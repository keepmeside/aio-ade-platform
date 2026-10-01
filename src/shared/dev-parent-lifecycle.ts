// Why: the CLI spawns the desktop app detached and exits once the ready
// handshake completes; both sides need the one env name marking such launches
// so the app never couples its lifetime to that transient parent.
export const DEV_PARENT_DECOUPLED_ENV = 'AIO_ADE_DEV_PARENT_DECOUPLED'
