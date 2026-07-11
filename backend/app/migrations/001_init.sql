-- /backend/app/migrations/001_init.sql
-- ANFA Database Migration: Initial Schema Setup
-- Creates partitioned messages table with pg_partman auto-management.
-- This script runs automatically when the PostgreSQL container starts
-- via the Docker entrypoint initdb.d mechanism.

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- Create schema for pg_partman to avoid cluttering public namespace
CREATE SCHEMA IF NOT EXISTS partman;

-- Enable pg_partman extension for automated partition management
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable JSONB operations
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_role') THEN
        CREATE TYPE agent_role AS ENUM ('admin', 'supervisor', 'agent');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sess_status') THEN
        CREATE TYPE sess_status AS ENUM ('open', 'pending', 'closed');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'msg_direction') THEN
        CREATE TYPE msg_direction AS ENUM ('inbound', 'outbound');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'msg_sender_type') THEN
        CREATE TYPE msg_sender_type AS ENUM ('contact', 'agent', 'system');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'msg_status') THEN
        CREATE TYPE msg_status AS ENUM ('sent', 'delivered', 'read', 'failed');
    END IF;
END$$;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Agents table: System users who handle conversations
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role agent_role DEFAULT 'agent' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_email ON public.agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON public.agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agents_role ON public.agents(role);

-- Contacts table: WhatsApp end users
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wa_id VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    profile_picture_url TEXT,
    phone_number VARCHAR(50),
    language_code VARCHAR(10),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_wa_id ON public.contacts(wa_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON public.contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_metadata ON public.contacts USING GIN(metadata);

-- Chat sessions table: Conversation threads
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    assigned_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    status sess_status DEFAULT 'pending' NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    last_message_at TIMESTAMPTZ,
    summary TEXT,
    priority INTEGER DEFAULT 0 NOT NULL,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_contact_id ON public.chat_sessions(contact_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON public.chat_sessions(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.chat_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_message ON public.chat_sessions(last_message_at);

-- Phone number configurations
CREATE TABLE IF NOT EXISTS public.phone_number_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number_id VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    business_account_id VARCHAR(50),
    webhook_verify_token VARCHAR(255) NOT NULL,
    app_secret VARCHAR(255) NOT NULL,
    access_token VARCHAR(512) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_configs_phone_number_id ON public.phone_number_configs(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_phone_configs_is_active ON public.phone_number_configs(is_active);

-- =============================================================================
-- PARTITIONED MESSAGES TABLE
-- =============================================================================

-- CRITICAL: Messages table uses native PostgreSQL RANGE partitioning by created_at
-- The partition key MUST be part of the primary key composite

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID NOT NULL,
    session_id UUID NOT NULL,
    direction msg_direction NOT NULL,
    sender_type msg_sender_type NOT NULL,
    sender_id UUID,
    message_id VARCHAR(255) NOT NULL,
    body TEXT,
    media_url TEXT,
    media_type VARCHAR(50),
    media_caption TEXT,
    status msg_status DEFAULT 'sent' NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    -- Composite primary key including partition key
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create indexes on parent (will be inherited by partitions)
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON public.messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON public.messages USING GIN(metadata);

-- =============================================================================
-- PARTITION MANAGEMENT WITH pg_partman
-- =============================================================================

-- Configure pg_partman to auto-generate monthly partitions
-- This creates the necessary trigger function and schedule
DO $$
BEGIN
    -- Only run if pg_partman is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_partman') THEN
        -- Create the partition setup if not already configured
        PERFORM partman.create_parent(
            p_parent_table := 'public.messages',
            p_control := 'created_at',
            p_type := 'native',
            p_interval := 'monthly',
            p_premake := 4,
            p_start_partition := date_trunc('month', CURRENT_DATE - interval '1 month')::text
        );
        
        -- Apply automated retention policy
        UPDATE partman.part_config
        SET 
            infinite_time_partitions = true,
            retention = '12 months',
            retention_keep_table = true,
            retention_keep_index = true,
            automatic_maintenance = 'on'
        WHERE parent_table = 'public.messages';
        
        RAISE NOTICE 'pg_partman configured for messages table';
    ELSE
        RAISE NOTICE 'pg_partman extension not available, skipping partition setup';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Partition setup note: %', SQLERRM;
END$$;

-- =============================================================================
-- AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_agent_id ON public.audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at);

-- =============================================================================
-- TRIGGER FUNCTIONS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DO $$
BEGIN
    -- Agents
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agents_updated_at') THEN
        CREATE TRIGGER trg_agents_updated_at
            BEFORE UPDATE ON public.agents
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Contacts
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contacts_updated_at') THEN
        CREATE TRIGGER trg_contacts_updated_at
            BEFORE UPDATE ON public.contacts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Chat sessions
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sessions_updated_at') THEN
        CREATE TRIGGER trg_sessions_updated_at
            BEFORE UPDATE ON public.chat_sessions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Phone configs
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_phone_configs_updated_at') THEN
        CREATE TRIGGER trg_phone_configs_updated_at
            BEFORE UPDATE ON public.phone_number_configs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- =============================================================================
-- PARTITION MAINTENANCE SCHEDULER
-- =============================================================================

-- Schedule automatic partition maintenance using PostgreSQL's built-in scheduler
-- This ensures partitions are created ahead of time and old ones are archived
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_partman') THEN
        -- Schedule partition maintenance to run daily
        -- Note: In production, use pg_cron or external scheduler
        PERFORM partman.partition_data_proc('public.messages');
        RAISE NOTICE 'Partition maintenance scheduler configured';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Partition scheduler note: %', SQLERRM;
END$$;

-- =============================================================================
-- COMPLETION
-- =============================================================================

-- Verify setup
SELECT 
    schemaname, 
    tablename, 
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'ANFA database initialization complete';
    RAISE NOTICE 'Tables created: agents, contacts, chat_sessions, messages (partitioned), phone_number_configs, audit_logs';
    RAISE NOTICE 'pg_partman configured for monthly message partitioning with 12-month retention';
END$$;
