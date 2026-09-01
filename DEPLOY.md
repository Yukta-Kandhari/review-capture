## Deploy to Render (free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint** (or Web Service)
3. Connect your GitHub repo
4. Render reads `render.yaml` automatically
5. In SendGrid, verify a Single Sender (for testing) or authenticate your domain,
   then create an API key with Mail Send permission.
6. Add these secret env vars when prompted:
   - `SENDGRID_API_KEY=SG...`
   - `EMAIL_FROM=Your Name <your-verified-sender@example.com>`
   - `PM_EMAIL=you@gmail.com`
   - Optional: `ANTHROPIC_API_KEY`, `GOOGLE_FORM_URL`
7. Deploy — your app URL will be `https://review-capture-xxxx.onrender.com`
8. Email links auto-use that URL (via `RENDER_EXTERNAL_URL`)

Render free services block SMTP ports 25, 465, and 587. The SendGrid HTTPS API
avoids that restriction. SMTP remains available for local or paid hosting.

**Note:** Free tier sleeps after 15 min idle — first visit may take ~30s to wake up.

**Note:** Review data (`data/`) resets on redeploy on free tier. Upgrade to Render disk for persistence.
