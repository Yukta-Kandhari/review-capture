import { generateReview, generateReviewFallback } from "./claude.js";
import {
  loadClients,
  getClientById,
  getSession,
  updateSession,
  saveSignedReview,
  listSessions,
} from "./store.js";
import {
  sendSignatureEmail,
  sendPmDraftReady,
  sendPmSigned,
  sendPmUnhappy,
} from "./email.js";

const clients = loadClients();
const googleFormUrl = () =>
  process.env.GOOGLE_FORM_URL ||
  "https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform";

export async function processClientLovesService(sessionId, { userId = "email" } = {}) {
  const session = getSession(sessionId);
  if (!session || session.status === "signed") return { ok: false, reason: "invalid_session" };

  const clientRecord = getClientById(clients, session.clientId);
  if (!clientRecord) return { ok: false, reason: "client_not_found" };

  if (["awaiting_pm_approval", "awaiting_signature", "signed"].includes(session.status)) {
    return { ok: true, alreadyProcessed: true, clientRecord, draftText: session.draftText };
  }

  updateSession(sessionId, { status: "generating" }, { name: "client_loves_service", by: userId });

  let draftText;
  try {
    draftText = await generateReview(clientRecord);
  } catch (err) {
    console.warn("Claude generation failed, using fallback:", err.message);
    draftText = generateReviewFallback(clientRecord);
  }

  updateSession(sessionId, { status: "awaiting_pm_approval", draftText }, { name: "review_generated" });

  try {
    await sendPmDraftReady(clientRecord, sessionId, draftText);
  } catch (err) {
    console.warn("PM notification failed:", err.message);
  }

  return { ok: true, clientRecord, draftText };
}

export async function processClientUnhappy(sessionId, { userId = "email" } = {}) {
  const session = getSession(sessionId);
  if (!session) return { ok: false, reason: "invalid_session" };

  const clientRecord = getClientById(clients, session.clientId);
  if (!clientRecord) return { ok: false, reason: "client_not_found" };

  if (session.status === "feedback_requested") {
    return { ok: true, alreadyProcessed: true, clientRecord, formUrl: googleFormUrl() };
  }

  updateSession(sessionId, { status: "feedback_requested" }, { name: "client_unhappy", by: userId });

  try {
    await sendPmUnhappy(clientRecord);
  } catch (err) {
    console.warn("PM notification failed:", err.message);
  }

  return { ok: true, clientRecord, formUrl: googleFormUrl() };
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

export async function initiateReviewRequest(clientRecord, session) {
  const { sendSatisfactionEmail, isEmailConfigured } = await import("./email.js");

  if (!isEmailConfigured()) {
    throw new Error("Email not configured — set SMTP_* in .env");
  }
  if (!clientRecord.email) {
    throw new Error(`No email for ${clientRecord.name}`);
  }

  await sendSatisfactionEmail(clientRecord, session.id);
  updateSession(session.id, { emailSentAt: new Date().toISOString() }, { name: "email_sent" });

  return { emailSent: true };
}

export async function resendSatisfactionEmail(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found");
  const clientRecord = getClientById(clients, session.clientId);
  if (!clientRecord) throw new Error("Client not found");
  const { sendSatisfactionEmail } = await import("./email.js");
  await sendSatisfactionEmail(clientRecord, sessionId);
  updateSession(sessionId, { emailSentAt: new Date().toISOString() }, { name: "email_resent" });
}

export async function resendSignatureEmail(sessionId) {
  const session = getSession(sessionId);
  if (!session?.draftText) throw new Error("No draft to sign");
  const clientRecord = getClientById(clients, session.clientId);
  if (!clientRecord) throw new Error("Client not found");
  await sendSignatureEmail(clientRecord, sessionId, session.draftText);
  updateSession(sessionId, {}, { name: "signature_resent" });
}

export async function sendReviewForSignature(sessionId, { approvedBy = "pm" } = {}) {
  const session = getSession(sessionId);
  if (!session?.draftText) return { ok: false, reason: "no_draft" };

  const clientRecord = getClientById(clients, session.clientId);
  if (!clientRecord) return { ok: false, reason: "client_not_found" };

  updateSession(sessionId, { status: "awaiting_signature" }, { name: "pm_approved", by: approvedBy });

  await sendSignatureEmail(clientRecord, sessionId, session.draftText);

  return { ok: true, clientRecord };
}

export async function regenerateReview(sessionId) {
  const session = getSession(sessionId);
  if (!session) return { ok: false, reason: "invalid_session" };

  const clientRecord = getClientById(clients, session.clientId);
  if (!clientRecord) return { ok: false, reason: "client_not_found" };

  let draftText;
  try {
    draftText = await generateReview(clientRecord);
  } catch {
    draftText = generateReviewFallback(clientRecord);
  }

  updateSession(sessionId, { draftText, status: "awaiting_pm_approval" }, { name: "regenerated" });
  await sendPmDraftReady(clientRecord, sessionId, draftText);

  return { ok: true, draftText };
}

export function getDashboardData() {
  const sessions = listSessions();
  const pending = sessions.filter((s) => s.status === "awaiting_pm_approval");
  const inProgress = sessions.filter((s) =>
    ["awaiting_client_response", "generating", "awaiting_signature"].includes(s.status)
  );
  const signed = sessions.filter((s) => s.status === "signed");
  const unhappy = sessions.filter((s) => s.status === "feedback_requested");

  return { clients, pending, inProgress, signed, unhappy, sessions };
}

export { clients, getClientById };
