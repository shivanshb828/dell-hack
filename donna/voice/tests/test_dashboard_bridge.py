import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from donna.voice.dashboard_bridge import emit_to_dashboard


class TestEmitToDashboard:
    def test_sends_json(self):
        sent = []

        mock_ws = AsyncMock()
        mock_ws.send = AsyncMock(side_effect=lambda msg: sent.append(msg))

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_ws)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("donna.voice.dashboard_bridge.websockets.connect", return_value=mock_ctx):
            asyncio.run(emit_to_dashboard({"type": "user_speech", "text": "hello"}))

        assert len(sent) == 1
        payload = json.loads(sent[0])
        assert payload["type"] == "user_speech"
        assert payload["text"] == "hello"
        assert "ts" in payload

    def test_adds_timestamp(self):
        sent = []
        mock_ws = AsyncMock()
        mock_ws.send = AsyncMock(side_effect=lambda msg: sent.append(msg))
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_ws)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("donna.voice.dashboard_bridge.websockets.connect", return_value=mock_ctx):
            asyncio.run(emit_to_dashboard({"type": "test"}))

        payload = json.loads(sent[0])
        assert isinstance(payload["ts"], int)

    def test_does_not_raise_on_connection_refused(self):
        with patch("donna.voice.dashboard_bridge.websockets.connect", side_effect=OSError("refused")):
            # should silently pass
            asyncio.run(emit_to_dashboard({"type": "test"}))

    def test_preserves_existing_ts(self):
        sent = []
        mock_ws = AsyncMock()
        mock_ws.send = AsyncMock(side_effect=lambda msg: sent.append(msg))
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_ws)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("donna.voice.dashboard_bridge.websockets.connect", return_value=mock_ctx):
            asyncio.run(emit_to_dashboard({"type": "test", "ts": 9999}))

        payload = json.loads(sent[0])
        assert payload["ts"] == 9999
