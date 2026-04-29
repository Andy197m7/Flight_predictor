"""
Trading Models - Pydantic models for prediction market trading system.
Designed for session-based demo, structured for future blockchain wallet integration.
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class MarketStatus(str, Enum):
    """Status of a prediction market."""
    ACTIVE = "active"
    CLOSED = "closed"
    RESOLVED = "resolved"


class MarketOutcome(str, Enum):
    """Possible outcomes for a market."""
    YES = "YES"
    NO = "NO"


class OrderSide(str, Enum):
    """Side of an order."""
    BUY = "buy"
    SELL = "sell"


class OrderStatus(str, Enum):
    """Status of an order."""
    PENDING = "pending"
    FILLED = "filled"
    CANCELLED = "cancelled"


class FlightEventType(str, Enum):
    """Types of flight events for markets."""
    ON_TIME = "on_time"
    DELAY_30_MIN = "delay_30_min"
    DELAY_1_HOUR = "delay_1_hour"
    DELAY_2_HOURS = "delay_2_hours"
    CANCELLATION = "cancellation"


class FlightData(BaseModel):
    """Flight data from AviationStack API."""
    flight_iata: str
    flight_number: str
    airline_name: str
    airline_iata: str
    departure_airport: str
    departure_iata: str
    departure_scheduled: Optional[datetime] = None
    departure_estimated: Optional[datetime] = None
    departure_actual: Optional[datetime] = None
    arrival_airport: str
    arrival_iata: str
    arrival_scheduled: Optional[datetime] = None
    arrival_estimated: Optional[datetime] = None
    arrival_actual: Optional[datetime] = None
    flight_status: str  # scheduled, active, landed, cancelled, incident, diverted


class Market(BaseModel):
    """A prediction market for a flight event."""
    id: str
    flight_iata: str
    flight_data: Optional[FlightData] = None
    event_type: FlightEventType
    question: str
    description: str
    yes_price: float = Field(ge=0.01, le=0.99, default=0.50)
    no_price: float = Field(ge=0.01, le=0.99, default=0.50)
    yes_shares: float = 1000.0  # Total YES shares (AMM liquidity)
    no_shares: float = 1000.0   # Total NO shares (AMM liquidity)
    volume: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    closes_at: Optional[datetime] = None  # When market stops accepting orders
    resolution_time: Optional[datetime] = None
    status: MarketStatus = MarketStatus.ACTIVE
    resolved_outcome: Optional[MarketOutcome] = None
    
    def get_price(self, outcome: MarketOutcome) -> float:
        """Get current price for an outcome using constant product formula."""
        if outcome == MarketOutcome.YES:
            return self.no_shares / (self.yes_shares + self.no_shares)
        else:
            return self.yes_shares / (self.yes_shares + self.no_shares)


class Position(BaseModel):
    """A user's position in a market."""
    id: str
    user_id: str
    market_id: str
    outcome: MarketOutcome
    shares: float = Field(ge=0.0)
    avg_price: float = Field(ge=0.0)
    current_value: float = 0.0
    unrealized_pnl: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Order(BaseModel):
    """An order to buy/sell shares in a market."""
    id: str
    user_id: str
    market_id: str
    side: OrderSide
    outcome: MarketOutcome
    shares: float = Field(gt=0.0)
    price: float = Field(ge=0.0)  # Average price per share (can exceed 1.0 due to AMM slippage)
    cost: float = 0.0  # Total cost of the order
    status: OrderStatus = OrderStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    filled_at: Optional[datetime] = None


class Trade(BaseModel):
    """A completed trade."""
    id: str
    order_id: str
    market_id: str
    user_id: str
    side: OrderSide
    outcome: MarketOutcome
    shares: float
    price: float
    cost: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class UserWallet(BaseModel):
    """User's wallet for demo credits.
    
    Designed for easy migration to blockchain wallet:
    - balance: Current available balance
    - locked_balance: Funds locked in open orders
    - wallet_address: Placeholder for future Solana wallet address
    """
    user_id: str
    balance: float = 1000.0  # Starting demo credits
    locked_balance: float = 0.0  # Funds in open orders
    total_deposited: float = 1000.0
    total_withdrawn: float = 0.0
    wallet_address: Optional[str] = None  # For future Solana integration
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    @property
    def available_balance(self) -> float:
        return self.balance - self.locked_balance


class OrderRequest(BaseModel):
    """Request to place an order."""
    market_id: str
    outcome: MarketOutcome
    shares: float = Field(gt=0.0, le=1000.0)
    side: OrderSide = OrderSide.BUY


class OrderResponse(BaseModel):
    """Response after placing an order."""
    order: Order
    trade: Optional[Trade] = None
    new_balance: float
    message: str


class CashOutRequest(BaseModel):
    """Request to cash out (sell) a position."""
    position_id: str
    shares: Optional[float] = None  # If None, sell all shares


class PortfolioSummary(BaseModel):
    """Summary of user's portfolio."""
    user_id: str
    wallet: UserWallet
    positions: list[Position]
    total_position_value: float
    total_unrealized_pnl: float
    recent_trades: list[Trade]
