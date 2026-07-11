# /backend/tests/test_security.py
# Unit tests for ANFA Security Module
# Tests: HMAC signature verification, password hashing, JWT lifecycle

import hmac
import hashlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token,
)


# =============================================================================
# PASSWORD HASHING TESTS
# =============================================================================

class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        """Password hash must never equal the original plaintext."""
        password = "supersecretpassword123"
        hashed = hash_password(password)
        assert hashed != password

    def test_correct_password_verifies(self):
        """Correct password must pass verification."""
        password = "correctpassword"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_wrong_password_fails(self):
        """Wrong password must fail verification."""
        hashed = hash_password("correctpassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_two_hashes_of_same_password_are_different(self):
        """Each hash must use a unique salt (no rainbow table vulnerability)."""
        password = "same_password"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2  # Different salts produce different hashes


# =============================================================================
# JWT TOKEN TESTS
# =============================================================================

class TestJWTTokens:
    def test_create_and_verify_token(self):
        """Token created with valid data must decode successfully."""
        token = create_access_token({"sub": "test-agent-id", "role": "admin"})
        assert isinstance(token, str)
        assert len(token) > 0

    @pytest.mark.asyncio
    async def test_valid_token_returns_payload(self):
        """Verify access token returns correct payload for valid JWT."""
        token = create_access_token({"sub": "agent-123", "role": "agent"})
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        payload = await verify_access_token(credentials)
        assert payload["sub"] == "agent-123"
        assert payload["role"] == "agent"

    @pytest.mark.asyncio
    async def test_missing_credentials_raises_401(self):
        """Missing auth header must raise 401 Unauthorized."""
        with pytest.raises(HTTPException) as exc_info:
            await verify_access_token(None)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        """Tampered or invalid JWT must raise 401 Unauthorized."""
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials="this.is.not.a.valid.jwt"
        )
        with pytest.raises(HTTPException) as exc_info:
            await verify_access_token(credentials)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_raises_401(self):
        """Expired JWT must raise 401 Unauthorized."""
        from datetime import timedelta
        token = create_access_token({"sub": "agent-exp"}, expires_delta=timedelta(seconds=-1))
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc_info:
            await verify_access_token(credentials)
        assert exc_info.value.status_code == 401


# =============================================================================
# WEBHOOK HMAC SIGNATURE TESTS
# =============================================================================

class TestWebhookSignature:
    def _compute_valid_signature(self, secret: str, body: bytes) -> str:
        """Helper: compute a valid Meta-style HMAC-SHA256 signature."""
        return "sha256=" + hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()

    @pytest.mark.asyncio
    async def test_valid_signature_passes(self):
        """Valid HMAC-SHA256 signature must not raise any exception."""
        from app.core.security import verify_webhook_signature

        secret = "test_app_secret"
        body = b'{"object":"whatsapp_business_account","entry":[]}'
        valid_sig = self._compute_valid_signature(secret, body)

        # Mock the request
        mock_request = MagicMock()
        mock_request.headers.get.return_value = valid_sig
        mock_request.body = AsyncMock(return_value=body)

        # Mock Redis returning the credentials
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=lambda key: (
            secret.encode() if "app_secret" in key else b"verify_token"
        ))

        # Should not raise
        await verify_webhook_signature(mock_request, "phone123", mock_redis)

    @pytest.mark.asyncio
    async def test_missing_signature_raises_401(self):
        """Webhook without signature header must be rejected with 401."""
        from app.core.security import verify_webhook_signature

        mock_request = MagicMock()
        mock_request.headers.get.return_value = None  # No signature header
        mock_request.body = AsyncMock(return_value=b"{}")
        mock_redis = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_signature(mock_request, "phone123", mock_redis)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_wrong_signature_raises_401(self):
        """Forged or tampered signature must be rejected with 401."""
        from app.core.security import verify_webhook_signature

        body = b'{"entry":[]}'
        mock_request = MagicMock()
        mock_request.headers.get.return_value = "sha256=deafbeefdeadbeefdeadbeef"
        mock_request.body = AsyncMock(return_value=body)

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=lambda key: (
            b"real_secret" if "app_secret" in key else b"verify_token"
        ))

        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_signature(mock_request, "phone123", mock_redis)
        assert exc_info.value.status_code == 401
