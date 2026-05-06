// ─── utils ────────────────────────────────────────────────────────────────────
const T   = () => localStorage.getItem("token");
const hdr = () => ({ "Authorization": "Bearer " + T(), "Content-Type": "application/json" });
function mostrarLoading()  { const e = document.getElementById("loading"); if(e) e.style.display="flex"; }
function esconderLoading() { const e = document.getElementById("loading"); if(e) e.style.display="none"; }

// ─── estado ───────────────────────────────────────────────────────────────────
let perm              = { visualizar: false, editar: false };
let todosClientes     = [];
let monitorados       = [];
let filtroStatus      = "";
let filtroCliente     = "";
let filtroDias        = "30";
let cliFinanceiro     = null;   // { id, suspenderBackup }

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
    // Botão topbar: Gerenciar Clientes (apenas editor)
    const tb = document.getElementById("topbarBtns");
    if (tb && perm.editar) {
        tb.innerHTML = `
          <button class="btn-secondary" style="font-size:12px;padding:7px 14px;" onclick="toggleSecaoGerenciar()">
            <i data-lucide="settings" style="width:13px;height:13px;"></i> Gerenciar Clientes
          </button>`;
        if (window.lucide) lucide.createIcons();
    }
    const show = v => v ? "" : "none";
    const btnL = document.getElementById("btnLimparHistorico");
    if (btnL) btnL.style.display = show(perm.editar);
    const thA = document.getElementById("thAcoes");
    if (thA) thA.style.display = show(perm.editar);
    const sG = document.getElementById("secaoGerenciar");
    if (sG) sG.style.display = show(perm.editar);
    const sF = document.getElementById("secaoFinanceiro");
    if (sF) sF.style.display = show(perm.editar);
}

// ─── cards resumo ─────────────────────────────────────────────────────────────
async function carregarResumo() {
    try {
        const r = await fetch("/api/backup/resumo", { headers: hdr() });
        if (!r.ok) return;
        const d = await r.json();
        const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v ?? "0"; };
        set("totalClientes",  d.totalClientes);
        set("comBackup",      d.comBackup);
        set("semBackup",      d.semBackup);
        set("totalSuspensos", d.totalSuspensos);
        if (d.semBackup > 0) setTimeout(() => toast.aviso(
            d.semBackup === 1 ? "⚠️ 1 cliente sem backup hoje!" : `⚠️ ${d.semBackup} clientes sem backup hoje!`, 6000), 800);
        renderizarSemBackup(d.semBackupLista || []);
    } catch(e) { console.error(e); }
}

function renderizarSemBackup(lista) {
    const el = document.getElementById("listaSemBackup");
    if (!el) return;
    el.innerHTML = lista.length === 0
        ? `<p class="backup-vazio">✅ Todos os clientes receberam backup hoje!</p>`
        : lista.map(c => `<div class="sem-backup-item"><span class="sem-backup-nome">${c.nome}</span><span class="sem-backup-badge">Sem backup hoje</span></div>`).join("");
}

// ─── clientes ─────────────────────────────────────────────────────────────────
async function carregarTodosClientes() {
    try {
        const r = await fetch("/api/clientes-backup", { headers: hdr() });
        if (!r.ok) return;
        todosClientes = await r.json();
        monitorados   = todosClientes.filter(c => c.monitoradoBackup);

        // Select filtro
        const elF = document.getElementById("filtroCliente");
        if (elF) elF.innerHTML = '<option value="">Todos os clientes</option>'
            + monitorados.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");

        // Selects financeiro
        ["finClienteSelect","gerarClienteId"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = (id === "finClienteSelect" ? '<option value="">Selecione o cliente</option>' : '<option value="">Selecione o cliente</option>')
                + monitorados.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
        });

        if (perm.editar) renderizarGerenciar(todosClientes);
    } catch(e) { console.error(e); }
}

