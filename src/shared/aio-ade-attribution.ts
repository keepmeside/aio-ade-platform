// Why: single source of truth for the commit trailer AIO-ADE appends when the
// "AIO-ADE Attribution" toggle (`enableGitHubAttribution`) is on. Used by both
// the terminal git/gh shim and the AI commit-message generator so the two
// code paths agree on the exact string.

export const AIO_ADE_GIT_COMMIT_TRAILER = 'Co-authored-by: AIO-ADE <noreply@keepmeside.dev>'
