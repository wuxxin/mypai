#!/usr/bin/env python3
"""claude-shim - Claude CLI compatibility shim backed by Oh My Pi (omp)."""

from __future__ import annotations

import base64
import binascii
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from types import FrameType
from typing import Any

VERSION = "1.0.0"
VERSION_BANNER = f"{VERSION} (claude-shim omp backend)"
DEFAULT_MODEL = "llama.cpp/qwen3.8-flash-next"
DEFAULT_EFFORT = "high"
MINIMAL_SYSTEM_PROMPT = "Follow the user prompt."
MAX_INLINE_PROMPT_BYTES = 65_536

EFFORT_MAP: dict[str, str] = {
    "off": "off",
    "none": "off",
    "0": "off",
    "minimal": "minimal",
    "min": "minimal",
    "low": "low",
    "medium": "medium",
    "med": "medium",
    "high": "high",
    "xhigh": "xhigh",
    "max": "max",
    "highest": "max",
    "auto": "auto",
}

TOOL_NAME_MAP: dict[str, str] = {
    "read": "read",
    "bash": "bash",
    "edit": "edit",
    "multiedit": "edit",
    "write": "write",
    "glob": "glob",
    "grep": "grep",
    "ls": "read",
    "webfetch": "read",
    "websearch": "web_search",
    "task": "task",
    "agent": "task",
    "todowrite": "todo",
    "todo": "todo",
    "notebookedit": "notebook",
    "askuserquestion": "ask",
}

IMAGE_MEDIA_EXT: dict[str, str] = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

STOP_REASON_MAP: dict[str, str] = {
    "stop": "end_turn",
    "length": "max_tokens",
    "toolUse": "tool_use",
    "error": "error",
    "aborted": "aborted",
}

VALUE_FLAGS: frozenset[str] = frozenset(
    {
        "-m",
        "--model",
        "--effort",
        "--output-format",
        "--input-format",
        "--system-prompt",
        "--system-prompt-file",
        "--append-system-prompt",
        "--append-system-prompt-file",
        "--tools",
        "--allowedTools",
        "--allowed-tools",
        "--disallowedTools",
        "--disallowed-tools",
        "--setting-sources",
        "--session-id",
        "--session",
        "-s",
        "--resume",
        "-r",
        "--cwd",
        "-C",
        "--add-dir",
        "--project",
        "-d",
        "--config-dir",
        "--permission-mode",
        "--timeout",
        "--max-tokens",
        "--max-turns",
        "--temperature",
        "--profile",
        "--mcp-config",
        "--api-key",
        "--agent",
        "--agent-type",
        "--settings",
        "--fallback-model",
        "--json-schema",
        "--system-prompt-snapshot",
        "--max-budget-usd",
    }
)

BOOL_FLAGS: frozenset[str] = frozenset(
    {
        "-p",
        "--print",
        "--exclude-dynamic-system-prompt-sections",
        "--dangerously-skip-permissions",
        "--allow-dangerously-skip-permissions",
        "--continue",
        "-c",
        "--fork-session",
        "--no-session",
        "--no-session-persistence",
        "--verbose",
        "--debug",
        "--strict",
        "--strict-mcp-config",
        "--safe-mode",
        "--restricted",
        "--replay-user-messages",
        "--include-partial-messages",
    }
)

VALID_OUTPUT_FORMATS: frozenset[str] = frozenset({"json", "text", "stream-json"})
VALID_INPUT_FORMATS: frozenset[str] = frozenset({"text", "stream-json"})


class ShimError(Exception):
    """Operational error surfaced as a Claude error envelope or stderr."""


@dataclass
class CliConfig:
    cli_model: str = ""
    cli_effort: str = ""
    output_format: str = "json"
    input_format: str = "text"
    system_prompt: str | None = None
    system_prompt_file: str | None = None
    append_system_prompt: str | None = None
    append_system_prompt_file: str | None = None
    tools_flag: str | None = None
    allowed_tools: list[str] = field(default_factory=list)
    disallowed_tools: list[str] = field(default_factory=list)
    positional_args: list[str] = field(default_factory=list)
    show_help: bool = False
    show_version: bool = False


@dataclass
class TokenUsage:
    input_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class ParsedOmpResult:
    assistant_text: str
    model_name: str
    stop_reason: str
    found_assistant: bool
    error_message: str
    usage: TokenUsage


@dataclass
class OmpRunResult:
    returncode: int
    stdout: str
    stderr: str


