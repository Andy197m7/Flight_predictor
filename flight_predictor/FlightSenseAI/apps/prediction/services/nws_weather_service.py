"""
NWS Weather Service - Integration with National Weather Service API (weather.gov).
Provides accurate weather forecasts for airport locations to predict flight disruptions.

API Documentation: https://www.weather.gov/documentation/services-web-api
"""
import httpx
from datetime import datetime, date
from typing import Optional
import asyncio

from config import config
from services.supabase_client import get_supabase, get_airport_coords


class NWSWeatherService:
    """
    Service for fetching weather data from the National Weather Service API.
    
    The NWS API works in two steps:
    1. Get the grid points for a lat/lon using /points/{lat},{lon}
    2. Get the forecast using /gridpoints/{office}/{gridX},{gridY}/forecast
    """
    
    def __init__(self):
        self.base_url = config.nws_api_base_url
        self._grid_cache: dict[str, dict] = {}  # Cache grid points by airport
        self._forecast_cache: dict[str, tuple[dict, datetime]] = {}
        self._cache_ttl_minutes = 30  # Cache forecasts for 30 minutes
    
    async def get_grid_points(self, lat: float, lon: float) -> Optional[dict]:
        """
        Get NWS grid points for a location.
        Returns: {office, gridX, gridY, forecast_url, forecastHourly_url}
        """
        cache_key = f"{lat:.4f},{lon:.4f}"
        if cache_key in self._grid_cache:
            return self._grid_cache[cache_key]
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.base_url}/points/{lat},{lon}",
                    headers={"User-Agent": "FlightSenseAI (hackathon@example.com)"}
                )
                
                if response.status_code != 200:
                    print(f"NWS points API error: {response.status_code}")
                    return None
                
                data = response.json()
                props = data.get("properties", {})
                
                grid_data = {
                    "office": props.get("gridId"),
                    "gridX": props.get("gridX"),
                    "gridY": props.get("gridY"),
                    "forecast_url": props.get("forecast"),
                    "forecast_hourly_url": props.get("forecastHourly"),
                    "observation_stations": props.get("observationStations"),
                }
                
                self._grid_cache[cache_key] = grid_data
                return grid_data
                
        except Exception as e:
            print(f"Error fetching NWS grid points: {e}")
            return None
    
    async def get_forecast(self, airport_code: str) -> Optional[dict]:
        """
        Get weather forecast for an airport.
        Returns parsed forecast data with wind, visibility, precipitation info.
        """
        # Check cache first
        cache_key = airport_code
        if cache_key in self._forecast_cache:
            cached_data, cached_at = self._forecast_cache[cache_key]
            age_minutes = (datetime.utcnow() - cached_at).total_seconds() / 60
            if age_minutes < self._cache_ttl_minutes:
                return cached_data
        
        # Get airport coordinates
        coords = await get_airport_coords(airport_code)
        if not coords:
            print(f"Unknown airport: {airport_code}")
            return None
        
        # Get grid points
        grid = await self.get_grid_points(coords["lat"], coords["lon"])
        if not grid or not grid.get("forecast_url"):
            print(f"Could not get NWS grid for {airport_code}")
            return None
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    grid["forecast_url"],
                    headers={"User-Agent": "FlightSenseAI (hackathon@example.com)"}
                )
                
                if response.status_code != 200:
                    print(f"NWS forecast API error: {response.status_code}")
                    return None
                
                data = response.json()
                props = data.get("properties", {})
                periods = props.get("periods", [])
                
                if not periods:
                    return None
                
                # Parse the forecast periods
                parsed = self._parse_forecast_periods(periods, airport_code)
                
                # Cache the result
                self._forecast_cache[cache_key] = (parsed, datetime.utcnow())
                
                # Store in database for historical tracking
                await self._store_forecast(airport_code, parsed)
                
                return parsed
                
        except Exception as e:
            print(f"Error fetching NWS forecast: {e}")
            return None
    
    def _parse_forecast_periods(self, periods: list, airport_code: str) -> dict:
        """Parse NWS forecast periods into structured data."""
        result = {
            "airport_code": airport_code,
            "fetched_at": datetime.utcnow().isoformat(),
            "periods": [],
            "current": None,
            "next_12h": None,
            "next_24h": None,
        }
        
        for i, period in enumerate(periods[:6]):  # Get first 6 periods (3 days)
            parsed_period = {
                "name": period.get("name"),
                "start_time": period.get("startTime"),
                "end_time": period.get("endTime"),
                "temperature_f": period.get("temperature"),
                "temperature_unit": period.get("temperatureUnit"),
                "wind_speed": self._parse_wind_speed(period.get("windSpeed", "")),
                "wind_direction": period.get("windDirection"),
                "short_forecast": period.get("shortForecast"),
                "detailed_forecast": period.get("detailedForecast"),
                "precipitation_probability": period.get("probabilityOfPrecipitation", {}).get("value", 0) or 0,
                "is_daytime": period.get("isDaytime"),
            }
            
            # Calculate disruption risk for this period
            parsed_period["disruption_risk"] = self._calculate_period_risk(parsed_period)
            
            result["periods"].append(parsed_period)
            
            if i == 0:
                result["current"] = parsed_period
            elif i == 1:
                result["next_12h"] = parsed_period
            elif i == 2:
                result["next_24h"] = parsed_period
        
        return result
    
    def _parse_wind_speed(self, wind_str: str) -> float:
        """Parse wind speed string like '10 to 15 mph' into numeric value."""
        if not wind_str:
            return 0.0
        
        try:
            # Handle ranges like "10 to 15 mph"
            wind_str = wind_str.lower().replace("mph", "").strip()
            if "to" in wind_str:
                parts = wind_str.split("to")
                # Use the higher value for risk assessment
                return float(parts[1].strip())
            return float(wind_str)
        except:
            return 0.0
    
    def _calculate_period_risk(self, period: dict) -> float:
        """
        Calculate disruption risk score (0-1) for a forecast period.
        Uses a weighted combination of weather factors.
        """
        risk = 0.0
        
        # Wind factor (0-0.35)
        wind = period.get("wind_speed", 0)
        if wind >= 35:
            risk += 0.35  # Severe wind, likely delays/cancellations
        elif wind >= 25:
            risk += 0.25  # High wind, possible delays
        elif wind >= 20:
            risk += 0.15  # Moderate wind
        elif wind >= 15:
            risk += 0.08  # Light wind
        
        # Precipitation factor (0-0.25)
        precip = period.get("precipitation_probability", 0)
        risk += (precip / 100) * 0.25
        
        # Weather condition factor (0-0.30)
        forecast = (period.get("short_forecast") or "").lower()
        detailed = (period.get("detailed_forecast") or "").lower()
        combined = f"{forecast} {detailed}"
        
        # Severe conditions
        if any(word in combined for word in ["thunderstorm", "severe", "tornado", "hurricane", "blizzard"]):
            risk += 0.30
        elif any(word in combined for word in ["snow", "ice", "freezing", "sleet", "winter storm"]):
            risk += 0.25
        elif any(word in combined for word in ["heavy rain", "storm", "fog", "visibility"]):
            risk += 0.18
        elif any(word in combined for word in ["rain", "showers", "drizzle"]):
            risk += 0.10
        elif any(word in combined for word in ["cloudy", "overcast"]):
            risk += 0.03
        
        # Temperature extremes (0-0.10)
        temp = period.get("temperature_f", 70)
        if temp is not None:
            if temp < 20 or temp > 105:
                risk += 0.10  # Extreme temps
            elif temp < 32 or temp > 100:
                risk += 0.05  # Cold/hot
        
        return min(risk, 1.0)
    
    async def _store_forecast(self, airport_code: str, forecast: dict) -> None:
        """Store forecast in Supabase for historical tracking."""
        try:
            supabase = get_supabase()
            
            for period in forecast.get("periods", []):
                record = {
                    "airport_code": airport_code,
                    "prediction_date": date.today().isoformat(),
                    "forecast_period": period.get("name"),
                    "temperature_f": period.get("temperature_f"),
                    "wind_speed_mph": period.get("wind_speed"),
                    "wind_direction": period.get("wind_direction"),
                    "precipitation_probability": period.get("precipitation_probability", 0) / 100,
                    "weather_condition": period.get("short_forecast"),
                    "short_forecast": period.get("short_forecast"),
                    "detailed_forecast": period.get("detailed_forecast"),
                    "disruption_risk_score": period.get("disruption_risk"),
                    "raw_nws_data": period,
                }
                
                # Upsert to handle duplicates
                supabase.table("weather_predictions").upsert(
                    record,
                    on_conflict="airport_code,prediction_date,forecast_period"
                ).execute()
                
        except Exception as e:
            print(f"Error storing forecast: {e}")
    
    async def get_all_airport_forecasts(self) -> dict[str, dict]:
        """Fetch forecasts for all airports in the database."""
        try:
            supabase = get_supabase()
            result = supabase.table("airports").select("iata_code").execute()
            
            forecasts = {}
            for airport in result.data or []:
                code = airport["iata_code"]
                forecast = await self.get_forecast(code)
                if forecast:
                    forecasts[code] = forecast
                # Small delay to avoid rate limiting
                await asyncio.sleep(0.2)
            
            return forecasts
            
        except Exception as e:
            print(f"Error fetching all forecasts: {e}")
            return {}
    
    def get_cached_forecast(self, airport_code: str) -> Optional[dict]:
        """Get cached forecast without making API call."""
        if airport_code in self._forecast_cache:
            return self._forecast_cache[airport_code][0]
        return None


# Singleton instance
nws_weather_service = NWSWeatherService()
