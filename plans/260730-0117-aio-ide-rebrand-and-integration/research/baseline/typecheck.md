```text
# baseline: pnpm typecheck
host: Linux 5.15.0-176-generic x86_64 | node v25.9.0 | pnpm 10.24.0
commit: 0304a3650aa8691975c8cb61535aec8a2d4ace02
started: 2026-08-22T03:03:02Z
---
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.overrides", "pnpm.supportedArchitectures", "pnpm.onlyBuiltDependencies", "pnpm.patchedDependencies". See https://pnpm.io/settings for the new home of each setting.
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 typecheck /home/stackops/devops-learning/aio-ade-platform
> tsc --noEmit -p config/tsconfig.node.json && tsc --noEmit -p config/tsconfig.tc.cli.json && tsc --noEmit -p config/tsconfig.tc.web.json

exit=0 finished=2026-08-22T03:03:36Z
```
