// ─── utils ────────────────────────────────────────────────────────────────────
const T   = () => localStorage.getItem("token");
const hdr = () => ({ "Authorization": "Bearer " + T(), "Content-Type": "application/json" });
function mostrarLoading()  { const e = document.getElementById("loading"); if(e) e.style.display="flex"; }
function esconderLoading() { const e = document.getElementById("loading"); if(e) e.style.display="none"; }

// ─── estado ───────────────────────────────────────────────────────────────────
let perm        = { visualizar: false, editar: false };
let todosClientes = [];         // todos (para gerenciar)
let monitorados   = [];         // apenas monitoradoBackup=true (para filtros/financeiro)
let filtroStatus  = "";
let filtroCliente = "";
let filtroDias    = "30";
let clienteFinanceiroAtual = null; // { id, suspenderBackup }

// ─── inicializar ──────────────────────────────────────────────────────────────
async function inicializarBackup() {
    await carregarPermissao();
    if (!perm.visualizar) { window.location.href = "dashboard.html"; return; }
    aplicarPermissaoUI();
    await Promise.all([carregarResumo(), carregarTodosClientes(), carregarBackups()]);
    if (perm.editar) verificarAtrasadosGlobal();
}

async function carregarPermissao() {
    try {
        const r = await fetch("/api/backup-permissao", { headers: hdr() });
        if (r.ok) perm = await r.json();
    } catch(e) {}
}

function aplicarPermissaoUI() {
    // Botões no topbar
    const tb = document.getElementById("topbarBtns");
    if (tb && perm.editar) {
        tb.innerHTML = `
          <button class="btn-secondary" style="font-size:12px;padding:7px 14px;" onclick="toggleSecaoGerenciar()">
            <i data-lucide="settings" style="width:13px;height:13px;"></i> Gerenciar Clientes
          </button>`;
        lucide.createIcons();
    }
    // Limpar histórico
    const bl = document.getElementById("btnLimparHistorico");
    if (bl) bl.style.display = perm.editar ? "" : "none";
    // Coluna ações
    const th = document.getElementById("thAcoes");
    if (th) th.style.display = perm.editar ? "" : "none";
    // Seções extras
    const sg = document.getElementById("secaoGerenciar");
    if (sg) sg.style.display = perm.editar ? "" : "none";
    const sf = document.getElementById("secaoFinanceiro");
    if (sf) sf.style.display = perm.editar ? "" : "none";
}

// ─── cards resumo ─────────────────────────────────────────────────────────────
async function carregarResumo() {
    try {
        const r = await fetch("/api/backup/resumo", { headers: hdr() });
        if (!r.ok) return;
        const d = await r.json();
        document.getElementById("totalClientes").textContent  = d.totalClientes  ?? "—";
        document.getElementById("comBackup").textContent      = d.comBackup      ?? "—";
        document.getElementById("semBackup").textContent      = d.semBackup      ?? "—";
        document.getElementById("totalSuspensos").textContent = d.totalSuspensos ?? "—";
        if (d.semBackup > 0)
            setTimeout(() => toast.aviso(d.semBackup === 1
                ? "⚠️ 1 cliente sem backup hoje!"
                : `⚠️ ${d.semBackup} clientes sem backup hoje!`, 6000), 800);
        renderizarSemBackup(d.semBackupLista || []);
    } catch(e) { console.error(e); }
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

// ─── carregar todos clientes (para gerenciar + selects) ───────────────────────
async function carregarTodosClientes() {
    try {
        const r = await fetch("/api/clientes-backup", { headers: hdr() });
        if (!r.ok) return;
        todosClientes = await r.json();
        monitorados   = todosClientes.filter(c => c.monitoradoBackup);

        // Popula selects de filtro e financeiro
        const opsFiltro = '<option value="">Todos os clientes</option>'
            + monitorados.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
        const elFiltro = document.getElementById("filtroCliente");
        if (elFiltro) elFiltro.innerHTML = opsFiltro;

        const opsFin = '<option value="">Selecione o cliente</option>'
            + monitorados.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
        ["finClienteSelect","gerarClienteId"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = opsFin;
        });

        if (perm.editar) renderizarGerenciar(todosClientes);
    } catch(e) { console.error(e); }
}

// ─── gerenciar clientes monitorados ──────────────────────────────────────────
function toggleSecaoGerenciar() {
    const s = document.getElementById("secaoGerenciar");
    if (!s) return;
    const visivel = s.style.display !== "none";
    s.style.display = visivel ? "none" : "";
    if (!visivel) s.scrollIntoView({ behavior: "smooth" });
}