def usage_text() -> str:
    return """claude-shim - Claude CLI compatibility shim for LifeOS inference via omp

Usage:
  claude [options] [prompt]
  echo "prompt" | claude [options]

Options:
  -p, --print                               Non-interactive print mode
  --model <model>                           Requested model (overridden by $LIFEOS_TOOLS_MODEL_NAME)
  --effort <effort>                         Thinking effort (overridden by $LIFEOS_TOOLS_MODEL_EFFORT)
  --output-format <json|text|stream-json>   Output format (default: json)
  --input-format <text|stream-json>         Input format (default: text)
  --system-prompt <prompt>                  Inline system prompt
  --system-prompt-file <path>               Path to system prompt file
  --append-system-prompt <prompt>           Append inline text to system prompt
  --append-system-prompt-file <path>        Append file contents to system prompt
  --tools <tools>                           Tool allowlist (empty or "none" disables tools)
  --allowedTools <tools>                    Allowed tools list
  --disallowedTools <tools>                 Disallowed tools list
  -h, --help                                Show this help message and exit
  -v, --version                             Show version and exit"""


def _apply_value_flag(config: CliConfig, flag: str, value: str) -> None:
    if flag in ("-m", "--model"):
        config.cli_model = value
    elif flag == "--effort":
        config.cli_effort = value
    elif flag == "--output-format":
        config.output_format = value or "json"
    elif flag == "--input-format":
        config.input_format = value or "text"
    elif flag == "--system-prompt":
        config.system_prompt = value
        config.system_prompt_file = None
    elif flag == "--system-prompt-file":
        config.system_prompt_file = value
        config.system_prompt = None
    elif flag == "--append-system-prompt":
        config.append_system_prompt = value
        config.append_system_prompt_file = None
    elif flag == "--append-system-prompt-file":
        config.append_system_prompt_file = value
        config.append_system_prompt = None
    elif flag == "--tools":
        config.tools_flag = value
    elif flag in ("--allowedTools", "--allowed-tools"):
        config.allowed_tools.append(value)
    elif flag in ("--disallowedTools", "--disallowed-tools"):
        config.disallowed_tools.append(value)


def parse_args(argv: list[str], *, stdin_is_tty: bool = True) -> CliConfig:
    config = CliConfig()
    i = 0
    total = len(argv)

    while i < total:
        arg = argv[i]
        if arg in ("-h", "--help"):
            config.show_help = True
            i += 1
        elif arg in ("-v", "--version"):
            config.show_version = True
            i += 1
        elif arg == "--":
            config.positional_args.extend(argv[i + 1 :])
            break
        elif arg.startswith("--") and "=" in arg:
            flag, value = arg.split("=", 1)
            if flag in VALUE_FLAGS:
                _apply_value_flag(config, flag, value)
            i += 1
        elif arg in BOOL_FLAGS:
            i += 1
        elif arg in VALUE_FLAGS:
            if i + 1 < total:
                _apply_value_flag(config, arg, argv[i + 1])
                i += 2
            else:
                _apply_value_flag(config, arg, "")
                i += 1
        elif arg.startswith("-"):
            remaining = total - i
            if remaining >= 2 and not argv[i + 1].startswith("-"):
                if remaining > 2 or not stdin_is_tty:
                    i += 2
                else:
                    i += 1
            else:
                i += 1
        else:
            config.positional_args.append(arg)
            i += 1

    return config


def resolve_model(environ: dict[str, str] | os._Environ[str] | None = None) -> str:
    env = os.environ if environ is None else environ
    model = env.get("LIFEOS_TOOLS_MODEL_NAME", "").strip()
    return model or DEFAULT_MODEL


def resolve_effort(
    cli_effort: str,
    environ: dict[str, str] | os._Environ[str] | None = None,
) -> str:
    env = os.environ if environ is None else environ
    raw = (env.get("LIFEOS_TOOLS_MODEL_EFFORT") or cli_effort or DEFAULT_EFFORT).strip().lower()
    return EFFORT_MAP.get(raw, DEFAULT_EFFORT)


def _split_tool_tokens(spec: str) -> list[str]:
    tokens: list[str] = []
    buf: list[str] = []
    depth = 0
    for ch in spec.strip():
        if ch == "(":
            depth += 1
            buf.append(ch)
        elif ch == ")":
            if depth > 0:
                depth -= 1
            buf.append(ch)
        elif depth == 0 and (ch == "," or ch.isspace()):
            if buf:
                tokens.append("".join(buf))
                buf.clear()
        else:
            buf.append(ch)
    if buf:
        tokens.append("".join(buf))
    return tokens


