function getToken() { return localStorage.getItem("token"); }
function mostrarLoading() { const el = document.getElementById("loading"); if (el) el.style.display = "flex"; }
function esconderLoading() { const el = document.getElementById("loading"); if (el) el.style.display = "none"; }

// =======================================
// ESTADO
// =======================================
let backupsCache  = [];
let clientesCache = [];
let filtroStatus  = "";
let filtroCliente = "";
let filtroDias    = "30";
let clienteSuspensaoAtual = null; // { id, suspenderBackup }

// =======================================
// INICIALIZAR PÁGINA
// =======================================
async function inicializarBackup() {
    await Promise.all([carregarResumo(), carregarClientes(), carregarBackups()]);
    await verificarBoletosAtrasadosGlobal();
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

        document.getElementById("totalClientes").textContent = data.totalClientes ?? "—";
        document.getElementById("comBackup").textContent     = data.comBackup ?? "—";
        document.getElementById("semBackup").textContent     = data.semBackup ?? "—";
        document.getElementById("totalSuspensos").textContent = data.totalSuspensos ?? "—";

        if (data.semBackup > 0) {
            setTimeout(() => {
                toast.aviso(
                    data.semBackup === 1
                        ? "⚠️ 1 cliente sem backup hoje!"
                        : `⚠️ ${data.semBackup} clientes sem backup hoje!`,
                    6000
                );
            }, 800);
        }

        renderizarSemBackup(data.semBackupLista || []);
    } catch (e) {
        console.error("Erro ao carregar resumo:", e);
    }
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
        </div>
    `).join("");
}

// =======================================
// CARREGAR CLIENTES
// =======================================
async function carregarClientes() {
    try {
        const res = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) return;
        clientesCache = await res.json();

        ["filtroCliente"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">Todos os clientes</option>' +
                clientesCache.map(c => `<option value="${c._id}">${c.nome}</option>`).join("");
        });

        // Popula selects do financeiro e modal gerar
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
    } catch (e) {
        console.error("Erro ao carregar clientes:", e);
    }
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
    } catch (e) {
        console.error("Erro ao carregar backups:", e);
    } finally {
        esconderLoading();
    }
}

// =======================================
// RENDERIZAR TABELA
// =======================================
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
        const tamanho = b.tamanho   || "-";
        const destino = b.destino   || "-";
        const st      = b.status;

        return `<tr>
            <td data-label="Cliente"><strong>${cliente}</strong></td>
            <td data-label="Data">${dataStr} <span style="color:var(--text-muted);font-size:12px;">${horaStr}</span></td>
            <td data-label="Status"><span class="backup-status ${st}">${labelStatus(st)}</span></td>
            <td data-label="Tamanho">${tamanho}</td>
            <td data-label="Destino">${destino}</td>
            <td data-label="Responsável">${usuario}</td>
            <td class="td-acoes-cell">
                <div class="td-acoes">
                    <button class="btn-primary" style="background:#f59e0b;" onclick="abrirEdicao('${b._id}','${st}','${b.tamanho||""}','${b.destino||""}','${(b.observacao||"").replace(/'/g,"\\'")}')">Editar</button>
                    <button class="btn-danger" onclick="excluirBackup('${b._id}')">Excluir</button>
                </div>
            </td>
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
    document.querySelectorAll("#tabelaBackup tr").forEach(linha => {
        linha.style.display = linha.innerText.toLowerCase().includes(termo) ? "" : "none";
    });
}

// =======================================
// LIMPAR HISTÓRICO
// =======================================
async function limparHistorico() {
    const ok = await toastConfirm("Deseja limpar TODO o histórico de backups visível? Esta ação não pode ser desfeita.");
    if (!ok) return;
    mostrarLoading();
    try {
        // Exclui todos os backups filtrados atualmente (sem filtro = todos)
        const params = new URLSearchParams();
        if (filtroCliente) params.append("clienteId", filtroCliente);
        if (filtroDias)    params.append("dias",      filtroDias);
        const res = await fetch("/api/backup/limpar?" + params.toString(), {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) { toast.erro("Erro ao limpar histórico"); return; }
        toast.sucesso("Histórico limpo com sucesso!");
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch (e) {
        toast.erro("Erro ao limpar histórico");
    } finally {
        esconderLoading();
    }
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

function fecharModal() {
    document.getElementById("modalBackup").style.display = "none";
}

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
        if (!res.ok) { const e = await res.json(); toast.erro(e.message || "Erro ao salvar"); return; }
        toast.sucesso("Registro atualizado!");
        fecharModal();
        await Promise.all([carregarResumo(), carregarBackups()]);
    } catch (e) {
        toast.erro("Erro ao salvar");
    } finally {
        esconderLoading();
    }
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
    } catch (e) {
        toast.erro("Erro ao excluir");
    } finally {
        esconderLoading();
    }
}

