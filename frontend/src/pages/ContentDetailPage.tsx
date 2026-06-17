import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import { MainNav } from '../layouts/MainNav';
import { Badge } from '../shared/ui/badge';
import { Button } from '../shared/ui/button';
import { useAuth } from '../app/providers/AuthProvider';
import {
  ApiClientError,
  attachmentDownloadUrl,
  contentDetailApi,
  type BackendContent,
  type ContentKind,
} from '../shared/api/lumitimeApi';

interface ContentDetailPageProps {
  kind: ContentKind;
}

const labels: Record<ContentKind, { title: string; route: string }> = {
  scripts: { title: '脚本分享', route: '/scripts' },
  works: { title: '个人作品', route: '/works' },
  blogs: { title: '经验心得', route: '/blogs' },
};

export function ContentDetailPage({ kind }: ContentDetailPageProps) {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, logout, user } = useAuth();
  const [item, setItem] = useState<BackendContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageLabel = labels[kind];

  const loadDetail = () => {
    if (!contentId) return;
    setLoading(true);
    setError('');
    contentDetailApi(kind, contentId)
      .then(payload => setItem(payload.data))
      .catch(error => {
        setItem(null);
        setError(error instanceof ApiClientError ? error.message : '内容加载失败。');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDetail();
  }, [contentId, kind]);

  if (loading || error || !item) {
    return (
      <div className="min-h-screen bg-[#f8f8f7]">
        <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />
        <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-gray-400 ring-1 ring-gray-100">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <ScrollText size={20} />}
          </div>
          <h1 className="text-xl font-medium text-gray-950">{loading ? '正在读取内容' : '内容不存在或暂未发布'}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">{error || '请稍后，正在从后端读取详情。'}</p>
          <div className="mt-6 flex gap-2">
            {error && (
              <Button variant="outline" onClick={loadDetail} className="border-gray-200">
                <RefreshCw size={13} />
                重试
              </Button>
            )}
            <Button onClick={() => navigate(pageLabel.route)} className="bg-black text-white hover:bg-black/85">
              返回{pageLabel.title}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <button
          onClick={() => navigate(pageLabel.route)}
          className="mb-8 flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-700"
        >
          <ArrowLeft size={13} />
          返回{pageLabel.title}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
        >
          <article className="rounded-lg border border-gray-100 bg-white p-6 md:p-8">
            <Badge variant="outline" className="mb-5 border-gray-200 text-gray-500">{item.tag || item.category || item.language || item.type}</Badge>
            <h1 className="max-w-3xl text-3xl font-medium leading-tight text-gray-950">{item.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-500">{item.desc || item.summary}</p>
            {!!item.tags?.length && (
              <div className="mt-5 flex flex-wrap gap-2">
                {item.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {kind === 'scripts' && <ScriptDetail item={item} />}
            {kind === 'works' && <WorkDetail item={item} isAdmin={isAdmin} />}
            {kind === 'blogs' && <BlogDetail item={item} />}
          </article>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-lg border border-gray-100 bg-white p-5">
              <p className="text-xs uppercase tracking-widest text-gray-400">Next</p>
              <h2 className="mt-2 text-sm font-medium text-gray-900">继续使用 Lumitime</h2>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                内容沉淀在这里，自动化服务放在工作站里。需要提交任务时，可以直接进入工作站。
              </p>
              <Button onClick={() => navigate('/workstation')} className="mt-4 w-full bg-black text-white hover:bg-black/85">
                <LayoutDashboard size={14} />
                进入工作站
              </Button>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white p-5">
              <p className="text-xs text-gray-400">更新日期</p>
              <p className="mt-1 text-sm text-gray-800">{item.updatedAt || item.updated_at?.slice(0, 10) || '-'}</p>
              <p className="mt-2 font-mono text-[11px] text-gray-300">{item.updated_at}</p>
            </div>
          </aside>
        </motion.div>
      </main>
    </div>
  );
}

function ScriptDetail({ item }: { item: BackendContent }) {
  const copyScript = () => {
    if (!item.allow_copy || !item.code) return;
    navigator.clipboard.writeText(item.code).catch(() => {});
    toast.success('代码已复制');
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-3 rounded-md border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
        <MetaBlock label="language" value={item.language || '-'} />
        <MetaBlock label="allow_copy" value={item.allow_copy ? 'true' : 'false'} />
      </div>
      <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
        <code className="block whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">{item.code || '暂无代码内容'}</code>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyScript}
          disabled={!item.allow_copy || !item.code}
          className="mt-3 px-0 text-gray-500 hover:bg-transparent hover:text-black disabled:text-gray-300"
        >
          <Copy size={13} />
          {item.allow_copy ? '复制代码' : '暂不可复制'}
        </Button>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-medium text-gray-900">运行方式</h2>
        <p className="rounded-md bg-gray-50 px-3 py-3 text-sm leading-7 text-gray-600">{item.usage || item.body || '-'}</p>
      </div>
      <DetailList title="使用说明" items={item.notes || splitBody(item.body).slice(0, 6)} icon={<CheckCircle2 size={15} />} />
    </div>
  );
}

function WorkDetail({ item, isAdmin }: { item: BackendContent; isAdmin: boolean }) {
  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-3 rounded-md border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
        <MetaBlock label="category" value={item.category || '-'} />
        <MetaBlock label="attachments" value={`${item.attachments?.length || 0} 个`} />
      </div>
      <div className="space-y-4">
        {splitBody(item.body).map(paragraph => (
          <p key={paragraph} className="text-sm leading-8 text-gray-600">{paragraph}</p>
        ))}
      </div>
      <DetailList title="作品亮点" items={item.highlights || item.tags || []} icon={<FileArchive size={15} />} />
      <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-900">附件下载</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          下载权限由管理员按单个附件配置。未开放附件不会展示真实下载地址；管理员始终可下载。
        </p>
        <div className="mt-4 space-y-2">
          {(item.attachments || []).length === 0 && <p className="text-xs text-gray-400">暂无附件</p>}
          {(item.attachments || []).map(attachment => {
            const canDownload = attachment.can_download || isAdmin;
            return (
              <div key={attachment.id} className="flex flex-col gap-3 rounded-md border border-gray-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{attachment.filename}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{formatFileSize(attachment.file_size)} · {attachment.can_download ? '受邀用户可下载' : '仅管理员可下载'}</p>
                </div>
                <Button
                  size="sm"
                  disabled={!canDownload}
                  variant={canDownload ? 'default' : 'outline'}
                  onClick={() => window.open(attachmentDownloadUrl(item.id, attachment.id), '_blank')}
                  className={canDownload ? 'bg-black text-white hover:bg-black/85' : 'border-gray-200 text-gray-400'}
                >
                  {canDownload ? <Download size={14} /> : <LockKeyhole size={14} />}
                  {canDownload ? '下载' : '未开放'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlogDetail({ item }: { item: BackendContent }) {
  return (
    <div className="mt-8">
      <div className="mb-6 flex items-center gap-2 text-xs text-gray-400">
        <BookOpen size={14} />
        <span>{Math.max(1, Math.ceil((item.body?.length || 0) / 450))} min</span>
        <span>·</span>
        <span>{item.updatedAt || item.updated_at?.slice(0, 10)}</span>
      </div>
      <div className="space-y-5">
        {splitBody(item.body).map(paragraph => (
          <p key={paragraph} className="text-sm leading-8 text-gray-600">{paragraph}</p>
        ))}
      </div>
    </div>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] text-gray-300">{label}</p>
      <p className="mt-1 text-sm text-gray-700">{value}</p>
    </div>
  );
}

function DetailList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  if (!items.length) return null;
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-gray-900">{title}</h2>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item} className="flex items-start gap-2 rounded-md bg-gray-50 px-3 py-2">
            <span className="mt-0.5 text-gray-400">{icon}</span>
            <span className="text-sm leading-6 text-gray-600">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function splitBody(value?: string | null) {
  return (value || '').split(/\n+/).map(item => item.trim()).filter(Boolean);
}

function formatFileSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 1024 / 102.4) / 10} MB`;
}
