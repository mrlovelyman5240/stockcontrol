from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'logiflow-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Mixy Logistics API")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ============== MODELS ==============

class UserBase(BaseModel):
    username: str
    role: str  # boss, customer_service, driver

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ItemVariant(BaseModel):
    name: str  # e.g., "Small", "Large", "Family Size"
    price: float
    stock: int = 0  # Variant-specific stock

class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    price: float  # Default/base price (first variant price or standalone)
    stock: int
    variants: List[ItemVariant] = []  # Empty = single-price item
    bogo_enabled: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class InventoryCreate(BaseModel):
    name: str
    price: float
    stock: int
    variants: List[ItemVariant] = []
    bogo_enabled: bool = False

class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    variants: Optional[List[ItemVariant]] = None
    bogo_enabled: Optional[bool] = None

class OrderItem(BaseModel):
    item_id: str
    name: str
    price: float
    quantity: int
    variant_name: Optional[str] = None  # Which variant was selected
    is_free_gift: bool = False

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address: str  # Also used as customer notes/instructions
    notes: Optional[str] = None  # Unified customer notes
    items: List[OrderItem]
    total: float
    order_type: str = "delivery"  # delivery or pickup
    status: str = "pending"  # pending, completed, cancelled
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    delivered_at: Optional[str] = None

class OrderCreate(BaseModel):
    address: str  # Customer notes / instructions
    items: List[OrderItem]
    total: float
    order_type: str = "delivery"  # delivery or pickup
    driver_id: str  # Required - must assign driver at creation
    driver_name: str

class OrderUpdate(BaseModel):
    status: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    driver_name: str
    amount: float
    status: str = "pending"  # pending, approved, rejected
    submitted_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None

class PaymentCreate(BaseModel):
    amount: float

class DriverHours(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    date: str  # YYYY-MM-DD
    hours: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DriverHoursCreate(BaseModel):
    driver_id: str  # Target driver (Boss/CS assigns hours)
    date: str
    hours: float

class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "global_settings"
    payment_method: str = "per_package"  # hourly or per_package
    hourly_rate: float = 15.0
    per_delivery_rate: float = 5.0
    per_pickup_rate: float = 3.0
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_by: Optional[str] = None

class SettingsUpdate(BaseModel):
    payment_method: Optional[str] = None
    hourly_rate: Optional[float] = None
    per_delivery_rate: Optional[float] = None
    per_pickup_rate: Optional[float] = None

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str  # delete, update
    entity_type: str  # order, inventory
    entity_id: str
    entity_name: str
    performed_by: str
    performed_by_name: str
    details: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ============== HELPER FUNCTIONS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(allowed_roles: List[str]):
    async def role_checker(user = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

async def create_audit_log(action: str, entity_type: str, entity_id: str, entity_name: str, user_id: str, user_name: str, details: str):
    log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        performed_by=user_id,
        performed_by_name=user_name,
        details=details
    )
    await db.audit_logs.insert_one(log.model_dump())

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Validate role
    if user_data.role not in ["boss", "customer_service", "driver"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.username, user_data.role)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            username=user_data.username,
            role=user_data.role,
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["username"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user = Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "password": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user_doc)

@api_router.put("/auth/password")
async def change_password(data: PasswordChange, user = Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(data.current_password, user_doc["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    await db.users.update_one(
        {"id": user["user_id"]},
        {"$set": {"password": hash_password(data.new_password)}}
    )
    return {"message": "Password changed successfully"}

# ============== USERS ROUTES ==============

@api_router.get("/users/drivers", response_model=List[UserResponse])
async def get_drivers(user = Depends(require_role(["boss", "customer_service"]))):
    drivers = await db.users.find({"role": "driver"}, {"_id": 0, "password": 0}).to_list(100)
    return [UserResponse(**d) for d in drivers]

# ============== INVENTORY ROUTES ==============

@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(user = Depends(get_current_user)):
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    return [InventoryItem(**item) for item in items]

@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item: InventoryCreate, user = Depends(require_role(["boss", "customer_service"]))):
    inventory_item = InventoryItem(**item.model_dump())
    await db.inventory.insert_one(inventory_item.model_dump())
    return inventory_item

@api_router.put("/inventory/{item_id}", response_model=InventoryItem)
async def update_inventory_item(item_id: str, update: InventoryUpdate, user = Depends(require_role(["boss", "customer_service"]))):
    existing = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = {}
    for k, v in update.model_dump().items():
        if v is not None:
            update_data[k] = v
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.inventory.update_one({"id": item_id}, {"$set": update_data})
    
    # Log if customer service
    if user["role"] == "customer_service":
        await create_audit_log(
            action="update",
            entity_type="inventory",
            entity_id=item_id,
            entity_name=existing["name"],
            user_id=user["user_id"],
            user_name=user["username"],
            details=f"Updated fields: {list(update_data.keys())}"
        )
    
    updated = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    return InventoryItem(**updated)

@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, user = Depends(require_role(["boss", "customer_service"]))):
    existing = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    
    await db.inventory.delete_one({"id": item_id})
    
    # Log if customer service
    if user["role"] == "customer_service":
        await create_audit_log(
            action="delete",
            entity_type="inventory",
            entity_id=item_id,
            entity_name=existing["name"],
            user_id=user["user_id"],
            user_name=user["username"],
            details=f"Deleted inventory item: {existing['name']}"
        )
    
    return {"message": "Item deleted"}

# ============== ORDERS ROUTES ==============

@api_router.get("/orders", response_model=List[Order])
async def get_orders(
    status: Optional[str] = None,
    driver_id: Optional[str] = None,
    date: Optional[str] = None,
    user = Depends(get_current_user)
):
    query = {}
    
    # Drivers can only see their own orders
    if user["role"] == "driver":
        query["driver_id"] = user["user_id"]
    elif driver_id:
        query["driver_id"] = driver_id
    
    if status:
        query["status"] = status
    
    if date:
        # Filter by date (orders created on that date)
        query["created_at"] = {"$regex": f"^{date}"}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Order(**order) for order in orders]

