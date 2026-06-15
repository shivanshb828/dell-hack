import { Router, Request, Response, NextFunction } from "express";
import { placeOutboundCall } from "../services/twilio/outbound";
import { createCallSession } from "../services/db/sessions";
import { normalizePhoneE164 } from "../services/intake/validation";
import { config } from "../config";

export const outboundCallsRouter = Router();

// Internal API guard. In prod set DONNA_API_KEY and require header. In dev (no key) allow through.
function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.DONNA_API_KEY) {
    next();
    return;
  }
  const provided = req.headers["x-api-key"];
  if (provided !== config.DONNA_API_KEY) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
}

outboundCallsRouter.post("/outbound", requireApiKey, async (req: Request, res: Response): Promise<void> => {
  const { phone, leadId } = req.body as { phone?: string; leadId?: string };
  const e164 = normalizePhoneE164(phone);
  if (!e164) {
    res.status(400).json({ error: "invalid_phone" });
    return;
  }
  try {
    const call = await placeOutboundCall({ to: e164, leadId: leadId ?? null });
    await createCallSession(call.callSid, e164, "outbound", leadId ?? null).catch((err) =>
      console.warn("[outbound] createCallSession warn:", err)
    );
    res.json({ callSid: call.callSid, status: call.status });
  } catch (err) {
    console.error("[outbound] failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
