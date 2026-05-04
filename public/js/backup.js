function getToken()       { return localStorage.getItem("token"); }
function getUsuario()     { return JSON.parse(localStorage.getItem("usuario") || "{}"); }
function mostrarLoading() { const el = document.getElementById("loading"); if (el) el.style.display = "flex"; }
function esconderLoading(){ const el = document.getElementById("loading"); if (el) el.style.display = "none"; }

// =======================================
// ESTADO
// =======================================
let backupsCache  = [];
let clientesCache = [];   // apenas monitorados (para filtros)
let todosClientesCache = []; // todos os clientes (para gerenciar)
let filtroStatus  = "";
let filtroCliente = "";
let filtroDias    = "30";
let clienteSuspensaoAtual = null;
let permissao = { visualizar: false, editar: false };

// =======================================
// INICIALIZAR PÁGINA
// =======================================
async function inicializarBackup() {
    // Carrega permissão primeiro — define o que será exibido
    await carregarPermissao();
    if (!permissao.visualizar) {
        // Sem permissão: redireciona (auth.js já cuida do menu, mas protege a página tb)
        window.location.href = "dashboard.html";
        return;
    }
    aplicarPermissaoUI();
    await Promise.all([carregarResumo(), carregarTodosClientes(), carregarBackups()]);
    await verificarBoletosAtrasadosGlobal();
}

