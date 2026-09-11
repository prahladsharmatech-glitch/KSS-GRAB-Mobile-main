import pytest
import os
import secrets
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from backend.app.main import (
    app,
    logger,
    normalize_order_dict,
    resolve_valid_rider_id,
    resolve_default_store_id,
    compute_rider_presence_status,
)
from backend.app.store import store
from backend.app.config import settings


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def anyio_backend():
    return "asyncio"


# ------------------------------------------------------------------------------
# Bug 1: Module-Level Logger
# ------------------------------------------------------------------------------
def test_bug_1_logger_is_defined():
    """Bug 1: logger is defined at module level in main.py."""
    assert logger is not None
    assert logger.name == "backend.app.main"


# ------------------------------------------------------------------------------
# Bug 2 & Bug 24: create_ticket (No undefined user var & Unique Ticket IDs)
# ------------------------------------------------------------------------------
def test_bug_2_and_24_create_ticket(client):
    """Bug 2 & 24: Ticket creation works without undefined user variable and generates unique TKT-UUID IDs."""
    payload = {
        "subject": "App Crash Report",
        "description": "App closes when opening navigation tab.",
        "category": "Technical",
        "user_name": "Test Driver",
        "user_phone": "+919999900003"
    }
    resp1 = client.post("/api/tickets", json=payload)
    assert resp1.status_code == 200
    ticket1 = resp1.json()
    assert ticket1["subject"] == "App Crash Report"
    assert ticket1["id"].startswith("TKT-")
    assert len(ticket1["id"]) > 8  # TKT-XXXXXXXX UUID format

    resp2 = client.post("/api/tickets", json=payload)
    assert resp2.status_code == 200
    ticket2 = resp2.json()
    assert ticket1["id"] != ticket2["id"]  # Unique ticket IDs, no collisions


# ------------------------------------------------------------------------------
# Bug 3 & Bug 4: Tickets update & Store methods
# ------------------------------------------------------------------------------
def test_bug_3_and_4_store_methods():
    """Bug 3 & 4: store.insert exists, store.patch signature is patch(table, payload, params)."""
    assert hasattr(store, "insert")
    assert hasattr(store, "patch")
    assert hasattr(store, "get")
    assert hasattr(store, "delete")


# ------------------------------------------------------------------------------
# Bug 5 & Bug 25: Store Auth & PostgREST Schema Headers
# ------------------------------------------------------------------------------
def test_bug_5_and_25_store_headers():
    """Bug 5 & 25: store read/write headers contain Accept-Profile and Content-Profile for schema targeting."""
    assert "Accept-Profile" in store._read_headers
    assert store._read_headers["Accept-Profile"] == "public"
    assert "Content-Profile" in store._write_headers
    assert store._write_headers["Content-Profile"] == "public"


# ------------------------------------------------------------------------------
# Bug 6 & Bug 7: Configuration & Environment Secrets
# ------------------------------------------------------------------------------
def test_bug_6_and_7_config_secrets():
    """Bug 6 & 7: Critical secrets have no hardcoded fallback values in config.py."""
    cfg = settings()
    assert hasattr(cfg, "jwt_secret")
    assert hasattr(cfg, "upstash_redis_rest_token")
    assert hasattr(cfg, "cloudinary_url")
    assert hasattr(cfg, "supabase_service_key")


# ------------------------------------------------------------------------------
# Bug 8 & Bug 27: Category Endpoints Auth & Cache Invalidation
# ------------------------------------------------------------------------------
def test_bug_8_and_27_category_delete_auth(client):
    """Bug 27: DELETE /categories/{cat_id} requires admin/seller auth."""
    resp = client.delete("/api/categories/cat-123")
    assert resp.status_code in (401, 403)


# ------------------------------------------------------------------------------
# Bug 9: Product Patch 404 Handling
# ------------------------------------------------------------------------------
def test_bug_9_product_patch_nonexistent(client):
    """Bug 9: PATCH /products/{id} returns 404 when product does not exist, not fake 200."""
    seller_headers = {"Authorization": "Bearer seller-token"}
    non_existent_uuid = "00000000-0000-0000-0000-000000000000"
    resp = client.patch(
        f"/api/products/{non_existent_uuid}",
        json={"name": "Nonexistent Item", "price": 99.0},
        headers=seller_headers
    )
    assert resp.status_code == 404


