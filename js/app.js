/**
 * APP.JS — Lógica principal do Portal de Imagens de Obras
 * Controla: Dashboard (index), Galeria (gallery), Upload (upload)
 */

// ═══════════════════════════════════════════════════════════════
//  AUTO-SETUP via URL hash  (#setup=BASE64)
//  O admin gera um link → engenheiro abre → portal já configurado
// ═══════════════════════════════════════════════════════════════

function checkAutoSetup() {
  const hash = window.location.hash;
  if (!hash.startsWith('#setup=')) return;

  try {
    const encoded = hash.slice(7);
    const decoded = JSON.parse(atob(encoded));

    if (decoded.owner && decoded.repo && decoded.token) {
      saveGithubConfig(decoded.owner, decoded.repo, decoded.token, decoded.branch || 'main');
      // Remove o hash da URL sem recarregar a página
      history.replaceState(null, '', window.location.pathname + window.location.search);
      // Mostra confirmação após o DOM carregar
      setTimeout(() => showToast('✅ Portal configurado automaticamente!', 'success'), 500);
    }
  } catch {
    // hash inválido — ignora silenciosamente
  }
}

// ─── Gerar link de configuração para compartilhar ──────────────

function generateSetupLink() {
  const cfg = getGithubConfig();

  if (!cfg.owner || !cfg.repo || !cfg.token) {
    showToast('Configure e salve o repositório primeiro.', 'error');
    return;
  }

  const payload = btoa(JSON.stringify({
    owner:  cfg.owner,
    repo:   cfg.repo,
    token:  cfg.token,
    branch: cfg.branch || 'main',
  }));

  // Gera o link apontando para upload.html (página mais usada pelos engenheiros)
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  const link = `${base}upload.html#setup=${payload}`;

  navigator.clipboard.writeText(link).then(() => {
    showToast('🔗 Link copiado! Compartilhe com os engenheiros.', 'success');
  }).catch(() => {
    // Fallback: mostra o link em um prompt
    window.prompt('Copie o link abaixo e compartilhe:', link);
  });
}

// ═══════════════════════════════════════════════════════════════
//  UTILITÁRIOS COMPARTILHADOS
// ═══════════════════════════════════════════════════════════════

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 4500);
}

function setLoading(el, on) {
  if (!el) return;
  if (on) el.setAttribute('data-loading', '1');
  else    el.removeAttribute('data-loading');
}

// ═══════════════════════════════════════════════════════════════
//  MODAL DE CONFIGURAÇÕES (presente em todas as páginas)
// ═══════════════════════════════════════════════════════════════

function initSettings() {
  const btnOpen = document.getElementById('btnSettings');
  const overlay = document.getElementById('settingsModal');
  const btnClose= document.getElementById('closeSettings');
  const form    = document.getElementById('settingsForm');
  const status  = document.getElementById('cfgStatus');
  if (!btnOpen || !overlay) return;

  // ── Abrir / fechar ──
  btnOpen.addEventListener('click', () => {
    fillSettingsForm();
    overlay.classList.add('open');
  });
  btnClose?.addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

  // ── Preencher campos ──
  function fillSettingsForm() {
    const cfg = getGithubConfig();
    document.getElementById('inOwner').value  = cfg.owner;
    document.getElementById('inRepo').value   = cfg.repo;
    document.getElementById('inToken').value  = cfg.token;
    document.getElementById('inBranch').value = cfg.branch || 'main';
    refreshStatusBanner(cfg);
  }

  function refreshStatusBanner(cfg) {
    if (!status) return;
    if (cfg.owner && cfg.repo && cfg.token) {
      status.className = 'config-status ok';
      status.innerHTML = '✅ &nbsp;Repositório configurado — uploads habilitados';
    } else {
      status.className = 'config-status warn';
      status.innerHTML = '⚠️ &nbsp;Configure o repositório GitHub para habilitar uploads';
    }
  }

  // ── Salvar ──
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const owner  = document.getElementById('inOwner').value.trim();
    const repo   = document.getElementById('inRepo').value.trim();
    const token  = document.getElementById('inToken').value.trim();
    const branch = document.getElementById('inBranch').value.trim() || 'main';

    if (!owner || !repo || !token) {
      showToast('Preencha todos os campos.', 'error'); return;
    }

    saveGithubConfig(owner, repo, token, branch);

    const btn = form.querySelector('[type="submit"]');
    btn.textContent = 'Verificando...';
    btn.disabled = true;

    try {
      const ok = await verifyGithubAccess();
      if (ok) {
        showToast('Configuração salva e verificada!', 'success');
        overlay.classList.remove('open');
        refreshStatusBanner(getGithubConfig());
        // recarregar dashboard se estiver nele
        if (document.body.dataset.page === 'dashboard') initDashboard();
      } else {
        showToast('Token inválido ou repositório não encontrado.', 'error');
      }
    } catch {
      showToast('Erro ao verificar — verifique sua conexão.', 'error');
    }

    btn.textContent = 'Salvar Configuração';
    btn.disabled = false;
  });
}


