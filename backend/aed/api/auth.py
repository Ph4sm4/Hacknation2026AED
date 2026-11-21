"""Minimal, dependency-free auth for data-holder accounts: scrypt password hashes + HMAC-signed tokens."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import db

def _secret() -> str:
    if os.environ.get("AED_SECRET"):
        return os.environ["AED_SECRET"]
    f = db.DB_PATH.parent / ".secret"
    f.parent.mkdir(parents=True, exist_ok=True)
    if not f.exists():
        f.write_text(secrets.token_hex(32))
    return f.read_text().strip()


SECRET = _secret()
TOKEN_TTL = 60 * 60 * 12
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, dk = stored.split("$")
    except ValueError:
        return False
    test = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(test.hex(), dk)


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def make_token(user_id: int) -> str:
    payload = _b64(json.dumps({"uid": user_id, "exp": int(time.time()) + TOKEN_TTL}).encode())
    sig = _b64(hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def read_token(token: str) -> int | None:
    try:
        payload, sig = token.split(".")
        good = _b64(hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, good):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return data["uid"] if data["exp"] > time.time() else None
    except Exception:  # noqa: BLE001
        return None


def moderator_emails() -> set[str]:
    """Extra moderators from the environment (comma separated), e.g. AED_MODERATORS=ops@gdzieaed.pl"""
    return {e.strip().lower() for e in os.environ.get("AED_MODERATORS", "").split(",") if e.strip()}


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    uid = read_token(cred.credentials) if cred else None
    if uid is None:
        raise HTTPException(401, "Wymagane zalogowanie")
    with db.connect() as c:
        row = c.execute("SELECT id, email, organization, regon, role, created_at FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(401, "Konto nie istnieje")
    user = dict(row)
    user["is_moderator"] = user.pop("role") == "moderator" or user["email"] in moderator_emails()
    return user


def require_moderator(user: dict = Depends(current_user)) -> dict:
    if not user["is_moderator"]:
        raise HTTPException(403, "Dostęp tylko dla moderatorów zgłoszeń")
    return user


def optional_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict | None:
    try:
        return current_user(cred)
    except HTTPException:
        return None
