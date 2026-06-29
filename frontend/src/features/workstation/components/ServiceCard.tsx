import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, Clock } from 'lucide-react';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import type { Service, ServiceStatus } from '../../../mocks/mockServices';

function StatusBadge({ status, apiStatus }: { status: ServiceStatus; apiStatus: Service['apiStatus'] }) {
  if (status === 'active')
    return (
      <Badge className="gap-1.5 border-[#d8eadf] bg-[#f1f8f4] font-normal text-emerald-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        {apiStatus === 'enabled' ? '在线' : '待接入'}
      </Badge>
    );
  if (status === 'maintenance')
    return (
      <Badge className="gap-1.5 border-[#eadfbd] bg-[#fff8eb] font-normal text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        维护中
      </Badge>
    );
  return (
    <Badge className="gap-1.5 border-[#e8e5dc] bg-[#fbfaf7] font-normal text-[#77736a]">
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
      className="flex min-h-[190px] flex-col justify-between rounded-lg border border-[#e8e5dc] bg-white/86 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d7d2c7] hover:shadow-[0_18px_44px_rgba(20,20,20,0.07)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-sm font-medium text-[#171717]">{service.name}</h3>
          <p className="text-xs leading-6 text-[#6f6d67]">{service.summary}</p>
          <p className="mt-3 truncate font-mono text-[11px] text-[#aaa69c]">{service.apiId} · {service.scriptVersion}</p>
        </div>
        <StatusBadge status={service.status} apiStatus={service.apiStatus} />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[#efede7] pt-4">
        <span className="flex items-center gap-1 text-xs text-[#9b978d]">
          <Clock size={11} />
          {service.updatedAt}
        </span>
        <Button
          size="sm"
          disabled={!canEnter}
          onClick={() => canEnter && navigate(service.route)}
          className={`h-8 gap-1.5 rounded-md text-xs ${!canEnter ? 'cursor-not-allowed bg-[#efede7] text-[#aaa69c]' : 'bg-[#161616] text-white hover:bg-black'}`}
        >
          {canEnter ? '进入服务' : '待接入'}
          <ArrowRight size={11} />
        </Button>
      </div>
    </motion.div>
  );
}
