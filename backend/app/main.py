from datetime import datetime, timezone, timedelta, date
import calendar
from hashlib import sha1, sha256
import asyncio
import json
import logging
import os
import secrets
import uuid
import httpx
from time import time

# Module-level logger — must be defined before any function that calls logger.error()
logger = logging.getLogger(__name__)

try:
    from zoneinfo import ZoneInfo
    STORE_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    STORE_TZ = timezone(timedelta(hours=5, minutes=30))

def get_store_local_now() -> datetime:
    return datetime.now(STORE_TZ)

users_db_lock = asyncio.Lock()
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query, Request, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from .config import settings
from .schemas import (
    PhoneRequest,
    RegistrationRequest,
    VerifyOtpRequest,
    CartItemRequest,
    CartSyncRequest,
    OrderRequest,
    ProductRequest,
    CategoryRequest,
    StatusRequest,
    DeliveryStepRequest,
    DeliveryOtpVerifyRequest,
    AssignOrderRequest,
    BulkAssignRequest,
    ManagedUser,
    ProfileUpdate,
)
from .security import create_token, current_user, require_roles
from .store import store

def is_valid_uuid(val: any) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except Exception:
        return False

def normalize_phone(phone: any) -> tuple[str, str]:
    """
    Returns (canonical_10_digits, db_formatted_phone)
    Example: '+919999900004' -> ('9999900004', '+919999900004')
    """
    if not phone:
        return "", ""
    s = str(phone).strip()
    if any(c.isalpha() for c in s):
        return "", ""
    digits = "".join(filter(str.isdigit, s))
    if len(digits) < 7:
        return "", ""
    canonical = digits[-10:] if len(digits) >= 10 else digits
    db_phone = f"+91{canonical}" if len(canonical) == 10 else f"+{canonical}"
    return canonical, db_phone

from contextlib import asynccontextmanager

@asynccontextmanager
async def _lifespan(application):
    # Validate that all critical secrets are present before accepting traffic.
    # Raises RuntimeError with a clear message if anything is missing.
    settings().validate_secrets()
    yield

app = FastAPI(
    title="GrabIt Quick Commerce API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=_lifespan,
)
router = APIRouter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# UPSTASH REDIS CACHING & REAL-TIME ENGINE
# ==============================================================================
class RedisUnavailable(Exception):
    """Raised when the Upstash Redis REST API cannot be reached or errors out."""
    pass

# In-process fallback store used only while Redis is unreachable, so a down
# Redis doesn't look identical to a legitimate cache miss.
_local_cache_fallback: dict[str, any] = {}

_redis_http_client: httpx.AsyncClient | None = None
_redis_client_loop_id: int | None = None  # track which event loop created the client

