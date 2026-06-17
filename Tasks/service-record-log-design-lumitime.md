# 服务提交记录与执行日志设计: 拾光筑梦 Lumitime

版本：v0.1  
日期：2026-06-12  
适用模块：工作站 / 日志自动提交服务 / 后续服务扩展  
关联文档：PRD、权限矩阵

## 1. 设计目标

工作站服务是 Lumitime 中由管理员封装的小服务集合。用户进入服务页后提交必要信息，后台执行对应脚本，并返回执行结果。

服务提交记录与执行日志需要同时满足：

- 用户可以知道自己的服务是否执行成功。
- 管理员可以按 `request_id` 追溯问题。
- 系统不能保存或泄露学生学习 App 密码。
- 系统不能展示学生学习 App 完整账号。
- 执行记录可以保留 180 天，用于问题排查。
- 管理员可以导出非敏感字段和脱敏日志。

## 2. 适用范围

首个服务为“日志自动提交”。后续所有工作站服务默认复用本设计。

| 服务 | 类型 | 说明 |
| --- | --- | --- |
| 日志自动提交 | 自动化脚本服务 | 用户输入学生学习 App 账号密码，后台运行脚本并返回结果 |
| 未来服务 | 可扩展服务 | 其他由管理员封装的个人工作站服务 |

## 3. 数据类型划分

| 数据类型 | 可见角色 | 用途 |
| --- | --- | --- |
| 服务提交记录 | 邀请用户、管理员 | 记录一次服务调用的基础信息和状态 |
| 用户结果摘要 | 邀请用户、管理员 | 给用户展示成功 / 失败及简短原因 |
| 执行日志 | 管理员 | 展示脚本完整脱敏运行过程 |
| 审计追溯记录 | 管理员 | 安全排查、权限追溯、异常定位 |

说明：

- 邀请用户在列表和详情中默认只能看到结果摘要，不展示完整执行日志。
- 管理员可以查看完整脱敏执行日志。
- 所有日志都必须先脱敏再存储或展示。

## 4. 用户提交记录展示

邀请用户的提交记录列表采用标准版字段。

| 字段 | 示例 | 说明 |
| --- | --- | --- |
| 服务名称 | 实习日志自动提交 | 用户调用的服务 |
| 提交时间 | 2026-06-12 18:30:00 | 用户发起服务请求的时间 |
| 状态 | 成功 / 失败 / 执行中 | 当前执行状态 |
| request_id | req_20260612_000001 | 问题追溯编号 |
| 耗时 | 12.4s | 服务执行耗时 |
| 结果摘要 | 已提交今日实习日志 | 面向用户的简短结果 |
| 账号掩码 | 2023****8912 | 学生学习 App 账号掩码，不展示完整账号 |

用户详情页可展示：

- 服务名称
- 提交时间
- 状态
- request_id
- 耗时
- 账号掩码
- 结果摘要
- 失败原因分类
- 失败后的“重新提交”入口

用户详情页不展示：

- 完整执行日志
- 学生学习 App 完整账号
- 学生学习 App 密码
- Cookie、Token、请求头
- 后端内部环境变量
- 原始异常堆栈中的敏感字段

## 5. 管理员记录展示

管理员可以查看全部用户的服务提交记录。

管理员列表字段：

| 字段 | 示例 | 说明 |
| --- | --- | --- |
| request_id | req_20260612_000001 | 全局追溯 ID |
| Lumitime 用户 | user_001 / 张三 | 发起请求的站内用户 |
| 服务名称 | 实习日志自动提交 | 被调用服务 |
| 提交时间 | 2026-06-12 18:30:00 | 请求发起时间 |
| 结束时间 | 2026-06-12 18:30:13 | 请求结束时间 |
| 状态 | 成功 / 失败 / 执行中 | 执行状态 |
| 失败原因分类 | 账号密码错误 | 失败时展示 |
| 耗时 | 13.2s | 执行耗时 |
| 账号掩码 | 2023****8912 | 学生学习 App 账号掩码 |
| 来源 IP 哈希 | iphash_xxx | 用于追溯，不展示原始 IP |
| User-Agent 摘要 | Chrome / Windows | 便于定位环境 |
| 脚本版本 | log-submit-v1.0.0 | 便于定位脚本问题 |

管理员详情页可查看：

- 以上全部列表字段。
- 完整脱敏执行日志。
- 审计追溯信息。
- 导出当前记录或批量导出记录。

管理员详情页不可查看：

- 学生学习 App 密码。
- 学生学习 App 完整账号。
- 未脱敏 Cookie、Token、请求头。
- 原始未脱敏脚本日志。

