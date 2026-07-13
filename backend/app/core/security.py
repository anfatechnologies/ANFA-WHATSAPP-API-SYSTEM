# /backend/app/core/security.py
# ANFA Security Module - Webhook Verification & Authentication
# All security-sensitive functions include inline security rationale comments.

import hmac
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
import redis.asyncio as redis
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

# =============================================================================
# PASSWORD HASHING
# =============================================================================

# Security Rationale: Use bcrypt with auto-generated salt rounds.
# bcrypt is resistant to GPU/ASIC attacks due to memory-hard design.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a password using bcrypt with automatic salt generation.
    
    Security Rationale: Salting prevents rainbow table attacks.
    Each hash uses a unique random salt, making precomputed tables useless.
    """
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash using constant-time comparison.
    
    Security Rationale: passlib's verify uses constant-time comparison
    internally to prevent timing side-channel attacks.
    """
    return _pwd_context.verify(plain_password, hashed_password)


# =============================================================================
# REDIS SECRET ENCRYPTION (AES-256-GCM)
# =============================================================================

def encrypt_redis_secret(secret: str) -> str:
    key_bytes = settings.ENCRYPTION_MASTER_KEY.encode('utf-8')[:32]
    if len(key_bytes) < 32:
        key_bytes = key_bytes.ljust(32, b'\0')
    aesgcm = AESGCM(key_bytes)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, secret.encode('utf-8'), None)
    return base64.b64encode(nonce + ciphertext).decode('utf-8')

def decrypt_redis_secret(encrypted_secret: str) -> str:
    if not encrypted_secret:
        return encrypted_secret
    try:
        key_bytes = settings.ENCRYPTION_MASTER_KEY.encode('utf-8')[:32]
        if len(key_bytes) < 32:
            key_bytes = key_bytes.ljust(32, b'\0')
        aesgcm = AESGCM(key_bytes)
        data = base64.b64decode(encrypted_secret.encode('utf-8'))
        nonce, ciphertext = data[:12], data[12:]
        return aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
    except Exception:
        # Fallback for old unencrypted secrets during migration
        return encrypted_secret


# =============================================================================
# JWT TOKEN MANAGEMENT
# =============================================================================

