# 需求追踪矩阵 RTM: 拾光筑梦 Lumitime

版本：v0.1  
日期：2026-06-12  
适用阶段：需求评审 / 设计评审 / 开发跟踪 / 测试验收 / 上线评审  
关联文档：PRD、权限矩阵、信息架构、接口设计、数据模型、视觉交互、测试计划、开发计划、概要设计、详细设计、运维手册

## 1. 文档目的

需求追踪矩阵用于确保每个产品需求都有对应的设计、接口、数据模型、开发任务和测试用例覆盖。

它解决的问题：

- PRD 中的需求是否都有设计落点。
- 设计中的模块是否都有开发任务。
- 核心接口和数据表是否都有测试覆盖。
- 权限、隐私、安全等高风险要求是否可验收。
- 后续需求变更时，能快速判断影响范围。

## 2. 状态定义

| 状态 | 含义 |
| --- | --- |
| Covered | 已有明确设计、接口 / 数据、开发任务和测试用例覆盖 |
| Partial | 已有部分覆盖，但仍有待确认或待补充 |
| Pending | 尚未覆盖，需要补充设计、开发任务或测试 |
| Deferred | 明确后置到二期或后续版本 |

## 3. 用户故事追踪矩阵

| PRD ID | 需求名称 | 设计覆盖 | 接口 / 数据覆盖 | 开发任务 | 测试用例 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US-001 | 最简约登录页面 | 视觉交互设计、信息架构、详细设计 | `/api/v1/auth/login`、`users` | T1.5、T2.2、T2.3、T2.4、T6.1、T6.2 | AUTH-001、AUTH-002、AUTH-003、AUTH-004、VIS-001、VIS-002、VIS-003、VIS-004 | Covered | 登录页主视觉和反转动画纳入一期 |
| US-002 | 邀请码注册 | 接口设计、数据模型、详细设计 | `/api/v1/auth/register-with-invite`、`invite_codes`、`invite_code_usages` | T1.6、T3.3 | AUTH-005、AUTH-006、AUTH-007 | Covered | 注册成功是否自动登录仍可在 UI 阶段确认 |
| US-003 | 主页与角色感知导航 | 信息架构、权限矩阵、视觉交互设计 | 当前用户接口、角色权限 | T2.1、T2.5 | HOME-001、HOME-002、HOME-003、HOME-004、PERM-001、PERM-002 | Covered | 访客看到邀请模块锁定状态 |
| US-004 | 管理员内容管理 | 权限矩阵、接口设计、数据模型、详细设计 | `/api/v1/admin/contents`、`content_items`、`content_attachments` | T3.5、T3.6、T3.7、T3.8、T3.10 | ADMIN-004、ADMIN-005、ADMIN-006 | Covered | 管理员是唯一内容管理者 |
| US-005 | 脚本分享页面 | 权限矩阵、信息架构、接口设计 | `/api/v1/scripts`、`content_items.type=script` | T2.7、T3.5 | SCRIPT-001、SCRIPT-002、SCRIPT-003、SCRIPT-004、SCRIPT-005 | Covered | 脚本只提供代码文本，允许复制，不提供文件下载 |
| US-006 | 个人作品分享页面 | 权限矩阵、信息架构、接口设计、数据模型 | `/api/v1/works`、`content_items.type=work`、`content_attachments` | T2.8、T3.6、T3.7 | WORKS-001、WORKS-002、WORKS-003、WORKS-004、WORKS-005 | Covered | 压缩包下载由管理员按作品配置 |
| US-007 | 个人经验心得分享 | 权限矩阵、信息架构、接口设计 | `/api/v1/blogs`、`content_items.type=blog` | T2.9、T3.8 | BLOG-001、BLOG-002、BLOG-003 | Covered | 所有邀请用户可查看已发布博客 |
| US-008 | 随记 / 留言板 | 权限矩阵、接口设计、数据模型、详细设计 | `/api/v1/messages`、`messages` | T2.10、T2.11、T3.9 | MSG-001、MSG-002、MSG-003、MSG-004、MSG-005 | Covered | 留言立即公开，管理员可隐藏 / 删除 |
| US-009 | 工作站与服务权限 | 权限矩阵、信息架构、概要设计、详细设计 | `/api/v1/workstation/services`、`workstation_services` | T4.1、T4.2 | STATION-001、STATION-002 | Covered | 已从“表单工作区”调整为“服务集合”；首版所有邀请用户可见全部服务 |
| US-010 | 日志自动提交服务接口预留 | 服务记录设计、接口设计、详细设计 | `/api/v1/workstation/services/{service_id}/requests`、`service_requests` | T4.3、T4.4、T4.5、T4.6、T4.9、T4.10 | STATION-003、STATION-004、REC-003 | Covered | 首版用模拟脚本验证异步流程 |
| US-011 | 日志自动提交隐私与追溯 | 权限矩阵、服务记录设计、数据模型、详细设计 | `service_requests`、`service_execution_logs`、`service_audits`、`audit_logs` | T4.7、T4.8、T4.11、T4.12、T4.13 | PRIV-001 至 PRIV-010、RECORD-001 至 RECORD-004、ADMIN-008、ADMIN-009、ADMIN-010 | Covered | 密码不保存；账号只存掩码和不可逆哈希；完整日志仅管理员看脱敏版 |
| US-012 | 公开大屏看板 | 信息架构、视觉交互设计、接口设计、数据模型 | `/api/v1/dashboard/metrics`、`daily_metric_snapshots`、`visit_events` | T5.1、T5.2、T5.3、T5.5、T5.6、T5.7 | DASH-001、DASH-002、DASH-003、PERF-003 | Covered | 只展示公开聚合数据 |
| US-013 | 日度统计记录文档 | 接口设计、数据模型、详细设计、运维手册 | `/api/v1/admin/exports/dashboard-snapshots.csv`、`export_jobs` | T5.4、T5.8、T5.10 | EXPORT-001、DASH-004 | Covered | 首版导出 CSV，PDF / Markdown 后续可扩展 |