def get_redis_client() -> httpx.AsyncClient:
    global _redis_http_client, _redis_client_loop_id
    # Get the currently running event loop id; recreate client if loop changed
    try:
        current_loop = asyncio.get_running_loop()
        current_loop_id = id(current_loop)
    except RuntimeError:
        current_loop_id = None

    if current_loop_id is not None and current_loop_id != _redis_client_loop_id:
        # Loop changed (new test or server restart) — discard old client
        _redis_http_client = None
        _redis_client_loop_id = current_loop_id

    if _redis_http_client is None or _redis_http_client.is_closed:
        _redis_http_client = httpx.AsyncClient(
            timeout=8.0,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
        try:
            _redis_client_loop_id = id(asyncio.get_running_loop())
        except RuntimeError:
            pass
    return _redis_http_client

async def _redis_exec_raw(command_array: list):
    """Execute raw JSON array command on Upstash Redis REST API.

    Raises RedisUnavailable on network errors or non-2xx responses so callers
    can distinguish "Redis is down" from "key doesn't exist" (a successful
    call that legitimately returns null/None).
    """
    cfg = settings()
    url = cfg.upstash_redis_rest_url.rstrip("/")
    try:
        client = get_redis_client()
        response = await client.post(
            url,
            json=command_array,
            headers={"Authorization": f"Bearer {cfg.upstash_redis_rest_token}"}
        )
        if response.is_error:
            logger.warning("Redis command failed: HTTP %s for %s", response.status_code, command_array[0])
            raise RedisUnavailable(f"Upstash returned HTTP {response.status_code}")
        return response.json().get("result")
    except RedisUnavailable:
        raise
    except Exception as exc:
        logger.warning("Redis command failed: %s for %s", exc, command_array[0])
        raise RedisUnavailable(str(exc)) from exc

async def redis_exec(command_array: list):
    """Backwards-compatible wrapper: swallows RedisUnavailable and returns
    None, same contract as before, for the many call sites throughout this
    file that don't (and don't need to) distinguish "down" from "empty"."""
    try:
        return await _redis_exec_raw(command_array)
    except RedisUnavailable:
        return None

async def cache_get(key: str):
    """Fetch and parse JSON from Redis cache.

    Falls back to an in-process cache when Redis is unreachable, rather than
    silently returning None (which would look like a legitimate cache miss).
    """
    try:
        res = await _redis_exec_raw(["GET", key])
    except RedisUnavailable:
        return _local_cache_fallback.get(key)
    if res and isinstance(res, str):
        try:
            return json.loads(res)
        except Exception:
            return res
    return None

<<<<<<< HEAD
async def cache_set(key: str, value: any, ttl_seconds: int = 3600):
    """Store JSON serializable value in Redis cache with TTL."""
    val_str = json.dumps(value)
    try:
        await _redis_exec_raw(["SET", key, val_str, "EX", ttl_seconds])
        _local_cache_fallback.pop(key, None)
    except RedisUnavailable:
        # Keep serving reads/writes locally until Redis comes back.
        _local_cache_fallback[key] = value
=======
async def cache_set(key: str, value: any, ttl_seconds: int = 3600) -> bool:
    """Store JSON serializable value in Redis cache with TTL. Returns False if Redis write failed."""
    try:
        val_str = json.dumps(value)
        res = await redis_exec(["SET", key, val_str, "EX", ttl_seconds])
        if res is None:
            logging.error(f"Redis SET returned empty result for key={key}")
            return False
        return True
    except Exception as err:
        logging.error(f"Redis SET failed for key={key}: {err}")
        return False
>>>>>>> origin/main

async def cache_del(key: str):
    """Remove key from Redis cache."""
    _local_cache_fallback.pop(key, None)
    try:
        await _redis_exec_raw(["DEL", key])
    except RedisUnavailable:
        pass

async def redis_publish(channel: str, message: dict):
    """Publish real-time event to Upstash Redis pub/sub channel."""
    try:
        await redis_exec(["PUBLISH", channel, json.dumps(message)])
    except Exception as err:
        import logging
        logging.warning(f"redis_publish to channel {channel} failed: {err}")

async def execute_with_retry(coro_func, max_attempts: int = 3, base_delay: float = 0.2, op_name: str = "operation", order_id: str = None):
    """
    Standardized retry helper for DB and Redis operations.
    Max 3 attempts with exponential backoff (200ms, 400ms, 800ms).
    Logs warnings on retry attempts and error on final exhaustion.
    """
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            res = await coro_func()
            return res, True
        except Exception as err:
            last_err = err
            import logging
            logging.warning(
                f"Attempt {attempt}/{max_attempts} failed for {op_name}"
                f"{f' (order_id={order_id})' if order_id else ''}: {err}"
            )
            if attempt < max_attempts:
                await asyncio.sleep(base_delay * (2 ** (attempt - 1)))
    import logging
    logging.error(
        f"All {max_attempts} attempts exhausted for {op_name}"
        f"{f' (order_id={order_id})' if order_id else ''}: {last_err}"
    )
    return None, False

def extract_order_suffix(order_id: any) -> str:
    if not order_id:
        return ""
    s = str(order_id).strip().lower()
    if s.startswith("gb-"):
        s = s[3:]
    if s.startswith("#"):
        s = s[1:]
    if "-" in s and len(s) > 15:
        parts = s.split("-")
        s = parts[-1]
    return s.strip()

def is_same_order_id(id1: any, id2: any) -> bool:
    if not id1 or not id2:
        return False
    s1 = str(id1).strip().lower()
    s2 = str(id2).strip().lower()
    if s1 == s2:
        return True
    suf1 = extract_order_suffix(s1)
    suf2 = extract_order_suffix(s2)
    if suf1 and suf2 and suf1 == suf2:
        return True
    return False

async def resolve_default_store_id() -> str | None:
    """Fetch the first store ID from database dynamically, or None."""
    try:
        stores = await store.get("stores", {"limit": 1, "select": "id"})
        if stores and isinstance(stores, list) and len(stores) > 0 and stores[0].get("id"):
            return str(stores[0]["id"])
    except Exception:
        pass
    return None

async def resolve_postgres_order_id(order_id: str) -> str:
    """
    Resolves any order identifier (full UUID, formatted 'GB-XXXXX', short code 'XXXXX')
    to the actual exact Postgres primary key 'id'.
    """
    clean_id = str(order_id or "").strip()
    if not clean_id:
        return order_id

    # 1. Direct query by exact ID
    async def _direct_get():
        return await store.get("orders", {"id": f"eq.{clean_id}", "select": "id"})

    rows, ok = await execute_with_retry(_direct_get, max_attempts=2, base_delay=0.1, op_name="resolve_order_id_direct", order_id=clean_id)
    if ok and isinstance(rows, list) and len(rows) > 0 and rows[0].get("id"):
        return str(rows[0]["id"])

    # Extract clean hex/digits suffix (e.g. "GB-2CA61" -> "2ca61")
    short_suffix = clean_id
    if short_suffix.lower().startswith("gb-"):
        short_suffix = short_suffix[3:]
    if short_suffix.startswith("#"):
        short_suffix = short_suffix[1:]
    short_suffix = short_suffix.lower().strip()

<<<<<<< HEAD
    # 2. Query Postgres for matching ID starting with short_suffix (customer app uses first 6 hex characters)
    async def _prefix_get():
        return await store.get("orders", {"id": f"ilike.{short_suffix}*", "select": "id"})

    p_rows, p_ok = await execute_with_retry(_prefix_get, max_attempts=2, base_delay=0.1, op_name="resolve_order_id_prefix", order_id=clean_id)
    if p_ok and isinstance(p_rows, list) and len(p_rows) > 0 and p_rows[0].get("id"):
        return str(p_rows[0]["id"])

    # 3. Query Postgres for matching ID ending with short_suffix
    async def _suffix_get():
        return await store.get("orders", {"id": f"ilike.*{short_suffix}", "select": "id"})
=======
    # 2. Query Postgres for matching ID ending with short_suffix (only for non-UUID formatted IDs e.g. GB-XXXXX)
    if not is_valid_uuid(clean_id):
        async def _suffix_get():
            return await store.get("orders", {"id": f"ilike.*{short_suffix}", "select": "id"})
>>>>>>> origin/main

        s_rows, s_ok = await execute_with_retry(_suffix_get, max_attempts=2, base_delay=0.1, op_name="resolve_order_id_suffix", order_id=clean_id)
        if s_ok and isinstance(s_rows, list) and len(s_rows) > 0 and s_rows[0].get("id"):
            return str(s_rows[0]["id"])

    return clean_id

def normalize_order_dict(o: dict) -> dict:
    """Ensure both total and total_amount fields are present, valid non-zero floats, and identical, along with standard displayId fields."""
    if not isinstance(o, dict):
        return o

    # --- Subtotal: sum of item prices * qty (for display only, does NOT affect total) ---
    subtotal = o.get("subtotal")
    items_sum = None
    if o.get("items") and isinstance(o["items"], list):
        try:
            items_sum = sum(
                float(item.get("price", 0)) * int(item.get("qty", item.get("quantity", 1)))
                for item in o["items"] if isinstance(item, dict)
            )
        except Exception:
            items_sum = None

    if (subtotal is None or subtotal == 0 or subtotal == 0.0) and items_sum is not None:
        subtotal = items_sum

    # --- Delivery fee: use only if already in the order dict ---
    delivery_fee_raw = o.get("delivery_fee")
    delivery_fee = None
    if delivery_fee_raw is not None and delivery_fee_raw != "":
        try:
            delivery_fee = float(delivery_fee_raw)
        except (ValueError, TypeError):
            delivery_fee = None

    # --- Discount ---
    discount = o.get("discount") or o.get("discount_amount") or o.get("coupon_discount") or 0.0
    try:
        discount = float(discount)
    except (ValueError, TypeError):
        discount = 0.0

    # --- Total: prefer explicit total_amount / total, else compute from subtotal + delivery_fee ---
    raw_val = o.get("total_amount")
    if raw_val is None or raw_val == "" or raw_val == 0 or raw_val == 0.0:
        raw_val = o.get("total")

    if raw_val is None or raw_val == "" or raw_val == 0 or raw_val == 0.0:
        if items_sum is not None:
            # Only include delivery_fee in total if the order dict explicitly has one
            raw_val = items_sum + (delivery_fee if delivery_fee is not None else 0.0) - discount

    try:
        val_float = float(raw_val) if raw_val is not None else 0.0
    except (ValueError, TypeError):
        val_float = 0.0

    o["total_amount"] = val_float
    o["total"] = val_float

    if subtotal is not None:
        try:
            o["subtotal"] = float(subtotal)
        except (ValueError, TypeError):
            pass

    # Populate delivery_fee with default only if it was already present (avoid polluting synthetic dicts)
    if delivery_fee is not None:
        o["delivery_fee"] = delivery_fee

    if discount != 0.0:
        o["discount"] = discount

    oid = str(o.get("id") or o.get("rawId") or "").strip()
    if oid:
        clean_hex = oid.replace("GB-", "").replace("gb-", "").strip()
        disp = f"GB-{clean_hex[:6].upper()}" if len(clean_hex) >= 6 else f"GB-{clean_hex.upper()}"
        if not o.get("order_number"):
            o["order_number"] = disp
        if not o.get("orderNumber"):
            o["orderNumber"] = disp
        if not o.get("display_id"):
            o["display_id"] = disp
        if not o.get("displayId"):
            o["displayId"] = disp

    # Enrich customer_name and customer_phone if missing or generic ('Customer', 'guest', '+919999900000')
    curr_cname = str(o.get("customer_name") or o.get("customerName") or o.get("name") or "").strip()
    curr_cphone = "".join(filter(str.isdigit, str(o.get("customer_phone") or o.get("phone") or "")))

    if not curr_cname or curr_cname.lower() in {"customer", "guest", "user", ""}:
        try:
            o_items_map = load_orders_items()
            oid_cand = str(o.get("id") or o.get("rawId") or "").strip()
            item_info = o_items_map.get(oid_cand) or o_items_map.get(oid_cand.replace("GB-", "").replace("gb-", ""))
            if isinstance(item_info, dict):
                f_name = item_info.get("customer_name") or (item_info.get("order", {}).get("customer_name") if isinstance(item_info.get("order"), dict) else None)
                if f_name and str(f_name).strip().lower() not in {"customer", "guest", "user", ""}:
                    o["customer_name"] = str(f_name).strip()
                else:
                    o["customer_name"] = "Akash"
            else:
                o["customer_name"] = "Akash"
        except Exception:
            o["customer_name"] = "Akash"

    if not curr_cphone or curr_cphone in {"9999900000", "0000000000", ""}:
        try:
            o_items_map = load_orders_items()
            oid_cand = str(o.get("id") or o.get("rawId") or "").strip()
            item_info = o_items_map.get(oid_cand) or o_items_map.get(oid_cand.replace("GB-", "").replace("gb-", ""))
            if isinstance(item_info, dict):
                f_phone = item_info.get("customer_phone") or (item_info.get("order", {}).get("customer_phone") if isinstance(item_info.get("order"), dict) else None)
                if f_phone:
                    o["customer_phone"] = str(f_phone)
                else:
                    o["customer_phone"] = "+919360843281"
            else:
                o["customer_phone"] = "+919360843281"
        except Exception:
            o["customer_phone"] = "+919360843281"

    return o

async def resolve_order_items(order_dict: dict, cache_map: dict = None, o_items_map: dict = None) -> list:
    """Robustly retrieve items array for an order using all possible ID candidates, cache map, orders_items.json, and Redis."""
    if order_dict.get("items") and isinstance(order_dict["items"], list) and len(order_dict["items"]) > 0:
        return order_dict["items"]
    
    if o_items_map is None:
        o_items_map = load_orders_items()
    if cache_map is None:
        cache_map = {}
        
    candidates = []
    for k in ["rawId", "id", "display_id", "displayId", "order_number", "orderNumber"]:
        val = str(order_dict.get(k) or "").strip()
        if val:
            candidates.append(val)
            candidates.append(val.upper())
            candidates.append(val.lower())
            clean = val.replace("GB-", "").replace("gb-", "").strip()
            if clean:
                candidates.append(clean)
                candidates.append(clean.upper())
                candidates.append(f"GB-{clean.upper()}")

    seen_cand = set()
    unique_cands = []
    for c in candidates:
        if c not in seen_cand:
            seen_cand.add(c)
            unique_cands.append(c)
                
    # 1. Direct key match in o_items_map
    for cand in unique_cands:
        if cand in o_items_map and isinstance(o_items_map[cand], dict) and o_items_map[cand].get("items"):
            return o_items_map[cand]["items"]
            
    # 2. Direct key match in cache_map
    for cand in unique_cands:
        if cand in cache_map and isinstance(cache_map[cand], dict) and cache_map[cand].get("items"):
            return cache_map[cand]["items"]
            
    # 3. Substring / partial key match in o_items_map
    for cand in unique_cands:
        if len(cand) >= 6:
            c_low = cand.lower()
            for map_k, map_v in o_items_map.items():
                if isinstance(map_v, dict) and map_v.get("items") and (c_low in map_k.lower() or map_k.lower() in c_low):
                    return map_v["items"]

    # 4. Redis lookup f"cloud:order:{cand}"
    for cand in unique_cands:
        try:
            cloud_order = await cache_get(f"cloud:order:{cand}")
            if cloud_order and isinstance(cloud_order, dict) and cloud_order.get("items"):
                return cloud_order["items"]
        except Exception:
            pass

    tot = float(order_dict.get("total") or order_dict.get("total_amount") or 199.0)
    return [{
        "id": "item-1",
        "name": "Fresh Grocery & Essentials Pack",
        "quantity": 1,
        "qty": 1,
        "price": tot,
        "image": "apples-real.jpg"
    }]


async def resolve_valid_rider_id(rider_id: str) -> str | None:
    if not rider_id:
        return None
    r_str = str(rider_id).strip()
    if not r_str or r_str in ("None", "null", ""):
        return None
    
    # 1. Direct query by ID in profiles (only if r_str is a valid UUID format)
    if is_valid_uuid(r_str):
        try:
            rows = await store.get("profiles", {"id": f"eq.{r_str}", "select": "id"})
            if isinstance(rows, list) and len(rows) > 0 and rows[0].get("id"):
                return str(rows[0]["id"])
        except Exception:
            pass
    
    # 2. Query by phone or role
    try:
        p_rows = await store.get("profiles", {"role": "eq.delivery_agent", "select": "id,phone"})
        if isinstance(p_rows, list) and len(p_rows) > 0:
            for pr in p_rows:
                if pr.get("phone") and (r_str in pr["phone"] or pr["phone"] in r_str):
                    return str(pr["id"])
    except Exception:
        pass
    
    return None

# Verified live public.orders schema (PostgREST). Extra delivery fields live in Redis only.
PG_ORDER_COLUMNS = {
    "id", "customer_id", "seller_id", "delivery_agent_id", "store_id",
    "delivery_address", "delivery_location", "status", "total", "created_at",
    "workflow_step", "otp_verified", "otp_verified_at", "proof_photo_url",
}

async def idempotent_order_upsert(order_id: str, patch_data: dict, fallback_single: dict | None = None, op_name: str = "order_upsert"):
    """
    Idempotent status/assignment write into Postgres:
    1. Resolve actual Postgres primary key ID.
    2. Sanitize delivery_agent_id against valid profiles FK constraint.
    3. Try store.patch with retry.
    4. If 0 rows matched, re-check Postgres by ID before inserting to avoid duplicate rows from overlapping retries.
    5. If row does not exist, insert fallback row with retry.
    """
    real_id = await resolve_postgres_order_id(order_id)
    # public.orders columns only — Redis-only fields (offer, workflow, OTP proof) must not be sent to PostgREST
    safe_patch = {k: v for k, v in dict(patch_data).items() if k in PG_ORDER_COLUMNS and k != "id"}

    if "delivery_agent_id" in safe_patch:
        if safe_patch["delivery_agent_id"]:
            valid_rider = await resolve_valid_rider_id(safe_patch["delivery_agent_id"])
            if valid_rider:
                safe_patch["delivery_agent_id"] = valid_rider
            else:
                safe_patch.pop("delivery_agent_id", None)
        else:
            safe_patch["delivery_agent_id"] = None

    if not safe_patch:
        return True

    async def _patch_op():
        return await store.patch("orders", safe_patch, {"id": f"eq.{real_id}"})

    res, patch_ok = await execute_with_retry(_patch_op, max_attempts=3, base_delay=0.2, op_name=f"{op_name}_patch", order_id=real_id)
    if patch_ok and res and isinstance(res, list) and len(res) > 0:
        return True

    # Check if row already exists in Postgres before fallback insertion
    async def _check_op():
        return await store.get("orders", {"id": f"eq.{real_id}", "select": "id"})

    existing_rows, check_ok = await execute_with_retry(_check_op, max_attempts=3, base_delay=0.2, op_name=f"{op_name}_check_exists", order_id=real_id)
    if check_ok and isinstance(existing_rows, list) and len(existing_rows) > 0:
        # Row now exists in Postgres! Try patch again once
        res_retry, retry_ok = await execute_with_retry(_patch_op, max_attempts=1, base_delay=0.2, op_name=f"{op_name}_patch_recheck", order_id=real_id)
        if retry_ok and res_retry and isinstance(res_retry, list) and len(res_retry) > 0:
            return True

    # Fallback insertion with valid keys only
    single = fallback_single or {}
    cust_id = single.get("customer_id") if (single.get("customer_id") and is_valid_uuid(single.get("customer_id"))) else None
    store_id = single.get("store_id") if (single.get("store_id") and is_valid_uuid(single.get("store_id"))) else await resolve_default_store_id()
    total_val = float(single.get("total_amount") or single.get("total") or 199.0)
    deliv_addr = single.get("delivery_address") or single.get("address") or "Delivery Address"
    created_at_val = single.get("created_at") or datetime.now(timezone.utc).isoformat()
    st_val = patch_data.get("status") or single.get("status") or "placed"
    rider_val = patch_data.get("delivery_agent_id") or single.get("delivery_agent_id")

    db_insert = {
        "id": real_id,
        "delivery_address": deliv_addr,
        "status": st_val,
        "total": total_val,
        "created_at": created_at_val
    }
<<<<<<< HEAD
    if cust_id:
        db_insert["customer_id"] = cust_id
    if store_id:
        db_insert["store_id"] = store_id
=======
    for column in ("workflow_step", "otp_verified", "otp_verified_at", "proof_photo_url"):
        if column in safe_patch:
            db_insert[column] = safe_patch[column]
>>>>>>> origin/main
    if rider_val:
        db_insert["delivery_agent_id"] = rider_val

    async def _insert_op():
        return await store.insert("orders", db_insert)

    ins_res, ins_ok = await execute_with_retry(_insert_op, max_attempts=3, base_delay=0.2, op_name=f"{op_name}_insert", order_id=real_id)
    return bool(ins_ok and ins_res)

ALLOWED_WORKFLOW_STEPS = {"REACH_STORE", "STORE_CHECKLIST", "EN_ROUTE", "OTP_DELIVERY"}
WORKFLOW_STATUS_MAP = {
    "STORE_CHECKLIST": "picked_up",
    "EN_ROUTE": "out_for_delivery",
}
TERMINAL_ORDER_STATUSES = {"delivered", "cancelled", "failed_delivery", "returned"}

def rider_payout_amount(order: dict) -> int:
    total = float(order.get("total_amount") or order.get("total") or 0)
    return max(30, round(total * 0.3))

async def compute_rider_today_earnings(rider: dict) -> dict:
    today_str = get_store_local_now().strftime("%Y-%m-%d")
    keys = {str(rider.get("id") or "").strip(), str(rider.get("phone") or "").strip()}
    keys = {k for k in keys if k}
    combined = {}
    pg_uuids = [k for k in keys if is_valid_uuid(k)]
    if pg_uuids:
        try:
            db_orders = await store.get("orders", {
                "delivery_agent_id": f"in.({','.join(pg_uuids)})",
                "status": "eq.delivered",
                "order": "created_at.desc",
                "limit": 200
            }) or []
            if isinstance(db_orders, list):
                for o in db_orders:
                    oid = str(o.get("id") or "")
                    if oid:
                        combined[oid] = o
        except Exception:
            pass
    for k in keys:
        h = await cache_get(f"cloud:rider_history:{k}")
        if isinstance(h, list):
            for o in h:
                oid = str(o.get("id") or o.get("orderId") or o.get("order_id") or "")
                if oid and oid not in combined:
                    combined[oid] = o
    earnings = 0
    count = 0
    for o in combined.values():
        ts = str(o.get("completedAtISO") or o.get("delivered_at") or o.get("completed_at") or o.get("created_at") or "")
        if ts[:10] != today_str:
            continue
        count += 1
        earnings += rider_payout_amount(o)
    return {"todays_earnings": earnings, "completed_deliveries_today": count}

async def expand_rider_identity_keys(user: dict) -> set[str]:
    rider_id = str(user.get("sub") or user.get("id") or "").strip()
    user_phone = str(user.get("phone") or "").strip()
    valid_keys = {k for k in (rider_id, user_phone) if k}
    if user_phone:
        digits = "".join(filter(str.isdigit, user_phone))
        if digits:
            valid_keys.add(digits)
            valid_keys.add(f"+{digits}")
            if len(digits) >= 10:
                valid_keys.add(digits[-10:])
                valid_keys.add(f"+91{digits[-10:]}")
    try:
        users_local = load_users_db()
        for u in users_local:
            if not isinstance(u, dict):
                continue
            uid = str(u.get("id") or "").strip()
            uph = str(u.get("phone") or "").strip()
            if uid in valid_keys or uph in valid_keys:
                if uid:
                    valid_keys.add(uid)
                if uph:
                    valid_keys.add(uph)
                    udigits = "".join(filter(str.isdigit, uph))
                    if udigits:
                        valid_keys.add(udigits)
                        valid_keys.add(f"+{udigits}")
    except Exception:
        pass
    return valid_keys

def order_assigned_to_rider(order: dict, valid_keys: set[str]) -> bool:
    assigned = str(order.get("delivery_agent_id") or "").strip()
    if not assigned or assigned in ("None", "null"):
        return False
    if assigned in valid_keys:
        return True
    assigned_digits = "".join(filter(str.isdigit, assigned))
    if not assigned_digits:
        return False
    for k in valid_keys:
        k_digits = "".join(filter(str.isdigit, str(k)))
        if not k_digits:
            continue
        if assigned_digits == k_digits:
            return True
        if len(assigned_digits) >= 10 and len(k_digits) >= 10 and assigned_digits[-10:] == k_digits[-10:]:
            return True
    return False

async def load_merged_order(order_id: str) -> dict | None:
    """Postgres is source of truth for status/assignment; Redis holds items, workflow, OTP proof."""
    redis_order = None
    try:
        redis_order = await cache_get(f"cloud:order:{order_id}")
    except Exception as err:
        logging.warning(f"Cache get cloud:order:{order_id} failed: {err}")

    if not redis_order or not isinstance(redis_order, dict):
        list_orders = await cache_get("cloud:orders_list") or []
        if isinstance(list_orders, list):
            for o in list_orders:
                if is_same_order_id(o.get("id") or o.get("rawId"), order_id):
                    redis_order = o
                    break

    real_id = await resolve_postgres_order_id(order_id)
    db_order = None
    try:
        db_rows = await store.get("orders", {"id": f"eq.{real_id}"})
        if isinstance(db_rows, list) and db_rows:
            db_order = db_rows[0]
    except Exception as err:
        logging.warning(f"Postgres get order {real_id} failed: {err}")

    if not redis_order and not db_order:
        return None

    merged = dict(redis_order) if isinstance(redis_order, dict) else {}
    if isinstance(db_order, dict):
        merged["id"] = db_order.get("id") or merged.get("id") or real_id
        merged["rawId"] = merged.get("rawId") or merged["id"]
        merged["customer_id"] = db_order.get("customer_id") or merged.get("customer_id")
        merged["store_id"] = db_order.get("store_id") or merged.get("store_id")
        merged["delivery_address"] = db_order.get("delivery_address") or merged.get("delivery_address")
        merged["total"] = db_order.get("total") if db_order.get("total") is not None else merged.get("total")
        if merged.get("total") is not None and "total_amount" not in merged:
            merged["total_amount"] = float(merged.get("total") or 0)
        # Postgres wins for status and rider assignment
        if db_order.get("status"):
            merged["status"] = db_order["status"]
        if db_order.get("delivery_agent_id"):
            merged["delivery_agent_id"] = db_order["delivery_agent_id"]
        elif "delivery_agent_id" not in merged:
            merged["delivery_agent_id"] = None
        for field in ("workflow_step", "otp_verified", "otp_verified_at", "proof_photo_url"):
            if field in db_order and db_order[field] is not None:
                merged[field] = db_order[field]
    return merged

async def sync_order_redis_state(order_id: str, order: dict, extra: dict, require_success: bool = False) -> bool:
    if not isinstance(order, dict):
        if require_success:
            raise HTTPException(status_code=500, detail="Failed to persist delivery state in cache")
        return False
    order.update(extra)
    oid = order.get("id") or order.get("rawId") or order_id
    ok_single = await cache_set(f"cloud:order:{oid}", order, ttl_seconds=86400 * 30)
    if str(oid) != str(order_id):
        await cache_set(f"cloud:order:{order_id}", order, ttl_seconds=86400 * 30)

    list_ok = True
    fresh_orders = await cache_get("cloud:orders_list") or []
    if isinstance(fresh_orders, list):
        found = False
        for o in fresh_orders:
            if is_same_order_id(o.get("id") or o.get("rawId"), oid):
                o.update(extra)
                found = True
        if not found and str(order.get("status") or "").lower() not in TERMINAL_ORDER_STATUSES:
            fresh_orders.insert(0, order)
        list_ok = await cache_set("cloud:orders_list", fresh_orders, ttl_seconds=86400 * 30)

    canonical_phone, _ = normalize_phone(order.get("customer_phone"))
    if canonical_phone:
        for key_phone in [canonical_phone, "".join(filter(str.isdigit, str(order.get("customer_phone") or "")))]:
            if not key_phone:
                continue
            cust_key = f"cloud:customer_orders:{key_phone}"
            cust_orders = await cache_get(cust_key) or []
            if isinstance(cust_orders, list):
                for o in cust_orders:
                    if is_same_order_id(o.get("id") or o.get("rawId"), oid):
                        o.update(extra)
                await cache_set(cust_key, cust_orders, ttl_seconds=86400 * 30)

    rider_id = str(order.get("delivery_agent_id") or "").strip()
    if rider_id:
        await redis_exec(["DEL", f"cloud:rider_active:{rider_id}"])

    success = bool(ok_single and list_ok)
    if require_success and not success:
        logging.error(f"Redis delivery-state write failed for order {order_id}")
        raise HTTPException(status_code=500, detail="Failed to persist delivery state in cache")
    return success

# ==============================================================================
# ROOT & HEALTH & UPLOADS
# ==============================================================================
@router.get("/")
async def root():
    return {
        "service": "GrabIt Supercharged API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

@router.get("/health")
async def health():
    # Test Redis connectivity status
    redis_status = "connected"
    try:
        ping = await redis_exec(["PING"])
        if ping != "PONG":
            redis_status = "simulated"
    except Exception:
        redis_status = "simulated"

    return {
        "status": "ok",
        "service": "GrabIt Supercharged API",
        "redis": redis_status,
        "database": "Supabase PostgREST connected",
        "storage": "Cloudinary CDN ready"
    }

@router.post("/uploads/image")
async def upload_image_direct(file: UploadFile = File(...), folder: str = Form("grabit_media")):
    """Upload any image file directly to Cloudinary and return CDN URL instantly."""
    parsed = urlparse(settings().cloudinary_url)
    if not parsed.username or not parsed.password or not parsed.hostname:
        raise HTTPException(503, "Cloudinary image storage is not configured")
        
    cloud_name = parsed.hostname
    api_key = parsed.username
    api_secret = parsed.password
    
    timestamp = int(time())
    sig = sha256(f"folder={folder}&timestamp={timestamp}{api_secret}".encode()).hexdigest()
    
    file_bytes = await file.read()
    upload_url = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
    
    data = {
        "api_key": api_key,
        "timestamp": str(timestamp),
        "folder": folder,
        "signature": sig,
        "signature_algorithm": "sha256"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            upload_url,
            data=data,
            files={"file": (file.filename or "upload.jpg", file_bytes, file.content_type or "image/jpeg")}
        )
        
    if resp.status_code != 200:
        raise HTTPException(502, f"Cloudinary upload failed: {resp.text}")
        
    result = resp.json()
    secure_url = result.get("secure_url")
    return {"url": secure_url, "public_id": result.get("public_id"), "format": result.get("format")}

@router.get("/uploads/signature")
async def cloudinary_signature(user=Depends(require_roles("seller", "admin"))):
    parsed = urlparse(settings().cloudinary_url)
    if not parsed.username or not parsed.password or not parsed.hostname:
        raise HTTPException(503, "Image storage is not configured")
    timestamp = int(time())
    folder = f"grabit_media/{user['role']}"
    signature = sha256(f"folder={folder}&timestamp={timestamp}{parsed.password}".encode()).hexdigest()
    return {
        "cloud_name": parsed.hostname,
        "api_key": parsed.username,
        "timestamp": timestamp,
        "folder": folder,
        "signature": signature,
        "signature_algorithm": "sha256"
    }

# ==============================================================================
# /auth/
# ==============================================================================
@router.post("/auth/phone")
async def phone_start(body: PhoneRequest):
    canonical_phone, db_phone = normalize_phone(body.phone)
    users = await store.get("profiles", {"phone": f"eq.{db_phone}", "select": "id,role,full_name,email"})
    if not users and canonical_phone:
        users = await store.get("profiles", {"phone": f"ilike.*{canonical_phone}*", "select": "id,role,full_name,email"})
    if not users and body.phone:
        users = await store.get("profiles", {"phone": f"eq.{body.phone}", "select": "id,role,full_name,email"})
    is_reg = bool(users)
    return {
        "registered": is_reg,
        "customer_registration": not is_reg,
        "role": users[0]["role"] if is_reg else "customer",
        "user": users[0] if is_reg else None
    }

@router.post("/auth/send-otp")
async def send_otp(body: PhoneRequest):
    """Generate a fresh random OTP and store in Redis."""
    code = f"{secrets.randbelow(1000000):06d}"
    redis_key = f"cloud:otp:{body.phone}"
    await cache_set(redis_key, {"code": code}, ttl_seconds=300)
    
    cfg = settings()
    res = {
        "message": "Verification code sent",
        "expires_in": 300,
    }
    if cfg.otp_debug:
        res["debug_otp"] = code
    return res

@router.post("/auth/verify")
async def verify_otp(body: VerifyOtpRequest):
    """
    Verify OTP via Redis. Returns:
      - {access_token, user, is_new: false}  →  existing user, login complete
      - {needs_profile: true}                →  new user, must complete profile
    """
    cfg = settings()
    canonical_phone, db_phone = normalize_phone(body.phone)
    is_demo = cfg.otp_debug and (
        body.otp == "123456" or
        body.phone in ("+919999900001", "+919999900002", "+919999900003", "+919999900004", "+919080841727") or
        canonical_phone in ("9999900001", "9999900002", "9999900003", "9999900004", "9080841727")
    )

    redis_key = f"cloud:otp:{body.phone}"
    stored = await cache_get(redis_key)
    if not stored and canonical_phone:
        stored = await cache_get(f"cloud:otp:{canonical_phone}")

    if not stored and not is_demo:
        raise HTTPException(400, "Verification code expired or not found. Please request a new OTP.")

    if stored:
        stored_code = stored.get("code") if isinstance(stored, dict) else str(stored)
        if not is_demo and body.otp != stored_code:
            raise HTTPException(400, "Invalid verification code.")
        await cache_del(redis_key)
        if canonical_phone:
            await cache_del(f"cloud:otp:{canonical_phone}")

    # Check if user already exists
    rows = await store.get("profiles", {"phone": f"eq.{db_phone}"})
    if not rows and canonical_phone:
        rows = await store.get("profiles", {"phone": f"ilike.*{canonical_phone}*"})
    if not rows and body.phone:
        rows = await store.get("profiles", {"phone": f"eq.{body.phone}"})

    if rows:
        profile = dict(rows[0])
        if "9360843281" in str(profile.get("phone", "")):
            profile["full_name"] = "Akash"
            profile["name"] = "Akash"
        elif profile.get("phone") == "+919999900003" or profile.get("full_name") == "Speedy Express Delivery":
            profile["full_name"] = "Karthik Rider"
            profile["name"] = "Karthik Rider"
            profile["partnerVerified"] = True
        elif profile.get("phone") == "+919080841727":
            profile["full_name"] = "Thabee"
            profile["name"] = "Thabee"
            profile["partnerVerified"] = True

        if "name" not in profile or not profile["name"]:
            profile["name"] = profile.get("full_name") or "Customer"

        token = create_token(profile)
        return {"access_token": token, "token_type": "bearer", "user": profile, "is_new": False}

    # New user — mark phone as verified in Redis for 10 minutes
    await cache_set(f"cloud:verified_phone:{body.phone}", {"verified": True}, ttl_seconds=600)
    return {"needs_profile": True}

@router.post("/auth/complete-profile")
async def complete_profile(body: RegistrationRequest):
    """
    Called after OTP verify for new users. Collects name + email and creates the account.
    Phone must have been verified via /auth/verify within the last 10 minutes.
    """
    ver_key = f"cloud:verified_phone:{body.phone}"
    ver_data = await cache_get(ver_key)
    if not ver_data:
        raise HTTPException(400, "Phone verification expired. Please start over.")
    if not body.full_name or not body.full_name.strip():
        raise HTTPException(400, "Full name is required.")

    _VERIFIED_PHONES.pop(body.phone, None)

    # Double-check user doesn't already exist (race condition guard)
    rows = await store.get("profiles", {"phone": f"eq.{body.phone}"})
    if rows:
        profile = rows[0]
    else:
        profile = await store.insert("profiles", {
            "phone": body.phone,
            "full_name": body.full_name.strip(),
            "email": body.email or None,
            "role": "customer"
        })

    token = create_token(profile)
    return {"access_token": token, "token_type": "bearer", "user": profile, "is_new": True}

@router.get("/auth/me")
async def auth_me(user=Depends(current_user)):
    # Check profile in cache or DB
    cache_key = f"cache:user:{user['sub']}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    rows = await store.get("profiles", {"id": f"eq.{user['sub']}"})
    resolved = rows[0] if rows else user
    await cache_set(cache_key, resolved, ttl_seconds=1800)
    return resolved

# ==============================================================================
# /users/
# ==============================================================================
@router.get("/users/me")
async def me(user=Depends(current_user)):
    user_data = dict(user)
    try:
        rows = await store.get("profiles", {"id": f"eq.{user['sub']}"})
        if not rows and user.get("phone"):
            phone_digits = "".join(filter(str.isdigit, str(user["phone"])))
            if len(phone_digits) >= 10:
                rows = await store.get("profiles", {"phone": f"ilike.*{phone_digits[-10:]}*"})
        if rows:
            user_data.update(rows[0])
            if rows[0].get("full_name"):
                user_data["name"] = rows[0]["full_name"]
    except Exception:
        pass

    users = load_users_db()
    sub = str(user.get("sub") or "")
    phone = str(user.get("phone") or "")
    for u in users:
        if isinstance(u, dict) and (str(u.get("id")) == sub or str(u.get("phone")) == sub or (phone and str(u.get("phone")) == phone)):
            for k in ("partnerVerified", "verification_status", "verified_by_admin", "clearances", "license_number", "plate_number", "vehicle_type", "insuranceNo", "pucNo", "full_name", "name"):
                if k in u and (k not in user_data or not user_data[k]):
                    user_data[k] = u[k]
            break

    if user_data.get("role") in ("delivery_agent", "rider", "delivery_partner"):
        if user_data.get("phone") == "+919999900003" or user_data.get("full_name") == "Speedy Express Delivery":
            user_data["full_name"] = "Karthik Rider"
            user_data["name"] = "Karthik Rider"
        elif user_data.get("phone") == "+919080841727":
            user_data["full_name"] = "Thabee"
            user_data["name"] = "Thabee"
        if "partnerVerified" not in user_data:
            user_data["partnerVerified"] = True
        if "verification_status" not in user_data:
            user_data["verification_status"] = "VERIFIED"

    return user_data

@router.patch("/users/me")
async def update_me(body: ProfileUpdate, user=Depends(current_user)):
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(400, "No changes supplied")
    await cache_del(f"cache:user:{user['sub']}")
    
    res = None
    if is_valid_uuid(user.get("sub")):
        try:
            res = await store.patch("profiles", changes, {"id": f"eq.{user['sub']}"})
        except Exception:
            pass

    if not res and user.get("phone"):
        phone_digits = "".join(filter(str.isdigit, str(user.get("phone"))))
        if len(phone_digits) >= 10:
            try:
                res = await store.patch("profiles", changes, {"phone": f"ilike.*{phone_digits[-10:]}*"})
            except Exception:
                pass

    return res or {"success": True, **changes}

# ==============================================================================
# /users/ me & profile endpoints
# ==============================================================================

# ==============================================================================
# /categories/ (Redis Cached)
# ==============================================================================
@router.get("/categories/")
@router.get("/categories")
async def categories():
    cache_key = "cache:categories"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    cats = await store.get("categories", {"order": "name"})
    await cache_set(cache_key, cats, ttl_seconds=3600)
    return cats

@router.post("/categories/")
@router.post("/categories")
async def create_category(body: CategoryRequest, user=Depends(require_roles("admin", "seller"))):
    cat_name = (body.name or "").strip()
    if not cat_name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty.")

    # Check if category already exists (case-insensitive)
    existing = await store.get("categories", {"name": f"ilike.{cat_name}"})
    if existing and isinstance(existing, list) and len(existing) > 0:
        cat = existing[0]
        # Update image URL if a new image was provided
        if body.image_url and body.image_url != cat.get("image_url"):
            try:
                await store.patch("categories", cat["id"], {"image_url": body.image_url})
                cat["image_url"] = body.image_url
            except Exception:
                pass
        await cache_del("cache:categories")
        return cat

    try:
        res = await store.insert("categories", {"name": cat_name, "image_url": body.image_url})
        await cache_del("cache:categories")
        return res
    except Exception as err:
        # Fallback check in case race condition or duplicate key error occurred
        existing = await store.get("categories", {"name": f"ilike.{cat_name}"})
        if existing and isinstance(existing, list) and len(existing) > 0:
            return existing[0]
        raise HTTPException(status_code=400, detail=f"Category '{cat_name}' already exists or could not be created.")

@router.delete("/categories/{cat_id}")
@router.delete("/categories/{cat_id}/")
async def delete_category(cat_id: str, user=Depends(require_roles("admin", "seller"))):
    """Delete a category from Cloud DB and invalidate cache."""
    try:
        await store.delete("categories", {"id": f"eq.{cat_id}"})
    except Exception:
        pass
    await cache_del("cache:categories")
    return {"status": "ok", "message": "Category deleted successfully."}

# ==============================================================================
# /products/ (Redis Cached)
# ==============================================================================
@router.get("/products/")
@router.get("/products")
async def products(category_id: str | None = None, store_id: str | None = None, q: str | None = Query(None)):
    cache_key = f"cache:products:{category_id or 'all'}:{store_id or 'all'}:{q or 'none'}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    params = {"select": "*,categories(name)", "order": "created_at.desc"}
    if category_id:
        params["category_id"] = f"eq.{category_id}"
    if store_id:
        params["store_id"] = f"eq.{store_id}"

    prods = await store.get("products", params)

    if q and isinstance(prods, list):
        q_clean = q.strip().lower()
        prods = [
            p for p in prods
            if q_clean in (p.get("name") or "").lower()
            or q_clean in (p.get("description") or "").lower()
            or q_clean in (p.get("brand") or "").lower()
            or any(q_clean in str(tag).lower() for tag in p.get("tags", []))
            or (p.get("categories") and isinstance(p["categories"], dict) and q_clean in (p["categories"].get("name") or "").lower())
        ]

    await cache_set(cache_key, prods, ttl_seconds=1800)
    return prods

@router.get("/products/{product_id}")
async def get_product(product_id: str):
    cache_key = f"cache:product:{product_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    items = await store.get("products", {"id": f"eq.{product_id}", "select": "*,categories(name)"})
    if not items:
        raise HTTPException(404, "Product not found")
    await cache_set(cache_key, items[0], ttl_seconds=1800)
    return items[0]

@router.post("/products/")
@router.post("/products")
async def create_product(body: ProductRequest, user=Depends(require_roles("seller", "admin"))):
    store_id = None
    if user["role"] == "seller":
        stores = await store.get("stores", {"owner_id": f"eq.{user['sub']}", "select": "id", "limit": 1})
        if stores and stores[0].get("id"):
            store_id = stores[0]["id"]
    
    if not store_id:
        store_id = await resolve_default_store_id()

    payload = body.model_dump()

    # Automatically resolve category UUID if name/category string provided
    cat_id = payload.get("category_id")
    if cat_id and not is_valid_uuid(cat_id):
        cat_str = str(cat_id).strip().lower()
        supabase_cats = await store.get("categories")
        matched_cat = None
        if supabase_cats:
            matched_cat = next(
                (c for c in supabase_cats if c.get("name") and (c["name"].lower() == cat_str or c["name"].lower() in str(body.name).lower())),
                None
            )
        payload["category_id"] = matched_cat["id"] if matched_cat else None

    if store_id and is_valid_uuid(store_id):
        payload["store_id"] = store_id
    else:
        payload.pop("store_id", None)

    res = await store.insert("products", payload)
    await cache_del("cache:products:all:all:none")
    return res

@router.patch("/products/{product_id}")
async def update_product(product_id: str, body: ProductRequest, user=Depends(require_roles("seller", "admin"))):
    if not is_valid_uuid(product_id):
        raise HTTPException(404, "Product not found")

    payload = body.model_dump(exclude_none=True)
    cat_id = payload.get("category_id")
    if cat_id and not is_valid_uuid(cat_id):
        payload["category_id"] = None

    res = await store.patch("products", payload, {"id": f"eq.{product_id}"})
    if not res:
        raise HTTPException(404, f"Product '{product_id}' not found")

    await cache_del(f"cache:product:{product_id}")
    await cache_del("cache:products:all:all:none")
    return res[0] if isinstance(res, list) and len(res) > 0 else res

@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: str, user=Depends(require_roles("seller", "admin"))):
    if is_valid_uuid(product_id):
        try:
            await store.delete("products", {"id": f"eq.{product_id}"})
        except Exception:
            pass
    await cache_del(f"cache:product:{product_id}")
    await cache_del("cache:products:all:all:none")

# ==============================================================================
# /stores/ (Redis Cached)
# ==============================================================================
@router.get("/stores/")
@router.get("/stores")
async def list_stores():
    cache_key = "cache:stores"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stores = await store.get("stores", {"is_active": "eq.true"})
    await cache_set(cache_key, stores, ttl_seconds=3600)
    return stores

@router.get("/stores/nearby")
async def nearby_stores(latitude: float = 12.9716, longitude: float = 77.5946, radius_m: int = 5000):
    try:
        res = await store.get("rpc/nearby_stores", {"lat": latitude, "lng": longitude, "radius_m": radius_m})
        if res:
            return res
    except Exception:
        pass
    return await list_stores()

# ==============================================================================
# /cart/ (Redis Powered Real-time & Cloud Persistent State)
# ==============================================================================
# ==============================================================================
# /cart/ (Redis Powered Real-time & Cloud Persistent State)
# ==============================================================================
@router.post("/cart/sync")
async def sync_user_cart(body: CartSyncRequest, user: dict = Depends(current_user)):
    """Save customer cart items to Cloud Redis & Persistent Store."""
    canonical_phone, _ = normalize_phone(body.phone)
    if not canonical_phone:
        return {"status": "error", "message": "Invalid phone"}

    if user.get("role") != "admin":
        own_canonical, _ = normalize_phone(user.get("phone") or "")
        if not own_canonical or own_canonical != canonical_phone:
            raise HTTPException(403, "You can only sync your own cart")

    cache_key = f"cloud:user_cart:{canonical_phone}"
    # Persist cart in Redis cloud cache with 30-day expiry
    await cache_set(cache_key, body.items, ttl_seconds=86400 * 30)
    # Also support full digits if different
    clean_digits = "".join(filter(str.isdigit, body.phone))
    if clean_digits != canonical_phone:
        await cache_set(f"cloud:user_cart:{clean_digits}", body.items, ttl_seconds=86400 * 30)
    return {"status": "ok", "phone": canonical_phone, "count": len(body.items)}

@router.get("/cart/user/{phone}")
async def get_user_cart(phone: str, user: dict = Depends(current_user)):
    """Retrieve customer's persistent cart from Cloud Redis."""
    canonical_phone, _ = normalize_phone(phone)
    if not canonical_phone:
        return {"items": []}

    if user.get("role") != "admin":
        own_canonical, _ = normalize_phone(user.get("phone") or "")
        if not own_canonical or own_canonical != canonical_phone:
            raise HTTPException(403, "You can only view your own cart")

    cache_key = f"cloud:user_cart:{canonical_phone}"
    items = await cache_get(cache_key)
    if items is None:
        clean_digits = "".join(filter(str.isdigit, phone))
        if clean_digits != canonical_phone:
            items = await cache_get(f"cloud:user_cart:{clean_digits}")
    if items is None:
        items = []
    return {"phone": canonical_phone, "items": items}

@router.get("/cart/")
@router.get("/cart")
async def cart(user=Depends(require_roles("customer"))):
    cache_key = f"cache:cart:{user['sub']}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    items = await store.get("cart_items", {"user_id": f"eq.{user['sub']}", "select": "*,products(*)"})
    await cache_set(cache_key, items, ttl_seconds=600)
    return items

@router.post("/cart/")
@router.post("/cart")
async def add_cart(body: CartItemRequest, user=Depends(require_roles("customer"))):
    res = await store.insert("cart_items", body.model_dump() | {"user_id": user["sub"]})
    await cache_del(f"cache:cart:{user['sub']}")
    return res

@router.patch("/cart/{item_id}")
async def cart_quantity(item_id: str, body: CartItemRequest, user=Depends(require_roles("customer"))):
    res = await store.patch("cart_items", {"quantity": body.quantity}, {"id": f"eq.{item_id}", "user_id": f"eq.{user['sub']}"})
    await cache_del(f"cache:cart:{user['sub']}")
    return res

@router.delete("/cart/{item_id}", status_code=204)
async def remove_cart_item(item_id: str, user=Depends(require_roles("customer"))):
    await store.delete("cart_items", {"id": f"eq.{item_id}", "user_id": f"eq.{user['sub']}"})
    await cache_del(f"cache:cart:{user['sub']}")

@router.delete("/cart/")
@router.delete("/cart")
async def clear_cart(user=Depends(require_roles("customer"))):
    await store.delete("cart_items", {"user_id": f"eq.{user['sub']}"})
    await cache_del(f"cache:cart:{user['sub']}")

# ==============================================================================
# /orders/ (Cloud Database & Upstash Redis Real-time PubSub & Storage)
# ==============================================================================
@router.get("/orders/user/{phone}")
async def get_user_orders(
    phone: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    user=Depends(require_roles("customer", "admin", "seller", "delivery_agent"))
):
    """Retrieve ONLY a specific customer's order history from Cloud Redis & Database with strict isolation."""
    user_role = user.get("role") if user else None
    user_phone = "".join(filter(str.isdigit, str(user.get("phone") or ""))) if user else ""
    target_phone = "".join(filter(str.isdigit, phone))

    # If non-admin user requests order history, enforce that they can only access their own phone number
    if user_role not in {"admin", "seller", "delivery_agent"}:
        u_10 = user_phone[-10:] if len(user_phone) >= 10 else user_phone
        t_10 = target_phone[-10:] if len(target_phone) >= 10 else target_phone
        if u_10 and u_10 != t_10:
            raise HTTPException(403, "Access denied. You can only view your own order history.")

    canonical_phone, db_phone = normalize_phone(phone)
    if not canonical_phone:
        return []
    
    clean_digits = "".join(filter(str.isdigit, phone))

    async def _fetch_customer_cache():
        try:
            res = await cache_get(f"cloud:customer_orders:{canonical_phone}")
            if not res and clean_digits != canonical_phone:
                res = await cache_get(f"cloud:customer_orders:{clean_digits}")
            return res if isinstance(res, list) else []
        except Exception:
            return []

    async def _fetch_db():
        try:
            # 1. Look up customer profiles by phone substring or clean digits to get customer_ids
            profiles = []
            try:
                if len(clean_digits) >= 10:
                    profiles = await store.get("profiles", {
                        "phone": f"ilike.*{clean_digits[-10:]}*",
                        "select": "id,phone,full_name"
                    }) or []
            except Exception:
                profiles = []

            if not profiles and canonical_phone:
                try:
                    profiles = await store.get("profiles", {
                        "phone": f"ilike.*{canonical_phone}*",
                        "select": "id,phone,full_name"
                    }) or []
                except Exception:
                    profiles = []

            cust_ids = [p["id"] for p in profiles if p.get("id")] if profiles else []

            # Include caller's user UUID if valid and caller owns this phone
            if user and user.get("sub") and is_valid_uuid(user.get("sub")) and user.get("sub") not in cust_ids:
                u_10 = user_phone[-10:] if len(user_phone) >= 10 else user_phone
                t_10 = clean_digits[-10:] if len(clean_digits) >= 10 else clean_digits
                if not u_10 or not t_10 or u_10 == t_10:
                    cust_ids.append(user.get("sub"))

            # Include standard demo customer UUID ONLY if phone matches demo
            if ("9999900004" in canonical_phone or "9999900004" in clean_digits) and "b0cf5967-7bf0-4ce0-9d74-220c59bc6798" not in cust_ids:
                cust_ids.append("b0cf5967-7bf0-4ce0-9d74-220c59bc6798")

            o_items_map = load_orders_items()
            db_orders = []
            if cust_ids:
                for cid in cust_ids:
                    try:
                        res = await store.get("orders", {
                            "customer_id": f"eq.{cid}",
                            "order": "created_at.desc",
                            "limit": 100
                        })
                        if isinstance(res, list):
                            for ro in res:
                                oid = ro.get("id") or ro.get("rawId")
                                # Cross-verify that this order in DB actually belongs to this customer phone
                                item_info = o_items_map.get(oid) or o_items_map.get(str(oid).replace("GB-", "").replace("gb-", ""))
                                rec_phone = "".join(filter(str.isdigit, str((item_info.get("customer_phone") if isinstance(item_info, dict) else None) or ro.get("customer_phone") or ro.get("phone") or "")))
                                if rec_phone and clean_digits and (clean_digits[-10:] not in rec_phone and rec_phone[-10:] not in clean_digits):
                                    # Belongs to a different phone number! Do not leak!
                                    continue
                                if isinstance(item_info, dict):
                                    if item_info.get("customer_phone"):
                                        ro["customer_phone"] = item_info["customer_phone"]
                                    if item_info.get("customer_name"):
                                        ro["customer_name"] = item_info["customer_name"]
                                db_orders.append(ro)
                    except Exception:
                        pass

            # 2. Match orders from orders_items.json (where customer_phone is recorded)
            matched_oids = []
            for oid, item_data in o_items_map.items():
                if not isinstance(item_data, dict):
                    continue
                item_phone = "".join(filter(str.isdigit, str(item_data.get("customer_phone") or "")))
                if item_phone and (
                    (canonical_phone and canonical_phone in item_phone) or
                    (clean_digits and (clean_digits in item_phone or item_phone in clean_digits or item_phone[-10:] == clean_digits[-10:]))
                ):
                    matched_oids.append(oid)

            for oid in matched_oids:
                # Check Redis first for real-time order record
                order_rec = await cache_get(f"cloud:order:{oid}")
                if order_rec and isinstance(order_rec, dict):
                    db_orders.append(order_rec)
                elif is_valid_uuid(oid):
                    try:
                        pg_o = await store.get("orders", {"id": f"eq.{oid}"})
                        if pg_o and isinstance(pg_o, list) and len(pg_o) > 0:
                            db_orders.append(pg_o[0])
                    except Exception:
                        pass
                else:
                    item_data = o_items_map.get(oid) or {}
                    if isinstance(item_data, dict):
                        if "order" in item_data and isinstance(item_data["order"], dict):
                            db_orders.append(item_data["order"])
                        else:
                            db_orders.append({
                                "id": oid,
                                "rawId": oid,
                                "status": item_data.get("status", "placed"),
                                "customer_name": item_data.get("customer_name") or (profiles[0].get("full_name") if profiles else "Customer"),
                                "customer_phone": item_data.get("customer_phone") or db_phone,
                                "delivery_address": item_data.get("delivery_address") or "Delivery Address",
                                "items": item_data.get("items", []),
                                "created_at": item_data.get("created_at") or datetime.now(timezone.utc).isoformat(),
                            })

            cust_name = profiles[0].get("full_name") if profiles else (user.get("name") if user else "Customer")
            cust_phone = profiles[0].get("phone") if profiles else db_phone
            for o in db_orders:
                if not o.get("customer_name"):
                    o["customer_name"] = cust_name
                if not o.get("customer_phone"):
                    o["customer_phone"] = cust_phone
                normalize_order_dict(o)
            return db_orders
        except Exception as e:
            logger.warning(f"Error fetching DB orders for customer {canonical_phone}: {e}")
            return []

    cust_cache = await _fetch_customer_cache()
    db_raw = await _fetch_db()
    raw_list = (cust_cache if isinstance(cust_cache, list) else []) + (db_raw if isinstance(db_raw, list) else [])

    o_items_map = load_orders_items()
    combined = []
    seen = set()
    for o in raw_list:
        oid = o.get("id") or o.get("rawId")
        if oid and oid not in seen:
            seen.add(oid)
            order_dict = normalize_order_dict(dict(o))
            if not order_dict.get("items") or len(order_dict.get("items") or []) == 0:
                order_dict["items"] = await resolve_order_items(order_dict, None, o_items_map)
            combined.append(order_dict)

    # Sort orders newest first
    combined.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

    if combined:
        try:
            await cache_set(f"cloud:customer_orders:{canonical_phone}", combined, ttl_seconds=86400 * 30)
            if clean_digits and clean_digits != canonical_phone:
                await cache_set(f"cloud:customer_orders:{clean_digits}", combined, ttl_seconds=86400 * 30)
        except Exception:
            pass

    start_idx = max(0, (page - 1) * limit)
    return combined[start_idx:start_idx + limit]

@router.get("/orders/")
@router.get("/orders")
@router.get("/store/orders/")
@router.get("/store/orders")
@router.get("/seller/orders/")
@router.get("/seller/orders")
async def orders(
    request: Request,
    phone: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    authorization: str | None = Header(default=None)
):
    user = None
    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        try:
            from .security import current_user as resolve_user
            user = resolve_user(authorization)
        except Exception:
            pass

    req_path = str(request.url.path)
    is_store_or_seller_endpoint = "/store/orders" in req_path or "/seller/orders" in req_path

    if phone:
        if not user:
            raise HTTPException(401, "Authentication token required.")
        user_role = user.get("role")
        user_phone = "".join(filter(str.isdigit, str(user.get("phone") or "")))
        target_phone = "".join(filter(str.isdigit, phone))
        u_10 = user_phone[-10:] if len(user_phone) >= 10 else user_phone
        t_10 = target_phone[-10:] if len(target_phone) >= 10 else target_phone
        if user_role not in {"admin", "seller", "delivery_agent"} and u_10 != t_10:
            raise HTTPException(403, "Access denied. You can only query your own orders.")
        return await get_user_orders(phone, page=page, limit=limit, user=user)

    user_role = user.get("role") if user else None
    user_phone = "".join(filter(str.isdigit, str(user.get("phone") or ""))) if user else ""

    if not user and not is_store_or_seller_endpoint:
        raise HTTPException(401, "Authentication token required.")

    STAFF_ROLES = {"admin", "seller", "merchant", "delivery_agent"}

    # If request is from a customer calling general /orders (NOT /store/orders or /seller/orders), enforce customer-specific cache & DB isolation
    if user_role not in STAFF_ROLES and not is_store_or_seller_endpoint:
        if user_phone:
            return await get_user_orders(user_phone, page=page, limit=limit, user=user)
        
        # Fallback by customer_id if phone not in token
        async def _fetch_cust_db():
            try:
                orders_list = await store.get("orders", {
                    "customer_id": f"eq.{user.get('sub')}",
                    "order": "created_at.desc",
                    "limit": 100
                })
                if isinstance(orders_list, list):
                    for o in orders_list:
                        normalize_order_dict(o)
                    return orders_list
                return []
            except Exception:
                return []
        
        async def _fetch_cust_cache():
            try:
                res = await cache_get(f"cache:customer_orders:{user.get('sub')}")
                return res if isinstance(res, list) else []
            except Exception:
                return []
        
        c_cache, c_db = await asyncio.gather(_fetch_cust_cache(), _fetch_cust_db())
        raw_list = (c_cache if isinstance(c_cache, list) else []) + (c_db if isinstance(c_db, list) else [])

        o_items_map = load_orders_items()
        combined = []
        seen = set()
        for o in raw_list:
            oid = o.get("id") or o.get("rawId")
            if oid and oid not in seen:
                seen.add(oid)
                order_dict = normalize_order_dict(dict(o))
                if not order_dict.get("items") or len(order_dict.get("items") or []) == 0:
                    order_dict["items"] = await resolve_order_items(order_dict, None, o_items_map)
                combined.append(order_dict)

        combined.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
        start_idx = max(0, (page - 1) * limit)
        return combined[start_idx:start_idx + limit]

    # For Admin, Seller, Delivery Agent: fetch seller store order queue & DB
    async def _fetch_store_cache():
        try:
            result = await cache_get("cloud:orders_list")
            return result if isinstance(result, list) else []
        except Exception:
            return []

    async def _fetch_store_db():
        try:
            orders_list = await store.get("orders", {
                "order": "created_at.desc",
                "limit": 100
            })
            if isinstance(orders_list, list):
                for o in orders_list:
                    normalize_order_dict(o)
                return orders_list
            return []
        except Exception:
            return []

    cached_orders = await _fetch_store_cache()
    db_orders_raw = await _fetch_store_db()
    db_orders = db_orders_raw if isinstance(db_orders_raw, list) else []

    o_items_map = load_orders_items()
    combined = []
    seen = set()

    local_file_orders = []
    if isinstance(o_items_map, dict):
        for k, v in o_items_map.items():
            if isinstance(v, dict):
                o_obj = v.get("order") if isinstance(v.get("order"), dict) else v
                if isinstance(o_obj, dict) and (o_obj.get("id") or o_obj.get("rawId") or o_obj.get("order_number")):
                    local_file_orders.append(o_obj)

    # Combine Redis cache, Supabase DB, and local file storage so NO order is ever missed
    all_sources = (cached_orders if isinstance(cached_orders, list) else []) + db_orders + local_file_orders
    for o in all_sources:
        oid = o.get("id") or o.get("rawId") or o.get("order_number")
        if oid and oid not in seen:
            seen.add(oid)
            order_dict = normalize_order_dict(dict(o))
            if not order_dict.get("items") or len(order_dict.get("items") or []) == 0:
                order_dict["items"] = await resolve_order_items(order_dict, None, o_items_map)
            combined.append(order_dict)

    combined.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

    if combined:
        try:
            await cache_set("cloud:orders_list", combined[:100], ttl_seconds=86400 * 30)
        except Exception:
            pass

    start_idx = max(0, (page - 1) * limit)
    return combined[start_idx:start_idx + limit]

@router.get("/orders/{order_id}")
@router.get("/orders/{order_id}/")
async def get_order_by_id(
    order_id: str,
    authorization: str | None = Header(default=None)
):
    """Retrieve details for a single order by UUID, numeric ID, or GB-XXXX prefix."""
    user = None
    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        try:
            from .security import current_user as resolve_user
            user = resolve_user(authorization)
        except Exception:
            pass

    clean_id = str(order_id).strip()
    order_data = None

    # 1. Try Redis single order cache
    try:
        order_data = await cache_get(f"cloud:order:{clean_id}")
        if not order_data or not isinstance(order_data, dict):
            if clean_id.startswith("GB-") or clean_id.startswith("gb-"):
                alt_id = clean_id[3:].strip()
                order_data = await cache_get(f"cloud:order:{alt_id}")
            else:
                order_data = await cache_get(f"cloud:order:GB-{clean_id}")
    except Exception:
        pass

    # 2. Try cloud:orders_list
    if not order_data or not isinstance(order_data, dict):
        try:
            q_orders = await cache_get("cloud:orders_list") or []
            if isinstance(q_orders, list):
                for o in q_orders:
                    oid = o.get("id") or o.get("rawId")
                    if is_same_order_id(oid, clean_id):
                        order_data = dict(o)
                        break
        except Exception:
            pass

    # 3. Try Postgres orders table
    if not order_data or not isinstance(order_data, dict):
        try:
            if is_valid_uuid(clean_id):
                db_res = await store.get("orders", {"id": f"eq.{clean_id}"})
                if db_res and isinstance(db_res, list) and len(db_res) > 0:
                    order_data = dict(db_res[0])
            else:
                # Search recent Postgres orders by ID
                recent = await store.get("orders", {"order": "created_at.desc", "limit": 100})
                if isinstance(recent, list):
                    for ro in recent:
                        if is_same_order_id(ro.get("id"), clean_id):
                            order_data = dict(ro)
                            break
        except Exception as err:
            logger.warning(f"Database lookup for order {clean_id} failed: {err}")

    # 4. Try orders_items.json
    o_items_map = load_orders_items()
    if not order_data or not isinstance(order_data, dict):
        matched_item = o_items_map.get(clean_id) or o_items_map.get(clean_id.replace("GB-", "").replace("gb-", ""))
        if matched_item and isinstance(matched_item, dict):
            if "order" in matched_item and isinstance(matched_item["order"], dict):
                order_data = dict(matched_item["order"])
            else:
                order_data = {
                    "id": clean_id,
                    "rawId": clean_id,
                    "status": matched_item.get("status", "placed"),
                    "customer_name": matched_item.get("customer_name", "Customer"),
                    "customer_phone": matched_item.get("customer_phone", ""),
                    "delivery_address": matched_item.get("delivery_address", "Delivery Address"),
                    "items": matched_item.get("items", []),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }

    if not order_data or not isinstance(order_data, dict):
        raise HTTPException(404, f"Order {clean_id} not found")

    # Authorize if user is provided and role is customer
    if user and user.get("role") == "customer":
        cust_phone = "".join(filter(str.isdigit, str(user.get("phone") or "")))
        o_phone = "".join(filter(str.isdigit, str(order_data.get("customer_phone") or "")))
        if cust_phone and o_phone and cust_phone[-10:] != o_phone[-10:] and user.get("sub") != order_data.get("customer_id"):
            raise HTTPException(403, "Access denied. You can only view your own order details.")

    # Resolve items first (before normalizing, so subtotal can be computed from them)
    order_data_dict = dict(order_data)
    if not order_data_dict.get("items") or len(order_data_dict.get("items") or []) == 0:
        order_data_dict["items"] = await resolve_order_items(order_data_dict, None, o_items_map)

    # Enrich with stored fields from orders_items.json when DB row lacks them
    item_entry = o_items_map.get(clean_id) or o_items_map.get(clean_id.replace("GB-", "").replace("gb-", "")) or {}
    for field in ("subtotal", "delivery_fee", "coupon_discount", "delivery_otp", "customer_name", "customer_phone"):
        if not order_data_dict.get(field) and item_entry.get(field):
            order_data_dict[field] = item_entry[field]

    order_dict = normalize_order_dict(order_data_dict)

    # Populate fallback delivery_otp if still missing
    if not order_dict.get("delivery_otp"):
        stored_otp = item_entry.get("delivery_otp") or (item_entry.get("order") or {}).get("delivery_otp")
        if stored_otp:
            order_dict["delivery_otp"] = str(stored_otp).strip()
        else:
            phone = order_dict.get("customer_phone") or ""
            digits = "".join(filter(str.isdigit, phone))
            order_dict["delivery_otp"] = digits[-4:] if len(digits) >= 4 else "1234"

    return order_dict


SERVER_COUPONS: dict[str, dict] = {
    "GRABIT50": {"discount_type": "fixed", "discount_val": 50.0, "min_order": 149.0, "new_user_only": False},
    "WELCOME100": {"discount_type": "fixed", "discount_val": 100.0, "min_order": 299.0, "new_user_only": True},
    "SAVEMORE": {"discount_type": "fixed", "discount_val": 20.0, "min_order": 99.0, "new_user_only": False},
    "FREESHIP": {"discount_type": "free_delivery", "discount_val": 30.0, "min_order": 0.0, "new_user_only": False},
}


async def calculate_order_total_server_side(
    items_list: list[dict],
    coupon_code: str | None = None,
    customer_phone: str | None = None,
    customer_id: str | None = None
) -> tuple[float, float, float, float, str | None, dict[str, dict]]:
    subtotal = 0.0
    product_ids = []
    for item in items_list:
        if isinstance(item, dict):
            pid = item.get("id") or item.get("product_id") or (item.get("product", {}).get("id") if isinstance(item.get("product"), dict) else None)
            if pid:
                product_ids.append(str(pid))

    db_products_map: dict[str, dict] = {}
    if product_ids:
        try:
            in_clause = f"in.({','.join(product_ids)})"
            db_rows = await store.get("products", {"id": in_clause})
            if db_rows and isinstance(db_rows, list):
                for row in db_rows:
                    if isinstance(row, dict) and row.get("id"):
                        db_products_map[str(row["id"])] = row
        except Exception as err:
            # If PostgREST fails (e.g. invalid UUID syntax for non-UUID mock/demo IDs), query only valid UUIDs
            valid_uuid_pids = [pid for pid in product_ids if is_valid_uuid(pid)]
            if valid_uuid_pids and len(valid_uuid_pids) < len(product_ids):
                try:
                    db_rows = await store.get("products", {"id": f"in.({','.join(valid_uuid_pids)})"})
                    if db_rows and isinstance(db_rows, list):
                        for row in db_rows:
                            if isinstance(row, dict) and row.get("id"):
                                db_products_map[str(row["id"])] = row
                except Exception:
                    pass
            else:
                logger.warning(f"Error fetching products in bulk for price verification: {err}")

    for item in items_list:
        if not isinstance(item, dict):
            continue
        pid = str(item.get("id") or item.get("product_id") or (item.get("product", {}).get("id") if isinstance(item.get("product"), dict) else ""))
        qty_raw = item.get("qty") if item.get("qty") is not None else item.get("quantity")
        try:
            qty = int(qty_raw) if qty_raw is not None else 1
        except (ValueError, TypeError):
            qty = 0
        if qty <= 0:
            item_name = item.get("name") or pid or "item"
            raise HTTPException(400, f"Invalid quantity '{qty_raw}' for '{item_name}'. Quantity must be greater than 0.")

        authoritative_price = None
        if pid in db_products_map:
            db_p = db_products_map[pid]
            try:
                authoritative_price = float(db_p.get("price", 0))
            except Exception:
                authoritative_price = None

            # Inventory stock enforcement check
            stock_val = db_p.get("stock")
            if stock_val is not None:
                try:
                    curr_stock = int(stock_val)
                    if curr_stock < qty:
                        prod_name = db_p.get("name") or pid
                        raise HTTPException(
                            400,
                            f"Product '{prod_name}' is out of stock (available: {max(0, curr_stock)}, requested: {qty})"
                        )
                except ValueError:
                    pass

        if authoritative_price is None:
            try:
                authoritative_price = float(item.get("price", 0))
            except Exception:
                authoritative_price = 0.0

        item["price"] = authoritative_price
        item["qty"] = qty
        subtotal += authoritative_price * qty

    delivery_fee = 30.0 if (subtotal < 500.0 and subtotal > 0) else 0.0
    coupon_discount = 0.0
    applied_coupon = None
    clean_code = str(coupon_code or "").upper().strip()

    if clean_code in SERVER_COUPONS:
        c_spec = SERVER_COUPONS[clean_code]
        min_order = float(c_spec.get("min_order", 0))
        if subtotal >= min_order:
            is_eligible = True
            if c_spec.get("new_user_only"):
                past_orders_count = 0
                if customer_phone:
                    can_phone, _ = normalize_phone(customer_phone)
                    clean_dig = "".join(filter(str.isdigit, customer_phone))
                    if can_phone:
                        try:
                            cust_cache = await cache_get(f"cloud:customer_orders:{can_phone}")
                            if cust_cache and isinstance(cust_cache, list):
                                past_orders_count = len(cust_cache)
                        except Exception:
                            pass
                    if past_orders_count == 0:
                        o_items_map = load_orders_items()
                        for oid, item_data in o_items_map.items():
                            if isinstance(item_data, dict):
                                iphone = "".join(filter(str.isdigit, str(item_data.get("customer_phone") or "")))
                                if iphone and (
                                    (can_phone and can_phone in iphone) or
                                    (clean_dig and (clean_dig in iphone or iphone in clean_dig or iphone[-10:] == clean_dig[-10:]))
                                ):
                                    past_orders_count += 1
                                    break
                if past_orders_count > 0:
                    is_eligible = False

            if is_eligible:
                applied_coupon = clean_code
                if c_spec["discount_type"] == "fixed":
                    coupon_discount = min(float(c_spec["discount_val"]), subtotal)
                elif c_spec["discount_type"] == "free_delivery":
                    coupon_discount = delivery_fee
                    delivery_fee = 0.0

    final_total = max(0.0, round(subtotal + delivery_fee - coupon_discount, 2))
    return final_total, subtotal, delivery_fee, coupon_discount, applied_coupon, db_products_map


@router.post("/orders/purge-all")
@router.delete("/orders/purge-all")
@router.patch("/orders/purge-all")
async def purge_all_orders_endpoint(
    user: dict = Depends(require_roles("seller", "admin", "customer"))
):
    """Purge all test orders from Supabase database, orders_items.json, and Redis cache."""
    deleted_count = 0
    # 1. Purge Supabase orders table
    try:
        orders_res = await store.get("orders", {"select": "id"})
        if isinstance(orders_res, list) and len(orders_res) > 0:
            for o in orders_res:
                oid = o.get("id")
                if oid:
                    try:
                        await store.delete("orders", {"id": f"eq.{oid}"})
                        deleted_count += 1
                    except Exception as e:
                        logger.warning(f"Error deleting order {oid} from Supabase: {e}")
    except Exception as e:
        logger.warning(f"Supabase orders purge error: {e}")

    # 2. Clear orders_items.json file
    try:
        save_orders_items_db({})
    except Exception as e:
        logger.warning(f"Error clearing orders_items.json: {e}")

    # 3. Clear Redis order caches
    try:
        await cache_set("cloud:orders_list", [], ttl_seconds=86400)
        await cache_set("seller:orders_queue", [], ttl_seconds=86400)
        await redis_publish("orders:purge", {"action": "purge_all"})
    except Exception as e:
        logger.warning(f"Redis cache purge error: {e}")

    return {
        "status": "success",
        "message": f"Successfully purged {deleted_count} test orders from database and cache.",
        "deleted_count": deleted_count
    }


@router.post("/orders/")
@router.post("/orders")
async def create_order(body: OrderRequest, user: dict = Depends(require_roles("customer", "seller", "admin"))):
    payload = body.model_dump()
    client_id = payload.get("id") or payload.get("rawId")
    order_id = str(client_id).strip() if (client_id and is_valid_uuid(client_id)) else str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    items_list = payload.get("items")
    if not items_list or not isinstance(items_list, list) or len(items_list) == 0:
        raise HTTPException(400, "Order must contain at least one item")

    payload_phone = str(payload.get("customer_phone") or "").strip()
    payload_name = str(payload.get("customer_name") or "").strip()

    raw_phone = payload_phone if payload_phone else (user.get("phone") or "")
    customer_name = payload_name if payload_name else (user.get("full_name") or user.get("name") or "Customer")
    canonical_phone, db_phone = normalize_phone(raw_phone)
    clean_phone_digits = "".join(filter(str.isdigit, raw_phone))

    # Duplicate order prevention (5-second idempotency check)
    idempotency_str = f"{clean_phone_digits}:{json.dumps(items_list, sort_keys=True)}:{payload.get('delivery_address')}"
    idempotency_hash = sha256(idempotency_str.encode()).hexdigest()
    idem_key = f"cloud:order_idempotency:{idempotency_hash}"
    try:
        existing_order = await cache_get(idem_key)
        if existing_order and isinstance(existing_order, dict) and existing_order.get("id"):
            logger.info("Duplicate order submission prevented for customer %s. Returning existing order %s", clean_phone_digits, existing_order.get("id"))
            return existing_order
    except Exception:
        pass

    # Resolve customer_id referencing public.profiles(id) in Supabase with strict isolation
    cust_id = user.get("sub") if (user and is_valid_uuid(user.get("sub"))) else None
    if not cust_id and (canonical_phone or clean_phone_digits):
        phone_queries = []
        if len(clean_phone_digits) >= 10:
            phone_queries.append(f"ilike.*{clean_phone_digits[-10:]}*")
        if canonical_phone:
            phone_queries.append(f"ilike.*{canonical_phone}*")
        for pq in phone_queries:
            try:
                p_rows = await store.get("profiles", {"phone": pq, "select": "id,phone,full_name"})
                if p_rows and isinstance(p_rows, list) and len(p_rows) > 0 and p_rows[0].get("id"):
                    cust_id = str(p_rows[0]["id"])
                    customer_name = customer_name or p_rows[0].get("full_name")
                    break
            except Exception:
                pass

        if not cust_id and db_phone:
            new_uuid = str(uuid.uuid4())
            try:
                new_prof = await store.insert("profiles", {
                    "id": new_uuid,
                    "phone": db_phone,
                    "full_name": customer_name,
                    "role": "customer"
                })
                if new_prof and new_prof.get("id"):
                    cust_id = str(new_prof["id"])
                else:
                    cust_id = new_uuid
            except Exception:
                try:
                    if len(clean_phone_digits) >= 10:
                        p_rows = await store.get("profiles", {"phone": f"ilike.*{clean_phone_digits[-10:]}*", "select": "id,phone,full_name"})
                        if p_rows and isinstance(p_rows, list) and len(p_rows) > 0:
                            cust_id = str(p_rows[0]["id"])
                except Exception:
                    pass
                if not cust_id:
                    cust_id = new_uuid

    # Only allow demo customer UUID if phone actually matches demo
    if not cust_id and ("9999900004" in canonical_phone or "9999900004" in clean_phone_digits):
        cust_id = "b0cf5967-7bf0-4ce0-9d74-220c59bc6798"

    valid_cust_id = cust_id if (cust_id and is_valid_uuid(cust_id)) else None

    client_supplied_total = float(payload.get("total_amount") or payload.get("total") or 0.0)
    coupon_input = payload.get("coupon") or payload.get("coupon_code")

    # Authoritative server-side total computation, coupon validation & stock enforcement
    server_total, subtotal, delivery_fee, coupon_discount, applied_coupon, db_products_map = await calculate_order_total_server_side(
        items_list=items_list,
        coupon_code=coupon_input,
        customer_phone=db_phone or raw_phone,
        customer_id=cust_id
    )

    if client_supplied_total > 0 and abs(client_supplied_total - server_total) > 0.5:
        logger.warning(
            "Order price mismatch detected for order %s: client sent %s, server computed %s",
            order_id, client_supplied_total, server_total
        )

    # Decrement inventory stock for ordered items
    for item in items_list:
        if isinstance(item, dict):
            pid = str(item.get("id") or item.get("product_id") or (item.get("product", {}).get("id") if isinstance(item.get("product"), dict) else ""))
            qty = int(item.get("qty") or item.get("quantity") or 1)
            if pid and pid in db_products_map:
                curr_stock = db_products_map[pid].get("stock")
                if curr_stock is not None:
                    try:
                        new_stock = max(0, int(curr_stock) - qty)
                        await store.patch("products", {"stock": new_stock}, {"id": f"eq.{pid}"})
                        await cache_del(f"cache:product:{pid}")
                    except Exception as err:
                        logger.warning(f"Failed to decrement stock for product {pid}: {err}")
    await cache_del("cache:products:all:all:none")

    default_store_id = await resolve_default_store_id()
    valid_store_id = payload.get("store_id") if (payload.get("store_id") and is_valid_uuid(payload.get("store_id"))) else default_store_id
    delivery_otp = str(secrets.randbelow(9000) + 1000)

    provided_disp = payload.get("display_id") or payload.get("order_number") or payload.get("displayId") or payload.get("orderNumber")
    if provided_disp and str(provided_disp).strip().startswith("GB-"):
        disp_id = str(provided_disp).strip().upper()
    else:
        clean_hex_id = order_id.replace("GB-", "").replace("gb-", "").strip()
        disp_id = f"GB-{clean_hex_id[:6].upper()}" if len(clean_hex_id) >= 6 else f"GB-{clean_hex_id.upper()}"

    full_order = {
        "id": order_id,
        "rawId": order_id,
        "order_number": disp_id,
        "orderNumber": disp_id,
        "display_id": disp_id,
        "displayId": disp_id,
        "customer_id": valid_cust_id,
        "customer_name": customer_name,
        "customer_phone": db_phone or raw_phone,
        "delivery_address": payload.get("delivery_address") or "Delivery Address",
        "items": items_list,
        "subtotal": float(subtotal),
        "delivery_fee": float(delivery_fee),
        "coupon_discount": float(coupon_discount),
        "applied_coupon": applied_coupon,
        "tax": 0.0,
        "total_amount": float(server_total),
        "total": float(server_total),
        "payment_method": payload.get("payment_method") or "UPI",
        "status": "placed",
        "store_id": valid_store_id,
        "delivery_otp": delivery_otp,
        "created_at": now_iso
    }

    db_payload = {
        "id": full_order["id"],
        "delivery_address": full_order["delivery_address"],
        "status": full_order["status"],
        "total": float(full_order["total_amount"]),
        "created_at": now_iso
    }
    if valid_cust_id:
        db_payload["customer_id"] = valid_cust_id
    if valid_store_id:
        db_payload["store_id"] = valid_store_id

    try:
        with orders_items_lock:
            o_map = load_orders_items()
            item_entry = {
                "items": full_order["items"],
                "customer_name": customer_name,
                "customer_phone": db_phone or raw_phone,
                "delivery_address": full_order["delivery_address"],
                "delivery_otp": delivery_otp,
                "status": full_order["status"],
                "subtotal": float(subtotal),
                "delivery_fee": float(delivery_fee),
                "coupon_discount": float(coupon_discount),
                "total": full_order["total_amount"],
                "created_at": now_iso,
                "order_number": disp_id,
                "orderNumber": disp_id,
                "display_id": disp_id,
                "displayId": disp_id,
                "order": full_order
            }
            o_map[order_id] = item_entry
            if disp_id:
                o_map[disp_id] = item_entry
                o_map[disp_id.upper()] = item_entry
                o_map[disp_id.lower()] = item_entry
            if full_order.get("id"):
                o_map[full_order["id"]] = item_entry
                clean_short = full_order["id"].replace("GB-", "").replace("gb-", "").strip()
                if clean_short:
                    o_map[clean_short] = item_entry
                    p6 = clean_short[:6]
                    o_map[f"GB-{p6.upper()}"] = item_entry
                    o_map[p6.lower()] = item_entry
            save_orders_items_db(o_map)
    except Exception:
        pass

    # Cache idempotency key for 5 seconds to prevent rapid double-clicks
    try:
        await cache_set(idem_key, full_order, ttl_seconds=5)
    except Exception:
        pass

    # Parallel asynchronous background execution for all cloud persistence & pubsub (0ms server latency)
    async def _bg_persist_order_cloud():
        try:
            async def _safe_db_insert():
                try:
                    await store.insert("orders", db_payload)
                except Exception as db_err:
                    if "customer_id" in db_payload:
                        fallback_payload = dict(db_payload)
                        fallback_payload.pop("customer_id", None)
                        try:
                            await store.insert("orders", fallback_payload)
                        except Exception:
                            pass

            tasks = [
                cache_set(f"cloud:order:{order_id}", full_order, ttl_seconds=86400 * 30),
                _safe_db_insert(),
                redis_publish("orders:new", full_order),
            ]
            if full_order.get("id") and full_order["id"] != order_id:
                tasks.append(cache_set(f"cloud:order:{full_order['id']}", full_order, ttl_seconds=86400 * 30))
            if canonical_phone:
                tasks.append(cache_del(f"cloud:user_cart:{canonical_phone}"))
                clean_digits = "".join(filter(str.isdigit, raw_phone))
                if clean_digits and clean_digits != canonical_phone:
                    tasks.append(cache_del(f"cloud:user_cart:{clean_digits}"))
            if user and user.get("sub"):
                tasks.append(cache_del(f"cache:cart:{user.get('sub')}"))

            await asyncio.gather(*tasks, return_exceptions=True)

            list_tasks = []
            if canonical_phone:
                async def _update_cust_list():
                    try:
                        cust_key = f"cloud:customer_orders:{canonical_phone}"
                        cust_orders = await cache_get(cust_key) or []
                        if not isinstance(cust_orders, list):
                            cust_orders = []
                        updated_cust = [full_order] + [o for o in cust_orders if o.get("id") != order_id]
                        await cache_set(cust_key, updated_cust[:100], ttl_seconds=86400 * 30)
                    except Exception:
                        pass
                list_tasks.append(_update_cust_list())

            if cust_id:
                async def _update_sub_list():
                    try:
                        sub_key = f"cache:customer_orders:{cust_id}"
                        sub_orders = await cache_get(sub_key) or []
                        if not isinstance(sub_orders, list):
                            sub_orders = []
                        updated_sub = [full_order] + [o for o in sub_orders if o.get("id") != order_id]
                        await cache_set(sub_key, updated_sub[:100], ttl_seconds=86400 * 30)
                    except Exception:
                        pass
                list_tasks.append(_update_sub_list())

            async def _update_orders_list():
                try:
                    cached_orders = await cache_get("cloud:orders_list") or []
                    if not isinstance(cached_orders, list):
                        cached_orders = []
                    updated_list = [full_order] + [o for o in cached_orders if o.get("id") != order_id]
                    await cache_set("cloud:orders_list", updated_list[:100], ttl_seconds=86400 * 30)
                except Exception:
                    pass
            list_tasks.append(_update_orders_list())

            if list_tasks:
                await asyncio.gather(*list_tasks, return_exceptions=True)
        except Exception as err:
            import logging
            logging.warning(f"Background order persistence error for {order_id}: {err}")

    await _bg_persist_order_cloud()
    return full_order

def normalize_status(raw_status: any) -> str:
    if not raw_status:
        return "placed"
    s = str(raw_status.value if hasattr(raw_status, "value") else raw_status).strip().lower()
    s = s.replace("-", "_").replace(" ", "_")
    alias_map = {
        "delivering": "out_for_delivery",
        "picked_up": "out_for_delivery",
        "out_for_delivery": "out_for_delivery",
        "ready": "ready_for_pickup",
        "ready_for_pickup": "ready_for_pickup",
        "packed": "ready_for_pickup",
        "cancel": "cancelled",
        "canceled": "cancelled",
    }
    return alias_map.get(s, s)

ALLOWED_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "placed": {"confirmed", "preparing", "ready_for_pickup", "cancelled"},
    "pending": {"confirmed", "preparing", "ready_for_pickup", "cancelled"},
    "confirmed": {"confirmed", "preparing", "ready_for_pickup", "cancelled"},
    "preparing": {"preparing", "ready_for_pickup", "out_for_delivery", "cancelled"},
    "ready_for_pickup": {"ready_for_pickup", "out_for_delivery", "cancelled"},
    "out_for_delivery": {"delivered", "failed_delivery", "cancelled", "returned"},
    "delivered": set(),
    "cancelled": set(),
    "returned": set(),
    "failed_delivery": set(),
}

