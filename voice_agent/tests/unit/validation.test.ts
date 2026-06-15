import { validateLeadParams, normalizePhoneE164, isValidEmail, isValidIncidentType } from "../../src/services/intake/validation";

describe("validation helpers", () => {
  it("normalizePhoneE164 accepts US 10-digit", () => {
    expect(normalizePhoneE164("555-234-1000")).toBe("+15552341000");
  });

  it("normalizePhoneE164 keeps E.164 prefix", () => {
    expect(normalizePhoneE164("+14155551234")).toBe("+14155551234");
  });

  it("normalizePhoneE164 rejects empty", () => {
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164(undefined)).toBeNull();
  });

  it("isValidEmail rejects bad emails", () => {
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b.c")).toBe(true);
  });

  it("isValidIncidentType enforces enum", () => {
    expect(isValidIncidentType("auto_accident")).toBe(true);
    expect(isValidIncidentType("foo")).toBe(false);
  });

  it("validateLeadParams rejects missing/invalid", () => {
    const r1 = validateLeadParams({});
    expect(r1.ok).toBe(false);
    const r2 = validateLeadParams({
      name: "Jane Doe",
      phone: "+15551234567",
      email: "jane@example.com",
      incident_type: "auto_accident",
    });
    expect(r2.ok).toBe(true);
  });
});