async function carregarPermissao() {
    try {
        const res = await fetch("/api/backup/minha-permissao", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (res.ok) permissao = await res.json();
    } catch (e) { /* mantém false */ }
}

// Mostra/oculta elementos conforme permissão
function aplicarPermissaoUI() {
    const podEditar = permissao.editar;

    // Botão Limpar Histórico (apenas quem pode editar)
    const btnLimpar = document.getElementById("btnLimpar");
    if (btnLimpar) btnLimpar.style.display = podEditar ? "" : "none";

    // Coluna Ações na tabela
    const thAcoes = document.getElementById("thAcoes");
    if (thAcoes) thAcoes.style.display = podEditar ? "" : "none";

    // Seção Financeiro
    const secFinanceiro = document.getElementById("secaoFinanceiro");
    if (secFinanceiro) secFinanceiro.style.display = podEditar ? "" : "none";

    // Seção Gerenciar Clientes
    const secGerenciar = document.getElementById("secaoGerenciar");
    if (secGerenciar) secGerenciar.style.display = podEditar ? "" : "none";

    // Botão no topbar: só quem edita vê "Gerenciar Clientes"
    const topAcoes = document.getElementById("topbarAcoes");
    if (topAcoes && podEditar) {
        topAcoes.innerHTML = `
          <button class="btn-secondary btn-sm" onclick="carregarGerenciar()" id="btnGerenciar">
            <i data-lucide="settings" style="width:13px;height:13px;"></i> Gerenciar Clientes
          </button>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

// =======================================
// RESUMO — cards do topo
// =======================================
async function carregarResumo() {
    try {
        const res  = await fetch("/api/backup/resumo", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById("totalClientes").textContent  = data.totalClientes ?? "—";
        document.getElementById("comBackup").textContent      = data.comBackup ?? "—";
        document.getElementById("semBackup").textContent      = data.semBackup ?? "—";
        document.getElementById("totalSuspensos").textContent = data.totalSuspensos ?? "—";

        if (data.semBackup > 0) {
            setTimeout(() => toast.aviso(
                data.semBackup === 1
                    ? "⚠️ 1 cliente sem backup hoje!"
                    : `⚠️ ${data.semBackup} clientes sem backup hoje!`,
                6000
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

// =======================================
// CARREGAR TODOS OS CLIENTES (para filtros, financeiro, gerenciar)
// =======================================
async function carregarTodosClientes() {
    try {
        // Clientes monitorados (para os selects de filtro/financeiro)
        const res = await fetch("/api/clientes/backup-gerenciar", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) return;
        todosClientesCache = await res.json();
        clientesCache = todosClientesCache.filter(c => c.monitoradoBackup);

        // Popula selects de filtro
        const filtroEl = document.getElementById("filtroCliente");
        if (filtroEl) {
            filtroEl.innerHTML = '<option value="">Todos os clientes</option>' +
                clientesCache.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
        }

        // Popula selects do financeiro
        ["finClienteSelect", "gerarClienteId"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const first = id === "finClienteSelect"
                ? '<option value="">Selecione cliente</option>'
                : '<option value="">Selecione o cliente</option>';
            el.innerHTML = first + clientesCache.map(c =>
                `<option value="${c._id}">${c.nome}</option>`
            ).join("");
        });
    } catch (e) { console.error("Erro clientes:", e); }
}

// =======================================
// GERENCIAR CLIENTES MONITORADOS
// =======================================
async function carregarGerenciar() {
    if (!permissao.editar) return;
    mostrarLoading();
    try {
        const res = await fetch("/api/clientes/backup-gerenciar", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) return;
        todosClientesCache = await res.json();
        renderizarGerenciar(todosClientesCache);
        // Scroll até a seção
        document.getElementById("secaoGerenciar")?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
        toast.erro("Erro ao carregar clientes");
    } finally {
        esconderLoading();
    }
}

function renderizarGerenciar(lista) {
    const tbody = document.getElementById("tabelaGerenciar");
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum cliente cadastrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(c => {
        const checked = c.monitoradoBackup ? "checked" : "";
        const idStr   = c._id.toString();
        return `<tr>
            <td data-label="Cliente"><strong>${c.nome}</strong></td>
            <td data-label="Monitorar">
              <label class="toggle-switch" title="Monitorar este cliente no backup">
                <input type="checkbox" ${checked} onchange="toggleMonitorado('${idStr}', this.checked, this)">
                <span class="toggle-slider"></span>
              </label>
            </td>
            <td data-label="ObjectID" style="display:flex;align-items:center;gap:8px;">
              <code style="font-size:11px;color:var(--text-muted);word-break:break-all;">${idStr}</code>
              <button class="btn-sm btn-copy" onclick="copiarObjectId('${idStr}', this)" title="Copiar ObjectID">
                <i data-lucide="copy" style="width:12px;height:12px;"></i>
              </button>
            </td>
        </tr>`;
    }).join("");
    if (window.lucide) window.lucide.createIcons();
}

async function toggleMonitorado(clienteId, monitorado, checkboxEl) {
    try {
        const res = await fetch(`/api/clientes/${clienteId}/monitorado-backup`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ monitorado })
        });
        if (!res.ok) { toast.erro("Erro ao atualizar"); checkboxEl.checked = !monitorado; return; }
        toast.sucesso(monitorado ? "Cliente adicionado ao monitoramento!" : "Cliente removido do monitoramento!");
        // Atualiza cache e recarrega resumo/filtros
        await Promise.all([carregarResumo(), carregarTodosClientes()]);
    } catch (e) {
        toast.erro("Erro ao atualizar");
        checkboxEl.checked = !monitorado;
    }
}

function copiarObjectId(id, btn) {
    navigator.clipboard.writeText(id).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="check" style="width:12px;height:12px;color:var(--green);"></i>`;
        if (window.lucide) window.lucide.createIcons();
        toast.sucesso("ObjectID copiado!");
        setTimeout(() => { btn.innerHTML = orig; if (window.lucide) window.lucide.createIcons(); }, 2000);
    }).catch(() => {
        // fallback
        const el = document.createElement("textarea");
        el.value = id;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        toast.sucesso("ObjectID copiado!");
    });
}

