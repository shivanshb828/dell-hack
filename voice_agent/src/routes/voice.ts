import { Router, Request, Response } from "express";
import crypto from "crypto";
import { twilioValidate } from "../middleware/twilioValidate";
import { buildStreamTwiml, buildHangupTwiml } from "../utils/twiml";
import { normalizePhone } from "../utils/phone";
import { createCallSession, lookupPriorSessionByPhone } from "../services/db/sessions";
import { broadcastEvent } from "../services/db/realtime";
import { config } from "../config";

export const voiceRouter = Router();

export type CallMode = "inbound" | "outbound" | "attorney";

interface TokenEntry {
  callSid: string;
  expiresAt: number;
  mode: CallMode;
  leadId: string | null;
}

const streamTokens = new Map<string, TokenEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of streamTokens) {
    if (now > entry.expiresAt) streamTokens.delete(token);
  }
}, 5 * 60 * 1000).unref();

export function issueStreamToken(
  callSid: string,
  mode: CallMode = "inbound",
  leadId: string | null = null
): string {
  const token = crypto.randomBytes(32).toString("hex");
  streamTokens.set(token, { callSid, expiresAt: Date.now() + 30_000, mode, leadId });
  return token;
}

export function consumeStreamToken(
  callSid: string,
  token?: string
): { mode: CallMode; leadId: string | null } | null {
  if (!token) return null;
  const entry = streamTokens.get(token);
  if (!entry || entry.callSid !== callSid || Date.now() > entry.expiresAt) return null;
  streamTokens.delete(token);
  return { mode: entry.mode, leadId: entry.leadId };
}

function normalizeForCompare(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

function isAttorneyCaller(from: string): boolean {
  if (!config.ATTORNEY_PHONE) return false;
  return normalizeForCompare(from) === normalizeForCompare(config.ATTORNEY_PHONE);
}

voiceRouter.post("/", twilioValidate, async (req: Request, res: Response): Promise<void> => {
  const { CallSid, From } = req.body as { CallSid: string; From: string };
  const callerPhone = normalizePhone(From);
  const mode: CallMode = isAttorneyCaller(From) ? "attorney" : "inbound";

  try {
    await createCallSession(CallSid, callerPhone, mode, null);

    let isReturning = false;
    let priorName: string | null = null;
    if (mode !== "attorney" && callerPhone) {
      const prior = await lookupPriorSessionByPhone(callerPhone).catch(() => null);
      if (prior) {
        isReturning = true;
        priorName = prior.name;
      }
    }

    void broadcastEvent({
      type: "call_started",
      callSid: CallSid,
      callerPhone,
      agentMode: mode === "attorney" ? "attorney" : "inbound_intake",
      isReturning,
      priorName,
      timestamp: new Date().toISOString(),
    } as Parameters<typeof broadcastEvent>[0]);

    const streamToken = issueStreamToken(CallSid, mode, null);
    res.type("text/xml").send(buildStreamTwiml({ callSid: CallSid, streamToken, mode }));
  } catch (err) {
    console.error("[voice] session creation failed:", err);
    res.type("text/xml").send(buildHangupTwiml("Sorry, we're experiencing issues. Please call back."));
  }
});
