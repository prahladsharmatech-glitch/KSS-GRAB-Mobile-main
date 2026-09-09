from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[".env", "backend/.env", "../.env"],
        extra="ignore"
    )
    supabase_url: str = os.getenv("SUPABASE_URL", "https://vhcmjwuhdcdxqmyjvqpz.supabase.co")
    supabase_publishable_key: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable__liWsDpEneX70mTGaYabSQ_B8J-B3fy")
    next_public_supabase_url: str = "https://vhcmjwuhdcdxqmyjvqpz.supabase.co"
    next_public_supabase_publishable_key: str = "sb_publishable__liWsDpEneX70mTGaYabSQ_B8J-B3fy"
    upstash_redis_rest_url: str = "https://right-elf-90042.upstash.io"
    upstash_redis_rest_token: str = "gQAAAAAAAV-6AAIgcDE1Zjc1ZmVkNThiZjU0ODYyOGRkZDIzNGQ3YjBmYzdiZg"
    cloudinary_url: str = "cloudinary://562757386132896:gTGcPuy7hpkPtqzpRiNazSkfh04@hmx3azp6"
    jwt_secret: str = "grabit-super-secure-jwt-secret-key-2026"
    cors_origins: str = "https://grabit-main.vercel.app,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175"
    otp_debug: bool = True

    @property
    def origins(self):
        return [v.strip() for v in self.cors_origins.split(",") if v.strip()]

@lru_cache
def settings() -> Settings:
    return Settings()
