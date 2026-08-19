#!/usr/bin/env python3
"""amux PreToolUse guard — block IRREVERSIBLE tree-wide git in SHARED checkouts.

A shared checkout (e.g. ~/Dev/mixpeek) holds many sessions' uncommitted work in
one tree. A tree-wide discard sweeps up or destroys EVERY session's work (two
data-loss incidents 2026-07-02). We block only the irreversible discards;
path-scoped git and recoverable ops (bare stash, pull --rebase --autostash) pass.

Matching is scoped to ACTUAL git invocations: quoted-string contents are stripped
before matching, so a subcommand merely MENTIONED in prose/JSON (e.g. a curl body)
never trips the guard.

Owner-sanctioned override: write the exact authorized command to
~/.amux/guard-allow-once (after owner sign-off). The next matching invocation is
allowed once, the marker is consumed, and the override is audit-logged. This
gives authorized cleanups a clean path instead of training reflog evasion.

Configure guarded roots via AMUX_SHARED_CHECKOUTS (colon-separated; default
~/Dev/mixpeek). Fail-open: any error lets the command through.
"""
import sys, json, os, re, time, pathlib

DANGER = [
    (r'\bgit\s+(?:-C\s+\S+\s+)?reset\s+--hard\b',
     'git reset --hard — discards ALL uncommitted tracked changes tree-wide'),
    # 2026-07-05: a MIXED `git reset HEAD~2` slipped this guard (not --hard) and
    # decapitated another session's two PUSHED commits from the shared branch
    # (content survived only as staged residue). ANY reset that moves shared
    # HEAD — bare/--soft/--mixed/--keep/--merge/<commit-ish> — rewrites every
    # session's branch state. Only the explicit path form (` -- <paths>`) is
    # safe, and it is the only form allowed through.
    (r'\bgit\s+(?:-C\s+\S+\s+)?reset\b(?![^;&|\n]*\s--\s)',
     "git reset (HEAD-moving or bare) — moves/unstages the SHARED branch state for every "
     "session (a mixed `reset HEAD~N` decapitates other sessions' commits). Unstage only "
     "your paths with `git reset -- <your files>`; never move shared HEAD"),
    (r'\bgit\s+(?:-C\s+\S+\s+)?checkout\s+(?:\S+\s+)?--\s+\.(?=\s|$|[;&|])',
     'git checkout -- . — discards ALL working-tree changes'),
    (r'\bgit\s+(?:-C\s+\S+\s+)?checkout\s+\.(?=\s|$|[;&|])',
     'git checkout . — discards ALL working-tree changes'),
    (r'\bgit\s+(?:-C\s+\S+\s+)?restore\s+(?:--\S+\s+)*\.(?=\s|$|[;&|])',
     'git restore . — discards ALL working-tree changes'),
    (r'\bgit\s+(?:-C\s+\S+\s+)?clean\s+-[a-wyz]*f',
     'git clean -f — deletes untracked files tree-wide'),
    (r'\bgit\s+(?:-C\s+\S+\s+)?stash\s+(?:drop|clear)\b',
     "git stash drop/clear — permanently discards a stash that may hold OTHER sessions' work"),
    # 2026-07-07 CASE 21 (fleet reset incident): bare/un-scoped `git stash` was
    # deliberately allowed as "recoverable" — invalidated in practice: stash
    # internally `reset --hard`s the WHOLE shared tree (the reflog "reset:
    # moving to HEAD" signature), sweeping every session's uncommitted work;
    # a conflicted pop strands the sweep and mid-flight readers see a wiped
    # tree. Allow only pathspec-scoped pushes + non-destructive subcommands.
    (r'\bgit\s+(?:-C\s+\S+\s+)?stash\b(?!\s+(?:pop\b|apply\b|list\b|show\b|branch\b|drop\b|clear\b|push\b[^;&|\n]*\s--\s))',
     "bare/un-scoped git stash — internally reset --hards the WHOLE shared tree "
     "(sweeps every session's uncommitted work; a conflicted pop strands it). "
     "Scope it: `git stash push -- <your paths>`"),
    # Shared INDEX hazard: `-a`/`--all` stages+commits every modified tracked file
    # in the one shared tree, sweeping up other sessions' unstaged edits into your
    # commit (wrong-attribution incidents). Bare `git commit` (no -a) is NOT blocked
    # here — too frequent to gate fleet-wide — but the fix is the same: name paths.
    (r'\bgit\s+(?:-C\s+\S+\s+)?commit\b[^\n;&|]*?(?:\s--all\b|\s-[a-zA-Z]*a[a-zA-Z]*(?=[\s;&|]|$))',
     'git commit -a/--all — commits EVERY modified tracked file in this SHARED tree, '
     'sweeping up other sessions\' edits; commit only your paths: `git commit -m "msg" -- <your files>`'),
]
_ALLOW_ONCE = pathlib.Path.home() / ".amux" / "guard-allow-once"
_AUDIT = pathlib.Path.home() / ".amux" / "logs" / "guard-overrides.jsonl"

