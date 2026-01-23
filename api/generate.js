import fetch from "node-fetch";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt မထည့်ထားပါ" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = "gemini-1.5-flash";

    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "API Error" });
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json({ result: resultText });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
