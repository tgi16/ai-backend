const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json());

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    const apiKey = req.headers['x-api-key'];

    if (!prompt) return res.status(400).json({ error: "Prompt missing" });
    if (!apiKey) return res.status(401).json({ error: "API Key missing in header x-api-key" });

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Gemini error" });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "No result";
    res.json({ result: text });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
