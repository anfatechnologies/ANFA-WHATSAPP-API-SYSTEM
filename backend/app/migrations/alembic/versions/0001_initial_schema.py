"""Initial schema: agents, contacts, sessions, messages, phone_number_config

Revision ID: 0001
Revises: 
Create Date: 2026-07-12

This is the foundational migration. It creates all core tables with:
- Native PostgreSQL ENUM types for status fields
- UUID primary keys using gen_random_uuid()
- JSONB columns for flexible metadata storage
- Indexes on all frequently-queried columns
- The messages table is pre-configured for monthly range partitioning
  via pg_partman (partitioning itself is handled in 0002_partitioning.py)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ENUMs
    op.execute("CREATE TYPE agent_role AS ENUM ('admin', 'supervisor', 'agent')")
    op.execute("CREATE TYPE session_status AS ENUM ('open', 'pending', 'closed')")
    op.execute("CREATE TYPE message_direction AS ENUM ('inbound', 'outbound')")
    op.execute("CREATE TYPE message_sender_type AS ENUM ('contact', 'agent', 'system')")
    op.execute("CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read', 'failed', 'processed')")

    # agents table
    op.create_table(
        'agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum('admin', 'supervisor', 'agent', name='agent_role'), nullable=False, server_default='agent'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )
    op.create_index('ix_agents_email', 'agents', ['email'])
    op.create_index('ix_agents_is_active', 'agents', ['is_active'])

    # contacts table
    op.create_table(
        'contacts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('wa_id', sa.String(50), nullable=False, unique=True),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('profile_picture_url', sa.Text(), nullable=True),
        sa.Column('phone_number', sa.String(50), nullable=True),
        sa.Column('language_code', sa.String(10), nullable=True),
        sa.Column('metadata', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('is_blocked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )
    op.create_index('ix_contacts_wa_id', 'contacts', ['wa_id'])
    op.create_index('ix_contacts_created_at', 'contacts', ['created_at'])

    # chat_sessions table
    op.create_table(
        'chat_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('contact_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_agent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('agents.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.Enum('open', 'pending', 'closed', name='session_status'), nullable=False, server_default='pending'),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )
    op.create_index('ix_chat_sessions_contact_id', 'chat_sessions', ['contact_id'])
    op.create_index('ix_chat_sessions_status', 'chat_sessions', ['status'])
    op.create_index('ix_chat_sessions_last_message_at', 'chat_sessions', ['last_message_at'])

    # messages table (parent — partitioned by created_at month via pg_partman in migration 0002)
    op.execute("""
        CREATE TABLE messages (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            direction message_direction NOT NULL,
            sender_type message_sender_type NOT NULL,
            sender_id UUID NOT NULL,
            message_id VARCHAR(255),
            body TEXT,
            media_url TEXT,
            media_type VARCHAR(50),
            media_caption TEXT,
            status message_status NOT NULL DEFAULT 'processed',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        ) PARTITION BY RANGE (created_at)
    """)
    op.execute("CREATE INDEX ix_messages_session_id ON messages (session_id)")
    op.execute("CREATE INDEX ix_messages_message_id ON messages (message_id)")
    op.execute("CREATE INDEX ix_messages_created_at ON messages (created_at)")

    # phone_number_config table
    op.create_table(
        'phone_number_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('phone_number_id', sa.String(50), nullable=False, unique=True),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('business_account_id', sa.String(100), nullable=True),
        sa.Column('webhook_verify_token', sa.String(255), nullable=False),
        sa.Column('app_secret', sa.String(255), nullable=False),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('settings', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )


def downgrade() -> None:
    op.drop_table('phone_number_configs')
    op.execute("DROP TABLE IF EXISTS messages")
    op.drop_table('chat_sessions')
    op.drop_table('contacts')
    op.drop_table('agents')
    op.execute("DROP TYPE IF EXISTS message_status")
    op.execute("DROP TYPE IF EXISTS message_sender_type")
    op.execute("DROP TYPE IF EXISTS message_direction")
    op.execute("DROP TYPE IF EXISTS session_status")
    op.execute("DROP TYPE IF EXISTS agent_role")
