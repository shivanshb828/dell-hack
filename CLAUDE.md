# Donna — Project Context for Claude

## What is this

Donna is an AI legal intake + customer-origination layer. Voice-native, OS-aware. Demo vertical is a personal-injury law firm — Donna handles inbound + outbound calls for lead capture, calms upset callers, books consults, and routes documents to a follow-up email. The attorney's personal cell line gets a separate **portal mode** for case lookup over voice.

## Current state (June 14 2026) — Gemini Live rewrite landed

**Branch:** `gemini-live-voice-rewrite`. The voice stack is now Node 22 + TypeScript + Express + WebSocket + Gemini Live + Twilio Media Streams at `voice_agent/`. Modelled 1:1 on `lending-pipeline/voice_agent/`.

Old Python Ollama + faster-whisper + Kokoro + Silero-VAD stack was deleted (`donna/voice/`, `donna/telephony/`, `scripts/run_voice.sh`, `scripts/run_telephony.sh`, `donna/VOICE_PIPELINE.md`). Branch retains the old code in git history.

### Three call modes, one /media-stream handler

| Mode | Trigger | Persona | Tools |
|---|---|---|---|
| `inbound` | Twilio `POST /voice`, `From ≠ ATTORNEY_PHONE` | Calm legal-intake. Lead capture, calm distressed callers, book consult, follow-up email | `record_consent`, `store_lead_profile`, `calm_response`, `discuss_rates`, `book_appointment`, `send_intake_email`, `transfer_to_human`, `end_call_politely` |
| `outbound` | `POST /api/calls/outbound` → Twilio dial → `POST /voice/outbound` | Follow-up call on a scraped or captured lead | Same intake tool set; outbound greeting block in prompt |
| `attorney` | Twilio `POST /voice`, `From == ATTORNEY_PHONE` | Portal — voice-native case DB query | `list_recent_leads`, `lookup_lead`, `list_upcoming_appointments`, `summarize_call`, `end_call_politely` |

### Voice/Twilio defaults (carry-over from lending-pipeline)

- Gemini Live model: `gemini-3.1-flash-live-preview`, voice `Aoede`, temperature 0.3.
- Built-in VAD: low sensitivity, 20ms prefix padding, 300ms silence threshold.
- Audio: mulaw 8k ↔ PCM 16k/24k via `alawmulaw@6.0.0`.
- Barge-in: Gemini `interrupted` → Twilio `clear` event flushes playback buffer.
- Tool responses scheduled `WHEN_IDLE` — agent keeps talking through tools; pair with mandatory filler phrase in system prompt.
- Stream-token gate on `/media-stream`: 32-byte hex, 30s TTL, single-use.

### State

`better-sqlite3` against `DONNA_DB_PATH` (default `voice_agent/voice_agent.sqlite`). Tables prefixed `voice_*` to avoid collision with the Python `donna/` schema:

- `voice_call_sessions` — call lifecycle + captured fields + consents
- `voice_leads` — unique-by-phone lead pipeline
- `voice_call_events` — SHA-256 hash-chained event log
- `voice_appointments` — booked consults

Schema applied idempotently at boot from `voice_agent/db-migrations.sql`.

### Dashboard

React app at `donna/dashboard/`. Voice service mounts a second `WebSocketServer` on `ws://localhost:3001/dashboard`. App's `WS_URL` already updated. Event types: `call_started`, `transcript`, `consent_recorded`, `lead_stored`, `calm_moment`, `rates_discussed`, `appointment_booked`, `intake_email_queued`, `transfer_requested`, `action_done`, `call_ended`, plus `spelling_flags`.

### Bridges to Python services (unchanged)

- **Email approval**: TS writes JSON drafts to `${DONNA_DRAFTS_DIR}/${call_sid}/${uuid}.json`. Existing Python `donna/email_server/approval_server.py` polls the dir. Zero Python changes.
- **Calendar**: TS inserts directly into `voice_appointments` table. Python tools can read.

## Tech stack (current)

| Layer | Tech |
|-------|------|
| HTTP server | Express 4 on port 3001 |
| Voice provider | Gemini Live via `@google/genai@^2.3.0` |
| Telephony | Twilio Media Streams (`twilio@^5.5.1`, `ws@^8.20.1`) |
| Audio codec | `alawmulaw@^6.0.0` (mulaw ↔ PCM) |
| State | `better-sqlite3@^11.5.0` |
| Dashboard | React 18 + Vite, WS to `/dashboard` |
| Email approval | Python FastAPI `donna/email_server/approval_server.py` (unchanged) |

