import { Link } from 'react-router';
import {
  Activity,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Users,
  Key,
  FileText,
  Settings,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import { NightModeToggle } from '../shared/components/NightModeToggle';
import { useNightMode } from '../app/providers/NightModeProvider';
import { cn } from '../shared/lib/utils';

interface AdminSidebarProps {
  active: string;
  onSelect: (item: string) => void;
}

const navItems = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'invites', label: '邀请码管理', icon: Key },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'scripts', label: '脚本管理', icon: FileText },
  { id: 'works', label: '作品管理', icon: BookOpen },
  { id: 'blogs', label: '博客管理', icon: Settings },
  { id: 'messages', label: '留言管理', icon: MessageSquare },
  { id: 'services', label: '服务管理', icon: ServerCog },
  { id: 'records', label: '服务提交记录', icon: Activity },
  { id: 'audit', label: '审计记录', icon: ShieldCheck },
  { id: 'metrics', label: '看板统计 / 导出', icon: BarChart3 },
];

export function AdminSidebar({ active, onSelect }: AdminSidebarProps) {
  const { nightMode, toggleNightMode } = useNightMode();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-gray-100 bg-[#fafafa] dark:border-white/10 dark:bg-[#171717]">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
        <div className="mb-1 flex items-center gap-2">
          <span
            className="lumitime-script-logo text-3xl leading-none text-black dark:text-[#f5f2ea]"
            style={{ fontFamily: "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive" }}
          >
            Lumitime
          </span>
        </div>
        <Link
          to="/"
          className="mt-2 flex items-center gap-1 text-xs text-gray-400 no-underline transition-colors hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70"
        >
          <ArrowLeft size={11} />
          返回主页
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
                isActive
                  ? 'bg-black text-white dark:bg-white dark:text-[#171717]'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-white/62 dark:hover:bg-white/10 dark:hover:text-white'
              )}
            >
              <Icon size={15} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={13} />}
            </button>
          );
        })}
      </nav>

      {/* Bottom account */}
      <div className="border-t border-gray-100 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-white/70">
            A
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 dark:text-white">Admin</p>
            <p className="text-xs text-gray-400 dark:text-white/42">管理员</p>
          </div>
          </div>
          <NightModeToggle active={nightMode} onToggle={toggleNightMode} className="scale-[0.82]" />
        </div>
      </div>
    </aside>
  );
}
