import type { FailureCode, RecordStatus, SubmitRecord } from '../../mocks/mockRecords';
import type { Service } from '../../mocks/mockServices';

const API_BASE = '/api/v1';
const CSRF_COOKIE_NAME = 'lumitime_csrf';

export interface ApiEnvelope<T> {
  code: string;
  message: string;
  data: T;
  request_id: string;
}

export class ApiClientError extends Error {
  code: string;
  requestId?: string;
  status: number;

  constructor(message: string, code = 'NETWORK_ERROR', status = 0, requestId?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}) {
  let response: Response;
  try {
    const isFormData = init.body instanceof FormData;
    const method = (init.method || 'GET').toUpperCase();
    const csrfToken = shouldAttachCsrf(method) ? readCookie(CSRF_COOKIE_NAME) : null;
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiClientError('无法连接 Lumitime 后端服务。');
  }

  let payload: ApiEnvelope<T | null>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError('后端响应格式不可解析。', 'BAD_RESPONSE', response.status);
  }

  if (!response.ok) {
    throw new ApiClientError(payload.message || '请求失败。', payload.code, response.status, payload.request_id);
  }

  return payload as ApiEnvelope<T>;
}

function shouldAttachCsrf(method: string) {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

function readCookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`;
  return document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length) || null;
}

export interface BackendUser {
  id: string;
  username: string;
  display_name: string;
  displayName?: string;
  role: 'admin' | 'invited_user';
  status: string;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

export function loginApi(username: string, password: string) {
  return apiFetch<{ user: BackendUser; redirect_to: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logoutApi() {
  return apiFetch<null>('/auth/logout', { method: 'POST' });
}

export function meApi() {
  return apiFetch<BackendUser>('/auth/me');
}

export function changePasswordApi(body: { old_password: string; new_password: string }) {
  return apiFetch<null>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function registerWithInviteApi(body: {
  invite_code: string;
  username: string;
  display_name: string;
  password: string;
}) {
  return apiFetch<{ user_id: string; role: 'invited_user' }>('/auth/register-with-invite', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

function queryString(query: Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'all' && value !== null) {
      params.set(key, String(value));
    }
  });
  return params.toString() ? `?${params.toString()}` : '';
}

export interface BackendMessage {
  id: string;
  nickname: string;
  content: string;
  status: 'visible' | 'hidden' | 'deleted' | string;
  created_at?: string;
  createdAt?: string;
  moderated_at?: string | null;
  moderated_by?: string | null;
}

export function listMessagesApi(query: { page?: number; page_size?: number } = {}) {
  return apiFetch<Paginated<BackendMessage>>(`/messages${queryString(query)}`);
}

export function createMessageApi(body: { nickname: string; content: string }) {
  return apiFetch<BackendMessage>('/messages', { method: 'POST', body: JSON.stringify(body) });
}

export type DashboardRange = '7d' | '30d' | '90d';

export interface DashboardSnapshot {
  date?: string;
  user_count: number;
  developer_count: number;
  visit_count: number;
  work_count: number;
  script_count: number;
  blog_count: number;
  message_count: number;
  service_count: number;
  generated_at?: string;
}

export function dashboardMetricsApi(range: DashboardRange) {
  return apiFetch<{ totals: DashboardSnapshot; daily_changes: DashboardSnapshot[] }>(
    `/dashboard/metrics${queryString({ range })}`,
  );
}

export type ContentType = 'script' | 'work' | 'blog';
export type ContentKind = 'scripts' | 'works' | 'blogs';

export interface BackendAttachment {
  id: string;
  filename: string;
  file_size: number;
  file_type?: string | null;
  can_download: boolean;
  allow_download: boolean;
  created_at?: string;
}

export interface BackendContent {
  id: string;
  type: ContentType;
  title: string;
  summary?: string | null;
  desc?: string | null;
  body?: string | null;
  code?: string | null;
  usage?: string | null;
  notes?: string[];
  language?: string | null;
  category?: string | null;
  tag?: string | null;
  tags?: string[];
  status?: 'draft' | 'published' | 'unpublished' | string;
  updated_at?: string;
  updatedAt?: string;
  allow_copy?: boolean;
  downloadable?: boolean;
  highlights?: string[];
  attachments?: BackendAttachment[];
}

const contentPathMap: Record<ContentKind, string> = {
  scripts: '/scripts',
  works: '/works',
  blogs: '/blogs',
};

export function listContentApi(kind: ContentKind, query: { keyword?: string; page?: number; page_size?: number } = {}) {
  return apiFetch<Paginated<BackendContent>>(`${contentPathMap[kind]}${queryString(query)}`);
}

export function contentDetailApi(kind: ContentKind, contentId: string) {
  return apiFetch<BackendContent>(`${contentPathMap[kind]}/${encodeURIComponent(contentId)}`);
}

export function attachmentDownloadUrl(workId: string, attachmentId: string) {
  return `${API_BASE}/works/${encodeURIComponent(workId)}/attachments/${encodeURIComponent(attachmentId)}/download`;
}

export interface BackendService {
  id: string;
  name: string;
  summary?: string;
  description?: string;
  status: 'active' | 'offline' | 'maintenance' | string;
  api_status?: 'enabled' | 'disabled';
  updated_at?: string;
  updatedAt?: string;
  route?: string;
  script_key?: string;
  script_version?: string;
  input_schema?: Array<{ name: string; label: string; type: string; required?: boolean; placeholder?: string }>;
}

export function listServicesApi(query: { page?: number; page_size?: number } = {}) {
  return apiFetch<Paginated<BackendService>>(`/workstation/services${queryString(query)}`);
}

export function serviceDetailApi(serviceId: string) {
  return apiFetch<BackendService>(`/workstation/services/${encodeURIComponent(serviceId)}`);
}

export function createServiceRequestApi(serviceId: string, body: {
  student_account: string;
  student_password: string;
  task_config: Record<string, unknown>;
}) {
  return apiFetch<{ service_request_id: string; status: RecordStatus; polling_url: string }>(
    `/workstation/services/${encodeURIComponent(serviceId)}/requests`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export interface BackendServiceRequest {
  id: string;
  service_request_id: string;
  requestId?: string;
  service_id: string;
  service_name: string;
  serviceName?: string;
  status: RecordStatus;
  failure_code: FailureCode;
  submitted_at: string;
  submittedAt?: string;
  finished_at: string | null;
  duration_ms: number | null;
  duration?: string;
  result_summary: string;
  summary?: string;
  student_account_masked: string;
  accountMask?: string;
  can_retry: boolean;
  canRetry?: boolean;
  retry_of_service_request_id?: string;
}

export function serviceRequestDetailApi(serviceRequestId: string) {
  return apiFetch<BackendServiceRequest>(`/workstation/service-requests/${encodeURIComponent(serviceRequestId)}`);
}

export function myServiceRequestsApi(query: {
  service_id?: string;
  status?: string;
  service_request_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
} = {}) {
  return apiFetch<Paginated<BackendServiceRequest>>(
    `/workstation/service-requests/my${queryString(query)}`,
  );
}

export function retryServiceRequestApi(serviceRequestId: string, body: {
  student_account: string;
  student_password: string;
  task_config?: Record<string, unknown>;
}) {
  return apiFetch<{ service_request_id: string; retry_of_service_request_id: string; status: RecordStatus; polling_url: string }>(
    `/workstation/service-requests/${encodeURIComponent(serviceRequestId)}/retry`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export interface BackendAuditLog {
  id: string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  service_request_id?: string | null;
  result: 'success' | 'failed' | string;
  metadata_sanitized?: unknown;
  user_agent_summary?: string | null;
  created_at?: string;
}

export interface BackendExecutionLog {
  sequence: number;
  level: 'info' | 'warn' | 'error' | string;
  time?: string;
  step_name?: string;
  message: string;
}

export interface BackendInvite {
  id: string;
  code: string;
  usage_limit: number;
  used_count: number;
  status: 'active' | 'disabled' | 'expired' | string;
  expires_at?: string | null;
  remark?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BackendInviteUsage {
  id: string;
  invite_code_id: string;
  user_id: string;
  used_at?: string;
  user_agent_summary?: string | null;
}

export interface BackendAdminService extends BackendService {
  status: 'enabled' | 'disabled' | string;
}

export function adminListInvitesApi(query: { status?: string; keyword?: string; page?: number; page_size?: number } = {}) {
  return apiFetch<Paginated<BackendInvite>>(`/admin/invite-codes${queryString(query)}`);
}

export function adminCreateInviteApi(body: { usage_limit: number; expires_at?: string | null; remark?: string | null }) {
  return apiFetch<BackendInvite>('/admin/invite-codes', { method: 'POST', body: JSON.stringify(body) });
}

export function adminDisableInviteApi(inviteId: string) {
  return apiFetch<BackendInvite>(`/admin/invite-codes/${encodeURIComponent(inviteId)}/disable`, { method: 'PATCH' });
}

export function adminInviteUsageApi(inviteId: string) {
  return apiFetch<Paginated<BackendInviteUsage>>(`/admin/invite-codes/${encodeURIComponent(inviteId)}/usage-records`);
}

export function adminListUsersApi(query: { status?: string; role?: string; keyword?: string; page?: number; page_size?: number } = {}) {
  return apiFetch<Paginated<BackendUser>>(`/admin/users${queryString(query)}`);
}

export function adminEnableUserApi(userId: string) {
  return apiFetch<BackendUser>(`/admin/users/${encodeURIComponent(userId)}/enable`, { method: 'PATCH' });
}

export function adminDisableUserApi(userId: string) {
  return apiFetch<BackendUser>(`/admin/users/${encodeURIComponent(userId)}/disable`, { method: 'PATCH' });
}

export function adminResetPasswordApi(userId: string, newPassword: string) {
  return apiFetch<null>(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'PATCH',
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export function adminListContentsApi(query: { type?: ContentType; status?: string; keyword?: string; page?: number; page_size?: number } = {}) {
  return apiFetch<Paginated<BackendContent>>(`/admin/contents${queryString(query)}`);
}

export function adminContentDetailApi(contentId: string) {
  return apiFetch<BackendContent>(`/admin/contents/${encodeURIComponent(contentId)}`);
}

export function adminCreateContentApi(body: {
  type: ContentType;
  title: string;
  summary?: string | null;
  body?: string | null;
  code?: string | null;
  language?: string | null;
  category?: string | null;
  tags?: string[];
  status?: string;
  allow_copy?: boolean;
}) {
  return apiFetch<BackendContent>('/admin/contents', { method: 'POST', body: JSON.stringify(body) });
}

export function adminPatchContentApi(contentId: string, body: Partial<{
  title: string;
  summary: string | null;
  body: string | null;
  code: string | null;
  language: string | null;
  category: string | null;
  tags: string[];
  status: string;
  allow_copy: boolean;
}>) {
  return apiFetch<BackendContent>(`/admin/contents/${encodeURIComponent(contentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function adminPublishContentApi(contentId: string) {
  return apiFetch<BackendContent>(`/admin/contents/${encodeURIComponent(contentId)}/publish`, { method: 'PATCH' });
}

export function adminUnpublishContentApi(contentId: string) {
  return apiFetch<BackendContent>(`/admin/contents/${encodeURIComponent(contentId)}/unpublish`, { method: 'PATCH' });
}

export function adminDeleteContentApi(contentId: string) {
  return apiFetch<null>(`/admin/contents/${encodeURIComponent(contentId)}`, { method: 'DELETE' });
}

export function adminUploadAttachmentApi(workId: string, file: File, allowDownload: boolean) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<{ id: string; filename: string; file_size: number; allow_download: boolean }>(
    `/admin/works/${encodeURIComponent(workId)}/attachments${queryString({ allow_download: allowDownload })}`,
    { method: 'POST', body: formData },
  );
}

export function adminPatchAttachmentApi(workId: string, attachmentId: string, allowDownload: boolean) {
  return apiFetch<{ id: string; allow_download: boolean }>(
    `/admin/works/${encodeURIComponent(workId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: 'PATCH', body: JSON.stringify({ allow_download: allowDownload }) },
  );
}

export function adminListMessagesApi(query: { status?: string; keyword?: string; page?: number; page_size?: number } = {}) {
  return apiFetch<Paginated<BackendMessage>>(`/admin/messages${queryString(query)}`);
}

export function adminHideMessageApi(messageId: string) {
  return apiFetch<BackendMessage>(`/admin/messages/${encodeURIComponent(messageId)}/hide`, { method: 'PATCH' });
}

export function adminRestoreMessageApi(messageId: string) {
  return apiFetch<BackendMessage>(`/admin/messages/${encodeURIComponent(messageId)}/restore`, { method: 'PATCH' });
}

export function adminDeleteMessageApi(messageId: string) {
  return apiFetch<null>(`/admin/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
}

export function adminListServicesApi(query: { status?: string; keyword?: string; page?: number; page_size?: number } = {}) {
  return apiFetch<Paginated<BackendAdminService>>(`/admin/workstation/services${queryString(query)}`);
}

export function adminCreateServiceApi(body: {
  name: string;
  summary?: string | null;
  description?: string | null;
  status?: 'enabled' | 'disabled';
  script_key?: string | null;
  script_version?: string | null;
  input_schema?: Array<Record<string, unknown>>;
}) {
  return apiFetch<BackendAdminService>('/admin/workstation/services', { method: 'POST', body: JSON.stringify(body) });
}

export function adminPatchServiceApi(serviceId: string, body: Partial<{
  name: string;
  summary: string | null;
  description: string | null;
  status: 'enabled' | 'disabled';
  script_key: string | null;
  script_version: string | null;
  input_schema: Array<Record<string, unknown>>;
}>) {
  return apiFetch<BackendAdminService>(`/admin/workstation/services/${encodeURIComponent(serviceId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function adminEnableServiceApi(serviceId: string) {
  return apiFetch<BackendAdminService>(`/admin/workstation/services/${encodeURIComponent(serviceId)}/enable`, { method: 'PATCH' });
}

export function adminDisableServiceApi(serviceId: string) {
  return apiFetch<BackendAdminService>(`/admin/workstation/services/${encodeURIComponent(serviceId)}/disable`, { method: 'PATCH' });
}

export function adminDeleteServiceApi(serviceId: string) {
  return apiFetch<null>(`/admin/workstation/services/${encodeURIComponent(serviceId)}`, { method: 'DELETE' });
}

export function adminListServiceRequestsApi(query: {
  service_id?: string;
  user_id?: string;
  status?: string;
  failure_code?: string;
  service_request_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
} = {}) {
  return apiFetch<Paginated<BackendServiceRequest>>(`/admin/service-requests${queryString(query)}`);
}

export function adminServiceRequestDetailApi(serviceRequestId: string) {
  return apiFetch<BackendServiceRequest>(`/admin/service-requests/${encodeURIComponent(serviceRequestId)}`);
}

export function adminServiceRequestLogsApi(serviceRequestId: string) {
  return apiFetch<{ service_request_id: string; logs: BackendExecutionLog[] }>(
    `/admin/service-requests/${encodeURIComponent(serviceRequestId)}/logs`,
  );
}

export function adminListSnapshotsApi(query: { page?: number; page_size?: number } = {}) {
  return apiFetch<Paginated<DashboardSnapshot>>(`/admin/dashboard/snapshots${queryString(query)}`);
}

export function adminListAuditLogsApi(query: {
  actor_user_id?: string;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  service_request_id?: string;
  page?: number;
  page_size?: number;
} = {}) {
  return apiFetch<Paginated<BackendAuditLog>>(`/admin/audit-logs${queryString(query)}`);
}

export function adminAuditLogDetailApi(auditId: string) {
  return apiFetch<BackendAuditLog>(`/admin/audit-logs/${encodeURIComponent(auditId)}`);
}

export function adminExportUrl(name: 'dashboard-snapshots.csv' | 'service-requests.csv', query: Record<string, unknown> = {}) {
  return `${API_BASE}/admin/exports/${name}${queryString(query)}`;
}

export function mapBackendService(service: BackendService): Service {
  return {
    id: service.id,
    apiId: service.id,
    name: service.name,
    summary: service.summary || service.description || service.name,
    description: service.description || service.summary || service.name,
    status: service.status === 'active' ? 'active' : service.status === 'maintenance' ? 'maintenance' : 'offline',
    apiStatus: service.api_status || (service.status === 'active' ? 'enabled' : 'disabled'),
    updatedAt: service.updatedAt || service.updated_at?.slice(0, 10) || '-',
    updated_at: service.updated_at || '',
    route: `/workstation/services/${service.id}`,
    scriptKey: service.script_key || service.id,
    scriptVersion: service.script_version || '-',
    inputSchema: (service.input_schema || []).map(item => ({
      name: item.name as Service['inputSchema'][number]['name'],
      label: item.label,
      type: item.type as Service['inputSchema'][number]['type'],
      required: !!item.required,
      placeholder: item.placeholder as string | undefined,
    })),
  };
}

export function mapBackendRequest(record: BackendServiceRequest, apiRequestId = ''): SubmitRecord {
  const submittedAt = record.submittedAt || normalizeDateTime(record.submitted_at);
  const finishedAt = record.finished_at ? normalizeDateTime(record.finished_at) : null;
  return {
    id: record.id,
    serviceId: record.service_id,
    service_id: record.service_id,
    serviceName: record.serviceName || record.service_name,
    service_name: record.service_name,
    userId: 'current',
    username: '我',
    submittedAt,
    submitted_at: record.submitted_at,
    finishedAt,
    finished_at: record.finished_at,
    status: record.status,
    requestId: record.service_request_id,
    serviceRequestId: record.service_request_id,
    service_request_id: record.service_request_id,
    apiRequestId,
    api_request_id: apiRequestId,
    pollingUrl: `/api/v1/workstation/service-requests/${record.service_request_id}`,
    polling_url: `/api/v1/workstation/service-requests/${record.service_request_id}`,
    duration: record.duration || formatDuration(record.duration_ms),
    durationMs: record.duration_ms,
    duration_ms: record.duration_ms,
    summary: record.summary || record.result_summary || '',
    resultSummary: record.result_summary || record.summary || '',
    result_summary: record.result_summary || record.summary || '',
    accountMask: record.accountMask || record.student_account_masked || '-',
    studentAccountMasked: record.student_account_masked || record.accountMask || '-',
    student_account_masked: record.student_account_masked || record.accountMask || '-',
    failureCode: record.failure_code,
    failure_code: record.failure_code,
    canRetry: record.canRetry ?? record.can_retry,
    can_retry: record.can_retry,
    retryOfServiceRequestId: record.retry_of_service_request_id,
    retry_of_service_request_id: record.retry_of_service_request_id,
    logs: [],
  };
}

function normalizeDateTime(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').replace(/\.\d+/, '').replace(/\+00:00|Z$/, '');
}

function formatDuration(value: number | null) {
  if (value == null) return '-';
  return `${(value / 1000).toFixed(1)}s`;
}






