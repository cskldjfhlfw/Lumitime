import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}

export function Pager({ page, pageSize, total, onPageChange, loading = false, className = '' }: PagerProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total <= pageSize && totalPages <= 1) return null;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p className="text-xs text-[#8f8a80]">
        {start}-{end} / {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="h-8 border-[#dedad0] bg-white px-2 text-xs text-[#6f6d67] hover:bg-[#fbfaf7]"
          aria-label="上一页"
        >
          <ChevronLeft size={14} />
        </Button>
        <span className="min-w-14 text-center text-xs text-[#6f6d67]">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="h-8 border-[#dedad0] bg-white px-2 text-xs text-[#6f6d67] hover:bg-[#fbfaf7]"
          aria-label="下一页"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
