/**
 * Feature flag for headless `serve` (decision 2026-08-21, phase 03).
 *
 * `serve` is not part of the minimal agent bridge keep-set, but its code is not deleted either —
 * the delete decision belongs to phase 09, which needs the dependency inventory first. Until then
 * the surface must be unreachable for users while staying intact for measurement.
 *
 * Fails closed: only an explicit, recognized opt-in enables it.
 */
const ENABLE_ENV_VAR = 'AIO_ADE_ENABLE_SERVE'
const ENABLED_VALUES = new Set(['1', 'true'])

export const SERVE_DISABLED_MESSAGE =
  'The headless `serve` command is disabled in this build. ' +
  `Set ${ENABLE_ENV_VAR}=1 to opt in; it is unsupported and may be removed.`

export function isServeEnabled(): boolean {
  const raw = process.env[ENABLE_ENV_VAR]
  return typeof raw === 'string' && ENABLED_VALUES.has(raw.trim().toLowerCase())
}
