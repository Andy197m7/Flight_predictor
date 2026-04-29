"""
Configuration settings using pydantic-settings.
Follows the unified config pattern from backend-dev-guidelines.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/flightsense"
    
    # Prediction Market APIs
    polymarket_api_url: str = "https://clob.polymarket.com"
    
    # Weather APIs
    noaa_api_key: str = ""
    openweathermap_api_key: str = ""
    
    # AviationStack API for flight data
    aviationstack_api_key: str = "2543ca0176d3d345b220ecbd085dfb41"
    aviationstack_base_url: str = "http://api.aviationstack.com/v1"
    
    # American Airlines
    aa_flight_engine_url: str = ""
    aa_flight_engine_api_key: str = ""
    
    # Redis for job queue
    redis_url: str = "redis://localhost:6379"
    
    # Supabase (for persistent storage)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    
    # NWS Weather API (weather.gov)
    nws_api_base_url: str = "https://api.weather.gov"
    
    # Prediction thresholds
    disruption_alert_threshold: float = 0.65
    polling_interval_seconds: int = 300  # 5 minutes



@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


config = get_settings()
