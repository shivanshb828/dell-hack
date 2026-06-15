import { runMigrations, db } from "../../src/services/db/client";
import { executeAction } from "../../src/services/intake/actions";
import { createCallSession } from "../../src/services/db/sessions";

beforeAll(() => {
  runMigrations();
});

describe("intake executeAction", () => {
  const ctx = { callSid: "CA_intake_1" };

  beforeAll(async () => {
    await createCallSession(ctx.callSid, "+15551112000", "inbound", null);
  });

  it("record_consent rejects unknown type", async () => {
    const r = await executeAction("record_consent", { consent_type: "wat" }, ctx);
    expect((r.output as { ok: boolean }).ok).toBe(false);
  });

  it("record_consent accepts valid type", async () => {
    const r = await executeAction("record_consent", { consent_type: "recording" }, ctx);
    expect((r.output as { ok: boolean }).ok).toBe(true);
  });

  it("store_lead_profile blocks without confirmed=true", async () => {
    const r = await executeAction("store_lead_profile", {
      name: "Jane Doe",
      phone: "+15551112001",
      email: "jane@example.com",
      incident_type: "auto_accident",
      confirmed: false,
    }, ctx);
    expect((r.output as { needs_confirmation?: boolean }).needs_confirmation).toBe(true);
  });

  it("store_lead_profile stores when confirmed + valid", async () => {
    const r = await executeAction("store_lead_profile", {
      name: "Jane Doe",
      phone: "555-111-2001",
      email: "jane@example.com",
      incident_type: "auto_accident",
      incident_date: "2026-06-01",
      incident_location: "Oakland, CA",
      injury_summary: "Rear-ended",
      confirmed: true,
    }, ctx);
    const out = r.output as { ok: boolean; stored: boolean; lead_id: string };
    expect(out.ok).toBe(true);
    expect(out.stored).toBe(true);
    expect(out.lead_id).toMatch(/^lead_/);
  });

  it("store_lead_profile rejects invalid email", async () => {
    const r = await executeAction("store_lead_profile", {
      name: "Jane Doe",
      phone: "+15551112001",
      email: "not-an-email",
      incident_type: "auto_accident",
      confirmed: true,
    }, ctx);
    expect((r.output as { ok: boolean }).ok).toBe(false);
  });

  it("discuss_rates returns rate card for incident", async () => {
    const r = await executeAction("discuss_rates", { incident_type: "auto_accident" }, ctx);
    const out = r.output as { contingency_pct: number; consult_fee_usd: number };
    expect(out.contingency_pct).toBe(33);
    expect(out.consult_fee_usd).toBe(0);
  });

  it("book_appointment rejects invalid datetime", async () => {
    const r = await executeAction("book_appointment", { datetime_iso: "not-a-date" }, ctx);
    expect((r.output as { ok: boolean }).ok).toBe(false);
  });

  it("book_appointment writes row on valid input", async () => {
    const r = await executeAction("book_appointment", {
      datetime_iso: "2026-07-01T15:00:00Z",
      duration_minutes: 30,
      attorney: "boss@example.com",
      notes: "first consult",
    }, ctx);
    const out = r.output as { ok: boolean; appointment_id: string };
    expect(out.ok).toBe(true);
    expect(out.appointment_id).toMatch(/^appt_/);
    const row = db.prepare(`SELECT datetime_iso, attorney FROM voice_appointments WHERE id = ?`).get(out.appointment_id) as { datetime_iso: string; attorney: string };
    expect(row.datetime_iso).toBe("2026-07-01T15:00:00Z");
    expect(row.attorney).toBe("boss@example.com");
  });

  it("send_intake_email rejects missing email", async () => {
    const r = await executeAction("send_intake_email", { client_name: "X" }, ctx);
    expect((r.output as { ok: boolean }).ok).toBe(false);
  });

  it("calm_response always ok", async () => {
    const r = await executeAction("calm_response", { note: "calmed" }, ctx);
    expect((r.output as { acknowledged: boolean }).acknowledged).toBe(true);
  });

  it("end_call_politely returns ending flag", async () => {
    const r = await executeAction("end_call_politely", {}, ctx);
    expect((r.output as { ending: boolean }).ending).toBe(true);
  });

  it("unknown tool name returns error", async () => {
    const r = await executeAction("totally_not_a_tool", {}, ctx);
    expect((r.output as { ok: boolean; error: string }).ok).toBe(false);
  });
});