// ═══════════════════════════════════════════════════════════════
//  PÁGINA: DASHBOARD (index.html)
// ═══════════════════════════════════════════════════════════════

async function initDashboard() {
  const grid = document.getElementById('obrasGrid');
  if (!grid) return;

  grid.innerHTML = buildSkeletons(15);

  // Tentar carregar dados remotos
  let obrasData = null;
  if (isConfigured()) {
    obrasData = await loadObrasJson();
  }

  // Contadores para stats
  let cntAndamento = 0, cntConcluida = 0, cntSemImg = 0;

  // Filtro ativo
  let activeFilter = 'todos';

  const cards = CONFIG.obras.map(obra => {
    const remote = obrasData?.obras?.find(o => o.id === obra.id);
    const status  = remote?.status || obra.status;
    const capaUrl = remote?.capa || null;
    const imagens = remote?.imagens || [];
    const total   = (capaUrl ? 1 : 0) + imagens.length;
    const pct     = Math.round((total / 19) * 100);
    const updated = remote?.ultimaAtualizacao || null;

    if (status === 'em_andamento') cntAndamento++;
    if (status === 'concluida')    cntConcluida++;
    if (total === 0)               cntSemImg++;

    return {
      obra, status, capaUrl, total, pct, updated,
      html: buildObraCard(obra, status, capaUrl, total, pct, updated),
    };
  });

  grid.innerHTML = cards.map(c => c.html).join('');

  // Stats
  el('statAndamento') && (el('statAndamento').textContent = cntAndamento);
  el('statConcluida') && (el('statConcluida').textContent = cntConcluida);
  el('statTotal')     && (el('statTotal').textContent     = CONFIG.obras.length);

  // Filtros
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterCards(activeFilter);
    });
  });

  function filterCards(filter) {
    document.querySelectorAll('.obra-card').forEach(card => {
      const s = card.dataset.status;
      const visible = filter === 'todos' || s === filter;
      card.style.display = visible ? '' : 'none';
    });
  }
}

function buildObraCard(obra, status, capaUrl, total, pct, updated) {
  const thumbContent = capaUrl
    ? `<img src="${capaUrl}" alt="Capa ${obra.nome}" loading="lazy" onerror="this.parentElement.innerHTML=obrasPlaceholder()">`
    : `<div class="obra-placeholder"><div class="obra-placeholder-icon">🏗️</div><div class="obra-placeholder-text">Sem capa</div></div>`;

  return `
  <a href="gallery.html?obra=${obra.id}" class="obra-card" data-status="${status}">
    <div class="obra-thumb">
      ${thumbContent}
      <span class="obra-badge ${statusClass(status)}">${statusLabel(status)}</span>
      <div class="img-bar"><div class="img-bar-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="obra-body">
      <div class="obra-num">${obra.codigo}</div>
      <div class="obra-name">${obra.nome}</div>
      <div class="obra-local">📍 ${obra.local}</div>
      <div class="obra-footer">
        <div class="obra-img-count">📷 <strong>${total}</strong>&nbsp;/ 19 imagens</div>
        <div class="obra-arrow">→</div>
      </div>
    </div>
  </a>`;
}

