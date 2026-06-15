import crypto from "crypto";
import { db } from "./client";
import { computeEventHash } from "./eventChain";

export type LeadProfile = {
  name?: string;
  phone?: string;
  email?: string;
  incident_type?: string;
  incident_date?: string;
  incident_location?: string;
  injury_summary?: string;
};

export async function createCallSession(
  callSid: string,
  callerPhone: string,
  mode: "inbound" | "outbound" | "attorney" = "inbound",
  leadId: string | null = null
): Promise<void> {
  db.prepare(`
    INSERT OR IGNORE INTO voice_call_sessions
      (call_sid, caller_phone, mode, lead_id, status, started_at)
    VALUES (?, ?, ?, ?, 'active', ?)
  `).run(callSid, callerPhone, mode, leadId, new Date().toISOString());
}

export async function updateLeadProfile(callSid: string, profile: LeadProfile): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, string> = {
    name: "client_name",
    phone: "client_phone",
    email: "client_email",
    incident_type: "incident_type",
    incident_date: "incident_date",
    incident_location: "incident_location",
    injury_summary: "injury_summary",
  };
  for (const [k, v] of Object.entries(profile)) {
    if (v === undefined || v === null) continue;
    const col = map[k];
    if (!col) continue;
    fields.push(`${col} = ?`);
    values.push(v);
  }
  if (!fields.length) return;
  values.push(callSid);
  db.prepare(`UPDATE voice_call_sessions SET ${fields.join(", ")} WHERE call_sid = ?`).run(...values);
}

const ALLOWED_CONSENT_COLUMNS = {
  recording: "consent_recording",
  ai_disclosure: "consent_ai_disclosure",
  intake: "consent_intake",
} as const;

export async function recordConsent(
  callSid: string,
  consentType: "recording" | "ai_disclosure" | "intake"
): Promise<void> {
  const col = ALLOWED_CONSENT_COLUMNS[consentType];
  if (!col) throw new Error(`invalid consent type: ${consentType}`);
  db.prepare(`UPDATE voice_call_sessions SET ${col} = 1 WHERE call_sid = ?`).run(callSid);
}

export async function completeCallSession(callSid: string, durationSeconds: number): Promise<void> {
  db.prepare(`
    UPDATE voice_call_sessions
       SET status = 'completed',
           ended_at = ?,
           duration_seconds = ?
     WHERE call_sid = ?
  `).run(new Date().toISOString(), durationSeconds, callSid);
}

export async function saveAdditionalContext(callSid: string, context: Record<string, unknown>): Promise<void> {
  db.prepare(`UPDATE voice_call_sessions SET additional_context = ? WHERE call_sid = ?`).run(
    JSON.stringify(context),
    callSid
  );
}

export async function getSessionDetails(callSid: string): Promise<{
  callerPhone: string | null;
  clientName: string | null;
  clientPhone: string | null;
  mode: string;
}> {
  const row = db.prepare(`
    SELECT caller_phone, client_name, client_phone, mode
      FROM voice_call_sessions
     WHERE call_sid = ?
  `).get(callSid) as { caller_phone?: string; client_name?: string; client_phone?: string; mode?: string } | undefined;
  return {
    callerPhone: row?.caller_phone ?? null,
    clientName: row?.client_name ?? null,
    clientPhone: row?.client_phone ?? null,
    mode: row?.mode ?? "inbound",
  };
}

export async function lookupPriorSessionByPhone(callerPhone: string): Promise<{
  callSid: string;
  name: string | null;
  incidentType: string | null;
  incidentSummary: string | null;
  email: string | null;
  additionalContext: Record<string, unknown> | null;
} | null> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const row = db.prepare(`
    SELECT call_sid, client_name, incident_type, injury_summary, client_email, additional_context
      FROM voice_call_sessions
     WHERE caller_phone = ? AND status = 'completed' AND ended_at >= ?
     ORDER BY ended_at DESC
     LIMIT 1
  `).get(callerPhone, cutoff) as
    | { call_sid: string; client_name: string | null; incident_type: string | null; injury_summary: string | null; client_email: string | null; additional_context: string | null }
    | undefined;
  if (!row) return null;
  let ac: Record<string, unknown> | null = null;
  if (row.additional_context) {
    try { ac = JSON.parse(row.additional_context); } catch { ac = null; }
  }
  return {
    callSid: row.call_sid,
    name: row.client_name,
    incidentType: row.incident_type,
    incidentSummary: row.injury_summary,
    email: row.client_email,
    additionalContext: ac,
  };
}

export async function upsertLead(profile: Required<Pick<LeadProfile, "phone">> & LeadProfile): Promise<string> {
  const existing = db.prepare(`SELECT id FROM voice_leads WHERE phone = ?`).get(profile.phone) as { id: string } | undefined;
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(`
      UPDATE voice_leads
         SET name = COALESCE(?, name),
             email = COALESCE(?, email),
             incident_type = COALESCE(?, incident_type),
             incident_summary = COALESCE(?, incident_summary),
             updated_at = ?
       WHERE id = ?
    `).run(
      profile.name ?? null,
      profile.email ?? null,
      profile.incident_type ?? null,
      profile.injury_summary ?? null,
      now,
      existing.id
    );
    return existing.id;
  }
  const id = `lead_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO voice_leads (id, phone, name, email, incident_type, incident_summary, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)
  `).run(
    id,
    profile.phone,
    profile.name ?? null,
    profile.email ?? null,
    profile.incident_type ?? null,
    profile.injury_summary ?? null,
    now,
    now
  );
  return id;
}

export async function insertCallEvent(callSid: string, type: string, payload: object): Promise<void> {
  const createdAt = new Date().toISOString();
  const last = db.prepare(`SELECT seq, hash FROM voice_call_events WHERE call_sid = ? ORDER BY seq DESC LIMIT 1`).get(callSid) as
    | { seq: number; hash: string }
    | undefined;
  const seq = last ? last.seq + 1 : 1;
  const prevHash = last?.hash ?? null;
  const hash = computeEventHash(prevHash, { type, ...payload }, createdAt);
  db.prepare(`
    INSERT INTO voice_call_events (call_sid, seq, type, payload, created_at, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(callSid, seq, type, JSON.stringify(payload), createdAt, prevHash, hash);
}
