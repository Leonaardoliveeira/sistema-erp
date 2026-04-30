const getToken   = () => localStorage.getItem("token");
const getUsuario = () => { try { return JSON.parse(localStorage.getItem("usuario") || "{}"); } catch(_){ return {}; } };
const mostrarLoading  = () => { const el = document.getElementById("loading"); if(el) el.style.display = "flex"; };
const esconderLoading = () => { const el = document.getElementById("loading"); if(el) el.style.display = "none"; };

let backupsCache    = [];
let clientesCache   = [];
let filtroStatus    = "";
let filtroClienteId = "";
let filtroDias      = "30";
let _filtroCardTipo = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function inicializarBackup() {
  await verificarPermissaoBackup();
  await carregarClientes();          // PRIMEIRO — backups depende disto
  await carregarResumo();
  await carregarBackups();
  await carregarBoletosVencidos();

  const painel = document.getElementById("painelPermissoes");
  if (painel) {
    if (getUsuario().perfil === "master") {
      painel.style.display = "block";
      await carregarPermissoes();
    } else {
      painel.style.display = "none";
    }
  }
}

// ── PERMISSÃO ─────────────────────────────────────────────────────────────────
async function verificarPermissaoBackup() {
  try {
    const res = await fetch("/api/backup/meu-acesso", {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (res.status === 401) { window.location.href = "index.html"; return; }
    if (!res.ok) return; 
    const data = await res.json();
    if (data.acesso === false) mostrarSemPermissao();
  } catch (e) {
    console.warn("Não foi possível verificar permissão:", e.message);
  }
}

function mostrarSemPermissao() {
  const el = document.getElementById("conteudoBackup");
  if (el) el.style.display = "none";
  const sem = document.getElementById("semPermissao");
  if (sem) sem.style.display = "flex";
}

// ── CLIENTES (AJUSTADO) ───────────────────────────────────────────────────────
async function carregarClientes() {
  try {
    const headers = { "Authorization": "Bearer " + getToken() };
    let res = await fetch("/api/backup/clientes-config", { headers });
    let data = [];

    if (res.ok) {
      data = await res.json();
    }

    // Se a rota específica falhar ou retornar vazio, busca na rota geral de clientes
    if (!res.ok || !Array.isArray(data) || data.length === 0) {
      const resLegacy = await fetch("/api/clientes", { headers });
      if (resLegacy.ok) {
        data = await resLegacy.json();
      }
    }

    // Normaliza os dados para garantir que backupHabilitado exista como boolean
    clientesCache = (Array.isArray(data) ? data : []).map(c => ({
      ...c,
      backupHabilitado: !!c.backupHabilitado // Força true/false
    }));

    if (clientesCache.length === 0) {
      console.warn("Nenhum cliente retornado da API.");
    }

    // Select de filtro superior (apenas clientes que JÁ tem backup ativo)
    const sel = document.getElementById("filtroCliente");
    if (sel) {
      const habilitados = clientesCache.filter(c => c.backupHabilitado === true);
      sel.innerHTML = '<option value="">Todos os clientes</option>' +
        habilitados.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
    }

    // Renderiza a tabela de gestão (onde você ativa/desativa)
    renderizarClientesConfig();

  } catch (e) {
    console.error("Erro carregarClientes:", e);
    mostrarErroConfig("Erro de rede ao carregar clientes: " + e.message);
  }
}

function mostrarErroConfig(msg) {
  const tbody = document.getElementById("tabelaClientesConfig");
  if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger);padding:16px;text-align:center;">${msg}</td></tr>`;
}

function renderizarClientesConfig() {
  const tbody = document.getElementById("tabelaClientesConfig");
  if (!tbody) return;

  if (!clientesCache.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">
      Nenhum cliente encontrado no sistema. <a href="cadastro.html">Cadastre clientes aqui.</a>
    </td></tr>`;
    return;
  }

  const u = getUsuario();
  const temBoleto = u.perfil === "master" || u.acessoBoleto;

  tbody.innerHTML = clientesCache.map(c => {
    const nomeCliente = c.nome || "Cliente sem nome";
    const nomeEsc = escapeHtml(c.backupClienteNome || "");
    const nomeModal = String(nomeCliente).replace(/'/g, "\\'");
    
    return `<tr>
      <td><strong>${escapeHtml(nomeCliente)}</strong></td>
      <td>
        <input type="text" class="input-agent-nome"
          value="${nomeEsc}"
          placeholder="Nome no Agent (opcional)"
          data-id="${c._id}"
          oninput="marcarAlterado('${c._id}')">
      </td>
      <td>
        <label class="toggle-wrap">
          <input type="checkbox" ${c.backupHabilitado ? "checked" : ""}
            onchange="toggleBackupCliente('${c._id}', this)">
          <span class="toggle-slider"></span>
          <span class="toggle-label">${c.backupHabilitado ? "Habilitado" : "Desabilitado"}</span>
        </label>
      </td>
      <td style="white-space:nowrap;">
        <button class="btn-salvar-agent" id="btn-agent-${c._id}"
          onclick="salvarNomeAgent('${c._id}')" style="display:none;">Salvar</button>
        ${temBoleto ? `<button class="btn-boleto-mini" onclick="abrirModalBoletos('${c._id}','${nomeModal}')" title="Financeiro">💰</button>` : ""}
      </td>
    </tr>`;
  }).join("");
}

function marcarAlterado(id) {
  const btn = document.getElementById("btn-agent-" + id);
  if (btn) btn.style.display = "inline-block";
}

async function salvarNomeAgent(id) {
  const input = document.querySelector(`.input-agent-nome[data-id="${id}"]`);
  if (!input) return;
  try {
    const res = await fetch(`/api/clientes/${id}/backup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify({ backupClienteNome: input.value.trim() })
    });
    if (!res.ok) { toast.erro("Erro ao salvar"); return; }
    const btn = document.getElementById("btn-agent-" + id);
    if (btn) btn.style.display = "none";
    const idx = clientesCache.findIndex(c => c._id === id);
    if (idx >= 0) clientesCache[idx].backupClienteNome = input.value.trim();
    toast.sucesso("Nome atualizado!");
  } catch (_) { toast.erro("Erro ao salvar"); }
}

