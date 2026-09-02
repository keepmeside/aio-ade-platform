import type {
  AioAdeCloudCapabilities,
  AioAdeCloudOrgSummary,
  AioAdeProfileCloudSummary
} from '../../shared/aio-ade-profiles'

export type AioAdeCloudSessionExchangeResponse = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  cloud: AioAdeProfileCloudSummary
  organizations?: AioAdeCloudOrgSummary[]
  capabilities: AioAdeCloudCapabilities
}
