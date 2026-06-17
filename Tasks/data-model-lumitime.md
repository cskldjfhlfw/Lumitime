# 数据模型设计 / 数据字典: 拾光筑梦 Lumitime

版本：v0.1  
日期：2026-06-12  
适用阶段：概要设计 / 详细设计 / 数据库设计 / 接口开发 / 测试设计  
关联文档：PRD、权限矩阵、信息架构、接口设计、服务提交记录与执行日志设计

## 1. 设计结论

Lumitime 首版数据模型采用逻辑模型描述，不绑定具体数据库类型。后续可以落地到 MySQL、PostgreSQL、SQLite 或其他数据库。

已确认的建模决策：

| 项目 | 决策 |
| --- | --- |
| 数据库类型 | PRD 阶段只定义逻辑模型，不绑定具体数据库 |
| 内容模型 | 脚本、作品、博客使用统一内容表 `content_items`，通过 `type` 区分 |
| 删除策略 | 内容使用软删除；留言和服务记录按保留策略处理；服务记录保留 180 天 |
| 学生学习 App 账号 | 只存账号掩码和不可逆哈希，不存完整账号 |
| 学生学习 App 密码 | 不存明文、不存哈希、不存掩码、不存任何派生值 |
| 执行日志 | 用户看摘要；管理员可看完整脱敏日志；不保存原始未脱敏日志 |
| 统计快照 | 每天一条全站快照，并预留扩展指标字段 |
| 访问记录 | 短期保存脱敏访问明细，定期聚合后清理 |

## 2. 数据分类与敏感等级

| 等级 | 类型 | 示例 | 处理要求 |
| --- | --- | --- | --- |
| Public | 公开数据 | 主页文案、公开留言、公开看板聚合指标 | 可公开展示 |
| Internal | 内部数据 | 内容草稿、服务配置、邀请码状态 | 仅管理员或授权用户可见 |
| Sensitive | 敏感数据 | Lumitime 密码哈希、IP 哈希、审计记录 | 严格权限控制，禁止公开 |
| Highly Sensitive | 高敏感数据 | 学生学习 App 密码、完整账号、Cookie、Token | 不落库、不写日志、不导出 |

## 3. 表清单

| 表名 | 用途 |
| --- | --- |
| users | Lumitime 站点用户 |
| invite_codes | 邀请码 |
| invite_code_usages | 邀请码使用记录 |
| content_items | 统一内容表：脚本、作品、博客 |
| content_attachments | 内容附件：作品压缩包等 |
| messages | 随记 / 留言 |
| workstation_services | 工作站服务 |
| service_requests | 服务提交记录 |
| service_execution_logs | 服务执行日志，保存脱敏日志 |
| service_audits | 服务审计追溯 |
| audit_logs | 系统审计记录 |
| visit_events | 短期脱敏访问明细 |
| daily_metric_snapshots | 日度统计快照 |
| export_jobs | 导出任务记录 |

## 4. users

用途：存储 Lumitime 站点账号。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 用户 ID |
| username | string | 是 | Internal | 登录用户名，唯一 |
| display_name | string | 是 | Internal | 展示名 |
| role | enum | 是 | Internal | `admin` / `invited_user` |
| password_hash | string | 是 | Sensitive | Lumitime 站点密码哈希 |
| status | enum | 是 | Internal | `active` / `disabled` |
| created_at | datetime | 是 | Internal | 创建时间 |
| updated_at | datetime | 是 | Internal | 更新时间 |
| last_login_at | datetime/null | 否 | Internal | 最后登录时间 |
| deleted_at | datetime/null | 否 | Internal | 软删除时间，首版一般不删除用户 |

建议索引：

- `username` 唯一索引
- `role`
- `status`
- `created_at`

规则：

- 不存 Lumitime 明文密码。
- 访客不进入 `users` 表。
- 首版管理员不细分。

## 5. invite_codes

