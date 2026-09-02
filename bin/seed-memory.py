#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import urllib.request

import yaml

HINDSIGHT_BASE_URL = "http://localhost:8888/v1/default/banks"
CONFIG_PATH = "skills/self-guide/references/memory-architecture.md"

FILES_TO_MIGRATE = [
    {"path": "memories/SOUL.md", "type": "soul", "tags": ["user-profile", "agent-persona"]},
    {"path": "memories/USER.md", "type": "user", "tags": ["user-profile"]},
    {"path": "workspace/routine.md", "type": "routine", "tags": ["adhd-routines-health"]},
    {"path": "workspace/braindump.md", "type": "braindump", "tags": ["project-tasks-commitments"]},
    {
        "path": "workspace/hostmachine-facts.md",
        "type": "hostmachine",
        "tags": ["host-agent-config"],
    },
    {
        "path": "workspace/mood-tracker-log.md",
        "type": "mood-log",
        "tags": ["inner-work", "mood-log"],
    },
    {
        "path": "workspace/stichwort-sammlung.md",
        "type": "stichwortsammlung",
        "tags": ["worldview-philosophy-maxims"],
    },
]


def slugify(text):
    text = text.lower()
    text = text.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = re.sub(r"[^a-z0-9\-]", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def send_request(url, method="POST", payload=None):
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            err_data = json.loads(e.read().decode("utf-8"))
            return e.code, err_data
        except Exception:
            return e.code, {"error": str(e)}
    except Exception as e:
        return 500, {"error": str(e)}


def setup_bank_config(bank_name):
    print(f"[{bank_name}] Extracting configuration from {CONFIG_PATH}...")
    if not os.path.exists(CONFIG_PATH):
        print(f"Error: Configuration file not found at {CONFIG_PATH}")
        sys.exit(1)

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    match = re.search(r"```yaml\s*(.*?)\s*```", content, re.DOTALL)
    if not match:
        print("Error: Could not find YAML code block in memory-architecture.md")
        sys.exit(1)

    yaml_content = match.group(1)
    try:
        config = yaml.safe_load(yaml_content)
    except Exception as e:
        print(f"Error parsing YAML configuration: {e}")
        sys.exit(1)

    url = f"{HINDSIGHT_BASE_URL}/{bank_name}/import"
    print(f"[{bank_name}] Configuring bank via POST {url}...")
    status, res = send_request(url, method="POST", payload=config)
    if status in (200, 201):
        print(f"[{bank_name}] Successfully imported bank configuration.")
    else:
        print(f"[{bank_name}] Failed to import configuration (Status {status}): {res}")
        sys.exit(1)


def ingest_facts_batch(bank_name, items):
    if not items:
        return True
    url = f"{HINDSIGHT_BASE_URL}/{bank_name}/memories"
    payload = {"items": items}
    status, res = send_request(url, method="POST", payload=payload)
    if status in (200, 201) and res.get("success"):
        return True
    else:
        print(f"Error ingesting batch (Status {status}): {res}")
        return False


def parse_markdown_headers(content):
    """Splits markdown content into sections based on headers."""
    sections = []
    current_title = "Introduction"
    current_lines = []

    for line in content.split("\n"):
        if line.startswith("# ") or line.startswith("## ") or line.startswith("### "):
            if current_lines:
                sections.append((current_title, "\n".join(current_lines).strip()))
            current_title = line.lstrip("#").strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        sections.append((current_title, "\n".join(current_lines).strip()))

    return sections


def parse_soul_file(file_info):
    path = file_info["path"]
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    sections = parse_markdown_headers(content)
    items = []
    for title, text in sections:
        if len(text) < 10:
            continue
        context = f"Agent Persona: {title}"
        items.append({"content": text, "context": context, "tags": file_info["tags"]})
    return items


def parse_user_file(file_info):
    path = file_info["path"]
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    sections = parse_markdown_headers(content)
    items = []
    for title, text in sections:
        if len(text) < 10:
            continue
        context = f"User Profile: {title}"
        items.append({"content": text, "context": context, "tags": file_info["tags"]})
    return items


def parse_routine_file(file_info):
    path = file_info["path"]
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    sections = parse_markdown_headers(content)
    items = []
    for title, text in sections:
        if len(text) < 10:
            continue
        context = f"ADHD Routines: {title}"
        items.append({"content": text, "context": context, "tags": file_info["tags"]})
    return items


def parse_braindump_file(file_info):
    path = file_info["path"]
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    sections = parse_markdown_headers(content)
    items = []
    for title, text in sections:
        if len(text) < 10:
            continue
        context = f"Tasks / Braindump: {title}"
        items.append({"content": text, "context": context, "tags": file_info["tags"]})
    return items


def parse_hostmachine_file(file_info):
    path = file_info["path"]
    with open(path, "r", encoding="utf-8") as f:
        text = f.read().strip()

    context = "Host Machine Configuration"
    return [{"content": text, "context": context, "tags": file_info["tags"]}]


def parse_mood_log_file(file_info):
    path = file_info["path"]
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    headers = []
    items = []

    for line in lines:
        line = line.strip()
        if not line or not line.startswith("|"):
            continue

        parts = [p.strip() for p in line.split("|")[1:-1]]
        if not parts:
            continue

        if "Datum" in parts or "Date" in parts:
            headers = parts
            continue

        if parts[0].startswith(":---") or parts[0].startswith(":-"):
            continue

        if headers and len(parts) == len(headers):
            metrics = []
            for h, val in zip(headers[1:], parts[1:]):
                metrics.append(f"{h}: {val}")

            fact_content = f"Date: {parts[0]}. Mood metrics: {', '.join(metrics)}"
            context = "Mood Tracker Log Entry"
            items.append({"content": fact_content, "context": context, "tags": file_info["tags"]})
    return items


def parse_stichwortsammlung_file(file_info):
    path = file_info["path"]
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    current_section = "Sprüche"
    quotes = []
    current_quote = []
    items = []

    def collect_section_quotes(section):
        sec_tag = slugify(section)
        tags = file_info["tags"] + [sec_tag]
        context = f"Worldview: {section}"
        for q in quotes:
            items.append({"content": q, "context": context, "tags": tags})
        quotes.clear()

    for line_raw in lines:
        line = line_raw.strip()

        if line.startswith("# ") or line.startswith("## "):
            if current_quote:
                quotes.append("\n".join(current_quote).strip())
                current_quote = []
            collect_section_quotes(current_section)
            current_section = line.lstrip("#").strip()

        elif line.startswith("- ") or line.startswith("* "):
            if current_quote:
                quotes.append("\n".join(current_quote).strip())
            current_quote = [re.sub(r"^[\-\*]\s+", "", line_raw.rstrip())]

        elif current_quote and (line_raw.startswith("  ") or line_raw.startswith("\t") or not line):
            if line:
                current_quote.append(line_raw.strip())

        elif current_quote:
            current_quote.append(line_raw.strip())

    if current_quote:
        quotes.append("\n".join(current_quote).strip())
    collect_section_quotes(current_section)
    return items


def migrate_files(bank_name):
    print(f"[{bank_name}] Parsing and migrating memory profiles and workspace files...")
    all_items = []

    for item in FILES_TO_MIGRATE:
        path = item["path"]
        if not os.path.exists(path):
            print(f"  Skipping {path} (file not found).")
            continue

        ftype = item["type"]
        items = []
        if ftype == "soul":
            items = parse_soul_file(item)
        elif ftype == "user":
            items = parse_user_file(item)
        elif ftype == "routine":
            items = parse_routine_file(item)
        elif ftype == "braindump":
            items = parse_braindump_file(item)
        elif ftype == "hostmachine":
            items = parse_hostmachine_file(item)
        elif ftype == "mood-log":
            items = parse_mood_log_file(item)
        elif ftype == "stichwortsammlung":
            items = parse_stichwortsammlung_file(item)

        print(f"  Parsed {len(items)} facts from {path}")
        all_items.extend(items)

    print(f"Total facts parsed across all files: {len(all_items)}")

    # Ingest facts in batches of 100
    batch_size = 100
    success_count = 0

    for i in range(0, len(all_items), batch_size):
        batch = all_items[i : i + batch_size]
        print(f"  Ingesting batch {i // batch_size + 1} ({len(batch)} items)...")
        if ingest_facts_batch(bank_name, batch):
            success_count += len(batch)
        else:
            print(f"  Warning: Batch starting at index {i} failed to ingest.")

    print(f"Successfully migrated {success_count}/{len(all_items)} facts into bank '{bank_name}'.")


def run_reflect(bank_name, query):
    url = f"{HINDSIGHT_BASE_URL}/{bank_name}/reflect"
    print(f"[{bank_name}] Reflecting on query: '{query}'...")
    status, res = send_request(url, method="POST", payload={"query": query})
    if status == 200:
        print("\n=== REFLECTION RESULT ===")
        print(res.get("text", json.dumps(res, indent=2)))
        print("=========================\n")
    else:
        print(f"Failed to reflect (Status {status}): {res}")


def query_mental_models(bank_name):
    url = f"{HINDSIGHT_BASE_URL}/{bank_name}/mental-models"
    print(f"[{bank_name}] Fetching active mental models...")
    status, res = send_request(url, method="GET")
    if status == 200:
        print("\n=== MENTAL MODELS ===")
        models = res.get("mental-models", res.get("mental_models", []))
        if not models:
            bank = res.get("bank", {})
            models = bank.get("mental-models", bank.get("mental_models", []))

        if not models:
            print("No mental models returned or they are still compiling. Try again in a minute.")
            print("Raw Response:", json.dumps(res, indent=2))
        else:
            for m in models:
                mid = m.get("id") or m.get("mental_model_id")
                name = m.get("name", "Unknown")
                text = m.get("text") or m.get("content", "")
                print(f"\n[{mid}] {name}:")
                print("-" * len(name))
                print(text.strip())
        print("=====================\n")
    else:
        print(f"Failed to fetch mental models (Status {status}): {res}")


def main():
    parser = argparse.ArgumentParser(description="Hindsight Memory Migration Tool")
    parser.add_argument(
        "--bank", default="hermes-test", help="Target memory bank name (default: hermes-test)"
    )
    parser.add_argument(
        "--skip-config", action="store_true", help="Skip bank configuration import step"
    )
    parser.add_argument(
        "--skip-migrate", action="store_true", help="Skip file parsing and ingestion step"
    )
    parser.add_argument(
        "--reflect", metavar="QUERY", help="Run a reflection query against the memory bank"
    )
    parser.add_argument(
        "--query-models", action="store_true", help="Display all mental model outputs"
    )

    args = parser.parse_args()
    bank_name = args.bank

    if not args.skip_config and not args.reflect and not args.query_models:
        setup_bank_config(bank_name)

    if not args.skip_migrate and not args.reflect and not args.query_models:
        migrate_files(bank_name)

    if args.reflect:
        run_reflect(bank_name, args.reflect)

    if args.query_models:
        query_mental_models(bank_name)


if __name__ == "__main__":
    main()