_HEREDOC_INTRO = re.compile(r'<<-?\s*([\'"]?)(\w+)\1')
# A heredoc whose intro line feeds a SHELL is executable content — its body must
# still be scanned (bash <<EOF ... git reset --hard ... EOF really runs). Only
# non-executable sinks (cat/tee/python/etc.) get their bodies stripped.
_SHELL_SINK = re.compile(r'\b(?:ba|z|da|k)?sh\b|\beval\b|\bsource\b')

def amux_base_url():
    """Where to reach the amux server, self-healing a STALE INHERITED PORT.

    This hook is a PreToolUse hook: it runs once per Bash tool call, as a child
    of the `claude` process, and so inherits that process's `AMUX_URL`. ~55 live
    sessions predate the 8822 -> 8824 port cutover and carry
    `AMUX_URL=https://localhost:8822` in a process env that cannot be rotated
    without killing them, which made this file the single busiest caller of the
    retired port on the machine (~743 req/h). Editing the DEFAULT below could
    never have helped: a default only fires when the variable is UNSET.

    `~/.amux/endpoint.json` is written by the amux server itself at boot, so
    neither port is hardcoded here (they are REVERSED in the cloud image). Only
    a localhost URL sitting on the port the server itself calls retired is
    swapped; a deliberate dev port or a remote amux is left alone. Missing file
    -> previous behaviour exactly.

    Mirrors amux:scripts/git-hooks/amux-staged-guard. This file is NOT tracked
    in the amux repo, which is why the same helper exists twice; see the
    frustrations entry (AREA: hooks).
    """
    import json as _json, os as _os
    url = (_os.environ.get("AMUX_URL") or "").strip().rstrip("/")
    home = _os.environ.get("AMUX_HOME") or _os.path.expanduser("~/.amux")
    try:
        with open(_os.path.join(home, "endpoint.json")) as fh:
            ep = _json.load(fh)
        legacy, canonical = ep.get("legacy_port"), (ep.get("canonical_url") or "").rstrip("/")
        if legacy and canonical:
            from urllib.parse import urlsplit
            sp = urlsplit(url)
            if sp.hostname in ("localhost", "127.0.0.1", "::1") and sp.port == legacy:
                return canonical
    except Exception:
        pass
    return url or "https://localhost:8824"


def _strip_heredoc_bodies(cmd):
    """MI-4083 (2026-07-05): remove heredoc BODIES so documentation text that
    merely MENTIONS a guarded git command (run-log blocks, memory notes, commit
    recipes) never pattern-matches. The intro line is kept (it is the real
    command); bodies feeding a shell interpreter are kept too (executable)."""
    lines = cmd.split("\n")
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        out.append(line)
        tags = [m.group(2) for m in _HEREDOC_INTRO.finditer(line)]
        i += 1
        if tags and _SHELL_SINK.search(line):
            continue  # executable heredoc — leave the body in place for scanning
        for tag in tags:
            while i < len(lines) and lines[i].strip() != tag:
                i += 1  # drop body line
            if i < len(lines):
                out.append(lines[i])  # keep the terminator (inert)
                i += 1
    return "\n".join(out)

