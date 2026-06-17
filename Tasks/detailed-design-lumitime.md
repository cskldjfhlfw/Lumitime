# 详细设计文档: 拾光筑梦 Lumitime

版本：v0.1  
日期：2026-06-12  
适用阶段：详细设计 / 开发实现 / 代码评审 / 联调测试  
关联文档：PRD、概要设计、接口设计、数据模型设计、测试计划

## 1. 设计范围

本文档在概要设计基础上，细化 Lumitime 首版核心模块的实现流程、状态流转、关键校验和伪代码。

覆盖模块：

- 认证与会话。
- 邀请码注册。
- 统一鉴权与权限判断。
- 内容管理与前台访问。
- 留言。
- 工作站服务。
- Worker 与脚本执行。
- 日志脱敏。
- 服务提交记录。
- CSV 导出。
- 大屏统计快照。
- 审计记录。

不覆盖：

- 具体技术栈代码。
- 具体 UI 组件实现。
- 具体数据库 SQL DDL。
- 真实学校系统脚本内部逻辑。

## 2. 关键设计决策

| 项目 | 决策 |
| --- | --- |
| 详细设计深度 | 模块流程 + 关键伪代码 |
| 认证会话 | 登录、退出、注册、Cookie / Session 安全建议、密码哈希、登录失败处理 |
| 权限实现 | 统一鉴权中间件 + 模块内二次权限判断 |
| 脚本调用 | 抽象为 `ScriptRunner`，后续可接命令行或内部模块 |
| Worker 并发 | 首版串行执行，后续扩展有限并发 |
| 日志脱敏 | 字段白名单 + 关键字正则双重脱敏 |
| CSV 导出 | 首版同步导出，数据量大后升级异步 |
| 统计快照 | 每天定时生成，管理员可手动补生成 |

## 3. 认证与会话详细设计

### 3.1 登录流程

```text
用户提交 username/password
  ↓
参数校验
  ↓
按 username 查询用户
  ↓
用户不存在或密码错误
  └─ 返回统一错误
  ↓
用户被禁用
  └─ 返回账号不可用
  ↓
校验 password_hash
  ↓
创建登录会话
  ↓
记录 last_login_at
  ↓
写入登录审计
  ↓
按角色返回 redirect_to
```

伪代码：

```pseudo
function login(username, password):
    validateRequired(username, password)

    user = userRepo.findByUsername(username)
    if user is null:
        auditLoginFailed(username_masked)
        return error("INVALID_CREDENTIALS", "账号或密码错误。")

    if user.status == "disabled":
        auditLoginFailed(user.id)
        return error("ACCOUNT_DISABLED", "账号不可用。")

    if not verifyPassword(password, user.password_hash):
        auditLoginFailed(user.id)
        return error("INVALID_CREDENTIALS", "账号或密码错误。")

    session = sessionService.create(user.id, user.role)
    userRepo.updateLastLoginAt(user.id)
    auditLoginSuccess(user.id)

    redirect_to = "/admin" if user.role == "admin" else "/"
    return success({ user: publicUser(user), redirect_to })
```

安全要求：

- 登录失败统一提示，避免枚举账号。
- 密码只保存哈希。
- Session Cookie 建议设置 `HttpOnly`、`Secure`、`SameSite`。
- 管理员接口必须校验当前会话角色。

### 3.2 退出登录

```pseudo
function logout(current_session):
    sessionService.destroy(current_session.id)
    return success(null)
```

### 3.3 当前用户

```pseudo
function getCurrentUser(session):
    if session is invalid:
        return error("UNAUTHORIZED")
    user = userRepo.findById(session.user_id)
    return success(publicUser(user))
```

## 4. 邀请码注册详细设计

### 4.1 注册流程

```text
访客提交 invite_code、username、display_name、password
  ↓
参数校验
  ↓
检查用户名是否已存在
  ↓
查询邀请码
  ↓
校验邀请码状态、过期时间、使用次数
  ↓
创建 invited_user
  ↓
邀请码 used_count + 1
  ↓
写入 invite_code_usages
  ↓
写入审计记录
  ↓
返回注册成功
```

