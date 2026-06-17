# PRD: 拾光筑梦 Lumitime 个人工作站

版本：v1.0  
日期：2026-06-12  
当前阶段：产品需求文档，不进入开发实现  
产品名称：拾光筑梦 Lumitime  
英文释义：lumi 微光 + time 时光，呼应拉丁语词根 lux/lumen（光、微光）  
品牌句：Every faint light of time, paves the way for your dream.

## 1. Introduction / Overview

拾光筑梦 Lumitime 是一个个人工作站网页，用于沉淀个人脚本、作品、技术经验、随记留言与工作协作内容。产品的核心价值是把个人过往的项目、知识、工具与协作场景统一收拢，形成一个有权限边界、可持续扩展、可被邀请用户访问的个人数字工作空间。

首版目标不是完整开发上线，而是完成一份可用于后续设计、开发和验收的 PRD。首版产品范围包括最简约登录页面、主页、三类权限角色、内容分享模块、留言板、工作站模块、日志自动提交临时工作栏目接口预留，以及公开大屏看板。

## 2. Goals

- 明确 Lumitime 个人工作站的一期产品范围、角色权限和页面结构。
- 支持管理员通过后台管理内容、邀请码、用户和工作区权限。
- 支持邀请用户访问脚本、个人作品、技术博客和授权工作区。
- 支持访客访问随记留言板和公开大屏看板。
- 为“日志自动提交”临时工作栏目预留页面和接口，不在一期接入真实脚本。
- 明确学生学习 App 账号密码的隐私处理规则：账号密码不保存，仅用于当次提交；系统保留非敏感审计记录用于追溯。
- 定义大屏看板的指标、日度变化和记录文档生成能力。

## 3. Users And Permissions

### 3.1 角色定义

| 角色 | 定义 | 核心权限 |
| --- | --- | --- |
| 管理员 | 站点拥有者或被授权维护者 | 管理邀请码、用户、内容、工作区、留言、看板统计、审计记录 |
| 邀请用户 | 通过管理员邀请码注册并登录的用户 | 访问脚本分享、个人作品、经验心得、授权工作区，可参与工作内容提交 |
| 访客 | 未登录用户 | 访问公开主页、随记留言板、公开大屏看板，可提交留言 |

### 3.2 权限原则

- 默认最小权限：未明确授权的内容不可访问。
- 内容权限按模块、内容状态和工作区授权共同判断。
- 工作站内不同工作区可以配置不同访问权限。
- 管理员可以禁用邀请码、封禁用户、隐藏内容、删除或屏蔽留言。
- 大屏看板对所有人可见，但仅展示聚合统计，不展示具体用户隐私数据。

## 4. Scope

### 4.1 In Scope

- 简约登录页面。
- 主页与角色感知导航。
- 邀请码注册机制。
- 管理员后台内容管理。
- 脚本分享页面。
- 个人作品分享页面。
- 个人经验心得分享页面。
- 随记 / 留言板。
- 工作站与工作区权限模型。
- 日志自动提交临时工作栏目的页面与接口预留。
- 公开大屏看板。
- 日度统计快照与记录文档生成需求。
- 隐私与审计追溯要求。

### 4.2 Out Of Scope For Current PRD Stage

- 不实现代码开发。
- 不接入真实学生学习 App。
- 不执行日志自动提交脚本。
- 不保存学生学习 App 的明文账号和密码。
- 不实现在线支付、会员、私信、实时聊天。
- 不实现复杂 CMS、多租户 SaaS、公开社区推荐流。
- 不开放第三方 OAuth 登录，除非后续单独立项。

## 5. User Stories

### US-001: 简约登录页面

**Description:** As a visitor, I want to log in to Lumitime using my site account so that I can access invitation-only content.

**Acceptance Criteria:**

- [ ] 登录页展示产品名称“拾光筑梦 Lumitime”和简洁品牌句。
- [ ] 用户可以输入 Lumitime 站点账号和密码。
- [ ] 登录失败时展示明确错误提示，不暴露账号是否存在的敏感判断。
- [ ] 登录成功后跳转到主页。
- [ ] 页面提供“邀请码注册”入口。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: 邀请码注册