@api_router.get("/orders/today", response_model=List[Order])
async def get_today_orders(user = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query = {"created_at": {"$regex": f"^{today}"}}
    
    if user["role"] == "driver":
        query["driver_id"] = user["user_id"]
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Order(**order) for order in orders]

@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, user = Depends(require_role(["boss", "customer_service"]))):
    # Validate driver exists
    driver = await db.users.find_one({"id": order_data.driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=400, detail="Invalid driver selected")
    
    # Validate and update inventory
    for item in order_data.items:
        if item.is_free_gift:
            continue  # Don't deduct stock for free gifts
        inv_item = await db.inventory.find_one({"id": item.item_id}, {"_id": 0})
        if not inv_item:
            raise HTTPException(status_code=400, detail=f"Item {item.name} not found")
        
        # Check variant-level stock if variant specified and item has variants
        if item.variant_name and inv_item.get("variants"):
            variant = next((v for v in inv_item["variants"] if v["name"] == item.variant_name), None)
            if not variant:
                raise HTTPException(status_code=400, detail=f"Variant {item.variant_name} not found for {inv_item['name']}")
            if variant.get("stock", 0) < item.quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {inv_item['name']} - {item.variant_name}")
        else:
            # Product-level stock for items without variants
            if inv_item["stock"] < item.quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {item.name}")
    
    # Deduct inventory
    for item in order_data.items:
        if not item.is_free_gift:
            if item.variant_name:
                # Deduct from variant-level stock
                await db.inventory.update_one(
                    {"id": item.item_id, "variants.name": item.variant_name},
                    {"$inc": {"variants.$.stock": -item.quantity}}
                )
            else:
                # Deduct from product-level stock
                await db.inventory.update_one(
                    {"id": item.item_id},
                    {"$inc": {"stock": -item.quantity}}
                )
    
    order = Order(
        address=order_data.address,
        items=[OrderItem(**i.model_dump()) for i in order_data.items],
        total=order_data.total,
        order_type=order_data.order_type,
        status="pending",  # Order starts as pending, assigned to driver
        driver_id=order_data.driver_id,
        driver_name=order_data.driver_name,
        created_by=user["user_id"],
        created_by_name=user["username"]
    )
    await db.orders.insert_one(order.model_dump())
    return order

@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, update: OrderUpdate, user = Depends(get_current_user)):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If marking as completed (done), set completed_at timestamp
    if update.status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return Order(**updated)

