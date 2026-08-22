# Feature Comparison: TermDeck (localterm fork) vs Aio-IDE (Orca fork)

Mode: `--compare` (no feature named → compare per xia rules)
Date: 2026-08-21

## Source manifest

- Source: `https://github.com/huytieu/termdeck-localterm`, default branch **`termdeck`** (not `main`), commit SHA not resolved; last push 2026-08-11
- License: MIT, inherited from `monotykamary/localterm`; TermDeck additions MIT
- Stack: TypeScript, pnpm, daemon + browser client (browser-native, served over tailnet/loopback), tldraw SDK for canvas
- Size 11 MB, 5 stars, 1 fork. Itself a fork: terminal foundation is localterm's work; wiki inspired by `anh-chu/wiki-viewer`
- Scope: README-level feature inventory. Recursive tree fetch was withheld as too large, so no file-level source verification on the TermDeck side.

## Local project

`orca` v1.4.162-rc.0, Electron + React, mid-rebrand to Aio-IDE. Canvas already decided: **Excalidraw approved, tldraw explicitly rejected** for the default build (`plans/.../decisions.md`, gate "Canvas") because production tldraw needs a license key and the hobby key keeps a watermark.

TermDeck is a browser-tab workspace: terminal multiplexer + Markdown vault + canvas, reachable from any device on a tailnet. Orca is a desktop IDE. The shapes differ, but the feature overlap is nearly total, and almost every TermDeck addition already exists locally.

## Head-to-head

| Aspect | TermDeck | Aio-IDE / Orca (verified locally) | Recommendation |
| --- | --- | --- | --- |
| Access model | browser tab over tailnet / `*.ts.net` / portless local alias | Electron desktop + `src/relay`, SSH providers, remote hosts | Different by design; nothing to port |
| Session model | new tab = new shell, grace-window reaping that never kills mid-command | tab groups, keep-alive panes, hibernation gate, orphan cleanup | Parity; the "never reap a shell producing output" rule is worth checking against local hibernation heuristics |
| Live session grid | interactive tiles, fast switcher | `components/dashboard/*` snapshot dashboard + popout, `WorktreeJumpPalette` | Parity |
| Session status glyph | `●` amber running / coral needs-input / `○` green idle, in sidebar and grid tiles | `AgentStateDot.tsx`, `AgentWorkingSpinner`, dashboard rows | Parity |
| Hover-to-kill row action | yes | hover-reveal action patterns exist (`hover-reveal-touch-action-visibility`) | Parity |
| Claude usage quota in header | session 5h + weekly bar, % left, reset countdown | `status-bar/UsageRosterPanel.tsx`, `inline-usage-bars`, `provider-segment-monthly-window`, plus full `stats/*UsagePane` | Local is stronger |
| Click-to-preview file paths in output | linkified paths incl. `file.ts:42`, opens rendered in drawer | `lib/terminal-links.ts` with `resolveTerminalFileLink`, worktree containment checks, Windows path handling, tap-conformance cases | Local is stronger (cross-platform + worktree-scoped) |
| Rendered previewers | Markdown, code w/ line jump, CSV tables, images, PDF, HTML | `MarkdownPreview.tsx`, `CsvViewer.tsx`, `PdfViewer.tsx` + find, Monaco | Parity |
| Mermaid in every markdown surface | wiki, previews, agent logs, canvas cards | `MermaidViewer.tsx`, `MermaidBlock.tsx`, `mermaid-config.ts`, `comment-mermaid-fence.tsx`, slash-command catalog | Parity |
| WYSIWYG Markdown editor + `/` block menu | Notion/Obsidian style, faithful round-trip, frontmatter verbatim | `RichMarkdownEditor.tsx`, `RichMarkdownSlashMenu.tsx`, slash catalog/filter/primitives, annotation overlay | Parity |
| `[[wikilinks]]` | yes | `markdown-doc-completions.ts` handles `[[`, aliases `[[doc|Alias]]` | Parity |
| Vault file tree w/ filters, persistence, full-text search | yes | repo file tree, `QuickOpen`, ripgrep-backed search w/ install guidance | Parity for repos; TermDeck's arbitrary-vault framing has no local analogue |
| Reading view: serif typography, centered measure, reading mode, info panel (word count, blocks, reading time) | yes | `MarkdownTableOfContentsPanel` exists; no word-count / reading-time / reading-mode chrome hiding | **Small gap.** Cosmetic-tier, and any styling must come from STYLEGUIDE tokens |
| Tweak mode: element picker → CSS selector + snippet + note into terminal session; batch send | yes | `browser-pane/browser-annotation-output.ts`, `BrowserAnnotationSendMenuContent`, `GrabConfirmationSheet`, `browser-annotation-viewport-bridge` | Parity. Check whether local supports **batching** several annotations into one message |
| Text-selection "chat about this" | yes | `SelectedTextCopyMenu.tsx`, diff-comments, comment code context | Parity |
| Remote deploy preview via same-origin proxy | yes | `browser-pane` webview loads URLs directly; `ports` module exists | Not needed; Electron webview has no same-origin constraint to work around |
| GitHub issue/PR link → fetched markdown in drawer | yes | `GitHubItemDialog.tsx`, `GitLabItemDialog.tsx`, `PullRequestPage.tsx` | Local is stronger (multi-provider) |
| Canvas | tldraw SDK, offline, IndexedDB, paste-aware (mermaid source → live shape, Markdown → rendered card) | none yet; Excalidraw approved, tldraw rejected | Gap exists but **do not adopt the tldraw implementation**. The paste-aware behavior is the transferable idea |

