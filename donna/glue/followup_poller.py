"""
Follow-up poller — fires scheduled follow-ups when their time comes.

Checks the followups.sqlite table every 60s. For each pending follow-up
whose scheduled_at is in the past, sends the email via Gmail SMTP and
marks it fired.

Run via: python -m donna.glue.followup_poller
Or from the IPC server startup.
"""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import sqlite3
import ssl
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

log = logging.getLogger(__name__)

_POLL_INTERVAL = 60  # seconds
_SMTP_HOST = "smtp.gmail.com"
_SMTP_PORT = 587


def _db_path() -> Path:
    base = os.getenv("DONNA_CALENDAR_DB", "/home/dell/dell-hack/data/donna_calendar.sqlite")
    return Path(base).parent / "followups.sqlite"


def _get_due(db: Path) -> list[dict]:
    if not db.exists():
        return []
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(db) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM followups WHERE status='pending' AND scheduled_at <= ?", (now,)
        ).fetchall()
    return [dict(r) for r in rows]


def _mark_fired(db: Path, followup_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(db) as conn:
        conn.execute(
            "UPDATE followups SET status='fired', fired_at=? WHERE id=?", (now, followup_id)
        )


def _send_email(*, to: str, subject: str, body: str) -> None:
    user = os.getenv("DONNA_EMAIL_USER", "")
    password = os.getenv("DONNA_EMAIL_PASS", "")
    if not user or not password:
        log.warning("DONNA_EMAIL_USER/PASS not set — skipping follow-up send")
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Donna (AI Legal Secretary) <{user}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ctx)
        smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(msg)


def _fire_followup(fu: dict) -> None:
    subject = fu.get("subject") or "Follow-up from Donna AI Legal Secretary"
    body = fu["message"]
    to = fu["client_email"]
    log.info("Firing follow-up | id=%s type=%s to=%s", fu["id"], fu["followup_type"], to)
    try:
        _send_email(to=to, subject=subject, body=body)
        _mark_fired(_db_path(), fu["id"])
        log.info("Follow-up sent | id=%s to=%s", fu["id"], to)
    except Exception as exc:
        log.error("Follow-up send failed | id=%s error=%s", fu["id"], exc)


async def run_poller() -> None:
    log.info("Follow-up poller started | interval=%ss", _POLL_INTERVAL)
    while True:
        try:
            due = _get_due(_db_path())
            if due:
                log.info("Follow-up poller: %d due follow-up(s)", len(due))
                for fu in due:
                    _fire_followup(fu)
        except Exception as exc:
            log.error("Follow-up poll error: %s", exc)
        await asyncio.sleep(_POLL_INTERVAL)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
    asyncio.run(run_poller())
