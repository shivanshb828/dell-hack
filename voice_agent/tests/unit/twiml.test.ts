import { buildStreamTwiml, buildOutboundStreamTwiml, buildHangupTwiml } from "../../src/utils/twiml";

describe("twiml builders", () => {
  it("builds inbound stream TwiML with token + callSid", () => {
    const xml = buildStreamTwiml({ callSid: "CA123", streamToken: "tok456" });
    expect(xml).toContain("<Stream");
    expect(xml).toContain('value="CA123"');
    expect(xml).toContain('value="tok456"');
    expect(xml).toContain('value="inbound"');
  });

  it("builds outbound stream TwiML with leadId param", () => {
    const xml = buildOutboundStreamTwiml({ callSid: "CA999", streamToken: "tk", leadId: "lead_42" });
    expect(xml).toContain('value="outbound"');
    expect(xml).toContain('value="lead_42"');
  });

  it("builds outbound without leadId when null", () => {
    const xml = buildOutboundStreamTwiml({ callSid: "CA999", streamToken: "tk", leadId: null });
    expect(xml).toContain('value="outbound"');
    expect(xml).not.toContain('name="leadId"');
  });

  it("XML-escapes attribute payloads to prevent injection", () => {
    const xml = buildStreamTwiml({ callSid: 'CA"evil', streamToken: "<script>" });
    expect(xml).toContain('CA&quot;evil');
    expect(xml).toContain('&lt;script&gt;');
  });

  it("builds hangup TwiML with optional message", () => {
    const xml = buildHangupTwiml("bye");
    expect(xml).toContain("<Say>bye</Say>");
    expect(xml).toContain("<Hangup/>");
  });
});
