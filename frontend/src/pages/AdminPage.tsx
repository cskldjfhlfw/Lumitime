import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Copy,
  Download,
  Edit2,
  Eye,
  FileDown,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  UserCheck,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminSidebar } from '../layouts/AdminSidebar';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Badge } from '../shared/ui/badge';
import { Checkbox } from '../shared/ui/checkbox';
import { Textarea } from '../shared/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../shared/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../shared/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../shared/ui/sheet';
import {
  ApiClientError,
  adminAuditLogDetailApi,
  adminContentDetailApi,
  adminCreateContentApi,
  adminCreateInviteApi,
  adminCreateServiceApi,
  adminDeleteContentApi,
  adminDeleteMessageApi,
  adminDeleteServiceApi,
  adminDisableInviteApi,
  adminDisableServiceApi,
  adminDisableUserApi,
  adminEnableServiceApi,
  adminEnableUserApi,
  adminExportUrl,
  adminHideMessageApi,
  adminInviteUsageApi,
  adminListAuditLogsApi,
  adminListContentsApi,
  adminListInvitesApi,
  adminListMessagesApi,
  adminListServiceRequestsApi,
  adminListServicesApi,
  adminListSnapshotsApi,
  adminListUsersApi,
  adminPatchAttachmentApi,
  adminPatchContentApi,
  adminPatchServiceApi,
  adminPublishContentApi,
  adminResetPasswordApi,
  adminRestoreMessageApi,
  adminServiceRequestDetailApi,
  adminServiceRequestLogsApi,
  adminUnpublishContentApi,
  adminUploadAttachmentApi,
  attachmentDownloadUrl,
  type BackendAdminService,
  type BackendAuditLog,
  type BackendContent,
  type BackendExecutionLog,
  type BackendInvite,
  type BackendInviteUsage,
  type BackendMessage,
  type BackendServiceRequest,
  type BackendUser,
  type ContentType,
  type DashboardSnapshot,
} from '../shared/api/lumitimeApi';

type ConfirmAction = {
  title: string;
  description: string;
  actionLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
};

type ContentStatus = 'all' | 'draft' | 'published' | 'unpublished';
type MessageStatusFilter = 'all' | 'visible' | 'hidden';
type EnabledStatusFilter = 'all' | 'enabled' | 'disabled';
type InviteStatusFilter = 'all' | 'active' | 'disabled' | 'expired';

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: '等待中', cls: 'bg-gray-100 text-gray-600' },
  running: { label: '执行中', cls: 'bg-blue-50 text-blue-600' },
  success: { label: '成功', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-600' },
  timeout: { label: '超时', cls: 'bg-amber-50 text-amber-600' },
  not_integrated: { label: '未接入', cls: 'bg-gray-100 text-gray-600' },
};

const contentTypeLabel: Record<ContentType, string> = {
  script: '脚本',
  work: '作品',
  blog: '博客',
};

const contentSectionType: Record<string, ContentType> = {
  scripts: 'script',
  works: 'work',
  blogs: 'blog',
};

