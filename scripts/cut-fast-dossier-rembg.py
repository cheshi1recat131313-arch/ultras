#!/usr/bin/env python3
"""Шустрый (досье): обёртка над build-fast-dossier.py."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).resolve().parent / "build-fast-dossier.py"), run_name="__main__")
