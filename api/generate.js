// api/generate.js

export default async function handler(req, res) {
  // ---- METHOD GUARD ----
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body || {};

    // ---- INPUT VALIDATION ----
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Invalid request. 'prompt' (string) is required."
      });
    }

    // ---- TEXT-ONLY GUARD (IMPORTANT) ----
    if (req.body.image || req.body.images || req.body.inlineData) {
      return res.status(400).json({
        error: "Image / Vision input is disabled. Text-only mode."
      });
    }

    // ---- API KEY CHECK ----
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Server configuration error: Missing API key."
      });
    }

    // ---- GEMINI REQUEST (QUOTA-SAFE) ----
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 600   // 🔥 quota-safe
          }
        })
      }
    );

    const data = await geminiRes.json();

    // ---- ERROR MAPPING (VERY IMPORTANT) ----
    if (!geminiRes.ok) {
      const msg =
        data?.error?.message ||
        "Gemini API error";

      // Quota / rate limit
      if (
        msg.includes("quota") ||
        msg.includes("rate") ||
        geminiRes.status === 429
      ) {
        return res.status(200).json({
          error: "Quota limit reached. Please wait or reduce usage."
        });
      }

      // Auth / key error
      if (
        msg.includes("API key") ||
        geminiRes.status === 401 ||
        geminiRes.status === 403
      ) {
        return res.status(200).json({
          error: "Invalid or inactive API key."
        });
      }

      // Fallback
      return res.status(200).json({
        error: "AI service temporarily unavailable."
      });
    }

    // ---- SAFE RESPONSE EXTRACTION ----
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    return res.status(200).json({
      result: text
    });

  } catch (err) {
    console.error("Backend Error:", err);
    return res.status(200).json({
      error: "Server error. Please try again later."
    });
  }
}
