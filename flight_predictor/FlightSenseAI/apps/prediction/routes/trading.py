"""
Trading Routes - API endpoints for prediction market trading.
Includes market listing, order placement, positions, and wallet management.
Updated to use wallet address from headers for user identification.
"""
from fastapi import APIRouter, Query, HTTPException, Header
from typing import Optional
from pydantic import BaseModel

from services.market_service import market_service
from services.trading_service import trading_service


router = APIRouter()


# Request/Response Models
class OrderRequest(BaseModel):
    market_id: str
    outcome: str  # "YES" or "NO"
    shares: float
    side: str = "buy"  # "buy" or "sell"


class CashOutRequest(BaseModel):
    position_id: str
    shares: Optional[float] = None


# ============= Markets =============

@router.get("/markets")
async def get_markets(
    status: Optional[str] = Query(None, description="Filter by market status"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Get all prediction markets.
    Markets are auto-created for popular flights on startup.
    """
    markets = await market_service.get_markets(status=status, event_type=event_type, limit=limit)
    
    # Add calculated yes/no prices to each market
    for market in markets:
        yes_pool = float(market.get("yes_pool", 500))
        no_pool = float(market.get("no_pool", 500))
        total = yes_pool + no_pool
        if total > 0:
            market["yes_price"] = no_pool / total
            market["no_price"] = yes_pool / total
        else:
            market["yes_price"] = 0.5
            market["no_price"] = 0.5
    
    return markets


@router.get("/markets/{market_id}")
async def get_market(market_id: str):
    """Get details for a specific market."""
    market = await market_service.get_market(market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    
    # Add calculated prices
    yes_pool = float(market.get("yes_pool", 500))
    no_pool = float(market.get("no_pool", 500))
    total = yes_pool + no_pool
    if total > 0:
        market["yes_price"] = no_pool / total
        market["no_price"] = yes_pool / total
    
    return market


@router.get("/markets/{market_id}/price-preview")
async def preview_price(
    market_id: str,
    outcome: str = Query(..., pattern="^(YES|NO)$"),
    shares: float = Query(..., gt=0, le=1000),
    side: str = Query("buy", pattern="^(buy|sell)$"),
):
    """
    Preview the price impact of a trade without executing.
    Useful for showing estimated cost before confirming.
    """
    market = await market_service.get_market(market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    
    try:
        if side == "buy":
            cost, avg_price, new_price = market_service.calculate_buy_price(
                market, outcome, shares
            )
            return {
                "side": "buy",
                "outcome": outcome,
                "shares": shares,
                "estimated_cost_sol": round(cost, 6),
                "avg_price_per_share": round(avg_price, 6),
                "current_price": round(market_service.get_price(market, outcome), 6),
                "price_after_trade": round(new_price if outcome == "YES" else 1-new_price, 6),
            }
        else:
            payout, avg_price, new_price = market_service.calculate_sell_price(
                market, outcome, shares
            )
            return {
                "side": "sell",
                "outcome": outcome,
                "shares": shares,
                "estimated_payout_sol": round(payout, 6),
                "avg_price_per_share": round(avg_price, 6),
                "current_price": round(market_service.get_price(market, outcome), 6),
                "price_after_trade": round(new_price if outcome == "YES" else 1-new_price, 6),
            }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============= Orders & Trading =============

@router.post("/orders")
async def place_order(
    request: OrderRequest,
    wallet_address: str = Header(..., alias="wallet-address"),
):
    """
    Place a buy or sell order.
    
    - BUY: Purchase shares with wallet balance (in SOL)
    - SELL: Sell existing position shares for wallet credit
    
    Orders are executed immediately against the AMM.
    Requires wallet-address header for user identification.
    """
    try:
        response = await trading_service.place_order(
            wallet_address=wallet_address,
            market_id=request.market_id,
            outcome=request.outcome,
            shares=request.shares,
            side=request.side,
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders")
async def get_orders(
    wallet_address: str = Header(..., alias="wallet-address"),
    limit: int = Query(50, ge=1, le=100),
):
    """Get order history for the current user."""
    orders = await trading_service.get_orders(wallet_address, limit=limit)
    return orders


# ============= Positions =============

@router.get("/positions")
async def get_positions(
    wallet_address: str = Header(..., alias="wallet-address"),
):
    """Get all open positions for the current user."""
    positions = await trading_service.get_positions(wallet_address)
    return positions


@router.post("/positions/{position_id}/cashout")
async def cash_out_position(
    position_id: str,
    wallet_address: str = Header(..., alias="wallet-address"),
    shares: Optional[float] = Query(None, gt=0, description="Shares to sell, or all if not specified"),
):
    """
    Cash out (sell) some or all shares in a position.
    If shares not specified, sells entire position.
    """
    # This would need position lookup first to get market_id and outcome
    # For now, simplified version
    raise HTTPException(status_code=501, detail="Use /orders endpoint with side=sell instead")


# ============= Wallet & Portfolio =============

@router.get("/wallet")
async def get_wallet(
    wallet_address: str = Header(..., alias="wallet-address"),
):
    """Get the current user's wallet balance (in SOL)."""
    wallet = await trading_service.get_wallet(wallet_address)
    return wallet


@router.get("/portfolio")
async def get_portfolio(
    wallet_address: str = Header(..., alias="wallet-address"),
):
    """
    Get complete portfolio summary including:
    - Wallet balance (in SOL)
    - All positions with current value and P&L
    - Recent trade history
    """
    portfolio = await trading_service.get_portfolio(wallet_address)
    return portfolio


# ============= Admin / Debug =============

@router.post("/admin/initialize-markets")
async def initialize_markets():
    """Initialize markets for popular flights. Called on startup."""
    count = await market_service.initialize_markets()
    return {"status": "ok", "markets_created": count}


@router.post("/admin/resolve-market/{market_id}")
async def resolve_market(
    market_id: str,
    outcome: str = Query(..., pattern="^(YES|NO)$"),
):
    """Manually resolve a market (for testing/demo)."""
    try:
        market = await market_service.resolve_market(market_id, outcome)
        return {
            "status": "resolved",
            "market_id": market_id,
            "resolved_outcome": outcome,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
