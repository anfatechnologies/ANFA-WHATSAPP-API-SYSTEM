import pytest_asyncio

from app.core.database import init_database, close_database


@pytest_asyncio.fixture(scope="session")
async def init_db():
    """
    Initializes the DB engines and session factories (db_manager.init())
    before DB-dependent tests run. Request this fixture explicitly (e.g.
    `@pytest.mark.usefixtures("init_db")`) in tests that call
    get_db_session()/get_db() directly - do NOT make this autouse, since
    most tests (password hashing, JWT, webhook signature checks, etc.)
    don't touch the database at all and shouldn't require one to be
    reachable just to run.

    Without this, app.core.database.get_db_session()/get_db() crash with
    'TypeError: NoneType object is not callable', because db_manager is
    only initialized inside the FastAPI app's startup lifespan
    (app/main.py) or the arq worker's startup() hook (backend/worker.py) -
    neither of which runs when pytest imports and calls these functions
    directly.
    """
    await init_database()
    yield
    await close_database()
