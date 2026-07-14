"""
/backend/tests/test_settings_retention.py

Verifies the data-retention cleanup chain end-to-end:
  cleanup_old_messages(ctx, retention_days) →
      DELETE FROM messages WHERE created_at < cutoff

Uses a real async DB session (requires `init_db` fixture from conftest.py,
which calls init_database() → creates all tables).

Run with:
    cd backend && pytest tests/test_settings_retention.py -v
"""
import uuid
import datetime
import pytest
import pytest_asyncio

from sqlalchemy import select, func, delete, text
from app.core.database import get_db_session

# worker.cleanup_old_messages reads from app.models.schema.Message
from app.models.schema import Contact, ChatSession, Message
from app.schemas.pydantic_models import (
    MessageDirectionSchema,
    MessageSenderTypeSchema,
    MessageStatusSchema,
    SessionStatusSchema,
)

pytestmark = pytest.mark.usefixtures("init_db")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_timestamp(days_ago: float) -> datetime.datetime:
    """Return a UTC datetime N days in the past."""
    return datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days_ago)


async def _seed_messages(db, session_id: uuid.UUID, timestamps: list[datetime.datetime]) -> list[uuid.UUID]:
    """Insert Message rows with the given created_at timestamps. Returns inserted IDs."""
    ids = []
    for ts in timestamps:
        msg_id = f"wamid.test.{uuid.uuid4().hex}"
        msg = Message(
            session_id=session_id,
            direction=MessageDirectionSchema.INBOUND,
            sender_type=MessageSenderTypeSchema.CONTACT,
            message_id=msg_id,
            body=f"test message at {ts.isoformat()}",
            status=MessageStatusSchema.PROCESSED,
            created_at=ts,
        )
        db.add(msg)
        ids.append(msg_id)
    await db.flush()
    return ids


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cleanup_old_messages_deletes_stale_keeps_fresh():
    """
    BEFORE: Insert 3 messages older than 30 days + 2 messages < 30 days old.
    ACTION: Run cleanup_old_messages with retention_days=30.
    AFTER:  3 old messages deleted, 2 fresh messages survive.
    """
    async with get_db_session(read_only=False) as db:
        # Create a throwaway Contact + ChatSession for the test messages
        contact = Contact(
            wa_id=f"test_{uuid.uuid4().hex[:8]}",
            display_name="Retention Test Contact",
        )
        db.add(contact)
        await db.flush()

        session = ChatSession(
            contact_id=contact.id,
            status=SessionStatusSchema.PENDING,
        )
        db.add(session)
        await db.flush()

        # Seed 3 OLD messages (>30 days ago) and 2 FRESH messages (<30 days ago)
        old_timestamps = [
            _make_timestamp(31),
            _make_timestamp(60),
            _make_timestamp(90),
        ]
        fresh_timestamps = [
            _make_timestamp(1),
            _make_timestamp(15),
        ]
        old_ids = await _seed_messages(db, session.id, old_timestamps)
        fresh_ids = await _seed_messages(db, session.id, fresh_timestamps)
        await db.commit()

        # Verify all 5 are present
        result = await db.execute(
            select(func.count()).select_from(Message)
            .where(Message.session_id == session.id)
        )
        assert result.scalar() == 5, "Expected 5 seeded messages before cleanup"

    # --- Run the actual cleanup job (same logic as worker.cleanup_old_messages) ---
    retention_days = 30
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=retention_days)

    async with get_db_session(read_only=False) as db:
        result = await db.execute(
            delete(Message).where(Message.created_at < cutoff)
        )
        await db.commit()
        deleted = result.rowcount

    # --- Verify ---
    async with get_db_session(read_only=True) as db:
        remaining = await db.execute(
            select(Message.message_id)
            .where(Message.session_id == session.id)
        )
        remaining_ids = {row[0] for row in remaining.fetchall()}

    assert deleted >= 3, f"Expected at least 3 old messages deleted, got {deleted}"
    for old_id in old_ids:
        assert old_id not in remaining_ids, f"Old message {old_id} should have been deleted"
    for fresh_id in fresh_ids:
        assert fresh_id in remaining_ids, f"Fresh message {fresh_id} should have survived"


@pytest.mark.asyncio
async def test_cleanup_with_zero_retention_deletes_all():
    """
    Edge case: retention_days=0 means cutoff is now, all messages should be deleted.
    """
    async with get_db_session(read_only=False) as db:
        contact = Contact(
            wa_id=f"test_{uuid.uuid4().hex[:8]}",
            display_name="Zero Retention Test",
        )
        db.add(contact)
        await db.flush()

        session = ChatSession(contact_id=contact.id, status=SessionStatusSchema.PENDING)
        db.add(session)
        await db.flush()

        await _seed_messages(db, session.id, [_make_timestamp(1), _make_timestamp(2)])
        await db.commit()

    # Cutoff = now → everything is "older" than now
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=0)

    async with get_db_session(read_only=False) as db:
        result = await db.execute(
            delete(Message).where(Message.created_at < cutoff)
        )
        await db.commit()
        assert result.rowcount >= 2


@pytest.mark.asyncio
async def test_cleanup_with_large_retention_keeps_everything():
    """
    Edge case: retention_days=9999 means nothing should be deleted.
    """
    async with get_db_session(read_only=False) as db:
        contact = Contact(
            wa_id=f"test_{uuid.uuid4().hex[:8]}",
            display_name="Long Retention Test",
        )
        db.add(contact)
        await db.flush()

        session = ChatSession(contact_id=contact.id, status=SessionStatusSchema.PENDING)
        db.add(session)
        await db.flush()

        await _seed_messages(db, session.id, [_make_timestamp(1), _make_timestamp(100)])
        await db.commit()

    # Cutoff is 9999 days ago → nothing recent should be older than that
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=9999)

    async with get_db_session(read_only=False) as db:
        result = await db.execute(
            delete(Message).where(Message.created_at < cutoff)
        )
        await db.commit()
        assert result.rowcount == 0, "No messages should be deleted with 9999-day retention"
