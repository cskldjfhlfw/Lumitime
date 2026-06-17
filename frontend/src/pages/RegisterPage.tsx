import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { useAuth } from '../app/providers/AuthProvider';

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, isAdmin, registerWithInvite } = useAuth();
  const [inviteCode, setInviteCode] = useState(() => (location.state as { inviteCode?: string } | null)?.inviteCode || '');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => (
    inviteCode.trim().length >= 6 &&
    username.trim().length >= 3 &&
    displayName.trim().length > 0 &&
    password.length >= 6 &&
    password === confirmPassword &&
    status === 'idle'
  ), [confirmPassword, displayName, inviteCode, password, status, username]);

  useEffect(() => {
    if (!isLoggedIn || status !== 'idle') return;
    navigate(isAdmin ? '/admin' : '/', { replace: true });
  }, [isAdmin, isLoggedIn, navigate, status]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(password !== confirmPassword ? '两次输入的密码不一致。' : '请完整填写注册信息。');
      return;
    }

    setError('');
    setStatus('loading');
    try {
      const result = await registerWithInvite({
        inviteCode: inviteCode.trim(),
        username: username.trim(),
        displayName: displayName.trim(),
        password,
      });
      setPassword('');
      setConfirmPassword('');
      if (!result.backend && result.message) {
        toast.info(`${result.message} 已保持前端演示登录态。`);
      }
      setStatus('done');
      await new Promise(r => setTimeout(r, 400));
      navigate('/', { replace: true });
    } catch (error) {
      setStatus('idle');
      setError(error instanceof Error ? error.message : '注册失败，请稍后再试。');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void handleSubmit();
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white lg:grid lg:grid-cols-[minmax(280px,1fr)_minmax(520px,2fr)]">
      <section className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_12%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(180deg,#080808,#111)]" />
        <div className="absolute left-1/2 top-0 h-full w-72 -translate-x-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_164deg,rgba(255,255,255,0.08)_173deg,rgba(255,255,255,0.2)_180deg,rgba(255,255,255,0.08)_187deg,transparent_196deg)]" />
        <div className="relative z-10 flex h-full flex-col justify-end p-8">
          <div className="mb-10 h-px w-28 bg-white/40" />
          <p className="max-w-xs text-sm leading-7 text-white/52">
            邀请码只负责打开门。进入之后，每一次脚本、作品、随记和服务提交都会回到自己的时间线上。
          </p>
        </div>
      </section>

      <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10 text-black">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md"
        >
          <button
            onClick={() => navigate('/')}
            className="mb-8 flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-black"
          >
            <ArrowLeft size={13} />
            返回主页
          </button>

          <div className="mb-8">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-black text-white">
              <KeyRound size={18} />
            </div>
            <h1 className="text-2xl font-medium text-gray-950">邀请码注册</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              注册后默认成为受邀用户，可访问脚本、作品、经验心得和工作站。
            </p>
          </div>

          <div className="space-y-4">
            <Field label="邀请码">
              <Input value={inviteCode} onChange={e => setInviteCode(e.target.value)} onKeyDown={handleKeyDown} placeholder="请输入邀请码" className="border-gray-200 focus-visible:ring-black" />
            </Field>
            <Field label="用户名">
              <Input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={handleKeyDown} placeholder="用于登录的 Lumitime 账号" className="border-gray-200 focus-visible:ring-black" autoComplete="username" />
            </Field>
            <Field label="显示名">
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} onKeyDown={handleKeyDown} placeholder="显示在个人中心的名称" className="border-gray-200 focus-visible:ring-black" autoComplete="name" />
            </Field>
            <Field label="密码">
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="至少 6 位" className="border-gray-200 focus-visible:ring-black" autoComplete="new-password" />
            </Field>
            <Field label="确认密码">
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="再次输入密码" className="border-gray-200 focus-visible:ring-black" autoComplete="new-password" />
            </Field>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <Button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="w-full bg-black text-white hover:bg-black/85 disabled:opacity-40"
            >
              {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {status === 'loading' ? '注册中…' : '完成注册'}
            </Button>

            <Button variant="ghost" onClick={() => navigate('/login')} className="w-full text-gray-500 hover:bg-gray-50 hover:text-black">
              <LogIn size={14} />
              已有账号，返回登录
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}