伪代码：

```pseudo
function registerWithInvite(input, request_meta):
    validate(input.invite_code, input.username, input.password)

    if userRepo.existsUsername(input.username):
        return error("CONFLICT", "用户名已存在。")

    invite = inviteRepo.findByCode(input.invite_code)
    if invite is null or invite.status != "active":
        return error("BAD_REQUEST", "邀请码不可用。")

    if invite.expires_at != null and now() > invite.expires_at:
        return error("BAD_REQUEST", "邀请码已过期。")

    if invite.used_count >= invite.usage_limit:
        return error("BAD_REQUEST", "邀请码使用次数已达上限。")

    tx.begin()
    user = userRepo.create({
        username,
        display_name,
        role: "invited_user",
        password_hash: hashPassword(input.password),
        status: "active"
    })
    inviteRepo.incrementUsedCount(invite.id)
    inviteUsageRepo.create({
        invite_code_id: invite.id,
        user_id: user.id,
        source_ip_hash: hashIp(request_meta.ip),
        user_agent_summary: summarizeUserAgent(request_meta.user_agent)
    })
    auditLog("register_with_invite", user.id)
    tx.commit()

    return created({ user_id: user.id, role: user.role })
```

## 5. 统一鉴权与权限判断

### 5.1 权限分层

```text
前端显示控制
  ↓
路由保护
  ↓
API 统一鉴权中间件
  ↓
模块内二次权限判断
  ↓
数据查询范围限制
```

### 5.2 统一鉴权中间件

伪代码：

```pseudo
function requireAuth(request):
    session = sessionService.get(request)
    if session is invalid:
        return error("UNAUTHORIZED", "请先登录。")

    request.current_user = userRepo.findById(session.user_id)
    if request.current_user.status != "active":
        return error("FORBIDDEN", "账号不可用。")

    next()
```

```pseudo
function requireRole(role):
    return function(request):
        requireAuth(request)
        if request.current_user.role != role:
            return error("FORBIDDEN", "无权限访问。")
        next()
```

### 5.3 模块内二次权限判断

示例：邀请用户查询服务请求详情。

```pseudo
function getServiceRequestDetail(current_user, service_request_id):
    record = serviceRequestRepo.findByPublicId(service_request_id)
    if record is null:
        return error("NOT_FOUND")

    if current_user.role == "admin":
        return success(adminView(record))

    if record.lumitime_user_id != current_user.id:
        return error("FORBIDDEN")

    return success(userView(record))
```

规则：

- 管理员可访问全量。
- 邀请用户只能访问自己的数据。
- 访客不能访问邀请用户接口。

## 6. 内容模块详细设计

### 6.1 内容创建 / 编辑

内容统一存储在 `content_items`。

类型：

- `script`
- `work`
- `blog`

管理员创建内容流程：

```text
管理员提交内容
  ↓
校验管理员权限
  ↓
校验 type 和必填字段
  ↓
按 type 校验专属字段
  ↓
保存 content_items
  ↓
写入审计
```

脚本专属校验：

- `code` 必填。
- `language` 建议必填。
- 不允许上传脚本文件作为下载附件。

作品专属校验：

- 可关联附件。
- 附件下载权限由 `allow_download` 控制。

博客专属校验：

- `body` 必填。

### 6.2 前台内容访问

```pseudo
function listContent(current_user, type):
    requireInvitedOrAdmin(current_user)
    return contentRepo.find({
        type,
        status: "published",
        deleted_at: null
    })
```

访客访问：

- 返回 `UNAUTHORIZED`。
- 或前端展示登录提示。

## 7. 附件下载详细设计

下载流程：

```text
用户请求下载附件
  ↓
校验登录状态
  ↓
查询附件与作品
  ↓
判断作品是否已发布
  ↓
判断角色
  ↓
管理员直接允许
  ↓
邀请用户需 allow_download = true
  ↓
生成临时下载响应
```

伪代码：

