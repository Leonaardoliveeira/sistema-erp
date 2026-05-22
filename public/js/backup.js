// ─── utils ────────────────────────────────────────────────────────────────────
const T = () => { try { return localStorage.getItem("token") || sessionStorage.getItem("token"); } catch (e) { return ""; } };
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
let _listaBackupsAtual = []; // cache para o accordion

// ─── inicializar ──────────────────────────────────────────────────────────────
async function inicializarBackup() {
    await carregarPermissao();
    if (!perm.visualizar) { window.location.href = "dashboard.html"; return; }
    aplicarPermissaoUI();
    await Promise.all([carregarResumo(), carregarTodosClientes(), carregarBackups()]);
}

async function carregarPermissao() {
    try {
        const r = await fetch("/api/backup-permissao", {
            method: "GET",
            cache: "no-store",
            headers: {
                ...hdr(),
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        });
        if (r.ok) perm = await r.json();
    } catch (e) { }
}

function aplicarPermissaoUI() {
    const bl = document.getElementById("btnLimparHistorico");
    if (bl) bl.style.display = perm.editar ? "" : "none";

    const th = document.getElementById("thAcoes");
    if (th) th.style.display = perm.editar ? "" : "none";

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

        const opsFiltro = '<option value="">Todos os clientes</option>'
            + monitorados.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
        const elFiltro = document.getElementById("filtroCliente");
        if (elFiltro) elFiltro.innerHTML = opsFiltro;

        if (perm.editar) renderizarGerenciar(todosClientes);
    } catch (e) { console.error(e); }
}

// ─── gerenciar clientes monitorados ──────────────────────────────────────────
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

async function toggleSuspensaoCliente(id, suspender, btnEl) {
    const msg = suspender
        ? "Confirmar SUSPENSÃO do backup para este cliente?"
        : "Confirmar REATIVAÇÃO do backup?";
    
    const textoBotao = suspender ? "Suspender" : "Reativar";

    if (!await toastConfirm(msg, textoBotao)) return;
    mostrarLoading();
    try {
        const r = await fetch(`/api/clientes/${id}/suspender-backup`, {
            method: "PUT", headers: hdr(), body: JSON.stringify({ suspender })
        });
        if (!r.ok) { toast.erro("Erro ao alterar suspensão"); return; }
        toast.sucesso(suspender ? "⛔ Backup suspenso!" : "✅ Backup reativado!");
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
        _listaBackupsAtual = await r.json();
        renderizarTabelaAcordeon(_listaBackupsAtual);
    } catch (e) { } finally { esconderLoading(); }
}

// ─── ACCORDION: histórico agrupado por cliente ────────────────────────────────
function renderizarTabelaAcordeon(lista) {
    const tb = document.getElementById("tabelaBackup");
    if (!tb) return;

    if (!lista.length) {
        tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--text-muted);">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    // Agrupa por cliente
    const grupos = {};
    lista.forEach(b => {
        const clienteId = b.clienteId?._id || b.clienteId || "sem-cliente";
        const clienteNome = b.clienteId?.nome || "Cliente desconhecido";
        if (!grupos[clienteId]) grupos[clienteId] = { nome: clienteNome, registros: [] };
        grupos[clienteId].registros.push(b);
    });

    // Ordena grupos por nome
    const gruposOrdenados = Object.entries(grupos).sort((a, b) =>
        a[1].nome.localeCompare(b[1].nome, "pt-BR")
    );

    let html = "";
    gruposOrdenados.forEach(([clienteId, grupo]) => {
        const total = grupo.registros.length;
        const qtdOk       = grupo.registros.filter(b => b.status === "ok").length;
        const qtdFalha    = grupo.registros.filter(b => b.status === "falha").length;
        const qtdPendente = grupo.registros.filter(b => b.status === "pendente").length;

        const badges = [];
        if (qtdOk > 0)       badges.push(`<span class="backup-status ok"       style="font-size:11px;">✅ ${qtdOk} OK</span>`);
        if (qtdFalha > 0)    badges.push(`<span class="backup-status falha"    style="font-size:11px;">❌ ${qtdFalha} Falha${qtdFalha !== 1 ? "s" : ""}</span>`);
        if (qtdPendente > 0) badges.push(`<span class="backup-status pendente" style="font-size:11px;">⏳ ${qtdPendente} Pendente${qtdPendente !== 1 ? "s" : ""}</span>`);

        // Linha de cabeçalho do grupo (clicável)
        html += `<tr class="bkp-grupo-header" onclick="toggleGrupo('grp-${clienteId}')">
          <td colspan="${perm.editar ? 7 : 6}" style="padding:10px 14px;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <i data-lucide="chevron-right" style="width:14px;height:14px;transition:transform .2s;flex-shrink:0;" id="icon-grp-${clienteId}"></i>
              <strong style="font-size:13px;">${grupo.nome}</strong>
              <span style="font-size:11px;color:var(--text-muted);">${total} registro${total !== 1 ? "s" : ""}</span>
              ${badges.join("")}
            </div>
          </td>
        </tr>`;

        // Linhas filhas (ocultas por padrão)
        html += `<tr id="grp-${clienteId}" class="bkp-grupo-body" style="display:none;">
          <td colspan="${perm.editar ? 7 : 6}" class="bkp-grupo-content">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr class="bkp-subheader">
                  <th style="padding:7px 14px 7px 36px;text-align:left;font-size:11px;color:var(--text-muted);font-weight:600;">Data / Hora</th>
                  <th style="padding:7px 14px;text-align:left;font-size:11px;color:var(--text-muted);font-weight:600;">Banco</th>
                  <th style="padding:7px 14px;text-align:left;font-size:11px;color:var(--text-muted);font-weight:600;">Status</th>
                  <th style="padding:7px 14px;text-align:left;font-size:11px;color:var(--text-muted);font-weight:600;">Tamanho</th>
                  <th style="padding:7px 14px;text-align:left;font-size:11px;color:var(--text-muted);font-weight:600;">Destino</th>
                  ${perm.editar ? '<th style="padding:7px 14px;text-align:left;font-size:11px;color:var(--text-muted);font-weight:600;">Ações</th>' : ""}
                </tr>
              </thead>
              <tbody>
                ${grupo.registros.map(b => renderizarLinhaBackup(b)).join("")}
              </tbody>
            </table>
          </td>
        </tr>`;
    });

    tb.innerHTML = html;
    lucide.createIcons();
}

