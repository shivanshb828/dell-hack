import twilio from "twilio";
import { config } from "../../config";

export interface OutboundCallInput {
  to: string; // E.164
  leadId?: string | null;
}

export async function placeOutboundCall(input: OutboundCallInput): Promise<{ callSid: string; status: string }> {
  if (!config.PUBLIC_URL) {
    throw new Error("PUBLIC_URL not set — cannot place outbound calls");
  }
  const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
  const url = `${config.PUBLIC_URL}/voice/outbound?leadId=${encodeURIComponent(input.leadId ?? "")}`;
  const call = await client.calls.create({
    from: config.TWILIO_PHONE_NUMBER,
    to: input.to,
    url,
    method: "POST",
  });
  return { callSid: call.sid, status: call.status ?? "unknown" };
}

export async function transferCallToHuman(callSid: string): Promise<void> {
  if (!config.TWILIO_TRANSFER_NUMBER) {
    console.warn(`[twilio] transfer requested but TWILIO_TRANSFER_NUMBER not set; ignoring`);
    return;
  }
  const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${config.TWILIO_TRANSFER_NUMBER}</Dial></Response>`;
  await client.calls(callSid).update({ twiml });
}