# Endpoint for Boss/CS/Driver to mark order as Done
@api_router.put("/orders/{order_id}/complete", response_model=Order)
async def complete_order(order_id: str, user = Depends(require_role(["boss", "customer_service", "driver"]))):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if existing["status"] != "pending":
        raise HTTPException(status_code=400, detail="Order is not in pending status")
    
    # Drivers can only complete their own orders
    if user["role"] == "driver" and existing.get("driver_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only complete your own orders")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "completed_by": user["username"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return Order(**updated)

# Endpoint to cancel an order
@api_router.put("/orders/{order_id}/cancel", response_model=Order)
async def cancel_order(order_id: str, user = Depends(require_role(["boss", "customer_service"]))):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if existing["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending orders can be cancelled")
    
    # Restore inventory for cancelled order
    for item in existing["items"]:
        if not item.get("is_free_gift", False):
            if item.get("variant_name"):
                await db.inventory.update_one(
                    {"id": item["item_id"], "variants.name": item["variant_name"]},
                    {"$inc": {"variants.$.stock": item["quantity"]}}
                )
            else:
                await db.inventory.update_one(
                    {"id": item["item_id"]},
                    {"$inc": {"stock": item["quantity"]}}
                )
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": user["username"],
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    
    # Audit log
    await create_audit_log(
        action="cancel",
        entity_type="order",
        entity_id=order_id,
        entity_name=f"Order #{order_id[:8]}",
        user_id=user["user_id"],
        user_name=user["username"],
        details=f"Cancelled order worth ${existing['total']:.2f}"
    )
    
    return Order(**updated)

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user = Depends(require_role(["boss", "customer_service"]))):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Restore inventory
    for item in existing["items"]:
        if not item.get("is_free_gift", False):
            if item.get("variant_name"):
                await db.inventory.update_one(
                    {"id": item["item_id"], "variants.name": item["variant_name"]},
                    {"$inc": {"variants.$.stock": item["quantity"]}}
                )
            else:
                await db.inventory.update_one(
                    {"id": item["item_id"]},
                    {"$inc": {"stock": item["quantity"]}}
                )
    
    await db.orders.delete_one({"id": order_id})
    
    # Log if customer service
    if user["role"] == "customer_service":
        await create_audit_log(
            action="delete",
            entity_type="order",
            entity_id=order_id,
            entity_name=f"Order to {existing['address']}",
            user_id=user["user_id"],
            user_name=user["username"],
            details=f"Deleted order worth ${existing['total']}"
        )
    
    return {"message": "Order deleted"}

# ============== PAYMENTS ROUTES ==============

@api_router.get("/payments", response_model=List[Payment])
async def get_payments(
    driver_id: Optional[str] = None,
    status: Optional[str] = None,
    user = Depends(get_current_user)
):
    query = {}
    
    if user["role"] == "driver":
        query["driver_id"] = user["user_id"]
    elif driver_id:
        query["driver_id"] = driver_id
    
    if status:
        query["status"] = status
    
    payments = await db.payments.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(1000)
    return [Payment(**p) for p in payments]

@api_router.post("/payments", response_model=Payment)
async def submit_payment(payment_data: PaymentCreate, user = Depends(require_role(["driver"]))):
    payment = Payment(
        driver_id=user["user_id"],
        driver_name=user["username"],
        amount=payment_data.amount
    )
    await db.payments.insert_one(payment.model_dump())
    return payment

@api_router.put("/payments/{payment_id}/approve", response_model=Payment)
async def approve_payment(payment_id: str, user = Depends(require_role(["boss"]))):
    existing = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": user["username"]
        }}
    )
    
    updated = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return Payment(**updated)

@api_router.put("/payments/{payment_id}/reject", response_model=Payment)
async def reject_payment(payment_id: str, user = Depends(require_role(["boss"]))):
    existing = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "rejected"}}
    )
    
    updated = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return Payment(**updated)

# ============== DRIVER HOURS ROUTES ==============

@api_router.get("/driver-hours")
async def get_driver_hours(
    date: Optional[str] = None,
    driver_id: Optional[str] = None,
    user = Depends(get_current_user)
):
    query = {}
    if user["role"] == "driver":
        query["driver_id"] = user["user_id"]
    elif driver_id:
        query["driver_id"] = driver_id
    if date:
        query["date"] = date
    
    hours = await db.driver_hours.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [DriverHours(**h) for h in hours]