```pseudo
function downloadAttachment(current_user, work_id, attachment_id):
    requireInvitedOrAdmin(current_user)

    work = contentRepo.findPublishedWork(work_id)
    if work is null:
        return error("NOT_FOUND")

    attachment = attachmentRepo.findActive(attachment_id, work_id)
    if attachment is null:
        return error("NOT_FOUND")

    if current_user.role != "admin" and attachment.allow_download != true:
        return error("FORBIDDEN")

    auditLog("download_attachment", current_user.id, attachment.id)
    return fileStorage.createDownloadResponse(attachment.storage_key)
```

## 8. 留言模块详细设计

### 8.1 提交流程

```text
访客或登录用户提交 nickname/content
  ↓
校验长度和内容
  ↓
检查频率限制
  ↓
保存为 visible
  ↓
立即公开展示
```

伪代码：

```pseudo
function createMessage(input, request_meta):
    validateLength(input.nickname, 1, 30)
    validateLength(input.content, 1, 500)

    key = hashIp(request_meta.ip)
    if rateLimiter.tooMany("message_submit", key):
        return error("RATE_LIMITED", "提交过于频繁。")

    messageRepo.create({
        nickname: sanitizeText(input.nickname),
        content: sanitizeText(input.content),
        status: "visible",
        source_ip_hash: hashIp(request_meta.ip),
        user_agent_summary: summarizeUserAgent(request_meta.user_agent)
    })

    return created()
```

## 9. 工作站服务详细设计

### 9.1 服务列表

```pseudo
function listServices(current_user):
    requireInvitedOrAdmin(current_user)
    return serviceRepo.find({
        status: "enabled",
        deleted_at: null
    })
```

首版规则：

- 所有邀请用户可见全部启用服务。
- 后续可在该方法中加入服务级授权过滤。

### 9.2 创建服务请求

```text
邀请用户提交服务请求
  ↓
校验登录状态
  ↓
校验服务存在且启用
  ↓
按 input_schema 校验输入
  ↓
提取学生账号和密码
  ↓
生成账号掩码和不可逆哈希
  ↓
不保存学生密码
  ↓
创建 service_requests，状态 pending
  ↓
写入 create_request 审计
  ↓
返回 service_request_id
```

伪代码：

```pseudo
function createServiceRequest(current_user, service_id, input, request_meta):
    requireInvitedOrAdmin(current_user)

    service = serviceRepo.findEnabled(service_id)
    if service is null:
        return error("NOT_FOUND")

    validateBySchema(service.input_schema, input)

    student_account = input.student_account
    student_password = input.student_password

    account_masked = maskAccount(student_account)
    account_hash = hashAccount(student_account)

    sanitized_task_config = sanitizeTaskConfig(input.task_config)

    service_request_id = idGenerator.newServiceRequestId()

    serviceRequestRepo.create({
        service_request_id,
        service_id: service.id,
        service_name_snapshot: service.name,
        lumitime_user_id: current_user.id,
        status: "pending",
        student_account_hash: account_hash,
        student_account_masked: account_masked,
        task_config_sanitized: sanitized_task_config,
        script_version: service.script_version,
        source_ip_hash: hashIp(request_meta.ip),
        user_agent_summary: summarizeUserAgent(request_meta.user_agent),
        expires_at: now() + 180 days
    })

    credentialVault.putEphemeral(service_request_id, {
        student_account,
        student_password
    })

    serviceAuditRepo.createCreateRequest(current_user, service_request_id)

    return created({
        service_request_id,
        status: "pending",
        polling_url: "/api/v1/workstation/service-requests/" + service_request_id
    })
```

重要说明：

- `credentialVault.putEphemeral` 表示请求生命周期或任务执行前的临时凭证传递机制。
- 该临时机制不得落库。
- 如果使用数据库任务表，不能把密码写进任务表。
- 具体实现可使用内存短期缓存、进程内安全队列或后续专用密钥管理方案。

## 10. Worker 详细设计

### 10.1 首版串行执行

首版 Worker 采用串行模式：

```text
循环拉取 1 条 pending 任务
  ↓
锁定任务
  ↓
状态改为 running
  ↓
读取临时凭证
  ↓
调用 ScriptRunner
  ↓
脱敏日志
  ↓
保存结果
  ↓
处理下一条
```

### 10.2 任务锁定

