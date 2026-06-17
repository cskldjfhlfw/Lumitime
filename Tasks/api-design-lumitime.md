# 接口设计文档: 拾光筑梦 Lumitime

版本：v0.1  
日期：2026-06-12  
适用阶段：概要设计 / 详细设计 / 前后端联调 / 测试用例设计  
关联文档：PRD、权限矩阵、信息架构、服务提交记录与执行日志设计

## 1. 设计结论

本接口文档用于定义 Lumitime 首版前后端对接边界。

已确认的设计决策：

| 项目 | 决策 |
| --- | --- |
| 接口版本 | 使用 `/api/v1/...` |
| 登录态方式 | 文档推荐 Cookie Session，具体实现可在技术选型阶段最终确定 |
| 工作站服务执行方式 | 异步执行：提交后立即返回 `request_id`，前端轮询状态 |
| 作品压缩包存储 | 接口只定义上传、下载、删除能力，不绑定本地存储或对象存储 |
| 管理员导出格式 | 首版支持 CSV |
| 统一返回格式 | `{ code, message, data, request_id }` |

## 2. 通用约定

### 2.1 Base URL

```text
/api/v1
```

### 2.2 统一响应结构

成功响应：

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "request_id": "req_api_20260612_000001"
}
```

失败响应：

```json
{
  "code": "UNAUTHORIZED",
  "message": "请先登录后再访问。",
  "data": null,
  "request_id": "req_api_20260612_000002"
}
```

说明：

- `request_id` 是接口请求追踪 ID，用于排查问题。
- 工作站服务请求也有业务级 `service_request_id`，例如 `svc_req_20260612_000001`。
- 两者不能混淆：接口 `request_id` 用于 API 调用追踪，服务 `service_request_id` 用于自动化服务执行追踪。

### 2.3 时间格式

统一使用 ISO 8601 字符串。

```text
2026-06-12T18:30:00+08:00
```

### 2.4 分页格式

列表接口统一支持分页。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| page | number | 否 | 1 | 页码 |
| page_size | number | 否 | 20 | 每页数量，最大 100 |
| keyword | string | 否 | - | 搜索关键词 |

响应格式：

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 100
}
```

### 2.5 鉴权规则

| 访问类型 | 要求 |
| --- | --- |
| 公开接口 | 不需要登录 |
| 邀请用户接口 | 必须登录，角色为 `invited_user` 或 `admin` |
| 管理员接口 | 必须登录，角色为 `admin` |

后端必须做权限校验，不能只依赖前端隐藏入口。

### 2.6 敏感字段规则

禁止在响应、日志、导出文件中返回：

- 学生学习 App 密码
- 学生学习 App 完整账号
- Cookie
- Token
- Authorization 请求头
- 原始请求头
- 原始未脱敏执行日志

允许返回：

- 学生学习 App 账号掩码，例如 `2023****8912`
- 学生学习 App 账号不可逆哈希，仅管理员审计使用
- 脱敏后的执行日志，仅管理员可查看完整内容

## 3. 错误码

| code | HTTP 状态码 | 含义 |
| --- | --- | --- |
| OK | 200 | 成功 |
| CREATED | 201 | 创建成功 |
| BAD_REQUEST | 400 | 请求参数错误 |
| UNAUTHORIZED | 401 | 未登录 |
| FORBIDDEN | 403 | 无权限 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突 |
| RATE_LIMITED | 429 | 请求过于频繁 |
| INTERNAL_ERROR | 500 | 系统异常 |
| SERVICE_NOT_INTEGRATED | 501 | 服务暂未接入真实脚本 |

工作站服务失败分类使用业务错误码：

| code | 含义 |
| --- | --- |
| AUTH_FAILED | 学生学习 App 账号或密码错误 |
| NETWORK_ERROR | 网络异常 |
| SCHOOL_SYSTEM_ERROR | 学校系统异常 |
| SCRIPT_ERROR | 自动化脚本异常 |
| VALIDATION_ERROR | 输入校验失败 |
| TIMEOUT | 执行超时 |
| UNKNOWN_ERROR | 未知错误 |

## 4. 认证接口

### 4.1 登录

`POST /api/v1/auth/login`

权限：公开

请求体：

```json
{
  "username": "zhangsan",
  "password": "site-password"
}
```

