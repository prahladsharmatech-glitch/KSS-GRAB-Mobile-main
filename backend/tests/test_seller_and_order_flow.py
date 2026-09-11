import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_store_orders_route_returns_200(client):
    seller_headers = {"Authorization": "Bearer seller-token"}
    response = client.get("/store/orders", headers=seller_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_seller_orders_route_returns_200(client):
    seller_headers = {"Authorization": "Bearer seller-token"}
    response = client.get("/seller/orders", headers=seller_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_seller_profile_endpoint(client):
    seller_headers = {"Authorization": "Bearer seller-token"}
    response = client.get("/seller/profile", headers=seller_headers)
    assert response.status_code == 200
    profile = response.json()
    assert "store_name" in profile
    assert "manager_name" in profile
    assert "phone" in profile
    assert profile["manager_name"] == "John Seller"
    assert profile["phone"] == "+919999900002"

import asyncio
from backend.app.store import store

def test_customer_to_seller_order_flow(client):
    customer_headers = {"Authorization": "Bearer customer-token"}
    seller_headers = {"Authorization": "Bearer seller-token"}

    # Place new customer order
    order_payload = {
        "customer_phone": "+919999900004",
        "customer_name": "Rahul Customer",
        "delivery_address": "Indiranagar, Bangalore",
        "total_amount": 99.0,
        "store_id": "b5c9ff6b-1f64-405f-a25d-54dc6ea77bbb",
        "items": [
            {"product_id": "p-1", "name": "Fresh Bananas", "price": 49.0, "quantity": 1},
            {"product_id": "p-2", "name": "Organic Chips", "price": 50.0, "quantity": 1}
        ],
        "payment_method": "UPI",
        "status": "placed"
    }

    order_id = None
    try:
        place_resp = client.post("/api/orders", json=order_payload, headers=customer_headers)
        assert place_resp.status_code in (200, 201)
        placed_order = place_resp.json()
        order_id = placed_order.get("id") or placed_order.get("rawId")
        assert order_id is not None

        # Fetch store orders as seller
        store_orders_resp = client.get("/store/orders", headers=seller_headers)
        assert store_orders_resp.status_code == 200
        orders = store_orders_resp.json()
        assert isinstance(orders, list)
        
        order_ids = [str(o.get("id") or o.get("rawId") or '') for o in orders]
        found = any(order_id in oid or oid in order_id for oid in order_ids)
        assert found is True
    finally:
        if order_id:
            async def _cleanup():
                try:
                    await store.delete("orders", {"id": f"eq.{order_id}"})
                except Exception:
                    pass
            asyncio.run(_cleanup())
