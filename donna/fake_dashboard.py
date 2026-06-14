"""
Fake dashboard — WebSocket server at ws://localhost:3001
Prints all events from the voice pipeline in real time.
Run this BEFORE running pipeline.py.

Usage: python donna/fake_dashboard.py
"""

import asyncio
import json
import websockets

PORT = 3001
COLORS = {
    "user_speech":      "\033[94m",   # blue
    "donna_speech":     "\033[92m",   # green
    "wake_word_detected": "\033[93m", # yellow
    "pipeline_status":  "\033[90m",   # grey
}
RESET = "\033[0m"
BOLD  = "\033[1m"


async def handler(ws):
    addr = ws.remote_address
    print(f"  [{addr[0]}:{addr[1]} connected]")
    try:
        async for raw in ws:
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                print(f"  [bad JSON] {raw}")
                continue

            etype = event.get("type", "unknown")
            color = COLORS.get(etype, "\033[37m")

            if etype == "user_speech":
                print(f"{color}{BOLD}YOU   >{RESET}{color} {event.get('text','')}{RESET}")
            elif etype == "donna_speech":
                print(f"{color}{BOLD}DONNA >{RESET}{color} {event.get('text','')}{RESET}")
            elif etype == "pipeline_status":
                status = event.get("status", "?")
                print(f"{color}[{status.upper()}]{RESET}")
            else:
                print(f"{color}[{etype}] {event}{RESET}")
    except websockets.exceptions.ConnectionClosed:
        print(f"  [{addr[0]}:{addr[1]} disconnected]")


async def main():
    print("=" * 50)
    print(f"  DONNA fake dashboard — ws://localhost:{PORT}")
    print("  Waiting for pipeline events... Ctrl+C to quit")
    print("=" * 50)
    async with websockets.serve(handler, "localhost", PORT):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nDashboard stopped.")
