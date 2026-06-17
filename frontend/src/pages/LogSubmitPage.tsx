import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, ClipboardList, Loader2, RotateCcw, Send, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { MainNav } from '../layouts/MainNav';
import { StatusCard, type ExecStatus } from '../features/log-submit/components/StatusCard';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Textarea } from '../shared/ui/textarea';
import type { FailureCode, RecordStatus, SubmitRecord } from '../mocks/mockRecords';
import type { Service, ServiceInputSchemaItem } from '../mocks/mockServices';
import { useAuth } from '../app/providers/AuthProvider';
import {
  ApiClientError,
  createServiceRequestApi,
  mapBackendRequest,
  mapBackendService,
  myServiceRequestsApi,
  serviceDetailApi,
  serviceRequestDetailApi,
} from '../shared/api/lumitimeApi';

type PageStatus = 'idle' | 'submitting' | RecordStatus;
const TERMINAL_STATUSES: RecordStatus[] = ['success', 'failed', 'timeout', 'not_integrated'];
const CREDENTIAL_FIELD_NAMES = new Set(['student_account', 'student_password']);

const fallbackAccountField: ServiceInputSchemaItem = {
  name: 'student_account',
  label: '学生学习 App 账号',
  type: 'text',
  required: true,
};

const fallbackPasswordField: ServiceInputSchemaItem = {
  name: 'student_password',
  label: '学生学习 App 密码',
  type: 'password',
  required: true,
};

