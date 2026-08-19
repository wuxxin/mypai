"""test_amux_errors.py - Unit tests for error handling and edge cases in amux REST API client."""

from __future__ import annotations

import httpx
import pytest

from mypai_runtime.amux import AmuxClient


def test_amux_get_nonexistent_message(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when getting a nonexistent message."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.get_message("nonexistent-msg-999")
    assert exc_info.value.response.status_code == 404


def test_amux_delete_nonexistent_message(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when deleting a nonexistent message."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.delete_message("nonexistent-msg-999")
    assert exc_info.value.response.status_code == 404


def test_amux_mark_read_nonexistent_message(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when marking a nonexistent message as read."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.mark_message_read("nonexistent-msg-999")
    assert exc_info.value.response.status_code == 404


def test_amux_get_nonexistent_card(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when getting a nonexistent Kanban card."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.get_card("card-99999")
    assert exc_info.value.response.status_code == 404


def test_amux_update_nonexistent_card(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when updating a nonexistent Kanban card."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.update_card(card_id="card-99999", lane="Done")
    assert exc_info.value.response.status_code == 404


def test_amux_delete_nonexistent_card(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when deleting a nonexistent Kanban card."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.delete_card("card-99999")
    assert exc_info.value.response.status_code == 404


def test_amux_get_nonexistent_session(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when getting a nonexistent session."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.get_session("session-that-does-not-exist")
    assert exc_info.value.response.status_code == 404


def test_amux_kill_nonexistent_session(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when killing a nonexistent session."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.kill_session("session-that-does-not-exist")
    assert exc_info.value.response.status_code == 404


def test_amux_restart_nonexistent_session(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when restarting a nonexistent session."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.restart_session("session-that-does-not-exist")
    assert exc_info.value.response.status_code == 404


def test_amux_get_nonexistent_schedule(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when getting a nonexistent schedule."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.get_schedule("sched-99999")
    assert exc_info.value.response.status_code == 404


def test_amux_update_nonexistent_schedule(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when updating a nonexistent schedule."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.update_schedule("sched-99999", title="New Title")
    assert exc_info.value.response.status_code == 404


def test_amux_trigger_nonexistent_schedule(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when triggering a nonexistent schedule."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.trigger_schedule("sched-99999")
    assert exc_info.value.response.status_code == 404


def test_amux_delete_nonexistent_schedule(mock_amux_client: AmuxClient) -> None:
    """Verify HTTP 404 is raised when deleting a nonexistent schedule."""
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        mock_amux_client.delete_schedule("sched-99999")
    assert exc_info.value.response.status_code == 404


def test_amux_wait_for_response_no_mark_read(mock_amux_client: AmuxClient) -> None:
    """Verify wait_for_response with mark_read=False preserves unread state."""
    mock_amux_client.send_message(
        target_worker="mypai-main",
        body="PING_NO_READ",
        correlation_id="corr-unread-test",
    )

    msg = mock_amux_client.wait_for_response(
        target_worker="mypai-main",
        correlation_id="corr-unread-test",
        timeout=1.0,
        poll_interval=0.02,
        mark_read=False,
    )
    assert msg["body"] == "PING_NO_READ"
    assert msg["unread"] is True
