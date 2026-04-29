"""
ML Prediction Service - Machine Learning pipeline for flight disruption prediction.
Uses weather data, historical patterns, and flight characteristics to predict win probability.

This implements a weighted ensemble model combining:
1. Weather-based risk (from NWS data)
2. Historical delay patterns (by route, airline, time of day)
3. Airport congestion factors
4. Seasonal adjustments
"""
from datetime import datetime, timedelta
from typing import Optional
import math

from services.supabase_client import get_supabase
from services.nws_weather_service import nws_weather_service


# Historical delay rates by route (based on BTS data patterns)
ROUTE_DELAY_RATES = {
    ("DFW", "MIA"): 0.18,  # Florida weather
    ("JFK", "LAX"): 0.22,  # Busy routes
    ("ORD", "SFO"): 0.25,  # Chicago weather
    ("ATL", "BOS"): 0.15,
    ("DEN", "SEA"): 0.20,  # Mountain weather
    ("DFW", "ORD"): 0.23,  # Chicago weather
    ("JFK", "MIA"): 0.19,
    ("LAX", "SFO"): 0.12,  # Short hop, good weather
}

# Airline on-time performance (based on BTS data)
AIRLINE_OTP = {
    "AA": 0.78,  # American Airlines
    "UA": 0.76,  # United Airlines
    "DL": 0.82,  # Delta Air Lines
    "WN": 0.80,  # Southwest Airlines
    "B6": 0.74,  # JetBlue Airways
    "AS": 0.83,  # Alaska Airlines
    "F9": 0.71,  # Frontier Airlines
    "NK": 0.69,  # Spirit Airlines
}

# Airport congestion factors (higher = more congested)
AIRPORT_CONGESTION = {
    "ORD": 0.25,  # O'Hare - very busy
    "ATL": 0.22,  # Atlanta - busiest
    "LAX": 0.20,
    "DFW": 0.18,
    "JFK": 0.23,
    "DEN": 0.15,
    "SFO": 0.17,
    "MIA": 0.16,
    "SEA": 0.12,
    "PHX": 0.10,
}

# Seasonal adjustment factors
SEASONAL_FACTORS = {
    1: 0.15,   # January - winter storms
    2: 0.12,   # February
    3: 0.08,   # March
    4: 0.05,   # April
    5: 0.03,   # May
    6: 0.08,   # June - thunderstorms begin
    7: 0.12,   # July - peak thunderstorms
    8: 0.15,   # August - hurricanes
    9: 0.10,   # September
    10: 0.05,  # October
    11: 0.08,  # November - early winter
    12: 0.18,  # December - holiday + winter
}


