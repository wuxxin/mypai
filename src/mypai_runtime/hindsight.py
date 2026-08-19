"""hindsight.py - Client for Hindsight vector memory and mental model reflection.

Usage Guidelines:
- Session Default Bank: For the active session's configured default bank, use OMP
  in-process loopback tools (`tool.reflect()`, `tool.recall()`, `tool.retain()`).
- Cross-Bank / Target Bank: When querying or updating a bank other than the session's
  default bank (e.g. accessing 'mypai' from a task worker or 'project-bank' from main),
  use this `HindsightClient` REST client.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, cast

import httpx


class HindsightClient:
    """Client for Hindsight memory recall, retention, reflection, and consolidation.

    Use for cross-bank queries or non-default memory banks.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 15.0,
    ) -> None:
        self.base_url = (
            base_url or os.environ.get("HINDSIGHT_API_URL", "http://localhost:8888")
        ).rstrip("/")
        self.client = httpx.Client(base_url=self.base_url, timeout=timeout)

    def reflect(
        self,
        query: str,
        context: Optional[str] = None,
        bank_id: str = "mypai",
    ) -> Dict[str, Any]:
        """Synthesize answers and context grounding from active mental models."""
        payload: Dict[str, Any] = {"query": query}
        if context:
            payload["context"] = context
        resp = self.client.post(f"/v1/banks/{bank_id}/reflect", json=payload)
        resp.raise_for_status()
        return cast(Dict[str, Any], resp.json())

    def recall(
        self,
        query: str,
        top_k: int = 5,
        bank_id: str = "mypai",
    ) -> Dict[str, Any]:
        """Perform semantic and vector search over memory facts."""
        params: Dict[str, str | int] = {"q": query, "top_k": top_k}
        resp = self.client.get(f"/v1/banks/{bank_id}/recall", params=params)
        resp.raise_for_status()
        return cast(Dict[str, Any], resp.json())

    def retain(
        self,
        items: List[Dict[str, Any]],
        bank_id: str = "mypai",
    ) -> Dict[str, Any]:
        """Persist durable facts, learnings, and decisions into Hindsight."""
        resp = self.client.post(f"/v1/banks/{bank_id}/retain", json={"items": items})
        resp.raise_for_status()
        return cast(Dict[str, Any], resp.json())

    def mental_models(self, bank_id: str = "mypai") -> List[Dict[str, Any]]:
        """List active mental models on the specified bank."""
        resp = self.client.get(f"/v1/banks/{bank_id}/mental-models")
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            return cast(List[Dict[str, Any]], data)
        models = data.get("models", [])
        return cast(List[Dict[str, Any]], models)

    def consolidate(self, bank_id: str = "mypai") -> Dict[str, Any]:
        """Trigger memory maintenance and mental model consolidation."""
        resp = self.client.post(f"/v1/banks/{bank_id}/consolidate")
        resp.raise_for_status()
        return cast(Dict[str, Any], resp.json())


# Pre-instantiated singleton instance
hindsight = HindsightClient()
