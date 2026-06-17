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
  return (
    <aside className="w-64 shrink-0 bg-[#fafafa] border-r border-gray-100 flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
          <span className="font-medium text-sm text-black">管理后台</span>
        </div>
        <Link
          to="/"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 no-underline mt-1 transition-colors"
        >
          <ArrowLeft size={11} />
          返回主页
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                isActive
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
            A
          </div>
          <div>
            <p className="text-xs font-medium text-gray-800">Admin</p>
            <p className="text-xs text-gray-400">管理员</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
