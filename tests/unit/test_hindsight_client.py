"""test_hindsight_client.py - Unit tests for HindsightClient."""

from __future__ import annotations

from mypai_eval_runtime.hindsight import HindsightClient


def test_hindsight_reflect(mock_hindsight_client: HindsightClient) -> None:
    """Verify reflection over active mental models."""
    res = mock_hindsight_client.reflect(
        query="What are the coding style conventions?",
        bank_id="mypai",
    )
    assert "reflection" in res
    assert res["confidence"] > 0.8
    assert "project-conventions" in res["grounding_models"]


def test_hindsight_recall(mock_hindsight_client: HindsightClient) -> None:
    """Verify semantic memory recall."""
    res = mock_hindsight_client.recall(
        query="database migration decisions",
        top_k=3,
        bank_id="mypai",
    )
    assert "facts" in res
    assert len(res["facts"]) >= 1
    assert "database migration decisions" in res["facts"][0]["content"]


def test_hindsight_retain(mock_hindsight_client: HindsightClient) -> None:
    """Verify fact retention into memory bank."""
    items = [
        {
            "content": "Decided to adopt PostgreSQL JSONB for flexibility",
            "context": "Architecture meeting",
        },
        {"content": "User prefers concise bullet points in chat", "context": "User feedback"},
    ]
    res = mock_hindsight_client.retain(items=items, bank_id="mypai")
    assert res["status"] == "retained"
    assert res["count"] == 2


def test_hindsight_mental_models(mock_hindsight_client: HindsightClient) -> None:
    """Verify listing active mental models."""
    models = mock_hindsight_client.mental_models(bank_id="mypai")
    assert isinstance(models, list)
    model_ids = [m["id"] for m in models]
    assert "user-profile" in model_ids
    assert "lifeos-anti-criteria" in model_ids


def test_hindsight_consolidate(mock_hindsight_client: HindsightClient) -> None:
    """Verify triggering memory consolidation."""
    res = mock_hindsight_client.consolidate(bank_id="mypai")
    assert res["status"] == "consolidated"
    assert res["updated_models"] >= 1
