import { insertCallEvent } from "./sessions";
import { wsBroadcaster } from "../dashboard/wsBroadcaster";

export type CallEvent =
  | { type: "call_started"; callSid: string; callerPhone: string; isReturning?: boolean; priorName?: string | null; timestamp?: string }
  | { type: "transcript"; callSid: string; role: "agent" | "user"; text: string; timestamp: string }
  | { type: "consent_recorded"; callSid: string; consents: string[] }
  | { type: "lead_stored"; callSid: string; lead: { name?: string; phone?: string; email?: string; incident_type?: string } }
  | { type: "calm_moment"; callSid: string; note: string }
  | { type: "rates_discussed"; callSid: string; contingency_pct: number; consult_fee: number }
  | { type: "appointment_booked"; callSid: string; datetime_iso: string; attorney: string }
  | { type: "intake_email_queued"; callSid: string; to: string }
  | { type: "transfer_requested"; callSid: string; reason: string }
  | { type: "call_end_requested"; callSid: string }
  | { type: "spelling_flags"; callSid: string; flags: Array<{ field: string; value: string; suggestAsk: string }> }
  | { type: "action_done"; callSid: string; action: string; result: string; success: boolean; durationMs: number }
  | { type: "call_ended"; callSid: string; duration: number };

export async function broadcastEvent(event: CallEvent): Promise<void> {
  const { callSid, type, ...payload } = event;
  await insertCallEvent(callSid, type, payload).catch((err) =>
    console.error(`[realtime] insert error for ${callSid}:`, err)
  );
  wsBroadcaster.broadcast({ type, callSid, ...payload });
}
