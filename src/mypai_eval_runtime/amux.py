"""amux.py - High-performance inter-agent communication client for all OMP sessions using httpx."""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional, cast

import httpx


class AmuxClient:
    """Client for the amux control plane, inter-worker message bus, and Kanban board."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        verify: bool = False,
        timeout: float = 30.0,
    ) -> None:
        self.base_url = (
            base_url or os.environ.get("AMUX_API_URL", "https://localhost:8824/api")
        ).rstrip("/")
        self.client = httpx.Client(
            base_url=self.base_url,
            verify=verify,
            timeout=timeout,
        )

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Perform a GET request against the amux API."""
        resp = self.client.get(path.lstrip("/"), params=params)
        resp.raise_for_status()
        return resp.json()

    def post(self, path: str, data: Optional[Dict[str, Any]] = None, **kwargs: Any) -> Any:
        """Perform a POST request against the amux API."""
        payload = data if data is not None else kwargs
        resp = self.client.post(path.lstrip("/"), json=payload)
        resp.raise_for_status()
        return resp.json()

    def send_message(
        self,
        target_worker: str,
        body: str,
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a structured turn message to another amux agent session."""
        payload: Dict[str, Any] = {
            "target": {"worker_name": target_worker},
            "body": body,
        }
        if correlation_id:
            payload["correlation_id"] = correlation_id
        res = self.post("messages", data=payload)
        return cast(Dict[str, Any], res)

    def wait_for_response(
        self,
        target_worker: str,
        correlation_id: str,
        timeout: float = 30.0,
        poll_interval: float = 0.5,
    ) -> Dict[str, Any]:
        """
        Poll the amux message bus for a response with matching correlation_id.
        Silently returns the message payload on arrival.
        Raises TimeoutError if timeout expires.
        """
        deadline = time.time() + timeout
        while time.time() < deadline:
            inbox = self.get("messages", params={"worker": target_worker, "unread": "true"})
            if isinstance(inbox, dict):
                for msg in inbox.get("messages", []):
                    if isinstance(msg, dict) and msg.get("correlation_id") == correlation_id:
                        return cast(Dict[str, Any], msg)
            time.sleep(poll_interval)
        raise TimeoutError(
            f"Timeout waiting for response from '{target_worker}' (correlation: {correlation_id})"
        )

    def create_card(
        self,
        title: str,
        description: str,
        lane: str = "Todo",
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create a new task card on the amux Kanban board."""
        res = self.post(
            "board/cards",
            data={
                "title": title,
                "description": description,
                "lane": lane,
                "tags": tags or [],
            },
        )
        return cast(Dict[str, Any], res)

    def update_card(
        self,
        card_id: str,
        lane: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update an existing task card on the amux Kanban board."""
        payload: Dict[str, Any] = {}
        if lane:
            payload["lane"] = lane
        if notes:
            payload["notes"] = notes
        res = self.post(f"board/cards/{card_id}", data=payload)
        return cast(Dict[str, Any], res)

    def spawn_task_worker(
        self,
        name: str,
        directory: str,
        prompt: str,
        provider: str = "omp",
    ) -> Dict[str, Any]:
        """Spawn an isolated normal-profile OMP worker session and assign a task."""
        session = self.post(
            "sessions",
            data={"name": name, "directory": directory, "provider": provider},
        )
        self.send_message(target_worker=name, body=prompt)
        return cast(Dict[str, Any], session)

    def get_metrics(self) -> Dict[str, Any]:
        """Retrieve telemetry metrics from the amux control plane."""
        res = self.get("metrics")
        return cast(Dict[str, Any], res)


# Pre-instantiated singleton instance
amux = AmuxClient()