用途：管理员生成和管理邀请码。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 邀请码 ID |
| code | string | 是 | Sensitive | 邀请码，唯一 |
| status | enum | 是 | Internal | `active` / `disabled` / `expired` |
| usage_limit | number | 是 | Internal | 最大使用次数 |
| used_count | number | 是 | Internal | 已使用次数 |
| expires_at | datetime/null | 否 | Internal | 过期时间 |
| remark | string/null | 否 | Internal | 管理员备注 |
| created_by | string | 是 | Internal | 创建管理员 ID |
| created_at | datetime | 是 | Internal | 创建时间 |
| updated_at | datetime | 是 | Internal | 更新时间 |

建议索引：

- `code` 唯一索引
- `status`
- `expires_at`

## 6. invite_code_usages

用途：记录邀请码被谁使用。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 使用记录 ID |
| invite_code_id | string | 是 | Internal | 邀请码 ID |
| user_id | string | 是 | Internal | 注册成功的用户 ID |
| used_at | datetime | 是 | Internal | 使用时间 |
| source_ip_hash | string/null | 否 | Sensitive | 来源 IP 哈希 |
| user_agent_summary | string/null | 否 | Internal | 浏览器摘要 |

建议索引：

- `invite_code_id`
- `user_id`
- `used_at`

## 7. content_items

用途：统一管理脚本、个人作品、经验心得 / 博客。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 内容 ID |
| type | enum | 是 | Internal | `script` / `work` / `blog` |
| title | string | 是 | Internal | 标题 |
| summary | string | 否 | Internal | 摘要 |
| body | text | 否 | Internal | 正文或详情 |
| code | text/null | 否 | Internal | 脚本代码，仅 `script` 使用 |
| language | string/null | 否 | Internal | 脚本语言 |
| category | string/null | 否 | Internal | 作品分类或内容分类 |
| tags | json/array | 否 | Internal | 标签 |
| status | enum | 是 | Internal | `draft` / `published` / `unpublished` |
| visibility | enum | 是 | Internal | `invited_only` / `admin_only` |
| allow_copy | boolean | 否 | Internal | 脚本是否显示复制按钮，脚本默认 true |
| created_by | string | 是 | Internal | 创建管理员 ID |
| created_at | datetime | 是 | Internal | 创建时间 |
| updated_at | datetime | 是 | Internal | 更新时间 |
| published_at | datetime/null | 否 | Internal | 发布时间 |
| deleted_at | datetime/null | 否 | Internal | 软删除时间 |

建议索引：

- `(type, status)`
- `created_at`
- `published_at`
- `deleted_at`

规则：

- 脚本只提供代码文本，不提供文件下载。
- 邀请用户可查看全部已发布脚本、作品、博客。
- 管理员是唯一可新增、编辑、发布、下架、删除内容的角色。

## 8. content_attachments

用途：存储个人作品压缩包、论文附件等。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 附件 ID |
| content_id | string | 是 | Internal | 关联内容 ID |
| filename | string | 是 | Internal | 文件名 |
| file_type | string | 否 | Internal | 文件类型 |
| file_size | number | 否 | Internal | 文件大小 |
| storage_key | string | 是 | Sensitive | 存储标识，不直接暴露 |
| checksum | string/null | 否 | Internal | 文件校验值 |
| allow_download | boolean | 是 | Internal | 是否允许邀请用户下载 |
| uploaded_by | string | 是 | Internal | 上传管理员 ID |
| created_at | datetime | 是 | Internal | 上传时间 |
| deleted_at | datetime/null | 否 | Internal | 软删除时间 |

建议索引：

- `content_id`
- `allow_download`
- `deleted_at`

规则：

- 存储方式不在逻辑模型中绑定。
- 下载必须经过权限校验，不应直接暴露永久公开地址。

## 9. messages

