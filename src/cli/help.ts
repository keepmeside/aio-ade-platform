/* eslint-disable max-lines -- Why: root and generated command help text live together so CLI discovery stays greppable. */
import type { CommandSpec } from './args'
import { findCommandSpec, isCommandGroup } from './args'
import { unknownCommandData } from './command-suggestion'

// Exported for help-command-coverage.test.ts, which proves help never advertises a command that
// dispatch cannot route.
export const ROOT_HELP_TEXT = `aio-ade

Usage: aio-ade <command> [options]

Startup:
  open                      Launch AIO-ADE and wait for the runtime to be reachable
  serve                     Start a headless AIO-ADE runtime server
  status                    Show app/runtime/graph readiness

Diagnostics:
  diagnostics memory        Collect a memory snapshot for AIO-ADE and managed terminals

Agent Discovery:
  agent-context             Print the machine-readable command schema for agents

Skills:
  skills list               List version-matched skill guides bundled with this AIO-ADE CLI
  skills get                Print a version-matched skill guide as Markdown

Environments:
  environment add           Save a remote AIO-ADE runtime from a pairing code
  environment list          List saved remote AIO-ADE runtimes
  environment show          Show one saved remote AIO-ADE runtime
  environment rm            Remove a saved remote AIO-ADE runtime

Environment Recipes:
  vm recipe doctor          Validate a per-workspace environment recipe

Automations:
  automations list          List scheduled AIO-ADE automations
  automations show          Show one AIO-ADE automation
  automations create        Create a scheduled AIO-ADE automation
  automations edit          Edit an AIO-ADE automation
  automations remove        Remove an AIO-ADE automation and its run history
  automations run           Run an AIO-ADE automation now
  automations runs          List automation run history

Projects:
  project list              List durable projects known to AIO-ADE
  project setups            List project host setups
  project setup-existing-folder Make a project available on a host by importing an existing folder
  project setup-clone       Make a project available on a host by cloning a repository
  project setup-create      Create independent project host setup metadata
  project setup-update      Update project host setup metadata
  project setup-delete      Remove a project host setup

Repos:
  repo list                 List repos registered in AIO-ADE
  repo add                  Add a project to AIO-ADE by filesystem path
  repo show                 Show one registered repo
  repo set-base-ref         Set the repo's default base ref for future worktrees
  repo search-refs          Search branch/tag refs within a repo

Worktrees:
  worktree list             List AIO-ADE-managed worktrees
  worktree show             Show one worktree
  worktree current          Show the AIO-ADE-managed worktree for the current directory
  worktree create           Create a new AIO-ADE-managed worktree
  worktree set              Update AIO-ADE metadata for a worktree
  worktree rm               Remove a worktree from AIO-ADE and git
  worktree ps               Show a compact orchestration summary across worktrees

Files:
  file open                 Open a workspace file in the AIO-ADE editor
  file diff                 Open a workspace file diff in the AIO-ADE editor
  file open-changed         Open all git-changed files for a workspace

Terminals:
  terminal list             List live AIO-ADE-managed terminals
  terminal show             Show terminal metadata and preview
  terminal read             Read bounded terminal output
  terminal send             Send input to a live terminal
  terminal wait             Wait for a terminal condition (exit, tui-idle)
  terminal stop             Stop terminals for a worktree
  terminal create           Create a terminal session in a worktree
  terminal rename           Set or clear the title of a terminal tab
  terminal split            Split an existing terminal pane
  terminal switch           Bring a terminal tab to the foreground
  terminal focus            Alias for terminal switch
  terminal close            Close a terminal pane/session, or its whole tab with --tab

Orchestration:
  orchestration run-create  Create and bind a lightweight orchestration Run
  orchestration run-use     Bind this coordinator terminal to an existing Run
  orchestration run-current Show this terminal's bound Run
  orchestration run-list    List lightweight orchestration Runs
  orchestration run-show    Show one lightweight orchestration Run
  orchestration send        Send an inter-agent message
  orchestration check       Check the bound Run mailbox
  orchestration ask         Ask the coordinator a blocking question
  orchestration reply       Reply to a message
  orchestration inbox       Show all messages across recipients
  orchestration task-create Create an orchestration task
  orchestration task-list   List orchestration tasks
  orchestration task-update Update a task status
  orchestration dispatch    Dispatch a task to a terminal
  orchestration dispatch-show Show dispatch context for a task
  orchestration worker-start Start a supervised worker locally or on a connected AIO-ADE server
  orchestration worker-show Inspect one supervised worker
  orchestration worker-read Read bounded output from one supervised worker
  orchestration worker-stop Stop one supervised worker
  orchestration worker-abandon Fence an uncertain worker without claiming it stopped
  orchestration coordinator-start Start the legacy automatic coordinator loop
  orchestration coordinator-stop Stop the legacy automatic coordinator loop
  orchestration gate-create Create a decision gate blocking a task
  orchestration gate-resolve Resolve a pending decision gate
  orchestration gate-list   List decision gates
  orchestration reset       Reset orchestration state

Computer Use:
  computer capabilities     Show computer-use provider capabilities
  computer permissions      Show or open computer-use permission setup
  computer list-apps        List running apps available to computer-use
  computer list-windows     List visible windows for a target app
  computer get-app-state    Capture a compact accessibility snapshot of an app
  computer click            Click an app element or window coordinate
  computer perform-secondary-action Run an advertised accessibility action
  computer scroll           Scroll an app element
  computer drag             Drag between app elements or window coordinates
  computer type-text        Type literal text at the current app focus
  computer press-key        Press a single key such as Return or Escape
  computer hotkey           Press a shortcut combination such as CmdOrCtrl+A
  computer paste-text       Paste text through the native clipboard path
  computer set-value        Set the value of a settable app element

Linear:
  linear                    Read Linear ticket context for agents

Mobile Emulator (iOS Simulator):
  emulator list             List available/running emulators (AIO-ADE-managed + raw serve-sim)
  emulator attach <device>  Attach/start helper and make active for the worktree
  emulator tap <x> <y>      Tap at normalized 0..1 coords (preferred for single taps)
  emulator type <text>      Type text (US ASCII only)
  emulator gesture <json>   Send begin/move/end touch points
  emulator button <name>    Hardware button (home, side_button, etc.)
  emulator rotate <o>       Rotate device (portrait|landscape_left|...)
  emulator exec --command   Raw serve-sim subcommand passthrough (no "serve-sim" prefix)
  emulator kill             Stop helper for device


Common Commands:
  aio-ade open [--json]
  aio-ade serve [--port <port>] [--pairing-address <host>] [--mobile-pairing] [--no-pairing] [--project-root <path>] [--recipe-json] [--json]
  aio-ade status [--json]
  aio-ade diagnostics memory [--json]
  aio-ade agent-context [--json]
  aio-ade environment add --name <name> --pairing-code <code> [--json]
  aio-ade environment list [--json]
  aio-ade environment show --environment <selector> [--json]
  aio-ade environment rm --environment <selector> [--json]
  aio-ade worktree list [--repo <selector>] [--limit <n>] [--json]
  aio-ade worktree create --name <name> [--repo <selector>|--project <id> [--host <host-id>]|--project-host-setup <id>] [--agent <id>] [--prompt <text>] [--setup run|skip|inherit] [--base-branch <ref>] [--issue <number>] [--linear-issue <identifier-or-url>] [--comment <text>] [--parent-worktree <selector>] [--no-parent] [--run-hooks] [--activate] [--json]
  aio-ade worktree show --worktree <selector> [--json]
  aio-ade worktree current [--json]
  aio-ade worktree set --worktree <selector> [--display-name <name>] [--issue <number|null>] [--linear-issue <identifier-or-url|null>] [--comment <text>] [--workspace-status <id>] [--parent-worktree <selector>|--no-parent] [--json]
  aio-ade worktree rm --worktree <selector> [--force] [--run-hooks] [--json]
  aio-ade worktree ps [--limit <n>] [--json]
  aio-ade file open <path> [--worktree <selector>] [--json]
  aio-ade file diff <path> [--staged] [--worktree <selector>] [--json]
  aio-ade file open-changed [--mode edit|diff|both] [--worktree <selector>] [--json]
  aio-ade terminal list [--worktree <selector>] [--limit <n>] [--json]
  aio-ade terminal show [--terminal <handle>] [--json]
  aio-ade terminal read [--terminal <handle>] [--cursor <n>] [--limit <n>] [--json]
  aio-ade terminal send [--terminal <handle>] [--text <text>] [--enter] [--interrupt] [--json]
  aio-ade terminal wait [--terminal <handle>] --for exit|tui-idle [--timeout-ms <ms>] [--json]
  aio-ade terminal stop --worktree <selector> [--json]
  aio-ade terminal create [--worktree <selector>] [--title <name>] [--command <text>] [--focus] [--json]
  aio-ade terminal split [--terminal <handle>] [--direction horizontal|vertical] [--json]
  aio-ade terminal switch [--terminal <handle>] [--json]
  aio-ade terminal close [--terminal <handle>] [--tab] [--json]
  aio-ade project list [--json]
  aio-ade project setups [--project <id>] [--host <host-id>] [--json]
  aio-ade project setup-existing-folder --project <id> --host <host-id> --path <path> [--kind git|folder] [--display-name <name>] [--json]
  aio-ade project setup-clone --project <id> --host <host-id> --url <clone-url> --destination <path> [--display-name <name>] [--json]
  aio-ade project setup-create --project <id> --host <host-id> [--setup-id <id>] [--path <path>] [--kind git|folder] [--display-name <name>] [--worktree-base-path <path>] [--git-username <name>] [--state ready|not-set-up|setting-up|error|unsupported] [--method imported-existing-folder|cloned|provisioned] [--json]
  aio-ade project setup-update --setup <setup-id> [--display-name <name>] [--path <path>] [--worktree-base-path <path>] [--git-username <name>] [--kind git|folder] [--state ready|not-set-up|setting-up|error|unsupported] [--method legacy-repo|imported-existing-folder|cloned|provisioned] [--json]
  aio-ade project setup-delete --setup <setup-id> [--json]
  aio-ade repo list [--json]
  aio-ade repo add --path <path> [--json]
  aio-ade repo show --repo <selector> [--json]
  aio-ade repo set-base-ref --repo <selector> --ref <ref> [--json]
  aio-ade repo search-refs --repo <selector> --query <text> [--limit <n>] [--json]

Selectors:
  --repo <selector>         Registered repo selector such as id:<id>, name:<name>, or path:<path>
  --worktree <selector>     Worktree selector such as id:<repo-id>::<path>, name:<displayName>, branch:<branch>, issue:<number>, path:<path>, or active/current
  --terminal <handle>       Runtime-issued terminal handle returned by \`aio-ade terminal list --json\`
  --parent-worktree <selector> Parent worktree selector such as id:<repo-id>::<path>, branch:<branch>, issue:<number>, path:<path>, or active/current
  --no-parent               Force no parent lineage for unrelated worktree creation/update

Terminal Send Options:
  --text <text>             Text to send to the terminal
  --enter                   Append Enter after sending text
  --interrupt               Send as an interrupt-style input when supported

Wait Options:
  --for exit                Wait until the target terminal exits
  --timeout-ms <ms>         Maximum wait time before timing out

Output Options:
  --json                    Emit machine-readable JSON instead of human text
  --pairing-code <code>      Connect to a remote AIO-ADE runtime using an aio-ade://pair?... code
  --environment <selector>   Connect using a saved environment id or name
  --help                    Show this help message

Behavior:
  Most commands require a running AIO-ADE runtime. If AIO-ADE is not open yet, run \`aio-ade open\` first.
  Remote runtime access can also be supplied with AIO_ADE_PAIRING_CODE or AIO_ADE_ENVIRONMENT.
  Use selectors for discovery and handles for repeated live terminal operations.

Agent Sessions And Worktrees:
  \`worktree create --agent\` creates a new checkout with an agent.
  To start a fresh agent in the current worktree, use:
    aio-ade terminal create --worktree active --command "codex"


Examples:
  $ aio-ade open
  $ aio-ade status --json
  $ aio-ade diagnostics memory --json
  $ aio-ade repo list
  $ aio-ade worktree create --name agent-task --agent codex --prompt "hi"
  $ aio-ade worktree create --repo name:aio-ade --name cli-test-1 --issue 273
  $ aio-ade worktree create --repo name:aio-ade --name linear-task --linear-issue https://linear.app/stably/issue/STA-335/test-issue
  $ aio-ade worktree create --name linear-task --linear-issue STA-335
  $ aio-ade worktree show --worktree branch:Jinwoo-H/cli
  $ aio-ade worktree current
  $ aio-ade worktree set --worktree active --comment "waiting on review"
  $ aio-ade worktree set --worktree active --linear-issue null
  $ aio-ade worktree ps --limit 10
  $ aio-ade file open-changed --mode diff
  $ aio-ade file open src/App.tsx
  $ aio-ade terminal create --worktree active --command "codex"
  $ aio-ade terminal list --worktree path:/Users/me/aio-ade/workspaces/aio-ade/cli-test-1 --json
  $ aio-ade terminal send --terminal term_123 --text "hi" --enter
  $ aio-ade terminal wait --terminal term_123 --for exit --timeout-ms 60000 --json`