_security_scheme = HTTPBearer(auto_error=False)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with configurable expiration.
    
    Security Rationale: Short-lived tokens limit exposure window if compromised.
    The 'exp' claim enables automatic rejection of expired tokens without
    server-side state (stateless authentication).
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    
    # Security Rationale: HS256 provides sufficient security for stateless tokens
    # when the secret key is adequately strong (256+ bits).
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_jwt_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token. Raises HTTPException on failure.

    Extracted as a plain (non-Depends) function so it can be reused by
    both the FastAPI dependency (verify_access_token) and any endpoint
    that receives a token via query param (e.g. SSE /settings/live).
    Any future changes to token validation — role checks, revocation lists,
    audience/issuer requirements — should be made here and will apply
    everywhere automatically.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        if "sub" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject claim",
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_access_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security_scheme)) -> Dict[str, Any]:
    """Verify and decode a JWT access token from the Authorization header.

    Security Rationale: Uses jose library's secure JWT decoding with signature
    verification and expiration checking. Rejects tokens that are malformed,
    expired, or have invalid signatures.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_jwt_token(credentials.credentials)


# =============================================================================
# WEBHOOK SECURITY - META CLOUD API SIGNATURE VERIFICATION
# =============================================================================

async def fetch_meta_credentials(phone_number_id: str, redis_client: redis.Redis) -> Dict[str, str]:
    """Retrieve Meta credentials from Redis cache keyed by phone_number_id.
    
    Security Rationale: Dynamic credential lookup per phone_number_id eliminates
    the need for container configuration reloads. This prevents the security risk
    of mounting /var/run/docker.sock to reload Nginx configurations, which would
    grant container escape capabilities to the application.
    
    Redis-backed storage enables zero-downtime credential rotation:
    updating credentials in Redis immediately takes effect without restarts.
    """
    app_secret = await redis_client.get(f"settings:meta_credentials:{phone_number_id}:app_secret")
    verify_token = await redis_client.get(f"settings:meta_credentials:{phone_number_id}:verify_token")
    
    if not app_secret or not verify_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meta Credentials for phone number {phone_number_id} not found. "
                   "Configure credentials in Settings first."
        )
    
    return {
        "app_secret": decrypt_redis_secret(app_secret.decode("utf-8")),
        "verify_token": decrypt_redis_secret(verify_token.decode("utf-8")),
    }


async def verify_webhook_signature(
    request: Request, 
    phone_number_id: str, 
    redis_client: redis.Redis
) -> None:
    """Verify Meta webhook signature using HMAC-SHA256 constant-time comparison.
    
    Security Rationale:
    1. RAW BODY BYTES: We read the request body as raw bytes (not parsed strings)
       to preserve exact byte-level formatting including Unicode, emojis, and
       special characters that would otherwise be mangled by string encoding.
    
    2. CONSTANT-TIME COMPARISON: hmac.compare_digest() executes in constant time
       regardless of where a mismatch occurs. This prevents timing side-channel
       attacks where an attacker measures response times to forge valid signatures
       byte-by-byte.
    
    3. DYNAMIC SECRET LOOKUP: Secrets are fetched per phone_number_id from Redis,
       preventing credential leakage in environment variables and enabling
       per-number isolation (compromise of one number doesn't affect others).
    """
    signature_header = request.headers.get("X-Hub-Signature-256")
    if not signature_header:
        # Security Rationale: Reject all unsigned payloads immediately.
        # Processing unsigned webhooks could allow message injection or
        # unauthorized data modification.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature validation header missing. All webhooks must be signed."
        )

    # Parse signature header: expected format "sha256=<hex_signature>"
    parts = signature_header.split("sha256=")
    if len(parts) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed X-Hub-Signature-256 header. Expected format: sha256=<hex>"
        )
    received_sig = parts[1]

    # Fetch app secret dynamically using the route's phone number ID
    # Security Rationale: Per-number credential isolation limits blast radius
    credentials = await fetch_meta_credentials(phone_number_id, redis_client)
    app_secret = credentials["app_secret"]

    # Read raw body bytes to preserve exact formatting of unicode and emojis
    # Security Rationale: String parsing could alter byte representation,
    # causing valid signatures to fail verification
    raw_body: bytes = await request.body()

    # Compute expected HMAC-SHA256 signature locally
    computed_sig = hmac.new(
        app_secret.encode("utf-8"),  # Key must be bytes
        raw_body,                     # Message as raw bytes
        hashlib.sha256               # Cryptographic hash function
    ).hexdigest()

    # Constant-time comparison prevents timing side-channel attacks
    # Security Rationale: Standard string comparison (==) returns early on first
    # mismatch, leaking timing information. compare_digest() always processes
    # all bytes, making timing attacks infeasible.
    if not hmac.compare_digest(computed_sig, received_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook signature verification failed. Request may be forged."
        )


async def verify_webhook_subscription(
    mode: str,
    verify_token: str,
    challenge: str,
    phone_number_id: str,
    redis_client: redis.Redis
) -> str:
    """Verify webhook subscription request from Meta.
    
    Meta sends a verification challenge when setting up webhooks.
    We validate the verify_token matches our stored credential before
    returning the challenge to confirm endpoint ownership.
    
    Security Rationale: Prevents attackers from registering malicious webhook
    endpoints by requiring knowledge of the secret verify_token.
    """
    if mode != "subscribe":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook mode. Expected 'subscribe'."
        )
    
    # Look up stored verify token for this phone number
    credentials = await fetch_meta_credentials(phone_number_id, redis_client)
    stored_token = credentials["verify_token"]
    
    # Security Rationale: Use secrets.compare_digest for token comparison
    # to prevent timing attacks on the verify token as well
    if not secrets.compare_digest(verify_token, stored_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Webhook verification token mismatch."
        )
    
    # Return the challenge to confirm endpoint ownership
    return challenge


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def generate_secure_random(length: int = 32) -> str:
    """Generate a cryptographically secure random string.
    
    Security Rationale: Uses os.urandom-based secrets module,
    which provides CSPRNG quality randomness suitable for tokens and keys.
    """
    return secrets.token_urlsafe(length)


# =============================================================================
# ZERO-CONFIGURATION DASHBOARD AUTHENTICATION
# =============================================================================

from fastapi.security import HTTPBasic, HTTPBasicCredentials

# Security Rationale: Basic auth is safe only over HTTPS. 
# It provides zero-configuration access for deployers without a DB setup.
basic_security = HTTPBasic()

def verify_admin(credentials: HTTPBasicCredentials = Depends(basic_security)):
    """Verify hardcoded admin credentials for dashboard access.
    
    Security Rationale: Uses secrets.compare_digest for constant-time comparison
    to prevent timing attacks.
    """
    correct_username = secrets.compare_digest(credentials.username, settings.ADMIN_USERNAME)
    correct_password = secrets.compare_digest(credentials.password, settings.ADMIN_PASSWORD)
    
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username
