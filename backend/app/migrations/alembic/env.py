# /backend/app/migrations/alembic/env.py
# Alembic Environment Configuration
# Supports async SQLAlchemy (asyncpg) with auto-generated migrations.

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Load settings BEFORE importing models
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from app.core.config import settings
from app.models.schema import Base  # Import Base so Alembic sees all models

# Alembic Config object (provides access to alembic.ini values)
config = context.config

# Override sqlalchemy.url with actual value from settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL_PRIMARY)

# Setup logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# This is the MetaData object that autogenerate inspects
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no DB connection needed).

    Generates a SQL script instead of connecting to the database.
    Useful for reviewing changes before applying.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create async engine and run migrations in 'online' mode."""
    connectable = create_async_engine(
        settings.DATABASE_URL_PRIMARY,
        future=True,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode against a live database."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