export function printHelp(specs: CommandSpec[], commandPath: string[] = []): void {
  const exactSpec = findCommandSpec(specs, commandPath)
  if (exactSpec) {
    console.log(formatCommandHelp(exactSpec))
    return
  }

  if (isCommandGroup(commandPath)) {
    console.log(formatGroupHelp(specs, commandPath[0]))
    return
  }

  if (commandPath.length > 0) {
    const { nextSteps } = unknownCommandData(specs, commandPath)
    const recovery = nextSteps.map((step) => `Next step: ${step}`).join('\n')
    console.log(`Unknown command: ${commandPath.join(' ')}${recovery ? `\n${recovery}` : ''}\n`)
  }

  console.log(ROOT_HELP_TEXT)
}

export function formatCommandHelp(spec: CommandSpec): string {
  const lines = [`aio-ade ${spec.path.join(' ')}`, '', `Usage: ${spec.usage}`, '', spec.summary]
  const displayedFlags = spec.argumentMode === 'passthrough' ? [] : spec.allowedFlags

  if (displayedFlags.length > 0) {
    lines.push('', 'Options:')
    for (const flag of displayedFlags) {
      lines.push(`  ${formatCommandFlagHelp(flag, spec.path)}`)
    }
  }

  if (spec.notes && spec.notes.length > 0) {
    lines.push('', 'Notes:')
    for (const note of spec.notes) {
      lines.push(`  ${note}`)
    }
  }

  if (spec.examples && spec.examples.length > 0) {
    lines.push('', 'Examples:')
    for (const example of spec.examples) {
      lines.push(`  $ ${example}`)
    }
  }

  return lines.join('\n')
}

