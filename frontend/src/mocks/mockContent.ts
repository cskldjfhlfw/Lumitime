export type ContentKind = 'scripts' | 'works' | 'blogs';

export interface ScriptItem {
  id: string;
  title: string;
  desc: string;
  summary: string;
  tag: string;
  language: string;
  tags: string[];
  updatedAt: string;
  updated_at: string;
  code: string;
  usage: string;
  notes: string[];
  allowCopy: boolean;
  allow_copy: boolean;
}

export interface WorkAttachment {
  id: string;
  filename: string;
  fileSize: number;
  file_size: number;
  canDownload: boolean;
  can_download: boolean;
}

export interface WorkItem {
  id: string;
  title: string;
  desc: string;
  summary: string;
  tag: string;
  category: string;
  tags: string[];
  updatedAt: string;
  updated_at: string;
  downloadable: boolean;
  highlights: string[];
  body: string[];
  attachments: WorkAttachment[];
}

export interface BlogItem {
  id: string;
  title: string;
  desc: string;
  summary: string;
  tag: string;
  tags: string[];
  updatedAt: string;
  updated_at: string;
  readTime: string;
  body: string[];
}

export const scripts: ScriptItem[] = [
  {
    id: 'service-polling',
    title: '日志提交状态轮询',
    desc: '根据 service_request_id 轮询服务执行状态，包含超时处理和错误分类。',
    summary: '根据 service_request_id 轮询服务执行状态，包含超时处理和错误分类。',
    tag: 'TypeScript',
    language: 'TypeScript',
    tags: ['工作站', '轮询', '异步服务'],
    updatedAt: '2026-06-13',
    updated_at: '2026-06-13T21:20:00+08:00',
    code: `async function pollServiceRequest(serviceRequestId: string) {
  const pollingUrl = \`/api/v1/workstation/service-requests/\${serviceRequestId}\`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < 120_000) {
    const response = await fetch(pollingUrl);
    const payload = await response.json();
    const status = payload.data.status;

    if (!['pending', 'running'].includes(status)) return payload.data;
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }

  return { service_request_id: serviceRequestId, status: 'timeout' };
}`,
    usage: '发起服务请求后保存 service_request_id，每 2 秒轮询详情接口，120 秒后停止等待并引导用户到提交记录页查看。',
    notes: ['接口 request_id 用于排查 API 调用，不等同于 service_request_id', 'pending / running 时继续轮询', '不在前端缓存学生学习 App 密码'],
    allowCopy: true,
    allow_copy: true,
  },
  {
    id: 'account-mask',
    title: '账号掩码工具',
    desc: '将学生学习 App 账号转为安全展示格式，避免完整账号出现在界面中。',
    summary: '将学生学习 App 账号转为安全展示格式，避免完整账号出现在界面中。',
    tag: 'Security',
    language: 'TypeScript',
    tags: ['安全', '脱敏', '账号'],
    updatedAt: '2026-06-12',
    updated_at: '2026-06-12T18:30:00+08:00',
    code: `function maskAccount(account: string) {
  if (account.length <= 8) return account.replace(/.(?=.{2})/g, '*');
  return \`\${account.slice(0, 4)}****\${account.slice(-4)}\`;
}

maskAccount('202312348912'); // 2023****8912`,
    usage: '用于提交记录、审计记录和脱敏日志展示。完整账号只参与当次服务调用，不进入响应、日志或导出文件。',
    notes: ['仅展示掩码结果', '完整账号不进入日志与导出', '失败重试仍需用户重新输入凭证'],
    allowCopy: true,
    allow_copy: true,
  },
  {
    id: 'dashboard-snapshot',
    title: '统计快照生成',
    desc: '按天生成聚合数据，供公开大屏读取，不访问明细数据。',
    summary: '按天生成聚合数据，供公开大屏读取，不访问明细数据。',
    tag: 'Node',
    language: 'Node.js',
    tags: ['看板', '聚合指标', 'CSV'],
    updatedAt: '2026-06-10',
    updated_at: '2026-06-10T09:00:00+08:00',
    code: `function createDashboardSnapshot(date: string) {
  return {
    date,
    totals: collectAggregateTotals(),
    daily_changes: collectDailyChanges(date),
  };
}`,
    usage: '公开看板读取聚合快照，管理员可导出 CSV。快照不包含用户明细、IP、账号或服务提交日志。',
    notes: ['大屏只展示聚合指标', '管理员可导出统计记录', '访客不接触任何用户明细'],
    allowCopy: true,
    allow_copy: true,
  },
];

