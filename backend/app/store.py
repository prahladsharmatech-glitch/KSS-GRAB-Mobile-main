"""Thin PostgREST client: API code stays independent from a specific ORM."""
import logging
import httpx
from fastapi import HTTPException
from .config import settings

logger = logging.getLogger(__name__)


class Store:
    def __init__(self):
        cfg = settings()
        self.base = cfg.supabase_url.rstrip("/") + "/rest/v1"

        anon_key = cfg.supabase_publishable_key
        service_key = cfg.supabase_service_key

        if not service_key:
            logger.warning(
                "SUPABASE_SERVICE_KEY is not set. Falling back to the anon/publishable "
                "key for DB writes. This will fail on any table with RLS enabled "
                "(orders, profiles, partner_documents). "
                "Set SUPABASE_SERVICE_KEY in backend/.env to fix this."
            )
        # Reads — anon key is fine; Supabase enforces RLS on SELECT for public data
        self._read_headers = {
            "apikey": anon_key,
            "Authorization": f"Bearer {anon_key}",
            "Content-Type": "application/json",
            "Accept-Profile": "public",
            "Content-Profile": "public",
        }

        # Writes — must use service role key to bypass RLS on INSERT/PATCH/DELETE
        # Falls back to anon key with a loud warning if service key not configured
        write_key = service_key if service_key else anon_key
        self._write_headers = {
            "apikey": write_key,
            "Authorization": f"Bearer {write_key}",
            "Content-Type": "application/json",
            "Accept-Profile": "public",
            "Content-Profile": "public",
        }

    async def get(self, table, params=None):
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(
                f"{self.base}/{table}",
                headers=self._read_headers,
                params=params or {},
            )
        if response.is_error:
            detail = (
                response.json().get("message", response.text)
                if response.headers.get("content-type", "").startswith("application/json")
                else response.text
            )
            raise HTTPException(502, f"Database request failed: {detail}")
        return response.json()

    async def insert(self, table, payload):
        headers = self._write_headers | {"Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(
                f"{self.base}/{table}",
                headers=headers,
                json=payload,
            )
        if response.is_error:
            detail = (
                response.json().get("message", response.text)
                if response.headers.get("content-type", "").startswith("application/json")
                else response.text
            )
            raise HTTPException(502, f"Database write failed: {detail}")
        rows = response.json()
        return rows[0] if isinstance(rows, list) else rows

    async def patch(self, table, payload, params):
        headers = self._write_headers | {"Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.patch(
                f"{self.base}/{table}",
                headers=headers,
                params=params,
                json=payload,
            )
        if response.is_error:
            detail = (
                response.json().get("message", response.text)
                if response.headers.get("content-type", "").startswith("application/json")
                else response.text
            )
            raise HTTPException(502, f"Database update failed: {detail}")
        return response.json()

    async def delete(self, table, params):
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.delete(
                f"{self.base}/{table}",
                headers=self._write_headers,
                params=params,
            )
        if response.is_error:
            detail = (
                response.json().get("message", response.text)
                if response.headers.get("content-type", "").startswith("application/json")
                else response.text
            )
            raise HTTPException(502, f"Database delete failed: {detail}")


store = Store()
