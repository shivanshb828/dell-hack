import numpy as np


class SileroVAD:
    THRESHOLD = 0.5
    SILENCE_FRAMES = 25  # ~800ms at 16kHz/512-sample chunks

    def __init__(self):
        import torch
        self.model, utils = torch.hub.load(
            "snakers4/silero-vad", "silero_vad", force_reload=False
        )
        self.model.eval()
        self._audio_buf = b""
        self._silence_count = 0
        self._speaking = False

    def process(self, chunk: bytes) -> dict:
        import torch
        audio_np = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0
        tensor = torch.from_numpy(audio_np)
        with torch.no_grad():
            conf = self.model(tensor, 16000).item()
        is_speaking = bool(conf >= self.THRESHOLD)
        if is_speaking:
            self._speaking = True
            self._silence_count = 0
        else:
            self._silence_count += 1
        self._audio_buf += chunk
        speech_ended = self._speaking and self._silence_count >= self.SILENCE_FRAMES
        # Capture buffer BEFORE reset so speech_ended doesn't return empty audio
        audio_out = self._audio_buf
        if speech_ended:
            self.reset()
        return {"is_speaking": is_speaking, "speech_ended": speech_ended, "audio": audio_out}

    def reset(self):
        self._audio_buf = b""
        self._silence_count = 0
        self._speaking = False


class EnergyVAD:
    THRESHOLD = 500
    SILENCE_FRAMES = 25

    def __init__(self):
        self._audio_buf = b""
        self._silence_count = 0
        self._speaking = False

    def process(self, chunk: bytes) -> dict:
        audio_np = np.frombuffer(chunk, dtype=np.int16)
        rms = np.sqrt(np.mean(audio_np.astype(np.float32) ** 2))
        is_speaking = bool(rms >= self.THRESHOLD)
        if is_speaking:
            self._speaking = True
            self._silence_count = 0
        else:
            self._silence_count += 1
        self._audio_buf += chunk
        speech_ended = self._speaking and self._silence_count >= self.SILENCE_FRAMES
        # Capture buffer BEFORE reset so speech_ended doesn't return empty audio
        audio_out = self._audio_buf
        if speech_ended:
            self.reset()
        return {"is_speaking": is_speaking, "speech_ended": speech_ended, "audio": audio_out}

    def reset(self):
        self._audio_buf = b""
        self._silence_count = 0
        self._speaking = False


def create_vad():
    try:
        vad = SileroVAD()
        print("[VAD] Silero-VAD loaded")
        return vad
    except Exception as e:
        print(f"[VAD] Silero failed ({e}), using energy VAD")
        return EnergyVAD()
