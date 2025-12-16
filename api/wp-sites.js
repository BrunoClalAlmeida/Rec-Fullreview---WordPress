export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = process.env.WP_SITES_PRESETS;
  if (!raw) {
    return res.status(500).json({ error: "WP_SITES_PRESETS não configurado" });
  }

  let sites;
  try {
    sites = JSON.parse(raw);
  } catch {
    return res.status(500).json({ error: "WP_SITES_PRESETS inválido" });
  }

  const safeSites = sites.map(({ id, label, baseUrl }) => ({
    id,
    label,
    baseUrl
  }));

  return res.status(200).json(safeSites);
}