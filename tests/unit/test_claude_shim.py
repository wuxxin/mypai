"""test_claude_shim.py - Unit tests for bin/claude-shim.py CLI compatibility shim."""

from __future__ import annotations

import base64
import importlib.util
import json
import os
import signal
import subprocess
import sys
import time
import uuid as uuidlib
from pathlib import Path
from types import ModuleType

import pytest

REPO_ROOT = Path(__file__).parents[2]
SHIM_PATH = REPO_ROOT / "bin" / "claude-shim.py"

PNG_1X1_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
)


def load_shim_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location("claude_shim", SHIM_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


shim = load_shim_module()


def _write_fake_omp(bin_dir: Path, script_body: str) -> Path:
    omp_path = bin_dir / "omp"
    omp_path.write_text(script_body, encoding="utf-8")
    omp_path.chmod(0o755)
    return omp_path


def test_cli_help_and_version() -> None:
    help_res = subprocess.run(
        [sys.executable, str(SHIM_PATH), "--help"],
        capture_output=True,
        text=True,
    )
    assert help_res.returncode == 0
    assert "claude-shim" in help_res.stdout
    assert "--output-format" in help_res.stdout

    ver_res = subprocess.run(
        [sys.executable, str(SHIM_PATH), "--version"],
        capture_output=True,
        text=True,
    )
    assert ver_res.returncode == 0
    first_line = ver_res.stdout.splitlines()[0].strip()
    assert first_line.split()[0] == "1.0.0"
    assert "(claude-shim omp backend)" in first_line


def test_parse_args_callers_and_separator() -> None:
    cfg_inf = shim.parse_args(
        [
            "--print",
            "--model",
            "haiku",
            "--effort",
            "low",
            "--tools",
            "",
            "--output-format",
            "json",
            "--exclude-dynamic-system-prompt-sections",
            "--safe-mode",
            "--strict-mcp-config",
            "--settings",
            '{"verbose":false}',
            "--no-session-persistence",
            "--system-prompt-file",
            "/tmp/sp.md",
        ],
        stdin_is_tty=False,
    )
    assert cfg_inf.cli_model == "haiku"
    assert cfg_inf.cli_effort == "low"
    assert cfg_inf.tools_flag == ""
    assert cfg_inf.output_format == "json"
    assert cfg_inf.system_prompt_file == "/tmp/sp.md"
    assert cfg_inf.positional_args == []

    cfg_pulse = shim.parse_args(
        [
            "--print",
            "--model",
            "sonnet",
            "--tools",
            "",
            "--output-format",
            "text",
            "--safe-mode",
            "--system-prompt",
            "",
        ],
        stdin_is_tty=False,
    )
    assert cfg_pulse.output_format == "text"
    assert cfg_pulse.system_prompt == ""
    assert cfg_pulse.tools_flag == ""

    cfg_sep = shim.parse_args(
        ["--print", "--", "--not-a-flag", "literal prompt"],
        stdin_is_tty=True,
    )
    assert cfg_sep.positional_args == ["--not-a-flag", "literal prompt"]


def test_parse_args_unknown_flag_heuristic() -> None:
    # Remaining > 2 on TTY consumes flag + value and leaves prompt
    cfg1 = shim.parse_args(["--unknown-opt", "val", "hello"], stdin_is_tty=True)
    assert cfg1.positional_args == ["hello"]

    # Remaining == 2 on TTY preserves trailing argument as user prompt
    cfg2 = shim.parse_args(["--unknown-flag", "hello"], stdin_is_tty=True)
    assert cfg2.positional_args == ["hello"]

    # Remaining == 2 with piped stdin consumes value since prompt rides stdin
    cfg3 = shim.parse_args(["--unknown-opt", "val"], stdin_is_tty=False)
    assert cfg3.positional_args == []

    # Unrecognized --key=value discarded cleanly
    cfg4 = shim.parse_args(["--future-opt=123", "hello"], stdin_is_tty=True)
    assert cfg4.positional_args == ["hello"]


def test_model_and_effort_precedence() -> None:
    assert shim.resolve_model({}) == "llama.cpp/qwen3.8-flash-next"
    assert (
        shim.resolve_model({"LIFEOS_TOOLS_MODEL_NAME": "llama.cpp/qwen3.6-35B-A3B"})
        == "llama.cpp/qwen3.6-35B-A3B"
    )

    assert shim.resolve_effort("", {}) == "high"
    assert shim.resolve_effort("min", {}) == "minimal"
    assert shim.resolve_effort("MED", {}) == "medium"
    assert shim.resolve_effort("highest", {}) == "max"
    assert shim.resolve_effort("xhigh", {}) == "xhigh"
    assert shim.resolve_effort("0", {}) == "off"
    assert shim.resolve_effort("bogus", {}) == "high"
    assert shim.resolve_effort("low", {"LIFEOS_TOOLS_MODEL_EFFORT": "max"}) == "max"


def test_resolve_tool_args_mapping_and_rules() -> None:
    assert shim.resolve_tool_args(None, [], []) == ["--no-tools"]
    assert shim.resolve_tool_args("", [], []) == ["--no-tools"]
    assert shim.resolve_tool_args("''", [], []) == ["--no-tools"]
    assert shim.resolve_tool_args("none", [], []) == ["--no-tools"]
    assert shim.resolve_tool_args(None, ["Read"], []) == ["--tools=read"]
    assert shim.resolve_tool_args(None, ["Skill"], []) == ["--no-tools"]

    agent_job_args = shim.resolve_tool_args(
        "Read,Grep,Glob,Bash",
        ["Read,Grep,Glob,Bash(bun /home/u/.claude/LIFEOS/TOOLS/gmail.ts:*)"],
        ["Bash(bun /home/u/.claude/LIFEOS/TOOLS/gmail.ts send:*)"],
    )
    assert agent_job_args == ["--tools=read,grep,glob,bash"]

    bare_denied = shim.resolve_tool_args(
        None,
        ["Read Grep Glob Bash WebFetch WebSearch"],
        ["Grep", "Bash"],
    )
    assert bare_denied == ["--tools=read,glob,web_search"]


def test_resolve_prompt_flags_and_spill(tmp_path: Path) -> None:
    # Omitted system prompt stays omitted while append passes through
    cfg_omitted = shim.CliConfig(append_system_prompt="JOB_SOUL")
    assert shim.resolve_prompt_flags(cfg_omitted, tmp_path) == ["--append-system-prompt=JOB_SOUL"]

    # Explicit empty system prompt uses minimal replacement prompt
    cfg_empty = shim.CliConfig(system_prompt="")
    assert shim.resolve_prompt_flags(cfg_empty, tmp_path) == [
        f"--system-prompt={shim.MINIMAL_SYSTEM_PROMPT}"
    ]

    # Empty system-prompt-file also maps to minimal replacement prompt
    empty_file = tmp_path / "empty.md"
    empty_file.write_text("", encoding="utf-8")
    cfg_empty_file = shim.CliConfig(system_prompt_file=str(empty_file))
    assert shim.resolve_prompt_flags(cfg_empty_file, tmp_path) == [
        f"--system-prompt={shim.MINIMAL_SYSTEM_PROMPT}"
    ]

    # Large inline system prompt spills to a 0600 file path
    big_prompt = "x" * (shim.MAX_INLINE_PROMPT_BYTES + 100)
    cfg_big = shim.CliConfig(system_prompt=big_prompt)
    flags = shim.resolve_prompt_flags(cfg_big, tmp_path)
    assert len(flags) == 1
    assert flags[0].startswith("--system-prompt=")
    spilled = Path(flags[0].split("=", 1)[1])
    assert spilled.exists()
    assert spilled.read_text(encoding="utf-8") == big_prompt
    assert (spilled.stat().st_mode & 0o777) == 0o600

    # Missing system-prompt-file fails with ShimError
    with pytest.raises(shim.ShimError):
        shim.resolve_prompt_flags(
            shim.CliConfig(system_prompt_file=str(tmp_path / "missing.md")),
            tmp_path,
        )


def test_parse_omp_events_sums_message_end_without_double_counting() -> None:
    events = [
        {
            "type": "message_end",
            "message": {
                "role": "assistant",
                "provider": "llama.cpp",
                "model": "qwen3.8-flash-next",
                "content": [{"type": "thinking", "thinking": "reading"}],
                "usage": {"input": 100, "cacheRead": 10, "cacheWrite": 0, "output": 20},
                "stopReason": "toolUse",
            },
        },
        {
            "type": "turn_end",
            "message": {
                "role": "assistant",
                "provider": "llama.cpp",
                "model": "qwen3.8-flash-next",
                "content": [],
                "usage": {"input": 100, "cacheRead": 10, "cacheWrite": 0, "output": 20},
                "stopReason": "toolUse",
            },
        },
        {
            "type": "message_end",
            "message": {
                "role": "assistant",
                "provider": "llama.cpp",
                "model": "qwen3.8-flash-next",
                "content": [{"type": "text", "text": "MAGIC_TOKEN_42"}],
                "usage": {"input": 15, "cacheRead": 120, "cacheWrite": 5, "output": 8},
                "stopReason": "stop",
            },
        },
        {
            "type": "turn_end",
            "message": {
                "role": "assistant",
                "provider": "llama.cpp",
                "model": "qwen3.8-flash-next",
                "content": [{"type": "text", "text": "MAGIC_TOKEN_42"}],
                "usage": {"input": 15, "cacheRead": 120, "cacheWrite": 5, "output": 8},
                "stopReason": "stop",
            },
        },
        {
            "type": "agent_end",
            "messages": [
                {
                    "role": "assistant",
                    "provider": "llama.cpp",
                    "model": "qwen3.8-flash-next",
                    "content": [{"type": "text", "text": "MAGIC_TOKEN_42"}],
                    "usage": {"input": 15, "cacheRead": 120, "cacheWrite": 5, "output": 8},
                    "stopReason": "stop",
                }
            ],
        },
    ]
    raw = "\n".join(json.dumps(e) for e in events)
    parsed = shim.parse_omp_events(raw, "llama.cpp/qwen3.8-flash-next")
    assert parsed.assistant_text == "MAGIC_TOKEN_42"
    assert parsed.stop_reason == "end_turn"
    assert parsed.model_name == "llama.cpp/qwen3.8-flash-next"
    assert parsed.usage.input_tokens == 115
    assert parsed.usage.cache_read_input_tokens == 130
    assert parsed.usage.cache_creation_input_tokens == 5
    assert parsed.usage.output_tokens == 28

    env = shim.build_success_envelope(parsed)
    assert env["type"] == "result"
    assert env["is_error"] is False
    assert env["result"] == "MAGIC_TOKEN_42"
    assert env["usage"] == {
        "input_tokens": 115,
        "cache_read_input_tokens": 130,
        "cache_creation_input_tokens": 5,
        "output_tokens": 28,
    }
    assert env["modelUsage"]["llama.cpp/qwen3.8-flash-next"] == {
        "inputTokens": 115,
        "cacheReadInputTokens": 130,
        "cacheCreationInputTokens": 5,
        "outputTokens": 28,
    }


def test_subprocess_stream_json_inline_image_and_isolation_flags(tmp_path: Path) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    capture_file = tmp_path / "captured.json"

    _write_fake_omp(
        bin_dir,
        f"""#!/usr/bin/env python3
import json, pathlib, sys
args = sys.argv[1:]
stdin_data = sys.stdin.read()
at_files = [a[1:] for a in args if a.startswith("@")]
img_sizes = [pathlib.Path(p).stat().st_size for p in at_files]
pathlib.Path({str(capture_file)!r}).write_text(json.dumps({{
    "args": args,
    "stdin": stdin_data,
    "at_files": at_files,
    "img_sizes": img_sizes,
}}))
print(json.dumps({{
    "type": "message_end",
    "message": {{
        "role": "assistant",
        "provider": "llama.cpp",
        "model": "qwen3.8-flash-next",
        "content": [{{"type": "text", "text": "Red"}}],
        "usage": {{"input": 50, "cacheRead": 0, "cacheWrite": 0, "output": 1}},
        "stopReason": "stop",
    }},
}}))
""",
    )

    stream_in = (
        json.dumps(
            {
                "type": "user",
                "message": {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": PNG_1X1_B64,
                            },
                        },
                        {"type": "text", "text": "What color is this image?"},
                    ],
                },
            }
        )
        + "\n"
    )

    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}:{env.get('PATH', '')}"
    env["LIFEOS_TOOLS_MODEL_NAME"] = "llama.cpp/qwen3.8-flash-next"
    env["LIFEOS_TOOLS_MODEL_EFFORT"] = "low"

    res = subprocess.run(
        [
            sys.executable,
            str(SHIM_PATH),
            "--print",
            "--model",
            "claude-opus-4-6",
            "--input-format",
            "stream-json",
            "--output-format",
            "stream-json",
            "--verbose",
            "--tools",
            "",
            "--system-prompt",
            "",
        ],
        input=stream_in,
        capture_output=True,
        text=True,
        env=env,
    )
    assert res.returncode == 0, res.stderr

    captured = json.loads(capture_file.read_text(encoding="utf-8"))
    args = captured["args"]
    assert "--no-extensions" in args
    assert "--no-context-files" in args
    assert "--profile=isolated" in args
    assert "--no-session" in args
    assert "--model=llama.cpp/qwen3.8-flash-next" in args
    assert "--thinking=low" in args
    assert "--no-tools" in args
    assert f"--system-prompt={shim.MINIMAL_SYSTEM_PROMPT}" in args
    assert captured["stdin"] == "What color is this image?"
    assert captured["img_sizes"] == [len(base64.b64decode(PNG_1X1_B64))]
    # Temp image directory must be cleaned up after exit
    assert not Path(captured["at_files"][0]).exists()

    lines = [json.loads(ln) for ln in res.stdout.splitlines() if ln.strip()]
    assert len(lines) == 3
    assert lines[0]["type"] == "system"
    assert lines[0]["subtype"] == "init"
    assert lines[0]["apiKeySource"] == "none"
    assert lines[1]["type"] == "assistant"
    assert lines[2]["type"] == "result"
    assert lines[2]["is_error"] is False
    assert lines[2]["result"] == "Red"


