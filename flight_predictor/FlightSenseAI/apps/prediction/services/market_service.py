"""
Market Service - Core prediction market engine with AMM (Automated Market Maker) pricing.
Creates and manages markets for flight events.
Now uses Supabase for persistent storage.
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional
from decimal import Decimal

from models.trading_models import (
    Market, MarketStatus, MarketOutcome, FlightEventType, FlightData
)
from services.aviationstack_service import aviationstack_service
from services.supabase_client import get_supabase
from services.ml_prediction_service import ml_prediction_service


class MarketService:
    """Service for managing prediction markets with Supabase persistence."""
    
    def __init__(self):
        self._initialized = False
    
    async def initialize_markets(self) -> int:
        """Initialize markets for popular flights. Called on startup."""
        if self._initialized:
            # Check if markets already exist in DB
            supabase = get_supabase()
            result = supabase.table("markets").select("id").limit(1).execute()
            if result.data:
                return len(result.data)
        
        flights = await aviationstack_service.get_popular_flights(count=8)
        
        for flight in flights:
            # Create multiple market types for each flight
            await self.create_market_for_flight(flight, FlightEventType.ON_TIME)
            await self.create_market_for_flight(flight, FlightEventType.DELAY_30_MIN)
            if flight.flight_status not in ["cancelled"]:
                await self.create_market_for_flight(flight, FlightEventType.CANCELLATION)
        
        self._initialized = True
        
        # Get count from DB
        supabase = get_supabase()
        result = supabase.table("markets").select("id").execute()
        return len(result.data) if result.data else 0
    
    async def create_market_for_flight(
        self,
        flight: FlightData,
        event_type: FlightEventType,
    ) -> dict:
        """Create a prediction market for a specific flight event."""
        supabase = get_supabase()
        
        # Check if market already exists for this flight/event
        existing = supabase.table("markets").select("id").eq(
            "flight_iata", flight.flight_iata
        ).eq("event_type", event_type.value).execute()
        
        if existing.data:
            return existing.data[0]
        
        # Generate question based on event type
        question = self._generate_question(flight, event_type)
        description = self._generate_description(flight, event_type)
        
        # Set initial prices based on historical patterns and current status
        yes_price, no_price = self._calculate_initial_prices(flight, event_type)
        
        # Get ML prediction for win probability
        prediction = await ml_prediction_service.predict_disruption_probability(
            departure_airport=flight.departure_iata,
            arrival_airport=flight.arrival_iata,
            scheduled_departure=flight.departure_scheduled or datetime.utcnow(),
            event_type=event_type.value,
        )
        
        market_data = {
            "flight_iata": flight.flight_iata,
            "departure_airport": flight.departure_iata,
            "arrival_airport": flight.arrival_iata,
            "scheduled_departure": flight.departure_scheduled.isoformat() if flight.departure_scheduled else None,
            "event_type": event_type.value,
            "question": question,
            "description": description,
            "yes_pool": float(1000.0 * (1 - yes_price)),  # AMM liquidity in SOL
            "no_pool": float(1000.0 * yes_price),
            "volume": 0.0,
            "status": "active",
            "win_probability": prediction.get("probability", yes_price),
            "weather_risk_score": prediction.get("components", {}).get("weather", 0),
        }
        
        result = supabase.table("markets").insert(market_data).execute()
        return result.data[0] if result.data else market_data
    
    def _generate_question(self, flight: FlightData, event_type: FlightEventType) -> str:
        """Generate the market question."""
        route = f"{flight.departure_iata} → {flight.arrival_iata}"
        
        questions = {
            FlightEventType.ON_TIME: f"Will {flight.flight_iata} ({route}) depart on time?",
            FlightEventType.DELAY_30_MIN: f"Will {flight.flight_iata} ({route}) be delayed 30+ minutes?",
            FlightEventType.DELAY_1_HOUR: f"Will {flight.flight_iata} ({route}) be delayed 1+ hour?",
            FlightEventType.DELAY_2_HOURS: f"Will {flight.flight_iata} ({route}) be delayed 2+ hours?",
            FlightEventType.CANCELLATION: f"Will {flight.flight_iata} ({route}) be cancelled?",
        }
        return questions.get(event_type, f"Will event occur for {flight.flight_iata}?")
    
    def _generate_description(self, flight: FlightData, event_type: FlightEventType) -> str:
        """Generate market description."""
        dep_time = "TBD"
        if flight.departure_scheduled:
            dep_time = flight.departure_scheduled.strftime("%b %d, %Y at %I:%M %p")
        
        return (
            f"{flight.airline_name} flight {flight.flight_iata} from "
            f"{flight.departure_airport} ({flight.departure_iata}) to "
            f"{flight.arrival_airport} ({flight.arrival_iata}). "
            f"Scheduled departure: {dep_time}. "
            f"Current status: {flight.flight_status}."
        )
    
    def _calculate_initial_prices(
        self,
        flight: FlightData,
        event_type: FlightEventType,
    ) -> tuple[float, float]:
        """Calculate initial YES/NO prices based on flight status and historical patterns."""
        # Base probabilities (historical averages)
        base_probs = {
            FlightEventType.ON_TIME: 0.75,
            FlightEventType.DELAY_30_MIN: 0.20,
            FlightEventType.DELAY_1_HOUR: 0.10,
            FlightEventType.DELAY_2_HOURS: 0.05,
            FlightEventType.CANCELLATION: 0.02,
        }
        
        yes_price = base_probs.get(event_type, 0.50)
        
        # Adjust based on current flight status
        if flight.flight_status == "delayed":
            if event_type == FlightEventType.ON_TIME:
                yes_price = 0.15
            elif event_type in [FlightEventType.DELAY_30_MIN, FlightEventType.DELAY_1_HOUR]:
                yes_price = 0.85
        elif flight.flight_status == "cancelled":
            if event_type == FlightEventType.CANCELLATION:
                yes_price = 0.99
            else:
                yes_price = 0.01
        
        yes_price = max(0.01, min(0.99, yes_price))
        no_price = 1.0 - yes_price
        
        return yes_price, no_price
    
    async def get_markets(
        self,
        status: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        """Get all markets with optional filtering."""
        supabase = get_supabase()
        
        query = supabase.table("markets").select("*")
        
        if status:
            query = query.eq("status", status)
        if event_type:
            query = query.eq("event_type", event_type)
        
        query = query.order("volume", desc=True).limit(limit)
        
        result = query.execute()
        return result.data or []
    
    async def get_market(self, market_id: str) -> Optional[dict]:
        """Get a specific market by ID."""
        supabase = get_supabase()
        result = supabase.table("markets").select("*").eq("id", market_id).execute()
        return result.data[0] if result.data else None
    
    def update_market(self, market_id: str, updates: dict) -> dict:
        """Update a market in storage."""
        supabase = get_supabase()
        updates["updated_at"] = datetime.utcnow().isoformat()
        result = supabase.table("markets").update(updates).eq("id", market_id).execute()
        return result.data[0] if result.data else updates
    
    def calculate_buy_price(
        self,
        market: dict,
        outcome: str,
        shares: float,
    ) -> tuple[float, float, float]:
        """
        Calculate the cost and new price for buying shares.
        Uses constant product AMM: x * y = k
        
        Returns: (cost, avg_price_per_share, new_yes_price)
        """
        yes_pool = float(market.get("yes_pool", 500))
        no_pool = float(market.get("no_pool", 500))
        
        if outcome == "YES":
            k = yes_pool * no_pool
            new_yes_pool = yes_pool - shares
            if new_yes_pool <= 0:
                raise ValueError("Insufficient liquidity")
            new_no_pool = k / new_yes_pool
            cost = new_no_pool - no_pool
        else:
            k = yes_pool * no_pool
            new_no_pool = no_pool - shares
            if new_no_pool <= 0:
                raise ValueError("Insufficient liquidity")
            new_yes_pool = k / new_no_pool
            cost = new_yes_pool - yes_pool
        
        avg_price = cost / shares if shares > 0 else 0
        new_yes_price = new_no_pool / (new_yes_pool + new_no_pool)
        
        return cost, avg_price, new_yes_price
    
    def calculate_sell_price(
        self,
        market: dict,
        outcome: str,
        shares: float,
    ) -> tuple[float, float, float]:
        """
        Calculate the payout and new price for selling shares.
        
        Returns: (payout, avg_price_per_share, new_yes_price)
        """
        yes_pool = float(market.get("yes_pool", 500))
        no_pool = float(market.get("no_pool", 500))
        
        if outcome == "YES":
            k = yes_pool * no_pool
            new_yes_pool = yes_pool + shares
            new_no_pool = k / new_yes_pool
            payout = no_pool - new_no_pool
        else:
            k = yes_pool * no_pool
            new_no_pool = no_pool + shares
            new_yes_pool = k / new_no_pool
            payout = yes_pool - new_yes_pool
        
        avg_price = payout / shares if shares > 0 else 0
        new_yes_price = new_no_pool / (new_yes_pool + new_no_pool)
        
        return max(0, payout), avg_price, new_yes_price
    
    def execute_buy(
        self,
        market: dict,
        outcome: str,
        shares: float,
    ) -> tuple[dict, float, float]:
        """
        Execute a buy order, updating the market state.
        
        Returns: (updated_market, cost, avg_price)
        """
        cost, avg_price, new_yes_price = self.calculate_buy_price(market, outcome, shares)
        
        yes_pool = float(market.get("yes_pool", 500))
        no_pool = float(market.get("no_pool", 500))
        volume = float(market.get("volume", 0))
        
        if outcome == "YES":
            k = yes_pool * no_pool
            yes_pool -= shares
            no_pool = k / yes_pool
        else:
            k = yes_pool * no_pool
            no_pool -= shares
            yes_pool = k / no_pool
        
        updates = {
            "yes_pool": yes_pool,
            "no_pool": no_pool,
            "volume": volume + cost,
        }
        
        updated = self.update_market(market["id"], updates)
        return updated, cost, avg_price
    
    def execute_sell(
        self,
        market: dict,
        outcome: str,
        shares: float,
    ) -> tuple[dict, float, float]:
        """
        Execute a sell order, updating the market state.
        
        Returns: (updated_market, payout, avg_price)
        """
        payout, avg_price, new_yes_price = self.calculate_sell_price(market, outcome, shares)
        
        yes_pool = float(market.get("yes_pool", 500))
        no_pool = float(market.get("no_pool", 500))
        volume = float(market.get("volume", 0))
        
        if outcome == "YES":
            k = yes_pool * no_pool
            yes_pool += shares
            no_pool = k / yes_pool
        else:
            k = yes_pool * no_pool
            no_pool += shares
            yes_pool = k / no_pool
        
        updates = {
            "yes_pool": yes_pool,
            "no_pool": no_pool,
            "volume": volume + payout,
        }
        
        updated = self.update_market(market["id"], updates)
        return updated, payout, avg_price
    
    async def resolve_market(
        self,
        market_id: str,
        outcome: str,
    ) -> dict:
        """Resolve a market with the final outcome."""
        updates = {
            "status": "resolved",
            "resolved_outcome": outcome,
        }
        return self.update_market(market_id, updates)
    
    def get_price(self, market: dict, outcome: str) -> float:
        """Get current price for an outcome."""
        yes_pool = float(market.get("yes_pool", 500))
        no_pool = float(market.get("no_pool", 500))
        total = yes_pool + no_pool
        
        if total == 0:
            return 0.5
        
        if outcome == "YES":
            return no_pool / total
        else:
            return yes_pool / total


# Singleton instance
market_service = MarketService()
