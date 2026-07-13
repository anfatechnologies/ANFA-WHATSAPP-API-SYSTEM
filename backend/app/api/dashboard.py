from fastapi import APIRouter, Depends
from app.core.security import verify_admin

router = APIRouter(prefix="/dashboard", dependencies=[Depends(verify_admin)])

# Endpoints will be added here once implemented
