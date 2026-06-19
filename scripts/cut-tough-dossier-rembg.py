#!/usr/bin/env python3
"""Крепыш (досье): обёртка над build-tough-dossier.py."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).resolve().parent / "build-tough-dossier.py"), run_name="__main__")
