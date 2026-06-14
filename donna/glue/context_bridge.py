from __future__ import annotations

import os
from pathlib import Path

from donna.glue.test_data import search_context

DEFAULT_CONTEXT_DB = Path("data/donna_m3_context.sqlite")


def lookup_context_block(
    query: str,
    db_path: Path | None = None,
    limit: int = 5,
) -> str:
    """Return formatted case context for agent prompts, or empty string if unavailable."""
    path = db_path or Path(os.getenv("DONNA_CONTEXT_DB", DEFAULT_CONTEXT_DB))
    if not path.exists():
        return ""

    try:
        hits = search_context(path, query, limit=limit)
    except Exception:
        return ""

    if not hits:
        return ""

    lines = [
        f"- [{hit.source}] {hit.title} (case {hit.case_id}): {hit.snippet}"
        for hit in hits
    ]
    return "Relevant case context:\n" + "\n".join(lines)