## 6. 状态设计

| 状态 | 含义 | 用户可见 | 管理员可见 |
| --- | --- | --- | --- |
| pending | 请求已创建，等待执行 | 是 | 是 |
| running | 脚本执行中 | 是 | 是 |
| success | 执行成功 | 是 | 是 |
| failed | 执行失败 | 是 | 是 |
| canceled | 请求被取消 | 是 | 是 |
| timeout | 执行超时 | 是 | 是 |
| not_integrated | 服务暂未接入真实脚本 | 是 | 是 |

## 7. 失败原因分类

失败时必须提供结构化错误分类。

| 错误码 | 分类 | 用户提示 | 管理员排查方向 |
| --- | --- | --- | --- |
| AUTH_FAILED | 账号密码错误 | 账号或密码可能不正确，请确认后重新提交。 | 检查登录接口返回、验证码、账号状态 |
| NETWORK_ERROR | 网络异常 | 当前网络连接异常，请稍后重试。 | 检查服务器网络、目标系统连通性、DNS |
| SCHOOL_SYSTEM_ERROR | 学校系统异常 | 学校系统暂时不可用，请稍后重试。 | 检查目标系统状态码、维护公告、返回内容 |
| SCRIPT_ERROR | 脚本异常 | 自动提交服务运行异常，请联系管理员。 | 检查脚本版本、异常堆栈、参数兼容性 |
| VALIDATION_ERROR | 输入校验失败 | 输入信息不完整或格式不正确。 | 检查服务入参 schema 和前端校验 |
| TIMEOUT | 执行超时 | 本次提交超时，请稍后重新提交。 | 检查脚本超时配置、目标系统响应耗时 |
| UNKNOWN_ERROR | 未知错误 | 服务暂时异常，请稍后重试或联系管理员。 | 检查 request_id 对应完整脱敏日志 |

## 8. 重新提交规则

用户可以对失败记录发起重新提交，但必须重新输入学生学习 App 账号和密码。

规则：

- 重新提交会创建新的 `request_id`。
- 重新提交不复用历史密码。
- 系统不得从历史记录中恢复学生学习 App 密码。
- 重新提交记录应关联原失败记录的 `retry_of_request_id`。
- 用户只能重试自己的失败记录。
- 管理员不能代替用户重试，除非用户当次重新提供账号密码。

## 9. 导出规则

管理员可以导出服务提交记录和脱敏执行日志。

允许导出的字段：

- request_id
- Lumitime 用户 ID 或展示名
- 服务 ID
- 服务名称
- 提交时间
- 结束时间
- 状态
- 失败原因分类
- 耗时
- 账号掩码
- 来源 IP 哈希
- User-Agent 摘要
- 脚本版本
- 结果摘要
- 完整脱敏执行日志

禁止导出的字段：

- 学生学习 App 密码
- 学生学习 App 完整账号
- Cookie
- Token
- Authorization 请求头
- 原始请求头
- 原始未脱敏执行日志
- 原始 IP，除非后续有明确合规依据和访问控制

导出格式建议：

- CSV：适合批量记录。
- Markdown：适合单次问题排查报告。
- PDF：适合对外留档，但首版可暂缓。

## 10. 脱敏规则

日志进入存储、展示、导出前必须经过统一脱敏处理。

### 10.1 必须脱敏字段

| 类型 | 示例 | 处理方式 |
| --- | --- | --- |
| 密码 | password=abc123 | 替换为 `[REDACTED_PASSWORD]` |
| Token | token=xxx | 替换为 `[REDACTED_TOKEN]` |
| Cookie | Cookie: session=xxx | 替换为 `[REDACTED_COOKIE]` |
| Authorization | Bearer xxx | 替换为 `[REDACTED_AUTH]` |
| 完整账号 | 202312345678 | 替换为掩码，如 `2023****5678` |
| 身份证 / 手机号等 | 视服务输入而定 | 按字段类型掩码 |
| 原始请求头 | headers={...} | 默认不展示，必要时只保留摘要 |

### 10.2 脱敏处理顺序

```text
脚本原始输出
  ↓
敏感字段匹配
  ↓
字段级脱敏
  ↓
账号掩码生成
  ↓
敏感关键字二次扫描
  ↓
保存脱敏日志
  ↓
按角色展示或导出
```

### 10.3 存储原则

- 不保存原始未脱敏日志。
- 不保存学生学习 App 密码。
- 不保存学生学习 App 完整账号。
- 可保存学生学习 App 账号不可逆哈希，用于追溯同一账号的请求。
- 可保存账号掩码，用于用户确认提交对象。

