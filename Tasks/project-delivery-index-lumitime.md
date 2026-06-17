# 项目总览 / 交付索引: 拾光筑梦 Lumitime

版本：v0.1  
日期：2026-06-12  
项目名称：拾光筑梦 Lumitime 个人工作站  
项目阶段：需求与设计交付包  

## 1. 项目简介

拾光筑梦 Lumitime 是一个个人工作站网页，用于沉淀个人脚本、个人作品、技术经验、随记留言和工作站服务。

核心定位：

- 对访客公开展示主页、随记留言板和大屏看板。
- 对邀请用户开放脚本、作品、博客和工作站服务。
- 管理员统一维护内容、邀请码、用户、服务、审计和统计。
- 工作站是服务集合，首个服务为“日志自动提交”。
- 日志自动提交服务使用学生学习 App 账号密码完成当次自动化任务，但系统不保存密码。

品牌含义：

```text
拾光筑梦 Lumitime
lumi 微光 + time 时光
Every faint light of time, paves the way for your dream.
```

寓意为收拢过往时光中的微光与经历，以此为基石奔赴未来理想。

## 2. 已完成交付物

### 2.1 产品与需求

| 文档 | 用途 | 主要读者 |
| --- | --- | --- |
| [PRD: 拾光筑梦 Lumitime 个人工作站](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/prd-lumitime-personal-workstation.md) | 定义产品目标、范围、用户故事、功能需求、非目标 | 产品、技术、测试、设计 |
| [权限矩阵](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/permission-matrix-lumitime.md) | 定义访客、邀请用户、管理员的访问与操作边界 | 产品、后端、测试 |
| [需求追踪矩阵 RTM](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/requirements-traceability-matrix-lumitime.md) | 将需求映射到设计、接口、数据、开发任务和测试用例 | 项目管理、测试、评审人员 |
| [需求追踪矩阵 CSV](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/requirements-traceability-matrix-lumitime.csv) | 表格化跟踪需求覆盖状态 | 项目管理、测试 |

### 2.2 信息架构与视觉交互

| 文档 | 用途 | 主要读者 |
| --- | --- | --- |
| [页面结构图 / 信息架构](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/information-architecture-lumitime.md) | 定义公开区、邀请用户区、管理后台的页面结构和路由 | 产品、前端、UI |
| [视觉交互设计说明](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/visual-interaction-design-lumitime.md) | 定义黑白主视觉、登录页 1:2 布局、反转动画、小猫交互、大屏和后台风格 | UI、前端、产品 |

### 2.3 技术设计

| 文档 | 用途 | 主要读者 |
| --- | --- | --- |
| [接口设计文档](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/api-design-lumitime.md) | 定义 `/api/v1` 接口、统一响应、鉴权、工作站服务、导出和审计接口 | 前端、后端、测试 |
| [数据模型设计 / 数据字典](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/data-model-lumitime.md) | 定义用户、邀请码、内容、附件、留言、服务、日志、审计、统计等数据对象 | 后端、数据库、测试 |
| [服务提交记录与执行日志设计](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/service-record-log-design-lumitime.md) | 定义工作站服务记录、执行日志、失败分类、重试、导出和脱敏规则 | 后端、测试、安全评审 |
| [概要设计文档](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/high-level-design-lumitime.md) | 定义总体架构、模块职责、Web/Worker/DB/文件存储、Docker 部署思路 | 技术负责人、后端、运维 |
| [详细设计文档](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/detailed-design-lumitime.md) | 细化认证、权限、服务执行、Worker、脱敏、导出、统计等流程和伪代码 | 后端、前端、代码评审 |

### 2.4 测试与验收

| 文档 | 用途 | 主要读者 |
| --- | --- | --- |
| [测试计划](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/test-plan-lumitime.md) | 定义测试目标、范围、策略、环境、进入退出标准和风险重点 | 测试、产品、技术 |
| [测试用例 CSV](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/test-cases-lumitime.csv) | 标准测试用例表，覆盖功能、权限、接口、隐私、安全、视觉、兼容性、性能 | 测试、开发 |
| [UAT 用户验收方案](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/uat-acceptance-plan-lumitime.md) | 定义访客、邀请用户、管理员的上线前用户验收场景 | 产品、站点拥有者、试用用户 |

### 2.5 项目执行、风险与运维

| 文档 | 用途 | 主要读者 |
| --- | --- | --- |
| [开发任务拆分 / 里程碑计划](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/development-plan-lumitime.md) | 按周拆分 MVP 开发任务、验收标准、二期增强任务 | 项目管理、开发、测试 |
| [风险清单与应对方案](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/risk-register-lumitime.md) | 识别隐私、权限、脚本、Docker、数据、统计、进度等风险及应对 | 产品、技术、安全、运维 |
| [上线部署与运维手册](C:/Users/HP/Documents/Codex/2026-06-12/productrequirements-document-app-lumitime-lumi-time/outputs/deployment-operations-manual-lumitime.md) | 定义单台云服务器、Docker Compose、HTTPS、备份、更新、回滚、管理员操作 | 运维、开发、站点管理员 |

