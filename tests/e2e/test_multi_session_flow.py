"""test_multi_session_flow.py - End-to-end multi-session workflow simulation test."""

from __future__ import annotations

from mypai_runtime.amux import AmuxClient
from mypai_runtime.diagnostics import analyze_worker_failure
from mypai_runtime.hindsight import HindsightClient


def test_e2e_user_request_to_task_worker_execution(
    mock_amux_client: AmuxClient,
    mock_hindsight_client: HindsightClient,
) -> None:
    """
    End-to-End Simulation:
    1. Chat Ingress (channel) receives user request.
    2. Channel reflects on user preferences via Hindsight and routes to Main.
    3. Main creates a Kanban board card and spawns a normal OMP task worker.
    4. Worker executes task and returns turn completion to Main.
    5. Main retains architectural decision in Hindsight, updates card to 'Done', and replies to Channel.
    """
    # -------------------------------------------------------------------------
    # Step 1: Channel Ingest & Reflection
    # -------------------------------------------------------------------------
    user_prompt = "Refactor database connection pool to support 100 concurrent workers."
    reflection = mock_hindsight_client.reflect(
        query=user_prompt,
        bank_id="mypai",
    )
    assert reflection["confidence"] > 0.8

    # Channel forwards to main
    channel_to_main_corr = "req-1001"
    mock_amux_client.send_message(
        target_worker="mypai-main",
        body=f"USER_REQUEST: {user_prompt}",
        correlation_id=channel_to_main_corr,
    )

    # -------------------------------------------------------------------------
    # Step 2: Main Orchestration & Kanban Card Creation
    # -------------------------------------------------------------------------
    inbox = mock_amux_client.list_messages(worker="mypai-main")
    assert len(inbox["messages"]) == 1
    incoming_msg = inbox["messages"][0]
    assert "USER_REQUEST" in incoming_msg["body"]

    # Main creates Kanban card
    card = mock_amux_client.create_card(
        title="Refactor DB Connection Pool",
        description=user_prompt,
        lane="Todo",
        tags=["database", "performance"],
    )
    card_id = card["id"]
    assert card["lane"] == "Todo"

    # Main spawns task worker
    worker_name = "task-worker-db-1"
    spawn_res = mock_amux_client.spawn_task_worker(
        name=worker_name,
        directory="repos/backend-core",
        prompt=f"Execute: {user_prompt}",
    )
    assert spawn_res["name"] == worker_name

    # Card moves to Doing
    mock_amux_client.update_card(card_id=card_id, lane="Doing", notes="Assigned to worker")

    # -------------------------------------------------------------------------
    # Step 3: Task Worker Execution & Completion Report
    # -------------------------------------------------------------------------
    worker_inbox = mock_amux_client.list_messages(worker=worker_name)
    assert len(worker_inbox["messages"]) == 1

    # Worker finishes and sends back diff report
    worker_to_main_corr = "report-1001"
    mock_amux_client.send_message(
        target_worker="mypai-main",
        body="TASK_COMPLETE: Connection pool enlarged to 100. Pytest passed with 0 failures.",
        correlation_id=worker_to_main_corr,
    )

    # -------------------------------------------------------------------------
    # Step 4: Main Verification, Retention & User Reply
    # -------------------------------------------------------------------------
    report = mock_amux_client.wait_for_response(
        target_worker="mypai-main",
        correlation_id=worker_to_main_corr,
        timeout=1.0,
        poll_interval=0.01,
    )
    assert "TASK_COMPLETE" in report["body"]

    # Main retains decision
    mock_hindsight_client.retain(
        items=[
            {
                "content": "Increased asyncpg connection pool max_size to 100 for high concurrency.",
                "context": "Backend optimization task",
            }
        ],
        bank_id="mypai",
    )

    # Main moves card to Done
    final_card = mock_amux_client.update_card(
        card_id=card_id,
        lane="Done",
        notes="Verified and merged.",
    )
    assert final_card["lane"] == "Done"

    # Main sends final formatted reply to channel
    mock_amux_client.send_message(
        target_worker="mypai-channel",
        body="Completed database connection pool upgrade. All unit and load tests passed.",
        correlation_id=channel_to_main_corr,
    )

    # -------------------------------------------------------------------------
    # Step 5: Channel Receives User-Facing Reply
    # -------------------------------------------------------------------------
    channel_reply = mock_amux_client.wait_for_response(
        target_worker="mypai-channel",
        correlation_id=channel_to_main_corr,
        timeout=1.0,
        poll_interval=0.01,
    )
    assert "Completed database connection pool upgrade" in channel_reply["body"]


def test_e2e_cron_sweep_and_anomaly_recovery(
    mock_amux_client: AmuxClient,
) -> None:
    """
    End-to-End Simulation of Cron Sweep:
    1. Cron receives CRON: health_sweep trigger.
    2. Probes metrics from amux control plane.
    3. Handles simulated worker exception with structured diagnostics.
    4. Files anomaly card on Kanban board.
    """
    # 1. Simulate cron sweep
    metrics = mock_amux_client.get_metrics()
    assert metrics["active_sessions"] >= 3

    # 2. Simulate worker failure during sweep
    try:
        raise ConnectionResetError("Lost peer connection to worker-analytics-3")
    except ConnectionResetError as exc:
        diag = analyze_worker_failure(worker_name="worker-analytics-3", exc=exc)

    assert (
        "WORKER_FAILURE: Task worker 'worker-analytics-3' failed with ConnectionResetError." in diag
    )

    # 3. Cron files alert card in Todo
    alert_card = mock_amux_client.create_card(
        title="Alert: worker-analytics-3 connection reset",
        description=diag,
        lane="Todo",
        tags=["alert", "infrastructure"],
    )
    assert alert_card["lane"] == "Todo"
    assert "alert" in alert_card["tags"]
