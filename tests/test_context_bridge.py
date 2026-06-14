from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from donna.glue.context_bridge import lookup_context_block
from donna.glue.test_data import seed_context_db


class ContextBridgeTest(unittest.TestCase):
    def test_lookup_context_block_returns_formatted_hits(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "context.sqlite"
            seed_context_db(db_path)

            block = lookup_context_block("Maria", db_path=db_path)

        self.assertIn("Relevant case context:", block)
        self.assertIn("Maria Lopez", block)

    def test_lookup_context_block_missing_db_returns_empty(self) -> None:
        block = lookup_context_block("Maria", db_path=Path("/tmp/donna-missing-context.sqlite"))
        self.assertEqual(block, "")


if __name__ == "__main__":
    unittest.main()