def _scrub(cmd):
    # strip heredoc bodies FIRST (their intro quotes e.g. <<'EOF' must still be
    # visible to the tag matcher), then quoted-string contents — so a subcommand
    # merely mentioned in prose/JSON/docs isn't matched
    s = _strip_heredoc_bodies(cmd)
    s = re.sub(r"'[^']*'", " ", s)
    s = re.sub(r'"[^"]*"', " ", s)
    return s

def _consume_override(cmd):
    """If an owner-sanctioned marker matches this command, consume it (one-time),
    audit-log, and allow. Returns True to allow, False to keep blocking."""
    try:
        if not _ALLOW_ONCE.exists():
            return False
        want = _ALLOW_ONCE.read_text().strip()
        if not want:
            return False
        norm = " ".join(cmd.split())
        if want in cmd or " ".join(want.split()) in norm:
            _ALLOW_ONCE.unlink()  # one-time use
            try:
                _AUDIT.parent.mkdir(parents=True, exist_ok=True)
                with open(_AUDIT, "a") as f:
                    f.write(json.dumps({"ts": time.time(), "authorized": want, "command": cmd[:600]}) + "\n")
            except Exception:
                pass
            return True
    except Exception:
        pass
    return False

def _amend_verdict(cmd, scrubbed, run_dir):
    """Case 15/16 (2026-07-05 near-miss): `git commit --amend` rewrites shared
    HEAD — which may be ANOTHER session's just-landed commit (author identity
    can't discriminate: every session commits as the same git user). Rule:
    amend requires PROOF OF INSPECTION — the caller must have looked at HEAD
    and pinned it: `AMUX_AMEND_EXPECT=<head-sha> git commit --amend ...`.
    Allowed iff the pinned sha == actual current HEAD (kills the race where
    a foreign commit lands between your commit and your amend) AND HEAD is
    not already pushed (published history is never amended on shared trunk).
    Returns None to allow, or a block-reason string."""
    if not re.search(r'\bgit\s+(?:-C\s+\S+\s+)?commit\b[^\n;&|]*--amend\b', scrubbed):
        return None
    import subprocess
    def _git(*args):
        return subprocess.run(("git", "-C", run_dir) + args, capture_output=True,
                              text=True, timeout=10).stdout.strip()
    head = _git("rev-parse", "HEAD")
    if not head:
        return None  # fail-open
    # case 16: never amend published history
    for ref in ("origin/main", "origin/HEAD"):
        base = _git("merge-base", head, ref)
        if base == head:
            return ("git commit --amend on a PUSHED commit — published shared history is "
                    "never rewritten; make a follow-up commit instead")
    m = re.search(r'AMUX_AMEND_EXPECT=([0-9a-f]{7,40})\b', cmd)
    if m and head.startswith(m.group(1)):
        return None  # inspected + pinned + matches -> safe amend of own fresh HEAD
    got = f"pinned {m.group(1)} != HEAD {head[:12]}" if m else "no AMUX_AMEND_EXPECT pin"
    return ("git commit --amend without verified HEAD pin (" + got + ") — HEAD on this SHARED "
            "branch may be ANOTHER session's commit (2026-07-05 near-miss: an amend silently "
            "rewrote a foreign unpushed commit). Inspect first (`git log -1 --format=%H`), then "
            "re-run pinned: `AMUX_AMEND_EXPECT=<that-sha> git commit --amend ...` — the guard "
            "allows it only if HEAD still matches when the amend runs. If HEAD is not yours, "
            "use a follow-up commit instead")