async function toggleBackupCliente(id, checkbox) {
  const habilitado = checkbox.checked;
  const label = checkbox.parentElement.querySelector(".toggle-label");
  try {
    const res = await fetch(`/api/clientes/${id}/backup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify({ backupHabilitado: habilitado })
    });
    if (!res.ok) { checkbox.checked = !habilitado; toast.erro("Erro ao atualizar"); return; }
    
    if (label) label.textContent = habilitado ? "Habilitado" : "Desabilitado";
    
    const idx = clientesCache.findIndex(c => c._id === id);
    if (idx >= 0) clientesCache[idx].backupHabilitado = habilitado;
    
    toast.sucesso(habilitado ? "Backup habilitado para este cliente." : "Backup desabilitado.");
    
    // Atualiza o select de filtros e o resumo, pois a lista de quem deve ter backup mudou
    carregarResumo();
    const sel = document.getElementById("filtroCliente");
    if (sel) {
        const hab = clientesCache.filter(c => c.backupHabilitado);
        sel.innerHTML = '<option value="">Todos os clientes</option>' +
          hab.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
    }
  } catch (_) { checkbox.checked = !habilitado; toast.erro("Erro ao atualizar"); }
}

// ── RESUMO ────────────────────────────────────────────────────────────────────
async function carregarResumo() {
  try {
    const res = await fetch("/api/backup/resumo", {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) return;
    const data = await res.json();
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val ?? "—"; };
    set("totalClientes",     data.totalClientes);
    set("comBackup",         data.comBackup);
    set("semBackup",         data.semBackup);
    set("totalSuspensos", data.suspensos);
    if (data.semBackup > 0) setTimeout(() => toast.aviso(`⚠️ ${data.semBackup} cliente(s) sem backup hoje!`, 6000), 800);
  } catch (e) { console.error("Erro resumo:", e); }
}

// ── BOLETOS VENCIDOS ──────────────────────────────────────────────────────────
async function carregarBoletosVencidos() {
  try {
    const res = await fetch("/api/backup/boletos-vencidos", {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) return;
    renderizarBoletosVencidos(await res.json());
  } catch (_) {}
}

function renderizarBoletosVencidos(lista) {
  const box = document.getElementById("boxBoletosVencidos");
  const el  = document.getElementById("listaBoletosVencidos");
  if (!box || !el) return;
  if (!lista || !lista.length) { box.style.display = "none"; return; }
  box.style.display = "block";
  el.innerHTML = lista.map(c => {
    const venc    = new Date(c.boletoVencimento);
    const diasAtr = Math.floor((new Date() - venc) / 86400000);
    return `<div class="boleto-item">
      <div class="boleto-item-info">
        <strong>${c.nome}</strong>
        <span class="boleto-venc-label">Venceu em ${venc.toLocaleDateString("pt-BR")}
          ${diasAtr > 0 ? `<span class="boleto-atraso">(${diasAtr} dia${diasAtr>1?"s":""} em atraso)</span>` : ""}
        </span>
      </div>
      <div class="boleto-item-acoes">
        <button class="btn-boleto-pago" onclick="abrirModalBoletos('${c._id}','${c.nome.replace(/'/g,"\\'")}')">💰 Ver Boletos</button>
        <button class="btn-boleto-bloquear ${c.backupBloqueado?"bloqueado":""}"
          onclick="toggleBloqueioBackup('${c._id}',${!c.backupBloqueado},this)">
          ${c.backupBloqueado ? "🔓 Liberar" : "🔒 Bloquear"}
        </button>
      </div>
    </div>`;
  }).join("");
}

async function toggleBloqueioBackup(clienteId, bloquear, btn) {
  try {
    const res = await fetch(`/api/clientes/${clienteId}/bloqueio-backup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify({ backupBloqueado: bloquear })
    });
    if (!res.ok) { toast.erro("Erro ao atualizar"); return; }
    toast.sucesso(bloquear ? "Backup bloqueado." : "Backup liberado!");
    btn.textContent = bloquear ? "🔓 Liberar" : "🔒 Bloquear";
    btn.className = `btn-boleto-bloquear ${bloquear ? "bloqueado" : ""}`;
    btn.onclick = () => toggleBloqueioBackup(clienteId, !bloquear, btn);
    await carregarResumo();
  } catch (_) { toast.erro("Erro ao atualizar"); }
}

