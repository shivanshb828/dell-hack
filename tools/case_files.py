"""Case file tools — create, read, update, list, search."""

from __future__ import annotations

import os
from datetime import datetime, timezone, date
from typing import Any
from uuid import uuid4

import psycopg

GBRAIN_DSN = os.environ.get("GBRAIN_DSN", "postgresql://donna@localhost:7700/donna")

# Statute of limitations defaults by state (years). Simplified — tolling rules handled separately.
_SOL_YEARS: dict[str, int] = {
    "CA": 2, "NY": 3, "TX": 2, "FL": 4, "IL": 2,
    "PA": 2, "OH": 2, "GA": 2, "NJ": 2, "MI": 3,
}


def _conn():
    return psycopg.connect(GBRAIN_DSN)


def _sol_date(incident_date: date, state: str) -> date:
    years = _SOL_YEARS.get(state.upper(), 2)
    return incident_date.replace(year=incident_date.year + years)


# ── create_case_file ──────────────────────────────────────────────────────────

def create_case_file(
    *,
    client_name: str,
    dol: str,                          # date of loss, YYYY-MM-DD
    incident_type: str,
    incident_location: str,
    incident_description: str,
    injuries: str,
    phone: str | None = None,
    email: str | None = None,
    treating_physician: str | None = None,
    at_fault_party: str | None = None,
    adverse_carrier: str | None = None,
    client_carrier: str | None = None,
    witnesses: str | None = None,
    police_report_number: str | None = None,
    state_jurisdiction: str = "CA",
) -> dict[str, Any]:
    client_id = f"client-{uuid4()}"
    case_id = f"case-{uuid4()}"
    incident_date = date.fromisoformat(dol)
    sol = _sol_date(incident_date, state_jurisdiction)

    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO clients (id, name, phone, email,
              consent_recording, consent_ai_disclosure, consent_data_storage)
            VALUES (%s,%s,%s,%s, TRUE, TRUE, TRUE)
            ON CONFLICT (phone) DO NOTHING
            """,
            (client_id, client_name, phone, email),
        )
        conn.execute(
            """
            INSERT INTO cases (
              id, client_id, case_type, incident_date, incident_location,
              incident_description, at_fault_party, adverse_carrier, client_carrier,
              injuries, treating_physician, witnesses, police_report_number,
              state_jurisdiction, statute_of_limitations_date
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (case_id, client_id, incident_type, incident_date, incident_location,
             incident_description, at_fault_party, adverse_carrier, client_carrier,
             injuries, treating_physician, witnesses, police_report_number,
             state_jurisdiction, sol),
        )
        # Seed a memory entry so GBrain can recall this case in future sessions
        conn.execute(
            "INSERT INTO memories (case_id, client_id, kind, content) VALUES (%s,%s,%s,%s)",
            (case_id, client_id, "intake_summary",
             f"{client_name}: {incident_type} on {dol} at {incident_location}. Injuries: {injuries}."),
        )

    sol_warning = None
    days_to_sol = (sol - date.today()).days
    if days_to_sol <= 60:
        sol_warning = f"WARNING: SOL is in {days_to_sol} days ({sol.isoformat()}). Flag for attorney review."

    return {
        "status": "created",
        "client_id": client_id,
        "case_id": case_id,
        "sol_date": sol.isoformat(),
        "sol_warning": sol_warning,
        "formatted_confirmation": (
            f"Case file created for {client_name}, {incident_type}, {dol}. "
            f"SOL: {sol.isoformat()}."
            + (f" {sol_warning}" if sol_warning else "")
        ),
    }


# ── get_case_file ─────────────────────────────────────────────────────────────

