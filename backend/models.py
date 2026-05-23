"""All Pydantic models and Enums shared across the API."""
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class UserRole(str, Enum):
    boss = "boss"
    customer_service = "customer_service"
    driver = "driver"


class OrderStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"


class OrderType(str, Enum):
    delivery = "delivery"
    pickup = "pickup"


class PaymentStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PaymentMethod(str, Enum):
    hourly = "hourly"
    per_package = "per_package"


class UserBase(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    username: str
    full_name: Optional[str] = None
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ResetPasswordRequest(BaseModel):
    new_password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    full_name: Optional[str] = None
    role: UserRole
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ItemVariant(BaseModel):
    name: str
    price: float = Field(ge=0)
    # How many units of the product's base stock this variant consumes per 1 sold.
    # e.g. AK-47 has base stock 100, variants Q=1, H=2, OZ=4 → selling 1 OZ removes 4 from base.
    units_per: int = Field(default=1, ge=1)
    # Legacy per-variant stock. Kept for backward compatibility with existing data,
    # but ignored by the order pipeline — base product stock is the source of truth.
    stock: int = Field(default=0, ge=0)


class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    price: float = Field(ge=0)
    stock: int = Field(ge=0)
    variants: List[ItemVariant] = []
    bogo_enabled: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class InventoryCreate(BaseModel):
    name: str
    price: float = Field(ge=0)
    stock: int = Field(ge=0)
    variants: List[ItemVariant] = []
    bogo_enabled: bool = False


class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)
    variants: Optional[List[ItemVariant]] = None
    bogo_enabled: Optional[bool] = None


class OrderItem(BaseModel):
    item_id: str
    name: str
    price: float
    quantity: int
    variant_name: Optional[str] = None
    is_free_gift: bool = False
    # Snapshotted at order creation so cancel/delete restores the right base-stock
    # amount even if the variant's units_per changes later. Defaults to 1 so old
    # orders (created before this field existed) restore at quantity * 1.
    units_per: int = Field(default=1, ge=1)


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore", use_enum_values=True)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address: str
    notes: Optional[str] = None
    items: List[OrderItem]
    total: float
    order_type: OrderType = OrderType.delivery
    status: OrderStatus = OrderStatus.pending
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    delivered_at: Optional[str] = None


class OrderCreate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    address: str
    items: List[OrderItem]
    order_type: OrderType = OrderType.delivery
    driver_id: str
    driver_name: str


class OrderUpdate(BaseModel):
    # Status transitions must go through /complete or /cancel — those routes
    # atomically gate on status=pending and restore stock correctly. Allowing
    # status here would let callers bypass stock restoration on cancel.
    model_config = ConfigDict(use_enum_values=True)
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None


class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore", use_enum_values=True)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    driver_name: str
    amount: float
    status: PaymentStatus = PaymentStatus.pending
    submitted_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)


class DriverHours(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    date: str  # YYYY-MM-DD
    hours: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class DriverHoursCreate(BaseModel):
    driver_id: str
    date: str
    hours: float = Field(gt=0)


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore", use_enum_values=True)
    id: str = "global_settings"
    payment_method: PaymentMethod = PaymentMethod.per_package
    hourly_rate: float = 15.0
    per_delivery_rate: float = 5.0
    per_pickup_rate: float = 3.0
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_by: Optional[str] = None


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    payment_method: Optional[PaymentMethod] = None
    hourly_rate: Optional[float] = None
    per_delivery_rate: Optional[float] = None
    per_pickup_rate: Optional[float] = None


class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str
    entity_type: str
    entity_id: str
    entity_name: str
    performed_by: str
    performed_by_name: str
    details: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