## 4. 功能需求分组追踪矩阵

| 功能范围 | PRD FR 范围 | 设计文档 | 核心接口 | 核心数据对象 | 测试覆盖 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 认证与邀请码 | FR-1 至 FR-7 | 接口设计、数据模型、详细设计 | `/auth/login`、`/auth/logout`、`/auth/me`、`/auth/register-with-invite` | `users`、`invite_codes`、`invite_code_usages` | AUTH-001 至 AUTH-008 | Covered |
| 角色权限 | FR-8 至 FR-13 | 权限矩阵、详细设计、测试计划 | 所有受限 API 鉴权 | `users.role`、会话信息 | PERM-001 至 PERM-005、API-003、API-004 | Covered |
| 主页 | FR-14 至 FR-17 | 信息架构、视觉交互设计 | 当前用户接口 | 用户会话 | HOME-001 至 HOME-004 | Covered |
| 后台管理 | FR-18 至 FR-23 | 信息架构、接口设计、详细设计 | `/admin/*` | `content_items`、`messages`、`users`、`invite_codes` | ADMIN-001 至 ADMIN-011 | Covered |
| 脚本分享 | FR-24 至 FR-27 | 权限矩阵、接口设计、数据模型 | `/scripts`、`/scripts/{id}` | `content_items` | SCRIPT-001 至 SCRIPT-005 | Covered |
| 个人作品 | FR-28 至 FR-31 | 权限矩阵、接口设计、数据模型 | `/works`、附件下载接口 | `content_items`、`content_attachments` | WORKS-001 至 WORKS-005 | Covered |
| 经验心得 / 博客 | FR-32 至 FR-34 | 信息架构、接口设计、数据模型 | `/blogs`、`/blogs/{id}` | `content_items` | BLOG-001 至 BLOG-003 | Covered |
| 留言板 | FR-35 至 FR-39 | 权限矩阵、接口设计、详细设计 | `/messages`、`/admin/messages/*` | `messages` | MSG-001 至 MSG-005 | Covered |
| 工作站服务 | FR-40 至 FR-45 | 概要设计、详细设计、接口设计 | `/workstation/services`、服务请求接口 | `workstation_services`、`service_requests` | STATION-001、STATION-002、RECORD-001 至 RECORD-004 | Covered |
| 日志自动提交 | FR-46 至 FR-53 | 服务记录设计、详细设计、数据模型 | 服务请求、轮询、重试、日志接口 | `service_requests`、`service_execution_logs`、`service_audits` | STATION-003 至 STATION-011、PRIV-001 至 PRIV-010 | Covered |
| 大屏看板 | FR-54 至 FR-64 | 信息架构、视觉交互、接口设计 | `/dashboard/metrics` | `daily_metric_snapshots`、`visit_events` | DASH-001 至 DASH-003 | Covered |
| 日度统计记录 | FR-65 至 FR-68 | 接口设计、详细设计、运维手册 | 统计导出 CSV | `daily_metric_snapshots`、`export_jobs` | EXPORT-001、DASH-004 | Covered |

