import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAioAdeElectronLaunchArgs } from './electron-launch-args'

describe('getAioAdeElectronLaunchArgs', () => {
  it('launches the package root that owns the compiled main entry', () => {
    const root = join('workspace', 'aio-ade')
    const mainPath = join(root, 'out', 'main', 'index.js')

    expect(getAioAdeElectronLaunchArgs(mainPath, true)).toEqual([root])
    expect(getAioAdeElectronLaunchArgs(mainPath, false).at(-1)).toBe(root)
  })
})