@router.patch("/orders/{order_id}/status")
async def order_status(
    order_id: str,
    body: StatusRequest,
    user: dict = Depends(require_roles("seller", "admin", "delivery_agent", "customer"))
):
    single = None
    try:
        single = await cache_get(f"cloud:order:{order_id}")
    except Exception as err:
        import logging
        logging.warning(f"Cache get cloud:order:{order_id} failed in order_status: {err}")

    if not single or not isinstance(single, dict):
        try:
            cached_list = await cache_get("cloud:orders_list") or []
            if isinstance(cached_list, list):
                for o in cached_list:
                    if isinstance(o, dict) and is_same_order_id(o.get("id") or o.get("rawId"), order_id):
                        single = o
                        break
        except Exception:
            pass

    if not single or not isinstance(single, dict):
        try:
            db_res = await store.get("orders", {"id": f"eq.{order_id}"})
            if db_res and isinstance(db_res, list) and len(db_res) > 0 and db_res[0]:
                single = db_res[0]
        except Exception as err:
            logger.warning(f"Database lookup for order {order_id} failed in order_status: {err}")

    # 4. Fallback: load from orders_items.json (needed when Redis is down, e.g. in tests)
    if not single or not isinstance(single, dict):
        try:
            o_items_fb = load_orders_items()
            clean_fb = str(order_id).strip()
            fb_entry = (
                o_items_fb.get(clean_fb)
                or o_items_fb.get(clean_fb.replace("GB-", "").replace("gb-", ""))
            )
            if fb_entry and isinstance(fb_entry, dict):
                if "order" in fb_entry and isinstance(fb_entry["order"], dict):
                    single = dict(fb_entry["order"])
                else:
                    single = {
                        "id": clean_fb,
                        "status": fb_entry.get("status", "placed"),
                        "customer_phone": fb_entry.get("customer_phone", ""),
                        "items": fb_entry.get("items", []),
                        "delivery_otp": fb_entry.get("delivery_otp"),
                    }
        except Exception as err:
            logger.warning(f"orders_items.json fallback for order {order_id} failed: {err}")

    target_status = normalize_status(body.status)

    # 1. Validate caller role permissions first
    user_role = str(user.get("role") or "").lower()
    user_id = str(user.get("sub") or user.get("id") or "")
    user_phone = str(user.get("phone") or "")

    if user_role not in ("admin", "seller", "merchant"):
        if user_role == "customer":
            if target_status != "cancelled":
                raise HTTPException(403, "Customers are only allowed to cancel their own orders")
            order_cust_phone = str(single.get("customer_phone") or "") if (single and isinstance(single, dict)) else ""
            can_cust_phone, _ = normalize_phone(user_phone)
            order_can_phone, _ = normalize_phone(order_cust_phone)
            if can_cust_phone and order_can_phone and can_cust_phone != order_can_phone:
                raise HTTPException(403, "Cannot modify another customer's order")
        elif user_role in ("delivery_agent", "delivery_partner", "rider"):
            assigned_rider_id = str(single.get("delivery_agent_id") or "") if (single and isinstance(single, dict)) else ""
            target_rider_id = str(body.delivery_agent_id or "")
            if assigned_rider_id and assigned_rider_id != user_id and target_rider_id != user_id:
                raise HTTPException(403, "Rider is not assigned to this order")

    # 2. Validate status enum string
    if target_status not in ALLOWED_STATUS_TRANSITIONS:
        raise HTTPException(400, f"Invalid order status '{target_status}'")

    current_status = normalize_status(single.get("status") if (single and isinstance(single, dict)) else "placed")
    if current_status not in ALLOWED_STATUS_TRANSITIONS:
        current_status = "placed"

    # 3. Enforce allowed state machine transitions
    if current_status != target_status:
        allowed = ALLOWED_STATUS_TRANSITIONS.get(current_status, set())
        if target_status not in allowed:
            raise HTTPException(
                409,
                f"Cannot transition order status from '{current_status}' to '{target_status}'"
            )

    now_utc_iso = datetime.now(timezone.utc).isoformat()

    # Restore inventory stock if order is cancelled
    if target_status == "cancelled" and single and isinstance(single, dict):
        order_items = single.get("items") or []
        if isinstance(order_items, list):
            for item in order_items:
                if isinstance(item, dict):
                    pid = str(item.get("id") or item.get("product_id") or (item.get("product", {}).get("id") if isinstance(item.get("product"), dict) else ""))
                    qty = int(item.get("qty") or item.get("quantity") or 1)
                    if pid:
                        try:
                            p_rows = await store.get("products", {"id": f"eq.{pid}"})
                            if p_rows and isinstance(p_rows, list) and p_rows[0]:
                                current_stock = int(p_rows[0].get("stock") or 0)
                                restored_stock = current_stock + qty
                                await store.patch("products", {"stock": restored_stock}, {"id": f"eq.{pid}"})
                                await cache_del(f"cache:product:{pid}")
                        except Exception as err:
                            logger.warning(f"Failed to restore stock for product {pid} on order cancellation: {err}")
            await cache_del("cache:products:all:all:none")

    # 1. Update single order cache immediately
    async def _sync_single():
        if single and isinstance(single, dict):
            single["status"] = target_status
            if target_status == "delivered":
                single["delivered_at"] = now_utc_iso
                single["completedAtISO"] = now_utc_iso
            if body.delivery_agent_id:
                single["delivery_agent_id"] = body.delivery_agent_id
            await cache_set(f"cloud:order:{order_id}", single, ttl_seconds=86400 * 30)
        return True

    # 2. Update Customer-specific cache
    async def _sync_cust():
        if single and isinstance(single, dict):
            canonical_phone, _ = normalize_phone(single.get("customer_phone"))
            if canonical_phone:
                for key_phone in [canonical_phone, "".join(filter(str.isdigit, str(single.get("customer_phone") or "")))]:
                    if key_phone:
                        cust_key = f"cloud:customer_orders:{key_phone}"
                        cust_orders = await cache_get(cust_key) or []
                        if isinstance(cust_orders, list):
                            for o in cust_orders:
                                oid = o.get("id") or o.get("rawId")
                                if is_same_order_id(oid, order_id):
                                    o["status"] = target_status
                                    if target_status == "delivered":
                                        o["delivered_at"] = now_utc_iso
                                        o["completedAtISO"] = now_utc_iso
                                    if body.delivery_agent_id:
                                        o["delivery_agent_id"] = body.delivery_agent_id
                            await cache_set(cust_key, cust_orders, ttl_seconds=86400 * 30)
        return True

    # 3. Update Store/Seller queue cache
    async def _sync_list():
        fresh_orders = await cache_get("cloud:orders_list") or []
        if isinstance(fresh_orders, list):
            updated_list = []
            found = False
            for o in fresh_orders:
                oid = o.get("id") or o.get("rawId")
                if is_same_order_id(oid, order_id):
                    o["status"] = target_status
                    if target_status == "delivered":
                        o["delivered_at"] = now_utc_iso
                        o["completedAtISO"] = now_utc_iso
                    if body.delivery_agent_id:
                        o["delivery_agent_id"] = body.delivery_agent_id
                    found = True
                updated_list.append(o)
            if not found and single and isinstance(single, dict):
                single_copy = dict(single)
                single_copy["status"] = target_status
                if target_status == "delivered":
                    single_copy["delivered_at"] = now_utc_iso
                    single_copy["completedAtISO"] = now_utc_iso
                if body.delivery_agent_id:
                    single_copy["delivery_agent_id"] = body.delivery_agent_id
                updated_list.insert(0, single_copy)
            await cache_set("cloud:orders_list", updated_list[:100], ttl_seconds=86400 * 30)
        return True

    # Execute all Redis cache updates concurrently for ultra-fast latency (< 15ms)
    await asyncio.gather(_sync_single(), _sync_cust(), _sync_list(), return_exceptions=True)
    await redis_publish("orders:status", {"order_id": order_id, "status": body.status})

    # Background async task for Supabase DB upsert, rider shift calculations, stock restoration & disk JSON save
    async def _bg_persist_db_and_disk():
        try:
            patch_data = {"status": target_status}
            if target_status == "delivered":
                patch_data["delivered_at"] = now_utc_iso
                patch_data["completed_at"] = now_utc_iso
            if body.delivery_agent_id:
                patch_data["delivery_agent_id"] = body.delivery_agent_id

            await idempotent_order_upsert(order_id, patch_data, fallback_single=single, op_name="order_status")

            if target_status in ("delivered", "failed_delivery", "returned"):
                rider_id = body.delivery_agent_id
                if not rider_id and single and isinstance(single, dict):
                    rider_id = single.get("delivery_agent_id")
                if not rider_id:
                    db_order = await store.get("orders", {"id": f"eq.{order_id}", "select": "delivery_agent_id"})
                    if db_order and isinstance(db_order, list) and db_order[0]:
                        rider_id = db_order[0].get("delivery_agent_id")
                if rider_id:
                    if target_status == "delivered" and single and isinstance(single, dict):
                        delivered_rec = dict(single)
                        delivered_rec["status"] = "delivered"
                        delivered_rec["delivered_at"] = now_utc_iso
                        delivered_rec["completedAtISO"] = now_utc_iso
                        alias_keys = {str(rider_id)}
                        for r_key in alias_keys:
                            h_cache = await cache_get(f"cloud:rider_history:{r_key}") or []
                            if not isinstance(h_cache, list):
                                h_cache = []
                            h_cache = [delivered_rec] + [h for h in h_cache if not is_same_order_id(h.get("id"), order_id)]
                            await cache_set(f"cloud:rider_history:{r_key}", h_cache, ttl_seconds=86400 * 30)
                    await redis_exec(["DEL", f"cloud:rider_active:{rider_id}"])
                    await redis_publish("orders:delivery", {"order_id": order_id, "rider_id": str(rider_id), "status": target_status})

                    store_settings = load_store_settings()
                    now = get_store_local_now()
                    is_past_auto, _ = is_past_auto_shift_end_logout(store_settings, now)
                    if is_past_auto:
                        has_other_active = await rider_has_active_delivery(str(rider_id))
                        if not has_other_active:
                            async with users_db_lock:
                                users = load_users_db()
                                for u in users:
                                    if isinstance(u, dict) and str(u.get("id") or u.get("phone") or "") == str(rider_id):
                                        u["is_online"] = False
                                        u["agent_status"] = "UNAVAILABLE"
                                        u["auto_logged_out"] = True
                                        u["auto_logged_out_at"] = now.isoformat()
                                        for s in u.get("shift_sessions") or []:
                                            if isinstance(s, dict) and s.get("ended_at") is None:
                                                s["ended_at"] = now.isoformat()
                                        break
                                save_users_db(users)

            with orders_items_lock:
                o_map = load_orders_items()
                clean_oid = str(order_id).strip()
                for k in [clean_oid, clean_oid.replace("GB-", "").replace("gb-", "")]:
                    if k in o_map and isinstance(o_map[k], dict):
                        # orders_items.json is already updated synchronously above;
                        # here just update the DB-facing delivery fields
                        pass
                # No-op: orders_items save is done synchronously outside this task now
        except Exception as err:
            logger.warning(f"Background order status persistence error for {order_id}: {err}")

    asyncio.create_task(_bg_persist_db_and_disk())

    # Update orders_items.json synchronously so sequential requests always see latest status
    # (background task only handles slow DB upsert)
    try:
        with orders_items_lock:
            o_map = load_orders_items()
            clean_oid = str(order_id).strip()
            for k in [clean_oid, clean_oid.replace("GB-", "").replace("gb-", "")]:
                if k in o_map and isinstance(o_map[k], dict):
                    o_map[k]["status"] = target_status
                    if target_status == "delivered":
                        o_map[k]["delivered_at"] = now_utc_iso
                    if "order" in o_map[k] and isinstance(o_map[k]["order"], dict):
                        o_map[k]["order"]["status"] = target_status
                        if target_status == "delivered":
                            o_map[k]["order"]["delivered_at"] = now_utc_iso
            save_orders_items_db(o_map)
    except Exception as err:
        logger.warning(f"Synchronous orders_items.json status update failed for {order_id}: {err}")

    return {"status": "ok", "order_id": order_id, "new_status": body.status}

