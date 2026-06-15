# voice_agent — Donna Gemini Live voice stack

Node 22 + TypeScript + Express + WebSocket + Gemini Live + Twilio Media Streams. Production-tuned pattern lifted from `lending-pipeline/voice_agent/` and retargeted for legal client intake.

Three call modes share one `/media-stream` WebSocket handler:

| Mode | Trigger | Persona | Tools |
|---|---|---|---|
| `inbound` | Twilio `POST /voice` (any From not the attorney's cell) | Donna legal-intake — calm, lead-capture, book consult, follow-up email | `record_consent`, `store_lead_profile`, `calm_response`, `discuss_rates`, `book_appointment`, `send_intake_email`, `transfer_to_human`, `end_call_politely` |
| `outbound` | `POST /api/calls/outbound` → Twilio dial out → `POST /voice/outbound` | Follow-up call to a previously captured lead | same intake tools (outbound greeting block in prompt) |
| `attorney` | Twilio `POST /voice` with `From == ATTORNEY_PHONE` | Portal mode — query the firm's case DB by voice | `list_recent_leads`, `lookup_lead`, `list_upcoming_appointments`, `summarize_call`, `end_call_politely` |

## Architecture

```
Twilio PSTN (mulaw 8kHz)
   │ POST /voice           ── stream token issued, mode chosen by From
   │ TwiML <Connect><Stream>
   ▼
WebSocket /media-stream    ── audio bridge + tool dispatch
   │   mulaw 8k → PCM 16k → Gemini Live
   │   Gemini PCM 24k → mulaw 8k → Twilio
   │   Gemini interrupt → "clear" frame to Twilio (barge-in)
   ▼
@google/genai ai.live.connect
   │  model = gemini-3.1-flash-live-preview, voice = Aoede, temp 0.3
   │  built-in VAD (low sensitivity, 300ms silence threshold)
   │  inputAudioTranscription + outputAudioTranscription
   ▼
Tool calls (FunctionResponseScheduling.WHEN_IDLE — agent keeps talking)
   ▼
better-sqlite3 (voice_call_sessions, voice_leads, voice_call_events, voice_appointments)
WebSocket /dashboard       ── live event push to React UI
```

Audio codec: `alawmulaw@6.0.0`. mulaw 8k ↔ PCM 16k via linear interpolation up, sample-skip down.

State storage: `better-sqlite3` opens `DONNA_DB_PATH` (default `./voice_agent.sqlite`). Schema applied idempotently at boot from `db-migrations.sql`. Tables prefixed `voice_` to avoid collision with the Python `donna/` schema.

## Setup

```bash
cd voice_agent
npm install
cp .env.example .env
# fill in TWILIO_*, GEMINI_API_KEY, PUBLIC_URL (ngrok), ATTORNEY_PHONE
npm run dev
```

Three terminals for a full demo loop:

```bash
# T1 — public tunnel for Twilio
ngrok http 3001

# T2 — voice agent
cd voice_agent && npm run dev

# T3 — dashboard
cd donna/dashboard && npm run dev
```

On boot, the voice agent:
1. Opens `DONNA_DB_PATH`, runs `db-migrations.sql`.
2. Logs `[voice-agent] listening on port 3001`.
3. Auto-registers Twilio number's voice webhook to `${PUBLIC_URL}/voice`.
4. Mounts dashboard WS on `:3001/dashboard`.

## Environment variables

See `.env.example` for the full list. Required: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `GEMINI_API_KEY`. Highly recommended: `PUBLIC_URL`, `ATTORNEY_PHONE`, `ATTORNEY_EMAIL`, `FIRM_NAME`.

`GEMINI_API_KEY` must be an `AIza*` key from aistudio.google.com — service-account / OAuth keys do not work with Live.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/voice` | Twilio inbound webhook. Chooses mode by `From`. Returns `<Connect><Stream>` TwiML. |
| `POST` | `/voice/outbound` | Twilio outbound-leg webhook. Same TwiML shape with `mode=outbound`. |
| `POST` | `/api/calls/outbound` | Trigger an outbound dial via Twilio REST. Body: `{phone, leadId?}`. |
| `WS`   | `/media-stream` | Twilio Media Streams audio bridge. Stream-token guarded (30s TTL, single-use). |
| `WS`   | `/dashboard` | Live event push for the React dashboard. |
| `GET`  | `/health` | Healthcheck. |

## Tests

```bash
npm test      # 17 unit tests: twiml, audio codec, validation, event chain, rate card
npm run check # tsc --noEmit
```

## Tuning notes (carry-over from lending-pipeline)

- **Temperature 0.3** — low for consistency. Higher (>0.5) risks hallucinated fees/programs.
- **VAD LOW sensitivity** — telephony has noise floor; HIGH false-triggers on background noise.
- **300ms silence threshold** — natural cadence; <200ms cuts off thinking pauses; >500ms feels sluggish.
- **Prefix padding 20ms** — captures speech onset.
- **Stream token TTL 30s** — single-use, prevents replay.
- **Function response WHEN_IDLE** — agent keeps speaking through tool execution; pair with mandatory filler phrase in system prompt.

## Compliance (intake mode)

The system prompt enforces:
- AI identity disclosure + recording disclosure before any data collection.
- NEVER give legal advice — deflect to attorney.
- NEVER promise outcomes / settlement amounts / case acceptance.
- NEVER ask for SSN.
- NEVER ask the caller to share documents over voice — direct to follow-up email.
- Explicit "this is intake info, not attorney-client privileged" framing.

## Bridging to the Python `donna/` services

- **Email approval**: TS writes JSON drafts to `${DONNA_DRAFTS_DIR}/${call_sid}/${uuid}.json`. Python `donna/email_server/approval_server.py` polls this dir.
- **Calendar**: TS writes directly to `voice_appointments` in the same SQLite. Python tools can read it.
- **Dashboard**: TS pushes events via `/dashboard` WS; React dashboard subscribes.

## Deletion log

This rewrite replaced the entire Python voice + telephony stack. Deleted:
- `donna/voice/` (pipeline.py, stt.py, tts.py, vad.py, wake_word.py, parakeet_server.py, dashboard_bridge.py, tests/)
- `donna/telephony/` (server.py, local_provider.py, llm.py, audio.py, etc.)
- `scripts/run_voice.sh`, `scripts/run_telephony.sh`
- `donna/VOICE_PIPELINE.md`

Kept: `donna/email_server/`, `donna/glue/`, `donna/tools/`, `donna/dashboard/`, `donna/agent/donna.yaml`, all `data/*.sqlite`.
