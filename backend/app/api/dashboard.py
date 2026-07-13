from fastapi import APIRouter, Depends
from app.core.security import verify_admin

router = APIRouter(prefix="/dashboard", dependencies=[Depends(verify_admin)])

@router.get("/stats")
async def get_dashboard_stats():
    return {"status": "authorized", "data": "ANFA Dashboard Access Granted"}
