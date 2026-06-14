"""
Donna lawyer query agent — Ollama-backed, no OpenClaw required.

Primary path: openclaw run lawyer --input "..."
This module: fallback / local dev / testing without OpenClaw running.

Usage:
    python -m donna.lawyer.agent "Who has the most urgent SOL deadline?"
    python scripts/ask.py "Give me a dashboard summary"
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
from typing import Any

import httpx

from tools import ALL_TOOL_DEFINITIONS
from tools.calendar import book_calendar, check_calendar_conflicts, get_upcoming_events
from tools.case_files import (
    create_case_file,
    get_case_file,
    get_case_summary,
    get_dashboard_stats,
    get_payment_summary,
    get_urgent_deadlines,
    list_cases,
    log_court_date,
    log_payment,
    search_context,
    update_case_file,
)
from tools.case_law import analyze_case_weaknesses, profile_adverse_adjuster, search_case_law

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODEL = os.environ.get("DONNA_LAWYER_MODEL", os.environ.get("DONNA_MODEL", "qwen2.5:32b"))

_PROMPT_PATH = pathlib.Path(__file__).parent.parent.parent / "agent" / "lawyer_prompt.md"

_DISPATCH: dict[str, Any] = {
    "get_dashboard_stats":      get_dashboard_stats,
    "get_urgent_deadlines":     get_urgent_deadlines,
    "get_case_summary":         get_case_summary,
    "get_case_file":            get_case_file,
    "list_cases":               list_cases,
    "search_context":           search_context,
    "get_upcoming_events":      get_upcoming_events,
    "get_payment_summary":      get_payment_summary,
    "search_case_law":          search_case_law,
    "analyze_case_weaknesses":  analyze_case_weaknesses,
    "profile_adverse_adjuster": profile_adverse_adjuster,
    "check_calendar_conflicts": check_calendar_conflicts,
    "book_calendar":            book_calendar,
    "create_case_file":         create_case_file,
    "update_case_file":         update_case_file,
    "log_payment":              log_payment,
    "log_court_date":           log_court_date,
}

_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": t["function"]["name"],
            "description": t["function"]["description"],
            "parameters": t["function"]["parameters"],
        },
    }
    for t in ALL_TOOL_DEFINITIONS
]


def _system_prompt() -> str:
    try:
        return _PROMPT_PATH.read_text()
    except OSError:
        return (
            "You are Donna, AI legal secretary. Answer the lawyer's questions "
            "about their caseload using your tools. Be brief and direct."
        )


def _call_tool(name: str, arguments: dict) -> str:
    fn = _DISPATCH.get(name)
    if fn is None:
        return json.dumps({"error": f"Unknown tool: {name}"})
    try:
        result = fn(**arguments)
        return json.dumps(result, default=str)
    except Exception as exc:
        return json.dumps({"error": str(exc)})


def ask(question: str, verbose: bool = False, model: str = MODEL) -> str:
    """Send one question to the lawyer agent; return the final text answer."""
    messages: list[dict] = [{"role": "user", "content": question}]
    system = _system_prompt()

    for round_num in range(12):
        payload = {
            "model": model,
            "messages": [{"role": "system", "content": system}] + messages,
            "tools": _TOOLS_SCHEMA,
            "stream": False,
        }
        resp = httpx.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=120)
        resp.raise_for_status()
        msg = resp.json()["message"]
        messages.append(msg)

        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            return msg.get("content", "").strip()

        for tc in tool_calls:
            fn_info = tc["function"]
            name = fn_info["name"]
            args = fn_info.get("arguments") or {}
            if isinstance(args, str):
                args = json.loads(args)
            result = _call_tool(name, args)
            if verbose:
                preview = result[:300] + ("..." if len(result) > 300 else "")
                print(f"[tool:{round_num}] {name}({args}) → {preview}", file=sys.stderr)
            messages.append({"role": "tool", "content": result})

    return "Reached maximum tool-call depth without a final answer."


def interactive(model: str = MODEL) -> None:
    """Simple REPL for continuous lawyer queries."""
    print("Donna (lawyer query mode) — type your question, Ctrl-C to exit.\n")
    while True:
        try:
            question = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            break
        if not question:
            continue
        answer = ask(question, model=model)
        print(f"Donna: {answer}\n")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Ask Donna a question about your caseload (Ollama-direct mode)."
    )
    parser.add_argument("question", nargs="?", help="Question to ask. Omit for interactive mode.")
    parser.add_argument("--model", default=MODEL, help="Ollama model ID.")
    parser.add_argument("-v", "--verbose", action="store_true", help="Print tool call traces.")
    args = parser.parse_args()

    if args.question:
        print(ask(args.question, verbose=args.verbose, model=args.model))
    else:
        interactive(model=args.model)


if __name__ == "__main__":
    main()
