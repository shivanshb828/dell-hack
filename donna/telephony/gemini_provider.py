"""Gemini Live voice session — replaces LocalVoiceSession when DONNA_USE_GEMINI=1."""

from __future__ import annotations

import asyncio
import base64
import os
import time
from dataclasses import dataclass, field

from donna.glue.prompts.inbound_intake import build_inbound_prompt
from donna.glue.prompts.shared import PI_LAW_KNOWLEDGE, consent_block, rapport_rules
from donna.glue.tools.registry import TOOL_DEFINITIONS, ToolRegistry
from donna.telephony.audio import (
    twilio_payload_to_pcm16_16k,
    wav_bytes_to_pcm16,
    pcm16_to_twilio_payload,
)
from donna.telephony.events import broadcast_event
from donna.voice.tts import synthesize

TWILIO_FRAME_BYTES = 160  # 20ms at 8kHz mu-law
GEMINI_MODEL = os.getenv("DONNA_GEMINI_MODEL", "gemini-live-2.5-flash-preview")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# Gemini disallows dots in function names — sanitize and keep reverse map
_GEMINI_NAME: dict[str, str] = {
    t["function"]["name"]: t["function"]["name"].replace(".", "_")
    for t in TOOL_DEFINITIONS
}
_ORIG_NAME: dict[str, str] = {v: k for k, v in _GEMINI_NAME.items()}


def _build_gemini_tools() -> list[dict]:
    """Convert OpenAI-style TOOL_DEFINITIONS to Gemini FunctionDeclaration dicts."""
    declarations = []
    for t in TOOL_DEFINITIONS:
        fn = t["function"]
        params = dict(fn.get("parameters", {"type": "object", "properties": {}}))
        # Gemini does not support 'default' inside properties — strip it
        if "properties" in params:
            cleaned: dict = {}
            for k, v in params["properties"].items():
                prop = dict(v)
                prop.pop("default", None)
                cleaned[k] = prop
            params = dict(params)
            params["properties"] = cleaned
        declarations.append({
            "name": _GEMINI_NAME[fn["name"]],
            "description": fn.get("description", ""),
            "parameters": params,
        })
    return declarations


def _build_system_prompt(*, firm_name: str, caller_name: str | None, is_returning: bool) -> str:
    base = build_inbound_prompt(
        firm_name=firm_name,
        phase="DISCLOSURE",
        caller_name=caller_name,
        is_returning=is_returning,
    )
    return f"{base}\n\n{rapport_rules()}\n\n{consent_block()}\n\n{PI_LAW_KNOWLEDGE}"


