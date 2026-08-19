"""test_amux_client.py - Unit tests for AmuxClient."""

from __future__ import annotations

import pytest

from mypai_eval_runtime.amux import AmuxClient


def test_amux_client_send_message(mock_amux_client: AmuxClient) -> None:
    """Verify sending a structured turn message to another worker."""
    res = mock_amux_client.send_message(
        target_worker="mypai-workspace",
        body="USER_REQUEST: Check project status",
        correlation_id="corr-100",
    )
    assert res["status"] == "sent"
    assert res["message"]["target_worker"] == "mypai-workspace"
    assert res["message"]["correlation_id"] == "corr-100"


def test_amux_client_wait_for_response(mock_amux_client: AmuxClient) -> None:
    """Verify in-cell synchronous polling retrieves matching correlation ID."""
    # Pre-inject message
    mock_amux_client.send_message(
        target_worker="mypai-channel",
        body="WORKSPACE_REPLY: All services operational.",
        correlation_id="corr-200",
    )

    msg = mock_amux_client.wait_for_response(
        target_worker="mypai-channel",
        correlation_id="corr-200",
        timeout=2.0,
        poll_interval=0.05,
    )
    assert msg is not None
    assert msg["body"] == "WORKSPACE_REPLY: All services operational."
    assert msg["correlation_id"] == "corr-200"


def test_amux_client_wait_for_response_timeout(mock_amux_client: AmuxClient) -> None:
    """Verify TimeoutError is raised when correlation ID does not arrive."""
    with pytest.raises(TimeoutError) as exc_info:
        mock_amux_client.wait_for_response(
            target_worker="mypai-channel",
            correlation_id="non-existent-corr",
            timeout=0.1,
            poll_interval=0.02,
        )
    assert "Timeout waiting for response from 'mypai-channel'" in str(exc_info.value)


def test_amux_client_card_lifecycle(mock_amux_client: AmuxClient) -> None:
    """Verify Kanban card creation, retrieval, and status updates."""
    # 1. Create card
    card = mock_amux_client.create_card(
        title="Refactor Auth Middleware",
        description="Migrate to token-based verification",
        lane="Todo",
        tags=["backend", "security"],
    )
    assert card["id"] == "card-1"
    assert card["lane"] == "Todo"
    assert "backend" in card["tags"]

    # 2. Update card lane and notes
    updated = mock_amux_client.update_card(
        card_id="card-1",
        lane="Doing",
        notes="Started work on JWT parser",
    )
    assert updated["lane"] == "Doing"
    assert updated["notes"] == "Started work on JWT parser"


def test_amux_client_spawn_worker(mock_amux_client: AmuxClient) -> None:
    """Verify spawning an isolated task worker session."""
    session = mock_amux_client.spawn_task_worker(
        name="worker-security-1",
        directory="repos/backend",
        prompt="Scan auth routes for CVEs.",
        provider="omp",
    )
    assert session["name"] == "worker-security-1"
    assert session["directory"] == "repos/backend"
    assert session["status"] == "spawned"


def test_amux_client_get_metrics(mock_amux_client: AmuxClient) -> None:
    """Verify telemetry metrics retrieval."""
    metrics = mock_amux_client.get_metrics()
    assert "active_sessions" in metrics
    assert "total_messages" in metrics
    assert "total_cards" in metrics
