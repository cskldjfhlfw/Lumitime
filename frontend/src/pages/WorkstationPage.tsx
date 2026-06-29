import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ChevronRight, ArrowLeft, Clock3, LayoutDashboard, Loader2, RefreshCw } from 'lucide-react';
import { MainNav } from '../layouts/MainNav';
import { ServiceCard } from '../features/workstation/components/ServiceCard';
import type { Service } from '../mocks/mockServices';
import type { RecordStatus, SubmitRecord } from '../mocks/mockRecords';
import { useAuth } from '../app/providers/AuthProvider';
import {
  ApiClientError,
  listServicesApi,
  mapBackendRequest,
  mapBackendService,
  myServiceRequestsApi,
} from '../shared/api/lumitimeApi';

const statusConfig: Record<RecordStatus, { label: string; cls: string }> = {
  pending: { label: '等待中', cls: 'bg-gray-100 text-gray-500' },
  running: { label: '执行中', cls: 'bg-blue-50 text-blue-600' },
  success: { label: '成功', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-600' },
  timeout: { label: '超时', cls: 'bg-amber-50 text-amber-600' },
  not_integrated: { label: '未接入', cls: 'bg-gray-100 text-gray-500' },
};

export function WorkstationPage() {
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, logout, user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [recentRecords, setRecentRecords] = useState<SubmitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  const activeServices = services.filter(service => service.apiStatus === 'enabled').length;

  const loadWorkstation = () => {
    setLoading(true);
    setApiError('');
    Promise.all([
      listServicesApi({ page: 1, page_size: 1 }),
      myServiceRequestsApi({ page: 1, page_size: 3 }),
    ])
      .then(([servicePayload, recordsPayload]) => {
        setServices(servicePayload.data.items.map(mapBackendService));
        setRecentRecords(recordsPayload.data.items.map(item => mapBackendRequest(item, recordsPayload.request_id)));
      })
      .catch(error => {
        setServices([]);
        setRecentRecords([]);
        setApiError(error instanceof ApiClientError ? error.message : '工作站数据加载失败，请确认后端服务状态。');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadWorkstation();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f3]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="mb-8 flex items-center gap-1.5 text-xs text-[#9b978d] transition-colors hover:text-[#56544f]"
        >
          <ArrowLeft size={13} />
          返回主页
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 grid gap-5 lg:grid-cols-[1fr_300px] lg:items-end"
        >
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[#9b978d]">Invited tools</p>
            <h1 className="mb-3 text-3xl font-medium tracking-[-0.01em] text-[#171717]">受邀工具</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#e8e5dc] bg-white/82 p-3 shadow-[0_18px_44px_rgba(20,20,20,0.05)]">
            <MiniStat icon={<LayoutDashboard size={14} />} label="日志服务" value={loading ? '...' : activeServices.toString()} />
            <MiniStat icon={<Clock3 size={14} />} label="最近记录" value={loading ? '...' : recentRecords.length.toString()} />
          </div>
        </motion.div>

        {apiError && (
          <div className="mb-8 flex items-start justify-between gap-4 rounded-lg border border-[#f1d6d0] bg-[#fff4f2] p-4">
            <p className="text-xs leading-5 text-[#9c4234]">{apiError}</p>
            <button
              onClick={loadWorkstation}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#f1d6d0] bg-white px-2.5 py-1.5 text-xs text-[#9c4234] transition-colors hover:bg-[#fff9f8]"
            >
              <RefreshCw size={12} />
              重试
            </button>
          </div>
        )}

        <section className="mb-12">
          <div className="mb-5 flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[#9b978d]">日志提交</p>
            {loading && <Loader2 size={13} className="animate-spin text-[#aaa69c]" />}
          </div>
          {services.length === 0 && !loading ? (
            <EmptyState title="暂无可用服务" desc={apiError ? '后端服务列表未能加载，修复接口后点击重试。' : '后端当前没有返回启用的工作站服务。'} />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:max-w-xl">
              {services.map((service, i) => (
                <ServiceCard key={service.id} service={service} index={i} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[#9b978d]">日志自动提交记录</p>
            <button
              onClick={() => navigate('/workstation/records')}
              className="flex items-center gap-1 text-xs text-[#6f6d67] transition-colors hover:text-[#171717]"
            >
              查看全部
              <ChevronRight size={12} />
            </button>
          </div>

          <div className="divide-y divide-[#efede7] rounded-lg border border-[#e8e5dc] bg-white/86">
            {recentRecords.length === 0 && !loading ? (
              <div className="px-5 py-12 text-center text-sm text-[#9b978d]">
                暂无真实提交记录
              </div>
            ) : recentRecords.map(record => {
              const cfg = statusConfig[record.status];
              return (
                <button
                  key={record.id}
                  onClick={() => navigate(`/workstation/records/${record.serviceRequestId}`)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[#fbfaf7]"
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                  <span className="flex-1 truncate text-sm text-[#56544f]">{record.serviceName}</span>
                  <span className="hidden font-mono text-xs text-[#9b978d] sm:block">{record.serviceRequestId}</span>
                  <span className="text-xs text-[#9b978d]">{record.submittedAt}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#d7d2c7] bg-white/72 px-5 py-12 text-center">
      <p className="text-sm text-[#56544f]">{title}</p>
      <p className="mt-2 text-xs text-[#9b978d]">{desc}</p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#efede7] bg-[#fbfaf7] p-3">
      <div className="mb-2 text-[#9b978d]">{icon}</div>
      <p className="text-xl font-light text-[#171717]">{value}</p>
      <p className="text-xs text-[#9b978d]">{label}</p>
    </div>
  );
}
