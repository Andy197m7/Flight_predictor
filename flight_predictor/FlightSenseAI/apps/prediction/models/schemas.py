"""
Pydantic models for the Prediction Engine.
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class DisruptionType(str, Enum):
    """Types of flight disruptions."""
    DELAY_MINOR = "delay_30min_2hr"
    DELAY_MAJOR = "delay_2hr_6hr"
    CANCELLATION = "cancellation"


class PredictionSource(str, Enum):
    """Sources of prediction signals."""
    POLYMARKET = "polymarket"
    WEATHER_API = "weather_api"
    SOCIAL_SENTIMENT = "social_sentiment"
    HISTORICAL = "historical"
    FAA_ATCSCC = "faa_atcscc"


class PredictionSignal(BaseModel):
    """A single prediction signal from a data source."""
    source: PredictionSource
    signal_id: str
    probability: float = Field(ge=0.0, le=1.0)
    weight: float = Field(ge=0.0, le=1.0, default=0.25)
    affected_airports: list[str] = []
    affected_routes: list[str] = []
    raw_data: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class FlightPrediction(BaseModel):
    """Aggregated prediction for a specific flight."""
    flight_id: str
    route: str  # e.g., "DFW-MIA"
    scheduled_departure: datetime
    disruption_type: DisruptionType
    disruption_probability: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    contributing_signals: list[PredictionSignal] = []
    recommendation: str = "monitor"  # monitor | proactive_outreach | urgent_action
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PolymarketEvent(BaseModel):
    """A Polymarket prediction market event."""
    market_id: str
    question: str
    outcome_prices: dict[str, float]  # {"Yes": 0.73, "No": 0.27}
    volume: float
    liquidity: float
    end_date: Optional[datetime] = None
    category: str = "weather"