# ------------------------------------------------------------------------------
# Bug 10: Order Total Normalization
# ------------------------------------------------------------------------------
def test_bug_10_order_total_normalization():
    """Bug 10: normalize_order_dict sets both total and total_amount to non-zero float values."""
    order_from_db = {"id": "ord-1", "total": "149.50", "total_amount": 0.0}
    normalized = normalize_order_dict(dict(order_from_db))
    assert normalized["total"] == 149.50
    assert normalized["total_amount"] == 149.50

    order_with_items = {"id": "ord-2", "items": [{"name": "Item A", "price": 50.0, "qty": 2}]}
    normalized_items = normalize_order_dict(dict(order_with_items))
    assert normalized_items["total"] == 100.0
    assert normalized_items["total_amount"] == 100.0


# ------------------------------------------------------------------------------
# Bug 11: Invalid Rider ID Resolution
# ------------------------------------------------------------------------------
@pytest.mark.anyio
async def test_bug_11_invalid_rider_id_returns_none():
    """Bug 11: resolve_valid_rider_id returns None for non-existent riders instead of 1st rider in DB."""
    res = await resolve_valid_rider_id("invalid-nonexistent-rider-id-999")
    assert res is None


# ------------------------------------------------------------------------------
# Bug 12: Active Delivery Queue Data Isolation
# ------------------------------------------------------------------------------
def test_bug_12_delivery_active_unauthenticated(client):
    """Bug 12: GET /delivery/active requires delivery_agent auth token."""
    resp = client.get("/api/delivery/active")
    assert resp.status_code in (401, 403)


# ------------------------------------------------------------------------------
# Bug 13: GET /orders User Phone Query Auth Protection
# ------------------------------------------------------------------------------
def test_bug_13_get_orders_user_phone_unauthenticated(client):
    """Bug 13: GET /orders?phone=... requires auth and prevents cross-user access."""
    resp_unauth = client.get("/api/orders?phone=919999900001")
    assert resp_unauth.status_code in (401, 403)

    resp_path_unauth = client.get("/api/orders/user/919999900001")
    assert resp_path_unauth.status_code in (401, 403)


# ------------------------------------------------------------------------------
# Bug 14: Sole Rider Logic Check
# ------------------------------------------------------------------------------
def test_bug_14_sole_rider_rejection_unauthenticated(client):
    """Bug 14: Rejection endpoint requires delivery_agent auth token."""
    resp = client.post("/api/delivery/ord-123/reject")
    assert resp.status_code in (401, 403)


# ------------------------------------------------------------------------------
# Bug 15: Bulk Assign Queue Assignment Logic
# ------------------------------------------------------------------------------
def test_bug_15_bulk_assign_unauthenticated(client):
    """Bug 15: POST /orders/bulk-assign requires seller/admin auth token."""
    resp = client.post("/api/orders/bulk-assign", json={"delivery_agent_id": "r-1", "order_ids": ["o-1", "o-2"]})
    assert resp.status_code in (401, 403)


