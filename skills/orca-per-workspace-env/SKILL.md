---
name: orca-per-workspace-env
description: >-
  Set up, review, debug, or validate repo-owned per-workspace environment recipes
  for disposable sandboxes, VMs, and SSH hosts. Use the Ephemeral VMs settings
  panel to inspect recipes and provision a workspace through Orca's runtime and
  SSH integrations.
---

# Per-Workspace Environments

This skill covers the repository-owned `environmentRecipes` contract. It is for
preparing disposable development environments and attaching them to a workspace
through Orca's Ephemeral VMs flow.

Read `skill-guides/orca-per-workspace-env.md` before changing a recipe. The guide
defines the JSON contract, SSH connection shape, lifecycle scripts, validation
steps, and safety boundaries.

The recipe must emit an SSH connection result. Orca then owns the runtime, terminal,
filesystem, and source-control channels over its SSH relay. Do not start a second
desktop process or expose a pairing URL from a recipe.

Use the Ephemeral VMs settings panel to check recipe paths and diagnostics, then use
the workspace composer to provision a selected recipe. Provider commands and coding
agent commands may be used inside lifecycle scripts; keep their output and secrets
within the provider environment.
