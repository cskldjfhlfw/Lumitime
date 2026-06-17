# Lumitime Backend

FastAPI backend for the Lumitime API contract.

## Run

```powershell
cd D:\desk\projects\Lumitime
python -m uvicorn backend.app.main:app --reload --port 8000
```

The API is mounted at `http://127.0.0.1:8000/api/v1`.

By default the backend expects PostgreSQL at `127.0.0.1:5432` using the URL
`postgresql+psycopg://lumitime:lumitime@127.0.0.1:5432/lumitime`.
For a lightweight local run you can override it with SQLite:

```powershell
$env:LUMITIME_DATABASE_URL='sqlite:///./backend/lumitime.db'
$env:LUMITIME_AUTO_MIGRATE='1'
python -m uvicorn backend.app.main:app --reload --port 8000
```

## Default Seed Accounts

| Role | Username | Password |
| --- | --- | --- |
| admin | `admin` | `admin` |
| invited_user | `member` | `member123` |

Default invite code: `LUMI-A1B2`.

## Configuration

Environment variables:

- `LUMITIME_DATABASE_URL`: SQLAlchemy database URL. Defaults to `postgresql+psycopg://lumitime:lumitime@127.0.0.1:5432/lumitime`.
- `LUMITIME_SECRET_KEY`: secret for hashes and session metadata. Defaults to a development value.
- `LUMITIME_COOKIE_SECURE`: set to `1` for HTTPS deployments.
- `LUMITIME_CORS_ORIGINS`: comma-separated CORS origins. Defaults to local Vite origins.
- `LUMITIME_UPLOAD_DIR`: upload storage root. Defaults to `backend/uploads`.
- `LUMITIME_BOOTSTRAP_TOKEN`: temporary production token for `POST /api/v1/auth/bootstrap-admin`.
- `LUMITIME_AUTO_MIGRATE`: auto-run Alembic migrations in non-production environments. Defaults to `1`.
- `LUMITIME_REQUIRE_MIGRATED_DB`: require the database to be at Alembic head before serving. Defaults to `1`.

## Production Deployment

Production deployment files live in `deploy/`:

- `deploy/compose.prod.yml`: PostgreSQL, migration job, API, Nginx, backup and restore services.
- `deploy/.env.example`: production environment template.
- `deploy/README.md`: first deployment, admin bootstrap, backup, restore and update commands.
