"""diagnostics.py - Failure diagnostics and error analysis for in-kernel execution."""

from __future__ import annotations

import sys
import traceback
from typing import Any, Dict, Optional


def capture_exception_context(exc: Optional[BaseException] = None) -> Dict[str, Any]:
    """Extract full traceback, exception type, and message."""
    if exc is None:
        exc_type, exc_val, exc_tb = sys.exc_info()
    else:
        exc_type = type(exc)
        exc_val = exc
        exc_tb = exc.__traceback__

    return {
        "error_type": exc_type.__name__ if exc_type else "UnknownError",
        "error_message": str(exc_val) if exc_val else "No error message provided",
        "traceback": "".join(traceback.format_exception(exc_type, exc_val, exc_tb)),
    }


def analyze_workspace_failure(exc: Optional[BaseException] = None) -> str:
    """Format failure diagnostics for mypai-workspace."""
    diag = capture_exception_context(exc)
    return (
        f"WORKSPACE_FAILURE: Encountered {diag['error_type']}.\n"
        f"Message: {diag['error_message']}\n"
        f"Traceback:\n{diag['traceback']}"
    )


def analyze_cron_failure(action: str, exc: Optional[BaseException] = None) -> str:
    """Format failure diagnostics for mypai-cron sweeps."""
    diag = capture_exception_context(exc)
    return (
        f"CRON_FAILURE: Action '{action}' failed with {diag['error_type']}.\n"
        f"Message: {diag['error_message']}\n"
        f"Traceback:\n{diag['traceback']}"
    )


def analyze_channel_failure(exc: Optional[BaseException] = None) -> str:
    """Format failure diagnostics for mypai-channel chat ingress."""
    diag = capture_exception_context(exc)
    return (
        f"CHANNEL_FAILURE: Ingress turn failed with {diag['error_type']}.\n"
        f"Message: {diag['error_message']}\n"
        f"Traceback:\n{diag['traceback']}"
    )


def analyze_worker_failure(worker_name: str, exc: Optional[BaseException] = None) -> str:
    """Format failure diagnostics for task worker sessions."""
    diag = capture_exception_context(exc)
    return (
        f"WORKER_FAILURE: Task worker '{worker_name}' failed with {diag['error_type']}.\n"
        f"Message: {diag['error_message']}\n"
        f"Traceback:\n{diag['traceback']}"
    )
