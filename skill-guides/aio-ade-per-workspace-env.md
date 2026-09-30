---
name: aio-ade-per-workspace-env
description: >-
  Set up, review, debug, or validate AIO-ADE per-workspace environment recipes —
  on-demand, disposable runtimes (cloud sandboxes, VMs, or local) created fresh
  for each workspace. Covers first-time setup (provider prerequisites, the
  reusable base snapshot, the coding-agent auth snapshot, credentials, and
  state), not just the per-workspace lifecycle scripts. Use to stand up
  per-workspace environments, fix an `environmentRecipes` entry in `aio-ade.yaml`, scaffold
  provider lifecycle scripts, or resolve an `aio-ade vm recipe doctor` failure.
---

# Per-Workspace Environments

Help a user stand up and maintain a repo-owned per-workspace environment recipe end to end. Each
workspace gets its own on-demand, disposable runtime (a cloud sandbox, a VM, or a local one),
created fresh and torn down after.

AIO-ADE is a **thin wrapper**: you guide, detect, and scaffold; you never own the user's cloud account,
billing, images, or credentials.

- **You DO:** sequence the setup, detect what's detectable (provider CLI present/logged-in? recipe
  present? `doctor` passing?), scaffold provider-templated scripts the user fills in, drive the slow
  snapshot/auth phases with the user, and always show the next action.
- **You DO NOT:** create accounts, choose plans/regions, invent org/project/scope ids, store or print
  secrets, or run anything that spends money without an explicit user OK.

First-time setup has **four phases before the per-workspace recipe runs** — easy to miss, so walk
them in order:

1. **Prerequisites** — cloud account, provider CLI, scope/project, plan limits, git token (§2).
2. **Base snapshot** — reusable image: tools + repo + headless build, snapshotted once (§3).
3. **Agent-auth snapshot** — boot the base, run interactive device-auth, re-snapshot (§4).
4. **State** — thread snapshot id / scope / project / port between phases via a state file (§6).

Then the **per-workspace contract** (create/suspend/resume/destroy) runs fast (§8).

**Connection is always SSH:** AIO-ADE dials into the environment over its SSH relay, brings up the git +
filesystem providers, and imports the repo. `create` runs no server in the env — it makes the host/VM ready
and prints a `connection.type:"ssh"` block (§7c, §7f/§7g).

**Quick-start (happy path):** interview the user (provider, SSH reachability — host/port/user/identity or
proxy, agent CLI, git auth — §1.2) + read the provider's CLI docs → scaffold `scripts/aio-ade-vm/` from §7 →
run the base-snapshot script, then the auth script (you invoke these by hand; not via `aio-ade.yaml`) → wire
`environmentRecipes` in `aio-ade.yaml` → `aio-ade vm recipe doctor <id> --json` (free) → then the `--provision`
self-test loop (§9) until it passes.

---

## 1. Setup workflow

Drive these with the user. **[CHECKPOINT]** steps need explicit confirmation — they spend money, take
a long time, or need the user at the keyboard. Never create an AIO-ADE workspace or commit unless asked.

1. **Inspect the repo** for an existing `environmentRecipes` entry, `scripts/aio-ade-vm/`, a state file, or setup
   notes. If a working recipe exists, jump to Doctor (§9) instead of rebuilding.
2. **Interview the user up front** — gather these choices and confirm them back before scaffolding
   anything. Don't pick for them (§11); don't guess.
   - **Provider + SSH reachability:** Vercel Sandbox, Fly, Modal, an existing SSH host, … AIO-ADE connects
     over SSH (worked examples §7f/§7g), so the provider must expose a real dialable SSH target
     (host/port/user/key or proxy command) — a provider-mediated interactive shell is not enough. For
     non-obvious providers, also ask scope/project/region and plan limits (§2). Then **read that
     provider's CLI/SDK docs** (or `<cli> --help`) before scaffolding — you need its exact
     create/exec/snapshot/remove verbs.
   - **Coding-agent CLI + account:** which agent runs in the VM (`codex`, `claude`, …) and that the user
     has an account for it — it gets logged in during the Phase-3 auth snapshot (§4).
   - **Git auth:** the token source for cloning a private repo (`GH_TOKEN`/`GITHUB_TOKEN` or `gh auth
     token`; §5).
3. **Check prerequisites (§2)** — detect the provider CLI + auth and confirm the items above are in
   place before any paid step.
4. **Scaffold scripts + state file** from §7 (worked examples: cloud VM §7f, existing SSH host §7g; Docker
   SSH: §7h; Windows: §7i), filling in the provider's real commands. Make them executable.
5. **[CHECKPOINT] Build the base snapshot (§3)** — paid, slow.
6. **[CHECKPOINT] Authenticate the agent (§4)** — interactive; the user follows a URL/code. **You cannot
   drive this step** — you run commands non-interactively, so there's no TTY for `docker exec -it` /
   `ssh -t` to prompt against. The **user** runs the Phase-3 login in their own terminal (or via the
   Claude Code harness bang-prefix — `! <cmd>`, with the required space after `!`); you scaffold and drive
   the non-interactive phases around it. After kicking it off, **ask the user to report back once the login
   finishes** — you can't observe it completing, and you need that confirmation before resuming the
   non-interactive steps (base/auth commit, doctor, provision).
