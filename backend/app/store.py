"""Thin PostgREST client: API code stays independent from a specific ORM."""
import httpx
from fastapi import HTTPException
from .config import settings


class Store:
    def __init__(self):
        cfg = settings()
        self.base = cfg.supabase_url.rstrip("/") + "/rest/v1"
        self.headers = {"apikey": cfg.supabase_publishable_key, "Authorization": f"Bearer {cfg.supabase_publishable_key}", "Content-Type": "application/json"}

    async def get(self, table, params=None):
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(f"{self.base}/{table}", headers=self.headers, params=params or {})
        if response.is_error:
            detail = response.json().get("message", response.text) if response.headers.get("content-type", "").startswith("application/json") else response.text
            raise HTTPException(502, f"Database request failed: {detail}")
        return response.json()

    async def insert(self, table, payload):
        headers = self.headers | {"Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(f"{self.base}/{table}", headers=headers, json=payload)
        if response.is_error:
            detail = response.json().get("message", response.text) if response.headers.get("content-type", "").startswith("application/json") else response.text
            raise HTTPException(502, f"Database write failed: {detail}")
        rows = response.json()
        return rows[0] if isinstance(rows, list) else rows

    async def patch(self, table, payload, params):
        headers = self.headers | {"Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.patch(f"{self.base}/{table}", headers=headers, params=params, json=payload)
        if response.is_error:
            detail = response.json().get("message", response.text) if response.headers.get("content-type", "").startswith("application/json") else response.text
            raise HTTPException(502, f"Database update failed: {detail}")
        return response.json()

    async def delete(self, table, params):
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.delete(f"{self.base}/{table}", headers=self.headers, params=params)
        if response.is_error:
            detail = response.json().get("message", response.text) if response.headers.get("content-type", "").startswith("application/json") else response.text
            raise HTTPException(502, f"Database delete failed: {detail}")

store = Store()