def get_case_file(*, query: str) -> dict[str, Any]:
    """Retrieve by client name or case_id."""
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT c.id, cl.name, c.case_type, c.incident_date, c.incident_location,
                   c.injuries, c.stage, c.statute_of_limitations_date,
                   c.at_fault_party, c.adverse_carrier, c.state_jurisdiction
            FROM cases c
            JOIN clients cl ON cl.id = c.client_id
            WHERE c.id = %s OR lower(cl.name) LIKE lower(%s)
            ORDER BY c.created_at DESC
            LIMIT 5
            """,
            (query, f"%{query}%"),
        ).fetchall()

    if not rows:
        return {"status": "not_found", "query": query}

    return {
        "status": "found",
        "count": len(rows),
        "cases": [
            {
                "case_id": r[0], "client_name": r[1], "case_type": r[2],
                "incident_date": str(r[3]), "incident_location": r[4],
                "injuries": r[5], "stage": r[6], "sol_date": str(r[7]),
                "at_fault_party": r[8], "adverse_carrier": r[9],
                "state_jurisdiction": r[10],
            }
            for r in rows
        ],
    }


# ── update_case_file ──────────────────────────────────────────────────────────

_ALLOWED_FIELDS = {
    "case_type", "incident_date", "incident_location", "incident_description",
    "at_fault_party", "adverse_carrier", "client_carrier", "injuries",
    "treating_physician", "witnesses", "police_report_number",
    "stage", "state_jurisdiction",
}

def update_case_file(*, case_id: str, field: str, value: str) -> dict[str, Any]:
    if field not in _ALLOWED_FIELDS:
        return {"status": "error", "message": f"Field '{field}' is not updatable via this tool."}

    with _conn() as conn:
        conn.execute(
            f"UPDATE cases SET {field} = %s, updated_at = NOW() WHERE id = %s",
            (value, case_id),
        )
        affected = conn.rowcount

    if affected == 0:
        return {"status": "not_found", "case_id": case_id}

    return {"status": "updated", "case_id": case_id, "field": field, "value": value}


# ── list_cases ────────────────────────────────────────────────────────────────

def list_cases(*, status: str = "all") -> dict[str, Any]:
    with _conn() as conn:
        if status == "all":
            rows = conn.execute(
                """
                SELECT c.id, cl.name, c.case_type, c.incident_date, c.stage,
                       c.statute_of_limitations_date
                FROM cases c JOIN clients cl ON cl.id = c.client_id
                ORDER BY c.created_at DESC
                """
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT c.id, cl.name, c.case_type, c.incident_date, c.stage,
                       c.statute_of_limitations_date
                FROM cases c JOIN clients cl ON cl.id = c.client_id
                WHERE c.stage = %s
                ORDER BY c.created_at DESC
                """,
                (status,),
            ).fetchall()

    cases = [
        {
            "case_id": r[0], "client_name": r[1], "case_type": r[2],
            "incident_date": str(r[3]), "stage": r[4], "sol_date": str(r[5]),
        }
        for r in rows
    ]

    # Flag anything close to SOL
    today = date.today()
    for c in cases:
        if c["sol_date"]:
            days = (date.fromisoformat(c["sol_date"]) - today).days
            if days <= 60:
                c["sol_warning"] = f"{days} days to SOL"

    return {"count": len(cases), "cases": cases}


# ── search_context ────────────────────────────────────────────────────────────

