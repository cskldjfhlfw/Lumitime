import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
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
import { Maximize2, Minimize2, ArrowLeft } from 'lucide-react';
import { MetricBlock } from '../features/dashboard/components/MetricBlock';
import { dashboardRanges, type Metric } from '../mocks/mockMetrics';
import { ApiClientError, dashboardMetricsApi, type DashboardRange, type DashboardSnapshot } from '../shared/api/lumitimeApi';

export function DashboardPage() {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [range, setRange] = useState<DashboardRange>('7d');
  const [totals, setTotals] = useState<DashboardSnapshot | null>(null);
  const [dailyChanges, setDailyChanges] = useState<DashboardSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

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
    <motion.div
      className="min-h-screen bg-[#080808] text-white flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft size={13} />
            返回
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span
            className="text-base text-white/80 tracking-wide"
            style={{ fontFamily: "'Ma Shan Zheng', serif", fontWeight: 400 }}
          >
            拾光筑梦 · 数据看板
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-md border border-white/10 bg-white/[0.03] p-0.5 sm:flex">
            {dashboardRanges.map(item => (
              <button
                key={item}
                onClick={() => setRange(item)}
                className={`h-7 rounded px-3 text-xs transition-colors ${range === item ? 'bg-white text-black' : 'text-white/35 hover:text-white/70'}`}
              >
                {item}
              </button>
            ))}
          </div>
          <span className="text-xs text-white/30">{dailyChanges.at(-1)?.date || '实时'}</span>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            title={isFullscreen ? '退出全屏' : '全屏'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/25">GET /api/v1/dashboard/metrics?range={range}</p>
            <h1 className="mt-1 text-xl font-light text-white/82">公开聚合指标</h1>
          </div>
          <p className="max-w-md text-xs leading-5 text-white/30">
            仅返回 totals 与 daily_changes，不含用户明细、IP、账号、留言原文或服务提交记录。
          </p>
        </div>
        {error && (
          <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}
        {loading && (
          <div className="mb-5 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/40">
            正在读取聚合指标…
          </div>
        )}

        <div className="mb-5 flex rounded-md border border-white/10 bg-white/[0.03] p-0.5 sm:hidden">
          {dashboardRanges.map(item => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className={`h-8 flex-1 rounded text-xs transition-colors ${range === item ? 'bg-white text-black' : 'text-white/35 hover:text-white/70'}`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <MetricBlock metric={metric} delay={i * 100} />
            </motion.div>
          ))}
        </div>

        {/* Trend chart */}
        <motion.div
          className="bg-[#111111] border border-white/5 rounded-lg p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-medium text-white/80">日度趋势</h2>
              <p className="text-xs text-white/30 mt-0.5">当前范围 {range} · daily_changes 聚合变化</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="w-3 h-px bg-white/60 inline-block" />
                访问数
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="w-3 h-px bg-emerald-500/70 inline-block" />
                用户数
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.8)',
                }}
                itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
                cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Line
                type="monotone"
                dataKey="visit_count"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth={1.5}
                dot={false}
                name="访问数"
                activeDot={{ r: 4, fill: 'white' }}
              />
              <Line
                type="monotone"
                dataKey="user_count"
                stroke="rgba(52,211,153,0.7)"
                strokeWidth={1.5}
                dot={false}
                name="用户数"
                activeDot={{ r: 4, fill: '#34d399' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Footer disclaimer */}
        <p className="text-xs text-white/20 text-center mt-6">
          数据仅展示汇总统计，不含用户明细、IP 地址或账号信息
        </p>
      </div>
    </motion.div>
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