@api_router.post("/driver-hours", response_model=DriverHours)
async def log_driver_hours(hours_data: DriverHoursCreate, user = Depends(require_role(["boss", "customer_service"]))):
    # Verify driver exists
    driver = await db.users.find_one({"id": hours_data.driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Check if entry exists for this driver+date
    existing = await db.driver_hours.find_one({
        "driver_id": hours_data.driver_id,
        "date": hours_data.date
    }, {"_id": 0})
    
    if existing:
        await db.driver_hours.update_one(
            {"id": existing["id"]},
            {"$set": {"hours": hours_data.hours, "logged_by": user["username"]}}
        )
        updated = await db.driver_hours.find_one({"id": existing["id"]}, {"_id": 0})
        return DriverHours(**updated)
    
    driver_hours = DriverHours(
        driver_id=hours_data.driver_id,
        date=hours_data.date,
        hours=hours_data.hours
    )
    doc = driver_hours.model_dump()
    doc["logged_by"] = user["username"]
    doc["driver_name"] = driver["username"]
    await db.driver_hours.insert_one(doc)
    return driver_hours

# ============== SETTINGS ROUTES ==============

@api_router.get("/settings", response_model=Settings)
async def get_settings(user = Depends(get_current_user)):
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        # Create default settings
        default = Settings()
        await db.settings.insert_one(default.model_dump())
        return default
    return Settings(**settings)

@api_router.put("/settings", response_model=Settings)
async def update_settings(update: SettingsUpdate, user = Depends(require_role(["boss"]))):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = user["username"]
    
    await db.settings.update_one(
        {"id": "global_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    return Settings(**settings)

# ============== AUDIT LOGS ROUTES ==============

@api_router.get("/audit-logs", response_model=List[AuditLog])
async def get_audit_logs(user = Depends(require_role(["boss"]))):
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return [AuditLog(**log) for log in logs]

# ============== FINANCIAL LEDGER ROUTE ==============

@api_router.get("/ledger")
async def get_financial_ledger(
    type: Optional[str] = None,  # orders, deposits, hours
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    driver_id: Optional[str] = None,
    search: Optional[str] = None,
    user = Depends(require_role(["boss"]))
):
    ledger = []
    
    # Get completed orders
    if not type or type == "orders":
        order_query = {"status": {"$in": ["completed", "cancelled"]}}
        if driver_id:
            order_query["driver_id"] = driver_id
        orders = await db.orders.find(order_query, {"_id": 0}).to_list(10000)
        for o in orders:
            ts = o.get("delivered_at") or o.get("updated_at") or o["created_at"]
            if date_from and ts < date_from:
                continue
            if date_to and ts > date_to + "T23:59:59":
                continue
            entry = {
                "id": o["id"],
                "type": "order",
                "subtype": o["status"],
                "amount": o["total"],
                "description": f"Order #{o['id'][:8]} ({o.get('order_type','delivery')}) - {o['status']}",
                "driver_name": o.get("driver_name", ""),
                "driver_id": o.get("driver_id", ""),
                "timestamp": ts,
                "details": {"items_count": len(o.get("items", [])), "order_type": o.get("order_type", "delivery")}
            }
            if search:
                search_lower = search.lower()
                desc_match = search_lower in entry["description"].lower()
                driver_match = entry["driver_name"] and search_lower in entry["driver_name"].lower()
                if not desc_match and not driver_match:
                    continue
            ledger.append(entry)
    
    # Get deposits (payments)
    if not type or type == "deposits":
        pay_query = {}
        if driver_id:
            pay_query["driver_id"] = driver_id
        payments = await db.payments.find(pay_query, {"_id": 0}).to_list(10000)
        for p in payments:
            ts = p.get("approved_at") or p["submitted_at"]
            if date_from and ts < date_from:
                continue
            if date_to and ts > date_to + "T23:59:59":
                continue
            entry = {
                "id": p["id"],
                "type": "deposit",
                "subtype": p["status"],
                "amount": p["amount"],
                "description": f"Deposit by {p['driver_name']} - {p['status']}",
                "driver_name": p.get("driver_name", ""),
                "driver_id": p.get("driver_id", ""),
                "timestamp": ts,
                "details": {"approved_by": p.get("approved_by", "")}
            }
            if search:
                search_lower = search.lower()
                desc_match = search_lower in entry["description"].lower()
                driver_match = entry["driver_name"] and search_lower in entry["driver_name"].lower()
                if not desc_match and not driver_match:
                    continue
            ledger.append(entry)
    
    # Get hours logged
    if not type or type == "hours":
        hr_query = {}
        if driver_id:
            hr_query["driver_id"] = driver_id
        hours = await db.driver_hours.find(hr_query, {"_id": 0}).to_list(10000)
        for h in hours:
            ts = h.get("created_at", h["date"])
            if date_from and h["date"] < date_from:
                continue
            if date_to and h["date"] > date_to:
                continue
            entry = {
                "id": h["id"],
                "type": "hours",
                "subtype": "logged",
                "amount": h["hours"],
                "description": f"{h.get('driver_name', 'Driver')} logged {h['hours']}h on {h['date']}",
                "driver_name": h.get("driver_name", ""),
                "driver_id": h.get("driver_id", ""),
                "timestamp": ts,
                "details": {"logged_by": h.get("logged_by", ""), "date": h["date"]}
            }
            if search:
                search_lower = search.lower()
                desc_match = search_lower in entry["description"].lower()
                driver_match = entry["driver_name"] and search_lower in entry["driver_name"].lower()
                if not desc_match and not driver_match:
                    continue
            ledger.append(entry)
    
    # Sort by timestamp descending
    ledger.sort(key=lambda x: x["timestamp"], reverse=True)
    return ledger

# ============== STATISTICS ROUTES ==============

@api_router.get("/stats/boss")
async def get_boss_stats(user = Depends(require_role(["boss"]))):
    # Get all orders
    orders = await db.orders.find({}, {"_id": 0}).to_list(10000)
    
    # Separate pending and completed orders
    pending_orders = [o for o in orders if o["status"] == "pending"]
    completed_orders = [o for o in orders if o["status"] == "completed"]
    
    # PENDING revenue (not yet finalized - out on delivery)
    pending_revenue = sum(o["total"] for o in pending_orders)
    
    # FINALIZED revenue (completed orders only)
    total_revenue = sum(o["total"] for o in completed_orders)
    
    # Get settings for payment calculation
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        settings = Settings().model_dump()
    
    # Calculate staff payments (only for completed orders)
    total_staff_payments = 0.0
    
    if settings["payment_method"] == "per_package":
        delivery_rate = settings.get("per_delivery_rate", settings.get("per_package_rate", 5.0))
        pickup_rate = settings.get("per_pickup_rate", settings.get("per_package_rate", 3.0))
        delivery_count = len([o for o in completed_orders if o.get("order_type", "delivery") == "delivery"])
        pickup_count = len([o for o in completed_orders if o.get("order_type", "delivery") == "pickup"])
        total_staff_payments = (delivery_count * delivery_rate) + (pickup_count * pickup_rate)
    else:
        hours = await db.driver_hours.find({}, {"_id": 0}).to_list(10000)
        total_hours = sum(h["hours"] for h in hours)
        total_staff_payments = total_hours * settings["hourly_rate"]
    
    # Net profit = finalized revenue - staff payments
    net_profit = total_revenue - total_staff_payments
    
    # Get approved payments from drivers
    approved_payments = await db.payments.find({"status": "approved"}, {"_id": 0}).to_list(10000)
    total_collected = sum(p["amount"] for p in approved_payments)
    
    # Calculate pending collections per driver (only from completed orders)
    drivers = await db.users.find({"role": "driver"}, {"_id": 0, "password": 0}).to_list(100)
    pending_collections = []
    
    for driver in drivers:
        driver_completed = [o for o in completed_orders if o.get("driver_id") == driver["id"]]
        driver_sales = sum(o["total"] for o in driver_completed)
        
        # Calculate driver's earnings from completed orders
        if settings["payment_method"] == "per_package":
            delivery_rate = settings.get("per_delivery_rate", settings.get("per_package_rate", 5.0))
            pickup_rate = settings.get("per_pickup_rate", settings.get("per_package_rate", 3.0))
            d_deliveries = len([o for o in driver_completed if o.get("order_type", "delivery") == "delivery"])
            d_pickups = len([o for o in driver_completed if o.get("order_type", "delivery") == "pickup"])
            driver_earnings = (d_deliveries * delivery_rate) + (d_pickups * pickup_rate)
        else:
            driver_hours = await db.driver_hours.find({"driver_id": driver["id"]}, {"_id": 0}).to_list(1000)
            total_hours = sum(h["hours"] for h in driver_hours)
            driver_earnings = total_hours * settings["hourly_rate"]
        
        # What driver owes (sales - earnings)
        holding = driver_sales - driver_earnings
        
        # Subtract approved payments
        driver_approved = await db.payments.find({
            "driver_id": driver["id"],
            "status": "approved"
        }, {"_id": 0}).to_list(1000)
        total_driver_paid = sum(p["amount"] for p in driver_approved)
        
        pending_amount = max(0, holding - total_driver_paid)
        
        if pending_amount > 0:
            pending_collections.append({
                "driver_id": driver["id"],
                "driver_name": driver["username"],
                "amount": pending_amount,
                "total_sales": driver_sales,
                "driver_earnings": driver_earnings
            })
    
    # Get pending payment submissions
    pending_payments = await db.payments.find({"status": "pending"}, {"_id": 0}).to_list(100)
    
    return {
        "pending_revenue": pending_revenue,  # Money out on delivery (not finalized)
        "total_revenue": total_revenue,      # Finalized revenue (completed orders)
        "total_staff_payments": total_staff_payments,
        "net_profit": net_profit,
        "total_collected": total_collected,
        "pending_collections": pending_collections,
        "pending_payments": [Payment(**p).model_dump() for p in pending_payments],
        "pending_orders": pending_orders,    # List of pending orders
        "total_orders": len(orders),
        "pending_count": len(pending_orders),
        "completed_count": len(completed_orders)
    }

@api_router.get("/stats/driver")
async def get_driver_stats(date: Optional[str] = None, user = Depends(require_role(["driver"]))):
    # Get settings
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        settings = Settings().model_dump()
    
    # Get ALL orders for this driver
    all_driver_orders = await db.orders.find({
        "driver_id": user["user_id"]
    }, {"_id": 0}).to_list(10000)
    
    # Separate pending vs completed
    pending_orders = [o for o in all_driver_orders if o["status"] == "pending"]
    completed_orders = [o for o in all_driver_orders if o["status"] == "completed"]
    
    # PENDING revenue (expected, not yet finalized)
    pending_revenue = sum(o["total"] for o in pending_orders)
    
    # FINALIZED sales (completed orders only)
    total_sales = sum(o["total"] for o in completed_orders)
    packages_delivered = len(completed_orders)
    
    # Calculate FINALIZED earnings (only from completed orders)
    if settings["payment_method"] == "per_package":
        delivery_rate = settings.get("per_delivery_rate", settings.get("per_package_rate", 5.0))
        pickup_rate = settings.get("per_pickup_rate", settings.get("per_package_rate", 3.0))
        deliveries_completed = len([o for o in completed_orders if o.get("order_type", "delivery") == "delivery"])
        pickups_completed = len([o for o in completed_orders if o.get("order_type", "delivery") == "pickup"])
        earnings = (deliveries_completed * delivery_rate) + (pickups_completed * pickup_rate)
        hours_logged = None
    else:
        hours_records = await db.driver_hours.find({"driver_id": user["user_id"]}, {"_id": 0}).to_list(1000)
        hours_logged = sum(h["hours"] for h in hours_records)
        earnings = hours_logged * settings["hourly_rate"]
        deliveries_completed = len([o for o in completed_orders if o.get("order_type", "delivery") == "delivery"])
        pickups_completed = len([o for o in completed_orders if o.get("order_type", "delivery") == "pickup"])
        delivery_rate = settings.get("per_delivery_rate", 5.0)
        pickup_rate = settings.get("per_pickup_rate", 3.0)
    
    # Calculate EXPECTED earnings from pending (for display)
    if settings["payment_method"] == "per_package":
        pending_deliveries = len([o for o in pending_orders if o.get("order_type", "delivery") == "delivery"])
        pending_pickups = len([o for o in pending_orders if o.get("order_type", "delivery") == "pickup"])
        expected_earnings = (pending_deliveries * delivery_rate) + (pending_pickups * pickup_rate)
    else:
        expected_earnings = 0  # Can't predict hours
    
    # Calculate holding (to boss) - only from FINALIZED completed orders
    holding = total_sales - earnings
    
    # Get approved payments
    approved_payments = await db.payments.find({
        "driver_id": user["user_id"], 
        "status": "approved"
    }, {"_id": 0}).to_list(1000)
    total_paid = sum(p["amount"] for p in approved_payments)
    
    # Pending amount to boss (only from finalized)
    pending_to_boss = max(0, holding - total_paid)
    
    # Today's stats
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_orders = [o for o in all_driver_orders if o["created_at"].startswith(today)]
    today_pending = [o for o in today_orders if o["status"] == "pending"]
    today_completed = [o for o in today_orders if o["status"] == "completed"]
    
    return {
        "payment_method": settings["payment_method"],
        "hourly_rate": settings["hourly_rate"],
        "per_delivery_rate": settings.get("per_delivery_rate", settings.get("per_package_rate", 5.0)),
        "per_pickup_rate": settings.get("per_pickup_rate", settings.get("per_package_rate", 3.0)),
        # Pending (expected, not finalized)
        "pending_revenue": pending_revenue,
        "pending_count": len(pending_orders),
        "expected_earnings": expected_earnings,
        # Finalized (completed orders)
        "total_sales": total_sales,
        "packages_delivered": packages_delivered,
        "deliveries_completed": deliveries_completed,
        "pickups_completed": pickups_completed,
        "hours_logged": hours_logged,
        "earnings": earnings,
        "holding": holding,
        "total_paid": total_paid,
        "pending_to_boss": pending_to_boss,
        # Today's stats
        "today_orders": len(today_orders),
        "today_pending": len(today_pending),
        "today_completed": len(today_completed),
        "today_pending_revenue": sum(o["total"] for o in today_pending),
        "today_revenue": sum(o["total"] for o in today_completed)
    }

# ============== SEED DATA ROUTE ==============

@api_router.post("/seed")
async def seed_data():
    # Check if already seeded
    existing_boss = await db.users.find_one({"username": "boss"}, {"_id": 0})
    if existing_boss:
        return {"message": "Data already seeded"}
    
    # Create users
    users = [
        {"id": str(uuid.uuid4()), "username": "boss", "password": hash_password("boss123"), "role": "boss", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "username": "service1", "password": hash_password("service123"), "role": "customer_service", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "username": "driver1", "password": hash_password("driver123"), "role": "driver", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "username": "driver2", "password": hash_password("driver123"), "role": "driver", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.users.insert_many(users)
    
    # Create inventory with variants
    inventory = [
        InventoryItem(name="Premium Pizza", price=12.99, stock=0, variants=[
            ItemVariant(name="Small", price=12.99, stock=50),
            ItemVariant(name="Medium", price=15.99, stock=30),
            ItemVariant(name="Large", price=19.99, stock=20),
        ]).model_dump(),
        InventoryItem(name="Classic Burger", price=9.99, stock=0, variants=[
            ItemVariant(name="Single", price=9.99, stock=60),
            ItemVariant(name="Double", price=14.99, stock=40),
        ]).model_dump(),
        InventoryItem(name="Caesar Salad", price=7.99, stock=30).model_dump(),
        InventoryItem(name="Chicken Wings", price=10.99, stock=0, variants=[
            ItemVariant(name="6 pcs", price=10.99, stock=45),
            ItemVariant(name="12 pcs", price=18.99, stock=25),
            ItemVariant(name="24 pcs", price=32.99, stock=10),
        ]).model_dump(),
        InventoryItem(name="Pasta Carbonara", price=14.99, stock=25).model_dump(),
        InventoryItem(name="Fish & Chips", price=11.99, stock=40).model_dump(),
        InventoryItem(name="Grilled Steak", price=24.99, stock=0, variants=[
            ItemVariant(name="Regular", price=24.99, stock=20),
            ItemVariant(name="Premium Cut", price=34.99, stock=10),
        ]).model_dump(),
        InventoryItem(name="Veggie Wrap", price=8.99, stock=35).model_dump(),
    ]
    await db.inventory.insert_many(inventory)
    
    # Create default settings
    settings = Settings()
    settings_dict = settings.model_dump()
    # Ensure new rate fields exist
    settings_dict["per_delivery_rate"] = 5.0
    settings_dict["per_pickup_rate"] = 3.0
    await db.settings.insert_one(settings_dict)
    
    return {"message": "Data seeded successfully", "users": [{"username": u["username"], "role": u["role"]} for u in users]}

# ============== HEALTH CHECK ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def ensure_boss_account():
    """Create default Boss account on first run if 'admin' doesn't exist."""
    existing_admin = await db.users.find_one({"username": "admin"}, {"_id": 0})
    if not existing_admin:
        boss_doc = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password": hash_password("admin123"),
            "role": "boss",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(boss_doc)
        logger.info("Default Boss account created: admin / admin123")
    # Ensure settings exist
    existing_settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not existing_settings:
        await db.settings.insert_one(Settings().model_dump())
        logger.info("Default settings initialized")