7. **Wire the recipe** so `aio-ade.yaml` points create/suspend/resume/destroy at the scripts (§8). The
   workspace composer reads `environmentRecipes` from the project's primary checkout of `aio-ade.yaml`, **not** from
   a feature branch or worktree. So a recipe added only on a branch won't appear as a "Run on" option
   until that `aio-ade.yaml` change is committed and merged to the project's primary branch. Tell the user
   this up front: `doctor`/`--provision` validate the scripts from the working copy on any branch, but
   creating a workspace from the recipe in the picker needs it on primary.
8. **Dry-run doctor** — `aio-ade vm recipe doctor <recipe-id> --repo-path <repo> --json` (free, static; §9).
   Fix every failure before going live.
9. **[CHECKPOINT] Live self-test** — get the user's OK once, then run
   `aio-ade vm recipe doctor <recipe-id> --provision --json` as a loop: it runs create → validates →
   destroys, and on failure returns a full transcript. Read it, fix the scripts, and re-run yourself until
   it passes (§9). Spends cloud money; the one approval covers the loop.
10. **[CHECKPOINT] Optional workspace test** — only if asked: create a workspace via the picker, then
    verify sleep/wake/delete.

---

## 2. Phase 1 — Prerequisites

The user's responsibility; verify what's verifiable, ask for the rest, invent nothing. State which
items you verified vs. which the user asserted.

- **SSH target confirmed** — the env must expose a dialable SSH endpoint (host/port/username/identity or a
  proxy command) that AIO-ADE's relay can reach; see §1 step 2 and §7g.
- **Cloud account + plan** that allows sandboxes/VMs. Ask.
- **Provider CLI installed + authenticated** — detect (`command -v <cli>`), check auth (e.g.
  `vercel whoami`). If missing, point at the provider's docs; don't log them in.
- **Scope / project / region** the sandboxes live under. Ask; flows into every script via state.
- **Plan / timeout / RAM caps.** Record them — e.g. Vercel Hobby caps sandbox timeout at **45m**,
  which limits both the base build and per-workspace runtime (see §10).
- **Git token for private repos** (`GH_TOKEN`/`GITHUB_TOKEN`, or the provider's git auth; can fall back
  to `gh auth token`). See §5.
- **Coding-agent CLI choice** (`codex`, `claude`…) and that the user has an account — it gets
  authenticated into the VM in Phase 3.

---

## 3. Phase 2 — Base snapshot (the reusable image)

Build **once**, snapshot, and every workspace boots from it in seconds instead of rebuilding.
Provisioning + building takes a while (often ~20–30 min), so it runs behind a checkpoint. The script
shape is §7a; key points:

- Build the **headless Electron main only** (not the renderer) so it fits in plan RAM.
- Use the VM image's package manager (`apt`/`dnf`/`apk`, per the base distro — not the provider brand).
- Clone with the git token via `GIT_ASKPASS` (§5).
- **Trap errors and remove the half-built sandbox** so a crash doesn't leave a paid resource running.
- Snapshot the stopped sandbox, parse the snapshot id, and write it + scope/project/port/repo to state.

---

## 4. Phase 3 — Agent-auth snapshot (interactive)

The base snapshot has the agent CLI installed but **not logged in**, and per-workspace VMs are
ephemeral — so authenticate once and bake it into a second snapshot layer. Script shape is §7b:

1. Boot a sandbox from the base `snapshotId` (from state).
2. Run the agent's login **interactively** (`--interactive --tty`); the user completes the URL/code in
   their browser. On a **headless VM this must be the device-auth flow** (e.g. `codex login --device-auth`),
   **not** plain `codex login`: the default OAuth login starts a loopback callback server on a container
   port the host browser can't reach, so it hangs. Device-auth instead prints a URL + code the user opens
   on the **host**.
3. Verify login; **refuse to snapshot an unauthenticated VM.** Prefer the status command's **exit code**
   (most agent CLIs exit non-zero when unauthenticated). If you grep instead, agent status often goes to
   **stderr** (e.g. `codex login status` prints "Logged in using ChatGPT" there), so **fold stderr first**
   (`... 2>&1 | grep …`) and match the agent's **exact success line** — never `grep -qi 'logged in'`, which
   also matches "**not** logged in" and would commit an unauthenticated image.
4. Re-snapshot, parse the new id, and overwrite `snapshotId` in state to the authenticated image
   (recording `authSourceSnapshotId`). Remove the auth sandbox.

**You can't drive step 2 yourself** (you run commands non-interactively — no TTY). The **user** runs it in
their own terminal, or via the Claude Code harness bang-prefix (`! <cmd>`, with the required space after
`!`). You scaffold/boot the sandbox and run steps 3–4, but **you cannot observe the interactive login
finishing** — so **ask the user to tell you when it's done** before you verify and re-snapshot.

If the agent's credentials are short-lived, warn that the snapshot may need periodic re-auth (§10).

For disposable runtimes, do **not** treat a host agent config directory (for example `~/.codex`) as the
auth snapshot by bind-mounting or copying it wholesale. Agent homes often contain sqlite state, hook
approval state, caches, logs, and host-specific env/config. Instead, authenticate/configure the agent
inside the disposable runtime and snapshot/commit that runtime layer.

---

## 5. Credentials