**Description:** As an invited user, I want to register with an invite code so that I can become an invited user of the workstation.

**Acceptance Criteria:**

- [ ] 用户可以输入邀请码、用户名、密码完成注册。
- [ ] 系统校验邀请码是否存在、未过期、未超限、未禁用。
- [ ] 注册成功后用户角色默认为“邀请用户”。
- [ ] 已使用的邀请码记录使用人、使用时间和来源 IP。
- [ ] 管理员可以查看邀请码使用记录。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: 主页与角色感知导航

**Description:** As any user, I want to see a clear home page so that I can understand what I can access.

**Acceptance Criteria:**

- [ ] 未登录访客可见公开入口：随记、公开大屏看板、登录 / 注册。
- [ ] 邀请用户登录后可见脚本分享、个人作品、经验心得、授权工作站、大屏看板、随记。
- [ ] 管理员登录后额外可见后台管理入口。
- [ ] 用户访问无权限模块时，系统展示登录或无权限提示。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: 管理员内容管理

**Description:** As an admin, I want to upload and edit content so that the site can continuously publish scripts, works, blogs, notes, and work items.

**Acceptance Criteria:**

- [ ] 管理员可以新增、编辑、下架、删除脚本内容。
- [ ] 管理员可以新增、编辑、下架、删除个人作品内容。
- [ ] 管理员可以新增、编辑、下架、删除经验心得文章。
- [ ] 管理员可以管理留言显示状态。
- [ ] 管理员可以配置内容的可见范围。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: 脚本分享页面

**Description:** As an invited user, I want to view simple single-file scripts so that I can learn from or use the shared tools.

**Acceptance Criteria:**

- [ ] 邀请用户可以查看脚本列表。
- [ ] 脚本卡片展示名称、语言、用途简介、版本、更新时间。
- [ ] 脚本详情页展示代码文件、使用说明、注意事项。
- [ ] 未登录访客访问脚本页时被要求登录。
- [ ] 管理员可以配置脚本是否允许下载或复制。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: 个人作品分享页面

**Description:** As an invited user, I want to view larger personal works so that I can understand the creator's projects, software copyrights, patents, papers, and related achievements.

**Acceptance Criteria:**

- [ ] 邀请用户可以查看个人作品列表。
- [ ] 作品支持分类：项目、软著、专利、论文、其他。
- [ ] 作品详情页展示标题、摘要、时间、标签、附件或外部链接。
- [ ] 管理员可以上传附件或填写外部链接。
- [ ] 未授权用户不能查看作品详情。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: 个人经验心得分享

**Description:** As an invited user, I want to read technical blogs so that I can learn from accumulated experience.

**Acceptance Criteria:**

- [ ] 邀请用户可以查看技术博客列表。
- [ ] 博客支持标题、摘要、正文、标签、发布时间、更新时间。
- [ ] 博客支持草稿、已发布、下架状态。
- [ ] 管理员可以编辑和发布博客。
- [ ] 访客不能访问邀请用户限定的博客正文。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-008: 随记 / 留言板

**Description:** As a visitor, I want to leave a short message so that I can interact with the workstation owner.

**Acceptance Criteria:**

- [ ] 访客无需登录即可查看公开随记。
- [ ] 访客可以填写昵称、留言内容并提交。
- [ ] 留言提交后默认进入待审核或公开状态，具体策略由管理员配置。
- [ ] 系统具备基础防刷机制，例如频率限制、验证码或内容长度限制。
- [ ] 管理员可以隐藏、删除、恢复留言。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-009: 工作站与工作区权限

**Description:** As an admin, I want to create workspaces with different permissions so that different users can access different work content.

**Acceptance Criteria:**

- [ ] 管理员可以创建工作区。
- [ ] 每个工作区可以配置可访问用户或用户组。
- [ ] 管理员可以在工作区内创建表单类工作内容。
- [ ] 邀请用户只能看到自己被授权的工作区。
- [ ] 用户填写表单后，系统生成提交记录。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-010: 日志自动提交临时工作栏目接口预留

