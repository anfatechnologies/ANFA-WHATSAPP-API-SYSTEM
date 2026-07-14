# /backend/app/models/schema.py
# ANFA Database Schema - SQLAlchemy 2.0 Declarative Models
# Messages table uses native PostgreSQL range partitioning by month.

import datetime
import uuid
from typing import List, Optional

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, ForeignKey, Text, 
    Enum, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
import enum
import os
import base64
from sqlalchemy.types import TypeDecorator
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings


# =============================================================================
# BASE CLASS
# =============================================================================

class Base(DeclarativeBase):
    """Base class for all declarative models."""
    pass


class EncryptedText(TypeDecorator):
    """Application-Level Encryption (ALE) using AES-256-GCM."""
    impl = Text
    cache_ok = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        key_bytes = settings.ENCRYPTION_MASTER_KEY.encode('utf-8')[:32]
        if len(key_bytes) < 32:
            key_bytes = key_bytes.ljust(32, b'\0')
        self.aesgcm = AESGCM(key_bytes)

    def process_bind_param(self, value, dialect):
        if value is not None:
            nonce = os.urandom(12)
            ciphertext = self.aesgcm.encrypt(nonce, value.encode('utf-8'), None)
            return base64.b64encode(nonce + ciphertext).decode('utf-8')
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            try:
                data = base64.b64decode(value.encode('utf-8'))
                nonce, ciphertext = data[:12], data[12:]
                return self.aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
            except Exception:
                return value  # Fallback for plain text during migration transition
        return value


# =============================================================================
# ENUM DEFINITIONS
# =============================================================================

class SessionStatus(str, enum.Enum):
    """Chat session lifecycle states."""
    OPEN = "open"       # Actively being handled
    PENDING = "pending" # Waiting for agent assignment
    CLOSED = "closed"   # Resolved and archived


class MessageDirection(str, enum.Enum):
    """Message flow direction."""
    INBOUND = "inbound"   # From WhatsApp contact to system
    OUTBOUND = "outbound" # From system/agent to contact


class MessageSenderType(str, enum.Enum):
    """Identifies who sent the message."""
    CONTACT = "contact"
    AGENT = "agent"
    SYSTEM = "system"


class MessageStatus(str, enum.Enum):
    """Outbound message delivery status tracking."""
    QUEUED = "queued"      # Saved to DB, waiting for ARQ worker to send to Meta
    SENT = "sent"         # Message sent to Meta API
    DELIVERED = "delivered"  # Delivered to recipient device
    READ = "read"         # Read by recipient
    FAILED = "failed"     # Delivery failed
    PROCESSED = "processed"  # Inbound message processed by worker


class AgentRole(str, enum.Enum):
    """Agent permission levels."""
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    AGENT = "agent"


# =============================================================================
# MODELS
# =============================================================================

class Agent(Base):
    """Represents a system user (agent) who can handle conversations."""
    
    __tablename__ = "agents"
    __table_args__ = (
        Index("ix_agents_email", "email"),
        Index("ix_agents_is_active", "is_active"),
    )
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, 
        comment="Agent login email address"
    )
    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="bcrypt hashed password - never store plaintext"
    )
    full_name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    role: Mapped[AgentRole] = mapped_column(
        Enum(AgentRole, name="agent_role"), 
        default=AgentRole.AGENT, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
        comment="Soft delete flag - inactive agents cannot login"
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc)
    )
    
    # Relationships
    assigned_sessions: Mapped[List["ChatSession"]] = relationship(
        "ChatSession", back_populates="assigned_agent"
    )

    def __repr__(self) -> str:
        return f"<Agent(id={self.id}, email={self.email}, role={self.role})>"


class Contact(Base):
    """Represents a WhatsApp contact (end user)."""
    
    __tablename__ = "contacts"
    __table_args__ = (
        Index("ix_contacts_wa_id", "wa_id"),
        Index("ix_contacts_created_at", "created_at"),
    )
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    wa_id: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="WhatsApp phone number ID (e.g., 1234567890)"
    )
    display_name: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    profile_picture_url: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    phone_number: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="E.164 formatted phone number"
    )
    language_code: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True,
        comment="Preferred language code (e.g., en, ar)"
    )
    extra_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True, default=dict,
        comment="Flexible JSON metadata for custom fields"
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc)
    )
    
    # Relationships
    chat_sessions: Mapped[List["ChatSession"]] = relationship(
        "ChatSession", back_populates="contact"
    )

    def __repr__(self) -> str:
        return f"<Contact(id={self.id}, wa_id={self.wa_id}, name={self.display_name})>"