用途：随记 / 留言板。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Public/Internal | 留言 ID |
| nickname | string | 是 | Public | 访客昵称 |
| content | text | 是 | Public | 留言内容，立即公开 |
| status | enum | 是 | Internal | `visible` / `hidden` / `deleted` |
| source_ip_hash | string/null | 否 | Sensitive | 来源 IP 哈希 |
| user_agent_summary | string/null | 否 | Internal | 浏览器摘要 |
| created_at | datetime | 是 | Public | 留言时间 |
| moderated_by | string/null | 否 | Internal | 操作管理员 |
| moderated_at | datetime/null | 否 | Internal | 管理操作时间 |
| deleted_at | datetime/null | 否 | Internal | 删除时间 |

建议索引：

- `status`
- `created_at`
- `source_ip_hash`

规则：

- 留言提交后立即公开。
- 需要基础防刷策略。
- 管理员可隐藏、恢复、删除。

## 10. workstation_services

用途：工作站服务配置。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 服务 ID |
| name | string | 是 | Internal | 服务名称 |
| summary | string | 否 | Internal | 简介 |
| description | text | 否 | Internal | 详细说明 |
| status | enum | 是 | Internal | `enabled` / `disabled` |
| service_type | enum | 是 | Internal | `automation` / `tool` / `other` |
| script_key | string/null | 否 | Internal | 后端脚本标识 |
| script_version | string/null | 否 | Internal | 脚本版本 |
| input_schema | json | 否 | Internal | 服务输入项配置 |
| result_display_mode | enum | 是 | Internal | `summary_only` / `admin_full_log` |
| created_by | string | 是 | Internal | 创建管理员 ID |
| created_at | datetime | 是 | Internal | 创建时间 |
| updated_at | datetime | 是 | Internal | 更新时间 |
| deleted_at | datetime/null | 否 | Internal | 软删除时间 |

建议索引：

- `status`
- `service_type`
- `script_key`
- `deleted_at`

规则：

- 首版所有邀请用户可见全部启用服务。
- 后续可扩展服务级授权表。

## 11. service_requests

用途：记录每一次工作站服务请求。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 内部 ID |
| service_request_id | string | 是 | Internal | 对外追溯 ID，唯一 |
| service_id | string | 是 | Internal | 服务 ID |
| service_name_snapshot | string | 是 | Internal | 服务名称快照 |
| lumitime_user_id | string | 是 | Internal | 发起请求用户 |
| status | enum | 是 | Internal | `pending` / `running` / `success` / `failed` / `canceled` / `timeout` / `not_integrated` |
| failure_code | enum/null | 否 | Internal | 失败原因分类 |
| result_summary | string/null | 否 | Internal | 用户可见摘要 |
| student_account_hash | string/null | 否 | Sensitive | 学生账号不可逆哈希 |
| student_account_masked | string/null | 否 | Sensitive | 学生账号掩码 |
| task_config_sanitized | json/null | 否 | Internal | 脱敏后的任务配置 |
| retry_of_service_request_id | string/null | 否 | Internal | 重试来源 |
| script_version | string/null | 否 | Internal | 执行脚本版本 |
| source_ip_hash | string/null | 否 | Sensitive | 来源 IP 哈希 |
| user_agent_summary | string/null | 否 | Internal | 浏览器摘要 |
| started_at | datetime/null | 否 | Internal | 开始时间 |
| finished_at | datetime/null | 否 | Internal | 结束时间 |
| duration_ms | number/null | 否 | Internal | 执行耗时 |
| created_at | datetime | 是 | Internal | 创建时间 |
| expires_at | datetime | 是 | Internal | 到期清理时间，默认创建后 180 天 |

建议索引：

- `service_request_id` 唯一索引
- `lumitime_user_id`
- `service_id`
- `status`
- `failure_code`
- `created_at`
- `expires_at`
- `student_account_hash`

禁止存储：

- 学生学习 App 密码
- 学生学习 App 完整账号
- Cookie
- Token
- Authorization
- 原始未脱敏请求体

## 12. service_execution_logs

用途：保存服务执行过程中的脱敏日志。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 日志 ID |
| service_request_id | string | 是 | Internal | 关联服务请求 |
| sequence | number | 是 | Internal | 日志顺序 |
| log_level | enum | 是 | Internal | `debug` / `info` / `warn` / `error` |
| step_name | string/null | 否 | Internal | 执行步骤 |
| message_sanitized | text | 是 | Internal | 脱敏后的日志内容 |
| created_at | datetime | 是 | Internal | 日志时间 |
| expires_at | datetime | 是 | Internal | 到期清理时间，默认跟随服务请求 |

