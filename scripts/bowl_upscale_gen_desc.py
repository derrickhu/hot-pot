#!/usr/bin/env python3
"""输出某 duo 批次的 GenerateImage 参数（description + reference paths）。"""
import importlib.util
import json
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "b", Path(__file__).resolve().parents[1] / "scripts/bowl_upscale_regen_v2.py"
)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


def main() -> None:
    a, b = sys.argv[1], sys.argv[2]
    print("===DESCRIPTION===")
    print(b.prompt_duo(a, b))
    print("===REFS===")
    for p in b.ref_paths_for_duo(a, b):
        print(p)


if __name__ == "__main__":
    main()