## 11. 建议数据对象

### 11.1 ServiceRequest

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 内部 ID |
| request_id | string | 对外追溯 ID |
| service_id | string | 服务 ID |
| service_name | string | 服务名称快照 |
| lumitime_user_id | string | 发起请求的站内用户 ID |
| status | enum | pending / running / success / failed / canceled / timeout / not_integrated |
| failure_code | enum/null | 失败原因分类 |
| result_summary | string | 面向用户的结果摘要 |
| student_account_hash | string/null | 学生账号不可逆哈希 |
| student_account_masked | string/null | 学生账号掩码 |
| started_at | datetime | 开始时间 |
| finished_at | datetime/null | 结束时间 |
| duration_ms | number/null | 执行耗时 |
| retry_of_request_id | string/null | 如果是重试，记录原 request_id |
| script_version | string/null | 脚本版本 |
| created_at | datetime | 创建时间 |

### 11.2 ServiceExecutionLog

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 内部 ID |
| request_id | string | 关联服务请求 |
| log_level | enum | info / warn / error / debug |
| log_time | datetime | 日志时间 |
| message_sanitized | text | 脱敏后的日志内容 |
| step_name | string/null | 执行步骤名称 |
| sequence | number | 日志顺序 |

### 11.3 ServiceAudit

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 内部 ID |
| request_id | string | 关联服务请求 |
| lumitime_user_id | string | 发起请求用户 |
| action | string | create_request / retry_request / view_result / export_record |
| actor_role | enum | invited_user / admin |
| source_ip_hash | string | 来源 IP 哈希 |
| user_agent_summary | string | User-Agent 摘要 |
| created_at | datetime | 记录时间 |

## 12. 接口草案

### 创建服务请求

`POST /api/workstation/services/{service_id}/requests`

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

响应体：

```json
{
  "request_id": "req_20260612_000001",
  "status": "pending",
  "message": "请求已创建，正在执行。"
}
```

### 查看自己的提交记录

`GET /api/workstation/service-requests/my`

响应体：

```json
{
  "items": [
    {
      "request_id": "req_20260612_000001",
      "service_name": "实习日志自动提交",
      "submitted_at": "2026-06-12T18:30:00+08:00",
      "status": "success",
      "duration_ms": 12400,
      "result_summary": "已提交今日实习日志。",
      "student_account_masked": "2023****8912"
    }
  ]
}
```

### 查看自己的请求详情

`GET /api/workstation/service-requests/my/{request_id}`

响应体：

```json
{
  "request_id": "req_20260612_000001",
  "service_name": "实习日志自动提交",
  "status": "failed",
  "failure_code": "AUTH_FAILED",
  "duration_ms": 8200,
  "result_summary": "账号或密码可能不正确，请确认后重新提交。",
  "student_account_masked": "2023****8912",
  "can_retry": true
}
```

### 管理员查看完整脱敏日志

`GET /api/admin/service-requests/{request_id}/logs`

响应体：

```json
{
  "request_id": "req_20260612_000001",
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

### 重新提交

`POST /api/workstation/service-requests/{request_id}/retry`

请求体：

```json
{
  "student_account": "not persisted",
  "student_password": "not persisted"
}
```

响应体：

```json
{
  "request_id": "req_20260612_000002",
  "retry_of_request_id": "req_20260612_000001",
  "status": "pending"
}
```

## 13. 测试要点

- 邀请用户只能看到自己的服务提交记录。
- 邀请用户详情页不展示完整执行日志。
- 管理员可以查看完整脱敏执行日志。
- 执行日志中不出现学生学习 App 密码。
- 执行日志中不出现学生学习 App 完整账号。
- 导出文件中不出现密码、完整账号、Cookie、Token、Authorization。
- 失败记录可以重新提交。
- 重新提交必须重新输入学生学习 App 账号和密码。
- 重新提交生成新的 request_id。
- 180 天以外的服务提交记录按保留策略处理。
- `AUTH_FAILED`、`NETWORK_ERROR`、`SCHOOL_SYSTEM_ERROR`、`SCRIPT_ERROR`、`TIMEOUT` 等错误分类可被正确返回。

## 14. 待确认项

- 邀请用户是否需要在详情页看到“步骤级摘要”，例如登录、填写、提交、确认四步。
- 管理员导出是否首版只支持 CSV，Markdown / PDF 后续再做。
- 180 天后的记录是物理删除，还是保留聚合统计。
- 是否需要对同一用户每日提交次数做限制。
- 是否需要对同一学生账号每日提交次数做限制。

