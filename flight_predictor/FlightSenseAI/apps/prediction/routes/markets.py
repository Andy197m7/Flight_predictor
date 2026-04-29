"""
Market routes - Polymarket prediction market data.
"""
from fastapi import APIRouter, Query
from typing import Optional

from models import PolymarketEvent
from services.polymarket_service import polymarket_service

router = APIRouter()


@router.get("/", response_model=list[PolymarketEvent])
async def get_markets(
    category: Optional[str] = Query(None, description="Filter by category (weather, travel, etc.)"),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Get relevant prediction markets from Polymarket.
    These are used as signals for disruption prediction.
    """
    markets = await polymarket_service.get_relevant_markets(category=category, limit=limit)
    return markets


@router.get("/{market_id}", response_model=PolymarketEvent)
async def get_market(market_id: str):
    """Get details for a specific market."""
    market = await polymarket_service.get_market(market_id)
    return market


@router.post("/sync")
async def sync_markets():
    """
    Sync latest markets from Polymarket.
    Called periodically by the scheduler.
    """
    count = await polymarket_service.sync_markets()
    return {"status": "ok", "markets_synced": count}
