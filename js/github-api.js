/**
 * GITHUB REST API — Funções de integração
 * Realiza upload de imagens direto para o repositório via API GitHub.
 */

// ─── Request base ──────────────────────────────────────────────────────────

async function ghContentsRequest(method, filePath, body) {
  const cfg = getGithubConfig();
  const url  = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;

  const opts = {
    method,
    headers: {
      Authorization:  `token ${cfg.token}`,
      'Content-Type': 'application/json',
      Accept:         'application/vnd.github.v3+json',
    },
  };

  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  if (!res.ok) {
    let errMsg = `GitHub API ${res.status}`;
    try { const e = await res.json(); errMsg = e.message || errMsg; } catch {}
    throw new Error(errMsg);
  }

  if (res.status === 204) return null;
  return res.json();
}


// ─── Obter SHA de arquivo existente ───────────────────────────────────────

async function getFileSHA(filePath) {
  try {
    const data = await ghContentsRequest('GET', filePath);
    return data?.sha || null;
  } catch {
    return null; // arquivo não existe ainda
  }
}


// ─── Converter File para base64 ────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// ─── Upload de arquivo genérico ────────────────────────────────────────────

async function uploadFile(filePath, base64Content, commitMessage, sha) {
  const cfg  = getGithubConfig();
  const body = {
    message: commitMessage,
    content: base64Content,
    branch:  cfg.branch,
  };
  if (sha) body.sha = sha;

  return ghContentsRequest('PUT', filePath, body);
}


// ─── Upload de imagem ──────────────────────────────────────────────────────

async function uploadImage(file, repoPath, onProgress) {
  onProgress && onProgress(`Preparando: ${file.name}`);

  const base64 = await fileToBase64(file);

  onProgress && onProgress(`Verificando arquivo no repositório...`);
  const sha = await getFileSHA(repoPath);

  onProgress && onProgress(`Enviando: ${file.name}`);
  const result = await uploadFile(
    repoPath,
    base64,
    `[Portal] Upload imagem: ${repoPath}`,
    sha
  );

  return result;
}


// ─── Carregar obras.json do repositório ───────────────────────────────────

async function loadObrasJson() {
  try {
    const base = getRawBaseUrl();
    const res  = await fetch(`${base}/data/obras.json?nocache=${Date.now()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}


// ─── Salvar obras.json no repositório ─────────────────────────────────────

async function saveObrasJson(data) {
  const json    = JSON.stringify(data, null, 2);
  // btoa com suporte a UTF-8
  const base64  = btoa(unescape(encodeURIComponent(json)));
  const sha     = await getFileSHA('data/obras.json');

  return uploadFile(
    'data/obras.json',
    base64,
    `[Portal] Atualizar obras.json — ${new Date().toISOString()}`,
    sha
  );
}


// ─── Criar obras.json inicial (se não existir) ─────────────────────────────

function buildDefaultObrasJson() {
  return {
    obras: CONFIG.obras.map(o => ({
      id:                o.id,
      codigo:            o.codigo,
      nome:              o.nome,
      local:             o.local,
      status:            o.status,
      capa:              null,
      imagens:           [],
      totalImagens:      0,
      ultimaAtualizacao: null,
    })),
    geradoEm: new Date().toISOString(),
    instrucao: 'Arquivo gerado automaticamente pelo Portal de Imagens de Obras. Use no Power BI via Conector Web.',
  };
}


// ─── Verificar se token é válido ──────────────────────────────────────────

async function verifyGithubAccess() {
  const cfg = getGithubConfig();
  const res = await fetch(
    `https://api.github.com/repos/${cfg.owner}/${cfg.repo}`,
    { headers: { Authorization: `token ${cfg.token}` } }
  );
  return res.ok;
}
