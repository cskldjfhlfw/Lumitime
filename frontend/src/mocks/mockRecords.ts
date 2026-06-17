export type RecordStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'not_integrated';
export type FailureCode =
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'SCHOOL_SYSTEM_ERROR'
  | 'SCRIPT_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR'
  | 'SERVICE_NOT_INTEGRATED'
  | null;

export interface MaskedExecutionLog {
  sequence: number;
  level: 'info' | 'warn' | 'error';
  time: string;
  stepName: string;
  step_name: string;
  message: string;
}

export interface SubmitRecord {
  id: string;
  serviceId: string;
  service_id: string;
  serviceName: string;
  service_name: string;
  userId: string;
  username: string;
  submittedAt: string;
  submitted_at: string;
  finishedAt: string | null;
  finished_at: string | null;
  status: RecordStatus;
  requestId: string;
  serviceRequestId: string;
  service_request_id: string;
  apiRequestId: string;
  api_request_id: string;
  pollingUrl: string;
  polling_url: string;
  duration: string;
  durationMs: number | null;
  duration_ms: number | null;
  summary: string;
  resultSummary: string;
  result_summary: string;
  accountMask: string;
  studentAccountMasked: string;
  student_account_masked: string;
  failureCategory?: string;
  failureCode: FailureCode;
  failure_code: FailureCode;
  canRetry: boolean;
  can_retry: boolean;
  retryOfServiceRequestId?: string;
  retry_of_service_request_id?: string;
  logs: MaskedExecutionLog[];
}

