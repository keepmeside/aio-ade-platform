// Sample AIO-ADE plugin worker entry. Runs inside the out-of-process plugin
// worker (plain Node, no Electron), forked lazily on the first trigger. The
// default export receives the plugin API: command registration, event
// handlers, and the capability-gated host API.
export default function activate(pluginApi) {
  pluginApi.commands.register('hello-ping', async (args) => {
    const stored = await pluginApi.host.call('storage.get', { key: 'pings' })
    const count = (typeof stored?.value === 'number' ? stored.value : 0) + 1
    await pluginApi.host.call('storage.set', { key: 'pings', value: count })
    return { pong: true, count, args: args ?? null }
  })

  pluginApi.events.on('worktree.created', async (payload) => {
    pluginApi.log(`worktree created: ${payload.worktreeId} at ${payload.path}`)
    await pluginApi.host.call('notifications.show', {
      title: 'Worktree created',
      body: payload.path
    })
  })

  pluginApi.events.on('agent.status.changed', (payload) => {
    pluginApi.log(`agent status: ${payload.state} in ${payload.worktreeId ?? 'unknown worktree'}`)
  })
}
