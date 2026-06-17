import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ChevronRight, ArrowLeft, Activity, Clock3, LayoutDashboard, Loader2, RefreshCw } from 'lucide-react';
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
      listServicesApi(),
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
    <div className="min-h-screen bg-[#f8f8f7] flex flex-col">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-8"
        >
          <ArrowLeft size={13} />
          返回主页
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end"
        >
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-gray-400">Workstation</p>
            <h1 className="text-3xl font-medium text-gray-950 mb-2">工作站</h1>
            <p className="max-w-xl text-sm leading-7 text-gray-500">
              自动化工具与服务集合。首版所有受邀用户可见全部启用服务，提交后生成 service_request_id 并保留 180 天非敏感记录。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-100 bg-white p-3">
            <MiniStat icon={<LayoutDashboard size={14} />} label="服务" value={loading ? '...' : services.length.toString()} />
            <MiniStat icon={<Activity size={14} />} label="启用" value={activeServices.toString()} />
            <MiniStat icon={<Clock3 size={14} />} label="记录" value={loading ? '...' : recentRecords.length.toString()} />
          </div>
        </motion.div>

        {apiError && (
          <div className="mb-8 flex items-start justify-between gap-4 rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-xs leading-5 text-red-700">{apiError}</p>
            <button
              onClick={loadWorkstation}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-red-100 bg-white px-2.5 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50"
            >
              <RefreshCw size={12} />
              重试
            </button>
          </div>
        )}

        <section className="mb-12">
          <div className="mb-5 flex items-center gap-2">
            <p className="text-xs text-gray-400 uppercase tracking-widest">可用服务</p>
            {loading && <Loader2 size={13} className="animate-spin text-gray-300" />}
          </div>
          {services.length === 0 && !loading ? (
            <EmptyState title="暂无可用服务" desc={apiError ? '后端服务列表未能加载，修复接口后点击重试。' : '后端当前没有返回启用的工作站服务。'} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service, i) => (
                <ServiceCard key={service.id} service={service} index={i} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-gray-400 uppercase tracking-widest">我的提交记录</p>
            <button
              onClick={() => navigate('/workstation/records')}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-black transition-colors"
            >
              查看全部
              <ChevronRight size={12} />
            </button>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg divide-y divide-gray-50">
            {recentRecords.length === 0 && !loading ? (
              <div className="px-5 py-12 text-center text-sm text-gray-400">
                暂无真实提交记录
              </div>
            ) : recentRecords.map(record => {
              const cfg = statusConfig[record.status];
              return (
                <button
                  key={record.id}
                  onClick={() => navigate(`/workstation/records/${record.serviceRequestId}`)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{record.serviceName}</span>
                  <span className="hidden font-mono text-xs text-gray-400 sm:block">{record.serviceRequestId}</span>
                  <span className="text-xs text-gray-400">{record.submittedAt}</span>
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
    <div className="rounded-lg border border-dashed border-gray-200 bg-white px-5 py-12 text-center">
      <p className="text-sm text-gray-700">{title}</p>
      <p className="mt-2 text-xs text-gray-400">{desc}</p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <div className="mb-2 text-gray-400">{icon}</div>
      <p className="text-xl font-light text-gray-950">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
