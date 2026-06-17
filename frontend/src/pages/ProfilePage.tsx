import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, KeyRound, Loader2, ShieldCheck, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MainNav } from '../layouts/MainNav';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import type { SubmitRecord } from '../mocks/mockRecords';
import { useAuth } from '../app/providers/AuthProvider';
import { ApiClientError, changePasswordApi, mapBackendRequest, myServiceRequestsApi } from '../shared/api/lumitimeApi';

export function ProfilePage() {
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, logout, user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<SubmitRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    setRecordsLoading(true);
    myServiceRequestsApi({ page: 1, page_size: 3 })
      .then(payload => setRecords(payload.data.items.map(item => mapBackendRequest(item, payload.request_id))))
      .catch(() => setRecords([]))
      .finally(() => setRecordsLoading(false));
  }, []);

  const savePassword = async () => {
    if (!oldPassword || newPassword.length < 6 || newPassword !== confirmPassword) {
      toast.error('请确认旧密码与新密码信息。');
      return;
    }
    setSaving(true);
    try {
      await changePasswordApi({ old_password: oldPassword, new_password: newPassword });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('站点密码已更新');
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : '密码更新失败。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <button
          onClick={() => navigate('/')}
          className="mb-8 flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-700"
        >
          <ArrowLeft size={13} />
          返回主页
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-5 lg:grid-cols-[320px_1fr]"
        >
          <section className="rounded-lg border border-gray-100 bg-white p-5">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-black text-white">
              <UserCircle size={22} />
            </div>
            <p className="text-xs uppercase tracking-widest text-gray-400">Profile</p>
            <h1 className="mt-2 text-2xl font-medium text-gray-950">{user?.displayName || 'Lumitime 用户'}</h1>
            <div className="mt-6 space-y-3 border-t border-gray-100 pt-5">
              <InfoRow label="账号" value={user?.username || '-'} />
              <InfoRow label="角色" value={isAdmin ? '管理员' : '邀请用户'} />
              <InfoRow label="登录状态" value="已登录" />
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-lg border border-gray-100 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <KeyRound size={16} className="text-gray-500" />
                <h2 className="text-sm font-medium text-gray-900">修改 Lumitime 站点密码</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input type="password" placeholder="旧密码" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="border-gray-200 focus-visible:ring-black" />
                <Input type="password" placeholder="新密码" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="border-gray-200 focus-visible:ring-black" />
                <Input type="password" placeholder="确认新密码" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="border-gray-200 focus-visible:ring-black" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">这里只修改 Lumitime 站点账号，不涉及学生学习 App 凭证。</p>
                <Button size="sm" onClick={savePassword} disabled={saving} className="bg-black text-white hover:bg-black/85">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  保存
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck size={16} className="text-gray-500" />
                <h2 className="text-sm font-medium text-gray-900">最近服务提交</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {recordsLoading && (
                  <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    正在读取最近提交
                  </div>
                )}
                {!recordsLoading && records.length === 0 && (
                  <div className="py-6 text-sm text-gray-400">暂无真实提交记录</div>
                )}
                {!recordsLoading && records.map(record => (
                  <div key={record.id} className="flex items-center gap-3 py-3">
                    <span className="text-xs text-gray-400">{record.submittedAt.split(' ')[0]}</span>
                    <span className="flex-1 truncate text-sm text-gray-700">{record.resultSummary}</span>
                    <span className="font-mono text-xs text-gray-400">{record.serviceRequestId}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}
