import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "..", "templates", "review-prompt.md");

function fillTemplate(template, client) {
  return template
    .replaceAll("{{contactName}}", client.contactName)
    .replaceAll("{{clientName}}", client.name)
    .replaceAll("{{projectSummary}}", client.projectSummary)
    .replaceAll("{{outcomes}}", client.outcomes.map((o) => `- ${o}`).join("\n"))
    .replaceAll("{{tone}}", client.tone);
}

export async function generateReview(client) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("your-key") || apiKey.includes("sk-ant-your")) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const prompt = fillTemplate(template, client);
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

  const anthropic = new Anthropic({ apiKey, timeout: 20_000 });

  const message = await anthropic.messages.create({
    model,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude returned an empty review");
  }

  return text;
}

export function generateReviewFallback(client) {
  const outcome = client.outcomes[0] ?? "great results";
  return `Working with the team on ${client.name} was a fantastic experience. ${client.projectSummary} We saw ${outcome} and would highly recommend them. — ${client.contactName}`;
}