function obrasPlaceholder() {
  return '<div class="obra-placeholder"><div class="obra-placeholder-icon">🏗️</div><div class="obra-placeholder-text">Sem capa</div></div>';
}

function buildSkeletons(n) {
  return Array.from({ length: n }).map(() => `
    <div class="obra-card" style="pointer-events:none">
      <div class="obra-thumb skeleton" style="aspect-ratio:16/10"></div>
      <div class="obra-body">
        <div class="skeleton" style="height:10px;width:50%;margin-bottom:6px;border-radius:4px"></div>
        <div class="skeleton" style="height:14px;width:80%;margin-bottom:8px;border-radius:4px"></div>
        <div class="skeleton" style="height:10px;width:60%;border-radius:4px"></div>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
//  PÁGINA: GALERIA (gallery.html)
// ═══════════════════════════════════════════════════════════════

let _lightboxImages = [];
let _lightboxIndex  = 0;

async function initGallery() {
  const params = new URLSearchParams(location.search);
  const obraId = params.get('obra');

  if (!obraId) { location.href = 'index.html'; return; }

  const obra = getObraById(obraId);
  if (!obra)  { location.href = 'index.html'; return; }

  // Preencher cabeçalho
  setTextContent('galleryTitle',  obra.nome);
  setTextContent('galleryCode',   obra.codigo);
  setTextContent('galleryLocal',  obra.local);
  document.title = `${obra.nome} — Portal de Obras`;

  // Link de upload
  const uploadLink = document.getElementById('galleryUploadBtn');
  if (uploadLink) uploadLink.href = `upload.html?obra=${obra.id}`;

  // Carregar dados
  const obrasData = isConfigured() ? await loadObrasJson() : null;
  const remote    = obrasData?.obras?.find(o => o.id === obra.id);

  // Capa
  const coverWrap = document.getElementById('coverWrap');
  if (coverWrap) {
    if (remote?.capa) {
      coverWrap.innerHTML = `<img src="${remote.capa}" alt="Capa da ${obra.nome}">`;
    } else {
      coverWrap.innerHTML = `
        <div class="cover-placeholder">
          <div style="font-size:4rem">🏗️</div>
          <p>Nenhuma imagem de capa enviada</p>
        </div>`;
    }
  }

  // Info card
  const imagens = remote?.imagens || [];
  const total   = (remote?.capa ? 1 : 0) + imagens.length;
  setTextContent('infoStatus',    statusLabel(remote?.status || obra.status));
  setTextContent('infoTotal',     `${total} / 19`);
  setTextContent('infoUpdated',   formatDate(remote?.ultimaAtualizacao));

  // Grid de progresso
  const imgsGrid = document.getElementById('imagesGrid');
  if (imgsGrid) {
    if (imagens.length === 0) {
      imgsGrid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">📷</div>
          <div class="empty-title">Nenhuma foto de andamento</div>
          <div class="empty-sub">Faça o upload das fotos na área de envio</div>
        </div>`;
    } else {
      imgsGrid.innerHTML = imagens.map((url, i) => `
        <div class="gallery-item" onclick="openLightbox(${i})" title="Foto ${i+1}">
          <img src="${url}" alt="Andamento ${i+1}" loading="lazy">
          <div class="gallery-item-num">${i+1}</div>
        </div>`).join('');
    }
  }

  // Lightbox
  _lightboxImages = imagens;
  _lightboxIndex  = 0;

  // Keyboard
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox')?.classList.contains('open')) return;
    if (e.key === 'ArrowRight') lightboxNext();
    if (e.key === 'ArrowLeft')  lightboxPrev();
    if (e.key === 'Escape')     closeLightbox();
  });
}

function openLightbox(idx) {
  if (_lightboxImages.length === 0) return;
  _lightboxIndex = idx;
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  const ctr = document.getElementById('lbCounter');
  img.src = _lightboxImages[idx];
  if (ctr) ctr.textContent = `${idx + 1} / ${_lightboxImages.length}`;
  lb?.classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox')?.classList.remove('open');
}

function lightboxNext() {
  const n = _lightboxImages.length;
  if (!n) return;
  _lightboxIndex = (_lightboxIndex + 1) % n;
  openLightbox(_lightboxIndex);
}

