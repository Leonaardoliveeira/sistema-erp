// =======================================
// 🔐 TOKEN
// =======================================

function getToken() {
    return localStorage.getItem("token");
}

function verificarAutenticacao() {
    if (!getToken()) {
        window.location.href = "index.html";
    }
}

verificarAutenticacao();


// =======================================
// 📡 FUNÇÃO PADRÃO DE REQUEST
// =======================================

async function apiRequest(url, options = {}) {

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken(),
            ...options.headers
        }
    });

    if (response.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        localStorage.clear();
        window.location.href = "index.html";
        return null;
    }

    return response;
}


// =======================================
// 📡 BUSCAR CLIENTES
// =======================================

async function buscarClientes() {

    const response = await apiRequest("/api/clientes");

    if (!response) return [];

    if (!response.ok) {
        console.error("Erro ao buscar clientes");
        return [];
    }

    return await response.json();
}


// =======================================
// 📊 CARREGAR DASHBOARD
// =======================================

async function carregarDashboard() {

    if (typeof verificarViradaDeMes === "function") {
        verificarViradaDeMes();
    }

    const clientes = await buscarClientes();

    document.getElementById("totalClientes").innerText = clientes.length;
    document.getElementById("gerados").innerText =
        clientes.filter(c => c.status === "Gerado").length;

    document.getElementById("pendentes").innerText =
        clientes.filter(c => c.status === "Pendente").length;

    document.getElementById("erros").innerText =
        clientes.filter(c => c.status === "Erro").length;

    renderizarTabelaDashboard(clientes);
}


// =======================================
// 📋 LISTAGEM
// =======================================

async function listarClientesDashboard() {
    const clientes = await buscarClientes();
    renderizarTabelaDashboard(clientes);
}


// =======================================
// 🔍 FILTRO
// =======================================

async function filtrarClientes() {

    const termo = document.getElementById("campoPesquisa").value.toLowerCase();
    const clientes = await buscarClientes();

    const filtrados = clientes.filter(c =>
        (c.nome && c.nome.toLowerCase().includes(termo)) ||
        (c.documento && c.documento.toLowerCase().includes(termo))
    );

    renderizarTabelaDashboard(filtrados);
}


// =======================================
// 🧱 RENDER TABELA
// =======================================

function renderizarTabelaDashboard(lista) {

    const tabela = document.getElementById("tabelaDashboard");
    if (!tabela) return;

    tabela.innerHTML = "";

    if (lista.length === 0) {
        tabela.innerHTML =
            "<tr><td colspan='5' style='text-align:center;'>Nenhum cliente cadastrado.</td></tr>";
        return;
    }

    lista.forEach(cliente => {

        const stClasse = cliente.status
            ? cliente.status.toLowerCase()
            : "pendente";

        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento || "-"}</td>
                <td>${cliente.regime || "-"}</td>
                <td>${cliente.telefone || "-"}</td>
                <td><span class="status ${stClasse}">
                    ${cliente.status || "Pendente"}
                </span></td>
            </tr>
        `;
    });
}