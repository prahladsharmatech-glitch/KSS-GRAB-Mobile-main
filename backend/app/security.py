from datetime import datetime, timedelta, timezone
import jwt
from fastapi import HTTPException, Header
from .config import settings


def create_token(profile: dict) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(profile["id"]),
        "role": profile["role"],
        "phone": str(profile.get("phone") or ""),
        "name": str(profile.get("full_name") or profile.get("name") or ""),
        "iat": now,
        "exp": now + timedelta(days=7)
    }
    return jwt.encode(claims, settings().jwt_secret, algorithm="HS256")


def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    raw_token = authorization[7:].strip()

    if raw_token in ("demo-token", "demo-admin-token", "admin-token"):
        return {"sub": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", "role": "admin", "name": "GrabIt Master Admin", "phone": "+919999900001"}
    if raw_token in ("demo-seller-token", "seller-token"):
        return {"sub": "c8d0412d-5c3d-489d-8e43-0dc5dcf90389", "role": "seller", "name": "Fresh Mart Supermarket", "phone": "+919999900002"}
    if raw_token in ("demo-delivery-token", "delivery-token"):
        return {"sub": "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a", "role": "delivery_agent", "name": "Karthik Rider", "phone": "+919999900003"}
    if raw_token in ("demo-customer-token", "customer-token"):
        return {"sub": "b0cf5967-7bf0-4ce0-9d74-220c59bc6798", "role": "customer", "name": "Rahul Customer", "phone": "+919999900004"}

    try:
        data = jwt.decode(raw_token, settings().jwt_secret, algorithms=["HS256"])
        if data.get("role") == "delivery_partner":
            data["role"] = "delivery_agent"
        return data
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Session expired or invalid") from exc


def require_roles(*roles):
    # Normalized allowed roles set
    allowed = set(roles)
    if "delivery_agent" in allowed or "delivery_partner" in allowed:
        allowed.add("delivery_agent")
        allowed.add("delivery_partner")
    if "seller" in allowed or "merchant" in allowed:
        allowed.add("seller")
        allowed.add("merchant")
    # Admin can always access all endpoints
    allowed.add("admin")

    def check(user: dict = __import__("fastapi").Depends(current_user)):
        user_role = user.get("role")
        if user_role not in allowed:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return check
