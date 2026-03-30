export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  // ---- CORS Headers ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-relay-token");

  // OPTIONS request ကို handle လုပ်ပေးခြင်း (CORS preflight အတွက်)
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // Relay Token စစ်ဆေးခြင်း (လုံခြုံရေးအတွက်)
    const expectedToken = (process.env.RELAY_TOKEN || "").trim();
    const incomingToken = String(req.headers["x-relay-token"] || "").trim();
    if (expectedToken && incomingToken !== expectedToken) {
      return res.status(401).json({ error: "Unauthorized relay token." });
    }

    // Body ကို Parse လုပ်ခြင်း
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { model, requestBody } = body;

    if (!model || !requestBody) {
      return res.status(400).json({ error: "Invalid payload. 'model' and 'requestBody' are required." });
    }

    // API Key ခေါ်ယူခြင်း
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({ error: "Relay is missing GEMINI_API_KEY environment variable." });
    }

    // Endpoint တည်ဆောက်ခြင်း (Key ကို URL parameter အနေနဲ့ ပို့ခြင်း)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Gemini API ဆီ Request ပို့ခြင်း
    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await upstreamResponse.json();

    // API ကနေ Error ပြန်လာရင် ဖမ်းယူခြင်း
    if (!upstreamResponse.ok) {
      console.error("[Gemini API Error]:", responseData);
      return res.status(upstreamResponse.status).json(responseData);
    }

    // အောင်မြင်စွာ ပြန်ပို့ခြင်း
    return res.status(200).json(responseData);

  } catch (err) {
    console.error("[Relay Server Error]:", err);
    return res.status(500).json({ 
      error: "AI service unavailable: " + (err.message || "Unknown error") 
    });
  }
}
