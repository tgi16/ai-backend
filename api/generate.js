export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key missing" });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt missing" });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    // 🔥 ဒီ line ကိုထည့်ပြီး response ကိုကြည့်မယ်
    console.log("Gemini response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message });
    }

    const text =
      data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ||
      "No result";

    res.status(200).json({ result: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
