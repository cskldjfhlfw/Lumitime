import { useMemo, useState } from 'react';
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
import PillNav, { type PillNavItem } from '../shared/components/PillNav';
import { NightModeToggle } from '../shared/components/NightModeToggle';
import { useNightMode } from '../app/providers/NightModeProvider';
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
  const { nightMode, toggleNightMode } = useNightMode();

  const logoutAndReturnHome = () => {
    onLogout();
    navigate('/');
    setMenuOpen(false);
  };

  const go = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const navItems = useMemo(() => [
    { to: '/dashboard', icon: <Monitor size={14} />, label: '大屏看板', show: isLoggedIn },
    { to: '/notes', icon: <PenLine size={14} />, label: '随记', show: true },
    { to: '/', icon: <Home size={14} />, label: '首页', show: !isLoggedIn },
    { to: '/scripts', icon: <Code2 size={14} />, label: '脚本分享', show: isLoggedIn },
    { to: '/works', icon: <ImageIcon size={14} />, label: '个人作品', show: isLoggedIn },
    { to: '/blogs', icon: <BookOpen size={14} />, label: '经验心得', show: isLoggedIn },
    { to: '/workstation', icon: <LayoutDashboard size={14} />, label: '工作站', show: isLoggedIn },
    { to: '/me', icon: <UserCircle size={14} />, label: '个人中心', show: isLoggedIn },
    { to: '/admin', icon: <User size={14} />, label: '管理后台', show: !!isAdmin },
  ], [isAdmin, isLoggedIn]);
  const visibleNavItems = navItems.filter(item => item.show && item.to !== '/me');
  const activeHref = visibleNavItems.find(item => isRouteActive(item.to, location.pathname))?.to || visibleNavItems[0]?.to || '/notes';
  const pillItems: PillNavItem[] = visibleNavItems.map(item => ({
    href: item.to,
    label: item.label,
    icon: item.icon,
  }));

  return (
    <nav className="sticky top-0 z-40 w-full overflow-visible border-b border-[#e8e5dc] bg-[#fbfaf7]/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#181818]/88">
      <NightModeToggle
        active={nightMode}
        onToggle={toggleNightMode}
        className="fixed left-4 top-4 z-[60] sm:left-6"
      />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <div className="group flex items-center gap-2 pl-16 text-[#171717] sm:pl-20 lg:hidden">
          <Link
            to="/"
            className="lumitime-script-logo whitespace-nowrap text-2xl text-[#171717] dark:text-[#f5f2ea]"
            style={{ fontFamily: "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive" }}
          >
            Lumitime
          </Link>
        </div>

        <div className="hidden min-w-0 flex-1 items-center lg:flex">
          <PillNav
            brand={(
              <Link
                to="/"
                className="lumitime-script-logo whitespace-nowrap text-2xl text-[#171717] dark:text-[#f5f2ea]"
                style={{ fontFamily: "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive" }}
              >
                Lumitime
              </Link>
            )}
            logoAlt="Lumitime"
            items={pillItems}
            activeHref={activeHref}
            onNavigate={href => navigate(href)}
            className="max-w-full"
            ease="cubic-bezier(0.2, 0.8, 0.2, 1)"
            baseColor={nightMode ? '#f5f2ea' : '#5f5a52'}
            pillColor={nightMode ? '#f5f2ea' : '#171717'}
            hoveredPillTextColor={nightMode ? '#171717' : '#ffffff'}
            pillTextColor={nightMode ? '#171717' : '#ffffff'}
            theme={nightMode ? 'dark' : 'light'}
            initialLoadAnimation
          />
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/me')}
                className="hidden gap-1.5 text-[#6f6d67] hover:bg-white hover:text-[#171717] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white md:inline-flex"
              >
                <UserCircle size={14} />
                {userLabel || '个人中心'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={logoutAndReturnHome}
                className="gap-1.5 text-[#6f6d67] hover:bg-white hover:text-[#171717] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
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
                className="hidden gap-1.5 text-[#6f6d67] hover:bg-white hover:text-[#171717] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white sm:inline-flex"
              >
                <KeyRound size={14} />
                邀请码注册
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/login')}
                className="hidden gap-1.5 bg-[#161616] text-white hover:bg-black sm:inline-flex"
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
          <div className="absolute inset-y-0 right-0 flex w-[86vw] max-w-sm flex-col border-l border-[#e8e5dc] bg-[#fbfaf7] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e8e5dc] px-5 py-5">
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
                    isRouteActive(item.to, location.pathname)
                      ? 'bg-[#161616] text-white'
                      : 'text-[#6f6d67] hover:bg-white hover:text-[#171717]'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-auto border-t border-[#e8e5dc] pt-4">
              {isLoggedIn ? (
                <Button variant="outline" onClick={logoutAndReturnHome} className="w-full border-[#dedad0] bg-white">
                  <LogOut size={14} />
                  退出登录
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => go('/login')} className="bg-[#161616] text-white hover:bg-black">
                    <LogIn size={14} />
                    登录
                  </Button>
                  <Button variant="outline" onClick={() => go('/register')} className="border-[#dedad0] bg-white">
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

function isRouteActive(path: string, currentPath: string) {
  if (path === '/') return currentPath === '/';
  return currentPath === path || currentPath.startsWith(`${path}/`);
}
