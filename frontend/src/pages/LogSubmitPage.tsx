import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { MainNav } from '../layouts/MainNav';
import { StatusCard, type ExecStatus } from '../features/log-submit/components/StatusCard';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Textarea } from '../shared/ui/textarea';
import { Badge } from '../shared/ui/badge';
import { cn } from '../shared/lib/utils';
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
const LOCAL_CACHE_KEY = 'lumitime.logSubmit.localFields.v1';
const LOCAL_CACHE_FIELDS = new Set([
  'student_account',
  'deepseek_base_url',
  'deepseek_model',
]);

const fallbackAccountField: ServiceInputSchemaItem = {
  name: 'student_account',
  label: '学生学习 App 账号',
  type: 'text',
  required: true,
  placeholder: '请输入学生学习 App 账号',
};

const fallbackPasswordField: ServiceInputSchemaItem = {
  name: 'student_password',
  label: '学生学习 App 密码',
  type: 'password',
  required: true,
  placeholder: '仅用于本次提交',
};

const recordStatusConfig: Record<RecordStatus, { label: string; cls: string }> = {
  pending: { label: '等待中', cls: 'bg-gray-100 text-gray-500' },
  running: { label: '执行中', cls: 'bg-blue-50 text-blue-600' },
  success: { label: '成功', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-600' },
  timeout: { label: '超时', cls: 'bg-amber-50 text-amber-600' },
  not_integrated: { label: '未接入', cls: 'bg-gray-100 text-gray-500' },
};

type ReadonlyDoSaveField = {
  key: string;
  value: string;
  source: string;
};

const READONLY_DOSAVE_FIXED_FIELDS: ReadonlyDoSaveField[] = [
  { key: 'XNXQ', value: '20252026-2', source: '后端默认' },
  { key: 'XSDB', value: '1', source: '后端默认' },
  { key: 'BX', value: '智慧警务学院', source: '后端默认' },
  { key: 'XYD_NAME', value: '智慧警务二队', source: '后端默认' },
  { key: 'XYD_COED', value: '1032010', source: '后端默认' },
  { key: 'SXLX', value: '07', source: '后端默认' },
  { key: 'SXXSDT', value: '1', source: '后端默认' },
  { key: 'SFZYXG', value: '1', source: '后端默认' },
  { key: 'SFYC', value: '1', source: '后端默认' },
  { key: 'TJZT', value: '1', source: '后端默认' },
  { key: 'SY_AUDFLAG', value: 'NOSTATUS', source: '后端默认' },
  { key: 'DELFLAG', value: 'A', source: '后端默认' },
  { key: 'SY_ACKFLAG', value: '0', source: '后端默认' },
  { key: 'tableCode', value: 'JWBZK.T_JWBZK_SXMRBG', source: '后端默认' },
  { key: 'codeGenFieldInfo', value: '[]', source: '后端默认' },
  { key: '__isFunc__', value: 'true', source: '后端默认' },
  { key: '__appid__', value: '2020-0823-2056-2412', source: '后端默认' },
  { key: '__funcCode__', value: 'copy from T_JWBZK_SJJX_SXMRBG', source: '后端默认' },
];

const READONLY_DOSAVE_BLANK_FIELDS: ReadonlyDoSaveField[] = [
  'SXLXMC',
  'QKSM',
  'FJ',
  'JB',
  'ID',
  'SY_PIID',
  'SY_PDID',
  'SY_STARTEDUSER',
  'SY_STARTEDUSERNAME',
  'SY_APPROVEDUSERS',
  'SY_APPROVEDUSERNAMES',
  'SY_LASTFLOWINFO',
  'SY_PREAPPROVUSERS',
  'SY_PREAPPROVUSERNAMES',
  'SY_LASTFLOWUSER',
  'SY_LASTFLOWUSERID',
  'SY_WFWARN',
  'SY_WARNFLAG',
  'SY_CURRENTTASK',
  'SY_ACKUSERNAME',
  'SY_ACKUSERID',
  'SY_ACKTIME',
].map(key => ({ key, value: '空', source: '模板默认' }));

const READONLY_DOSAVE_DYNAMIC_FIELDS: ReadonlyDoSaveField[] = [
  { key: 'SXJXRW_ID', value: '提交时从教务接口回填', source: '接口回填' },
  { key: 'XY_ID', value: '提交时从教务接口回填', source: '接口回填' },
  { key: 'OPERATERCODE', value: '提交时从教务接口回填', source: '接口回填' },
  { key: 'SY_CREATEUSERID', value: '提交时从教务接口回填', source: '接口回填' },
];

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
  const taskFields = useMemo(
    () => schema.filter(item => !CREDENTIAL_FIELD_NAMES.has(item.name) && item.name !== 'log_dates'),
    [schema],
  );
  const requiredFields = useMemo(
    () => [...credentialFields, ...taskFields.filter(item => item.required)],
    [credentialFields, taskFields],
  );

  const serviceEnabled = service?.apiStatus === 'enabled';
  const isWorking = pageStatus === 'submitting' || pageStatus === 'pending' || pageStatus === 'running';
  const missingFields = requiredFields.filter(field => (formValues[field.name] || '').trim().length === 0);
  const canSubmit = !!service &&
    serviceLoadState === 'ready' &&
    serviceEnabled &&
    pageStatus === 'idle' &&
    missingFields.length === 0;

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

  const clearCredentials = () => {
    setFormValues(prev => ({ ...prev, student_account: '', student_password: '', deepseek_api_key: '' }));
    saveCachedFields({ student_account: '' });
  };

  const handleSubmit = async () => {
    if (!service) return;
    if (!canSubmit) {
      toast.error(submitDisabledReason(serviceLoadState, service, serviceEnabled, missingFields, pageStatus));
      return;
    }

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
    setServiceRequestId('');
    setApiRequestId('');
    clearPollTimer();
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
    setFailureCode(null);
    setServiceRequestId('');
    setApiRequestId('');
    setPageStatus('idle');
    clearPollTimer();
    serviceDetailApi(resolvedServiceId)
      .then(payload => {
        if (!mounted) return;
        const mapped = mapBackendService(payload.data);
        setService(mapped);
        setFormValues({ ...buildDefaultValues(mapped.inputSchema), ...readCachedFields() });
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

  useEffect(() => {
    if (serviceLoadState === 'ready') saveCachedFields(formValues);
  }, [formValues, serviceLoadState]);

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
  const disabledReason = submitDisabledReason(serviceLoadState, service, serviceEnabled, missingFields, pageStatus);

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f3]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-6">
        <button
          onClick={() => navigate('/workstation')}
          className="mb-6 flex items-center gap-1.5 text-xs text-[#9b978d] transition-colors hover:text-[#56544f]"
        >
          <ArrowLeft size={13} />
          返回工作站
        </button>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
          className="relative mb-6 overflow-hidden rounded-lg border border-[#e8e5dc] bg-white/88 shadow-[0_18px_48px_rgba(20,20,20,0.05)]"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#171717]/20 to-transparent" />
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-[#dedad0] bg-[#fbfaf7] font-mono text-[11px] font-normal text-[#77736a]">
                  {resolvedServiceId}
                </Badge>
                <ServiceStateBadge service={service} loadState={serviceLoadState} />
              </div>
              <h1 className="text-2xl font-medium tracking-[-0.01em] text-[#171717]">{service?.name || '服务加载中'}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6f6d67]">
                {service?.description || '正在从后端读取服务详情。'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-md border border-[#e8e5dc] bg-[#fbfaf7] p-2">
              <MetaTile label="脚本" value={service?.scriptKey || '-'} />
              <MetaTile label="版本" value={service?.scriptVersion || '-'} />
              <MetaTile label="字段" value={`${credentialFields.length + taskFields.length}`} />
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.04 }}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <section className="space-y-5">
            <div className="rounded-lg border border-[#e8e5dc] bg-white/88">
              <div className="border-b border-[#efede7] px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[#9b978d]">Submit</p>
                    <h2 className="mt-1 text-base font-medium text-[#171717]">提交脚本任务</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#9b978d]">
                    {isWorking ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                    {isWorking ? '请求处理中' : '凭证仅用于本次请求'}
                  </div>
                </div>
              </div>

              <div className="space-y-6 p-5">
                {apiNotice && (
                  <Notice tone={serviceLoadState === 'error' ? 'danger' : 'warning'}>{apiNotice}</Notice>
                )}

                <FormGroup
                  index="01"
                  icon={<LockKeyhole size={14} />}
                  title="当前请求凭证"
                  desc="这里输入的是学生学习 App 凭证，不是 Lumitime 登录账号。"
                >
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
                </FormGroup>

                <FormGroup
                  index="02"
                  icon={<SlidersHorizontal size={14} />}
                  title="任务参数"
                  desc={taskFields.length > 0 ? '只提交输入项，doSave 保留字段在下方只读展示。' : '该服务当前无需额外任务参数。'}
                >
                  {taskFields.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {taskFields.map(field => (
                        field.name === 'target_date' ? (
                          <MultiDateField
                            key={field.name}
                            field={field}
                            values={formValues}
                            disabled={pageStatus !== 'idle' || serviceLoadState !== 'ready'}
                            onChange={setFieldValue}
                          />
                        ) : (
                          <SchemaField
                            key={field.name}
                            field={field}
                            value={formValues[field.name] || ''}
                            disabled={pageStatus !== 'idle' || serviceLoadState !== 'ready'}
                            onChange={setFieldValue}
                          />
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-[#d7d2c7] bg-[#fbfaf7] px-4 py-5 text-center text-xs text-[#9b978d]">
                      后端 input_schema 未返回额外参数。
                    </div>
                  )}
                </FormGroup>

                <FormGroup
                  index="03"
                  icon={<FileText size={14} />}
                  title="关键字段预览"
                  desc="这些字段由后端按模板、输入映射、运行时和教务接口生成，客户端提交不会覆盖。"
                >
                  <ReadonlyDoSavePanel values={formValues} />
                </FormGroup>

                <div className="rounded-md border border-[#e8e5dc] bg-[#fbfaf7] p-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#9b978d]" />
                    <p className="text-xs leading-5 text-[#6f6d67]">
                      密码与 DeepSeek Key 仅保留在当前表单状态；后端只保存账号掩码、状态、结果摘要和 `service_request_id`。
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={!canSubmit}
                    className="h-10 flex-1 gap-2 bg-[#161616] text-white hover:bg-black disabled:opacity-40"
                  >
                    {pageStatus === 'submitting' ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        创建服务请求
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        提交脚本任务
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isWorking}
                    onClick={clearCredentials}
                    className="h-10 border-[#dedad0] bg-white text-[#6f6d67] hover:bg-[#fbfaf7] hover:text-[#171717]"
                  >
                    清空本地凭证
                  </Button>
                </div>

                {!canSubmit && (
                  <p className="text-center text-xs text-[#9b978d]">{disabledReason}</p>
                )}
              </div>
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
            <WorkflowPanel
              serviceRequestId={serviceRequestId}
              apiRequestId={apiRequestId}
              pollingUrl={pollingUrl}
              status={pageStatus}
            />

            <RecentRecordsPanel records={recentRecords} onOpen={requestId => navigate(`/workstation/records/${requestId}`)} />

            {pageStatus !== 'idle' && (
              <Button variant="outline" onClick={handleRetry} className="w-full border-[#dedad0] bg-white text-[#6f6d67] hover:bg-[#fbfaf7]">
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

function FormGroup({
  index,
  icon,
  title,
  desc,
  children,
}: {
  index: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#e3dfd5] bg-[#f8f7f3] text-[#171717]">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#b8b3a8]">{index}</span>
            <h3 className="text-sm font-medium text-[#56544f]">{title}</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#9b978d]">{desc}</p>
        </div>
      </div>
      {children}
    </section>
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
  const [showPassword, setShowPassword] = useState(false);
  const isTextarea = field.type === 'textarea';
  const isPassword = field.type === 'password';
  const inputType = isPassword
    ? showPassword ? 'text' : 'password'
    : field.type === 'number' || field.type === 'date' || field.type === 'email'
      ? field.type
      : 'text';
  const isCredential = CREDENTIAL_FIELD_NAMES.has(field.name);

  return (
    <label className={cn('block', isTextarea && 'sm:col-span-2')}>
      <span className="mb-1.5 flex items-center gap-1 text-xs text-[#6f6d67]">
        {field.label}
        {field.required && <span className="text-red-400">*</span>}
      </span>
      {isTextarea ? (
        <Textarea
          value={value}
          onChange={event => onChange(field.name, event.target.value)}
          disabled={disabled}
          placeholder={field.placeholder || field.label}
          className="min-h-24 resize-y border-[#dedad0] bg-white focus-visible:ring-[#171717]"
        />
      ) : (
        <div className="relative">
          <Input
            type={inputType}
            value={value}
            onChange={event => onChange(field.name, event.target.value)}
            disabled={disabled}
            placeholder={field.placeholder || field.label}
            className={cn('border-[#dedad0] bg-white focus-visible:ring-[#171717]', isPassword && 'pr-10')}
            autoComplete={field.name === 'student_password' ? 'new-password' : 'off'}
            inputMode={field.type === 'number' ? 'numeric' : undefined}
          />
          {isPassword && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowPassword(prev => !prev)}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#9b978d] transition-colors hover:bg-[#fbfaf7] hover:text-[#56544f] disabled:pointer-events-none disabled:opacity-40"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
      )}
      <span className="mt-1 block font-mono text-[11px] text-[#b8b3a8]">
        {isCredential ? field.name : `task_config.${field.name}`}
      </span>
    </label>
  );
}

function MultiDateField({
  field,
  values,
  disabled,
  onChange,
}: {
  field: ServiceInputSchemaItem;
  values: Record<string, string>;
  disabled: boolean;
  onChange: (name: string, value: string) => void;
}) {
  const selectedDates = normalizeDateList(values.log_dates || values.target_date || '');
  const candidate = values.target_date || selectedDates[0] || todayInputValue();

  const updateDates = (dates: string[], preferredDate?: string) => {
    const normalized = normalizeDateList(dates);
    onChange('log_dates', dateListToValue(normalized));
    onChange('target_date', preferredDate && normalized.includes(preferredDate) ? preferredDate : normalized[0] || '');
  };

  const addDate = () => {
    if (!candidate) return;
    updateDates([...selectedDates, candidate], candidate);
  };

  const removeDate = (dateValue: string) => {
    updateDates(selectedDates.filter(item => item !== dateValue), candidate === dateValue ? undefined : candidate);
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1 text-xs text-[#6f6d67]">
          {field.label}
          {field.required && <span className="text-red-400">*</span>}
        </span>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            type="date"
            value={candidate}
            onChange={event => onChange('target_date', event.target.value)}
            disabled={disabled}
            className="border-[#dedad0] bg-white focus-visible:ring-[#171717]"
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !candidate}
            onClick={addDate}
            className="h-10 gap-2 border-[#dedad0] bg-white text-[#6f6d67] hover:bg-[#fbfaf7] hover:text-[#171717]"
          >
            <Plus size={14} />
            添加日期
          </Button>
        </div>
      </label>
      <div className="flex min-h-8 flex-wrap gap-2">
        {selectedDates.length > 0 ? selectedDates.map(dateValue => (
          <span
            key={dateValue}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dedad0] bg-white px-2.5 font-mono text-xs text-[#56544f]"
          >
            {dateValue}
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeDate(dateValue)}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[#b8b3a8] transition-colors hover:bg-[#fbfaf7] hover:text-[#56544f] disabled:pointer-events-none disabled:opacity-40"
              aria-label={`移除 ${dateValue}`}
            >
              <X size={12} />
            </button>
          </span>
        )) : (
          <span className="text-xs text-[#9b978d]">至少添加一个提交日期。</span>
        )}
      </div>
      <span className="block font-mono text-[11px] text-[#b8b3a8]">task_config.log_dates</span>
    </div>
  );
}

function ReadonlyDoSavePanel({ values }: { values: Record<string, string> }) {
  const groups = buildReadonlyDoSaveGroups(values);

  return (
    <div className="overflow-hidden rounded-md border border-[#e8e5dc] bg-white">
      {groups.map(group => (
        <div key={group.title} className="border-b border-[#efede7] last:border-b-0">
          <div className="flex items-center justify-between bg-[#fbfaf7] px-3 py-2">
            <p className="text-xs font-medium text-[#56544f]">{group.title}</p>
            <span className="font-mono text-[10px] text-[#b8b3a8]">{group.fields.length} fields</span>
          </div>
          <div className="divide-y divide-[#f1efe9]">
            {group.fields.map(field => (
              <div key={`${group.title}-${field.key}`} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)_88px]">
                <span className="font-mono text-[11px] text-[#6f6d67]">{field.key}</span>
                <span className="min-w-0 truncate text-xs text-[#56544f]">{field.value || '空'}</span>
                <span className="text-xs text-[#9b978d] sm:text-right">{field.source}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ServiceStateBadge({ service, loadState }: { service: Service | null; loadState: 'loading' | 'ready' | 'error' }) {
  if (loadState === 'loading') {
    return (
      <Badge variant="outline" className="gap-1.5 border-[#dedad0] bg-[#fbfaf7] font-normal text-[#77736a]">
        <Loader2 size={11} className="animate-spin" />
        加载中
      </Badge>
    );
  }
  if (loadState === 'error' || !service) {
    return (
      <Badge variant="outline" className="gap-1.5 border-[#f1d6d0] bg-[#fff4f2] font-normal text-red-600">
        <AlertCircle size={11} />
        不可用
      </Badge>
    );
  }
  if (service.apiStatus === 'enabled') {
    return (
      <Badge variant="outline" className="gap-1.5 border-[#d8eadf] bg-[#f1f8f4] font-normal text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        可提交
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5 border-[#dedad0] bg-[#fbfaf7] font-normal text-[#77736a]">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      已停用
    </Badge>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-white px-3 py-2">
      <p className="font-mono text-[10px] text-[#b8b3a8]">{label}</p>
      <p className="mt-1 truncate text-xs text-[#56544f]">{value}</p>
    </div>
  );
}

function WorkflowPanel({
  serviceRequestId,
  apiRequestId,
  pollingUrl,
  status,
}: {
  serviceRequestId: string;
  apiRequestId: string;
  pollingUrl: string;
  status: PageStatus;
}) {
  const traceActive = !!serviceRequestId;
  const working = status === 'submitting' || status === 'pending' || status === 'running';

  return (
    <div className="rounded-lg border border-[#e8e5dc] bg-white/88 p-4">
      <div className="mb-4 flex items-center gap-2">
        <FileText size={15} className="text-[#6f6d67]" />
        <p className="text-sm font-medium text-[#171717]">执行追踪</p>
      </div>

      <div className="space-y-3">
        <WorkflowStep done icon={<KeyRound size={13} />} title="输入凭证" desc="只保留在当前表单状态" />
        <WorkflowStep done={traceActive} active={!traceActive && status === 'submitting'} icon={<Send size={13} />} title="创建请求" desc="后端返回 service_request_id" />
        <WorkflowStep done={TERMINAL_STATUSES.includes(status as RecordStatus)} active={working} icon={<Clock3 size={13} />} title="轮询结果" desc="约每 2 秒读取一次状态" />
        <WorkflowStep done={TERMINAL_STATUSES.includes(status as RecordStatus)} icon={<CheckCircle2 size={13} />} title="写入记录" desc="只保存脱敏结果" />
      </div>

      {traceActive && (
        <div className="mt-4 space-y-2 rounded-md border border-[#efede7] bg-[#fbfaf7] p-3">
          <TraceLine label="service_request_id" value={serviceRequestId} />
          {apiRequestId && <TraceLine label="request_id" value={apiRequestId} />}
          {pollingUrl && <TraceLine label="polling_url" value={pollingUrl} />}
        </div>
      )}
    </div>
  );
}

function WorkflowStep({
  done,
  active,
  icon,
  title,
  desc,
}: {
  done: boolean;
  active?: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3">
      <div className={cn(
        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
        done ? 'border-[#171717] bg-[#171717] text-white' : active ? 'border-[#d9e7f5] bg-[#f3f7fb] text-blue-600' : 'border-[#e8e5dc] bg-[#fbfaf7] text-[#9b978d]',
      )}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={cn('text-sm', done || active ? 'text-[#56544f]' : 'text-[#9b978d]')}>{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-[#9b978d]">{desc}</p>
      </div>
    </div>
  );
}

function TraceLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase text-[#b8b3a8]">{label}</p>
      <p className="break-all font-mono text-[11px] text-[#6f6d67]">{value}</p>
    </div>
  );
}

function RecentRecordsPanel({ records, onOpen }: { records: SubmitRecord[]; onOpen: (requestId: string) => void }) {
  return (
    <div className="rounded-lg border border-[#e8e5dc] bg-white/88 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={15} className="text-[#6f6d67]" />
          <p className="text-sm font-medium text-[#171717]">最近提交记录</p>
        </div>
      </div>
      <div className="divide-y divide-[#efede7]">
        {records.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#9b978d]">暂无该服务的真实提交记录</div>
        ) : records.map(record => (
          <button key={record.id} onClick={() => onOpen(record.serviceRequestId)} className="block w-full py-3 text-left">
            <div className="mb-2 flex items-center gap-2">
              <RecordStatusBadge status={record.status} />
              <span className="truncate font-mono text-xs text-[#9b978d]">{record.serviceRequestId}</span>
            </div>
            <p className="line-clamp-2 text-xs leading-5 text-[#56544f]">{record.resultSummary || '-'}</p>
            <p className="mt-1 text-xs text-[#b8b3a8]">{record.submittedAt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecordStatusBadge({ status }: { status: RecordStatus }) {
  const config = recordStatusConfig[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${config.cls}`}>{config.label}</span>;
}

function Notice({ tone, children }: { tone: 'warning' | 'danger'; children: React.ReactNode }) {
  return (
    <div className={cn(
      'flex items-start gap-2 rounded-md border p-3',
      tone === 'danger' ? 'border-[#f1d6d0] bg-[#fff4f2]' : 'border-[#eadfbd] bg-[#fff8eb]',
    )}>
      <AlertCircle size={14} className={cn('mt-0.5 shrink-0', tone === 'danger' ? 'text-red-600' : 'text-amber-600')} />
      <p className={cn('text-xs leading-5', tone === 'danger' ? 'text-red-700' : 'text-amber-700')}>{children}</p>
    </div>
  );
}

function submitDisabledReason(
  serviceLoadState: 'loading' | 'ready' | 'error',
  service: Service | null,
  serviceEnabled: boolean,
  missingFields: ServiceInputSchemaItem[],
  pageStatus: PageStatus,
) {
  if (pageStatus === 'submitting' || pageStatus === 'pending' || pageStatus === 'running') return '当前请求处理中，请等待执行结果。';
  if (serviceLoadState === 'error') return '服务详情加载失败，请返回工作站重新进入。';
  if (!service) return '服务加载中。';
  if (!serviceEnabled) return '该服务当前未启用，不能提交任务。';
  if (missingFields.length > 0) return `请填写必填项：${missingFields.map(field => field.label).join('、')}`;
  return '';
}

function buildDefaultValues(schema: ServiceInputSchemaItem[]) {
  const values: Record<string, string> = {
    student_account: '',
    student_password: '',
    deepseek_api_key: '',
    deepseek_base_url: 'https://api.deepseek.com',
    deepseek_model: 'deepseek-v4-flash',
  };
  schema.forEach(field => {
    const nextValue = defaultValueForField(field);
    values[field.name] = nextValue || values[field.name] || '';
  });
  if (values.target_date && !values.log_dates) values.log_dates = values.target_date;
  return values;
}

function readCachedFields() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const cached = Object.fromEntries(
      Object.entries(parsed)
        .filter(([key, value]) => LOCAL_CACHE_FIELDS.has(key) && typeof value === 'string')
        .map(([key, value]) => [key, value as string]),
    );
    saveCachedFields(cached);
    return cached;
  } catch {
    return {};
  }
}

function saveCachedFields(values: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const cached = Object.fromEntries(
    Object.entries(values).filter(([key]) => LOCAL_CACHE_FIELDS.has(key)),
  );
  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Local browser storage can be disabled; submitting still works without persistence.
  }
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

function normalizeDateList(value: string | string[]) {
  const rawItems = Array.isArray(value) ? value : value.split(/[\s,，;；]+/);
  const dates = rawItems
    .map(item => item.trim().slice(0, 10))
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item));
  return Array.from(new Set(dates)).sort();
}

function dateListToValue(dates: string[]) {
  return normalizeDateList(dates).join(',');
}

function buildReadonlyDoSaveGroups(values: Record<string, string>) {
  const dates = normalizeDateList(values.log_dates || values.target_date || '');
  const accountPreview = maskAccountPreview(values.student_account);
  const displayName = values.display_name?.trim();
  const sxrzSource = values.sxrz_text?.trim()
    ? '日志正文输入'
    : values.station_activity_text?.trim() && values.deepseek_api_key?.trim()
      ? `DeepSeek ${values.deepseek_model || 'deepseek-v4-flash'}`
      : '本地日志库';

  return [
    {
      title: '输入映射',
      fields: [
        { key: 'XSXM', value: displayName || '提交时由姓名填入', source: '前端输入' },
        { key: 'XSXH', value: accountPreview || '提交时由学号/账号填入', source: '前端输入' },
        { key: 'SY_CREATEUSER', value: accountPreview || '提交时由学号/账号填入', source: '前端输入' },
        { key: 'SY_CREATEUSERNAME', value: displayName || '提交时由姓名填入', source: '前端输入' },
      ],
    },
    {
      title: '运行时生成',
      fields: [
        { key: 'BGRQ', value: dates.length > 0 ? dates.join('、') : '提交日期', source: '提交日期' },
        { key: 'SXRZ', value: sxrzSource, source: '正文来源' },
        { key: 'OPERATETIME', value: '提交时服务器当前时间', source: '运行时' },
      ],
    },
    {
      title: '教务接口回填',
      fields: READONLY_DOSAVE_DYNAMIC_FIELDS,
    },
    {
      title: '固定默认',
      fields: READONLY_DOSAVE_FIXED_FIELDS,
    },
    {
      title: '模板留空',
      fields: READONLY_DOSAVE_BLANK_FIELDS,
    },
  ];
}

function maskAccountPreview(account: string | undefined) {
  const value = (account || '').trim();
  if (!value) return '';
  if (value.length <= 4) return `${value[0] || ''}***`;
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function buildTaskConfig(fields: ServiceInputSchemaItem[], values: Record<string, string>) {
  const config = fields.reduce<Record<string, unknown>>((nextConfig, field) => {
    const raw = values[field.name];
    if (raw == null || raw.trim() === '') return nextConfig;
    if (field.type === 'number') {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) nextConfig[field.name] = parsed;
      return nextConfig;
    }
    nextConfig[field.name] = raw.trim();
    return nextConfig;
  }, {});
  const selectedDates = normalizeDateList(values.log_dates || values.target_date || '');
  if (selectedDates.length > 0) {
    config.log_dates = selectedDates;
    config.target_date = selectedDates[0];
  }
  return config;
}

function fallbackSummary(status: ExecStatus) {
  if (status === 'success') return '服务执行成功。';
  if (status === 'failed') return '服务执行失败，请根据 failure_code 判断是否重试。';
  if (status === 'timeout') return '请求超时，目标系统无响应。';
  if (status === 'not_integrated') return '服务暂未接入真实脚本，请稍后在提交记录中查看结果。';
  return undefined;
}
