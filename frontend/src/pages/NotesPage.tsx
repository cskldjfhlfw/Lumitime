import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, LogIn, PenLine, RefreshCw, Send, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { MainNav } from '../layouts/MainNav';
import AnimatedList from '../shared/components/AnimatedList';
import { Pager } from '../shared/components/Pager';
import { Button } from '../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/dialog';
import { Input } from '../shared/ui/input';
import { Textarea } from '../shared/ui/textarea';
import { useAuth } from '../app/providers/AuthProvider';
import { ApiClientError, createMessageApi, listMessagesApi, type BackendMessage } from '../shared/api/lumitimeApi';

const NOTES_PAGE_SIZE = 10;

export function NotesPage() {
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, logout, user } = useAuth();
  const [notes, setNotes] = useState<BackendMessage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [nickname, setNickname] = useState(user?.displayName || '');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);

  const canSubmit = useMemo(() => isLoggedIn && nickname.trim().length > 0 && content.trim().length >= 2, [content, isLoggedIn, nickname]);

  useEffect(() => {
    if (user?.displayName && !nickname.trim()) {
      setNickname(user.displayName);
    }
  }, [nickname, user?.displayName]);

  const loadMessages = () => {
    setLoading(true);
    setError('');
    listMessagesApi({ page, page_size: NOTES_PAGE_SIZE })
      .then(payload => {
        setNotes(payload.data.items);
        setTotal(payload.data.total);
      })
      .catch(error => {
        setNotes([]);
        setTotal(0);
        setError(error instanceof ApiClientError ? error.message : '留言加载失败，请稍后重试。');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMessages();
  }, [page]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createMessageApi({ nickname: nickname.trim(), content: content.trim() });
      setContent('');
      setComposerOpen(false);
      setPage(1);
      toast.success('留言已公开');
      loadMessages();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : '留言提交失败。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f7] dark:bg-[#111111]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="sticky top-16 z-20 mb-8 flex flex-col gap-4 border-b border-black/10 bg-[#f8f8f7]/92 pb-6 pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#111111]/92 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 text-xs uppercase tracking-widest text-gray-400 dark:text-white/40">Public Notes</p>
              <h1 className="text-3xl font-medium text-gray-950 dark:text-white">随记 / 留言板</h1>
              <p className="mt-2 text-xs text-gray-400 dark:text-white/42">共 {total} 条公开随记</p>
            </div>
            {isLoggedIn ? (
              <Button onClick={() => setComposerOpen(true)} className="h-10 gap-2 bg-black text-white hover:bg-black/85 dark:bg-white dark:text-[#171717] dark:hover:bg-white/90">
                <PenLine size={14} />
                写一条随记
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => navigate('/login', { state: { from: '/notes' } })}
                className="h-10 gap-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/72 dark:hover:bg-white/10"
              >
                <LogIn size={14} />
                登录后写随记
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-3">
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
              <div className="rounded-lg border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/40">
                暂无公开留言
              </div>
            )}
            {!loading && !error && (
              <AnimatedList
                items={notes}
                keyForItem={note => note.id}
                showGradients
                enableArrowNavigation
                displayScrollbar
                renderItem={note => (
                  <article className="rounded-lg border border-gray-100 bg-white p-5 dark:border-white/10 dark:bg-white/[0.06]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{note.nickname}</span>
                      <span className="text-xs text-gray-400 dark:text-white/40">{note.createdAt || formatDate(note.created_at)}</span>
                    </div>
                    <p className="text-sm leading-7 text-gray-600 dark:text-white/62">{note.content}</p>
                  </article>
                )}
              />
            )}
          </div>
          {!loading && !error && (
            <Pager page={page} pageSize={NOTES_PAGE_SIZE} total={total} loading={loading} onPageChange={setPage} className="mt-7" />
          )}
        </motion.section>

        <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
          <DialogContent className="max-w-md border-gray-100 bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Sparkles size={16} className="text-gray-500" />
                写一条随记
              </DialogTitle>
            </DialogHeader>
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
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').replace(/\.\d+/, '').replace(/\+00:00|Z$/, '').slice(0, 16);
}
