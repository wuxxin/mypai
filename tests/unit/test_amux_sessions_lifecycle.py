"""test_amux_sessions_lifecycle.py - Comprehensive unit tests for amux session lifecycle."""

from __future__ import annotations

from mypai_runtime.amux import AmuxClient


def test_amux_sessions_lifecycle(mock_amux_client: AmuxClient) -> None:
    """Verify session creation, inspection, restart, termination, and worker helper."""
    # 1. Spawn task worker via helper
    worker = mock_amux_client.spawn_task_worker(
        name="worker-refactor-api",
        directory="repos/api-service",
        prompt="TASK: Add comprehensive pytest fixtures",
        provider="omp",
        profile="normal",
    )
    assert worker["name"] == "worker-refactor-api"
    assert worker["directory"] == "repos/api-service"

    # 2. Check that initial prompt was dispatched to worker inbox
    inbox = mock_amux_client.list_messages(worker="worker-refactor-api", unread=True)
    assert len(inbox["messages"]) == 1
    assert "Add comprehensive pytest fixtures" in inbox["messages"][0]["body"]

    # 3. Retrieve session metadata
    sess = mock_amux_client.get_session("worker-refactor-api")
    assert sess["name"] == "worker-refactor-api"
    assert sess["status"] == "spawned"

    # 4. Restart session
    restart_res = mock_amux_client.restart_session("worker-refactor-api")
    assert restart_res["status"] == "restarted"

    # 5. Kill session
    kill_res = mock_amux_client.kill_session("worker-refactor-api")
    assert kill_res["status"] == "terminated"

    # 6. Verify status updated
    sess_after_kill = mock_amux_client.get_session("worker-refactor-api")
    assert sess_after_kill["status"] == "terminated"