export function formatGroupHelp(specs: CommandSpec[], group: string): string {
  const groupSpecs = specs.filter((spec) => spec.path[0] === group)
  const lines = [
    `aio-ade ${group}`,
    '',
    `Usage: aio-ade ${group} <command> [options]`,
    '',
    'Commands:'
  ]
  for (const spec of groupSpecs) {
    lines.push(`  ${spec.path.slice(1).join(' ').padEnd(18)} ${spec.summary}`)
  }
  lines.push('', `Run \`aio-ade ${group} <command> --help\` for command-specific usage.`)
  return lines.join('\n')
}

function formatCommandFlagHelp(flag: string, commandPath: string[]): string {
  const command = commandPath.join(' ')
  if (command === 'terminal close' && flag === 'tab') {
    return '--tab                  Close the whole tab and wait for durable persistence'
  }
  if (command === 'linear issue' && flag === 'id') {
    return '--id <id>             Linear issue key, id, or URL'
  }
  if (command === 'linear issue' && flag === 'workspace') {
    return '--workspace <id>      Connected Linear workspace id'
  }
  if (command === 'linear search' && flag === 'query') {
    return '--query <text>        Text to search across Linear issues'
  }
  if (command === 'linear search' && flag === 'workspace') {
    return '--workspace <id|all>  Connected Linear workspace id, or all'
  }
  if (command === 'linear list-issues' && flag === 'cursor') {
    return '--cursor <cursor>      Opaque cursor returned by a previous list-issues page'
  }
  if (command === 'orchestration worker-read' && flag === 'cursor') {
    return '--cursor <cursor>      Opaque cursor returned by a previous worker-read page'
  }
  if (command === 'linear list-issues' && flag === 'workspace') {
    return '--workspace <id|all>  Connected Linear workspace id, or all'
  }
  if (command.startsWith('linear ') && flag === 'workspace') {
    return '--workspace <id>      Connected Linear workspace id'
  }
  if (command.startsWith('linear ') && flag === 'body') {
    return '--body <text>         Linear comment or issue body'
  }
  if (command.startsWith('linear ') && flag === 'body-file') {
    return '--body-file <path|->  Read Linear body from a file or stdin'
  }
  if (command.startsWith('linear ') && flag === 'write-id') {
    return '--write-id <uuid>     Retry id from linear_write_unconfirmed'
  }
  if (command.startsWith('linear ') && flag === 'to') {
    return '--to <state>          Exact Linear workflow state name'
  }
  if (command === 'linear comment add' && flag === 'reply-to') {
    return '--reply-to <id>       Comment id to reply to'
  }
  if (command === 'linear attach' && flag === 'url') {
    return '--url <url>           Absolute http(s) link to attach'
  }
  if (command === 'linear attach' && flag === 'title') {
    return '--title <text>        Attachment title'
  }
  if (command === 'linear create' && flag === 'title') {
    return '--title <text>        New Linear issue title'
  }
  if (command === 'linear create' && flag === 'team') {
    return '--team <key>          Linear team key'
  }
  if (command === 'linear create' && flag === 'parent') {
    return '--parent <id>         Parent Linear issue key, id, or URL'
  }
  if (command === 'linear create' && flag === 'parent-current') {
    return '--parent-current      Use the current linked issue as parent'
  }
  if (command === 'worktree create' && flag === 'parent-worktree') {
    return '--parent-worktree <selector> Parent selector such as active/current, id:<repo-id>::<path>, branch:<branch>, issue:<number>, path:<path>, folder:<id>, or worktree:<worktreeId>'
  }
  if (command === 'orchestration task-create' && flag === 'task-title') {
    return '--task-title <text>  Concise title for the orchestration task'
  }
  if (command === 'orchestration task-create' && flag === 'display-name') {
    return '--display-name <text> UI label shown for dispatched worker rows'
  }
  if (flag === 'key' && command === 'computer hotkey') {
    return '--key <key-combo>      Modifier chord with one key, e.g. CmdOrCtrl+A'
  }
  if (flag === 'key' && command === 'computer press-key') {
    return '--key <key>            Single key, e.g. Return, Escape, Tab, Left, or PageUp'
  }
  return formatFlagHelp(flag)
}

