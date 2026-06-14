#!/usr/bin/env bash
# Create a repo-local venv and install Donna Python deps.
# Ubuntu 24.04 blocks system pip (PEP 668) — always use this on the Dell GB10.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${ROOT}/.venv"
REQ="${ROOT}/donna/requirements-minimal.txt"
FULL="${ROOT}/donna/requirements.txt"

echo "Donna venv setup — ${ROOT}"

missing=()
for pkg in python3 python3-venv python3-full portaudio19-dev; do
  if ! dpkg -s "$pkg" >/dev/null 2>&1; then
    missing+=("$pkg")
  fi
done

if ((${#missing[@]})); then
  echo "Installing system packages: ${missing[*]}"
  sudo apt-get update
  sudo apt-get install -y "${missing[@]}"
fi

if [[ ! -d "${VENV}" ]]; then
  python3 -m venv "${VENV}"
fi

# shellcheck disable=SC1091
source "${VENV}/bin/activate"

pip_install() {
  python -m pip install --retries 5 --timeout 120 --no-cache-dir "$@"
}

echo "Upgrading pip..."
pip_install --upgrade pip setuptools wheel

echo "Installing minimal voice deps (no torch — energy VAD fallback)..."
if ! pip_install -r "${REQ}"; then
  echo "Batch install failed — trying packages one at a time..."
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    echo "  → $line"
    pip_install "$line"
  done < "${REQ}"
fi

if [[ "${1:-}" == "--full" ]]; then
  echo "Installing full requirements (torch, silero-vad, openwakeword)..."
  pip_install -r "${FULL}" || echo "WARN: full install failed — minimal voice stack is still usable"
fi

python -c "import pyaudio, httpx, websockets, numpy; print('OK: core imports')"

echo
echo "Done. Run voice from repo root:"
echo "  cd ${ROOT} && bash scripts/run_voice.sh"
