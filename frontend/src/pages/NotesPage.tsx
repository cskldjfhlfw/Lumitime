import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, RefreshCw, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { MainNav } from '../layouts/MainNav';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Textarea } from '../shared/ui/textarea';
import { useAuth } from '../app/providers/AuthProvider';
import { ApiClientError, createMessageApi, listMessagesApi, type BackendMessage } from '../shared/api/lumitimeApi';

export function NotesPage() {
  const { isLoggedIn, isAdmin, logout, user } = useAuth();
  const [notes, setNotes] = useState<BackendMessage[]>([]);
  const [nickname, setNickname] = useState(user?.displayName || '');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => nickname.trim().length > 0 && content.trim().length >= 2, [content, nickname]);

  const loadMessages = () => {
    setLoading(true);
    setError('');
    listMessagesApi({ page: 1, page_size: 50 })
      .then(payload => setNotes(payload.data.items))
      .catch(error => {
        setNotes([]);
        setError(error instanceof ApiClientError ? error.message : '留言加载失败，请稍后重试。');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createMessageApi({ nickname: nickname.trim(), content: content.trim() });
      setContent('');
      toast.success('留言已公开');
      loadMessages();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : '留言提交失败。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-black/10 pb-6">
            <div>
              <p className="mb-3 text-xs uppercase tracking-widest text-gray-400">Public Notes</p>
              <h1 className="text-3xl font-medium text-gray-950">随记 / 留言板</h1>
              <p className="mt-2 text-xs text-gray-400">GET /api/v1/messages · 访客公开可见</p>
            </div>
            <div className="hidden h-10 w-px bg-black/20 sm:block" />
          </div>

          <div className="space-y-3">
            {loading && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-100 bg-white py-12 text-sm text-gray-400">
                <Loader2 size={15} className="animate-spin" />
                正在读取留言
              </div>
            )}
            {!loading && error && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-5">
                <p className="text-sm text-red-700">{error}</p>
                <Button variant="outline" size="sm" onClick={loadMessages} className="mt-4 border-red-100 bg-white text-red-600">
                  <RefreshCw size={13} />
                  重试
                </Button>
              </div>
            )}
            {!loading && !error && notes.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
                暂无公开留言
              </div>
            )}
            {!loading && !error && notes.map((note, index) => (
              <motion.article
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
                className="rounded-lg border border-gray-100 bg-white p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-900">{note.nickname}</span>
                  <span className="text-xs text-gray-400">{note.createdAt || formatDate(note.created_at)}</span>
                </div>
                <p className="text-sm leading-7 text-gray-600">{note.content}</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-gray-500" />
              <h2 className="text-sm font-medium text-gray-900">写一条随记</h2>
            </div>
            <div className="mb-4 flex items-start gap-2 rounded-md bg-gray-50 p-3">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <p className="text-xs leading-5 text-gray-500">
                留言提交后立即公开。前端限制 180 字，后端还需要做频率限制、敏感内容和垃圾内容拦截。
              </p>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">昵称</span>
                <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="你的昵称" className="border-gray-200 focus-visible:ring-black" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-500">内容</span>
                <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="留下时间里的微光…" className="min-h-32 border-gray-200 bg-white focus-visible:ring-black" maxLength={180} />
              </label>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">{content.length}/180</span>
                <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="bg-black text-white hover:bg-black/85">
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {submitting ? '提交中' : '提交'}
                </Button>
              </div>
            </div>
            <p className="mt-4 font-mono text-[11px] text-gray-300">POST /api/v1/messages · RATE_LIMITED 时请稍后再试</p>
          </div>
        </aside>
      </main>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').replace(/\.\d+/, '').replace(/\+00:00|Z$/, '').slice(0, 16);
}
