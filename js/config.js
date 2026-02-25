/**
 * CONFIGURAÇÃO DO PORTAL DE IMAGENS DE OBRAS
 * Edite a lista de obras abaixo conforme necessário.
 * Status: 'em_andamento' | 'concluida' | 'nao_iniciada'
 */

const CONFIG = {

  // ─── Lista das 15 Obras ───────────────────────────────────────────────────
  obras: [
    { id: 1,  codigo: 'OBR-001', nome: 'Obra 01', local: 'Local da Obra 01', status: 'em_andamento' },
    { id: 2,  codigo: 'OBR-002', nome: 'Obra 02', local: 'Local da Obra 02', status: 'em_andamento' },
    { id: 3,  codigo: 'OBR-003', nome: 'Obra 03', local: 'Local da Obra 03', status: 'nao_iniciada' },
    { id: 4,  codigo: 'OBR-004', nome: 'Obra 04', local: 'Local da Obra 04', status: 'nao_iniciada' },
    { id: 5,  codigo: 'OBR-005', nome: 'Obra 05', local: 'Local da Obra 05', status: 'nao_iniciada' },
    { id: 6,  codigo: 'OBR-006', nome: 'Obra 06', local: 'Local da Obra 06', status: 'nao_iniciada' },
    { id: 7,  codigo: 'OBR-007', nome: 'Obra 07', local: 'Local da Obra 07', status: 'nao_iniciada' },
    { id: 8,  codigo: 'OBR-008', nome: 'Obra 08', local: 'Local da Obra 08', status: 'nao_iniciada' },
    { id: 9,  codigo: 'OBR-009', nome: 'Obra 09', local: 'Local da Obra 09', status: 'nao_iniciada' },
    { id: 10, codigo: 'OBR-010', nome: 'Obra 10', local: 'Local da Obra 10', status: 'nao_iniciada' },
    { id: 11, codigo: 'OBR-011', nome: 'Obra 11', local: 'Local da Obra 11', status: 'nao_iniciada' },
    { id: 12, codigo: 'OBR-012', nome: 'Obra 12', local: 'Local da Obra 12', status: 'nao_iniciada' },
    { id: 13, codigo: 'OBR-013', nome: 'Obra 13', local: 'Local da Obra 13', status: 'nao_iniciada' },
    { id: 14, codigo: 'OBR-014', nome: 'Obra 14', local: 'Local da Obra 14', status: 'nao_iniciada' },
    { id: 15, codigo: 'OBR-015', nome: 'Obra 15', local: 'Local da Obra 15', status: 'nao_iniciada' },
  ],

  // ─── Rótulos de Status ────────────────────────────────────────────────────
  statusLabels: {
    em_andamento:  'Em Andamento',
    concluida:     'Concluída',
    nao_iniciada:  'Não Iniciada',
  },

  statusClasses: {
    em_andamento:  'badge-andamento',
    concluida:     'badge-concluida',
    nao_iniciada:  'badge-nao-iniciada',
  },
};


// ─── Helpers de Configuração do GitHub (localStorage) ─────────────────────

function getGithubConfig() {
  return {
    owner:  localStorage.getItem('gh_owner')  || '',
    repo:   localStorage.getItem('gh_repo')   || '',
    token:  localStorage.getItem('gh_token')  || '',
    branch: localStorage.getItem('gh_branch') || 'main',
  };
}

function saveGithubConfig(owner, repo, token, branch = 'main') {
  localStorage.setItem('gh_owner',  owner.trim());
  localStorage.setItem('gh_repo',   repo.trim());
  localStorage.setItem('gh_token',  token.trim());
  localStorage.setItem('gh_branch', branch.trim() || 'main');
}

function isConfigured() {
  const c = getGithubConfig();
  return !!(c.owner && c.repo && c.token);
}

function getRawBaseUrl() {
  const c = getGithubConfig();
  return `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch}`;
}

// ─── Lookup Helpers ────────────────────────────────────────────────────────

function getObraById(id) {
  return CONFIG.obras.find(o => o.id === parseInt(id, 10)) || null;
}

function statusLabel(s) {
  return CONFIG.statusLabels[s] || s;
}

function statusClass(s) {
  return CONFIG.statusClasses[s] || 'badge-nao-iniciada';
}

// ─── Formatar data legível ─────────────────────────────────────────────────

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const [y, m, d] = isoStr.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return isoStr;
  }
}
