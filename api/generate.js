export default async function handler(req, res) {
  // ✅ Allow POST only
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;

    // ✅ Input validation
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Invalid prompt" });
    }

    // ✅ Prompt length protection
    if (prompt.length > 6000) {
      return res.status(400).json({ error: "Prompt too long" });
    }

    // 🔐 API Key (Server only)
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "Server API key missing" });
    }

    // ✅ Call AI provider
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    // ✅ Provider error handling
    if (!response.ok) {
      console.error("AI API error:", data);
      return res.status(500).json({
        error: "AI service error"
      });
    }

    // ✅ Safe response extraction
    const result =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    return res.status(200).json({ result });

  } catch (err) {
    console.error("Server crash:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