export function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [activeSection, setActiveSection] = useState(() => routeToSection(location.pathname, params.section));
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setActiveSection(routeToSection(location.pathname, params.section));
  }, [location.pathname, params.section]);

  const handleSectionSelect = (section: string) => {
    setActiveSection(section);
    navigate(sectionToRoute(section));
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, '操作失败。'));
    } finally {
      setConfirming(false);
    }
  };

  const title = getSectionTitle(activeSection);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <AdminSidebar active={activeSection} onSelect={handleSectionSelect} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 items-center justify-between border-b border-gray-100 bg-white px-6">
          <div>
            <h1 className="text-sm font-medium text-gray-800">{title}</h1>
            <p className="text-xs text-gray-400">真实 API 对接 · 接口异常会显示错误态</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            credentials: include
          </div>
        </div>

        <main className="flex-1 overflow-auto p-6">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {activeSection === 'overview' && <OverviewSection />}
            {activeSection === 'invites' && <InvitesSection requestConfirm={setConfirm} />}
            {activeSection === 'users' && <UsersSection requestConfirm={setConfirm} />}
            {['scripts', 'works', 'blogs'].includes(activeSection) && (
              <ContentAdminSection type={contentSectionType[activeSection]} requestConfirm={setConfirm} />
            )}
            {activeSection === 'messages' && <MessagesSection requestConfirm={setConfirm} />}
            {activeSection === 'services' && <ServicesSection requestConfirm={setConfirm} />}
            {activeSection === 'records' && <ServiceRecordsSection />}
            {activeSection === 'audit' && <AuditSection />}
            {activeSection === 'metrics' && <MetricsSection />}
          </motion.div>
        </main>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={open => !open && !confirming && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>取消</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-black text-white hover:bg-gray-900'}
              disabled={confirming}
              onClick={event => {
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {confirming && <Loader2 size={13} className="mr-1 animate-spin" />}
              {confirm?.actionLabel || '确认'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OverviewSection() {
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [records, setRecords] = useState<BackendServiceRequest[]>([]);
  const [audits, setAudits] = useState<BackendAuditLog[]>([]);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [totals, setTotals] = useState({ users: 0, records: 0, audits: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([
      adminListUsersApi({ page: 1, page_size: 100 }),
      adminListServiceRequestsApi({ page: 1, page_size: 5 }),
      adminListAuditLogsApi({ page: 1, page_size: 5 }),
      adminListSnapshotsApi({ page: 1, page_size: 1 }),
    ])
      .then(([userPayload, recordPayload, auditPayload, snapshotPayload]) => {
        if (!alive) return;
        setUsers(userPayload.data.items);
        setRecords(recordPayload.data.items);
        setAudits(auditPayload.data.items);
        setSnapshot(snapshotPayload.data.items[0] || null);
        setTotals({
          users: userPayload.data.total,
          records: recordPayload.data.total,
          audits: auditPayload.data.total,
        });
      })
      .catch(error => {
        if (!alive) return;
        setError(apiErrorMessage(error, '后台总览加载失败。'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refresh]);

  const activeUsers = users.filter(user => user.status === 'active').length;

  if (loading) return <LoadingState text="正在读取后台总览…" />;
  if (error) return <ErrorState message={error} onRetry={() => setRefresh(v => v + 1)} />;

  return (
    <div className="space-y-5">
      <Toolbar>
        <p className="text-xs text-gray-400">总览只汇总后台接口返回的真实列表，不使用演示数据。</p>
        <Button variant="outline" size="sm" className="h-8 border-gray-200 text-xs" onClick={() => setRefresh(v => v + 1)}>
          <RefreshCw size={12} />
          刷新
        </Button>
      </Toolbar>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="用户总数" value={totals.users} detail={`本页启用 ${activeUsers} 个`} />
        <StatCard label="服务提交" value={totals.records} detail="管理员记录接口" />
        <StatCard label="审计事件" value={totals.audits} detail="脱敏摘要" />
        <StatCard label="最新访问数" value={snapshot?.visit_count || 0} detail={snapshot?.date || '暂无快照'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="最近服务提交">
          {records.length === 0 ? (
            <EmptyState text="暂无服务提交记录" />
          ) : (
            <div className="space-y-3">
              {records.map(record => (
                <div key={record.service_request_id} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{record.service_name}</p>
                    <p className="font-mono text-xs text-gray-400">{record.service_request_id}</p>
                  </div>
                  <RecordStatusBadge status={record.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="最近审计">
          {audits.length === 0 ? (
            <EmptyState text="暂无审计记录" />
          ) : (
            <div className="space-y-3">
              {audits.map(audit => (
                <div key={audit.id} className="rounded-md border border-gray-100 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-800">{audit.action}</p>
                    <span className={audit.result === 'success' ? 'text-xs text-emerald-600' : 'text-xs text-red-600'}>{audit.result}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-gray-400">{audit.resource_type}:{audit.resource_id || '-'}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function InvitesSection({ requestConfirm }: { requestConfirm: (action: ConfirmAction) => void }) {
  const [items, setItems] = useState<BackendInvite[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<InviteStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [usageInvite, setUsageInvite] = useState<BackendInvite | null>(null);
  const [usage, setUsage] = useState<BackendInviteUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [form, setForm] = useState({ usage_limit: '1', expires_at: '', remark: '' });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    adminListInvitesApi({ keyword, status, page: 1, page_size: 100 })
      .then(payload => {
        if (alive) setItems(payload.data.items);
      })
      .catch(error => {
        if (alive) setError(apiErrorMessage(error, '邀请码列表加载失败。'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [keyword, refresh, status]);

  const createInvite = async () => {
    setCreating(true);
    try {
      await adminCreateInviteApi({
        usage_limit: Number(form.usage_limit || 1),
        expires_at: form.expires_at || null,
        remark: form.remark.trim() || null,
      });
      toast.success('邀请码已创建。');
      setCreateOpen(false);
      setForm({ usage_limit: '1', expires_at: '', remark: '' });
      setRefresh(v => v + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, '创建邀请码失败。'));
    } finally {
      setCreating(false);
    }
  };

  const openUsage = async (invite: BackendInvite) => {
    setUsageInvite(invite);
    setUsageLoading(true);
    try {
      const payload = await adminInviteUsageApi(invite.id);
      setUsage(payload.data.items);
    } catch (error) {
      toast.error(apiErrorMessage(error, '使用记录加载失败。'));
      setUsage([]);
    } finally {
      setUsageLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索邀请码" />
          <NativeSelect value={status} onChange={value => setStatus(value as InviteStatusFilter)}>
            <option value="all">全部状态</option>
            <option value="active">有效</option>
            <option value="disabled">禁用</option>
            <option value="expired">过期</option>
          </NativeSelect>
        </div>
        <Button size="sm" className="h-8 bg-black text-xs text-white hover:bg-gray-900" onClick={() => setCreateOpen(true)}>
          <Plus size={12} />
          新建邀请码
        </Button>
      </Toolbar>

      {error && <ErrorState message={error} onRetry={() => setRefresh(v => v + 1)} compact />}
      <DataShell headers={['邀请码', '状态', '使用次数', '过期时间', '备注', '创建时间', '']} template="180px 90px 100px 170px 1fr 170px 42px" minWidth={960}>
        {loading ? (
          <TableLoading colSpan={7} />
        ) : items.length === 0 ? (
          <TableEmpty text="暂无邀请码" />
        ) : items.map(invite => (
          <DataRow key={invite.id} template="180px 90px 100px 170px 1fr 170px 42px">
            <span className="font-mono text-xs text-gray-700">{invite.code}</span>
            <InviteStatus status={invite.status} />
            <span className="text-xs text-gray-500">{invite.used_count}/{invite.usage_limit}</span>
            <span className="text-xs text-gray-400">{formatDateTime(invite.expires_at)}</span>
            <span className="truncate text-xs text-gray-500">{invite.remark || '-'}</span>
            <span className="text-xs text-gray-400">{formatDateTime(invite.created_at)}</span>
            <RowMenu
              items={[
                { label: '复制', icon: Copy, onClick: () => copyText(invite.code, '邀请码已复制。') },
                { label: '使用记录', icon: Eye, onClick: () => void openUsage(invite) },
                {
                  label: '禁用',
                  icon: PowerOff,
                  disabled: invite.status !== 'active',
                  danger: true,
                  onClick: () => requestConfirm({
                    title: '禁用邀请码',
                    description: `禁用后邀请码 ${invite.code} 将无法继续注册。`,
                    actionLabel: '禁用',
                    danger: true,
                    onConfirm: async () => {
                      await adminDisableInviteApi(invite.id);
                      toast.success('邀请码已禁用。');
                      setRefresh(v => v + 1);
                    },
                  }),
                },
              ]}
            />
          </DataRow>
        ))}
      </DataShell>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="mb-5">
            <SheetTitle>新建邀请码</SheetTitle>
            <SheetDescription>创建后可复制给受邀用户注册。</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <Field label="使用上限">
              <Input type="number" min={1} max={100} value={form.usage_limit} onChange={e => setForm(prev => ({ ...prev, usage_limit: e.target.value }))} />
            </Field>
            <Field label="过期时间">
              <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(prev => ({ ...prev, expires_at: e.target.value }))} />
            </Field>
            <TextAreaField label="备注" value={form.remark} onChange={value => setForm(prev => ({ ...prev, remark: value }))} rows={4} />
            <Button className="w-full bg-black text-white hover:bg-gray-900" disabled={creating} onClick={() => void createInvite()}>
              {creating && <Loader2 size={14} className="animate-spin" />}
              创建
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!usageInvite} onOpenChange={open => !open && setUsageInvite(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader className="mb-5">
            <SheetTitle>邀请码使用记录</SheetTitle>
            <SheetDescription className="font-mono text-xs">{usageInvite?.code}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {usageLoading ? <LoadingState text="正在读取使用记录…" compact /> : usage.length === 0 ? <EmptyState text="暂无使用记录" /> : (
              <div className="space-y-3">
                {usage.map(item => (
                  <div key={item.id} className="rounded-md border border-gray-100 p-3">
                    <p className="font-mono text-xs text-gray-700">{item.user_id}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(item.used_at)} · {item.user_agent_summary || '-'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UsersSection({ requestConfirm }: { requestConfirm: (action: ConfirmAction) => void }) {
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [resetUser, setResetUser] = useState<BackendUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    adminListUsersApi({ keyword, status, page: 1, page_size: 100 })
      .then(payload => {
        if (alive) setUsers(payload.data.items);
      })
      .catch(error => {
        if (alive) setError(apiErrorMessage(error, '用户列表加载失败。'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [keyword, refresh, status]);

  const resetPassword = async () => {
    if (!resetUser) return;
    setSaving(true);
    try {
      await adminResetPasswordApi(resetUser.id, newPassword);
      toast.success('密码已重置。');
      setResetUser(null);
      setNewPassword('');
    } catch (error) {
      toast.error(apiErrorMessage(error, '重置密码失败。'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索用户名" />
          <NativeSelect value={status} onChange={value => setStatus(value as 'all' | 'active' | 'disabled')}>
            <option value="all">全部状态</option>
            <option value="active">启用</option>
            <option value="disabled">禁用</option>
          </NativeSelect>
        </div>
        <Button variant="outline" size="sm" className="h-8 border-gray-200 text-xs" onClick={() => setRefresh(v => v + 1)}>
          <RefreshCw size={12} />
          刷新
        </Button>
      </Toolbar>

      {error && <ErrorState message={error} onRetry={() => setRefresh(v => v + 1)} compact />}
      <DataShell headers={['用户名', '角色', '状态', '创建时间', '最近登录', '']} template="1fr 120px 110px 170px 170px 42px" minWidth={850}>
        {loading ? (
          <TableLoading colSpan={6} />
        ) : users.length === 0 ? (
          <TableEmpty text="暂无用户" />
        ) : users.map(user => (
          <DataRow key={user.id} template="1fr 120px 110px 170px 170px 42px">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{user.username}</p>
              <p className="truncate text-xs text-gray-400">{user.display_name || user.displayName || '-'}</p>
            </div>
            <RoleBadge role={user.role} />
            <UserStatus status={user.status} />
            <span className="text-xs text-gray-400">{formatDateTime(user.created_at)}</span>
            <span className="text-xs text-gray-400">{formatDateTime(user.last_login_at)}</span>
            <RowMenu
              items={[
                {
                  label: user.status === 'active' ? '禁用' : '启用',
                  icon: user.status === 'active' ? UserX : UserCheck,
                  disabled: user.role === 'admin' && user.status === 'active',
                  danger: user.status === 'active',
                  onClick: () => requestConfirm({
                    title: user.status === 'active' ? '禁用用户' : '启用用户',
                    description: user.status === 'active'
                      ? `禁用后 ${user.username} 将无法继续访问受邀内容。`
                      : `启用后 ${user.username} 可恢复登录。`,
                    actionLabel: user.status === 'active' ? '禁用' : '启用',
                    danger: user.status === 'active',
                    onConfirm: async () => {
                      if (user.status === 'active') {
                        await adminDisableUserApi(user.id);
                      } else {
                        await adminEnableUserApi(user.id);
                      }
                      toast.success('用户状态已更新。');
                      setRefresh(v => v + 1);
                    },
                  }),
                },
                { label: '重置密码', icon: KeyRound, onClick: () => setResetUser(user) },
              ]}
            />
          </DataRow>
        ))}
      </DataShell>

      <Sheet open={!!resetUser} onOpenChange={open => !open && setResetUser(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader className="mb-5">
            <SheetTitle>重置用户密码</SheetTitle>
            <SheetDescription>{resetUser?.username}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <Field label="新密码">
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少 6 位" />
            </Field>
            <Button className="w-full bg-black text-white hover:bg-gray-900" disabled={saving || newPassword.length < 6} onClick={() => void resetPassword()}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              保存新密码
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ContentAdminSection({ type, requestConfirm }: { type: ContentType; requestConfirm: (action: ConfirmAction) => void }) {
  const [items, setItems] = useState<BackendContent[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<ContentStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BackendContent | null>(null);
  const [form, setForm] = useState(blankContentForm(type));
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAllow, setUploadAllow] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    adminListContentsApi({ type, keyword, status, page: 1, page_size: 100 })
      .then(payload => {
        if (alive) setItems(payload.data.items);
      })
      .catch(error => {
        if (alive) setError(apiErrorMessage(error, `${contentTypeLabel[type]}列表加载失败。`));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [keyword, refresh, status, type]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankContentForm(type));
    setSheetOpen(true);
  };

  const openEdit = async (item: BackendContent) => {
    setSheetOpen(true);
    setSheetLoading(true);
    try {
      const payload = await adminContentDetailApi(item.id);
      setEditing(payload.data);
      setForm(contentToForm(payload.data));
    } catch (error) {
      toast.error(apiErrorMessage(error, '内容详情加载失败。'));
      setSheetOpen(false);
    } finally {
      setSheetLoading(false);
    }
  };

  const reloadEditing = async (contentId: string) => {
    const payload = await adminContentDetailApi(contentId);
    setEditing(payload.data);
    setForm(contentToForm(payload.data));
  };

  const saveContent = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        body: form.body.trim() || null,
        code: type === 'script' ? form.code : null,
        language: form.language.trim() || null,
        category: form.category.trim() || null,
        tags: parseTags(form.tags),
        status: form.status,
        allow_copy: form.allow_copy,
      };
      if (editing) {
        await adminPatchContentApi(editing.id, payload);
        toast.success('内容已更新。');
      } else {
        await adminCreateContentApi({ ...payload, type });
        toast.success('内容已创建。');
      }
      setSheetOpen(false);
      setRefresh(v => v + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, '保存内容失败。'));
    } finally {
      setSaving(false);
    }
  };

  const uploadAttachment = async () => {
    if (!editing || !uploadFile) return;
    setUploading(true);
    try {
      await adminUploadAttachmentApi(editing.id, uploadFile, uploadAllow);
      toast.success('附件已上传。');
      setUploadFile(null);
      await reloadEditing(editing.id);
      setRefresh(v => v + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, '附件上传失败。'));
    } finally {
      setUploading(false);
    }
  };

  const title = `${contentTypeLabel[type]}管理`;

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={keyword} onChange={setKeyword} placeholder={`搜索${contentTypeLabel[type]}标题`} />
          <NativeSelect value={status} onChange={value => setStatus(value as ContentStatus)}>
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="unpublished">已下架</option>
          </NativeSelect>
        </div>
        <Button size="sm" className="h-8 bg-black text-xs text-white hover:bg-gray-900" onClick={openCreate}>
          <Plus size={12} />
          新建{contentTypeLabel[type]}
        </Button>
      </Toolbar>

      {error && <ErrorState message={error} onRetry={() => setRefresh(v => v + 1)} compact />}
      <DataShell headers={['标题', '状态', '标签', '更新时间', '']} template="1fr 100px 150px 170px 42px" minWidth={780}>
        {loading ? (
          <TableLoading colSpan={5} />
        ) : items.length === 0 ? (
          <TableEmpty text={`暂无${contentTypeLabel[type]}`} />
        ) : items.map(item => (
          <DataRow key={item.id} template="1fr 100px 150px 170px 42px">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{item.title}</p>
              <p className="truncate text-xs text-gray-400">{item.summary || item.desc || '-'}</p>
            </div>
            <ContentStatusBadge status={item.status || 'draft'} />
            <span className="truncate text-xs text-gray-500">{item.tag || item.category || item.language || '-'}</span>
            <span className="text-xs text-gray-400">{formatDateTime(item.updated_at || item.updatedAt)}</span>
            <RowMenu
              items={[
                { label: '编辑', icon: Edit2, onClick: () => void openEdit(item) },
                {
                  label: '发布',
                  icon: CheckCircle2,
                  disabled: item.status === 'published',
                  onClick: () => requestConfirm({
                    title: '发布内容',
                    description: `确认发布「${item.title}」？`,
                    actionLabel: '发布',
                    onConfirm: async () => {
                      await adminPublishContentApi(item.id);
                      toast.success('内容已发布。');
                      setRefresh(v => v + 1);
                    },
                  }),
                },
                {
                  label: '下架',
                  icon: PowerOff,
                  disabled: item.status !== 'published',
                  onClick: () => requestConfirm({
                    title: '下架内容',
                    description: `下架后「${item.title}」不会出现在前台公开/受邀列表。`,
                    actionLabel: '下架',
                    danger: true,
                    onConfirm: async () => {
                      await adminUnpublishContentApi(item.id);
                      toast.success('内容已下架。');
                      setRefresh(v => v + 1);
                    },
                  }),
                },
                {
                  label: '删除',
                  icon: Trash2,
                  danger: true,
                  onClick: () => requestConfirm({
                    title: '删除内容',
                    description: `删除后「${item.title}」将按后端软删除语义移出管理列表。`,
                    actionLabel: '删除',
                    danger: true,
                    onConfirm: async () => {
                      await adminDeleteContentApi(item.id);
                      toast.success('内容已删除。');
                      setRefresh(v => v + 1);
                    },
                  }),
                },
              ]}
            />
          </DataRow>
        ))}
      </DataShell>

      <Sheet open={sheetOpen} onOpenChange={open => !open && setSheetOpen(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="mb-5">
            <SheetTitle>{editing ? `编辑${contentTypeLabel[type]}` : `新建${contentTypeLabel[type]}`}</SheetTitle>
            <SheetDescription>{title} · 普通输入框 v1</SheetDescription>
          </SheetHeader>
          {sheetLoading ? (
            <LoadingState text="正在读取内容详情…" compact />
          ) : (
            <div className="space-y-4 px-4 pb-8">
              <Field label="标题">
                <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
              </Field>
              <TextAreaField label="摘要" value={form.summary} onChange={value => setForm(prev => ({ ...prev, summary: value }))} rows={3} />
              <TextAreaField label={type === 'script' ? '说明' : '正文'} value={form.body} onChange={value => setForm(prev => ({ ...prev, body: value }))} rows={6} />
              {type === 'script' && (
                <TextAreaField label="代码" value={form.code} onChange={value => setForm(prev => ({ ...prev, code: value }))} rows={10} className="font-mono text-xs" />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="语言">
                  <Input value={form.language} onChange={e => setForm(prev => ({ ...prev, language: e.target.value }))} />
                </Field>
                <Field label="分类">
                  <Input value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} />
                </Field>
              </div>
              <Field label="标签">
                <Input value={form.tags} onChange={e => setForm(prev => ({ ...prev, tags: e.target.value }))} placeholder="用逗号分隔" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="状态">
                  <NativeSelect value={form.status} onChange={value => setForm(prev => ({ ...prev, status: value as ContentStatus }))}>
                    <option value="draft">草稿</option>
                    <option value="published">已发布</option>
                    <option value="unpublished">已下架</option>
                  </NativeSelect>
                </Field>
                <CheckboxField
                  label="允许复制脚本"
                  checked={form.allow_copy}
                  disabled={type !== 'script'}
                  onChange={checked => setForm(prev => ({ ...prev, allow_copy: checked }))}
                />
              </div>

              {type === 'work' && editing && (
                <div className="rounded-lg border border-gray-100 p-4">
                  <h3 className="mb-3 text-sm font-medium text-gray-900">作品附件</h3>
                  {editing.attachments?.length ? (
                    <div className="space-y-2">
                      {editing.attachments.map(attachment => (
                        <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-gray-700">{attachment.filename}</p>
                            <p className="text-xs text-gray-400">{formatFileSize(attachment.file_size)} · {attachment.allow_download ? '允许下载' : '禁止下载'}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={!attachment.allow_download}
                              onClick={() => window.open(attachmentDownloadUrl(editing.id, attachment.id), '_blank')}
                            >
                              <Download size={13} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 border-gray-200 text-xs"
                              onClick={async () => {
                                try {
                                  await adminPatchAttachmentApi(editing.id, attachment.id, !attachment.allow_download);
                                  toast.success('下载权限已更新。');
                                  await reloadEditing(editing.id);
                                  setRefresh(v => v + 1);
                                } catch (error) {
                                  toast.error(apiErrorMessage(error, '附件权限更新失败。'));
                                }
                              }}
                            >
                              {attachment.allow_download ? '禁用下载' : '允许下载'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="暂无附件" />
                  )}
                  <div className="mt-4 grid gap-3">
                    <Input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                    <CheckboxField label="上传后允许下载" checked={uploadAllow} onChange={setUploadAllow} />
                    <Button variant="outline" className="border-gray-200" disabled={!uploadFile || uploading} onClick={() => void uploadAttachment()}>
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      上传附件
                    </Button>
                  </div>
                </div>
              )}

              <Button className="w-full bg-black text-white hover:bg-gray-900" disabled={saving || !form.title.trim()} onClick={() => void saveContent()}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                保存内容
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MessagesSection({ requestConfirm }: { requestConfirm: (action: ConfirmAction) => void }) {
  const [items, setItems] = useState<BackendMessage[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<MessageStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    adminListMessagesApi({ keyword, status, page: 1, page_size: 100 })
      .then(payload => {
        if (alive) setItems(payload.data.items);
      })
      .catch(error => {
        if (alive) setError(apiErrorMessage(error, '留言列表加载失败。'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [keyword, refresh, status]);

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索昵称或留言" />
          <NativeSelect value={status} onChange={value => setStatus(value as MessageStatusFilter)}>
            <option value="all">全部状态</option>
            <option value="visible">公开</option>
            <option value="hidden">隐藏</option>
          </NativeSelect>
        </div>
        <Button variant="outline" size="sm" className="h-8 border-gray-200 text-xs" onClick={() => setRefresh(v => v + 1)}>
          <RefreshCw size={12} />
          刷新
        </Button>
      </Toolbar>

      {error && <ErrorState message={error} onRetry={() => setRefresh(v => v + 1)} compact />}
      <DataShell headers={['留言', '昵称', '状态', '创建时间', '']} template="1fr 140px 100px 170px 42px" minWidth={820}>
        {loading ? (
          <TableLoading colSpan={5} />
        ) : items.length === 0 ? (
          <TableEmpty text="暂无留言" />
        ) : items.map(message => (
          <DataRow key={message.id} template="1fr 140px 100px 170px 42px">
            <p className="truncate text-sm text-gray-700">{message.content}</p>
            <span className="truncate text-xs text-gray-500">{message.nickname}</span>
            <MessageStatus status={message.status} />
            <span className="text-xs text-gray-400">{formatDateTime(message.created_at || message.createdAt)}</span>
            <RowMenu
              items={[
                {
                  label: message.status === 'visible' ? '隐藏' : '恢复',
                  icon: message.status === 'visible' ? PowerOff : Power,
                  onClick: () => requestConfirm({
                    title: message.status === 'visible' ? '隐藏留言' : '恢复留言',
                    description: message.status === 'visible' ? '隐藏后该留言不会在前台公开显示。' : '恢复后该留言会重新进入公开列表。',
                    actionLabel: message.status === 'visible' ? '隐藏' : '恢复',
                    danger: message.status === 'visible',
                    onConfirm: async () => {
                      if (message.status === 'visible') {
                        await adminHideMessageApi(message.id);
                      } else {
                        await adminRestoreMessageApi(message.id);
                      }
                      toast.success('留言状态已更新。');
                      setRefresh(v => v + 1);
                    },
                  }),
                },
                {
                  label: '删除',
                  icon: Trash2,
                  danger: true,
                  onClick: () => requestConfirm({
                    title: '删除留言',
                    description: '删除后留言会按后端语义移出管理列表和前台展示。',
                    actionLabel: '删除',
                    danger: true,
                    onConfirm: async () => {
                      await adminDeleteMessageApi(message.id);
                      toast.success('留言已删除。');
                      setRefresh(v => v + 1);
                    },
                  }),
                },
              ]}
            />
          </DataRow>
        ))}
      </DataShell>
    </div>
  );
}

function ServicesSection({ requestConfirm }: { requestConfirm: (action: ConfirmAction) => void }) {
  const [items, setItems] = useState<BackendAdminService[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<EnabledStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<BackendAdminService | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankServiceForm());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    adminListServicesApi({ keyword, status, page: 1, page_size: 100 })
      .then(payload => {
        if (alive) setItems(payload.data.items);
      })
      .catch(error => {
        if (alive) setError(apiErrorMessage(error, '服务列表加载失败。'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [keyword, refresh, status]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankServiceForm());
    setSheetOpen(true);
  };

  const openEdit = (service: BackendAdminService) => {
    setEditing(service);
    setForm(serviceToForm(service));
    setSheetOpen(true);
  };

  const saveService = async () => {
    let inputSchema: Array<Record<string, unknown>>;
    try {
      const parsed = JSON.parse(form.input_schema || '[]');
      if (!Array.isArray(parsed)) throw new Error('input_schema must be an array');
      inputSchema = parsed as Array<Record<string, unknown>>;
    } catch {
      toast.error('input_schema 必须是 JSON 数组。');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        summary: form.summary.trim() || null,
        description: form.description.trim() || null,
        status: form.status,
        script_key: form.script_key.trim() || null,
        script_version: form.script_version.trim() || null,
        input_schema: inputSchema,
      };
      if (editing) {
        await adminPatchServiceApi(editing.id, payload);
        toast.success('服务已更新。');
      } else {
        await adminCreateServiceApi(payload);
        toast.success('服务已创建。');
      }
      setSheetOpen(false);
      setRefresh(v => v + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, '保存服务失败。'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索服务名称" />
          <NativeSelect value={status} onChange={value => setStatus(value as EnabledStatusFilter)}>
            <option value="all">全部状态</option>
            <option value="enabled">启用</option>
            <option value="disabled">停用</option>
          </NativeSelect>
        </div>
        <Button size="sm" className="h-8 bg-black text-xs text-white hover:bg-gray-900" onClick={openCreate}>
          <Plus size={12} />
          新建服务
        </Button>
      </Toolbar>

      {error && <ErrorState message={error} onRetry={() => setRefresh(v => v + 1)} compact />}
      <DataShell headers={['服务', '状态', '脚本键', '版本', '更新时间', '']} template="1fr 90px 180px 100px 170px 42px" minWidth={900}>
        {loading ? (
          <TableLoading colSpan={6} />
        ) : items.length === 0 ? (
          <TableEmpty text="暂无服务" />
        ) : items.map(service => (
          <DataRow key={service.id} template="1fr 90px 180px 100px 170px 42px">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{service.name}</p>
              <p className="truncate text-xs text-gray-400">{service.summary || service.description || '-'}</p>
            </div>
            <ServiceStatusBadge status={service.status} />
            <span className="truncate font-mono text-xs text-gray-500">{service.script_key || '-'}</span>
            <span className="text-xs text-gray-500">{service.script_version || '-'}</span>
            <span className="text-xs text-gray-400">{formatDateTime(service.updated_at || service.updatedAt)}</span>
            <RowMenu
              items={[
                { label: '编辑', icon: Edit2, onClick: () => openEdit(service) },
                {
                  label: service.status === 'enabled' ? '停用' : '启用',
                  icon: service.status === 'enabled' ? PowerOff : Power,
                  danger: service.status === 'enabled',
                  onClick: () => requestConfirm({
                    title: service.status === 'enabled' ? '停用服务' : '启用服务',
                    description: service.status === 'enabled'
                      ? `停用后「${service.name}」不可再发起新的服务请求。`
                      : `启用后「${service.name}」会重新出现在工作站服务入口。`,
                    actionLabel: service.status === 'enabled' ? '停用' : '启用',
                    danger: service.status === 'enabled',
                    onConfirm: async () => {
                      if (service.status === 'enabled') {
                        await adminDisableServiceApi(service.id);
                      } else {
                        await adminEnableServiceApi(service.id);
                      }
                      toast.success('服务状态已更新。');
                      setRefresh(v => v + 1);
                    },
                  }),
                },
                {
                  label: '删除',
                  icon: Trash2,
                  danger: true,
                  onClick: () => requestConfirm({
                    title: '删除服务',
                    description: `删除「${service.name}」后，服务入口会从后台和工作站列表移除。`,
                    actionLabel: '删除',
                    danger: true,
                    onConfirm: async () => {
                      await adminDeleteServiceApi(service.id);
                      toast.success('服务已删除。');
                      setRefresh(v => v + 1);
                    },
                  }),
                },
              ]}
            />
          </DataRow>
        ))}
      </DataShell>

      <Sheet open={sheetOpen} onOpenChange={open => !open && setSheetOpen(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="mb-5">
            <SheetTitle>{editing ? '编辑工作站服务' : '新建工作站服务'}</SheetTitle>
            <SheetDescription>input_schema 使用 JSON 数组保存。</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <Field label="服务名称">
              <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
            </Field>
            <TextAreaField label="摘要" value={form.summary} onChange={value => setForm(prev => ({ ...prev, summary: value }))} rows={3} />
            <TextAreaField label="说明" value={form.description} onChange={value => setForm(prev => ({ ...prev, description: value }))} rows={5} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="状态">
                <NativeSelect value={form.status} onChange={value => setForm(prev => ({ ...prev, status: value as 'enabled' | 'disabled' }))}>
                  <option value="enabled">启用</option>
                  <option value="disabled">停用</option>
                </NativeSelect>
              </Field>
              <Field label="脚本键">
                <Input value={form.script_key} onChange={e => setForm(prev => ({ ...prev, script_key: e.target.value }))} />
              </Field>
              <Field label="脚本版本">
                <Input value={form.script_version} onChange={e => setForm(prev => ({ ...prev, script_version: e.target.value }))} />
              </Field>
            </div>
            <TextAreaField label="input_schema" value={form.input_schema} onChange={value => setForm(prev => ({ ...prev, input_schema: value }))} rows={10} className="font-mono text-xs" />
            <Button className="w-full bg-black text-white hover:bg-gray-900" disabled={saving || !form.name.trim()} onClick={() => void saveService()}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              保存服务
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ServiceRecordsSection() {
  const [records, setRecords] = useState<BackendServiceRequest[]>([]);
  const [services, setServices] = useState<BackendAdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [filters, setFilters] = useState({ service_id: 'all', user_id: '', status: 'all', failure_code: 'all', service_request_id: '' });
  const [detail, setDetail] = useState<BackendServiceRequest | null>(null);
  const [logs, setLogs] = useState<BackendExecutionLog[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    adminListServicesApi({ page: 1, page_size: 100 })
      .then(payload => setServices(payload.data.items))
      .catch(() => setServices([]));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    adminListServiceRequestsApi({ ...filters, page: 1, page_size: 100 })
      .then(payload => {
        if (alive) setRecords(payload.data.items);
      })
      .catch(error => {
        if (alive) setError(apiErrorMessage(error, '服务提交记录加载失败。'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters, refresh]);

  const openDetail = async (record: BackendServiceRequest) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setLogs([]);
    try {
      const [detailPayload, logsPayload] = await Promise.all([
        adminServiceRequestDetailApi(record.service_request_id),
        adminServiceRequestLogsApi(record.service_request_id),
      ]);
      setDetail(detailPayload.data);
      setLogs(logsPayload.data.logs);
    } catch (error) {
      toast.error(apiErrorMessage(error, '服务记录详情加载失败。'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const exportCsv = () => {
    window.open(adminExportUrl('service-requests.csv', filters), '_blank');
  };

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect value={filters.service_id} onChange={value => setFilters(prev => ({ ...prev, service_id: value }))}>
            <option value="all">全部服务</option>
            {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
          </NativeSelect>
          <SearchInput value={filters.service_request_id} onChange={value => setFilters(prev => ({ ...prev, service_request_id: value }))} placeholder="service_request_id" />
          <SearchInput value={filters.user_id} onChange={value => setFilters(prev => ({ ...prev, user_id: value }))} placeholder="user_id" />
          <NativeSelect value={filters.status} onChange={value => setFilters(prev => ({ ...prev, status: value }))}>
            <option value="all">全部状态</option>
            <option value="pending">等待中</option>
            <option value="running">执行中</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
            <option value="timeout">超时</option>
            <option value="not_integrated">未接入</option>
          </NativeSelect>
          <NativeSelect value={filters.failure_code} onChange={value => setFilters(prev => ({ ...prev, failure_code: value }))}>
            <option value="all">全部 failure_code</option>
            <option value="AUTH_FAILED">AUTH_FAILED</option>
            <option value="SCRIPT_ERROR">SCRIPT_ERROR</option>
            <option value="TIMEOUT">TIMEOUT</option>
            <option value="SERVICE_NOT_INTEGRATED">SERVICE_NOT_INTEGRATED</option>
          </NativeSelect>
        </div>
        <Button variant="outline" size="sm" className="h-8 border-gray-200 text-xs" onClick={exportCsv}>
          <FileDown size={12} />
          导出 CSV
        </Button>
      </Toolbar>

      {error && <ErrorState message={error} onRetry={() => setRefresh(v => v + 1)} compact />}
      <DataShell headers={['service_request_id', '服务名称', '状态', '账号掩码', 'failure_code', '提交时间', '']} template="210px 1fr 90px 130px 150px 170px 42px" minWidth={1040}>
        {loading ? (
          <TableLoading colSpan={7} />
        ) : records.length === 0 ? (
          <TableEmpty text="暂无服务提交记录" />
        ) : records.map(record => (
          <button
            key={record.service_request_id}
            onClick={() => void openDetail(record)}
            className="grid w-full items-center border-b border-gray-50 px-5 py-3.5 text-left last:border-b-0 hover:bg-gray-50/60"
            style={{ gridTemplateColumns: '210px 1fr 90px 130px 150px 170px 42px' }}
          >
            <span className="font-mono text-xs text-gray-500">{record.service_request_id}</span>
            <span className="truncate text-sm font-medium text-gray-800">{record.service_name}</span>
            <RecordStatusBadge status={record.status} />
            <span className="font-mono text-xs text-gray-500">{record.student_account_masked || '-'}</span>
            <span className="font-mono text-xs text-gray-400">{record.failure_code || '-'}</span>
            <span className="text-xs text-gray-400">{formatDateTime(record.submitted_at)}</span>
            <Eye size={14} className="text-gray-400" />
          </button>
        ))}
      </DataShell>
      <p className="text-xs text-gray-400">记录详情与导出均不展示学生 App 密码、完整账号、Token、Cookie 或 Authorization。</p>

      <Sheet open={detailOpen} onOpenChange={open => !open && setDetailOpen(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="mb-5">
            <SheetTitle>{detail?.service_name || '服务记录详情'}</SheetTitle>
            <SheetDescription className="font-mono text-xs">{detail?.service_request_id}</SheetDescription>
          </SheetHeader>
          {detailLoading ? (
            <LoadingState text="正在读取记录详情…" compact />
          ) : detail ? (
            <div className="space-y-4 px-4 pb-8">
              <AdminDetail label="状态"><RecordStatusBadge status={detail.status} /></AdminDetail>
              <AdminDetail label="账号掩码"><span className="font-mono text-xs">{detail.student_account_masked || '-'}</span></AdminDetail>
              <AdminDetail label="failure_code"><span className="font-mono text-xs">{detail.failure_code || '-'}</span></AdminDetail>
              <AdminDetail label="提交时间">{formatDateTime(detail.submitted_at)}</AdminDetail>
              <AdminDetail label="完成时间">{formatDateTime(detail.finished_at)}</AdminDetail>
              <AdminDetail label="耗时">{formatDuration(detail.duration_ms)}</AdminDetail>
              <AdminDetail label="摘要">{detail.result_summary || '-'}</AdminDetail>
              <div className="rounded-lg border border-gray-100">
                <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">脱敏执行日志</div>
                {logs.length === 0 ? <EmptyState text="暂无执行日志" /> : (
                  <div className="divide-y divide-gray-100">
                    {logs.map(log => (
                      <div key={`${log.sequence}-${log.time}`} className="grid grid-cols-[50px_70px_1fr] gap-3 px-4 py-3 text-xs">
                        <span className="font-mono text-gray-400">#{log.sequence}</span>
                        <span className={log.level === 'error' ? 'text-red-600' : log.level === 'warn' ? 'text-amber-600' : 'text-gray-500'}>{log.level}</span>
                        <div className="min-w-0">
                          <p className="truncate text-gray-700">{log.message}</p>
                          <p className="mt-1 font-mono text-gray-400">{formatDateTime(log.time)} · {log.step_name || '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState text="未找到记录详情" />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AuditSection() {
  const [items, setItems] = useState<BackendAuditLog[]>([]);
  const [filters, setFilters] = useState({ actor_user_id: '', action: '', service_request_id: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState<BackendAuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    adminListAuditLogsApi({ ...filters, page: 1, page_size: 100 })
      .then(payload => {
        if (alive) setItems(payload.data.items);
      })
      .catch(error => {
        if (alive) setError(apiErrorMessage(error, '审计记录加载失败。'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters, refresh]);

  const openDetail = async (audit: BackendAuditLog) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const payload = await adminAuditLogDetailApi(audit.id);
      setDetail(payload.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, '审计详情加载失败。'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={filters.actor_user_id} onChange={value => setFilters(prev => ({ ...prev, actor_user_id: value }))} placeholder="actor_user_id" />
          <SearchInput value={filters.action} onChange={value => setFilters(prev => ({ ...prev, action: value }))} placeholder="action" />
          <SearchInput value={filters.service_request_id} onChange={value => setFilters(prev => ({ ...prev, service_request_id: value }))} placeholder="service_request_id" />
        </div>
        <Button variant="outline" size="sm" className="h-8 border-gray-200 text-xs" onClick={() => setRefresh(v => v + 1)}>
          <RefreshCw size={12} />
          刷新
        </Button>
      </Toolbar>

      {error && <ErrorState message={error} onRetry={() => setRefresh(v => v + 1)} compact />}
      <DataShell headers={['时间', '操作者', '动作', '资源', 'service_request_id', 'UA 摘要', '结果']} template="170px 140px 170px 180px 210px 1fr 80px" minWidth={1120}>
        {loading ? (
          <TableLoading colSpan={7} />
        ) : items.length === 0 ? (
          <TableEmpty text="暂无审计记录" />
        ) : items.map(audit => (
          <button
            key={audit.id}
            onClick={() => void openDetail(audit)}
            className="grid w-full items-center border-b border-gray-50 px-5 py-3.5 text-left last:border-b-0 hover:bg-gray-50/60"
            style={{ gridTemplateColumns: '170px 140px 170px 180px 210px 1fr 80px' }}
          >
            <span className="text-xs text-gray-400">{formatDateTime(audit.created_at)}</span>
            <span className="truncate font-mono text-xs text-gray-500">{audit.actor_user_id || '-'}</span>
            <span className="truncate text-sm text-gray-700">{audit.action}</span>
            <span className="truncate font-mono text-xs text-gray-400">{audit.resource_type}:{audit.resource_id || '-'}</span>
            <span className="truncate font-mono text-xs text-gray-400">{audit.service_request_id || '-'}</span>
            <span className="truncate text-xs text-gray-400">{audit.user_agent_summary || '-'}</span>
            <span className={audit.result === 'success' ? 'text-xs text-emerald-600' : 'text-xs text-red-600'}>{audit.result}</span>
          </button>
        ))}
      </DataShell>

      <Sheet open={detailOpen} onOpenChange={open => !open && setDetailOpen(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="mb-5">
            <SheetTitle>审计详情</SheetTitle>
            <SheetDescription>{detail?.id}</SheetDescription>
          </SheetHeader>
          {detailLoading ? <LoadingState text="正在读取审计详情…" compact /> : detail ? (
            <div className="space-y-4 px-4 pb-8">
              <AdminDetail label="动作">{detail.action}</AdminDetail>
              <AdminDetail label="操作者"><span className="font-mono text-xs">{detail.actor_user_id || '-'}</span></AdminDetail>
              <AdminDetail label="角色">{detail.actor_role || '-'}</AdminDetail>
              <AdminDetail label="资源"><span className="font-mono text-xs">{detail.resource_type}:{detail.resource_id || '-'}</span></AdminDetail>
              <AdminDetail label="结果">{detail.result}</AdminDetail>
              <AdminDetail label="时间">{formatDateTime(detail.created_at)}</AdminDetail>
              <div>
                <p className="mb-2 text-xs text-gray-400">metadata_sanitized</p>
                <pre className="max-h-80 overflow-auto rounded-lg bg-gray-950 p-4 text-xs leading-5 text-gray-100">{JSON.stringify(detail.metadata_sanitized ?? {}, null, 2)}</pre>
              </div>
            </div>
          ) : <EmptyState text="未找到审计详情" />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MetricsSection() {
  const [items, setItems] = useState<DashboardSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    adminListSnapshotsApi({ page: 1, page_size: 90 })
      .then(payload => {
        if (alive) setItems(payload.data.items);
      })
      .catch(error => {
        if (alive) setError(apiErrorMessage(error, '统计快照加载失败。'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refresh]);

  const latest = items[0];

  return (
    <div className="space-y-4">
      <Toolbar>
        <p className="text-xs text-gray-400">看板快照为聚合统计，不包含用户明细。</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 border-gray-200 text-xs" onClick={() => setRefresh(v => v + 1)}>
            <RefreshCw size={12} />
            刷新
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-gray-200 text-xs" onClick={() => window.open(adminExportUrl('dashboard-snapshots.csv'), '_blank')}>
            <FileDown size={12} />
            导出快照
          </Button>
        </div>
      </Toolbar>

      {error && <ErrorState message={error} onRetry={() => setRefresh(v => v + 1)} compact />}
      {loading ? <LoadingState text="正在读取快照…" /> : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="访问数" value={latest?.visit_count || 0} detail={latest?.date || '暂无快照'} />
            <StatCard label="用户数" value={latest?.user_count || 0} detail="聚合用户" />
            <StatCard label="作品数" value={latest?.work_count || 0} detail="已纳入快照" />
            <StatCard label="服务数" value={latest?.service_count || 0} detail="工作站服务" />
          </div>
          <DataShell headers={['日期', '用户', '开发者', '访问', '作品', '脚本', '博客', '留言', '服务', '生成时间']} template="130px repeat(8, 90px) 170px" minWidth={1050}>
            {items.length === 0 ? <TableEmpty text="暂无统计快照" /> : items.map(item => (
              <DataRow key={item.date || item.generated_at} template="130px repeat(8, 90px) 170px">
                <span className="text-xs text-gray-500">{item.date || '-'}</span>
                <span className="text-xs text-gray-500">{item.user_count}</span>
                <span className="text-xs text-gray-500">{item.developer_count}</span>
                <span className="text-xs text-gray-500">{item.visit_count}</span>
                <span className="text-xs text-gray-500">{item.work_count}</span>
                <span className="text-xs text-gray-500">{item.script_count}</span>
                <span className="text-xs text-gray-500">{item.blog_count}</span>
                <span className="text-xs text-gray-500">{item.message_count}</span>
                <span className="text-xs text-gray-500">{item.service_count}</span>
                <span className="text-xs text-gray-400">{formatDateTime(item.generated_at)}</span>
              </DataRow>
            ))}
          </DataShell>
        </>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-5">
      <h2 className="mb-3 text-sm font-medium text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{children}</div>;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 border-gray-200 pl-8 text-sm focus-visible:ring-black"
      />
    </div>
  );
}

function NativeSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600 outline-none transition-colors focus:border-black"
    >
      {children}
    </select>
  );
}

function DataShell({
  headers,
  children,
  template,
  minWidth = 760,
}: {
  headers: string[];
  children: ReactNode;
  template: string;
  minWidth?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <div className="grid border-b border-gray-100 bg-gray-50 px-5 py-3" style={{ gridTemplateColumns: template }}>
            {headers.map(header => (
              <span key={header} className="text-xs font-medium text-gray-400">{header}</span>
            ))}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function DataRow({ children, template }: { children: ReactNode; template: string }) {
  return (
    <div className="grid items-center border-b border-gray-50 px-5 py-3.5 last:border-b-0" style={{ gridTemplateColumns: template }}>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-gray-400">{text}</div>;
}

function TableEmpty({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-gray-400">{text}</div>;
}

function TableLoading({ colSpan }: { colSpan: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400" style={{ gridColumn: `span ${colSpan}` }}>
      <Loader2 size={14} className="animate-spin" />
      正在加载…
    </div>
  );
}

function LoadingState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-2 rounded-lg border border-gray-100 bg-white text-sm text-gray-400 ${compact ? 'py-8' : 'py-16'}`}>
      <Loader2 size={14} className="animate-spin" />
      {text}
    </div>
  );
}

function ErrorState({ message, onRetry, compact = false }: { message: string; onRetry: () => void; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-red-100 bg-red-50/60 p-4 ${compact ? '' : 'max-w-2xl'}`}>
      <div className="flex items-start gap-3">
        <ShieldAlert size={16} className="mt-0.5 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-red-700">{message}</p>
          <Button variant="outline" size="sm" className="mt-3 h-8 border-red-200 bg-white text-xs text-red-700" onClick={onRetry}>
            <RefreshCw size={12} />
            重试
          </Button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({
  items,
}: {
  items: { label: string; icon: ElementType; danger?: boolean; disabled?: boolean; onClick: () => void }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal size={13} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-sm">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.label}
              className={item.danger ? 'gap-2 text-red-600 focus:text-red-600' : 'gap-2'}
              onClick={item.onClick}
              disabled={item.disabled}
            >
              <Icon size={12} />
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <p className="text-2xl font-light tabular-nums text-gray-900">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
      <p className="mt-2 text-xs text-gray-400">{detail}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  className?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <Textarea value={value} rows={rows} onChange={e => onChange(e.target.value)} className={className} />
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-md border border-gray-100 px-3 text-sm text-gray-600">
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={value => onChange(value === true)} />
      {label}
    </label>
  );
}

function RoleBadge({ role }: { role: string }) {
  return role === 'admin'
    ? <Badge className="w-fit bg-black text-xs font-normal text-white">管理员</Badge>
    : <Badge variant="outline" className="w-fit text-xs font-normal text-gray-600">受邀用户</Badge>;
}

function UserStatus({ status }: { status: string }) {
  return status === 'active'
    ? <span className="flex items-center gap-1 text-xs text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />启用</span>
    : <span className="flex items-center gap-1 text-xs text-gray-400"><span className="h-1.5 w-1.5 rounded-full bg-gray-300" />禁用</span>;
}

function InviteStatus({ status }: { status: string }) {
  if (status === 'active') return <span className="text-xs text-emerald-600">有效</span>;
  if (status === 'expired') return <span className="text-xs text-amber-600">已过期</span>;
  return <span className="text-xs text-gray-400">已禁用</span>;
}

function ContentStatusBadge({ status }: { status: string }) {
  if (status === 'published') return <span className="text-xs text-emerald-600">已发布</span>;
  if (status === 'draft') return <span className="text-xs text-amber-600">草稿</span>;
  return <span className="text-xs text-gray-400">已下架</span>;
}

function MessageStatus({ status }: { status: string }) {
  return status === 'visible'
    ? <span className="text-xs text-emerald-600">公开</span>
    : <span className="text-xs text-gray-400">隐藏</span>;
}

function ServiceStatusBadge({ status }: { status: string }) {
  if (status === 'enabled') return <span className="text-xs text-emerald-600">启用</span>;
  return <span className="text-xs text-gray-400">停用</span>;
}

function RecordStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status || '-', cls: 'bg-gray-100 text-gray-600' };
  return <span className={`w-fit rounded-full px-2 py-0.5 text-xs ${config.cls}`}>{config.label}</span>;
}

function AdminDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-4 text-sm">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="min-w-0 text-gray-700">{children}</div>
    </div>
  );
}

function blankContentForm(type: ContentType) {
  return {
    title: '',
    summary: '',
    body: '',
    code: '',
    language: type === 'script' ? 'TypeScript' : '',
    category: '',
    tags: '',
    status: 'draft' as ContentStatus,
    allow_copy: true,
  };
}

function contentToForm(item: BackendContent) {
  return {
    title: item.title || '',
    summary: item.summary || item.desc || '',
    body: item.body || '',
    code: item.code || '',
    language: item.language || '',
    category: item.category || '',
    tags: (item.tags || []).join(', '),
    status: (item.status || 'draft') as ContentStatus,
    allow_copy: item.allow_copy !== false,
  };
}

function blankServiceForm() {
  return {
    name: '',
    summary: '',
    description: '',
    status: 'enabled' as 'enabled' | 'disabled',
    script_key: '',
    script_version: 'v1',
    input_schema: '[]',
  };
}

function serviceToForm(service: BackendAdminService) {
  return {
    name: service.name || '',
    summary: service.summary || '',
    description: service.description || '',
    status: service.status === 'disabled' ? 'disabled' as const : 'enabled' as const,
    script_key: service.script_key || '',
    script_version: service.script_version || '',
    input_schema: JSON.stringify(service.input_schema || [], null, 2),
  };
}

function parseTags(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.requestId ? `${error.message}（request_id: ${error.requestId}）` : error.message;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('zh-CN', { hour12: false });
}

function formatDuration(value?: number | null) {
  if (value == null) return '-';
  return `${(value / 1000).toFixed(1)}s`;
}

function formatFileSize(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function copyText(value: string, message: string) {
  navigator.clipboard?.writeText(value)
    .then(() => toast.success(message))
    .catch(() => toast.error('复制失败。'));
}

function getSectionTitle(activeSection: string) {
  const titles: Record<string, string> = {
    overview: '总览',
    invites: '邀请码管理',
    users: '用户管理',
    scripts: '脚本管理',
    works: '作品管理',
    blogs: '博客管理',
    messages: '留言管理',
    services: '工作站服务管理',
    records: '服务提交记录',
    audit: '审计记录',
    metrics: '看板统计 / 文档导出',
  };
  return titles[activeSection] || '管理后台';
}

function routeToSection(pathname: string, section?: string) {
  if (pathname.includes('/admin/invite-codes')) return 'invites';
  if (pathname.includes('/admin/users')) return 'users';
  if (pathname.includes('/admin/contents')) return 'scripts';
  if (pathname.includes('/admin/workstation/services')) return 'services';
  if (pathname.includes('/admin/scripts')) return 'scripts';
  if (pathname.includes('/admin/works')) return 'works';
  if (pathname.includes('/admin/blogs')) return 'blogs';
  if (pathname.includes('/admin/messages')) return 'messages';
  if (pathname.includes('/admin/service-requests')) return 'records';
  if (pathname.includes('/admin/audit-logs')) return 'audit';
  if (pathname.includes('/admin/dashboard/snapshots') || pathname.includes('/admin/exports')) return 'metrics';
  const sectionMap: Record<string, string> = {
    inviteCodes: 'invites',
    'invite-codes': 'invites',
    contents: 'scripts',
    users: 'users',
    scripts: 'scripts',
    works: 'works',
    blogs: 'blogs',
    messages: 'messages',
    services: 'services',
    records: 'records',
    audit: 'audit',
    metrics: 'metrics',
  };
  return section ? (sectionMap[section] || section) : 'overview';
}

function sectionToRoute(section: string) {
  const routes: Record<string, string> = {
    overview: '/admin',
    invites: '/admin/invite-codes',
    users: '/admin/users',
    scripts: '/admin/scripts',
    works: '/admin/works',
    blogs: '/admin/blogs',
    messages: '/admin/messages',
    services: '/admin/workstation/services',
    records: '/admin/service-requests',
    audit: '/admin/audit-logs',
    metrics: '/admin/dashboard/snapshots',
  };
  return routes[section] || '/admin';
}
