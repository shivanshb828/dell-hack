#!/usr/bin/env bash
# Run ON the Dell GBIO box while SSH'd in. Captures machine + service state
# for pasting into .context/dell-machine.md or updating docs.

set -u

echo "=== Donna Dell Discovery ==="
echo "timestamp: $(date -Is 2>/dev/null || date)"
echo "hostname: $(hostname 2>/dev/null || echo unknown)"
echo "user: $(whoami 2>/dev/null || echo unknown)"
echo "pwd: $(pwd)"
echo

echo "=== OS ==="
uname -a 2>/dev/null || true
if command -v lsb_release >/dev/null 2>&1; then
  lsb_release -a 2>/dev/null || true
fi
echo

echo "=== GPU ==="
nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used --format=csv 2>/dev/null || echo "nvidia-smi unavailable"
echo

echo "=== Listening ports (donna-related) ==="
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | grep -E ':9000|:8880|:11434|:3001' || echo "no donna ports in ss output"
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp 2>/dev/null | grep -E '9000|8880|11434|3001' || echo "no donna ports in netstat output"
else
  echo "ss/netstat unavailable"
fi
echo

echo "=== Docker ==="
if command -v docker >/dev/null 2>&1; then
  docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null || true
else
  echo "docker unavailable"
fi
echo

echo "=== Ollama models ==="
curl -s http://localhost:11434/api/tags 2>/dev/null | head -c 2000 || echo "ollama unreachable"
echo
echo

echo "=== Repo (if in dell-hack) ==="
if [[ -d .git ]]; then
  git rev-parse --abbrev-ref HEAD 2>/dev/null || true
  git log -1 --oneline 2>/dev/null || true
else
  echo "not inside git repo — cd to dell-hack and re-run"
fi
echo

echo "=== Donna service check ==="
if [[ -f scripts/check_services.sh ]]; then
  bash scripts/check_services.sh localhost
else
  echo "scripts/check_services.sh not found"
fi