def _discard_verdict(cmd, scrubbed, run_dir):
    """AC-212 (2026-08-04): block a PATH-SCOPED discard that would destroy ANOTHER
    session's uncommitted work.

    The guard above covers only TREE-WIDE destroys and its own docstring says
    path-scoped ops "pass". That exemption was written for multi-directory repos,
    where naming a path really does narrow the blast radius to your own work. It is
    exactly inverted in a SINGLE-FILE repo: `git checkout -- amux-server.py` names
    one path, and that one path holds every session's edits. I destroyed a peer's
    uncommitted fix that way while reverting my own ~20 lines; `git diff --stat`
    had said 63 insertions and I never asked whose the other 43 were.

    Why this direction deserves a guard MORE than the two that already have one:
    committing or pushing a peer's work is RECOVERABLE — the content is in the
    object store, revertable, and the PASSENGER convention names it. Destroying
    unstaged work leaves no object and no reflog entry. amux guarded both
    recoverable directions and left the unrecoverable one open.

    Detection is deliberately narrow, because a false block on `git checkout <branch>`
    would be worse than the gap:
      - checkout: only with an explicit `--` separator (a branch switch has none)
      - restore:  skipped when --staged/-S is present WITHOUT --worktree/-W, since
                  that only unstages and the worktree content survives
      - `.` is left to the tree-wide patterns above
    Attribution is not guessed here: it reuses POST /api/git/staged-guard, which is
    already generic ({session,dir,paths} -> foreign) rather than commit-specific, and
    derives ownership from each session's own JSONL transcript.

    Fail-open on anything unexpected, same posture as the rest of this guard.
    Returns a block-reason string, or None to allow."""
    import shlex, urllib.request, ssl, subprocess
    if not re.search(r'\bgit\s+(?:-C\s+\S+\s+)?(?:checkout|restore)\b', scrubbed):
        return None
    # Detect on `scrubbed` (so prose/docs that merely mention the command never
    # match), but extract the operands from the ORIGINAL cmd — scrubbing removes
    # quoted strings, which is where a filename with a space would live.
    paths = []
    for m in re.finditer(r'\bgit\s+(?:-C\s+\S+\s+)?(checkout|restore)\b([^\n;&|]*)', cmd):
        sub, tail = m.group(1), m.group(2)
        try:
            toks = shlex.split(tail)
        except ValueError:
            continue
        if sub == "checkout":
            if "--" not in toks:
                continue            # `git checkout <branch>` — switches, destroys nothing
            cand = toks[toks.index("--") + 1:]
        else:
            staged = any(t in ("--staged", "-S") for t in toks)
            worktree = any(t in ("--worktree", "-W") for t in toks)
            if staged and not worktree:
                continue            # unstage only; the worktree copy survives
            cand = (toks[toks.index("--") + 1:] if "--" in toks
                    else [t for t in toks if not t.startswith("-")])
        paths += [p for p in cand if p != "." and not p.startswith("-")]
    if not paths:
        return None
    top = subprocess.run(["git", "-C", run_dir, "rev-parse", "--show-toplevel"],
                         capture_output=True, text=True, timeout=10).stdout.strip()
    if not top:
        return None
    rel = []
    for p in paths:
        ap = os.path.realpath(os.path.join(run_dir, os.path.expanduser(p)))
        try:
            rel.append(os.path.relpath(ap, top))
        except Exception:
            pass
    if not rel:
        return None
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    base = amux_base_url()
    sess = os.environ.get("AMUX_SESSION", "")
    body = json.dumps({"session": sess, "dir": top, "paths": rel, "op": "discard"}).encode()
    req = urllib.request.Request(base + "/api/git/staged-guard", data=body, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "X-Amux-Session": sess})
    res = json.load(urllib.request.urlopen(req, timeout=4, context=ctx))
    foreign = res.get("foreign") or []
    shared = res.get("shared") or []
    # BLOCK ON shared AS WELL AS foreign (AC-221). The two consumers of this
    # endpoint cannot share one verdict:
    #   COMMIT  a co-edited file -> you have a real claim, and the peer's work
    #           survives in the object store either way. `shared` = warn is right.
    #   DESTROY a co-edited file -> the peer's uncommitted half is gone whether or
    #           not you also touched it. No object, no reflog entry. Having edited
    #           it too grants NO claim to delete it.
    # "Both of us wrote this" is a reason to let you commit it and a reason to stop
    # you deleting it. f85b162 correctly widened `mine` to count shell writes, which
    # moved co-edited files from foreign -> shared, and this consumer — keyed on
    # foreign alone — silently stopped blocking the exact command that motivated
    # AC-212. Keying on both is what makes the widening safe here.
    if not foreign and not shared:
        return None
    hits = foreign + shared
    who = ", ".join(sorted({f.get("owner", "?") for f in hits}))
    what = ", ".join(f.get("path", "?") for f in hits[:5])
    # Distinct wording: "also edited" is a different fact from "is theirs", and a
    # guard that says the wrong one gets argued with instead of obeyed.
    lead = ("discarding UNCOMMITTED work that belongs to another session"
            if foreign else
            "discarding a file ANOTHER SESSION HAS ALSO EDITED")
    return (lead + " — "
            f"{what} (recently edited by {who}). Naming a path does NOT make this "
            "yours in a shared checkout: in a single-file repo that one path holds "
            "every session's edits, and editing it too is not a claim to destroy "
            "their half. Unlike a bad commit or push, this is "
            "UNRECOVERABLE — no object, no reflog entry. Make it recoverable "
            "instead: `git stash push -- <paths>` keeps the content, or revert only "
            "your own hunks (`git diff` then a sliced `git apply -R`), or ask "
            f"{who} first")


