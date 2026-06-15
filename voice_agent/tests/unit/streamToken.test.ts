import { issueStreamToken, consumeStreamToken } from "../../src/routes/voice";

describe("stream tokens", () => {
  it("issue + consume roundtrip", () => {
    const tok = issueStreamToken("CA_tok_1", "inbound", null);
    expect(typeof tok).toBe("string");
    const r = consumeStreamToken("CA_tok_1", tok);
    expect(r).not.toBeNull();
    expect(r?.mode).toBe("inbound");
  });

  it("single-use — second consume fails", () => {
    const tok = issueStreamToken("CA_tok_2", "outbound", "lead_x");
    expect(consumeStreamToken("CA_tok_2", tok)).not.toBeNull();
    expect(consumeStreamToken("CA_tok_2", tok)).toBeNull();
  });

  it("wrong callSid rejected", () => {
    const tok = issueStreamToken("CA_tok_3", "inbound", null);
    expect(consumeStreamToken("CA_wrong", tok)).toBeNull();
  });

  it("missing token rejected", () => {
    expect(consumeStreamToken("CA_tok_4", undefined)).toBeNull();
    expect(consumeStreamToken("CA_tok_4", "")).toBeNull();
  });

  it("attorney mode round-trips", () => {
    const tok = issueStreamToken("CA_tok_5", "attorney", null);
    const r = consumeStreamToken("CA_tok_5", tok);
    expect(r?.mode).toBe("attorney");
  });
});
