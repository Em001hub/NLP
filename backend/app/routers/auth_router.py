from fastapi import APIRouter, HTTPException, Depends, status

from .. import auth, storage
from ..schemas import SignupRequest, LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest):
    if len(req.username.strip()) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(req.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")
    if storage.user_exists(req.username):
        raise HTTPException(400, "Username already taken")
    storage.save_user(req.username, auth.hash_password(req.password))
    token = auth.create_access_token(req.username)
    return TokenResponse(access_token=token, username=req.username)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    if not auth.authenticate_user(req.username, req.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    token = auth.create_access_token(req.username)
    return TokenResponse(access_token=token, username=req.username)


@router.get("/me")
def me(username: str = Depends(auth.get_current_username)):
    return {"username": username}
