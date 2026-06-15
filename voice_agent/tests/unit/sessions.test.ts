// Sessions DB tests against in-memory SQLite (jest.setup.js sets DONNA_DB_PATH=:memory:)
import { db, runMigrations } from "../../src/services/db/client";
import {
  createCallSession,
  updateLeadProfile,
  recordConsent,
  completeCallSession,
  getSessionDetails,
  lookupPriorSessionByPhone,
  saveAdditionalContext,
  upsertLead,
  insertCallEvent,
} from "../../src/services/db/sessions";

beforeAll(() => {
  runMigrations();
});

describe("sessions", () => {
  it("creates a call session idempotently", async () => {
    await createCallSession("CA_test_1", "+15551110000", "inbound", null);
    await createCallSession("CA_test_1", "+15551110000", "inbound", null); // duplicate ignored
    const details = await getSessionDetails("CA_test_1");
    expect(details.callerPhone).toBe("+15551110000");
    expect(details.mode).toBe("inbound");
  });

  it("updates lead profile partial fields", async () => {
    await createCallSession("CA_test_2", "+15551110001", "inbound", null);
    await updateLeadProfile("CA_test_2", { name: "Maria Lopez", email: "maria@example.com" });
    const details = await getSessionDetails("CA_test_2");
    expect(details.clientName).toBe("Maria Lopez");
  });

  it("records consents via enum-mapped column", async () => {
    await createCallSession("CA_test_3", "+15551110002", "inbound", null);
    await recordConsent("CA_test_3", "recording");
    await recordConsent("CA_test_3", "ai_disclosure");
    const row = db.prepare(`SELECT consent_recording, consent_ai_disclosure FROM voice_call_sessions WHERE call_sid = ?`).get("CA_test_3") as { consent_recording: number; consent_ai_disclosure: number };
    expect(row.consent_recording).toBe(1);
    expect(row.consent_ai_disclosure).toBe(1);
  });

  it("rejects invalid consent type", async () => {
    await createCallSession("CA_test_3b", "+15551110002", "inbound", null);
    await expect(recordConsent("CA_test_3b", "invalid" as never)).rejects.toThrow(/invalid consent type/);
  });

  it("completes a session with duration", async () => {
    await createCallSession("CA_test_4", "+15551110003", "inbound", null);
    await completeCallSession("CA_test_4", 42);
    const row = db.prepare(`SELECT status, duration_seconds FROM voice_call_sessions WHERE call_sid = ?`).get("CA_test_4") as { status: string; duration_seconds: number };
    expect(row.status).toBe("completed");
    expect(row.duration_seconds).toBe(42);
  });

  it("saves additional_context as JSON", async () => {
    await createCallSession("CA_test_5", "+15551110004", "inbound", null);
    await saveAdditionalContext("CA_test_5", { urgency: "high", treatment_started: true });
    const row = db.prepare(`SELECT additional_context FROM voice_call_sessions WHERE call_sid = ?`).get("CA_test_5") as { additional_context: string };
    expect(JSON.parse(row.additional_context).urgency).toBe("high");
  });

  it("looks up prior session by phone (only completed within 90d)", async () => {
    await createCallSession("CA_test_6", "+15551110005", "inbound", null);
    await updateLeadProfile("CA_test_6", { name: "James Wright", incident_type: "auto_accident", injury_summary: "minor whiplash" });
    await completeCallSession("CA_test_6", 60);
    const prior = await lookupPriorSessionByPhone("+15551110005");
    expect(prior?.name).toBe("James Wright");
    expect(prior?.incidentType).toBe("auto_accident");
  });

  it("returns null for unseen phone", async () => {
    const prior = await lookupPriorSessionByPhone("+15559999999");
    expect(prior).toBeNull();
  });

  it("upserts leads — inserts then updates by phone", async () => {
    const id1 = await upsertLead({ phone: "+15551110006", name: "Karen Singh", email: "karen@example.com", incident_type: "slip_fall" });
    expect(id1).toMatch(/^lead_/);
    const id2 = await upsertLead({ phone: "+15551110006", name: "Karen Singh", incident_type: "slip_fall" });
    expect(id2).toBe(id1);
    const count = db.prepare(`SELECT COUNT(*) as c FROM voice_leads WHERE phone = ?`).get("+15551110006") as { c: number };
    expect(count.c).toBe(1);
  });

  it("inserts hash-chained call events", async () => {
    await createCallSession("CA_test_7", "+15551110007", "inbound", null);
    await insertCallEvent("CA_test_7", "call_started", { foo: "bar" });
    await insertCallEvent("CA_test_7", "transcript", { role: "agent", text: "hi" });
    const rows = db.prepare(`SELECT seq, prev_hash, hash FROM voice_call_events WHERE call_sid = ? ORDER BY seq`).all("CA_test_7") as Array<{ seq: number; prev_hash: string | null; hash: string }>;
    expect(rows).toHaveLength(2);
    expect(rows[0].seq).toBe(1);
    expect(rows[0].prev_hash).toBeNull();
    expect(rows[1].seq).toBe(2);
    expect(rows[1].prev_hash).toBe(rows[0].hash);
    expect(rows[1].hash).not.toBe(rows[0].hash);
  });
});
