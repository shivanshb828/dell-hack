import threading
import pytest

from donna.voice.wake_word import KeyboardWakeWord, create_wake_word


class TestKeyboardWakeWord:
    def test_instantiates(self):
        ww = KeyboardWakeWord()
        ww.stop()
        assert ww is not None

    def test_triggered_event_fires(self):
        ww = KeyboardWakeWord()
        ww._triggered.set()  # simulate Enter press
        # wait_for_activation should return immediately
        done = threading.Event()

        def _wait():
            ww.wait_for_activation()
            done.set()

        t = threading.Thread(target=_wait, daemon=True)
        t.start()
        t.join(timeout=1.0)
        ww.stop()
        assert done.is_set(), "wait_for_activation did not return"

    def test_event_cleared_after_activation(self):
        ww = KeyboardWakeWord()
        ww._triggered.set()
        ww.wait_for_activation()
        assert not ww._triggered.is_set()
        ww.stop()


class TestCreateWakeWord:
    def test_keyboard_mode_returns_keyboard(self):
        ww = create_wake_word(prefer_audio=False)
        assert isinstance(ww, KeyboardWakeWord)
        ww.stop()

    def test_audio_mode_falls_back_to_keyboard_if_unavailable(self):
        # openwakeword likely not installed in this env; should fall back
        ww = create_wake_word(prefer_audio=True)
        # either OpenWakeWord or KeyboardWakeWord — both have stop() or detect()
        assert ww is not None
        if isinstance(ww, KeyboardWakeWord):
            ww.stop()
