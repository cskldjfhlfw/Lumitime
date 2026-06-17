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
    <div className="bg-[#111111] border border-white/5 rounded-lg p-5 flex flex-col gap-3 hover:border-white/10 transition-colors">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-light text-white tabular-nums">
            {count.toLocaleString()}
            {metric.unit && (
              <span className="text-base text-white/50 ml-1">{metric.unit}</span>
            )}
          </p>
          <p className="text-xs text-white/40 mt-1.5 tracking-wide">{metric.label}</p>
        </div>

        {/* Trend badge */}
        <div className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
          {first > 0 && last >= first ? '+' : ''}{trendText}
        </div>
      </div>

      {/* Sparkline */}
      <div className="h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`grad-${metric.label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(255,255,255,0.3)" stopOpacity={1} />
                <stop offset="95%" stopColor="rgba(255,255,255,0)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke="rgba(255,255,255,0.5)"
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
