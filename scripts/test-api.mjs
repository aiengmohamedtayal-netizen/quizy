import fs from "fs";

const env = fs.readFileSync(".env", "utf-8");
const keyMatch = env.match(/AI_API_KEY=["']?([^"'\r\n]+)/);
const key = keyMatch ? keyMatch[1] : "";
const start = Date.now();

console.log("Testing SovereignEG connection with model qwen3.5-plus-02-15...");
try {
  const res = await fetch("https://backend.sovereigneg.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen3.5-plus-02-15",
      messages: [{ role: "user", content: "Say hello in 3 words" }],
      max_tokens: 15,
    }),
  });

  const d = await res.json();
  console.log("Status:", res.status);
  console.log("Time taken:", Date.now() - start, "ms");
  console.log("Response:", JSON.stringify(d));
} catch (e) {
  console.error("Fetch Error:", e);
}