def _is_disabled_tool_spec(spec: str) -> bool:
    cleaned = spec.strip().strip("'\"").strip().lower()
    return cleaned in ("", "none")


def _extract_bare_tool_names(specs: list[str]) -> list[str]:
    mapped: list[str] = []
    seen: set[str] = set()
    for spec in specs:
        if _is_disabled_tool_spec(spec):
            continue
        for token in _split_tool_tokens(spec):
            base = token.split("(", 1)[0].strip().strip("'\"").lower()
            if not base:
                continue
            omp_name = TOOL_NAME_MAP.get(base)
            if omp_name and omp_name not in seen:
                seen.add(omp_name)
                mapped.append(omp_name)
    return mapped


def resolve_tool_args(
    tools_flag: str | None,
    allowed_tools: list[str],
    disallowed_tools: list[str],
) -> list[str]:
    if tools_flag is not None and _is_disabled_tool_spec(tools_flag):
        return ["--no-tools"]

    if allowed_tools:
        enabled = _extract_bare_tool_names(allowed_tools)
        if tools_flag is not None and tools_flag.strip().lower() != "default":
            allowed_base = set(_extract_bare_tool_names([tools_flag]))
            enabled = [t for t in enabled if t in allowed_base]
    elif tools_flag is not None:
        enabled = _extract_bare_tool_names([tools_flag])
    else:
        return ["--no-tools"]

    denied: set[str] = set()
    for spec in disallowed_tools:
        for token in _split_tool_tokens(spec):
            if "(" in token:
                continue
            omp_name = TOOL_NAME_MAP.get(token.strip().strip("'\"").lower())
            if omp_name:
                denied.add(omp_name)

    final_tools = [tool for tool in enabled if tool not in denied]
    if not final_tools:
        return ["--no-tools"]
    return [f"--tools={','.join(final_tools)}"]


def _read_prompt_file(path_str: str, label: str) -> str:
    try:
        return Path(path_str).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise ShimError(f"Failed to read {label} '{path_str}': {exc}") from exc


def _write_temp_text(temp_dir: Path, filename: str, content: str) -> Path:
    target = temp_dir / filename
    target.write_text(content, encoding="utf-8")
    target.chmod(0o600)
    return target


def resolve_prompt_flags(config: CliConfig, temp_dir: Path) -> list[str]:
    flags: list[str] = []

    if config.system_prompt_file is not None:
        text = _read_prompt_file(config.system_prompt_file, "system-prompt-file")
        if not text:
            flags.append(f"--system-prompt={MINIMAL_SYSTEM_PROMPT}")
        elif len(text.encode("utf-8")) > MAX_INLINE_PROMPT_BYTES:
            flags.append(f"--system-prompt={config.system_prompt_file}")
        else:
            flags.append(f"--system-prompt={text}")
    elif config.system_prompt is not None:
        if not config.system_prompt:
            flags.append(f"--system-prompt={MINIMAL_SYSTEM_PROMPT}")
        elif len(config.system_prompt.encode("utf-8")) > MAX_INLINE_PROMPT_BYTES:
            sp_file = _write_temp_text(temp_dir, "system-prompt.md", config.system_prompt)
            flags.append(f"--system-prompt={sp_file}")
        else:
            flags.append(f"--system-prompt={config.system_prompt}")

    if config.append_system_prompt_file is not None:
        append_text = _read_prompt_file(
            config.append_system_prompt_file, "append-system-prompt-file"
        )
        if append_text:
            if len(append_text.encode("utf-8")) > MAX_INLINE_PROMPT_BYTES:
                flags.append(f"--append-system-prompt={config.append_system_prompt_file}")
            else:
                flags.append(f"--append-system-prompt={append_text}")
    elif config.append_system_prompt:
        if len(config.append_system_prompt.encode("utf-8")) > MAX_INLINE_PROMPT_BYTES:
            ap_file = _write_temp_text(
                temp_dir, "append-system-prompt.md", config.append_system_prompt
            )
            flags.append(f"--append-system-prompt={ap_file}")
        else:
            flags.append(f"--append-system-prompt={config.append_system_prompt}")

    return flags


