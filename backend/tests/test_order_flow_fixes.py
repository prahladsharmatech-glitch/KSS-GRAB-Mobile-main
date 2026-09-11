import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.security import create_token

client = TestClient(app)

CUSTOMER_TOKEN = create_token({"sub": "b0cf5967-7bf0-4ce0-9d74-220c59bc6798", "role": "customer", "phone": "+919999900004", "name": "Rahul Customer"})
SELLER_TOKEN = create_token({"sub": "seller-1", "role": "seller", "phone": "+919999900002", "name": "Priya Seller"})
RIDER_TOKEN = create_token({"sub": "rider-1", "role": "delivery_agent", "phone": "+919999900003", "name": "Karthik Rider"})


def test_customer_order_creation_and_otp():
    """Verify that placing an order generates a 4-digit delivery OTP and persists it."""
    order_payload = {
        "items": [
            {"id": "prod-1", "name": "Fresh Milk", "price": 40.0, "qty": 2}
        ],
        "delivery_address": "Flat 402, Sunshine Apartments, Bengaluru",
        "payment_method": "UPI",
        "customer_phone": "+919999900004",
        "customer_name": "Rahul Customer"
    }
    res = client.post(
        "/api/orders",
        json=order_payload,
        headers={"Authorization": f"Bearer {CUSTOMER_TOKEN}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "id" in data
    order_id = data["id"]
    assert "delivery_otp" in data
    assert len(data["delivery_otp"]) == 4
    assert data["delivery_otp"].isdigit()


def test_customer_order_history_no_crash():
    """Verify customer order history does not crash with 502/PostgREST column error."""
    res = client.get(
        "/api/orders?phone=9999900004",
        headers={"Authorization": f"Bearer {CUSTOMER_TOKEN}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)
    # If customer placed an order, it should be present
    if len(data) > 0:
        assert any(o.get("customer_phone") and "9999900004" in str(o.get("customer_phone")) for o in data)


def test_get_single_order_by_id():
    """Verify GET /orders/{order_id} retrieves full order with items and OTP."""
    # 1. Create an order
    order_payload = {
        "items": [
            {"id": "prod-2", "name": "Brown Bread", "price": 45.0, "qty": 1}
        ],
        "delivery_address": "123 Indiranagar, Bengaluru",
        "customer_phone": "+919999900004",
        "customer_name": "Rahul Customer"
    }
    create_res = client.post(
        "/api/orders",
        json=order_payload,
        headers={"Authorization": f"Bearer {CUSTOMER_TOKEN}"}
    )
    assert create_res.status_code == 200
    created = create_res.json()
    order_id = created["id"]

    # 2. Fetch single order via /api/orders/{order_id}
    get_res = client.get(
        f"/api/orders/{order_id}",
        headers={"Authorization": f"Bearer {CUSTOMER_TOKEN}"}
    )
    assert get_res.status_code == 200, get_res.text
    fetched = get_res.json()
    assert fetched["id"] == order_id
    assert fetched["status"] == "placed"
    assert "items" in fetched and len(fetched["items"]) > 0
    assert fetched["delivery_otp"] == created["delivery_otp"]

    # 3. Also verify root path /orders/{order_id}
    root_res = client.get(
        f"/orders/{order_id}",
        headers={"Authorization": f"Bearer {CUSTOMER_TOKEN}"}
    )
    assert root_res.status_code == 200


def test_seller_orders_list_merges_orders():
    """Verify seller order queue returns orders."""
    res = client.get(
        "/api/store/orders",
        headers={"Authorization": f"Bearer {SELLER_TOKEN}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)


def test_rider_profile_and_status():
    """Verify GET /delivery/agent/me and PATCH /delivery/agent/status."""
    # 1. Get profile
    me_res = client.get(
        "/api/delivery/agent/me",
        headers={"Authorization": f"Bearer {RIDER_TOKEN}"}
    )
    assert me_res.status_code == 200, me_res.text
    profile = me_res.json()
    assert "phone" in profile or "user" in profile

    # 2. Update status to online
    patch_res = client.patch(
        "/api/delivery/agent/status",
        json={"is_online": True, "agent_status": "AVAILABLE"},
        headers={"Authorization": f"Bearer {RIDER_TOKEN}"}
    )
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["is_online"] is True

    # 3. Update payout profile UPI
    payout_res = client.patch(
        "/api/delivery/payout-profile",
        json={"upi_id": "karthik.rider@okaxis"},
        headers={"Authorization": f"Bearer {RIDER_TOKEN}"}
    )
    assert payout_res.status_code == 200, payout_res.text
    assert payout_res.json()["upi_id"] == "karthik.rider@okaxis"


def test_rider_delivery_workflow_and_otp_verification():
    """Verify rider workflow step transitions and OTP verification."""
    # 1. Place order
    order_payload = {
        "items": [{"id": "prod-1", "name": "Fresh Milk", "price": 40.0, "qty": 1}],
        "delivery_address": "Koramangala 4th Block",
        "customer_phone": "+919999900004",
        "customer_name": "Rahul Customer"
    }
    c_res = client.post(
        "/api/orders",
        json=order_payload,
        headers={"Authorization": f"Bearer {CUSTOMER_TOKEN}"}
    )
    assert c_res.status_code == 200
    order = c_res.json()
    order_id = order["id"]
    otp = order["delivery_otp"]

    # 2. Accept order
    assign_res = client.post(
        f"/api/delivery/{order_id}/accept",
        headers={"Authorization": f"Bearer {RIDER_TOKEN}"}
    )
    assert assign_res.status_code == 200

    # 3. Advance steps: REACH_STORE -> STORE_CHECKLIST -> EN_ROUTE
    step_res = client.patch(
        f"/api/delivery/{order_id}/step",
        json={"step": "EN_ROUTE"},
        headers={"Authorization": f"Bearer {RIDER_TOKEN}"}
    )
    assert step_res.status_code == 200
    assert step_res.json()["order_status"] == "out_for_delivery"

    # 4. Verify wrong OTP fails with 400
    wrong_otp_res = client.patch(
        f"/api/orders/{order_id}/verify-otp",
        json={"otp": "9999"},
        headers={"Authorization": f"Bearer {RIDER_TOKEN}"}
    )
    # Unless 9999 happens to be last 4 of phone (which is 0004) or otp, it must fail
    if otp != "9999":
        assert wrong_otp_res.status_code == 400

    # 5. Verify correct OTP succeeds
    correct_otp_res = client.patch(
        f"/api/orders/{order_id}/verify-otp",
        json={"otp": otp, "proof_photo_url": "https://example.com/proof.jpg"},
        headers={"Authorization": f"Bearer {RIDER_TOKEN}"}
    )
    assert correct_otp_res.status_code == 200
    assert correct_otp_res.json()["status"] == "delivered"
    assert correct_otp_res.json()["verified"] is True

    # 6. Verify order state is delivered
    final_res = client.get(
        f"/api/orders/{order_id}",
        headers={"Authorization": f"Bearer {CUSTOMER_TOKEN}"}
    )
    assert final_res.status_code == 200
    assert final_res.json()["status"] == "delivered"
