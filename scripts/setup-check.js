#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

const checks = [
  { key: "SLACK_BOT_TOKEN", hint: "OAuth & Permissions → Bot User OAuth Token (xoxb-…)" },
  { key: "SLACK_APP_TOKEN", hint: "Basic Information → App-Level Token with connections:write (xapp-…)" },
  { key: "SLACK_SIGNING_SECRET", hint: "Basic Information → Signing Secret" },
  { key: "REVIEW_CHANNEL_ID", hint: "Right-click #reviews channel → View channel details → copy ID (C…)" },
  { key: "ANTHROPIC_API_KEY", hint: "console.anthropic.com → API Keys (optional but recommended)" },
];

console.log("\n🔍 Slack Auto — Setup Check\n");

if (!fs.existsSync(envPath)) {
  console.log("❌ No .env file found");
  console.log(`   Run: cp .env.example .env\n`);
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log("   ✓ Created .env from .env.example — fill in your values\n");
  }
} else {
  console.log("✓ .env exists\n");
}

// Load .env manually for check
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

let ready = true;
for (const { key, hint } of checks) {
  const val = process.env[key];
  const ok = val && !val.includes("your-") && !val.includes("YOUR_") && val.length > 8;
  console.log(`${ok ? "✅" : "⬜"} ${key}`);
  if (!ok) {
    console.log(`   → ${hint}`);
    if (key.startsWith("SLACK_") || key === "REVIEW_CHANNEL_ID") ready = false;
  }
}

console.log("\n" + (ready ? "✅ Ready to run: npm start" : "⬜ Add missing values to .env, then: npm start"));
console.log("   In Slack: /review-list\n");
