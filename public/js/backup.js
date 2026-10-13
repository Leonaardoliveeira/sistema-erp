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
    iniciarPollStatusServico();
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

    const sg = document.getElementById("secaoGerenciar");
    if (sg) sg.style.display = perm.editar ? "" : "none";

    const br = document.getElementById("boxRetencao");
    if (br) br.style.display = perm.editar ? "" : "none";
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

        const elRetCliente = document.getElementById("retencaoCliente");
        if (elRetCliente) elRetCliente.innerHTML = opsFiltro;

        if (perm.editar) renderizarGerenciar(todosClientes);
    } catch (e) { console.error(e); }
}

// Atualiza em segundo plano apenas o status do serviço / backup remoto, sem
// re-renderizar a tabela de histórico (evita "piscar" a tela a cada poll).
let _pollStatusTimer = null;
function iniciarPollStatusServico() {
    if (_pollStatusTimer) clearInterval(_pollStatusTimer);
    _pollStatusTimer = setInterval(async () => {
        if (!perm.editar) return;
        try {
            const r = await fetch("/api/clientes-backup", { headers: hdr() });
            if (!r.ok) return;
            todosClientes = await r.json();
            monitorados = todosClientes.filter(c => c.monitoradoBackup);
            renderizarGerenciar(todosClientes);
        } catch (e) { }
    }, 30000); // 30s
}

// ─── gerenciar clientes monitorados ──────────────────────────────────────────
const SERVICO_INFO = {
    rodando: { label: "🟢 Rodando", classe: "servico-ok" },
    parado: { label: "🔴 Parado", classe: "servico-erro" },
    pausado: { label: "🟡 Pausado", classe: "servico-alerta" },
    erro: { label: "🔴 Erro", classe: "servico-erro" },
    offline: { label: "⚫ Offline", classe: "servico-erro" },
    desconhecido: { label: "⚪ Sem dados", classe: "servico-desconhecido" }
};

