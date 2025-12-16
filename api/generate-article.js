// api/generate-article.js
// Função Serverless da Vercel que chama a OpenAI usando a variável de ambiente OPENAI_API_KEY

module.exports = (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      const { model, systemPrompt, userPrompt } = parsed;
      const valor = process.env.WP_SITES_PRESETS;
      console.log(valor)
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "OPENAI_API_KEY não configurada no servidor",
          })
        );
        return;
      }

      const openaiBody = {
        model: model || "gpt-5.1",
        messages: [
          { role: "system", content: systemPrompt || "" },
          { role: "user", content: userPrompt || "" },
        ],
        temperature: 0.7,
      };

      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + apiKey,
          },
          body: JSON.stringify(openaiBody),
        }
      );

      const data = await openaiResponse.json();

      res.statusCode = openaiResponse.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