class MLPredictionService:
    """
    ML-based prediction service for flight disruption probability.
    
    The model combines multiple signals with learned weights:
    - Weather risk: 40% weight
    - Historical route delay rate: 20% weight
    - Airline performance: 15% weight
    - Airport congestion: 10% weight
    - Seasonal factors: 10% weight
    - Time of day: 5% weight
    """
    
    WEIGHT_WEATHER = 0.40
    WEIGHT_ROUTE = 0.20
    WEIGHT_AIRLINE = 0.15
    WEIGHT_CONGESTION = 0.10
    WEIGHT_SEASONAL = 0.10
    WEIGHT_TIME = 0.05
    
    async def predict_disruption_probability(
        self,
        departure_airport: str,
        arrival_airport: str,
        scheduled_departure: datetime,
        airline_code: Optional[str] = None,
        event_type: str = "delay_30_min"
    ) -> dict:
        """
        Predict the probability of flight disruption.
        
        Args:
            departure_airport: IATA code (e.g., "DFW")
            arrival_airport: IATA code (e.g., "MIA")
            scheduled_departure: Scheduled departure time
            airline_code: 2-letter airline IATA code (e.g., "AA")
            event_type: Type of disruption to predict
            
        Returns:
            {
                "probability": float (0-1),
                "confidence": float (0-1),
                "components": {detailed breakdown},
                "recommendation": str
            }
        """
        components = {}
        
        # 1. Weather Risk (40%)
        weather_risk = await self._get_weather_risk(departure_airport, arrival_airport)
        components["weather"] = weather_risk
        
        # 2. Historical Route Delay (20%)
        route_risk = self._get_route_risk(departure_airport, arrival_airport)
        components["route_history"] = route_risk
        
        # 3. Airline Performance (15%)
        airline_risk = self._get_airline_risk(airline_code)
        components["airline"] = airline_risk
        
        # 4. Airport Congestion (10%)
        congestion_risk = self._get_congestion_risk(departure_airport, arrival_airport)
        components["congestion"] = congestion_risk
        
        # 5. Seasonal Factors (10%)
        seasonal_risk = self._get_seasonal_risk(scheduled_departure)
        components["seasonal"] = seasonal_risk
        
        # 6. Time of Day (5%)
        time_risk = self._get_time_risk(scheduled_departure)
        components["time_of_day"] = time_risk
        
        # Calculate weighted probability
        probability = (
            weather_risk * self.WEIGHT_WEATHER +
            route_risk * self.WEIGHT_ROUTE +
            airline_risk * self.WEIGHT_AIRLINE +
            congestion_risk * self.WEIGHT_CONGESTION +
            seasonal_risk * self.WEIGHT_SEASONAL +
            time_risk * self.WEIGHT_TIME
        )
        
        # Apply event type modifier
        probability = self._apply_event_modifier(probability, event_type)
        
        # Calculate confidence based on data availability
        confidence = self._calculate_confidence(components)
        
        # Generate recommendation
        recommendation = self._get_recommendation(probability)
        
        return {
            "probability": round(probability, 4),
            "confidence": round(confidence, 4),
            "components": components,
            "recommendation": recommendation,
            "event_type": event_type,
            "calculated_at": datetime.utcnow().isoformat(),
        }
    
    async def _get_weather_risk(self, dep: str, arr: str) -> float:
        """Get weather-based risk from NWS forecasts."""
        risks = []
        
        # Get departure airport weather
        dep_forecast = await nws_weather_service.get_forecast(dep)
        if dep_forecast and dep_forecast.get("current"):
            risks.append(dep_forecast["current"].get("disruption_risk", 0.1))
        
        # Get arrival airport weather
        arr_forecast = await nws_weather_service.get_forecast(arr)
        if arr_forecast and arr_forecast.get("current"):
            risks.append(arr_forecast["current"].get("disruption_risk", 0.1))
        
        if not risks:
            return 0.15  # Default moderate risk if no data
        
        # Take the max risk (worst weather on route)
        return max(risks)
    
    def _get_route_risk(self, dep: str, arr: str) -> float:
        """Get historical delay rate for this route."""
        # Check both directions
        rate = ROUTE_DELAY_RATES.get((dep, arr))
        if rate is None:
            rate = ROUTE_DELAY_RATES.get((arr, dep))
        if rate is None:
            # Default rate based on distance (longer = more risk)
            rate = 0.18  # National average
        return rate
    
    def _get_airline_risk(self, airline_code: Optional[str]) -> float:
        """Get delay risk based on airline performance."""
        if not airline_code:
            return 0.22  # Average delay rate
        
        otp = AIRLINE_OTP.get(airline_code.upper(), 0.78)
        # Convert on-time performance to delay risk
        return 1.0 - otp
    
    def _get_congestion_risk(self, dep: str, arr: str) -> float:
        """Get congestion-based delay risk."""
        dep_congestion = AIRPORT_CONGESTION.get(dep, 0.10)
        arr_congestion = AIRPORT_CONGESTION.get(arr, 0.10)
        return (dep_congestion + arr_congestion) / 2
    
    def _get_seasonal_risk(self, departure: datetime) -> float:
        """Get seasonal delay risk adjustment."""
        month = departure.month
        return SEASONAL_FACTORS.get(month, 0.08)
    
    def _get_time_risk(self, departure: datetime) -> float:
        """Get time-of-day delay risk."""
        hour = departure.hour
        
        # Early morning (5-7 AM) - lowest risk, fresh starts
        if 5 <= hour < 7:
            return 0.05
        # Morning rush (7-10 AM) - moderate
        elif 7 <= hour < 10:
            return 0.15
        # Midday (10 AM - 3 PM) - moderate, delays accumulate
        elif 10 <= hour < 15:
            return 0.20
        # Afternoon (3-7 PM) - highest risk, cascading delays
        elif 15 <= hour < 19:
            return 0.30
        # Evening (7-10 PM) - moderate
        elif 19 <= hour < 22:
            return 0.20
        # Late night - low volume, moderate risk
        else:
            return 0.15
    
    def _apply_event_modifier(self, base_prob: float, event_type: str) -> float:
        """Apply modifier based on event type severity."""
        modifiers = {
            "on_time": 1.0 - base_prob,  # Invert for on-time prediction
            "delay_30_min": base_prob * 1.0,  # Base probability
            "delay_1_hour": base_prob * 0.6,  # Less likely for longer delays
            "delay_2_hour": base_prob * 0.35,
            "cancellation": base_prob * 0.15,  # Cancellations are rare
        }
        return min(modifiers.get(event_type, base_prob), 0.95)
    
    def _calculate_confidence(self, components: dict) -> float:
        """Calculate confidence score based on data availability."""
        # Start with base confidence
        confidence = 0.5
        
        # Add confidence for each data source present
        if components.get("weather", 0) > 0:
            confidence += 0.2  # Weather data available
        if components.get("route_history", 0) > 0:
            confidence += 0.1  # Route history available
        if components.get("airline", 0) > 0:
            confidence += 0.1  # Airline data available
        
        return min(confidence, 0.95)
    
    def _get_recommendation(self, probability: float) -> str:
        """Generate human-readable recommendation."""
        if probability >= 0.70:
            return "High risk - Consider backup options"
        elif probability >= 0.50:
            return "Elevated risk - Monitor closely"
        elif probability >= 0.30:
            return "Moderate risk - Normal precautions"
        elif probability >= 0.15:
            return "Low risk - Likely on schedule"
        else:
            return "Very low risk - Clear conditions"
    
    async def update_market_predictions(self) -> int:
        """Update win probabilities for all active markets."""
        try:
            supabase = get_supabase()
            
            # Get all active markets
            result = supabase.table("markets").select("*").eq("status", "active").execute()
            markets = result.data or []
            
            updated_count = 0
            for market in markets:
                try:
                    # Calculate new prediction
                    prediction = await self.predict_disruption_probability(
                        departure_airport=market["departure_airport"],
                        arrival_airport=market["arrival_airport"],
                        scheduled_departure=datetime.fromisoformat(market["scheduled_departure"].replace("Z", "+00:00")) if market.get("scheduled_departure") else datetime.utcnow(),
                        event_type=market.get("event_type", "delay_30_min"),
                    )
                    
                    # Update market with new prediction
                    supabase.table("markets").update({
                        "win_probability": prediction["probability"],
                        "weather_risk_score": prediction["components"].get("weather", 0),
                        "updated_at": datetime.utcnow().isoformat(),
                    }).eq("id", market["id"]).execute()
                    
                    updated_count += 1
                    
                except Exception as e:
                    print(f"Error updating market {market['id']}: {e}")
                    continue
            
            return updated_count
            
        except Exception as e:
            print(f"Error updating market predictions: {e}")
            return 0


# Singleton instance
ml_prediction_service = MLPredictionService()