- **Never** commit secrets or put them in `userData`, recipe JSON, comments, docs, or the state file.
- **Git token:** read from env (`GH_TOKEN`/`GITHUB_TOKEN`), falling back to `gh auth token`. Pass to the
  VM only via the provider's ephemeral `--env`. Inside the VM, use a `GIT_ASKPASS` helper with
  `x-access-token` (not the token in the clone URL) and `GIT_TERMINAL_PROMPT=0` so a missing token fails
  fast instead of hanging. When you write the helper from inside `bash -lc` under `set -u`, escape the
  positional arg and the token (`\$1`, `\$GH_TOKEN`) so they land **literally** and resolve at git-runtime
  — an unescaped `$1` aborts with "unbound variable", and a literal `$GH_TOKEN` keeps the real token out of
  the written file. `rm -f` the helper after the clone/fetch.
- **Provider auth:** rely on the provider CLI's logged-in session, not checked-in keys.
- **Agent auth:** lives in the authenticated snapshot (Phase 3) — never a file you write or commit.
- State holds only **non-secret** wiring (snapshot ids, scope, project, port, repo url/ref).

---

## 6. State file

A repo-local JSON file (e.g. `scripts/aio-ade-vm/<provider>-state.json`) threads non-secret values between
phases. Each script resolves values as **env var → state → built-in fallback**, and merges its outputs
back. Phase 2 writes the base `snapshotId`; Phase 3 overwrites it with the authenticated snapshot;
per-workspace `create` boots from `snapshotId`.

```json
{
  "baseName": "aio-ade-base",
  "snapshotId": "snap_authenticated_image_id",
  "authSourceSnapshotId": "snap_base_image_id",
  "scope": "<provider-scope>",
  "project": "<provider-project>",
  "port": 22,
  "repoUrl": "https://host/org/repo.git",
  "repoRef": "main",
  "projectRoot": "/abs/path/on/remote/repo"
}
```

---

## 7. Script templates (provider-agnostic shapes)

Scaffold under `scripts/aio-ade-vm/`. These are **shapes** — fill in the provider's real commands. All
reserve stdout for the final JSON and log progress to stderr. Include a shared `json_value <key>` /
`env_value <NAME>` reader (env → state → fallback) in each.

**Where each script runs:**

