import pytest
import uuid
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.security import create_token

client = TestClient(app)

CUSTOMER_A_PHONE = "+919876543210"
CUSTOMER_A_TOKEN = create_token({
    "sub": "beab20b0-8b48-486f-9746-175872a0b438",
    "role": "customer",
    "phone": CUSTOMER_A_PHONE,
    "name": "Customer Alice"
})

CUSTOMER_B_PHONE = "+919888877771"
CUSTOMER_B_TOKEN = create_token({
    "sub": "1d8e15d2-f01d-4094-b5ce-4607a91234a1",
    "role": "customer",
    "phone": CUSTOMER_B_PHONE,
    "name": "Customer Bob"
})

SELLER_TOKEN = create_token({
    "sub": "c8d0412d-5c3d-489d-8e43-0dc5dcf90389",
    "role": "seller",
    "phone": "+919999900002",
    "name": "John Seller"
})

RIDER_TOKEN = create_token({
    "sub": "700b1d05-e6f5-4be0-9e57-1d05137b5487",
    "role": "delivery_agent",
    "phone": "+919999900003",
    "name": "Karthik Rider"
})


# ==============================================================================
# 1. ORDER CREATION VALIDATION
# ==============================================================================

def test_order_creation_empty_items_rejected():
    """Empty items list must be rejected with 400 Bad Request."""
    payload = {
        "customer_phone": CUSTOMER_A_PHONE,
        "delivery_address": "Test Street 1, Bengaluru",
        "items": []
    }
    res = client.post("/api/orders", json=payload, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert res.status_code == 400
    assert "at least one item" in res.json()["detail"].lower()


def test_order_creation_invalid_quantity_rejected():
    """Quantity <= 0 must be rejected with 400 Bad Request."""
    payload = {
        "customer_phone": CUSTOMER_A_PHONE,
        "delivery_address": "Test Street 1, Bengaluru",
        "items": [
            {"id": "prod-item-1", "name": "Test Milk", "price": 40.0, "qty": 0}
        ]
    }
    res = client.post("/api/orders", json=payload, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert res.status_code == 400
    assert "quantity must be greater than 0" in res.json()["detail"].lower()


def test_order_creation_financial_breakdown():
    """Order creation returns complete financial breakdown: subtotal, delivery_fee, discount, total, delivery_otp."""
    payload = {
        "customer_phone": CUSTOMER_A_PHONE,
        "customer_name": "Customer Alice",
        "delivery_address": "42 Baker Street, Bengaluru",
        "items": [
            {"id": "prod-breakdown-1", "name": "Organic Honey", "price": 120.0, "qty": 2}
        ]
    }
    res = client.post("/api/orders", json=payload, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert res.status_code in (200, 201)
    data = res.json()
    assert "id" in data
    assert data["status"] == "placed"
    assert data["subtotal"] == 240.0
    # subtotal < 500 incurs 30.0 delivery fee
    assert data["delivery_fee"] == 30.0
    assert data["total"] == 270.0
    assert data["total_amount"] == 270.0
    assert "delivery_otp" in data
    assert len(data["delivery_otp"]) == 4


# ==============================================================================
# 2. DUPLICATE ORDER PREVENTION (IDEMPOTENCY)
# ==============================================================================

def test_duplicate_order_prevention():
    """Submitting the exact same order twice within the idempotency window returns the original order."""
    payload = {
        "customer_phone": CUSTOMER_A_PHONE,
        "delivery_address": "Idempotency Suite 101, Bengaluru",
        "items": [
            {"id": "prod-idem-1", "name": "Basmati Rice", "price": 90.0, "qty": 1}
        ]
    }
    # First submission
    res1 = client.post("/api/orders", json=payload, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert res1.status_code in (200, 201)
    order1 = res1.json()

    # Immediate second submission (rapid duplicate/retry)
    res2 = client.post("/api/orders", json=payload, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert res2.status_code in (200, 201)
    order2 = res2.json()

    # Must return the SAME order ID without creating duplicate DB entry
    assert order1["id"] == order2["id"]


# ==============================================================================
# 3. STRICT CUSTOMER ORDER ISOLATION
# ==============================================================================

def test_multi_customer_order_isolation():
    """Customer A and Customer B must never see each other's orders."""
    unique_suffix = uuid.uuid4().hex[:6]
    # 1. Customer A places an order
    order_a_payload = {
        "customer_phone": CUSTOMER_A_PHONE,
        "delivery_address": f"Alice House {unique_suffix}, Bengaluru",
        "items": [{"id": f"prod-alice-{unique_suffix}", "name": "Alice Apple", "price": 50.0, "qty": 1}]
    }
    res_a = client.post("/api/orders", json=order_a_payload, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert res_a.status_code in (200, 201)
    order_a = res_a.json()
    order_a_id = order_a["id"]

    # 2. Customer B places an order
    order_b_payload = {
        "customer_phone": CUSTOMER_B_PHONE,
        "delivery_address": f"Bob House {unique_suffix}, Bengaluru",
        "items": [{"id": f"prod-bob-{unique_suffix}", "name": "Bob Banana", "price": 60.0, "qty": 1}]
    }
    res_b = client.post("/api/orders", json=order_b_payload, headers={"Authorization": f"Bearer {CUSTOMER_B_TOKEN}"})
    assert res_b.status_code in (200, 201)
    order_b = res_b.json()
    order_b_id = order_b["id"]

    # 3. Customer A queries their own history
    clean_a = "".join(filter(str.isdigit, CUSTOMER_A_PHONE))
    hist_a = client.get(f"/api/orders/user/{clean_a}", headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert hist_a.status_code == 200
    orders_for_a = hist_a.json()
    a_ids = [o.get("id") or o.get("rawId") for o in orders_for_a]
    assert order_a_id in a_ids
    assert order_b_id not in a_ids, "Customer B's order leaked into Customer A's history!"

    # 4. Customer B queries their own history
    clean_b = "".join(filter(str.isdigit, CUSTOMER_B_PHONE))
    hist_b = client.get(f"/api/orders/user/{clean_b}", headers={"Authorization": f"Bearer {CUSTOMER_B_TOKEN}"})
    assert hist_b.status_code == 200
    orders_for_b = hist_b.json()
    b_ids = [o.get("id") or o.get("rawId") for o in orders_for_b]
    assert order_b_id in b_ids
    assert order_a_id not in b_ids, "Customer A's order leaked into Customer B's history!"

    # 5. Customer A attempts to fetch Customer B's order details -> 403 Forbidden
    cross_details = client.get(f"/api/orders/{order_b_id}", headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert cross_details.status_code == 403, "Customer A accessed Customer B's order details!"

    # 6. Customer A attempts to query Customer B's history by phone -> 403 Forbidden
    cross_hist = client.get(f"/api/orders/user/{clean_b}", headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert cross_hist.status_code == 403, "Customer A accessed Customer B's phone history!"


# ==============================================================================
# 4. MULTIPLE ORDERS HISTORY & SORTING
# ==============================================================================

def test_multiple_orders_history_and_sorting():
    """Verify that multiple successive orders appear in history sorted newest first."""
    created_ids = []
    for i in range(3):
        p = {
            "customer_phone": CUSTOMER_A_PHONE,
            "delivery_address": f"Address #{i}",
            "items": [{"id": f"prod-multi-{uuid.uuid4().hex[:4]}", "name": f"Item {i}", "price": 30.0 + i, "qty": 1}]
        }
        r = client.post("/api/orders", json=p, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
        assert r.status_code in (200, 201)
        created_ids.append(r.json()["id"])

    clean_a = "".join(filter(str.isdigit, CUSTOMER_A_PHONE))
    hist = client.get(f"/api/orders/user/{clean_a}", headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert hist.status_code == 200
    orders = hist.json()
    assert isinstance(orders, list)

    order_ids = [o.get("id") or o.get("rawId") for o in orders]
    for cid in created_ids:
        assert cid in order_ids

    # Verify descending sort order by timestamp
    for idx in range(len(orders) - 1):
        t1 = orders[idx].get("created_at") or ""
        t2 = orders[idx + 1].get("created_at") or ""
        assert t1 >= t2, f"Orders not sorted newest first: {t1} < {t2}"


# ==============================================================================
# 5. ORDER DETAILS GET /orders/{order_id}
# ==============================================================================

def test_order_details_retrieval_and_404():
    """GET /orders/{order_id} retrieves complete order; non-existent order returns 404."""
    # 1. Place order
    p = {
        "customer_phone": CUSTOMER_A_PHONE,
        "delivery_address": "Details Suite 99",
        "items": [{"id": f"prod-det-{uuid.uuid4().hex[:4]}", "name": "Details Item", "price": 85.0, "qty": 2}]
    }
    c_res = client.post("/api/orders", json=p, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert c_res.status_code in (200, 201)
    order_id = c_res.json()["id"]

    # 2. Get order details
    d_res = client.get(f"/api/orders/{order_id}", headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert d_res.status_code == 200
    det = d_res.json()
    assert det["id"] == order_id
    assert det["subtotal"] == 170.0
    assert det["total"] == 200.0  # 170 + 30 delivery fee
    assert len(det["items"]) == 1
    assert det["items"][0]["qty"] == 2

    # 3. Non-existent order returns 404
    fake_id = str(uuid.uuid4())
    nf_res = client.get(f"/api/orders/{fake_id}", headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert nf_res.status_code == 404


# ==============================================================================
# 6. ORDER STATUS STATE MACHINE & TERMINAL LOCKOUT
# ==============================================================================

def test_status_state_machine_invalid_transitions():
    """Terminal orders (delivered, cancelled) cannot be reverted or transitioned."""
    # 1. Place order
    p = {
        "customer_phone": CUSTOMER_A_PHONE,
        "delivery_address": "State Machine Avenue",
        "items": [{"id": f"prod-st-{uuid.uuid4().hex[:4]}", "name": "Status Item", "price": 60.0, "qty": 1}]
    }
    c_res = client.post("/api/orders", json=p, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    order_id = c_res.json()["id"]

    # 2. Advance to confirmed -> preparing -> ready_for_pickup -> out_for_delivery -> delivered
    client.patch(f"/api/orders/{order_id}/status", json={"status": "confirmed"}, headers={"Authorization": f"Bearer {SELLER_TOKEN}"})
    client.patch(f"/api/orders/{order_id}/status", json={"status": "preparing"}, headers={"Authorization": f"Bearer {SELLER_TOKEN}"})
    client.patch(f"/api/orders/{order_id}/status", json={"status": "ready_for_pickup"}, headers={"Authorization": f"Bearer {SELLER_TOKEN}"})
    client.patch(f"/api/orders/{order_id}/status", json={"status": "out_for_delivery"}, headers={"Authorization": f"Bearer {SELLER_TOKEN}"})
    deliv_res = client.patch(f"/api/orders/{order_id}/status", json={"status": "delivered"}, headers={"Authorization": f"Bearer {SELLER_TOKEN}"})
    assert deliv_res.status_code == 200

    # 3. Invalid transition: delivered -> processing/preparing -> 409 Conflict
    rev_res = client.patch(f"/api/orders/{order_id}/status", json={"status": "preparing"}, headers={"Authorization": f"Bearer {SELLER_TOKEN}"})
    assert rev_res.status_code == 409, "Delivered order was illegally reverted to preparing!"

    # 4. Invalid transition: delivered -> pending/placed -> 409 Conflict
    rev_res2 = client.patch(f"/api/orders/{order_id}/status", json={"status": "placed"}, headers={"Authorization": f"Bearer {SELLER_TOKEN}"})
    assert rev_res2.status_code == 409, "Delivered order was illegally reverted to placed!"

    # 5. Advancement of step on delivered order -> 409 Conflict
    step_res = client.patch(f"/api/delivery/{order_id}/step", json={"step": "EN_ROUTE"}, headers={"Authorization": f"Bearer {RIDER_TOKEN}"})
    assert step_res.status_code == 409, "Delivery step was allowed on already delivered order!"


def test_cancelled_order_lockout():
    """Cancelled order cannot be transitioned to confirmed or have OTP verified."""
    p = {
        "customer_phone": CUSTOMER_A_PHONE,
        "delivery_address": "Cancel Avenue",
        "items": [{"id": f"prod-canc-{uuid.uuid4().hex[:4]}", "name": "Cancel Item", "price": 70.0, "qty": 1}]
    }
    c_res = client.post("/api/orders", json=p, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    order_id = c_res.json()["id"]

    # Customer cancels their own order
    cancel_res = client.patch(f"/api/orders/{order_id}/status", json={"status": "cancelled"}, headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert cancel_res.status_code == 200

    # Attempt to confirm cancelled order -> 409 Conflict
    conf_res = client.patch(f"/api/orders/{order_id}/status", json={"status": "confirmed"}, headers={"Authorization": f"Bearer {SELLER_TOKEN}"})
    assert conf_res.status_code == 409, "Cancelled order was illegally confirmed!"

    # Attempt to verify OTP on cancelled order -> 409 Conflict
    otp_res = client.patch(f"/api/orders/{order_id}/verify-otp", json={"otp": "1234"}, headers={"Authorization": f"Bearer {RIDER_TOKEN}"})
    assert otp_res.status_code == 409, "OTP verification was allowed on cancelled order!"


# ==============================================================================
# 7. ADMIN / SELLER STORE ORDER QUEUE
# ==============================================================================

def test_seller_store_orders_queue_access():
    """Seller and Admin tokens can view the store orders queue across all statuses."""
    res = client.get("/api/store/orders", headers={"Authorization": f"Bearer {SELLER_TOKEN}"})
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


# ==============================================================================
# 8. PAGINATION
# ==============================================================================

def test_order_history_pagination():
    """Verify page and limit query parameters."""
    clean_a = "".join(filter(str.isdigit, CUSTOMER_A_PHONE))
    paged_res = client.get(f"/api/orders/user/{clean_a}?page=1&limit=2", headers={"Authorization": f"Bearer {CUSTOMER_A_TOKEN}"})
    assert paged_res.status_code == 200
    orders = paged_res.json()
    assert isinstance(orders, list)
    assert len(orders) <= 2
