import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const REVIEWS_DIR = path.join(DATA_DIR, "reviews");

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(REVIEWS_DIR, { recursive: true });
}

function readState() {
  ensureDirs();
  if (!fs.existsSync(STATE_FILE)) {
    return { sessions: {}, declined: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function writeState(state) {
  ensureDirs();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function getClientById(clients, id) {
  return clients.find((c) => c.id === id) ?? null;
}

export function createSession(clientId, initiatedBy) {
  const state = readState();
  const sessionId = `${clientId}-${Date.now()}`;
  state.sessions[sessionId] = {
    id: sessionId,
    clientId,
    initiatedBy,
    status: "awaiting_client_response",
    createdAt: new Date().toISOString(),
    history: [{ at: new Date().toISOString(), event: "initiated", by: initiatedBy }],
  };
  writeState(state);
  return state.sessions[sessionId];
}

export function getSession(sessionId) {
  const state = readState();
  return state.sessions[sessionId] ?? null;
}

export function updateSession(sessionId, patch, event) {
  const state = readState();
  const session = state.sessions[sessionId];
  if (!session) return null;

  Object.assign(session, patch);
  session.history.push({
    at: new Date().toISOString(),
    event: event?.name ?? "updated",
    ...event,
  });
  writeState(state);
  return session;
}

export function logDecline(clientId, reason, declinedBy) {
  const state = readState();
  state.declined.push({
    clientId,
    reason,
    declinedBy,
    at: new Date().toISOString(),
  });
  writeState(state);
}

export function saveSignedReview(sessionId, review) {
  ensureDirs();
  const file = path.join(REVIEWS_DIR, `${sessionId}.json`);
  const payload = {
    ...review,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return payload;
}

export function loadClients() {
  const file = path.join(ROOT, "config", "clients.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return data.clients;
}

export function listSessions() {
  const state = readState();
  return Object.values(state.sessions).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

export function listDeclined() {
  return readState().declined;
}

const ACTIVE_STATUSES = [
  "awaiting_client_response",
  "generating",
  "awaiting_pm_approval",
  "awaiting_signature",
  "feedback_requested",
];

export function getActiveSessionForClient(clientId) {
  return listSessions().find(
    (s) => s.clientId === clientId && ACTIVE_STATUSES.includes(s.status)
  );
}

export function cancelSession(sessionId) {
  const state = readState();
  const session = state.sessions[sessionId];
  if (!session) return null;
  session.status = "cancelled";
  session.history.push({
    at: new Date().toISOString(),
    event: "cancelled",
    name: "cancelled",
  });
  writeState(state);
  return session;
}