function renderizarGerenciar(lista) {
    const tbody = document.getElementById("tabelaGerenciar");
    if (!tbody) return;
    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum cliente cadastrado.</td></tr>`;
        return;
    }
    tbody.innerHTML = lista.map(c => {
        const id  = c._id.toString();
        const chk = c.monitoradoBackup ? "checked" : "";
        return `<tr>
          <td data-label="Cliente"><strong>${c.nome}</strong></td>
          <td data-label="Monitorar">
            <label class="toggle-switch">
              <input type="checkbox" ${chk} onchange="toggleMonitorado('${id}',this.checked,this)">
              <span class="toggle-slider"></span>
            </label>
          </td>
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
    } catch(e) { toast.erro("Erro"); el.checked = !monitorado; }
}

function copiarId(id, btn) {
    const orig = btn.innerHTML;
    const ok   = () => {
        toast.sucesso("ObjectID copiado!");
        btn.innerHTML = `<i data-lucide="check" style="width:12px;height:12px;color:var(--green);"></i>`;
        lucide.createIcons();
        setTimeout(() => { btn.innerHTML = orig; lucide.createIcons(); }, 2000);
    };
    if (navigator.clipboard) { navigator.clipboard.writeText(id).then(ok).catch(()=>{}); return; }
    const t = document.createElement("textarea");
    t.value = id; document.body.appendChild(t); t.select();
    document.execCommand("copy"); document.body.removeChild(t); ok();
}

// ─── backups histórico ────────────────────────────────────────────────────────
async function carregarBackups() {
    mostrarLoading();
    try {
        const p = new URLSearchParams();
        if (filtroStatus)  p.append("status",    filtroStatus);
        if (filtroCliente) p.append("clienteId", filtroCliente);
        if (filtroDias)    p.append("dias",       filtroDias);
        const r = await fetch("/api/backup?" + p.toString(), { headers: hdr() });
        if (!r.ok) return;
        renderizarTabela(await r.json());
    } catch(e) {} finally { esconderLoading(); }
}

function renderizarTabela(lista) {
    const tb = document.getElementById("tabelaBackup");
    if (!tb) return;
    if (!lista.length) {
        tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--text-muted);">Nenhum registro encontrado.</td></tr>`;
        return;
    }
    tb.innerHTML = lista.map(b => {
        const dt   = new Date(b.dataBackup);
        const st   = b.status;
        const acao = perm.editar
            ? `<td class="td-acoes-cell"><div class="td-acoes">
                 <button class="btn-primary" style="background:#f59e0b;" onclick="abrirEdicao('${b._id}','${st}','${b.tamanho||""}','${b.destino||""}','${(b.observacao||"").replace(/'/g,"\\'")}')">Editar</button>
                 <button class="btn-danger" onclick="excluirBackup('${b._id}')">Excluir</button>
               </div></td>`
            : "";
        return `<tr>
          <td data-label="Cliente"><strong>${b.clienteId?.nome||"-"}</strong></td>
          <td data-label="Data">${dt.toLocaleDateString("pt-BR")} <span style="color:var(--text-muted);font-size:12px;">${dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></td>
          <td data-label="Status"><span class="backup-status ${st}">${{ok:"OK",falha:"Falha",pendente:"Pendente"}[st]}</span></td>
          <td data-label="Tamanho">${b.tamanho||"-"}</td>
          <td data-label="Destino">${b.destino||"-"}</td>
          <td data-label="Responsável">${b.usuarioId?.nome||"-"}</td>
          ${acao}
        </tr>`;
    }).join("");
}

function aplicarFiltros() {
    filtroStatus  = document.getElementById("filtroStatus")?.value  || "";
    filtroCliente = document.getElementById("filtroCliente")?.value || "";
    filtroDias    = document.getElementById("filtroDias")?.value    || "30";
    carregarBackups();
}

function filtrarTabela() {
    const t = document.getElementById("campoPesquisa")?.value.toLowerCase()||"";
    document.querySelectorAll("#tabelaBackup tr").forEach(l => l.style.display = l.innerText.toLowerCase().includes(t)?"":"none");
}

