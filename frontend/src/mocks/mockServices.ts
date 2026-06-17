export type ServiceStatus = 'active' | 'maintenance' | 'offline';
export type ApiServiceStatus = 'enabled' | 'disabled';
export type ServiceInputType = 'text' | 'password' | 'date' | 'number' | 'textarea' | 'email';

export interface ServiceInputSchemaItem {
  name: string;
  label: string;
  type: ServiceInputType;
  required: boolean;
  placeholder?: string;
}

export interface Service {
  id: string;
  apiId: string;
  name: string;
  summary: string;
  description: string;
  status: ServiceStatus;
  apiStatus: ApiServiceStatus;
  updatedAt: string;
  updated_at: string;
  route: string;
  scriptKey: string;
  scriptVersion: string;
  inputSchema: ServiceInputSchemaItem[];
}

export const mockServices: Service[] = [
  {
    id: 'log-submit',
    apiId: 'service_log_auto_submit',
    name: '日志自动提交',
    summary: '自动提交学校实习日志。',
    description: '自动完成学习日志提交，支持状态追踪与结果反馈。',
    status: 'active',
    apiStatus: 'enabled',
    updatedAt: '2026-06-13',
    updated_at: '2026-06-13T18:30:00+08:00',
    route: '/workstation/services/service_log_auto_submit',
    scriptKey: 'log_auto_submit',
    scriptVersion: 'v1.0.0',
    inputSchema: [
      { name: 'student_account', label: '学生学习 App 账号', type: 'text', required: true },
      { name: 'student_password', label: '学生学习 App 密码', type: 'password', required: true },
      { name: 'target_date', label: '提交日期', type: 'date', required: true },
    ],
  },
  {
    id: 'script-run',
    apiId: 'service_script_run',
    name: '脚本执行引擎',
    summary: '在线运行授权脚本并返回脱敏结果。',
    description: '在线运行自定义脚本，支持定时任务与参数配置。',
    status: 'active',
    apiStatus: 'enabled',
    updatedAt: '2026-06-10',
    updated_at: '2026-06-10T10:00:00+08:00',
    route: '/workstation/services/service_script_run',
    scriptKey: 'script_run',
    scriptVersion: 'v0.2.0',
    inputSchema: [
      { name: 'target_date', label: '运行日期', type: 'date', required: false },
    ],
  },
  {
    id: 'data-sync',
    apiId: 'service_data_sync',
    name: '数据同步服务',
    summary: '跨平台同步个人数据，当前维护中。',
    description: '跨平台数据同步，保持多端一致性，支持增量更新。',
    status: 'maintenance',
    apiStatus: 'disabled',
    updatedAt: '2026-06-08',
    updated_at: '2026-06-08T09:30:00+08:00',
    route: '/workstation/services/service_data_sync',
    scriptKey: 'data_sync',
    scriptVersion: 'v0.1.4',
    inputSchema: [
      { name: 'target_date', label: '同步日期', type: 'date', required: false },
    ],
  },
  {
    id: 'monitor',
    apiId: 'service_monitor',
    name: '站点监控',
    summary: '实时监测服务可用性和历史趋势。',
    description: '实时监测服务可用性，异常告警通知，历史记录查看。',
    status: 'active',
    apiStatus: 'enabled',
    updatedAt: '2026-06-12',
    updated_at: '2026-06-12T14:20:00+08:00',
    route: '/workstation/services/service_monitor',
    scriptKey: 'site_monitor',
    scriptVersion: 'v0.3.1',
    inputSchema: [],
  },
  {
    id: 'export',
    apiId: 'service_content_export',
    name: '内容导出工具',
    summary: '导出个人内容包，当前停用。',
    description: '批量导出作品、博客、随记，支持多种格式。',
    status: 'offline',
    apiStatus: 'disabled',
    updatedAt: '2026-05-20',
    updated_at: '2026-05-20T12:00:00+08:00',
    route: '/workstation/services/service_content_export',
    scriptKey: 'content_export',
    scriptVersion: 'v0.1.0',
    inputSchema: [],
  },
  {
    id: 'api-proxy',
    apiId: 'service_api_proxy',
    name: 'API 代理网关',
    summary: '统一管理外部 API 调用，提供限流与追踪。',
    description: '统一管理外部 API 调用，限流、鉴权、日志一体化。',
    status: 'active',
    apiStatus: 'enabled',
    updatedAt: '2026-06-11',
    updated_at: '2026-06-11T17:20:00+08:00',
    route: '/workstation/services/service_api_proxy',
    scriptKey: 'api_proxy',
    scriptVersion: 'v0.2.3',
    inputSchema: [],
  },
];

export const logAutoSubmitService = mockServices[0];