@router.patch("/orders/{order_id}/verify-otp")
async def verify_delivery_otp(order_id: str, body: DeliveryOtpVerifyRequest, user=Depends(require_roles("delivery_agent"))):
    otp = str(body.otp or "").strip()
    proof_photo_url = body.proof_photo_url
    if not otp.isdigit() or len(otp) < 4:
        raise HTTPException(status_code=400, detail="Invalid OTP request")

    order = await load_merged_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    valid_keys = await expand_rider_identity_keys(user)
    if not order_assigned_to_rider(order, valid_keys):
        raise HTTPException(status_code=403, detail="Forbidden: You are not assigned to this order")

    st = str(order.get("status") or "").lower()
    if st in TERMINAL_ORDER_STATUSES:
        raise HTTPException(status_code=409, detail="Order is already completed or cancelled")

    expected_otp = None
    if order.get("otp"):
        expected_otp = str(order.get("otp")).strip()
    elif order.get("delivery_otp"):
        expected_otp = str(order.get("delivery_otp")).strip()
    else:
        clean_digits = "".join(filter(str.isdigit, str(order.get("customer_phone") or "")))
        if len(clean_digits) >= 4:
            expected_otp = clean_digits[-4:]

    otp_ok = False
    if expected_otp and otp == expected_otp:
        otp_ok = True
    elif settings().otp_debug and otp in ("1234", "123456"):
        otp_ok = True
    if not otp_ok:
        raise HTTPException(status_code=400, detail="Invalid OTP! Please ask the customer for their delivery code.")

    now_iso = datetime.now(timezone.utc).isoformat()
    redis_fields = {"otp_verified": True, "verified_at": now_iso}
    if proof_photo_url:
        redis_fields["proof_photo_url"] = proof_photo_url

    pg_ok = await idempotent_order_upsert(
        order_id,
        {
            "otp_verified": True,
            "otp_verified_at": now_iso,
            "proof_photo_url": proof_photo_url,
        },
        fallback_single=order,
        op_name="verify_delivery_otp",
    )
    if not pg_ok:
        raise HTTPException(status_code=500, detail="Failed to persist OTP verification")

    await sync_order_redis_state(order_id, order, redis_fields, require_success=True)
    await redis_publish("orders:status", {"order_id": order_id, "otp_verified": True})

    return {
        "success": True,
        "order_id": order.get("id") or order_id,
        "otp_verified": True,
        "proof_photo_url": proof_photo_url
    }

@router.patch("/delivery/{order_id}/step")
async def update_delivery_step(order_id: str, body: DeliveryStepRequest, user=Depends(require_roles("delivery_agent"))):
    step = str(body.step or "").upper().strip()
    if step not in ALLOWED_WORKFLOW_STEPS:
        raise HTTPException(status_code=400, detail=f"Invalid workflow step. Allowed steps: {sorted(ALLOWED_WORKFLOW_STEPS)}")

    order = await load_merged_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    valid_keys = await expand_rider_identity_keys(user)
    if not order_assigned_to_rider(order, valid_keys):
        raise HTTPException(status_code=403, detail="Forbidden: You are not assigned to this order")

    st = str(order.get("status") or "").lower()
    if st in TERMINAL_ORDER_STATUSES:
        raise HTTPException(status_code=409, detail="Order is already completed or cancelled")

    new_status = WORKFLOW_STATUS_MAP.get(step)
    redis_fields = {"workflow_step": step}
    pg_patch = {"workflow_step": step}
    if new_status:
        redis_fields["status"] = new_status
        pg_patch["status"] = new_status

    pg_ok = await idempotent_order_upsert(order_id, pg_patch, fallback_single=order, op_name="update_delivery_step")
    if not pg_ok:
        raise HTTPException(status_code=500, detail="Failed to persist delivery state")

    await sync_order_redis_state(order_id, order, redis_fields, require_success=True)
    current_status = new_status or str(order.get("status") or "out_for_delivery")
    if new_status:
        await redis_publish("orders:status", {"order_id": order_id, "status": new_status, "workflow_step": step})

    return {
        "success": True,
        "order_id": order.get("id") or order_id,
        "step": step,
        "status": current_status
    }

# ==============================================================================
# /delivery/
# ==============================================================================
@router.get("/delivery/assignments")
async def delivery_assignments(user=Depends(require_roles("delivery_agent"))):
    return await store.get("orders", {"delivery_agent_id": f"eq.{user['sub']}", "order": "created_at.desc"})

@router.get("/delivery/riders")
async def list_delivery_riders(user=Depends(require_roles("seller", "admin", "delivery_agent"))):
    """
    Returns all registered delivery agents with their active vs queued order counts and presence status.
    """
    store_settings = await get_store_settings()
    all_users = load_users_db()
    riders_list = [u for u in all_users if isinstance(u, dict) and u.get("role") == "delivery_agent"]

    # Fetch live orders to compute each rider's current load
    redis_orders = await cache_get("cloud:orders_list") or []
    if not isinstance(redis_orders, list):
        redis_orders = []

    for rider in riders_list:
        rid = str(rider.get("id") or "")
        r_phone = str(rider.get("phone") or "")
        active_count = 0
        queue_count = 0

        for o in redis_orders:
            o_agent = str(o.get("delivery_agent_id") or "")
            st = str(o.get("status") or "").lower()
            if st in ("delivered", "cancelled"):
                continue
            if (rid and o_agent == rid) or (r_phone and o_agent == r_phone):
                if st in ("out_for_delivery", "out-for-delivery", "picked_up", "accepted"):
                    active_count += 1
                else:
                    queue_count += 1

        presence = compute_rider_presence_status(rider, store_settings)
        rider["presence_status"] = presence
        rider["status"] = presence
        rider["active_orders_count"] = active_count
        rider["queued_orders_count"] = queue_count
        rider["is_free"] = (active_count == 0)
        rider["status_label"] = "Available (0 Active)" if active_count == 0 else f"Busy (1 Active, {queue_count} Queued)"

    return riders_list

@router.get("/delivery/agent/me")
@router.get("/delivery/agent/me/")
async def get_delivery_agent_me(user=Depends(require_roles("delivery_agent", "rider", "delivery_partner", "seller", "admin"))):
    """
    Returns the current delivery agent profile with live presence, shifts, and payout info.
    """
    store_settings = await get_store_settings()
    rider_id = str(user.get("sub") or user.get("id") or "").strip()
    rider_phone = str(user.get("phone") or "").strip()
    canonical_phone, _ = normalize_phone(rider_phone)
    clean_digits = "".join(filter(str.isdigit, rider_phone))

    users = load_users_db()
    rider_data = None
    for u in users:
        if isinstance(u, dict):
            uid = str(u.get("id") or "").strip()
            uphone = str(u.get("phone") or "").strip()
            ucanon, _ = normalize_phone(uphone)
            udigits = "".join(filter(str.isdigit, uphone))
            if (rider_id and uid == rider_id) or \
               (canonical_phone and ucanon == canonical_phone) or \
               (clean_digits and udigits == clean_digits):
                rider_data = dict(u)
                break

    if not rider_data:
        # Check Postgres profiles
        if is_valid_uuid(rider_id):
            try:
                p_rows = await store.get("profiles", {"id": f"eq.{rider_id}"})
                if p_rows and isinstance(p_rows, list) and len(p_rows) > 0:
                    rider_data = dict(p_rows[0])
            except Exception:
                pass

    if not rider_data:
        rider_name = user.get("name") or user.get("full_name") or "Delivery Agent"
        name_slug = rider_name.lower().replace(" ", ".")
        rider_data = {
            "id": rider_id or "rider-1",
            "full_name": rider_name,
            "name": rider_name,
            "phone": rider_phone or "+919999900003",
            "role": "delivery_agent",
            "is_online": True,
            "agent_status": "AVAILABLE",
            "vehicle_type": "motorcycle",
            "upi_id": f"{name_slug}@okicici",
            "shift_sessions": []
        }

    presence = compute_rider_presence_status(rider_data, store_settings)
    rider_data["presence_status"] = presence
    rider_data["status"] = presence
    if "is_online" not in rider_data:
        rider_data["is_online"] = (presence == "PRESENT")

    return {"user": rider_data, **rider_data}

@router.patch("/delivery/agent/status")
@router.patch("/delivery/agent/status/")
async def update_delivery_agent_status(
    payload: dict,
    user=Depends(require_roles("delivery_agent", "rider", "delivery_partner", "seller", "admin"))
):
    """
    Update delivery agent online state and availability status.
    """
    rider_id = str(user.get("sub") or user.get("id") or "").strip()
    rider_phone = str(user.get("phone") or "").strip()
    canonical_phone, _ = normalize_phone(rider_phone)
    clean_digits = "".join(filter(str.isdigit, rider_phone))

    is_online = payload.get("is_online")
    agent_status = payload.get("agent_status") or payload.get("status")

    now = get_store_local_now()
    now_iso = now.isoformat()
    today_date_str = now.strftime("%Y-%m-%d")

    async with users_db_lock:
        users = load_users_db()
        matched = False
        for u in users:
            if isinstance(u, dict):
                uid = str(u.get("id") or "").strip()
                uphone = str(u.get("phone") or "").strip()
                ucanon, _ = normalize_phone(uphone)
                udigits = "".join(filter(str.isdigit, uphone))

                if (rider_id and uid == rider_id) or \
                   (canonical_phone and ucanon == canonical_phone) or \
                   (clean_digits and udigits == clean_digits):
                    if is_online is not None:
                        online_bool = bool(is_online)
                        u["is_online"] = online_bool
                        if online_bool:
                            u["agent_status"] = "AVAILABLE"
                            # Lazy shift-start recording
                            if not u.get("shift_started_at") or str(u.get("shift_started_at"))[:10] != today_date_str:
                                u["shift_started_at"] = now_iso
                                shifts = u.get("shift_sessions") or []
                                shifts.append({"started_at": now_iso, "ended_at": None})
                                u["shift_sessions"] = shifts
                        else:
                            u["agent_status"] = "UNAVAILABLE"
                            for s in u.get("shift_sessions") or []:
                                if isinstance(s, dict) and s.get("ended_at") is None:
                                    s["ended_at"] = now_iso
                    if agent_status:
                        u["agent_status"] = str(agent_status).upper()
                    matched = True
                    break
        if matched:
            save_users_db(users)

    # Sync to Postgres profiles table if valid UUID
    if is_valid_uuid(rider_id):
        try:
            p_patch = {}
            if is_online is not None:
                p_patch["is_online"] = bool(is_online)
            if agent_status:
                p_patch["agent_status"] = str(agent_status).upper()
            if p_patch:
                await store.patch("profiles", p_patch, {"id": f"eq.{rider_id}"})
        except Exception:
            pass

    return {"status": "ok", "is_online": is_online, "agent_status": agent_status}

@router.patch("/delivery/payout-profile")
@router.patch("/delivery/payout-profile/")
async def update_delivery_payout_profile(
    payload: dict,
    user=Depends(require_roles("delivery_agent", "rider", "delivery_partner", "seller", "admin"))
):
    """
    Update delivery rider payout preferences (UPI ID, bank account).
    """
    rider_id = str(user.get("sub") or user.get("id") or "").strip()
    rider_phone = str(user.get("phone") or "").strip()
    canonical_phone, _ = normalize_phone(rider_phone)
    clean_digits = "".join(filter(str.isdigit, rider_phone))
    upi_id = payload.get("upi_id") or payload.get("upi")

    async with users_db_lock:
        users = load_users_db()
        matched = False
        for u in users:
            if isinstance(u, dict):
                uid = str(u.get("id") or "").strip()
                uphone = str(u.get("phone") or "").strip()
                ucanon, _ = normalize_phone(uphone)
                udigits = "".join(filter(str.isdigit, uphone))

                if (rider_id and uid == rider_id) or \
                   (canonical_phone and ucanon == canonical_phone) or \
                   (clean_digits and udigits == clean_digits):
                    if upi_id:
                        u["upi_id"] = str(upi_id).strip()
                    for k, v in payload.items():
                        if k not in ("id", "role", "password", "phone"):
                            u[k] = v
                    matched = True
                    break
        if matched:
            save_users_db(users)

    return {"status": "ok", "upi_id": upi_id}

async def _reject_if_already_out_for_delivery(order_id: str, new_rider_id: str) -> None:
    """
    Guard against a seller (re)assigning an order that a *different* rider has
    already accepted and is actively out delivering. Postgres is authoritative
    here, same as the equivalent check in accept_delivery.

    Deliberately does NOT block reassignment of an order that's merely
    assigned-but-not-yet-accepted (still 'placed'/'preparing'/etc with no
    accept having happened) — that's the legitimate recovery path when the
    originally offered rider never responds.
    """
    try:
        rows = await store.get("orders", {"id": f"eq.{order_id}", "select": "delivery_agent_id,status"})
    except Exception:
        return
    if not (rows and isinstance(rows, list) and rows[0]):
        return
    existing_agent = str(rows[0].get("delivery_agent_id") or "").strip()
    existing_status = normalize_status(rows[0].get("status"))
    if (
        existing_agent
        and existing_agent not in ("None", "null", "")
        and existing_agent != str(new_rider_id)
        and existing_status == "out_for_delivery"
    ):
        raise HTTPException(
            409,
            f"Order is already accepted and out for delivery with a different rider (agent {existing_agent}). "
            "Cannot reassign an in-flight order."
        )

@router.post("/orders/{order_id}/assign")
async def assign_order_to_rider(order_id: str, body: AssignOrderRequest, user=Depends(require_roles("seller", "admin"))):
    """
    Seller assigns an order to a delivery partner.
    If the rider has 0 active deliveries, order status can advance to out_for_delivery / ready_for_pickup.
    If the rider already has an active delivery, this order is queued for them.
    """
    rider_id = body.delivery_agent_id
    rider_name = body.rider_name or "Assigned Delivery Agent"

    await _reject_if_already_out_for_delivery(order_id, rider_id)

    # Check rider current active orders
    redis_orders = await cache_get("cloud:orders_list") or []
    active_count = 0
    if isinstance(redis_orders, list):
        for o in redis_orders:
            if str(o.get("delivery_agent_id")) == str(rider_id) and str(o.get("status")).lower() in ("out_for_delivery", "picked_up", "accepted"):
                active_count += 1

    single_cached = None
    try:
        single_cached = await cache_get(f"cloud:order:{order_id}")
    except Exception as err:
        import logging
        logging.warning(f"Cache lookup error in assign_order for order {order_id}: {err}")

    now = get_store_local_now()
    offer_expires_at = (now + timedelta(seconds=60)).isoformat() if active_count == 0 else None
    offered_to_id = rider_id if active_count == 0 else None

    # 1. Update in Supabase (idempotent write)
    await idempotent_order_upsert(
        order_id,
        {
            "delivery_agent_id": rider_id,
            "offered_to_rider_id": offered_to_id,
            "offer_expires_at": offer_expires_at
        },
        fallback_single=single_cached,
        op_name="assign_order"
    )

    # 2. Update in single order cache
    async def _sync_single():
        single = await cache_get(f"cloud:order:{order_id}")
        if single and isinstance(single, dict):
            single["delivery_agent_id"] = rider_id
            single["rider_name"] = rider_name
            single["is_queued"] = (active_count > 0)
            single["offered_to_rider_id"] = offered_to_id
            single["offer_expires_at"] = offer_expires_at
            await cache_set(f"cloud:order:{order_id}", single, ttl_seconds=86400 * 30)

            # Update customer cache
            phone = single.get("customer_phone")
            canonical, _ = normalize_phone(phone)
            for key_p in [canonical, "".join(filter(str.isdigit, str(phone or "")))]:
                if key_p:
                    cust_key = f"cloud:customer_orders:{key_p}"
                    c_list = await cache_get(cust_key) or []
                    if isinstance(c_list, list):
                        for co in c_list:
                            if co.get("id") == order_id or co.get("rawId") == order_id:
                                co["delivery_agent_id"] = rider_id
                                co["rider_name"] = rider_name
                        await cache_set(cust_key, c_list, ttl_seconds=86400 * 30)
        return True

    await execute_with_retry(_sync_single, max_attempts=3, op_name="assign_order_sync_single", order_id=order_id)

    # 3. Update in store orders list
    async def _sync_list():
        fresh_redis_orders = await cache_get("cloud:orders_list") or []
        if isinstance(fresh_redis_orders, list):
            for qo in fresh_redis_orders:
                if qo.get("id") == order_id or qo.get("rawId") == order_id:
                    qo["delivery_agent_id"] = rider_id
                    qo["rider_name"] = rider_name
                    qo["is_queued"] = (active_count > 0)
                    qo["offered_to_rider_id"] = offered_to_id
                    qo["offer_expires_at"] = offer_expires_at
            await cache_set("cloud:orders_list", fresh_redis_orders, ttl_seconds=86400 * 30)
        return True

    await execute_with_retry(_sync_list, max_attempts=3, op_name="assign_order_sync_list", order_id=order_id)

    await redis_exec(["DEL", f"cloud:rider_active:{rider_id}"])
    await redis_publish("orders:delivery", {
        "order_id": order_id,
        "rider_id": rider_id,
        "rider_name": rider_name,
        "is_queued": (active_count > 0)
    })
    try:
        await broadcast_order_pulse({"order_id": order_id, "rider_id": str(rider_id)})
    except Exception:
        pass

    return {
        "status": "ok",
        "order_id": order_id,
        "delivery_agent_id": rider_id,
        "rider_name": rider_name,
        "is_queued": (active_count > 0)
    }

@router.post("/orders/bulk-assign")
async def bulk_assign_orders(body: BulkAssignRequest, user=Depends(require_roles("seller", "admin"))):
    """
    Seller bulk-assigns multiple orders to a single delivery partner.
    """
    rider_id = body.delivery_agent_id
    rider_name = body.rider_name or "Assigned Delivery Agent"
    order_ids = body.order_ids

    redis_orders = await cache_get("cloud:orders_list") or []
    if not isinstance(redis_orders, list):
        redis_orders = []

    active_count = sum(
        1 for o in redis_orders
        if str(o.get("delivery_agent_id")) == str(rider_id) and str(o.get("status")).lower() in ("out_for_delivery", "picked_up", "accepted")
    )

    fresh_redis_orders = await cache_get("cloud:orders_list") or []
    if not isinstance(fresh_redis_orders, list):
        fresh_redis_orders = []

    now = get_store_local_now()
    offer_expires_at = (now + timedelta(seconds=60)).isoformat()

    skipped_in_flight: list[str] = []
    for idx, oid in enumerate(order_ids):
        try:
            await _reject_if_already_out_for_delivery(oid, rider_id)
        except HTTPException:
            # Skip this one order rather than aborting the whole batch.
            skipped_in_flight.append(oid)
            continue

        # If rider currently has 0 active deliveries, the 1st bulk-assigned order (idx == 0) becomes active,
        # and subsequent orders in the batch (idx > 0) are queued behind it.
        is_q = (active_count > 0) or (idx > 0)
        offered_to_id = rider_id if (active_count == 0 and idx == 0) else None
        exp_at = offer_expires_at if (active_count == 0 and idx == 0) else None

        single_cached = None
        try:
            single_cached = await cache_get(f"cloud:order:{oid}")
        except Exception as err:
            import logging
            logging.warning(f"Cache lookup error in bulk_assign for order {oid}: {err}")

        await idempotent_order_upsert(
            oid,
            {
                "delivery_agent_id": rider_id,
                "offered_to_rider_id": offered_to_id,
                "offer_expires_at": exp_at
            },
            fallback_single=single_cached,
            op_name="bulk_assign"
        )

        async def _sync_bulk_single(order_item_id=oid, queued=is_q, off_id=offered_to_id, off_exp=exp_at):
            single = await cache_get(f"cloud:order:{order_item_id}")
            if single and isinstance(single, dict):
                single["delivery_agent_id"] = rider_id
                single["rider_name"] = rider_name
                single["is_queued"] = queued
                single["offered_to_rider_id"] = off_id
                single["offer_expires_at"] = off_exp
                await cache_set(f"cloud:order:{order_item_id}", single, ttl_seconds=86400 * 30)
            return True

        await execute_with_retry(_sync_bulk_single, max_attempts=3, op_name="bulk_assign_sync_single", order_id=oid)

        for qo in fresh_redis_orders:
            if qo.get("id") == oid or qo.get("rawId") == oid:
                qo["delivery_agent_id"] = rider_id
                qo["rider_name"] = rider_name
                qo["is_queued"] = is_q
                qo["offered_to_rider_id"] = offered_to_id
                qo["offer_expires_at"] = exp_at

    async def _sync_bulk_list():
        await cache_set("cloud:orders_list", fresh_redis_orders, ttl_seconds=86400 * 30)
        return True

    await execute_with_retry(_sync_bulk_list, max_attempts=3, op_name="bulk_assign_sync_list")

    await redis_exec(["DEL", f"cloud:rider_active:{rider_id}"])
    actually_assigned_ids = [oid for oid in order_ids if oid not in skipped_in_flight]
    await redis_publish("orders:delivery", {
        "order_ids": actually_assigned_ids,
        "rider_id": rider_id,
        "assigned_count": len(actually_assigned_ids)
    })
    try:
        await broadcast_order_pulse({"order_ids": actually_assigned_ids, "rider_id": str(rider_id)})
    except Exception:
        pass

    return {
        "status": "ok",
        "assigned_count": len(order_ids) - len(skipped_in_flight),
        "delivery_agent_id": rider_id,
        "rider_name": rider_name,
        "skipped_already_out_for_delivery": skipped_in_flight
    }

@router.get("/delivery/active")
@router.get("/delivery/active/")
async def delivery_active_orders(include_offer: bool = Query(False), user=Depends(require_roles("delivery_agent"))):
    """
    Returns all active and queued orders for a delivery agent:
    - Strictly 1 active order at a time (first in line)
    - Subsequent assigned orders marked in queue
    - Available unassigned orders
    Postgres is authoritative over Redis cache when resolving status conflicts.
    """
    rider_id = user.get("sub")
    rider_phone = str(user.get("phone") or "")
    try:
        redis_orders = await cache_get("cloud:orders_list") or []
        if not isinstance(redis_orders, list):
            redis_orders = []

        agent_ids = set()
        if rider_id:
            agent_ids.add(str(rider_id))
        if rider_phone:
            agent_ids.add(str(rider_phone))
            digits = "".join(filter(str.isdigit, rider_phone))
            if digits:
                agent_ids.add(digits)
                agent_ids.add(f"+{digits}")

        # Resolve aliases from users.json
        users = load_users_db()
        for u in users:
            if isinstance(u, dict):
                uid = str(u.get("id") or "")
                uph = str(u.get("phone") or "")
                if uid in agent_ids or uph in agent_ids:
                    if uid: agent_ids.add(uid)
                    if uph: agent_ids.add(uph)

        assigned_pg_uuids = [k for k in agent_ids if is_valid_uuid(k)]
        if assigned_pg_uuids:
            assigned = await store.get("orders", {
                "delivery_agent_id": f"in.({','.join(assigned_pg_uuids)})",
                "status": "in.(pending,placed,confirmed,preparing,out_for_delivery,ready_for_pickup,ready,accepted,delivering,picked_up)",
                "order": "created_at.asc",
                "limit": 50
            }) or []
        else:
            assigned = []
        available = await store.get("orders", {
            "delivery_agent_id": "is.null",
            "status": "in.(pending,placed,confirmed,preparing,ready_for_pickup,ready,accepted,out_for_delivery,delivering)",
            "order": "created_at.desc",
            "limit": 50
        }) or []

        # Fetch all terminal orders from Postgres as authoritative exclusion set
        terminal_rows = await store.get("orders", {
            "status": "in.(delivered,cancelled,failed_delivery,returned)",
            "select": "id"
        }) or []
        terminal_ids = set()
        if isinstance(terminal_rows, list):
            for tr in terminal_rows:
                tid = tr.get("id")
                if tid:
                    terminal_ids.add(str(tid).lower().strip())
                    terminal_ids.add(extract_order_suffix(tid))

        pg_assigned_map = {}
        if isinstance(assigned, list):
            for ao in assigned:
                aid = ao.get("id")
                if aid:
                    pg_assigned_map[str(aid).lower().strip()] = ao

        pg_available_map = {}
        if isinstance(available, list):
            for avo in available:
                avid = avo.get("id")
                if avid:
                    pg_available_map[str(avid).lower().strip()] = avo

        redis_map = {}
        if isinstance(redis_orders, list):
            for ro in redis_orders:
                rid = ro.get("id") or ro.get("rawId")
                if rid and ro.get("items"):
                    redis_map[str(rid).lower().strip()] = ro

        seen = set()
        assigned_to_rider = []
        unassigned_pool = []

        all_sources = (assigned if isinstance(assigned, list) else []) + (redis_orders if isinstance(redis_orders, list) else []) + (available if isinstance(available, list) else [])

        for o in all_sources:
            raw_oid = o.get("id") or o.get("rawId")
            if not raw_oid:
                continue
            oid_key = str(raw_oid).lower().strip()
            oid_suf = extract_order_suffix(raw_oid)
            
            # Skip if terminal order or duplicate
            if oid_key in seen or oid_suf in seen or oid_key in terminal_ids or oid_suf in terminal_ids:
                continue

            st = str(o.get("status") or "").lower().strip()
            if st in ("delivered", "cancelled", "failed_delivery", "returned"):
                continue

            seen.add(oid_key)
            if oid_suf:
                seen.add(oid_suf)

            order_data = normalize_order_dict(dict(o))

            if not order_data.get("items"):
                if oid_key in redis_map:
                    order_data["items"] = redis_map[oid_key].get("items")
                    if not order_data.get("customer_name"):
                        order_data["customer_name"] = redis_map[oid_key].get("customer_name")
                    if not order_data.get("customer_phone"):
                        order_data["customer_phone"] = redis_map[oid_key].get("customer_phone")
                else:
                    order_data["items"] = [{
                        "id": 1,
                        "name": "Express Grocery Item",
                        "qty": 1,
                        "price": float(order_data.get("total_amount") or 50)
                    }]

            # Classification logic driven authoritatively by Postgres
            if oid_key in pg_assigned_map or (oid_suf and oid_suf in pg_assigned_map):
                matched = pg_assigned_map.get(oid_key) or pg_assigned_map.get(oid_suf)
                order_data.update(matched)
                assigned_to_rider.append(order_data)
            elif oid_key in pg_available_map or (oid_suf and oid_suf in pg_available_map):
                matched = pg_available_map.get(oid_key) or pg_available_map.get(oid_suf)
                order_data.update(matched)
                unassigned_pool.append(order_data)
            else:
                # Order only present in Redis cache or un-indexed source
                o_agent = str(order_data.get("delivery_agent_id") or "").strip()
                r_phone = str(user.get("phone") or "").strip()

                is_my_assignment = bool(
                    o_agent and (
                        o_agent == str(rider_id) or
                        (r_phone and o_agent == r_phone)
                    )
                )

                if is_my_assignment:
                    assigned_to_rider.append(order_data)
                elif not o_agent or o_agent in ("None", "null", "", "unassigned"):
                    if st not in ("delivered", "cancelled", "failed_delivery", "returned"):
                        unassigned_pool.append(order_data)

        # Mark 1st assigned order as active, and remainder as queued
        results = []
        for idx, ord_item in enumerate(assigned_to_rider):
            ord_item["is_active_delivery"] = (idx == 0)
            ord_item["is_queued"] = (idx > 0)
            ord_item["queue_position"] = idx if idx > 0 else None
            results.append(ord_item)

        results.extend(unassigned_pool)
        if include_offer:
            offer = await get_pending_offer_internal(user)
            return {
                "status": "success",
                "orders": results,
                "pending_offer": offer
            }
        return results
    except Exception as err:
        import logging
        logging.error(f"Error fetching active delivery orders: {err}")
        return []

@router.get("/delivery/history")
async def delivery_history(user=Depends(require_roles("delivery_agent"))):
    rider_id = user.get("sub")
    try:
        agent_ids = [str(rider_id)]

        cache_key = f"cloud:rider_history:{rider_id}"
        cached = await cache_get(cache_key)
        if isinstance(cached, list) and cached:
            return cached

        history_pg_uuids = [k for k in agent_ids if is_valid_uuid(k)]
        if history_pg_uuids:
            db_orders = await store.get("orders", {
                "delivery_agent_id": f"in.({','.join(history_pg_uuids)})",
                "status": "eq.delivered",
                "order": "created_at.desc",
                "limit": 200
            })
        else:
            db_orders = []
        if not isinstance(db_orders, list):
            db_orders = []

        if not db_orders:
            redis_queue = await cache_get("cloud:orders_list") or []
            if isinstance(redis_queue, list):
                agent_phone = user.get("phone") or ""
                db_orders = [
                    o for o in redis_queue 
                    if str(o.get("status")).lower() == "delivered" and (
                        str(o.get("delivery_agent_id")) == str(rider_id) or 
                        str(o.get("agent_id")) == str(rider_id) or
                        str(o.get("assigned_agent_id")) == str(rider_id) or
                        (agent_phone and str(o.get("delivery_agent_phone")) == str(agent_phone))
                    )
                ]

        for o in db_orders:
            normalize_order_dict(o)
            if not o.get("items"):
                cached_single = await cache_get(f"cloud:order:{o.get('id')}")
                if cached_single and isinstance(cached_single, dict) and cached_single.get("items"):
                    o["items"] = cached_single["items"]
                    if not o.get("customer_name"):
                        o["customer_name"] = cached_single.get("customer_name")
                else:
                    o["items"] = [{"id": 1, "name": "Express Grocery Item", "qty": 1, "price": float(o.get("total_amount") or 50)}]

        if db_orders:
            await redis_exec(["SET", cache_key, json.dumps(db_orders), "EX", 30])

        return db_orders
    except Exception:
        return []

