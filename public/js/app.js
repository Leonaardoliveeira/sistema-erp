// =======================================
// 🔐 PEGAR TOKEN
// =======================================
function getToken() {
    return localStorage.getItem("token");
}

// =======================================
// 🎯 CONTROLE DE FILTRO DO DASHBOARD
// =======================================
let filtroAtivo = null;

// =======================================
// 📡 BUSCAR CLIENTES DO BACKEND
// =======================================
async function buscarClientes() {
    try {
        const response = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!response.ok) throw new Error("Erro ao buscar clientes");
        return await response.json();
    } catch (error) {
        console.error("Erro:", error);
        return [];
    }
}

// =======================================
// 📊 CARREGAR DASHBOARD
// =======================================
async function carregarDashboard() {
    const clientes = await buscarClientes();

    document.getElementById("pendentes").innerText = clientes.filter(c => c.status === "Pendente").length;
    document.getElementById("enviados").innerText = clientes.filter(c => c.status === "Enviado").length;
    document.getElementById("gerados").innerText = clientes.filter(c => c.status === "Gerado").length;
    document.getElementById("erros").innerText = clientes.filter(c => c.status === "Erro").length;

    renderizarTabelaDashboard(clientes);
}

// =======================================
// 📋 LISTAGEM PADRÃO
// =======================================
async function listarClientesDashboard() {
    filtroAtivo = null;
    const clientes = await buscarClientes();
    renderizarTabelaDashboard(clientes);
}

// =======================================
// 🎯 FILTRO AO CLICAR NOS CARDS
// =======================================
async function filtrarPorStatus(status) {

    const clientes = await buscarClientes();

    // se clicar no mesmo card remove filtro
    if (filtroAtivo === status) {
        filtroAtivo = null;
        renderizarTabelaDashboard(clientes);
        return;
    }

    filtroAtivo = status;

    const filtrados = clientes.filter(c => c.status === status);

    renderizarTabelaDashboard(filtrados);
}

// =======================================
// 🔍 FILTRO DE PESQUISA
// =======================================
async function filtrarClientes() {
    const termo = document.getElementById("campoPesquisa").value.toLowerCase();
    const clientes = await buscarClientes();

    let lista = clientes;

    // aplica filtro de status se existir
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
// 🧱 RENDERIZAR TABELA
// =======================================
function renderizarTabelaDashboard(lista) {
    const tabela = document.getElementById("tabelaDashboard");
    if (!tabela) return;

    tabela.innerHTML = "";

    if (lista.length === 0) {
        tabela.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Nenhum cliente cadastrado.</td></tr>";
        return;
    }

    lista.forEach(cliente => {

        const stClasse = cliente.status ? cliente.status.toLowerCase() : "pendente";

        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento || "-"}</td>
                <td>${cliente.regime || "-"}</td>
                <td>${cliente.telefone || "-"}</td>
                <td><span class="status ${stClasse}">${cliente.status || "Pendente"}</span></td>
            </tr>
        `;
    });
}

// =======================================
// 🌙 DARK MODE
// =======================================
function toggleDark() {
    document.body.classList.toggle("dark");

    // salva preferência
    if (document.body.classList.contains("dark")) {
        localStorage.setItem("tema", "dark");
    } else {
        localStorage.setItem("tema", "light");
    }
}

// aplicar tema salvo ao carregar
window.addEventListener("load", () => {
    const tema = localStorage.getItem("tema");

    if (tema === "dark") {
        document.body.classList.add("dark");
    }
});