"""
/backend/tests/test_key_rotation.py

Verifies the encryption key rotation logic end-to-end:
  1. Encrypt a value with the current key (via CryptoService)
  2. Call reencrypt() to produce a token encrypted with a NEW key
  3. Decrypt with the new key → original plaintext matches
  4. Confirm old key can no longer decrypt the re-encrypted token
     (returns the raw ciphertext as fallback, not the original plaintext)

These are pure unit tests — no DB or network required.
They test app.core.crypto.CryptoService directly.

Run with:
    cd backend && pytest tests/test_key_rotation.py -v
"""
import pytest
from app.core.crypto import CryptoService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

OLD_KEY = "old-master-key-32-bytes-padded!!"  # exactly 32 bytes
NEW_KEY = "new-master-key-32-bytes-padded!!"  # exactly 32 bytes
SAMPLE_PLAINTEXT = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-access-token"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_encrypt_decrypt_roundtrip():
    """Encrypt then decrypt with same key returns original plaintext."""
    svc = CryptoService(master_key=OLD_KEY)
    ciphertext = svc.encrypt(SAMPLE_PLAINTEXT)

    assert ciphertext != SAMPLE_PLAINTEXT, "Ciphertext should not equal plaintext"
    assert len(ciphertext) > 20, "Ciphertext should be non-trivially long"

    recovered = svc.decrypt(ciphertext)
    assert recovered == SAMPLE_PLAINTEXT, f"Expected '{SAMPLE_PLAINTEXT}', got '{recovered}'"


def test_reencrypt_readable_with_new_key():
    """
    Re-encrypt a token: the result should be decryptable with the new key
    and return the original plaintext.
    """
    old_svc = CryptoService(master_key=OLD_KEY)
    new_svc = CryptoService(master_key=NEW_KEY)

    # Step 1: Encrypt with old key
    old_ciphertext = old_svc.encrypt(SAMPLE_PLAINTEXT)

    # Step 2: Re-encrypt with new key (this is what the rotation endpoint does)
    new_ciphertext = old_svc.reencrypt(old_ciphertext, NEW_KEY)

    # Step 3: Decrypt with new key — should recover plaintext
    recovered = new_svc.decrypt(new_ciphertext)
    assert recovered == SAMPLE_PLAINTEXT, (
        f"After reencrypt: new key should decrypt to original. Got: '{recovered}'"
    )


def test_old_key_cannot_decrypt_reencrypted_token():
    """
    After rotation, the old key should NOT be able to recover the plaintext
    from the re-encrypted token. CryptoService.decrypt falls back to returning
    the raw token on decryption failure — confirm this does NOT equal plaintext.
    """
    old_svc = CryptoService(master_key=OLD_KEY)

    old_ciphertext = old_svc.encrypt(SAMPLE_PLAINTEXT)
    new_ciphertext = old_svc.reencrypt(old_ciphertext, NEW_KEY)

    # Old service tries to decrypt the new-key ciphertext
    wrong_result = old_svc.decrypt(new_ciphertext)

    # The fallback returns the raw ciphertext string (not plaintext)
    assert wrong_result != SAMPLE_PLAINTEXT, (
        "Old key should NOT be able to decrypt a token encrypted with the new key"
    )


def test_reencrypt_different_each_time():
    """
    Two reencrypt calls on the same input should produce different ciphertexts
    (because each AES-GCM call uses a fresh random 12-byte nonce).
    """
    old_svc = CryptoService(master_key=OLD_KEY)
    old_ct = old_svc.encrypt(SAMPLE_PLAINTEXT)

    ct1 = old_svc.reencrypt(old_ct, NEW_KEY)
    ct2 = old_svc.reencrypt(old_ct, NEW_KEY)

    assert ct1 != ct2, "Each encryption should produce a different ciphertext (random nonce)"


def test_encrypt_empty_string_passthrough():
    """Empty string should pass through unencrypted (no crash)."""
    svc = CryptoService(master_key=OLD_KEY)
    assert svc.encrypt("") == ""
    assert svc.decrypt("") == ""


def test_encrypt_none_like_passthrough():
    """None-like falsy values should pass through (worker sometimes passes None for body)."""
    svc = CryptoService(master_key=OLD_KEY)
    # CryptoService.encrypt/decrypt guard with `if not data: return data`
    assert svc.encrypt(None) is None  # type: ignore[arg-type]
    assert svc.decrypt(None) is None  # type: ignore[arg-type]


def test_key_shorter_than_32_bytes_is_padded():
    """
    A key shorter than 32 bytes is zero-padded to 32 bytes.
    Encrypt+decrypt should still work correctly.
    """
    short_key = "short"  # only 5 bytes
    svc = CryptoService(master_key=short_key)
    ct = svc.encrypt(SAMPLE_PLAINTEXT)
    assert svc.decrypt(ct) == SAMPLE_PLAINTEXT


def test_cross_service_with_same_key():
    """
    Two separate CryptoService instances initialized with the same key
    should be able to decrypt each other's ciphertexts.
    """
    svc_a = CryptoService(master_key=OLD_KEY)
    svc_b = CryptoService(master_key=OLD_KEY)

    ct = svc_a.encrypt(SAMPLE_PLAINTEXT)
    assert svc_b.decrypt(ct) == SAMPLE_PLAINTEXT
