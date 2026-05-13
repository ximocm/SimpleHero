#!/usr/bin/env python3
"""Copy static assets into dist for compiled app serving."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets"
TARGET = ROOT / "dist" / "assets"


def main() -> None:
    if not SOURCE.exists():
        return

    if TARGET.exists():
        shutil.rmtree(TARGET)

    shutil.copytree(SOURCE, TARGET)


if __name__ == "__main__":
    main()
