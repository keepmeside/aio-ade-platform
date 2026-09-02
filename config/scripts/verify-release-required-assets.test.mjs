import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extractManifestAssetNames,
  getRequiredReleaseAssetNames,
  verifyRequiredReleaseAssets
} from './verify-release-required-assets.mjs'

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn(async () => body),
    text: vi.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body)))
  }
}

function releaseWithAssets(tag, assetNames) {
  return {
    tag_name: tag,
    draft: true,
    prerelease: false,
    assets: assetNames.map((name, index) => ({
      id: index + 1,
      name,
      state: 'uploaded',
      size: 123
    }))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getRequiredReleaseAssetNames', () => {
  it('includes both mac updater ZIP names for the tag version', () => {
    expect(getRequiredReleaseAssetNames('v1.4.27')).toEqual(
      expect.arrayContaining([
        'AIO-ADE-1.4.27-mac.zip',
        'AIO-ADE-1.4.27-mac.zip.blockmap',
        'AIO-ADE-1.4.27-arm64-mac.zip',
        'AIO-ADE-1.4.27-arm64-mac.zip.blockmap'
      ])
    )
  })

  it('includes x64 and arm64 Linux assets', () => {
    expect(getRequiredReleaseAssetNames('v1.4.27')).toEqual(
      expect.arrayContaining([
        'latest-linux-arm64.yml',
        'aio-ade-linux.AppImage',
        'aio-ade-linux-arm64.AppImage',
        'aio-ade_1.4.27_amd64.deb',
        'aio-ade_1.4.27_arm64.deb',
        'aio-ade-1.4.27.x86_64.rpm',
        'aio-ade-1.4.27.aarch64.rpm'
      ])
    )
  })
})

describe('extractManifestAssetNames', () => {
  it('extracts relative and absolute manifest asset names', () => {
    expect(
      extractManifestAssetNames(
        [
          'files:',
          '  - url: AIO-ADE-1.4.27-arm64-mac.zip',
          '  - url: https://example.com/downloads/aio-ade-windows-setup.exe',
          'path: aio-ade-linux.AppImage'
        ].join('\n')
      )
    ).toEqual([
      'AIO-ADE-1.4.27-arm64-mac.zip',
      'aio-ade-windows-setup.exe',
      'aio-ade-linux.AppImage'
    ])
  })
})

describe('verifyRequiredReleaseAssets', () => {
  it('fails when a manifest-referenced asset has not been uploaded', async () => {
    const tag = 'v1.4.27'
    const required = getRequiredReleaseAssetNames(tag)
    const assets = required.filter((name) => name !== 'AIO-ADE-1.4.27-arm64-mac.zip')
    const release = releaseWithAssets(tag, assets)
    const latestMacAsset = release.assets.find((asset) => asset.name === 'latest-mac.yml')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([release]))
      .mockResolvedValueOnce(
        jsonResponse(
          [
            'version: 1.4.27',
            'files:',
            '  - url: AIO-ADE-1.4.27-arm64-mac.zip',
            '    sha512: test',
            'path: AIO-ADE-1.4.27-arm64-mac.zip'
          ].join('\n')
        )
      )
      .mockResolvedValue(jsonResponse('version: 1.4.27\n'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyRequiredReleaseAssets({ repo: 'keepmeside/aio-ade-platform', tag, token: 'token' })
    ).rejects.toThrow('Missing: AIO-ADE-1.4.27-arm64-mac.zip')
    expect(latestMacAsset).toBeTruthy()
  })

  it('checks assets referenced by the Linux arm64 updater manifest', async () => {
    const tag = 'v1.4.27'
    const required = getRequiredReleaseAssetNames(tag)
    const release = releaseWithAssets(tag, required)
    const arm64Manifest = release.assets.find((asset) => asset.name === 'latest-linux-arm64.yml')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([release]))
      .mockResolvedValueOnce(jsonResponse('version: 1.4.27\n'))
      .mockResolvedValueOnce(
        jsonResponse(
          [
            'version: 1.4.27',
            'files:',
            '  - url: aio-ade-linux-arm64.AppImage.blockmap',
            'path: aio-ade-linux-arm64.AppImage'
          ].join('\n')
        )
      )
      .mockResolvedValue(jsonResponse('version: 1.4.27\n'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyRequiredReleaseAssets({ repo: 'keepmeside/aio-ade-platform', tag, token: 'token' })
    ).rejects.toThrow('Missing: aio-ade-linux-arm64.AppImage.blockmap')
    expect(arm64Manifest).toBeTruthy()
  })
})
