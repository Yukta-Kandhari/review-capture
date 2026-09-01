import test from "node:test";
import assert from "node:assert/strict";
import { sendReviewAndSignEmail } from "../src/email.js";

test("SendGrid transport builds a safe review email", async () => {
  process.env.SENDGRID_API_KEY = "SG.test";
  process.env.EMAIL_FROM = "Reviews <reviews@example.com>";
  process.env.PM_EMAIL = "owner@example.com";
  process.env.APP_URL = "https://review.example.com";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(url, "https://api.sendgrid.com/v3/mail/send");
    assert.equal(body.from.email, "reviews@example.com");
    assert.equal(body.personalizations[0].to[0].email, "client@example.com");
    assert.equal(body.personalizations[0].bcc[0].email, "owner@example.com");
    assert.equal(body.reply_to.email, "owner@example.com");
    assert.match(body.content[0].value, /\/r\/session-1\/sign/);
    assert.doesNotMatch(body.content[1].value, /<script>/);
    return { ok: true, headers: { get: () => "sg-message-123" } };
  };

  try {
    const result = await sendReviewAndSignEmail(
      {
        name: "Client <script>unsafe()</script>",
        contactName: "Person",
        email: "client@example.com",
      },
      "session-1",
      "Great work <script>unsafe()</script>"
    );
    assert.equal(result.messageId, "sg-message-123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
