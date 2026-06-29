import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Image,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  Monitor,
  Pencil,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { MainNav } from '../layouts/MainNav';
import { ModuleCard } from '../features/home/components/ModuleCard';
import { Button } from '../shared/ui/button';
import { useAuth } from '../app/providers/AuthProvider';
import LightRays from '../shared/components/LightRays';

const publicModules = [
  {
    icon: <Monitor size={18} />,
    title: '大屏看板',
    description: '只展示聚合指标，作为公开站点状态的一扇窗。',
    route: '/dashboard',
    locked: false,
  },
  {
    icon: <Pencil size={18} />,
    title: '随记',
    description: '公开留言与时间片段，保留那些值得回看的微光。',
    route: '/notes',
    locked: false,
  },
];

const invitedModules = [
  {
    icon: <Image size={18} />,
    title: '个人作品',
    description: '项目、设计、方案和创作成果的归档入口。',
    route: '/works',
    locked: true,
  },
  {
    icon: <BookOpen size={18} />,
    title: '经验心得',
    description: '技术复盘、方法沉淀与成长记录。',
    route: '/blogs',
    locked: true,
  },
  {
    icon: <Code2 size={18} />,
    title: '脚本分享',
    description: '常用自动化脚本和使用说明，供受邀成员查阅。',
    route: '/scripts',
    locked: true,
  },
  {
    icon: <LayoutDashboard size={18} />,
    title: '受邀工具',
    description: '工作站与任务提交能力，只作为自用效率工具。',
    route: '/workstation',
    locked: true,
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, logout, user } = useAuth();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--lumitime-bg)] text-[#171717] dark:text-[#f5f2ea]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] overflow-hidden">
        <LightRays
          raysOrigin="top-center"
          raysColor="#fff7dc"
          raysSpeed={0.82}
          lightSpread={0.52}
          rayLength={2.8}
          followMouse
          mouseInfluence={0.08}
          noiseAmount={0.02}
          distortion={0.04}
          className="opacity-80"
          pulsating={false}
          fadeDistance={0.95}
          saturation={1.04}
        />
      </div>
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="relative z-10">
        <section className="relative overflow-hidden border-b border-[#e8e5dc]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(255,255,255,0.95),transparent_24%),radial-gradient(circle_at_18%_78%,rgba(0,0,0,0.055),transparent_22%)]" />
          <div className="pointer-events-none absolute left-1/2 top-16 hidden h-[440px] w-[440px] -translate-x-1/2 rounded-full border border-[#e3dfd5]/70 lg:block" />

          <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:py-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <p className="mb-6 max-w-full text-sm leading-7 text-[#8d897f] sm:max-w-xl">
                Every faint light of time, paves the way for your dream.
              </p>

              <h1
                className="max-w-3xl text-5xl leading-[1.12] tracking-normal text-[#171717] sm:text-6xl lg:text-7xl"
                style={{ fontFamily: "'Ma Shan Zheng', serif", fontWeight: 400 }}
              >
                拾光筑梦
                <span
                  className="lumitime-script-logo mt-3 block text-3xl text-[#77736a] sm:text-4xl"
                  style={{ fontFamily: "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive" }}
                >
                  Lumitime
                </span>
              </h1>

              <p className="mt-7 max-w-[22rem] text-base leading-8 text-[#56544f] sm:max-w-2xl">
                一个用于记录、沉淀和整理个人创作的个人站。公开内容保持轻盈可读，受邀入口承载脚本、作品、心得与自用工作站。
              </p>

              <div className="mt-9 grid max-w-[22rem] grid-cols-1 gap-3 sm:max-w-none sm:flex sm:flex-wrap sm:items-center">
                <Button onClick={() => navigate('/notes')} className="h-10 gap-2 bg-[#161616] px-4 text-white hover:bg-black sm:px-5">
                  进入随记
                  <ArrowRight size={14} />
                </Button>
                <Button
                  onClick={() => navigate('/works')}
                  variant="outline"
                  className="h-10 border-[#d9d5ca] bg-white/78 px-4 text-[#171717] hover:bg-white sm:px-5"
                >
                  查看作品
                </Button>
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="ghost"
                  className="h-10 text-[#6f6d67] hover:bg-white hover:text-[#171717]"
                >
                  查看大屏
                </Button>
              </div>

              <div className="mt-5 grid max-w-[22rem] grid-cols-1 gap-3 sm:max-w-none sm:flex sm:flex-wrap sm:items-center">
                {isLoggedIn ? (
                  <Button
                    onClick={() => navigate('/workstation')}
                    variant="outline"
                    className="h-9 border-[#d9d5ca] bg-white/70 text-[#56544f] hover:bg-white hover:text-[#171717]"
                  >
                    <LayoutDashboard size={14} />
                    进入受邀工具
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => navigate('/login')}
                      variant="outline"
                      className="h-9 border-[#d9d5ca] bg-white/70 text-[#56544f] hover:bg-white hover:text-[#171717]"
                    >
                      <LogIn size={14} />
                      登录
                    </Button>
                    <Button
                      onClick={() => navigate('/register')}
                      variant="outline"
                      className="h-9 border-[#d9d5ca] bg-white/70 text-[#56544f] hover:bg-white hover:text-[#171717]"
                    >
                      <KeyRound size={14} />
                      邀请码注册
                    </Button>
                  </>
                )}
                {isAdmin && (
                  <Button onClick={() => navigate('/admin')} className="h-9 bg-[#161616] text-white hover:bg-black">
                    管理后台
                  </Button>
                )}
              </div>
            </motion.div>

            {!isLoggedIn && (
              <motion.aside
                initial={{ opacity: 0, y: 22, rotate: -1 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.65, delay: 0.08 }}
                className="relative min-w-0 overflow-hidden rounded-lg border border-[#e3dfd5] bg-white/86 p-5 shadow-[0_28px_70px_rgba(20,20,20,0.08)]"
              >
                <motion.div
                  className="absolute left-8 top-6 h-20 w-20 rounded-full border border-[#dedad0]"
                  animate={{ y: [0, 10, 0], opacity: [0.45, 0.7, 0.45] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute -right-8 top-10 h-28 w-28 rounded-full border border-[#e5e1d7]"
                  animate={{ y: [0, -8, 0], x: [0, -5, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-[#aaa69c]">Lumitime</p>
                      <h2 className="mt-2 text-lg font-medium text-[#171717]">公开入口</h2>
                    </div>
                    <motion.span
                      animate={{ rotate: [0, 12, -8, 0], scale: [1, 1.08, 1] }}
                      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Sparkles size={18} className="text-[#9b978d]" />
                    </motion.span>
                  </div>

                  <div className="mb-6 space-y-3 border-l border-[#dcd8ce] pl-4">
                    <p className="max-w-[18rem] text-sm leading-7 text-[#56544f] sm:max-w-none">
                      先看看站点状态与公开随记。受邀内容登录后展开，工具入口保持清晰。
                    </p>
                    <p className="font-mono text-xs text-[#aaa69c]">public board · quiet notes · invited archive</p>
                  </div>

                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <AccessRow icon={<Monitor size={14} />} label="第一入口" value="大屏看板" open />
                    <AccessRow icon={<ShieldCheck size={14} />} label="公开内容" value="随记" open />
                    <AccessRow icon={<LockKeyhole size={14} />} label="受邀内容" value="作品 / 心得 / 脚本" open={false} />
                  </div>
                </div>
              </motion.aside>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
          <SectionTitle
            label="Public"
            title="公开入口"
            desc="访客可访问。这里保留轻量表达和站点聚合状态，不展示用户明细或敏感内容。"
          />
          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
            {publicModules.map((mod, i) => (
              <ModuleCard key={mod.title} {...mod} index={i} isLoggedIn={isLoggedIn} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
          <SectionTitle
            label="Archive"
            title="内容沉淀与受邀工具"
            desc={isLoggedIn ? '内容与工具已解锁，可以进入详情或工作站继续操作。' : '受邀内容保持可见但锁定，登录或使用邀请码注册后进入。'}
          />
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {invitedModules.map((mod, i) => (
              <ModuleCard key={mod.title} {...mod} index={i} isLoggedIn={isLoggedIn} />
            ))}
          </div>
        </section>

        <footer className="border-t border-[#e8e5dc] py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 sm:px-6 md:flex-row">
            <span className="text-sm text-[#77736a]" style={{ fontFamily: "'Ma Shan Zheng', serif" }}>
              拾光筑梦 Lumitime
            </span>
            <p className="text-xs text-[#aaa69c]">每一束微光，都在铺就你的路。</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function SectionTitle({ label, title, desc }: { label: string; title: string; desc: string }) {
  return (
    <div className="border-b border-[#dedad0] pb-5">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[#9b978d]">{label}</p>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h2 className="text-2xl font-medium tracking-[-0.01em] text-[#171717]">{title}</h2>
        <p className="max-w-xl text-sm leading-6 text-[#6f6d67]">{desc}</p>
      </div>
    </div>
  );
}

function AccessRow({
  icon,
  label,
  value,
  open,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  open: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[#ece8de] bg-[#fbfaf7] px-3 py-3">
      <span className={open ? 'text-[#171717]' : 'text-[#bbb6aa]'}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#aaa69c]">{label}</p>
        <p className="truncate text-sm text-[#56544f]">{value}</p>
      </div>
      <span className={open ? 'text-xs text-[#56544f]' : 'text-xs text-[#aaa69c]'}>
        {open ? '可访问' : '锁定'}
      </span>
    </div>
  );
}
