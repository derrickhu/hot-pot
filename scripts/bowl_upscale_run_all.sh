#!/bin/bash
set -euo pipefail
ASSETS="/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2"
RAW="$ASSETS/raw"
SCRIPT="/Users/rosa/rosa_games/hot-pot/scripts/bowl_upscale_regen_v2.py"
LOG="$ASSETS/process.log"

exec >>"$LOG" 2>&1
echo "=== $(date) start process-all ==="

python3 <<'PY'
import json
import subprocess
import sys
from pathlib import Path

assets = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2")
raw = assets / "raw"
script = Path("/Users/rosa/rosa_games/hot-pot/scripts/bowl_upscale_regen_v2.py")
batches = json.loads((assets / "batches.json").read_text())

pairs = [("grapefruit", "lime"), ("mandarin", "kumquat")]
pairs += [tuple(x) for x in batches["pair"]]
pairs += [tuple(x) for x in batches["single"] if len(x) == 2]
if batches["single"] and len(batches["single"][-1]) == 1:
    x = batches["single"][-1][0]
    pairs.append((x, x))

seen = set()
for a, b in pairs:
    key = (a, b)
    if key in seen:
        continue
    seen.add(key)
    name = f"duo_{a}__{b}_v3.png"
    path = raw / name
    out = assets / "final" / f"{a}__{b}"
    if not path.is_file():
        print(f"MISSING {name}", flush=True)
        continue
    if (out / f"{a}_1.png").is_file() and (out / f"{b}_1.png").is_file():
        print(f"SKIP {a}__{b}", flush=True)
        continue
    print(f"PROCESS {a} + {b}", flush=True)
    subprocess.run(
        [sys.executable, str(script), "process-duo", "--a", a, "--b", b, "--raw", str(path)],
        check=True,
    )

print("process-all done", flush=True)
PY

python3 /Users/rosa/rosa_games/hot-pot/scripts/bowl_upscale_finalize_all.py
echo "=== $(date) finalize: $(ls -1 "$ASSETS/final_all" 2>/dev/null | wc -l | tr -d ' ') files ==="
