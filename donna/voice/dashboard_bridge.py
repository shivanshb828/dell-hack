import json
import os
import time

import websockets

DASHBOARD_WS = os.getenv("DONNA_DASHBOARD_WS", "ws://localhost:3001")


async def emit_to_dashboard(event: dict):
    event.setdefault("ts", int(time.time()))
    try:
        async with websockets.connect(DASHBOARD_WS, open_timeout=1) as ws:
            await ws.send(json.dumps(event))
    except Exception:
        pass  # never block voice pipeline if dashboard is down
