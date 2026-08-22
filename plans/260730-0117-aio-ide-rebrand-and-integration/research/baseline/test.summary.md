```text
# baseline: pnpm test
host: Linux 5.15.0-176-generic x86_64 | node v25.9.0 | pnpm 10.24.0
commit: 0304a3650aa8691975c8cb61535aec8a2d4ace02
started: 2026-08-22T03:03:02Z
---

### full log kept out of git (test.log, 3.0M); summary below

### failing files
 FAIL  src/main/git/worktree-list-paths.test.ts > git worktree paths > deletes the matching local branch after removing a newline-path worktree
 FAIL  src/main/git/worktree-list-paths.test.ts > git worktree paths > lists worktrees whose paths contain newlines
 FAIL  src/main/native-chat/transcript-watch.test.ts > subscribeNativeChatTranscript > delivers the offset-0 drain as one initial snapshot, then only live appends
 FAIL  src/main/ssh/ssh-system-transport.integration.test.ts > system SSH transport integration > deploys and speaks relay RPC over a system ssh process for ProxyUseFdpass targets
 FAIL  src/relay/git-handler.test.ts > GitHandler > listWorktrees > lists worktrees whose paths contain newlines
 FAIL  src/renderer/src/components/browser-pane/markup/use-markup-draw-hint.test.ts > useMarkupDrawHint > closes when eligibility drops so a hidden pane cannot keep it open
 FAIL  src/renderer/src/components/browser-pane/markup/use-markup-draw-hint.test.ts > useMarkupDrawHint > dismisses without reopening after the first view
 FAIL  src/renderer/src/components/browser-pane/markup/use-markup-draw-hint.test.ts > useMarkupDrawHint > does not open when the surface is not eligible
 FAIL  src/renderer/src/components/browser-pane/markup/use-markup-draw-hint.test.ts > useMarkupDrawHint > opens once when eligible and records the seen flag
 FAIL  src/renderer/src/components/github-project/project-view-wrapper-source-context-boundary.test.ts > ProjectViewWrapper GitHub source context boundary > builds project work items with a host-pinned repository identity
 FAIL  src/renderer/src/components/right-sidebar/pr-comment-presentation.test.ts > pr-comment-presentation > falls back to the default variant when localStorage is unset
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > bounds persisted review contexts while retaining recently restored selections
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > clears sent standalone bot comments from the queue when the parent confirms launch
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > clears the queued comment list from the header action
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > does not refresh LRU recency for an abandoned Suspense render
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > drops an empty selection from the persisted context cache
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > exits selection mode when refresh leaves no eligible loaded threads
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > keeps GitHub and GitLab review selections isolated under Strict Mode replay
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > keeps a clear request pending until its review context is mounted
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > keeps queued comments selected when clearRequest is null
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > keeps the overflow menu queue action available as a fallback
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > lets a user queue one eligible comment thread for the agent from the visible row action
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > lets a user queue one standalone comment for the agent from the visible row action
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > sends all canonical groups even when the active audience filter hides the root
 FAIL  src/renderer/src/components/right-sidebar/pr-comments-list-selection.test.tsx > PRCommentsList comment resolution selection > shows the bulk action when loaded unresolved comment groups are selectable
 FAIL  src/renderer/src/components/right-sidebar/use-persisted-ai-vault-view-options.test.tsx > usePersistedAiVaultViewOptions > keeps at least one agent enabled
 FAIL  src/renderer/src/components/right-sidebar/use-persisted-ai-vault-view-options.test.tsx > usePersistedAiVaultViewOptions > keeps in-memory options usable when persistence fails
 FAIL  src/renderer/src/components/right-sidebar/use-persisted-ai-vault-view-options.test.tsx > usePersistedAiVaultViewOptions > resets every persisted option to its default
 FAIL  src/renderer/src/components/right-sidebar/use-persisted-ai-vault-view-options.test.tsx > usePersistedAiVaultViewOptions > restores view options when the panel remounts
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > clears active reminder state after onAutoClose
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > clears active reminder state after onDismiss
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > dismisses an active reminder toast on permanent dismissal
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > does not create missing reminder state when resetting a runtime
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > does not recreate missing reminder state during toast cleanup
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > does not repeat the Orca CLI in CLI-only reminder toast copy
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > keeps WSL target nuance in reminder toast copy
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > keeps remote setup nuance in reminder toast copy
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > opens the setup dialog from the reminder toast action
 FAIL  src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.reminder-toast.test.tsx > LinearAgentSkillSetupPrompt reminder toast > shows a warning toast on a later modal-only activation after a casual close
 FAIL  src/renderer/src/components/sidebar/SidebarToolbar.test.tsx > SidebarToolbar moved workspace board hint > does not show the moved hint to brand-new users after their first board click
 FAIL  src/renderer/src/components/sidebar/SidebarToolbar.test.tsx > SidebarToolbar moved workspace board hint > renders the profile switcher before settings in the footer controls
 FAIL  src/renderer/src/components/sidebar/SidebarToolbar.test.tsx > SidebarToolbar moved workspace board hint > shows the moved hint once to users who had already used the workspace board
 FAIL  src/renderer/src/components/sidebar/mobile-sidebar-onboarding-badge.test.ts > mobile sidebar onboarding badge > does not show the badge on a failed load and recovers on window focus
 FAIL  src/renderer/src/components/sidebar/mobile-sidebar-onboarding-badge.test.ts > mobile sidebar onboarding badge > does not show when the sidebar button is hidden
 FAIL  src/renderer/src/components/sidebar/mobile-sidebar-onboarding-badge.test.ts > mobile sidebar onboarding badge > marks a paired device after shared mobile devices load
 FAIL  src/renderer/src/components/sidebar/mobile-sidebar-onboarding-badge.test.ts > mobile sidebar onboarding badge > shows only while enabled and undismissed
 FAIL  src/renderer/src/components/sidebar/mobile-sidebar-onboarding-badge.test.ts > mobile sidebar onboarding badge > shows the badge after shared mobile devices load empty

### error classes
      1 AssertionError: expected [ 'u-1', 'a-1' ] to deeply equal [ 'a-1' ]
      1 AssertionError: expected [ …(2) ] to include '/home/stackops/.jcode/scratch/orca-wo…'
      1 AssertionError: expected [ …(2) ] to include '/home/stackops/.jcode/scratch/relay-g…'
      1 AssertionError: expected true to be false // Object.is equality
      1 Error: Cannot find module 'electron'
      1 Error: Test timed out in 20000ms.
      1 Error: Test timed out in 30000ms.
      2 Error: runtime offline
      4 TypeError: window.localStorage.clear is not a function
      1 TypeError: window.localStorage.getItem is not a function
      5 TypeError: window.localStorage.removeItem is not a function

### totals
 Test Files  12 failed | 3763 passed | 13 skipped (3788)
      Tests  47 failed | 39827 passed | 152 skipped (40026)
   Duration  354.63s (transform 852.01s, setup 0ms, import 3288.24s, tests 1026.90s, environment 122.97s)
exit=1 finished=2026-08-22T03:09:00Z
```
