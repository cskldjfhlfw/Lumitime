import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, RotateCcw, Loader2, ShieldCheck, Send, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { MainNav } from '../layouts/MainNav';
import { Pager } from '../shared/components/Pager';
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
  pending: { label: '等待中', cls: 'bg-white text-[#56544f] border border-[#e8e5dc]' },
  running: { label: '执行中', cls: 'bg-[#f3f7fb] text-blue-600 border border-[#d9e7f5]' },
  success: { label: '成功', cls: 'bg-[#f1f8f4] text-emerald-700 border border-[#d8eadf]' },
  failed: { label: '失败', cls: 'bg-[#fff4f2] text-red-600 border border-[#f1d6d0]' },
  timeout: { label: '超时', cls: 'bg-[#fff8eb] text-amber-700 border border-[#eadfbd]' },
  not_integrated: { label: '未接入', cls: 'bg-white text-[#56544f] border border-[#e8e5dc]' },
};

const PAGE_SIZE = 10;
const SERVICE_FILTER_PAGE_SIZE = 20;

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
  const [totalRecords, setTotalRecords] = useState(0);
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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRecords / PAGE_SIZE)), [totalRecords]);

  const loadServices = async () => {
    setServicesLoading(true);
    setServicesNotice('');
    try {
      const payload = await listServicesApi({ page: 1, page_size: SERVICE_FILTER_PAGE_SIZE });
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
        service_request_id: search.trim(),
        page,
        page_size: PAGE_SIZE,
      });
      setRecords(payload.data.items.map(item => mapBackendRequest(item, payload.request_id)));
      setTotalRecords(payload.data.total);
    } catch (error) {
      setRecords([]);
      setTotalRecords(0);
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
  }, [filterService, filterStatus, startDate, endDate, search]);

  useEffect(() => {
    void loadRecords();
  }, [filterService, filterStatus, startDate, endDate, search, page]);

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
    <div className="flex min-h-screen flex-col bg-[#f8f7f3]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-6">
        <button
          onClick={() => navigate('/workstation')}
          className="mb-8 flex items-center gap-1.5 text-xs text-[#9b978d] transition-colors hover:text-[#56544f]"
        >
          <ArrowLeft size={13} />
          返回工作站
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[#9b978d]">Execution records</p>
              <h1 className="text-3xl font-medium tracking-[-0.01em] text-[#171717]">提交记录</h1>
              <p className="mt-2 text-xs text-[#9b978d]">GET /api/v1/workstation/service-requests/my · 共 {totalRecords} 条记录</p>
            </div>
            {(recordsLoading || servicesLoading) && <Loader2 size={16} className="animate-spin text-[#9b978d]" />}
          </div>

          <div className="mb-5 flex items-start gap-2 rounded-lg border border-[#e8e5dc] bg-white/88 p-3">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#9b978d]" />
            <p className="text-xs leading-5 text-[#6f6d67]">
              这里只展示自己的服务请求、结果摘要和账号掩码。完整学生账号、密码、Cookie、Token 与原始请求头不会出现在记录或导出中；记录保留 180 天。
            </p>
          </div>
          {(apiNotice || servicesNotice) && (
            <div className="mb-5 rounded-lg border border-[#eadfbd] bg-[#fff8eb] p-3 text-xs leading-5 text-amber-700">
              {apiNotice || servicesNotice}
            </div>
          )}

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Input
              placeholder="搜索服务名、请求 ID…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="h-9 max-w-xs border-[#dedad0] bg-white text-sm focus-visible:ring-[#171717]"
            />
            <Select value={filterService} onValueChange={v => { setFilterService(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-48 border-[#dedad0] bg-white text-sm">
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
              <SelectTrigger className="h-9 w-32 border-[#dedad0] bg-white text-sm">
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
              className="h-9 w-36 border-[#dedad0] bg-white text-sm focus-visible:ring-[#171717]"
            />
            <Input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="h-9 w-36 border-[#dedad0] bg-white text-sm focus-visible:ring-[#171717]"
            />
            <Button variant="outline" size="sm" onClick={() => void loadRecords()} className="h-9 border-[#dedad0] bg-white text-xs text-[#6f6d67] hover:bg-[#fbfaf7]">
              <RotateCcw size={13} />
              刷新
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#e8e5dc] bg-white/88">
            <div className="hidden grid-cols-[96px_1fr_170px_86px_130px_120px] border-b border-[#efede7] bg-[#fbfaf7] px-5 py-3 md:grid">
              {['状态', '服务 / service_request_id', '提交时间', '耗时', '账号掩码', 'failure_code'].map(h => (
                <span key={h} className="text-xs font-medium text-[#9b978d]">{h}</span>
              ))}
            </div>

            {recordsLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#9b978d]">
                <Loader2 size={15} className="animate-spin" />
                正在读取提交记录
              </div>
            ) : records.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#9b978d]">暂无记录</div>
            ) : (
              records.map(record => {
                const cfg = statusConfig[record.status];
                return (
                  <button
                    key={record.id}
                    onClick={() => navigate(`/workstation/records/${record.serviceRequestId}`)}
                    className="grid w-full gap-2 border-b border-[#f1efe9] px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-[#fbfaf7] md:grid-cols-[96px_1fr_170px_86px_130px_120px] md:gap-0 md:py-3.5"
                  >
                    <span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${cfg.cls}`}>{cfg.label}</span>
                    </span>
                    <span className="min-w-0 pr-4">
                      <span className="block truncate text-sm text-[#56544f]">{record.serviceName}</span>
                      <span className="block truncate font-mono text-xs text-[#9b978d]">{record.serviceRequestId}</span>
                    </span>
                    <span className="text-xs text-[#6f6d67]">{record.submittedAt}</span>
                    <span className="text-xs text-[#6f6d67]">{record.duration}</span>
                    <span className="font-mono text-xs text-[#9b978d]">{record.studentAccountMasked}</span>
                    <span className="font-mono text-xs text-[#9b978d]">{record.failureCode || '-'}</span>
                  </button>
                );
              })
            )}
          </div>

          <Pager page={page} pageSize={PAGE_SIZE} total={totalRecords} loading={recordsLoading} onPageChange={setPage} className="mt-5" />
        </motion.div>
      </main>

      <Sheet open={!!selected} onOpenChange={open => {
        if (!open) {
          setSelected(null);
          if (requestId) navigate('/workstation/records', { replace: true });
        }
      }}>
        <SheetContent className="w-full overflow-y-auto border-[#e8e5dc] bg-[#fbfaf7] sm:max-w-lg">
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
                  <span className="font-mono text-xs text-[#56544f]">{selected.serviceRequestId}</span>
                </DetailRow>
                <DetailRow label="request_id">
                  <span className="font-mono text-xs text-[#6f6d67]">{selected.apiRequestId || '-'}</span>
                </DetailRow>
                <DetailRow label="状态">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusConfig[selected.status].cls}`}>
                    {statusConfig[selected.status].label}
                  </span>
                </DetailRow>
                <DetailRow label="提交时间">
                  <span className="text-sm text-[#56544f]">{selected.submittedAt}</span>
                </DetailRow>
                <DetailRow label="完成时间">
                  <span className="text-sm text-[#56544f]">{selected.finishedAt || '尚未完成'}</span>
                </DetailRow>
                <DetailRow label="执行耗时">
                  <span className="text-sm text-[#56544f]">{selected.duration} {selected.durationMs ? `(${selected.durationMs}ms)` : ''}</span>
                </DetailRow>
                <DetailRow label="账号">
                  <span className="font-mono text-sm text-[#56544f]">{selected.studentAccountMasked}</span>
                </DetailRow>
                <DetailRow label="结果摘要">
                  <span className="text-sm text-[#56544f]">{selected.resultSummary || '-'}</span>
                </DetailRow>
                {selected.failureCode && (
                  <DetailRow label="failure_code">
                    <span className="font-mono text-sm text-red-600">{selected.failureCode}</span>
                  </DetailRow>
                )}
                {selected.retryOfServiceRequestId && (
                  <DetailRow label="重试来源">
                    <span className="font-mono text-xs text-[#6f6d67]">{selected.retryOfServiceRequestId}</span>
                  </DetailRow>
                )}
                <div className="rounded-md border border-[#e8e5dc] bg-white p-3 text-xs leading-5 text-[#6f6d67]">
                  邀请用户视图不展示完整执行日志。如需排查，请向管理员提供 service_request_id 和接口 request_id。
                </div>
              </div>

              {selected.canRetry && (
                <div className="mt-8 space-y-4 border-t border-[#e8e5dc] px-1 pt-6">
                  <div className="flex items-start gap-2">
                    <SlidersHorizontal size={15} className="mt-0.5 text-[#6f6d67]" />
                    <div>
                      <p className="text-sm font-medium text-[#171717]">重新提交该记录</p>
                      <p className="mt-1 text-xs leading-5 text-[#9b978d]">
                        后端 retry 接口会创建新的 service_request_id。账号和密码只用于本次重试，提交后立即清空。
                      </p>
                    </div>
                  </div>

                  {retryError && (
                    <div className="flex items-start gap-2 rounded-md border border-[#f1d6d0] bg-[#fff4f2] p-3">
                      <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600" />
                      <p className="text-xs leading-5 text-red-700">{retryError}</p>
                    </div>
                  )}

                  <RetryField label="学生学习 App 账号">
                    <Input value={retryAccount} onChange={e => setRetryAccount(e.target.value)} placeholder="重新输入账号" className="border-[#dedad0] bg-white focus-visible:ring-[#171717]" autoComplete="off" />
                  </RetryField>
                  <RetryField label="学生学习 App 密码">
                    <Input type="password" value={retryPassword} onChange={e => setRetryPassword(e.target.value)} placeholder="重新输入密码" className="border-[#dedad0] bg-white focus-visible:ring-[#171717]" autoComplete="new-password" />
                  </RetryField>
                  <RetryField label="任务参数 JSON">
                    <Textarea value={retryTaskConfig} onChange={e => setRetryTaskConfig(e.target.value)} rows={5} className="min-h-28 border-[#dedad0] bg-white font-mono text-xs focus-visible:ring-[#171717]" />
                  </RetryField>

                  <Button
                    className="w-full gap-2 bg-[#161616] text-white hover:bg-black"
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
      <span className="w-20 shrink-0 pt-0.5 text-xs text-[#9b978d]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function RetryField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[#6f6d67]">{label}</span>
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
