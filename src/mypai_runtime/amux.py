"""amux.py - Comprehensive REST API client for the amux control plane and message bus."""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional, cast

import httpx


class AmuxClient:
    """Complete REST API client for amux-server control plane, sessions, messages, Kanban board, and schedules."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        verify: bool = False,
        timeout: float = 30.0,
    ) -> None:
        self.base_url = (
            base_url or os.environ.get("AMUX_API_URL", "https://localhost:28824/api")
        ).rstrip("/")
        self.client = httpx.Client(
            base_url=self.base_url,
            verify=verify,
            timeout=timeout,
        )

    # -------------------------------------------------------------------------
    # Core HTTP primitives
    # -------------------------------------------------------------------------

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Execute a GET request against the amux REST API."""
        resp = self.client.get(path.lstrip("/"), params=params)
        resp.raise_for_status()
        return resp.json()

    def post(self, path: str, data: Optional[Dict[str, Any]] = None, **kwargs: Any) -> Any:
        """Execute a POST request against the amux REST API."""
        payload = data if data is not None else kwargs
        resp = self.client.post(path.lstrip("/"), json=payload)
        resp.raise_for_status()
        return resp.json()

    def patch(self, path: str, data: Optional[Dict[str, Any]] = None, **kwargs: Any) -> Any:
        """Execute a PATCH request against the amux REST API."""
        payload = data if data is not None else kwargs
        resp = self.client.patch(path.lstrip("/"), json=payload)
        resp.raise_for_status()
        return resp.json()

    def delete(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Execute a DELETE request against the amux REST API."""
        resp = self.client.delete(path.lstrip("/"), params=params)
        resp.raise_for_status()
        return resp.json()

    # -------------------------------------------------------------------------
    # Messages API (/api/messages)
    # -------------------------------------------------------------------------

    def list_messages(
        self,
        worker: Optional[str] = None,
        unread: Optional[bool] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> Dict[str, Any]:
        """List messages with optional filters."""
        params: Dict[str, Any] = {}
        if worker is not None:
            params["worker"] = worker
        if unread is not None:
            params["unread"] = "true" if unread else "false"
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        res = self.get("messages", params=params)
        return cast(Dict[str, Any], res)

    def send_message(
        self,
        target_worker: str,
        body: str,
        correlation_id: Optional[str] = None,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Send a structured turn message to another amux agent session."""
        payload: Dict[str, Any] = {
            "target": {"worker_name": target_worker},
            "body": body,
        }
        if correlation_id:
            payload["correlation_id"] = correlation_id
        if reply_to:
            payload["reply_to"] = reply_to
        if metadata:
            payload["metadata"] = metadata
        res = self.post("messages", data=payload)
        return cast(Dict[str, Any], res)

    def get_message(self, message_id: str) -> Dict[str, Any]:
        """Retrieve details of a specific message by ID."""
        res = self.get(f"messages/{message_id}")
        return cast(Dict[str, Any], res)

    def mark_message_read(self, message_id: str) -> Dict[str, Any]:
        """Mark a message as read."""
        res = self.post(f"messages/{message_id}/read")
        return cast(Dict[str, Any], res)

    def delete_message(self, message_id: str) -> Dict[str, Any]:
        """Delete a message from the message bus."""
        res = self.delete(f"messages/{message_id}")
        return cast(Dict[str, Any], res)

    def wait_for_response(
        self,
        target_worker: str,
        correlation_id: str,
        timeout: float = 30.0,
        poll_interval: float = 0.5,
        mark_read: bool = True,
    ) -> Dict[str, Any]:
        """
        Poll the amux message bus for a response with matching correlation_id.
        Silently returns the message payload on arrival.
        Raises TimeoutError if timeout expires.
        """
        deadline = time.time() + timeout
        while time.time() < deadline:
            inbox = self.list_messages(worker=target_worker, unread=True)
            for msg in inbox.get("messages", []):
                if isinstance(msg, dict) and msg.get("correlation_id") == correlation_id:
                    if mark_read and "id" in msg:
                        try:
                            self.mark_message_read(msg["id"])
                        except Exception:
                            pass
                    return cast(Dict[str, Any], msg)
            time.sleep(poll_interval)
        raise TimeoutError(
            f"Timeout waiting for response from '{target_worker}' (correlation: {correlation_id})"
        )

    # -------------------------------------------------------------------------
    # Sessions API (/api/sessions)
    # -------------------------------------------------------------------------

    def list_sessions(self) -> List[Dict[str, Any]]:
        """List all active or registered amux sessions."""
        res = self.get("sessions")
        if isinstance(res, list):
            return cast(List[Dict[str, Any]], res)
        return cast(List[Dict[str, Any]], res.get("sessions", []))

    def create_session(
        self,
        name: str,
        directory: str = ".",
        provider: str = "omp",
        profile: Optional[str] = None,
        command: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Create or spawn a new agent session under amux management."""
        payload: Dict[str, Any] = {
            "name": name,
            "directory": directory,
            "provider": provider,
        }
        if profile:
            payload["profile"] = profile
        if command:
            payload["command"] = command
        if env:
            payload["env"] = env
        res = self.post("sessions", data=payload)
        return cast(Dict[str, Any], res)

    def get_session(self, name: str) -> Dict[str, Any]:
        """Retrieve state and metadata for a specific session."""
        res = self.get(f"sessions/{name}")
        return cast(Dict[str, Any], res)

    def kill_session(self, name: str) -> Dict[str, Any]:
        """Terminate a managed session."""
        res = self.post(f"sessions/{name}/kill")
        return cast(Dict[str, Any], res)

    def restart_session(self, name: str) -> Dict[str, Any]:
        """Restart a managed session."""
        res = self.post(f"sessions/{name}/restart")
        return cast(Dict[str, Any], res)

    def spawn_task_worker(
        self,
        name: str,
        directory: str,
        prompt: str,
        provider: str = "omp",
        profile: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Spawn an isolated task worker session and deliver its initial prompt."""
        session = self.create_session(
            name=name,
            directory=directory,
            provider=provider,
            profile=profile,
        )
        self.send_message(target_worker=name, body=prompt)
        return session

    # -------------------------------------------------------------------------
    # Kanban Board & Cards API (/api/board)
    # -------------------------------------------------------------------------

    def list_cards(
        self,
        lane: Optional[str] = None,
        tag: Optional[str] = None,
        assignee: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List Kanban cards with optional filtering."""
        params: Dict[str, Any] = {}
        if lane:
            params["lane"] = lane
        if tag:
            params["tag"] = tag
        if assignee:
            params["assignee"] = assignee
        res = self.get("board/cards", params=params)
        if isinstance(res, list):
            return cast(List[Dict[str, Any]], res)
        return cast(List[Dict[str, Any]], res.get("cards", []))

    def create_card(
        self,
        title: str,
        description: str = "",
        lane: str = "Todo",
        tags: Optional[List[str]] = None,
        assignee: Optional[str] = None,
        priority: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new task card on the amux Kanban board."""
        payload: Dict[str, Any] = {
            "title": title,
            "description": description,
            "lane": lane,
            "tags": tags or [],
        }
        if assignee:
            payload["assignee"] = assignee
        if priority:
            payload["priority"] = priority
        if metadata:
            payload["metadata"] = metadata
        res = self.post("board/cards", data=payload)
        return cast(Dict[str, Any], res)

    def get_card(self, card_id: str) -> Dict[str, Any]:
        """Retrieve details of a specific Kanban card."""
        res = self.get(f"board/cards/{card_id}")
        return cast(Dict[str, Any], res)

    def update_card(
        self,
        card_id: str,
        lane: Optional[str] = None,
        notes: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        assignee: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update an existing card on the amux Kanban board."""
        payload: Dict[str, Any] = {}
        if lane is not None:
            payload["lane"] = lane
        if notes is not None:
            payload["notes"] = notes
        if title is not None:
            payload["title"] = title
        if description is not None:
            payload["description"] = description
        if tags is not None:
            payload["tags"] = tags
        if assignee is not None:
            payload["assignee"] = assignee
        if status is not None:
            payload["status"] = status
        res = self.post(f"board/cards/{card_id}", data=payload)
        return cast(Dict[str, Any], res)

    def delete_card(self, card_id: str) -> Dict[str, Any]:
        """Delete a card from the amux Kanban board."""
        res = self.delete(f"board/cards/{card_id}")
        return cast(Dict[str, Any], res)

    def list_lanes(self) -> List[str]:
        """List configured lanes on the amux Kanban board."""
        res = self.get("board/lanes")
        if isinstance(res, list):
            return cast(List[str], res)
        return cast(List[str], res.get("lanes", ["Todo", "Doing", "Done"]))

    # -------------------------------------------------------------------------
    # Schedules API (/api/schedules)
    # -------------------------------------------------------------------------

    def list_schedules(self) -> List[Dict[str, Any]]:
        """List all scheduled cron automation jobs."""
        res = self.get("schedules")
        if isinstance(res, list):
            return cast(List[Dict[str, Any]], res)
        return cast(List[Dict[str, Any]], res.get("schedules", []))

    def create_schedule(
        self,
        title: str,
        session: str,
        schedule_expr: str,
        command: str,
        enabled: bool = True,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Register a new durable scheduled cron job in amux-server."""
        payload: Dict[str, Any] = {
            "title": title,
            "session": session,
            "schedule_expr": schedule_expr,
            "command": command,
            "enabled": enabled,
        }
        if metadata:
            payload["metadata"] = metadata
        res = self.post("schedules", data=payload)
        return cast(Dict[str, Any], res)

    def get_schedule(self, schedule_id: str) -> Dict[str, Any]:
        """Retrieve details of a specific schedule."""
        res = self.get(f"schedules/{schedule_id}")
        return cast(Dict[str, Any], res)

    def update_schedule(
        self,
        schedule_id: str,
        title: Optional[str] = None,
        schedule_expr: Optional[str] = None,
        command: Optional[str] = None,
        enabled: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Update a scheduled job."""
        payload: Dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if schedule_expr is not None:
            payload["schedule_expr"] = schedule_expr
        if command is not None:
            payload["command"] = command
        if enabled is not None:
            payload["enabled"] = enabled
        res = self.post(f"schedules/{schedule_id}", data=payload)
        return cast(Dict[str, Any], res)

    def trigger_schedule(self, schedule_id: str) -> Dict[str, Any]:
        """Manually trigger an immediate execution of a scheduled job."""
        res = self.post(f"schedules/{schedule_id}/trigger")
        return cast(Dict[str, Any], res)

    def delete_schedule(self, schedule_id: str) -> Dict[str, Any]:
        """Delete a schedule from amux-server."""
        res = self.delete(f"schedules/{schedule_id}")
        return cast(Dict[str, Any], res)

    # -------------------------------------------------------------------------
    # System Health, Status & Metrics API (/api/metrics, /api/health, /api/status)
    # -------------------------------------------------------------------------

    def get_metrics(self) -> Dict[str, Any]:
        """Retrieve telemetry metrics from the amux control plane."""
        res = self.get("metrics")
        return cast(Dict[str, Any], res)

    def get_health(self) -> Dict[str, Any]:
        """Retrieve system health status from amux-server."""
        res = self.get("health")
        return cast(Dict[str, Any], res)

    def get_status(self) -> Dict[str, Any]:
        """Retrieve daemon status, uptime, and active sessions overview."""
        res = self.get("status")
        return cast(Dict[str, Any], res)


# Pre-instantiated singleton instance
amux = AmuxClient()
