"""
Weather Service - Integration with weather APIs.
Provides weather signals for disruption prediction.
"""
import httpx
from datetime import datetime
from typing import Optional

from config import config
from models import PredictionSignal, PredictionSource


# Severe weather alert types that affect flights
SEVERE_WEATHER_TYPES = [
    "Hurricane", "Tropical Storm", "Blizzard", "Ice Storm",
    "Severe Thunderstorm", "Tornado", "Winter Storm", "High Wind",
]


class WeatherService:
    """Service for fetching weather data from multiple APIs."""

    def __init__(self):
        self.noaa_key = config.noaa_api_key
        self.openweather_key = config.openweathermap_api_key

    async def get_weather_signals(self, airports: list[str]) -> list[PredictionSignal]:
        """
        Get weather-based prediction signals for airports.
        Combines data from NOAA alerts and OpenWeatherMap.
        """
        signals = []
        
        for airport in airports:
            # Get coordinates for airport (simplified mapping)
            coords = self._get_airport_coords(airport)
            if not coords:
                continue
            
            # Fetch weather data
            weather_data = await self._fetch_weather(coords["lat"], coords["lon"])
            
            if weather_data and weather_data.get("severity", 0) > 0.3:
                signal = PredictionSignal(
                    source=PredictionSource.WEATHER_API,
                    signal_id=f"weather-{airport}-{datetime.utcnow().date()}",
                    probability=weather_data["severity"],
                    weight=0.35,
                    affected_airports=[airport],
                    raw_data=weather_data,
                )
                signals.append(signal)
        
        return signals

    async def _fetch_weather(self, lat: float, lon: float) -> Optional[dict]:
        """Fetch weather data from OpenWeatherMap."""
        if not self.openweather_key:
            # Return mock data for demo
            return self._get_mock_weather()
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    "https://api.openweathermap.org/data/2.5/weather",
                    params={
                        "lat": lat,
                        "lon": lon,
                        "appid": self.openweather_key,
                        "units": "metric",
                    },
                )
                
                if response.status_code != 200:
                    return self._get_mock_weather()
                
                data = response.json()
                return self._process_weather_data(data)
                
        except Exception as e:
            print(f"Weather API error: {e}")
            return self._get_mock_weather()

    def _process_weather_data(self, data: dict) -> dict:
        """Process raw weather data into severity score."""
        weather_main = data.get("weather", [{}])[0].get("main", "")
        wind_speed = data.get("wind", {}).get("speed", 0)
        visibility = data.get("visibility", 10000)
        
        # Calculate severity based on conditions
        severity = 0.0
        
        # Wind factor
        if wind_speed > 20:
            severity += 0.3
        elif wind_speed > 15:
            severity += 0.2
        elif wind_speed > 10:
            severity += 0.1
        
        # Visibility factor
        if visibility < 1000:
            severity += 0.4
        elif visibility < 3000:
            severity += 0.2
        elif visibility < 5000:
            severity += 0.1
        
        # Weather condition factor
        if weather_main in ["Thunderstorm", "Snow", "Extreme"]:
            severity += 0.3
        elif weather_main in ["Rain", "Drizzle", "Fog", "Mist"]:
            severity += 0.15
        
        return {
            "severity": min(severity, 1.0),
            "condition": weather_main,
            "wind_speed": wind_speed,
            "visibility": visibility,
            "raw": data,
        }

    def _get_mock_weather(self) -> dict:
        """Return mock weather data for demo."""
        return {
            "severity": 0.45,
            "condition": "Rain",
            "wind_speed": 12,
            "visibility": 5000,
        }

    def _get_airport_coords(self, airport: str) -> Optional[dict]:
        """Get coordinates for an airport code."""
        coords_map = {
            "DFW": {"lat": 32.8998, "lon": -97.0403},
            "MIA": {"lat": 25.7959, "lon": -80.2870},
            "LAX": {"lat": 33.9425, "lon": -118.4081},
            "JFK": {"lat": 40.6413, "lon": -73.7781},
            "ORD": {"lat": 41.9742, "lon": -87.9073},
            "ATL": {"lat": 33.6407, "lon": -84.4277},
            "SFO": {"lat": 37.6213, "lon": -122.3790},
            "DEN": {"lat": 39.8561, "lon": -104.6737},
            "SEA": {"lat": 47.4502, "lon": -122.3088},
            "PHX": {"lat": 33.4373, "lon": -112.0078},
        }
        return coords_map.get(airport)


# Singleton instance
weather_service = WeatherService()
