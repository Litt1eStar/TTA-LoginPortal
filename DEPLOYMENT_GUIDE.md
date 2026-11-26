# Deploying the TTA Portal

| Target | Status | Runbook |
|---|---|---|
| KMUTT server `CIT_TTA2027` (10.2.15.250), Windows, no Docker | **Primary** | [`deploy/kmutt/README.md`](deploy/kmutt/README.md) |
| CMM droplet (`tta.portal.cmm.works`), Docker + Caddy, deployed by hand from GitHub Actions | Fallback | [`deploy/cmm/README.md`](deploy/cmm/README.md) |

Both run the same build: one Node process serving `/api` and the frontend, data in `server/data` (SQLite + uploads).
Moving between them = copy `portal.db` and `uploads/`.

Step-by-step first install on KMUTT (Login Portal and Landing Page): [`deploy/kmutt/DEPLOY_STEP_BY_STEP.md`](deploy/kmutt/DEPLOY_STEP_BY_STEP.md).
Domain `https://tta2027.kmutt.ac.th` (nginx on port 80, HTTPS mode, Google Drive): [`deploy/kmutt/NGINX_DOMAIN_SETUP.md`](deploy/kmutt/NGINX_DOMAIN_SETUP.md).
Updating after an edit (laptop → GitHub → server): [`docs/MAINTENANCE_WORKFLOW.md`](docs/MAINTENANCE_WORKFLOW.md).

Progress: `docs/superpowers/plans/2026-11-25-kmutt-server-deploy.md`.