def test_subprocess_error_envelopes(tmp_path: Path) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_omp(
        bin_dir,
        """#!/usr/bin/env python3
import json, sys
print(json.dumps({
    "type": "message_end",
    "message": {
        "role": "assistant",
        "provider": "llama.cpp",
        "model": "qwen3.8-flash-next",
        "content": [],
        "stopReason": "error",
        "errorMessage": "backend unreachable",
    },
}))
sys.exit(1)
""",
    )
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}:{env.get('PATH', '')}"

    res_json = subprocess.run(
        [sys.executable, str(SHIM_PATH), "--print", "--output-format", "json", "hi"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert res_json.returncode == 1
    err_env = json.loads(res_json.stdout)
    assert err_env["is_error"] is True
    assert "backend unreachable" in err_env["result"]

    res_stream = subprocess.run(
        [
            sys.executable,
            str(SHIM_PATH),
            "--print",
            "--output-format",
            "stream-json",
            "hi",
        ],
        capture_output=True,
        text=True,
        env=env,
    )
    assert res_stream.returncode == 1
    stream_lines = [json.loads(ln) for ln in res_stream.stdout.splitlines()]
    assert stream_lines[0]["subtype"] == "init"
    assert stream_lines[0]["apiKeySource"] == "none"
    assert stream_lines[1]["type"] == "result"
    assert stream_lines[1]["is_error"] is True

    res_text = subprocess.run(
        [sys.executable, str(SHIM_PATH), "--print", "--output-format", "text", "hi"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert res_text.returncode == 1
    assert "backend unreachable" in res_text.stderr


def test_sigterm_terminates_child_omp(tmp_path: Path) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    pid_file = tmp_path / "omp.pid"

    _write_fake_omp(
        bin_dir,
        f"""#!/usr/bin/env python3
import os, pathlib, time
pathlib.Path({str(pid_file)!r}).write_text(str(os.getpid()))
time.sleep(30)
""",
    )
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}:{env.get('PATH', '')}"

    proc = subprocess.Popen(
        [sys.executable, str(SHIM_PATH), "--print", "sleep"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    try:
        deadline = time.monotonic() + 5.0
        while not pid_file.exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert pid_file.exists(), "fake omp never started"
        child_pid = int(pid_file.read_text().strip())

        proc.send_signal(signal.SIGTERM)
        proc.wait(timeout=5)
        assert proc.returncode != 0

        # Ensure child omp process is gone and not orphaned
        dead = False
        wait_child = time.monotonic() + 3.0
        while time.monotonic() < wait_child:
            try:
                os.kill(child_pid, 0)
                time.sleep(0.05)
            except ProcessLookupError:
                dead = True
                break
        assert dead, f"child omp pid {child_pid} left running after SIGTERM"
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()


# --- Hook bridge opt-in (LIFEOS_BRIDGE) and session identity ---------------------
# The shim runs every child isolated, which drops the LifeOS hook bridge (an omp
# extension). A caller opts in per spawn; the gate must be exact, a missing bridge file
# must degrade to an isolated run, and every child must carry a real session id so hook
# state stops landing in STATE/*/unknown.json.


def test_bridge_gate_units(tmp_path: Path) -> None:
    ext = tmp_path / "OmpHooksBridge.ts"
    ext.write_text("// bridge stub", encoding="utf-8")

    # Gate off by default; only truthy spellings opt in.
    assert shim.resolve_bridge_extension({}) is None
    for value in ("0", "", "false", "off"):
        assert shim.resolve_bridge_extension({"LIFEOS_BRIDGE": value, "LIFEOS_BRIDGE_EXTENSION": str(ext)}) is None

    # Opted in: the explicit path wins.
    assert shim.resolve_bridge_extension({"LIFEOS_BRIDGE": "1", "LIFEOS_BRIDGE_EXTENSION": str(ext)}) == str(ext)
    assert shim.resolve_bridge_extension({"LIFEOS_BRIDGE": "TRUE", "LIFEOS_BRIDGE_EXTENSION": str(ext)}) == str(ext)

    # A missing bridge degrades to isolated, never to a failed inference call.
    missing = tmp_path / "absent.ts"
    assert shim.resolve_bridge_extension({"LIFEOS_BRIDGE": "yes", "LIFEOS_BRIDGE_EXTENSION": str(missing)}) is None

    # The gate is never inherited: an inference hook spawns `claude` again, and an inherited
    # gate loads the bridge in every nested child (measured 85 SessionStart + 72 Stop
    # dispatches from one prompt). The session id is set; the caller's other keys survive.
    sid = shim.new_session_id()
    child = shim.child_environment(
        sid,
        {shim.BRIDGE_REQUEST_ENV: "1", shim.BRIDGE_PATH_ENV: str(ext), "PATH": "/usr/bin"},
    )
    assert child[shim.SESSION_ID_ENV] == sid
    assert child["PATH"] == "/usr/bin"
    assert shim.BRIDGE_REQUEST_ENV not in child
    assert shim.BRIDGE_PATH_ENV not in child


def test_build_omp_command_appends_bridge_flag() -> None:
    base = shim.build_omp_command("omp", "llama.cpp/x", "high", [], [], [])
    assert "-e" not in base

    gated = shim.build_omp_command("omp", "llama.cpp/x", "high", [], [], [], "/ext/OmpHooksBridge.ts")
    idx = gated.index("-e")
    assert gated[idx + 1] == "/ext/OmpHooksBridge.ts"
    # Isolation is untouched: the opt-in adds one extension, not discovery.
    assert "--no-extensions" in gated and "--profile=isolated" in gated


def test_gated_run_loads_bridge_and_exports_session_id(tmp_path: Path) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    capture_file = tmp_path / "captured.json"
    ext = tmp_path / "OmpHooksBridge.ts"
    ext.write_text("// bridge stub", encoding="utf-8")

    _write_fake_omp(
        bin_dir,
        f"""#!/usr/bin/env python3
import json, os, pathlib, sys
pathlib.Path({str(capture_file)!r}).write_text(json.dumps({{
    "args": sys.argv[1:],
    "session_id": os.environ.get("OMP_SESSION_ID"),
}}))
print(json.dumps({{
    "type": "message_end",
    "message": {{
        "role": "assistant",
        "provider": "llama.cpp",
        "model": "qwen3.8-flash-next",
        "content": [{{"type": "text", "text": "ok"}}],
        "usage": {{"input": 1, "cacheRead": 0, "cacheWrite": 0, "output": 1}},
        "stopReason": "stop",
    }},
}}))
""",
    )

    def run(extra_env: dict[str, str]) -> dict:
        env = os.environ.copy()
        env["PATH"] = f"{bin_dir}:{env.get('PATH', '')}"
        env["LIFEOS_TOOLS_MODEL_NAME"] = "llama.cpp/qwen3.8-flash-next"
        env.update(extra_env)
        res = subprocess.run(
            [sys.executable, str(SHIM_PATH), "--print", "--output-format", "text"],
            input="ping",
            capture_output=True,
            text=True,
            env=env,
        )
        assert res.returncode == 0, res.stderr
        return json.loads(capture_file.read_text(encoding="utf-8"))

    plain = run({})
    assert "-e" not in plain["args"], "default path must stay hook-free"
    # Every child carries a session id, gated or not: hooks key state on it.
    uuidlib.UUID(plain["session_id"])

    gated = run({"LIFEOS_BRIDGE": "1", "LIFEOS_BRIDGE_EXTENSION": str(ext)})
    idx = gated["args"].index("-e")
    assert gated["args"][idx + 1] == str(ext)
    uuidlib.UUID(gated["session_id"])

    # Missing bridge file: call succeeds, no -e appended.
    absent = run({"LIFEOS_BRIDGE": "1", "LIFEOS_BRIDGE_EXTENSION": str(tmp_path / "gone.ts")})
    assert "-e" not in absent["args"]
