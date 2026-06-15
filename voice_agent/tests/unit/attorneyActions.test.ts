import { runMigrations, db } from "../../src/services/db/client";
import { executeAttorneyAction } from "../../src/services/attorney/actions";
import { upsertLead, createCallSession, insertCallEvent } from "../../src/services/db/sessions";

beforeAll(() => {
  runMigrations();
});

describe("attorney executeAttorneyAction", () => {
  const ctx = { callSid: "CA_attorney_1" };

  beforeAll(async () => {
    await createCallSession(ctx.callSid, "+19259676242", "inbound", null);
    await upsertLead({ phone: "+15551113000", name: "Search Mary", email: "m@x.com", incident_type: "auto_accident" });
    await upsertLead({ phone: "+15551113001", name: "Another Mary", email: "m2@x.com", incident_type: "slip_fall" });
    db.prepare(`INSERT INTO voice_appointments (id,lead_id,call_sid,datetime_iso,duration_minutes,attorney,notes,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run("appt_a1", "lead_t1", ctx.callSid, new Date(Date.now() + 3600_000).toISOString(), 30, "boss@example.com", "test", new Date().toISOString());
    await insertCallEvent(ctx.callSid, "transcript", { role: "user", text: "hi I need help" });
    await insertCallEvent(ctx.callSid, "transcript", { role: "agent", text: "happy to help" });
  });

  it("list_recent_leads returns leads", async () => {
    const r = await executeAttorneyAction("list_recent_leads", { days: 1, limit: 10 }, ctx);
    const out = r.output as { count: number; leads: unknown[] };
    expect(out.count).toBeGreaterThanOrEqual(2);
  });

  it("lookup_lead by name", async () => {
    const r = await executeAttorneyAction("lookup_lead", { query: "Mary" }, ctx);
    const out = r.output as { count: number };
    expect(out.count).toBeGreaterThanOrEqual(2);
  });

  it("lookup_lead empty query rejects", async () => {
    const r = await executeAttorneyAction("lookup_lead", { query: "" }, ctx);
    expect((r.output as { ok: boolean }).ok).toBe(false);
  });

  it("list_upcoming_appointments returns future only", async () => {
    const r = await executeAttorneyAction("list_upcoming_appointments", { days_ahead: 7 }, ctx);
    const out = r.output as { count: number };
    expect(out.count).toBeGreaterThanOrEqual(1);
  });

  it("summarize_call returns session + transcript", async () => {
    const r = await executeAttorneyAction("summarize_call", { call_sid: ctx.callSid }, ctx);
    const out = r.output as { ok: boolean; transcript: Array<{ role: string; text: string }> };
    expect(out.ok).toBe(true);
    expect(out.transcript.length).toBeGreaterThanOrEqual(2);
    expect(out.transcript[0].role).toBe("user");
  });

  it("summarize_call without sid rejects", async () => {
    const r = await executeAttorneyAction("summarize_call", {}, ctx);
    expect((r.output as { ok: boolean }).ok).toBe(false);
  });

  it("unknown tool returns error", async () => {
    const r = await executeAttorneyAction("nope", {}, ctx);
    expect((r.output as { ok: boolean }).ok).toBe(false);
  });
});
