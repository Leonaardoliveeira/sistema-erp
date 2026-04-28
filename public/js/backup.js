const getToken   = () => localStorage.getItem("token");
const getUsuario = () => JSON.parse(localStorage.getItem("usuario") || "{}");
const mostrarLoading  = () => { document.getElementById("loading")?.style && (document.getElementById("loading").style.display = "flex"); };
const esconderLoading = () => { document.getElementById("loading")?.style && (document.getElementById("loading").style.display = "none"); };

// ── Estado ────────────────────────────────────────────────────────────────────
let backupsCache      = [];
let clientesCache     = [];
let filtroCardAtivo   = null;
let filtroStatus      = "";
let filtroClienteId   = "";
let filtroDias        = "30";

// ── Init ──────────────────────────────────────────────────────────────────────
async function inicializarBackup() {
  await verificarPermissaoBackup();
  await Promise.all([carregarResumo(), carregarClientes(), carregarBackups(), carregarBoletosVencidos()]);
  const painel = document.getElementById("painelPermissoes");
  if (painel) {
    if (getUsuario().perfil === "master") { painel.style.display = "block"; await carregarPermissoes(); }
    else painel.style.display = "none";
  }
}

// ── Permissão ─────────────────────────────────────────────────────────────────
async function verificarPermissaoBackup() {
  try {
    const res = await fetch("/api/backup/meu-acesso", { headers: { "Authorization": "Bearer " + getToken() } });
    if (!res.ok) { mostrarSemPermissao(); return; }
    const { acesso } = await res.json();
    if (!acesso) mostrarSemPermissao();
  } catch (_) { mostrarSemPermissao(); }
}
function mostrarSemPermissao() {
  document.getElementById("conteudoBackup").style.display = "none";
  document.getElementById("semPermissao").style.display   = "flex";
}

// ── Resumo ────────────────────────────────────────────────────────────────────
async function carregarResumo() {
  try {
    const res  = await fetch("/api/backup/resumo", { headers: { "Authorization": "Bearer " + getToken() } });
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById("totalClientes").textContent = data.totalClientes ?? "—";
    document.getElementById("comBackup").textContent     = data.comBackup     ?? "—";
    document.getElementById("semBackup").textContent     = data.semBackup     ?? "—";
    document.getElementById("totalSuspensos").textContent = data.suspensos    ?? "—";
    if (data.semBackup > 0) {
      setTimeout(() => toast.aviso(`⚠️ ${data.semBackup} cliente(s) sem backup hoje!`, 6000), 800);
    }
  } catch (e) { console.error("Erro resumo:", e); }
}

// ── Boletos vencidos ─────────────────────────────────────────────────────────
async function carregarBoletosVencidos() {
  try {
    const res = await fetch("/api/backup/boletos-vencidos", { headers: { "Authorization": "Bearer " + getToken() } });
    if (!res.ok) return;
    const vencidos = await res.json();
    renderizarBoletosVencidos(vencidos);
  } catch (_) {}
}