function lightboxPrev() {
  const n = _lightboxImages.length;
  if (!n) return;
  _lightboxIndex = (_lightboxIndex - 1 + n) % n;
  openLightbox(_lightboxIndex);
}


// ═══════════════════════════════════════════════════════════════
//  PÁGINA: UPLOAD (upload.html)
// ═══════════════════════════════════════════════════════════════

let _capaFile  = null;
let _progFiles = [];

function initUpload() {
  const obraSelect = document.getElementById('obraSelect');
  if (!obraSelect) return;

  // Preencher select com obras
  obraSelect.innerHTML =
    '<option value="">— Selecione a obra —</option>' +
    CONFIG.obras.map(o =>
      `<option value="${o.id}">${o.codigo} — ${o.nome}</option>`
    ).join('');

  // Pré-selecionar obra se vier na URL
  const params = new URLSearchParams(location.search);
  const preObra = params.get('obra');
  if (preObra) obraSelect.value = preObra;
  updateSelectedObra();

  obraSelect.addEventListener('change', updateSelectedObra);

  // Status de configuração
  updateConfigWarning();

  // ── Capa ──
  setupDropzone('capaDrop', 'capaInput', files => {
    _capaFile = files[0] || null;
    renderCapaPreview();
  });

  // ── Fotos de andamento ──
  setupDropzone('progDrop', 'progInput', files => {
    const novos = Array.from(files).slice(0, 18 - _progFiles.length);
    _progFiles  = [..._progFiles, ...novos].slice(0, 18);
    renderProgPreviews();
  }, true); // multiple

  // ── Submit ──
  document.getElementById('uploadForm')?.addEventListener('submit', handleUpload);
}

function updateSelectedObra() {
  const select = document.getElementById('obraSelect');
  const nameEl = document.getElementById('selectedObraName');
  if (!select || !nameEl) return;
  const obra = getObraById(select.value);
  nameEl.textContent = obra ? `${obra.codigo} — ${obra.nome}` : '';
}

function updateConfigWarning() {
  const warn = document.getElementById('uploadConfigWarn');
  if (!warn) return;
  if (isConfigured()) {
    warn.style.display = 'none';
  } else {
    warn.style.display = '';
  }
}

function setupDropzone(zoneId, inputId, onChange, multiple = false) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  if (multiple) input.setAttribute('multiple', '');

  input.addEventListener('change', e => onChange(e.target.files));

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    onChange(e.dataTransfer.files);
  });
}

function renderCapaPreview() {
  const preview = document.getElementById('capaPreview');
  if (!preview) return;

  if (_capaFile) {
    const url = URL.createObjectURL(_capaFile);
    preview.innerHTML = `<img src="${url}" alt="Preview capa">`;
    preview.style.display = '';
  } else {
    preview.innerHTML = '';
    preview.style.display = 'none';
  }
}

function renderProgPreviews() {
  const grid  = document.getElementById('progPreview');
  const count = document.getElementById('progCount');
  if (!grid) return;

  if (count) {
    const n = _progFiles.length;
    count.innerHTML = `<strong>${n}</strong> / 18 selecionadas`;
  }

  grid.innerHTML = _progFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `
      <div class="preview-item">
        <img src="${url}" alt="${f.name}">
        <button class="remove-btn" onclick="removeProgFile(${i})" title="Remover">×</button>
      </div>`;
  }).join('');
}

function removeProgFile(idx) {
  _progFiles.splice(idx, 1);
  renderProgPreviews();
}