function renderizarGerenciar(lista) {
    const tbody = document.getElementById("tabelaGerenciar");
    if (!tbody) return;
    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum cliente cadastrado.</td></tr>`;
        return;
    }
    tbody.innerHTML = lista.map(c => {
        const id = c._id.toString();
        const chkMon = c.monitoradoBackup ? "checked" : "";
        const susp = c.suspenderBackup;
        const btnSusp = susp
            ? `<button class="bkp-btn-suspensao bkp-btn-reativar"  onclick="toggleSuspensaoCliente('${id}', false, this)">✅ Reativar</button>`
            : `<button class="bkp-btn-suspensao bkp-btn-suspender" onclick="toggleSuspensaoCliente('${id}', true,  this)">⛔ Suspender</button>`;

        const infoServico = SERVICO_INFO[c.servicoStatusComputado] || SERVICO_INFO.desconhecido;
        const tituloServico = c.servicoAtualizadoEm
            ? `Última atualização: ${new Date(c.servicoAtualizadoEm).toLocaleString("pt-BR")}${c.servicoMensagem ? " — " + c.servicoMensagem : ""}`
            : "Agente ainda não reportou status";
        const badgeServico = `<span class="backup-servico-badge ${infoServico.classe}" title="${tituloServico}">${infoServico.label}</span>`;

        const pendente = c.executarBackupAgora;
        const btnExecutar = pendente
            ? `<button class="bkp-btn-executar bkp-btn-executar-pendente" disabled title="Aguardando o agente executar...">⏳ Solicitado</button>`
            : `<button class="bkp-btn-executar" onclick="executarBackupAgora('${id}', this)">▶️ Executar Agora</button>`;

        return `<tr>
          <td data-label="Cliente"><strong>${c.nome}</strong></td>
          <td data-label="Monitorar">
            <label class="toggle-switch">
              <input type="checkbox" ${chkMon} onchange="toggleMonitorado('${id}',this.checked,this)">
              <span class="toggle-slider"></span>
            </label>
          </td>
          <td data-label="Suspensão">${btnSusp}</td>
          <td data-label="Status do Serviço">${badgeServico}</td>
          <td data-label="Backup Remoto">${btnExecutar}</td>
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

// ─── executar backup remotamente ──────────────────────────────────────────────
async function executarBackupAgora(id, btnEl) {
    if (!perm.editar) return;
    const ok = await toastConfirm("Solicitar execução do backup agora para este cliente? O agente instalado na máquina dele vai iniciar assim que detectar o pedido.", "Executar");
    if (!ok) return;
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = "Enviando..."; }
    try {
        const r = await fetch(`/api/clientes/${id}/executar-backup`, { method: "PUT", headers: hdr() });
        if (!r.ok) { toast.erro("Erro ao solicitar backup"); if (btnEl) { btnEl.disabled = false; btnEl.textContent = "▶️ Executar Agora"; } return; }
        toast.sucesso("✅ Solicitação enviada! O agente vai executar no próximo ciclo de verificação.");
        await carregarTodosClientes();
    } catch (e) { toast.erro("Erro ao solicitar backup"); if (btnEl) { btnEl.disabled = false; btnEl.textContent = "▶️ Executar Agora"; } }
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

        // Contagem apenas do dia de HOJE — fica em branco se ainda não houve backup hoje
        const hoje = new Date().toLocaleDateString("pt-BR");
        const registrosDoDia = grupo.registros.filter(
            b => new Date(b.dataBackup).toLocaleDateString("pt-BR") === hoje
        );
        const qtdOk = registrosDoDia.filter(b => b.status === "ok").length;
        const qtdFalha = registrosDoDia.filter(b => b.status === "falha").length;
        const qtdPendente = registrosDoDia.filter(b => b.status === "pendente").length;

        const badges = [];
        if (qtdOk > 0) badges.push(`<span class="backup-status ok"       style="font-size:11px;">✅ ${qtdOk} OK</span>`);
        if (qtdFalha > 0) badges.push(`<span class="backup-status falha"    style="font-size:11px;">❌ ${qtdFalha} Falha${qtdFalha !== 1 ? "s" : ""}</span>`);
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

// ─── retenção: excluir backups antigos por período ou data ───────────────────
function onMudaRetencaoPeriodo() {
    const periodo = document.getElementById("retencaoPeriodo")?.value || "";
    const campoData = document.getElementById("retencaoData");
    if (!campoData) return;
    if (periodo === "custom") {
        campoData.focus();
    } else if (periodo) {
        campoData.value = "";
    }
}

function onMudaRetencaoData() {
    const data = document.getElementById("retencaoData")?.value;
    const sel = document.getElementById("retencaoPeriodo");
    if (data && sel) sel.value = "custom";
}

async function executarLimpezaRetencao() {
    if (!perm.editar) return;
    const periodo = document.getElementById("retencaoPeriodo")?.value || "";
    const data = document.getElementById("retencaoData")?.value || "";
    const clienteId = document.getElementById("retencaoCliente")?.value || "";

    const p = new URLSearchParams();
    if (clienteId) p.append("clienteId", clienteId);

    let descricaoPeriodo = "";
    if (periodo === "custom" && data) {
        p.append("antes", new Date(data + "T00:00:00").toISOString());
        descricaoPeriodo = `anteriores a ${new Date(data + "T00:00:00").toLocaleDateString("pt-BR")}`;
    } else if (periodo && periodo !== "custom") {
        p.append("periodo", periodo);
        const nomes = { "1d": "1 dia (diário)", "7d": "1 semana", "15d": "15 dias", "1m": "1 mês" };
        descricaoPeriodo = `com mais de ${nomes[periodo] || periodo}`;
    } else {
        toast.aviso("Escolha um período ou uma data específica.");
        return;
    }

    const ok = await toastConfirm(
        `Excluir PERMANENTEMENTE os registros de backup ${descricaoPeriodo}? Esta ação não pode ser desfeita.`,
        "Excluir"
    );
    if (!ok) return;

    mostrarLoading();
    try {
        const r = await fetch("/api/backup/retencao?" + p.toString(), { method: "DELETE", headers: hdr() });
        const d = await r.json();
        if (!r.ok) { toast.erro(d.message || "Erro ao excluir"); return; }
        toast.sucesso(`${d.removidos} registro(s) antigo(s) removido(s)!`);
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch (e) { toast.erro("Erro ao excluir registros antigos"); } finally { esconderLoading(); }
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

// =======================================
// 🔍 FILTRO DE PESQUISA (SEM API)
// =======================================
function filtrarClientes() {
    // Pega o valor do input de pesquisa de clientes
    const termo = document.getElementById("campoPesquisaClientes")?.value.toLowerCase() || "";

    // Filtra em cima da variável 'todosClientes' que já foi carregada pela API
    const filtrados = todosClientes.filter(c =>
        (c.nome && c.nome.toLowerCase().includes(termo)) ||
        (c._id && c._id.toString().toLowerCase().includes(termo))
    );

    // Renderiza novamente a tabela com os clientes filtrados
    renderizarGerenciar(filtrados);
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