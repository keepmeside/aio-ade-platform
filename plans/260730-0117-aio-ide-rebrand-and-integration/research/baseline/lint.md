```text
# baseline: pnpm lint
host: Linux 5.15.0-176-generic x86_64 | node v25.9.0 | pnpm 10.24.0
commit: 0304a3650aa8691975c8cb61535aec8a2d4ace02
started: 2026-08-22T03:03:02Z
---
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.overrides", "pnpm.supportedArchitectures", "pnpm.onlyBuiltDependencies", "pnpm.patchedDependencies". See https://pnpm.io/settings for the new home of each setting.
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 lint /home/stackops/devops-learning/aio-ade-platform
> oxlint && pnpm run audit:code-quality:native && pnpm run audit:code-quality:type-aware && pnpm run check:reliability-gates && pnpm run check:max-lines-ratchet && pnpm run verify:bundled-skill-guides && pnpm run verify:skill-bundle-manifest && pnpm run verify:localization-catalog && pnpm run verify:localization-coverage

Found 0 warnings and 0 errors.
Finished in 10.3s on 10634 files using 16 threads.
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 audit:code-quality:native /home/stackops/devops-learning/aio-ade-platform
> oxlint --config config/oxlint-code-quality-native-plugins.json src config tests mobile --deny-warnings

Found 0 warnings and 0 errors.
Finished in 4.2s on 10581 files with 15 rules using 16 threads.
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 audit:code-quality:type-aware /home/stackops/devops-learning/aio-ade-platform
> oxlint --type-aware --config config/oxlint-code-quality-type-aware.json src config tests --deny-warnings

Found 0 warnings and 0 errors.
Finished in 8.9s on 9570 files with 4 rules using 16 threads.
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 check:reliability-gates /home/stackops/devops-learning/aio-ade-platform
> node config/scripts/check-reliability-gates.mjs

Reliability gate manifest check passed for 53 gate(s).
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 check:max-lines-ratchet /home/stackops/devops-learning/aio-ade-platform
> node config/scripts/check-max-lines-ratchet.mjs

max-lines ratchet OK — 354 grandfathered suppression(s), no new bypasses.
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 verify:bundled-skill-guides /home/stackops/devops-learning/aio-ade-platform
> node config/scripts/generate-bundled-skill-guides.mjs --check

 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 verify:skill-bundle-manifest /home/stackops/devops-learning/aio-ade-platform
> node config/scripts/generate-skill-bundle-manifest.mjs

 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 verify:localization-catalog /home/stackops/devops-learning/aio-ade-platform
> node config/scripts/verify-localization-catalog.mjs

Verified 10725 localization key references against en.json.
Verified locale parity for es.json (11548 keys).
Verified locale parity for ja.json (11548 keys).
Verified locale parity for ko.json (11548 keys).
Verified locale parity for zh.json (11548 keys).
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})
 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v25.9.0","pnpm":"10.24.0"})

> orca@1.4.162-rc.0 verify:localization-coverage /home/stackops/devops-learning/aio-ade-platform
> node config/scripts/audit-localization-coverage.mjs --check

Localization coverage check passed with 12 allowlisted candidates.
exit=0 finished=2026-08-22T03:03:51Z
```
