export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  // ---- CORS Headers ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // OPTIONS request ကို handle လုပ်ပေးခြင်း (CORS preflight အတွက်)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { prompt, model } = req.body; // model ကိုပါ ထည့်ခေါ်နိုင်အောင် ပြင်ထားပါတယ်
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    // Vercel Environment Variable ထဲက GEMINI_API_KEY ကို ခေါ်ယူခြင်း
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY is missing." });
    }

    // Model နာမည်ကို သေချာစေရန် (Default အနေနဲ့ gemini-1.5-flash ကို သုံးပါ)
    const modelToUse = model || "gemini-1.5-flash"; 
    
    // API Endpoint တည်ဆောက်ခြင်း
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    // API ကနေ Error ပြန်လာရင် ဖမ်းယူခြင်း
    if (!response.ok) {
      console.error("[Gemini API Error]:", data);
      return res.status(response.status).json({ 
        error: data.error?.message || "Gemini API request failed." 
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated.";

    res.status(200).json({ result: text });

  } catch (err) {
    console.error("[Relay Server Error]:", err);
    res.status(500).json({ error: "AI service unavailable: " + err.message });
  }
}