- **Local-side** (`create`/`suspend`/`resume`/`destroy` + the base-snapshot/auth scripts the user
  invokes) runs **on the user's desktop**, so it must run on their OS. macOS/Linux: `#!/usr/bin/env
  bash`, `set -euo pipefail`, quoted paths. **Windows:** a bare `.sh` won't run — scaffold `.ps1`/`.cmd`
  or require WSL/Git-Bash and point `aio-ade.yaml` at the right launcher.
- **Remote-side** (commands you `exec` *inside* the Linux VM) always runs in the VM's Linux shell, so
  bash is fine there regardless of the user's OS.

### 7a. Base-snapshot (`<provider>-base-snapshot.sh`) — Phase 2

```bash
#!/usr/bin/env bash
set -euo pipefail
# resolve base_name/repo_url/repo_ref/project_root/port/scope/project/timeout (env→state→fallback)
# resolve gh token: GH_TOKEN | GITHUB_TOKEN | `gh auth token`
# 1. provision a sandbox (timeout/vcpus/snapshot retention — published port only if the provider reaches
#    sshd that way, §7f); trap: remove on error
# 2. remote exec (long timeout): install pkgs + gh + corepack/pnpm + agent CLI;
#    clone with GIT_ASKPASS(token); write headless main-only build config;
#    dev setup; pnpm install; build CLI; build headless electron main; smoke-check tools
# 3. snapshot stopped sandbox; parse snapshot id (fail if unparseable)
# 4. merge { baseName, snapshotId, projectRoot, repoUrl, repoRef, port, scope, project } into state
# print only the state JSON to stdout
```

Worked Vercel commands for this phase are in §7f. You run this script by hand (not via `aio-ade.yaml`),
after exporting the first-run inputs the state file doesn't have yet — e.g. provider scope/project, the
repo URL/ref, and a git token (`GH_TOKEN`); later runs read them back from state.

### 7b. Auth (`<provider>-base-auth.sh`) — Phase 3

```bash
#!/usr/bin/env bash
set -euo pipefail
# read source snapshot from state.snapshotId (fail if absent); auth_name="${base_name}-auth"
# 1. boot sandbox from source snapshot; trap: remove on error
# 2. INTERACTIVE/TTY remote exec: agent login — user completes URL/code. Headless VM: MUST use the
#    device-auth flow (e.g. `codex login --device-auth`) — plain OAuth login binds a loopback callback
#    port the host can't reach and hangs. User runs this themselves (you have no interactive TTY); ask
#    them to report back when it's done before continuing.
# 3. verify login, then refuse to snapshot if not logged in. Prefer the status command's EXIT CODE (most
#    agent CLIs exit non-zero when unauthenticated) over string-matching. If you must grep, fold stderr
#    first (`status 2>&1 | grep …` — many agents print the success line there) and match the agent's exact
#    success line; never `grep -qi 'logged in'`, which also matches "not logged in". Codex example: §7f.
# 4. snapshot; parse new id
# 5. merge { snapshotId:<new>, authSourceSnapshotId:<source> } into state; remove auth sandbox
# print only the state JSON to stdout
```

### 7c. Create (`<provider>-create.sh`) — per workspace

```bash
#!/usr/bin/env bash
set -euo pipefail
# read authenticated snapshotId/scope/project/ssh_*/repo*/project_root (env→state→fallback)
# fail clearly if snapshotId is missing (point back to Phases 2–3)
# name = aio-ade-${AIO_ADE_VM_RECIPE_ID}-${AIO_ADE_VM_INSTANCE_ID} (sanitized, length-capped)
# 1. boot sandbox from snapshotId; resolve its dialable SSH endpoint (host/port/username/identity or a
#    proxy command — provider-dependent); trap: remove sandbox on error
# 2. over SSH: ensure repo at desired commit; rebuild only if commit changed (cache marker)
# 3. print the SSH connection block to stdout, enriched with userData:
#    { schemaVersion:1, connection:{ type:"ssh", projectRoot, target:{ label, host, port, username, … } },
#      userData:{ provider, resourceId:name, snapshotId } }
```

**The result is the `connection` block, not a server URL.** AIO-ADE dials `target` over its own SSH
relay — there is no in-env daemon for the script to start or read (the in-env server + pairing-URL
output channel was removed when `aio-ade`'s serve command was deleted). Required/optional `target`
fields and a complete script: §7g; Docker variant: §7h.

### 7d. Suspend / resume / destroy — per workspace

```bash
#!/usr/bin/env bash
set -euo pipefail
payload="$(cat)"                       # AIO-ADE passes lifecycle JSON on stdin
resource_id="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d.recipeResult?.userData?.resourceId ?? "")' "$payload")"
[ -n "$resource_id" ] || { echo "No resource id in lifecycle payload" >&2; exit 1; }
# suspend: provider suspend "$resource_id"
# resume:  provider resume "$resource_id"; then RE-EMIT fresh recipe JSON (the SSH target may change)
# destroy: provider remove "$resource_id"   (or set destroy: none in aio-ade.yaml)
```

### 7e. State file — scaffold with scope/project/repo filled in and snapshot ids empty (§6).

### 7f. Worked example — cloud snapshot VM (Vercel Sandbox, all three phases)

A real, working shape (the Vercel surface is a CLI: `vercel sandbox create|exec|snapshot|remove`). Adapt
names; verify flags against `vercel sandbox --help` for the user's CLI version before relying on them.
These ground §7a (base snapshot) and §7b (auth), which are otherwise generic skeletons. Per-workspace
`create` connects over SSH: it must resolve the sandbox's dialable SSH endpoint and emit a
`connection.type:"ssh"` block (shape + field rules: §7g).

**Phase 2 — base snapshot (§7a):** provision → install tools + clone + headless build → snapshot.

```bash
# provision a fresh build sandbox (retain a couple of snapshots); trap-remove on error
# publish a port only if the provider maps a published port to the sandbox's sshd (most don't — check
# the provider's SSH reachability docs; §1 step 2)
vercel sandbox create --name "$base" --runtime node24 --timeout 30m --vcpus 4 \
  --snapshot-expiration 30d --keep-last-snapshots 2 "${vercel_args[@]}" >&2
# remote build (long timeout): install pkgs+gh+pnpm+agent CLI, clone with GIT_ASKPASS (write the helper
# with LITERAL \$1/\$GH_TOKEN so they resolve at git-runtime, not write-time — see §5/§7f create — then
# `rm -f /tmp/askpass.sh`), write the headless main-only build config (drop the renderer), dev setup,
# build CLI + headless main, smoke-check
vercel sandbox exec "$base" "${vercel_args[@]}" --timeout 25m --env "GH_TOKEN=$gh_token" … -- bash -lc '…build…' >&2
# snapshot the STOPPED sandbox and parse the id from CLI output (fail if unparseable)
out="$(vercel sandbox snapshot "$base" --stop --expiration 30d "${vercel_args[@]}" 2>&1)"; printf '%s\n' "$out" >&2
snapshot_id="$(printf '%s\n' "$out" | sed -nE 's/.*(snap_[A-Za-z0-9]+).*/\1/p' | tail -1)"
# merge { baseName, snapshotId, scope, project, port, repoUrl, repoRef, projectRoot } into state; print state JSON
```

**Phase 3 — agent-auth snapshot (§7b):** boot the base, log the agent in interactively, re-snapshot.
(`codex` below is an example — substitute the user's chosen agent's login/status verbs, e.g. `claude`.)

```bash
vercel sandbox create --name "$auth" --snapshot "$snapshot_id" --timeout 30m "${vercel_args[@]}" >&2
# INTERACTIVE — the USER runs this in their own terminal (you have no interactive TTY) and completes the
# URL/code on the HOST. --device-auth is MANDATORY on a headless VM: plain `codex login` binds a loopback
# callback port the host browser can't reach and hangs. Ask the user to report back when login finishes.
vercel sandbox exec --interactive --tty "$auth" "${vercel_args[@]}" -- bash -lc 'codex login --device-auth'
# refuse to snapshot an unauthenticated VM — fold stderr, match codex's exact success line (§4)
vercel sandbox exec "$auth" "${vercel_args[@]}" --timeout 30s -- bash -lc 'codex login status 2>&1' | grep -Eqi 'Logged in using ChatGPT|Logged in via device' \
  || { echo "agent not logged in; not snapshotting" >&2; exit 1; }