响应：

```json
{
  "code": "OK",
  "message": "登录成功。",
  "data": {
    "user": {
      "id": "user_001",
      "username": "zhangsan",
      "display_name": "张三",
      "role": "invited_user"
    },
    "redirect_to": "/"
  },
  "request_id": "req_api_20260612_000001"
}
```

规则：

- 邀请用户登录后默认跳转主页 `/`。
- 管理员登录后默认跳转 `/admin`。
- 登录失败时统一提示，不暴露账号是否存在。

### 4.2 退出登录

`POST /api/v1/auth/logout`

权限：已登录用户

响应：

```json
{
  "code": "OK",
  "message": "已退出登录。",
  "data": null,
  "request_id": "req_api_20260612_000002"
}
```

### 4.3 获取当前用户

`GET /api/v1/auth/me`

权限：已登录用户

响应：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "id": "user_001",
    "username": "zhangsan",
    "display_name": "张三",
    "role": "invited_user",
    "status": "active"
  },
  "request_id": "req_api_20260612_000003"
}
```

### 4.4 邀请码注册

`POST /api/v1/auth/register-with-invite`

权限：公开

请求体：

```json
{
  "invite_code": "LUMI-2026-ABCD",
  "username": "zhangsan",
  "display_name": "张三",
  "password": "site-password"
}
```

响应：

```json
{
  "code": "CREATED",
  "message": "注册成功。",
  "data": {
    "user_id": "user_001",
    "role": "invited_user"
  },
  "request_id": "req_api_20260612_000004"
}
```

规则：

- 注册成功后角色默认为 `invited_user`。
- 无效、过期、禁用、超次数的邀请码应返回明确错误。

### 4.5 修改站点密码

`PATCH /api/v1/auth/password`

权限：已登录用户

请求体：

```json
{
  "old_password": "old-site-password",
  "new_password": "new-site-password"
}
```

说明：

- 该接口只修改 Lumitime 站点密码。
- 与学生学习 App 账号密码无关。

## 5. 管理员邀请码接口

### 5.1 创建邀请码

`POST /api/v1/admin/invite-codes`

权限：管理员

请求体：

```json
{
  "usage_limit": 1,
  "expires_at": "2026-12-31T23:59:59+08:00",
  "remark": "给某位同学的邀请"
}
```

响应数据：

```json
{
  "id": "invite_001",
  "code": "LUMI-2026-ABCD",
  "usage_limit": 1,
  "used_count": 0,
  "status": "active",
  "expires_at": "2026-12-31T23:59:59+08:00"
}
```

### 5.2 邀请码列表

`GET /api/v1/admin/invite-codes`

权限：管理员

支持筛选：

- `status`
- `keyword`
- `page`
- `page_size`

### 5.3 禁用邀请码

`PATCH /api/v1/admin/invite-codes/{invite_code_id}/disable`

权限：管理员

### 5.4 查看邀请码使用记录

`GET /api/v1/admin/invite-codes/{invite_code_id}/usage-records`

权限：管理员

## 6. 用户管理接口

### 6.1 用户列表

`GET /api/v1/admin/users`

权限：管理员

支持筛选：

- `status`
- `role`
- `keyword`
- `page`
- `page_size`

### 6.2 禁用用户

`PATCH /api/v1/admin/users/{user_id}/disable`

权限：管理员

### 6.3 启用用户

`PATCH /api/v1/admin/users/{user_id}/enable`

权限：管理员

### 6.4 重置用户站点密码

`PATCH /api/v1/admin/users/{user_id}/reset-password`

权限：管理员

请求体：

```json
{
  "new_password": "temporary-site-password"
}
```

## 7. 前台内容接口

### 7.1 脚本列表

`GET /api/v1/scripts`

权限：邀请用户、管理员

响应数据项：

```json
{
  "id": "script_001",
  "title": "超级粘贴板",
  "summary": "一个提升复制粘贴效率的小脚本。",
  "language": "Python",
  "tags": ["效率工具", "脚本"],
  "updated_at": "2026-06-12T18:30:00+08:00"
}
```

### 7.2 脚本详情

`GET /api/v1/scripts/{script_id}`

权限：邀请用户、管理员

响应数据：

```json
{
  "id": "script_001",
  "title": "超级粘贴板",
  "summary": "一个提升复制粘贴效率的小脚本。",
  "language": "Python",
  "code": "print('example')",
  "usage": "复制代码后在本地运行。",
  "notes": "请在了解代码用途后使用。",
  "allow_copy": true,
  "updated_at": "2026-06-12T18:30:00+08:00"
}
```

规则：

- 脚本只提供代码文本。
- 不提供脚本文件下载接口。

### 7.3 作品列表

`GET /api/v1/works`

权限：邀请用户、管理员

### 7.4 作品详情

`GET /api/v1/works/{work_id}`

权限：邀请用户、管理员

响应数据：

```json
{
  "id": "work_001",
  "title": "某项目作品",
  "category": "project",
  "summary": "项目简介。",
  "body": "项目详细介绍。",
  "tags": ["项目", "算法"],
  "attachments": [
    {
      "id": "att_001",
      "filename": "work.zip",
      "file_size": 1048576,
      "can_download": true
    }
  ]
}
```

### 7.5 下载作品附件

`GET /api/v1/works/{work_id}/attachments/{attachment_id}/download`

权限：邀请用户、管理员

规则：

- 邀请用户只有在该作品配置允许下载时才能下载。
- 管理员始终可下载。
- 接口不绑定具体存储方式。

### 7.6 博客列表

`GET /api/v1/blogs`

权限：邀请用户、管理员

### 7.7 博客详情

`GET /api/v1/blogs/{blog_id}`

权限：邀请用户、管理员

## 8. 管理员内容管理接口

### 8.1 创建内容

`POST /api/v1/admin/contents`

权限：管理员

请求体：

```json
{
  "type": "script",
  "title": "超级粘贴板",
  "summary": "一个提升复制粘贴效率的小脚本。",
  "body": "正文或说明",
  "code": "print('example')",
  "language": "Python",
  "category": "tool",
  "tags": ["效率工具"],
  "status": "draft"
}
```

### 8.2 编辑内容

`PATCH /api/v1/admin/contents/{content_id}`

权限：管理员

### 8.3 发布内容

`PATCH /api/v1/admin/contents/{content_id}/publish`

权限：管理员

### 8.4 下架内容

`PATCH /api/v1/admin/contents/{content_id}/unpublish`

权限：管理员

### 8.5 删除内容

`DELETE /api/v1/admin/contents/{content_id}`

权限：管理员

### 8.6 上传作品附件

`POST /api/v1/admin/works/{work_id}/attachments`

权限：管理员

请求类型：`multipart/form-data`

字段：

- `file`
- `filename`
- `allow_download`

### 8.7 配置作品附件下载权限

`PATCH /api/v1/admin/works/{work_id}/attachments/{attachment_id}`

权限：管理员

请求体：

```json
{
  "allow_download": true
}
```

## 9. 留言接口

### 9.1 公开留言列表

`GET /api/v1/messages`

权限：公开

### 9.2 提交留言

`POST /api/v1/messages`

权限：公开

请求体：

```json
{
  "nickname": "路过的访客",
  "content": "这里写留言内容。"
}
```

规则：

- 留言提交后立即公开。
- 必须做频率限制和内容长度限制。

### 9.3 管理员隐藏留言

`PATCH /api/v1/admin/messages/{message_id}/hide`

权限：管理员

### 9.4 管理员恢复留言

`PATCH /api/v1/admin/messages/{message_id}/restore`

权限：管理员

### 9.5 管理员删除留言

`DELETE /api/v1/admin/messages/{message_id}`

权限：管理员

## 10. 工作站服务接口

### 10.1 服务列表

`GET /api/v1/workstation/services`

权限：邀请用户、管理员

响应数据项：

```json
{
  "id": "service_log_auto_submit",
  "name": "日志自动提交",
  "summary": "自动提交学校实习日志。",
  "status": "enabled",
  "updated_at": "2026-06-12T18:30:00+08:00"
}
```

规则：

- 首版所有邀请用户可见全部启用服务。
- 后续预留按服务授权。

### 10.2 服务详情

`GET /api/v1/workstation/services/{service_id}`

权限：邀请用户、管理员

响应数据：

```json
{
  "id": "service_log_auto_submit",
  "name": "日志自动提交",
  "summary": "自动提交学校实习日志。",
  "description": "输入学生学习 App 账号密码后，系统会调用后台脚本进行提交。",
  "status": "enabled",
  "input_schema": [
    {
      "name": "student_account",
      "label": "学生学习 App 账号",
      "type": "text",
      "required": true
    },
    {
      "name": "student_password",
      "label": "学生学习 App 密码",
      "type": "password",
      "required": true
    }
  ]
}
```

### 10.3 发起服务请求

`POST /api/v1/workstation/services/{service_id}/requests`

权限：邀请用户、管理员

请求体：

```json
{
  "student_account": "not persisted",
  "student_password": "not persisted",
  "task_config": {
    "target_date": "2026-06-12"
  }
}
```

响应数据：

```json
{
  "service_request_id": "svc_req_20260612_000001",
  "status": "pending",
  "polling_url": "/api/v1/workstation/service-requests/svc_req_20260612_000001"
}
```

规则：

- 接口异步执行。
- 后端立即创建服务请求并返回 `service_request_id`。
- 前端通过轮询接口获取执行状态。
- 学生学习 App 密码不得保存、记录、展示、导出。

### 10.4 查询自己的服务请求详情

`GET /api/v1/workstation/service-requests/{service_request_id}`

权限：邀请用户、管理员

响应数据：

```json
{
  "service_request_id": "svc_req_20260612_000001",
  "service_name": "日志自动提交",
  "status": "success",
  "failure_code": null,
  "submitted_at": "2026-06-12T18:30:00+08:00",
  "finished_at": "2026-06-12T18:30:12+08:00",
  "duration_ms": 12000,
  "result_summary": "已提交今日实习日志。",
  "student_account_masked": "2023****8912",
  "can_retry": false
}
```

规则：

- 邀请用户只能查看自己的请求。
- 邀请用户不查看完整执行日志。

### 10.5 我的服务请求列表

`GET /api/v1/workstation/service-requests/my`

权限：邀请用户、管理员

支持筛选：

- `service_id`
- `status`
- `start_date`
- `end_date`
- `page`
- `page_size`

### 10.6 重新提交失败请求

`POST /api/v1/workstation/service-requests/{service_request_id}/retry`

权限：邀请用户、管理员

请求体：

```json
{
  "student_account": "not persisted",
  "student_password": "not persisted"
}
```

响应数据：

```json
{
  "service_request_id": "svc_req_20260612_000002",
  "retry_of_service_request_id": "svc_req_20260612_000001",
  "status": "pending"
}
```

规则：

- 只能重试自己的失败记录。
- 必须重新输入学生学习 App 账号和密码。
- 生成新的 `service_request_id`。

## 11. 管理员工作站服务管理接口

### 11.1 创建服务

`POST /api/v1/admin/workstation/services`

权限：管理员

请求体：

```json
{
  "name": "日志自动提交",
  "summary": "自动提交学校实习日志。",
  "description": "服务说明。",
  "status": "enabled",
  "script_key": "log_auto_submit",
  "script_version": "v1.0.0",
  "input_schema": []
}
```

### 11.2 编辑服务

`PATCH /api/v1/admin/workstation/services/{service_id}`

权限：管理员

### 11.3 启用服务

`PATCH /api/v1/admin/workstation/services/{service_id}/enable`

权限：管理员

### 11.4 停用服务

`PATCH /api/v1/admin/workstation/services/{service_id}/disable`

权限：管理员

### 11.5 删除服务

`DELETE /api/v1/admin/workstation/services/{service_id}`

权限：管理员

## 12. 管理员服务记录接口

### 12.1 全部服务请求列表

`GET /api/v1/admin/service-requests`

权限：管理员

支持筛选：

- `service_id`
- `user_id`
- `status`
- `failure_code`
- `service_request_id`
- `start_date`
- `end_date`
- `page`
- `page_size`

### 12.2 服务请求详情

`GET /api/v1/admin/service-requests/{service_request_id}`

权限：管理员

### 12.3 查看完整脱敏执行日志

`GET /api/v1/admin/service-requests/{service_request_id}/logs`

权限：管理员

响应数据：

```json
{
  "service_request_id": "svc_req_20260612_000001",
  "logs": [
    {
      "sequence": 1,
      "level": "info",
      "time": "2026-06-12T18:30:02+08:00",
      "step_name": "login",
      "message": "开始登录，账号=2023****8912，密码=[REDACTED_PASSWORD]"
    }
  ]
}
```

## 13. 大屏看板接口

### 13.1 获取公开聚合指标

`GET /api/v1/dashboard/metrics`

权限：公开

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| range | string | 否 | `7d` / `30d` / `90d`，默认 `7d` |

响应数据：

```json
{
  "totals": {
    "user_count": 120,
    "developer_count": 1,
    "visit_count": 3560,
    "work_count": 12,
    "script_count": 8,
    "blog_count": 20,
    "message_count": 66,
    "service_count": 3
  },
  "daily_changes": [
    {
      "date": "2026-06-12",
      "user_count": 2,
      "developer_count": 0,
      "visit_count": 80,
      "work_count": 1,
      "script_count": 0,
      "blog_count": 1,
      "message_count": 3,
      "service_count": 0
    }
  ]
}
```

规则：

- 仅返回聚合数据。
- 不返回用户明细、IP、账号、留言原文、服务提交明细。

### 13.2 管理员查看日度快照

`GET /api/v1/admin/dashboard/snapshots`

权限：管理员

## 14. 导出接口

### 14.1 导出统计记录 CSV

`GET /api/v1/admin/exports/dashboard-snapshots.csv`

权限：管理员

说明：

- 首版只支持 CSV。
- 导出内容只包含聚合指标和日度变化。

### 14.2 导出服务提交记录 CSV

`GET /api/v1/admin/exports/service-requests.csv`

权限：管理员

支持筛选：

- `service_id`
- `user_id`
- `status`
- `failure_code`
- `start_date`
- `end_date`

规则：

- 可导出非敏感字段。
- 可导出完整脱敏执行日志。
- 不得导出学生学习 App 密码、完整账号、Cookie、Token、Authorization。

## 15. 审计接口

### 15.1 审计记录列表

`GET /api/v1/admin/audit-logs`

权限：管理员

支持筛选：

- `actor_user_id`
- `action`
- `resource_type`
- `resource_id`
- `service_request_id`
- `start_date`
- `end_date`
- `page`
- `page_size`

### 15.2 审计记录详情

`GET /api/v1/admin/audit-logs/{audit_log_id}`

权限：管理员

规则：

- 审计记录不得包含密码、完整账号、Token、Cookie。
- 审计记录可包含来源 IP 哈希、User-Agent 摘要、操作对象、操作时间、结果状态。

## 16. 前端轮询建议

工作站服务采用异步执行。

推荐流程：

```text
POST /workstation/services/{service_id}/requests
  ↓