def _has_cotenants(run_dir):
    """True if another live session shares this repo root. Fail-CLOSED to False
    (allow) on any error, matching the guard's standing fail-open contract: a
    guard that blocks when the server is down would wedge every lane."""
    try:
        import urllib.request, ssl
        body = json.dumps({"session": os.environ.get("AMUX_SESSION", ""),
                           "dir": run_dir, "paths": []}).encode()
        req = urllib.request.Request(
            amux_base_url() + "/api/git/staged-guard",
            data=body, method="POST",
            headers={"Content-Type": "application/json",
                     "X-Amux-Session": os.environ.get("AMUX_SESSION", "")})
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=4, context=ctx) as r:
            return bool((json.loads(r.read().decode()) or {}).get("cotenants"))
    except Exception as _e:
        # Fail-open stays (see docstring): blocking every lane when the server
        # is down is worse than missing a warning. What changes is that the skip
        # is no longer SILENT. A quiet False is indistinguishable from "checked,
        # and you have no co-tenants" — so a session reads clean output as
        # verification it never received.
        #
        # This is not hypothetical and the coincidence is the point: the server
        # re-execs on every save of amux-server.py, so editing THAT file takes
        # the guard offline for a few seconds at a time. The one file where a
        # co-edit sweep is most likely on this checkout is the one whose editing
        # disables the check. On 2026-08-06 a commit swept ~93 lines of a peer's
        # work with no warning shown, during exactly such a window.
        try:
            sys.stderr.write("amux staged-guard: SKIPPED — could not reach the "
                             "amux server (" + type(_e).__name__ + "). Co-tenant "
                             "attribution was NOT checked; if you are committing a "
                             "shared file, run `git diff --cached --numstat` and "
                             "confirm the size matches what you wrote.\n")
        except Exception:
            pass
        return False


