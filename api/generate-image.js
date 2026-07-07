export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, style, aspectRatio, count } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

  const n = Math.min(Math.max(Number(count) || 1, 1), 4);

  const ratioGuidance = {
    "1:1": "square format",
    "2:3": "portrait orientation",
    "16:9": "wide landscape format",
    "9:16": "tall vertical format",
  };
  const orientation = ratioGuidance[aspectRatio] || "square format";
  const fullPrompt = `${prompt}. Style: ${style || "Realistic"}. Composition: ${orientation}.`;

  const generateOne = async () => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inline_data || p.inlineData);
    const b64 = imagePart?.inline_data?.data || imagePart?.inlineData?.data;
    const mime = imagePart?.inline_data?.mime_type || imagePart?.inlineData?.mimeType || "image/png";

    if (!b64) throw new Error("No image returned by the model.");
    return `data:${mime};base64,${b64}`;
  };

  try {
    const images = await Promise.all(Array.from({ length: n }, () => generateOne()));
    return res.status(200).json({ images });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Image generation failed." });
  }
}