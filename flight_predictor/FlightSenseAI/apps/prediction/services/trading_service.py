"""
Trading Service - Handles user orders, positions, and wallet management.
Uses Supabase for persistent storage. Users are identified by wallet address.
"""
import uuid
from datetime import datetime
from typing import Optional

from services.supabase_client import get_supabase, get_or_create_wallet
from services.market_service import market_service


class TradingService:
    """Service for handling user trades and positions with Supabase persistence."""
    
    async def get_wallet(self, wallet_address: str) -> dict:
        """Get or create a wallet for a user."""
        return await get_or_create_wallet(wallet_address)
    
    async def place_order(
        self,
        wallet_address: str,
        market_id: str,
        outcome: str,
        shares: float,
        side: str = "buy",
    ) -> dict:
        """
        Place a buy or sell order.
        For buys: deduct from wallet, add to position
        For sells: reduce position, add to wallet
        """
        supabase = get_supabase()
        
        # Get wallet
        wallet = await self.get_wallet(wallet_address)
        
        # Get the market
        market = await market_service.get_market(market_id)
        if not market:
            raise ValueError(f"Market {market_id} not found")
        
        if market.get("status") != "active":
            raise ValueError(f"Market is not active (status: {market.get('status')})")
        
        if side == "buy":
            return await self._execute_buy(wallet, market, outcome, shares)
        else:
            return await self._execute_sell(wallet, market, outcome, shares)
    
    async def _execute_buy(
        self,
        wallet: dict,
        market: dict,
        outcome: str,
        shares: float,
    ) -> dict:
        """Execute a buy order."""
        supabase = get_supabase()
        
        # Calculate cost
        cost, avg_price, _ = market_service.calculate_buy_price(market, outcome, shares)
        
        # Check wallet balance
        available = float(wallet.get("balance", 0)) - float(wallet.get("locked_balance", 0))
        if cost > available:
            raise ValueError(
                f"Insufficient balance. Cost: {cost:.4f} SOL, "
                f"Available: {available:.4f} SOL"
            )
        
        # Execute on market (updates pools)
        updated_market, actual_cost, actual_price = market_service.execute_buy(
            market, outcome, shares
        )
        
        # Update wallet balance
        new_balance = float(wallet["balance"]) - actual_cost
        supabase.table("wallets").update({
            "balance": new_balance,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("wallet_address", wallet["wallet_address"]).execute()
        
        # Create order record
        order = {
            "wallet_address": wallet["wallet_address"],
            "market_id": market["id"],
            "side": "buy",
            "outcome": outcome,
            "shares": shares,
            "price": actual_price,
            "cost": actual_cost,
            "status": "filled",
        }
        order_result = supabase.table("orders").insert(order).execute()
        order_data = order_result.data[0] if order_result.data else order
        
        # Update or create position
        await self._update_position(
            wallet["wallet_address"],
            market["id"],
            outcome,
            shares,
            actual_price,
            is_buy=True,
        )
        
        return {
            "order": order_data,
            "new_balance": new_balance,
            "message": f"Bought {shares} {outcome} shares for {actual_cost:.4f} SOL",
        }
    
    async def _execute_sell(
        self,
        wallet: dict,
        market: dict,
        outcome: str,
        shares: float,
    ) -> dict:
        """Execute a sell order (cash out position)."""
        supabase = get_supabase()
        
        # Find user's position
        position = await self._get_position(wallet["wallet_address"], market["id"], outcome)
        if not position or float(position.get("shares", 0)) < shares:
            available = float(position.get("shares", 0)) if position else 0
            raise ValueError(
                f"Insufficient shares. Requested: {shares}, "
                f"Available: {available}"
            )
        
        # Calculate payout
        payout, avg_price, _ = market_service.calculate_sell_price(market, outcome, shares)
        
        # Execute on market (updates pools)
        updated_market, actual_payout, actual_price = market_service.execute_sell(
            market, outcome, shares
        )
        
        # Update wallet balance
        new_balance = float(wallet["balance"]) + actual_payout
        supabase.table("wallets").update({
            "balance": new_balance,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("wallet_address", wallet["wallet_address"]).execute()
        
        # Create order record
        order = {
            "wallet_address": wallet["wallet_address"],
            "market_id": market["id"],
            "side": "sell",
            "outcome": outcome,
            "shares": shares,
            "price": actual_price,
            "cost": actual_payout,
            "status": "filled",
        }
        order_result = supabase.table("orders").insert(order).execute()
        order_data = order_result.data[0] if order_result.data else order
        
        # Update position
        await self._update_position(
            wallet["wallet_address"],
            market["id"],
            outcome,
            shares,
            actual_price,
            is_buy=False,
        )
        
        return {
            "order": order_data,
            "new_balance": new_balance,
            "message": f"Sold {shares} {outcome} shares for {actual_payout:.4f} SOL",
        }
    
    async def _get_position(
        self,
        wallet_address: str,
        market_id: str,
        outcome: str,
    ) -> Optional[dict]:
        """Get a user's position in a market."""
        supabase = get_supabase()
        result = supabase.table("positions").select("*").eq(
            "wallet_address", wallet_address
        ).eq("market_id", market_id).eq("outcome", outcome).execute()
        
        return result.data[0] if result.data else None
    
    async def _update_position(
        self,
        wallet_address: str,
        market_id: str,
        outcome: str,
        shares: float,
        price: float,
        is_buy: bool,
    ) -> dict:
        """Update or create a position."""
        supabase = get_supabase()
        
        existing = await self._get_position(wallet_address, market_id, outcome)
        
        if existing:
            current_shares = float(existing.get("shares", 0))
            current_avg = float(existing.get("avg_price", 0))
            
            if is_buy:
                # Add shares, update average price
                total_cost = (current_shares * current_avg) + (shares * price)
                new_shares = current_shares + shares
                new_avg = total_cost / new_shares if new_shares > 0 else 0
            else:
                # Remove shares
                new_shares = current_shares - shares
                new_avg = current_avg  # Keep same avg price
            
            if new_shares <= 0:
                # Delete position if empty
                supabase.table("positions").delete().eq("id", existing["id"]).execute()
                return {}
            
            result = supabase.table("positions").update({
                "shares": new_shares,
                "avg_price": new_avg,
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", existing["id"]).execute()
            
            return result.data[0] if result.data else {}
        
        elif is_buy:
            # Create new position
            position = {
                "wallet_address": wallet_address,
                "market_id": market_id,
                "outcome": outcome,
                "shares": shares,
                "avg_price": price,
            }
            result = supabase.table("positions").insert(position).execute()
            return result.data[0] if result.data else position
        
        return {}
    
    async def get_positions(
        self,
        wallet_address: str,
    ) -> list[dict]:
        """Get all positions for a user with current values."""
        supabase = get_supabase()
        
        result = supabase.table("positions").select(
            "*, markets(id, flight_iata, question, yes_pool, no_pool, status)"
        ).eq("wallet_address", wallet_address).gt("shares", 0).execute()
        
        positions = []
        for pos in result.data or []:
            market = pos.pop("markets", {})
            if market:
                # Calculate current value
                current_price = market_service.get_price(market, pos["outcome"])
                pos["current_price"] = current_price
                pos["current_value"] = float(pos["shares"]) * current_price
                pos["unrealized_pnl"] = pos["current_value"] - (float(pos["shares"]) * float(pos["avg_price"]))
                pos["market"] = market
            positions.append(pos)
        
        return positions
    
    async def get_orders(
        self,
        wallet_address: str,
        limit: int = 50,
    ) -> list[dict]:
        """Get order history for a user."""
        supabase = get_supabase()
        
        result = supabase.table("orders").select(
            "*, markets(id, flight_iata, question)"
        ).eq("wallet_address", wallet_address).order(
            "created_at", desc=True
        ).limit(limit).execute()
        
        return result.data or []
    
    async def get_portfolio(
        self,
        wallet_address: str,
    ) -> dict:
        """Get complete portfolio summary for a user."""
        wallet = await self.get_wallet(wallet_address)
        positions = await self.get_positions(wallet_address)
        
        total_value = sum(p.get("current_value", 0) for p in positions)
        total_pnl = sum(p.get("unrealized_pnl", 0) for p in positions)
        
        # Get recent orders
        orders = await self.get_orders(wallet_address, limit=10)
        
        return {
            "wallet": wallet,
            "positions": positions,
            "total_position_value": total_value,
            "total_unrealized_pnl": total_pnl,
            "recent_orders": orders,
        }


# Singleton instance
trading_service = TradingService()
