"""
FlightSense AI - Prediction Engine
Main FastAPI application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.health import router as health_router
from routes.predictions import router as predictions_router
from routes.markets import router as markets_router
from routes.trading import router as trading_router
from services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="FlightSense Prediction Engine",
    description="Prediction market signal aggregation for flight disruption intelligence.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(predictions_router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(markets_router, prefix="/api/markets", tags=["Markets"])
app.include_router(trading_router, prefix="/api/trading", tags=["Trading"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