def main():
    data = json.load(sys.stdin)
    if data.get("tool_name") != "Bash":
        return 0
    cmd = (data.get("tool_input") or {}).get("command", "") or ""
    scrubbed = _scrub(cmd)                       # match only real invocations
    cwd = data.get("cwd") or os.getcwd()
    shared = [os.path.realpath(os.path.expanduser(p)) for p in
              os.environ.get("AMUX_SHARED_CHECKOUTS", "~/Dev/mixpeek").split(":") if p.strip()]
    mC = re.search(r'-C\s+(\S+)', scrubbed)
    run_dir = os.path.realpath(os.path.expanduser(mC.group(1))) if mC else os.path.realpath(cwd)
    # WHERE run_dir CAME FROM, said out loud in the refusal (AF-23). Otherwise the
    # message asserts a repo path as FACT, and when the inference is wrong it still
    # reads as a true positive: a compound command that `cd`s into a throwaway clone
    # and commits THERE is blocked as though it targeted the shared checkout, naming
    # a repo the command never touched. Hit 2026-08-09 building a scratch clone.
    #
    # Deliberately NOT parsing `cd` out of the command, and that is the whole design
    # decision. A wrong parse fails OPEN on a real cross-session sweep — the exact
    # thing this guard exists to catch — and `cd a; cd b && git ...` is not safely
    # parseable. The asymmetry is decisive: a false positive costs one retry, a false
    # negative costs another session's uncommitted work.
    #
    # `-C` already resolves one line up, so a precise escape ALREADY EXISTS and the
    # refusal simply never named it. That was the real defect — an escape nobody is
    # told about is not an escape. Point at the path that works rather than guessing.
    _dir_note = ("" if mC else
                 "\n  (Repo INFERRED from this session's working directory — the guard cannot "
                 "see a `cd` inside a compound command. If you meant a different repo, such as "
                 "a scratch clone, re-run as `git -C <path> ... -- <paths>` and the guard will "
                 "evaluate THAT repo instead.)")
    # The discard check runs BEFORE the static-scope gate below, and deliberately so.
    # AMUX_SHARED_CHECKOUTS is unset in every session env, in the shell, and in
    # amux-server.py, so `shared` is the hardcoded default ~/Dev/mixpeek — while
    # ~/Dev/amux is a documented shared checkout with 6 lanes whose ENTIRE codebase
    # is one file. The incident this check exists for happened there, so gating it on
    # that list would have produced a guard that cannot fire on its own motivating
    # case. A static list of shared checkouts drifts by construction; it needs a human
    # to notice a repo became shared.
    # This check does not need the list: it self-scopes on REAL cotenant data from
    # /api/git/staged-guard (repo-root paired, AMUX-2337). No cotenants -> no foreign
    # paths -> allow. In a genuinely private repo it costs one rev-parse and one
    # localhost POST on `git checkout -- <paths>` / `git restore <paths>`, and nothing
    # at all on any other command.
    discard_why = None
    _dv_err = None
    # RETRY BEFORE REFUSING (AC-287). The amux server re-execs on every save of
    # amux-server.py, which on this shared checkout happens many times an hour, so
    # a single 4s timeout is a routine event rather than an outage. Failing closed
    # on the first miss would refuse legitimate discards during every restart —
    # caught by a control in review: the guard blocked with a reachable server
    # purely because the call landed in a reload window. Three tries over ~6s costs
    # nothing on an operation this rare and removes that whole false-refusal class.
    for _dv_try in range(3):
        try:
            discard_why = _discard_verdict(cmd, scrubbed, run_dir)
            _dv_err = None
            break
        except Exception as _e:
            _dv_err = _e
            if _dv_try < 2:
                import time as _t   # inline, matching this hook's import style
                _t.sleep(2)
    if _dv_err is not None:
        # FAIL CLOSED HERE, unlike everywhere else in this guard (AC-287).
        # The standing contract is fail-OPEN: a guard that blocks when the server
        # is down wedges every lane, and for a COMMIT that trade is right — the
        # peer's work survives in the object store either way, so the cost of a
        # missed warning is a glance.
        #
        # A DISCARD is not that. It is UNRECOVERABLE: no object, no reflog entry.
        # A missed block is permanent data loss belonging to someone who is not
        # even at the keyboard. Measured 2026-08-07 with the server unreachable:
        # exit 0, no output, the destroy proceeded — and the only thing printed
        # was the co-tenant SKIP notice, which talks about COMMITTING a shared
        # file while the user is DISCARDING one, so it named the wrong operation
        # for the one case where the stakes are highest.
        #
        # This is the same asymmetry that motivated AC-221 — "both of us wrote
        # this" is a reason to let you commit and a reason to stop you deleting —
        # applied one level up, to the FAILURE MODE rather than the verdict. One
        # fail-open policy cannot serve a recoverable and an unrecoverable
        # consumer. The override below is the sanctioned escape and stays
        # available, so this is refusable, not a wedge.
        discard_why = ("cannot verify co-tenancy — the amux server is unreachable "
                       f"({type(_dv_err).__name__}). REFUSING an unrecoverable "
                       "discard rather than guessing: unlike a commit, this leaves "
                       "no object and no reflog entry, so a wrong guess is "
                       "permanent and the work destroyed may not be yours. Re-run "
                       "when the server answers, or use `git stash push -- <paths>` "
                       "which is reversible")
    if discard_why:
        if _consume_override(cmd):
            sys.stderr.write(f"amux guard: ALLOWED once (owner-sanctioned): {discard_why}\n")
        else:
            sys.stderr.write(
                f"BLOCKED by amux shared-checkout guard: {discard_why}.\n"
                f"'{run_dir}' is a SHARED checkout used by multiple agent sessions.{_dir_note}\n"
                f"OWNER-AUTHORIZED one-off: write the exact command to ~/.amux/guard-allow-once "
                f"and re-run (consumed once, audit-logged).\n")
            return 2
    # SELF-SCOPE the tree-wide checks too, instead of trusting a static list.
    # AMUX_SHARED_CHECKOUTS is unset everywhere, so `shared` was the hardcoded
    # ~/Dev/mixpeek and `git reset --hard` / `git clean -fd` were ALLOWED in
    # ~/Dev/amux — 6 lanes, entire codebase in one file, and the repo holding
    # this guard's own source. Measured, control-first: reset --hard BLOCKED in
    # mixpeek, allowed in amux. A list that must be edited when a repo becomes
    # shared drifts by construction, and nobody edited it for ~/Dev/amux.
    #
    # A checkout is SHARED if another live session actually resolves to the same
    # repo root — real data, repo-root paired (AMUX-2337), the same source the
    # discard check above already uses. The list stays as an ADDITIVE override so
    # an explicitly-named root is still guarded even with no cotenants online.
    if not any(run_dir == s or run_dir.startswith(s + os.sep) for s in shared):
        if not _has_cotenants(run_dir):
            return 0
    amend_why = None
    try:
        amend_why = _amend_verdict(cmd, scrubbed, run_dir)
    except Exception:
        amend_why = None  # fail-open, same posture as the rest of the guard
    if amend_why:
        if _consume_override(cmd):
            sys.stderr.write(f"amux guard: ALLOWED once (owner-sanctioned): {amend_why}\n")
        else:
            sys.stderr.write(
                f"BLOCKED by amux shared-checkout guard: {amend_why}.\n"
                f"'{run_dir}' is a SHARED checkout used by multiple agent sessions.{_dir_note}\n"
                f"OWNER-AUTHORIZED one-off: write the exact command to ~/.amux/guard-allow-once "
                f"and re-run (consumed once, audit-logged).\n")
            return 2
    # Path-scoped discard of a PEER's uncommitted work (AC-212). Runs before the
    # tree-wide table below, whose own remedy line tells callers to "scope to YOUR
    # OWN paths" — this is what makes "your own" enforced rather than advisory.
    discard_why = None
    _dv_err = None
    # RETRY BEFORE REFUSING (AC-287). The amux server re-execs on every save of
    # amux-server.py, which on this shared checkout happens many times an hour, so
    # a single 4s timeout is a routine event rather than an outage. Failing closed
    # on the first miss would refuse legitimate discards during every restart —
    # caught by a control in review: the guard blocked with a reachable server
    # purely because the call landed in a reload window. Three tries over ~6s costs
    # nothing on an operation this rare and removes that whole false-refusal class.
    for _dv_try in range(3):
        try:
            discard_why = _discard_verdict(cmd, scrubbed, run_dir)
            _dv_err = None
            break
        except Exception as _e:
            _dv_err = _e
            if _dv_try < 2:
                import time as _t   # inline, matching this hook's import style
                _t.sleep(2)
    if _dv_err is not None:
        # FAIL CLOSED HERE, unlike everywhere else in this guard (AC-287).
        # The standing contract is fail-OPEN: a guard that blocks when the server
        # is down wedges every lane, and for a COMMIT that trade is right — the
        # peer's work survives in the object store either way, so the cost of a
        # missed warning is a glance.
        #
        # A DISCARD is not that. It is UNRECOVERABLE: no object, no reflog entry.
        # A missed block is permanent data loss belonging to someone who is not
        # even at the keyboard. Measured 2026-08-07 with the server unreachable:
        # exit 0, no output, the destroy proceeded — and the only thing printed
        # was the co-tenant SKIP notice, which talks about COMMITTING a shared
        # file while the user is DISCARDING one, so it named the wrong operation
        # for the one case where the stakes are highest.
        #
        # This is the same asymmetry that motivated AC-221 — "both of us wrote
        # this" is a reason to let you commit and a reason to stop you deleting —
        # applied one level up, to the FAILURE MODE rather than the verdict. One
        # fail-open policy cannot serve a recoverable and an unrecoverable
        # consumer. The override below is the sanctioned escape and stays
        # available, so this is refusable, not a wedge.
        discard_why = ("cannot verify co-tenancy — the amux server is unreachable "
                       f"({type(_dv_err).__name__}). REFUSING an unrecoverable "
                       "discard rather than guessing: unlike a commit, this leaves "
                       "no object and no reflog entry, so a wrong guess is "
                       "permanent and the work destroyed may not be yours. Re-run "
                       "when the server answers, or use `git stash push -- <paths>` "
                       "which is reversible")
    if discard_why:
        if _consume_override(cmd):
            sys.stderr.write(f"amux guard: ALLOWED once (owner-sanctioned): {discard_why}\n")
        else:
            sys.stderr.write(
                f"BLOCKED by amux shared-checkout guard: {discard_why}.\n"
                f"'{run_dir}' is a SHARED checkout used by multiple agent sessions.{_dir_note}\n"
                f"OWNER-AUTHORIZED one-off: write the exact command to ~/.amux/guard-allow-once "
                f"and re-run (consumed once, audit-logged).\n")
            return 2
    for pat, why in DANGER:
        if re.search(pat, scrubbed):
            if _consume_override(cmd):
                sys.stderr.write(f"amux guard: ALLOWED once (owner-sanctioned via ~/.amux/guard-allow-once): {why}\n")
                return 0
            sys.stderr.write(
                f"BLOCKED by amux shared-checkout guard: {why}.\n"
                f"'{run_dir}' is a SHARED checkout used by multiple agent sessions — this discards or "
                f"sweeps up EVERY session's uncommitted work. Scope to YOUR OWN paths instead: "
                f"`git checkout -- <yourfile>`, `git stash push -- <yourpath>`, or commit your files. "
                f"For pulls, fetch+rebase on committed state or verify the autostash popped.{_dir_note}\n"
                f"OWNER-AUTHORIZED one-off: after sign-off, write the exact command to "
                f"~/.amux/guard-allow-once and re-run (consumed once, audit-logged) — do NOT route around "
                f"the guard via reflog.\n")
            return 2
    return 0

try:
    sys.exit(main())
except Exception:
    sys.exit(0)  # fail-open: a guard bug must never break tool calls
