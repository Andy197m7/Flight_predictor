"""
Prediction Service - Core aggregation logic.
Combines signals from multiple sources to generate flight disruption predictions.
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional

from config import config
from models import (
    FlightPrediction,
    PredictionSignal,
    PredictionSource,
    DisruptionType,
)
from services.polymarket_service import polymarket_service
from services.weather_service import weather_service


class PredictionService:
    """
    Core prediction aggregation service.
    Implements the weighted scoring algorithm from the PRD.
    """

    def __init__(self):
        self._predictions_cache: dict[str, FlightPrediction] = {}
        self._signals_cache: list[PredictionSignal] = []

    async def get_predictions(
        self,
        airport: Optional[str] = None,
        min_probability: float = 0.0,
        limit: int = 50,
    ) -> list[FlightPrediction]:
        """Get current flight predictions."""
        predictions = list(self._predictions_cache.values())
        
        # Filter by airport
        if airport:
            predictions = [
                p for p in predictions
                if airport in p.route
            ]
        
        # Filter by probability
        predictions = [p for p in predictions if p.disruption_probability >= min_probability]
        
        # Sort by probability (highest first)
        predictions.sort(key=lambda p: p.disruption_probability, reverse=True)
        
        return predictions[:limit]

    async def get_flight_prediction(self, flight_id: str) -> Optional[FlightPrediction]:
        """Get prediction for a specific flight."""
        return self._predictions_cache.get(flight_id)

    async def refresh_all_predictions(self) -> None:
        """
        Refresh all predictions by aggregating signals from all sources.
        This is the core algorithm that combines prediction market data,
        weather data, and historical patterns.
        """
        # 1. Gather signals from all sources
        signals: list[PredictionSignal] = []
        
        # Polymarket signals
        markets = await polymarket_service.get_relevant_markets()
        for market in markets:
            signal = polymarket_service.market_to_signal(market)
            signals.append(signal)
        
        # Weather signals for major airports
        major_airports = ["DFW", "MIA", "LAX", "JFK", "ORD", "ATL", "SFO", "DEN"]
        weather_signals = await weather_service.get_weather_signals(major_airports)
        signals.extend(weather_signals)
        
        # Add historical pattern signals (mock for hackathon)
        historical_signals = self._get_historical_signals()
        signals.extend(historical_signals)
        
        self._signals_cache = signals
        
        # 2. Generate flight predictions
        flights = self._get_monitored_flights()
        
        for flight in flights:
            prediction = self._calculate_prediction(flight, signals)
            self._predictions_cache[flight["flight_id"]] = prediction
            
            # 3. Check if alert threshold exceeded
            # if prediction.disruption_probability >= config.disruption_alert_threshold:
            #     await self._trigger_alert(prediction)

    def _calculate_prediction(
        self,
        flight: dict,
        signals: list[PredictionSignal],
    ) -> FlightPrediction:
        """
        Calculate disruption probability for a flight.
        Uses weighted average of relevant signals.
        """
        route = flight["route"]
        departure_airport = route.split("-")[0]
        arrival_airport = route.split("-")[1] if "-" in route else ""
        
        # Find relevant signals for this flight
        relevant_signals = []
        for signal in signals:
            if (
                departure_airport in signal.affected_airports
                or arrival_airport in signal.affected_airports
                or route in signal.affected_routes
            ):
                relevant_signals.append(signal)
        
        # Calculate weighted probability
        if not relevant_signals:
            probability = 0.1  # Base probability
            confidence = 0.3
        else:
            total_weight = sum(s.weight for s in relevant_signals)
            weighted_sum = sum(s.probability * s.weight for s in relevant_signals)
            probability = weighted_sum / total_weight if total_weight > 0 else 0.1
            confidence = min(0.5 + (len(relevant_signals) * 0.1), 0.95)
        
        # Determine disruption type based on probability
        if probability >= 0.7:
            disruption_type = DisruptionType.CANCELLATION
        elif probability >= 0.5:
            disruption_type = DisruptionType.DELAY_MAJOR
        else:
            disruption_type = DisruptionType.DELAY_MINOR
        
        # Determine recommendation
        if probability >= config.disruption_alert_threshold:
            recommendation = "proactive_outreach"
        elif probability >= 0.5:
            recommendation = "monitor"
        else:
            recommendation = "no_action"
        
        return FlightPrediction(
            flight_id=flight["flight_id"],
            route=route,
            scheduled_departure=datetime.fromisoformat(flight["departure"]),
            disruption_type=disruption_type,
            disruption_probability=round(probability, 2),
            confidence=round(confidence, 2),
            contributing_signals=relevant_signals,
            recommendation=recommendation,
        )


    def _get_disruption_reason(self, prediction: FlightPrediction) -> str:
        """Get human-readable reason for disruption."""
        for signal in prediction.contributing_signals:
            if signal.source == PredictionSource.WEATHER_API:
                return "adverse weather conditions"
            if signal.source == PredictionSource.POLYMARKET:
                return "anticipated severe weather"
        return "operational factors"

    def _get_historical_signals(self) -> list[PredictionSignal]:
        """Get historical pattern signals (mock data for hackathon)."""
        return [
            PredictionSignal(
                source=PredictionSource.HISTORICAL,
                signal_id="hist-dfw-winter",
                probability=0.25,
                weight=0.20,
                affected_airports=["DFW"],
                raw_data={"pattern": "winter_delays", "historical_rate": 0.25},
            ),
            PredictionSignal(
                source=PredictionSource.HISTORICAL,
                signal_id="hist-mia-hurricane",
                probability=0.40,
                weight=0.20,
                affected_airports=["MIA", "FLL"],
                raw_data={"pattern": "hurricane_season", "historical_rate": 0.40},
            ),
        ]

    def _get_monitored_flights(self) -> list[dict]:
        """Get list of flights to monitor (mock data for hackathon)."""
        now = datetime.utcnow()
        return [
            {
                "flight_id": "AA1234",
                "route": "DFW-MIA",
                "departure": (now + timedelta(hours=6)).isoformat(),
            },
            {
                "flight_id": "AA2093",
                "route": "DFW-LAX",
                "departure": (now + timedelta(hours=4)).isoformat(),
            },
            {
                "flight_id": "AA5678",
                "route": "MIA-JFK",
                "departure": (now + timedelta(hours=8)).isoformat(),
            },
            {
                "flight_id": "AA3456",
                "route": "ORD-DFW",
                "departure": (now + timedelta(hours=5)).isoformat(),
            },
            {
                "flight_id": "AA7890",
                "route": "LAX-SFO",
                "departure": (now + timedelta(hours=3)).isoformat(),
            },
        ]


# Singleton instance
prediction_service = PredictionService()