export function LogSubmitPage() {
  const navigate = useNavigate();
  const { serviceId } = useParams();
  const { isLoggedIn, isAdmin, logout, user } = useAuth();
  const resolvedServiceId = serviceId || 'service_log_auto_submit';
  const [service, setService] = useState<Service | null>(null);
  const [serviceLoadState, setServiceLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [apiNotice, setApiNotice] = useState('');
  const [recentRecords, setRecentRecords] = useState<SubmitRecord[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [pageStatus, setPageStatus] = useState<PageStatus>('idle');
  const [serviceRequestId, setServiceRequestId] = useState('');
  const [apiRequestId, setApiRequestId] = useState('');
  const [failureCode, setFailureCode] = useState<FailureCode>(null);
  const [resultSummary, setResultSummary] = useState('');
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schema = service?.inputSchema || [];
  const accountField = schema.find(item => item.name === 'student_account') || fallbackAccountField;
  const passwordField = schema.find(item => item.name === 'student_password') || fallbackPasswordField;
  const credentialFields = useMemo(() => [accountField, passwordField], [accountField, passwordField]);
  const taskFields = useMemo(() => schema.filter(item => !CREDENTIAL_FIELD_NAMES.has(item.name)), [schema]);
  const requiredFields = useMemo(
    () => [...credentialFields, ...taskFields.filter(item => item.required)],
    [credentialFields, taskFields],
  );

  const canSubmit = !!service &&
    serviceLoadState === 'ready' &&
    pageStatus === 'idle' &&
    requiredFields.every(field => (formValues[field.name] || '').trim().length > 0);

  const setFieldValue = (name: string, value: string) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const clearPollTimer = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  };

  const loadRecentRecords = () => {
    myServiceRequestsApi({ service_id: resolvedServiceId, page: 1, page_size: 5 })
      .then(recordsPayload => {
        setRecentRecords(recordsPayload.data.items.map(item => mapBackendRequest(item, recordsPayload.request_id)));
      })
      .catch(() => setRecentRecords([]));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !service) return;
    clearPollTimer();
    const studentAccount = (formValues.student_account || '').trim();
    const studentPassword = formValues.student_password || '';
    const taskConfig = buildTaskConfig(taskFields, formValues);

    setFailureCode(null);
    setResultSummary('');
    setServiceRequestId('');
    setApiRequestId('');
    setApiNotice('');
    setPageStatus('submitting');
    setFormValues(prev => ({ ...prev, student_account: '', student_password: '' }));

    try {
      const created = await createServiceRequestApi(service.apiId, {
        student_account: studentAccount,
        student_password: studentPassword,
        task_config: taskConfig,
      });
      setServiceRequestId(created.data.service_request_id);
      setApiRequestId(created.request_id);
      setPageStatus(created.data.status);
      pollServiceRequest(created.data.service_request_id, created.request_id, Date.now(), 700);
    } catch (error) {
      const message = error instanceof ApiClientError
        ? `${error.message}${error.requestId ? ` request_id=${error.requestId}` : ''}`
        : '服务请求创建失败。';
      setApiNotice(message);
      setPageStatus('idle');
      toast.error(message);
    }
  };

  const handleRetry = () => {
    setPageStatus('idle');
    setFailureCode(null);
    setResultSummary('');
    setApiNotice('');
    clearPollTimer();
    setFormValues(prev => ({ ...prev, student_account: '', student_password: '' }));
  };

  const pollServiceRequest = (
    nextServiceRequestId: string,
    fallbackApiRequestId: string,
    startedAt: number,
    delayMs = 2_000,
  ) => {
    clearPollTimer();
    pollTimerRef.current = setTimeout(async () => {
      try {
        const detail = await serviceRequestDetailApi(nextServiceRequestId);
        const mapped = mapBackendRequest(detail.data, detail.request_id || fallbackApiRequestId);
        const nextApiRequestId = detail.request_id || fallbackApiRequestId;
        setPageStatus(mapped.status);
        setFailureCode(mapped.failureCode);
        setResultSummary(mapped.resultSummary);
        setApiRequestId(nextApiRequestId);
        if (!TERMINAL_STATUSES.includes(mapped.status) && Date.now() - startedAt < 120_000) {
          pollServiceRequest(nextServiceRequestId, nextApiRequestId, startedAt);
        } else {
          if (!TERMINAL_STATUSES.includes(mapped.status)) {
            setApiNotice('服务仍在执行，请稍后在提交记录中查看结果。');
          }
          loadRecentRecords();
        }
      } catch (error) {
        const message = error instanceof ApiClientError ? error.message : '轮询服务请求失败。';
        setApiNotice(message);
      }
    }, delayMs);
  };

  useEffect(() => {
    let mounted = true;
    setService(null);
    setServiceLoadState('loading');
    setApiNotice('');
    setResultSummary('');
    clearPollTimer();
    serviceDetailApi(resolvedServiceId)
      .then(payload => {
        if (!mounted) return;
        const mapped = mapBackendService(payload.data);
        setService(mapped);
        setFormValues(buildDefaultValues(mapped.inputSchema));
        setServiceLoadState('ready');
      })
      .catch(error => {
        if (!mounted) return;
        setService(null);
        setFormValues({});
        setServiceLoadState('error');
        setApiNotice(error instanceof Error ? error.message : '后端服务详情不可用。');
      });
    return () => { mounted = false; };
  }, [resolvedServiceId]);

  useEffect(() => {
    loadRecentRecords();
  }, [resolvedServiceId]);

  useEffect(() => () => clearPollTimer(), []);

  const execStatus: ExecStatus | null =
    pageStatus === 'pending' ? 'pending'
    : pageStatus === 'running' ? 'running'
    : pageStatus === 'success' ? 'success'
    : pageStatus === 'failed' ? 'failed'
    : pageStatus === 'timeout' ? 'timeout'
    : pageStatus === 'not_integrated' ? 'not_integrated'
    : null;

  const pollingUrl = serviceRequestId ? `/api/v1/workstation/service-requests/${serviceRequestId}` : '';
  const submitDisabledReason = serviceLoadState === 'error'
    ? '服务详情加载失败'
    : !service
      ? '服务加载中'
      : !canSubmit
        ? '请填写必填项'
        : '';

  return (
    <div className="min-h-screen bg-[#f8f8f7] flex flex-col">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <button
          onClick={() => navigate('/workstation')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-8"
        >
          <ArrowLeft size={13} />
          返回工作站
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <section className="space-y-6">
            <div className="bg-white border border-gray-100 rounded-lg p-5">
              <p className="mb-3 text-xs uppercase tracking-widest text-gray-400">Service</p>
              <h1 className="text-2xl font-medium text-gray-950 mb-2">{service?.name || '服务加载中'}</h1>
              <p className="text-sm text-gray-500 leading-7 mb-4">
                {service?.description || '正在从后端读取服务详情。'} 提交后立即返回 service_request_id，前端通过真实接口轮询执行结果。
              </p>
              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                <MetaPill label="service_id" value={service?.apiId || resolvedServiceId} />
                <MetaPill label="status" value={service ? service.apiStatus : serviceLoadState} />
                <MetaPill label="script" value={service ? `${service.scriptKey}@${service.scriptVersion}` : '-'} />
              </div>
              <div className="flex items-start gap-2 bg-gray-50 rounded-md p-3">
                <ShieldCheck size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-500 leading-relaxed">
                  学生学习 App 账号密码只用于本次请求，提交后立即从前端状态清空，不保存、不回显、不写入提交记录。
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-lg p-5 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-gray-700">服务提交表单</h2>
                  <p className="mt-1 text-xs text-gray-400">
                    字段来自后端 input_schema。密码字段不会进入浏览器持久缓存。
                  </p>
                </div>
                {serviceLoadState === 'loading' && <Loader2 size={15} className="animate-spin text-gray-300" />}
              </div>

              {apiNotice && (
                <div className="flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50 p-3">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs leading-5 text-amber-700">{apiNotice}</p>
                </div>
              )}
              {serviceLoadState === 'error' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/workstation')}
                  className="w-full border-gray-200 text-gray-600"
                >
                  返回服务列表
                </Button>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <ShieldCheck size={14} />
                  当前请求凭证
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {credentialFields.map(field => (
                    <SchemaField
                      key={field.name}
                      field={field}
                      value={formValues[field.name] || ''}
                      disabled={pageStatus !== 'idle' || serviceLoadState !== 'ready'}
                      onChange={setFieldValue}
                    />
                  ))}
                </div>
              </div>

              {taskFields.length > 0 && (
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <SlidersHorizontal size={14} />
                    任务参数
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {taskFields.map(field => (
                      <SchemaField
                        key={field.name}
                        field={field}
                        value={formValues[field.name] || ''}
                        disabled={pageStatus !== 'idle' || serviceLoadState !== 'ready'}
                        onChange={setFieldValue}
                      />
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="w-full bg-black text-white hover:bg-black/80 disabled:opacity-40 gap-2"
                title={submitDisabledReason}
              >
                {pageStatus === 'submitting' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    创建服务请求…
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    提交服务请求
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-300 text-center">
                本地模拟规则：账号含 fail 返回 AUTH_FAILED，含 timeout 返回 TIMEOUT；未集成脚本返回 not_integrated。
              </p>
            </div>

            {execStatus && (
              <StatusCard
                status={execStatus}
                serviceRequestId={serviceRequestId}
                apiRequestId={apiRequestId}
                pollingUrl={pollingUrl}
                summary={resultSummary || fallbackSummary(execStatus)}
                failureCode={failureCode}
                onRetry={handleRetry}
              />
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-lg border border-gray-100 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList size={15} className="text-gray-500" />
                  <p className="text-sm font-medium text-gray-900">最近提交记录</p>
                </div>
                <button onClick={() => navigate('/workstation/records')} className="text-xs text-gray-400 hover:text-black">
                  全部
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {recentRecords.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">暂无该服务的真实提交记录</div>
                ) : recentRecords.map(r => {
                  const statusMap: Record<RecordStatus, { label: string; cls: string }> = {
                    success: { label: '成功', cls: 'text-emerald-600 bg-emerald-50' },
                    failed: { label: '失败', cls: 'text-red-500 bg-red-50' },
                    timeout: { label: '超时', cls: 'text-amber-600 bg-amber-50' },
                    running: { label: '执行中', cls: 'text-blue-500 bg-blue-50' },
                    pending: { label: '等待中', cls: 'text-gray-500 bg-gray-100' },
                    not_integrated: { label: '未接入', cls: 'text-gray-500 bg-gray-100' },
                  };
                  const s = statusMap[r.status];
                  return (
                    <button key={r.id} onClick={() => navigate(`/workstation/records/${r.serviceRequestId}`)} className="block w-full py-3 text-left">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                        <span className="font-mono text-xs text-gray-400">{r.serviceRequestId}</span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-5 text-gray-600">{r.resultSummary || '-'}</p>
                      <p className="mt-1 text-xs text-gray-300">{r.submittedAt}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            {pageStatus !== 'idle' && (
              <Button variant="outline" onClick={handleRetry} className="w-full border-gray-200 text-gray-600">
                <RotateCcw size={14} />
                重新填写
              </Button>
            )}
          </aside>
        </motion.div>
      </main>
    </div>
  );
}

function SchemaField({
  field,
  value,
  disabled,
  onChange,
}: {
  field: ServiceInputSchemaItem;
  value: string;
  disabled: boolean;
  onChange: (name: string, value: string) => void;
}) {
  const isTextarea = field.type === 'textarea';
  const inputType = field.type === 'number' || field.type === 'date' || field.type === 'email' || field.type === 'password'
    ? field.type
    : 'text';
  const isCredential = CREDENTIAL_FIELD_NAMES.has(field.name);

  return (
    <label className={isTextarea ? 'block sm:col-span-2' : 'block'}>
      <span className="mb-1.5 flex items-center gap-1 text-xs text-gray-500">
        {field.label}
        {field.required && <span className="text-red-400">*</span>}
      </span>
      {isTextarea ? (
        <Textarea
          value={value}
          onChange={event => onChange(field.name, event.target.value)}
          disabled={disabled}
          placeholder={field.placeholder || field.name}
          className="min-h-24 border-gray-200 focus-visible:ring-black"
        />
      ) : (
        <Input
          type={inputType}
          value={value}
          onChange={event => onChange(field.name, event.target.value)}
          disabled={disabled}
          placeholder={field.placeholder || field.name}
          className="border-gray-200 focus-visible:ring-black"
          autoComplete={field.name === 'student_password' ? 'new-password' : 'off'}
        />
      )}
      <span className="mt-1 block font-mono text-[11px] text-gray-300">
        {isCredential ? field.name : `task_config.${field.name}`}
      </span>
    </label>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <p className="font-mono text-[10px] text-gray-300">{label}</p>
      <p className="mt-1 truncate text-xs text-gray-600">{value}</p>
    </div>
  );
}

function buildDefaultValues(schema: ServiceInputSchemaItem[]) {
  const values: Record<string, string> = {
    student_account: '',
    student_password: '',
  };
  schema.forEach(field => {
    values[field.name] = defaultValueForField(field);
  });
  return values;
}

function defaultValueForField(field: ServiceInputSchemaItem) {
  if (field.type === 'date' && (field.required || field.name.includes('date'))) return todayInputValue();
  return '';
}

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildTaskConfig(fields: ServiceInputSchemaItem[], values: Record<string, string>) {
  return fields.reduce<Record<string, unknown>>((config, field) => {
    const raw = values[field.name];
    if (raw == null || raw.trim() === '') return config;
    config[field.name] = field.type === 'number' ? Number(raw) : raw.trim();
    return config;
  }, {});
}

function fallbackSummary(status: ExecStatus) {
  if (status === 'success') return '服务执行成功。';
  if (status === 'failed') return '服务执行失败，请根据 failure_code 判断是否重试。';
  if (status === 'timeout') return '请求超时，目标系统无响应。';
  if (status === 'not_integrated') return '服务暂未接入真实脚本，请稍后在提交记录中查看结果。';
  return undefined;
}
