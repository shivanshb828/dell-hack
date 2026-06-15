import WebSocket from "ws";
import { GeminiProvider } from "../providers/gemini";
import { VoiceSession } from "../providers/base";
import { INTAKE_TOOLS } from "../services/intake/tools";
import { buildSystemPrompt } from "../services/intake/systemPrompt";
import { executeAction } from "../services/intake/actions";
import { ATTORNEY_TOOLS } from "../services/attorney/tools";
import { buildAttorneySystemPrompt } from "../services/attorney/systemPrompt";
import { executeAttorneyAction } from "../services/attorney/actions";
import {
  completeCallSession,
  getSessionDetails,
  lookupPriorSessionByPhone,
} from "../services/db/sessions";
import { broadcastEvent } from "../services/db/realtime";
import { consumeStreamToken } from "./voice";

interface TwilioFrame {
  event: string;
  start?: {
    callSid: string;
    streamSid: string;
    customParameters?: Record<string, string>;
  };
  media?: { payload: string };
  stop?: { callSid: string };
}

const provider = new GeminiProvider();

const intakeToolDeclarations = INTAKE_TOOLS.map((t) => ({
  name: t.name ?? "",
  description: t.description ?? "",
  parameters: (t.parameters ?? {}) as Record<string, unknown>,
}));

const attorneyToolDeclarations = ATTORNEY_TOOLS.map((t) => ({
  name: t.name ?? "",
  description: t.description ?? "",
  parameters: (t.parameters ?? {}) as Record<string, unknown>,
}));

export function handleMediaStream(ws: WebSocket): void {
  let callSid: string | null = null;
  let streamSid: string | null = null;
  let voiceSession: VoiceSession | null = null;
  let completed = false;
  let started = false;
  let callStarted: number = Date.now();
  const bufferedAudio: string[] = [];

  async function finalize() {
    if (completed || !callSid) return;
    completed = true;
    voiceSession?.close();
    const duration = Math.round((Date.now() - callStarted) / 1000);
    try {
      await completeCallSession(callSid, duration);
      void broadcastEvent({ type: "call_ended", callSid, duration });
      console.log(`[${callSid}] call complete — duration ${duration}s`);
    } catch (err) {
      console.error(`[${callSid}] finalize error:`, err);
    }
  }

  async function handleStart(frame: TwilioFrame): Promise<void> {
    if (!frame.start) return;
    if (started) {
      console.warn(`[${callSid}] duplicate start frame ignored`);
      return;
    }
    started = true;
    callSid = frame.start.callSid;
    streamSid = frame.start.streamSid;
    callStarted = Date.now();

    const token = frame.start.customParameters?.streamToken;
    const consumed = consumeStreamToken(callSid, token);
    if (!consumed) {
      console.error(`[${callSid}] invalid stream token — closing`);
      ws.close();
      return;
    }
    const mode = consumed.mode;
    console.log(`[${callSid}] call started (${mode})`);

    const { callerPhone } = await getSessionDetails(callSid).catch(() => ({
      callerPhone: null,
      clientName: null,
      clientPhone: null,
      mode: "inbound",
    }));

    let systemPrompt: string;
    let toolDecls: typeof intakeToolDeclarations;
    let dispatcher: (name: string, args: Record<string, unknown>) => Promise<unknown>;

    if (mode === "attorney") {
      systemPrompt = buildAttorneySystemPrompt();
      toolDecls = attorneyToolDeclarations;
      dispatcher = async (name, args) => {
        const r = await executeAttorneyAction(name, args, { callSid: callSid! });
        return r.output;
      };
    } else {
      const prior = callerPhone
        ? await lookupPriorSessionByPhone(callerPhone).catch(() => null)
        : null;
      systemPrompt = buildSystemPrompt({
        isReturning: !!prior,
        priorName: prior?.name ?? null,
        priorLead: prior
          ? {
              incidentType: prior.incidentType,
              incidentSummary: prior.incidentSummary,
              email: prior.email,
            }
          : null,
        additionalContext: prior?.additionalContext ?? null,
        mode: mode === "outbound" ? "outbound" : "inbound",
      });
      toolDecls = intakeToolDeclarations;
      dispatcher = async (name, args) => {
        const r = await executeAction(name, args, { callSid: callSid! });
        return r.output;
      };
    }

    voiceSession = await provider
      .openSession(callSid, systemPrompt, toolDecls, {
        onAudio: (chunk) => {
          if (ws.readyState === WebSocket.OPEN && streamSid) {
            ws.send(JSON.stringify({ event: "media", streamSid, media: { payload: chunk.payload } }));
          }
        },
        onTranscript: (role, text) => {
          if (!callSid) return;
          const safeText = text.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, "[SSN REDACTED]");
          void broadcastEvent({
            type: "transcript",
            callSid,
            role,
            text: safeText,
            timestamp: new Date().toISOString(),
          });
        },
        onBargeIn: () => {
          if (ws.readyState === WebSocket.OPEN && streamSid) {
            ws.send(JSON.stringify({ event: "clear", streamSid }));
          }
        },
        onToolCall: async (name, args) => dispatcher(name, args as Record<string, unknown>),
        onError: (err) => {
          console.error(`[${callSid}] provider error:`, err.message);
          ws.close();
        },
      })
      .catch((err) => {
        console.error(`[${callSid}] failed to open voice session:`, err);
        ws.close();
        return null;
      });

    for (const payload of bufferedAudio.splice(0)) {
      voiceSession?.sendAudio(payload);
    }
  }

  ws.on("message", async (raw: Buffer) => {
    try {
      let frame: TwilioFrame;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (frame.event === "connected") return;
      if (frame.event === "start") return handleStart(frame);

      if (frame.event === "media" && frame.media) {
        if (voiceSession) voiceSession.sendAudio(frame.media.payload);
        else if (bufferedAudio.length < 50) bufferedAudio.push(frame.media.payload);
        return;
      }

      if (frame.event === "stop") {
        await finalize();
        ws.close();
      }
    } catch (err) {
      console.error(`[${callSid}] message handler error:`, err);
    }
  });

  ws.on("close", () => finalize());
  ws.on("error", (err) => {
    console.error("WS error:", err.message);
    finalize();
  });
}