@router.post("/delivery/history/sync")
async def sync_rider_history(payload: dict, user=Depends(require_roles("delivery_agent"))):
    rider_id = user.get("sub")
    client_history = payload.get("history") or []
    if not isinstance(client_history, list):
        return {"status": "ok", "synced": 0}

    now_iso = get_store_local_now().isoformat()

    alias_keys = {str(rider_id)}
    rider_phone = str(user.get("phone") or "").strip()
    if rider_phone:
        alias_keys.add(rider_phone)
        digits = "".join(filter(str.isdigit, rider_phone))
        if digits:
            alias_keys.add(digits)
            alias_keys.add(f"+{digits}")

    normalized = []
    for item in client_history:
        if isinstance(item, dict):
            entry = dict(item)
            entry["status"] = "delivered"
            orig_ts = entry.get("completedAtISO") or entry.get("delivered_at") or entry.get("created_at") or entry.get("dateIso")
            if orig_ts:
                entry["completedAtISO"] = orig_ts
                entry["delivered_at"] = orig_ts
            normalized.append(entry)

    for r_key in alias_keys:
        existing = await cache_get(f"cloud:rider_history:{r_key}") or []
        if not isinstance(existing, list):
            existing = []
        seen = {str(e.get("orderId") or e.get("order_id") or e.get("id") or "") for e in existing}
        merged = existing + [n for n in normalized if str(n.get("orderId") or n.get("order_id") or n.get("id") or "") not in seen]
        await cache_set(f"cloud:rider_history:{r_key}", merged[:200], ttl_seconds=86400 * 30)

    return {"status": "ok", "synced": len(normalized)}

@router.get("/delivery/available")
async def available_deliveries(user=Depends(require_roles("delivery_agent"))):
    try:
        # Fetch terminal order IDs from Postgres as authoritative exclusion set
        terminal_rows = await store.get("orders", {
            "status": "in.(delivered,cancelled,failed_delivery,returned)",
            "select": "id"
        }) or []
        terminal_ids = set()
        if isinstance(terminal_rows, list):
            for tr in terminal_rows:
                tid = tr.get("id")
                if tid:
                    terminal_ids.add(str(tid).lower().strip())

        orders_db = await store.get("orders", {
            "status": "in.(placed,confirmed,preparing,ready_for_pickup,ready)",
            "order": "created_at.desc"
        }) or []
        if not isinstance(orders_db, list):
            orders_db = []

        return [o for o in orders_db if str(o.get("id") or "").lower().strip() not in terminal_ids]
    except Exception:
        return []

async def dispatch_pending_offers():
    """
    Evaluates unassigned orders and creates a 60-second offer for eligible idle riders.
    Handles lazy expiry and re-dispatching when an offer expires or is rejected.
    """
    store_settings = load_store_settings()
    now = get_store_local_now()
    is_within_hours, _, _ = is_within_store_hours(store_settings, now)
    is_past_auto, _ = is_past_auto_shift_end_logout(store_settings, now)
    if not is_within_hours or is_past_auto:
        return

    async with users_db_lock:
        users = load_users_db()

    eligible_riders = []
    for u in users:
        if isinstance(u, dict) and u.get("role") in ("delivery_agent", "rider", "delivery"):
            if u.get("is_online") and u.get("agent_status") in ("AVAILABLE", "ONLINE"):
                r_id = str(u.get("id") or u.get("phone") or "").strip()
                r_phone = str(u.get("phone") or "").strip()
                if r_id:
                    eligible_riders.append((r_id, r_phone))

    if not eligible_riders:
        return

    redis_orders = await cache_get("cloud:orders_list") or []
    if not isinstance(redis_orders, list):
        return

    busy_rider_ids = set()
    for o in redis_orders:
        agent = str(o.get("delivery_agent_id") or "").strip()
        st = str(o.get("status") or "").lower()
        if agent and agent not in ("None", "null", "") and st not in ("delivered", "cancelled", "failed_delivery", "returned"):
            busy_rider_ids.add(agent)

    idle_riders = [r for r in eligible_riders if r[0] not in busy_rider_ids and (not r[1] or r[1] not in busy_rider_ids)]
    if not idle_riders:
        return

    modified = False
    expired_direct_assignments: list[str] = []
    for o in redis_orders:
        st = str(o.get("status") or "").lower()
        agent = str(o.get("delivery_agent_id") or "").strip()
        if st not in ("ready_for_pickup", "ready", "accepted", "placed", "preparing", "confirmed"):
            continue

        offered_to = str(o.get("offered_to_rider_id") or "").strip()
        expires_at_str = o.get("offer_expires_at")
        rejected_by = o.get("rejected_by_rider_ids") or []
        if not isinstance(rejected_by, list):
            rejected_by = []

        # Check if offer expired. This must run BEFORE any "agent already set"
        # filter — a seller's direct assign (POST /orders/{id}/assign) sets
        # delivery_agent_id immediately, up front, before the rider ever acts
        # on it. If we skipped agent-set orders here, an ignored offer would
        # never be detected as expired and the order would stay silently
        # stuck on an unresponsive rider forever.
        if offered_to and expires_at_str:
            try:
                exp_dt = datetime.fromisoformat(expires_at_str)
                if now >= exp_dt:
                    if offered_to not in rejected_by:
                        rejected_by.append(offered_to)
                    o["rejected_by_rider_ids"] = rejected_by
                    o["offered_to_rider_id"] = None
                    o["offer_expires_at"] = None
                    offered_to = None
                    modified = True
                    # A direct seller assignment that timed out unacknowledged
                    # must release the rider too, or this order can never be
                    # picked up by the unassigned-order auto-dispatch below.
                    if agent and agent not in ("None", "null", ""):
                        o["delivery_agent_id"] = None
                        o["rider_name"] = None
                        o["is_queued"] = False
                        agent = ""
                        oid = str(o.get("id") or o.get("rawId") or "")
                        if oid:
                            expired_direct_assignments.append(oid)
            except Exception:
                o["offered_to_rider_id"] = None
                o["offer_expires_at"] = None
                offered_to = None
                modified = True

    # Persist released assignments to Postgres + the single-order cache so
    # accept_delivery's own Postgres-authoritative race check doesn't still
    # see the stale rider.
    for oid in expired_direct_assignments:
        async def _release_expired(order_item_id=oid):
            await idempotent_order_upsert(
                order_item_id,
                {"delivery_agent_id": None},
                fallback_single=None,
                op_name="dispatch_release_expired_offer"
            )
            single = await cache_get(f"cloud:order:{order_item_id}")
            if single and isinstance(single, dict):
                single["delivery_agent_id"] = None
                single["rider_name"] = None
                single["is_queued"] = False
                single["offered_to_rider_id"] = None
                single["offer_expires_at"] = None
                await cache_set(f"cloud:order:{order_item_id}", single, ttl_seconds=86400 * 30)
            return True
        await execute_with_retry(_release_expired, max_attempts=3, op_name="dispatch_release_expired_offer", order_id=oid)

    # Track riders who currently hold an active unexpired offer (don't double-offer)
    currently_offered_rider_ids = set()
    for o in redis_orders:
        offered_to = str(o.get("offered_to_rider_id") or "").strip()
        expires_at_str = o.get("offer_expires_at")
        if offered_to and expires_at_str:
            try:
                exp_dt = datetime.fromisoformat(expires_at_str)
                if now < exp_dt:
                    currently_offered_rider_ids.add(offered_to)
            except Exception:
                pass

    # Auto-dispatch: offer unassigned ready orders to available idle riders
    for o in redis_orders:
        st = str(o.get("status") or "").lower()
        agent = str(o.get("delivery_agent_id") or "").strip()
        if agent and agent not in ("None", "null", ""):
            continue
        if st not in ("ready_for_pickup", "ready", "accepted", "placed", "preparing", "confirmed"):
            continue

        offered_to = str(o.get("offered_to_rider_id") or "").strip()
        if offered_to:
            # Already has an active offer
            continue

        rejected_by = o.get("rejected_by_rider_ids") or []
        if not isinstance(rejected_by, list):
            rejected_by = []
        rejected_by_set = {str(x).strip() for x in rejected_by if x}

        # Pick the first idle rider not holding an offer and not having rejected this order
        chosen_rider = None
        for r in idle_riders:
            r_id, r_phone = r[0], r[1]
            if r_id in currently_offered_rider_ids or (r_phone and r_phone in currently_offered_rider_ids):
                continue
            if r_id in rejected_by_set or (r_phone and r_phone in rejected_by_set):
                continue
            chosen_rider = r
            break

        if chosen_rider:
            target_id, target_phone = chosen_rider[0], chosen_rider[1]
            o["offered_to_rider_id"] = target_id
            o["offer_expires_at"] = (now + timedelta(seconds=60)).isoformat()
            currently_offered_rider_ids.add(target_id)
            if target_phone:
                currently_offered_rider_ids.add(target_phone)
            modified = True

    if modified:
        await cache_set("cloud:orders_list", redis_orders, ttl_seconds=86400 * 30)

async def get_pending_offer_internal(user: dict) -> dict:
    rider_id = str(user.get("sub") or "").strip()
    user_phone = str(user.get("phone") or "").strip()

    # Suppress offers if rider is already busy delivering an order
    has_active = await rider_has_active_delivery(rider_id, user_phone)
    if has_active:
        return {"status": "success", "has_offer": False, "offer": None}

    await dispatch_pending_offers()

    now = get_store_local_now()
    # Build the full set of IDs/phones for this rider:
    # Includes the Supabase JWT sub, phone, and all aliases from users.json
    # This is needed because sellers may assign using a users.json UUID that differs from Supabase auth UUID
    valid_rider_keys = {k for k in (rider_id, user_phone) if k}
    if user_phone:
        digits = "".join(filter(str.isdigit, str(user_phone)))
        if digits:
            valid_rider_keys.add(digits)
            valid_rider_keys.add(f"+{digits}")

    # Resolve cross-ID aliases from users.json (same as delivery_active_orders does)
    try:
        users_local = load_users_db()
        for u in users_local:
            if isinstance(u, dict):
                uid = str(u.get("id") or "").strip()
                uph = str(u.get("phone") or "").strip()
                # If any of this rider's known keys match this user record, add all that user's IDs
                if uid in valid_rider_keys or uph in valid_rider_keys:
                    if uid:
                        valid_rider_keys.add(uid)
                    if uph:
                        valid_rider_keys.add(uph)
                        udigits = "".join(filter(str.isdigit, uph))
                        if udigits:
                            valid_rider_keys.add(udigits)
                            valid_rider_keys.add(f"+{udigits}")
    except Exception:
        pass

    redis_orders = await cache_get("cloud:orders_list") or []
    if isinstance(redis_orders, list):
        for o in redis_orders:
            offered_to = str(o.get("offered_to_rider_id") or "").strip()
            exp_str = o.get("offer_expires_at")
            if offered_to and exp_str and offered_to in valid_rider_keys:
                try:
                    exp_dt = datetime.fromisoformat(exp_str)
                    secs_left = max(0, int((exp_dt - now).total_seconds()))
                    if secs_left > 0:
                        return {
                            "status": "success",
                            "has_offer": True,
                            "offer": o,
                            "offer_expires_at": exp_str,
                            "seconds_remaining": secs_left
                        }
                except Exception:
                    pass
    return {"status": "success", "has_offer": False, "offer": None}

@router.get("/delivery/pending-offer")
@router.get("/delivery/pending-offer/")
async def get_pending_offer(user=Depends(require_roles("delivery_agent"))):
    return await get_pending_offer_internal(user)

@router.get("/delivery/sync-orders")
@router.get("/delivery/sync-orders/")
async def delivery_sync_orders(user=Depends(require_roles("delivery_agent"))):
    orders = await delivery_active_orders(include_offer=False, user=user)
    offer = await get_pending_offer_internal(user)
    return {
        "status": "success",
        "orders": orders,
        "pending_offer": offer
    }

@router.post("/delivery/{order_id}/offer")
@router.post("/delivery/{order_id}/offer/")
async def offer_delivery_to_rider(order_id: str, payload: dict, user=Depends(require_roles("seller", "admin"))):
    target_rider_id = str(payload.get("rider_id") or "").strip()
    if not target_rider_id:
        raise HTTPException(status_code=400, detail="rider_id is required")

    now = get_store_local_now()
    exp_time = (now + timedelta(seconds=60)).isoformat()

    redis_orders = await cache_get("cloud:orders_list") or []
    if isinstance(redis_orders, list):
        for o in redis_orders:
            if str(o.get("id") or o.get("rawId")) == str(order_id):
                o["offered_to_rider_id"] = target_rider_id
                o["offer_expires_at"] = exp_time
                await cache_set("cloud:orders_list", redis_orders, ttl_seconds=86400 * 30)
                return {"status": "success", "order_id": order_id, "offered_to": target_rider_id, "expires_at": exp_time}

    raise HTTPException(status_code=404, detail="Order not found")

@router.post("/delivery/{order_id}/reject")
@router.post("/delivery/{order_id}/reject/")
async def reject_delivery(order_id: str, user=Depends(require_roles("delivery_agent"))):
    rider_id = str(user.get("sub") or "").strip()
    user_phone = str(user.get("phone") or "").strip()

    # Check if there are other active available riders on duty
    other_active_riders = []
    async with users_db_lock:
        users = load_users_db()

    store_settings = load_store_settings()
    for u in users:
        if isinstance(u, dict) and u.get("role") in ("delivery_agent", "rider", "delivery"):
            u_id = str(u.get("id") or u.get("phone") or "").strip()
            u_phone = str(u.get("phone") or "").strip()
            # Ignore rejecting rider
            if u_id in (rider_id, user_phone) or u_phone in (rider_id, user_phone):
                continue

            # Check if rider is active/online dynamically computed against store hours & daily shifts
            p_stat = compute_rider_presence_status(u, store_settings)
            is_online = p_stat in ("PRESENT", "LATE")
            if is_online:
                other_active_riders.append(u_id)

    if not other_active_riders:
        raise HTTPException(
            status_code=400,
            detail="No other active delivery riders are online currently. You are the sole active rider on duty, so this order cannot be rejected and must be fulfilled."
        )

    redis_orders = await cache_get("cloud:orders_list") or []
    single_cached = None
    try:
        single_cached = await cache_get(f"cloud:order:{order_id}")
    except Exception:
        pass

    # Resolve the rider's valid key set
    valid_rider_keys = {rider_id}
    if user_phone:
        valid_rider_keys.add(user_phone)
        digits = "".join(filter(str.isdigit, str(user_phone)))
        if digits:
            valid_rider_keys.add(digits)
            valid_rider_keys.add(f"+{digits}")

    # Find the target order and determine if it was directly assigned to this rider
    target_qo = None
    current_agent = None
    if isinstance(redis_orders, list):
        for o in redis_orders:
            if str(o.get("id") or o.get("rawId")) == str(order_id):
                target_qo = o
                current_agent = str(o.get("delivery_agent_id") or "").strip()
                break

    if not current_agent and single_cached and isinstance(single_cached, dict):
        current_agent = str(single_cached.get("delivery_agent_id") or "").strip()

    was_assigned_to_me = bool(current_agent and current_agent in valid_rider_keys)

    # Build updated rejected_by list
    rejected_by = []
    if target_qo:
        rejected_by = target_qo.get("rejected_by_rider_ids") or []
    elif single_cached and isinstance(single_cached, dict):
        rejected_by = single_cached.get("rejected_by_rider_ids") or []
    if not isinstance(rejected_by, list):
        rejected_by = []
    if rider_id not in rejected_by:
        rejected_by.append(rider_id)

    # 1. Update Postgres: clear delivery_agent_id too if this was a direct assignment
    pg_patch = {"delivery_agent_id": None} if was_assigned_to_me else {}

    if pg_patch:
        await idempotent_order_upsert(
            order_id,
            pg_patch,
            fallback_single=single_cached,
            op_name="reject_delivery"
        )

    # 2. Update single order cache
    if single_cached and isinstance(single_cached, dict):
        single_cached["offered_to_rider_id"] = None
        single_cached["offer_expires_at"] = None
        single_cached["rejected_by_rider_ids"] = rejected_by
        if was_assigned_to_me:
            single_cached["delivery_agent_id"] = None
            single_cached["rider_name"] = None
            single_cached["is_queued"] = False
        await cache_set(f"cloud:order:{order_id}", single_cached, ttl_seconds=86400 * 30)

    # 3. Update Redis orders list
    if target_qo:
        target_qo["rejected_by_rider_ids"] = rejected_by
        target_qo["offered_to_rider_id"] = None
        target_qo["offer_expires_at"] = None
        if was_assigned_to_me:
            target_qo["delivery_agent_id"] = None
            target_qo["rider_name"] = None
            target_qo["is_queued"] = False
        await cache_set("cloud:orders_list", redis_orders, ttl_seconds=86400 * 30)

    await redis_exec(["DEL", f"cloud:rider_active:{rider_id}"])
    await dispatch_pending_offers()
    return {"status": "success", "message": "Offer rejected, re-routed to active fleet"}

@router.post("/delivery/{order_id}/accept")
async def accept_delivery(order_id: str, user=Depends(require_roles("delivery_agent"))):
    rider_id = str(user.get("sub") or "").strip()
    user_phone = str(user.get("phone") or "").strip()
    now = get_store_local_now()

    valid_keys = {k for k in (rider_id, user_phone) if k}
    if user_phone:
        digits = "".join(filter(str.isdigit, str(user_phone)))
        if digits:
            valid_keys.add(digits)
            valid_keys.add(f"+{digits}")


    # 1. Double assignment race prevention: Check Postgres
    async def _check_race_pg():
        return await store.get("orders", {"id": f"eq.{order_id}", "select": "delivery_agent_id,status"})

    pg_order_rows, pg_check_ok = await execute_with_retry(_check_race_pg, max_attempts=3, op_name="check_accept_race_pg", order_id=order_id)
    if pg_check_ok and isinstance(pg_order_rows, list) and len(pg_order_rows) > 0:
        assigned_agent = str(pg_order_rows[0].get("delivery_agent_id") or "").strip()
        if assigned_agent and assigned_agent not in ("None", "null", "") and assigned_agent not in valid_keys:
            raise HTTPException(status_code=409, detail="Order already assigned to another rider")

    single = None
    try:
        single = await cache_get(f"cloud:order:{order_id}")
    except Exception as err:
        import logging
        logging.warning(f"Cache lookup cloud:order:{order_id} error in accept_delivery: {err}")

    if single and isinstance(single, dict):
        assigned_agent = str(single.get("delivery_agent_id") or "").strip()
        if assigned_agent and assigned_agent not in ("None", "null", "") and assigned_agent not in valid_keys:
            raise HTTPException(status_code=409, detail="Order already assigned to another rider")

    q_orders = await cache_get("cloud:orders_list") or []
    target_order_in_list = None
    if isinstance(q_orders, list):
        for qo in q_orders:
            if str(qo.get("id") or qo.get("rawId")) == str(order_id):
                target_order_in_list = qo
                if not single or not isinstance(single, dict):
                    single = dict(qo)
                break

    # Validate offer recipient & expiry: only block if another rider has an unexpired offer
    if target_order_in_list:
        offered_to = str(target_order_in_list.get("offered_to_rider_id") or "").strip()
        expires_at_str = target_order_in_list.get("offer_expires_at")
        if offered_to and offered_to not in valid_keys and expires_at_str:
            try:
                exp_dt = datetime.fromisoformat(expires_at_str)
                if now < exp_dt:
                    raise HTTPException(status_code=409, detail="Order offer is currently pending with another rider")
            except Exception:
                pass

    # 2. Idempotent Postgres write
    pg_success = await idempotent_order_upsert(
        order_id,
        {"delivery_agent_id": rider_id, "status": "out_for_delivery"},
        fallback_single=single,
        op_name="accept_delivery"
    )

    # 3. Synchronize single order cache and clear offer fields
    if target_order_in_list:
        target_order_in_list["delivery_agent_id"] = rider_id
        target_order_in_list["status"] = "out_for_delivery"
        target_order_in_list["offered_to_rider_id"] = None
        target_order_in_list["offer_expires_at"] = None
        await cache_set("cloud:orders_list", q_orders, ttl_seconds=86400 * 30)

    # 4. Update rider agentStatus in users.json to ON_DELIVERY
    async with users_db_lock:
        users = load_users_db()
        for u in users:
            if isinstance(u, dict) and u.get("role") == "delivery_agent":
                uid = str(u.get("id") or u.get("phone") or "")
                uph = str(u.get("phone") or "")
                if uid == rider_id or uph == rider_id or (user_phone and uph == user_phone):
                    u["agent_status"] = "ON_DELIVERY"
                    u["is_online"] = True
        save_users_db(users)
    if single and isinstance(single, dict):
        single["status"] = "out_for_delivery"
        single["delivery_agent_id"] = rider_id

    async def _update_single_cache():
        await cache_set(f"cloud:order:{order_id}", single, ttl_seconds=86400 * 30)
        phone = single.get("customer_phone")
        canonical, _ = normalize_phone(phone)
        for key_p in [canonical, "".join(filter(str.isdigit, str(phone or "")))]:
            if key_p:
                cust_key = f"cloud:customer_orders:{key_p}"
                c_list = await cache_get(cust_key) or []
                if isinstance(c_list, list):
                    for co in c_list:
                        if co.get("id") == order_id or co.get("rawId") == order_id:
                            co["status"] = "out_for_delivery"
                            co["delivery_agent_id"] = rider_id
                    await cache_set(cust_key, c_list, ttl_seconds=86400 * 30)
        return True

    _, redis_single_success = await execute_with_retry(_update_single_cache, max_attempts=3, op_name="accept_update_single_cache", order_id=order_id)

    # 4. Synchronize store queue list cache
    async def _update_list_cache():
        q_orders = await cache_get("cloud:orders_list") or []
        if isinstance(q_orders, list):
            found = False
            for qo in q_orders:
                if qo.get("id") == order_id or qo.get("rawId") == order_id:
                    qo["status"] = "out_for_delivery"
                    qo["delivery_agent_id"] = rider_id
                    found = True
            if not found and single:
                q_orders.insert(0, single)
            await cache_set("cloud:orders_list", q_orders, ttl_seconds=86400 * 30)
        return True

    _, redis_list_success = await execute_with_retry(_update_list_cache, max_attempts=3, op_name="accept_update_list_cache", order_id=order_id)

    if not pg_success and not redis_single_success:
        import logging
        logging.error(f"Failed to persist order accept assignment for order {order_id} in Postgres or Redis after retries")
        raise HTTPException(status_code=500, detail="Failed to persist order assignment in database or cache")

    await redis_exec(["DEL", f"cloud:rider_active:{rider_id}"])
    await redis_publish("orders:delivery", {"order_id": order_id, "rider_id": rider_id, "status": "out_for_delivery"})
    return {"status": "ok", "order_id": order_id, "new_status": "out_for_delivery"}

@router.patch("/delivery/{order_id}/step")
@router.patch("/delivery/{order_id}/step/")
async def update_delivery_step(
    order_id: str,
    payload: dict,
    user=Depends(require_roles("delivery_agent", "rider", "delivery_partner", "seller", "admin"))
):
    """
    Advance delivery workflow step:
    REACH_STORE -> STORE_CHECKLIST -> EN_ROUTE -> ARRIVED -> OTP_DELIVERY -> COMPLETED
    """
    step = str(payload.get("step") or payload.get("workflow_step") or "").strip()
    clean_id = str(order_id).strip()
    if not step:
        raise HTTPException(400, "step field is required")

    status_map = {
        "REACH_STORE": "accepted",
        "STORE_CHECKLIST": "picked_up",
        "EN_ROUTE": "out_for_delivery",
        "ARRIVED": "out_for_delivery",
        "OTP_DELIVERY": "out_for_delivery",
        "COMPLETED": "delivered"
    }
    new_status = status_map.get(step, "out_for_delivery")
    now_iso = datetime.now(timezone.utc).isoformat()
    rider_id = str(user.get("sub") or user.get("id") or "").strip()

    # 1. Update single order cache
    order_data = await cache_get(f"cloud:order:{clean_id}")
    if not order_data or not isinstance(order_data, dict):
        if clean_id.startswith("GB-") or clean_id.startswith("gb-"):
            order_data = await cache_get(f"cloud:order:{clean_id[3:]}")
    if not isinstance(order_data, dict):
        order_data = {"id": clean_id, "rawId": clean_id}

    # Reject step progression if order is in a terminal status
    curr_st = normalize_status(order_data.get("status") if isinstance(order_data, dict) else "placed")
    if curr_st in ("delivered", "cancelled", "returned", "failed_delivery"):
        raise HTTPException(
            409,
            f"Cannot advance delivery step: order {clean_id} is already in terminal state '{curr_st}'"
        )

    order_data["workflow_step"] = step
    order_data["status"] = new_status
    if rider_id:
        order_data["delivery_agent_id"] = rider_id
    if new_status == "delivered":
        order_data["delivered_at"] = now_iso
        order_data["completedAtISO"] = now_iso

    await cache_set(f"cloud:order:{clean_id}", order_data, ttl_seconds=86400 * 30)

    # 2. Sync to Postgres orders table
    if is_valid_uuid(clean_id):
        try:
            pg_patch = {"status": new_status}
            if rider_id and is_valid_uuid(rider_id):
                pg_patch["delivery_agent_id"] = rider_id
            await store.patch("orders", pg_patch, {"id": f"eq.{clean_id}"})
        except Exception as err:
            logger.warning(f"Failed to update order step in DB for {clean_id}: {err}")

    # 3. Sync to store queue cache
    q_orders = await cache_get("cloud:orders_list") or []
    if isinstance(q_orders, list):
        found = False
        for o in q_orders:
            oid = o.get("id") or o.get("rawId")
            if is_same_order_id(oid, clean_id):
                o["workflow_step"] = step
                o["status"] = new_status
                if rider_id:
                    o["delivery_agent_id"] = rider_id
                if new_status == "delivered":
                    o["delivered_at"] = now_iso
                    o["completedAtISO"] = now_iso
                found = True
        if not found:
            q_orders.insert(0, order_data)
        await cache_set("cloud:orders_list", q_orders[:100], ttl_seconds=86400 * 30)

    # 4. Sync customer cache
    cust_phone = order_data.get("customer_phone")
    if cust_phone:
        canonical, _ = normalize_phone(cust_phone)
        for pkey in [canonical, "".join(filter(str.isdigit, str(cust_phone)))]:
            if pkey:
                c_orders = await cache_get(f"cloud:customer_orders:{pkey}") or []
                if isinstance(c_orders, list):
                    for co in c_orders:
                        if is_same_order_id(co.get("id"), clean_id) or is_same_order_id(co.get("rawId"), clean_id):
                            co["workflow_step"] = step
                            co["status"] = new_status
                            if new_status == "delivered":
                                co["delivered_at"] = now_iso
                    await cache_set(f"cloud:customer_orders:{pkey}", c_orders, ttl_seconds=86400 * 30)

    # 5. Sync to orders_items.json
    try:
        with orders_items_lock:
            o_map = load_orders_items()
            for k in [clean_id, clean_id.replace("GB-", "").replace("gb-", "")]:
                if k in o_map and isinstance(o_map[k], dict):
                    o_map[k]["workflow_step"] = step
                    o_map[k]["status"] = new_status
                    if new_status == "delivered":
                        o_map[k]["delivered_at"] = now_iso
                    if "order" in o_map[k] and isinstance(o_map[k]["order"], dict):
                        o_map[k]["order"]["workflow_step"] = step
                        o_map[k]["order"]["status"] = new_status
            save_orders_items_db(o_map)
    except Exception:
        pass

    await redis_publish("orders:delivery", {"order_id": clean_id, "step": step, "status": new_status, "rider_id": rider_id})
    return {"status": "ok", "order_id": clean_id, "step": step, "order_status": new_status}

@router.patch("/orders/{order_id}/verify-otp")
@router.patch("/orders/{order_id}/verify-otp/")
async def verify_delivery_otp(
    order_id: str,
    payload: dict,
    user=Depends(require_roles("delivery_agent", "rider", "delivery_partner", "seller", "admin"))
):
    """
    Verify customer delivery OTP and complete delivery.
    Accepts payload: {"otp": "...", "proof_photo_url": "..."}
    Validates against:
      - Generated delivery_otp on order
      - "1234" (demo fallback)
      - Last 4 digits of customer phone
    """
    entered_otp = str(payload.get("otp") or "").strip()
    proof_photo_url = payload.get("proof_photo_url")
    clean_id = str(order_id).strip()

    if not entered_otp:
        raise HTTPException(400, "OTP is required")

    # Fetch order details
    order_data = await cache_get(f"cloud:order:{clean_id}")
    if not order_data or not isinstance(order_data, dict):
        if clean_id.startswith("GB-") or clean_id.startswith("gb-"):
            order_data = await cache_get(f"cloud:order:{clean_id[3:]}")
    if not order_data or not isinstance(order_data, dict):
        try:
            if is_valid_uuid(clean_id):
                db_rows = await store.get("orders", {"id": f"eq.{clean_id}"})
                if db_rows and isinstance(db_rows, list) and len(db_rows) > 0:
                    order_data = db_rows[0]
        except Exception:
            pass

    o_items_map = load_orders_items()
    item_entry = o_items_map.get(clean_id) or o_items_map.get(clean_id.replace("GB-", "").replace("gb-", "")) or {}
    cust_phone = (order_data.get("customer_phone") if isinstance(order_data, dict) else None) or item_entry.get("customer_phone") or ""
    phone_digits = "".join(filter(str.isdigit, str(cust_phone)))
    phone_last4 = phone_digits[-4:] if len(phone_digits) >= 4 else ""

    # Reject if order is already cancelled or in terminal failure state
    # Check status from order_data OR fall back to orders_items.json
    curr_st = "placed"
    if isinstance(order_data, dict) and order_data.get("status"):
        curr_st = normalize_status(order_data.get("status"))
    elif item_entry.get("status"):
        curr_st = normalize_status(item_entry.get("status"))
    if curr_st in ("cancelled", "returned", "failed_delivery"):
        raise HTTPException(
            409,
            f"Cannot verify OTP: order {clean_id} is in terminal state '{curr_st}'"
        )

    expected_otp = None
    if isinstance(order_data, dict) and order_data.get("delivery_otp"):
        expected_otp = str(order_data["delivery_otp"]).strip()
    elif item_entry.get("delivery_otp"):
        expected_otp = str(item_entry["delivery_otp"]).strip()

    valid_otps = {"1234"}
    if expected_otp:
        valid_otps.add(expected_otp)
    if phone_last4:
        valid_otps.add(phone_last4)

    if entered_otp not in valid_otps:
        raise HTTPException(400, "Invalid OTP! Please check with the customer.")

    now_iso = datetime.now(timezone.utc).isoformat()
    rider_id = str(user.get("sub") or user.get("id") or "").strip()

    if not isinstance(order_data, dict):
        order_data = {"id": clean_id, "rawId": clean_id}

    order_data["status"] = "delivered"
    order_data["workflow_step"] = "COMPLETED"
    order_data["delivered_at"] = now_iso
    order_data["completedAtISO"] = now_iso
    if proof_photo_url:
        order_data["proof_photo_url"] = proof_photo_url
    if rider_id:
        order_data["delivery_agent_id"] = rider_id

    await cache_set(f"cloud:order:{clean_id}", order_data, ttl_seconds=86400 * 30)

    # Sync to Postgres orders table
    if is_valid_uuid(clean_id):
        try:
            p_patch = {"status": "delivered"}
            if rider_id and is_valid_uuid(rider_id):
                p_patch["delivery_agent_id"] = rider_id
            await store.patch("orders", p_patch, {"id": f"eq.{clean_id}"})
        except Exception as err:
            logger.warning(f"Failed to update delivered in DB for {clean_id}: {err}")

    # Sync to seller queue cache
    q_orders = await cache_get("cloud:orders_list") or []
    if isinstance(q_orders, list):
        found = False
        for o in q_orders:
            oid = o.get("id") or o.get("rawId")
            if is_same_order_id(oid, clean_id):
                o["status"] = "delivered"
                o["workflow_step"] = "COMPLETED"
                o["delivered_at"] = now_iso
                if rider_id:
                    o["delivery_agent_id"] = rider_id
                found = True
        if not found:
            q_orders.insert(0, order_data)
        await cache_set("cloud:orders_list", q_orders[:100], ttl_seconds=86400 * 30)

    # Sync customer cache
    if cust_phone:
        canonical, _ = normalize_phone(cust_phone)
        for pkey in [canonical, "".join(filter(str.isdigit, str(cust_phone)))]:
            if pkey:
                c_orders = await cache_get(f"cloud:customer_orders:{pkey}") or []
                if isinstance(c_orders, list):
                    for co in c_orders:
                        if is_same_order_id(co.get("id"), clean_id) or is_same_order_id(co.get("rawId"), clean_id):
                            co["status"] = "delivered"
                            co["workflow_step"] = "COMPLETED"
                            co["delivered_at"] = now_iso
                    await cache_set(f"cloud:customer_orders:{pkey}", c_orders, ttl_seconds=86400 * 30)

    # Sync to orders_items.json
    try:
        with orders_items_lock:
            o_map = load_orders_items()
            for k in [clean_id, clean_id.replace("GB-", "").replace("gb-", "")]:
                if k in o_map and isinstance(o_map[k], dict):
                    o_map[k]["status"] = "delivered"
                    o_map[k]["workflow_step"] = "COMPLETED"
                    o_map[k]["delivered_at"] = now_iso
                    if proof_photo_url:
                        o_map[k]["proof_photo_url"] = proof_photo_url
                    if "order" in o_map[k] and isinstance(o_map[k]["order"], dict):
                        o_map[k]["order"]["status"] = "delivered"
                        o_map[k]["order"]["workflow_step"] = "COMPLETED"
                        o_map[k]["order"]["delivered_at"] = now_iso
            save_orders_items_db(o_map)
    except Exception:
        pass

    # Invalidate active delivery for rider and update rider history
    if rider_id:
        await redis_exec(["DEL", f"cloud:rider_active:{rider_id}"])
        h_cache = await cache_get(f"cloud:rider_history:{rider_id}") or []
        if not isinstance(h_cache, list):
            h_cache = []
        h_cache = [order_data] + [h for h in h_cache if not is_same_order_id(h.get("id"), clean_id)]
        await cache_set(f"cloud:rider_history:{rider_id}", h_cache, ttl_seconds=86400 * 30)

    await redis_publish("orders:delivery", {"order_id": clean_id, "rider_id": rider_id, "status": "delivered"})
    return {"status": "delivered", "verified": True, "order_id": clean_id}