function renderizarBoletosVencidos(lista) {
  const box = document.getElementById("boxBoletosVencidos");
  const el  = document.getElementById("listaBoletosVencidos");
  if (!box || !el) return;
  if (!lista || lista.length === 0) { box.style.display = "none"; return; }
  box.style.display = "block";
  el.innerHTML = lista.map(c => {
    const venc    = new Date(c.boletoVencimento);
    const diasAtr = Math.floor((new Date() - venc) / 86400000);
    return `<div class="boleto-item">
      <div class="boleto-item-info">
        <strong>${c.nome}</strong>
        <span class="boleto-venc-label">Venceu em ${venc.toLocaleDateString("pt-BR")}
          ${diasAtr > 0 ? `<span class="boleto-atraso">(${diasAtr} dia${diasAtr > 1 ? "s" : ""} em atraso)</span>` : ""}
        </span>
      </div>
      <div class="boleto-item-acoes">
        <button class="btn-boleto-pago" onclick="abrirModalBoletos('${c._id}','${c.nome}')">💰 Ver Boletos</button>
        <button class="btn-boleto-bloquear ${c.backupBloqueado ? "bloqueado" : ""}"
          onclick="toggleBloqueioBackup('${c._id}',${!c.backupBloqueado},this)">
          ${c.backupBloqueado ? "🔓 Liberar Backup" : "🔒 Bloquear Backup"}
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
    btn.textContent = bloquear ? "🔓 Liberar Backup" : "🔒 Bloquear Backup";
    btn.className = `btn-boleto-bloquear ${bloquear ? "bloqueado" : ""}`;
    btn.onclick = () => toggleBloqueioBackup(clienteId, !bloquear, btn);
    await carregarResumo();
  } catch (_) { toast.erro("Erro ao atualizar"); }
}

// ── Clientes ──────────────────────────────────────────────────────────────────
async function carregarClientes() {
  try {
    const res = await fetch("/api/clientes", { headers: { "Authorization": "Bearer " + getToken() } });
    if (!res.ok) return;
    clientesCache = await res.json();

    const habilitados = clientesCache.filter(c => c.backupHabilitado);
    const sel = document.getElementById("filtroCliente");
    if (sel) {
      sel.innerHTML = '<option value="">Todos os clientes habilitados</option>' +
        habilitados.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
    }

    renderizarClientesConfig();
  } catch (e) { console.error("Erro clientes:", e); }
}

function renderizarClientesConfig() {
  const tbody = document.getElementById("tabelaClientesConfig");
  if (!tbody) return;
  if (clientesCache.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum cliente cadastrado</td></tr>`; return; }
  tbody.innerHTML = clientesCache.map(c => `
    <tr>
      <td><strong>${c.nome}</strong></td>
      <td><input type="text" class="input-agent-nome" value="${(c.backupClienteNome||"").replace(/"/g,"&quot;")}"
        placeholder="Nome no Agent" data-id="${c._id}" oninput="marcarAlterado('${c._id}')"></td>
      <td>
        <label class="toggle-wrap">
          <input type="checkbox" data-id="${c._id}" ${c.backupHabilitado?"checked":""} onchange="toggleBackupCliente('${c._id}',this)">
          <span class="toggle-slider"></span>
          <span class="toggle-label">${c.backupHabilitado?"Habilitado":"Desabilitado"}</span>
        </label>
      </td>
      <td>
        <button class="btn-salvar-agent" id="btn-agent-${c._id}" onclick="salvarNomeAgent('${c._id}')" style="display:none">Salvar</button>
        ${getUsuario().acessoBoleto || getUsuario().perfil === "master"
          ? `<button class="btn-boleto-mini" onclick="abrirModalBoletos('${c._id}','${c.nome}')">💰 Boletos</button>`
          : ""}
      </td>
    </tr>`).join("");
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
    toast.sucesso("Nome atualizado!");
    const idx = clientesCache.findIndex(c => c._id === id);
    if (idx >= 0) clientesCache[idx].backupClienteNome = input.value.trim();
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
    toast.sucesso(habilitado ? "Backup habilitado." : "Backup desabilitado.");
    await carregarResumo();
  } catch (_) { checkbox.checked = !habilitado; toast.erro("Erro ao atualizar"); }
}

// ── Permissões ────────────────────────────────────────────────────────────────
async function carregarPermissoes() {
  const tbody = document.getElementById("tabelaPermissoes");
  if (!tbody) return;
  try {
    const res = await fetch("/api/backup/permissoes", { headers: { "Authorization": "Bearer " + getToken() } });
    if (!res.ok) return;
    const usuarios = await res.json();
    if (usuarios.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--text-muted)">Nenhum usuário além do mestre.</td></tr>`; return; }
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
  } catch (e) { console.error(e); }
}

