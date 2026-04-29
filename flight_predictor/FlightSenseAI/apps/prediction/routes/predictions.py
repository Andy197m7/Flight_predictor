"""
Prediction routes - flight disruption predictions.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from models import FlightPrediction, DisruptionType
from services.prediction_service import prediction_service

router = APIRouter()


@router.get("/", response_model=list[FlightPrediction])
async def get_predictions(
    airport: Optional[str] = Query(None, description="Filter by airport code (e.g., DFW)"),
    min_probability: float = Query(0.0, ge=0, le=1, description="Minimum disruption probability"),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Get flight disruption predictions.
    Returns flights sorted by disruption probability (highest first).
    """
    predictions = await prediction_service.get_predictions(
        airport=airport,
        min_probability=min_probability,
        limit=limit,
    )
    return predictions


@router.get("/{flight_id}", response_model=FlightPrediction)
async def get_flight_prediction(flight_id: str):
    """Get prediction for a specific flight."""
    prediction = await prediction_service.get_flight_prediction(flight_id)
    if not prediction:
        raise HTTPException(status_code=404, detail=f"Flight {flight_id} not found")
    return prediction


@router.post("/refresh")
async def refresh_predictions():
    """
    Manually trigger a prediction refresh.
    Useful for testing; in production this runs on a schedule.
    """
    await prediction_service.refresh_all_predictions()
    return {"status": "ok", "message": "Predictions refreshed"}
