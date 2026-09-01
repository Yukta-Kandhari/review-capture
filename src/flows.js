import { generateReview, generateReviewFallback } from "./claude.js";
import {
  loadClients,
  getClientById,
  getSession,
  updateSession,
  saveSignedReview,
  listSessions,
} from "./store.js";
import { sendReviewAndSignEmail, sendPmSigned } from "./email.js";

const clients = loadClients();

async function generateDraft(clientRecord) {
  try {
    return await generateReview(clientRecord);
  } catch (err) {
    console.warn("Claude generation failed, using fallback:", err.message);
    return generateReviewFallback(clientRecord);
  }
}

/** PM clicks Yes → generate review + one email to client with sign link */
export async function initiateReviewRequest(clientRecord, session) {
  const { isEmailConfigured } = await import("./email.js");

  if (!isEmailConfigured()) {
    throw new Error("Email not configured — set SMTP_* in .env");
  }
  if (!clientRecord.email) {
    throw new Error(`No email for ${clientRecord.name}`);
  }

  updateSession(session.id, { status: "generating" }, { name: "generating" });

  const draftText = await generateDraft(clientRecord);

  updateSession(
    session.id,
    {
      status: "awaiting_signature",
      draftText,
      emailSentAt: new Date().toISOString(),
    },
    { name: "review_sent" }
  );

  await sendReviewAndSignEmail(clientRecord, session.id, draftText);

  return { draftText };
}

export async function resendReviewEmail(sessionId) {
  const session = getSession(sessionId);
  if (!session?.draftText) throw new Error("No review to send");
  const clientRecord = getClientById(clients, session.clientId);
  if (!clientRecord) throw new Error("Client not found");

  await sendReviewAndSignEmail(clientRecord, sessionId, session.draftText);
  updateSession(sessionId, { emailSentAt: new Date().toISOString() }, { name: "email_resent" });
}

export async function regenerateReview(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found");

  const clientRecord = getClientById(clients, session.clientId);
  if (!clientRecord) throw new Error("Client not found");

  const draftText = await generateDraft(clientRecord);

  updateSession(
    sessionId,
    { draftText, status: "awaiting_signature", emailSentAt: new Date().toISOString() },
    { name: "regenerated" }
  );

  await sendReviewAndSignEmail(clientRecord, sessionId, draftText);

  return { ok: true, draftText };
}

export async function processClientSign(sessionId, { userId = "email" } = {}) {
  const session = getSession(sessionId);
  if (!session?.draftText) return { ok: false, reason: "no_draft" };

  const clientRecord = getClientById(clients, session.clientId);
  if (!clientRecord) return { ok: false, reason: "client_not_found" };

  if (session.status === "signed") {
    return { ok: true, alreadyProcessed: true, clientRecord, reviewText: session.draftText };
  }

  const signedAt = new Date().toISOString();
  updateSession(
    sessionId,
    { status: "signed", signedBy: userId, signedAt },
    { name: "client_signed", by: userId }
  );

  saveSignedReview(sessionId, {
    clientId: clientRecord.id,
    clientName: clientRecord.name,
    contactName: clientRecord.contactName,
    reviewText: session.draftText,
    signedBy: clientRecord.contactName,
    signedAt,
    source: "email",
  });

  try {
    await sendPmSigned(clientRecord, session.draftText);
  } catch (err) {
    console.warn("PM notification failed:", err.message);
  }

  return { ok: true, clientRecord, reviewText: session.draftText };
}

export function getDashboardData() {
  const sessions = listSessions();
  const signed = sessions.filter((s) => s.status === "signed");

  return { clients, signed, sessions };
}

export { clients, getClientById };
