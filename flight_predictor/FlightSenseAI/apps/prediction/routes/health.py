"""
Health check routes.
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": "flightsense-prediction-engine",
        "version": "0.1.0",
    }