def _decode_stream_json_stdin(stdin_text: str, temp_dir: Path) -> tuple[str, list[str]]:
    text_messages: list[str] = []
    attachments: list[str] = []

    for line_no, raw_line in enumerate(stdin_text.splitlines(), start=1):
        stripped = raw_line.strip()
        if not stripped:
            continue
        try:
            event = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ShimError(f"Invalid JSON on stream-json stdin line {line_no}: {exc}") from exc

        if not isinstance(event, dict):
            raise ShimError(f"Expected JSON object on stream-json stdin line {line_no}")

        msg = event.get("message")
        is_user = event.get("type") == "user" or (
            isinstance(msg, dict) and msg.get("role") == "user"
        )
        if not is_user:
            continue

        content: Any = msg.get("content") if isinstance(msg, dict) else event.get("content")
        if isinstance(content, str):
            if content:
                text_messages.append(content)
            continue
        if not isinstance(content, list):
            continue

        line_texts: list[str] = []
        for block in content:
            if isinstance(block, str):
                line_texts.append(block)
                continue
            if not isinstance(block, dict):
                continue

            btype = block.get("type")
            if btype == "text":
                text_val = block.get("text")
                if isinstance(text_val, str) and text_val:
                    line_texts.append(text_val)
            elif btype == "image":
                source = block.get("source")
                if not isinstance(source, dict) or source.get("type") != "base64":
                    raise ShimError("Unsupported image block source in stream-json input")
                media_type = str(source.get("media_type", "")).lower()
                ext = IMAGE_MEDIA_EXT.get(media_type)
                if not ext:
                    raise ShimError(f"Unsupported inline image media type: {media_type}")
                data_val = source.get("data")
                if not isinstance(data_val, str) or not data_val:
                    raise ShimError("Missing base64 image payload in stream-json input")
                try:
                    raw_bytes = base64.b64decode(data_val, validate=True)
                except (binascii.Error, ValueError) as exc:
                    raise ShimError(f"Invalid base64 image payload: {exc}") from exc
                img_path = temp_dir / f"image_{len(attachments)}{ext}"
                img_path.write_bytes(raw_bytes)
                img_path.chmod(0o600)
                attachments.append(f"@{img_path}")

        if line_texts:
            text_messages.append("".join(line_texts))

    return "\n\n".join(text_messages), attachments


def prepare_prompt(
    config: CliConfig,
    stdin_text: str,
    temp_dir: Path,
) -> tuple[str, list[str]]:
    if config.input_format == "stream-json":
        parsed_stdin, attachments = _decode_stream_json_stdin(stdin_text, temp_dir)
    else:
        parsed_stdin, attachments = stdin_text, []

    positional_prompt = " ".join(config.positional_args)
    if parsed_stdin and positional_prompt:
        prompt_text = f"{parsed_stdin}\n\n{positional_prompt}"
    elif parsed_stdin:
        prompt_text = parsed_stdin
    else:
        prompt_text = positional_prompt

    if not prompt_text.strip() and not attachments:
        raise ShimError("No prompt provided on stdin or positional arguments")

    return prompt_text, attachments


def _to_nonneg_int(val: Any) -> int:
    if isinstance(val, bool) or not isinstance(val, (int, float)):
        return 0
    return max(0, int(val))


