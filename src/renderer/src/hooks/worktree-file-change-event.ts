import type { FsChangedPayload } from '../../../shared/types'

export const AIO_ADE_WORKTREE_FILE_CHANGE_EVENT = 'aio-ade:worktree-file-change'

export type WorktreeFileChangeEventDetail = {
  payload: FsChangedPayload
  runtimeEnvironmentId: string | null
}