**Description:** As an admin, I want to reserve a page and API contract for log auto-submission so that the existing automation script can be connected later.

**Acceptance Criteria:**

- [ ] 工作站内存在“日志自动提交”临时工作栏目。
- [ ] 一期仅展示占位页面和接口说明，不调用真实脚本。
- [ ] 页面预留学生学习 App 账号和密码输入字段，但默认不可提交真实任务，或提交后返回“暂未接入”状态。
- [ ] 接口请求体定义包含 student_account、student_password、task_config、workspace_id。
- [ ] student_account 和 student_password 不写入数据库、日志、统计系统、错误追踪系统或浏览器持久缓存。
- [ ] 每次请求生成 request_id，用于后续问题追溯。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-011: 日志自动提交隐私与追溯

**Description:** As an admin, I want each submission to be traceable without storing private credentials so that issues can be investigated later.

**Acceptance Criteria:**

- [ ] 系统保存 request_id、Lumitime 用户 ID、工作区 ID、操作类型、提交时间、来源 IP、User-Agent、接口版本、脚本版本占位字段。
- [ ] 系统保存学生账号的不可逆哈希和可选掩码值，例如 `abc***789`；不得保存明文学生账号。
- [ ] 系统不得保存学生密码的明文、哈希、掩码或派生值。
- [ ] 日志中不得出现 student_account 或 student_password 原始字段值。
- [ ] 审计记录可由管理员按 request_id、Lumitime 用户、时间范围检索。
- [ ] 审计记录至少保留 180 天，具体周期可由管理员配置。
- [ ] Typecheck/lint passes.

### US-012: 公开大屏看板

**Description:** As any user, I want to see public aggregated metrics so that I can understand the site's current scale and daily changes.

**Acceptance Criteria:**

- [ ] 访客、邀请用户、管理员均可访问大屏看板。
- [ ] 看板展示网站用户数、开发者数、访问数、个人作品数、脚本数、博客数、随记数、工作组数。
- [ ] 看板展示上述指标的日度变化趋势。
- [ ] 看板仅展示聚合数据，不展示用户列表、IP、账号、留言原文等隐私数据。
- [ ] 看板支持按近 7 天、近 30 天、近 90 天查看趋势。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-013: 日度统计记录文档

**Description:** As an admin, I want the dashboard metrics to generate daily records so that historical changes can be reviewed.

**Acceptance Criteria:**

- [ ] 系统每日生成一条统计快照。
- [ ] 统计快照包含指标值、较昨日变化值、生成时间。
- [ ] 管理员可以导出统计记录文档，格式优先支持 Markdown 或 PDF。
- [ ] 导出文档不得包含隐私明细。
- [ ] 导出失败时展示明确错误提示。
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 6. Functional Requirements

### 6.1 Authentication And Invitation

- FR-1: The system must provide a minimalist Lumitime login page.
- FR-2: The system must distinguish Lumitime site credentials from the student learning App credentials used by the future log automation workflow.
- FR-3: The system must allow users to register with an admin-generated invite code.
- FR-4: The system must validate invite code status, expiration, usage limit, and disabled state.
- FR-5: The system must assign the “invited_user” role to users who register by invite code.
- FR-6: The system must allow admins to create, disable, expire, and review invite codes.
- FR-7: The system must store password hashes for Lumitime site accounts, never plaintext passwords.

### 6.2 Role-Based Access Control

- FR-8: The system must support three roles: admin, invited_user, visitor.
- FR-9: The system must deny visitor access to scripts, personal works, blogs, and restricted workspaces.
- FR-10: The system must allow visitors to access the message board and public dashboard.
- FR-11: The system must allow invited users to access scripts, works, blogs, and authorized workspaces.
- FR-12: The system must allow admins to access all modules and management views.
- FR-13: The system must enforce permissions on both frontend navigation and backend APIs.

### 6.3 Home Page

