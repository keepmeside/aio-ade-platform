import { randomUUID } from 'node:crypto'
import type { AioAdeCloudCapabilities, AioAdeCloudOrgSummary } from '../../shared/aio-ade-profiles'
import type { AioAdeCloudSessionExchangeResponse } from './profile-cloud-session-exchange'

const DEV_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function cleanEnvString(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed || fallback
}

function defaultDevOrganizations(): AioAdeCloudOrgSummary[] {
  return [
    { orgId: 'dev-personal', name: 'Personal', role: 'Owner' },
    { orgId: 'dev-acme', name: 'Acme Dev', role: 'Admin' }
  ]
}

function devCapabilities(): AioAdeCloudCapabilities {
  return {
    flags: {
      share: true,
      team: true,
      'share.create': true,
      'share.manage': true,
      'relay.use': true,
      'team.member': true,
      'enterprise.sso': true
    },
    refreshedAt: Date.now()
  }
}

function devToken(prefix: string): string {
  return `${prefix}-${randomUUID()}`
}

export function createDevAioAdeCloudSession(
  args: {
    localProfileId?: string
    cloudProfileId?: string
    orgId?: string
  } = {}
): AioAdeCloudSessionExchangeResponse {
  const organizations = defaultDevOrganizations()
  const selectedOrg = organizations.find((organization) => organization.orgId === args.orgId)
  const cloudProfileId =
    args.cloudProfileId ??
    (args.localProfileId ? `dev-cloud-${args.localProfileId}` : `dev-cloud-${randomUUID()}`)

  return {
    accessToken: devToken('dev-access'),
    refreshToken: devToken('dev-refresh'),
    expiresAt: Date.now() + DEV_SESSION_TTL_MS,
    cloud: {
      cloudProfileId,
      userId: cleanEnvString(process.env.AIO_ADE_CLOUD_DEV_USER_ID, 'dev-user'),
      email: cleanEnvString(process.env.AIO_ADE_CLOUD_DEV_EMAIL, 'dev@aio-ade.local'),
      displayName: cleanEnvString(process.env.AIO_ADE_CLOUD_DEV_DISPLAY_NAME, 'AIO-ADE Dev'),
      activeOrgId: selectedOrg?.orgId,
      activeOrgName: selectedOrg?.name,
      linkedAt: Date.now()
    },
    organizations,
    capabilities: devCapabilities()
  }
}
