import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ArrowRight, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { LightBeam } from '../features/auth/components/LightBeam';
import { FallingFigure } from '../features/auth/components/FallingFigure';
import { InteractiveCat } from '../features/auth/components/InteractiveCat';
import { useAuth } from '../app/providers/AuthProvider';
import LightRays from '../shared/components/LightRays';

type LoginState = 'idle' | 'loading' | 'flipping' | 'done';

const ENABLE_LOGIN_LIGHT_RAYS = false;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, isAdmin, loginWithPassword } = useAuth();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loginState, setLoginState] = useState<LoginState>('idle');
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const canSubmit = account.trim().length > 0 && password.trim().length > 0 && loginState === 'idle';

  useEffect(() => {
    if (!isLoggedIn || loginState !== 'idle') return;
    navigate(isAdmin ? '/admin' : '/', { replace: true });
  }, [isAdmin, isLoggedIn, loginState, navigate]);

  const goToRegister = () => {
    navigate('/register', inviteCode.trim() ? { state: { inviteCode: inviteCode.trim() } } : undefined);
  };

  const handleLogin = async () => {
    if (!canSubmit) return;
    const username = account.trim();
    const currentPassword = password;
    setError('');
    setLoginState('loading');
    setPassword('');

    try {
      const result = await loginWithPassword(username, currentPassword);
      if (!result.backend && result.message) {
        toast.info(`${result.message} 服务请求页会继续尝试真实 API。`);
      }
      setLoginState('flipping');
      await new Promise(r => setTimeout(r, 650));
      setLoginState('done');
      await new Promise(r => setTimeout(r, 250));
      const from = (location.state as { from?: string } | null)?.from;
      navigate(result.redirectTo === '/admin' ? '/admin' : (from || result.redirectTo || '/'), { replace: true });
    } catch (error) {
      setLoginState('idle');
      setError(error instanceof Error ? error.message : '登录失败，请重试。');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void handleLogin();
  };

  const isFlipping = loginState === 'flipping' || loginState === 'done';
  const isLoading = loginState === 'loading';

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#080808] lg:flex">
      <div className="relative h-56 overflow-hidden bg-[#080808] lg:h-screen lg:w-1/3 lg:min-w-[260px] lg:flex-shrink-0">
        <LightBeam intensified={isFlipping} />
        <FallingFigure flipped={isFlipping} />
        <InteractiveCat />

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#080808] to-transparent" />
        <div className="absolute bottom-4 left-4 select-none text-[10px] uppercase tracking-widest text-white/20">
          Lumitime
        </div>
      </div>

      <div className="hidden w-px flex-shrink-0 bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />

      <motion.div
        className="relative flex min-h-[calc(100vh-14rem)] flex-1 flex-col justify-center overflow-hidden bg-[var(--lumitime-bg)] px-6 py-10 md:px-20 lg:min-h-screen"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {ENABLE_LOGIN_LIGHT_RAYS && (
          <div className="pointer-events-none absolute inset-0">
            <LightRays
              raysOrigin="top-center"
              raysColor="#fff7dc"
              raysSpeed={0.74}
              lightSpread={0.48}
              rayLength={2.4}
              followMouse
              mouseInfluence={0.07}
              noiseAmount={0.02}
              distortion={0.03}
              className="opacity-75"
              pulsating={false}
              fadeDistance={0.88}
              saturation={1.02}
            />
          </div>
        )}
        <div className="relative z-10 mx-auto w-full max-w-sm">
          <div className="mb-10">
            <h1
              className="mb-2 text-4xl tracking-wide text-black"
              style={{ fontFamily: "'Ma Shan Zheng', serif", fontWeight: 400 }}
            >
              拾光筑梦
              <span
                className="ml-3 text-2xl text-gray-400"
                style={{ fontFamily: 'serif', fontWeight: 300 }}
              >
                Lumitime
              </span>
            </h1>
            <p className="text-sm text-gray-400" style={{ fontWeight: 300 }}>
              Every faint light of time, paves the way for your dream.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs text-gray-500">Lumitime 站点账号</label>
              <Input
                type="text"
                placeholder="请输入账号"
                value={account}
                onChange={e => setAccount(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loginState !== 'idle'}
                className="border-gray-200 focus-visible:border-black focus-visible:ring-black"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-gray-500">站点密码</label>
              <Input
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loginState !== 'idle'}
                className="border-gray-200 focus-visible:border-black focus-visible:ring-black"
                autoComplete="current-password"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="py-1 text-xs text-red-500"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              onClick={() => void handleLogin()}
              disabled={!canSubmit}
              className="mt-1 w-full gap-2 bg-black text-white hover:bg-black/85 disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  验证中…
                </>
              ) : (
                <>
                  登录
                  <ArrowRight size={14} />
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <button
              onClick={() => setShowInvite(v => !v)}
              className="text-xs text-gray-400 underline underline-offset-2 transition-colors hover:text-gray-600"
            >
              {showInvite ? '收起邀请码注册' : '我有邀请码'}
            </button>

            <AnimatePresence>
              {showInvite && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pt-3">
                    <Input
                      placeholder="输入邀请码后去注册"
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value)}
                      onKeyDown={event => event.key === 'Enter' && goToRegister()}
                      className="border-gray-200 text-sm focus-visible:ring-black"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-black text-black hover:bg-gray-50"
                      onClick={goToRegister}
                    >
                      <KeyRound size={13} />
                      前往注册
                    </Button>
                    <p className="text-xs leading-5 text-gray-400">
                      邀请码会带到注册页预填，注册完成后自动使用真实后端登录。
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => navigate('/')}
            className="mt-3 block w-full text-center text-xs text-gray-300 transition-colors hover:text-gray-500"
          >
            先返回公开主页
          </button>
        </div>
      </motion.div>
    </div>
  );
}
