// =======================================
// 🔐 PEGAR TOKEN
// =======================================
function getToken() {
    return localStorage.getItem("token");
}

// =======================================
// ⏳ LOADING
// =======================================
function mostrarLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "flex";
}

function esconderLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "none";
}

// =======================================
// 🎯 CONTROLE DE FILTRO
// =======================================
let filtroAtivo = null;
let clientesCache = []; // 🔥 cache dos clientes

// =======================================
// 📡 BUSCAR CLIENTES
// =======================================
async function buscarClientes() {
    mostrarLoading();

    try {
        const response = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });

        if (!response.ok) throw new Error("Erro ao buscar clientes");

        return await response.json();

    } catch (error) {
        console.error("Erro:", error);
        return [];

    } finally {
        esconderLoading();
    }
}

// =======================================
// 📊 CARREGAR DASHBOARD
// =======================================
async function carregarDashboard() {
    const clientes = await buscarClientes();

    // 🔥 FILTRO SPED (IGUAL AO clientes.js)
    clientesCache = clientes.filter(c => c.sped === "Sim");

    document.getElementById("pendentes").innerText =
        clientesCache.filter(c => c.status === "Pendente").length;

    document.getElementById("enviados").innerText =
        clientesCache.filter(c => c.status === "Enviado").length;

    document.getElementById("gerados").innerText =
        clientesCache.filter(c => c.status === "Gerado").length;

    document.getElementById("erros").innerText =
        clientesCache.filter(c => c.status === "Erro").length;

    renderizarTabelaDashboard(clientesCache);
}
// =======================================
// 🎯 FILTRO POR CARD
// =======================================
function filtrarPorStatus(status, elemento) {

    const cards = document.querySelectorAll('.card');

    // 🔁 Se clicar no mesmo card → desativa
    if (filtroAtivo === status) {
        filtroAtivo = null;

        // remove ativo de todos
        cards.forEach(card => card.classList.remove('ativo'));

        // mostra todos novamente
        renderizarTabelaDashboard(clientesCache);
        const el = document.getElementById("tituloFiltroAtivo");
        if (el) el.textContent = "";
        return;
    }

    // 🎯 ativa novo filtro
    filtroAtivo = status;
    // remove ativo de todos
    cards.forEach(card => card.classList.remove('ativo'));

    // ativa o clicado
    elemento.classList.add('ativo');

    // filtra lista
    const filtrados = clientesCache.filter(c => c.status === status);

    renderizarTabelaDashboard(filtrados);
    const el = document.getElementById("tituloFiltroAtivo");
    if (el) el.textContent = "— " + status;
}
// =======================================
// 🔍 FILTRO DE PESQUISA (SEM API)
// =======================================
function filtrarClientes() {
    const termo = document.getElementById("campoPesquisa").value.toLowerCase();

    let lista = clientesCache;

    if (filtroAtivo) {
        lista = lista.filter(c => c.status === filtroAtivo);
    }

    const filtrados = lista.filter(c =>
        (c.nome && c.nome.toLowerCase().includes(termo)) ||
        (c.documento && c.documento.toLowerCase().includes(termo))
    );

    renderizarTabelaDashboard(filtrados);
}

// =======================================
// 🧱 RENDERIZAR TABELA (CORRIGIDO)
// =======================================
function renderizarTabelaDashboard(lista) {
    const tabela = document.getElementById("tabelaDashboard");
    if (!tabela) return;

    // detecta mobile
    const isMobile = window.innerWidth <= 768;

    const colspan = isMobile ? 3 : 5;

    if (lista.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="${colspan}" style="text-align:center;">
                    Nenhum cliente encontrado.
                </td>
            </tr>
        `;
        return;
    }

    let html = "";

    lista.forEach(cliente => {
        const stClasse = cliente.status
            ? cliente.status.toLowerCase()
            : "pendente";

        html += `
            <tr>
                <td data-label="Nome">${cliente.nome}</td>
                <td data-label="Documento">${cliente.documento || "-"}</td>
                <td data-label="Regime">${cliente.regime || "-"}</td>
                <td data-label="Telefone">${cliente.telefone || "-"}</td>
                <td data-label="Status">
                    <span class="status ${stClasse}">
                        ${cliente.status || "Pendente"}
                    </span>
                </td>
            </tr>
        `;
    });

    tabela.innerHTML = html;
}

// =======================================
// 🌙 DARK MODE
// =======================================
function toggleDark() {
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
        localStorage.setItem("tema", "dark");
    } else {
        localStorage.setItem("tema", "light");
    }
}

window.addEventListener("load", () => {
    const tema = localStorage.getItem("tema");

    if (tema === "dark") {
        document.body.classList.add("dark");
    }
});