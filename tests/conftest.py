"""conftest.py - Pytest fixtures and mock HTTP servers for Next-Gen MyPAI tests."""

from __future__ import annotations

import json
from typing import Any, Dict, List

import httpx
import pytest

from mypai_runtime.amux import AmuxClient
from mypai_runtime.hindsight import HindsightClient


class MockAmuxState:
    """In-memory simulated state for amux-server control plane."""

    def __init__(self) -> None:
        self.messages: List[Dict[str, Any]] = []
        self.cards: Dict[str, Dict[str, Any]] = {}
        self.sessions: Dict[str, Dict[str, Any]] = {
            "mypai-main": {"name": "mypai-main", "profile": "mypai", "status": "active"},
            "mypai-channel": {"name": "mypai-channel", "profile": "mypai", "status": "active"},
            "mypai-cron": {"name": "mypai-cron", "profile": "mypai", "status": "active"},
        }
        self.schedules: Dict[str, Dict[str, Any]] = {}
        self.next_card_id = 1
        self.next_schedule_id = 1


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

        # ---------------------------------------------------------------------
        # Messages API
        # ---------------------------------------------------------------------
        if path == "/api/messages":
            if method == "POST":
                payload = json.loads(request.content.decode("utf-8"))
                target = payload.get("target", {}).get("worker_name", "")
                msg_entry = {
                    "id": f"msg-{len(amux_state.messages) + 1}",
                    "target_worker": target,
                    "body": payload.get("body", ""),
                    "correlation_id": payload.get("correlation_id"),
                    "reply_to": payload.get("reply_to"),
                    "metadata": payload.get("metadata", {}),
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

        elif path.startswith("/api/messages/"):
            sub = path.split("/")
            if len(sub) == 4:
                msg_id = sub[3]
                found = next((m for m in amux_state.messages if m["id"] == msg_id), None)
                if method == "GET":
                    if found:
                        return httpx.Response(200, json=found)
                    return httpx.Response(404, json={"error": f"Message {msg_id} not found"})
                elif method == "DELETE":
                    if found:
                        amux_state.messages.remove(found)
                        return httpx.Response(200, json={"status": "deleted", "id": msg_id})
                    return httpx.Response(404, json={"error": f"Message {msg_id} not found"})
            elif len(sub) == 5 and sub[4] == "read":
                msg_id = sub[3]
                found = next((m for m in amux_state.messages if m["id"] == msg_id), None)
                if found:
                    found["unread"] = False
                    return httpx.Response(200, json={"status": "marked_read", "id": msg_id})
                return httpx.Response(404, json={"error": f"Message {msg_id} not found"})

        # ---------------------------------------------------------------------
        # Board & Cards API
        # ---------------------------------------------------------------------
        elif path == "/api/board/lanes":
            return httpx.Response(200, json={"lanes": ["Todo", "Doing", "Done"]})

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
                    "assignee": payload.get("assignee"),
                    "priority": payload.get("priority"),
                }
                amux_state.cards[card_id] = card_entry
                return httpx.Response(201, json=card_entry)

            elif method == "GET":
                lane = url.params.get("lane")
                tag = url.params.get("tag")
                filtered = list(amux_state.cards.values())
                if lane:
                    filtered = [c for c in filtered if c.get("lane") == lane]
                if tag:
                    filtered = [c for c in filtered if tag in c.get("tags", [])]
                return httpx.Response(200, json={"cards": filtered})

        elif path.startswith("/api/board/cards/"):
            card_id = path.split("/")[-1]
            if card_id not in amux_state.cards:
                return httpx.Response(404, json={"error": f"Card {card_id} not found"})
            if method in ("POST", "PATCH"):
                payload = json.loads(request.content.decode("utf-8"))
                card = amux_state.cards[card_id]
                for key, val in payload.items():
                    card[key] = val
                return httpx.Response(200, json=card)
            elif method == "GET":
                return httpx.Response(200, json=amux_state.cards[card_id])
            elif method == "DELETE":
                deleted = amux_state.cards.pop(card_id)
                return httpx.Response(200, json={"status": "deleted", "card": deleted})

        # ---------------------------------------------------------------------
        # Sessions API
        # ---------------------------------------------------------------------
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
            elif method == "GET":
                return httpx.Response(200, json={"sessions": list(amux_state.sessions.values())})

        elif path.startswith("/api/sessions/"):
            sub = path.split("/")
            name = sub[3]
            if len(sub) == 4:
                if name in amux_state.sessions:
                    return httpx.Response(200, json=amux_state.sessions[name])
                return httpx.Response(404, json={"error": f"Session {name} not found"})
            elif len(sub) == 5 and sub[4] == "kill":
                if name in amux_state.sessions:
                    amux_state.sessions[name]["status"] = "terminated"
                    return httpx.Response(200, json={"status": "terminated", "name": name})
                return httpx.Response(404, json={"error": f"Session {name} not found"})
            elif len(sub) == 5 and sub[4] == "restart":
                if name in amux_state.sessions:
                    amux_state.sessions[name]["status"] = "restarted"
                    return httpx.Response(200, json={"status": "restarted", "name": name})
                return httpx.Response(404, json={"error": f"Session {name} not found"})

        # ---------------------------------------------------------------------
        # Schedules API
        # ---------------------------------------------------------------------
        elif path == "/api/schedules":
            if method == "POST":
                payload = json.loads(request.content.decode("utf-8"))
                sched_id = f"sched-{amux_state.next_schedule_id}"
                amux_state.next_schedule_id += 1
                sched_entry = {
                    "id": sched_id,
                    "title": payload.get("title", ""),
                    "session": payload.get("session", "mypai-cron"),
                    "schedule_expr": payload.get("schedule_expr", "0 * * * *"),
                    "command": payload.get("command", ""),
                    "enabled": payload.get("enabled", True),
                }
                amux_state.schedules[sched_id] = sched_entry
                return httpx.Response(201, json=sched_entry)
            elif method == "GET":
                return httpx.Response(200, json={"schedules": list(amux_state.schedules.values())})

        elif path.startswith("/api/schedules/"):
            sub = path.split("/")
            sched_id = sub[3]
            if len(sub) == 4:
                if sched_id not in amux_state.schedules:
                    return httpx.Response(404, json={"error": f"Schedule {sched_id} not found"})
                if method == "GET":
                    return httpx.Response(200, json=amux_state.schedules[sched_id])
                elif method in ("POST", "PATCH"):
                    payload = json.loads(request.content.decode("utf-8"))
                    sched = amux_state.schedules[sched_id]
                    for k, v in payload.items():
                        sched[k] = v
                    return httpx.Response(200, json=sched)
                elif method == "DELETE":
                    deleted = amux_state.schedules.pop(sched_id)
                    return httpx.Response(200, json={"status": "deleted", "schedule": deleted})
            elif len(sub) == 5 and sub[4] == "trigger":
                if sched_id in amux_state.schedules:
                    return httpx.Response(200, json={"status": "triggered", "id": sched_id})
                return httpx.Response(404, json={"error": f"Schedule {sched_id} not found"})

        # ---------------------------------------------------------------------
        # Metrics, Health & Status
        # ---------------------------------------------------------------------
        elif path == "/api/metrics":
            return httpx.Response(
                200,
                json={
                    "active_sessions": len(amux_state.sessions),
                    "total_messages": len(amux_state.messages),
                    "total_cards": len(amux_state.cards),
                },
            )

        elif path == "/api/health":
            return httpx.Response(200, json={"status": "healthy", "service": "amux-server"})

        elif path == "/api/status":
            return httpx.Response(
                200,
                json={
                    "status": "online",
                    "uptime_seconds": 12345,
                    "sessions_count": len(amux_state.sessions),
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