建议索引：

- `service_request_id`
- `(service_request_id, sequence)`
- `log_level`
- `created_at`
- `expires_at`

规则：

- 不保存原始未脱敏日志。
- 邀请用户不直接查看完整日志。
- 管理员可查看完整脱敏日志。

## 13. service_audits

用途：记录服务请求相关的审计追溯事件。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 审计 ID |
| service_request_id | string | 是 | Internal | 关联服务请求 |
| lumitime_user_id | string | 是 | Internal | 操作用户 |
| actor_role | enum | 是 | Internal | `invited_user` / `admin` |
| action | enum | 是 | Internal | `create_request` / `retry_request` / `view_result` / `view_log` / `export_record` |
| source_ip_hash | string/null | 否 | Sensitive | 来源 IP 哈希 |
| user_agent_summary | string/null | 否 | Internal | 浏览器摘要 |
| created_at | datetime | 是 | Internal | 创建时间 |

建议索引：

- `service_request_id`
- `lumitime_user_id`
- `action`
- `created_at`

## 14. audit_logs

用途：系统级审计记录。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 审计 ID |
| actor_user_id | string/null | 否 | Internal | 操作用户，访客可为空 |
| actor_role | enum | 是 | Internal | `visitor` / `invited_user` / `admin` / `system` |
| action | string | 是 | Internal | 操作类型 |
| resource_type | string | 是 | Internal | 资源类型 |
| resource_id | string/null | 否 | Internal | 资源 ID |
| result | enum | 是 | Internal | `success` / `failed` |
| metadata_sanitized | json/null | 否 | Internal | 脱敏后的上下文 |
| source_ip_hash | string/null | 否 | Sensitive | 来源 IP 哈希 |
| user_agent_summary | string/null | 否 | Internal | 浏览器摘要 |
| created_at | datetime | 是 | Internal | 创建时间 |

建议索引：

- `actor_user_id`
- `action`
- `resource_type`
- `resource_id`
- `created_at`

规则：

- 仅管理员可查看。
- 不得包含密码、完整学生账号、Token、Cookie、原始请求头。

## 15. visit_events

用途：短期保存脱敏访问明细，用于统计日度访问变化。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 访问事件 ID |
| visitor_id_hash | string/null | 否 | Sensitive | 访客标识哈希，可由会话或设备标识生成 |
| user_id | string/null | 否 | Internal | 登录用户 ID，未登录为空 |
| path | string | 是 | Internal | 访问路径 |
| referrer_domain | string/null | 否 | Internal | 来源域名，不保存完整 URL 中的敏感参数 |
| user_agent_summary | string/null | 否 | Internal | 浏览器摘要 |
| source_ip_hash | string/null | 否 | Sensitive | 来源 IP 哈希 |
| created_at | datetime | 是 | Internal | 访问时间 |
| expires_at | datetime | 是 | Internal | 到期清理时间 |

建议索引：

- `created_at`
- `path`
- `user_id`
- `expires_at`

规则：

- 访问明细短期保留，定期聚合后清理。
- 大屏看板只展示聚合结果。
- 不保存完整 IP。

## 16. daily_metric_snapshots

用途：保存每日聚合统计。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 快照 ID |
| snapshot_date | date | 是 | Public | 快照日期 |
| user_count | number | 是 | Public | 网站用户数 |
| developer_count | number | 是 | Public | 开发者数 |
| visit_count | number | 是 | Public | 访问数 |
| work_count | number | 是 | Public | 个人作品数 |
| script_count | number | 是 | Public | 脚本数 |
| blog_count | number | 是 | Public | 博客数 |
| message_count | number | 是 | Public | 随记数 |
| service_count | number | 是 | Public | 工作站服务数 |
| deltas_json | json | 否 | Public | 较前一日变化 |
| extra_metrics | json/null | 否 | Public | 预留扩展指标 |
| generated_at | datetime | 是 | Internal | 生成时间 |