export const works: WorkItem[] = [
  {
    id: 'lumitime-workstation',
    title: 'Lumitime 个人工作站',
    desc: '围绕脚本、作品、随记、工作服务构建的个人效率空间。',
    summary: '围绕脚本、作品、随记、工作服务构建的个人效率空间。',
    tag: 'Web App',
    category: 'project',
    tags: ['React', '工作站', '权限'],
    updatedAt: '2026-06-10',
    updated_at: '2026-06-10T16:00:00+08:00',
    downloadable: true,
    highlights: ['公开展示与邀请访问分层', '服务提交记录可追溯', '黑白微光视觉系统'],
    body: [
      '这个项目把公开品牌入口、受邀内容区和管理员后台拆成清晰的三层，让访客不会误入受限页面，也让受邀用户能快速进入工具。',
      '工作站服务采用异步提交和轮询模型，前台只展示必要结果摘要，敏感字段不在界面、日志或导出中出现。',
    ],
    attachments: [
      { id: 'att_lumi_package', filename: 'lumitime-workstation-preview.zip', fileSize: 1284500, file_size: 1284500, canDownload: true, can_download: true },
      { id: 'att_lumi_notes', filename: 'interaction-notes.pdf', fileSize: 420800, file_size: 420800, canDownload: true, can_download: true },
    ],
  },
  {
    id: 'service-traceability',
    title: '服务请求追溯方案',
    desc: '以 service_request_id 串联用户反馈、后台记录和脱敏执行日志。',
    summary: '以 service_request_id 串联用户反馈、后台记录和脱敏执行日志。',
    tag: 'Design',
    category: 'design',
    tags: ['API', '审计', '隐私'],
    updatedAt: '2026-06-08',
    updated_at: '2026-06-08T14:30:00+08:00',
    downloadable: false,
    highlights: ['用户只看自己的记录', '管理员查看完整脱敏日志', '敏感凭证不保存不导出'],
    body: [
      '追溯方案把接口追踪 ID 和业务服务请求 ID 分开：request_id 用来定位一次 API 调用，service_request_id 用来定位一次自动化服务执行。',
      '邀请用户只看到自己的记录与结果摘要，管理员可以查看完整脱敏日志，但仍不能接触密码、Token、Cookie 或完整学生账号。',
    ],
    attachments: [
      { id: 'att_trace_spec', filename: 'traceability-flow.zip', fileSize: 968300, file_size: 968300, canDownload: false, can_download: false },
    ],
  },
  {
    id: 'lumi-visual-system',
    title: '微光风格视觉系统',
    desc: '黑白主调、光束叙事和低干扰工具界面的视觉规范。',
    summary: '黑白主调、光束叙事和低干扰工具界面的视觉规范。',
    tag: 'UI',
    category: 'design-system',
    tags: ['视觉系统', '黑白微光', '界面规范'],
    updatedAt: '2026-06-06',
    updated_at: '2026-06-06T11:10:00+08:00',
    downloadable: true,
    highlights: ['登录页承担情绪入口', '普通页面保持克制留白', '后台不使用强叙事动效'],
    body: [
      '视觉系统把品牌叙事集中在入口和关键转场，工具页则回到克制、可扫描、低干扰的布局。',
      '这种分工让 Lumitime 既有记忆点，也能在频繁使用时保持效率。',
    ],
    attachments: [
      { id: 'att_visual_tokens', filename: 'lumi-visual-tokens.zip', fileSize: 734000, file_size: 734000, canDownload: true, can_download: true },
    ],
  },
];

export const blogs: BlogItem[] = [
  {
    id: 'no-password-storage',
    title: '为什么工作站需要“只保存记录，不保存密码”',
    desc: '从隐私、审计和用户信任三个角度拆解日志自动提交的边界。',
    summary: '从隐私、审计和用户信任三个角度拆解日志自动提交的边界。',
    tag: '安全设计',
    tags: ['工作站', '隐私', '权限'],
    updatedAt: '2026-06-08',
    updated_at: '2026-06-08T20:00:00+08:00',
    readTime: '6 min',
    body: [
      '工作站服务会接触外部系统账号，但 Lumitime 的边界必须更清楚：服务可以处理一次请求，却不拥有用户的长期凭证。',
      '提交记录只需要保存服务名称、状态、service_request_id、耗时、结果摘要和账号掩码。接口 request_id 只用于 API 调用排查。',
      '这样的设计让失败重试更麻烦一点，但换来的是更明确的信任关系：每次重试都由用户主动重新授权。',
    ],
  },
  {
    id: 'login-motion-meaning',
    title: '从下坠到向上：登录动效的产品语义',
    desc: '让动画服务于 Lumitime 的情绪转折，而不是只做装饰。',
    summary: '让动画服务于 Lumitime 的情绪转折，而不是只做装饰。',
    tag: '交互',
    tags: ['登录', '动效', '品牌叙事'],
    updatedAt: '2026-06-07',
    updated_at: '2026-06-07T15:40:00+08:00',
    readTime: '4 min',
    body: [
      '登录前的光束和人物剪影表达的是误以为自己在向下。登录成功后的反转，让同一个画面变成向上的引导。',
      '这个动效不应该拖慢效率，所以它必须短、轻、可降级。用户频繁跳转时，内容可直接淡入。',
      '品牌叙事最好的位置是入口，而工具页面要重新回到清晰、轻量和可读。',
    ],
  },
  {
    id: 'personal-ia-restraint',
    title: '个人项目的信息架构如何克制',
    desc: '公开展示、邀请访问和独立后台之间的边界设计。',
    summary: '公开展示、邀请访问和独立后台之间的边界设计。',
    tag: 'IA',
    tags: ['信息架构', '权限', '前台体验'],
    updatedAt: '2026-06-05',
    updated_at: '2026-06-05T10:25:00+08:00',
    readTime: '7 min',
    body: [
      'Lumitime 不是企业门户，也不是内容社区。它的核心是个人表达和个人工具。',
      '公开区负责让访客理解这个空间，邀请区负责给受邀用户提供内容和服务，后台则独立承担维护和排查。',
      '当这三层边界足够清楚，导航、权限提示和页面布局都会自然变得更轻。',
    ],
  },
];

export function getContentItems(kind: ContentKind) {
  if (kind === 'scripts') return scripts;
  if (kind === 'works') return works;
  return blogs;
}

export function getContentItem(kind: ContentKind, id: string) {
  return getContentItems(kind).find(item => item.id === id);
}

export const contentLabels: Record<ContentKind, { title: string; route: string }> = {
  scripts: { title: '脚本分享', route: '/scripts' },
  works: { title: '个人作品', route: '/works' },
  blogs: { title: '经验心得', route: '/blogs' },
};
