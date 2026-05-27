#!/usr/bin/env python3
"""处理 raw/ 下已生成的合图（切格+抠图）。"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ASSETS = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2")
RAW = ASSETS / "raw"
SCRIPT = Path(__file__).resolve().parents[1] / "bowl_upscale_regen_v2.py"


def main() -> None:
    batches = json.loads((ASSETS / "batches.json").read_text())
    done = set(batches.get("done", []))
    for a, b in batches["pair"]:
        name = f"duo_{a}__{b}_v2.png"
        raw = RAW / name
        if not raw.is_file():
            print(f"SKIP missing {name}")
            continue
        out = ASSETS / "final" / f"{a}__{b}"
        if (out / f"{a}_1.png").is_file():
            print(f"SKIP exists {a}__{b}")
            continue
        subprocess.run(
            [sys.executable, str(SCRIPT), "process-duo", "--a", a, "--b", b, "--raw", str(raw)],
            check=True,
        )
    for a, b in batches["single"]:
        name = f"duo_{a}__{b}_v2.png"
        raw = RAW / name
        if not raw.is_file():
            print(f"SKIP missing {name}")
            continue
        out = ASSETS / "final" / f"{a}__{b}"
        if (out / f"{a}_1.png").is_file():
            print(f"SKIP exists {a}__{b}")
            continue
        subprocess.run(
            [sys.executable, str(SCRIPT), "process-duo", "--a", a, "--b", b, "--raw", str(raw)],
            check=True,
        )


if __name__ == "__main__":
    main()