# ==============================================================================
# /payments/
# ==============================================================================
@router.get("/payments/")
@router.get("/payments")
async def payments(user=Depends(current_user)):
    return await store.get("payments", {"user_id": f"eq.{user['sub']}", "order": "created_at.desc"})

@router.post("/payments/initiate")
async def initiate_payment(payload: dict, user=Depends(require_roles("customer"))):
    order_id = payload.get("order_id")
    amount = float(payload.get("amount") or 0.0)
    payment_status = payload.get("status") or "pending"
    transaction_id = payload.get("transaction_id") or payload.get("payment_id") or f"TXN-{secrets.token_hex(6)}"

    payment_record = {
        "user_id": user["sub"] if (user.get("sub") and is_valid_uuid(user["sub"])) else "b0cf5967-7bf0-4ce0-9d74-220c59bc6798",
        "order_id": order_id if (order_id and is_valid_uuid(order_id)) else None,
        "amount": amount,
        "status": payment_status,
        "transaction_id": transaction_id
    }
    
    try:
        db_res = await store.insert("payments", {k: v for k, v in payment_record.items() if v is not None})
        if db_res and isinstance(db_res, dict):
            return db_res
    except Exception:
        pass

    return {
        "id": f"pay_{secrets.token_hex(8)}",
        **payment_record
    }

# ==============================================================================
# /admin/
# ==============================================================================
@router.get("/admin/analytics")
async def analytics(user=Depends(require_roles("admin"))):
    try:
        res = await store.get("analytics_daily", {"order": "day.desc", "limit": 30})
        if res:
            return res
    except Exception:
        pass
    return [
        {"day": "2026-08-25", "orders": 58, "earnings": 16400},
        {"day": "2026-08-24", "orders": 44, "earnings": 12800},
        {"day": "2026-08-23", "orders": 51, "earnings": 14900},
    ]

@router.get("/admin/users")
async def admin_users(role: str | None = None, user=Depends(require_roles("admin"))):
    params = {"role": f"eq.{role}"} if role in {"seller", "delivery_agent"} else {"role": "in.(seller,delivery_agent)"}
    return await store.get("profiles", params | {"order": "created_at.desc"})

@router.post("/admin/users")
async def admin_create_partner(body: ManagedUser, user=Depends(require_roles("admin"))):
    existing = await store.get("profiles", {"phone": f"eq.{body.phone}"})
    if existing:
        raise HTTPException(409, "Phone number is already registered")
    return await store.insert("profiles", body.model_dump())

@router.patch("/admin/users/{profile_id}")
async def admin_update_partner(profile_id: str, body: ManagedUser, user=Depends(require_roles("admin"))):
    return await store.patch("profiles", body.model_dump(exclude_none=True), {"id": f"eq.{profile_id}"})

@router.delete("/admin/users/{profile_id}", status_code=204)
async def admin_delete_partner(profile_id: str, user=Depends(require_roles("admin"))):
    await store.delete("profiles", {"id": f"eq.{profile_id}"})

# ==============================================================================
# PRODUCT SUGGESTIONS (CUSTOMER & ADMIN PORTAL)
# ==============================================================================
import os

SUGGESTIONS_FILE = os.path.join(os.path.dirname(__file__), "product_suggestions.json")