// =======================================
// CARREGAR BACKUPS
// =======================================
async function carregarBackups() {
    mostrarLoading();
    try {
        const params = new URLSearchParams();
        if (filtroStatus)  params.append("status",    filtroStatus);
        if (filtroCliente) params.append("clienteId", filtroCliente);
        if (filtroDias)    params.append("dias",      filtroDias);

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
        const data    = new Date(b.dataBackup);
        const dataStr = data.toLocaleDateString("pt-BR");
        const horaStr = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const cliente = b.clienteId?.nome || "-";
        const usuario = b.usuarioId?.nome || "-";
        const st      = b.status;

        const tdAcoes = permissao.editar
            ? `<td class="td-acoes-cell">
                <div class="td-acoes">
                  <button class="btn-primary" style="background:#f59e0b;" onclick="abrirEdicao('${b._id}','${st}','${b.tamanho||""}','${b.destino||""}','${(b.observacao||"").replace(/'/g,"\\'")}')">Editar</button>
                  <button class="btn-danger" onclick="excluirBackup('${b._id}')">Excluir</button>
                </div>
               </td>`
            : "";

        return `<tr>
            <td data-label="Cliente"><strong>${cliente}</strong></td>
            <td data-label="Data">${dataStr} <span style="color:var(--text-muted);font-size:12px;">${horaStr}</span></td>
            <td data-label="Status"><span class="backup-status ${st}">${labelStatus(st)}</span></td>
            <td data-label="Tamanho">${b.tamanho || "-"}</td>
            <td data-label="Destino">${b.destino || "-"}</td>
            <td data-label="Responsável">${usuario}</td>
            ${tdAcoes}
        </tr>`;
    }).join("");
}

function labelStatus(st) {
    return st === "ok" ? "OK" : st === "falha" ? "Falha" : "Pendente";
}

// =======================================
// FILTROS
// =======================================
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