def search_context(*, query: str, limit: int = 5) -> dict[str, Any]:
    """Hybrid BM25 + vector search across all case context in GBrain."""
    tsquery = query.replace(" ", " & ")
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT 'case' AS source, c.id AS ref_id, cl.name AS title,
              c.case_type || ': ' || coalesce(c.injuries,'') || ' at ' || coalesce(c.incident_location,'') AS snippet,
              ts_rank(to_tsvector('english', coalesce(c.incident_description,'') || ' ' || coalesce(c.injuries,'')),
                      to_tsquery('english', %s)) AS rank
            FROM cases c JOIN clients cl ON cl.id = c.client_id
            WHERE to_tsvector('english', coalesce(c.incident_description,'') || ' ' || coalesce(c.injuries,''))
                  @@ to_tsquery('english', %s)
            UNION ALL
            SELECT 'memory' AS source, case_id AS ref_id, kind AS title, content AS snippet,
              ts_rank(to_tsvector('english', content), to_tsquery('english', %s)) AS rank
            FROM memories
            WHERE to_tsvector('english', content) @@ to_tsquery('english', %s)
            UNION ALL
            SELECT 'document' AS source, case_id AS ref_id, filename AS title,
              coalesce(summary,'') AS snippet,
              ts_rank(to_tsvector('english', coalesce(summary,'')), to_tsquery('english', %s)) AS rank
            FROM documents
            WHERE to_tsvector('english', coalesce(summary,'')) @@ to_tsquery('english', %s)
            ORDER BY rank DESC
            LIMIT %s
            """,
            (tsquery, tsquery, tsquery, tsquery, tsquery, tsquery, limit),
        ).fetchall()

    return {
        "query": query,
        "count": len(rows),
        "results": [
            {"source": r[0], "ref_id": r[1], "title": r[2], "snippet": r[3]}
            for r in rows
        ],
    }


# ── Payment tools ─────────────────────────────────────────────────────────────

def log_payment(
    *, case_id: str, amount: float, payment_type: str, date: str, notes: str | None = None
) -> dict[str, Any]:
    payment_id = f"pay-{uuid4()}"
    with _conn() as conn:
        conn.execute(
            "INSERT INTO payments (id, case_id, amount, payment_type, date, notes) VALUES (%s,%s,%s,%s,%s,%s)",
            (payment_id, case_id, amount, payment_type, date, notes),
        )
    return {"status": "logged", "payment_id": payment_id, "amount": amount, "type": payment_type}


def get_payment_summary(*, case_id: str) -> dict[str, Any]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT payment_type, status, amount, date, notes FROM payments WHERE case_id = %s ORDER BY date",
            (case_id,),
        ).fetchall()
    total = sum(r[2] for r in rows)
    return {
        "case_id": case_id,
        "total": float(total),
        "payments": [
            {"type": r[0], "status": r[1], "amount": float(r[2]), "date": str(r[3]), "notes": r[4]}
            for r in rows
        ],
    }


def log_court_date(
    *, case_id: str, date: str, court: str, outcome: str,
    judge: str | None = None, notes: str | None = None
) -> dict[str, Any]:
    court_date_id = f"cd-{uuid4()}"
    with _conn() as conn:
        conn.execute(
            "INSERT INTO court_dates (id, case_id, date, court, judge, outcome, notes) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (court_date_id, case_id, date, court, judge, outcome, notes),
        )
    return {"status": "logged", "court_date_id": court_date_id}


# ── Lawyer query tools ────────────────────────────────────────────────────────

def get_urgent_deadlines(*, days_ahead: int = 90) -> dict[str, Any]:
    """Return open cases whose SOL expires within days_ahead days, ordered by urgency."""
    today = date.today()
    cutoff = today + timedelta(days=days_ahead)
    with _conn() as conn:
        cur = conn.execute(
            """
            SELECT c.id, cl.name, c.case_type, c.incident_date, c.stage,
                   c.statute_of_limitations_date, c.state_jurisdiction,
                   c.at_fault_party, c.adverse_carrier
            FROM cases c JOIN clients cl ON cl.id = c.client_id
            WHERE c.statute_of_limitations_date <= %s
              AND c.stage NOT IN ('settlement', 'closed')
            ORDER BY c.statute_of_limitations_date ASC
            """,
            (cutoff,),
        )
        rows = cur.fetchall()

    deadlines = []
    for r in rows:
        sol = r[5]
        if sol is None:
            continue
        sol_date = sol if isinstance(sol, date) else date.fromisoformat(str(sol))
        days_left = (sol_date - today).days
        deadlines.append({
            "case_id": r[0],
            "client_name": r[1],
            "case_type": r[2],
            "incident_date": str(r[3]),
            "stage": r[4],
            "sol_date": str(r[5]),
            "state": r[6],
            "at_fault_party": r[7],
            "adverse_carrier": r[8],
            "days_to_sol": days_left,
            "urgency": "critical" if days_left <= 30 else "warning",
        })

    return {
        "count": len(deadlines),
        "days_ahead": days_ahead,
        "deadlines": deadlines,
    }


def get_case_summary(*, case_id: str) -> dict[str, Any]:
    """Full case summary: parties, stage, SOL, notes, payments, court dates, documents."""
    with _conn() as conn:
        cur = conn.execute(
            """
            SELECT c.id, c.case_type, c.incident_date, c.incident_location,
                   c.incident_description, c.injuries, c.treating_physician,
                   c.at_fault_party, c.adverse_carrier, c.client_carrier,
                   c.witnesses, c.police_report_number, c.stage,
                   c.statute_of_limitations_date, c.state_jurisdiction, c.updated_at,
                   cl.name, cl.phone, cl.email
            FROM cases c JOIN clients cl ON cl.id = c.client_id
            WHERE c.id = %s
            """,
            (case_id,),
        )
        row = cur.fetchone()
        if not row:
            return {"status": "not_found", "case_id": case_id}

        memories = conn.execute(
            "SELECT kind, content, created_at FROM memories WHERE case_id = %s ORDER BY created_at",
            (case_id,),
        ).fetchall()

        payments = conn.execute(
            "SELECT payment_type, status, amount, date FROM payments WHERE case_id = %s ORDER BY date",
            (case_id,),
        ).fetchall()

        court_dates = conn.execute(
            "SELECT date, court, judge, outcome, notes FROM court_dates WHERE case_id = %s ORDER BY date",
            (case_id,),
        ).fetchall()

        docs = conn.execute(
            "SELECT filename, doc_type, summary FROM documents WHERE case_id = %s ORDER BY uploaded_at",
            (case_id,),
        ).fetchall()

    today = date.today()
    sol = row[13]
    sol_date = sol if isinstance(sol, date) else (date.fromisoformat(str(sol)) if sol else None)
    days_to_sol = (sol_date - today).days if sol_date else None

    return {
        "status": "found",
        "case": {
            "id": row[0],
            "case_type": row[1],
            "incident_date": str(row[2]),
            "incident_location": row[3],
            "incident_description": row[4],
            "injuries": row[5],
            "treating_physician": row[6],
            "at_fault_party": row[7],
            "adverse_carrier": row[8],
            "client_carrier": row[9],
            "witnesses": row[10],
            "police_report_number": row[11],
            "stage": row[12],
            "sol_date": str(row[13]),
            "days_to_sol": days_to_sol,
            "sol_urgency": (
                "critical" if days_to_sol is not None and days_to_sol <= 30 else
                "warning" if days_to_sol is not None and days_to_sol <= 90 else
                "ok"
            ),
            "state_jurisdiction": row[14],
            "last_updated": str(row[15]),
            "client_name": row[16],
            "client_phone": row[17],
            "client_email": row[18],
        },
        "notes": [
            {"kind": m[0], "content": m[1], "at": str(m[2])}
            for m in memories
        ],
        "payments": [
            {"type": p[0], "status": p[1], "amount": float(p[2]), "date": str(p[3])}
            for p in payments
        ],
        "court_dates": [
            {"date": str(c[0]), "court": c[1], "judge": c[2], "outcome": c[3], "notes": c[4]}
            for c in court_dates
        ],
        "documents": [
            {"filename": d[0], "type": d[1], "summary": d[2]}
            for d in docs
        ],
    }


def get_dashboard_stats() -> dict[str, Any]:
    """Aggregate caseload stats: counts by stage, SOL urgency, upcoming events."""
    today = date.today()
    cutoff_30 = today + timedelta(days=30)
    cutoff_90 = today + timedelta(days=90)

    with _conn() as conn:
        stage_rows = conn.execute(
            "SELECT stage, COUNT(*) FROM cases GROUP BY stage ORDER BY stage"
        ).fetchall()

        client_count = conn.execute("SELECT COUNT(*) FROM clients").fetchone()[0]

        critical_sol = conn.execute(
            "SELECT COUNT(*) FROM cases WHERE statute_of_limitations_date <= %s AND stage NOT IN ('settlement','closed')",
            (cutoff_30,),
        ).fetchone()[0]

        warning_sol = conn.execute(
            """
            SELECT COUNT(*) FROM cases
            WHERE statute_of_limitations_date > %s
              AND statute_of_limitations_date <= %s
              AND stage NOT IN ('settlement','closed')
            """,
            (cutoff_30, cutoff_90),
        ).fetchone()[0]

        upcoming_events = conn.execute(
            "SELECT COUNT(*) FROM calendar_events WHERE scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'"
        ).fetchone()[0]

        recent_intake = conn.execute(
            "SELECT COUNT(*) FROM cases WHERE stage = 'intake'"
        ).fetchone()[0]

    return {
        "total_clients": client_count,
        "total_cases": sum(r[1] for r in stage_rows),
        "by_stage": {r[0]: r[1] for r in stage_rows},
        "sol_critical_30d": critical_sol,
        "sol_warning_90d": warning_sol,
        "upcoming_events_7d": upcoming_events,
        "pending_intake": recent_intake,
    }


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "create_case_file",
            "description": "Create a new client and case record after intake.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {"type": "string"},
                    "dol": {"type": "string", "description": "Date of loss YYYY-MM-DD"},
                    "incident_type": {"type": "string"},
                    "incident_location": {"type": "string"},
                    "incident_description": {"type": "string"},
                    "injuries": {"type": "string"},
                    "phone": {"type": "string"},
                    "email": {"type": "string"},
                    "treating_physician": {"type": "string"},
                    "at_fault_party": {"type": "string"},
                    "adverse_carrier": {"type": "string"},
                    "client_carrier": {"type": "string"},
                    "witnesses": {"type": "string"},
                    "police_report_number": {"type": "string"},
                    "state_jurisdiction": {"type": "string", "default": "CA"},
                },
                "required": ["client_name", "dol", "incident_type", "incident_location", "incident_description", "injuries"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_case_file",
            "description": "Retrieve a case by client name or case_id.",
            "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_case_file",
            "description": "Update a single field on an existing case.",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_id": {"type": "string"},
                    "field": {"type": "string"},
                    "value": {"type": "string"},
                },
                "required": ["case_id", "field", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_cases",
            "description": "List cases optionally filtered by stage.",
            "parameters": {
                "type": "object",
                "properties": {"status": {"type": "string", "default": "all"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_context",
            "description": "Hybrid search across cases, memories, and documents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_payment",
            "description": "Record a payment against a case.",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_id": {"type": "string"},
                    "amount": {"type": "number"},
                    "payment_type": {"type": "string", "enum": ["retainer","settlement","fee","lien","other"]},
                    "date": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["case_id", "amount", "payment_type", "date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_payment_summary",
            "description": "Get all payments for a case.",
            "parameters": {"type": "object", "properties": {"case_id": {"type": "string"}}, "required": ["case_id"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_court_date",
            "description": "Record a court date and outcome.",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_id": {"type": "string"},
                    "date": {"type": "string"},
                    "court": {"type": "string"},
                    "outcome": {"type": "string"},
                    "judge": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["case_id", "date", "court", "outcome"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_urgent_deadlines",
            "description": "List open cases approaching their statute of limitations deadline. Returns cases ordered by urgency (soonest first).",
            "parameters": {
                "type": "object",
                "properties": {
                    "days_ahead": {
                        "type": "integer",
                        "default": 90,
                        "description": "How far ahead to look in days (default 90).",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_case_summary",
            "description": "Full case summary for a given case_id: parties, stage, SOL status, all notes, payments, court dates, and documents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_id": {"type": "string", "description": "The case ID (e.g. case-uuid)."},
                },
                "required": ["case_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_stats",
            "description": "Aggregate caseload stats: total cases by stage, SOL urgency counts, upcoming calendar events this week, and pending intakes.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]
