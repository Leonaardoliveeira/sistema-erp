function getToken()        { return localStorage.getItem("token"); }
function getUsuario()      { return JSON.parse(localStorage.getItem("usuario") || "{}"); }
function mostrarLoading()  { const el = document.getElementById("loading");  if (el) el.style.display = "flex";  }
function esconderLoading() { const el = document.getElementById("loading");  if (el) el.style.display = "none";  }

// ── Estado ────────────────────────────────────────────────────────────────────
let backupsCache  = [];
let clientesCache = [];
let filtroStatus  = "";
let filtroCliente = "";
let filtroDias    = "30";

// ── Init ──────────────────────────────────────────────────────────────────────
async function inicializarBackup() {
  // Verifica permissão antes de carregar qualquer dado
  await verificarPermissaoBackup();
  await Promise.all([carregarResumo(), carregarClientes(), carregarBackups(), carregarBoletosVencidos()]);

  // Painel de permissões só aparece para master
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

// ── Boletos vencidos ─────────────────────────────────────────────────────────
async function carregarBoletosVencidos() {
  try {
    const res = await fetch("/api/backup/boletos-vencidos", {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) return; // usuário sem permissão de boleto — ignora silenciosamente
    const vencidos = await res.json();
    renderizarBoletosVencidos(vencidos);
  } catch (e) { /* sem permissão de boleto — oculta seção */ }
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
    const bloq    = c.backupBloqueado;
    return `
    <div class="boleto-item">
      <div class="boleto-item-info">
        <strong>${c.nome}</strong>
        <span class="boleto-venc-label">Venceu em ${venc.toLocaleDateString("pt-BR")}
          ${diasAtr > 0 ? `<span class="boleto-atraso">(${diasAtr} dia${diasAtr > 1 ? "s" : ""} em atraso)</span>` : ""}
        </span>
      </div>
      <div class="boleto-item-acoes">
        <button class="btn-boleto-pago" onclick="marcarBoletoClientePago('${c._id}')">
          ✅ Marcar como Pago
        </button>
        <button class="btn-boleto-bloquear ${bloq ? "bloqueado" : ""}"
          onclick="toggleBloqueioBackup('${c._id}', ${!bloq}, this)">
          ${bloq ? "🔓 Liberar Backup" : "🔒 Bloquear Backup"}
        </button>
      </div>
    </div>`;
  }).join("");
}

async function marcarBoletoClientePago(clienteId) {
  try {
    const res = await fetch(`/api/clientes/${clienteId}/boleto`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify({ boletoPago: true })
    });
    if (!res.ok) { toast.erro("Erro ao atualizar boleto"); return; }
    toast.sucesso("Boleto marcado como pago! Backup liberado automaticamente.");
    await carregarBoletosVencidos();
    await carregarResumo();
  } catch (e) { toast.erro("Erro ao atualizar"); }
}