// =======================================
// LIMPAR HISTÓRICO
// =======================================
async function limparHistorico() {
    if (!permissao.editar) return;
    const ok = await toastConfirm("Deseja limpar TODO o histórico de backups visível?");
    if (!ok) return;
    mostrarLoading();
    try {
        const params = new URLSearchParams();
        if (filtroCliente) params.append("clienteId", filtroCliente);
        if (filtroDias)    params.append("dias",      filtroDias);
        const res = await fetch("/api/backup/limpar?" + params.toString(), {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) { toast.erro("Erro ao limpar histórico"); return; }
        toast.sucesso("Histórico limpo!");
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch (e) { toast.erro("Erro ao limpar histórico"); }
    finally { esconderLoading(); }
}

// =======================================
// MODAL EDIÇÃO
// =======================================
function abrirEdicao(id, status, tamanho, destino, observacao) {
    document.getElementById("backupId").value         = id;
    document.getElementById("backupStatus").value     = status;
    document.getElementById("backupTamanho").value    = tamanho;
    document.getElementById("backupDestino").value    = destino;
    document.getElementById("backupObservacao").value = observacao;
    document.getElementById("modalBackup").style.display = "flex";
}
function fecharModal() { document.getElementById("modalBackup").style.display = "none"; }

async function salvarBackup() {
    const id         = document.getElementById("backupId").value;
    const status     = document.getElementById("backupStatus").value;
    const tamanho    = document.getElementById("backupTamanho").value;
    const destino    = document.getElementById("backupDestino").value;
    const observacao = document.getElementById("backupObservacao").value;
    if (!status) { toast.aviso("Selecione o status"); return; }
    mostrarLoading();
    try {
        const res = await fetch("/api/backup/" + id, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ status, tamanho, destino, observacao })
        });
        if (!res.ok) { const e = await res.json(); toast.erro(e.message || "Erro"); return; }
        toast.sucesso("Registro atualizado!");
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

// =======================================
// MINI FINANCEIRO — BOLETOS
// =======================================
async function verificarBoletosAtrasadosGlobal() {
    if (!permissao.editar) return;
    try {
        const res = await fetch("/api/boletos/resumo/atrasados", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) return;
        const lista = await res.json();
        if (lista.length === 0) return;
        const por = {};
        lista.forEach(b => { const n = b.clienteId?.nome || "Cliente"; por[n] = (por[n] || 0) + 1; });
        const msgs = Object.entries(por).map(([n, q]) => `${n}: ${q}`).join(" | ");
        setTimeout(() => toast.aviso(`🔴 Boletos em atraso — ${msgs}`, 8000), 1200);
    } catch (e) { /* silencioso */ }
}

async function carregarBoletos() {
    const clienteId = document.getElementById("finClienteSelect")?.value;
    const wrap      = document.getElementById("tabelaBoletosWrap");
    const vazio     = document.getElementById("boletosVazio");
    const alertaBox = document.getElementById("alertaAtrasados");
    const suspRow   = document.getElementById("boletoSuspensaoRow");
    if (!clienteId) {
        if (wrap)  wrap.style.display  = "none";
        if (vazio) vazio.style.display = "";
        if (alertaBox) alertaBox.style.display = "none";
        if (suspRow)   suspRow.style.display   = "none";
        return;
    }
    mostrarLoading();
    try {
        const [bolRes, cliRes] = await Promise.all([
            fetch("/api/boletos/" + clienteId, { headers: { "Authorization": "Bearer " + getToken() } }),
            fetch("/api/clientes/" + clienteId, { headers: { "Authorization": "Bearer " + getToken() } })
        ]);
        const boletos = bolRes.ok ? await bolRes.json() : [];
        const cliente = cliRes.ok ? await cliRes.json() : null;
        clienteSuspensaoAtual = cliente ? { id: cliente._id, suspenderBackup: cliente.suspenderBackup } : null;
        if (boletos.length === 0) {
            if (wrap)  wrap.style.display  = "none";
            if (vazio) { vazio.style.display = ""; vazio.textContent = "Nenhum boleto gerado para este cliente."; }
            if (alertaBox) alertaBox.style.display = "none";
            if (suspRow)   suspRow.style.display   = "none";
            return;
        }
        if (wrap)  wrap.style.display  = "";
        if (vazio) vazio.style.display = "none";
        const atrasados = boletos.filter(b => b.status === "atrasado");
        if (atrasados.length > 0 && alertaBox) {
            alertaBox.style.display = "flex";
            document.getElementById("alertaAtrasadosMsg").textContent =
                `⚠️ ${atrasados.length} boleto(s) em atraso para este cliente!`;
        } else if (alertaBox) { alertaBox.style.display = "none"; }
        if (suspRow && cliente) {
            suspRow.style.display = "";
            const msg = document.getElementById("boletoSuspensaoMsg");
            const btn = document.getElementById("btnToggleSuspensao");
            if (cliente.suspenderBackup) {
                msg.textContent = "Backup está SUSPENSO para este cliente.";
                btn.textContent = "✅ Reativar Backup";
                btn.className   = "btn-sm btn-success";
            } else {
                msg.textContent = "Backup está ATIVO para este cliente.";
                btn.textContent = "⛔ Suspender Backup";
                btn.className   = "btn-sm btn-danger";
            }
        }
        renderizarBoletos(boletos);
    } catch (e) { toast.erro("Erro ao carregar boletos"); }
    finally { esconderLoading(); }
}

function renderizarBoletos(lista) {
    const tbody = document.getElementById("tabelaBoletos");
    if (!tbody) return;
    const statusLabel = { aberto: "Aberto", pago: "Pago", atrasado: "Atrasado" };
    const statusClass = { aberto: "pendente", pago: "ok", atrasado: "falha" };
    tbody.innerHTML = lista.map(b => {
        const venc   = new Date(b.vencimento).toLocaleDateString("pt-BR");
        const pagoEm = b.pago_em ? new Date(b.pago_em).toLocaleDateString("pt-BR") : "—";
        const valor  = parseFloat(b.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const st     = b.status;
        const btnBaixa = st !== "pago"
            ? `<button class="btn-success btn-sm" onclick="darBaixa('${b._id}')">✔ Dar Baixa</button>`
            : `<span style="color:var(--text-muted);font-size:12px;">—</span>`;
        return `<tr>
            <td data-label="Parcela">${b.parcela}/${b.totalParcelas || 12}</td>
            <td data-label="Vencimento">${venc}</td>
            <td data-label="Valor">${valor}</td>
            <td data-label="Status"><span class="backup-status ${statusClass[st]}">${statusLabel[st]}</span></td>
            <td data-label="Pago em">${pagoEm}</td>
            <td class="td-acoes-cell">${btnBaixa}</td>
        </tr>`;
    }).join("");
}

async function darBaixa(boletoId) {
    const ok = await toastConfirm("Confirmar baixa neste boleto?");
    if (!ok) return;
    mostrarLoading();
    try {
        const res = await fetch("/api/boletos/" + boletoId + "/baixa", {
            method: "PUT",
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) { toast.erro("Erro ao dar baixa"); return; }
        const data = await res.json();
        toast.sucesso(data.backupReativado ? "Baixa confirmada! ✅ Backup reativado automaticamente." : "Baixa confirmada!");
        await carregarBoletos();
        await carregarResumo();
    } catch (e) { toast.erro("Erro ao dar baixa"); }
    finally { esconderLoading(); }
}

async function toggleSuspensao() {
    if (!clienteSuspensaoAtual) return;
    const suspender = !clienteSuspensaoAtual.suspenderBackup;
    const ok = await toastConfirm(suspender ? "Confirmar SUSPENSÃO do backup?" : "Confirmar REATIVAÇÃO do backup?");
    if (!ok) return;
    mostrarLoading();
    try {
        const res = await fetch(`/api/clientes/${clienteSuspensaoAtual.id}/suspender-backup`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ suspender })
        });
        if (!res.ok) { toast.erro("Erro ao alterar suspensão"); return; }
        toast.sucesso(suspender ? "Backup suspenso!" : "Backup reativado!");
        await carregarBoletos();
        await carregarResumo();
    } catch (e) { toast.erro("Erro"); }
    finally { esconderLoading(); }
}