## 3. 推荐阅读顺序

### 3.1 产品 / 需求评审

1. PRD
2. 权限矩阵
3. 页面结构图 / 信息架构
4. 视觉交互设计说明
5. 风险清单
6. 需求追踪矩阵

### 3.2 技术评审

1. PRD
2. 权限矩阵
3. 接口设计
4. 数据模型设计
5. 服务提交记录与执行日志设计
6. 概要设计
7. 详细设计
8. 上线部署与运维手册

### 3.3 前端 / UI 开发

1. 页面结构图 / 信息架构
2. 视觉交互设计说明
3. 接口设计
4. 权限矩阵
5. 测试用例 CSV

### 3.4 后端开发

1. 接口设计
2. 数据模型设计
3. 详细设计
4. 服务提交记录与执行日志设计
5. 权限矩阵
6. 开发任务拆分

### 3.5 测试验收

1. PRD
2. 权限矩阵
3. 测试计划
4. 测试用例 CSV
5. UAT 用户验收方案
6. 需求追踪矩阵

### 3.6 部署运维

1. 概要设计
2. 上线部署与运维手册
3. 风险清单
4. 测试计划中的上线退出标准
5. 开发任务拆分中的 Week 6

## 4. 核心设计结论摘要

### 4.1 角色权限

| 角色 | 权限摘要 |
| --- | --- |
| 访客 | 查看主页、留言板、大屏；可留言；不可访问脚本、作品、博客、工作站、后台 |
| 邀请用户 | 查看脚本、作品、博客、工作站；可复制脚本；可使用服务；可查看自己的提交记录 |
| 管理员 | 管理全部内容、邀请码、用户、留言、服务、提交记录、审计和导出 |

### 4.2 工作站定位

工作站不是普通表单中心，而是服务集合。  
日志自动提交是其中一个服务：用户输入学生学习 App 账号密码，后台运行封装脚本，返回结果摘要和提交记录。

### 4.3 隐私边界

必须遵守：

- 学生学习 App 密码不入库。
- 学生学习 App 密码不写日志。
- 学生学习 App 密码不导出。
- 学生学习 App 完整账号不保存，只保存掩码和不可逆哈希。
- 执行日志先脱敏再存储。

### 4.4 技术架构

- 模块化单体。
- Web/API 与 Worker 分离。
- 首版数据库任务表，后续可升级消息队列。
- 文件存储使用抽象层，不绑定本地或对象存储。
- Docker Compose 部署，包含 web、worker、db、reverse-proxy、backup。

### 4.5 开发策略

- 按 6 周 MVP 推进。
- 真实日志脚本接入放到 V0.3。
- 登录页主视觉和反转动画进入一期。
- 小猫交互进入二期。
- 先测试环境，稳定后生产上线。

## 5. 当前未决事项

以下事项需要在开发前或开发过程中确认：

| 事项 | 建议处理阶段 |
| --- | --- |
| 最终技术栈 | 技术评审前 |
| 数据库类型 | 技术评审前 |
| 临时凭证传递机制 | 工作站服务开发前 |
| 访问明细保留天数 | 大屏统计开发前 |
| `developer_count` 统计口径 | 大屏开发前 |
| 真实日志自动提交脚本接入时间 | V0.3 规划前 |
| 登录页人物素材实现方式 | UI 设计阶段 |
| 小猫形象和交互细节 | V0.2 规划前 |
| Docker 生产机器配置 | 部署前 |
| 备份保留天数和是否异地备份 | 部署前 |

## 6. 下一步建议

建议按以下顺序推进：

1. 召开 PRD 和权限矩阵评审。
2. 确认技术栈、数据库、部署方式。
3. 对“临时凭证传递机制”做专项技术评审。
4. 完成 UI 设计稿，特别是登录页主视觉。
5. 按开发任务拆分进入 Week 1。
6. 在 Week 4 前准备模拟日志自动提交脚本。
7. 在 Week 6 执行完整测试计划和 UAT。
8. 上线前按运维手册执行备份、部署、回滚检查。

## 7. 文档维护规则

- 需求变更后，先更新 PRD，再更新 RTM。
- 权限变更后，必须同步更新权限矩阵、接口设计、测试用例。
- 服务执行逻辑变更后，必须同步更新详细设计、服务记录设计、隐私安全测试。
- 部署方式变更后，必须同步更新概要设计和运维手册。
- 每次正式评审后建议记录版本号和变更摘要。