// ── HISTÓRICO ─────────────────────────────────────────────────────────────────
async function carregarBackups() {
  mostrarLoading();
  try {
    const params = new URLSearchParams();
    if (filtroStatus)    params.append("status",    filtroStatus);
    if (filtroClienteId) params.append("clienteId", filtroClienteId);
    if (filtroDias)      params.append("dias",       filtroDias);

    const res = await fetch("/api/backup?" + params, {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) { renderizarHistoricoAgrupado([]); return; }

    const todos = await res.json();

    // Filtra para mostrar apenas logs de clientes que estão com backup habilitado
    const habIds = new Set(clientesCache.filter(c => c.backupHabilitado).map(c => String(c._id)));
    
    // Se a lista de habilitados estiver vazia (primeiro acesso), mostra tudo para evitar tela vazia
    // Caso contrário, mostra apenas logs dos habilitados
    backupsCache = habIds.size === 0
      ? todos
      : todos.filter(b => habIds.has(String(b.clienteId?._id || b.clienteId || "")));

    renderizarHistoricoAgrupado(backupsCache);
  } catch (e) {
    console.error("Erro carregarBackups:", e);
    renderizarHistoricoAgrupado([]);
  } finally {
    esconderLoading();
  }
}

function renderizarHistoricoAgrupado(lista) {
  const container = document.getElementById("historicoAgrupado");
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = `<p style="text-align:center;padding:28px;color:var(--text-muted);">
      Nenhum registro de backup encontrado no período selecionado.
    </p>`;
    return;
  }

  const grupos = {};
  lista.forEach(b => {
    const id   = String(b.clienteId?._id || b.clienteId || "sem-cliente");
    const nome = b.clienteId?.nome || "Cliente não identificado";
    if (!grupos[id]) {
      grupos[id] = {
        nome,
        documento: b.clienteId?.documento || "",
        telefone: b.clienteId?.telefone || "",
        itens: []
      };
    }
    grupos[id].itens.push(b);
  });

  container.innerHTML = Object.values(grupos).map(g => `
    <div class="historico-grupo">
      <div class="historico-grupo-header">
        <i data-lucide="hard-drive" style="width:14px;height:14px;"></i>
        <strong>${escapeHtml(g.nome)}</strong>
        <span class="historico-grupo-count">${g.itens.length} registro(s)</span>
      </div>
      <table class="historico-grupo-table">
        <thead><tr>
          <th>Data / Hora</th><th>Status</th><th>Banco</th><th>Tamanho</th><th></th>
        </tr></thead>
        <tbody>
          ${g.itens.map(b => {
            const dt = new Date(b.dataBackup);
            const obs = b.observacao || "";
            const bancoM = obs.match(/Banco:\s*([^\s|]+)/);
            const banco = bancoM ? bancoM[1] : (obs || "—");
            return `<tr>
              <td>${dt.toLocaleDateString("pt-BR")} <span style="color:var(--text-muted);font-size:11px;">${dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></td>
              <td><span class="backup-status ${b.status}">${b.status==="ok"?"✔ OK":b.status==="falha"?"✘ Falha":"⏳ Pendente"}</span></td>
              <td style="font-size:11px;" data-doc="${escapeHtml(g.documento)}" data-tel="${escapeHtml(g.telefone)}">${escapeHtml(banco)}</td>
              <td style="font-size:11px;">${b.tamanho||"—"}</td>
              <td><button class="btn-danger" style="font-size:10px;padding:2px 7px;" onclick="excluirBackup('${b._id}')">✕</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`).join("");

  if (window.lucide) lucide.createIcons();
}

// ── CARDS / FILTROS ───────────────────────────────────────────────────────────
function filtrarPorCard(tipo, el) {
  document.querySelectorAll(".card-clicavel").forEach(c => c.classList.remove("ativo"));
  const labelEl = document.getElementById("filtroAtivoLabel");
  const labelTx = document.getElementById("filtroAtivoTexto");

  if (_filtroCardTipo === tipo || tipo === "todos") {
    _filtroCardTipo = null;
    filtroStatus = "";
    filtroClienteId = "";
    if (labelEl) labelEl.style.display = "none";
    carregarBackups();
    return;
  }

  _filtroCardTipo = tipo;
  if (el) el.classList.add("ativo");
  const LABELS = { ok: "Com Backup Hoje", sem: "Sem Backup Hoje", suspenso: "Suspensos" };
  if (labelEl) { labelEl.style.display = "block"; if(labelTx) labelTx.textContent = LABELS[tipo] || tipo; }

  if (tipo === "ok") { filtroStatus = "ok"; carregarBackups(); }
  else if (tipo === "sem") {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const idsHoje = new Set(backupsCache.filter(b => new Date(b.dataBackup) >= hoje).map(b => String(b.clienteId?._id || b.clienteId)));
    renderizarHistoricoAgrupado(backupsCache.filter(b => !idsHoje.has(String(b.clienteId?._id || b.clienteId))));
  } else if (tipo === "suspenso") {
    const ids = new Set(clientesCache.filter(c => c.backupBloqueado || (!c.pago && c.boletoVencimento)).map(c => String(c._id)));
    renderizarHistoricoAgrupado(backupsCache.filter(b => ids.has(String(b.clienteId?._id || b.clienteId))));
  }
}

function aplicarFiltros() {
  filtroStatus    = document.getElementById("filtroStatus")?.value  || "";
  filtroClienteId = document.getElementById("filtroCliente")?.value || "";
  filtroDias      = document.getElementById("filtroDias")?.value    || "30";
  _filtroCardTipo = null;
  document.querySelectorAll(".card-clicavel").forEach(c => c.classList.remove("ativo"));
  const labelEl = document.getElementById("filtroAtivoLabel");
  if (labelEl) labelEl.style.display = "none";
  carregarBackups();
}

function filtrarTabela() {
  const termo = (document.getElementById("campoPesquisa")?.value || "").toLowerCase();
  document.querySelectorAll(".historico-grupo").forEach(g => {
    g.style.display = g.innerText.toLowerCase().includes(termo) ? "" : "none";
  });
}

async function excluirBackup(id) {
  if (!confirm("Excluir este registro?")) return;
  mostrarLoading();
  try {
    await fetch("/api/backup/" + id, { method: "DELETE", headers: { "Authorization": "Bearer " + getToken() } });
    toast.sucesso("Removido.");
    await Promise.all([carregarResumo(), carregarBackups()]);
  } catch (_) { toast.erro("Erro ao excluir"); }
  finally { esconderLoading(); }
}

async function confirmarLimparHistorico() {
  const dias = prompt("Limpar registros com mais de quantos dias?\n(deixe 0 para limpar tudo, Cancelar para sair)", "5");
  if (dias === null) return;
  mostrarLoading();
  try {
    const url = dias === "0" ? "/api/backup/historico" : `/api/backup/historico?dias=${parseInt(dias)||5}`;
    const res = await fetch(url, { method: "DELETE", headers: { "Authorization": "Bearer " + getToken() } });
    const data = await res.json();
    toast.sucesso(`${data.removidos} registro(s) removidos.`);
    await Promise.all([carregarResumo(), carregarBackups()]);
  } catch (_) { toast.erro("Erro ao limpar"); }
  finally { esconderLoading(); }
}

// ── OBJECTID ─────────────────────────────────────────────────────────────────
async function buscarIdCliente() {
  const termo = (document.getElementById("buscaIdCliente")?.value || "").trim();
  const campo = document.getElementById("buscaIdCampo")?.value || "todos";
  const el   = document.getElementById("resultadoIdCliente");
  if (!el) return;
  if (!termo) {
    el.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Digite para buscar por nome, documento ou telefone.</p>`;
    return;
  }
  try {
    const qs = new URLSearchParams({ campo, termo });
    const res = await fetch(`/api/clientes/buscar-id?${qs.toString()}`, {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    const lista = await res.json();
    if (!Array.isArray(lista) || !lista.length) {
      el.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Nenhum cliente encontrado.</p>`;
      return;
    }
    el.innerHTML = lista.map(c => `
      <div class="objectid-item">
        <div>
          <strong style="font-size:13px;">${escapeHtml(c.nome || "—")}</strong>
          ${c.documento ? `<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">Doc: ${escapeHtml(c.documento)}</span>` : ""}
          ${c.telefone ? `<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">Tel: ${escapeHtml(c.telefone)}</span>` : ""}
          ${c.backupClienteNome ? `<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">(${escapeHtml(c.backupClienteNome)})</span>` : ""}
          <code class="objectid-code" id="oid-${c._id}">${c._id}</code>
        </div>
        <button class="btn-copy-id" onclick="copiarId('${c._id}')">📋 Copiar ID</button>
      </div>`).join("");
  } catch (_) { el.innerHTML = `<p style="font-size:12px;color:var(--danger);">Erro ao buscar.</p>`; }
}

function copiarId(id) {
  navigator.clipboard.writeText(id)
    .then(() => toast.sucesso("ID copiado!"))
    .catch(() => {
      const el = document.getElementById("oid-" + id);
      if (el) { const r = document.createRange(); r.selectNode(el); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); }
      toast.aviso("Selecione e copie manualmente.");
    });
}

// ── PERMISSÕES ────────────────────────────────────────────────────────────────
async function carregarPermissoes() {
  const tbody = document.getElementById("tabelaPermissoes");
  if (!tbody) return;
  try {
    const res = await fetch("/api/backup/permissoes", {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) return;
    const usuarios = await res.json();
    if (!usuarios.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--text-muted);">Nenhum usuário além do mestre.</td></tr>`;
      return;
    }
    const L = { admin: "Administrador", user: "Usuário" };
    tbody.innerHTML = usuarios.map(u => `
      <tr>
        <td>${u.nome}</td><td>${u.usuario}</td>
        <td><span class="status ${u.perfil}">${L[u.perfil]||u.perfil}</span></td>
        <td>
          <label class="toggle-wrap">
            <input type="checkbox" ${u.acessoBackup?"checked":""} onchange="togglePermissaoUsuario('${u._id}',this,'backup')">
            <span class="toggle-slider"></span>
            <span class="toggle-label">${u.acessoBackup?"Permitido":"Bloqueado"}</span>
          </label>
        </td>
        <td>
          <label class="toggle-wrap">
            <input type="checkbox" ${u.acessoBoleto?"checked":""} onchange="togglePermissaoUsuario('${u._id}',this,'boleto')">
            <span class="toggle-slider"></span>
            <span class="toggle-label">${u.acessoBoleto?"Permitido":"Bloqueado"}</span>
          </label>
        </td>
      </tr>`).join("");
  } catch (e) { console.error("Erro permissoes:", e); }
}

async function togglePermissaoUsuario(id, checkbox, tipo) {
  const permitido = checkbox.checked;
  const label      = checkbox.parentElement.querySelector(".toggle-label");
  const url        = tipo === "boleto" ? `/api/usuarios/${id}/acesso-boleto` : `/api/usuarios/${id}/acesso-backup`;
  const body      = tipo === "boleto" ? { acessoBoleto: permitido } : { acessoBackup: permitido };
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify(body)
    });
    if (!res.ok) { checkbox.checked = !permitido; toast.erro("Erro ao atualizar"); return; }
    if (label) label.textContent = permitido ? "Permitido" : "Bloqueado";
    const u = getUsuario();
    if (String(u._id || u.id) === String(id)) {
      localStorage.setItem("usuario", JSON.stringify({ ...u, [tipo==="boleto"?"acessoBoleto":"acessoBackup"]: permitido }));
    }
    toast.sucesso(permitido ? "Acesso liberado!" : "Acesso revogado.");
  } catch (_) { checkbox.checked = !permitido; toast.erro("Erro ao atualizar"); }
}

