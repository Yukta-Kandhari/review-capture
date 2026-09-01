# Review Capture — Email Only

Capture client reviews entirely over email. No Slack required.

## Flow

```
You (dashboard) → Yes → 📧 ONE email to client (draft + sign button)
                              → Client signs → 📧 You get notified
         → No  → log reason
```

## Quick start

```bash
npm install
cp .env.example .env   # fill in SendGrid + PM_EMAIL (or SMTP locally)
npm start
```

Open **http://localhost:3000** — pick a client and click Yes to send one review email.

## Email setup (Render free tier — SendGrid)

1. Create a SendGrid account.
2. Verify a Single Sender for testing, or authenticate your domain for production.
3. Create an API key with Mail Send permission.
4. Add to `.env` or your Render environment:

```bash
SENDGRID_API_KEY=SG.your-api-key
EMAIL_FROM="Your Name <your-verified-sender@example.com>"
PM_EMAIL=you@gmail.com
```

SendGrid uses HTTPS, which works on Render's free tier. Gmail SMTP does not because
Render blocks outbound SMTP ports on free web services.

## Optional local email setup (Gmail SMTP)

1. Enable 2FA on your Google account
2. Create an [App Password](https://myaccount.google.com/apppasswords)
3. Add to `.env`:

```bash
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="Pulkit <you@gmail.com>"
PM_EMAIL=you@gmail.com
```

## Client email links (ngrok)

Email buttons need a public URL. For local dev:

```bash
ngrok http 3000
# Copy https URL → PUBLIC_BASE_URL in .env
```

## Files

| File | Purpose |
|------|---------|
| `src/server.js` | Dashboard + email link handlers |
| `src/flows.js` | Review state machine |
| `src/email.js` | All email sending |
| `config/clients.json` | Client roster + project context |
| `data/reviews/` | Signed reviews (JSON) |

## What emails get sent

| When | To | What |
|------|-----|------|
| You click Yes | Client | **One email** — testimonial draft + Sign button |
| Client signs | You | Confirmation with full signed text |
