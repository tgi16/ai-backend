// api/generate.js

export default async function handler(req, res) {

  /* ================= CORS HEADERS ================= */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ---- Preflight request ----
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ---- Method guard ----
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body || {};

    // ---- Validation ----
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Invalid request. 'prompt' is required."
      });
    }

    // ---- Text-only guard ----
    if (req.body.image || req.body.images) {
      return res.status(400).json({
        error: "Image input disabled. Text-only mode."
      });
    }

    // ---- API key ----
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Server misconfiguration (API key missing)."
      });
    }

    // ---- Gemini call (quota-safe) ----
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

    const data = await geminiRes.json();

    // ---- Error mapping ----
    if (!geminiRes.ok) {
      const msg = data?.error?.message || "Gemini error";

      if (msg.includes("quota") || geminiRes.status === 429) {
        return res.status(200).json({
          error: "Quota limit reached. Please wait."
        });
      }

      return res.status(200).json({
        error: "AI service unavailable."
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({ result: text });

  } catch (err) {
    console.error("Backend error:", err);
    return res.status(200).json({
      error: "Server error. Try again later."
    });
  }
}