out="$(vercel sandbox snapshot "$auth" --stop --expiration 30d "${vercel_args[@]}" 2>&1)"; printf '%s\n' "$out" >&2
new_id="$(printf '%s\n' "$out" | sed -nE 's/.*(snap_[A-Za-z0-9]+).*/\1/p' | tail -1)"
# overwrite state.snapshotId = new_id, record authSourceSnapshotId = snapshot_id; remove the auth sandbox
```

**Per-workspace `create`** (the fast path):

```bash
#!/usr/bin/env bash
set -euo pipefail
# resolve from env→state→fallback: snapshot_id, scope, project, ssh_user, ssh_port, identity_file,
#   repo_url, repo_ref, project_root  (default unset optionals to "")
: "${identity_file:=}"
vercel_args=(); [ -n "$scope" ] && vercel_args+=(--scope "$scope"); [ -n "$project" ] && vercel_args+=(--project "$project")
[ -n "$snapshot_id" ] || { echo "snapshotId missing — run Phases 2–3 first" >&2; exit 1; }
gh_token="${GH_TOKEN:-${GITHUB_TOKEN:-$(command -v gh >/dev/null 2>&1 && gh auth token 2>/dev/null || true)}}"
name="aio-ade-${AIO_ADE_VM_RECIPE_ID:-vercel-sandbox}-${AIO_ADE_VM_INSTANCE_ID:-$(date +%s)}"  # sanitize+cap to 63 chars

# Arm cleanup BEFORE create so a failing create can't leak a half-built paid sandbox.
cleanup_on_error() { [ "$?" -ne 0 ] && vercel sandbox remove "$name" "${vercel_args[@]}" >/dev/null 2>&1 || true; }
trap cleanup_on_error EXIT

# 1. boot from the authenticated snapshot
vercel sandbox create --name "$name" --snapshot "$snapshot_id" --timeout 30m "${vercel_args[@]}" >&2
# resolve the sandbox's dialable SSH endpoint into ssh_host/ssh_port/… here — the mechanism is
# provider-specific (an sshd baked into the base image behind a published port, a provider ssh command
# usable as proxyCommand, a tunnel, …); see the provider's docs. ssh_keyscan it into known_hosts so a
# first-connect prompt can't hang AIO-ADE's non-interactive dial.