- FR-14: The system must provide a public home page introducing “拾光筑梦 Lumitime”.
- FR-15: The home page must show role-aware navigation.
- FR-16: The home page must show unavailable modules as locked or require login when viewed by visitors.
- FR-17: The home page must provide quick access to login, invite registration, message board, and dashboard.

### 6.4 Admin Management

- FR-18: The system must provide admin views for content management.
- FR-19: Admins must be able to create, edit, publish, unpublish, and delete scripts.
- FR-20: Admins must be able to create, edit, publish, unpublish, and delete personal works.
- FR-21: Admins must be able to create, edit, publish, unpublish, and delete blog posts.
- FR-22: Admins must be able to moderate visitor messages.
- FR-23: Admins must be able to manage workspaces and workspace permissions.

### 6.5 Script Sharing

- FR-24: The system must display a script list for invited users.
- FR-25: Each script must support metadata: title, description, language, version, update date, tags, visibility, file content or file attachment.
- FR-26: The script detail page must show usage instructions and risk notes.
- FR-27: Admins must be able to configure whether a script can be copied or downloaded.

### 6.6 Personal Works

- FR-28: The system must display a personal works list for invited users.
- FR-29: Personal works must support categories: project, software copyright, patent, paper, other.
- FR-30: Each work must support metadata: title, summary, category, tags, date, attachments, external links, visibility.
- FR-31: The work detail page must support larger project descriptions and multiple attachments.

### 6.7 Blog / Experience Sharing

- FR-32: The system must display a blog list for invited users.
- FR-33: Blog posts must support title, summary, body, tags, status, created time, updated time.
- FR-34: Blog posts must support draft, published, and unpublished states.

### 6.8 Message Board

- FR-35: The system must allow visitors to view public messages.
- FR-36: The system must allow visitors to submit a message with nickname and content.
- FR-37: The system must apply rate limits to visitor message submission.
- FR-38: The system must allow admins to moderate messages.
- FR-39: The system must record message submission time and basic audit information.

### 6.9 Workstation And Workspaces

- FR-40: The system must provide a workstation module.
- FR-41: Admins must be able to create multiple workspaces.
- FR-42: Each workspace must support independent access permissions.
- FR-43: Admins must be able to create form-based work items inside a workspace.
- FR-44: Invited users must be able to submit authorized forms.
- FR-45: The system must store form submissions and allow admins to review them.

### 6.10 Log Auto-Submission Temporary Column

- FR-46: The workstation must include a temporary column named “日志自动提交”.
- FR-47: In the PRD-defined first version, this column must only reserve UI and API contracts.
- FR-48: The reserved API must accept student learning App credentials only in the current request lifecycle.
- FR-49: The reserved API must return a placeholder status such as `not_integrated` before the real script is connected.
- FR-50: The system must generate a unique `request_id` for every attempted submission.
- FR-51: The system must not persist student learning App plaintext account or password.
- FR-52: The system must not log student learning App plaintext account or password.
- FR-53: The system must store traceable audit metadata without storing private credentials.

### 6.11 Dashboard

- FR-54: The system must provide a public dashboard.
- FR-55: The dashboard must display total user count.
- FR-56: The dashboard must display developer count.
- FR-57: The dashboard must display visit count.
- FR-58: The dashboard must display personal work count.
- FR-59: The dashboard must display script count.
- FR-60: The dashboard must display blog count.
- FR-61: The dashboard must display message count.
- FR-62: The dashboard must display workspace / workgroup count.
- FR-63: The dashboard must display daily changes for each metric.
- FR-64: The dashboard must avoid exposing user-level private data.

### 6.12 Daily Metric Record

- FR-65: The system must generate daily metric snapshots.
- FR-66: The system must support exporting metric snapshots as a record document.
- FR-67: The exported document must include metric name, current value, daily delta, snapshot date, and generation time.
- FR-68: The exported document must exclude private personal identifiers and raw access logs.

## 7. Suggested Data Objects

### User

- id
- username
- display_name
- role: admin | invited_user
- password_hash
- status: active | disabled
- created_at
- last_login_at

### InviteCode

