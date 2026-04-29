"""
Supabase Client - Singleton client for Supabase database operations.
Used for persisting markets, wallets, positions, orders, and weather data.
"""
from functools import lru_cache
from typing import Optional
from supabase import create_client, Client

from config import config


_client: Optional[Client] = None


def get_supabase() -> Client:
    """Get or create Supabase client singleton."""
    global _client
    if _client is None:
        if not config.supabase_url or not config.supabase_anon_key:
            raise ValueError(
                "Supabase credentials not configured. "
                "Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
            )
        _client = create_client(config.supabase_url, config.supabase_anon_key)
    return _client


def reset_client():
    """Reset the client (useful for testing)."""
    global _client
    _client = None


# Helper functions for common operations
async def get_or_create_wallet(wallet_address: str) -> dict:
    """Get or create a wallet for a user."""
    supabase = get_supabase()
    
    # Try to get existing wallet
    result = supabase.table("wallets").select("*").eq("wallet_address", wallet_address).execute()
    
    if result.data:
        return result.data[0]
    
    # Create new wallet with starting balance
    new_wallet = {
        "wallet_address": wallet_address,
        "balance": 100.0,
        "locked_balance": 0.0,
    }
    result = supabase.table("wallets").insert(new_wallet).execute()
    return result.data[0]


async def get_airport_coords(iata_code: str) -> Optional[dict]:
    """Get airport coordinates from database."""
    supabase = get_supabase()
    result = supabase.table("airports").select("*").eq("iata_code", iata_code).execute()
    
    if result.data:
        airport = result.data[0]
        return {
            "lat": float(airport["latitude"]),
            "lon": float(airport["longitude"]),
            "name": airport["name"],
            "nws_office": airport.get("nws_office"),
            "nws_grid_x": airport.get("nws_grid_x"),
            "nws_grid_y": airport.get("nws_grid_y"),
        }
    return None


async def get_all_airports() -> list[dict]:
    """Get all airports from database."""
    supabase = get_supabase()
    result = supabase.table("airports").select("*").execute()
    return result.data or []
