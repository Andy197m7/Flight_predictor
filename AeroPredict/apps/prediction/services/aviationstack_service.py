"""
AviationStack Service - Integration with AviationStack API for real-time flight data.
Used to create prediction markets and resolve them based on actual flight outcomes.
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional
import random

from config import config
from models.trading_models import FlightData


# Popular routes for auto-generating markets
POPULAR_ROUTES = [
    ("DFW", "MIA"),  # Dallas to Miami
    ("JFK", "LAX"),  # New York to LA
    ("ORD", "SFO"),  # Chicago to San Francisco
    ("ATL", "BOS"),  # Atlanta to Boston
    ("DEN", "SEA"),  # Denver to Seattle
    ("IAH", "LAS"),  # Houston to Las Vegas
    ("PHX", "MSP"),  # Phoenix to Minneapolis
]

# Major airlines
AIRLINES = [
    ("AA", "American Airlines"),
    ("UA", "United Airlines"),
    ("DL", "Delta Air Lines"),
    ("WN", "Southwest Airlines"),
    ("B6", "JetBlue Airways"),
]


class AviationStackService:
    """Service for fetching flight data from AviationStack API."""
    
    def __init__(self):
        self.api_key = config.aviationstack_api_key
        self.base_url = config.aviationstack_base_url
        self._cache: dict[str, tuple[FlightData, datetime]] = {}
        self._cache_ttl = timedelta(minutes=5)
    
    async def get_flights(
        self,
        flight_iata: Optional[str] = None,
        dep_iata: Optional[str] = None,
        arr_iata: Optional[str] = None,
        airline_iata: Optional[str] = None,
        limit: int = 10,
    ) -> list[FlightData]:
        """
        Fetch flights from AviationStack API.
        Falls back to mock data if API unavailable or rate limited.
        """
        # Check cache first
        cache_key = f"{flight_iata}:{dep_iata}:{arr_iata}:{airline_iata}"
        if cache_key in self._cache:
            data, cached_at = self._cache[cache_key]
            if datetime.utcnow() - cached_at < self._cache_ttl:
                return [data] if isinstance(data, FlightData) else data
        
        try:
            if not self.api_key:
                # No API key configured, use mock data
                return self._get_mock_flights(dep_iata, arr_iata, limit)
            
            params = {
                "access_key": self.api_key,
                "limit": limit,
            }
            
            if flight_iata:
                params["flight_iata"] = flight_iata
            if dep_iata:
                params["dep_iata"] = dep_iata
            if arr_iata:
                params["arr_iata"] = arr_iata
            if airline_iata:
                params["airline_iata"] = airline_iata
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.base_url}/flights",
                    params=params,
                )
                
                if response.status_code != 200:
                    print(f"AviationStack API error: {response.status_code}")
                    return self._get_mock_flights(dep_iata, arr_iata, limit)
                
                data = response.json()
                
                if "error" in data:
                    print(f"AviationStack API error: {data['error']}")
                    return self._get_mock_flights(dep_iata, arr_iata, limit)
                
                flights = []
                for item in data.get("data", []):
                    flight = self._parse_flight(item)
                    if flight:
                        flights.append(flight)
                
                # Cache the result
                if flights:
                    self._cache[cache_key] = (flights, datetime.utcnow())
                
                return flights
                
        except Exception as e:
            print(f"Error fetching from AviationStack: {e}")
            return self._get_mock_flights(dep_iata, arr_iata, limit)
    
    async def get_flight_by_number(self, flight_iata: str) -> Optional[FlightData]:
        """Get a specific flight by its IATA code (e.g., AA1234)."""
        flights = await self.get_flights(flight_iata=flight_iata, limit=1)
        return flights[0] if flights else None
    
    def _parse_flight(self, item: dict) -> Optional[FlightData]:
        """Parse API response into FlightData model."""
        try:
            flight_info = item.get("flight", {})
            airline = item.get("airline", {})
            departure = item.get("departure", {})
            arrival = item.get("arrival", {})
            
            return FlightData(
                flight_iata=flight_info.get("iata", ""),
                flight_number=flight_info.get("number", ""),
                airline_name=airline.get("name", ""),
                airline_iata=airline.get("iata", ""),
                departure_airport=departure.get("airport", ""),
                departure_iata=departure.get("iata", ""),
                departure_scheduled=self._parse_datetime(departure.get("scheduled")),
                departure_estimated=self._parse_datetime(departure.get("estimated")),
                departure_actual=self._parse_datetime(departure.get("actual")),
                arrival_airport=arrival.get("airport", ""),
                arrival_iata=arrival.get("iata", ""),
                arrival_scheduled=self._parse_datetime(arrival.get("scheduled")),
                arrival_estimated=self._parse_datetime(arrival.get("estimated")),
                arrival_actual=self._parse_datetime(arrival.get("actual")),
                flight_status=item.get("flight_status", "scheduled"),
            )
        except Exception as e:
            print(f"Error parsing flight data: {e}")
            return None
    
    def _parse_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        """Parse ISO datetime string."""
        if not dt_str:
            return None
        try:
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except:
            return None
    
    def _get_mock_flights(
        self,
        dep_iata: Optional[str] = None,
        arr_iata: Optional[str] = None,
        limit: int = 10,
    ) -> list[FlightData]:
        """Generate mock flight data for demo purposes."""
        flights = []
        now = datetime.utcnow()
        
        for i in range(min(limit, len(POPULAR_ROUTES) * 2)):
            route = POPULAR_ROUTES[i % len(POPULAR_ROUTES)]
            airline = AIRLINES[i % len(AIRLINES)]
            
            # Skip if doesn't match filter
            if dep_iata and route[0] != dep_iata:
                continue
            if arr_iata and route[1] != arr_iata:
                continue
            
            # Random flight number
            flight_num = random.randint(100, 9999)
            
            # Scheduled departure in the next 1-6 hours
            hours_ahead = random.randint(1, 6)
            scheduled = now + timedelta(hours=hours_ahead)
            
            # Random delay (0-90 minutes, weighted toward on-time)
            delay_minutes = 0
            delay_roll = random.random()
            if delay_roll > 0.7:  # 30% chance of some delay
                delay_minutes = random.randint(15, 90)
            
            estimated = scheduled + timedelta(minutes=delay_minutes)
            
            # Status based on delay
            status = "scheduled"
            if delay_minutes >= 60:
                status = "delayed"
            elif random.random() > 0.95:  # 5% chance of cancellation
                status = "cancelled"
            
            flight = FlightData(
                flight_iata=f"{airline[0]}{flight_num}",
                flight_number=str(flight_num),
                airline_name=airline[1],
                airline_iata=airline[0],
                departure_airport=f"{route[0]} International Airport",
                departure_iata=route[0],
                departure_scheduled=scheduled,
                departure_estimated=estimated,
                departure_actual=None,
                arrival_airport=f"{route[1]} International Airport",
                arrival_iata=route[1],
                arrival_scheduled=scheduled + timedelta(hours=random.randint(2, 5)),
                arrival_estimated=None,
                arrival_actual=None,
                flight_status=status,
            )
            flights.append(flight)
        
        return flights
    
    async def get_popular_flights(self, count: int = 10) -> list[FlightData]:
        """Get flights for popular routes - used for auto-creating markets."""
        all_flights = []
        
        for dep, arr in POPULAR_ROUTES[:count]:
            flights = await self.get_flights(dep_iata=dep, arr_iata=arr, limit=2)
            all_flights.extend(flights)
            
            if len(all_flights) >= count:
                break
        
        return all_flights[:count]


# Singleton instance
aviationstack_service = AviationStackService()
