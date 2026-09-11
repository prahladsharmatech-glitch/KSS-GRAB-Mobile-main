from pydantic import BaseModel, Field
from typing import Literal

class PhoneRequest(BaseModel): phone: str = Field(pattern=r"^\+?[1-9]\d{7,14}$")
class RegistrationRequest(PhoneRequest): full_name: str = Field(min_length=2, max_length=100); email: str | None = None
class VerifyOtpRequest(PhoneRequest): otp: str = Field(pattern=r"^\d{6}$"); full_name: str | None = None; email: str | None = None
class CartSyncRequest(BaseModel): phone: str; items: list
class CartItemRequest(BaseModel): product_id: str; quantity: int = Field(ge=1, le=50)
class OrderRequest(BaseModel):
    id: str | None = None
    rawId: str | None = None
    display_id: str | None = None
    displayId: str | None = None
    order_number: str | None = None
    orderNumber: str | None = None
    store_id: str | None = None
    delivery_address: str | None = "Delivery Address"
    latitude: float | None = 12.9716
    longitude: float | None = 77.5946
    items: list | None = []
    total_amount: float | None = None
    total: float | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    payment_method: str | None = "UPI"
    status: str | None = "placed"
    coupon: str | None = None
    coupon_code: str | None = None
class ProductRequest(BaseModel):
    name: str
    price: float = Field(gt=0)
    stock: int = Field(default=0, ge=0)
    category_id: str | None = None
    image_url: str | None = None

class ProductUpdateRequest(BaseModel):
    name: str | None = None
    price: float | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)
    category_id: str | None = None
    image_url: str | None = None

class CategoryRequest(BaseModel):
    name: str
    image_url: str | None = None

from enum import Enum

class OrderStatus(str, Enum):
    PLACED = "placed"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"
    FAILED_DELIVERY = "failed_delivery"

class StatusRequest(BaseModel):
    status: OrderStatus | str
    delivery_agent_id: str | None = None

class AssignOrderRequest(BaseModel):
    delivery_agent_id: str
    rider_name: str | None = None

class BulkAssignRequest(BaseModel):
    order_ids: list[str]
    delivery_agent_id: str
    rider_name: str | None = None
class ManagedUser(BaseModel): full_name: str; phone: str; role: Literal["seller", "delivery_agent"]
class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    email: str | None = None
    avatar_url: str | None = None
    selfie_image: str | None = None
    vehicle: str | None = None
    plate: str | None = None
    license_plate: str | None = None
    driving_license: str | None = None
    insurance_no: str | None = None
    bg_check_ref: str | None = None
    biometrics_done: bool | None = None
    clearances: dict | None = None
    clearance_timestamps: dict | None = None


