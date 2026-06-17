import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, Clock } from 'lucide-react';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import type { Service, ServiceStatus } from '../../../mocks/mockServices';

function StatusBadge({ status, apiStatus }: { status: ServiceStatus; apiStatus: Service['apiStatus'] }) {
  if (status === 'active')
    return (
      <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 font-normal text-emerald-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        {apiStatus === 'enabled' ? '在线' : '待接入'}
      </Badge>
    );
  if (status === 'maintenance')
    return (
      <Badge className="gap-1.5 border-amber-200 bg-amber-50 font-normal text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        维护中
      </Badge>
    );
  return (
    <Badge className="gap-1.5 border-gray-200 bg-gray-50 font-normal text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      已下线
    </Badge>
  );
}

interface ServiceCardProps {
  service: Service;
  index?: number;
}

export function ServiceCard({ service, index = 0 }: ServiceCardProps) {
  const navigate = useNavigate();
  const canEnter = service.apiStatus === 'enabled';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: index * 0.07 }}
      className="flex flex-col gap-4 rounded-lg border border-gray-150 bg-white p-5 transition-all duration-200 hover:border-gray-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 text-sm font-medium text-gray-900">{service.name}</h3>
          <p className="text-xs leading-relaxed text-gray-500">{service.summary}</p>
          <p className="mt-2 truncate text-[11px] text-gray-300">{service.apiId} · {service.scriptVersion}</p>
        </div>
        <StatusBadge status={service.status} apiStatus={service.apiStatus} />
      </div>

      <div className="flex items-center justify-between border-t border-gray-50 pt-3">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Clock size={11} />
          {service.updatedAt}
        </span>
        <Button
          size="sm"
          disabled={!canEnter}
          onClick={() => canEnter && navigate(service.route)}
          className={`h-7 gap-1.5 text-xs ${!canEnter ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-black text-white hover:bg-black/80'}`}
        >
          {canEnter ? '进入服务' : '待接入'}
          <ArrowRight size={11} />
        </Button>
      </div>
    </motion.div>
  );
}
