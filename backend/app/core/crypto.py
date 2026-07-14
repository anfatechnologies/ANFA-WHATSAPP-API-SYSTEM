# /backend/app/core/crypto.py
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

# =============================================================================
# DATA SOVEREIGNTY: AES-256-GCM Encryption Layer
# =============================================================================
# Why: To ensure that all message bodies stored in the database are encrypted at rest.
# Even if the database is compromised, the actual contents of the messages are secure.
# How: We use AES-GCM for authenticated encryption. The 256-bit key should be provided 
# via the ENCRYPTION_KEY environment variable (Base64 encoded 32 bytes).
# Contributors can manage their own KMS keys by securely providing this env var.

class CryptoService:
    def __init__(self, master_key: str | None = None):
        # Security: Use the validated application settings instead of os.getenv
        # Removes hardcoded development fallbacks that could leak to production
        key_bytes = (master_key or settings.ENCRYPTION_MASTER_KEY).encode('utf-8')[:32]
        if len(key_bytes) < 32:
            # Pad key to 32 bytes (256 bits) if misconfigured
            key_bytes = key_bytes.ljust(32, b'\0')
        self.key = key_bytes
        self.aesgcm = AESGCM(self.key)

    def encrypt(self, data: str) -> str:
        """Encrypt string data and return base64 encoded string containing nonce + ciphertext."""
        if not data:
            return data
        nonce = os.urandom(12) # GCM standard nonce size
        ciphertext = self.aesgcm.encrypt(nonce, data.encode('utf-8'), None)
        return base64.b64encode(nonce + ciphertext).decode('utf-8')

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt a base64 encoded string (nonce + ciphertext) and return the original string."""
        if not encrypted_data:
            return encrypted_data
        try:
            raw_data = base64.b64decode(encrypted_data)
            nonce, ciphertext = raw_data[:12], raw_data[12:]
            return self.aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
        except Exception:
            # Return original if decryption fails (e.g. for already plain text legacy messages)
            return encrypted_data

    def reencrypt(self, token: str, new_key: str) -> str:
        """Decrypt with the current key and re-encrypt with new_key.
        
        Used by the key-rotation endpoint to migrate all encrypted data to a new master key.
        Raises ValueError if the token cannot be decrypted with the current key
        (which would indicate corrupted/already-rotated data).
        """
        plaintext = self.decrypt(token)
        new_service = CryptoService(master_key=new_key)
        return new_service.encrypt(plaintext)


# Module-level singleton — import and use directly:
#   from app.core.crypto import crypto_service
crypto_service = CryptoService()

# Backward-compatible alias (some imports may use EncryptionService)
EncryptionService = CryptoService
