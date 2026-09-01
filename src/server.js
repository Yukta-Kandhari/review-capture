import "dotenv/config";
import express from "express";
import {
  processClientLovesService,
  processClientUnhappy,
  processClientSign,
  initiateReviewRequest,
  sendReviewForSignature,
  regenerateReview,
  getDashboardData,
  getClientById,
  clients,
  resendSatisfactionEmail,
  resendSignatureEmail,
} from "./flows.js";
import { createSession, logDecline, getSession, listDeclined, cancelSession, getActiveSessionForClient } from "./store.js";
import { isEmailConfigured, baseUrl } from "./email.js";

const port = Number(process.env.PORT || process.env.HTTP_PORT || 3000);
const app = express();
app.use(express.urlencoded({ extended: true }));

function page(title, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Review Capture</title>
<style>
  *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f8f8f8}
  h1{font-size:1.5rem;margin:0 0 8px}h2{font-size:1.1rem;margin:32px 0 12px;color:#611f69}
  .card{background:#fff;border-radius:8px;padding:16px 20px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .client-name{font-weight:600;font-size:1.05rem}.meta{color:#616061;font-size:.9rem;margin-top:4px}
  .actions{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
  .btn{display:inline-block;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:.9rem;border:none;cursor:pointer;font-family:inherit}
  .btn-yes{background:#2eb67d;color:#fff}.btn-no{background:#e8e8e8;color:#1a1a1a}
  .btn-primary{background:#611f69;color:#fff}.btn-secondary{background:#e8e8e8;color:#1a1a1a}
  blockquote{border-left:4px solid #611f69;padding-left:16px;margin:12px 0;font-style:italic;color:#333}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.75rem;background:#ede7f0;color:#611f69}
  .alert{padding:12px 16px;border-radius:6px;margin-bottom:16px;background:#e8f5e9;color:#2e7d32}
  .warn{background:#fff3e0;color:#e65100}
  form.inline{display:inline}
  textarea{width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-family:inherit;margin-top:8px}
  .skip-form{margin-top:12px;padding-top:12px;border-top:1px solid #eee}
</style></head>
<body>${body}</body></html>`;
}

function thankYouPage(title, message) {
  return page(title, `<div class="card" style="text-align:center;margin-top:48px"><h1>${title}</h1><p>${message}</p></div>`);
}

function activeSessionActions(session) {
  const b = baseUrl();
  const cancelBtn = `<form class="inline" method="POST" action="/admin/cancel/${session.id}">
    <button type="submit" class="btn btn-no">✕ Cancel & start over</button>
  </form>`;

  if (session.status === "awaiting_client_response") {
    const emailNote = session.emailSentAt
      ? `Email sent ${new Date(session.emailSentAt).toLocaleString()}`
      : `⚠️ Email may not have sent — use Resend`;
    return `<p class="meta" style="margin-top:8px">${emailNote}</p>
      <p class="meta">Client must click Yes or No in their email. Testing on this machine?</p>
      <div class="actions">
        <a href="${b}/r/${session.id}/yes" class="btn btn-yes">Simulate: Client Yes</a>
        <a href="${b}/r/${session.id}/no" class="btn btn-no">Simulate: Client No</a>
        <form class="inline" method="POST" action="/admin/resend/${session.id}">
          <button type="submit" class="btn btn-secondary">📧 Resend email</button>
        </form>
        ${cancelBtn}
      </div>`;
  }

  if (session.status === "awaiting_signature") {
    return `<p class="meta" style="margin-top:8px">Waiting for client signature</p>
      <div class="actions">
        <a href="${b}/r/${session.id}/sign" class="btn btn-primary">✍️ Open sign link</a>
        <form class="inline" method="POST" action="/admin/resend-sign/${session.id}">
          <button type="submit" class="btn btn-secondary">📧 Resend sign email</button>
        </form>
        ${cancelBtn}
      </div>`;
  }

  return `<p class="meta" style="margin-top:8px">Processing…</p>${cancelBtn}`;
}

function renderDashboard() {
  const { pending, signed, unhappy } = getDashboardData();
  const declined = listDeclined();

  const clientCards = clients
    .map((c) => {
      const active = getActiveSessionForClient(c.id);
      const statusBadge = active
        ? `<span class="badge">${active.status.replace(/_/g, " ")}</span>`
        : "";

      return `<div class="card">
        <div class="client-name">${c.name} ${statusBadge}</div>
        <div class="meta">${c.contactName} · ${c.email}</div>
        <div class="meta">${c.projectSummary.slice(0, 100)}…</div>
        ${
          active
            ? activeSessionActions(active)
            : `<div class="actions">
            <form class="inline" method="POST" action="/admin/request/${c.id}">
              <button type="submit" class="btn btn-yes">✅ Yes — request review</button>
            </form>
            <button type="button" class="btn btn-no" onclick="document.getElementById('skip-${c.id}').style.display='block'">❌ No — skip</button>
          </div>
          <div id="skip-${c.id}" class="skip-form" style="display:none">
            <form method="POST" action="/admin/skip/${c.id}">
              <label>Understand why?</label>
              <textarea name="reason" rows="2" placeholder="Project still in progress, timing not right…" required></textarea>
              <div class="actions"><button type="submit" class="btn btn-no">Save & skip</button></div>
            </form>
          </div>`
        }
      </div>`;
    })
    .join("");

  const pendingCards = pending
    .map((s) => {
      const c = getClientById(clients, s.clientId);
      return `<div class="card">
        <div class="client-name">${c?.name ?? s.clientId} <span class="badge">needs approval</span></div>
        <blockquote>${s.draftText}</blockquote>
        <div class="actions">
          <a href="/admin/approve/${s.id}" class="btn btn-primary">✅ Approve & send for signature</a>
          <a href="/admin/regenerate/${s.id}" class="btn btn-secondary">🔄 Regenerate</a>
        </div>
      </div>`;
    })
    .join("");

  const signedCards = signed
    .slice(0, 10)
    .map((s) => {
      const c = getClientById(clients, s.clientId);
      return `<div class="card">
        <div class="client-name">✅ ${c?.name ?? s.clientId}</div>
        <blockquote>${s.draftText}</blockquote>
        <div class="meta">Signed ${new Date(s.signedAt).toLocaleString()}</div>
      </div>`;
    })
    .join("");

  const emailStatus = isEmailConfigured()
    ? `<div class="alert">📧 Email configured · links use ${baseUrl()}</div>`
    : `<div class="alert warn">⚠️ Set SMTP_* in .env to send emails</div>`;

  return page(
    "Reviews",
    `${emailStatus}
    <h1>📋 Reviews to be taken</h1>
    <p class="meta">Click Yes to email the client. They respond via email — you approve drafts here or via email link.</p>
    ${clientCards}
    ${pending.length ? `<h2>Pending your approval</h2>${pendingCards}` : ""}
    ${unhappy.length ? `<h2>Needs reorientation (${unhappy.length})</h2><p class="meta">Clients sent to Google Form — loop back when ready.</p>` : ""}
    ${signed.length ? `<h2>Signed reviews</h2>${signedCards}` : ""}
    ${declined.length ? `<h2>Skipped</h2>${declined.map((d) => `<div class="card meta">${d.clientId}: ${d.reason}</div>`).join("")}` : ""}`
  );
}

// ─── Admin dashboard ────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.send(renderDashboard()));
app.get("/admin", (_req, res) => res.redirect("/"));

app.post("/admin/request/:clientId", async (req, res) => {
  try {
    const clientRecord = getClientById(clients, req.params.clientId);
    if (!clientRecord) return res.status(404).send("Client not found");

    const existing = getActiveSessionForClient(clientRecord.id);
    if (existing) {
      return res.redirect("/?already=1");
    }

    const session = createSession(clientRecord.id, "pm");
    try {
      await initiateReviewRequest(clientRecord, session);
    } catch (err) {
      cancelSession(session.id);
      throw err;
    }
    res.redirect("/?sent=1");
  } catch (err) {
    res.status(500).send(page("Error", `<div class="card warn">${err.message}</div><p><a href="/">← Back</a></p>`));
  }
});

app.post("/admin/cancel/:sessionId", (req, res) => {
  cancelSession(req.params.sessionId);
  res.redirect("/");
});

app.post("/admin/resend/:sessionId", async (req, res) => {
  try {
    await resendSatisfactionEmail(req.params.sessionId);
    res.redirect("/?resent=1");
  } catch (err) {
    res.status(500).send(page("Error", `<div class="card warn">${err.message}</div><p><a href="/">← Back</a></p>`));
  }
});

app.post("/admin/resend-sign/:sessionId", async (req, res) => {
  try {
    await resendSignatureEmail(req.params.sessionId);
    res.redirect("/?resent=1");
  } catch (err) {
    res.status(500).send(page("Error", `<div class="card warn">${err.message}</div><p><a href="/">← Back</a></p>`));
  }
});

app.post("/admin/skip/:clientId", (req, res) => {
  logDecline(req.params.clientId, req.body.reason || "No reason given", "pm");
  res.redirect("/");
});

app.get("/admin/review/:sessionId", (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session?.draftText) return res.status(404).send("Session not found");
  const c = getClientById(clients, session.clientId);
  res.send(
    page(
      "Review draft",
      `<div class="card">
        <h1>${c?.name}</h1>
        <blockquote>${session.draftText}</blockquote>
        <div class="actions">
          <a href="/admin/approve/${session.id}" class="btn btn-primary">✅ Approve & send for signature</a>
          <a href="/admin/regenerate/${session.id}" class="btn btn-secondary">🔄 Regenerate</a>
          <a href="/" class="btn btn-secondary">← Dashboard</a>
        </div>
      </div>`
    )
  );
});

app.get("/admin/approve/:sessionId", async (req, res) => {
  try {
    await sendReviewForSignature(req.params.sessionId);
    res.send(
      thankYouPage(
        "Sent! 📧",
        "Signature email sent to the client. You'll get an email when they sign."
      )
    );
  } catch (err) {
    res.status(500).send(page("Error", `<div class="card warn">${err.message}</div>`));
  }
});

app.get("/admin/regenerate/:sessionId", async (req, res) => {
  try {
    await regenerateReview(req.params.sessionId);
    res.redirect(`/admin/review/${req.params.sessionId}`);
  } catch (err) {
    res.status(500).send(page("Error", `<div class="card warn">${err.message}</div>`));
  }
});

// ─── Client email link handlers ─────────────────────────────────────────────
app.get("/r/:sessionId/yes", async (req, res) => {
  try {
    const result = await processClientLovesService(req.params.sessionId);
    if (result.alreadyProcessed) {
      return res.send(thankYouPage("Already received!", "We already got your response. Thank you!"));
    }
    res.send(
      thankYouPage(
        "Thank you! ❤️",
        "We're preparing your testimonial. You'll receive an email shortly to review and sign it."
      )
    );
  } catch (err) {
    console.error(err);
    res.status(500).send(thankYouPage("Something went wrong", "Please reply to the email directly."));
  }
});

app.get("/r/:sessionId/no", async (req, res) => {
  try {
    const result = await processClientUnhappy(req.params.sessionId);
    const formUrl = result.formUrl || "#";
    if (result.alreadyProcessed) {
      return res.send(thankYouPage("Already received!", "We already got your feedback. Thank you!"));
    }
    res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>We'd love your feedback</title>
<meta http-equiv="refresh" content="3;url=${formUrl}">
<style>body{font-family:-apple-system,sans-serif;max-width:480px;margin:80px auto;text-align:center;padding:24px;}
a{color:#611f69;}</style></head>
<body><h1>Thank you for your honesty</h1>
<p>Redirecting you to our feedback form…</p>
<p><a href="${formUrl}">Click here if you're not redirected</a></p></body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send(thankYouPage("Something went wrong", "Please reply to the email directly."));
  }
});

app.get("/r/:sessionId/sign", async (req, res) => {
  try {
    const result = await processClientSign(req.params.sessionId);
    if (result.alreadyProcessed) {
      return res.send(thankYouPage("Already signed!", "Your testimonial was already captured. Thank you!"));
    }
    res.send(
      thankYouPage(
        "Signed! ✅",
        "Your testimonial has been signed and saved. Thank you for sharing your experience!"
      )
    );
  } catch (err) {
    console.error(err);
    res.status(500).send(thankYouPage("Something went wrong", "Please contact us directly."));
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, email: isEmailConfigured() }));

app.listen(port, () => {
  console.log(`\n📧 Review Capture (email-only)`);
  console.log(`   Dashboard: http://localhost:${port}`);
  console.log(`   Email configured: ${isEmailConfigured() ? "yes" : "no"}`);
  console.log(`   Public URL for email links: ${baseUrl()}`);
  if (baseUrl().includes("localhost")) {
    console.log(`   ⚠ Use ngrok for client email links: ngrok http ${port}\n`);
  }
});