export function formatFlagHelp(flag: string): string {
  const helpByFlag: Record<string, string> = {
    agent: '--agent <id>          Launch a known TUI agent in the first terminal',
    'base-branch': '--base-branch <ref>    Base branch/ref to create the worktree from',
    command: '--command <text>       Command to run in the terminal on startup',
    comment: '--comment <text>       Comment stored in AIO-ADE metadata',
    cursor: '--cursor <n>           Line cursor from a previous read (returns only new output)',
    action: '--action <name>       Secondary accessibility action name',
    activate: '--activate             Reveal the new worktree in the AIO-ADE app',
    app: '--app <app>            App name, bundle ID, or pid:N',
    direction:
      '--direction <dir>      Direction: up|down|left|right for scroll, horizontal|vertical for split',
    'display-name': '--display-name <name>  Override the AIO-ADE display name',
    'element-index': '--element-index <n>   Element index from get-app-state',
    title: '--title <text>         Custom title for the terminal tab (omit to reset)',
    enter: '--enter                Append Enter after sending text',
    force: '--force                Force worktree removal when supported',
    focus: '--focus                Reveal the created terminal session in AIO-ADE',
    for: '--for exit|tui-idle    Wait condition to satisfy',
    'from-element-index': '--from-element-index <n> Source element index from get-app-state',
    'from-x': '--from-x <x>           Source window-local x coordinate',
    'from-y': '--from-y <y>           Source window-local y coordinate',
    help: '--help                 Show this help message',
    interrupt: '--interrupt            Send as an interrupt-style input when supported',
    id: '--id <id>             Identifier for a target item or permission',
    issue: '--issue <number|null>  Linked GitHub issue number',
    'linear-issue':
      '--linear-issue <id|url|null> Linked Linear issue identifier or URL; null clears on set',
    json: '--json                 Emit machine-readable JSON',
    key: '--key <key>            Key argument for this command',
    limit: '--limit <n>            Maximum number of rows to return',
    mode: '--mode <mode>          Mode such as edit, diff, or both',
    'mouse-button': '--mouse-button <btn>   Mouse button: left, right, or middle',
    name: '--name <name>          Name for the new worktree or automation',
    'no-parent': '--no-parent            Force no parent lineage for unrelated work',
    'no-screenshot': '--no-screenshot       Skip screenshot capture after the operation',
    pages: '--pages <n>           Number of scroll pages',
    'parent-worktree':
      '--parent-worktree <selector> Parent worktree selector such as id:<repo-id>::<path>, branch:<branch>, issue:<number>, path:<path>, or active/current',
    path: '--path <path>          Path argument for the command',
    prompt: '--prompt <text>        Prompt text for agent-backed commands',
    query: '--query <text>        Search text for matching refs',
    ref: '--ref <ref>            Base ref to persist for the repo',
    repo: '--repo <selector>      Repo selector such as id:<id>, name:<name>, or path:<path>',
    'restore-window':
      '--restore-window     Bring the target app/window forward before the operation',
    session: '--session <id>        Snapshot namespace for a related computer-use workflow',
    setup: '--setup run|skip|inherit Setup policy for repo-defined setup hooks',
    terminal: '--terminal <handle>  Runtime-issued terminal handle',
    text: '--text <text>          Text payload to send or type',
    'text-stdin': '--text-stdin          Read text payload from stdin',
    'task-id': '--task-id <id>        Task id to include in orchestration payload JSON',
    'task-title': '--task-title <text>    Concise title for an orchestration task',
    'dispatch-id': '--dispatch-id <id>    Dispatch id to include in orchestration payload JSON',
    'files-modified': '--files-modified <csv> Comma-separated files for orchestration payload JSON',
    'report-path': '--report-path <path>  Report path to include in orchestration payload JSON',
    phase: '--phase <text>        Worker phase to include in orchestration payload JSON',
    'timeout-ms': '--timeout-ms <ms>     Maximum wait time before timing out',
    'to-element-index': '--to-element-index <n> Destination element index from get-app-state',
    'to-x': '--to-x <x>             Destination window-local x coordinate',
    'to-y': '--to-y <y>             Destination window-local y coordinate',
    worktree:
      '--worktree <selector>  Worktree selector such as id:<repo-id>::<path>, name:<displayName>, branch:<branch>, issue:<number>, path:<path>, or active/current',
    workspace: '--workspace <selector> Existing worktree selector for automation runs',
    'workspace-status':
      '--workspace-status <id> Board status id (defaults: todo, in-progress, in-review, completed)',
    staged: '--staged               Open staged source-control changes',
    provider: '--provider <agent>     Agent id such as codex, claude, or gemini',
    'source-context':
      '--source-context <json|null> Explicit TaskSourceContext for automation task/provider data',
    trigger: '--trigger <schedule>   Automation schedule preset, cron, or RRULE',
    schedule: '--schedule <schedule>  Alias for --trigger',
    time: '--time <HH:MM>        Time used with daily/weekdays/weekly presets',
    day: '--day <0-6>           Day used with weekly preset, Sunday=0',
    timezone: '--timezone <tz>       IANA timezone for the automation',
    enabled: '--enabled              Enable the automation',
    disabled: '--disabled             Disable the automation',
    'reuse-session':
      '--reuse-session        Reuse the previous live session for existing-workspace runs',
    'fresh-session': '--fresh-session        Disable session reuse for future runs',
    'workspace-mode': '--workspace-mode <mode> existing or new-per-run',
    'missed-run-grace-minutes': '--missed-run-grace-minutes <n> Missed-run grace window',
    'value-stdin': '--value-stdin         Read set-value payload from stdin',
    'window-id': '--window-id <id>      Target a window id from list-windows',
    'window-index': '--window-index <n>   Target a window index from list-windows',
    // Browser automation flags
    element: '--element <ref>        Element ref from snapshot (e.g. e3)',
    url: '--url <url>            URL to navigate to',
    value: '--value <text>         Value to fill or select',
    input: '--input <text>         Text to type at current focus',
    expression: '--expression <js>     JavaScript expression to evaluate',
    amount: '--amount <pixels>      Scroll distance in pixels',
    index: '--index <n>            Tab index to switch to',
    page: '--page <id>            Stable browser page id from `aio-ade tab list --json`',
    profile: '--profile <id>        Browser profile id',
    'show-profile': '--show-profile        Include tab profile in text output',
    format: '--format <png|jpeg>    Screenshot image format'
  }

  if (flag === 'current') {
    return '--current              Use the current AIO-ADE worktree linked Linear issue'
  }
  if (flag === 'comments') {
    return '--comments             Include threaded Linear comments'
  }
  if (flag === 'children') {
    return '--children             Include recursive child issues'
  }
  if (flag === 'depth') {
    return '--depth <n>            Child issue depth for --children/--full'
  }
  if (flag === 'attachments') {
    return '--attachments          Include attachment metadata and URLs'
  }
  if (flag === 'relations') {
    return '--relations            Include blocking, related, and duplicate links'
  }
  if (flag === 'activity') {
    return '--activity             Include issue field-change history'
  }
  if (flag === 'full') {
    return '--full                 Include all supported V1 issue context within caps'
  }

  return helpByFlag[flag] ?? `--${flag}`
}