@dataclass
class GeminiVoiceSession:
    call_sid: str
    stream_sid: str
    agent_mode: str
    caller_name: str | None
    is_returning: bool
    tools: ToolRegistry
    firm_name: str
    dashboard_ws: str
    greeting_text: str
    started_at: float = field(default_factory=time.time)
    transcript_lines: list[str] = field(default_factory=list)
    greeting_sent: bool = False
    speaking_until: float = 0.0
    _outbound_frames: asyncio.Queue = field(default_factory=asyncio.Queue)
    _audio_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    _response_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    _session_task: asyncio.Task | None = None
    _gemini_session = None

    async def start(self) -> None:
        self._session_task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._session_task and not self._session_task.done():
            self._session_task.cancel()

    async def send_greeting(self) -> list[str]:
        if self.greeting_sent:
            return []
        self.greeting_sent = True
        self.transcript_lines.append(f"Donna: {self.greeting_text}")
        return await self._tts_to_frames(self.greeting_text)

    async def handle_mulaw_frame(self, payload_b64: str) -> list[str]:
        # Drop inbound audio while Donna is speaking to avoid echo
        if time.time() < self.speaking_until:
            return self._drain()
        pcm16 = twilio_payload_to_pcm16_16k(payload_b64)
        await self._audio_queue.put(pcm16)
        return self._drain()

    def clear_playback(self) -> None:
        self.speaking_until = 0.0
        while True:
            try:
                self._outbound_frames.get_nowait()
            except asyncio.QueueEmpty:
                break

    @property
    def transcript(self) -> str:
        return "\n".join(self.transcript_lines)

    # ── Gemini Live loop ─────────────────────────────────────────────────────

    async def _run(self) -> None:
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            print(f"[Gemini] google-genai not installed: {exc}")
            return

        if not GOOGLE_API_KEY:
            print("[Gemini] GOOGLE_API_KEY not set")
            return

        client = genai.Client(api_key=GOOGLE_API_KEY)
        system_prompt = _build_system_prompt(
            firm_name=self.firm_name,
            caller_name=self.caller_name,
            is_returning=self.is_returning,
        )

        config = types.LiveConnectConfig(
            response_modalities=["TEXT"],
            system_instruction=system_prompt,
            tools=[types.Tool(function_declarations=_build_gemini_tools())],
        )

        try:
            async with client.aio.live.connect(model=GEMINI_MODEL, config=config) as session:
                self._gemini_session = session
                await asyncio.gather(
                    self._send_audio_loop(session, types),
                    self._recv_loop(session, types),
                )
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            print(f"[Gemini] session error: {exc}")

    async def _send_audio_loop(self, session, types) -> None:
        while True:
            pcm = await self._audio_queue.get()
            try:
                await session.send_realtime_input(
                    media=types.Blob(data=pcm, mime_type="audio/pcm;rate=16000")
                )
            except Exception as exc:
                print(f"[Gemini] send error: {exc}")

    async def _recv_loop(self, session, types) -> None:
        accumulated_text = ""
        async for response in session.receive():
            # Text chunks — accumulate until turn complete
            if hasattr(response, "text") and response.text:
                accumulated_text += response.text

            # Model turn end — speak accumulated text
            if (
                hasattr(response, "server_content")
                and response.server_content
                and getattr(response.server_content, "turn_complete", False)
                and accumulated_text.strip()
            ):
                text = accumulated_text.strip()
                accumulated_text = ""
                self.transcript_lines.append(f"Donna: {text}")
                await broadcast_event(self.dashboard_ws, {
                    "type": "donna_speech",
                    "callSid": self.call_sid,
                    "text": text,
                })
                frames = await self._tts_to_frames(text)
                for f in frames:
                    await self._outbound_frames.put(f)

            # Function calls
            if hasattr(response, "tool_call") and response.tool_call:
                fn_responses = []
                for call in response.tool_call.function_calls:
                    orig_name = _ORIG_NAME.get(call.name, call.name)
                    args = dict(call.args) if call.args else {}
                    result = self.tools.execute(
                        call_sid=self.call_sid,
                        tool_name=orig_name,
                        args=args,
                    )
                    await broadcast_event(self.dashboard_ws, {
                        "type": "tool_result",
                        "callSid": self.call_sid,
                        "tool": orig_name,
                        "ok": result.ok,
                        "data": result.data,
                        "error": result.error,
                    })
                    fn_responses.append(
                        types.FunctionResponse(
                            name=call.name,
                            id=call.id,
                            response={"ok": result.ok, "error": result.error, **result.data},
                        )
                    )
                try:
                    await session.send_tool_response(function_responses=fn_responses)
                except Exception as exc:
                    print(f"[Gemini] tool response error: {exc}")

    # ── TTS helpers ──────────────────────────────────────────────────────────

    async def _tts_to_frames(self, text: str) -> list[str]:
        try:
            wav = await asyncio.to_thread(synthesize, text)
            pcm, rate = wav_bytes_to_pcm16(wav)
            payload = pcm16_to_twilio_payload(pcm, rate)
        except Exception as exc:
            print(f"[Gemini] TTS error: {exc}")
            return []
        mulaw = base64.b64decode(payload)
        self.speaking_until = time.time() + max(0.5, len(mulaw) / 8000.0)
        return [
            base64.b64encode(mulaw[i : i + TWILIO_FRAME_BYTES]).decode("ascii")
            for i in range(0, len(mulaw), TWILIO_FRAME_BYTES)
        ]

    def _drain(self) -> list[str]:
        frames = []
        while True:
            try:
                frames.append(self._outbound_frames.get_nowait())
            except asyncio.QueueEmpty:
                break
        return frames