返回 service_request_id
  ↓
前端每 2 秒调用 GET /workstation/service-requests/{service_request_id}
  ↓
状态为 pending / running 时继续轮询
  ↓
状态为 success / failed / timeout / not_integrated 时停止轮询
```

建议规则：

- 轮询间隔：2 秒。
- 最大轮询时长：120 秒。
- 超过最大轮询时长后前端提示“服务仍在执行，请稍后在提交记录中查看结果”。
- 后端脚本执行应有超时时间。

## 17. 测试关注点

- 未登录访问邀请用户接口返回 `UNAUTHORIZED`。
- 邀请用户访问管理员接口返回 `FORBIDDEN`。
- 访客可以访问留言列表和大屏看板。
- 访客不能访问脚本、作品、博客、工作站接口。
- 邀请用户可以复制脚本代码，但没有脚本文件下载接口。
- 作品附件下载受 `allow_download` 控制。
- 发起日志自动提交后立即返回 `service_request_id`。
- 前端可通过轮询获取服务状态。
- 邀请用户只能查看自己的服务请求。
- 管理员能查看全部服务请求和完整脱敏日志。
- 学生学习 App 密码不出现在任何接口响应中。
- 导出 CSV 不包含敏感字段。
- 审计接口仅管理员可访问。

## 18. 待确认项

- Cookie Session 的具体实现框架和安全配置。
- 注册成功后是否自动登录。
- CSV 导出是否需要异步任务，还是同步下载。
- 上传附件的大小限制和允许文件类型。
- 是否需要接口级 CSRF 防护策略。
- 服务执行是否需要队列系统，还是首版直接后端任务执行。

