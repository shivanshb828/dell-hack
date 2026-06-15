const INCIDENT_TYPES = ["auto_accident", "slip_fall", "workplace", "medical_malpractice", "other"] as const;
type IncidentType = (typeof INCIDENT_TYPES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: unknown): s is string {
  return typeof s === "string" && EMAIL_RE.test(s);
}

export function isValidIncidentType(s: unknown): s is IncidentType {
  return typeof s === "string" && (INCIDENT_TYPES as readonly string[]).includes(s);
}

export function normalizePhoneE164(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function validateLeadParams(params: Record<string, unknown>): { ok: true } | { ok: false; reason: string } {
  if (typeof params.name !== "string" || params.name.trim().length < 2) return { ok: false, reason: "name_too_short" };
  if (!normalizePhoneE164(params.phone)) return { ok: false, reason: "invalid_phone" };
  if (!isValidEmail(params.email)) return { ok: false, reason: "invalid_email" };
  if (!isValidIncidentType(params.incident_type)) return { ok: false, reason: "invalid_incident_type" };
  return { ok: true };
}