伪代码：

```pseudo
function claimNextPendingRequest():
    tx.begin()
    record = serviceRequestRepo.findOldestPendingForUpdate()
    if record is null:
        tx.commit()
        return null

    serviceRequestRepo.update(record.id, {
        status: "running",
        started_at: now()
    })
    tx.commit()
    return record
```

### 10.3 Worker 主循环

```pseudo
while worker.isRunning:
    request = claimNextPendingRequest()
    if request is null:
        sleep(2 seconds)
        continue

    executeRequest(request)
```

### 10.4 执行请求

```pseudo
function executeRequest(request):
    service = serviceRepo.findById(request.service_id)
    credentials = credentialVault.getEphemeral(request.service_request_id)

    if credentials is null:
        markFailed(request, "VALIDATION_ERROR", "凭证已失效，请重新提交。")
        return

    try:
        result = scriptRunner.run({
            script_key: service.script_key,
            script_version: service.script_version,
            student_account: credentials.student_account,
            student_password: credentials.student_password,
            task_config: request.task_config_sanitized
        })

        sanitized_logs = logSanitizer.sanitizeAll(result.logs, {
            student_account: credentials.student_account
        })

        saveLogs(request.service_request_id, sanitized_logs)

        if result.success:
            markSuccess(request, result.summary)
        else:
            markFailed(request, mapFailureCode(result), result.summary)

    catch TimeoutError:
        markTimeout(request)
    catch Exception as e:
        sanitized_error = logSanitizer.sanitize(e.message)
        saveErrorLog(request.service_request_id, sanitized_error)
        markFailed(request, "SCRIPT_ERROR", "自动提交服务运行异常，请联系管理员。")
    finally:
        credentialVault.remove(request.service_request_id)
```

## 11. ScriptRunner 抽象

### 11.1 目标

`ScriptRunner` 屏蔽脚本执行方式。后续可以接：

- 命令行脚本。
- 后端内部模块。
- 独立本地服务。
- 容器化脚本执行器。

### 11.2 接口定义

```pseudo
interface ScriptRunner:
    run(input: ScriptRunInput) -> ScriptRunResult

ScriptRunInput:
    script_key
    script_version
    student_account
    student_password
    task_config

ScriptRunResult:
    success: boolean
    failure_code: string|null
    summary: string
    logs: list<RawLogLine>
    duration_ms: number
```

### 11.3 返回约束

脚本可以返回原始日志给 Worker，但 Worker 必须先脱敏再保存。

脚本不应主动打印密码、Cookie、Token，但系统不能只依赖脚本自律。

## 12. 日志脱敏详细设计

### 12.1 双重脱敏

采用：

1. 字段白名单。
2. 关键字正则。

字段白名单：

- 只允许保存 `message_sanitized`。
- 不保存原始 `message`。
- 不保存完整 headers。
- 不保存原始请求体。

关键字正则：

- password
- pwd
- token
- cookie
- authorization
- bearer
- session
- student_account 完整值

### 12.2 伪代码

```pseudo
function sanitizeLog(raw_message, context):
    message = raw_message

    if context.student_account is not null:
        message = message.replace(context.student_account, maskAccount(context.student_account))

    patterns = [
        /password\s*[:=]\s*[^,\s]+/i,
        /pwd\s*[:=]\s*[^,\s]+/i,
        /token\s*[:=]\s*[^,\s]+/i,
        /cookie\s*[:=]\s*.+/i,
        /authorization\s*[:=]\s*.+/i,
        /bearer\s+[a-zA-Z0-9._-]+/i,
        /session\s*[:=]\s*[^,\s]+/i
    ]

    for pattern in patterns:
        message = pattern.replace(message, "[REDACTED]")

    return message
```

### 12.3 保存日志

```pseudo
function saveLogs(service_request_id, raw_logs):
    sequence = 1
    for raw in raw_logs:
        sanitized = sanitizeLog(raw.message, raw.context)
        serviceLogRepo.create({
            service_request_id,
            sequence,
            log_level: raw.level,
            step_name: raw.step_name,
            message_sanitized: sanitized,
            expires_at: now() + 180 days
        })
        sequence += 1
```

