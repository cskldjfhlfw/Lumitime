# Lumitime 生产部署说明

本目录提供 Lumitime 当前实现可直接使用的单机生产部署包：Docker Compose、FastAPI API 镜像、React/Nginx 静态站点镜像、Nginx HTTPS 模板、环境变量样板和备份任务。

## 1. 部署形态

- `db`: PostgreSQL 16，持久化到宿主机目录。
- `migrate`: 一次性 Alembic 迁移任务，执行 `alembic upgrade head`。
- `api`: FastAPI 后端，生产环境强制 PostgreSQL，启动时校验数据库已迁移到 head。
- `nginx`: 托管 React 构建产物，处理 HTTPS，并将 `/api/` 反向代理到 `api:8000`。
- `backup`: 一次性备份任务，导出 PostgreSQL dump、uploads 压缩包和部署配置模板。

当前代码没有可独立生产运行的外部 Worker。生产部署保持 `LUMITIME_ENABLE_INLINE_WORKER=0`，未真实接入的工作站服务会按当前后端逻辑返回 `not_integrated`。

## 2. 首次部署

在服务器上准备目录和证书：

```bash
mkdir -p /opt/lumitime/app
# 将代码仓库放到 /opt/lumitime/app，以下命令默认在该目录执行
sudo mkdir -p /opt/lumitime/data/postgres /opt/lumitime/data/uploads /opt/lumitime/backups /opt/lumitime/certs
sudo cp fullchain.pem /opt/lumitime/certs/fullchain.pem
sudo cp privkey.pem /opt/lumitime/certs/privkey.pem
```

`deploy/.env.example` 里 `LUMITIME_CERT_DIR` 指向宿主机证书目录，Nginx 进程内部使用 `/etc/nginx/certs/fullchain.pem` 和 `/etc/nginx/certs/privkey.pem`。

创建生产环境变量：

```bash
cp deploy/.env.example deploy/.env
```

必须修改 `deploy/.env` 中的域名、数据库密码、`LUMITIME_DATABASE_URL`、`LUMITIME_SECRET_KEY`、`LUMITIME_BOOTSTRAP_TOKEN` 和 `LUMITIME_CORS_ORIGINS`。如果数据库密码包含特殊字符，`LUMITIME_DATABASE_URL` 中的密码部分需要 URL encode。

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