def parse_omp_events(raw_output: str, default_model: str) -> ParsedOmpResult:
    assistant_text = ""
    model_name = default_model
    stop_reason = "end_turn"
    found_assistant = False
    error_message = ""
    usage_totals = TokenUsage()

    message_end_assistants: list[dict[str, Any]] = []
    turn_end_assistants: list[dict[str, Any]] = []
    agent_end_assistants: list[dict[str, Any]] = []

    for raw_line in raw_output.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue

        event_type = event.get("type")
        if event_type == "error":
            err_val = event.get("error") or event.get("message") or "Unknown error"
            error_message = str(err_val)
        elif event_type == "message_end":
            msg = event.get("message")
            if isinstance(msg, dict) and msg.get("role") == "assistant":
                message_end_assistants.append(msg)
        elif event_type == "turn_end":
            msg = event.get("message")
            if isinstance(msg, dict) and msg.get("role") == "assistant":
                turn_end_assistants.append(msg)
        elif event_type == "agent_end":
            msgs = event.get("messages")
            if isinstance(msgs, list):
                for item in msgs:
                    if isinstance(item, dict) and item.get("role") == "assistant":
                        agent_end_assistants.append(item)

    assistant_messages = message_end_assistants or turn_end_assistants or agent_end_assistants

    for msg in assistant_messages:
        content = msg.get("content", [])
        text_parts: list[str] = []
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    if part.get("type") == "text":
                        text_parts.append(str(part.get("text", "")))
                elif isinstance(part, str):
                    text_parts.append(part)
        elif isinstance(content, str):
            text_parts.append(content)

        if text_parts:
            assistant_text = "".join(text_parts)
            found_assistant = True

        usage = msg.get("usage")
        if isinstance(usage, dict):
            usage_totals.input_tokens += _to_nonneg_int(
                usage.get("input", usage.get("inputTokens", 0))
            )
            usage_totals.cache_read_input_tokens += _to_nonneg_int(
                usage.get("cacheRead", usage.get("cacheReadInputTokens", 0))
            )
            usage_totals.cache_creation_input_tokens += _to_nonneg_int(
                usage.get("cacheWrite", usage.get("cacheCreationInputTokens", 0))
            )
            usage_totals.output_tokens += _to_nonneg_int(
                usage.get("output", usage.get("outputTokens", 0))
            )

        prov = msg.get("provider")
        mod = msg.get("model")
        if isinstance(prov, str) and prov and isinstance(mod, str) and mod and "/" not in mod:
            model_name = f"{prov}/{mod}"
        elif isinstance(mod, str) and mod:
            model_name = mod

        sr = msg.get("stopReason")
        if isinstance(sr, str) and sr:
            stop_reason = STOP_REASON_MAP.get(sr, sr)
            if sr in ("error", "aborted"):
                msg_err = msg.get("errorMessage")
                if isinstance(msg_err, str) and msg_err and not error_message:
                    error_message = msg_err

    return ParsedOmpResult(
        assistant_text=assistant_text,
        model_name=model_name,
        stop_reason=stop_reason,
        found_assistant=found_assistant,
        error_message=error_message,
        usage=usage_totals,
    )


def build_success_envelope(
    parsed: ParsedOmpResult,
    *,
    session_id: str | None = None,
) -> dict[str, Any]:
    envelope: dict[str, Any] = {
        "type": "result",
        "subtype": "success",
        "is_error": False,
        "result": parsed.assistant_text,
        "stop_reason": parsed.stop_reason,
        "usage": {
            "input_tokens": parsed.usage.input_tokens,
            "cache_read_input_tokens": parsed.usage.cache_read_input_tokens,
            "cache_creation_input_tokens": parsed.usage.cache_creation_input_tokens,
            "output_tokens": parsed.usage.output_tokens,
        },
        "modelUsage": {
            parsed.model_name: {
                "inputTokens": parsed.usage.input_tokens,
                "cacheReadInputTokens": parsed.usage.cache_read_input_tokens,
                "cacheCreationInputTokens": parsed.usage.cache_creation_input_tokens,
                "outputTokens": parsed.usage.output_tokens,
            }
        },
    }
    if session_id is not None:
        envelope["session_id"] = session_id
    return envelope


def format_stream_json_success(
    parsed: ParsedOmpResult,
    *,
    session_id: str | None = None,
) -> list[str]:
    sid = session_id or str(uuid.uuid4())
    init_event = {
        "type": "system",
        "subtype": "init",
        "session_id": sid,
        "model": parsed.model_name,
        "apiKeySource": "none",
    }
    assistant_event = {
        "type": "assistant",
        "message": {
            "role": "assistant",
            "model": parsed.model_name,
            "content": [{"type": "text", "text": parsed.assistant_text}],
        },
    }
    result_event = build_success_envelope(parsed, session_id=sid)
    return [
        json.dumps(init_event),
        json.dumps(assistant_event),
        json.dumps(result_event),
    ]


def emit_error(
    output_format: str,
    err: str,
    *,
    model_name: str = DEFAULT_MODEL,
    session_id: str | None = None,
) -> int:
    if output_format == "json":
        envelope = {
            "type": "error",
            "is_error": True,
            "api_error_status": 500,
            "result": err,
            "error": err,
        }
        print(json.dumps(envelope))
    elif output_format == "stream-json":
        sid = session_id or str(uuid.uuid4())
        init_event = {
            "type": "system",
            "subtype": "init",
            "session_id": sid,
            "model": model_name,
            "apiKeySource": "none",
        }
        result_event = {
            "type": "result",
            "subtype": "error_during_execution",
            "session_id": sid,
            "is_error": True,
            "api_error_status": 500,
            "result": err,
            "error": err,
        }
        print(json.dumps(init_event))
        print(json.dumps(result_event))
    else:
        print(err, file=sys.stderr)
    return 1


