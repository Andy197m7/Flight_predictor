# Routes package
from routes.health import router as health_router
from routes.predictions import router as predictions_router
from routes.markets import router as markets_router

__all__ = ["health_router", "predictions_router", "markets_router"]
