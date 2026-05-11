// ─── utils ────────────────────────────────────────────────────────────────────
const T = () => localStorage.getItem("token");
const hdr = () => ({ "Authorization": "Bearer " + T(), "Content-Type": "application/json" });
function mostrarLoading() { const e = document.getElementById("loading"); if (e) e.style.display = "flex"; }
function esconderLoading() { const e = document.getElementById("loading"); if (e) e.style.display = "none"; }

// ─── estado ───────────────────────────────────────────────────────────────────
let perm = { visualizar: false, editar: false };
let todosClientes = [];
let monitorados = [];
let filtroStatus = "";
let filtroCliente = "";
let filtroDias = "30";

// ─── inicializar ──────────────────────────────────────────────────────────────
async function inicializarBackup() {
    await carregarPermissao();
    if (!perm.visualizar) { window.location.href = "dashboard.html"; return; }
    aplicarPermissaoUI();
    await Promise.all([carregarResumo(), carregarTodosClientes(), carregarBackups()]);
}

async function carregarPermissao() {
    try {
        const r = await fetch("/api/backup-permissao", { headers: hdr() });
        if (r.ok) perm = await r.json();
    } catch (e) { }
}

function aplicarPermissaoUI() {
    // Limpar histórico — visível apenas para quem pode editar
    const bl = document.getElementById("btnLimparHistorico");
    if (bl) bl.style.display = perm.editar ? "" : "none";

    // Coluna ações na tabela de histórico
    const th = document.getElementById("thAcoes");
    if (th) th.style.display = perm.editar ? "" : "none";

    // Seção gerenciar (aberta via scroll/âncora se necessário)
    const sg = document.getElementById("secaoGerenciar");
    if (sg) sg.style.display = perm.editar ? "" : "none";
}

// ─── cards resumo ─────────────────────────────────────────────────────────────
async function carregarResumo() {
    try {
        const r = await fetch("/api/backup/resumo", { headers: hdr() });
        if (!r.ok) return;
        const d = await r.json();
        document.getElementById("totalClientes").textContent = d.totalClientes ?? "—";
        document.getElementById("comBackup").textContent = d.comBackup ?? "—";
        document.getElementById("semBackup").textContent = d.semBackup ?? "—";
        document.getElementById("totalSuspensos").textContent = d.totalSuspensos ?? "—";
        if (d.semBackup > 0)
            setTimeout(() => toast.aviso(d.semBackup === 1
                ? "⚠️ 1 cliente sem backup hoje!"
                : `⚠️ ${d.semBackup} clientes sem backup hoje!`, 6000), 800);
        renderizarSemBackup(d.semBackupLista || []);
    } catch (e) { console.error(e); }
}

function renderizarSemBackup(lista) {
    const el = document.getElementById("listaSemBackup");
    if (!el) return;
    el.innerHTML = lista.length === 0
        ? `<p class="backup-vazio">✅ Todos os clientes receberam backup hoje!</p>`
        : lista.map(c => `
            <div class="sem-backup-item">
              <span class="sem-backup-nome">${c.nome}</span>
              <span class="sem-backup-badge">Sem backup hoje</span>
            </div>`).join("");
}

// ─── carregar todos clientes ──────────────────────────────────────────────────
async function carregarTodosClientes() {
    try {
        const r = await fetch("/api/clientes-backup", { headers: hdr() });
        if (!r.ok) return;
        todosClientes = await r.json();
        monitorados = todosClientes.filter(c => c.monitoradoBackup);

        // Popula select de filtro
        const opsFiltro = '<option value="">Todos os clientes</option>'
            + monitorados.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
        const elFiltro = document.getElementById("filtroCliente");
        if (elFiltro) elFiltro.innerHTML = opsFiltro;

        if (perm.editar) renderizarGerenciar(todosClientes);
    } catch (e) { console.error(e); }
}