class ChatSession(Base):
    """Represents a conversation thread between a contact and the system.
    
    Uses optimistic locking with version field for concurrent access control.
    """
    
    __tablename__ = "chat_sessions"
    __table_args__ = (
        Index("ix_sessions_contact_id", "contact_id"),
        Index("ix_sessions_agent_id", "assigned_agent_id"),
        Index("ix_sessions_status", "status"),
        Index("ix_sessions_created_at", "created_at"),
    )
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("contacts.id", ondelete="CASCADE"), 
        nullable=False
    )
    assigned_agent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("agents.id", ondelete="SET NULL"), 
        nullable=True
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="sess_status"), 
        default=SessionStatus.PENDING, 
        nullable=False
    )
    version: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False,
        comment="Optimistic locking version - incremented on each update"
    )
    last_message_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    summary: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="AI-generated or manual session summary"
    )
    priority: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="Priority score: higher = more urgent"
    )
    tags: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True, default=list
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc)
    )
    
    # Relationships
    contact: Mapped["Contact"] = relationship("Contact", back_populates="chat_sessions")
    assigned_agent: Mapped[Optional["Agent"]] = relationship(
        "Agent", back_populates="assigned_sessions"
    )
    messages: Mapped[List["Message"]] = relationship(
        "Message", back_populates="session", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<ChatSession(id={self.id}, status={self.status}, contact={self.contact_id})>"


class Message(Base):
    """Represents a single message within a chat session.
    
    CRITICAL: This table uses native PostgreSQL RANGE partitioning by created_at.
    The partition key (created_at) MUST be part of the primary key composite.
    Monthly partitions are auto-managed by pg_partman.
    
    Partitioning Rationale:
    - Message volume grows rapidly in WhatsApp systems
    - Queries typically filter by time range (recent conversations)
    - Partition pruning eliminates full table scans for time-bounded queries
    - Older partitions can be archived or dropped independently
    """
    
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_session_id", "session_id"),
        Index("ix_messages_message_id", "message_id"),
        Index("ix_messages_created_at", "created_at"),
        Index("ix_messages_status", "status"),
        # CRITICAL: PostgreSQL range partitioning declaration (dict must be LAST in the tuple)
        {"postgresql_partition_by": "RANGE (created_at)"},
    )
    
    # Primary key is COMPOSITE: (id, created_at)
    # Range partitioning REQUIRES the partition key in the primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), default=uuid.uuid4, nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    direction: Mapped[MessageDirection] = mapped_column(
        Enum(MessageDirection, name="msg_direction"), 
        nullable=False
    )
    sender_type: Mapped[MessageSenderType] = mapped_column(
        Enum(MessageSenderType, name="msg_sender_type"), 
        nullable=False
    )
    sender_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    message_id: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Meta WhatsApp message ID (wamid.xxx) for deduplication"
    )
    body: Mapped[Optional[str]] = mapped_column(
        EncryptedText, nullable=True,
        comment="Message text content (AES-256-GCM Encrypted at rest)"
    )
    media_url: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="URL to media file if message contains media"
    )
    media_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Media MIME type (image/jpeg, audio/ogg, etc.)"
    )
    media_caption: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    status: Mapped[MessageStatus] = mapped_column(
        Enum(MessageStatus, name="msg_status"), 
        default=MessageStatus.SENT, 
        nullable=False
    )
    extra_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True, default=dict,
        comment="Additional message metadata (reactions, replies, etc.)"
    )
    # CRITICAL: Range partitioning requires the partition key to be part of the composite PK
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        primary_key=True,  # Part of composite PK for partition compatibility
        default=datetime.datetime.now(datetime.timezone.utc),
        nullable=False
    )
    
    # Relationships
    session: Mapped["ChatSession"] = relationship(
        "ChatSession", back_populates="messages"
    )

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, direction={self.direction}, status={self.status})>"


class PhoneNumberConfig(Base):
    """Stores WhatsApp Business phone number configurations.
    
    Each phone number has its own Meta API credentials and settings,
    enabling multi-number support with complete credential isolation.
    """
    
    __tablename__ = "phone_number_configs"
    __table_args__ = (
        Index("ix_phone_configs_phone_number_id", "phone_number_id"),
        Index("ix_phone_configs_is_active", "is_active"),
    )
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    phone_number_id: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="Meta Phone Number ID"
    )
    display_name: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Human-readable label for this number"
    )
    business_account_id: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    webhook_verify_token: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Token for webhook subscription verification"
    )
    app_secret: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="Meta App Secret for webhook signature verification"
    )
    access_token: Mapped[str] = mapped_column(
        String(512), nullable=False,
        comment="Meta Cloud API access token"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    settings: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default=dict,
        comment="Number-specific settings (auto-reply, business hours, etc.)"
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc)
    )

    def __repr__(self) -> str:
        return f"<PhoneNumberConfig(id={self.id}, phone={self.phone_number_id})>"


class AuditLog(Base):
    """Immutable audit trail for all security-relevant operations.
    
    Security Rationale: Provides non-repudiation and forensic capabilities
    for compliance requirements. Records agent actions, credential changes,
    and system events.
    """
    
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_agent_id", "agent_id"),
        Index("ix_audit_action", "action"),
        Index("ix_audit_created_at", "created_at"),
    )
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    agent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    action: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Action type: login, message_send, settings_update, etc."
    )
    resource_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Entity type being acted upon"
    )
    resource_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    details: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True,
        comment="IPv4 or IPv6 address of the actor"
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc)
    )

    def __repr__(self) -> str:
        return f"<AuditLog(action={self.action}, resource={self.resource_type})>"


class SystemSettings(Base):
    """Global System Settings configuration with Encrypted Secrets."""
    
    __tablename__ = "system_settings"
    
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, default=1,
        comment="Singleton pattern: Always use ID=1"
    )
    
    # Category 1: Meta Business Configuration
    whatsapp_business_account_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    phone_number_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    permanent_access_token: Mapped[Optional[str]] = mapped_column(EncryptedText, nullable=True)
    app_secret: Mapped[Optional[str]] = mapped_column(EncryptedText, nullable=True)

    # Category 2: Automation & Workflow
    n8n_webhook_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    auto_reply_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_reply_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Category 3: System & Privacy
    data_retention_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    enable_logging: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Category 4: Appearance / UI Preferences (Part 3 — new fields)
    # theme_mode: applied to <html> class on the frontend for real dark/light toggling
    theme_mode: Mapped[str] = mapped_column(String(10), default="dark", nullable=False)
    # language: stored for i18n stub (see frontend ThemeProvider for usage)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    # notification_sound_enabled: gates audio playback on new message events
    notification_sound_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc)
    )

    def __repr__(self) -> str:
        return f"<SystemSettings(id={self.id}, updated_at={self.updated_at})>"

