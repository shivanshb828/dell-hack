import { db } from "../db/client";
import { broadcastEvent } from "../db/realtime";

export interface ActionResult {
  output: object;
}

export async function executeAttorneyAction(
  name: string,
  params: Record<string, unknown>,
  ctx: { callSid: string }
): Promise<ActionResult> {
  let output: object = { ok: true };
  try {
    switch (name) {
      case "list_recent_leads": {
        const days = (params.days as number) ?? 7;
        const limit = Math.min((params.limit as number) ?? 10, 50);
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const rows = db
          .prepare(
            `SELECT id, name, phone, email, incident_type, incident_summary, status, created_at
               FROM voice_leads
              WHERE created_at >= ?
              ORDER BY created_at DESC
              LIMIT ?`
          )
          .all(cutoff, limit);
        output = { ok: true, count: rows.length, leads: rows };
        break;
      }

      case "lookup_lead": {
        const q = ((params.query as string) ?? "").trim();
        if (!q) {
          output = { ok: false, reason: "empty_query" };
          break;
        }
        const pattern = `%${q}%`;
        const rows = db
          .prepare(
            `SELECT id, name, phone, email, incident_type, incident_summary, status, created_at
               FROM voice_leads
              WHERE name LIKE ? OR phone LIKE ?
              ORDER BY created_at DESC
              LIMIT 5`
          )
          .all(pattern, pattern);
        output = { ok: true, count: rows.length, leads: rows };
        break;
      }

      case "list_upcoming_appointments": {
        const daysAhead = (params.days_ahead as number) ?? 7;
        const nowIso = new Date().toISOString();
        const future = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
        const rows = db
          .prepare(
            `SELECT id, lead_id, call_sid, datetime_iso, duration_minutes, attorney, notes
               FROM voice_appointments
              WHERE datetime_iso >= ? AND datetime_iso <= ?
              ORDER BY datetime_iso ASC
              LIMIT 20`
          )
          .all(nowIso, future);
        output = { ok: true, count: rows.length, appointments: rows };
        break;
      }

      case "summarize_call": {
        const callSid = params.call_sid as string;
        if (!callSid) {
          output = { ok: false, reason: "missing_call_sid" };
          break;
        }
        const session = db
          .prepare(
            `SELECT call_sid, client_name, client_phone, client_email, incident_type, incident_date, incident_location, injury_summary, duration_seconds, status
               FROM voice_call_sessions
              WHERE call_sid = ?`
          )
          .get(callSid);
        const transcriptRows = db
          .prepare(
            `SELECT payload, created_at
               FROM voice_call_events
              WHERE call_sid = ? AND type = 'transcript'
              ORDER BY seq ASC`
          )
          .all(callSid) as Array<{ payload: string; created_at: string }>;
        const turns: Array<{ role: string; text: string; ts: string }> = [];
        for (const r of transcriptRows) {
          try {
            const p = JSON.parse(r.payload);
            if (p.role && p.text) turns.push({ role: p.role, text: p.text, ts: r.created_at });
          } catch {
            // ignore
          }
        }
        output = { ok: true, session, transcript: turns };
        break;
      }

      case "end_call_politely": {
        void broadcastEvent({ type: "call_end_requested", callSid: ctx.callSid });
        output = { ok: true, ending: true };
        break;
      }

      default:
        output = { ok: false, error: `unknown_attorney_tool:${name}` };
    }
  } catch (err) {
    output = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return { output };
}
