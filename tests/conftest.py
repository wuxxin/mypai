"""conftest.py - Pytest fixtures and mock HTTP servers for Next-Gen MyPAI tests."""

from __future__ import annotations

import json
from typing import Any, Dict, List

import httpx
import pytest

from mypai_eval_runtime.amux import AmuxClient
from mypai_eval_runtime.hindsight import HindsightClient


class MockAmuxState:
    """In-memory simulated state for amux-server control plane."""

    def __init__(self) -> None:
        self.messages: List[Dict[str, Any]] = []
        self.cards: Dict[str, Dict[str, Any]] = {}
        self.sessions: Dict[str, Dict[str, Any]] = {
            "mypai-workspace": {"name": "mypai-workspace", "profile": "mypai", "status": "active"},
            "mypai-channel": {"name": "mypai-channel", "profile": "mypai", "status": "active"},
            "mypai-cron": {"name": "mypai-cron", "profile": "mypai", "status": "active"},
        }
        self.schedules: List[Dict[str, Any]] = []
        self.next_card_id = 1


@pytest.fixture
def amux_state() -> MockAmuxState:
    return MockAmuxState()


@pytest.fixture
def mock_amux_transport(amux_state: MockAmuxState) -> httpx.MockTransport:
    """Mock HTTP transport intercepting amux API requests."""

    def handler(request: httpx.Request) -> httpx.Response:
        url = request.url
        path = url.path.rstrip("/")
        method = request.method

        if path == "/api/messages":
            if method == "POST":
                payload = json.loads(request.content.decode("utf-8"))
                target = payload.get("target", {}).get("worker_name", "")
                msg_entry = {
                    "id": f"msg-{len(amux_state.messages) + 1}",
                    "target_worker": target,
                    "body": payload.get("body", ""),
                    "correlation_id": payload.get("correlation_id"),
                    "unread": True,
                }
                amux_state.messages.append(msg_entry)
                return httpx.Response(200, json={"status": "sent", "message": msg_entry})

            elif method == "GET":
                worker = url.params.get("worker")
                unread_only = url.params.get("unread") == "true"
                matched = [
                    m
                    for m in amux_state.messages
                    if (not worker or m["target_worker"] == worker)
                    and (not unread_only or m.get("unread", False))
                ]
                return httpx.Response(200, json={"messages": matched})

        elif path == "/api/board/cards":
            if method == "POST":
                payload = json.loads(request.content.decode("utf-8"))
                card_id = f"card-{amux_state.next_card_id}"
                amux_state.next_card_id += 1
                card_entry = {
                    "id": card_id,
                    "title": payload.get("title", ""),
                    "description": payload.get("description", ""),
                    "lane": payload.get("lane", "Todo"),
                    "tags": payload.get("tags", []),
                }
                amux_state.cards[card_id] = card_entry
                return httpx.Response(201, json=card_entry)

            elif method == "GET":
                return httpx.Response(200, json={"cards": list(amux_state.cards.values())})

        elif path.startswith("/api/board/cards/"):
            card_id = path.split("/")[-1]
            if card_id not in amux_state.cards:
                return httpx.Response(404, json={"error": f"Card {card_id} not found"})
            if method == "POST":
                payload = json.loads(request.content.decode("utf-8"))
                card = amux_state.cards[card_id]
                if "lane" in payload:
                    card["lane"] = payload["lane"]
                if "notes" in payload:
                    card["notes"] = payload["notes"]
                return httpx.Response(200, json=card)

        elif path == "/api/sessions":
            if method == "POST":
                payload = json.loads(request.content.decode("utf-8"))
                name = payload.get("name", f"worker-{len(amux_state.sessions) + 1}")
                sess_entry = {
                    "name": name,
                    "directory": payload.get("directory", "."),
                    "provider": payload.get("provider", "omp"),
                    "status": "spawned",
                }
                amux_state.sessions[name] = sess_entry
                return httpx.Response(201, json=sess_entry)

        elif path == "/api/metrics":
            return httpx.Response(
                200,
                json={
                    "active_sessions": len(amux_state.sessions),
                    "total_messages": len(amux_state.messages),
                    "total_cards": len(amux_state.cards),
                },
            )

        return httpx.Response(404, json={"error": f"Route not found: {path}"})

    return httpx.MockTransport(handler)


@pytest.fixture
def mock_amux_client(mock_amux_transport: httpx.MockTransport) -> AmuxClient:
    """AmuxClient configured with mock transport."""
    client = AmuxClient(base_url="https://mock-amux/api", verify=False)
    client.client = httpx.Client(
        base_url="https://mock-amux/api",
        transport=mock_amux_transport,
    )
    return client


@pytest.fixture
def mock_hindsight_transport() -> httpx.MockTransport:
    """Mock HTTP transport for Hindsight vector memory server."""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path.rstrip("/")
        method = request.method

        if path.endswith("/reflect") and method == "POST":
            payload = json.loads(request.content.decode("utf-8"))
            query = payload.get("query", "")
            return httpx.Response(
                200,
                json={
                    "reflection": f"Reflected insight for: {query}",
                    "confidence": 0.95,
                    "grounding_models": ["user-profile", "project-conventions"],
                },
            )

        elif path.endswith("/recall") and method == "GET":
            query = request.url.params.get("q", "")
            return httpx.Response(
                200,
                json={
                    "query": query,
                    "facts": [
                        {
                            "id": "fact-1",
                            "content": f"Relevant memory fact for {query}",
                            "score": 0.89,
                        },
                    ],
                },
            )

        elif path.endswith("/retain") and method == "POST":
            payload = json.loads(request.content.decode("utf-8"))
            items = payload.get("items", [])
            return httpx.Response(200, json={"status": "retained", "count": len(items)})

        elif path.endswith("/mental-models") and method == "GET":
            return httpx.Response(
                200,
                json={
                    "models": [
                        {"id": "user-profile", "name": "User Profile"},
                        {"id": "project-conventions", "name": "Project Conventions"},
                        {"id": "lifeos-anti-criteria", "name": "Anti-Criteria"},
                    ]
                },
            )

        elif path.endswith("/consolidate") and method == "POST":
            return httpx.Response(200, json={"status": "consolidated", "updated_models": 3})

        return httpx.Response(404, json={"error": f"Route not found: {path}"})

    return httpx.MockTransport(handler)


@pytest.fixture
def mock_hindsight_client(mock_hindsight_transport: httpx.MockTransport) -> HindsightClient:
    """HindsightClient configured with mock transport."""
    client = HindsightClient(base_url="http://mock-hindsight:8888")
    client.client = httpx.Client(
        base_url="http://mock-hindsight:8888",
        transport=mock_hindsight_transport,
    )
    return client
