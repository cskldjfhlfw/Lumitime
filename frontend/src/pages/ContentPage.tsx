import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  FileArchive,
  ImageIcon,
  Loader2,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { MainNav } from '../layouts/MainNav';
import AnimatedList from '../shared/components/AnimatedList';
import { Pager } from '../shared/components/Pager';
import { Badge } from '../shared/ui/badge';
import { Button } from '../shared/ui/button';
import { useAuth } from '../app/providers/AuthProvider';
import { ApiClientError, attachmentDownloadUrl, listContentApi, type BackendContent, type ContentKind } from '../shared/api/lumitimeApi';

interface ContentPageProps {
  kind: ContentKind;
}

const pageConfig = {
  scripts: {
    title: '脚本分享',
    subtitle: '可复制的自动化脚本与使用说明',
    icon: Code2,
    eyebrow: 'Scripts',
  },
  works: {
    title: '个人作品',
    subtitle: '项目、软著、论文与创作成果',
    icon: ImageIcon,
    eyebrow: 'Works',
  },
  blogs: {
    title: '经验心得',
    subtitle: '技术复盘、方法沉淀与成长记录',
    icon: BookOpen,
    eyebrow: 'Notes',
  },
};

const contentLabels: Record<ContentKind, { title: string; route: string }> = {
  scripts: { title: '脚本分享', route: '/scripts' },
  works: { title: '个人作品', route: '/works' },
  blogs: { title: '经验心得', route: '/blogs' },
};

const CONTENT_PAGE_SIZE = 12;

export function ContentPage({ kind }: ContentPageProps) {
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, logout, user } = useAuth();
  const config = pageConfig[kind];
  const Icon = config.icon;
  const route = contentLabels[kind].route;
  const [items, setItems] = useState<BackendContent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const copyScript = (value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    toast.success('代码已复制');
  };

  const loadItems = () => {
    setLoading(true);
    setError('');
    listContentApi(kind, { page, page_size: CONTENT_PAGE_SIZE })
      .then(payload => {
        setItems(payload.data.items);
        setTotal(payload.data.total);
      })
      .catch(error => {
        setItems([]);
        setTotal(0);
        setError(error instanceof ApiClientError ? error.message : '内容加载失败。');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, [kind, page]);

  useEffect(() => {
    setPage(1);
  }, [kind]);

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      <MainNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} userLabel={user?.displayName} onLogout={logout} />

      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="sticky top-16 z-20 mb-8 border-b border-black/10 bg-[#f8f8f7]/92 pb-7 pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#111111]/92"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="mb-3 text-xs uppercase tracking-widest text-gray-400 dark:text-white/40">{config.eyebrow}</p>
              <h1 className="text-3xl font-medium text-gray-950 dark:text-white">{config.title}</h1>
              <p className="mt-2 text-xs text-gray-400 dark:text-white/42">共 {total} 条内容</p>
            </div>
            <div className="hidden h-11 w-11 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-[#171717] sm:flex">
              <Icon size={19} />
            </div>
          </div>
        </motion.header>

        {loading && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-100 bg-white py-16 text-sm text-gray-400">
            <Loader2 size={15} className="animate-spin" />
            正在读取内容
          </div>
        )}
        {!loading && error && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-5">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={loadItems} className="mt-4 border-red-100 bg-white text-red-600">
              <RefreshCw size={13} />
              重试
            </Button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
            暂无已发布内容
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <>
            <AnimatedList
              items={items}
              keyForItem={item => item.id}
              showGradients
              enableArrowNavigation
              displayScrollbar
              renderItem={item => (
                <article className="rounded-lg border border-gray-100 bg-white p-5 transition-colors hover:border-gray-200 dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-white/18">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="outline" className="border-gray-200 text-gray-500 dark:border-white/12 dark:text-white/52">{item.tag}</Badge>
                    {kind === 'works' && (
                      item.attachments?.some(attachment => attachment.can_download) ? (
                        <Download size={15} className="text-gray-400" />
                      ) : (
                        <LockKeyhole size={15} className="text-gray-300" />
                      )
                    )}
                    {kind === 'blogs' && (
                      <span className="text-xs text-gray-400 dark:text-white/40">{formatReadTime(item.body)}</span>
                    )}
                  </div>

                  <button onClick={() => navigate(`${route}/${item.id}`)} className="block max-w-full text-left">
                    <h2 className="break-words text-base font-medium text-gray-950 transition-colors hover:text-gray-600 dark:text-white dark:hover:text-white/72">{item.title}</h2>
                  </button>
                  <p className="mt-2 text-sm leading-7 text-gray-500 dark:text-white/62">{item.desc}</p>
                  {!!item.tags?.length && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="rounded-full bg-gray-50 px-2 py-1 text-[11px] text-gray-400 dark:bg-white/8 dark:text-white/42">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {kind === 'scripts' && (
                    <div className="mt-5 rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-black/18">
                      <code className="block truncate text-xs text-gray-600 dark:text-white/56">{item.code}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyScript(item.code || '')}
                        disabled={!item.allow_copy}
                        className="mt-2 h-7 px-0 text-xs text-gray-500 hover:bg-transparent hover:text-black disabled:text-gray-300 dark:text-white/48 dark:hover:text-white"
                      >
                        <Copy size={12} />
                        {item.allow_copy ? '复制代码' : '暂不可复制'}
                      </Button>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {kind === 'works' && (
                      <Button
                        variant={item.attachments?.some(attachment => attachment.can_download) ? 'default' : 'outline'}
                        size="sm"
                        disabled={!item.attachments?.some(attachment => attachment.can_download)}
                        onClick={() => {
                          const attachment = item.attachments?.find(attachment => attachment.can_download);
                          if (attachment) window.open(attachmentDownloadUrl(item.id, attachment.id), '_blank');
                        }}
                        className={item.attachments?.some(attachment => attachment.can_download) ? 'bg-black text-white hover:bg-black/85' : 'border-gray-200 text-gray-400'}
                      >
                        {item.attachments?.some(attachment => attachment.can_download) ? <FileArchive size={13} /> : <LockKeyhole size={13} />}
                        {item.attachments?.some(attachment => attachment.can_download) ? `可下载 ${item.attachments.filter(attachment => attachment.can_download).length} 个附件` : '附件未开放'}
                      </Button>
                    )}
                    <Button onClick={() => navigate(`${route}/${item.id}`)} variant="ghost" size="sm" className="justify-start px-0 text-gray-500 hover:bg-transparent hover:text-black dark:text-white/48 dark:hover:text-white">
                      {kind === 'blogs' ? <Check size={13} /> : null}
                      {kind === 'blogs' ? '查看正文' : '查看详情'}
                    </Button>
                  </div>
                </article>
              )}
            />
            <Pager page={page} pageSize={CONTENT_PAGE_SIZE} total={total} loading={loading} onPageChange={setPage} className="mt-7" />
          </>
        )}
      </main>
    </div>
  );
}

function formatReadTime(body?: string | null) {
  const chars = body?.length || 0;
  return `${Math.max(1, Math.ceil(chars / 450))} min`;
}
