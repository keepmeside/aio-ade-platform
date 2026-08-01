---
name: orca-per-workspace-env
description: >-
  Set up, review, debug, or validate repo-owned per-workspace environment recipes
  for disposable sandboxes, VMs, and SSH hosts. Covers provider preparation,
  authenticated base images, lifecycle scripts, and Orca's SSH runtime attachment.
---

# Per-Workspace Environments

Per-workspace environments are disposable sandboxes, VMs, or hosts created for one
workspace. Orca invokes the lifecycle scripts declared in `orca.yaml`, validates
their output, and attaches the resulting host through its SSH relay. The same flow
supports local Docker, cloud sandboxes, existing SSH hosts, and snapshot-capable VMs.

This guide uses SSH connection mode. A recipe must return an SSH target; desktop
pairing URLs and a second headless desktop process are not part of this contract.

## Boundaries

- The repository owns recipe scripts and configuration.
- The provider owns accounts, billing, images, and resource lifecycle.
- Orca owns workspace attachment, runtime startup, terminals, files, and cleanup
  callbacks after a recipe returns an SSH connection.
- Never invent provider IDs, choose a paid plan, or store credentials in a recipe.
- Keep progress and diagnostics on stderr. Stdout is reserved for one JSON result.

## Setup workflow

1. Inspect the repository for `orca.yaml`, `environmentRecipes`, and
   `scripts/orca-vm/` (or another clearly named recipe directory).
2. Ask for the provider, region or project scope, repository ref, coding agent,
   authentication method, and SSH target details. Do not guess these values.
3. Prepare a reusable base image or host with Git, the provider tools, the coding
   agent, and the runtime prerequisites. Authenticate the coding agent interactively
   inside the environment before taking an image or snapshot.
4. Add the lifecycle scripts and wire them into `orca.yaml`.
5. Open Settings > Ephemeral VMs and run the recipe checks. Fix every failed path or
   diagnostic before provisioning a real workspace.
6. Provision from the workspace composer, verify the SSH connection, run a smoke
   check, and clean up the resource when the workspace is deleted.

## Recipe declaration

Declare lifecycle scripts under `environmentRecipes`:

```yaml
environmentRecipes:
  - id: cloud-sandbox
    name: Cloud Sandbox
    create: ./scripts/orca-vm/cloud-sandbox-create.sh
    suspend: ./scripts/orca-vm/cloud-sandbox-suspend.sh
    resume: ./scripts/orca-vm/cloud-sandbox-resume.sh
    destroy: ./scripts/orca-vm/cloud-sandbox-destroy.sh
```

`create` is required. `suspend` and `resume` are optional but must be provided as a
pair. Configure `destroy: none` only when another system reliably removes the
provider resource.

## Create contract

The create script runs locally from the repository root. It should:

1. Provision or boot the resource, with an error trap that removes it on failure.
2. Ensure the requested repository ref exists at the remote project root.
3. Ensure the SSH daemon and the configured user/key are ready.
4. Print exactly one compact JSON object to stdout.

The successful result has this shape:

```json
{
  "schemaVersion": 1,
  "connection": {
    "type": "ssh",
    "projectRoot": "/workspace/repo",
    "target": {
      "label": "cloud-sandbox",
      "host": "203.0.113.10",
      "port": 22,
      "username": "ubuntu",
      "identityFile": "~/.ssh/id_ed25519",
      "identitiesOnly": true,
      "jumpHost": "bastion.example.com",
      "portForwards": []
    }
  },
  "userData": {
    "provider": "example",
    "resourceId": "provider-resource-id"
  }
}
```

`label`, `host`, `port`, `username`, and `projectRoot` are required. Omit optional
target fields when they are not needed. `userData` may contain non-secret provider
identifiers used by suspend, resume, and destroy.

The recipe result is consumed by Orca's SSH relay. After the connection is accepted,
Orca starts or reconnects the remote runtime and exposes terminals, files, Git, and
agent sessions through the normal workspace UI.

## Lifecycle scripts

- `suspend` receives the prior recipe result on stdin and should stop or hibernate
  the resource without losing its identity.
- `resume` receives the prior result and prints a fresh SSH recipe result to stdout.
- `destroy` receives the prior result and removes the resource. Make it idempotent.
- All scripts must fail non-zero on provider errors and must not print secrets.

Use provider CLIs or SDKs inside scripts only when they are installed and authenticated
on the local host. Route their progress to stderr and redact tokens from diagnostics.

## SSH smoke checks

Before declaring a recipe ready, verify:

```bash
ssh -i "$IDENTITY_FILE" -o IdentitiesOnly=yes -p "$SSH_PORT" \
  "$SSH_USER@$SSH_HOST" 'pwd && git -C "$PROJECT_ROOT" rev-parse --show-toplevel'
```

Then confirm the coding agent is available, the project root is writable, and the
runtime can create a terminal. For a jump host or proxy, test the exact `jumpHost` or
`proxyCommand` fields emitted in the result. For Docker, verify the container entrypoint
starts `sshd` and that host keys are stable between containers.

## Base image and authentication

Snapshot-capable providers should use two images:

1. A base image with system packages, Git, Node or the required toolchain, and the
   repository bootstrap dependencies.
2. An authenticated image created after the user completes the coding-agent login
   interactively inside the environment.

Do not copy a host agent home into an image. Authenticate in the target environment,
keep the image private, and rotate short-lived credentials according to the provider's
rules.

## Validation and recovery

Settings > Ephemeral VMs checks repository paths, lifecycle pairing, executable bits,
and recipe diagnostics before provisioning. A failed create result includes redacted
stdout and stderr in the UI; preserve those details when fixing the script.

Common failures:

- The result is not valid JSON: move every progress message to stderr.
- SSH refuses the connection: check host, port, user, key permissions, and known-hosts.
- The repository is missing: clone or fetch it during `create`, then verify the ref.
- Resume returns stale data: print a complete fresh result after the provider allocates
  a new address or port.
- Cleanup leaks a resource: add a trap and make `destroy` safe to retry.
- A headless login hangs: use the coding agent's device or non-loopback login flow and
  have the user complete it interactively inside the environment.

## Security checklist

- Never put tokens, private keys, or account cookies in stdout, `userData`, or commits.
- Use `GIT_TERMINAL_PROMPT=0` and a temporary askpass helper for private clones.
- Restrict SSH keys and provider credentials to the intended resource.
- Remove temporary askpass files and provider resources on every failure path.
- Keep `projectRoot` absolute on the remote host and normalize path separators in
  platform-specific scripts.
