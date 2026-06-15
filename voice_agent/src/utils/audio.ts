import * as alawmulaw from "alawmulaw";

type MulawCodec = { encode: (s: Int16Array) => Uint8Array; decode: (s: Uint8Array) => Int16Array };
// CJS interop: in ESM runtime the codec sits at default.mulaw; in CJS (ts-jest) at .mulaw directly
const _pkg = (alawmulaw as unknown as { default?: { mulaw: MulawCodec }; mulaw?: MulawCodec });
const mulaw = (_pkg.default?.mulaw ?? _pkg.mulaw) as MulawCodec;

function upsample(samples: Int16Array, fromRate: number, toRate: number): Int16Array {
  const ratio = toRate / fromRate;
  const output = new Int16Array(Math.floor(samples.length * ratio));
  for (let i = 0; i < output.length; i++) {
    const srcIdx = i / ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, samples.length - 1);
    const frac = srcIdx - lo;
    output[i] = Math.round(samples[lo] * (1 - frac) + samples[hi] * frac);
  }
  return output;
}

function downsample(samples: Int16Array, fromRate: number, toRate: number): Int16Array {
  const ratio = fromRate / toRate;
  const output = new Int16Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < output.length; i++) {
    output[i] = samples[Math.round(i * ratio)];
  }
  return output;
}

export function twilioToGemini(base64Mulaw: string): string {
  const mulawBytes = new Uint8Array(Buffer.from(base64Mulaw, "base64"));
  const pcm8k = mulaw.decode(mulawBytes);
  const pcm16k = upsample(pcm8k, 8000, 16000);
  return Buffer.from(pcm16k.buffer).toString("base64");
}

export function geminiToTwilio(base64Pcm24k: string): string {
  const raw = Buffer.from(base64Pcm24k, "base64");
  const pcm24k = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  const pcm16k = downsample(pcm24k, 24000, 16000);
  const pcm8k = downsample(pcm16k, 16000, 8000);
  const mulawBytes = mulaw.encode(pcm8k);
  return Buffer.from(mulawBytes).toString("base64");
}
