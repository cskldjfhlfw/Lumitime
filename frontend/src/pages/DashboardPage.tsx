import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Activity, BarChart3, CalendarDays, Database } from 'lucide-react';
import { MetricBlock } from '../features/dashboard/components/MetricBlock';
import { dashboardRanges, type Metric } from '../mocks/mockMetrics';
import { ApiClientError, dashboardMetricsApi, type DashboardRange, type DashboardSnapshot } from '../shared/api/lumitimeApi';
import { MainNav } from '../layouts/MainNav';
import { useAuth } from '../app/providers/AuthProvider';

export function DashboardPage() {
  const { isLoggedIn, isAdmin, logout, user } = useAuth();
  const [range, setRange] = useState<DashboardRange>('7d');
  const [totals, setTotals] = useState<DashboardSnapshot | null>(null);
  const [dailyChanges, setDailyChanges] = useState<DashboardSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    dashboardMetricsApi(range)
      .then(payload => {
        setTotals(payload.data.totals);
        setDailyChanges(payload.data.daily_changes);
      })
      .catch(error => {
        setTotals(null);
        setDailyChanges([]);
        setError(error instanceof ApiClientError ? error.message : '大屏指标加载失败。');
      })
      .finally(() => setLoading(false));
  }, [range]);

  const metrics = useMemo(() => makeMetrics(totals, dailyChanges), [dailyChanges, totals]);
  const chartData = useMemo(() => dailyChanges.map(item => ({
    ...item,
    date: item.date?.slice(5) || '-',
  })), [dailyChanges]);

  return (
    <div className="dashboard-page min-h-screen overflow-x-hidden bg-[#f8f7f3] text-[#171717] dark:bg-[#151515] dark:text-[#f5f2ea]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <motion.main
        className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <header className="mb-8 flex flex-col gap-6 border-b border-[#e3dfd5] pb-7 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[#9b978d] dark:text-white/40">
              <BarChart3 size={14} />
              Site statistics
            </p>
            <h1 className="text-4xl font-light tracking-normal text-[#171717] dark:text-white">大屏看板</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6f6d67] dark:text-white/56">
              汇总展示 Lumitime 的公开访问、内容与工作站服务数据，只呈现聚合趋势。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-[#dedad0] bg-white/76 p-1 shadow-[0_12px_30px_rgba(20,20,20,0.04)] dark:border-white/10 dark:bg-white/[0.06]">
              {dashboardRanges.map(item => (
                <button
                  key={item}
                  onClick={() => setRange(item)}
                  className={`h-8 rounded-md px-3 text-xs transition-colors ${range === item ? 'bg-[#171717] text-white dark:bg-white dark:text-[#171717]' : 'text-[#7d786f] hover:text-[#171717] dark:text-white/48 dark:hover:text-white'}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 rounded-lg border border-[#e8e5dc] bg-white/62 px-3 py-2 text-xs text-[#7d786f] dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50">
              <CalendarDays size={13} />
              {dailyChanges.at(-1)?.date || '实时'}
            </span>
          </div>
        </header>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <InfoStrip icon={<Database size={15} />} label="数据来源" value="GET /api/v1/dashboard/metrics" />
          <InfoStrip icon={<Activity size={15} />} label="当前范围" value={`${range} · daily_changes`} />
          <InfoStrip icon={<BarChart3 size={15} />} label="隐私边界" value="仅聚合统计" />
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {error}
          </div>
        )}
        {loading && (
          <div className="mb-5 rounded-lg border border-[#e8e5dc] bg-white/80 p-4 text-sm text-[#9b978d] dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50">
            正在读取聚合指标...
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <MetricBlock metric={metric} delay={i * 70} />
            </motion.div>
          ))}
        </div>

        <motion.section
          className="rounded-lg border border-[#e8e5dc] bg-white/86 p-5 shadow-[0_20px_60px_rgba(20,20,20,0.05)] dark:border-white/10 dark:bg-white/[0.06]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-medium text-[#171717] dark:text-white">日度趋势</h2>
              <p className="mt-1 text-xs text-[#9b978d] dark:text-white/45">访问数与用户数的聚合变化</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-[#6f6d67] dark:text-white/50">
                <span className="inline-block h-px w-4 bg-[#56544f]" />
                访问数
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#6f6d67] dark:text-white/50">
                <span className="inline-block h-px w-4 bg-emerald-500" />
                用户数
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(88,83,75,0.12)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9b978d', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(88,83,75,0.16)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9b978d', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: '#fbfaf7',
                  border: '1px solid #e3dfd5',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#171717',
                }}
                itemStyle={{ color: '#56544f' }}
                cursor={{ stroke: 'rgba(88,83,75,0.15)' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="visit_count"
                stroke="#56544f"
                strokeWidth={1.8}
                dot={false}
                name="访问数"
                activeDot={{ r: 4, fill: '#171717' }}
              />
              <Line
                type="monotone"
                dataKey="user_count"
                stroke="#10b981"
                strokeWidth={1.8}
                dot={false}
                name="用户数"
                activeDot={{ r: 4, fill: '#10b981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.section>
      </motion.main>
    </div>
  );
}

function InfoStrip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-[#e8e5dc] bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.05]">
      <span className="text-[#9b978d] dark:text-white/40">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#aaa69c] dark:text-white/32">{label}</p>
        <p className="truncate text-xs text-[#56544f] dark:text-white/62">{value}</p>
      </div>
    </div>
  );
}

function makeMetrics(totals: DashboardSnapshot | null, dailyChanges: DashboardSnapshot[]): Metric[] {
  const trendFor = (key: keyof DashboardSnapshot) => {
    const values = dailyChanges.map(item => Number(item[key] || 0));
    return values.length ? values : [0, 0, 0, 0, 0, 0, 0];
  };
  return [
    { key: 'user_count', label: '注册用户', value: totals?.user_count || 0, trend: trendFor('user_count') },
    { key: 'developer_count', label: '开发者', value: totals?.developer_count || 0, trend: trendFor('developer_count') },
    { key: 'visit_count', label: '访问数', value: totals?.visit_count || 0, trend: trendFor('visit_count') },
    { key: 'work_count', label: '个人作品', value: totals?.work_count || 0, trend: trendFor('work_count') },
    { key: 'script_count', label: '脚本数', value: totals?.script_count || 0, trend: trendFor('script_count') },
    { key: 'blog_count', label: '博客文章', value: totals?.blog_count || 0, trend: trendFor('blog_count') },
    { key: 'message_count', label: '随记条目', value: totals?.message_count || 0, trend: trendFor('message_count') },
    { key: 'service_count', label: '工作站服务', value: totals?.service_count || 0, trend: trendFor('service_count') },
  ];
}
