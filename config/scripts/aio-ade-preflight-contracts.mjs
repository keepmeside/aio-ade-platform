export const GIT_COMPATIBILITY_FLOOR = '2.25.0'

export const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.pnpm-store',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'release'
])

export const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.ps1',
  '.rs',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml'
])

export const SENSITIVE_FILE_PATTERN =
  /(?:^|\/)(?:\.env(?:\..*)?|credentials?\.json|id_(?:rsa|ed25519)|[^/]+\.(?:jks|key|keystore|p12|pem|pfx))$/i

export const DESTRUCTIVE_SCOPES = [
  {
    id: 'mobile',
    ownerPhase: 2,
    action: 'delete',
    rootPatterns: [
      'mobile/**',
      'src/**/mobile/**',
      'src/**/*mobile*',
      'config/**/*mobile*',
      'docs/**/*mobile*',
      '.github/workflows/*mobile*',
      'resources/**/*mobile*'
    ],
    excludePatterns: [
      'src/renderer/src/components/browser-pane/**/*mobile*',
      'src/renderer/src/components/emulator-pane/**/*mobile*',
      'src/renderer/src/components/settings/**/*mobile*emulator*',
      'src/renderer/src/components/terminal-pane/**/*mobile*driver*',
      'src/renderer/src/lib/open-mobile-emulator*',
      'src/renderer/src/lib/pane-manager/**/*mobile*driver*',
      'src/renderer/src/lib/pane-manager/**/*mobile-fit*'
    ],
    couplingTerms: ['mobile/', 'mobile companion', 'mobile-v', 'react-native', 'testflight']
  },
  {
    id: 'product-cli',
    ownerPhase: 3,
    action: 'delete',
    rootPatterns: ['src/cli/**', 'config/scripts/*cli*', 'resources/win32/bin/**'],
    couplingTerms: ['src/cli/', 'out/cli/', 'orca-cli', 'orca serve', 'verify-cli-bin']
  },
  {
    id: 'agent-teams',
    ownerPhase: 3,
    action: 'delete',
    rootPatterns: ['**/*agent-team*'],
    couplingTerms: ['agent teams', 'agent-teams', 'agentteams']
  },
  {
    id: 'orchestration',
    ownerPhase: 3,
    action: 'delete',
    rootPatterns: ['**/*orchestration*'],
    couplingTerms: ['orchestration', 'team-preamble', 'worker-preamble']
  },
  {
    id: 'headless-serve',
    ownerPhase: 3,
    action: 'delete',
    rootPatterns: ['**/*headless*serve*', 'config/scripts/serve-headless-*'],
    couplingTerms: ['headless serve', 'orca serve', 'serve-headless']
  },
  {
    id: 'installers-shims',
    ownerPhase: 3,
    action: 'delete',
    rootPatterns: [
      'config/scripts/*install*cli*',
      'config/scripts/*launcher*',
      'resources/win32/bin/**'
    ],
    couplingTerms: ['install-dev-cli', 'resources/win32/bin/', 'launcher', 'shim']
  },
  {
    id: 'agent-roster',
    ownerPhase: 4,
    action: 'narrow',
    rootPatterns: [
      'src/**/agents/**',
      'src/**/*agent*',
      'src/**/*agent-status*',
      'src/**/*agent-session*',
      'src/**/*tui-agent*',
      'src/main/codex-cli/**',
      'src/shared/types.ts',
      '**/*agent-roster*',
      '**/*supported-agent*',
      '**/*claude-agent-teams*',
      '**/*openclaude*',
      '**/*opencode*',
      '**/*gemini*',
      '**/*copilot*',
      '**/*cursor*'
    ],
    couplingTerms: [
      'agent roster',
      'agenttype',
      'claude-code',
      'claude-agent-teams',
      'openclaude',
      'opencode',
      'gemini',
      'copilot',
      'cursor-agent',
      'supported agents'
    ]
  },
  {
    id: 'brand-tokens',
    ownerPhase: 5,
    action: 'rebrand',
    rootPatterns: ['src/renderer/src/assets/**', 'resources/build/**', '**/*brand*'],
    couplingTerms: ['onorca.dev', 'term_program', 'orca']
  },
  {
    id: 'profiles',
    ownerPhase: 10,
    action: 'migrate',
    rootPatterns: ['**/*profile*'],
    couplingTerms: ['account profile', 'profile', 'safestorage']
  },
  {
    id: 'telemetry-updater-release',
    ownerPhase: 12,
    action: 'migrate',
    rootPatterns: [
      '**/*telemetry*',
      '**/*updater*',
      '.github/workflows/*release*',
      'config/scripts/*release*'
    ],
    couplingTerms: ['electron-updater', 'posthog', 'telemetry', 'update-electron-app']
  }
]
