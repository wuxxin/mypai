"""test_amux_client.py - Unit tests for AmuxClient REST API wrapper."""

from __future__ import annotations

import pytest

from mypai_runtime.amux import AmuxClient


def test_amux_messages_api(mock_amux_client: AmuxClient) -> None:
    """Verify complete Messages REST API methods."""
    # 1. Send message with full metadata and reply_to
    res = mock_amux_client.send_message(
        target_worker="mypai-main",
        body="USER_REQUEST: Check project status",
        correlation_id="corr-100",
        reply_to="msg-0",
        metadata={"priority": "high", "source": "signal"},
    )
    assert res["status"] == "sent"
    msg_id = res["message"]["id"]
    assert res["message"]["target_worker"] == "mypai-main"
    assert res["message"]["reply_to"] == "msg-0"

    # 2. List messages with limits
    inbox = mock_amux_client.list_messages(
        worker="mypai-main",
        unread=True,
        limit=10,
        offset=0,
    )
    assert len(inbox["messages"]) >= 1

    # 3. Get message by ID
    msg = mock_amux_client.get_message(msg_id)
    assert msg["id"] == msg_id
    assert msg["body"] == "USER_REQUEST: Check project status"

    # 4. Mark message read
    read_res = mock_amux_client.mark_message_read(msg_id)
    assert read_res["status"] == "marked_read"

    # 5. Delete message
    del_res = mock_amux_client.delete_message(msg_id)
    assert del_res["status"] == "deleted"


def test_amux_client_wait_for_response(mock_amux_client: AmuxClient) -> None:
    """Verify in-cell synchronous polling retrieves matching correlation ID."""
    mock_amux_client.send_message(
        target_worker="mypai-channel",
        body="MAIN_REPLY: All services operational.",
        correlation_id="corr-200",
    )

    msg = mock_amux_client.wait_for_response(
        target_worker="mypai-channel",
        correlation_id="corr-200",
        timeout=2.0,
        poll_interval=0.05,
    )
    assert msg is not None
    assert msg["body"] == "MAIN_REPLY: All services operational."
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


def test_amux_sessions_api(mock_amux_client: AmuxClient) -> None:
    """Verify complete Sessions REST API methods."""
    # 1. List initial sessions
    sessions = mock_amux_client.list_sessions()
    assert len(sessions) >= 3

    # 2. Create session with full options
    created = mock_amux_client.create_session(
        name="worker-custom-1",
        directory="repos/backend",
        provider="omp",
        profile="normal",
        command="omp",
        env={"TEST_VAR": "1"},
    )
    assert created["name"] == "worker-custom-1"

    # 3. Get session
    session = mock_amux_client.get_session("worker-custom-1")
    assert session["name"] == "worker-custom-1"

    # 4. Restart session
    restarted = mock_amux_client.restart_session("worker-custom-1")
    assert restarted["status"] == "restarted"

    # 5. Kill session
    killed = mock_amux_client.kill_session("worker-custom-1")
    assert killed["status"] == "terminated"


def test_amux_board_cards_api(mock_amux_client: AmuxClient) -> None:
    """Verify complete Board and Cards REST API methods."""
    # 1. List lanes
    lanes = mock_amux_client.list_lanes()
    assert "Todo" in lanes
    assert "Done" in lanes

    # 2. Create card with full options
    card = mock_amux_client.create_card(
        title="Refactor Auth Middleware",
        description="Migrate to token-based verification",
        lane="Todo",
        tags=["backend", "security"],
        assignee="worker-auth-1",
        priority="P1",
        metadata={"milestone": "v2.0"},
    )
    card_id = card["id"]
    assert card["lane"] == "Todo"

    # 3. List cards with filter
    cards = mock_amux_client.list_cards(lane="Todo", tag="backend", assignee="worker-auth-1")
    assert len(cards) >= 1

    # 4. Get card
    fetched = mock_amux_client.get_card(card_id)
    assert fetched["id"] == card_id

    # 5. Update card with multiple fields
    updated = mock_amux_client.update_card(
        card_id=card_id,
        lane="Doing",
        notes="Started implementation",
        title="Refactor Auth Middleware v2",
        description="Updated description",
        tags=["backend", "security", "in-progress"],
        assignee="worker-auth-2",
        status="in_progress",
    )
    assert updated["lane"] == "Doing"
    assert updated["notes"] == "Started implementation"
    assert updated["title"] == "Refactor Auth Middleware v2"

    # 6. Delete card
    deleted = mock_amux_client.delete_card(card_id)
    assert deleted["status"] == "deleted"


def test_amux_schedules_api(mock_amux_client: AmuxClient) -> None:
    """Verify complete Schedules REST API methods."""
    # 1. Create schedule with metadata
    sched = mock_amux_client.create_schedule(
        title="Health Sweep",
        session="mypai-cron",
        schedule_expr="0 8 * * *",
        command="CRON: health_sweep",
        enabled=True,
        metadata={"category": "audit"},
    )
    sched_id = sched["id"]
    assert sched["title"] == "Health Sweep"

    # 2. List schedules
    schedules = mock_amux_client.list_schedules()
    assert len(schedules) >= 1

    # 3. Get schedule
    fetched = mock_amux_client.get_schedule(sched_id)
    assert fetched["id"] == sched_id

    # 4. Update schedule with all options
    updated = mock_amux_client.update_schedule(
        schedule_id=sched_id,
        title="Daily Morning Health Sweep",
        schedule_expr="0 7 * * *",
        command="CRON: daily_health_sweep",
        enabled=False,
    )
    assert updated["title"] == "Daily Morning Health Sweep"
    assert updated["enabled"] is False

    # 5. Trigger schedule
    triggered = mock_amux_client.trigger_schedule(sched_id)
    assert triggered["status"] == "triggered"

    # 6. Delete schedule
    deleted = mock_amux_client.delete_schedule(sched_id)
    assert deleted["status"] == "deleted"


def test_amux_system_health_and_metrics(mock_amux_client: AmuxClient) -> None:
    """Verify telemetry metrics, health, and system status."""
    metrics = mock_amux_client.get_metrics()
    assert "active_sessions" in metrics
    assert "total_messages" in metrics

    health = mock_amux_client.get_health()
    assert health["status"] == "healthy"

    status = mock_amux_client.get_status()
    assert status["status"] == "online"
    assert "uptime_seconds" in status


def test_amux_http_primitives_direct(mock_amux_client: AmuxClient) -> None:
    """Verify direct post, patch, delete, and get calls."""
    post_res = mock_amux_client.post("messages", target={"worker_name": "mypai-main"}, body="test")
    assert post_res["status"] == "sent"

    card = mock_amux_client.post("board/cards", title="Direct Card")
    card_id = card["id"]

    patch_res = mock_amux_client.patch(f"board/cards/{card_id}", lane="Done")
    assert patch_res["lane"] == "Done"

    del_res = mock_amux_client.delete(f"board/cards/{card_id}")
    assert del_res["status"] == "deleted"
