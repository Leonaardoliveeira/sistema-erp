function getToken() { return localStorage.getItem("token"); }
function mostrarLoading() { const el = document.getElementById("loading"); if (el) el.style.display = "flex"; }
function esconderLoading() { const el = document.getElementById("loading"); if (el) el.style.display = "none"; }

// =======================================
// ESTADO
// =======================================
let backupsCache   = [];
let clientesCache  = [];
let filtroStatus   = "";
let filtroCliente  = "";
let filtroDias     = "30";

// =======================================
// INICIALIZAR PÁGINA
// =======================================
async function inicializarBackup() {
    await Promise.all([carregarResumo(), carregarClientes(), carregarBackups()]);
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

        document.getElementById("totalClientes").textContent = data.totalClientes;
        document.getElementById("comBackup").textContent     = data.comBackup;
        document.getElementById("semBackup").textContent     = data.semBackup;

        // Alerta se houver clientes sem backup hoje
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
// CARREGAR CLIENTES — para o select de filtro e modal
// =======================================
async function carregarClientes() {
    try {
        const res = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) return;
        clientesCache = await res.json();

        // Preenche selects de filtro e modal
        ["filtroCliente", "backupClienteId"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const primeiraOpcao = id === "filtroCliente"
                ? '<option value="">Todos os clientes</option>'
                : '<option value="">Selecione o cliente</option>';
            el.innerHTML = primeiraOpcao + clientesCache.map(c =>
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
        if (filtroStatus)   params.append("status",    filtroStatus);
        if (filtroCliente)  params.append("clienteId", filtroCliente);
        if (filtroDias)     params.append("dias",      filtroDias);

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
        const data      = new Date(b.dataBackup);
        const dataStr   = data.toLocaleDateString("pt-BR");
        const horaStr   = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const cliente   = b.clienteId?.nome || "-";
        const usuario   = b.usuarioId?.nome || "-";
        const tamanho   = b.tamanho   || "-";
        const destino   = b.destino   || "-";
        const obs       = b.observacao || "-";
        const st        = b.status;

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
// MODAL — NOVO REGISTRO MANUAL
// =======================================
function abrirModalNovo() {
    document.getElementById("backupId").value          = "";
    document.getElementById("backupClienteId").value   = "";
    document.getElementById("backupStatus").value      = "ok";
    document.getElementById("backupTamanho").value     = "";
    document.getElementById("backupDestino").value     = "";
    document.getElementById("backupObservacao").value  = "";
    document.getElementById("backupData").value        = new Date().toISOString().slice(0,16);
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

function fecharModal() {
    document.getElementById("modalBackup").style.display = "none";
}

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
        let res;
        if (id) {
            // Edição
            res = await fetch("/api/backup/" + id, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
                body: JSON.stringify({ status, tamanho, destino, observacao })
            });
        } else {
            // Novo
            res = await fetch("/api/backup", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
                body: JSON.stringify({ clienteId, status, tamanho, destino, observacao, dataBackup })
            });
        }

        if (!res.ok) {
            const erro = await res.json();
            toast.erro(erro.message || "Erro ao salvar");
            return;
        }

        toast.sucesso(id ? "Registro atualizado!" : "Backup registrado!");
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
// DARK MODE
// =======================================
function toggleDark() {
    document.body.classList.toggle("dark");
    localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light");
}
window.addEventListener("load", () => {
    if (localStorage.getItem("tema") === "dark") document.body.classList.add("dark");
});