def run_omp(
    cmd: list[str],
    prompt_text: str,
) -> OmpRunResult:
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError as exc:
        return OmpRunResult(returncode=127, stdout="", stderr=str(exc))

    received_signal: int | None = None

    def _terminate_child() -> None:
        if proc.poll() is not None:
            return
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()

    def _on_signal(signum: int, _frame: FrameType | None) -> None:
        nonlocal received_signal
        received_signal = signum
        _terminate_child()

    install_signals = threading.current_thread() is threading.main_thread()
    prev_sigterm = signal.getsignal(signal.SIGTERM) if install_signals else None
    prev_sigint = signal.getsignal(signal.SIGINT) if install_signals else None
    if install_signals:
        signal.signal(signal.SIGTERM, _on_signal)
        signal.signal(signal.SIGINT, _on_signal)

    try:
        stdout, stderr = proc.communicate(input=prompt_text)
    except BaseException:
        _terminate_child()
        raise
    finally:
        if install_signals:
            signal.signal(signal.SIGTERM, prev_sigterm)
            signal.signal(signal.SIGINT, prev_sigint)

    if received_signal is not None:
        return OmpRunResult(
            returncode=128 + received_signal,
            stdout=stdout,
            stderr=stderr or f"Terminated by signal {received_signal}",
        )

    return OmpRunResult(returncode=proc.returncode, stdout=stdout, stderr=stderr)


def build_omp_command(
    omp_bin: str,
    target_model: str,
    target_effort: str,
    tool_args: list[str],
    prompt_flags: list[str],
    attachment_args: list[str],
) -> list[str]:
    return [
        omp_bin,
        "-p",
        "--no-session",
        "--no-skills",
        "--no-rules",
        "--no-title",
        "--no-extensions",
        "--no-context-files",
        "--profile=isolated",
        "--mode=json",
        f"--model={target_model}",
        f"--thinking={target_effort}",
        *tool_args,
        *prompt_flags,
        *attachment_args,
    ]


def main(argv: list[str] | None = None) -> int:
    raw_argv = sys.argv[1:] if argv is None else argv
    stdin_is_tty = sys.stdin.isatty()
    config = parse_args(raw_argv, stdin_is_tty=stdin_is_tty)

    if config.show_help:
        print(usage_text())
        return 0

    if config.show_version:
        print(VERSION_BANNER)
        return 0

    if config.output_format not in VALID_OUTPUT_FORMATS:
        return emit_error(
            "text",
            f"Unsupported --output-format: {config.output_format}",
        )

    if config.input_format not in VALID_INPUT_FORMATS:
        return emit_error(
            config.output_format,
            f"Unsupported --input-format: {config.input_format}",
        )

    target_model = resolve_model()
    target_effort = resolve_effort(config.cli_effort)
    tool_args = resolve_tool_args(config.tools_flag, config.allowed_tools, config.disallowed_tools)

    stdin_text = "" if stdin_is_tty else sys.stdin.read()

    try:
        with tempfile.TemporaryDirectory(prefix="claude-shim-") as tmp:
            temp_dir = Path(tmp)
            prompt_flags = resolve_prompt_flags(config, temp_dir)
            prompt_text, attachment_args = prepare_prompt(config, stdin_text, temp_dir)
            omp_bin = shutil.which("omp")
            if not omp_bin:
                return emit_error(
                    config.output_format,
                    "omp executable not found on PATH",
                    model_name=target_model,
                )
            cmd = build_omp_command(
                omp_bin,
                target_model,
                target_effort,
                tool_args,
                prompt_flags,
                attachment_args,
            )
            run_res = run_omp(cmd, prompt_text)
    except ShimError as exc:
        return emit_error(config.output_format, str(exc), model_name=target_model)

    parsed = parse_omp_events(run_res.stdout, target_model)
    stderr_text = run_res.stderr.strip()

    failed = (
        run_res.returncode != 0
        or parsed.stop_reason in ("error", "aborted")
        or (not parsed.found_assistant and not parsed.assistant_text)
    )
    if failed:
        err = (
            parsed.error_message
            or stderr_text
            or f"omp process failed with exit code {run_res.returncode}"
        )
        return emit_error(config.output_format, err, model_name=parsed.model_name)

    if config.output_format == "text":
        print(parsed.assistant_text)
    elif config.output_format == "stream-json":
        for line in format_stream_json_success(parsed):
            print(line)
    else:
        print(json.dumps(build_success_envelope(parsed)))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
