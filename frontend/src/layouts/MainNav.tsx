import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  BookOpen,
  Code2,
  Home,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  X,
  Monitor,
  PenLine,
  User,
  UserCircle,
} from 'lucide-react';
import { Button } from '../shared/ui/button';
import { cn } from '../shared/lib/utils';

interface MainNavProps {
  isLoggedIn: boolean;
  isAdmin?: boolean;
  userLabel?: string;
  onLogout: () => void;
}

export function MainNav({ isLoggedIn, isAdmin, userLabel, onLogout }: MainNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const logoutAndReturnHome = () => {
    onLogout();
    navigate('/');
    setMenuOpen(false);
  };

  const go = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const navItems = [
    { to: '/', icon: <Home size={14} />, label: '首页', show: true },
    { to: '/notes', icon: <PenLine size={14} />, label: '随记', show: true },
    { to: '/dashboard', icon: <Monitor size={14} />, label: '大屏看板', show: true },
    { to: '/scripts', icon: <Code2 size={14} />, label: '脚本分享', show: isLoggedIn },
    { to: '/works', icon: <ImageIcon size={14} />, label: '个人作品', show: isLoggedIn },
    { to: '/blogs', icon: <BookOpen size={14} />, label: '经验心得', show: isLoggedIn },
    { to: '/workstation', icon: <LayoutDashboard size={14} />, label: '工作站', show: isLoggedIn },
    { to: '/me', icon: <UserCircle size={14} />, label: '个人中心', show: isLoggedIn },
    { to: '/admin', icon: <User size={14} />, label: '管理后台', show: !!isAdmin },
  ];

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-black/10 bg-white/92 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-black no-underline group"
        >
          <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center shadow-[0_0_18px_rgba(0,0,0,0.16)]">
            <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
          </div>
          <span
            className="text-base tracking-wide whitespace-nowrap"
            style={{ fontFamily: "'Ma Shan Zheng', serif" }}
          >
            拾光筑梦
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {navItems.filter(item => item.show && item.to !== '/me').map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              active={item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/me')}
                className="hidden md:inline-flex gap-1.5 text-gray-600 hover:text-black"
              >
                <UserCircle size={14} />
                {userLabel || '个人中心'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={logoutAndReturnHome}
                className="gap-1.5 text-gray-600"
              >
                <LogOut size={14} />
                退出
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/register')}
                className="hidden sm:inline-flex gap-1.5 text-gray-600"
              >
                <KeyRound size={14} />
                邀请码注册
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/login')}
                className="gap-1.5 bg-black text-white hover:bg-black/80"
              >
                <LogIn size={14} />
                登录
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(true)}
            className="lg:hidden"
            aria-label="打开导航菜单"
          >
            <Menu size={18} />
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/45"
            aria-label="关闭导航菜单背景"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[86vw] max-w-sm flex-col border-l border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-5">
              <span className="text-lg" style={{ fontFamily: "'Ma Shan Zheng', serif" }}>拾光筑梦</span>
              <Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)} aria-label="关闭导航菜单">
                <X size={18} />
              </Button>
            </div>

            <div className="flex flex-1 flex-col px-5 py-4">
            <div className="space-y-1">
              {navItems.filter(item => item.show).map(item => (
                <button
                  key={item.to}
                  onClick={() => go(item.to)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                    (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to))
                      ? 'bg-black text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-auto border-t border-gray-100 pt-4">
              {isLoggedIn ? (
                <Button variant="outline" onClick={logoutAndReturnHome} className="w-full border-gray-200">
                  <LogOut size={14} />
                  退出登录
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => go('/login')} className="bg-black text-white hover:bg-black/85">
                    <LogIn size={14} />
                    登录
                  </Button>
                  <Button variant="outline" onClick={() => go('/register')} className="border-gray-200">
                    <KeyRound size={14} />
                    注册
                  </Button>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({
  to,
  icon,
  label,
  active = false,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors no-underline',
        active
          ? 'bg-black text-white'
          : 'text-gray-600 hover:text-black hover:bg-gray-50'
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
