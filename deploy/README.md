# Lumitime 生产部署说明

本目录提供 Lumitime 当前实现可直接使用的单机生产部署包：Docker Compose、FastAPI API 镜像、React/Nginx 静态站点镜像、Nginx HTTPS 模板、环境变量样板和备份任务。

## 1. 部署形态

- `db`: PostgreSQL 16，持久化到宿主机目录。
- `migrate`: 一次性 Alembic 迁移任务，执行 `alembic upgrade head`。
- `api`: FastAPI 后端，生产环境强制 PostgreSQL，启动时校验数据库已迁移到 head。
- `nginx`: 托管 React 构建产物，处理 HTTPS，并将 `/api/` 反向代理到 `api:8000`。
- `backup`: 一次性备份任务，导出 PostgreSQL dump、uploads 压缩包和部署配置模板。

当前生产部署默认启用内联日志提交执行器：`LUMITIME_ENABLE_INLINE_WORKER=1` 且 `LUMITIME_LOG_SUBMIT_MODE=dry_run`。该模式复用本地验收流程，会生成服务记录和脱敏执行日志，但不会请求真实学校系统。只有在确认外部脚本资源、目标系统网络和运维告警都就绪后，才建议把 `LUMITIME_LOG_SUBMIT_MODE` 切为 `real`。

## 2. 首次部署

在服务器上准备目录和证书：

```bash
mkdir -p /opt/lumitime/app
# 将代码仓库放到 /opt/lumitime/app，以下命令默认在该目录执行
sudo mkdir -p /opt/lumitime/data/postgres /opt/lumitime/data/uploads /opt/lumitime/backups /opt/lumitime/certs
sudo cp fullchain.pem /opt/lumitime/certs/fullchain.pem
sudo cp privkey.pem /opt/lumitime/certs/privkey.pem
sudo chown root:root /opt/lumitime/certs/fullchain.pem /opt/lumitime/certs/privkey.pem
sudo chmod 644 /opt/lumitime/certs/fullchain.pem
sudo chmod 600 /opt/lumitime/certs/privkey.pem
```

`deploy/.env.example` 里 `LUMITIME_CERT_DIR` 指向宿主机证书目录，Nginx 进程内部使用 `/etc/nginx/certs/fullchain.pem` 和 `/etc/nginx/certs/privkey.pem`。

如果使用本仓库旁边的 `25638083_yeen666.cn_nginx` 证书包，上传到服务器后按 Compose 期望的文件名落盘：

```bash
sudo install -m 644 25638083_yeen666.cn_nginx/yeen666.cn.pem /opt/lumitime/certs/fullchain.pem
sudo install -m 600 25638083_yeen666.cn_nginx/yeen666.cn.key /opt/lumitime/certs/privkey.pem
```

创建生产环境变量：

```bash
cp deploy/.env.example deploy/.env
```

必须修改 `deploy/.env` 中的域名、数据库密码、`LUMITIME_DATABASE_URL`、`LUMITIME_SECRET_KEY`、`LUMITIME_BOOTSTRAP_TOKEN` 和 `LUMITIME_CORS_ORIGINS`。`LUMITIME_SECRET_KEY` 生产环境必须是至少 32 字符的非默认密钥，`LUMITIME_CORS_ORIGINS` 不能留空或使用 `*`。如果数据库密码包含特殊字符，`LUMITIME_DATABASE_URL` 中的密码部分需要 URL encode。

`yeen666.cn` 的关键生产变量示例：

```dotenv
LUMITIME_SERVER_NAME=yeen666.cn
LUMITIME_CORS_ORIGINS=https://yeen666.cn
LUMITIME_CERT_DIR=/opt/lumitime/certs
LUMITIME_SSL_CERTIFICATE=/etc/nginx/certs/fullchain.pem
LUMITIME_SSL_CERTIFICATE_KEY=/etc/nginx/certs/privkey.pem
```

如果同时解析 `www.yeen666.cn`，需要把 `LUMITIME_SERVER_NAME` 写成 `yeen666.cn www.yeen666.cn`，并把 `LUMITIME_CORS_ORIGINS` 写成 `https://yeen666.cn,https://www.yeen666.cn`。

构建镜像、执行迁移并启动：

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yml build
docker compose --env-file deploy/.env -f deploy/compose.prod.yml run --rm migrate
docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d db api nginx
```

检查健康状态：

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yml ps
curl -fsS https://lumitime.example.com/api/v1/health
```

## 3. 初始化管理员

首次上线后调用已有接口创建管理员：

```bash
curl -X POST https://lumitime.example.com/api/v1/auth/bootstrap-admin \
  -H 'Content-Type: application/json' \
  -d '{
    "bootstrap_token": "replace-with-deploy-env-token",
    "username": "admin",
    "display_name": "Admin",
    "password": "replace-with-strong-password"
  }'
```

管理员创建成功后，立即把 `deploy/.env` 中的 `LUMITIME_BOOTSTRAP_TOKEN` 清空，并重启 API：

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d api
```

## 4. 备份

手动备份：

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yml run --rm backup
```

默认输出到 `/opt/lumitime/backups/<timestamp>/`，包含：

- `db/lumitime.dump`
- `uploads/uploads.tar.gz`
- `configs/deploy-configs.tar.gz`

宿主机 cron 示例：

```cron
15 2 * * * cd /opt/lumitime/app && docker compose --env-file deploy/.env -f deploy/compose.prod.yml run --rm backup >> /opt/lumitime/backups/backup.log 2>&1
```

默认保留 `BACKUP_RETENTION_DAYS=14` 天。

## 5. 恢复

恢复数据库前先停止 API 写入：

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yml stop api nginx
```

恢复数据库 dump 示例：

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yml run --rm \
  -e RESTORE_TIMESTAMP=20260617T020000Z restore
```

`restore` 会同时恢复 `db/lumitime.dump` 和 `uploads/uploads.tar.gz`。

恢复后启动服务并检查健康：

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d db api nginx
curl -fsS https://lumitime.example.com/api/v1/health
```

## 6. 更新发布

更新前先备份：

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yml run --rm backup
```

拉取新代码后执行：

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yml build
docker compose --env-file deploy/.env -f deploy/compose.prod.yml run --rm migrate
docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d db api nginx
curl -fsS https://lumitime.example.com/api/v1/health
```

生产建议把 `LUMITIME_API_IMAGE` 和 `LUMITIME_NGINX_IMAGE` 改为带版本号的镜像标签，例如 `registry.example.com/lumitime-api:v0.1.0`，便于回滚。