async function toggleBloqueioBackup(clienteId, bloquear, btn) {
  try {
    const res = await fetch(`/api/clientes/${clienteId}/bloqueio-backup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify({ backupBloqueado: bloquear })
    });
    if (!res.ok) { toast.erro("Erro ao atualizar bloqueio"); return; }
    toast.sucesso(bloquear ? "Backup bloqueado para este cliente." : "Backup liberado!");
    btn.textContent     = bloquear ? "🔓 Liberar Backup" : "🔒 Bloquear Backup";
    btn.className       = `btn-boleto-bloquear ${bloquear ? "bloqueado" : ""}`;
    btn.onclick         = () => toggleBloqueioBackup(clienteId, !bloquear, btn);
  } catch (e) { toast.erro("Erro ao atualizar"); }
}

// ── Verificação de acesso ─────────────────────────────────────────────────────
async function verificarPermissaoBackup() {
  try {
    const res = await fetch("/api/backup/meu-acesso", {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) { mostrarSemPermissao(); return; }
    const { acesso } = await res.json();
    if (!acesso) mostrarSemPermissao();
  } catch (e) {
    mostrarSemPermissao();
  }
}

function mostrarSemPermissao() {
  document.getElementById("conteudoBackup").style.display = "none";
  document.getElementById("semPermissao").style.display   = "flex";
}

// ── Resumo ────────────────────────────────────────────────────────────────────
async function carregarResumo() {
  try {
    const res  = await fetch("/api/backup/resumo", {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById("totalClientes").textContent = data.totalClientes;
    document.getElementById("comBackup").textContent     = data.comBackup;
    document.getElementById("semBackup").textContent     = data.semBackup;

    if (data.semBackup > 0) {
      setTimeout(() => toast.aviso(
        data.semBackup === 1
          ? "⚠️ 1 cliente sem backup hoje!"
          : `⚠️ ${data.semBackup} clientes sem backup hoje!`, 6000
      ), 800);
    }
    renderizarSemBackup(data.semBackupLista || []);
  } catch (e) { console.error("Erro resumo:", e); }
}

function renderizarSemBackup(lista) {
  const el = document.getElementById("listaSemBackup");
  if (!el) return;
  if (lista.length === 0) {
    el.innerHTML = `<p class="backup-vazio">✅ Todos os clientes receberam backup hoje!</p>`;
    return;
  }
  el.innerHTML = lista.map(c => `
    <div class="sem-backup-item">
      <span class="sem-backup-nome">${c.nome}</span>
      <span class="sem-backup-badge">Sem backup hoje</span>
    </div>`).join("");
}

// ── Clientes ──────────────────────────────────────────────────────────────────
async function carregarClientes() {
  try {
    const res = await fetch("/api/clientes", {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) return;
    clientesCache = await res.json();

    // Filtra apenas clientes com backup habilitado para os selects
    const habilitados = clientesCache.filter(c => c.backupHabilitado);

    ["filtroCliente", "backupClienteId"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const primeiro = id === "filtroCliente"
        ? '<option value="">Todos os clientes</option>'
        : '<option value="">Selecione o cliente</option>';
      // Filtro mostra todos; modal mostra só habilitados
      const lista = id === "filtroCliente" ? clientesCache : habilitados;
      el.innerHTML = primeiro + lista.map(c =>
        `<option value="${c._id}">${c.nome}${c.backupClienteNome ? " (" + c.backupClienteNome + ")" : ""}</option>`
      ).join("");
    });

    // Renderiza tabela de clientes no painel de configuração
    renderizarClientesConfig();
  } catch (e) { console.error("Erro clientes:", e); }
}

function renderizarClientesConfig() {
  const tbody = document.getElementById("tabelaClientesConfig");
  if (!tbody) return;

  if (clientesCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum cliente cadastrado</td></tr>`;
    return;
  }

  tbody.innerHTML = clientesCache.map(c => {
    const hab = c.backupHabilitado;
    return `<tr>
      <td data-label="Cliente"><strong>${c.nome}</strong></td>
      <td data-label="Nome no Agent">
        <input type="text" class="input-agent-nome" value="${c.backupClienteNome || ""}"
          placeholder="Nome no Backup Agent (opcional)"
          data-id="${c._id}" oninput="marcarAlterado('${c._id}')">
      </td>
      <td data-label="Backup">
        <label class="toggle-wrap">
          <input type="checkbox" class="toggle-backup" data-id="${c._id}"
            ${hab ? "checked" : ""} onchange="toggleBackupCliente('${c._id}', this)">
          <span class="toggle-slider"></span>
          <span class="toggle-label">${hab ? "Habilitado" : "Desabilitado"}</span>
        </label>
      </td>
      <td data-label="Salvar">
        <button class="btn-salvar-agent" id="btn-agent-${c._id}" onclick="salvarNomeAgent('${c._id}')"
          style="display:none">Salvar</button>
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
    toast.sucesso("Nome atualizado!");
    const idx = clientesCache.findIndex(c => c._id === id);
    if (idx >= 0) clientesCache[idx].backupClienteNome = input.value.trim();
  } catch (e) { toast.erro("Erro ao salvar"); }
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
    // Atualiza resumo
    await carregarResumo();
  } catch (e) { checkbox.checked = !habilitado; toast.erro("Erro ao atualizar"); }
}

// ── Permissões de usuários (só master) ───────────────────────────────────────
async function carregarPermissoes() {
  const tbody = document.getElementById("tabelaPermissoes");
  if (!tbody) return;
  try {
    const res = await fetch("/api/backup/permissoes", {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) { tbody.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center">Acesso negado</td></tr>`; return; }
    const usuarios = await res.json();
    if (usuarios.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--text-muted)">Nenhum usuário cadastrado além do mestre.</td></tr>`;
      return;
    }
    const LABELS = { admin: "Administrador", user: "Usuário" };
    tbody.innerHTML = usuarios.map(u => `
      <tr>
        <td data-label="Nome">${u.nome}</td>
        <td data-label="Login">${u.usuario}</td>
        <td data-label="Perfil"><span class="status ${u.perfil}">${LABELS[u.perfil] || u.perfil}</span></td>
        <td data-label="Acesso Backup">
          <label class="toggle-wrap">
            <input type="checkbox" ${u.acessoBackup ? "checked" : ""}
              onchange="togglePermissaoUsuario('${u._id}', this, 'backup')">
            <span class="toggle-slider"></span>
            <span class="toggle-label">${u.acessoBackup ? "Permitido" : "Bloqueado"}</span>
          </label>
        </td>
        <td data-label="Ver Boleto">
          <label class="toggle-wrap">
            <input type="checkbox" ${u.acessoBoleto ? "checked" : ""}
              onchange="togglePermissaoUsuario('${u._id}', this, 'boleto')">
            <span class="toggle-slider"></span>
            <span class="toggle-label">${u.acessoBoleto ? "Permitido" : "Bloqueado"}</span>
          </label>
        </td>
      </tr>`).join("");
  } catch (e) { console.error("Erro permissoes:", e); }
}

