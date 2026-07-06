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

  // Map WriteCoach ratios to Imagen-supported ratios
  const ratioMap = { "1:1": "1:1", "2:3": "3:4", "16:9": "16:9", "9:16": "9:16" };
  const mappedRatio = ratioMap[aspectRatio] || "1:1";
  const n = Math.min(Math.max(Number(count) || 1, 1), 4);
  const fullPrompt = `${prompt}. Style: ${style || "Realistic"}.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: fullPrompt }],
          parameters: { sampleCount: n, aspectRatio: mappedRatio },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Imagen API error (${response.status}): ${errText}`,
      });
    }

    const data = await response.json();
    const predictions = data?.predictions || [];
    const images = predictions
      .map((p) => p?.bytesBase64Encoded)
      .filter(Boolean)
      .map((b64) => `data:image/png;base64,${b64}`);

    if (images.length === 0) {
      return res.status(500).json({ error: "No image returned by the API." });
    }

    return res.status(200).json({ images });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Image generation failed." });
  }
}