## 13. 服务请求状态查询

### 13.1 用户查询自己的请求

```pseudo
function getMyServiceRequest(current_user, service_request_id):
    record = serviceRequestRepo.findByPublicId(service_request_id)
    if record is null:
        return error("NOT_FOUND")

    if current_user.role != "admin" and record.lumitime_user_id != current_user.id:
        return error("FORBIDDEN")

    return success({
        service_request_id: record.service_request_id,
        service_name: record.service_name_snapshot,
        status: record.status,
        failure_code: record.failure_code,
        submitted_at: record.created_at,
        finished_at: record.finished_at,
        duration_ms: record.duration_ms,
        result_summary: record.result_summary,
        student_account_masked: record.student_account_masked,
        can_retry: canRetry(record, current_user)
    })
```

用户响应不包含：

- 完整执行日志。
- 学生完整账号。
- 学生密码。

### 13.2 管理员查询完整脱敏日志

```pseudo
function getAdminServiceLogs(current_user, service_request_id):
    requireAdmin(current_user)
    logs = serviceLogRepo.findByRequestId(service_request_id)
    auditLog("view_service_log", current_user.id, service_request_id)
    return success(logs)
```

## 14. 失败重试详细设计

```pseudo
function retryServiceRequest(current_user, old_service_request_id, input, request_meta):
    old = serviceRequestRepo.findByPublicId(old_service_request_id)
    if old is null:
        return error("NOT_FOUND")

    if old.lumitime_user_id != current_user.id:
        return error("FORBIDDEN")

    if old.status not in ["failed", "timeout"]:
        return error("BAD_REQUEST", "当前记录不可重试。")

    if input.student_account is empty or input.student_password is empty:
        return error("BAD_REQUEST", "请重新输入账号和密码。")

    new_request = createServiceRequest(current_user, old.service_id, input, request_meta)
    serviceRequestRepo.update(new_request.id, {
        retry_of_service_request_id: old.service_request_id
    })
    return new_request
```

规则：

- 失败和超时可重试。
- 成功记录不可重试。
- 重试必须重新输入账号密码。
- 新请求生成新的 `service_request_id`。

## 15. CSV 导出详细设计

### 15.1 首版同步导出

适用：

- 统计快照 CSV。
- 服务提交记录 CSV。

流程：

```text
管理员点击导出
  ↓
后端校验管理员权限
  ↓
按筛选条件查询数据
  ↓
字段白名单过滤
  ↓
生成 CSV
  ↓
返回下载
  ↓
写入导出审计
```

### 15.2 字段白名单

服务记录导出允许字段：

- service_request_id
- service_name
- lumitime_user_id
- status
- failure_code
- result_summary
- student_account_masked
- started_at
- finished_at
- duration_ms
- script_version

禁止字段：

- student_password
- student_account 完整值
- Cookie
- Token
- Authorization
- 原始执行日志
- 原始请求头

### 15.3 后续异步升级

当导出数据量较大时，升级为：

```text
创建 export_jobs
  ↓
后台异步生成文件
  ↓
管理员下载生成结果
```

## 16. 大屏统计快照详细设计

### 16.1 生成方式

- 每天定时生成。
- 管理员可手动补生成指定日期快照。

### 16.2 生成流程

```pseudo
function generateDailySnapshot(date):
    totals = {
        user_count: userRepo.countActive(),
        developer_count: computeDeveloperCount(),
        visit_count: visitRepo.countByDate(date),
        work_count: contentRepo.countPublished("work"),
        script_count: contentRepo.countPublished("script"),
        blog_count: contentRepo.countPublished("blog"),
        message_count: messageRepo.countVisible(),
        service_count: serviceRepo.countEnabled()
    }

    yesterday = snapshotRepo.findByDate(date - 1 day)
    deltas = computeDeltas(totals, yesterday)

    snapshotRepo.upsert({
        snapshot_date: date,
        ...totals,
        deltas_json: deltas,
        generated_at: now()
    })
```

### 16.3 大屏查询

