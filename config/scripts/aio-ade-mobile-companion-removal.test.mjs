import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const MOBILE_COMPANION_PATHS = [
  'mobile',
  '.github/workflows/mobile-android-release.yml',
  '.github/workflows/mobile-ios-release.yml',
  '.github/workflows/mobile.yml',
  'src/main/ipc/mobile.ts',
  'src/main/runtime/mobile-pairing-files.ts',
  'src/main/runtime/relay',
  'src/main/runtime/rpc/relay-transport.ts',
  'src/renderer/src/components/mobile/MobilePage.tsx',
  'src/renderer/src/components/settings/MobileSettingsPane.tsx',
  'src/shared/mobile-e2ee-v2-contract.ts',
  'src/shared/mobile-relay-credential-contract.ts'
]

const PRESERVED_GENERIC_PATHS = [
  'src/main/emulator/android/android-app-control.ts',
  'src/main/emulator/backends/ios-emulator-backend.ts',
  'src/renderer/src/components/browser-pane/BrowserMobileDriverOverlay.tsx',
  'src/renderer/src/components/terminal-pane/MobileDriverOverlay.tsx',
  'src/renderer/src/web/web-preload-api.ts',
  'src/main/ssh/ssh-connection.ts',
  'src/main/ipc/notifications.ts',
  'src/renderer/src/lib/unread-badge-count.ts',
  'src/shared/remote-runtime-client.ts',
  'src/main/runtime/runtime-pairing-files.ts',
  'src/main/runtime/rpc/runtime-socket-wiring.ts',
  'src/shared/runtime-pairing-offer.ts',
  'src/shared/runtime-e2ee-v2-contract.ts',
  'src/shared/runtime-markdown-document.ts',
  'docs/assets/orca-mobile-emulator.gif'
]

const PHASE_03_DEFERRED_MANIFESTS = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']

const MOBILE_COMPANION_REFERENCE_FILES = [
  'README.md',
  'docs/readme/README.es.md',
  'docs/readme/README.fr.md',
  'docs/readme/README.ja.md',
  'docs/readme/README.ko.md',
  'docs/readme/README.pt.md',
  'docs/readme/README.zh-CN.md',
  'tests/e2e/helpers/paired-electron-client.ts',
  'tests/e2e/multi-client-navigation-isolation.spec.ts'
]

const FORBIDDEN_MOBILE_COMPANION_REFERENCES = [
  'mobile-companion-app-showcase',
  'window.api.mobile',
  'getRuntimePairingUrl'
]

function existingPaths(paths) {
  return paths.filter((path) => existsSync(resolve(path)))
}

function missingPaths(paths) {
  return paths.filter((path) => !existsSync(resolve(path)))
}

describe('aio-ade mobile companion removal contract', () => {
  it('removes only representative mobile companion surfaces', () => {
    expect(existingPaths(MOBILE_COMPANION_PATHS)).toEqual([])
  })

  it('preserves emulator, mobile-driver, web, SSH, notification, and remote runtime surfaces', () => {
    expect(missingPaths(PRESERVED_GENERIC_PATHS)).toEqual([])
  })

  it('defers shared root manifest cleanup to Phase 03', () => {
    expect(MOBILE_COMPANION_PATHS).not.toEqual(
      expect.arrayContaining(PHASE_03_DEFERRED_MANIFESTS)
    )
  })

  it('removes broken companion docs and preload API references', () => {
    for (const path of MOBILE_COMPANION_REFERENCE_FILES) {
      const content = readFileSync(resolve(path), 'utf8')
      for (const reference of FORBIDDEN_MOBILE_COMPANION_REFERENCES) {
        expect(content).not.toContain(reference)
      }
    }
  })
})