async function handleUpload(e) {
  e.preventDefault();

  // ── Validações ──
  if (!isConfigured()) {
    showToast('Configure o repositório GitHub primeiro (botão ⚙ no topo).', 'error');
    document.getElementById('btnSettings')?.click();
    return;
  }
  const obraId = document.getElementById('obraSelect')?.value;
  if (!obraId) { showToast('Selecione uma obra antes de enviar.', 'error'); return; }
  if (!_capaFile && _progFiles.length === 0) {
    showToast('Selecione ao menos uma imagem para enviar.', 'error'); return;
  }

  const obra    = getObraById(obraId);
  const obraDir = `images/obra-${String(obraId).padStart(2, '0')}`;
  const cfg     = getGithubConfig();
  const rawBase = getRawBaseUrl();

  // ── UI de progresso ──
  const progressWrap  = document.getElementById('uploadProgress');
  const progressFill  = document.getElementById('progressFill');
  const progressText  = document.getElementById('progressText');
  const submitBtn     = document.getElementById('submitBtn');

  progressWrap?.classList.add('show');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

  function setProgress(pct, msg) {
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = msg;
  }

  try {
    setProgress(5, 'Carregando dados das obras...');

    // ── Carregar ou criar obras.json ──
    let obrasData = await loadObrasJson();
    if (!obrasData) obrasData = buildDefaultObrasJson();

    let obraEntry = obrasData.obras.find(o => o.id === parseInt(obraId));
    if (!obraEntry) {
      obraEntry = {
        id: parseInt(obraId), codigo: obra.codigo, nome: obra.nome,
        local: obra.local, status: obra.status,
        capa: null, imagens: [], totalImagens: 0, ultimaAtualizacao: null,
      };
      obrasData.obras.push(obraEntry);
    }

    const totalFiles = (_capaFile ? 1 : 0) + _progFiles.length;
    let   uploaded   = 0;

    // ── Upload capa ──
    if (_capaFile) {
      const ext  = (_capaFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${obraDir}/capa.${ext}`;
      setProgress(15, `Enviando capa...`);
      await uploadImage(_capaFile, path, msg => setProgress(20, msg));
      obraEntry.capa = `${rawBase}/${path}`;
      uploaded++;
      setProgress(30, 'Capa enviada ✓');
    }

    // ── Upload fotos de andamento ──
    const startPct  = _capaFile ? 30 : 10;
    const endPct    = 90;
    const perFile   = _progFiles.length > 0 ? (endPct - startPct) / _progFiles.length : 0;

    for (let i = 0; i < _progFiles.length; i++) {
      const file = _progFiles[i];
      const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const num  = String(i + 1).padStart(2, '0');
      const path = `${obraDir}/img-${num}.${ext}`;
      const pct  = startPct + perFile * i;

      setProgress(pct, `Enviando foto ${i + 1} de ${_progFiles.length}...`);
      await uploadImage(file, path, () => {});

      const imgUrl = `${rawBase}/${path}`;
      if (!obraEntry.imagens.includes(imgUrl)) obraEntry.imagens.push(imgUrl);
      uploaded++;
    }

    // ── Atualizar obras.json ──
    setProgress(92, 'Atualizando manifesto de imagens...');
    obraEntry.status            = 'em_andamento';
    obraEntry.totalImagens      = (obraEntry.capa ? 1 : 0) + obraEntry.imagens.length;
    obraEntry.ultimaAtualizacao = new Date().toISOString().split('T')[0];
    obrasData.geradoEm          = new Date().toISOString();

    await saveObrasJson(obrasData);

    setProgress(100, `✅ ${uploaded} imagem(ns) enviada(s) com sucesso!`);
    showToast(`${uploaded} imagem(ns) enviada(s) com sucesso!`, 'success');

    // Reset após 3s
    setTimeout(() => {
      progressWrap?.classList.remove('show');
      _capaFile  = null;
      _progFiles = [];
      renderCapaPreview();
      renderProgPreviews();
    }, 3500);

  } catch (err) {
    console.error(err);
    showToast(`Erro no upload: ${err.message}`, 'error');
    setProgress(0, '');
    progressWrap?.classList.remove('show');
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🚀 Enviar Imagens'; }
}


// ═══════════════════════════════════════════════════════════════
//  HELPERS DOM
// ═══════════════════════════════════════════════════════════════

function el(id) { return document.getElementById(id); }

function setTextContent(id, text) {
  const e = document.getElementById(id);
  if (e) e.textContent = text;
}


// ═══════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  checkAutoSetup(); // ← detecta link de auto-configuração
  initSettings();

  const page = document.body.dataset.page;
  if (page === 'dashboard') initDashboard();
  if (page === 'gallery')   initGallery();
  if (page === 'upload')    initUpload();
});
