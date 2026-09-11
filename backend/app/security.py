from datetime import datetime, timedelta, timezone
import logging
import jwt
from fastapi import HTTPException, Header
from .config import settings

logger = logging.getLogger(__name__)

# Demo tokens are ONLY valid when OTP_DEBUG=true (local development).
# In production (OTP_DEBUG=false) these are rejected — real JWTs required.
_DEMO_TOKENS: dict[str, dict] = {
    "demo-token":            {"sub": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", "role": "admin",          "name": "GrabIt Master Admin",       "phone": "+919999900001"},
    "demo-admin-token":      {"sub": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", "role": "admin",          "name": "GrabIt Master Admin",       "phone": "+919999900001"},
    "admin-token":           {"sub": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", "role": "admin",          "name": "GrabIt Master Admin",       "phone": "+919999900001"},
    "demo-seller-token":     {"sub": "c8d0412d-5c3d-489d-8e43-0dc5dcf90389", "role": "seller",         "name": "Fresh Mart Supermarket",    "phone": "+919999900002"},
    "seller-token":          {"sub": "c8d0412d-5c3d-489d-8e43-0dc5dcf90389", "role": "seller",         "name": "Fresh Mart Supermarket",    "phone": "+919999900002"},
    "demo-delivery-token":   {"sub": "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a", "role": "delivery_agent", "name": "Karthik Rider",            "phone": "+919999900003"},
    "delivery-token":        {"sub": "d7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a", "role": "delivery_agent", "name": "Karthik Rider",            "phone": "+919999900003"},
    "demo-customer-token":   {"sub": "b0cf5967-7bf0-4ce0-9d74-220c59bc6798", "role": "customer",       "name": "Rahul Customer",           "phone": "+919999900004"},
    "customer-token":        {"sub": "b0cf5967-7bf0-4ce0-9d74-220c59bc6798", "role": "customer",       "name": "Rahul Customer",           "phone": "+919999900004"},
}


def create_token(profile: dict) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(profile.get("id") or profile.get("sub") or ""),
        "role": profile.get("role", "customer"),
        "phone": str(profile.get("phone") or ""),
        "name": str(profile.get("full_name") or profile.get("name") or ""),
        "iat": now,
        "exp": now + timedelta(days=7)
    }
    secret = settings().jwt_secret
    if not secret:
        raise RuntimeError(
            "JWT_SECRET is not configured. Set it in backend/.env before issuing tokens."
        )
    return jwt.encode(claims, secret, algorithm="HS256")


def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    raw_token = authorization[7:].strip()

    # Demo tokens — only accepted in debug/development mode
    if raw_token in _DEMO_TOKENS:
        cfg = settings()
        if not cfg.otp_debug:
            logger.warning(
                "Rejected demo token '%s' — OTP_DEBUG is false (production mode).",
                raw_token,
            )
            raise HTTPException(
                401,
                "Demo tokens are not accepted in production. Please log in with a real account."
            )
        return dict(_DEMO_TOKENS[raw_token])

    # Real JWT — validate with the configured secret
    secret = settings().jwt_secret
    if not secret:
        raise HTTPException(
            500,
            "Server misconfiguration: JWT_SECRET is not set. Contact the administrator."
        )
    try:
        data = jwt.decode(raw_token, secret, algorithms=["HS256"])
        # Normalise delivery role alias
        if data.get("role") == "delivery_partner":
            data["role"] = "delivery_agent"
        return data
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired. Please log in again.")
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Session expired or invalid") from exc


def require_roles(*roles):
    allowed = set(roles)
    # Normalise role aliases
    if "delivery_agent" in allowed or "delivery_partner" in allowed:
        allowed.update({"delivery_agent", "delivery_partner"})
    if "seller" in allowed or "merchant" in allowed:
        allowed.update({"seller", "merchant"})
    # Admin can always access all endpoints
    allowed.add("admin")

    def check(user: dict = __import__("fastapi").Depends(current_user)):
        if user.get("role") not in allowed:
            raise HTTPException(403, "Insufficient permissions")
        return user

    return check
