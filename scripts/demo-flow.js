#!/usr/bin/env node
import "dotenv/config";
import { loadClients, getClientById, createSession, updateSession, saveSignedReview } from "../src/store.js";
import { generateReview, generateReviewFallback } from "../src/claude.js";
import { initiateReviewRequest, sendReviewForSignature, processClientLovesService, processClientSign } from "../src/flows.js";

const clients = loadClients();
const clientId = process.argv[2] || clients[0].id;
const client = getClientById(clients, clientId);

if (!client) {
  console.error(`Client not found: ${clientId}`);
  process.exit(1);
}

console.log("\n📧 EMAIL-ONLY REVIEW FLOW DEMO\n");
console.log("Step 1: You open dashboard → click Yes on", client.name);

const session = createSession(client.id, "demo");
console.log("\nStep 2: Email sent to client — Do you like the service? Y/N");
console.log(`   → ${client.contactName} <${client.email}>`);

if (process.env.SMTP_USER && !process.env.SMTP_USER.includes("YOUR_GMAIL")) {
  try {
    await initiateReviewRequest(client, session);
    console.log("   ✓ Email sent (live)\n");
  } catch (err) {
    console.log(`   ⚠ ${err.message}\n`);
  }
} else {
  console.log("   (skipped — set SMTP_USER in .env to send live)\n");
}

console.log("Step 3: Client clicks Yes in email\n");

const result = await processClientLovesService(session.id);
console.log("Step 4: Claude draft generated");
console.log("── Draft ──");
console.log(result.draftText);
console.log("──────────\n");
console.log("Step 5: PM approves → signature email sent to client\n");

await sendReviewForSignature(session.id);
console.log("Step 6: Client signs via email link\n");

await processClientSign(session.id);
console.log("Step 7: Review saved ✅");
console.log(`   data/reviews/${session.id}.json\n`);