// ─── gerenciar monitorados ────────────────────────────────────────────────────
function toggleSecaoGerenciar() {
    const s = document.getElementById("secaoGerenciar");
    if (!s) return;
    const aberto = s.style.display !== "none";
    s.style.display = aberto ? "none" : "";
    if (!aberto) s.scrollIntoView({ behavior: "smooth" });
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
          <td><strong>${c.nome}</strong></td>
          <td><label class="toggle-switch"><input type="checkbox" ${chk} onchange="toggleMonitorado('${id}',this.checked,this)"><span class="toggle-slider"></span></label></td>
          <td style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <code style="font-size:11px;color:var(--text-muted);word-break:break-all;">${id}</code>
            <button class="bkp-btn-copiar" onclick="copiarId('${id}',this)" title="Copiar ObjectID">
              <i data-lucide="copy" style="width:12px;height:12px;"></i>
            </button>
          </td>
        </tr>`;
    }).join("");
    if (window.lucide) lucide.createIcons();
}

async function toggleMonitorado(id, monitorado, el) {
    try {
        const r = await fetch(`/api/clientes/${id}/monitorado-backup`, { method:"PUT", headers:hdr(), body:JSON.stringify({monitorado}) });
        if (!r.ok) { toast.erro("Erro ao atualizar"); el.checked = !monitorado; return; }
        toast.sucesso(monitorado ? "Adicionado ao monitoramento!" : "Removido do monitoramento!");
        await Promise.all([carregarResumo(), carregarTodosClientes(), carregarBackups()]);
    } catch(e) { toast.erro("Erro"); el.checked = !monitorado; }
}

function copiarId(id, btn) {
    const orig = btn.innerHTML;
    const ok = () => {
        toast.sucesso("ObjectID copiado!");
        btn.innerHTML = `<i data-lucide="check" style="width:12px;height:12px;color:var(--green);"></i>`;
        if(window.lucide) lucide.createIcons();
        setTimeout(()=>{ btn.innerHTML=orig; if(window.lucide) lucide.createIcons(); }, 2000);
    };
    if (navigator.clipboard) { navigator.clipboard.writeText(id).then(ok); return; }
    const t = document.createElement("textarea"); t.value=id;
    document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); ok();
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
        const dt  = new Date(b.dataBackup);
        const st  = b.status;
        const acao = perm.editar
            ? `<td class="td-acoes-cell"><div class="td-acoes">
                <button class="btn-primary" style="background:#f59e0b;" onclick="abrirEdicao('${b._id}','${st}','${b.tamanho||""}','${b.destino||""}','${(b.observacao||"").replace(/'/g,"\\'")}')">Editar</button>
                <button class="btn-danger" onclick="excluirBackup('${b._id}')">Excluir</button>
               </div></td>` : "";
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
    if (!await toastConfirm("Limpar TODO o histórico de backups visível?")) return;
    mostrarLoading();
    try {
        const p = new URLSearchParams();
        if (filtroCliente) p.append("clienteId", filtroCliente);
        if (filtroDias)    p.append("dias", filtroDias);
        const r = await fetch("/api/backup?" + p.toString(), { method:"DELETE", headers:hdr() });
        if (!r.ok) { toast.erro("Erro ao limpar"); return; }
        const d = await r.json();
        toast.sucesso(`${d.removidos} registros removidos!`);
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

// ─── modal edição backup ──────────────────────────────────────────────────────
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
    const id = document.getElementById("backupId").value;
    const dados = {
        status:     document.getElementById("backupStatus").value,
        tamanho:    document.getElementById("backupTamanho").value,
        destino:    document.getElementById("backupDestino").value,
        observacao: document.getElementById("backupObservacao").value,
    };
    if (!dados.status) { toast.aviso("Selecione o status"); return; }
    mostrarLoading();
    try {
        const r = await fetch("/api/backup/"+id, { method:"PUT", headers:hdr(), body:JSON.stringify(dados) });
        if (!r.ok) { toast.erro((await r.json()).message||"Erro"); return; }
        toast.sucesso("Registro atualizado!"); fecharModal();
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}
async function excluirBackup(id) {
    if (!await toastConfirm("Deseja excluir este registro?")) return;
    mostrarLoading();
    try {
        await fetch("/api/backup/"+id, { method:"DELETE", headers:hdr() });
        toast.sucesso("Removido!"); await Promise.all([carregarResumo(), carregarBackups()]);
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

// ─── mini financeiro ──────────────────────────────────────────────────────────
async function verificarAtrasadosGlobal() {
    try {
        const r = await fetch("/api/boletos-atrasados", { headers: hdr() });
        if (!r.ok) return;
        const lista = await r.json();
        if (!lista.length) return;
        const msg = lista.map(x=>`${x.nome}: ${x.qtd}`).join(" | ");
        setTimeout(() => toast.aviso(`🔴 Boletos em atraso — ${msg}`, 9000), 1500);
        carregarResumo();
    } catch(e) {}
}

async function carregarBoletos() {
    const id = document.getElementById("finClienteSelect")?.value;
    const wrapEl   = document.getElementById("wrapBoletos");
    const vazioEl  = document.getElementById("boletosVazio");
    const alertaEl = document.getElementById("alertaBoletos");
    const suspEl   = document.getElementById("rowSuspensao");

    if (!id) {
        if(wrapEl)   wrapEl.style.display   = "none";
        if(vazioEl)  vazioEl.style.display  = "";
        if(alertaEl) alertaEl.style.display = "none";
        if(suspEl)   suspEl.style.display   = "none";
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
        cliFinanceiro = cliente ? { id: cliente._id, suspenderBackup: cliente.suspenderBackup } : null;

        // Botão excluir todas as parcelas
        const btnDelTodos = document.getElementById("btnExcluirParcelas");
        if (btnDelTodos) btnDelTodos.style.display = boletos.length ? "" : "none";

        if (!boletos.length) {
            if(wrapEl)  wrapEl.style.display   = "none";
            if(vazioEl) { vazioEl.style.display = ""; vazioEl.textContent = "Nenhum boleto gerado para este cliente."; }
            if(alertaEl) alertaEl.style.display = "none";
            if(suspEl)   suspEl.style.display   = "none";
            return;
        }
        if(wrapEl)  wrapEl.style.display  = "";
        if(vazioEl) vazioEl.style.display = "none";

        // Alerta atrasados
        const atrasados = boletos.filter(b => b.status === "atrasado");
        if (alertaEl) {
            alertaEl.style.display = atrasados.length ? "flex" : "none";
            document.getElementById("alertaBoletosMsg").textContent =
                atrasados.length ? `⚠️ ${atrasados.length} boleto(s) em atraso!` : "";
        }

        // Linha suspensão
        if (suspEl && cliente) {
            suspEl.style.display = "";
            const msgEl = document.getElementById("msgSuspensao");
            const btnEl = document.getElementById("btnToggleSuspensao");
            if (cliente.suspenderBackup) {
                msgEl.textContent = "Backup SUSPENSO para este cliente.";
                btnEl.textContent = "✅ Reativar Backup";
                btnEl.className   = "bkp-btn-suspensao bkp-btn-reativar";
            } else {
                msgEl.textContent = "Backup ATIVO para este cliente.";
                btnEl.textContent = "⛔ Suspender Backup";
                btnEl.className   = "bkp-btn-suspensao bkp-btn-suspender";
            }
        }
        renderizarBoletos(boletos);
    } catch(e) { toast.erro("Erro ao carregar boletos"); } finally { esconderLoading(); }
}

function renderizarBoletos(lista) {
    const tbody = document.getElementById("tabelaBoletos");
    if (!tbody) return;
    const labelSt = { aberto:"Aberto", pago:"Pago", atrasado:"Atrasado" };
    const classSt = { aberto:"pendente", pago:"ok", atrasado:"falha" };

    // Totalizadores
    const total     = lista.reduce((s,b) => s + parseFloat(b.valor||0), 0);
    const totalPago = lista.filter(b=>b.status==="pago").reduce((s,b)=>s+parseFloat(b.valor||0),0);
    const totalAbert= lista.filter(b=>b.status!=="pago").reduce((s,b)=>s+parseFloat(b.valor||0),0);
    const fmt = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

    // Linha de resumo no topo da tabela
    const resumoHtml = `
      <tr class="bkp-boleto-resumo-row">
        <td colspan="6">
          <span class="bkp-res-item bkp-res-total">Total: <strong>${fmt(total)}</strong></span>
          <span class="bkp-res-item bkp-res-pago">Pago: <strong>${fmt(totalPago)}</strong></span>
          <span class="bkp-res-item bkp-res-aberto">Em aberto: <strong>${fmt(totalAbert)}</strong></span>
        </td>
      </tr>`;

    tbody.innerHTML = resumoHtml + lista.map(b => {
        const venc  = new Date(b.vencimento);
        const hoje  = new Date(); hoje.setHours(0,0,0,0);
        const dias  = Math.round((venc - hoje) / 86400000);
        const vencStr = venc.toLocaleDateString("pt-BR");
        const pagoE   = b.pago_em ? new Date(b.pago_em).toLocaleDateString("pt-BR") : "—";
        const valor   = parseFloat(b.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
        const st      = b.status;

        // Badge de proximidade de vencimento
        let badgeVenc = "";
        if (st === "aberto" || st === "atrasado") {
            if (st === "atrasado")     badgeVenc = `<span class="bkp-badge-venc atrasado">${Math.abs(dias)}d atraso</span>`;
            else if (dias <= 3)        badgeVenc = `<span class="bkp-badge-venc urgente">vence em ${dias}d</span>`;
            else if (dias <= 7)        badgeVenc = `<span class="bkp-badge-venc proximo">em ${dias}d</span>`;
        }

        const btnBaixa  = st !== "pago"
            ? `<button class="bkp-btn-baixa" onclick="darBaixa('${b._id}')">✔ Baixa</button>` : "";
        const btnExcluir = `<button class="bkp-btn-excluir-parcela" onclick="excluirParcela('${b._id}')" title="Excluir esta parcela">
            <i data-lucide="trash-2" style="width:11px;height:11px;"></i>
          </button>`;

        return `<tr class="${st === "atrasado" ? "bkp-row-atrasado" : ""}">
          <td data-label="Parcela" style="font-weight:600;">${b.parcela}/${b.totalParcelas||12}</td>
          <td data-label="Vencimento">${vencStr} ${badgeVenc}</td>
          <td data-label="Valor">${valor}</td>
          <td data-label="Status"><span class="backup-status ${classSt[st]}">${labelSt[st]}</span></td>
          <td data-label="Pago em">${pagoE}</td>
          <td class="td-acoes-cell"><div class="td-acoes">${btnBaixa}${btnExcluir}</div></td>
        </tr>`;
    }).join("");
    if (window.lucide) lucide.createIcons();
}

async function darBaixa(id) {
    if (!await toastConfirm("Confirmar baixa neste boleto?")) return;
    mostrarLoading();
    try {
        const r = await fetch(`/api/boletos/${id}/baixa`, { method:"PUT", headers:hdr() });
        if (!r.ok) { toast.erro("Erro ao dar baixa"); return; }
        const d = await r.json();
        toast.sucesso(d.backupReativado ? "Baixa confirmada! ✅ Backup reativado automaticamente." : "Baixa confirmada!");
        await carregarBoletos(); await Promise.all([carregarResumo(), verificarAtrasadosGlobal()]);
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

async function excluirParcela(id) {
    if (!await toastConfirm("Excluir esta parcela?")) return;
    mostrarLoading();
    try {
        const r = await fetch(`/api/boletos/${id}`, { method:"DELETE", headers:hdr() });
        if (!r.ok) { toast.erro("Erro ao excluir parcela"); return; }
        toast.sucesso("Parcela excluída!");
        await carregarBoletos();
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

async function excluirTodasParcelas() {
    const id = document.getElementById("finClienteSelect")?.value;
    if (!id) return;
    if (!await toastConfirm("Excluir TODAS as parcelas deste cliente? Esta ação não pode ser desfeita.")) return;
    mostrarLoading();
    try {
        const r = await fetch(`/api/boletos/cliente/${id}`, { method:"DELETE", headers:hdr() });
        if (!r.ok) { toast.erro("Erro ao excluir parcelas"); return; }
        toast.sucesso("Todas as parcelas excluídas!");
        await carregarBoletos();
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

async function toggleSuspensao() {
    if (!cliFinanceiro) return;
    const suspender = !cliFinanceiro.suspenderBackup;
    if (!await toastConfirm(suspender ? "Confirmar SUSPENSÃO do backup?" : "Confirmar REATIVAÇÃO do backup?")) return;
    mostrarLoading();
    try {
        const r = await fetch(`/api/clientes/${cliFinanceiro.id}/suspender-backup`, {
            method:"PUT", headers:hdr(), body:JSON.stringify({suspender})
        });
        if (!r.ok) { toast.erro("Erro"); return; }
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
            method:"POST", headers:hdr(),
            body: JSON.stringify({ clienteId, valorMensal: parseFloat(valorMensal), dataInicio })
        });
        if (!r.ok) { toast.erro((await r.json()).message||"Erro"); return; }
        toast.sucesso("12 parcelas geradas! Vencimentos já ajustados para dias úteis.");
        fecharModalGerar();
        const sel = document.getElementById("finClienteSelect");
        if (sel) sel.value = clienteId;
        await carregarBoletos();
    } catch(e) { toast.erro("Erro"); } finally { esconderLoading(); }
}

// ─── dark mode ────────────────────────────────────────────────────────────────
function toggleDark() {
    document.body.classList.toggle("dark");
    localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light");
}
window.addEventListener("load", () => {
    if (localStorage.getItem("tema") === "dark") document.body.classList.add("dark");
});
