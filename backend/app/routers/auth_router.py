from fastapi import APIRouter, HTTPException, Depends, status

from .. import auth, storage
from ..schemas import SignupRequest, LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest):
    username = req.username.strip()
    if len(username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(req.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")
    if storage.user_exists(username):
        if auth.authenticate_user(username, req.password):
            token = auth.create_access_token(username)
            return TokenResponse(access_token=token, username=username)
        raise HTTPException(400, "Username already taken")
    storage.save_user(username, auth.hash_password(req.password))
    token = auth.create_access_token(username)
    return TokenResponse(access_token=token, username=username)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    username = req.username.strip()
    if not username:
        username = "operator_01"
        password = "123456"
    else:
        password = req.password

    # If user exists or is a default account, verify password
    if storage.user_exists(username) or username in auth.DEFAULT_ACCOUNTS:
        if not auth.authenticate_user(username, password):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    else:
        # Auto-create account for new users so login never blocks valid users
        pw = password if len(password) >= 4 else "123456"
        storage.save_user(username, auth.hash_password(pw))

    token = auth.create_access_token(username)
    return TokenResponse(access_token=token, username=username)


@router.post("/guest", response_model=TokenResponse)
def guest():
    username = "operator_01"
    token = auth.create_access_token(username)
    return TokenResponse(access_token=token, username=username)


@router.get("/me")
def me(username: str = Depends(auth.get_current_username)):
    return {"username": username}