# 2. (SSH) ensure the repo is at the right commit; rebuild only if the commit changed (cache marker).
#    Re-establish git auth for the private-repo fetch (why + full rationale: §5); else it hangs on a prompt.
#    The GIT_ASKPASS helper's escaping is load-bearing: \$1 and \$GH_TOKEN must land LITERALLY and resolve
#    at git-runtime. Test after any edit — reformatting the nested quoting silently breaks the fetch or
#    leaks the token.
ssh -p "$ssh_port" ${identity_file:+-i "$identity_file"} "$ssh_user@$ssh_host" \
  "GH_TOKEN='$gh_token' GIT_TERMINAL_PROMPT=0 bash -lc '
     set -euo pipefail
     cd \"$project_root\"
     if [ -n \"\${GH_TOKEN:-}\" ]; then
       printf \"%s\n\" \"#!/usr/bin/env bash\" \"case \\\"\$1\\\" in *Username*) echo x-access-token;; *Password*) echo \\\"\$GH_TOKEN\\\";; esac\" > /tmp/askpass.sh
       chmod 700 /tmp/askpass.sh; export GIT_ASKPASS=/tmp/askpass.sh GIT_TERMINAL_PROMPT=0
     fi
     git fetch origin \"$repo_ref\" && git checkout -B \"$repo_ref\" FETCH_HEAD
     rm -f /tmp/askpass.sh
     c=\$(git rev-parse HEAD)
     [ -f .aio-ade-built ] && [ \"\$(cat .aio-ade-built)\" = \"\$c\" ] || {
       pnpm install --prefer-offline && pnpm run build:cli && printf \"%s\" \"\$c\" > .aio-ade-built; }
   '" >&2

# 3. print the SSH connection block enriched with userData (single object on stdout; §7g for fields)
node -e 'const [host,port,user,idf,name,snap,root]=process.argv.slice(1);
  const target={ label:name, host, port:Number(port), username:user };
  if(idf) target.identityFile=idf;  // or target.proxyCommand=… / target.jumpHost=… per how you dial
  console.log(JSON.stringify({ schemaVersion:1,
    connection:{ type:"ssh", projectRoot:root, target },
    userData:{ provider:"vercel-sandbox", resourceId:name, snapshotId:snap } }))' \
  "$ssh_host" "$ssh_port" "$ssh_user" "$identity_file" "$name" "$snapshot_id" "$project_root"
trap - EXIT
```

`suspend`/`resume`/`destroy` use `vercel sandbox stop|...|remove "$resource_id"` reading
`userData.resourceId` from stdin (§7d) — so `create` must emit `userData.resourceId`.

### 7g. Worked example — existing SSH host

`create`'s whole job on a persistent host is: make the repo ready, then **print SSH connection details**
AIO-ADE will dial. AIO-ADE itself connects to the host over its SSH relay, brings up the git + filesystem
providers, and imports the repo. The result is a `connection` block with `type: "ssh"` and a `target` —
exact shape (AIO-ADE rejects anything else):

```json
{
  "schemaVersion": 1,
  "connection": {
    "type": "ssh",
    "projectRoot": "/abs/path/to/repo/on/host",
    "target": {
      "label": "my-box",
      "host": "192.0.2.10",
      "port": 22,
      "username": "ubuntu",
      "identityFile": "~/.ssh/id_ed25519",
      "jumpHost": "bastion.example.com",
      "proxyCommand": "cloudflared access ssh --hostname %h",
      "relayGracePeriodSeconds": 0,
      "portForwards": []
    }
  }
}
```

`label`, `host`, `port`, `username` are required; the rest are optional — omit any you don't need.

**Networking → which `target` fields to set** (how *your desktop* reaches the box):

- Public IP / DNS, or a Tailscale/VPN address → `host`; SSH port → `port` (usually 22).
- Key auth → `identityFile` (add `identitiesOnly: true` if the agent has many keys).
- Through a bastion → `jumpHost` (a `user@host` ProxyJump) **or** a full `proxyCommand` (e.g. an access
  proxy). Use one, not both.
- A service port the workspace needs → add entries to `portForwards`.
- `relayGracePeriodSeconds` (optional): how long AIO-ADE keeps the SSH relay alive after the workspace
  detaches before tearing it down; `0` = tear down immediately. Leave it off unless the user wants a
  reconnect grace window.

**Toolchain & agent auth on a persistent (no-snapshot) host — do this ONCE, by hand, before wiring the
recipe** (there's no base image to bake; the host *is* the base). Run the §7f Phase-2 install steps and
the §7f Phase-3 `<agent> login --device-auth` **directly over SSH on the host** (interactive, e.g.
`ssh -t user@host '<agent> login --device-auth'`). After that the host stays ready across workspaces.

```bash
#!/usr/bin/env bash
set -euo pipefail
# resolve from env→state→fallback (default unset optionals to ""): ssh_username, host,
#   ssh_port (default 22), identity_file, jump_host, proxy_command, project_root, repo_url, repo_ref
: "${identity_file:=}"; : "${jump_host:=}"; : "${proxy_command:=}"   # avoid set -u aborts on optionals
gh_token="${GH_TOKEN:-${GITHUB_TOKEN:-$(command -v gh >/dev/null 2>&1 && gh auth token 2>/dev/null || true)}}"
ssh_target="${ssh_username}@${host}"
ssh_opts=(-p "$ssh_port"); [ -n "$identity_file" ] && ssh_opts+=(-i "$identity_file")
# Why: a fresh host's key isn't in known_hosts; a StrictHostKeyChecking prompt would HANG a
# non-interactive create. Pre-add the key (or set the option) so it can't block.
ssh-keyscan -p "$ssh_port" "$host" >> "$HOME/.ssh/known_hosts" 2>/dev/null || true

# 1. ensure the repo is present and at the right commit on the host
ssh "${ssh_opts[@]}" "$ssh_target" \
  "GH_TOKEN='$gh_token' GIT_TERMINAL_PROMPT=0 bash -lc '
     set -euo pipefail
     [ -d \"$project_root/.git\" ] || git clone \"$repo_url\" \"$project_root\"
     cd \"$project_root\" && git fetch origin \"$repo_ref\" && git checkout -B \"$repo_ref\" FETCH_HEAD
   '" >&2

# 2. print the SSH connection block. host/port/username tell AIO-ADE's
#    relay how to dial in; identityFile/jumpHost/proxyCommand/portForwards are emitted when set.
node -e 'const [host,port,user,idf,jh,pc,root]=process.argv.slice(1);
  const target={ label:"per-workspace-host", host, port:Number(port), username:user };
  if(idf) target.identityFile=idf; if(jh) target.jumpHost=jh; if(pc) target.proxyCommand=pc;
  // add target.portForwards=[...] here if the workspace needs forwarded service ports
  console.log(JSON.stringify({ schemaVersion:1, connection:{ type:"ssh", projectRoot:root, target } }))' \
  "$host" "$ssh_port" "$ssh_username" "$identity_file" "$jump_host" "$proxy_command" "$project_root"
```

`suspend`/`resume`/`destroy`: on a persistent host there's usually nothing to tear down — set
`destroy: none` and omit suspend/resume. (AIO-ADE still disconnects/reconnects its own SSH relay on
sleep/wake/delete — that's separate from these scripts.)

If the SSH host is instead an **ephemeral/snapshot-capable VM** (your hypervisor, or a cloud VM with
image support), keep the §7f Phase-2/3 base-image model for provisioning — per-workspace `create` still
emits the `connection.type:"ssh"` block above (worked in §7f).

### 7h. Worked example — local Docker SSH

Local Docker can model an ephemeral SSH VM without cloud cost: build a base image with `sshd`, tools,
repo prerequisites, and the agent CLI; run an **interactive auth container** once; then `docker commit`
that container as the authenticated image used by per-workspace `create`.

Key points:

- Publish container SSH to a random localhost port (`-p 127.0.0.1::22`) and emit
  `connection.type:"ssh"` with `host:"127.0.0.1"`, that port, `username`, `identityFile`, and
  `identitiesOnly:true`.
- Generate a repo-local SSH key if needed, but gitignore the private/public key files.
- **Bake SSH host keys into the base image** (`ssh-keygen -A` at **build** time; at runtime only generate
  if absent). Ephemeral containers all present the **same** host key, so `known_hosts` on `127.0.0.1`
  doesn't churn as the published port rotates across workspaces (otherwise every container's freshly
  generated key collides on `localhost` and trips host-key-changed warnings).
- The auth image is the Docker equivalent of Phase 3: the **user** runs the agent login **inside** the
  container (you can't drive it — you have no interactive TTY), configures proxy env/config, approves
  hooks, and you commit once they report it's done. On a headless container use the **device-auth** flow
  (§4). Verify login before committing — exit code, or fold stderr and match the exact success line (§4).
- Do not bind-mount or copy the host's full agent home into the image. Let each container have writable
  agent state; only the committed auth image should carry reusable authenticated state.
- If committing from an interactive shell, force the runtime entrypoint back to `sshd`:
  `docker commit --change='ENTRYPOINT ["/usr/local/bin/aio-ade-docker-ssh-entrypoint"]' …`.
- `destroy` should read `recipeResult.userData.resourceId` and run `docker rm -f "$resource_id"`.

Validation before wiring/live use:

```bash
docker image inspect "$auth_image" --format '{{json .Config.Entrypoint}}'
docker run -d --name "$name" -p 127.0.0.1::22 -e "AIO_ADE_SSH_PUBLIC_KEY=$pubkey" "$auth_image"
docker ps -a --filter "name=$name"
docker logs "$name"
ssh -i "$key" -p "$port" -o IdentitiesOnly=yes user@127.0.0.1 'codex --version'
```

If the container exits immediately, inspect logs before the cleanup trap removes it; a committed
interactive image with `ENTRYPOINT ["bash"]` is a common cause.

Also confirm the **host key is stable** across containers: the SSH `ssh -i … 127.0.0.1` dial should not
trigger a host-key-changed warning when a second container reuses the port. If it does, the host keys
weren't baked into the base image (see the `ssh-keygen -A` point above).

### 7i. Windows local-side scripts

The local-side scripts run on the user's desktop. On **Windows**, a bare `.sh` won't execute. Either
require WSL/Git-Bash (and point `aio-ade.yaml` at e.g. `bash ./scripts/aio-ade-vm/<name>.sh` via a `.cmd`
launcher), or scaffold PowerShell equivalents. Minimal PowerShell shape:

```powershell
#requires -Version 5
$ErrorActionPreference = 'Stop'
# resolve env→state→fallback; run the provider CLI / ssh the same way;
# capture provider output; build the SSH result object and write ONE line of JSON to stdout.
# @{ schemaVersion=1; connection=@{ type="ssh"; projectRoot=$projectRoot;
#    target=@{ label=$label; host=$host; port=$port; username=$user } } }  (see §7g/§7h)
($result | ConvertTo-Json -Compress -Depth 6)
# progress/errors → Write-Error / the error stream, never stdout.
```

The remote-side commands you run *inside* the Linux VM stay bash regardless of the desktop OS.

---

## 8. Per-workspace recipe contract (the fast path)

Once the authenticated snapshot exists, this runs on every workspace create. Define recipes in
`aio-ade.yaml`:

```yaml
environmentRecipes:
  - id: cloud-sandbox
    name: Cloud Sandbox
    create: ./scripts/aio-ade-vm/cloud-sandbox-create.sh
    suspend: ./scripts/aio-ade-vm/cloud-sandbox-suspend.sh
    resume: ./scripts/aio-ade-vm/cloud-sandbox-resume.sh
    destroy: ./scripts/aio-ade-vm/cloud-sandbox-destroy.sh
```

`create` runs **locally from the repo root** and prints **one** JSON object to stdout — the
`connection.type:"ssh"` block (full shape + worked scripts in §7c/§7g/§7h). `schemaVersion` (`1`) and
`userData` are optional; `connection.projectRoot` and `connection.target` are required.

Lifecycle hooks (all run locally):

- `create`: required. Prints recipe result JSON.
- `suspend`: optional. Sleep; reads lifecycle payload on stdin.
- `resume`: optional. Wake; reads payload on stdin and **prints fresh recipe JSON** (the SSH target may
  change).
- `destroy`: optional unless `destroy: none`. Delete/cleanup; reads payload on stdin.

Backward compatibility: `command`→`create`, `cleanup`→`destroy`, `cleanup: none`→`destroy: none`.
Prefer the lifecycle names.

---

## 9. Doctor and validation

Validate in two stages — the cheap dry run first, then the live self-test.

### Dry run (free, non-destructive) — always do this first

`aio-ade vm recipe doctor <recipe-id> --repo-path <repo> --json` validates **static wiring only** — it does
**not** boot anything. It checks: local-host execution (v1), repo path, recipe id exists,
create/destroy/suspend/resume command paths resolve, suspend/resume are paired, and each script is
executable (POSIX exec bit; skipped on Windows). Fix every failure here before spending any cloud money.

### Live self-test (`--provision`) — diagnose and iterate yourself

`aio-ade vm recipe doctor <recipe-id> --repo-path <repo> --provision --json` actually runs the recipe end
to end: it executes `create`, validates the returned recipe JSON, then runs `destroy` to **tear the
environment back down** (so the test leaves nothing running, as long as `destroy` works). It spends real
cloud money, so get the user's OK **once** before starting — that one approval covers the whole loop
below; do not re-ask before each run.

On failure, the JSON result includes a `provisionTranscript` with the **complete** captured output of
each stage so you can self-diagnose without asking the user to relay logs:

```json
{
  "ok": false,
  "checks": [ { "id": "recipe.provision", "status": "fail", "message": "…" } ],
  "provisionTranscript": {
    "provision": { "exitCode": 0, "signal": null, "stdout": "…", "stderr": "…", "parseError": "…" },
    "destroy":   { "exitCode": 0, "signal": null, "stdout": "…", "stderr": "…" }
  }
}
```

**Run it as a loop:** read `provisionTranscript.provision.stderr` / `.stdout` / `.parseError` (and
`destroy.*`), fix the script, and re-run `--provision` until `ok` is `true` — iterating on your own
rather than waiting for the user to paste errors. Common reads: a non-empty `stderr` with `exitCode 0`
plus a `parseError` means `create` ran but printed something other than the single recipe-result JSON on
stdout (often a stray `echo` — route it to stderr, see §10); a non-zero `exitCode` is a provider/script
failure described in `stderr`. Each stream is redacted and capped (head+tail) — large logs keep both the
setup context and the failure.

The self-test cannot see provider-side truth beyond what the scripts print, so still confirm: state has a
populated **authenticated** `snapshotId` (Phases 2–3 done), and `destroy` is implemented/tested (or
explicitly `none` — in which case the self-test won't tear down, so clean up manually).

For SSH recipes, also smoke-test the exact emitted target before declaring success: dial the host/port
with the identity/proxy settings, run `pwd`, verify the repo path, check the agent binary, and confirm
`destroy` removes the provider resource/container. For Docker, inspect the auth image entrypoint and do a
startup-only `docker run` before the full clone/install path.

---

## 10. Failure modes

- **Build exceeds plan timeout (e.g. Hobby 45m).** Use enough vCPUs and a timeout covering the build;
  else split work or use a higher plan. The cap also limits per-workspace runtime — surface it.
- **Build exceeds plan RAM.** Build the **headless main only** (drop the renderer) — the biggest fitter.
- **Private-repo clone hangs/fails.** Wrong/missing token. Use `GIT_ASKPASS` + `GIT_TERMINAL_PROMPT=0`
  so it fails fast instead of prompting.
- **`GIT_ASKPASS` helper aborts the clone with "`$1: unbound variable`".** The `printf`/heredoc that writes
  the helper inside `bash -lc` under `set -u` expanded `$1`/`$GH_TOKEN` at **write** time. Escape them
  (`\$1`, `\$GH_TOKEN`) so they land literally and resolve at git-runtime; this also keeps the real token
  out of the file. `rm -f` the helper afterward (§5, §7f).
- **Agent verified as "not logged in" despite a good login.** `codex login status` (and similar) print
  "Logged in …" to **stderr**; an stdout-only `grep` misses it. Prefer the status **exit code**; if you
  grep, fold stderr first (`status 2>&1 | grep …`) and match the exact success line — not `grep -qi
  'logged in'`, which also matches "not logged in".
- **Headless agent login hangs.** Plain OAuth `login` starts a loopback callback server on a VM/container
  port the host browser can't reach. Use the **device-auth** flow (`login --device-auth`) — it prints a
  URL + code the user opens on the host.
- **`known_hosts` host-key churn on local Docker.** Each ephemeral container regenerating its SSH host key
  collides on `127.0.0.1` as the published port rotates. Bake host keys into the base image at build time
  (`ssh-keygen -A`; runtime generates only if absent) so all containers share one stable key (§7h).
- **Snapshot expired/evicted.** If `create` hits an unknown snapshot id, rerun Phases 2–3 and update
  `snapshotId`.
- **Agent auth didn't persist.** Confirm `snapshotId` points at the **authenticated** snapshot; re-run
  Phase 3. Warn that short-lived tokens may need periodic re-auth.
- **Agent auth copied from the host breaks.** Do not bind-mount/copy a full host agent home; sqlite
  files can be unwritable or host-specific, hooks may need approval again, and config may reference
  local-only env vars. Authenticate inside the runtime and snapshot/commit that layer.
- **Docker auth image exits immediately.** Inspect `docker image inspect … .Config.Entrypoint` and
  `docker logs`. If the image was committed from an interactive shell, reset the entrypoint to the SSH
  entrypoint during `docker commit`.
- **Leaked paid resource.** Every long script must trap errors and remove the sandbox it created.
- **`create` emits non-JSON on stdout.** A stray `echo` corrupts the result — stdout is for the final
  JSON only; everything else to stderr. The `--provision` self-test surfaces this as `exitCode 0` + a
  `parseError` with the offending stdout in `provisionTranscript` (§9).

---

## 11. Boundaries

- Don't create accounts, choose plans/regions, or invent scope/project/org/image/billing ids.
- Don't invent or store credentials; no secrets in `userData`, state, comments, docs, or commits.
- Don't run paid/long phases (base snapshot, auth, live test) without an explicit OK.
- Don't hide provider errors behind generic messages — preserve actionable stderr.
- Don't make AIO-ADE own provider lifecycle beyond invoking the configured scripts.
- Don't commit or create an AIO-ADE workspace unless asked.