// =======================================
// MODAL GERAR BOLETOS
// =======================================
function abrirModalGerar() {
    const finId = document.getElementById("finClienteSelect")?.value;
    const sel   = document.getElementById("gerarClienteId");
    if (sel && finId) sel.value = finId;
    const hoje = new Date().toISOString().split("T")[0];
    const dtEl = document.getElementById("gerarDataInicio");
    if (dtEl) dtEl.value = hoje;
    document.getElementById("modalGerar").style.display = "flex";
}
function fecharModalGerar() { document.getElementById("modalGerar").style.display = "none"; }

async function gerarBoletos() {
    const clienteId   = document.getElementById("gerarClienteId").value;
    const valorMensal = document.getElementById("gerarValor").value;
    const dataInicio  = document.getElementById("gerarDataInicio").value;
    if (!clienteId)   { toast.aviso("Selecione o cliente");       return; }
    if (!valorMensal) { toast.aviso("Informe o valor mensal");    return; }
    if (!dataInicio)  { toast.aviso("Informe a data de início");  return; }
    mostrarLoading();
    try {
        const res = await fetch("/api/boletos/gerar", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ clienteId, valorMensal: parseFloat(valorMensal), dataInicio })
        });
        if (!res.ok) { const e = await res.json(); toast.erro(e.message || "Erro"); return; }
        toast.sucesso("12 parcelas geradas com sucesso!");
        fecharModalGerar();
        const sel = document.getElementById("finClienteSelect");
        if (sel) sel.value = clienteId;
        await carregarBoletos();
    } catch (e) { toast.erro("Erro ao gerar boletos"); }
    finally { esconderLoading(); }
}

// =======================================
// DARK MODE
// =======================================
function toggleDark() {
    document.body.classList.toggle("dark");
    localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light");
}
window.addEventListener("load", () => {
    if (localStorage.getItem("tema") === "dark") document.body.classList.add("dark");
});
