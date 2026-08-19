"""test_amux_schedules_crud.py - Comprehensive unit tests for amux durable schedule management."""

from __future__ import annotations

from mypai_runtime.amux import AmuxClient


def test_amux_schedules_lifecycle(mock_amux_client: AmuxClient) -> None:
    """Verify registration, mutation, triggering, and deletion of scheduled cron jobs."""
    # 1. Create schedule
    sched = mock_amux_client.create_schedule(
        title="Weekly Hindsight Consolidation",
        session="mypai-cron",
        schedule_expr="0 2 * * 0",
        command="CRON: memory_consolidation",
        enabled=True,
        metadata={"scope": "global"},
    )
    sched_id = sched["id"]
    assert sched["title"] == "Weekly Hindsight Consolidation"
    assert sched["session"] == "mypai-cron"
    assert sched["schedule_expr"] == "0 2 * * 0"

    # 2. Get schedule details
    detail = mock_amux_client.get_schedule(sched_id)
    assert detail["id"] == sched_id
    assert detail["command"] == "CRON: memory_consolidation"

    # 3. Update schedule expression and disable
    updated = mock_amux_client.update_schedule(
        schedule_id=sched_id,
        title="Nightly Hindsight Consolidation",
        schedule_expr="0 3 * * *",
        enabled=False,
    )
    assert updated["title"] == "Nightly Hindsight Consolidation"
    assert updated["schedule_expr"] == "0 3 * * *"
    assert updated["enabled"] is False

    # 4. Trigger schedule run manually
    trig_res = mock_amux_client.trigger_schedule(sched_id)
    assert trig_res["status"] == "triggered"
    assert trig_res["id"] == sched_id

    # 5. Delete schedule
    del_res = mock_amux_client.delete_schedule(sched_id)
    assert del_res["status"] == "deleted"

    # 6. Verify schedule is no longer in list
    schedules = mock_amux_client.list_schedules()
    assert not any(s["id"] == sched_id for s in schedules)