async function togglePermissaoUsuario(id, checkbox, tipo = "backup") {
  const permitido = checkbox.checked;
  const label     = checkbox.parentElement.querySelector(".toggle-label");
  const url       = tipo === "boleto" ? `/api/usuarios/${id}/acesso-boleto` : `/api/usuarios/${id}/acesso-backup`;
  const body      = tipo === "boleto" ? { acessoBoleto: permitido } : { acessoBackup: permitido };
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify(body)
    });
    if (!res.ok) { checkbox.checked = !permitido; toast.erro("Erro ao atualizar"); return; }
    if (label) label.textContent = permitido ? "Permitido" : "Bloqueado";
    toast.sucesso(permitido ? "Acesso liberado!" : "Acesso revogado.");
  } catch (e) { checkbox.checked = !permitido; toast.erro("Erro ao atualizar"); }
}

// ── Histórico de backups ──────────────────────────────────────────────────────
async function carregarBackups() {
  mostrarLoading();
  try {
    const params = new URLSearchParams();
    if (filtroStatus)  params.append("status",    filtroStatus);
    if (filtroCliente) params.append("clienteId", filtroCliente);
    if (filtroDias)    params.append("dias",       filtroDias);

    const res = await fetch("/api/backup?" + params.toString(), {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) return;
    backupsCache = await res.json();
    renderizarTabela(backupsCache);
  } catch (e) { console.error("Erro backups:", e); }
  finally { esconderLoading(); }
}

function renderizarTabela(lista) {
  const tabela = document.getElementById("tabelaBackup");
  if (!tabela) return;
  if (lista.length === 0) {
    tabela.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--text-muted);">Nenhum registro encontrado.</td></tr>`;
    return;
  }
  tabela.innerHTML = lista.map(b => {
    const dt      = new Date(b.dataBackup);
    const dataStr = dt.toLocaleDateString("pt-BR");
    const horaStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const st      = b.status;
    // Nome de exibição: observação contém "Banco: X" se veio do Agent
    const obs     = b.observacao || "";
    const bancoMatch = obs.match(/Banco:\s*([^\s|]+)/);
    const banco   = bancoMatch ? `<span style="font-size:10px;color:var(--text-muted);display:block;">${bancoMatch[1]}</span>` : "";

    return `<tr>
      <td data-label="Cliente"><strong>${b.clienteId?.nome || "—"}</strong>${banco}</td>
      <td data-label="Data">${dataStr} <span style="color:var(--text-muted);font-size:12px;">${horaStr}</span></td>
      <td data-label="Status"><span class="backup-status ${st}">${labelStatus(st)}</span></td>
      <td data-label="Tamanho">${b.tamanho || "—"}</td>
      <td data-label="Destino">${b.destino || "—"}</td>
      <td data-label="Responsável">${b.usuarioId?.nome || "—"}</td>
      <td class="td-acoes-cell">
        <div class="td-acoes">
          <button class="btn-primary" style="background:#f59e0b;"
            onclick="abrirEdicao('${b._id}','${st}','${b.tamanho||""}','${b.destino||""}','${(b.observacao||"").replace(/'/g,"\\'")}')">Editar</button>
          <button class="btn-danger" onclick="excluirBackup('${b._id}')">Excluir</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function labelStatus(st) {
  return st === "ok" ? "OK" : st === "falha" ? "Falha" : "Pendente";
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function aplicarFiltros() {
  filtroStatus  = document.getElementById("filtroStatus")?.value  || "";
  filtroCliente = document.getElementById("filtroCliente")?.value || "";
  filtroDias    = document.getElementById("filtroDias")?.value    || "30";
  carregarBackups();
}

function filtrarTabela() {
  const termo = document.getElementById("campoPesquisa")?.value.toLowerCase() || "";
  document.querySelectorAll("#tabelaBackup tr").forEach(l => {
    l.style.display = l.innerText.toLowerCase().includes(termo) ? "" : "none";
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function abrirModalNovo() {
  document.getElementById("backupId").value         = "";
  document.getElementById("backupClienteId").value  = "";
  document.getElementById("backupStatus").value     = "ok";
  document.getElementById("backupTamanho").value    = "";
  document.getElementById("backupDestino").value    = "";
  document.getElementById("backupObservacao").value = "";
  document.getElementById("backupData").value       = new Date().toISOString().slice(0,16);
  document.getElementById("modalTitulo").textContent = "Registrar Backup";
  document.getElementById("modalBackup").style.display = "flex";
}

function abrirEdicao(id, status, tamanho, destino, observacao) {
  document.getElementById("backupId").value         = id;
  document.getElementById("backupStatus").value     = status;
  document.getElementById("backupTamanho").value    = tamanho;
  document.getElementById("backupDestino").value    = destino;
  document.getElementById("backupObservacao").value = observacao;
  document.getElementById("modalTitulo").textContent = "Editar Registro";
  document.getElementById("modalBackup").style.display = "flex";
}

function fecharModal() { document.getElementById("modalBackup").style.display = "none"; }

async function salvarBackup() {
  const id         = document.getElementById("backupId").value;
  const clienteId  = document.getElementById("backupClienteId").value;
  const status     = document.getElementById("backupStatus").value;
  const tamanho    = document.getElementById("backupTamanho").value;
  const destino    = document.getElementById("backupDestino").value;
  const observacao = document.getElementById("backupObservacao").value;
  const dataBackup = document.getElementById("backupData")?.value;

  if (!id && !clienteId) { toast.aviso("Selecione o cliente"); return; }
  if (!status)           { toast.aviso("Selecione o status");  return; }

  mostrarLoading();
  try {
    const url    = id ? "/api/backup/" + id : "/api/backup";
    const method = id ? "PUT" : "POST";
    const body   = id
      ? { status, tamanho, destino, observacao }
      : { clienteId, status, tamanho, destino, observacao, dataBackup };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify(body)
    });
    if (!res.ok) { const e = await res.json(); toast.erro(e.message || "Erro ao salvar"); return; }
    toast.sucesso(id ? "Registro atualizado!" : "Backup registrado!");
    fecharModal();
    await Promise.all([carregarResumo(), carregarBackups()]);
  } catch (e) { toast.erro("Erro ao salvar"); }
  finally { esconderLoading(); }
}

async function excluirBackup(id) {
  const ok = await toastConfirm("Deseja excluir este registro?");
  if (!ok) return;
  mostrarLoading();
  try {
    await fetch("/api/backup/" + id, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + getToken() }
    });
    toast.sucesso("Registro removido");
    await Promise.all([carregarResumo(), carregarBackups()]);
  } catch (e) { toast.erro("Erro ao excluir"); }
  finally { esconderLoading(); }
}

// ── Dark mode ─────────────────────────────────────────────────────────────────
function toggleDark() {
  document.body.classList.toggle("dark");
  localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light");
}
window.addEventListener("load", () => {
  if (localStorage.getItem("tema") === "dark") document.body.classList.add("dark");
});
