"""Grant or revoke the moderator role for an existing account.

    python -m aed.api.moderators add jan@urzad.gov.pl
    python -m aed.api.moderators remove jan@urzad.gov.pl
    python -m aed.api.moderators list
"""
from __future__ import annotations

import sys

from . import db


def main() -> None:
    db.init()
    cmd, *rest = sys.argv[1:] or ["list"]
    with db.connect() as c:
        if cmd in ("add", "remove") and rest:
            role = "moderator" if cmd == "add" else "dysponent"
            n = c.execute("UPDATE users SET role=? WHERE lower(email)=lower(?)", (role, rest[0])).rowcount
            print(f"{rest[0]}: {role}" if n else f"Nie ma konta {rest[0]} – zarejestruj je najpierw w /dysponent")
        for r in c.execute("SELECT email, organization FROM users WHERE role='moderator' ORDER BY email"):
            print(f"moderator: {r['email']} ({r['organization']})")


if __name__ == "__main__":
    main()