## Challenge questions

1. Does anything here justify reopening the Canvas gate? No. tldraw's license posture is exactly why it was rejected on 2026-08-21. Risk if adopted: watermark or paid key in an MIT fork, contradicting an approved decision.
2. Is the paste-aware canvas idea portable to Excalidraw? Partly. Mermaid-source-to-live-shape and Markdown-to-rendered-card need custom element support; Excalidraw's embed/custom element story is thinner than tldraw's shape API. Risk if assumed easy: a phase-scoped feature balloons into custom renderer work.
3. Does local annotation support batching? TermDeck's "Add to batch" sends several tweaks as one agent message. Local has `browser-annotation-output` and a send menu, but batching is unverified. Risk if absent: users send one message per tweak and burn context.
4. Is TermDeck's reaping rule stricter than Orca's hibernation? TermDeck never reaps a shell producing output or running a foreground program. Orca has `AgentHibernationGate` and orphan cleanup. Risk if local is laxer: a suspended pane kills work mid-command.
5. Does the reading view conflict with the design system? Serif typography, centered measure, and a coral accent are TermDeck brand choices. AGENTS.md forbids inventing color values or font sizes outside `main.css`. Risk: a port that violates the styleguide gate.
6. Is the browser-native/tailnet access model a product gap? Orca answers remote access with relay + SSH, not a served web client. Risk if conflated: pulling in a web-server surface the rebrand plan is deliberately deferring (gate "Headless `serve`" is still pending).

## Decision matrix

| Decision | TermDeck's way | Our way | Recommendation |
| --- | --- | --- | --- |
| Canvas engine | tldraw SDK + license key | Excalidraw (approved) | Keep Excalidraw; ignore the implementation |
| Canvas paste behavior | mermaid/Markdown paste → live shapes | n/a | Adopt as an idea inside the Excalidraw phase, scoped |
| Terminal path linkify | own linkifier | `terminal-links.ts`, worktree-scoped, cross-platform | Keep local |
| Element-picker feedback | tweak mode + batch | browser annotation pipeline | Keep local; add batching if missing |
| Usage quota surface | header bar | status bar + usage panes | Keep local |
| Markdown editing | WYSIWYG + `/` menu | `RichMarkdownEditor` + slash menu | Keep local |
| Reading-mode + doc stats | serif reading view, word count, reading time | absent | Optional small addition, tokens only |
| Remote access | tailnet-served browser client | relay + SSH | Keep local; do not open `serve` |

## Risk score

Port value: **low**. Orca already implements nearly every TermDeck addition, usually with broader platform coverage. The one real feature gap (canvas) is already owned by an approved decision that rejects TermDeck's engine.

- Canvas paste-awareness (as an Excalidraw idea): risk 5/10 (custom shape support)
- Annotation batching: risk 2/10 (if actually missing)
- Reading mode + doc stats: risk 2/10 (styleguide compliance)
- Adopting tldraw: risk 9/10 (contradicts approved gate, licensing)
- Adopting tailnet web serving: risk 8/10 (reopens a deferred gate)

## Recommendation

Nothing here warrants an implementation plan on its own. Three small follow-ups, in order of value:

1. Verify annotation **batching** in `browser-pane/browser-annotation-output.ts`. If a user can't stack several element notes into one agent message, add it. Cheapest real win.
2. Carry the **paste-aware canvas** idea into the existing Excalidraw canvas phase as an explicit requirement (mermaid source → live diagram, Markdown → rendered card), noting Excalidraw may not support it as cleanly as tldraw did.
3. Optionally add **reading mode + doc stats** (word count, blocks, reading time) to `MarkdownPreview`, using only STYLEGUIDE tokens. No serif/coral brand import.

Explicitly reject: tldraw (approved gate says otherwise), the tailnet-served browser client (the `serve` gate is still pending), and the same-origin proxy (Electron doesn't need it).

Both TermDeck and its upstream localterm are MIT, so any borrowed code needs the localterm copyright preserved. Note this comparison rests on TermDeck's README; the source tree was not read.
