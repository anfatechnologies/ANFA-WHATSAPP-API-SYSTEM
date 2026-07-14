# /backend/app/schemas/pydantic_models.py
# ANFA Pydantic Models - Request/Response Validation
# Strict type safety with comprehensive field validation.

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from enum import Enum

from pydantic import BaseModel, Field, field_validator, ConfigDict, EmailStr


# =============================================================================
# ENUM SCHEMAS
# =============================================================================

class SessionStatusSchema(str, Enum):
    OPEN = "open"
    PENDING = "pending"
    CLOSED = "closed"


class MessageDirectionSchema(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageSenderTypeSchema(str, Enum):
    CONTACT = "contact"
    AGENT = "agent"
    SYSTEM = "system"


class MessageStatusSchema(str, Enum):
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    PROCESSED = "processed"


class AgentRoleSchema(str, Enum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    AGENT = "agent"


# =============================================================================
# AGENT SCHEMAS
# =============================================================================

class AgentBase(BaseModel):
    """Base agent fields shared across schemas."""
    model_config = ConfigDict(from_attributes=True)
    
    email: EmailStr = Field(..., max_length=255)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: AgentRoleSchema = Field(default=AgentRoleSchema.AGENT)
    is_active: bool = Field(default=True)


class AgentCreate(AgentBase):
    """Schema for creating a new agent."""
    password: str = Field(..., min_length=12, max_length=128)
    
    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Enforce password complexity requirements."""
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in v):
            raise ValueError("Password must contain at least one special character")
        return v


class AgentUpdate(BaseModel):
    """Schema for updating agent fields (all optional)."""
    model_config = ConfigDict(from_attributes=True)
    
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    role: Optional[AgentRoleSchema] = None
    is_active: Optional[bool] = None


class AgentResponse(AgentBase):
    """Schema for agent API responses (excludes password)."""
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class AgentLogin(BaseModel):
    """Schema for agent login requests."""
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., max_length=128)


class TokenResponse(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    agent: AgentResponse


# =============================================================================
# CONTACT SCHEMAS
# =============================================================================

class ContactBase(BaseModel):
    """Base contact fields."""
    model_config = ConfigDict(from_attributes=True)
    
    wa_id: str = Field(..., min_length=5, max_length=50, pattern=r"^\d+$")
    display_name: Optional[str] = Field(default=None, max_length=255)
    phone_number: Optional[str] = Field(default=None, max_length=50)
    language_code: Optional[str] = Field(default=None, max_length=10)
    profile_picture_url: Optional[str] = Field(default=None, max_length=2048)


class ContactCreate(ContactBase):
    """Schema for creating a new contact."""
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ContactUpdate(BaseModel):
    """Schema for updating contact fields."""
    model_config = ConfigDict(from_attributes=True)
    
    display_name: Optional[str] = Field(default=None, max_length=255)
    profile_picture_url: Optional[str] = None
    language_code: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ContactResponse(ContactBase):
    """Schema for contact API responses."""
    id: uuid.UUID
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime


# =============================================================================
# CHAT SESSION SCHEMAS
# =============================================================================

class ChatSessionBase(BaseModel):
    """Base chat session fields."""
    model_config = ConfigDict(from_attributes=True)
    
    contact_id: uuid.UUID
    status: SessionStatusSchema = Field(default=SessionStatusSchema.PENDING)
    priority: int = Field(default=0, ge=0, le=100)


class ChatSessionCreate(ChatSessionBase):
    """Schema for creating a new chat session."""
    assigned_agent_id: Optional[uuid.UUID] = None
    tags: Optional[List[str]] = Field(default_factory=list)


class ChatSessionUpdate(BaseModel):
    """Schema for updating chat session fields."""
    model_config = ConfigDict(from_attributes=True)
    
    status: Optional[SessionStatusSchema] = None
    assigned_agent_id: Optional[uuid.UUID] = None
    priority: Optional[int] = Field(default=None, ge=0, le=100)
    summary: Optional[str] = None
    tags: Optional[List[str]] = None


class ChatSessionResponse(ChatSessionBase):
    """Schema for chat session API responses."""
    id: uuid.UUID
    assigned_agent_id: Optional[uuid.UUID]
    version: int
    last_message_at: Optional[datetime]
    summary: Optional[str]
    tags: Optional[List[str]]
    created_at: datetime
    updated_at: datetime
    contact: Optional[ContactResponse] = None
    assigned_agent: Optional[AgentResponse] = None


class ChatSessionListResponse(BaseModel):
    """Paginated list of chat sessions."""
    items: List[ChatSessionResponse]
    total: int
    page: int
    page_size: int
    pages: int


# =============================================================================
# MESSAGE SCHEMAS
# =============================================================================

class MessageBase(BaseModel):
    """Base message fields."""
    model_config = ConfigDict(from_attributes=True)
    
    session_id: uuid.UUID
    direction: MessageDirectionSchema
    body: Optional[str] = Field(default=None, max_length=4096)
    media_url: Optional[str] = None
    media_type: Optional[str] = Field(default=None, max_length=50)
    media_caption: Optional[str] = None


class MessageCreate(MessageBase):
    """Schema for creating a new message."""
    sender_type: MessageSenderTypeSchema
    sender_id: Optional[uuid.UUID] = None
    message_id: str = Field(..., max_length=255)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class MessageUpdate(BaseModel):
    """Schema for updating message fields (typically status updates)."""
    model_config = ConfigDict(from_attributes=True)
    
    status: Optional[MessageStatusSchema] = None
    metadata: Optional[Dict[str, Any]] = None


class MessageResponse(MessageBase):
    """Schema for message API responses."""
    id: uuid.UUID
    sender_type: MessageSenderTypeSchema
    sender_id: Optional[uuid.UUID]
    message_id: str
    status: MessageStatusSchema
    metadata: Optional[Dict[str, Any]]
    created_at: datetime


class MessageListResponse(BaseModel):
    """Paginated list of messages."""
    items: List[MessageResponse]
    total: int
    page: int
    page_size: int
    pages: int


# =============================================================================
# OUTBOUND MESSAGE SCHEMAS
# =============================================================================

class OutboundTextMessage(BaseModel):
    """Schema for sending a text message via WhatsApp."""
    phone_number_id: str = Field(..., min_length=5, max_length=50)
    recipient_wa_id: str = Field(..., min_length=5, max_length=50, pattern=r"^\d+$")
    body: str = Field(..., min_length=1, max_length=4096)
    preview_url: bool = Field(default=False)


class OutboundMediaMessage(BaseModel):
    """Schema for sending a media message via WhatsApp."""
    phone_number_id: str = Field(..., min_length=5, max_length=50)
    recipient_wa_id: str = Field(..., min_length=5, max_length=50, pattern=r"^\d+$")
    media_type: Literal["image", "document", "audio", "video", "sticker"] = "image"
    media_url: str = Field(..., max_length=2048)
    caption: Optional[str] = Field(default=None, max_length=1024)
    filename: Optional[str] = Field(default=None, max_length=255)


class OutboundTemplateMessage(BaseModel):
    """Schema for sending a template message via WhatsApp."""
    phone_number_id: str = Field(..., min_length=5, max_length=50)
    recipient_wa_id: str = Field(..., min_length=5, max_length=50, pattern=r"^\d+$")
    template_name: str = Field(..., min_length=1, max_length=512)
    language_code: str = Field(default="en", max_length=10)
    components: Optional[List[Dict[str, Any]]] = None


# =============================================================================
# WEBHOOK SCHEMAS
# =============================================================================

class WebhookVerification(BaseModel):
    """Schema for Meta webhook verification challenge."""
    hub_mode: str = Field(..., alias="hub.mode")
    hub_verify_token: str = Field(..., alias="hub.verify_token")
    hub_challenge: str = Field(..., alias="hub.challenge")


class WebhookPayload(BaseModel):
    """Schema for incoming webhook payload from Meta.
    
    Meta's webhook payload is highly variable. We accept a flexible dict
    structure and parse it internally for maximum compatibility.
    """
    object: str = Field(default="whatsapp_business_account", max_length=100)
    entry: List[Dict[str, Any]] = Field(default_factory=list)


# =============================================================================
# PHONE NUMBER CONFIG SCHEMAS
# =============================================================================

class PhoneNumberConfigBase(BaseModel):
    """Base phone number config fields."""
    model_config = ConfigDict(from_attributes=True)
    
    phone_number_id: str = Field(..., min_length=5, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=255)
    business_account_id: Optional[str] = Field(default=None, max_length=50)
    is_active: bool = Field(default=True)


class PhoneNumberConfigCreate(PhoneNumberConfigBase):
    """Schema for creating phone number config."""
    webhook_verify_token: str = Field(..., min_length=16, max_length=255)
    app_secret: str = Field(..., min_length=16, max_length=255)
    access_token: str = Field(..., min_length=32, max_length=512)
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)


class PhoneNumberConfigUpdate(BaseModel):
    """Schema for updating phone number config."""
    model_config = ConfigDict(from_attributes=True)
    
    display_name: Optional[str] = Field(default=None, max_length=255)
    is_active: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


class PhoneNumberConfigResponse(PhoneNumberConfigBase):
    """Schema for phone number config responses (excludes secrets)."""
    id: uuid.UUID
    settings: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime


# =============================================================================
# SETTINGS SCHEMAS
# =============================================================================

class SystemSettingsLegacy(BaseModel):
    """DEPRECATED: Old schema that did not match DB fields. Kept for reference only."""
    model_config = ConfigDict(from_attributes=True)
    
    default_agent_role: AgentRoleSchema = Field(default=AgentRoleSchema.AGENT)
    auto_assign_sessions: bool = Field(default=True)
    business_hours_start: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    business_hours_end: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    timezone: str = Field(default="UTC")
    max_message_length: int = Field(default=4096, ge=100, le=16000)
    session_timeout_hours: int = Field(default=24, ge=1, le=168)
    enable_ml_features: bool = Field(default=False)


class SystemSettingsResponse(BaseModel):
    """H1/H5 Fix: Schema that actually matches the SystemSettings DB model fields.
    
    Used for GET /settings/ responses so the frontend receives real DB values
    instead of Pydantic defaults from a mismatched schema.
    """
    model_config = ConfigDict(from_attributes=True)

    # Category 1: Meta Business Configuration
    whatsapp_business_account_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    # Secrets are never returned — presence is indicated by has_* booleans
    has_permanent_access_token: bool = False
    has_app_secret: bool = False

    # Category 2: Automation & Workflow
    n8n_webhook_url: Optional[str] = None
    auto_reply_enabled: bool = False
    default_reply_message: Optional[str] = None

    # Category 3: System & Privacy
    data_retention_days: int = 90
    enable_logging: bool = True

    # Category 4: Appearance / UI Preferences (Part 3 — new fields)
    theme_mode: str = Field(default="dark", description="UI theme: 'light' | 'dark' | 'system'")
    language: str = Field(default="en", description="UI language code (e.g. 'en', 'ur', 'ar')")
    notification_sound_enabled: bool = Field(default=True, description="Play sound on new messages")


# Backward compat alias — old code that imported SystemSettings for settings responses
# should migrate to SystemSettingsResponse
SystemSettings = SystemSettingsResponse

class MetaCredentialsSettings(BaseModel):
    """Schema for Meta API credentials stored in Redis."""
    model_config = ConfigDict(from_attributes=True)
    
    phone_number_id: str
    verify_token: str = Field(..., min_length=8)
    app_secret: str = Field(..., min_length=16)
    access_token: Optional[str] = Field(default=None)


class RotateKeyRequest(BaseModel):
    """Request body for POST /settings/rotate-encryption-key.
    
    The confirm flag must be explicitly set to true to prevent accidental
    rotations — this is a destructive operation if done incorrectly.
    """
    confirm: bool = Field(
        ...,
        description="Must be explicitly set to true. Prevents accidental key rotations."
    )


class RotateKeyResponse(BaseModel):
    """Response from POST /settings/rotate-encryption-key.
    
    CRITICAL SECURITY WARNING: The new_master_key field in the response must be
    immediately saved to your .env file as ENCRYPTION_MASTER_KEY and all containers
    restarted. If the response is lost before updating .env, the encrypted data
    will become permanently unreadable after the next container restart.
    """
    status: str
    new_master_key: str = Field(
        description="NEW ENCRYPTION_MASTER_KEY value. Update .env immediately and restart all containers."
    )
    rows_reencrypted: int
    warning: str = (
        "CRITICAL: Save new_master_key to .env as ENCRYPTION_MASTER_KEY and restart all containers "
        "before they are restarted for any other reason. Data will be unreadable if this step is skipped."
    )

# =============================================================================
# REAL-TIME EVENT SCHEMAS
# =============================================================================

class MessageEvent(BaseModel):
    """Schema for real-time message events pushed via SSE."""
    model_config = ConfigDict(from_attributes=True)
    
    event_type: Literal["message_received", "message_sent", "message_status_update", 
                        "session_assigned", "session_closed", "typing_indicator"]
    payload: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ConnectionEvent(BaseModel):
    """Schema for SSE connection status events."""
    model_config = ConfigDict(from_attributes=True)
    
    event_type: Literal["connected", "heartbeat", "disconnected"] = "connected"
    client_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# AUDIT LOG SCHEMAS
# =============================================================================

class AuditLogCreate(BaseModel):
    """Schema for creating audit log entries."""
    model_config = ConfigDict(from_attributes=True)
    
    action: str = Field(..., max_length=100)
    resource_type: str = Field(..., max_length=50)
    resource_id: Optional[str] = Field(default=None, max_length=255)
    details: Optional[Dict[str, Any]] = Field(default_factory=dict)
    ip_address: Optional[str] = Field(default=None, max_length=45)
    user_agent: Optional[str] = Field(default=None)


class AuditLogResponse(AuditLogCreate):
    """Schema for audit log API responses."""
    id: uuid.UUID
    agent_id: Optional[uuid.UUID]
    created_at: datetime


# =============================================================================
# HEALTH & UTILITY SCHEMAS
# =============================================================================

class HealthResponse(BaseModel):
    """Schema for health check response."""
    model_config = ConfigDict(from_attributes=True)
    
    status: Literal["healthy", "degraded", "unhealthy"] = "healthy"
    version: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    services: Dict[str, Literal["up", "down"]] = Field(default_factory=dict)
    uptime_seconds: Optional[float] = None


class ErrorResponse(BaseModel):
    """Standardized error response schema."""
    model_config = ConfigDict(from_attributes=True)
    
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = None