// ─── gerenciar clientes monitorados ──────────────────────────────────────────
// A seção fica visível para editores — o botão "Gerenciar Clientes" do topbar
// foi removido conforme solicitado. A seção aparece naturalmente na página.
function renderizarGerenciar(lista) {
    const tbody = document.getElementById("tabelaGerenciar");
    if (!tbody) return;
    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum cliente cadastrado.</td></tr>`;
        return;
    }
    tbody.innerHTML = lista.map(c => {
        const id = c._id.toString();
        const chkMon = c.monitoradoBackup ? "checked" : "";
        const susp = c.suspenderBackup;
        const btnSusp = susp
            ? `<button class="bkp-btn-suspensao bkp-btn-reativar"  onclick="toggleSuspensaoCliente('${id}', false, this)">✅ Reativar</button>`
            : `<button class="bkp-btn-suspensao bkp-btn-suspender" onclick="toggleSuspensaoCliente('${id}', true,  this)">⛔ Suspender</button>`;
        return `<tr>
          <td data-label="Cliente"><strong>${c.nome}</strong></td>
          <td data-label="Monitorar">
            <label class="toggle-switch">
              <input type="checkbox" ${chkMon} onchange="toggleMonitorado('${id}',this.checked,this)">
              <span class="toggle-slider"></span>
            </label>
          </td>
          <td data-label="Suspensão">${btnSusp}</td>
          <td data-label="ObjectID" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <code style="font-size:11px;color:var(--text-muted);word-break:break-all;">${id}</code>
            <button class="bkp-btn-copiar" onclick="copiarId('${id}',this)" title="Copiar ObjectID">
              <i data-lucide="copy" style="width:12px;height:12px;"></i>
            </button>
          </td>
        </tr>`;
    }).join("");
    lucide.createIcons();
}

async function toggleMonitorado(id, monitorado, el) {
    try {
        const r = await fetch(`/api/clientes/${id}/monitorado-backup`, {
            method: "PUT", headers: hdr(), body: JSON.stringify({ monitorado })
        });
        if (!r.ok) { toast.erro("Erro ao atualizar"); el.checked = !monitorado; return; }
        toast.sucesso(monitorado ? "Cliente adicionado ao monitoramento!" : "Cliente removido do monitoramento!");
        await Promise.all([carregarResumo(), carregarTodosClientes(), carregarBackups()]);
    } catch (e) { toast.erro("Erro"); el.checked = !monitorado; }
}

// ─── suspender / reativar backup de um cliente ────────────────────────────────
// Usado tanto na tabela de Gerenciar quanto no botão inline da tabela de histórico
async function toggleSuspensaoCliente(id, suspender, btnEl) {
    const acao = suspender ? "SUSPENDER" : "REATIVAR";
    const msg = suspender
        ? "Confirmar SUSPENSÃO do backup para este cliente?"
        : "Confirmar REATIVAÇÃO do backup?";
    if (!await toastConfirm(msg)) return;

    mostrarLoading();
    try {
        const r = await fetch(`/api/clientes/${id}/suspender-backup`, {
            method: "PUT", headers: hdr(), body: JSON.stringify({ suspender })
        });
        if (!r.ok) { toast.erro("Erro ao alterar suspensão"); return; }
        toast.sucesso(suspender ? "⛔ Backup suspenso!" : "✅ Backup reativado!");
        // Recarrega tudo para refletir o novo estado em cards, tabela e gerenciar
        await Promise.all([carregarResumo(), carregarTodosClientes(), carregarBackups()]);
    } catch (e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

function copiarId(id, btn) {
    const orig = btn.innerHTML;
    const ok = () => {
        toast.sucesso("ObjectID copiado!");
        btn.innerHTML = `<i data-lucide="check" style="width:12px;height:12px;color:var(--green);"></i>`;
        lucide.createIcons();
        setTimeout(() => { btn.innerHTML = orig; lucide.createIcons(); }, 2000);
    };
    if (navigator.clipboard) { navigator.clipboard.writeText(id).then(ok).catch(() => { }); return; }
    const t = document.createElement("textarea");
    t.value = id; document.body.appendChild(t); t.select();
    document.execCommand("copy"); document.body.removeChild(t); ok();
}

// ─── backups histórico ────────────────────────────────────────────────────────
async function carregarBackups() {
    mostrarLoading();
    try {
        const p = new URLSearchParams();
        if (filtroStatus) p.append("status", filtroStatus);
        if (filtroCliente) p.append("clienteId", filtroCliente);
        if (filtroDias) p.append("dias", filtroDias);
        const r = await fetch("/api/backup?" + p.toString(), { headers: hdr() });
        if (!r.ok) return;
        renderizarTabela(await r.json());
    } catch (e) { } finally { esconderLoading(); }
}

function renderizarTabela(lista) {
    const tb = document.getElementById("tabelaBackup");
    if (!tb) return;
    if (!lista.length) {
        tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--text-muted);">Nenhum registro encontrado.</td></tr>`;
        return;
    }
    tb.innerHTML = lista.map(b => {
        const dt = new Date(b.dataBackup);
        const st = b.status;

        // Extrai o nome do banco da observação enviada pelo Backup Agent
        // Formato esperado: "Banco: gestores | Servidor: localhost"
        const obs = b.observacao || "";
        const bancoM = obs.match(/Banco:\s*([^|]+)/i);
        const banco = bancoM ? bancoM[1].trim() : (b.destino ? b.destino.split("/").pop() : "—");

        const acaoCol = perm.editar
            ? `<td class="td-acoes-cell"><div class="td-acoes">
                 <button class="btn-danger" style="font-size:11px;padding:5px 10px;" onclick="excluirBackup('${b._id}')">Excluir</button>
               </div></td>`
            : "";

        return `<tr>
          <td data-label="Cliente"><strong>${b.clienteId?.nome || "—"}</strong></td>
          <td data-label="Data">${dt.toLocaleDateString("pt-BR")} <span style="color:var(--text-muted);font-size:12px;">${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></td>
          <td data-label="Banco"><code style="font-size:12px;color:var(--text-muted);">${banco}</code></td>
          <td data-label="Status"><span class="backup-status ${st}">${{ ok: "OK", falha: "Falha", pendente: "Pendente" }[st] || st}</span></td>
          <td data-label="Tamanho">${b.tamanho || "—"}</td>
          <td data-label="Destino">${b.destino || "—"}</td>
          ${acaoCol}
        </tr>`;
    }).join("");
}