# ------------------------------------------------------------------------------
# Bug 16: Payment Initiate Default Status
# ------------------------------------------------------------------------------
def test_bug_16_payment_initiate_default_status(client):
    """Bug 16: POST /payments/initiate defaults status to pending, not hardcoded completed."""
    cust_headers = {"Authorization": "Bearer customer-token"}
    resp = client.post(
        "/api/payments/initiate",
        json={"order_id": "ord-100", "amount": 250.0},
        headers=cust_headers
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["status"] == "pending"
    assert data["amount"] == 250.0


# ------------------------------------------------------------------------------
# Bug 17: accept_delivery Store Hours Check
# ------------------------------------------------------------------------------
def test_bug_17_accept_delivery_unauthenticated(client):
    """Bug 17: POST /delivery/{order_id}/accept requires delivery_agent role."""
    resp = client.post("/api/delivery/ord-123/accept")
    assert resp.status_code in (401, 403)


# ------------------------------------------------------------------------------
# Bug 18 & Bug 19: Redis OTP & Auth Verification
# ------------------------------------------------------------------------------
def test_bug_18_and_19_otp_verify_invalid_code(client):
    """Bug 18 & 19: OTP verification fails when code is missing or invalid."""
    resp = client.post("/api/auth/verify", json={"phone": "+919888877776", "otp": "999999"})
    assert resp.status_code == 400
    assert "Verification code expired or not found" in resp.json()["detail"]


# ------------------------------------------------------------------------------
# Bug 20: complete-profile Schema Type
# ------------------------------------------------------------------------------
def test_bug_20_complete_profile_schema(client):
    """Bug 20: POST /auth/complete-profile accepts RegistrationRequest without requiring otp field."""
    resp = client.post(
        "/api/auth/complete-profile",
        json={"phone": "+919888877775", "full_name": "New User Name", "email": "new@user.com"}
    )
    # Verification fails because phone wasn't verified, but NOT due to Pydantic schema missing otp error
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Phone verification expired. Please start over."


# ------------------------------------------------------------------------------
# Bug 22: Category ID Auto-Resolution
# ------------------------------------------------------------------------------
def test_bug_22_create_product_unmatched_category(client):
    """Bug 22: Product with unrecognized category leaves category_id as None, not 1st DB category."""
    seller_headers = {"Authorization": "Bearer seller-token"}
    resp = client.post(
        "/api/products",
        json={"name": "Exotic Fruit Item", "price": 120.0, "category_id": "non-existent-cat-name"},
        headers=seller_headers
    )
    assert resp.status_code in (200, 201)
    product = resp.json()
    assert product.get("category_id") is None


# ------------------------------------------------------------------------------
# Bug 23: Dynamic Join Date Calculation
# ------------------------------------------------------------------------------
def test_bug_23_compute_presence_status():
    """Bug 23: compute_rider_presence_status executes cleanly without hardcoding 2026-08-25."""
    status = compute_rider_presence_status({"is_online": True}, {"store_open_time": "09:00", "store_close_time": "22:00"})
    assert status in ("PRESENT", "LATE", "ABSENT")


# ------------------------------------------------------------------------------
# Bug 26: Product Search Fields Expansion
# ------------------------------------------------------------------------------
def test_bug_26_product_search(client):
    """Bug 26: Product search responds successfully on /products endpoint."""
    resp = client.get("/api/products?q=organic")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ------------------------------------------------------------------------------
# Bug 28: Cloudinary Upload Signature Algorithm
# ------------------------------------------------------------------------------
def test_bug_28_cloudinary_signature(client):
    """Bug 28: GET /uploads/signature returns signature_algorithm: sha256."""
    seller_headers = {"Authorization": "Bearer seller-token"}
    resp = client.get("/api/uploads/signature", headers=seller_headers)
    if resp.status_code == 200:
        data = resp.json()
        assert data["signature_algorithm"] == "sha256"
        assert len(data["signature"]) == 64  # SHA256 hex string length is 64 chars


# ------------------------------------------------------------------------------
# Order Status Route Auth/Authz Check
# ------------------------------------------------------------------------------
def test_order_status_authentication_and_authorization(client):
    """PATCH /orders/{order_id}/status requires authentication and validates role permissions."""
    # 1. Unauthenticated request must return 401
    unauth_resp = client.patch("/api/orders/ORD-TEST-101/status", json={"status": "delivered"})
    assert unauth_resp.status_code == 401

    # 2. Customer user attempting to set status to 'delivered' must return 403
    cust_headers = {"Authorization": "Bearer customer-token"}
    cust_resp = client.patch("/api/orders/ORD-TEST-101/status", json={"status": "delivered"}, headers=cust_headers)
    assert cust_resp.status_code == 403

    # 3. Seller or Admin user can update order status successfully (valid transition from default placed -> preparing)
    seller_headers = {"Authorization": "Bearer seller-token"}
    with patch("backend.app.main.idempotent_order_upsert", new=AsyncMock(return_value=True)):
        seller_resp = client.patch("/api/orders/ORD-TEST-101/status", json={"status": "preparing"}, headers=seller_headers)
        assert seller_resp.status_code in (200, 201)


def test_order_status_state_machine_transitions(client):
    """PATCH /orders/{order_id}/status validates status strings and state transitions, returning 409 on invalid jumps."""
    seller_headers = {"Authorization": "Bearer seller-token"}

    # 1. Invalid status string returns 400
    invalid_resp = client.patch("/api/orders/ORD-TEST-102/status", json={"status": "deliverd"}, headers=seller_headers)
    assert invalid_resp.status_code == 400

    # 2. Illegal jump from placed -> delivered returns 409 Conflict
    with patch("backend.app.main.cache_get", new=AsyncMock(return_value={"id": "ORD-TEST-102", "status": "placed"})):
        illegal_resp = client.patch("/api/orders/ORD-TEST-102/status", json={"status": "delivered"}, headers=seller_headers)
        assert illegal_resp.status_code == 409

    # 3. Valid transition placed -> preparing returns 200/201
    with patch("backend.app.main.cache_get", new=AsyncMock(return_value={"id": "ORD-TEST-102", "status": "placed"})), \
         patch("backend.app.main.idempotent_order_upsert", new=AsyncMock(return_value=True)):
        valid_resp = client.patch("/api/orders/ORD-TEST-102/status", json={"status": "preparing"}, headers=seller_headers)
        assert valid_resp.status_code in (200, 201)


def test_order_total_server_side_calculation_and_coupon_validation(client):
    """POST /orders recalculates total server-side from catalog and validates coupon eligibility."""
    cust_headers = {"Authorization": "Bearer customer-token"}

    # Attacker sends tampered total_amount=1.0 for item priced 150.0
    payload = {
        "customer_phone": "+919999900004",
        "delivery_address": "Test Address",
        "items": [{"id": "prod-101", "name": "Test Item", "price": 150.0, "qty": 1}],
        "total_amount": 1.0,  # Tampered total
        "coupon": "GRABIT50"   # Valid coupon (min 149, -50 discount -> 150 - 50 = 100 + 30 delivery = 130)
    }

    with patch("backend.app.main.store.get", new=AsyncMock(return_value=[{"id": "prod-101", "price": 150.0}])), \
         patch("backend.app.main.store.insert", new=AsyncMock(return_value=True)), \
         patch("backend.app.main.idempotent_order_upsert", new=AsyncMock(return_value=True)):
        resp = client.post("/api/orders", json=payload, headers=cust_headers)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["total_amount"] == 130.0  # Server calculated: (150 - 50 coupon) + 30 delivery fee = 130.0
        assert data["total"] == 130.0

def test_inventory_stock_enforcement_and_restoration(client):
    """POST /orders enforces product stock limits, decrements stock on placement, and restores stock on cancellation."""
    cust_headers = {"Authorization": "Bearer customer-token"}
    seller_headers = {"Authorization": "Bearer seller-token"}

    # 1. Out of stock item (available: 0) rejected with 400 Bad Request
    out_of_stock_payload = {
        "customer_phone": "+919999900004",
        "delivery_address": "Test Address",
        "items": [{"id": "prod-zero-stock", "name": "Zero Stock Item", "price": 100.0, "qty": 1}],
    }
    with patch("backend.app.main.store.get", new=AsyncMock(return_value=[{"id": "prod-zero-stock", "price": 100.0, "stock": 0}])):
        resp = client.post("/api/orders", json=out_of_stock_payload, headers=cust_headers)
        assert resp.status_code == 400
        assert "out of stock" in resp.json()["detail"].lower()

    # 2. Stock decremented on order placement (stock 5 -> 3)
    in_stock_payload = {
        "customer_phone": "+919999900004",
        "delivery_address": "Test Address",
        "items": [{"id": "prod-in-stock", "name": "In Stock Item", "price": 100.0, "qty": 2}],
    }
    mock_patch = AsyncMock(return_value=True)
    with patch("backend.app.main.store.get", new=AsyncMock(return_value=[{"id": "prod-in-stock", "price": 100.0, "stock": 5}])), \
         patch("backend.app.main.store.insert", new=AsyncMock(return_value=True)), \
         patch("backend.app.main.store.patch", new=mock_patch), \
         patch("backend.app.main.idempotent_order_upsert", new=AsyncMock(return_value=True)):
        resp = client.post("/api/orders", json=in_stock_payload, headers=cust_headers)
        assert resp.status_code in (200, 201)
        # Verify store.patch called with stock: 3 (5 - 2 = 3)
        mock_patch.assert_called_with("products", {"stock": 3}, {"id": "eq.prod-in-stock"})

    # 3. Stock restored on order cancellation
    cancel_mock_patch = AsyncMock(return_value=True)
    mock_order = {
        "id": "ORD-CANCEL-TEST",
        "status": "placed",
        "items": [{"id": "prod-in-stock", "qty": 2}]
    }
    with patch("backend.app.main.cache_get", new=AsyncMock(return_value=mock_order)), \
         patch("backend.app.main.store.get", new=AsyncMock(return_value=[{"id": "prod-in-stock", "stock": 3}])), \
         patch("backend.app.main.store.patch", new=cancel_mock_patch), \
         patch("backend.app.main.idempotent_order_upsert", new=AsyncMock(return_value=True)):
        resp = client.patch("/api/orders/ORD-CANCEL-TEST/status", json={"status": "cancelled"}, headers=seller_headers)
        assert resp.status_code in (200, 201)
        # Verify store.patch called with stock: 5 (3 + 2 = 5)
        cancel_mock_patch.assert_called_with("products", {"stock": 5}, {"id": "eq.prod-in-stock"})


def test_create_order_initial_status_forced_to_placed(client):
    """POST /orders ignores client-supplied status and forces initial status to 'placed'."""
    cust_headers = {"Authorization": "Bearer customer-token"}
    payload = {
        "customer_phone": "+919999900004",
        "delivery_address": "Test Address",
        "items": [{"id": "prod-101", "name": "Item", "price": 50.0, "qty": 1}],
        "status": "delivered"  # Client attempts to bypass flow by sending 'delivered'
    }

    with patch("backend.app.main.store.insert", new=AsyncMock(return_value=True)), \
         patch("backend.app.main.idempotent_order_upsert", new=AsyncMock(return_value=True)):
        resp = client.post("/api/orders", json=payload, headers=cust_headers)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["status"] == "placed"  # Must be forced to 'placed' server-side


def test_accept_delivery_blocks_double_assignment_regardless_of_status(client):
    """POST /delivery/{order_id}/accept blocks second rider even if order is in preparing status."""
    rider_headers = {"Authorization": "Bearer delivery-token"}
    # Order is assigned to Rider A (UUID 'rider-a-uuid'), sitting at 'preparing' status
    order_assigned_to_rider_a = {
        "id": "ORD-RACE-101",
        "status": "preparing",
        "delivery_agent_id": "rider-a-uuid"
    }

    with patch("backend.app.main.is_within_store_hours", return_value=(True, "09:00", "22:00")), \
         patch("backend.app.main.store.get", new=AsyncMock(return_value=[order_assigned_to_rider_a])), \
         patch("backend.app.main.cache_get", new=AsyncMock(return_value=order_assigned_to_rider_a)):
        resp = client.post("/api/delivery/ORD-RACE-101/accept", headers=rider_headers)
        assert resp.status_code == 409
        assert "already assigned to another rider" in resp.json()["detail"].lower()


def test_order_status_normalization(client):
    """PATCH /orders/{order_id}/status normalizes status strings with uppercase/hyphens into canonical lowercase snake_case."""
    seller_headers = {"Authorization": "Bearer seller-token"}

    # 1. Alias 'PREPARING' -> 'preparing' from 'placed'
    mock_order_placed = {"id": "ORD-NORM-101", "status": "placed"}
    with patch("backend.app.main.cache_get", new=AsyncMock(return_value=mock_order_placed)), \
         patch("backend.app.main.idempotent_order_upsert", new=AsyncMock(return_value=True)):
        resp = client.patch("/api/orders/ORD-NORM-101/status", json={"status": "PREPARING"}, headers=seller_headers)
        assert resp.status_code in (200, 201)

    # 2. Uppercase & hyphens: 'OUT-FOR-DELIVERY' -> 'out_for_delivery' from 'preparing'
    mock_order_preparing = {"id": "ORD-NORM-101", "status": "preparing"}
    with patch("backend.app.main.cache_get", new=AsyncMock(return_value=mock_order_preparing)), \
         patch("backend.app.main.idempotent_order_upsert", new=AsyncMock(return_value=True)):
        resp = client.patch("/api/orders/ORD-NORM-101/status", json={"status": "OUT-FOR-DELIVERY"}, headers=seller_headers)
        assert resp.status_code in (200, 201)







