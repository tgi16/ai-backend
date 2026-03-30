export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  // Debug: ဘယ် Method နဲ့ ရောက်လာလဲဆိုတာ အရင်ဆုံး Log ထုတ်မယ်
  console.log("Incoming Request Method:", req.method);
  console.log("Incoming Request URL:", req.url);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-relay-token");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST. Received: " + req.method });
  }

  try {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    console.log("API Key loaded:", apiKey ? `Yes (Length: ${apiKey.length})` : "No");

    if (!apiKey) {
      return res.status(500).json({ error: "Relay is missing GEMINI_API_KEY." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { model, requestBody } = body;

    if (!model || !requestBody) {
      return res.status(400).json({ error: "Invalid payload." });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
      console.error("[Gemini API Error]:", JSON.stringify(responseData));
      return res.status(upstreamResponse.status).json(responseData);
    }

    return res.status(200).json(responseData);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
