import { useEffect, useRef, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { Metric } from '../../../mocks/mockMetrics';

interface MetricBlockProps {
  metric: Metric;
  delay?: number;
}

function useCountUp(target: number, duration: number = 1600, delay: number = 0) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      startedRef.current = true;
      const startTime = performance.now();
      const startVal = 0;

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(startVal + (target - startVal) * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }, delay);

    return () => clearTimeout(timer);
  }, [target, duration, delay]);

  return value;
}

export function MetricBlock({ metric, delay = 0 }: MetricBlockProps) {
  const count = useCountUp(metric.value, 1400, delay);
  const sparkData = metric.trend.map((v, i) => ({ v, i }));
  const first = metric.trend[0] || 0;
  const last = metric.trend[metric.trend.length - 1] || 0;
  const trendText = first > 0 ? `${Math.round(((last - first) / first) * 100)}%` : '0%';

  return (
    <div className="dashboard-metric-card flex flex-col gap-3 rounded-lg border border-[#e8e5dc] bg-white/86 p-5 transition-colors hover:border-[#d8d4ca] dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-white/20">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-light tabular-nums text-[#171717] dark:text-white">
            {count.toLocaleString()}
            {metric.unit && (
              <span className="ml-1 text-base text-[#9b978d] dark:text-white/50">{metric.unit}</span>
            )}
          </p>
          <p className="mt-1.5 text-xs tracking-wide text-[#7d786f] dark:text-white/50">{metric.label}</p>
        </div>

        <div className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
          {first > 0 && last >= first ? '+' : ''}{trendText}
        </div>
      </div>

      <div className="h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`grad-${metric.label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(88,83,75,0.22)" stopOpacity={1} />
                <stop offset="95%" stopColor="rgba(88,83,75,0)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke="rgba(88,83,75,0.55)"
              strokeWidth={1.5}
              fill={`url(#grad-${metric.label})`}
              dot={false}
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
