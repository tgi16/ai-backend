export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("✅ generate called");

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Prompt required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing API key" });
  }

  const r = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600
      }
    })
  }
);


  const d = await r.json();
  console.log("📦 Gemini:", d);

  if (!r.ok) {
    return res.status(200).json({ error: d?.error?.message || "Gemini error" });
  }

  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return res.status(200).json({ result: text });
}
