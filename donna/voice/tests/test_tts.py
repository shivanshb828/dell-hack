import io
import wave
from unittest.mock import MagicMock, patch

import pytest

from donna.voice.tts import synthesize, _synthesize_kokoro, _synthesize_piper


def _make_wav(duration_s=0.1, rate=22050) -> bytes:
    n = int(rate * duration_s)
    import numpy as np
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(rate)
        wf.writeframes(np.zeros(n, dtype=np.int16).tobytes())
    return buf.getvalue()


class TestKokoro:
    def test_returns_bytes(self):
        mock_resp = MagicMock()
        mock_resp.content = _make_wav()
        mock_resp.raise_for_status = MagicMock()

        with patch("donna.voice.tts.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.post.return_value = mock_resp
            result = _synthesize_kokoro("Hello")

        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_raises_on_connection_error(self):
        import httpx
        with patch("donna.voice.tts.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.post.side_effect = httpx.ConnectError("down")
            with pytest.raises(httpx.ConnectError):
                _synthesize_kokoro("Hello")


class TestPiper:
    def test_returns_wav_bytes(self):
        import numpy as np
        raw_pcm = np.zeros(22050, dtype=np.int16).tobytes()

        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = raw_pcm

        with patch("donna.voice.tts.subprocess.run", return_value=mock_result):
            result = _synthesize_piper("Hello")

        buf = io.BytesIO(result)
        with wave.open(buf, "rb") as wf:
            assert wf.getsampwidth() == 2
            assert wf.getframerate() == 22050

    def test_raises_on_nonzero_exit(self):
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = b"model not found"

        with patch("donna.voice.tts.subprocess.run", return_value=mock_result):
            with pytest.raises(RuntimeError, match="piper failed"):
                _synthesize_piper("Hello")


class TestSynthesize:
    def test_kokoro_primary(self):
        wav = _make_wav()
        with patch("donna.voice.tts._synthesize_kokoro", return_value=wav) as mk, \
             patch("donna.voice.tts._synthesize_piper") as mp:
            result = synthesize("Hello")
        assert result == wav
        mk.assert_called_once()
        mp.assert_not_called()

    def test_falls_back_to_piper(self):
        wav = _make_wav()
        with patch("donna.voice.tts._synthesize_kokoro", side_effect=Exception("down")), \
             patch("donna.voice.tts._synthesize_piper", return_value=wav) as mp:
            result = synthesize("Hello")
        assert result == wav
        mp.assert_called_once()

    def test_raises_if_all_fail(self):
        with patch("donna.voice.tts._synthesize_kokoro", side_effect=Exception("k")), \
             patch("donna.voice.tts._synthesize_piper", side_effect=Exception("p")):
            with pytest.raises(RuntimeError, match="All TTS backends failed"):
                synthesize("Hello")