async function limparHistorico() {
    if (!perm.editar) return;
    const ok = await toastConfirm("Limpar TODO o histórico de backups visível? Esta ação não pode ser desfeita.");
    if (!ok) return;
    mostrarLoading();
    try {
        const p = new URLSearchParams();
        if (filtroCliente) p.append("clienteId", filtroCliente);
        if (filtroDias)    p.append("dias", filtroDias);
        const r = await fetch("/api/backup?" + p.toString(), { method: "DELETE", headers: hdr() });
        if (!r.ok) { toast.erro("Erro ao limpar"); return; }
        const d = await r.json();
        toast.sucesso(`${d.removidos} registros removidos!`);
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch(e) { toast.erro("Erro ao limpar"); } finally { esconderLoading(); }
}

// ─── modal edição ─────────────────────────────────────────────────────────────
function abrirEdicao(id, status, tamanho, destino, obs) {
    document.getElementById("backupId").value         = id;
    document.getElementById("backupStatus").value     = status;
    document.getElementById("backupTamanho").value    = tamanho;
    document.getElementById("backupDestino").value    = destino;
    document.getElementById("backupObservacao").value = obs;
    document.getElementById("modalBackup").style.display = "flex";
}
function fecharModal() { document.getElementById("modalBackup").style.display = "none"; }

async function salvarEdicaoBackup() {
    const id  = document.getElementById("backupId").value;
    const dados = {
        status:     document.getElementById("backupStatus").value,
        tamanho:    document.getElementById("backupTamanho").value,
        destino:    document.getElementById("backupDestino").value,
        observacao: document.getElementById("backupObservacao").value,
    };
    if (!dados.status) { toast.aviso("Selecione o status"); return; }
    mostrarLoading();
    try {
        const r = await fetch("/api/backup/" + id, { method:"PUT", headers: hdr(), body: JSON.stringify(dados) });
        if (!r.ok) { toast.erro((await r.json()).message||"Erro"); return; }
        toast.sucesso("Registro atualizado!");
        fecharModal();
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

async function excluirBackup(id) {
    if (!await toastConfirm("Deseja excluir este registro?")) return;
    mostrarLoading();
    try {
        await fetch("/api/backup/" + id, { method:"DELETE", headers: hdr() });
        toast.sucesso("Removido!");
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

// ─── financeiro / boletos ─────────────────────────────────────────────────────
async function verificarAtrasadosGlobal() {
    try {
        const r = await fetch("/api/boletos-atrasados", { headers: hdr() });
        if (!r.ok) return;
        const lista = await r.json();
        if (!lista.length) return;
        const msg = lista.map(x => `${x.nome}: ${x.qtd} boleto(s)`).join(" | ");
        setTimeout(() => toast.aviso(`🔴 Boletos em atraso — ${msg}`, 9000), 1500);
        // Recarrega cards pois suspensões podem ter mudado
        carregarResumo();
    } catch(e) {}
}

async function carregarBoletos() {
    const id = document.getElementById("finClienteSelect")?.value;
    const wrapEl  = document.getElementById("wrapBoletos");
    const vazioEl = document.getElementById("boletosVazio");
    const alertaEl= document.getElementById("alertaBoletos");
    const suspEl  = document.getElementById("rowSuspensao");

    if (!id) {
        if(wrapEl)  wrapEl.style.display   = "none";
        if(vazioEl) vazioEl.style.display  = "";
        if(alertaEl)alertaEl.style.display = "none";
        if(suspEl)  suspEl.style.display   = "none";
        return;
    }
    mostrarLoading();
    try {
        const [rBol, rCli] = await Promise.all([
            fetch(`/api/boletos/${id}`,  { headers: hdr() }),
            fetch(`/api/clientes/${id}`, { headers: hdr() })
        ]);
        const boletos = rBol.ok  ? await rBol.json()  : [];
        const cliente = rCli.ok  ? await rCli.json()  : null;
        clienteFinanceiroAtual = cliente ? { id: cliente._id, suspenderBackup: cliente.suspenderBackup } : null;

        if (!boletos.length) {
            if(wrapEl)  wrapEl.style.display   = "none";
            if(vazioEl){ vazioEl.style.display = ""; vazioEl.textContent = "Nenhum boleto gerado para este cliente."; }
            if(alertaEl)alertaEl.style.display = "none";
            if(suspEl)  suspEl.style.display   = "none";
            return;
        }
        if(wrapEl)  wrapEl.style.display   = "";
        if(vazioEl) vazioEl.style.display  = "none";

        const atrasados = boletos.filter(b => b.status === "atrasado");
        if (alertaEl) {
            alertaEl.style.display = atrasados.length ? "flex" : "none";
            document.getElementById("alertaBoletosMsg").textContent =
                atrasados.length ? `⚠️ ${atrasados.length} boleto(s) em atraso!` : "";
        }

        if (suspEl && cliente) {
            suspEl.style.display = "";
            const msgEl = document.getElementById("msgSuspensao");
            const btnEl = document.getElementById("btnToggleSuspensao");
            if (cliente.suspenderBackup) {
                msgEl.textContent   = "Backup SUSPENSO para este cliente.";
                btnEl.textContent   = "✅ Reativar Backup";
                btnEl.className     = "bkp-btn-suspensao bkp-btn-reativar";
            } else {
                msgEl.textContent   = "Backup ATIVO para este cliente.";
                btnEl.textContent   = "⛔ Suspender Backup";
                btnEl.className     = "bkp-btn-suspensao bkp-btn-suspender";
            }
        }
        renderizarBoletos(boletos);
    } catch(e) { toast.erro("Erro ao carregar boletos"); } finally { esconderLoading(); }
}

function renderizarBoletos(lista) {
    const tbody = document.getElementById("tabelaBoletos");
    if (!tbody) return;
    const labels = { aberto:"Aberto", pago:"Pago", atrasado:"Atrasado" };
    const cls    = { aberto:"pendente", pago:"ok", atrasado:"falha" };
    tbody.innerHTML = lista.map(b => {
        const venc  = new Date(b.vencimento).toLocaleDateString("pt-BR");
        const pagoE = b.pago_em ? new Date(b.pago_em).toLocaleDateString("pt-BR") : "—";
        const valor = parseFloat(b.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
        const btn   = b.status !== "pago"
            ? `<button class="bkp-btn-baixa" onclick="darBaixa('${b._id}')">✔ Dar Baixa</button>`
            : `<span style="color:var(--text-muted);font-size:12px;">—</span>`;
        return `<tr>
          <td data-label="Parcela">${b.parcela}/${b.totalParcelas||12}</td>
          <td data-label="Vencimento">${venc}</td>
          <td data-label="Valor">${valor}</td>
          <td data-label="Status"><span class="backup-status ${cls[b.status]}">${labels[b.status]}</span></td>
          <td data-label="Pago em">${pagoE}</td>
          <td class="td-acoes-cell">${btn}</td>
        </tr>`;
    }).join("");
}

async function darBaixa(id) {
    if (!await toastConfirm("Confirmar baixa neste boleto?")) return;
    mostrarLoading();
    try {
        const r = await fetch(`/api/boletos/${id}/baixa`, { method:"PUT", headers: hdr() });
        if (!r.ok) { toast.erro("Erro ao dar baixa"); return; }
        const d = await r.json();
        toast.sucesso(d.backupReativado ? "Baixa confirmada! ✅ Backup reativado automaticamente." : "Baixa confirmada!");
        await carregarBoletos();
        await Promise.all([carregarResumo(), verificarAtrasadosGlobal()]);
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

async function toggleSuspensao() {
    if (!clienteFinanceiroAtual) return;
    const suspender = !clienteFinanceiroAtual.suspenderBackup;
    if (!await toastConfirm(suspender ? "Confirmar SUSPENSÃO do backup para este cliente?" : "Confirmar REATIVAÇÃO do backup?")) return;
    mostrarLoading();
    try {
        const r = await fetch(`/api/clientes/${clienteFinanceiroAtual.id}/suspender-backup`, {
            method:"PUT", headers: hdr(), body: JSON.stringify({ suspender })
        });
        if (!r.ok) { toast.erro("Erro ao alterar suspensão"); return; }
        toast.sucesso(suspender ? "Backup suspenso!" : "Backup reativado!");
        await carregarBoletos(); await carregarResumo();
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

// ─── modal gerar boletos ──────────────────────────────────────────────────────
function abrirModalGerar() {
    const finId = document.getElementById("finClienteSelect")?.value;
    const sel   = document.getElementById("gerarClienteId");
    if (sel && finId) sel.value = finId;
    const dtEl = document.getElementById("gerarDataInicio");
    if (dtEl) dtEl.value = new Date().toISOString().split("T")[0];
    document.getElementById("modalGerar").style.display = "flex";
}
function fecharModalGerar() { document.getElementById("modalGerar").style.display = "none"; }

async function confirmarGerarBoletos() {
    const clienteId   = document.getElementById("gerarClienteId").value;
    const valorMensal = document.getElementById("gerarValor").value;
    const dataInicio  = document.getElementById("gerarDataInicio").value;
    if (!clienteId)   { toast.aviso("Selecione o cliente");      return; }
    if (!valorMensal) { toast.aviso("Informe o valor mensal");   return; }
    if (!dataInicio)  { toast.aviso("Informe a data de início"); return; }
    mostrarLoading();
    try {
        const r = await fetch("/api/boletos/gerar", {
            method:"POST", headers: hdr(),
            body: JSON.stringify({ clienteId, valorMensal: parseFloat(valorMensal), dataInicio })
        });
        if (!r.ok) { toast.erro((await r.json()).message||"Erro"); return; }
        toast.sucesso("12 parcelas geradas com sucesso!");
        fecharModalGerar();
        const sel = document.getElementById("finClienteSelect");
        if (sel) sel.value = clienteId;
        await carregarBoletos();
    } catch(e) { toast.erro("Erro ao gerar boletos"); } finally { esconderLoading(); }
}

// ─── dark mode ────────────────────────────────────────────────────────────────
function toggleDark() {
    document.body.classList.toggle("dark");
    localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light");
}
window.addEventListener("load", () => {
    if (localStorage.getItem("tema") === "dark") document.body.classList.add("dark");
});