function renderizarLinhaBackup(b) {
    const dt = new Date(b.dataBackup);
    const st = b.status;
    const obs = b.observacao || "";
    const bancoM = obs.match(/Banco:\s*([^|]+)/i);
    const banco = bancoM ? bancoM[1].trim() : (b.destino ? b.destino.split("/").pop() : "—");

    const acaoCol = perm.editar
        ? `<td style="padding:7px 14px;"><div style="display:flex;gap:6px;">
             <button class="btn-danger" style="font-size:11px;padding:4px 9px;" onclick="excluirBackup('${b._id}')">Excluir</button>
           </div></td>`
        : "";

    return `<tr class="bkp-linha-backup">
      <td style="padding:8px 14px 8px 36px;font-size:12px;">
        ${dt.toLocaleDateString("pt-BR")}
        <span style="color:var(--text-muted);font-size:11px;">${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      </td>
      <td style="padding:8px 14px;"><code style="font-size:11px;color:var(--text-muted);">${banco}</code></td>
      <td style="padding:8px 14px;"><span class="backup-status ${st}">${{ ok: "✅ OK", falha: "❌ Falha", pendente: "⏳ Pendente" }[st] || st}</span></td>
      <td style="padding:8px 14px;font-size:12px;">${b.tamanho || "—"}</td>
      <td style="padding:8px 14px;font-size:12px;">${b.destino || "—"}</td>
      ${acaoCol}
    </tr>`;
}

function toggleGrupo(id) {
    const corpo = document.getElementById(id);
    const icon = document.getElementById("icon-" + id);
    if (!corpo) return;
    const aberto = corpo.style.display !== "none";
    corpo.style.display = aberto ? "none" : "";
    if (icon) icon.style.transform = aberto ? "" : "rotate(90deg)";
}

function aplicarFiltros() {
    filtroStatus = document.getElementById("filtroStatus")?.value || "";
    filtroCliente = document.getElementById("filtroCliente")?.value || "";
    filtroDias = document.getElementById("filtroDias")?.value || "30";
    carregarBackups();
}

function filtrarTabela() {
    const t = document.getElementById("campoPesquisa")?.value.toLowerCase() || "";
    // Filtra nos grupos: mostra/oculta grupos inteiros
    document.querySelectorAll("#tabelaBackup .bkp-grupo-header").forEach(header => {
        const texto = header.innerText.toLowerCase();
        const grpId = header.nextElementSibling?.id;
        const corpo = grpId ? document.getElementById(grpId) : null;
        const visivel = texto.includes(t);
        header.style.display = visivel ? "" : "none";
        if (corpo) corpo.style.display = visivel ? corpo.style.display : "none";
    });
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
    try { localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light"); } catch (e) { }
}
window.addEventListener("load", () => {
    let tema;
    try { tema = localStorage.getItem("tema"); } catch (e) { }
    if (tema === "dark") document.body.classList.add("dark");
});