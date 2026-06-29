import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, RotateCcw, Clock, PlugZap } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import type { FailureCode } from '../../../mocks/mockRecords';

export type ExecStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'not_integrated';

interface StatusCardProps {
  status: ExecStatus;
  serviceRequestId: string;
  apiRequestId?: string;
  pollingUrl?: string;
  summary?: string;
  failureCode?: FailureCode;
  onRetry?: () => void;
}

const statusConfig = {
  pending: {
    icon: <Clock size={20} className="text-[#77736a]" />,
    label: '等待执行',
    labelCls: 'text-[#56544f]',
    bg: 'bg-white border-[#e8e5dc]',
  },
  running: {
    icon: <Loader2 size={20} className="animate-spin text-blue-500" />,
    label: '执行中',
    labelCls: 'text-blue-600',
    bg: 'bg-[#f3f7fb] border-[#d9e7f5]',
  },
  success: {
    icon: <CheckCircle2 size={20} className="text-emerald-500" />,
    label: '执行成功',
    labelCls: 'text-emerald-700',
    bg: 'bg-[#f1f8f4] border-[#d8eadf]',
  },
  failed: {
    icon: <XCircle size={20} className="text-red-500" />,
    label: '执行失败',
    labelCls: 'text-red-700',
    bg: 'bg-[#fff4f2] border-[#f1d6d0]',
  },
  timeout: {
    icon: <Clock size={20} className="text-amber-500" />,
    label: '请求超时',
    labelCls: 'text-amber-700',
    bg: 'bg-[#fff8eb] border-[#eadfbd]',
  },
  not_integrated: {
    icon: <PlugZap size={20} className="text-[#77736a]" />,
    label: '服务未接入',
    labelCls: 'text-[#56544f]',
    bg: 'bg-white border-[#e8e5dc]',
  },
};

const failureLabels: Record<Exclude<FailureCode, null>, string> = {
  AUTH_FAILED: '学生学习 App 账号或密码错误',
  NETWORK_ERROR: '网络异常',
  SCHOOL_SYSTEM_ERROR: '学校系统异常',
  SCRIPT_ERROR: '自动化脚本异常',
  VALIDATION_ERROR: '输入校验失败',
  TIMEOUT: '执行超时',
  UNKNOWN_ERROR: '未知错误',
  SERVICE_NOT_INTEGRATED: '服务暂未接入真实脚本',
};

export function StatusCard({ status, serviceRequestId, apiRequestId, pollingUrl, summary, failureCode, onRetry }: StatusCardProps) {
  const cfg = statusConfig[status];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className={`rounded-lg border p-4 ${cfg.bg}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{cfg.icon}</div>
          <div className="flex-1">
            <p className={`mb-2 text-sm font-medium ${cfg.labelCls}`}>{cfg.label}</p>

            <div className="mb-2 space-y-1">
              <p className="font-mono text-xs text-[#56544f]">service_request_id: {serviceRequestId}</p>
              {apiRequestId && <p className="font-mono text-[11px] text-[#9b978d]">request_id: {apiRequestId}</p>}
              {pollingUrl && <p className="break-all font-mono text-[11px] text-[#9b978d]">polling_url: {pollingUrl}</p>}
            </div>

            {/* Polling indicator */}
            {(status === 'pending' || status === 'running') && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <span>每 2 秒轮询一次，最长等待 120 秒</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="inline-block h-1 w-1 rounded-full bg-blue-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                    />
                  ))}
                </span>
              </div>
            )}

            {/* Summary */}
            {summary && status !== 'pending' && status !== 'running' && (
              <p className="mt-2 text-xs leading-5 text-[#56544f]">{summary}</p>
            )}

            {/* Failure category */}
            {failureCode && (
              <p className="mt-1 text-xs text-[#6f6d67]">
                failure_code: <span className="font-mono">{failureCode}</span> · {failureLabels[failureCode]}
              </p>
            )}
          </div>
        </div>

        {/* Retry button */}
        {(['failed', 'timeout', 'not_integrated'] as ExecStatus[]).includes(status) && onRetry && (
          <div className="mt-4 border-t border-current/10 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-1.5 border-[#dedad0] bg-white text-[#56544f] hover:bg-white"
            >
              <RotateCcw size={12} />
              重新输入凭证并提交
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