async function togglePermissaoUsuario(id, checkbox, tipo) {
  const permitido = checkbox.checked;
  const label     = checkbox.parentElement.querySelector(".toggle-label");
  const url       = tipo === "boleto" ? `/api/usuarios/${id}/acesso-boleto` : `/api/usuarios/${id}/acesso-backup`;
  const body      = tipo === "boleto" ? { acessoBoleto: permitido } : { acessoBackup: permitido };
  try {
    const res = await fetch(url, { method:"PATCH", headers:{"Content-Type":"application/json","Authorization":"Bearer "+getToken()}, body: JSON.stringify(body) });
    if (!res.ok) { checkbox.checked = !permitido; toast.erro("Erro ao atualizar"); return; }
    if (label) label.textContent = permitido ? "Permitido" : "Bloqueado";
    // Atualiza localStorage do usuário atual se for ele mesmo
    const usuAtual = getUsuario();
    if (usuAtual._id === id || usuAtual.id === id) {
      const atualizado = { ...usuAtual, [tipo === "boleto" ? "acessoBoleto" : "acessoBackup"]: permitido };
      localStorage.setItem("usuario", JSON.stringify(atualizado));
    }
    toast.sucesso(permitido ? "Acesso liberado!" : "Acesso revogado.");
  } catch (_) { checkbox.checked = !permitido; toast.erro("Erro ao atualizar"); }
}

// ── Histórico ─────────────────────────────────────────────────────────────────
async function carregarBackups() {
  mostrarLoading();
  try {
    const params = new URLSearchParams();
    if (filtroStatus)    params.append("status",    filtroStatus);
    if (filtroClienteId) params.append("clienteId", filtroClienteId);
    if (filtroDias)      params.append("dias",       filtroDias);
    const res = await fetch("/api/backup?" + params, { headers: { "Authorization": "Bearer " + getToken() } });
    if (!res.ok) return;
    // Filtra somente clientes habilitados para backup
    const todos     = await res.json();
    const habIds    = new Set(clientesCache.filter(c => c.backupHabilitado).map(c => c._id));
    backupsCache    = todos.filter(b => habIds.size === 0 || habIds.has(b.clienteId?._id || b.clienteId));
    renderizarHistoricoAgrupado(backupsCache);
  } catch (e) { console.error(e); }
  finally { esconderLoading(); }
}