## Run commands

```bash
# Terminal 1 — ngrok tunnel for Twilio
ngrok http 3001

# Terminal 2 — voice agent (paste the ngrok URL into voice_agent/.env as PUBLIC_URL)
cd voice_agent
npm install
cp .env.example .env  # fill TWILIO_*, GEMINI_API_KEY, ATTORNEY_PHONE, FIRM_NAME
npm run dev

# Terminal 3 — dashboard
cd donna/dashboard && npm install && npm run dev

# Terminal 4 (optional) — Python email approval server
python -m donna.email_server.approval_server
```

Tests + typecheck:

```bash
cd voice_agent
npm run check   # tsc --noEmit
npm test        # 51 unit tests (twiml, audio codec, validation, eventChain, rateCard, streamToken)

# Python supporting tools
cd donna && python3 -m pytest -q --ignore=email_server/tests/test_server.py  # 96 passed
```

## Outbound trigger

```bash
curl -X POST http://localhost:3001/api/calls/outbound \
  -H 'content-type: application/json' \
  -d '{"phone":"+15551234567","leadId":"lead_optional"}'
```

## Attorney portal trigger

Set `ATTORNEY_PHONE=+19259676242` in `.env`. When that number calls the firm's Twilio number, the system routes to attorney mode automatically — different system prompt, different tool set, read-only access to the case DB.

## Compliance (intake mode — enforced in system prompt)

- AI identity disclosure + recording disclosure before any data collection.
- NEVER give legal advice — always defer to attorney consult.
- NEVER promise outcomes / settlement amounts / case acceptance.
- NEVER ask for SSN.
- NEVER ask for documents over voice — direct to follow-up email.
- Explicit "intake, not attorney-client privileged" framing.

## Tuning notes (do not change without rationale)

- Temperature 0.3 — higher risks hallucinated fees.
- VAD LOW sensitivity — telephony noise floor.
- 300ms silence threshold — natural cadence.
- Stream token 30s TTL — replay prevention.

## Team split

- Dhruva: voice pipeline integration, demo wiring
- Shivansh: DevOps — services on Dell GBIO (ngrok, env, prod)
- Aayush: agent personas + system prompts + tool design
- Anish: voice pipeline co-owner

## Remaining work for demo

1. **ngrok on Dell** — `ngrok http 3001`, set `PUBLIC_URL` in `voice_agent/.env`, point Twilio webhook to `/voice`.
2. Sanity-test full inbound call end-to-end with real Twilio.
3. Sanity-test outbound dial via `POST /api/calls/outbound`.
4. Sanity-test attorney portal mode (call from `ATTORNEY_PHONE`).
5. Verify dashboard receives all event types live.
6. Demo rehearsal — 90s flow (inbound + portal).
7. Latency check — first agent audio byte within ~1.5s of user speech end.

### Dell env (already set)

```
GOOGLE_API_KEY=AIzaSyAwVX9clZIv9YY4fzj0SI68TS0w5KbicyA  # ~/dell-hack/.env
DONNA_USE_GEMINI=1
DONNA_MODEL=nemotron-3-nano
```

Set these also in `voice_agent/.env`:
```
GEMINI_API_KEY=AIzaSyAwVX9clZIv9YY4fzj0SI68TS0w5KbicyA
```

## Python supporting tools (donna/)

Still active alongside TS voice_agent — handles email approval, OCR, cost estimation, calendar:

| Tool | File | Status |
|------|------|--------|
| Email approval server | `donna/email_server/approval_server.py` | ✓ Running |
| OCR document scan | `donna/tools/ocr.py` | ✓ Implemented (pytesseract) |
| Fee estimator | `donna/tools/cost_estimator.py` | ✓ Implemented (rule-based) |
| Calendar | `donna/glue/tools/calendar.py` | ✓ Existing |
| Python Gemini Live fallback | `donna/telephony/gemini_provider.py` | ✓ Implemented (set `DONNA_USE_GEMINI=1`) |

## Run on Dell GB10 (production target)

Service-of-record location: `~/dell-hack/voice_agent/`. Run `npm run dev` after pulling. Ngrok tunnel needed for Twilio webhook reachability unless deployed behind a stable public hostname.
