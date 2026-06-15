import { twilioToGemini, geminiToTwilio } from "../../src/utils/audio";

describe("audio codec", () => {
  it("twilioToGemini accepts base64 mulaw and returns base64 PCM16", () => {
    const fakeMulaw = Buffer.alloc(160, 0x7f).toString("base64"); // 20ms of silence-ish
    const out = twilioToGemini(fakeMulaw);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
    expect(Buffer.from(out, "base64").length).toBe(640); // 8k samples * upsample 2 * 2 bytes
  });

  it("geminiToTwilio downsamples PCM24k to mulaw 8k", () => {
    const pcm24kSamples = new Int16Array(2400); // 100ms @ 24kHz
    const b64 = Buffer.from(pcm24kSamples.buffer).toString("base64");
    const out = geminiToTwilio(b64);
    expect(typeof out).toBe("string");
    const mulawBytes = Buffer.from(out, "base64");
    expect(mulawBytes.length).toBe(800); // 100ms @ 8kHz = 800 bytes mulaw
  });
});