```pseudo
function getDashboardMetrics(range):
    totals = snapshotRepo.findLatest()
    daily_changes = snapshotRepo.findRange(range)
    return success({ totals, daily_changes })
```

规则：

- 大屏接口公开。
- 只返回聚合数据。
- 不返回访问明细。

## 17. 访问记录详细设计

流程：

```text
用户访问页面
  ↓
记录 path、user_id、visitor_id_hash、source_ip_hash、UA 摘要
  ↓
用于统计聚合
  ↓
短期保留后清理
```

注意：

- 不保存完整 IP。
- 不保存完整 Referrer URL 中的敏感参数。
- 大屏不读取明细，只读取快照。

## 18. 审计记录详细设计

### 18.1 审计事件

必须记录：

- 登录成功 / 失败。
- 邀请码注册。
- 邀请码创建 / 禁用。
- 用户禁用 / 启用。
- 内容创建 / 编辑 / 发布 / 下架 / 删除。
- 附件上传 / 下载 / 权限变更。
- 留言隐藏 / 恢复 / 删除。
- 服务请求创建。
- 服务重试。
- 管理员查看服务完整脱敏日志。
- 导出 CSV。

### 18.2 审计字段

审计上下文必须脱敏。

```pseudo
function auditLog(action, actor, resource, metadata):
    auditRepo.create({
        actor_user_id: actor.id,
        actor_role: actor.role,
        action,
        resource_type: resource.type,
        resource_id: resource.id,
        result,
        metadata_sanitized: sanitizeMetadata(metadata),
        source_ip_hash,
        user_agent_summary,
        created_at: now()
    })
```

禁止：

- 把学生学习 App 密码写入审计。
- 把完整学生账号写入审计。
- 把原始请求体写入审计。

## 19. 清理任务详细设计

### 19.1 服务记录清理

```pseudo
function cleanupExpiredServiceData():
    expired = serviceRequestRepo.findExpired(now())
    for request in expired:
        serviceLogRepo.deleteByRequestId(request.service_request_id)
        serviceAuditRepo.deleteOrArchiveByRequestId(request.service_request_id)
        serviceRequestRepo.deleteOrArchive(request.id)
```

策略：

- 服务记录保留 180 天。
- 可选择物理删除或归档脱敏统计，后续技术设计确认。

### 19.2 访问明细清理

```pseudo
function cleanupVisitEvents():
    visitRepo.deleteWhere(expires_at < now())
```

## 20. 前端轮询详细设计

```pseudo
function pollServiceRequest(service_request_id):
    maxDuration = 120 seconds
    interval = 2 seconds
    start = now()

    while now() - start < maxDuration:
        detail = api.getServiceRequest(service_request_id)
        updateUi(detail)

        if detail.status in ["success", "failed", "timeout", "not_integrated"]:
            stop

        wait(interval)

    showMessage("服务仍在执行，请稍后在提交记录中查看结果。")
```

UI 状态：

- pending：请求已创建。
- running：正在执行。
- success：展示结果摘要。
- failed：展示失败原因和重试入口。
- timeout：展示超时提示和重试入口。
- not_integrated：展示服务暂未接入。

## 21. 关键测试映射

| 设计点 | 测试重点 |
| --- | --- |
| 统一鉴权 | 访客访问邀请接口返回 UNAUTHORIZED |
| 管理员接口 | 邀请用户访问返回 FORBIDDEN |
| 服务请求隔离 | 邀请用户不能查看他人服务记录 |
| 日志脱敏 | 密码、Token、Cookie 不进入日志 |
| Worker 串行 | 多任务按顺序执行，不重复执行 |
| CSV 白名单 | 导出文件不包含敏感字段 |
| 快照生成 | 日度指标和变化正确 |
| 轮询 | 终态停止轮询，超时有提示 |

## 22. 待确认项

- 临时凭证传递机制的最终实现方式。
- 是否允许 Worker 与 Web 共用同一进程内存；生产环境建议分离后需设计安全传递方式。
- 数据库任务锁的具体实现方式。
- 密码哈希算法。
- 访问明细保留天数。
- 服务记录 180 天后物理删除还是归档脱敏统计。
- CSV 导出最大行数限制。

