import { Router, Request, Response } from "express";
import { twilioValidate } from "../middleware/twilioValidate";
import { buildOutboundStreamTwiml } from "../utils/twiml";
import { normalizePhone } from "../utils/phone";
import { issueStreamToken } from "./voice";
import { createCallSession } from "../services/db/sessions";
import { broadcastEvent } from "../services/db/realtime";

export const voiceOutboundRouter = Router();

voiceOutboundRouter.post("/", twilioValidate, async (req: Request, res: Response): Promise<void> => {
  const { CallSid, To } = req.body as { CallSid: string; To?: string };
  const leadId = (req.query.leadId as string) ?? "";
  const calleePhone = normalizePhone(To ?? "");

  // Idempotent — outboundCalls.ts already inserted the session row; this catches
  // the race where Twilio's /voice/outbound webhook fires before that insert.
  await createCallSession(CallSid, calleePhone, "outbound", leadId || null).catch((err) =>
    console.warn("[voice/outbound] createCallSession skipped:", err)
  );

  void broadcastEvent({
    type: "call_started",
    callSid: CallSid,
    callerPhone: calleePhone,
    isReturning: !!leadId,
    priorName: null,
    timestamp: new Date().toISOString(),
  });

  const streamToken = issueStreamToken(CallSid, "outbound", leadId || null);
  res.type("text/xml").send(
    buildOutboundStreamTwiml({ callSid: CallSid, streamToken, leadId: leadId || null })
  );
});
