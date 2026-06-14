"""
Wake word detection for Donna.
Currently: keyboard mode (Enter key) — audio wake word deferred.
To enable audio wake word:
  pip install openwakeword
  export DONNA_WAKEWORD_MODEL=/path/to/hey_donna.onnx   # or leave unset for hey_jarvis
"""

import os
import threading


class KeyboardWakeWord:
    """Push-to-talk: waits for Enter key press."""

    def __init__(self):
        self._triggered = threading.Event()
        self._running = True
        t = threading.Thread(target=self._listen, daemon=True)
        t.start()

    def _listen(self):
        while self._running:
            try:
                input()
                self._triggered.set()
            except (EOFError, OSError):
                break

    def wait_for_activation(self):
        self._triggered.wait()
        self._triggered.clear()

    def stop(self):
        self._running = False


class OpenWakeWord:
    """Audio wake word using openwakeword. Falls back to hey_jarvis if no custom model."""

    THRESHOLD = float(os.getenv("DONNA_WAKEWORD_THRESHOLD", "0.5"))

    def __init__(self):
        from openwakeword.model import Model
        model_path = os.getenv("DONNA_WAKEWORD_MODEL")
        if model_path:
            self.model = Model(wakeword_models=[model_path])
            print(f"[WakeWord] Custom model: {model_path}")
        else:
            self.model = Model(wakeword_models=["hey_jarvis"])
            print("[WakeWord] Using hey_jarvis (closest to Hey Donna)")

    def detect(self, audio_chunk: bytes) -> bool:
        import numpy as np
        audio_np = np.frombuffer(audio_chunk, dtype=np.int16)
        predictions = self.model.predict(audio_np)
        return any(v >= self.THRESHOLD for v in predictions.values())


def create_wake_word(prefer_audio: bool = False):
    if prefer_audio:
        try:
            ww = OpenWakeWord()
            print("[WakeWord] Audio mode active")
            return ww
        except Exception as e:
            print(f"[WakeWord] Audio failed ({e}), using keyboard")
    print("[WakeWord] Keyboard mode (Enter to activate)")
    return KeyboardWakeWord()
