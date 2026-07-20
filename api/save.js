// api/save.js — Vercel Serverless Function
// El token de GitHub vive en las variables de entorno de Vercel, nunca en el frontend

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // Variables de entorno (las configuras en Vercel Dashboard)
  const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
  const GITHUB_USER   = process.env.GITHUB_USER;
  const GITHUB_REPO   = process.env.GITHUB_REPO;
  const GITHUB_FOLDER = process.env.GITHUB_FOLDER || "diagnosticos";

  if (!GITHUB_TOKEN || !GITHUB_USER || !GITHUB_REPO) {
    return res.status(500).json({
      error: "Variables de entorno no configuradas. Revisa GITHUB_TOKEN, GITHUB_USER y GITHUB_REPO en Vercel."
    });
  }

  // Recibir datos del frontend
  const { filename, content, commitMessage } = req.body;

  if (!filename || !content) {
    return res.status(400).json({ error: "Faltan campos: filename y content son requeridos." });
  }

  // Construir la ruta completa del archivo en el repo
  const folder = GITHUB_FOLDER.replace(/\/$/, "");
  const filepath = `${folder}/${filename}`;

  // Codificar contenido en base64
  const encoded = Buffer.from(content, "utf-8").toString("base64");

  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${filepath}`;
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "diagnostico-app"
  };

  try {
    // Verificar si el archivo ya existe (para obtener el SHA y poder actualizarlo)
    let sha = null;
    const checkRes = await fetch(apiUrl, { headers });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }

    // Hacer el PUT a GitHub
    const body = {
      message: commitMessage || `diagnóstico: ${filename}`,
      content: encoded,
      ...(sha && { sha }) // Si el archivo ya existe, incluir SHA para actualizarlo
    };

    const pushRes = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });

    if (!pushRes.ok) {
      const err = await pushRes.json();
      return res.status(pushRes.status).json({
        error: err.message || "Error al guardar en GitHub",
        detail: err
      });
    }

    const data = await pushRes.json();
    return res.status(200).json({
      ok: true,
      url: data.content?.html_url,
      path: filepath,
      repo: `${GITHUB_USER}/${GITHUB_REPO}`
    });

  } catch (e) {
    return res.status(500).json({ error: `Error interno: ${e.message}` });
  }
}
