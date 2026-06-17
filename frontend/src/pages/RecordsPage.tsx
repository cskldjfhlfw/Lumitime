import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, RotateCcw, ChevronLeft, ChevronRight, Loader2, ShieldCheck, Send, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { MainNav } from '../layouts/MainNav';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Textarea } from '../shared/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shared/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../shared/ui/sheet';
import type { SubmitRecord, RecordStatus } from '../mocks/mockRecords';
import type { Service } from '../mocks/mockServices';
import { useAuth } from '../app/providers/AuthProvider';
import {
  ApiClientError,
  listServicesApi,
  mapBackendRequest,
  mapBackendService,
  myServiceRequestsApi,
  retryServiceRequestApi,
  serviceRequestDetailApi,
} from '../shared/api/lumitimeApi';

const statusConfig: Record<RecordStatus, { label: string; cls: string }> = {
  pending: { label: '等待中', cls: 'bg-gray-100 text-gray-600' },
  running: { label: '执行中', cls: 'bg-blue-50 text-blue-600' },
  success: { label: '成功', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-600' },
  timeout: { label: '超时', cls: 'bg-amber-50 text-amber-600' },
  not_integrated: { label: '未接入', cls: 'bg-gray-100 text-gray-600' },
};

const PAGE_SIZE = 10;

export function RecordsPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { isLoggedIn, isAdmin, logout, user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterService, setFilterService] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SubmitRecord | null>(null);
  const [records, setRecords] = useState<SubmitRecord[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [apiNotice, setApiNotice] = useState('');
  const [servicesNotice, setServicesNotice] = useState('');
  const [retryAccount, setRetryAccount] = useState('');
  const [retryPassword, setRetryPassword] = useState('');
  const [retryTaskConfig, setRetryTaskConfig] = useState('');
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryError, setRetryError] = useState('');

  const filtered = useMemo(() => {
    return records.filter(r => {
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchService = filterService === 'all' || r.serviceId === filterService;
      const submittedDate = r.submittedAt.slice(0, 10);
      const matchStart = !startDate || submittedDate >= startDate;
      const matchEnd = !endDate || submittedDate <= endDate;
      const matchSearch =
        search.trim() === '' ||
        r.serviceName.includes(search) ||
        r.serviceRequestId.includes(search);
      return matchStatus && matchService && matchStart && matchEnd && matchSearch;
    });
  }, [endDate, filterService, filterStatus, records, search, startDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const loadServices = async () => {
    setServicesLoading(true);
    setServicesNotice('');
    try {
      const payload = await listServicesApi();
      setServices(payload.data.items.map(mapBackendService));
    } catch (error) {
      setServices([]);
      setServicesNotice(error instanceof ApiClientError ? error.message : '服务列表加载失败。');
    } finally {
      setServicesLoading(false);
    }
  };

  const loadRecords = async () => {
    setRecordsLoading(true);
    setApiNotice('');
    try {
      const payload = await myServiceRequestsApi({
        service_id: filterService,
        status: filterStatus,
        start_date: startDate,
        end_date: endDate,
        page: 1,
        page_size: 100,
      });
      setRecords(payload.data.items.map(item => mapBackendRequest(item, payload.request_id)));
    } catch (error) {
      setRecords([]);
      setApiNotice(error instanceof ApiClientError ? error.message : '后端提交记录不可用，请确认接口状态。');
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  useEffect(() => {
    setPage(1);
    void loadRecords();
  }, [filterService, filterStatus, startDate, endDate]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!requestId) return;
    const localRecord = records.find(record => record.serviceRequestId === requestId);
    if (localRecord) {
      setSelected(localRecord);
      return;
    }
    serviceRequestDetailApi(requestId)
      .then(payload => {
        const mapped = mapBackendRequest(payload.data, payload.request_id);
        setSelected(mapped);
        setRecords(prev => prev.some(record => record.serviceRequestId === mapped.serviceRequestId) ? prev : [mapped, ...prev]);
      })
      .catch(error => {
        toast.error(error instanceof ApiClientError ? error.message : '无法打开该提交记录。');
      });
  }, [records, requestId]);

  useEffect(() => {
    setRetryAccount('');
    setRetryPassword('');
    setRetryError('');
    setRetryTaskConfig(selected ? JSON.stringify(defaultRetryTaskConfig(selected), null, 2) : '');
  }, [selected?.serviceRequestId]);

  const handleRetry = async () => {
    if (!selected) return;
    if (!retryAccount.trim() || !retryPassword) {
      setRetryError('请重新输入学生学习 App 账号和密码。');
      return;
    }

    let taskConfig: Record<string, unknown> | undefined;
    try {
      taskConfig = parseRetryTaskConfig(retryTaskConfig);
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : '任务参数 JSON 不可解析。');
      return;
    }

    setRetryLoading(true);
    setRetryError('');
    const studentAccount = retryAccount.trim();
    const studentPassword = retryPassword;
    setRetryAccount('');
    setRetryPassword('');

    try {
      const created = await retryServiceRequestApi(selected.serviceRequestId, {
        student_account: studentAccount,
        student_password: studentPassword,
        task_config: taskConfig,
      });
      toast.success('重试请求已创建。');
      setSelected(null);
      void loadRecords();
      navigate(`/workstation/records/${created.data.service_request_id}`, { replace: true });
    } catch (error) {
      setRetryError(error instanceof ApiClientError ? error.message : '重试请求创建失败。');
    } finally {
      setRetryLoading(false);
    }
  };

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
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-medium text-gray-900 mb-0.5">提交记录</h1>
              <p className="text-xs text-gray-400">GET /api/v1/workstation/service-requests/my · 共 {filtered.length} 条记录</p>
            </div>
            {(recordsLoading || servicesLoading) && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </div>

          <div className="mb-5 flex items-start gap-2 rounded-lg border border-gray-100 bg-white p-3">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-gray-400" />
            <p className="text-xs leading-5 text-gray-500">
              这里只展示自己的服务请求、结果摘要和账号掩码。完整学生账号、密码、Cookie、Token 与原始请求头不会出现在记录或导出中；记录保留 180 天。
            </p>
          </div>
          {(apiNotice || servicesNotice) && (
            <div className="mb-5 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-700">
              {apiNotice || servicesNotice}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-5">
            <Input
              placeholder="搜索服务名、请求 ID…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="max-w-xs border-gray-200 focus-visible:ring-black text-sm h-9"
            />
            <Select value={filterService} onValueChange={v => { setFilterService(v); setPage(1); }}>
              <SelectTrigger className="w-48 h-9 border-gray-200 text-sm">
                <SelectValue placeholder="服务" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部服务</SelectItem>
                {services.map(service => (
                  <SelectItem key={service.apiId} value={service.apiId}>{service.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-9 border-gray-200 text-sm">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
                <SelectItem value="timeout">超时</SelectItem>
                <SelectItem value="running">执行中</SelectItem>
                <SelectItem value="pending">等待中</SelectItem>
                <SelectItem value="not_integrated">未接入</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="h-9 w-36 border-gray-200 text-sm focus-visible:ring-black"
            />
            <Input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="h-9 w-36 border-gray-200 text-sm focus-visible:ring-black"
            />
            <Button variant="outline" size="sm" onClick={() => void loadRecords()} className="h-9 border-gray-200 text-xs text-gray-500">
              <RotateCcw size={13} />
              刷新
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
            <div className="hidden grid-cols-[96px_1fr_170px_86px_130px_120px] bg-gray-50 px-5 py-3 md:grid border-b border-gray-100">
              {['状态', '服务 / service_request_id', '提交时间', '耗时', '账号掩码', 'failure_code'].map(h => (
                <span key={h} className="text-xs text-gray-400 font-medium">{h}</span>
              ))}
            </div>

            {recordsLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
                <Loader2 size={15} className="animate-spin" />
                正在读取提交记录
              </div>
            ) : paged.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">暂无记录</div>
            ) : (
              paged.map(record => {
                const cfg = statusConfig[record.status];
                return (
                  <button
                    key={record.id}
                    onClick={() => navigate(`/workstation/records/${record.serviceRequestId}`)}
                    className="grid w-full gap-2 border-b border-gray-50 px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-gray-50 md:grid-cols-[96px_1fr_170px_86px_130px_120px] md:gap-0 md:py-3.5"
                  >
                    <span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                    </span>
                    <span className="min-w-0 pr-4">
                      <span className="block truncate text-sm text-gray-700">{record.serviceName}</span>
                      <span className="block truncate font-mono text-xs text-gray-400">{record.serviceRequestId}</span>
                    </span>
                    <span className="text-xs text-gray-500">{record.submittedAt}</span>
                    <span className="text-xs text-gray-500">{record.duration}</span>
                    <span className="text-xs text-gray-400 font-mono">{record.studentAccountMasked}</span>
                    <span className="text-xs text-gray-400 font-mono">{record.failureCode || '-'}</span>
                  </button>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="h-8 px-2"
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs text-gray-500">{page} / {totalPages}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="h-8 px-2"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </motion.div>
      </main>

      <Sheet open={!!selected} onOpenChange={open => {
        if (!open) {
          setSelected(null);
          if (requestId) navigate('/workstation/records', { replace: true });
        }
      }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>{selected.serviceName}</SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  {selected.serviceRequestId}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-1">
                <DetailRow label="service_request_id">
                  <span className="font-mono text-xs text-gray-700">{selected.serviceRequestId}</span>
                </DetailRow>
                <DetailRow label="request_id">
                  <span className="font-mono text-xs text-gray-500">{selected.apiRequestId || '-'}</span>
                </DetailRow>
                <DetailRow label="状态">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[selected.status].cls}`}>
                    {statusConfig[selected.status].label}
                  </span>
                </DetailRow>
                <DetailRow label="提交时间">
                  <span className="text-sm text-gray-700">{selected.submittedAt}</span>
                </DetailRow>
                <DetailRow label="完成时间">
                  <span className="text-sm text-gray-700">{selected.finishedAt || '尚未完成'}</span>
                </DetailRow>
                <DetailRow label="执行耗时">
                  <span className="text-sm text-gray-700">{selected.duration} {selected.durationMs ? `(${selected.durationMs}ms)` : ''}</span>
                </DetailRow>
                <DetailRow label="账号">
                  <span className="text-sm text-gray-700 font-mono">{selected.studentAccountMasked}</span>
                </DetailRow>
                <DetailRow label="结果摘要">
                  <span className="text-sm text-gray-700">{selected.resultSummary || '-'}</span>
                </DetailRow>
                {selected.failureCode && (
                  <DetailRow label="failure_code">
                    <span className="font-mono text-sm text-red-600">{selected.failureCode}</span>
                  </DetailRow>
                )}
                {selected.retryOfServiceRequestId && (
                  <DetailRow label="重试来源">
                    <span className="font-mono text-xs text-gray-500">{selected.retryOfServiceRequestId}</span>
                  </DetailRow>
                )}
                <div className="rounded-md bg-gray-50 p-3 text-xs leading-5 text-gray-500">
                  邀请用户视图不展示完整执行日志。如需排查，请向管理员提供 service_request_id 和接口 request_id。
                </div>
              </div>

              {selected.canRetry && (
                <div className="mt-8 space-y-4 border-t border-gray-100 px-1 pt-6">
                  <div className="flex items-start gap-2">
                    <SlidersHorizontal size={15} className="mt-0.5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">重新提交该记录</p>
                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        后端 retry 接口会创建新的 service_request_id。账号和密码只用于本次重试，提交后立即清空。
                      </p>
                    </div>
                  </div>

                  {retryError && (
                    <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3">
                      <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600" />
                      <p className="text-xs leading-5 text-red-700">{retryError}</p>
                    </div>
                  )}

                  <RetryField label="学生学习 App 账号">
                    <Input value={retryAccount} onChange={e => setRetryAccount(e.target.value)} placeholder="重新输入账号" className="border-gray-200 focus-visible:ring-black" autoComplete="off" />
                  </RetryField>
                  <RetryField label="学生学习 App 密码">
                    <Input type="password" value={retryPassword} onChange={e => setRetryPassword(e.target.value)} placeholder="重新输入密码" className="border-gray-200 focus-visible:ring-black" autoComplete="new-password" />
                  </RetryField>
                  <RetryField label="任务参数 JSON">
                    <Textarea value={retryTaskConfig} onChange={e => setRetryTaskConfig(e.target.value)} rows={5} className="min-h-28 border-gray-200 font-mono text-xs focus-visible:ring-black" />
                  </RetryField>

                  <Button
                    className="w-full gap-2 bg-black text-white hover:bg-black/80"
                    onClick={() => void handleRetry()}
                    disabled={retryLoading || !retryAccount.trim() || !retryPassword}
                  >
                    {retryLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {retryLoading ? '创建重试请求…' : '创建重试请求'}
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function RetryField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function defaultRetryTaskConfig(record: SubmitRecord) {
  if (record.serviceId === 'service_log_auto_submit') {
    return { target_date: todayInputValue() };
  }
  return {};
}

function parseRetryTaskConfig(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('任务参数必须是 JSON 对象。');
  }
  return parsed as Record<string, unknown>;
}

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
