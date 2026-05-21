# Codex Tools

11 free student tools deployed as a single static bundle. Each app lives in its own subfolder; the root `index.html` is the landing page that links them.

## Apps

| Slug | Purpose |
|---|---|
| `attendance-guardian/` | Attendance tracker |
| `cgpa-rescue-planner/` | CGPA projection |
| `coursevault/` | Course materials organizer |
| `deadline-panic-shield/` | Deadline tracker |
| `exam-war-room/` | Exam prep |
| `groupfair/` | Group task allocator |
| `labreport-pro/` | Lab report templates |
| `notemorph/` | Note transformer |
| `student-survival-wallet/` | Budget tracker |
| `studybuddy-match/` | Study partner matcher |
| `uniroute-routine/` | Weekly routine (PWA) |

## Deploy

Pushed to GitHub → Cloudflare Pages auto-deploys.

Single Cloudflare Pages project `codex-tools` serves the whole bundle at `<domain>/<slug>/`.

Set GitHub Secrets:

- `CLOUDFLARE_API_TOKEN` — create at https://dash.cloudflare.com/profile/api-tokens
- `CLOUDFLARE_ACCOUNT_ID` — find in your Cloudflare dashboard sidebar

Then `git push` triggers `.github/workflows/deploy.yml`.

## Local preview

```bash
npx serve .
# → http://localhost:3000
```

## License

MIT.