- id
- code
- status: active | disabled | expired
- usage_limit
- used_count
- expires_at
- created_by
- created_at

### ContentItem

- id
- type: script | work | blog
- title
- summary
- body
- category
- tags
- status: draft | published | unpublished
- visibility: invited_only | admin_only
- created_by
- created_at
- updated_at

### Attachment

- id
- content_id
- filename
- file_type
- file_size
- storage_url
- created_at

### Message

- id
- nickname
- content
- status: pending | visible | hidden | deleted
- submit_ip_hash
- created_at
- moderated_by
- moderated_at

### Workspace

- id
- name
- description
- status
- created_by
- created_at

### WorkspacePermission

- id
- workspace_id
- user_id
- permission: view | submit | manage
- created_at

### WorkItem

- id
- workspace_id
- type: form | automation_placeholder
- title
- description
- schema
- status
- created_at

### WorkSubmission

- id
- work_item_id
- workspace_id
- submitted_by
- submission_payload
- status
- created_at

### AutomationRequestAudit

- id
- request_id
- lumitime_user_id
- workspace_id
- work_item_id
- action
- student_account_hash
- student_account_masked
- credential_persisted: false
- source_ip_hash
- user_agent
- interface_version
- script_version
- request_status
- error_code
- created_at

### DailyMetricSnapshot

- id
- snapshot_date
- user_count
- developer_count
- visit_count
- work_count
- script_count
- blog_count
- message_count
- workspace_count
- deltas_json
- generated_at

## 8. API Contract Draft

### Authentication

- `POST /api/auth/login`
  - Purpose: Lumitime site login.
  - Request: username, password.
  - Response: user profile, role, session token or cookie.

- `POST /api/auth/register-with-invite`
  - Purpose: Register invited user by invite code.
  - Request: invite_code, username, password, display_name.
  - Response: created user profile.

### Admin

- `POST /api/admin/invite-codes`
- `PATCH /api/admin/invite-codes/{id}`
- `GET /api/admin/invite-codes`
- `POST /api/admin/content`
- `PATCH /api/admin/content/{id}`
- `DELETE /api/admin/content/{id}`
- `POST /api/admin/workspaces`
- `PATCH /api/admin/workspaces/{id}/permissions`

### Content

- `GET /api/scripts`
- `GET /api/scripts/{id}`
- `GET /api/works`
- `GET /api/works/{id}`
- `GET /api/blogs`
- `GET /api/blogs/{id}`

### Message Board

- `GET /api/messages`
- `POST /api/messages`
- `PATCH /api/admin/messages/{id}`

### Workstation

- `GET /api/workspaces`
- `GET /api/workspaces/{id}/work-items`
- `POST /api/work-items/{id}/submissions`

### Reserved Log Auto-Submission API

- `POST /api/workstation/log-auto-submit/requests`
  - Purpose: Reserve API for future log auto-submission script integration.
  - Current behavior: Validate permission, create traceable audit record, return `not_integrated`.
  - Request:

```json
{
  "workspace_id": "workspace_001",
  "work_item_id": "work_item_log_auto_submit",
  "student_account": "student app account, not persisted",
  "student_password": "student app password, not persisted",
  "task_config": {
    "target_date": "2026-06-12",
    "remark": "optional"
  }
}
```

  - Response:

```json
{
  "request_id": "req_20260612_000001",
  "status": "not_integrated",
  "message": "日志自动提交脚本暂未接入，当前仅完成接口预留。"
}
```

  - Persistence rule:
    - Persist request_id, Lumitime user ID, workspace ID, work item ID, source metadata, student_account_hash, optional student_account_masked, status.
    - Do not persist student_account plaintext.
    - Do not persist student_password plaintext, hash, masked value, or derived value.
    - Do not emit credentials to logs, analytics, error monitoring, browser storage, or exported records.

### Dashboard

- `GET /api/dashboard/metrics?range=7d|30d|90d`
- `GET /api/dashboard/snapshots`
- `POST /api/admin/dashboard/export-record`

## 9. Design Considerations

