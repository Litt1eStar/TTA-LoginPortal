# Deploying the TTA Portal

| Target | Status | Runbook |
|---|---|---|
| KMUTT server `CIT_TTA2027` (10.2.15.250), Windows, no Docker | **Primary** | [`deploy/kmutt/README.md`](deploy/kmutt/README.md) |
| CMM droplet (`tta.portal.cmm.works`), Docker + Caddy, deployed by hand from GitHub Actions | Fallback | [`deploy/cmm/README.md`](deploy/cmm/README.md) |

Both run the same build: one Node process serving `/api` and the frontend, data in `server/data` (SQLite + uploads).
Moving between them = copy `portal.db` and `uploads/`.

Progress: `docs/superpowers/plans/2026-11-25-kmutt-server-deploy.md`.