function renderizarHistoricoAgrupado(lista) {
  const container = document.getElementById("historicoAgrupado");
  if (!container) return;

  if (lista.length === 0) {
    container.innerHTML = `<p style="text-align:center;padding:28px;color:var(--text-muted);">Nenhum registro encontrado.</p>`;
    return;
  }

  // Agrupa por cliente
  const grupos = {};
  lista.forEach(b => {
    const id   = b.clienteId?._id || b.clienteId || "—";
    const nome = b.clienteId?.nome || "—";
    if (!grupos[id]) grupos[id] = { nome, itens: [] };
    grupos[id].itens.push(b);
  });

  container.innerHTML = Object.values(grupos).map(g => `
    <div class="historico-grupo">
      <div class="historico-grupo-header">
        <i data-lucide="hard-drive" style="width:14px;height:14px;"></i>
        <strong>${g.nome}</strong>
        <span class="historico-grupo-count">${g.itens.length} registro(s)</span>
      </div>
      <table class="historico-grupo-table">
        <thead><tr>
          <th>Data / Hora</th><th>Status</th><th>Banco / Obs</th><th>Tamanho</th><th>Ações</th>
        </tr></thead>
        <tbody>
          ${g.itens.map(b => {
            const dt  = new Date(b.dataBackup);
            const obs = b.observacao || "";
            const bancoM = obs.match(/Banco:\s*([^\s|]+)/);
            return `<tr>
              <td>${dt.toLocaleDateString("pt-BR")} <span style="color:var(--text-muted);font-size:11px;">${dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></td>
              <td><span class="backup-status ${b.status}">${b.status==="ok"?"✔ OK":b.status==="falha"?"✘ Falha":"⏳ Pendente"}</span></td>
              <td style="font-size:11px;">${bancoM?bancoM[1]:obs||"—"}</td>
              <td style="font-size:11px;">${b.tamanho||"—"}</td>
              <td><button class="btn-danger" style="font-size:11px;padding:3px 8px;" onclick="excluirBackup('${b._id}')">Excluir</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`).join("");

  // Re-inicializa ícones Lucide nos novos elementos
  if (window.lucide) lucide.createIcons();
}

// ── Filtros ───────────────────────────────────────────────────────────────────
let _filtroCardTipo = null;

function filtrarPorCard(tipo, el) {
  const cards = document.querySelectorAll(".card-clicavel");
  cards.forEach(c => c.classList.remove("ativo"));

  const label   = document.getElementById("filtroAtivoLabel");
  const labelTx = document.getElementById("filtroAtivoTexto");

  if (_filtroCardTipo === tipo || tipo === "todos") {
    _filtroCardTipo = null;
    filtroStatus    = "";
    filtroClienteId = "";
    if (label) label.style.display = "none";
    carregarBackups();
    return;
  }

  _filtroCardTipo = tipo;
  if (el) el.classList.add("ativo");

  const LABELS = { ok: "Com Backup Hoje", sem: "Sem Backup Hoje", suspenso: "Suspensos" };
  if (label) { label.style.display = "block"; labelTx.textContent = LABELS[tipo] || tipo; }

  if (tipo === "ok" || tipo === "falha") {
    filtroStatus = tipo;
    carregarBackups();
  } else if (tipo === "sem") {
    // Exibe apenas clientes habilitados sem backup hoje
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const idsComBackup = new Set(backupsCache.filter(b => new Date(b.dataBackup) >= hoje).map(b => b.clienteId?._id || b.clienteId));
    const semBackup = backupsCache.filter(b => !idsComBackup.has(b.clienteId?._id || b.clienteId));
    renderizarHistoricoAgrupado(semBackup);
  } else if (tipo === "suspenso") {
    const bloqueados = clientesCache.filter(c => c.backupBloqueado || (!c.boletoPago && c.boletoVencimento));
    const ids = new Set(bloqueados.map(c => c._id));
    renderizarHistoricoAgrupado(backupsCache.filter(b => ids.has(b.clienteId?._id || b.clienteId)));
  }
}

function aplicarFiltros() {
  filtroStatus    = document.getElementById("filtroStatus")?.value  || "";
  filtroClienteId = document.getElementById("filtroCliente")?.value || "";
  filtroDias      = document.getElementById("filtroDias")?.value    || "30";
  _filtroCardTipo = null;
  document.querySelectorAll(".card-clicavel").forEach(c => c.classList.remove("ativo"));
  const label = document.getElementById("filtroAtivoLabel");
  if (label) label.style.display = "none";
  carregarBackups();
}

function filtrarTabela() {
  const termo = document.getElementById("campoPesquisa")?.value.toLowerCase() || "";
  document.querySelectorAll(".historico-grupo").forEach(g => {
    const txt = g.innerText.toLowerCase();
    g.style.display = txt.includes(termo) ? "" : "none";
  });
}

async function excluirBackup(id) {
  if (!confirm("Excluir este registro?")) return;
  mostrarLoading();
  try {
    await fetch("/api/backup/" + id, { method:"DELETE", headers:{"Authorization":"Bearer "+getToken()} });
    toast.sucesso("Registro removido");
    await Promise.all([carregarResumo(), carregarBackups()]);
  } catch (_) { toast.erro("Erro ao excluir"); }
  finally { esconderLoading(); }
}

// ── Limpeza de histórico ──────────────────────────────────────────────────────
async function confirmarLimparHistorico() {
  const dias = prompt("Limpar registros com mais de quantos dias?\n(0 = limpar tudo, Enter = cancelar)", "5");
  if (dias === null) return;
  mostrarLoading();
  try {
    const url = dias === "0" ? "/api/backup/historico" : `/api/backup/historico?dias=${parseInt(dias)||5}`;
    const res = await fetch(url, { method:"DELETE", headers:{"Authorization":"Bearer "+getToken()} });
    const data = await res.json();
    toast.sucesso(`${data.removidos} registro(s) removidos.`);
    await Promise.all([carregarResumo(), carregarBackups()]);
  } catch (_) { toast.erro("Erro ao limpar histórico"); }
  finally { esconderLoading(); }
}

// ── Buscar ObjectID ───────────────────────────────────────────────────────────
async function buscarIdCliente() {
  const nome = document.getElementById("buscaIdCliente")?.value.trim();
  const el   = document.getElementById("resultadoIdCliente");
  if (!el) return;
  if (!nome) { el.innerHTML = ""; return; }
  try {
    const res = await fetch(`/api/clientes/buscar-id?nome=${encodeURIComponent(nome)}`, {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    const lista = await res.json();
    if (lista.length === 0) { el.innerHTML = `<p style="font-size:12px;color:var(--text-muted)">Nenhum cliente encontrado.</p>`; return; }
    el.innerHTML = lista.map(c => `
      <div class="objectid-item">
        <div>
          <strong style="font-size:13px;">${c.nome}</strong>
          ${c.backupClienteNome ? `<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">(${c.backupClienteNome})</span>` : ""}
          <code class="objectid-code" id="oid-${c._id}">${c._id}</code>
        </div>
        <button class="btn-copy-id" onclick="copiarId('${c._id}')">📋 Copiar ID</button>
      </div>`).join("");
  } catch (_) { el.innerHTML = `<p style="font-size:12px;color:var(--danger)">Erro ao buscar.</p>`; }
}

function copiarId(id) {
  navigator.clipboard.writeText(id).then(() => toast.sucesso("ID copiado!")).catch(() => {
    const el = document.getElementById("oid-" + id);
    if (el) { const r = document.createRange(); r.selectNode(el); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); }
  });
}

// ── Modal Boletos ─────────────────────────────────────────────────────────────
async function abrirModalBoletos(clienteId, nomeCliente) {
  document.getElementById("boletoClienteIdAtual").value = clienteId;
  document.getElementById("modalBoletosTitle").textContent = `Boletos — ${nomeCliente}`;
  document.getElementById("modalBoletos").style.display = "flex";
  await carregarBoletos(clienteId);
  if (window.lucide) lucide.createIcons();
}

function fecharModalBoletos() { document.getElementById("modalBoletos").style.display = "none"; }

async function carregarBoletos(clienteId) {
  const el = document.getElementById("listaBoletos");
  if (!el) return;
  el.innerHTML = `<p style="text-align:center;padding:12px;color:var(--text-muted)">Carregando...</p>`;
  try {
    const res = await fetch(`/api/boletos/${clienteId}`, { headers: { "Authorization": "Bearer " + getToken() } });
    if (!res.ok) { el.innerHTML = `<p style="color:var(--danger)">Erro ao carregar.</p>`; return; }
    const boletos = await res.json();
    if (boletos.length === 0) { el.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:12px;">Nenhuma parcela cadastrada. Gere acima.</p>`; return; }

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
          const venc    = new Date(b.vencimento);
          const atrasado = !b.pago && venc < hoje;
          const hoje2   = venc.toDateString() === new Date().toDateString();
          return `
          <div class="boleto-parcela-item ${b.pago?"pago":atrasado?"atrasado":hoje2?"hoje":""}">
            <div class="boleto-parcela-info">
              <span class="boleto-parcela-num">${b.parcela}/${b.totalParcelas}</span>
              <span class="boleto-parcela-venc">Venc: ${fmt(b.vencimento)}</span>
              ${b.valor > 0 ? `<span class="boleto-parcela-valor">R$ ${b.valor.toFixed(2)}</span>` : ""}
              ${b.pago ? `<span class="boleto-parcela-pago-em">Pago em ${fmt(b.dataPagamento)}</span>` : ""}
            </div>
            <div class="boleto-parcela-acoes">
              ${b.pago
                ? `<button class="btn-baixa estornar" onclick="darBaixa('${b._id}',false,'${clienteId}')">↩ Estornar</button>`
                : `<button class="btn-baixa pagar" onclick="darBaixa('${b._id}',true,'${clienteId}')">✅ Dar Baixa</button>`}
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
  const valor       = document.getElementById("boletoValor").value;
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
    toast.sucesso(pago ? "Baixa registrada! Backup liberado." : "Estorno realizado.");
    await carregarBoletos(clienteId);
    await carregarBoletosVencidos();
    await carregarResumo();
  } catch (_) { toast.erro("Erro ao atualizar"); }
}

async function excluirBoleto(boletoId, clienteId) {
  if (!confirm("Excluir esta parcela?")) return;
  try {
    await fetch(`/api/boletos/${boletoId}`, { method:"DELETE", headers:{"Authorization":"Bearer "+getToken()} });
    toast.sucesso("Parcela removida.");
    await carregarBoletos(clienteId);
  } catch (_) { toast.erro("Erro ao excluir"); }
}