- Visual style should be minimal, quiet, and personal rather than corporate-heavy.
- Login page should use brand name, concise background phrase, and one focused form.
- Home page should surface the workstation modules directly instead of a marketing-style landing page.
- Navigation should clearly separate public modules and invitation-only modules.
- Gated modules should show a login prompt, not a blank page.
- Admin management should prioritize efficient table/list operations over decorative cards.
- Dashboard should be readable on large screens with numeric tiles and trend lines.
- Public dashboard must not expose sensitive details.

## 10. Technical Considerations

- Use role-based access control on the server side; frontend hiding alone is insufficient.
- Use secure password hashing for Lumitime site credentials.
- Use HTTP-only secure cookies or equivalent secure session handling.
- Uploaded attachments should use file type, size, and malware checks before storage.
- Content body should be sanitized to avoid XSS.
- Visitor message submissions need rate limiting and anti-spam protection.
- Dashboard visit counting should avoid double-count inflation where practical, for example by session/day aggregation.
- Audit logs should be append-only where possible.
- The reserved automation API should implement credential redaction middleware before any request logging.
- Error handling for the future automation workflow must never include submitted credentials.

## 11. Privacy, Security, And Compliance Requirements

- PS-1: Student learning App credentials are separate from Lumitime login credentials.
- PS-2: Student learning App account and password are only used for the current request.
- PS-3: Student learning App plaintext account must not be stored.
- PS-4: Student learning App password must not be stored in any form.
- PS-5: Traceability must be achieved through Lumitime user ID, request_id, timestamps, workspace IDs, request status, source metadata, and irreversible student account hash.
- PS-6: Admin audit views must redact sensitive fields by default.
- PS-7: Exported dashboard records must include only aggregated metrics.
- PS-8: Logs must apply sensitive-field filtering before persistence.
- PS-9: The UI must inform users that student learning App credentials are used only for the current submission and are not stored.

## 12. Success Metrics

- PRD review passes with all core modules, permissions, and privacy boundaries clearly documented.
- Future developer can split the PRD into implementation tasks without needing to redefine product scope.
- All role permissions can be verified against the requirements table.
- Reserved log auto-submission API has enough detail for later script integration.
- Dashboard metrics and daily record requirements are explicit enough for backend and frontend implementation.
- Privacy rules prevent accidental persistence of student learning App passwords.

## 13. Non-Goals

- No real automation execution in the current PRD stage.
- No storage of student learning App passwords.
- No public access to scripts, personal works, blogs, or restricted workspaces.
- No social feed, comments under each blog, likes, follows, or recommendations.
- No full enterprise permission matrix beyond admin, invited user, and visitor for the first version.
- No mobile native App.
- No monetization features.

## 14. Open Questions

- 是否需要“开发者数”单独对应一个角色，还是从管理员配置的开发者标签中统计？
- 个人作品中的软著、专利、论文附件是否需要水印或防下载？
- 随记留言默认是否公开，还是默认待审核？
- 工作站表单是否需要支持文件上传？
- 大屏看板的访问数是否按 PV、UV、登录用户访问数分别统计？
- 日度统计记录文档优先导出 Markdown、PDF，还是两者都要？
- 日志自动提交脚本接入后，是否需要支持定时任务？当前用户选择为“不保存账号密码”，因此定时任务需要另行设计授权方式。

## 15. Initial Information Architecture

```text
Lumitime
├─ 登录 / 邀请码注册
├─ 主页
│  ├─ 脚本分享（邀请用户）
│  ├─ 个人作品（邀请用户）
│  ├─ 经验心得（邀请用户）
│  ├─ 随记 / 留言板（访客可见）
│  ├─ 工作站（按工作区授权）
│  │  ├─ 普通表单工作内容
│  │  └─ 日志自动提交（临时栏目，接口预留）
│  └─ 大屏看板（公开聚合统计）
└─ 管理后台（管理员）
   ├─ 邀请码管理
   ├─ 用户管理
   ├─ 内容管理
   ├─ 工作区管理
   ├─ 留言管理
   ├─ 审计记录
   └─ 看板统计记录导出
```

