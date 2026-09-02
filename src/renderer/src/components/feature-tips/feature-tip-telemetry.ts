import { track } from '@/lib/telemetry'
import type { EventProps } from '../../../../shared/telemetry-events'

export type AioAdeCliFeatureTipSource = EventProps<'aio_ade_cli_feature_tip_shown'>['source']
export type AioAdeCliFeatureTipSetupResult =
  EventProps<'aio_ade_cli_feature_tip_setup_result'>['result']
export type CmdJPaletteFeatureTipSource = EventProps<'cmd_j_palette_feature_tip_shown'>['source']

export function getAioAdeCliFeatureTipTelemetrySource(value: unknown): AioAdeCliFeatureTipSource {
  return value === 'app_open' ? 'app_open' : 'manual'
}

export function trackAioAdeCliFeatureTipShown(source: AioAdeCliFeatureTipSource): void {
  track('aio_ade_cli_feature_tip_shown', { source })
}

export function trackAioAdeCliFeatureTipSetupClicked(source: AioAdeCliFeatureTipSource): void {
  track('aio_ade_cli_feature_tip_setup_clicked', { source })
}

export function trackAioAdeCliFeatureTipSetupResult(
  source: AioAdeCliFeatureTipSource,
  result: AioAdeCliFeatureTipSetupResult
): void {
  track('aio_ade_cli_feature_tip_setup_result', { source, result })
}

export function trackCmdJPaletteFeatureTipShown(source: CmdJPaletteFeatureTipSource): void {
  track('cmd_j_palette_feature_tip_shown', { source })
}

export function trackCmdJPaletteFeatureTipAcknowledged(source: CmdJPaletteFeatureTipSource): void {
  track('cmd_j_palette_feature_tip_acknowledged', { source })
}
