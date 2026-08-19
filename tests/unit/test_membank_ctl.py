"""test_membank_ctl.py - Unit tests for bin/membank-ctl CLI utility."""

from __future__ import annotations

import subprocess
from pathlib import Path


def test_membank_ctl_help() -> None:
    """Verify bin/membank-ctl displays usage help."""
    script_path = Path(__file__).parents[2] / "bin" / "membank-ctl"
    res = subprocess.run(
        ["bash", str(script_path), "--help"],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0
    assert "membank-ctl - Management CLI for Hindsight memory banks" in res.stdout
    assert "update" in res.stdout
    assert "export" in res.stdout


def test_membank_ctl_missing_args() -> None:
    """Verify bin/membank-ctl fails gracefully when required arguments are missing."""
    script_path = Path(__file__).parents[2] / "bin" / "membank-ctl"
    res = subprocess.run(
        ["bash", str(script_path), "update"],
        capture_output=True,
        text=True,
    )
    assert res.returncode != 0
    assert "Usage:" in res.stderr or "Error" in res.stderr or "Usage:" in res.stdout
