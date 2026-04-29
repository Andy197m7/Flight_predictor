"""
Polymarket Service - Integration with Polymarket prediction markets.
Fetches and processes market data for disruption signal generation.
"""
import httpx
from datetime import datetime
from typing import Optional

from config import config
from models import PolymarketEvent, PredictionSignal, PredictionSource


# Keywords to filter relevant markets
RELEVANT_KEYWORDS = [
    "hurricane", "storm", "weather", "flight", "airline", "airport",
    "travel", "faa", "aviation", "tornado", "blizzard", "delay",
]

# Mapping of market categories to affected airports
WEATHER_AIRPORT_MAP = {
    "florida": ["MIA", "FLL", "TPA", "MCO", "JAX"],
    "texas": ["DFW", "IAH", "AUS", "SAT", "HOU"],
    "california": ["LAX", "SFO", "SAN", "SJC"],
    "new york": ["JFK", "LGA", "EWR"],
    "chicago": ["ORD", "MDW"],
}


class PolymarketService:
    """Service for interacting with Polymarket API."""

    def __init__(self):
        self.base_url = config.polymarket_api_url
        self._markets_cache: list[PolymarketEvent] = []

    async def get_relevant_markets(
        self,
        category: Optional[str] = None,
        limit: int = 20,
    ) -> list[PolymarketEvent]:
        """Get markets relevant to flight disruptions."""
        # For hackathon demo: return cached/mock data if no API available
        if not self._markets_cache:
            await self.sync_markets()
        
        markets = self._markets_cache
        
        if category:
            markets = [m for m in markets if m.category == category]
        
        return markets[:limit]

    async def get_market(self, market_id: str) -> Optional[PolymarketEvent]:
        """Get a specific market by ID."""
        for market in self._markets_cache:
            if market.market_id == market_id:
                return market
        return None

    async def sync_markets(self) -> int:
        """
        Sync markets from Polymarket API.
        Filters for weather/travel related markets.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Polymarket CLOB API endpoint for markets
                response = await client.get(
                    f"{self.base_url}/markets",
                    params={"limit": 100},
                )
                
                if response.status_code != 200:
                    # Fall back to mock data for demo
                    self._markets_cache = self._get_mock_markets()
                    return len(self._markets_cache)
                
                data = response.json()
                markets = []
                
                for item in data:
                    # Filter for relevant markets
                    question = item.get("question", "").lower()
                    if not any(kw in question for kw in RELEVANT_KEYWORDS):
                        continue
                    
                    market = PolymarketEvent(
                        market_id=item.get("condition_id", item.get("id", "")),
                        question=item.get("question", ""),
                        outcome_prices=self._parse_outcomes(item),
                        volume=float(item.get("volume", 0)),
                        liquidity=float(item.get("liquidity", 0)),
                        end_date=self._parse_date(item.get("end_date_iso")),
                        category=self._categorize_market(question),
                    )
                    markets.append(market)
                
                self._markets_cache = markets
                return len(markets)
                
        except Exception as e:
            print(f"Error syncing Polymarket: {e}")
            # Fall back to mock data for demo
            self._markets_cache = self._get_mock_markets()
            return len(self._markets_cache)

    def _parse_outcomes(self, item: dict) -> dict[str, float]:
        """Parse outcome prices from market data."""
        tokens = item.get("tokens", [])
        if tokens:
            return {t.get("outcome", "Yes"): float(t.get("price", 0.5)) for t in tokens}
        return {"Yes": 0.5, "No": 0.5}

    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse ISO date string."""
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except:
            return None

    def _categorize_market(self, question: str) -> str:
        """Categorize a market based on its question."""
        question = question.lower()
        if any(kw in question for kw in ["hurricane", "storm", "weather", "tornado", "blizzard"]):
            return "weather"
        if any(kw in question for kw in ["flight", "airline", "airport", "faa", "aviation"]):
            return "travel"
        return "other"

    def _get_mock_markets(self) -> list[PolymarketEvent]:
        """Return mock markets for demo purposes."""
        return [
            PolymarketEvent(
                market_id="hurricane-helene-florida",
                question="Will Hurricane Helene make landfall in Florida before Feb 1?",
                outcome_prices={"Yes": 0.73, "No": 0.27},
                volume=125000.0,
                liquidity=45000.0,
                end_date=datetime(2026, 2, 1),
                category="weather",
            ),
            PolymarketEvent(
                market_id="winter-storm-chicago",
                question="Will Chicago experience a major winter storm in January 2026?",
                outcome_prices={"Yes": 0.58, "No": 0.42},
                volume=85000.0,
                liquidity=32000.0,
                end_date=datetime(2026, 1, 31),
                category="weather",
            ),
            PolymarketEvent(
                market_id="faa-ground-stop-northeast",
                question="Will FAA issue ground stop for Northeast airports in next 48 hours?",
                outcome_prices={"Yes": 0.22, "No": 0.78},
                volume=42000.0,
                liquidity=18000.0,
                end_date=datetime(2026, 1, 26),
                category="travel",
            ),
        ]

    def market_to_signal(self, market: PolymarketEvent) -> PredictionSignal:
        """Convert a market to a prediction signal."""
        # Determine affected airports based on market
        affected_airports = []
        question_lower = market.question.lower()
        for region, airports in WEATHER_AIRPORT_MAP.items():
            if region in question_lower:
                affected_airports.extend(airports)
        
        return PredictionSignal(
            source=PredictionSource.POLYMARKET,
            signal_id=market.market_id,
            probability=market.outcome_prices.get("Yes", 0.5),
            weight=0.45,  # High weight for prediction markets
            affected_airports=affected_airports,
            affected_routes=[],
            raw_data=market.model_dump(),
        )


# Singleton instance
polymarket_service = PolymarketService()