// ── BOLETOS MODAL ─────────────────────────────────────────────────────────────
async function abrirModalBoletos(clienteId, nomeCliente) {
  document.getElementById("boletoClienteIdAtual").value = clienteId;
  document.getElementById("modalBoletosTitle").textContent = `Boletos — ${nomeCliente}`;
  document.getElementById("modalBoletos").style.display = "flex";
  await carregarBoletos(clienteId);
  if (window.lucide) lucide.createIcons();
}

function fecharModalBoletos() {
  const m = document.getElementById("modalBoletos");
  if (m) m.style.display = "none";
}

async function carregarBoletos(clienteId) {
  const el = document.getElementById("listaBoletos");
  if (!el) return;
  el.innerHTML = `<p style="text-align:center;padding:12px;color:var(--text-muted)">Carregando...</p>`;
  try {
    const res = await fetch(`/api/boletos/${clienteId}`, {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) { el.innerHTML = `<p style="color:var(--danger)">Erro ao carregar.</p>`; return; }
    const boletos = await res.json();
    if (!boletos.length) { el.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:12px;">Nenhuma parcela cadastrada. Gere acima.</p>`; return; }

    const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const vencidos = boletos.filter(b => !b.pago && new Date(b.vencimento) < hoje).length;

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="font-size:11px;color:var(--text-muted)">${boletos.length} parcela(s)</span>
        ${vencidos > 0 ? `<span style="font-size:11px;color:#ef4444;font-weight:700">⚠️ ${vencidos} vencida(s)</span>` : `<span style="font-size:11px;color:var(--green)">✅ Em dia</span>`}
      </div>
      <div class="boletos-lista">
        ${boletos.map(b => {
          const venc = new Date(b.vencimento);
          const atrasado = !b.pago && venc < hoje;
          const isHoje = venc.toDateString() === new Date().toDateString();
          return `<div class="boleto-parcela-item ${b.pago?"pago":atrasado?"atrasado":isHoje?"hoje":""}">
            <div class="boleto-parcela-info">
              <span class="boleto-parcela-num">${b.parcela}/${b.totalParcelas}</span>
              <span class="boleto-parcela-venc">Venc: ${fmt(b.vencimento)}</span>
              ${b.valor > 0 ? `<span class="boleto-parcela-valor">R$ ${b.valor.toFixed(2)}</span>` : ""}
              ${b.pago ? `<span class="boleto-parcela-pago-em">Pago em ${fmt(b.dataPagamento)}</span>` : ""}
            </div>
            <div class="boleto-parcela-acoes">
              ${b.pago
                ? `<button class="btn-baixa estornar" onclick="darBaixa('${b._id}',false,'${clienteId}')">↩ Estornar</button>`
                : `<button class="btn-baixa pagar"   onclick="darBaixa('${b._id}',true,'${clienteId}')">✅ Dar Baixa</button>`}
              <button class="btn-baixa excluir" onclick="excluirBoleto('${b._id}','${clienteId}')">✕</button>
            </div>
          </div>`;
        }).join("")}
      </div>`;
  } catch (e) { el.innerHTML = `<p style="color:var(--danger)">Erro: ${e.message}</p>`; }
}

async function gerarParcelas() {
  const clienteId  = document.getElementById("boletoClienteIdAtual").value;
  const dataInicial = document.getElementById("boletoDataInicial").value;
  const valor        = document.getElementById("boletoValor").value;
  const totalP      = document.getElementById("boletoParcelas").value;
  if (!dataInicial) { toast.aviso("Informe a data do 1º vencimento"); return; }
  try {
    const res = await fetch("/api/boletos/gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify({ clienteId, primeiroVencimento: dataInicial, valor: parseFloat(valor)||0, totalParcelas: parseInt(totalP)||12 })
    });
    if (!res.ok) { toast.erro("Erro ao gerar parcelas"); return; }
    toast.sucesso(`${totalP} parcelas geradas!`);
    await carregarBoletos(clienteId);
    await carregarBoletosVencidos();
    await carregarResumo();
  } catch (_) { toast.erro("Erro ao gerar"); }
}

async function darBaixa(boletoId, pago, clienteId) {
  try {
    const res = await fetch(`/api/boletos/${boletoId}/baixa`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify({ pago })
    });
    if (!res.ok) { toast.erro("Erro ao atualizar"); return; }
    toast.sucesso(pago ? "Baixa registrada!" : "Estorno realizado.");
    await carregarBoletos(clienteId);
    await carregarBoletosVencidos();
    await carregarResumo();
  } catch (_) { toast.erro("Erro ao atualizar"); }
}

async function excluirBoleto(boletoId, clienteId) {
  if (!confirm("Excluir esta parcela?")) return;
  try {
    await fetch(`/api/boletos/${boletoId}`, {
      method: "DELETE", headers: { "Authorization": "Bearer " + getToken() }
    });
    toast.sucesso("Parcela removida.");
    await carregarBoletos(clienteId);
  } catch (_) { toast.erro("Erro ao excluir"); }
}