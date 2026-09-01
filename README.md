# Review Capture — Email Only

Capture client reviews entirely over email. No Slack required.

## Flow

```
You (dashboard) → Yes → 📧 Email to client (Y/N)
                              → Yes → Claude draft → you approve → 📧 Sign email → Done
                              → No  → Google Form → loop back
         → No  → log reason
```

## Quick start

```bash
npm install
cp .env.example .env   # fill in SMTP + PM_EMAIL
npm start
```

Open **http://localhost:3000** — your dashboard to pick clients and approve drafts.

## Email setup (Gmail)

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
| You click Yes | Client | "Do you like our service?" Y/N |
| Client clicks Yes | You (`PM_EMAIL`) | Draft ready — approve link |
| You approve | Client | Sign testimonial link |
| Client signs | You | Confirmation with full text |
| Client clicks No | You | Alert + client redirected to Google Form |
