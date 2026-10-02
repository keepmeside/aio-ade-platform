import { net, session } from 'electron'
import { ensureElectronProxyFromEnvironment } from '../network/proxy-settings'
import type { AgentAuthProfileHealthTestFetch } from './agent-auth-profile-health-test'

// Bridges the environment proxy into the Electron session before a health
// probe: net.fetch honors the session proxy, not HTTP_PROXY/HTTPS_PROXY.
// Best-effort by design — a proxy that cannot be applied must not fail the probe.
export const agentAuthProfileElectronHealthFetch: AgentAuthProfileHealthTestFetch = async (
  url,
  init
) => {
  await ensureElectronProxyFromEnvironment({
    proxySession: session.defaultSession,
    probeUrl: url
  }).catch(() => {})
  const response = await net.fetch(url, init)
  return { status: response.status, ok: response.ok }
}
