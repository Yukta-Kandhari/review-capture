## Deploy to Render (free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint** (or Web Service)
3. Connect your GitHub repo
4. Render reads `render.yaml` automatically
5. Add secret env vars when prompted:
   - `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `PM_EMAIL`
   - Optional: `ANTHROPIC_API_KEY`, `GOOGLE_FORM_URL`
6. Deploy — your app URL will be `https://review-capture-xxxx.onrender.com`
7. Email links auto-use that URL (via `RENDER_EXTERNAL_URL`)

**Note:** Free tier sleeps after 15 min idle — first visit may take ~30s to wake up.

**Note:** Review data (`data/`) resets on redeploy on free tier. Upgrade to Render disk for persistence.
