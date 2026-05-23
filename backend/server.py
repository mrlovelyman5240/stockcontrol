"""Mixy Logistics API entrypoint. Routes are mounted from routers/*."""
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.cors import CORSMiddleware

from database import client, db
from models import Settings
from rate_limit import limiter
from routers import audit as audit_router
from routers import auth as auth_router
from routers import driver_hours as driver_hours_router
from routers import inventory as inventory_router
from routers import orders as orders_router
from routers import payments as payments_router
from routers import settings as settings_router
from routers import stats as stats_router
from routers import users as users_router
from security import hash_password

app = FastAPI(title="Mixy Logistics API")

# Rate limiter (per IP). SlowAPI middleware reads limiter from app.state.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# All routes live under /api; sub-routers add their own segment (e.g. /auth, /orders).
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router.router)
api_router.include_router(users_router.router)
api_router.include_router(inventory_router.router)
api_router.include_router(orders_router.router)
api_router.include_router(payments_router.router)
api_router.include_router(driver_hours_router.router)
api_router.include_router(settings_router.router)
api_router.include_router(audit_router.router)
api_router.include_router(stats_router.router)


@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


app.include_router(api_router)

# CORS — origins are required via env so no accidental wildcard.
_cors_origins_raw = os.environ.get('CORS_ORIGINS', '').strip()
if not _cors_origins_raw:
    raise RuntimeError(
        "CORS_ORIGINS environment variable is required. "
        "Set it to a comma-separated list of allowed origins "
        "(e.g. 'https://stockcontrol.vercel.app,http://localhost:3000')."
    )
_cors_origins = [origin.strip() for origin in _cors_origins_raw.split(',') if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@app.on_event("startup")
async def ensure_indexes():
    """Create unique indexes for data integrity. Idempotent — safe to run on every boot."""
    await db.users.create_index("username", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.inventory.create_index("id", unique=True)
    await db.payments.create_index("id", unique=True)
    await db.driver_hours.create_index([("driver_id", 1), ("date", 1)], unique=True)
    logger.info("MongoDB indexes ensured")


@app.on_event("startup")
async def ensure_boss_account():
    """Create initial Boss account from env vars if no boss exists yet.

    Set INITIAL_BOSS_USERNAME and INITIAL_BOSS_PASSWORD to bootstrap the first
    boss account. Once any boss exists, these env vars are ignored.
    """
    initial_username = os.environ.get("INITIAL_BOSS_USERNAME")
    initial_password = os.environ.get("INITIAL_BOSS_PASSWORD")
    if not initial_username or not initial_password:
        return
    existing_boss = await db.users.find_one({"role": "boss"}, {"_id": 0})
    if existing_boss:
        return
    username_taken = await db.users.find_one({"username": initial_username}, {"_id": 0})
    if username_taken:
        logger.warning("INITIAL_BOSS_USERNAME '%s' already taken; skipping boss bootstrap", initial_username)
        return
    boss_doc = {
        "id": str(uuid.uuid4()),
        "username": initial_username,
        "full_name": initial_username,
        "password": hash_password(initial_password),
        "role": "boss",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(boss_doc)
    logger.info("Initial Boss account created from env: %s", initial_username)
    existing_settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not existing_settings:
        await db.settings.insert_one(Settings().model_dump())
        logger.info("Default settings initialized")