// =======================================
// MINI FINANCEIRO — BOLETOS
// =======================================

async function verificarBoletosAtrasadosGlobal() {
    try {
        const res = await fetch("/api/boletos/resumo/atrasados", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) return;
        const lista = await res.json();
        if (lista.length === 0) return;
        // Agrupa por cliente
        const por_cliente = {};
        lista.forEach(b => {
            const nome = b.clienteId?.nome || "Cliente";
            por_cliente[nome] = (por_cliente[nome] || 0) + 1;
        });
        const msgs = Object.entries(por_cliente)
            .map(([n, q]) => `${n}: ${q} boleto(s)`)
            .join(" | ");
        setTimeout(() => toast.aviso(`🔴 Boletos em atraso — ${msgs}`, 8000), 1200);
    } catch (e) { /* silencioso */ }
}

async function carregarBoletos() {
    const clienteId = document.getElementById("finClienteSelect")?.value;
    const wrap  = document.getElementById("tabelaBoletosWrap");
    const vazio = document.getElementById("boletosVazio");
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

        // Alerta atrasados
        const atrasados = boletos.filter(b => b.status === "atrasado");
        if (atrasados.length > 0 && alertaBox) {
            alertaBox.style.display = "flex";
            document.getElementById("alertaAtrasadosMsg").textContent =
                `⚠️ ${atrasados.length} boleto(s) em atraso para este cliente!`;
        } else if (alertaBox) {
            alertaBox.style.display = "none";
        }

        // Linha de suspensão
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
    } catch (e) {
        toast.erro("Erro ao carregar boletos");
    } finally {
        esconderLoading();
    }
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
        if (data.backupReativado) {
            toast.sucesso("Baixa confirmada! ✅ Backup reativado automaticamente.");
        } else {
            toast.sucesso("Baixa confirmada!");
        }
        await carregarBoletos();
        await carregarResumo();
    } catch (e) {
        toast.erro("Erro ao dar baixa");
    } finally {
        esconderLoading();
    }
}

async function toggleSuspensao() {
    if (!clienteSuspensaoAtual) return;
    const suspender = !clienteSuspensaoAtual.suspenderBackup;
    const msg = suspender
        ? "Confirmar SUSPENSÃO do backup para este cliente?"
        : "Confirmar REATIVAÇÃO do backup para este cliente?";
    const ok = await toastConfirm(msg);
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
    } catch (e) {
        toast.erro("Erro ao alterar suspensão");
    } finally {
        esconderLoading();
    }
}

// =======================================
// MODAL GERAR BOLETOS
// =======================================
function abrirModalGerar() {
    // Pré-seleciona o cliente escolhido no financeiro, se houver
    const finId = document.getElementById("finClienteSelect")?.value;
    const sel   = document.getElementById("gerarClienteId");
    if (sel && finId) sel.value = finId;
    // Data padrão = hoje
    const hoje = new Date().toISOString().split("T")[0];
    const dtEl = document.getElementById("gerarDataInicio");
    if (dtEl) dtEl.value = hoje;
    document.getElementById("modalGerar").style.display = "flex";
}

function fecharModalGerar() {
    document.getElementById("modalGerar").style.display = "none";
}

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
        if (!res.ok) { const e = await res.json(); toast.erro(e.message || "Erro ao gerar boletos"); return; }
        toast.sucesso("12 parcelas geradas com sucesso!");
        fecharModalGerar();
        // Seleciona o cliente no financeiro e recarrega
        const sel = document.getElementById("finClienteSelect");
        if (sel) { sel.value = clienteId; }
        await carregarBoletos();
    } catch (e) {
        toast.erro("Erro ao gerar boletos");
    } finally {
        esconderLoading();
    }
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
