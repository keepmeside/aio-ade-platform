export const AIO_ADE_EDITOR_SAVE_DIRTY_FILES_EVENT = 'aio-ade:editor-save-dirty-files'
export const AIO_ADE_EDITOR_PREPARE_HOT_EXIT_EVENT = 'aio-ade:editor-prepare-hot-exit'

export type EditorSaveDirtyFilesDetail = {
  claim: () => void
  resolve: () => void
  reject: (message: string) => void
}

export type EditorPrepareHotExitDetail = EditorSaveDirtyFilesDetail
