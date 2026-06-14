#!/usr/bin/env python3
"""
Donna — lawyer query CLI.

Primary path (OpenClaw running):
    openclaw run lawyer --input "Who has the most urgent SOL deadline?"

This script (Ollama-direct fallback):
    python scripts/ask.py "Give me a dashboard summary"
    python scripts/ask.py               # interactive mode
    python scripts/ask.py -v "..."      # verbose: show tool traces
    DONNA_LAWYER_MODEL=qwen2.5:72b python scripts/ask.py "..."
"""

import sys
import os

# Ensure project root is on path when run as a script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from donna.lawyer.agent import main

if __name__ == "__main__":
    main()