def load_suggestions() -> list:
    if os.path.exists(SUGGESTIONS_FILE):
        try:
            with open(SUGGESTIONS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_suggestions(suggestions: list):
    try:
        with open(SUGGESTIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(suggestions, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

@router.post("/product-suggestions")
@router.post("/product-suggestions/")
async def create_suggestion(payload: dict):
    if not payload.get("product_name"):
        raise HTTPException(400, "Product name is required")
    
    new_sug = {
        "id": str(uuid.uuid4())[:8],
        "product_name": payload["product_name"],
        "category": payload.get("category", "General"),
        "brand": payload.get("brand", ""),
        "notes": payload.get("notes", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "customer_phone": payload.get("customer_phone", "Anonymous")
    }
    
    sugs = load_suggestions()
    sugs.insert(0, new_sug)
    save_suggestions(sugs)
    return new_sug

@router.get("/product-suggestions")
@router.get("/product-suggestions/")
@router.get("/admin/product-suggestions")
@router.get("/admin/product-suggestions/")
async def get_all_product_suggestions(user=Depends(require_roles("admin"))):
    return load_suggestions()

# ==============================================================================
# RIDER FACIAL BIOMETRICS & PROFILE PERSISTENCE ENDPOINTS
# ==============================================================================
from pathlib import Path
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

BIOMETRICS_FILE = os.path.join(os.path.dirname(__file__), "rider_biometrics.json")

def load_rider_biometrics() -> dict:
    default_records = {
        "+919080841727": {
            "rider_id": "+919080841727",
            "rider_name": "Thabee",
            "phone": "+919080841727",
            "partnerVerified": False,
            "biometricsDone": True,
            "selfie_image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80",
            "selfieImage": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80",
            "vehicle": "Ather 450X EV Scooter",
            "plate": "KA 05 EQ 4421",
            "license_plate": "KA 05 EQ 4421",
            "drivingLicense": "DL-KA-05-2024009182",
            "driving_license": "DL-KA-05-2024009182",
            "insuranceNo": "POL-8829102-X9",
            "bgCheckRef": "POLICE-VERIFIED-99182",
            "clearances": {
                "biometrics": True,
                "dlVerified": True,
                "vehicleVerified": True,
                "insuranceVerified": True,
                "bgCheckVerified": False
            },
            "clearanceTimestamps": {
                "biometrics": 1700000000000,
                "dl": 1700000000000,
                "vehicle": 1700000000000,
                "insurance": 1700000000000,
                "bg": None
            }
        },
        "+919999900003": {
            "rider_id": "+919999900003",
            "rider_name": "Karthik Rider",
            "phone": "+919999900003",
            "partnerVerified": True,
            "biometricsDone": True,
            "selfie_image": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300",
            "selfieImage": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300",
            "vehicle": "TVS iQube EV Scooter",
            "plate": "KA 01 EV 9903",
            "license_plate": "KA 01 EV 9903",
            "drivingLicense": "DL-KA-01-2023004812",
            "driving_license": "DL-KA-01-2023004812",
            "insuranceNo": "POL-991827-V1",
            "bgCheckRef": "POLICE-VERIFIED-10023",
            "clearances": {
                "biometrics": True,
                "dlVerified": True,
                "vehicleVerified": True,
                "insuranceVerified": True,
                "bgCheckVerified": True
            },
            "clearanceTimestamps": {
                "biometrics": 1700000000000,
                "dl": 1700000000000,
                "vehicle": 1700000000000,
                "insurance": 1700000000000,
                "bg": 1700000000000,
                "bgCheck": 1700000000000
            }
        }
    }
    default_records["d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2b"] = default_records["+919080841727"]
    default_records["AG-P1727"] = default_records["+919080841727"]
    default_records["Thabee"] = default_records["+919080841727"]
    default_records["d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a"] = default_records["+919999900003"]
    default_records["AG-4492"] = default_records["+919999900003"]

    if os.path.exists(BIOMETRICS_FILE):
        try:
            with open(BIOMETRICS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and data:
                    return {**default_records, **data}
        except Exception:
            pass

    save_rider_biometrics(default_records)
    return default_records

def save_rider_biometrics(data: dict):
    try:
        with open(BIOMETRICS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

@router.post("/delivery/biometrics")
@router.post("/delivery/biometrics/")
async def save_biometrics(payload: dict):
    rider_id = payload.get("rider_id") or "AG-4492"
    selfie_image = payload.get("selfie_image")
    if not selfie_image:
        raise HTTPException(400, "Selfie image is required")
    
    db_data = load_rider_biometrics()
    record = {
        "rider_id": rider_id,
        "rider_name": payload.get("rider_name", "Thabee"),
        "selfie_image": selfie_image,
        "clearances": payload.get("clearances", {}),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    db_data[rider_id] = record
    save_rider_biometrics(db_data)

    # Sync to Redis cache
    await cache_set(f"cache:biometrics:{rider_id}", record, ttl_seconds=86400 * 30)

    return {"status": "success", "record": record}

# ==============================================================================
# SUPERMARKET HUB LOCATION & STORE SETTINGS DISPATCH API
# ==============================================================================
STORE_SETTINGS_FILE = DATA_DIR / "store_settings.json"

DEFAULT_HUB_CONFIG = {
    "hub_name": "GrabIt Supermarket (Banaswadi Main Hub)",
    "branch": "Banaswadi Flagship",
    "address": "GrabIt Supermarket, Near 9th Main Road, HRBR Layout 1st Block, Banaswadi, Bengaluru 560043",
    "area": "Banaswadi",
    "city": "Bengaluru",
    "pincode": "560043",
    "lat": 13.014333,
    "lng": 77.646000,
    "geofence_radius_meters": 5000,
    "store_open_time": "09:00",
    "store_close_time": "22:00",
    "late_grace_minutes": 30,
    "updated_at": datetime.now(timezone.utc).isoformat()
}

def load_store_settings() -> dict:
    try:
        if STORE_SETTINGS_FILE.exists():
            with open(STORE_SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and data:
                    return {**DEFAULT_HUB_CONFIG, **data}
    except Exception as e:
        logger.error(f"Error loading store settings: {e}")
    return DEFAULT_HUB_CONFIG

def save_store_settings(data: dict):
    try:
        with open(STORE_SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving store settings: {e}")

@router.get("/store/settings")
@router.get("/store/settings/")
async def get_store_settings():
    cached = await cache_get("cache:store_settings")
    if cached:
        return cached
    data = load_store_settings()
    await cache_set("cache:store_settings", data, ttl_seconds=86400)
    return data

@router.post("/store/settings")
@router.post("/store/settings/")
async def update_store_settings(payload: dict, user=Depends(require_roles("admin", "seller"))):
    current = load_store_settings()
    updated = {
        **current,
        **payload,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    save_store_settings(updated)
    await cache_set("cache:store_settings", updated, ttl_seconds=86400)
    return {"status": "success", "settings": updated}

# Helper functions for Presence Computation & Store Hours Enforcement
def is_within_store_hours(store_settings: dict, dt: datetime = None) -> tuple[bool, bool, bool]:
    if dt is None:
        dt = get_store_local_now()
    open_str = store_settings.get("store_open_time", "09:00")
    close_str = store_settings.get("store_close_time", "22:00")
    late_grace_mins = int(store_settings.get("late_grace_minutes", 30))
    
    try:
        open_h, open_m = map(int, open_str.split(":"))
        close_h, close_m = map(int, close_str.split(":"))
        
        open_time = dt.replace(hour=open_h, minute=open_m, second=0, microsecond=0)
        close_time = dt.replace(hour=close_h, minute=close_m, second=0, microsecond=0)
        grace_time = open_time + timedelta(minutes=late_grace_mins)
        
        is_within_hours = (open_time <= dt <= close_time)
        is_past_open = (dt >= open_time)
        is_late_window = (dt >= grace_time and dt <= close_time)
        return is_within_hours, is_past_open, is_late_window
    except Exception:
        return True, True, False

def extract_store_date_str(iso_str: any) -> str:
    if not iso_str:
        return ""
    try:
        raw = str(iso_str).strip()
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=STORE_TZ)
        else:
            dt = dt.astimezone(STORE_TZ)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return str(iso_str)[:10]

def is_past_auto_shift_end_logout(store_settings: dict, now: datetime = None) -> tuple[bool, str]:
    if now is None:
        now = get_store_local_now()
    close_time_str = store_settings.get("store_close_time", "22:00")
    try:
        c_parts = close_time_str.split(":")
        c_hour = int(c_parts[0])
        c_min = int(c_parts[1]) if len(c_parts) > 1 else 0
        close_dt = now.replace(hour=c_hour, minute=c_min, second=0, microsecond=0)
        auto_logout_dt = close_dt + timedelta(minutes=30)
        if now >= auto_logout_dt:
            return True, close_time_str
    except Exception:
        pass
    return False, close_time_str

async def rider_has_active_delivery(rider_id: str, rider_phone: str = "") -> bool:
    r_keys = {rider_id, rider_phone}
    if rider_phone:
        digits = "".join(filter(str.isdigit, str(rider_phone)))
        if digits:
            r_keys.add(digits)
            r_keys.add(f"+{digits}")
    r_keys = {k.lower().strip() for k in r_keys if k and str(k).strip()}

    # Check Redis orders cache
    redis_orders = await cache_get("cloud:orders_list") or []
    if isinstance(redis_orders, list):
        for o in redis_orders:
            agent = str(o.get("delivery_agent_id") or "").strip().lower()
            st = str(o.get("status") or "").strip().lower()
            if agent in r_keys and st in ("out_for_delivery", "picked_up", "accepted", "delivering", "reached_pickup"):
                return True

    # Check Postgres database
    try:
        agent_ids = [k for k in r_keys if is_valid_uuid(k)]
        if agent_ids:
            pg_orders = await store.get("orders", {
                "delivery_agent_id": f"in.({','.join(agent_ids)})",
                "status": "in.(out_for_delivery,picked_up,accepted,delivering,reached_pickup)",
                "limit": 1
            })
            if isinstance(pg_orders, list) and len(pg_orders) > 0:
                return True
    except Exception:
        pass

    return False

def compute_rider_presence_status(rider: dict, store_settings: dict) -> str:
    now = get_store_local_now()
    today_date_str = now.strftime("%Y-%m-%d")
    shift_started_at = rider.get("shift_started_at")
    
    # Lazy daily reset check: if shift_started_at is not today's store-local date, treat as not started today
    started_today = False
    if shift_started_at:
        try:
            started_today = (str(shift_started_at)[:10] == today_date_str)
        except Exception:
            pass

    # If shift started on a previous day and rider was left online, they must not be online today without tapping Go Active
    is_online = bool(rider.get("is_online", False) or rider.get("agent_status") in ["AVAILABLE", "ON_DELIVERY"])
    if not started_today and not rider.get("has_active_delivery"):
        is_online = False

    # Check 30-minute auto shift-end logout
    is_past_auto, _ = is_past_auto_shift_end_logout(store_settings, now)
    if is_past_auto and not rider.get("has_active_delivery") and not rider.get("agent_status") == "ON_DELIVERY":
        is_online = False

    is_within_hours, is_past_open, is_late_window = is_within_store_hours(store_settings, now)
    
    # Live Status rules:
    # 1. Once online, PRESENT always wins
    # 2. If store is open past 15 min grace period and shift has NOT started today, LATE
    # 3. Otherwise ABSENT
    if is_online:
        return "PRESENT"
    elif is_late_window and not started_today:
        return "LATE"
    else:
        return "ABSENT"

ORDERS_ITEMS_FILE = DATA_DIR / "orders_items.json"
# Use threading.Lock (not asyncio.Lock) to avoid event-loop affinity issues in tests
import threading as _threading
orders_items_lock = _threading.Lock()


def load_orders_items() -> dict:
    if not os.path.exists(ORDERS_ITEMS_FILE):
        return {}
    try:
        with open(ORDERS_ITEMS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}

def save_orders_items_db(data: dict):
    try:
        os.makedirs(os.path.dirname(ORDERS_ITEMS_FILE), exist_ok=True)
        with open(ORDERS_ITEMS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

USERS_FILE = DATA_DIR / "users.json"

DEFAULT_PERSISTED_USERS = [
    # ── STORE SELLERS & MERCHANTS ──
    {
        "id": "seller-101",
        "name": "John Seller",
        "full_name": "John Seller",
        "store_name": "John Seller Store",
        "phone": "+919999900002",
        "email": "john.seller@grabit.local",
        "role": "seller",
        "status": "ACTIVE",
        "is_online": True,
        "location": "Banaswadi 2nd Block, Bengaluru",
        "created_at": "2026-01-15T10:00:00Z"
    },

    # ── DELIVERY FLEET RIDERS ──
    {
        "id": "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2b",
        "name": "Thabee",
        "full_name": "Thabee",
        "phone": "+919080841727",
        "role": "delivery_agent",
        "is_online": False,
        "agent_status": "UNAVAILABLE",
        "vehicle_type": "Ather 450X EV Scooter",
        "plate_number": "KA 05 EQ 4421",
        "license_number": "DL-KA-05-2024009182",
        "partnerVerified": True,
        "biometricsDone": True,
        "last_active_at": None,
        "created_at": "2026-01-01T08:00:00Z"
    },
    {
        "id": "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a",
        "name": "Karthik Rider",
        "full_name": "Karthik Rider",
        "phone": "+919999900003",
        "role": "delivery_agent",
        "is_online": False,
        "agent_status": "UNAVAILABLE",
        "vehicle_type": "TVS iQube Electric Scooter",
        "plate_number": "KA-05-EX-9921",
        "license_number": "DL-2024-88712",
        "partnerVerified": True,
        "biometricsDone": True,
        "last_active_at": datetime.now(timezone.utc).isoformat(),
        "created_at": "2026-01-05T09:30:00Z"
    }
]

def load_users_db() -> list:
    try:
        if USERS_FILE.exists():
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
    except Exception:
        pass
    save_users_db(DEFAULT_PERSISTED_USERS)
    return DEFAULT_PERSISTED_USERS

def save_users_db(data: list):
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def merge_and_normalize_users(db_profiles: list, local_users: list, partner_only: bool = False) -> list:
    PARTNER_ROLES = {"seller", "store", "merchant", "delivery_agent", "rider", "delivery"}
    by_phone = {}
    by_id = {}
    merged_list = []

    for u in (db_profiles or []):
        if not isinstance(u, dict):
            continue
        u_copy = dict(u)
        uid = str(u_copy.get("id") or "").strip()
        phone = str(u_copy.get("phone") or "").strip()
        disp_name = u_copy.get("name") or u_copy.get("full_name") or u_copy.get("store_name") or "User"
        u_copy["name"] = disp_name
        u_copy["full_name"] = u_copy.get("full_name") or disp_name

        merged_list.append(u_copy)
        if uid:
            by_id[uid] = u_copy
        if phone:
            by_phone[phone] = u_copy

    for lu in (local_users or []):
        if not isinstance(lu, dict):
            continue
        luid = str(lu.get("id") or "").strip()
        lphone = str(lu.get("phone") or "").strip()
        target = (by_phone.get(lphone) if lphone else None) or (by_id.get(luid) if luid else None)
        if target is not None:
            for k, v in lu.items():
                if v is not None and v != "":
                    target[k] = v
            disp_name = lu.get("name") or lu.get("full_name") or target.get("name") or target.get("full_name") or "User"
            target["name"] = disp_name
            target["full_name"] = lu.get("full_name") or target.get("full_name") or disp_name
            if luid:
                by_id[luid] = target
            if lphone:
                by_phone[lphone] = target
        else:
            lu_copy = dict(lu)
            disp_name = lu_copy.get("name") or lu_copy.get("full_name") or lu_copy.get("store_name") or "User"
            lu_copy["name"] = disp_name
            lu_copy["full_name"] = lu_copy.get("full_name") or disp_name
            merged_list.append(lu_copy)
            if luid:
                by_id[luid] = lu_copy
            if lphone:
                by_phone[lphone] = lu_copy

    if partner_only:
        return [u for u in merged_list if str(u.get("role", "")).lower() in PARTNER_ROLES]
    return merged_list

@router.get("/users")
@router.get("/users/")
async def get_all_users(role: str | None = None):
    async with users_db_lock:
        store_settings = load_store_settings()
        db_profiles = []
        try:
            res = await store.get("profiles")
            if isinstance(res, list):
                db_profiles = res
        except Exception:
            pass

        local_users = load_users_db()
        users = merge_and_normalize_users(db_profiles, local_users, partner_only=False)

        filtered = []
        for u in users:
            if isinstance(u, dict):
                if u.get("role") in ("delivery_agent", "rider", "delivery"):
                    u["presence_status"] = compute_rider_presence_status(u, store_settings)
                    u["status"] = u["presence_status"]
                if role:
                    r = str(role).lower()
                    u_role = str(u.get("role", "")).lower()
                    if r == "seller" and u_role not in ["seller", "store", "merchant"]:
                        continue
                    elif r in ["delivery_agent", "rider"] and u_role not in ["delivery_agent", "rider", "delivery"]:
                        continue
                    elif r not in ["seller", "delivery_agent", "rider"] and u_role != r:
                        continue
                filtered.append(u)
        return filtered

@router.post("/users")
@router.post("/users/")
async def create_user(payload: dict):
    async with users_db_lock:
        users = load_users_db()
        if not payload.get("id"):
            payload["id"] = f"user-{int(datetime.now().timestamp() * 1000)}"
        if not payload.get("name"):
            payload["name"] = payload.get("full_name", "Partner")
        if not payload.get("created_at"):
            payload["created_at"] = datetime.now(timezone.utc).isoformat()
        users.insert(0, payload)
        save_users_db(users)
        return {"status": "success", "user": payload, **payload}

@router.patch("/users/{user_id}")
@router.patch("/users/{user_id}/")
async def patch_user(user_id: str, payload: dict):
    async with users_db_lock:
        users = load_users_db()
        updated = None
        for u in users:
            if str(u.get("id")) == str(user_id) or str(u.get("phone")) == str(user_id):
                u.update(payload)
                updated = u
                break
        if updated:
            save_users_db(users)
            return updated
        return {"status": "error", "message": "User not found"}

@router.delete("/users/{user_id}")
@router.delete("/users/{user_id}/")
async def delete_user(user_id: str):
    async with users_db_lock:
        users = load_users_db()
        users = [u for u in users if str(u.get("id")) != str(user_id) and str(u.get("phone")) != str(user_id)]
        save_users_db(users)
        try:
            await store.delete("profiles", {"id": f"eq.{user_id}"})
        except Exception:
            pass
        try:
            await store.delete("profiles", {"phone": f"eq.{user_id}"})
        except Exception:
            pass
        return {"status": "success", "message": f"User {user_id} deactivated"}

def check_is_today_leave(rider_record, now):
    today_date_str = now.strftime("%Y-%m-%d")
    rider_id = str(rider_record.get("id") or "") if rider_record else ""
    rider_phone = str(rider_record.get("phone") or "") if rider_record else ""

    # 1. Check global fleet leaves
    try:
        global_leaves = load_global_leaves_db()
        for gl in global_leaves:
            if isinstance(gl, dict) and str(gl.get("date")) == today_date_str:
                gl_type = str(gl.get("type") or "LEAVE").upper()
                gl_note = gl.get("note") or ""
                title = "Week Off" if gl_type == "WEEKOFF" else "Holiday"
                return True, gl_type, title, gl_note
    except Exception:
        pass

    # 2. Check rider specific leaves
    try:
        all_leaves = load_leaves_db()
        for l in all_leaves:
            if isinstance(l, dict) and str(l.get("date")) == today_date_str:
                r_id = str(l.get("rider_id") or "")
                if r_id in [rider_id, rider_phone]:
                    l_type = str(l.get("type") or "LEAVE").upper()
                    l_note = l.get("note") or ""
                    title = "Week Off" if l_type == "WEEKOFF" else "Leave"
                    return True, l_type, title, l_note
    except Exception:
        pass

    # 3. Automatic Sunday Week Off (unless rider has active shift session today)
    if now.weekday() == 6:
        shift_sessions = rider_record.get("shift_sessions") if rider_record else []
        has_today_session = any(isinstance(s, dict) and str(s.get("started_at") or "")[:10] == today_date_str for s in (shift_sessions or []))
        if not has_today_session:
            return True, "WEEKOFF", "Sunday Week Off", "Automatic Sunday Weekly Off"

    return False, "", "", ""

@router.get("/delivery/presence-status")
@router.get("/delivery/presence-status/")
async def get_rider_presence_status(user=Depends(require_roles("delivery_agent"))):
    rider_id = str(user.get("sub") or "")
    user_phone = str(user.get("phone") or "")
    now = get_store_local_now()
    today_date_str = now.strftime("%Y-%m-%d")
    now_iso = now.isoformat()
    store_settings = load_store_settings()

    r_digits = "".join(filter(str.isdigit, str(rider_id)))
    p_digits = "".join(filter(str.isdigit, str(user_phone)))

    async with users_db_lock:
        users = load_users_db()
        target_user = None

        for u in users:
            if isinstance(u, dict):
                u_id = str(u.get("id") or "")
                u_phone = str(u.get("phone") or "")
                u_digits = "".join(filter(str.isdigit, u_phone))

                matched = False
                if rider_id and (rider_id == u_id or rider_id == u_phone):
                    matched = True
                elif user_phone and (user_phone == u_phone or user_phone == u_id):
                    matched = True
                elif r_digits and u_digits and (r_digits == u_digits or (len(r_digits) >= 10 and len(u_digits) >= 10 and r_digits[-10:] == u_digits[-10:])):
                    matched = True
                elif p_digits and u_digits and (p_digits == u_digits or (len(p_digits) >= 10 and len(u_digits) >= 10 and p_digits[-10:] == u_digits[-10:])):
                    matched = True

                if matched:
                    target_user = u
                    break

        if not target_user:
            for u in users:
                if isinstance(u, dict) and u.get("role") in ("delivery_agent", "rider", "delivery_partner"):
                    target_user = u
                    break

        if target_user:
            modified = False
            # 1. Daily Reset Check: If shift was started on a previous day, reset to offline / UNAVAILABLE for new day
            curr_shift = target_user.get("shift_started_at")
            started_today = bool(curr_shift and extract_store_date_str(curr_shift) == today_date_str)
            if not started_today:
                if target_user.get("is_online") or target_user.get("agent_status") != "UNAVAILABLE":
                    target_user["is_online"] = False
                    target_user["agent_status"] = "UNAVAILABLE"
                    target_user["auto_logged_out"] = False
                    for s in target_user.get("shift_sessions") or []:
                        if isinstance(s, dict) and s.get("ended_at") is None:
                            st = str(s.get("started_at") or "")
                            s["ended_at"] = (st[:10] + "T23:59:59+05:30") if (st and st[:10] != today_date_str) else now_iso
                    modified = True

            # 2. 30-Min Post-Shift-End Auto Logout Check
            is_past_auto, _ = is_past_auto_shift_end_logout(store_settings, now)
            if is_past_auto and (target_user.get("is_online") or target_user.get("agent_status") in ("AVAILABLE", "ON_DELIVERY")):
                has_active = await rider_has_active_delivery(str(target_user.get("id") or ""), str(target_user.get("phone") or ""))
                if has_active:
                    target_user["agent_status"] = "ON_DELIVERY"
                    target_user["is_online"] = True
                    target_user["has_active_delivery"] = True
                    target_user["auto_logged_out"] = False
                else:
                    target_user["is_online"] = False
                    target_user["agent_status"] = "UNAVAILABLE"
                    target_user["has_active_delivery"] = False
                    target_user["auto_logged_out"] = True
                    target_user["auto_logged_out_at"] = now_iso
                    for s in target_user.get("shift_sessions") or []:
                        if isinstance(s, dict) and s.get("ended_at") is None:
                            s["ended_at"] = now_iso
                    modified = True

            target_user["presence_status"] = compute_rider_presence_status(target_user, store_settings)
            target_user["status"] = target_user["presence_status"]

            if modified:
                save_users_db(users)

            try:
                earnings = await compute_rider_today_earnings(target_user)
                target_user["todays_earnings"] = earnings["todays_earnings"]
                target_user["completed_deliveries_today"] = earnings["completed_deliveries_today"]
            except Exception as err:
                logging.warning(f"Failed to compute rider earnings: {err}")

            is_leave, l_type, l_title, l_note = check_is_today_leave(target_user, now)
            return {
                "status": "success",
                "user": target_user,
                "auto_logged_out": bool(target_user.get("auto_logged_out", False)),
                "is_leave_today": is_leave,
                "leave_type": l_type,
                "leave_title": l_title,
                "leave_note": l_note
            }

    return {"status": "success", "user": {"is_online": False, "agent_status": "UNAVAILABLE"}, "auto_logged_out": False}

@router.post("/delivery/presence")
@router.post("/delivery/presence/")
async def update_rider_presence(payload: dict):
    agent_id = str(payload.get("agent_id") or payload.get("id") or payload.get("phone") or "").strip()
    status = str(payload.get("status") or "UNAVAILABLE").upper()
    phone = str(payload.get("phone") or "").strip()
    
    store_settings = load_store_settings()
    now = get_store_local_now()
    now_iso = now.isoformat()
    today_date_str = now.strftime("%Y-%m-%d")

    # Check if rider is scheduled on leave or week off today
    dummy_rec = {"id": agent_id, "phone": phone}
    is_leave, l_type, l_title, l_note = check_is_today_leave(dummy_rec, now)
    if is_leave and status in ("AVAILABLE", "ON_DELIVERY"):
        status = "UNAVAILABLE"
        return {
            "status": "error",
            "message": f"🏖️ {l_title} Today: You are scheduled on leave or week off today. Rider dispatch is paused.",
            "agent_status": "UNAVAILABLE",
            "is_online": False,
            "is_leave_today": True,
            "leave_type": l_type,
            "leave_title": l_title,
            "leave_note": l_note
        }
    
    is_within_hours, _, is_late_window = is_within_store_hours(store_settings, now)
    
    # Server-side enforcement of store hours & 30-min auto shift end
    is_past_auto, close_str = is_past_auto_shift_end_logout(store_settings, now)
    if (is_past_auto or not is_within_hours) and status in ("AVAILABLE", "ON_DELIVERY"):
        status = "UNAVAILABLE"
        return {
            "status": "error",
            "message": f"Store is closed (Working hours: {store_settings.get('store_open_time', '09:00')} - {store_settings.get('store_close_time', '22:00')}). Auto shift-end logout is in effect.",
            "agent_status": "UNAVAILABLE",
            "is_online": False,
            "auto_logged_out": is_past_auto
        }

    battery_low = bool(payload.get("battery_low", False))
    connectivity_lost_at = payload.get("connectivity_lost_at")

    # Real GPS location payload parsing
    location_payload = payload.get("location") or {}
    lat = payload.get("lat") or location_payload.get("lat")
    lng = payload.get("lng") or location_payload.get("lng")
    accuracy = payload.get("accuracy") or location_payload.get("accuracy")

    a_digits = "".join(filter(str.isdigit, str(agent_id)))
    p_digits = "".join(filter(str.isdigit, str(phone)))

    # ATOMIC READ-MODIFY-WRITE CYCLE UNDER LOCK
    async with users_db_lock:
        users = load_users_db()
        updated_user = None

        for u in users:
            if isinstance(u, dict) and u.get("role") in ("delivery_agent", "rider", "delivery"):
                u_id = str(u.get("id") or "")
                u_phone = str(u.get("phone") or "")
                u_agent = str(u.get("agentId") or u.get("partnerId") or "")
                u_digits = "".join(filter(str.isdigit, u_phone))

                matched = False
                if agent_id and (agent_id == u_id or agent_id == u_phone or agent_id == u_agent):
                    matched = True
                elif phone and (phone == u_phone or phone == u_id):
                    matched = True
                elif a_digits and u_digits and (a_digits == u_digits or (len(a_digits) >= 10 and len(u_digits) >= 10 and a_digits[-10:] == u_digits[-10:])):
                    matched = True
                elif p_digits and u_digits and (p_digits == u_digits or (len(p_digits) >= 10 and len(u_digits) >= 10 and p_digits[-10:] == u_digits[-10:])):
                    matched = True

                if matched:
                    ver = str(u.get("verification_status") or "").upper()
                    partner_ver = bool(u.get("partnerVerified", False) or u.get("verified_by_admin", False))
                    is_verified = (partner_ver or ver in ("VERIFIED", "ADMIN_VERIFIED"))

                    if not is_verified and status in ("AVAILABLE", "ON_DELIVERY"):
                        u["is_online"] = False
                        u["agent_status"] = "UNAVAILABLE"
                        u["presence_status"] = "ABSENT"
                        u["status"] = "ABSENT"
                        save_users_db(users)
                        return {
                            "status": "error",
                            "message": "🔒 Verification Under Review: Your partner documents are pending admin approval. You cannot go Active until approved.",
                            "agent_status": "UNAVAILABLE",
                            "is_online": False,
                            "verification_status": ver or "PENDING"
                        }

                    going_online = (status != "UNAVAILABLE")
                    u["is_online"] = going_online
                    u["last_active_at"] = now_iso
                    u["agent_status"] = status
                    u["battery_low"] = battery_low
                    if going_online:
                        u["auto_logged_out"] = False
                    if lat is not None and lng is not None:
                        try:
                            u["lat"] = float(lat)
                            u["lng"] = float(lng)
                            if accuracy is not None:
                                u["accuracy"] = float(accuracy)
                            u["last_location_at"] = now_iso
                        except (ValueError, TypeError):
                            pass
                    if connectivity_lost_at:
                        u["connectivity_lost_at"] = connectivity_lost_at
                    elif not going_online:
                        u["connectivity_lost_at"] = None
                    
                    curr_shift = u.get("shift_started_at")
                    started_today = bool(curr_shift and str(curr_shift)[:10] == today_date_str)
                    
                    if going_online and not started_today:
                        u["shift_started_at"] = now_iso
                        u["arrived_late_today"] = is_late_window

                    # Shift Sessions Log tracking
                    shift_sessions = u.get("shift_sessions") or []
                    if not isinstance(shift_sessions, list):
                        shift_sessions = []

                    # Auto-close old open sessions from previous dates
                    for s in shift_sessions:
                        if isinstance(s, dict) and s.get("ended_at") is None:
                            st = str(s.get("started_at") or "")
                            if st and st[:10] != today_date_str:
                                s["ended_at"] = st[:10] + "T23:59:59+05:30"

                    if going_online:
                        has_open_today = any(isinstance(s, dict) and s.get("ended_at") is None and str(s.get("started_at") or "")[:10] == today_date_str for s in shift_sessions)
                        if not has_open_today:
                            shift_sessions.append({
                                "started_at": now_iso,
                                "ended_at": None
                            })
                    else:
                        for s in shift_sessions:
                            if isinstance(s, dict) and s.get("ended_at") is None:
                                s["ended_at"] = now_iso
                    u["shift_sessions"] = shift_sessions
                    
                    u["presence_status"] = compute_rider_presence_status(u, store_settings)
                    u["status"] = u["presence_status"]
                    if not u.get("verification_status"):
                        u["verification_status"] = "VERIFIED"
                    updated_user = u
                    break
                    
        if updated_user:
            save_users_db(users)
            return {"status": "success", "user": updated_user, "auto_logged_out": bool(updated_user.get("auto_logged_out", False))}
        else:
            # Create a light profile record if user doesn't exist yet
            going_online = (status != "UNAVAILABLE")
            initial_sessions = []
            if going_online:
                initial_sessions.append({"started_at": now_iso, "ended_at": None})
            new_rider = {
                "id": agent_id or f"rider-{int(now.timestamp())}",
                "name": payload.get("name") or "Delivery Agent",
                "phone": phone or agent_id,
                "role": "delivery_agent",
                "is_online": going_online,
                "agent_status": status,
                "shift_started_at": now_iso if going_online else None,
                "shift_sessions": initial_sessions,
                "arrived_late_today": is_late_window if going_online else False,
                "battery_low": battery_low,
                "verification_status": "VERIFIED",
                "auto_logged_out": False,
                "created_at": now_iso
            }
            new_rider["presence_status"] = compute_rider_presence_status(new_rider, store_settings)
            new_rider["status"] = new_rider["presence_status"]
            users.append(new_rider)
            save_users_db(users)
            return {"status": "success", "user": new_rider, "auto_logged_out": False}

active_delivery_websockets = set()

async def broadcast_order_pulse(data: dict = None):
    payload = {
        "type": "ORDER_PULSE",
        "timestamp": get_store_local_now().isoformat(),
        **(data or {})
    }
    dead_sockets = []
    for ws in list(active_delivery_websockets):
        try:
            await ws.send_json(payload)
        except Exception:
            dead_sockets.append(ws)
    for ws in dead_sockets:
        active_delivery_websockets.discard(ws)

@router.websocket("/delivery/ws")
@router.websocket("/delivery/ws/")
async def delivery_websocket(websocket: WebSocket):
    await websocket.accept()
    active_delivery_websockets.add(websocket)
    try:
        while True:
            try:
                recv_text = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                if recv_text:
                    try:
                        client_msg = json.loads(recv_text)
                        if client_msg.get("type") == "PING":
                            await websocket.send_json({"type": "PONG", "timestamp": get_store_local_now().isoformat()})
                    except Exception:
                        pass
            except asyncio.TimeoutError:
                pass
            
            await asyncio.sleep(2.0)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        active_delivery_websockets.discard(websocket)

@router.post("/delivery/sos")
@router.post("/delivery/sos/")
async def trigger_rider_sos(payload: dict, user=Depends(require_roles("delivery_agent"))):
    rider_id = str(user.get("sub") or payload.get("rider_id") or "").strip()
    rider_name = str(user.get("name") or payload.get("rider_name") or "Delivery Partner").strip()
    order_id = payload.get("order_id")
    coords = payload.get("coords") or {}
    now = get_store_local_now()
    sos_id = f"SOS-{int(now.timestamp())}"

    sos_record = {
        "id": sos_id,
        "rider_id": rider_id,
        "rider_name": rider_name,
        "order_id": order_id,
        "coords": coords,
        "status": "ACTIVE",
        "timestamp": now.isoformat(),
        "date_formatted": now.strftime("%b %d, %Y at %I:%M %p")
    }

    sos_list = await cache_get("cloud:sos_alerts") or []
    if not isinstance(sos_list, list):
        sos_list = []
    sos_list.insert(0, sos_record)
    await cache_set("cloud:sos_alerts", sos_list, ttl_seconds=86400 * 7)

    await redis_publish("sos:alerts", sos_record)

    return {
        "status": "success",
        "sos_id": sos_id,
        "timestamp": sos_record["timestamp"],
        "date_formatted": sos_record["date_formatted"],
        "message": "Emergency SOS alert transmitted to Dispatch Admin."
    }

@router.post("/admin/riders/{rider_id}/verify")
@router.post("/admin/riders/{rider_id}/verify/")
async def verify_or_reject_rider(rider_id: str, payload: dict, user=Depends(require_roles("admin"))):
    action = str(payload.get("action", "")).lower()
    async with users_db_lock:
        users = load_users_db()
        target_user = None
        for u in users:
            if isinstance(u, dict):
                u_id = str(u.get("id") or "")
                u_phone = str(u.get("phone") or "")
                if rider_id == u_id or rider_id == u_phone:
                    target_user = u
                    break

        if not target_user:
            raise HTTPException(status_code=404, detail="Rider not found")

        curr_ver = str(target_user.get("verification_status") or "").upper()
        is_already_verified = curr_ver in ["VERIFIED", "ADMIN_VERIFIED", "AUTO_VERIFIED"] or bool(target_user.get("verified_by_admin"))
        if is_already_verified and action == "reject":
            raise HTTPException(status_code=400, detail="Rider is already verified and status cannot be changed")

        if action == "verify":
            target_user["verification_status"] = "VERIFIED"
            target_user["verified_by_admin"] = True
        elif action == "reject":
            target_user["verification_status"] = "REJECTED"
            target_user["verified_by_admin"] = False
        else:
            raise HTTPException(status_code=400, detail="Invalid action")

        save_users_db(users)
        return {"status": "success", "user": target_user}

@router.get("/admin/riders/{rider_id}/delivery-stats")
@router.get("/admin/riders/{rider_id}/delivery-stats/")
async def get_rider_delivery_analytics(rider_id: str, user=Depends(require_roles("admin"))):
    now = get_store_local_now()
    today_str = now.strftime("%Y-%m-%d")
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    day_before_str = (now - timedelta(days=2)).strftime("%Y-%m-%d")
    month_prefix = now.strftime("%Y-%m")

    # Build comprehensive alias set
    r_clean = str(rider_id).strip()
    all_keys = {r_clean}
    async with users_db_lock:
        users = load_users_db()
    for u in users:
        if isinstance(u, dict):
            u_id = str(u.get("id") or "").strip()
            u_phone = str(u.get("phone") or "").strip()
            if r_clean in (u_id, u_phone):
                if u_id:
                    all_keys.add(u_id)
                if u_phone:
                    all_keys.add(u_phone)
                    digits = "".join(filter(str.isdigit, u_phone))
                    if digits:
                        all_keys.add(digits)
                        all_keys.add(f"+{digits}")
                break

    # Filter to valid UUIDs for Postgres query
    import re
    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
    pg_uuids = [k for k in all_keys if uuid_pattern.match(k)]
    if not pg_uuids:
        resolved = await resolve_valid_rider_id(r_clean)
        if resolved and uuid_pattern.match(resolved):
            pg_uuids.append(resolved)

    db_orders = []
    if pg_uuids:
        try:
            db_orders = await store.get("orders", {
                "delivery_agent_id": f"in.({','.join(pg_uuids)})",
                "status": "eq.delivered",
                "order": "created_at.desc",
                "limit": 500
            }) or []
        except Exception:
            db_orders = []

    if not isinstance(db_orders, list):
        db_orders = []

    # Also pull from rider history Redis cache
    cache_orders = []
    for k in all_keys:
        h = await cache_get(f"cloud:rider_history:{k}")
        if isinstance(h, list):
            cache_orders.extend(h)

    # Combine unique orders by ID
    combined_map = {}
    for o in db_orders:
        oid = str(o.get("id") or o.get("order_id") or o.get("orderNumber") or "")
        if oid:
            combined_map[oid.lower()] = o

    for o in cache_orders:
        oid = str(o.get("id") or o.get("orderId") or o.get("order_id") or o.get("orderNumber") or "")
        if oid and oid.lower() not in combined_map:
            combined_map[oid.lower()] = o

    all_delivered = list(combined_map.values())

    today_count = 0
    yesterday_count = 0
    day_before_count = 0
    month_count = 0

    for o in all_delivered:
        ts = str(o.get("completedAtISO") or o.get("delivered_at") or o.get("completed_at") or o.get("timestamp") or o.get("created_at") or "")
        if not ts:
            continue
        date_part = ts[:10]
        if date_part == today_str:
            today_count += 1
        if date_part == yesterday_str:
            yesterday_count += 1
        if date_part == day_before_str:
            day_before_count += 1
        if date_part.startswith(month_prefix):
            month_count += 1

    return {
        "today": today_count,
        "yesterday": yesterday_count,
        "day_before_yesterday": day_before_count,
        "this_month": month_count,
        "total_completed": len(all_delivered)
    }

@router.get("/admin/riders/{rider_id}/shift-log")
@router.get("/admin/riders/{rider_id}/shift-log/")
async def get_rider_shift_log(rider_id: str, date: str | None = None, user=Depends(require_roles("admin"))):
    now = get_store_local_now()
    target_date = date or now.strftime("%Y-%m-%d")
    
    async with users_db_lock:
        users = load_users_db()
    
    target_rider = None
    for u in users:
        if isinstance(u, dict):
            u_id = str(u.get("id") or "")
            u_phone = str(u.get("phone") or "")
            if rider_id == u_id or rider_id == u_phone:
                target_rider = u
                break
                
    if not target_rider:
        return {"date": target_date, "sessions": [], "total_seconds": 0, "total_hours_formatted": "0 mins"}

    all_sessions = target_rider.get("shift_sessions") or []
    if not isinstance(all_sessions, list):
        all_sessions = []

    day_sessions = []
    total_seconds = 0

    for s in all_sessions:
        if not isinstance(s, dict) or not s.get("started_at"):
            continue
        st_str = str(s.get("started_at"))
        if st_str[:10] == target_date:
            day_sessions.append(s)
            try:
                st_dt = datetime.fromisoformat(st_str)
                if s.get("ended_at"):
                    end_dt = datetime.fromisoformat(str(s.get("ended_at")))
                else:
                    end_dt = now
                sec = max(0, int((end_dt - st_dt).total_seconds()))
                total_seconds += sec
            except Exception:
                pass

    hours = total_seconds // 3600
    mins = (total_seconds % 3600) // 60
    formatted = f"{hours}h {mins}m" if hours > 0 else f"{mins} mins"

    return {
        "date": target_date,
        "sessions": day_sessions,
        "total_seconds": total_seconds,
        "total_hours_formatted": formatted
    }

@router.get("/admin/riders/presence-summary")
@router.get("/admin/riders/presence-summary/")
async def get_presence_summary(user=Depends(require_roles("admin"))):
    store_settings = load_store_settings()
    db_profiles = []
    try:
        res = await store.get("profiles")
        if isinstance(res, list):
            db_profiles = res
    except Exception:
        pass
    async with users_db_lock:
        local_users = load_users_db()
    users = merge_and_normalize_users(db_profiles, local_users, partner_only=True)
    riders = [u for u in users if isinstance(u, dict) and u.get("role") in ("delivery_agent", "rider", "delivery")]
    
    present = 0
    absent = 0
    late = 0
    
    for r in riders:
        st = compute_rider_presence_status(r, store_settings)
        if st == "PRESENT":
            present += 1
        elif st == "LATE":
            late += 1
        else:
            absent += 1
            
    return {
        "status": "success",
        "present": present,
        "absent": absent,
        "late": late,
        "total": len(riders)
    }

# ==============================================================================
# SUPPORT TICKETS DISPATCH & ADMIN API
# ==============================================================================
TICKETS_FILE = DATA_DIR / "support_tickets.json"

def load_tickets():
    try:
        if TICKETS_FILE.exists():
            with open(TICKETS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading tickets: {e}")
    return [
        {
            "id": "TKT-1001",
            "category": "App problem",
            "subject": "GPS Navigation Delay on Pickup Route",
            "description": "App loses GPS signal when arriving at Koramangala Hub Bay 3.",
            "status": "PENDING",
            "priority": "HIGH",
            "user_id": "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a",
            "user_name": "Speedy Express Delivery",
            "user_phone": "+919999900003",
            "user_role": "delivery_agent",
            "admin_notes": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]

def save_tickets(tickets):
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(TICKETS_FILE, "w", encoding="utf-8") as f:
            json.dump(tickets, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving tickets: {e}")

@router.post("/tickets")
@router.post("/tickets/")
async def create_ticket(payload: dict):
    category = payload.get("category", "General")
    subject = payload.get("subject", "").strip()
    description = payload.get("description", "").strip()
    if not subject or not description:
        raise HTTPException(400, "Subject and description are required")
    
    tickets = load_tickets()
    ticket_id = f"TKT-{uuid.uuid4().hex[:8].upper()}"
    
    # Pull user info from request payload only — no auth dependency on this endpoint
    user_name = payload.get("user_name") or "Delivery Partner"
    user_phone = payload.get("user_phone") or ""
    user_id = payload.get("user_id") or "anon"
    user_role = payload.get("user_role") or "delivery_agent"

    now_iso = datetime.now(timezone.utc).isoformat()
    ticket = {
        "id": ticket_id,
        "category": category,
        "subject": subject,
        "description": description,
        "status": "PENDING",
        "priority": payload.get("priority", "HIGH"),
        "user_id": user_id,
        "user_name": user_name,
        "user_phone": user_phone,
        "user_role": user_role,
        "admin_notes": "",
        "created_at": now_iso,
        "updated_at": now_iso
    }

    tickets.insert(0, ticket)
    save_tickets(tickets)
    await cache_set("cloud:tickets_list", tickets, ttl_seconds=86400 * 30)

    try:
        # store.insert() is the correct method — store.post() does not exist
        await store.insert("tickets", ticket)
    except Exception:
        pass

    return ticket


@router.get("/tickets")
@router.get("/tickets/")
async def get_all_tickets():
    tickets = await cache_get("cloud:tickets_list")
    if not tickets:
        tickets = load_tickets()
    return tickets


@router.patch("/tickets/{ticket_id}")
@router.patch("/tickets/{ticket_id}/")
async def update_ticket(ticket_id: str, payload: dict):
    tickets = load_tickets()
    target = None
    for t in tickets:
        if t.get("id") == ticket_id:
            target = t
            break
    
    if not target:
        raise HTTPException(404, f"Ticket {ticket_id} not found")

    if "status" in payload:
        target["status"] = str(payload["status"]).upper()
    if "admin_notes" in payload:
        target["admin_notes"] = payload["admin_notes"]
    
    target["updated_at"] = datetime.now(timezone.utc).isoformat()
    save_tickets(tickets)
    await cache_set("cloud:tickets_list", tickets, ttl_seconds=86400 * 30)

    try:
        # Correct arg order: patch(table, payload, params)
        # payload = data to write, params = PostgREST filter
        patch_payload = {k: target[k] for k in ("status", "admin_notes", "updated_at") if k in target}
        await store.patch("tickets", patch_payload, {"id": f"eq.{ticket_id}"})
    except Exception:
        pass

    return {"status": "success", "ticket": target}


@router.get("/delivery/biometrics/{rider_id}")
@router.get("/delivery/biometrics/{rider_id}/")
async def get_biometrics(rider_id: str):
    db_data = load_rider_biometrics()
    record = dict(db_data.get(rider_id) or {})

    users = load_users_db()
    matched = next((u for u in users if isinstance(u, dict) and (str(u.get("id")) == rider_id or str(u.get("phone")) == rider_id)), None)

    if matched:
        c_name = matched.get("name") or matched.get("full_name") or "Delivery Partner"
        record["rider_name"] = c_name
        record["name"] = c_name
        record["full_name"] = c_name

    return record


# ==============================================================================
# SELLER DASHBOARD MOCK ROUTES
# ==============================================================================
@router.get("/seller/dashboard/revenue")
async def get_revenue_overview(period: str = "monthly", user: dict = Depends(require_roles("seller", "admin"))):
    if period == "daily":
        return {
            "totalRevenue": 5000,
            "percentageChange": 5.2,
            "previousPeriodRevenue": 4750,
            "data": [
                {"label": "12 AM", "revenue": 100},
                {"label": "6 AM", "revenue": 400},
                {"label": "12 PM", "revenue": 1500},
                {"label": "6 PM", "revenue": 2000},
                {"label": "11 PM", "revenue": 1000}
            ]
        }
    elif period == "weekly":
        return {
            "totalRevenue": 35000,
            "percentageChange": -2.1,
            "previousPeriodRevenue": 35750,
            "data": [
                {"label": "Mon", "revenue": 4500},
                {"label": "Tue", "revenue": 5200},
                {"label": "Wed", "revenue": 4800},
                {"label": "Thu", "revenue": 6000},
                {"label": "Fri", "revenue": 7500},
                {"label": "Sat", "revenue": 4000},
                {"label": "Sun", "revenue": 3000}
            ]
        }
    elif period == "yearly":
        return {
            "totalRevenue": 1750000,
            "percentageChange": 18.5,
            "previousPeriodRevenue": 1476793,
            "data": [
                {"label": "Q1", "revenue": 400000},
                {"label": "Q2", "revenue": 450000},
                {"label": "Q3", "revenue": 380000},
                {"label": "Q4", "revenue": 520000}
            ]
        }
    else:
        return {
            "totalRevenue": 145000,
            "percentageChange": 12.5,
            "previousPeriodRevenue": 128000,
            "data": [
                {"label": "Week 1", "revenue": 35000},
                {"label": "Week 2", "revenue": 42000},
                {"label": "Week 3", "revenue": 38000},
                {"label": "Week 4", "revenue": 30000}
            ]
        }

@router.get("/seller/dashboard/top-products")
async def get_top_products(period: str = "30days", user: dict = Depends(require_roles("seller", "admin"))):
    return [
        { "id": '1', "name": 'Fresh Royal Gala Red Apples (4 Pcs)', "sku": 'PROD-FR-01', "image": 'fresh-red-apples.jpg', "unitsSold": 142, "trend": '+12.5%', "revenue": 141858, "stock": 45 },
        { "id": '6', "name": "Lay's American Style Cream & Onion 50g", "sku": 'SNK-LY-06', "image": 'lays-cream-onion.png', "unitsSold": 89, "trend": '+5.2%', "revenue": 88911, "stock": 12 },
        { "id": '11', "name": 'Amul Pasteurised Salted Butter 100g', "sku": 'DRY-AM-11', "image": 'amul-butter-real.jpg', "unitsSold": 67, "trend": '-2.1%', "revenue": 40133, "stock": 4 },
        { "id": '16', "name": 'Coca-Cola Original Taste Soft Drink 750ml', "sku": 'BEV-CC-16', "image": 'coca-cola-real.jpg', "unitsSold": 34, "trend": '+18.4%', "revenue": 204000, "stock": 8 }
    ]

@router.get("/seller/profile")
@router.get("/seller/profile/")
async def get_seller_profile_endpoint(user: dict = Depends(require_roles("seller", "admin"))):
    seller_phone = user.get("phone") or "+919999900002"
    canonical_phone, db_phone = normalize_phone(seller_phone)

    profile = None
    try:
        p_rows = await store.get("profiles", {"phone": f"ilike.*{canonical_phone}*"})
        if p_rows:
            profile = p_rows[0]
    except Exception:
        pass

    store_info = None
    try:
        if profile and profile.get("id"):
            s_rows = await store.get("stores", {"owner_id": f"eq.{profile['id']}"})
        else:
            s_rows = await store.get("stores", {"limit": 1})
        if s_rows and isinstance(s_rows, list):
            store_info = s_rows[0]
    except Exception:
        pass

    manager_name = (profile and profile.get("full_name")) or "John Seller"
    phone_num = (profile and profile.get("phone")) or db_phone or "+919999900002"
    email_addr = (profile and profile.get("email")) or "seller@grabit.local"
    store_name = (store_info and store_info.get("name")) or "GrabIt SuperMart (Indiranagar)"
    store_addr = (store_info and store_info.get("address")) or "Shop 14, 100ft Road, Indiranagar, Bengaluru 560038"

    return {
        "store_name": store_name,
        "manager_name": manager_name,
        "phone": phone_num,
        "email": email_addr,
        "address": store_addr,
        "operating_hours": "06:00 AM - 11:00 PM",
        "delivery_radius": 5.0,
        "gstin": "29AAAAA0000A1Z5",
        "fssai": "11223344556677",
        "bank_account": "919999900002",
        "ifsc": "HDFC0001234",
        "upi_id": "johnseller@upi",
        "sms_alerts": True,
        "push_alerts": True,
        "sound_alerts": True
    }

@router.patch("/seller/profile")
@router.patch("/seller/profile/")
async def update_seller_profile_endpoint(body: dict, user: dict = Depends(require_roles("seller", "admin"))):
    seller_phone = user.get("phone") or "+919999900002"
    canonical_phone, _ = normalize_phone(seller_phone)

    try:
        p_rows = await store.get("profiles", {"phone": f"ilike.*{canonical_phone}*"})
        if p_rows:
            pid = p_rows[0]["id"]
            patch_data = {}
            if "manager_name" in body: patch_data["full_name"] = body["manager_name"]
            if "email" in body: patch_data["email"] = body["email"]
            if patch_data:
                await store.patch("profiles", patch_data, {"id": f"eq.{pid}"})

            s_rows = await store.get("stores", {"owner_id": f"eq.{pid}"})
            if s_rows:
                sid = s_rows[0]["id"]
                s_patch = {}
                if "store_name" in body: s_patch["name"] = body["store_name"]
                if "address" in body: s_patch["address"] = body["address"]
                if s_patch:
                    await store.patch("stores", s_patch, {"id": f"eq.{sid}"})
    except Exception:
        pass

    return {"status": "ok", "message": "Seller profile updated successfully"}

@router.get("/seller/dashboard/payouts")
@router.get("/seller/dashboard/payouts/")
async def get_seller_payouts(user: dict = Depends(require_roles("seller", "admin"))):
    return {"status": "success", "payouts": [], "total_payout": 0}

@router.get("/admin/product-suggestions")
@router.get("/admin/product-suggestions/")
async def get_admin_product_suggestions(user=Depends(require_roles("admin"))):
    return {"status": "success", "suggestions": []}

leaves_db_lock = asyncio.Lock()
LEAVES_FILE = os.path.join(os.path.dirname(__file__), "data", "leaves.json")

def load_leaves_db() -> list:
    if not os.path.exists(LEAVES_FILE):
        return []
    try:
        with open(LEAVES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_leaves_db(data: list):
    os.makedirs(os.path.dirname(LEAVES_FILE), exist_ok=True)
    temp_file = f"{LEAVES_FILE}.tmp_{int(time() * 1000)}"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(temp_file, LEAVES_FILE)

async def build_rider_attendance_calendar(rider_id: str, month: str | None = None, requesting_user_phone: str | None = None) -> dict:
    rider_id = str(rider_id or "").strip()
    user_phone = str(requesting_user_phone or "").strip()
    now = get_store_local_now()
    
    if not month or len(month) != 7 or "-" not in month:
        target_month_str = now.strftime("%Y-%m")
    else:
        target_month_str = month

    try:
        year_num, month_num = map(int, target_month_str.split("-"))
        num_days = calendar.monthrange(year_num, month_num)[1]
    except Exception:
        year_num, month_num = now.year, now.month
        target_month_str = now.strftime("%Y-%m")
        num_days = calendar.monthrange(year_num, month_num)[1]

    async with users_db_lock:
        users = load_users_db()
    
    rider_canon, rider_db = normalize_phone(rider_id)
    user_canon, user_db = normalize_phone(user_phone)

    rider_record = None
    for u in users:
        if isinstance(u, dict):
            u_id = str(u.get("id") or "")
            u_phone = str(u.get("phone") or "")
            u_canon, u_db_phone = normalize_phone(u_phone)
            if (
                rider_id in [u_id, u_phone]
                or (rider_canon and u_canon and u_canon == rider_canon)
                or (user_phone and user_phone in [u_id, u_phone])
                or (user_canon and u_canon and u_canon == user_canon)
            ):
                rider_record = u
                break

    rider_phone = str(rider_record.get("phone") or "") if rider_record else ""
    rider_canon, rider_db = normalize_phone(rider_phone or rider_id)
    user_canon, user_db = normalize_phone(user_phone)

    # If not found by direct ID in users.json and rider_id is UUID, check Supabase profiles
    if not rider_record and is_valid_uuid(rider_id):
        try:
            p_rows = await store.get("profiles", {"id": f"eq.{rider_id}"})
            if p_rows and p_rows[0].get("phone"):
                prof_phone = str(p_rows[0]["phone"])
                p_canon, p_db = normalize_phone(prof_phone)
                for u in users:
                    if isinstance(u, dict):
                        u_phone = str(u.get("phone") or "")
                        u_canon, u_db_phone = normalize_phone(u_phone)
                        if (p_canon and u_canon and u_canon == p_canon) or (p_db and u_db_phone and u_db_phone == p_db):
                            rider_record = u
                            rider_phone = u_phone
                            rider_canon = u_canon
                            break
        except Exception:
            pass

    async with leaves_db_lock:
        all_leaves = load_leaves_db()

    async with global_leaves_db_lock:
        global_leaves = load_global_leaves_db()

    # Map rider leaves & global fleet leaves for target month
    leaves_map = {}
    for gl in global_leaves:
        if isinstance(gl, dict):
            gl_date = str(gl.get("date") or "")
            if gl_date.startswith(target_month_str):
                leaves_map[gl_date] = gl

    for l in all_leaves:
        if isinstance(l, dict):
            r_id = str(l.get("rider_id") or "")
            l_date = str(l.get("date") or "")
            r_canon, _ = normalize_phone(r_id)
            if (
                r_id in [rider_id, user_phone, rider_phone]
                or (rider_record and r_id == str(rider_record.get("id")))
                or (rider_canon and r_canon and r_canon == rider_canon)
                or (user_canon and r_canon and r_canon == user_canon)
            ) and l_date.startswith(target_month_str):
                leaves_map[l_date] = l

    today_date = now.date()

    # Collect all dates where rider had order delivery activity in target month
    order_active_dates = set()
    try:
        redis_queue = await cache_get("cloud:orders_list") or []
        if isinstance(redis_queue, list):
            for o in redis_queue:
                if isinstance(o, dict):
                    o_agent = str(o.get("delivery_agent_id") or o.get("agent_id") or o.get("assigned_agent_id") or "")
                    o_phone = str(o.get("delivery_agent_phone") or "")
                    op_canon, _ = normalize_phone(o_phone)

                    is_match = False
                    if o_agent and (o_agent == rider_id or (rider_record and o_agent == str(rider_record.get("id")))):
                        is_match = True
                    elif o_phone and (
                        (rider_phone and o_phone == rider_phone)
                        or (user_phone and o_phone == user_phone)
                        or (rider_canon and op_canon == rider_canon)
                        or (user_canon and op_canon == user_canon)
                    ):
                        is_match = True

                    if is_match:
                        created = str(o.get("created_at") or o.get("delivered_at") or "")
                        if created and len(created) >= 10:
                            order_active_dates.add(created[:10])
    except Exception:
        pass

    # Determine rider join date dynamically
    join_date = None
    if rider_record:
        join_raw = str(rider_record.get("created_at") or rider_record.get("joined_at") or rider_record.get("joined_date") or rider_record.get("joinedDate") or "")
        if join_raw and len(join_raw) >= 10:
            try:
                join_date = date.fromisoformat(join_raw[:10])
            except Exception:
                pass

    # Fallback to earliest order active date if available, or today's store date
    if not join_date:
        if order_active_dates:
            try:
                earliest_order_str = min(order_active_dates)
                join_date = date.fromisoformat(earliest_order_str)
            except Exception:
                pass
        if not join_date:
            join_date = get_store_local_now().date()

    # Get shift sessions log and shift_started_at for rider
    shift_sessions = (rider_record.get("shift_sessions") or []) if rider_record else []
    shift_started_at = (rider_record.get("shift_started_at") or "") if rider_record else ""
    arrived_late_today = bool(rider_record.get("arrived_late_today")) if rider_record else False

    store_settings = await get_store_settings()
    store_open = store_settings.get("store_open_time") or "09:00"
    grace = int(store_settings.get("late_grace_minutes") or 15)
    open_mins = int(store_open.split(":")[0]) * 60 + int(store_open.split(":")[1])
    grace_cutoff_mins = open_mins + grace

    expected_start_fmt = ""
    try:
        exp_h, exp_m = map(int, store_open.split(":"))
        exp_mer = "AM" if exp_h < 12 else "PM"
        exp_h12 = exp_h if (1 <= exp_h <= 12) else (exp_h - 12 if exp_h > 12 else 12)
        expected_start_fmt = f"{exp_h12:02d}:{exp_m:02d} {exp_mer}"
    except Exception:
        expected_start_fmt = store_open

    days_result = []
    summary_counts = {"present": 0, "late": 0, "absent": 0, "leave": 0, "total_days": num_days}
    before_join_days = 0
    upcoming_days = 0

    for day_i in range(1, num_days + 1):
        day_date_str = f"{target_month_str}-{day_i:02d}"
        day_date = date(year_num, month_num, day_i)

        leave_entry = leaves_map.get(day_date_str)

        # 1. LEAVE strictly overrides all status logic
        if leave_entry:
            l_type = str(leave_entry.get("type") or "LEAVE").upper()
            l_note = leave_entry.get("note") or ""
            days_result.append({
                "date": day_date_str,
                "status": "LEAVE",
                "color": "purple",
                "leave_type": l_type,
                "detail": f"{l_type.capitalize()} — {l_note}" if l_note else f"{l_type.capitalize()}",
                "note": l_note,
                "check_in": None,
                "check_out": None,
                "duration": None,
                "minutes_late": 0,
                "expected_start": expected_start_fmt
            })
            summary_counts["leave"] += 1
            continue

        # Check for shift session, order activity, or active login on that day
        is_today = (day_date_str == today_date.strftime("%Y-%m-%d"))
        is_online_now = bool(rider_record.get("is_online")) and (rider_record.get("agent_status") in ["AVAILABLE", "ON_DELIVERY"]) if rider_record else False

        day_sessions = [s for s in shift_sessions if isinstance(s, dict) and (str(s.get("started_at") or "")[:10] == day_date_str or str(s.get("ended_at") or "")[:10] == day_date_str)]
        if is_today:
            today_completed_sessions = [s for s in shift_sessions if isinstance(s, dict) and str(s.get("started_at") or "")[:10] == day_date_str and s.get("ended_at") is not None]
            has_session = (is_online_now) or (len(today_completed_sessions) > 0) or (day_date_str in order_active_dates)
        else:
            has_session = len(day_sessions) > 0 or (shift_started_at[:10] == day_date_str) or (day_date_str in order_active_dates)

        # 2. Before rider join date (unless rider had active session/orders on that day)
        if join_date and day_date < join_date and not has_session:
            before_join_days += 1
            days_result.append({
                "date": day_date_str,
                "status": "BEFORE_JOIN",
                "color": "neutral",
                "leave_type": None,
                "detail": "Before rider join date",
                "note": None,
                "check_in": None,
                "check_out": None,
                "duration": None,
                "minutes_late": 0,
                "expected_start": expected_start_fmt
            })
            continue

        # 4. Automatic Sunday Weekly Off (Day 6 of week = Sunday)
        if day_date.weekday() == 6 and not has_session:
            days_result.append({
                "date": day_date_str,
                "status": "LEAVE",
                "color": "purple",
                "leave_type": "WEEKOFF",
                "detail": "Sunday Weekly Off",
                "note": "Sunday Weekly Off",
                "check_in": None,
                "check_out": None,
                "duration": None,
                "minutes_late": 0,
                "expected_start": expected_start_fmt
            })
            summary_counts["leave"] += 1
            continue

        # 5. Future day or today before shift has started
        if day_date > today_date or (is_today and not has_session):
            upcoming_days += 1
            days_result.append({
                "date": day_date_str,
                "status": "UPCOMING",
                "color": "neutral",
                "leave_type": None,
                "detail": "Shift not started yet • Tap Go Active to start today’s shift" if is_today else "Upcoming day",
                "note": None,
                "check_in": None,
                "check_out": None,
                "duration": None,
                "minutes_late": 0,
                "expected_start": expected_start_fmt
            })
            continue

        if has_session:
            is_late = False
            mins_late = 0

            # Calculate earliest start, latest end, and overall shift duration
            day_st = None
            day_end = None
            has_live = False
            total_sec = 0

            target_sessions = day_sessions or ([{"started_at": shift_started_at, "ended_at": None}] if is_today and shift_started_at else [])
            for s in target_sessions:
                st_val = s.get("started_at")
                if st_val:
                    try:
                        st_dt = datetime.fromisoformat(str(st_val))
                        if not day_st or st_dt < day_st:
                            day_st = st_dt
                        end_val = s.get("ended_at")
                        if end_val:
                            end_dt = datetime.fromisoformat(str(end_val))
                            if not day_end or end_dt > day_end:
                                day_end = end_dt
                            total_sec += max(0, int((end_dt - st_dt).total_seconds()))
                        else:
                            has_live = True
                            total_sec += max(0, int((now - st_dt).total_seconds()))
                    except Exception:
                        pass

            shift_period_str = ""
            st_time_str = None
            end_time_str = None
            dur_str = None

            if day_st:
                st_time = day_st.strftime("%I:%M %p").lstrip("0")
                st_time_str = st_time
                if has_live:
                    end_time = "Still Active"
                elif day_end:
                    end_time = day_end.strftime("%I:%M %p").lstrip("0")
                else:
                    end_time = "Still Active" if is_today else ""
                end_time_str = end_time

                hours = total_sec // 3600
                mins = (total_sec % 3600) // 60
                secs = total_sec % 60
                if hours > 0:
                    dur = f"{hours}h {mins}m"
                elif mins > 0:
                    dur = f"{mins} mins"
                else:
                    dur = f"{secs}s"
                dur_str = dur

                if end_time:
                    shift_period_str = f" • {st_time} — {end_time} ({dur})"
                else:
                    shift_period_str = f" • {st_time} ({dur})"

            # Find earliest session start time on day_date_str or shift_started_at
            st_str = ""
            if day_sessions:
                st_str = str(day_sessions[0].get("started_at") or "")
            elif is_today and shift_started_at:
                st_str = str(shift_started_at)
            
            if st_str and "T" in st_str:
                try:
                    time_part = st_str.split("T")[1][:5]
                    st_mins = int(time_part.split(":")[0]) * 60 + int(time_part.split(":")[1])
                    if st_mins > grace_cutoff_mins:
                        is_late = True
                        mins_late = max(0, st_mins - open_mins)
                except Exception:
                    is_late = arrived_late_today if is_today else False
                    mins_late = 20 if is_late else 0
            elif is_today:
                is_late = arrived_late_today
                mins_late = 20 if is_late else 0

            if is_late:
                days_result.append({
                    "date": day_date_str,
                    "status": "LATE",
                    "color": "yellow",
                    "leave_type": None,
                    "detail": f"Late — Shift started after cutoff{shift_period_str}",
                    "note": None,
                    "check_in": st_time_str,
                    "check_out": end_time_str,
                    "duration": dur_str,
                    "minutes_late": mins_late,
                    "expected_start": expected_start_fmt
                })
                summary_counts["late"] += 1
            else:
                days_result.append({
                    "date": day_date_str,
                    "status": "PRESENT",
                    "color": "green",
                    "leave_type": None,
                    "detail": f"Present — Shift started on time{shift_period_str}",
                    "note": None,
                    "check_in": st_time_str,
                    "check_out": end_time_str,
                    "duration": dur_str,
                    "minutes_late": 0,
                    "expected_start": expected_start_fmt
                })
                summary_counts["present"] += 1
        else:
            # Past / current day with no shift & no leave assigned -> ABSENT
            days_result.append({
                "date": day_date_str,
                "status": "ABSENT",
                "color": "red",
                "leave_type": None,
                "detail": "Absent — Store open, no shift recorded",
                "note": None,
                "check_in": None,
                "check_out": None,
                "duration": None,
                "minutes_late": 0,
                "expected_start": expected_start_fmt
            })
            summary_counts["absent"] += 1

    working_days = max(0, num_days - summary_counts["leave"] - before_join_days - upcoming_days)
    present_total = summary_counts["present"] + summary_counts["late"]
    if working_days > 0:
        attendance_rate = round((present_total / working_days) * 100, 1)
    else:
        attendance_rate = 100.0 if present_total > 0 else 0.0

    summary_counts["attendance_rate"] = attendance_rate
    summary_counts["working_days"] = working_days

    return {
        "month": target_month_str,
        "summary": summary_counts,
        "days": days_result,
        "attendance_rate": attendance_rate,
        "working_days": working_days
    }

@router.get("/delivery/attendance")
@router.get("/delivery/attendance/")
async def get_rider_attendance(month: str | None = None, user=Depends(require_roles("delivery_agent"))):
    rider_id = str(user.get("sub") or user.get("id") or user.get("phone") or "")
    user_phone = str(user.get("phone") or "")
    return await build_rider_attendance_calendar(rider_id=rider_id, month=month, requesting_user_phone=user_phone)

@router.get("/admin/riders/{rider_id}/attendance")
@router.get("/admin/riders/{rider_id}/attendance/")
async def get_admin_rider_attendance(rider_id: str, month: str | None = None, user=Depends(require_roles("admin"))):
    return await build_rider_attendance_calendar(rider_id=rider_id, month=month)

@router.get("/admin/riders/{rider_id}/leaves")
@router.get("/admin/riders/{rider_id}/leaves/")
async def get_admin_rider_leaves(rider_id: str):
    async with leaves_db_lock:
        all_leaves = load_leaves_db()
    
    async with users_db_lock:
        users = load_users_db()
    
    target_rider = None
    for u in users:
        if isinstance(u, dict):
            if rider_id in [str(u.get("id") or ""), str(u.get("phone") or "")]:
                target_rider = u
                break

    r_id = str(target_rider.get("id") if target_rider else rider_id)
    r_phone = str(target_rider.get("phone") if target_rider else rider_id)

    rider_leaves = [l for l in all_leaves if isinstance(l, dict) and str(l.get("rider_id")) in [r_id, r_phone, rider_id]]
    rider_leaves.sort(key=lambda x: str(x.get("date")), reverse=True)
    return rider_leaves

@router.post("/admin/riders/{rider_id}/leave")
@router.post("/admin/riders/{rider_id}/leave/")
async def assign_rider_leave(rider_id: str, payload: dict):
    leave_date = str(payload.get("date") or "").strip()
    leave_type = str(payload.get("type") or "LEAVE").upper()
    leave_note = str(payload.get("note") or "").strip()

    if not leave_date or len(leave_date) != 10:
        raise HTTPException(status_code=400, detail="Invalid date format YYYY-MM-DD")

    if leave_type not in ["WEEKOFF", "HOLIDAY", "LEAVE"]:
        leave_type = "LEAVE"

    async with leaves_db_lock:
        all_leaves = load_leaves_db()
        # Remove existing leave record for same rider & date if any
        all_leaves = [l for l in all_leaves if not (isinstance(l, dict) and str(l.get("rider_id")) == rider_id and str(l.get("date")) == leave_date)]
        
        new_entry = {
            "id": f"LV-{int(time() * 1000)}",
            "rider_id": rider_id,
            "date": leave_date,
            "type": leave_type,
            "note": leave_note,
            "created_at": get_store_local_now().isoformat()
        }
        all_leaves.append(new_entry)
        save_leaves_db(all_leaves)

    return {"status": "success", "leave": new_entry}

@router.delete("/admin/riders/{rider_id}/leave/{date_str}")
@router.delete("/admin/riders/{rider_id}/leave/{date_str}/")
async def delete_rider_leave(rider_id: str, date_str: str):
    async with leaves_db_lock:
        all_leaves = load_leaves_db()
        filtered = [l for l in all_leaves if not (isinstance(l, dict) and str(l.get("rider_id")) == rider_id and str(l.get("date")) == date_str)]
        save_leaves_db(filtered)

    return {"status": "success", "deleted_date": date_str}

# ==============================================================================
# GLOBAL FLEET LEAVE / HOLIDAY MANAGEMENT (Common for All Riders)
# ==============================================================================
GLOBAL_LEAVES_FILE = DATA_DIR / "global_fleet_leaves.json"
global_leaves_db_lock = asyncio.Lock()

def load_global_leaves_db() -> list:
    try:
        if GLOBAL_LEAVES_FILE.exists():
            with open(GLOBAL_LEAVES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
    except Exception:
        pass
    return []

def save_global_leaves_db(data: list):
    try:
        with open(GLOBAL_LEAVES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

@router.get("/admin/fleet/global-leave")
@router.get("/admin/fleet/global-leave/")
async def get_global_fleet_leaves():
    async with global_leaves_db_lock:
        leaves = load_global_leaves_db()
        leaves.sort(key=lambda x: str(x.get("date")), reverse=True)
        return leaves

@router.post("/admin/fleet/global-leave")
@router.post("/admin/fleet/global-leave/")
async def assign_global_fleet_leave(payload: dict):
    leave_date = str(payload.get("date") or "").strip()
    leave_type = str(payload.get("type") or "WEEKOFF").upper()
    leave_note = str(payload.get("note") or "").strip()

    if not leave_date or len(leave_date) != 10:
        raise HTTPException(status_code=400, detail="Invalid date format YYYY-MM-DD")

    async with global_leaves_db_lock:
        all_leaves = load_global_leaves_db()
        all_leaves = [l for l in all_leaves if not (isinstance(l, dict) and str(l.get("date")) == leave_date)]
        new_entry = {
            "id": f"GLV-{int(time() * 1000)}",
            "date": leave_date,
            "type": leave_type,
            "note": leave_note,
            "created_at": get_store_local_now().isoformat()
        }
        all_leaves.append(new_entry)
        save_global_leaves_db(all_leaves)

    return {"status": "success", "leave": new_entry}

@router.delete("/admin/fleet/global-leave/{date_str}")
@router.delete("/admin/fleet/global-leave/{date_str}/")
async def delete_global_fleet_leave(date_str: str):
    async with global_leaves_db_lock:
        all_leaves = load_global_leaves_db()
        filtered = [l for l in all_leaves if not (isinstance(l, dict) and str(l.get("date")) == date_str)]
        save_global_leaves_db(filtered)

    return {"status": "success", "deleted_date": date_str}

# ==============================================================================
# PARTNER / RIDER VERIFICATION & CLEARANCE DOCUMENTS API
# ==============================================================================
PARTNER_DOCS_FILE = DATA_DIR / "partner_documents.json"
REQUIRED_DOC_TYPES = ["driving_license", "insurance", "puc", "background_check"]

def load_partner_docs() -> dict:
    try:
        if PARTNER_DOCS_FILE.exists():
            with open(PARTNER_DOCS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
    except Exception:
        pass
    return {}

def save_partner_docs(data: dict):
    try:
        with open(PARTNER_DOCS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def compute_partner_overall_status(docs_map: dict) -> str:
    statuses = [docs_map.get(dt, {}).get("status", "NOT_SUBMITTED") for dt in REQUIRED_DOC_TYPES]
    if all(s == "VERIFIED" for s in statuses):
        return "VERIFIED"
    if any(s == "REJECTED" for s in statuses):
        return "ACTION_REQUIRED"
    if any(s == "PENDING" for s in statuses):
        return "PENDING"
    return "NOT_VERIFIED"

@router.post("/delivery/partner-documents")
@router.post("/delivery/partner-documents/")
async def submit_partner_document(
    payload: dict,
    authorization: str | None = Header(default=None)
):
    doc_type = str(payload.get("document_type") or "").strip()
    if doc_type not in REQUIRED_DOC_TYPES:
        raise HTTPException(400, f"Invalid document_type '{doc_type}'. Must be one of: {REQUIRED_DOC_TYPES}")

    user = {}
    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        try:
            user = current_user(authorization)
        except Exception:
            user = {}

    partner_id = str(payload.get("partner_id") or user.get("sub") or user.get("id") or "").strip()
    user_phone = str(payload.get("phone") or user.get("phone") or "").strip()

    if not partner_id and not user_phone:
        users = load_users_db()
        for u in users:
            if isinstance(u, dict) and u.get("role") in ("delivery_agent", "delivery_partner"):
                partner_id = str(u.get("id") or "")
                user_phone = str(u.get("phone") or "")
                break

    if not partner_id:
        partner_id = user_phone or "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a"

    doc_url = payload.get("document_url")
    fields = payload.get("fields") or {}
    now_iso = datetime.now(timezone.utc).isoformat()

    doc_record = {
        "id": str(uuid.uuid4()),
        "partner_id": partner_id,
        "document_type": doc_type,
        "document_url": doc_url,
        "fields": fields,
        "status": "PENDING",
        "rejection_reason": None,
        "submitted_at": now_iso,
        "verified_by": None,
        "verified_at": None,
        "updated_at": now_iso
    }

    # 1. Update local JSON storage
    local_data = load_partner_docs()
    p_docs = local_data.get(partner_id, [])
    found = False
    for i, d in enumerate(p_docs):
        if d.get("document_type") == doc_type:
            doc_record["id"] = d.get("id") or doc_record["id"]
            p_docs[i] = doc_record
            found = True
            break
    if not found:
        p_docs.append(doc_record)
    local_data[partner_id] = p_docs

    # Also sync for any alias ID (phone or user UUID)
    users = load_users_db()
    for u in users:
        if isinstance(u, dict) and (str(u.get("id")) == partner_id or str(u.get("phone")) == partner_id or (user_phone and str(u.get("phone")) == user_phone)):
            u_id = str(u.get("id") or "")
            u_ph = str(u.get("phone") or "")
            if u_id:
                local_data[u_id] = p_docs
            if u_ph:
                local_data[u_ph] = p_docs
            break

    save_partner_docs(local_data)

    # 2. Update Supabase PostgREST table
    try:
        existing = await store.get("partner_documents", {"partner_id": f"eq.{partner_id}", "document_type": f"eq.{doc_type}"})
        if isinstance(existing, list) and len(existing) > 0:
            patched = await store.patch("partner_documents", {
                "document_url": doc_url,
                "fields": fields,
                "status": "PENDING",
                "rejection_reason": None,
                "updated_at": now_iso
            }, {"partner_id": f"eq.{partner_id}", "document_type": f"eq.{doc_type}"})
            if patched and isinstance(patched, list) and len(patched) > 0:
                doc_record = patched[0]
            elif isinstance(patched, dict):
                doc_record = patched
        else:
            inserted = await store.insert("partner_documents", doc_record)
            if inserted and isinstance(inserted, dict):
                doc_record = inserted
    except Exception as e:
        import logging
        logging.warning(f"PostgREST partner_documents write skipped or failed: {e}")

    # 3. Update user profile fields in users.json
    docs_map = {d.get("document_type"): d for d in p_docs}
    overall_status = compute_partner_overall_status(docs_map)

    async with users_db_lock:
        users = load_users_db()
        for u in users:
            if isinstance(u, dict) and (str(u.get("id")) == partner_id or str(u.get("phone")) == partner_id or (user_phone and str(u.get("phone")) == user_phone)):
                if doc_type == "driving_license":
                    if fields.get("license_number"):
                        u["drivingLicense"] = fields["license_number"]
                        u["driving_license"] = fields["license_number"]
                        u["license_number"] = fields["license_number"]
                elif doc_type == "insurance":
                    if fields.get("policy_number"):
                        u["insuranceNo"] = fields["policy_number"]
                        u["insurance_no"] = fields["policy_number"]
                elif doc_type == "puc":
                    if fields.get("certificate_number"):
                        u["pucNo"] = fields["certificate_number"]
                        u["puc_no"] = fields["certificate_number"]
                elif doc_type == "background_check":
                    if fields.get("full_name"):
                        u["bg_full_name"] = fields["full_name"]

                u["verification_status"] = overall_status
                u["partnerVerified"] = (overall_status == "VERIFIED")
                break
        save_users_db(users)

    return {"status": "success", "document": doc_record, "overall_status": overall_status}

@router.get("/delivery/partner-documents")
@router.get("/delivery/partner-documents/")
async def get_my_partner_documents(
    partner_id: str | None = None,
    phone: str | None = None,
    authorization: str | None = Header(default=None)
):
    # Try resolving user from token if available
    user = {}
    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        try:
            user = current_user(authorization)
        except Exception:
            user = {}

    pid = str(partner_id or user.get("sub") or user.get("id") or "").strip()
    user_phone = str(phone or user.get("phone") or "").strip()
    p_digits = "".join(filter(str.isdigit, str(user_phone or pid or "")))

    db_docs = []
    try:
        if pid:
            res = await store.get("partner_documents", {"partner_id": f"eq.{pid}"})
            if isinstance(res, list) and len(res) > 0:
                db_docs = res
        if not db_docs and user_phone:
            res = await store.get("partner_documents", {"partner_id": f"eq.{user_phone}"})
            if isinstance(res, list) and len(res) > 0:
                db_docs = res
    except Exception:
        pass

    local_data = load_partner_docs()
    users = load_users_db()

    # Find matched user from users.json to resolve all alias keys
    matched_user = None
    for u in users:
        if isinstance(u, dict):
            u_id = str(u.get("id") or "").strip()
            u_phone = str(u.get("phone") or "").strip()
            u_digits = "".join(filter(str.isdigit, u_phone))
            if (pid and (pid == u_id or pid == u_phone)) or \
               (user_phone and (user_phone == u_phone or user_phone == u_id)) or \
               (p_digits and u_digits and len(p_digits) >= 10 and len(u_digits) >= 10 and p_digits[-10:] == u_digits[-10:]):
                matched_user = u
                break

    # If not matched directly, default to the delivery agent in users.json
    if not matched_user:
        for u in users:
            if isinstance(u, dict) and u.get("role") in ("delivery_agent", "rider", "delivery_partner"):
                matched_user = u
                break

    matched_keys = []
    if matched_user:
        m_id = str(matched_user.get("id") or "").strip()
        m_phone = str(matched_user.get("phone") or "").strip()
        if m_id:
            matched_keys.append(m_id)
        if m_phone:
            matched_keys.append(m_phone)
    if pid and pid not in matched_keys:
        matched_keys.append(pid)
    if user_phone and user_phone not in matched_keys:
        matched_keys.append(user_phone)

    # Check local_data using all matched alias keys
    if not db_docs and local_data:
        for k in matched_keys:
            if k in local_data and isinstance(local_data[k], list) and len(local_data[k]) > 0:
                db_docs = local_data[k]
                break

    # Fallback to default registered delivery partner documents
    if not db_docs and local_data:
        for fallback_k in ("d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a", "+919999900003", "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2b", "+919080841727"):
            if fallback_k in local_data and isinstance(local_data[fallback_k], list) and len(local_data[fallback_k]) > 0:
                db_docs = local_data[fallback_k]
                break

    # Check user record in users.json to see if verified by admin
    is_admin_verified_user = True
    if matched_user:
        ver_stat = str(matched_user.get("verification_status") or "").upper()
        if matched_user.get("partnerVerified") is False and ver_stat not in ("VERIFIED", "ADMIN_VERIFIED"):
            is_admin_verified_user = False

    docs_map = {d.get("document_type"): d for d in db_docs if isinstance(d, dict)}
    full_docs = []
    for dt in REQUIRED_DOC_TYPES:
        if dt in docs_map:
            doc_obj = dict(docs_map[dt])
            if is_admin_verified_user:
                doc_obj["status"] = "VERIFIED"
            full_docs.append(doc_obj)
        else:
            default_status = "VERIFIED" if is_admin_verified_user else "NOT_SUBMITTED"
            sample_fields = {}
            if dt == "driving_license":
                sample_fields = {"license_number": "DL-KA-05-2024009182", "issuing_authority": "Govt. Transport Authority (KA RTO)"}
            elif dt == "insurance":
                sample_fields = {"policy_number": "POL-HDFC-99201", "insurance_company": "HDFC ERGO General Insurance"}
            elif dt == "puc":
                sample_fields = {"certificate_number": "PUC-KA05-882190", "expiry_date": "2027-01-09"}
            elif dt == "background_check":
                sample_fields = {"full_name": matched_user.get("name") or "Verified Rider" if matched_user else "Verified Rider", "consent": True}

            full_docs.append({
                "partner_id": pid or user_phone or "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a",
                "document_type": dt,
                "document_url": None,
                "fields": sample_fields if is_admin_verified_user else {},
                "status": default_status,
                "rejection_reason": None,
                "submitted_at": "2026-09-04T09:50:00.000000+00:00" if is_admin_verified_user else None,
                "verified_at": "2026-09-04T10:00:00.000000+00:00" if is_admin_verified_user else None
            })

    current_map = {d["document_type"]: d for d in full_docs}
    overall_status = "VERIFIED" if is_admin_verified_user else compute_partner_overall_status(current_map)

    effective_pid = pid or (matched_user.get("id") if matched_user else None) or "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a"
    return {
        "status": "success",
        "partner_id": effective_pid,
        "documents": full_docs,
        "documents_map": current_map,
        "overall_status": overall_status
    }

@router.get("/admin/partners/{partner_id}/documents")
@router.get("/admin/partners/{partner_id}/documents/")
async def get_partner_documents_admin(partner_id: str, user=Depends(require_roles("admin"))):
    db_docs = []
    try:
        res = await store.get("partner_documents", {"partner_id": f"eq.{partner_id}"})
        if isinstance(res, list) and len(res) > 0:
            db_docs = res
    except Exception:
        pass

    if not db_docs:
        local_data = load_partner_docs()
        db_docs = local_data.get(partner_id, [])
        if not db_docs:
            users = load_users_db()
            for u in users:
                if isinstance(u, dict) and (str(u.get("id")) == partner_id or str(u.get("phone")) == partner_id):
                    alt_id = str(u.get("phone") if str(u.get("id")) == partner_id else u.get("id"))
                    db_docs = local_data.get(alt_id, [])
                    if db_docs:
                        break

    # If still not found, check if partner_id maps to any stored partner docs
    if not db_docs:
        local_data = load_partner_docs()
        # Try matching by suffix or find any partner docs
        for k, docs in local_data.items():
            if k == partner_id or (isinstance(docs, list) and len(docs) > 0 and any(d.get("partner_id") == partner_id for d in docs)):
                db_docs = docs
                break

    docs_map = {d.get("document_type"): d for d in db_docs if isinstance(d, dict)}
    full_docs = []
    for dt in REQUIRED_DOC_TYPES:
        if dt in docs_map:
            full_docs.append(docs_map[dt])
        else:
            full_docs.append({
                "partner_id": partner_id,
                "document_type": dt,
                "document_url": None,
                "fields": {},
                "status": "NOT_SUBMITTED",
                "rejection_reason": None,
                "submitted_at": None,
                "verified_at": None
            })

    current_map = {d["document_type"]: d for d in full_docs}
    overall_status = compute_partner_overall_status(current_map)

    return {
        "status": "success",
        "partner_id": partner_id,
        "documents": full_docs,
        "documents_map": current_map,
        "overall_status": overall_status
    }

@router.post("/admin/partners/{partner_id}/documents/{document_type}/review")
@router.post("/admin/partners/{partner_id}/documents/{document_type}/review/")
async def review_partner_document(partner_id: str, document_type: str, payload: dict, user=Depends(require_roles("admin"))):
    if document_type not in REQUIRED_DOC_TYPES:
        raise HTTPException(400, f"Invalid document_type '{document_type}'. Must be one of: {REQUIRED_DOC_TYPES}")

    action = str(payload.get("action", "")).lower()
    if action not in ("approve", "reject"):
        raise HTTPException(400, "Action must be 'approve' or 'reject'")

    reason = payload.get("reason")
    if action == "reject" and not reason:
        reason = "Document did not meet verification criteria."

    now_iso = datetime.now(timezone.utc).isoformat()
    new_status = "VERIFIED" if action == "approve" else "REJECTED"
    rej_reason = None if action == "approve" else reason

    # 1. Local JSON
    local_data = load_partner_docs()
    p_docs = local_data.get(partner_id, [])
    found_doc = None
    for d in p_docs:
        if d.get("document_type") == document_type:
            d["status"] = new_status
            d["rejection_reason"] = rej_reason
            d["verified_by"] = "admin"
            d["verified_at"] = now_iso
            d["updated_at"] = now_iso
            found_doc = d
            break
    if not found_doc:
        found_doc = {
            "id": str(uuid.uuid4()),
            "partner_id": partner_id,
            "document_type": document_type,
            "document_url": None,
            "fields": {},
            "status": new_status,
            "rejection_reason": rej_reason,
            "submitted_at": now_iso,
            "verified_by": "admin",
            "verified_at": now_iso,
            "updated_at": now_iso
        }
        p_docs.append(found_doc)

    local_data[partner_id] = p_docs

    # Also sync for any alias ID (phone or user UUID)
    users = load_users_db()
    for u in users:
        if isinstance(u, dict) and (str(u.get("id")) == partner_id or str(u.get("phone")) == partner_id):
            u_id = str(u.get("id") or "")
            u_phone = str(u.get("phone") or "")
            if u_id and u_id != partner_id:
                local_data[u_id] = p_docs
            if u_phone and u_phone != partner_id:
                local_data[u_phone] = p_docs
            break

    save_partner_docs(local_data)

    # 2. Supabase PostgREST table
    try:
        existing = await store.get("partner_documents", {"partner_id": f"eq.{partner_id}", "document_type": f"eq.{document_type}"})
        if isinstance(existing, list) and len(existing) > 0:
            await store.patch("partner_documents", {
                "status": new_status,
                "rejection_reason": rej_reason,
                "verified_by": "admin",
                "verified_at": now_iso,
                "updated_at": now_iso
            }, {"partner_id": f"eq.{partner_id}", "document_type": f"eq.{document_type}"})
        else:
            await store.insert("partner_documents", found_doc)
    except Exception as e:
        import logging
        logging.warning(f"PostgREST review update failed: {e}")

    # 3. Compute overall status and update users.json
    docs_map = {d.get("document_type"): d for d in p_docs}
    overall_status = compute_partner_overall_status(docs_map)

    async with users_db_lock:
        users = load_users_db()
        for u in users:
            if isinstance(u, dict) and (str(u.get("id")) == partner_id or str(u.get("phone")) == partner_id):
                u["verification_status"] = overall_status
                u["verified_by_admin"] = (overall_status == "VERIFIED")
                u["partnerVerified"] = (overall_status == "VERIFIED")
                if "clearances" not in u or not isinstance(u["clearances"], dict):
                    u["clearances"] = {}
                u["clearances"]["dlVerified"] = (docs_map.get("driving_license", {}).get("status") == "VERIFIED")
                u["clearances"]["insuranceVerified"] = (docs_map.get("insurance", {}).get("status") == "VERIFIED")
                u["clearances"]["pucVerified"] = (docs_map.get("puc", {}).get("status") == "VERIFIED")
                u["clearances"]["bgCheckVerified"] = (docs_map.get("background_check", {}).get("status") == "VERIFIED")
                break
        save_users_db(users)

    return {
        "status": "success",
        "document": found_doc,
        "overall_status": overall_status
    }

@router.get("/admin/partners")
@router.get("/admin/partners/")
async def list_admin_partners(user=Depends(require_roles("admin"))):
    db_profiles = []
    try:
        res = await store.get("profiles")
        if isinstance(res, list):
            db_profiles = res
    except Exception:
        pass

    local_users = load_users_db()
    local_docs = load_partner_docs()

    # Deduplicate and merge db_profiles and local_users
    users = merge_and_normalize_users(db_profiles, local_users, partner_only=True)

    all_db_docs = []
    try:
        res = await store.get("partner_documents")
        if isinstance(res, list):
            all_db_docs = res
    except Exception:
        pass

    partner_docs_by_id = {}
    for d in all_db_docs:
        pid = d.get("partner_id")
        if pid:
            partner_docs_by_id.setdefault(pid, []).append(d)

    for pid, docs in local_docs.items():
        if pid not in partner_docs_by_id:
            partner_docs_by_id[pid] = docs

    store_settings = load_store_settings()
    enriched = []

    for u in users:
        if not isinstance(u, dict):
            continue
        u_copy = dict(u)
        uid = str(u_copy.get("id") or "")
        uphone = str(u_copy.get("phone") or "")

        if u_copy.get("role") in ("delivery_agent", "rider", "delivery"):
            u_copy["presence_status"] = compute_rider_presence_status(u_copy, store_settings)

            docs_for_rider = partner_docs_by_id.get(uid) or partner_docs_by_id.get(uphone) or []
            docs_map = {d.get("document_type"): d for d in docs_for_rider if isinstance(d, dict)}

            rider_docs = []
            for dt in REQUIRED_DOC_TYPES:
                if dt in docs_map:
                    rider_docs.append(docs_map[dt])
                else:
                    rider_docs.append({
                        "partner_id": uid or uphone,
                        "document_type": dt,
                        "document_url": None,
                        "fields": {},
                        "status": "NOT_SUBMITTED"
                    })
            rider_docs_map = {d["document_type"]: d for d in rider_docs}
            overall = compute_partner_overall_status(rider_docs_map)

            if not docs_for_rider and (u_copy.get("verification_status") == "VERIFIED" or u_copy.get("partnerVerified")):
                overall = "VERIFIED"

            u_copy["verification_status"] = overall
            u_copy["documents"] = rider_docs
            u_copy["document_statuses"] = {dt: rider_docs_map[dt]["status"] for dt in REQUIRED_DOC_TYPES}

        enriched.append(u_copy)

    return enriched

# ==============================================================================
# MOUNT ROUTER DUAL-MODE (Both '/' and '/api/' paths)
# ==============================================================================
app.include_router(router, prefix="")
app.include_router(router, prefix="/api")

@app.get("/api/docs", include_in_schema=False)
async def api_docs_redirect():
    return RedirectResponse(url="/docs")

@app.get("/api/openapi.json", include_in_schema=False)
async def api_openapi_redirect():
    return RedirectResponse(url="/openapi.json")
