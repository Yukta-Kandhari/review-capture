#!/usr/bin/env node
import "dotenv/config";
import { loadClients, getClientById, createSession } from "../src/store.js";
import { initiateReviewRequest, processClientSign } from "../src/flows.js";

const clients = loadClients();
const clientId = process.argv[2] || clients[0].id;
const client = getClientById(clients, clientId);

if (!client) {
  console.error(`Client not found: ${clientId}`);
  process.exit(1);
}

console.log("\n📧 ONE-EMAIL REVIEW FLOW DEMO\n");
console.log("Step 1: You click Yes on", client.name);

const session = createSession(client.id, "demo");

console.log("Step 2: Generate review + send ONE email to client");
console.log(`   → ${client.contactName} <${client.email}>`);

if (process.env.SMTP_USER && !process.env.SMTP_USER.includes("YOUR_GMAIL")) {
  try {
    const { draftText } = await initiateReviewRequest(client, session);
    console.log("   ✓ Email sent (live)\n");
    console.log("── Draft in email ──");
    console.log(draftText);
    console.log("──────────────────\n");
  } catch (err) {
    console.log(`   ⚠ ${err.message}\n`);
    process.exit(1);
  }
} else {
  console.log("   (skipped — set SMTP_USER in .env)\n");
  process.exit(0);
}

console.log("Step 3: Client clicks Sign in that one email\n");
await processClientSign(session.id);
console.log("Step 4: You get ONE notification email when they sign ✅\n");
