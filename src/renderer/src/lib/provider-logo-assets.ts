import antigravityUrl from '../../../shared/provider-icons/antigravity.png?url'
import grokUrl from '../../../shared/provider-icons/grok.png?url'
import kimiUrl from '../../../shared/provider-icons/kimi.png?url'

/** Logos for usage/rate-limit providers that have no hand-authored SVG glyph. Bundled at build
 *  time rather than fetched from a favicon service, which is unreachable offline and in some
 *  regions. Keyed by rate-limit provider id — these are subscription providers, not agents Orca
 *  launches, so they are deliberately independent of the agent catalog. */
export const PROVIDER_LOGO_ASSETS: Record<string, string> = {
  antigravity: antigravityUrl,
  grok: grokUrl,
  kimi: kimiUrl
}
