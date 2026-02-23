# Deployment & Live Comparison Guide

## What this repo contains
- Runtime PHP proxy and JS helper for `https://happydo.xyz/api`.
- Local test surfaces (`tester.html`, `quick-test.html`, `bridge-test.html`).

## First-time GitHub setup
1. Create a new empty GitHub repository.
2. In this folder, run:
   - `git init`
   - `git add .`
   - `git commit -m "Initial AI proxy baseline"`
   - `git branch -M main`
   - `git remote add origin <YOUR_GITHUB_REPO_URL>`
   - `git push -u origin main`

## Compare local vs live
- Live JS source can be fetched directly from `https://happydo.xyz/api/ailnl.js`.
- Live PHP source is usually **not directly retrievable** (`aiproxy.php` executes server-side), so compare by behavior:
  - `GET /api/aiproxy.php?models`
  - `GET /api/aiproxy.php?describe=gpt-5`
  - Run smoke tests against endpoint using `bridge-test.html`.

## Prepare regular push-to-live
Use one of these options:

### Option A — GitHub Actions deploy (recommended)
- Add workflow in `.github/workflows/deploy-live.yml`.
- Store secrets in GitHub repo:
  - `SFTP_HOST`
  - `SFTP_PORT`
  - `SFTP_USER`
  - `SFTP_PASS` (if using password auth)
  - `SFTP_SSH_KEY` (if using SSH key auth; preferred)
  - `SFTP_REMOTE_PATH` (e.g., `/home/<user>/happydo.xyz/api`)
- Trigger on push to `main` after review.

Notes:
- Workflow supports either key auth (`SFTP_SSH_KEY`) or password auth (`SFTP_PASS`).
- At least one of `SFTP_SSH_KEY` or `SFTP_PASS` must be set.

### Option B — Manual SFTP sync from local
- Keep this repo as source of truth.
- Upload changed files to `happydo.xyz/api` after each commit.

## Safety checks before deploy
- `php -l aiproxy.php`
- Verify `.env` is present on server parent path and not in web root.
- Test:
  - `https://happydo.xyz/api/tester.html`
  - `https://happydo.xyz/api/aiproxy.php?models`

## Guarded deploy (recommended)
- Run guard-only check:
  - `./scripts/predeploy-guard.ps1`
- Run and allow known live/local diffs:
  - `./scripts/predeploy-guard.ps1 -AllowLiveDiff`
- Run guard and trigger deploy workflow:
  - `./scripts/predeploy-guard.ps1 -TriggerDeploy`
