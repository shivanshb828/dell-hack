import io
import os
import subprocess
import wave

import httpx

KOKORO_URL = os.getenv("DONNA_KOKORO_URL", "http://localhost:8880/v1/audio/speech")
KOKORO_VOICE = os.getenv("DONNA_KOKORO_VOICE", "af_heart")
PIPER_MODEL = os.getenv("DONNA_PIPER_MODEL", "en_US-amy-medium")


def _synthesize_kokoro(text: str) -> bytes:
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(
            KOKORO_URL,
            json={"model": "kokoro", "input": text, "voice": KOKORO_VOICE, "response_format": "wav"},
        )
    resp.raise_for_status()
    return resp.content


def _synthesize_piper(text: str) -> bytes:
    result = subprocess.run(
        ["piper", "--model", PIPER_MODEL, "--output-raw"],
        input=text.encode(),
        capture_output=True,
        timeout=15,
    )
    if result.returncode != 0:
        raise RuntimeError(f"piper failed: {result.stderr.decode()}")
    # piper --output-raw gives raw PCM16 at 22050Hz — wrap in WAV
    pcm = result.stdout
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(22050)
        wf.writeframes(pcm)
    return buf.getvalue()


def synthesize(text: str) -> bytes:
    for fn, name in [(_synthesize_kokoro, "Kokoro"), (_synthesize_piper, "Piper")]:
        try:
            audio = fn(text)
            print(f"[TTS] {name}")
            return audio
        except Exception as e:
            print(f"[TTS] {name} failed: {e}")
    raise RuntimeError("All TTS backends failed")


def play_audio(audio_bytes: bytes):
    import pyaudio
    buf = io.BytesIO(audio_bytes)
    with wave.open(buf, "rb") as wf:
        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=pa.get_format_from_width(wf.getsampwidth()),
            channels=wf.getnchannels(),
            rate=wf.getframerate(),
            output=True,
        )
        try:
            chunk = 1024
            data = wf.readframes(chunk)
            while data:
                stream.write(data)
                data = wf.readframes(chunk)
        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()


if __name__ == "__main__":
    print("TTS test: synthesizing...")
    audio = synthesize("Hello, I'm Donna. How can I help you today?")
    print(f"Got {len(audio)} bytes. Playing...")
    play_audio(audio)
    print("Done.")
