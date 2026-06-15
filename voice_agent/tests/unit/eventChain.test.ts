import { computeEventHash } from "../../src/services/db/eventChain";

describe("eventChain", () => {
  it("computeEventHash is deterministic", () => {
    const ts = "2026-06-14T18:00:00.000Z";
    const a = computeEventHash(null, { type: "call_started", callerPhone: "+15551234567" }, ts);
    const b = computeEventHash(null, { callerPhone: "+15551234567", type: "call_started" }, ts);
    expect(a).toBe(b);
  });

  it("chains via prevHash", () => {
    const ts = "2026-06-14T18:00:00.000Z";
    const h1 = computeEventHash(null, { type: "a" }, ts);
    const h2 = computeEventHash(h1, { type: "b" }, ts);
    expect(h1).not.toBe(h2);
    expect(h2.length).toBe(64);
  });
});
