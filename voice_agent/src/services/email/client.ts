import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "../../config";

export interface IntakeEmailPayload {
  call_sid: string;
  lead_id?: string;
  client_name: string;
  client_email: string;
  incident_type: string;
  incident_summary?: string;
  incident_date?: string;
  attorney_email?: string;
}

export async function queueIntakeEmail(payload: IntakeEmailPayload): Promise<{
  ok: boolean;
  draft_path: string;
}> {
  const id = crypto.randomUUID();
  const caseId = payload.call_sid;
  const dir = path.join(config.DONNA_DRAFTS_DIR, caseId);
  await fs.mkdir(dir, { recursive: true });
  const draftPath = path.join(dir, `${id}.json`);
  const draft = {
    id,
    kind: "intake_summary",
    to: payload.client_email,
    cc: payload.attorney_email ?? config.ATTORNEY_EMAIL,
    subject: `Following up on your call — ${config.FIRM_NAME}`,
    payload,
    created_at: new Date().toISOString(),
  };
  await fs.writeFile(draftPath, JSON.stringify(draft, null, 2));

  // Best-effort POST to Python email_server if configured. Non-blocking.
  if (config.DONNA_EMAIL_SERVER_URL) {
    void fetch(`${config.DONNA_EMAIL_SERVER_URL}/email/intake`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    }).catch(() => {});
  }

  return { ok: true, draft_path: draftPath };
}