建议索引：

- `snapshot_date` 唯一索引
- `generated_at`

规则：

- 每天一条全站快照。
- 只存聚合数据，不存明细。
- 可公开展示。

## 17. export_jobs

用途：记录管理员导出行为。

| 字段 | 类型 | 必填 | 敏感等级 | 说明 |
| --- | --- | --- | --- | --- |
| id | string | 是 | Internal | 导出任务 ID |
| export_type | enum | 是 | Internal | `dashboard_snapshots_csv` / `service_requests_csv` |
| status | enum | 是 | Internal | `pending` / `running` / `success` / `failed` |
| requested_by | string | 是 | Internal | 管理员 ID |
| filter_sanitized | json/null | 否 | Internal | 脱敏后的筛选条件 |
| file_storage_key | string/null | 否 | Sensitive | 导出文件存储标识 |
| created_at | datetime | 是 | Internal | 创建时间 |
| finished_at | datetime/null | 否 | Internal | 完成时间 |
| expires_at | datetime/null | 否 | Internal | 导出文件过期时间 |

建议索引：

- `export_type`
- `status`
- `requested_by`
- `created_at`
- `expires_at`

规则：

- 首版导出格式为 CSV。
- 导出文件不得包含敏感字段。

## 18. 保留与清理策略

| 数据 | 策略 |
| --- | --- |
| 内容 `content_items` | 软删除，默认长期保留 |
| 附件 `content_attachments` | 软删除，文件可按后台策略清理 |
| 留言 `messages` | 可隐藏、删除；删除后可软删除或物理清理，待技术设计确认 |
| 服务请求 `service_requests` | 保留 180 天 |
| 服务执行日志 `service_execution_logs` | 跟随服务请求保留 180 天 |
| 服务审计 `service_audits` | 建议至少保留 180 天 |
| 系统审计 `audit_logs` | 建议至少保留 180 天 |
| 访问明细 `visit_events` | 短期保留，聚合后清理；具体天数待确认 |
| 日度快照 `daily_metric_snapshots` | 长期保留 |
| 导出任务 `export_jobs` | 任务记录保留，导出文件可设置过期清理 |

## 19. 关键关系

```text
users 1 ── n invite_codes.created_by
users 1 ── n invite_code_usages.user_id
invite_codes 1 ── n invite_code_usages

users 1 ── n content_items.created_by
content_items 1 ── n content_attachments

users 1 ── n workstation_services.created_by
workstation_services 1 ── n service_requests
users 1 ── n service_requests.lumitime_user_id
service_requests 1 ── n service_execution_logs
service_requests 1 ── n service_audits

users 1 ── n audit_logs.actor_user_id
users 1 ── n export_jobs.requested_by
```

## 20. 测试关注点

- Lumitime 密码只保存哈希。
- 学生学习 App 密码不出现在任何表中。
- 学生学习 App 完整账号不出现在任何表中。
- `service_requests` 只保存账号掩码和不可逆哈希。
- `service_execution_logs` 只保存脱敏日志。
- 邀请用户无法查询他人的 `service_requests`。
- 管理员可以按 `service_request_id` 查询对应记录和脱敏日志。
- 内容删除后前台不可见，但后台可根据软删除策略追溯。
- 作品附件下载必须受 `allow_download` 控制。
- 大屏看板只读取聚合快照，不读取隐私明细。
- 导出 CSV 不包含敏感字段。
- 访问明细到期后可清理，不影响历史日度快照。

## 21. 待确认项

- 访问明细 `visit_events` 的短期保留天数，建议 30 或 90 天。
- 留言删除采用软删除还是物理删除。
- 导出文件保留时间，建议 7 天或 30 天。
- 附件上传最大文件大小和允许文件类型。
- `developer_count` 的计算规则。
- 是否需要增加 `tags` 独立表，还是首版使用 JSON / 数组字段即可。

