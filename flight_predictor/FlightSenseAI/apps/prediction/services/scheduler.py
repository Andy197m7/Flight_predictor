"""
Scheduler Service - Background job scheduling.
Runs periodic tasks for weather updates and prediction refreshes.
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import config

# Global scheduler instance
scheduler = AsyncIOScheduler()


async def refresh_weather_job():
    """Job to refresh weather data from NWS for all airports."""
    from services.nws_weather_service import nws_weather_service
    print("🌤️  Running scheduled weather refresh...")
    try:
        forecasts = await nws_weather_service.get_all_airport_forecasts()
        print(f"🌤️  Weather refresh complete. Updated {len(forecasts)} airports.")
    except Exception as e:
        print(f"❌ Weather refresh failed: {e}")


async def update_predictions_job():
    """Job to update ML predictions for all active markets."""
    from services.ml_prediction_service import ml_prediction_service
    print("🤖 Running scheduled prediction update...")
    try:
        count = await ml_prediction_service.update_market_predictions()
        print(f"🤖 Prediction update complete. Updated {count} markets.")
    except Exception as e:
        print(f"❌ Prediction update failed: {e}")


async def initialize_markets_job():
    """Job to initialize markets on startup."""
    from services.market_service import market_service
    print("📊 Initializing markets...")
    try:
        count = await market_service.initialize_markets()
        print(f"📊 Market initialization complete. {count} markets available.")
    except Exception as e:
        print(f"❌ Market initialization failed: {e}")


def start_scheduler():
    """Start the background scheduler."""
    # Refresh weather every 30 minutes (NWS updates hourly, so 30 min is sufficient)
    scheduler.add_job(
        refresh_weather_job,
        trigger=IntervalTrigger(minutes=30),
        id="refresh_weather",
        replace_existing=True,
    )
    
    # Update predictions every 5 minutes (after weather data is available)
    scheduler.add_job(
        update_predictions_job,
        trigger=IntervalTrigger(seconds=config.polling_interval_seconds),
        id="update_predictions",
        replace_existing=True,
    )
    
    scheduler.start()
    print(f"⏰ Scheduler started. Weather every 30m, Predictions every {config.polling_interval_seconds}s.")


def stop_scheduler():
    """Stop the background scheduler."""
    scheduler.shutdown(wait=False)
    print("⏰ Scheduler stopped.")
