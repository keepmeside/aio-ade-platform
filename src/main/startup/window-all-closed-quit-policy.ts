export function shouldQuitWhenAllWindowsClosed(options: {
  platform: NodeJS.Platform
  isQuitting: boolean
}): boolean {
  return options.platform !== 'darwin' || options.isQuitting
}