export const mockRecords: SubmitRecord[] = [
  {
    id: 'r001',
    serviceId: 'service_log_auto_submit',
    service_id: 'service_log_auto_submit',
    serviceName: '日志自动提交',
    service_name: '日志自动提交',
    userId: 'user_002',
    username: 'alice_dev',
    submittedAt: '2026-06-13 22:14:03',
    submitted_at: '2026-06-13T22:14:03+08:00',
    finishedAt: '2026-06-13 22:14:15',
    finished_at: '2026-06-13T22:14:15+08:00',
    status: 'success',
    requestId: 'svc_req_20260613_000051',
    serviceRequestId: 'svc_req_20260613_000051',
    service_request_id: 'svc_req_20260613_000051',
    apiRequestId: 'req_api_20260613_000201',
    api_request_id: 'req_api_20260613_000201',
    pollingUrl: '/api/v1/workstation/service-requests/svc_req_20260613_000051',
    polling_url: '/api/v1/workstation/service-requests/svc_req_20260613_000051',
    duration: '12.0s',
    durationMs: 12000,
    duration_ms: 12000,
    summary: '成功提交 3 条学习日志，系统返回确认编号。',
    resultSummary: '成功提交 3 条学习日志，系统返回确认编号。',
    result_summary: '成功提交 3 条学习日志，系统返回确认编号。',
    accountMask: 's***@edu.cn',
    studentAccountMasked: '2023****8912',
    student_account_masked: '2023****8912',
    failureCode: null,
    failure_code: null,
    canRetry: false,
    can_retry: false,
    logs: [
      { sequence: 1, level: 'info', time: '2026-06-13T22:14:04+08:00', stepName: 'login', step_name: 'login', message: '开始登录，账号=2023****8912，密码=[REDACTED_PASSWORD]' },
      { sequence: 2, level: 'info', time: '2026-06-13T22:14:10+08:00', stepName: 'submit', step_name: 'submit', message: '提交 3 条日志，Authorization=[REDACTED_AUTH_HEADER]' },
      { sequence: 3, level: 'info', time: '2026-06-13T22:14:15+08:00', stepName: 'finish', step_name: 'finish', message: '服务执行成功，返回确认编号 LUMI-LOG-0613' },
    ],
  },
  {
    id: 'r002',
    serviceId: 'service_log_auto_submit',
    service_id: 'service_log_auto_submit',
    serviceName: '日志自动提交',
    service_name: '日志自动提交',
    userId: 'user_002',
    username: 'alice_dev',
    submittedAt: '2026-06-12 09:30:11',
    submitted_at: '2026-06-12T09:30:11+08:00',
    finishedAt: '2026-06-12 09:30:19',
    finished_at: '2026-06-12T09:30:19+08:00',
    status: 'failed',
    requestId: 'svc_req_20260612_000034',
    serviceRequestId: 'svc_req_20260612_000034',
    service_request_id: 'svc_req_20260612_000034',
    apiRequestId: 'req_api_20260612_000144',
    api_request_id: 'req_api_20260612_000144',
    pollingUrl: '/api/v1/workstation/service-requests/svc_req_20260612_000034',
    polling_url: '/api/v1/workstation/service-requests/svc_req_20260612_000034',
    duration: '8.1s',
    durationMs: 8100,
    duration_ms: 8100,
    summary: '账号密码验证失败，无法完成提交。',
    resultSummary: '账号密码验证失败，无法完成提交。',
    result_summary: '账号密码验证失败，无法完成提交。',
    accountMask: 's***@edu.cn',
    studentAccountMasked: '2023****1120',
    student_account_masked: '2023****1120',
    failureCategory: '认证失败',
    failureCode: 'AUTH_FAILED',
    failure_code: 'AUTH_FAILED',
    canRetry: true,
    can_retry: true,
    logs: [
      { sequence: 1, level: 'info', time: '2026-06-12T09:30:12+08:00', stepName: 'login', step_name: 'login', message: '开始登录，账号=2023****1120，密码=[REDACTED_PASSWORD]' },
      { sequence: 2, level: 'warn', time: '2026-06-12T09:30:19+08:00', stepName: 'login', step_name: 'login', message: '学习 App 返回认证失败，Cookie=[REDACTED_COOKIE]' },
    ],
  },
  {
    id: 'r003',
    serviceId: 'service_log_auto_submit',
    service_id: 'service_log_auto_submit',
    serviceName: '日志自动提交',
    service_name: '日志自动提交',
    userId: 'user_003',
    username: 'bob_creator',
    submittedAt: '2026-06-11 18:55:42',
    submitted_at: '2026-06-11T18:55:42+08:00',
    finishedAt: '2026-06-11 18:55:49',
    finished_at: '2026-06-11T18:55:49+08:00',
    status: 'success',
    requestId: 'svc_req_20260611_000022',
    serviceRequestId: 'svc_req_20260611_000022',
    service_request_id: 'svc_req_20260611_000022',
    apiRequestId: 'req_api_20260611_000092',
    api_request_id: 'req_api_20260611_000092',
    pollingUrl: '/api/v1/workstation/service-requests/svc_req_20260611_000022',
    polling_url: '/api/v1/workstation/service-requests/svc_req_20260611_000022',
    duration: '3.7s',
    durationMs: 3700,
    duration_ms: 3700,
    summary: '成功提交 5 条学习日志。',
    resultSummary: '成功提交 5 条学习日志。',
    result_summary: '成功提交 5 条学习日志。',
    accountMask: 's***@edu.cn',
    studentAccountMasked: '2022****7754',
    student_account_masked: '2022****7754',
    failureCode: null,
    failure_code: null,
    canRetry: false,
    can_retry: false,
    logs: [
      { sequence: 1, level: 'info', time: '2026-06-11T18:55:44+08:00', stepName: 'submit', step_name: 'submit', message: '提交 5 条日志，账号=2022****7754' },
      { sequence: 2, level: 'info', time: '2026-06-11T18:55:49+08:00', stepName: 'finish', step_name: 'finish', message: '服务执行成功' },
    ],
  },
  {
    id: 'r004',
    serviceId: 'service_log_auto_submit',
    service_id: 'service_log_auto_submit',
    serviceName: '日志自动提交',
    service_name: '日志自动提交',
    userId: 'user_004',
    username: 'charlie99',
    submittedAt: '2026-06-10 14:20:00',
    submitted_at: '2026-06-10T14:20:00+08:00',
    finishedAt: '2026-06-10 14:22:00',
    finished_at: '2026-06-10T14:22:00+08:00',
    status: 'timeout',
    requestId: 'svc_req_20260610_000018',
    serviceRequestId: 'svc_req_20260610_000018',
    service_request_id: 'svc_req_20260610_000018',
    apiRequestId: 'req_api_20260610_000077',
    api_request_id: 'req_api_20260610_000077',
    pollingUrl: '/api/v1/workstation/service-requests/svc_req_20260610_000018',
    polling_url: '/api/v1/workstation/service-requests/svc_req_20260610_000018',
    duration: '120s',
    durationMs: 120000,
    duration_ms: 120000,
    summary: '请求超时，目标系统无响应。',
    resultSummary: '请求超时，目标系统无响应。',
    result_summary: '请求超时，目标系统无响应。',
    accountMask: 's***@edu.cn',
    studentAccountMasked: '2021****6402',
    student_account_masked: '2021****6402',
    failureCategory: '超时',
    failureCode: 'TIMEOUT',
    failure_code: 'TIMEOUT',
    canRetry: true,
    can_retry: true,
    logs: [
      { sequence: 1, level: 'info', time: '2026-06-10T14:20:02+08:00', stepName: 'login', step_name: 'login', message: '开始登录，账号=2021****6402，密码=[REDACTED_PASSWORD]' },
      { sequence: 2, level: 'error', time: '2026-06-10T14:22:00+08:00', stepName: 'submit', step_name: 'submit', message: '目标系统 120 秒内无响应，状态=TIMEOUT' },
    ],
  },
  {
    id: 'r005',
    serviceId: 'service_log_auto_submit',
    service_id: 'service_log_auto_submit',
    serviceName: '日志自动提交',
    service_name: '日志自动提交',
    userId: 'user_005',
    username: 'diana_x',
    submittedAt: '2026-06-09 21:05:17',
    submitted_at: '2026-06-09T21:05:17+08:00',
    finishedAt: '2026-06-09 21:05:19',
    finished_at: '2026-06-09T21:05:19+08:00',
    status: 'not_integrated',
    requestId: 'svc_req_20260609_000012',
    serviceRequestId: 'svc_req_20260609_000012',
    service_request_id: 'svc_req_20260609_000012',
    apiRequestId: 'req_api_20260609_000041',
    api_request_id: 'req_api_20260609_000041',
    pollingUrl: '/api/v1/workstation/service-requests/svc_req_20260609_000012',
    polling_url: '/api/v1/workstation/service-requests/svc_req_20260609_000012',
    duration: '2.0s',
    durationMs: 2000,
    duration_ms: 2000,
    summary: '服务暂未接入真实脚本，请稍后再试。',
    resultSummary: '服务暂未接入真实脚本，请稍后再试。',
    result_summary: '服务暂未接入真实脚本，请稍后再试。',
    accountMask: 's***@edu.cn',
    studentAccountMasked: '2020****2031',
    student_account_masked: '2020****2031',
    failureCategory: '服务未接入',
    failureCode: 'SERVICE_NOT_INTEGRATED',
    failure_code: 'SERVICE_NOT_INTEGRATED',
    canRetry: true,
    can_retry: true,
    logs: [
      { sequence: 1, level: 'warn', time: '2026-06-09T21:05:19+08:00', stepName: 'dispatch', step_name: 'dispatch', message: '服务暂未接入真实脚本，未读取任何学生学习 App 凭证' },
    ],
  },
];
