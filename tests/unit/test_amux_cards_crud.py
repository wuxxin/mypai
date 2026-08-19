"""test_amux_cards_crud.py - Comprehensive unit tests for Kanban cards and lanes in amux."""

from __future__ import annotations

from mypai_runtime.amux import AmuxClient


def test_amux_cards_full_crud_lifecycle(mock_amux_client: AmuxClient) -> None:
    """Verify end-to-end CRUD on Kanban cards."""
    # 1. Create card in Todo
    card = mock_amux_client.create_card(
        title="Implement Auth Token Refresh",
        description="Support background refresh token rotation in client",
        lane="Todo",
        tags=["auth", "security", "core"],
        assignee="worker-auth-1",
        priority="P0",
        metadata={"epic": "auth-v2"},
    )
    card_id = card["id"]
    assert card["title"] == "Implement Auth Token Refresh"
    assert card["lane"] == "Todo"
    assert card["priority"] == "P0"

    # 2. Transition card to Doing with implementation notes
    doing_card = mock_amux_client.update_card(
        card_id=card_id,
        lane="Doing",
        notes="Worker spawned; drafting token cache",
    )
    assert doing_card["lane"] == "Doing"
    assert doing_card["notes"] == "Worker spawned; drafting token cache"

    # 3. Filter by lane and tag
    todo_list = mock_amux_client.list_cards(lane="Todo")
    assert not any(c["id"] == card_id for c in todo_list)

    doing_list = mock_amux_client.list_cards(lane="Doing", tag="security")
    assert any(c["id"] == card_id for c in doing_list)

    # 4. Transition card to Done
    done_card = mock_amux_client.update_card(
        card_id=card_id,
        lane="Done",
        notes="PR reviewed and merged with 100% test pass",
        status="completed",
    )
    assert done_card["lane"] == "Done"
    assert done_card["status"] == "completed"

    # 5. Delete card
    del_res = mock_amux_client.delete_card(card_id)
    assert del_res["status"] == "deleted"

    # 6. Verify card is gone
    all_cards = mock_amux_client.list_cards()
    assert not any(c["id"] == card_id for c in all_cards)
