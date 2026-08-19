---
name: hindsight-bank-configuration
description: Inspecting, reconfiguring, and managing Hindsight memory banks, retain/reflect/observations missions, mental models, and consolidation triggers via the Hindsight REST API. Use when configuring memory bank missions, refreshing mental models, checking bank statistics, or provisioning bank JSON schemas.
---

# Hindsight Memory API & Bank Management Skill

Teaches the agent how to inspect, query, reconfigure, and manage Hindsight memory banks programmatically via the local Hindsight REST API served on `http://localhost:8888`.

## Hindsight REST API Reference (`http://localhost:8888`)

All REST endpoints operate under the default namespace `/v1/default/banks/{bank_id}`.

### 1. Bank Configuration & Missions

| Endpoint | Method | Description |
|---|---|---|
| `/v1/default/banks/{bank_id}/config` | `GET` | Retrieve current bank settings and active mission overrides. |
| `/v1/default/banks/{bank_id}/config` | `PATCH` | Update `retain_mission`, `observations_mission`, `reflect_mission`, or `enable_observations`. |
| `/v1/default/banks/{bank_id}/stats` | `GET` | Get document, fact, observation, and entity node counts. |

#### Provisioning and Exporting Banks via `membank-ctl`

You can idempotently provision or export bank configurations and mental models using the `membank-ctl` CLI tool:

```bash
# Update bank configs and mental models from JSON or YAML definitions:
./bin/membank-ctl update http://localhost:8888 ./omp/agent/memorybanks --yes --prune

# Export server bank configuration and mental models to YAML or JSON:
./bin/membank-ctl export http://localhost:8888 oh-my-pi --yaml --out oh-my-pi.yaml
```

#### Manual REST API Operations

To apply a bank configuration file via `curl`:

```bash
# 1. Update Retain, Observations, and Reflect missions:
curl -sS -X PATCH "http://localhost:8888/v1/default/banks/{bank_id}/config" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c '
import json, sys
data = json.load(open("sandbox-templates/opencode/hindsight-banks/{bank_id}.json"))
bank = data.get("bank", {})
print(json.dumps({
    "retain_mission": bank.get("retain_mission"),
    "observations_mission": bank.get("observations_mission"),
    "reflect_mission": bank.get("reflect_mission"),
    "enable_observations": bank.get("enable_observations", True)
}))
')"
```

---

### 2. Mental Models Management

| Endpoint | Method | Description |
|---|---|---|
| `/v1/default/banks/{bank_id}/mental-models` | `GET` | List all mental models for a bank. |
| `/v1/default/banks/{bank_id}/mental-models` | `POST` | Create or update a mental model (`id`, `name`, `source_query`, `max_tokens`). |
| `/v1/default/banks/{bank_id}/mental-models/{id}/refresh` | `POST` | Force an immediate re-synthesis pass for a specific mental model. |

#### Registering Mental Models from Bank JSON

```bash
# Register mental models from JSON template:
python3 -c '
import json, urllib.request
bank_id = "opencode-oracle"
data = json.load(open(f"sandbox-templates/opencode/hindsight-banks/{bank_id}.json"))
for mm in data.get("mental_models", []):
    req = urllib.request.Request(
        f"http://localhost:8888/v1/default/banks/{bank_id}/mental-models",
        data=json.dumps(mm).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Registered mental model {mm[\"id\"]}: {resp.status}")
    except Exception as e:
        print(f"Error registering {mm[\"id\"]}: {e}")
'
```

---

### 3. Memory Operations & Consolidation

| Endpoint | Method | Description |
|---|---|---|
| `/v1/default/banks/{bank_id}/consolidate` | `POST` | Trigger background memory consolidation for raw chunks. |
| `/v1/default/banks/{bank_id}/operations?status=pending` | `GET` | Check count of pending background tasks. |
| `/v1/default/banks/{bank_id}/reflect` | `POST` | Execute a `reflect` synthesis query using the bank's `reflect_mission`. |
| `/v1/default/banks/{bank_id}/recall` | `POST` | Execute a semantic vector + FTS search recall query. |

#### Triggering Consolidation & Refresh

```bash
# Force background consolidation for an agent bank:
curl -sS -X POST "http://localhost:8888/v1/default/banks/opencode-oracle/consolidate"
```

---

## Guidelines for Agents

1. **Self-Inspection**: Query `GET /v1/default/banks/{bank_id}/config` to inspect active missions before adjusting memory behavior.
2. **Dynamic Mental Model Addition**: When a new recurring topic or project domain emerges, use `POST /v1/default/banks/{bank_id}/mental-models` to add a dedicated mental model.
3. **Reflect Customization**: Ensure `reflect_mission` is tuned for the agent role (`oracle` vs `fixer` vs `designer`).
