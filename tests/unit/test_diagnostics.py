"""test_diagnostics.py - Unit tests for trapped failure diagnostics."""

from __future__ import annotations

from mypai_eval_runtime.diagnostics import (
    analyze_channel_failure,
    analyze_cron_failure,
    analyze_worker_failure,
    analyze_workspace_failure,
    capture_exception_context,
)


def test_capture_exception_context_explicit() -> None:
    """Verify extracting context from an explicit exception object."""
    try:
        raise ValueError("Invalid configuration parameter: timeout <= 0")
    except ValueError as exc:
        ctx = capture_exception_context(exc)

    assert ctx["error_type"] == "ValueError"
    assert "Invalid configuration parameter" in ctx["error_message"]
    assert "traceback" in ctx
    assert len(ctx["traceback"]) > 0


def test_analyze_workspace_failure() -> None:
    """Verify formatting failure diagnostics for mypai-workspace."""
    exc = KeyError("missing_session_id")
    msg = analyze_workspace_failure(exc)
    assert "WORKSPACE_FAILURE: Encountered KeyError." in msg
    assert "missing_session_id" in msg


def test_analyze_cron_failure() -> None:
    """Verify formatting failure diagnostics for mypai-cron sweeps."""
    exc = ConnectionRefusedError("Could not reach metrics endpoint")
    msg = analyze_cron_failure(action="health_sweep", exc=exc)
    assert "CRON_FAILURE: Action 'health_sweep' failed with ConnectionRefusedError." in msg
    assert "Could not reach metrics endpoint" in msg


def test_analyze_channel_failure() -> None:
    """Verify formatting failure diagnostics for mypai-channel chat gateway."""
    exc = RuntimeError("Signal daemon disconnected")
    msg = analyze_channel_failure(exc=exc)
    assert "CHANNEL_FAILURE: Ingress turn failed with RuntimeError." in msg
    assert "Signal daemon disconnected" in msg


def test_analyze_worker_failure() -> None:
    """Verify formatting failure diagnostics for task workers."""
    exc = TimeoutError("Compilation timed out after 300s")
    msg = analyze_worker_failure(worker_name="worker-auth-1", exc=exc)
    assert "WORKER_FAILURE: Task worker 'worker-auth-1' failed with TimeoutError." in msg
    assert "Compilation timed out" in msg