## 5. 高风险需求追踪

| 风险需求 | 要求 | 设计覆盖 | 测试覆盖 | 状态 |
| --- | --- | --- | --- | --- |
| 学生学习 App 密码不保存 | 不入库、不哈希、不掩码、不导出 | 权限矩阵、服务记录设计、数据模型、详细设计 | PRIV-001、PRIV-005、PRIV-007、EXPORT-003 | Covered |
| 学生学习 App 完整账号不保存 | 只存掩码和不可逆哈希 | 数据模型、详细设计 | PRIV-002、PRIV-006 | Covered |
| 执行日志脱敏 | 先脱敏再存储 | 服务记录设计、详细设计 | PRIV-003、PRIV-004、ADMIN-009 | Covered |
| 邀请用户只能看自己的记录 | 数据查询绑定当前用户 | 权限矩阵、详细设计 | RECORD-001、RECORD-002 | Covered |
| 管理员后台不可越权 | 仅 admin 可访问 | 权限矩阵、详细设计 | PERM-001、PERM-002、ADMIN-011 | Covered |
| 大屏只展示聚合数据 | 不展示隐私明细 | 信息架构、接口设计、数据模型 | DASH-001、DASH-002 | Covered |
| 作品附件下载受控 | 按作品配置 `allow_download` | 权限矩阵、接口设计、数据模型 | WORKS-003、WORKS-004 | Covered |
| Docker 更新不丢数据 | 数据库和附件持久化 | 概要设计、运维手册 | 上线检查清单，后续部署验收 | Partial |
| 真实脚本接入 | 当前仅模拟脚本 | 开发计划 V0.3 | 后续联调用例待补充 | Deferred |

## 6. 开发任务覆盖汇总

| 里程碑 | 覆盖需求 | 关键测试 |
| --- | --- | --- |
| Week 1: 项目基础与认证权限 | US-001、US-002、US-003 权限基础 | AUTH、PERM、API 鉴权 |
| Week 2: 公开页面与内容展示 | US-003、US-005、US-006、US-007、US-008 | HOME、SCRIPT、WORKS、BLOG、MSG |
| Week 3: 管理后台与内容管理 | US-004、邀请码、用户、内容、留言管理 | ADMIN、权限、附件下载 |
| Week 4: 工作站服务与模拟日志提交 | US-009、US-010、US-011 | STATION、RECORD、PRIV、REC |
| Week 5: 大屏、统计、导出 | US-012、US-013 | DASH、EXPORT、PERF |
| Week 6: 视觉、安全回归、测试部署 | 登录主视觉、安全回归、兼容性 | VIS、COMP、PERF、全量 P0/P1 |

## 7. 待补充追踪项

以下内容不阻塞首版 RTM，但后续需要补充：

- 真实日志自动提交脚本接入后的专项测试用例。
- Docker Compose 部署完成后的部署验收用例。
- UI 高保真稿完成后的视觉验收截图或设计稿链接。
- 访问明细保留天数确认后的清理任务测试。
- 备份恢复演练完成后的运维验收记录。
- `developer_count` 最终统计口径确认后的测试用例。

