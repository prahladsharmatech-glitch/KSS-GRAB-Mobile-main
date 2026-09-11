from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    All configuration is loaded from environment variables.
    Priority order (highest to lowest):
      1. OS environment variables  (e.g. set in production hosting dashboard)
      2. backend/.env file         (local development — git-ignored)
      3. Field defaults below      (only for non-secret, public config)

    Fields with NO default (no `default=` argument) MUST be set in the
    environment or .env. The app will refuse to start if they are missing.
    """
    model_config = SettingsConfigDict(
        env_file=[".env", "backend/.env", "../.env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Supabase ──────────────────────────────────────────────────────────────
    # Project URL — not a secret, but environment-specific
    supabase_url: str = Field(
        default="https://vhcmjwuhdcdxqmyjvqpz.supabase.co",
        alias="SUPABASE_URL",
    )

    # Anon/publishable key — safe for client-facing reads; enforces RLS
    # Kept as a fallback for local dev convenience; rotate immediately if leaked
    supabase_publishable_key: str = Field(
        default="sb_publishable__liWsDpEneX70mTGaYabSQ_B8J-B3fy",
        alias="SUPABASE_PUBLISHABLE_KEY",
    )

    # Service role key — bypasses RLS for all backend writes
    # NO default — must be set in backend/.env or hosting env vars
    # Get from: Supabase Dashboard → Project Settings → API → service_role (secret)
    supabase_service_key: str = Field(default="", alias="SUPABASE_SERVICE_KEY")

    # ── Upstash Redis ─────────────────────────────────────────────────────────
    # Endpoint URL — not a secret
    upstash_redis_rest_url: str = Field(
        default="https://right-elf-90042.upstash.io",
        alias="UPSTASH_REDIS_REST_URL",
    )

    # REST token IS a secret — NO hardcoded default
    # Anyone with this token can read/write/flush your entire Redis cache
    upstash_redis_rest_token: str = Field(default="", alias="UPSTASH_REDIS_REST_TOKEN")

    # ── Cloudinary ────────────────────────────────────────────────────────────
    # Full URL contains api_key + api_secret — NO hardcoded default
    # Anyone with this can upload/delete unlimited media on your account
    cloudinary_url: str = Field(default="", alias="CLOUDINARY_URL")

    # ── JWT ───────────────────────────────────────────────────────────────────
    # Must be a cryptographically strong random string — NO hardcoded default
    # Anyone who knows this can forge tokens for any role (admin, seller, etc.)
    # Generate a new one: python -c "import secrets; print(secrets.token_hex(48))"
    jwt_secret: str = Field(default="", alias="JWT_SECRET")

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: str = Field(
        default=(
            "https://grabit-main.vercel.app,"
            "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
            "http://localhost:3000,"
            "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175"
        ),
        alias="CORS_ORIGINS",
    )

    # Set to False in production to reject all demo/* tokens
    otp_debug: bool = Field(default=True, alias="OTP_DEBUG")

    @property
    def origins(self) -> list[str]:
        return [v.strip() for v in self.cors_origins.split(",") if v.strip()]

    def validate_secrets(self) -> None:
        """
        Called at app startup (via lifespan handler) to fail fast with a
        clear error rather than silently serving traffic with missing secrets.
        """
        import logging
        _log = logging.getLogger(__name__)

        missing_critical: list[str] = []

        if not self.jwt_secret:
            missing_critical.append(
                "JWT_SECRET — generate with: "
                "python -c \"import secrets; print(secrets.token_hex(48))\""
            )
        if not self.cloudinary_url:
            missing_critical.append("CLOUDINARY_URL")
        if not self.upstash_redis_rest_token:
            missing_critical.append("UPSTASH_REDIS_REST_TOKEN")

        if missing_critical:
            lines = "\n  • ".join(missing_critical)
            raise RuntimeError(
                f"Server cannot start — critical secrets are missing from the environment:\n"
                f"  • {lines}\n"
                f"Add them to backend/.env and restart."
            )

        # Non-critical — app works but DB writes to RLS-protected tables will fail
        if not self.supabase_service_key:
            _log.warning(
                "SUPABASE_SERVICE_KEY is not set. "
                "INSERT/PATCH/DELETE on RLS-protected tables (orders, profiles, "
                "partner_documents) will fail with 401/403. "
                "Get it from: Supabase Dashboard → Project Settings → API → service_role"
            )


@lru_cache
def settings() -> Settings:
    return Settings()