function aplicarFiltros() {
    filtroStatus = document.getElementById("filtroStatus")?.value || "";
    filtroCliente = document.getElementById("filtroCliente")?.value || "";
    filtroDias = document.getElementById("filtroDias")?.value || "30";
    carregarBackups();
}

function filtrarTabela() {
    const t = document.getElementById("campoPesquisa")?.value.toLowerCase() || "";
    document.querySelectorAll("#tabelaBackup tr").forEach(l =>
        l.style.display = l.innerText.toLowerCase().includes(t) ? "" : "none"
    );
}

async function limparHistorico() {
    if (!perm.editar) return;
    const ok = await toastConfirm("Limpar TODO o histórico de backups visível? Esta ação não pode ser desfeita.");
    if (!ok) return;
    mostrarLoading();
    try {
        const p = new URLSearchParams();
        if (filtroCliente) p.append("clienteId", filtroCliente);
        if (filtroDias) p.append("dias", filtroDias);
        const r = await fetch("/api/backup?" + p.toString(), { method: "DELETE", headers: hdr() });
        if (!r.ok) { toast.erro("Erro ao limpar"); return; }
        const d = await r.json();
        toast.sucesso(`${d.removidos} registros removidos!`);
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch (e) { toast.erro("Erro ao limpar"); } finally { esconderLoading(); }
}

// ─── modal edição ─────────────────────────────────────────────────────────────
function abrirEdicao(id, status, tamanho, destino, obs) {
    document.getElementById("backupId").value = id;
    document.getElementById("backupStatus").value = status;
    document.getElementById("backupTamanho").value = tamanho;
    document.getElementById("backupDestino").value = destino;
    document.getElementById("backupObservacao").value = obs;
    document.getElementById("modalBackup").style.display = "flex";
}
function fecharModal() { document.getElementById("modalBackup").style.display = "none"; }

async function salvarEdicaoBackup() {
    const id = document.getElementById("backupId").value;
    const dados = {
        status: document.getElementById("backupStatus").value,
        tamanho: document.getElementById("backupTamanho").value,
        destino: document.getElementById("backupDestino").value,
        observacao: document.getElementById("backupObservacao").value,
    };
    if (!dados.status) { toast.aviso("Selecione o status"); return; }
    mostrarLoading();
    try {
        const r = await fetch("/api/backup/" + id, { method: "PUT", headers: hdr(), body: JSON.stringify(dados) });
        if (!r.ok) { toast.erro((await r.json()).message || "Erro"); return; }
        toast.sucesso("Registro atualizado!");
        fecharModal();
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch (e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

async function excluirBackup(id) {
    if (!await toastConfirm("Deseja excluir este registro?")) return;
    mostrarLoading();
    try {
        await fetch("/api/backup/" + id, { method: "DELETE", headers: hdr() });
        toast.sucesso("Removido!");
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch (e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

// ─── dark mode ────────────────────────────────────────────────────────────────
function toggleDark() {
    document.body.classList.toggle("dark");
    localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light");
}
window.addEventListener("load", () => {
    if (localStorage.getItem("tema") === "dark") document.body.classList.add("dark");
});