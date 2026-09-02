// Chinese phrase fixes from high-visibility UI audit round 5.
export const ZH_PHRASE_FIXES_ROUND5 = [
  { pattern: /AIO-ADE集成开发环境/g, replacement: 'AIO-ADE IDE', whenEnIncludes: 'AIO-ADE IDE' },
  { pattern: /AIO-ADE第一/g, replacement: 'AIO-ADE 优先', whenEnIncludes: 'AIO-ADE first' },
  { pattern: /AIO-ADE移动/g, replacement: 'AIO-ADE Mobile', whenEnIncludes: 'AIO-ADE Mobile' },
  { pattern: /AIO-ADE归属/g, replacement: 'AIO-ADE 归因', whenEnIncludes: 'AIO-ADE Attribution' },
  { pattern: /AIO-ADE标志/g, replacement: 'AIO-ADE 标志', whenEnIncludes: 'AIO-ADE logo' },
  { pattern: /喜欢AIO-ADE/g, replacement: '喜欢 AIO-ADE', whenEnIncludes: 'Enjoying AIO-ADE' },
  { pattern: /认识AIO-ADE/g, replacement: '了解 AIO-ADE', whenEnIncludes: 'Get to know AIO-ADE' },
  { pattern: /支持AIO-ADE/g, replacement: '支持 AIO-ADE', whenEnIncludes: 'Support AIO-ADE' },
  { pattern: /展开AIO-ADE/g, replacement: '展开 AIO-ADE', whenEnIncludes: 'Expand AIO-ADE' },
  { pattern: /来自AIO-ADE/g, replacement: '来自 AIO-ADE', whenEnIncludes: 'from AIO-ADE' },
  {
    pattern: /正在重新启动AIO-ADE/g,
    replacement: '正在重启 AIO-ADE',
    whenEnIncludes: 'Restarting AIO-ADE'
  },
  { pattern: /AIO-ADE([\u4e00-\u9fff])/g, replacement: 'AIO-ADE $1', whenEnIncludes: 'AIO-ADE' },
  { pattern: /Linear([\u4e00-\u9fff])/g, replacement: 'Linear $1', whenEnIncludes: 'Linear' },
  { pattern: /Codex([\u4e00-\u9fff])/g, replacement: 'Codex $1', whenEnIncludes: 'Codex' },
  { pattern: /Claude([\u4e00-\u9fff])/g, replacement: 'Claude $1', whenEnIncludes: 'Claude' },
  { pattern: /Claude代码/g, replacement: 'Claude Code', whenEnIncludes: 'Claude Code' },
  { pattern: /GitHub 和Linear/g, replacement: 'GitHub 和 Linear', whenEnIncludes: 'Linear tasks' },
  { pattern: /托管审阅/g, replacement: '托管评审', whenEnIncludes: 'hosted-review' },
  { pattern: /托管审阅/g, replacement: '托管评审', whenEnIncludes: 'Hosted-review' },
  { pattern: /审阅笔记/g, replacement: '评审笔记', whenEnIncludes: 'review note' },
  { pattern: /审阅任务/g, replacement: '评审任务', whenEnIncludes: 'review task' },
  { pattern: /待审阅/g, replacement: '待评审', whenEnIncludes: 'need review' },
  { pattern: /重新审核/g, replacement: '重新评审', whenEnIncludes: 'Re-review' },
  { pattern: /依赖项审核/g, replacement: '依赖项审计', whenEnIncludes: 'dependency audit' },
  { pattern: /Git AI 作者/g, replacement: 'Git AI Author', whenEnIncludes: 'Git AI Author' },
  { pattern: /基本引用/g, replacement: '基础引用', whenEnIncludes: 'base ref' },
  { pattern: /重新开放PR/g, replacement: '重新打开 PR', whenEnIncludes: 'Reopen PR' },
  { pattern: /重新开放/g, replacement: '重新打开', whenEnIncludes: 'reopen' },
  { pattern: /受限制的钥匙/g, replacement: '受限制的密钥', whenEnIncludes: 'restricted keys' },
  { pattern: /更换钥匙/g, replacement: '更换密钥', whenEnIncludes: 'Replace key' },
  {
    pattern: /根据所看到的内容采取行动/g,
    replacement: '根据所看到的内容执行操作',
    whenEnIncludes: 'act on what they see'
  },
  {
    pattern: /建议下一步行动/g,
    replacement: '建议下一步操作',
    whenEnIncludes: 'suggest next actions'
  },
  {
    pattern: /可操作的问题/g,
    replacement: '需处理的问题',
    whenEnIncludes: 'actionable issues'
  },
  {
    pattern: /显示 AIO-ADE 移动按钮/g,
    replacement: '显示 AIO-ADE Mobile 按钮',
    whenEnIncludes: 'Show AIO-ADE Mobile Button'
  }
]
