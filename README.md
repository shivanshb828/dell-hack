# dell-hack

Donna is a local-first AI legal secretary for personal injury lawyers.

## Voice Pipeline

Push-to-talk voice interface with STT, agent routing, and TTS. See [donna/VOICE_PIPELINE.md](donna/VOICE_PIPELINE.md).

```bash
cd donna
pip install -r requirements.txt
python -m voice.pipeline
```

When the M3 seed DB is present, voice queries automatically inject matching case context before the agent call.

## M3 Glue Layer

- [M3 implementation plan](docs/m3-glue-layer-plan.md)
- [M2 testing tools](docs/m2-testing-tools.md)

Create the seed context and calendar databases:

```bash
python3 scripts/init_m3_test_db.py
```

Run a sample context lookup:

```bash
python3 scripts/context_lookup.py Maria
```

## Tests

```bash
python3 -m unittest discover -s tests
cd donna && python -m pytest voice/tests/ -v
```
