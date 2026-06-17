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
    icon: <Clock size={20} className="text-gray-500" />,
    label: '等待执行',
    labelCls: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-100',
  },
  running: {
    icon: <Loader2 size={20} className="animate-spin text-blue-500" />,
    label: '执行中',
    labelCls: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-100',
  },
  success: {
    icon: <CheckCircle2 size={20} className="text-emerald-500" />,
    label: '执行成功',
    labelCls: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-100',
  },
  failed: {
    icon: <XCircle size={20} className="text-red-500" />,
    label: '执行失败',
    labelCls: 'text-red-700',
    bg: 'bg-red-50 border-red-100',
  },
  timeout: {
    icon: <Clock size={20} className="text-amber-500" />,
    label: '请求超时',
    labelCls: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-100',
  },
  not_integrated: {
    icon: <PlugZap size={20} className="text-gray-500" />,
    label: '服务未接入',
    labelCls: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-100',
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
        className={`border rounded-lg p-5 ${cfg.bg}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{cfg.icon}</div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${cfg.labelCls} mb-1`}>{cfg.label}</p>

            <div className="mb-2 space-y-1">
              <p className="font-mono text-xs text-gray-500">service_request_id: {serviceRequestId}</p>
              {apiRequestId && <p className="font-mono text-[11px] text-gray-400">request_id: {apiRequestId}</p>}
              {pollingUrl && <p className="break-all font-mono text-[11px] text-gray-400">polling_url: {pollingUrl}</p>}
            </div>

            {/* Polling indicator */}
            {(status === 'pending' || status === 'running') && (
              <div className="flex items-center gap-1 text-xs text-blue-500">
                <span>每 2 秒轮询一次，最长等待 120 秒</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 rounded-full bg-blue-400 inline-block"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                    />
                  ))}
                </span>
              </div>
            )}

            {/* Summary */}
            {summary && status !== 'pending' && status !== 'running' && (
              <p className="text-xs text-gray-700 mt-2">{summary}</p>
            )}

            {/* Failure category */}
            {failureCode && (
              <p className="text-xs text-gray-500 mt-1">
                failure_code: <span className="font-mono">{failureCode}</span> · {failureLabels[failureCode]}
              </p>
            )}
          </div>
        </div>

        {/* Retry button */}
        {(['failed', 'timeout', 'not_integrated'] as ExecStatus[]).includes(status) && onRetry && (
          <div className="mt-4 pt-4 border-t border-current/10">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-1.5 border-gray-300 text-gray-700 hover:bg-white"
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
