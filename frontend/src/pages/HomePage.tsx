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
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { MainNav } from '../layouts/MainNav';
import { ModuleCard } from '../features/home/components/ModuleCard';
import { Button } from '../shared/ui/button';
import { LightBeam } from '../features/auth/components/LightBeam';
import { FallingFigure } from '../features/auth/components/FallingFigure';
import { useAuth } from '../app/providers/AuthProvider';

const publicModules = [
  {
    icon: <Pencil size={18} />,
    title: '随记',
    description: '公开留言与片段记录，访客也能留下时间里的微光。',
    route: '/notes',
    locked: false,
  },
  {
    icon: <Monitor size={18} />,
    title: '大屏看板',
    description: '只展示聚合指标，不触碰用户明细、账号或服务日志。',
    route: '/dashboard',
    locked: false,
  },
];

const invitedModules = [
  {
    icon: <Code2 size={18} />,
    title: '脚本分享',
    description: '自动化脚本合集，包含复制代码、使用说明和注意事项。',
    route: '/scripts',
    locked: true,
  },
  {
    icon: <Image size={18} />,
    title: '个人作品',
    description: '项目、设计、方案和创作成果，附件下载按作品配置。',
    route: '/works',
    locked: true,
  },
  {
    icon: <BookOpen size={18} />,
    title: '经验心得',
    description: '技术复盘、方法沉淀与成长记录，留给受邀成员细读。',
    route: '/blogs',
    locked: true,
  },
  {
    icon: <LayoutDashboard size={18} />,
    title: '工作站',
    description: '自动化服务集合，发起任务、查看结果、追溯 service_request_id。',
    route: '/workstation',
    locked: true,
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main>
        <section className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-[#080808] text-white">
          <div className="absolute inset-0 opacity-80">
            <LightBeam intensified={isLoggedIn} />
            <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_68%_18%,rgba(255,255,255,0.16),transparent_26%),linear-gradient(90deg,rgba(8,8,8,0.98),rgba(8,8,8,0.72)_48%,rgba(8,8,8,0.96))]" />
          </div>

          <div className="absolute bottom-12 right-[12%] hidden opacity-70 lg:block">
            <FallingFigure flipped={isLoggedIn} />
          </div>

          <div className="relative z-10 mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div className="mb-8 flex items-center gap-3">
                <span className="h-px w-12 bg-white/45" />
                <span className="text-xs uppercase tracking-widest text-white/45">Personal Workstation</span>
              </div>

              <h1
                className="max-w-3xl text-6xl leading-tight text-white md:text-7xl"
                style={{ fontFamily: "'Ma Shan Zheng', serif", fontWeight: 400 }}
              >
                拾光筑梦
                <span className="mt-2 block text-3xl text-white/42 md:text-4xl" style={{ fontFamily: 'serif' }}>
                  Lumitime
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-8 text-white/62">
                Every faint light of time, paves the way for your dream.
              </p>
              <p className="mt-5 max-w-2xl text-sm leading-8 text-white/52">
                这里不是门户，也不是社区。它先让访客看见公开的随记与聚合数据，再让受邀成员进入脚本、作品、经验心得和自动化工作站。
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button onClick={() => navigate('/notes')} className="bg-white text-black hover:bg-white/88">
                  进入随记
                  <ArrowRight size={14} />
                </Button>
                <Button onClick={() => navigate('/dashboard')} variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  查看大屏
                </Button>
                {isLoggedIn ? (
                  <Button onClick={() => navigate('/workstation')} variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    进入工作站
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => navigate('/login')} variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                      <LogIn size={14} />
                      登录
                    </Button>
                    <Button onClick={() => navigate('/register')} variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                      <KeyRound size={14} />
                      邀请码注册
                    </Button>
                  </>
                )}
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12 }}
              className="border border-white/12 bg-white/[0.06] p-5 backdrop-blur-md"
            >
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-sm text-white/80">当前访问身份</span>
                <span className="text-xs text-white/38">{isAdmin ? '管理员' : isLoggedIn ? '受邀用户' : '访客'}</span>
              </div>
              <div className="space-y-3">
                <AccessRow icon={<ShieldCheck size={14} />} label="公开入口" value="随记 / 大屏看板" open />
                <AccessRow icon={<LockKeyhole size={14} />} label="邀请入口" value="脚本 / 作品 / 博客 / 工作站" open={isLoggedIn} />
                <AccessRow icon={<LayoutDashboard size={14} />} label="后台入口" value="仅管理员" open={!!isAdmin} />
              </div>
              {isAdmin && (
                <Button onClick={() => navigate('/admin')} className="mt-5 w-full bg-white text-black hover:bg-white/88">
                  管理后台
                </Button>
              )}
            </motion.aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionTitle eyebrow="Public" title="公开入口" desc="访客可访问，不展示用户明细或敏感内容。" />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {publicModules.map((mod, i) => (
              <ModuleCard key={mod.title} {...mod} index={i} isLoggedIn={isLoggedIn} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <SectionTitle
            eyebrow="Invited"
            title="受邀成员入口"
            desc={isLoggedIn ? '内容与工具已解锁，可以进入详情或工作站继续操作。' : '以下模块仅对受邀账号开放，访客可先了解范围，再登录或注册。'}
          />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {invitedModules.map((mod, i) => (
              <ModuleCard key={mod.title} {...mod} index={i} isLoggedIn={isLoggedIn} />
            ))}
          </div>
        </section>

        <footer className="border-t border-gray-100 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 md:flex-row">
            <span className="text-sm text-gray-400" style={{ fontFamily: "'Ma Shan Zheng', serif" }}>
              拾光筑梦 Lumitime
            </span>
            <p className="text-xs text-gray-300">每一束微光，都在铺就你的路。</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div>
      <p className="mb-3 text-xs uppercase tracking-widest text-gray-400">{eyebrow}</p>
      <div className="flex flex-col gap-3 border-b border-black/10 pb-5 md:flex-row md:items-end md:justify-between">
        <h2 className="text-2xl font-medium text-gray-950">{title}</h2>
        <p className="max-w-xl text-sm leading-6 text-gray-500">{desc}</p>
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
    <div className="flex items-center gap-3 bg-white/[0.05] px-3 py-3">
      <span className={open ? 'text-white' : 'text-white/25'}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/35">{label}</p>
        <p className="truncate text-sm text-white/76">{value}</p>
      </div>
      <span className={open ? 'text-xs text-white/72' : 'text-xs text-white/28'}>
        {open ? '可访问' : '锁定'}
      </span>
    </div>
  );
}
