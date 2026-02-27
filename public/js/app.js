// =======================================
// CARREGAR DADOS DO DASHBOARD
// =======================================
function carregarDashboard() {
    if (typeof verificarViradaDeMes === "function") {
        verificarViradaDeMes();
    }

    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];

    document.getElementById("totalClientes").innerText = clientes.length;
    document.getElementById("gerados").innerText = clientes.filter(c => c.status === "Gerado").length;
    document.getElementById("pendentes").innerText = clientes.filter(c => c.status === "Pendente").length;
    document.getElementById("erros").innerText = clientes.filter(c => c.status === "Erro").length;

    listarClientesDashboard();
}

// =======================================
// LISTAGEM PADRÃO NO DASHBOARD
// =======================================
function listarClientesDashboard() {
    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    renderizarTabelaDashboard(clientes);
}

// =======================================
// FUNÇÃO DE PESQUISA (FILTRO)
// =======================================
function filtrarClientes() {
    const termo = document.getElementById("campoPesquisa").value.toLowerCase();
    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];

    const clientesFiltrados = clientes.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(termo)) || 
        (c.documento && c.documento.toLowerCase().includes(termo)) ||
        (c.telefone && c.telefone.toLowerCase().includes(termo))
    );

    renderizarTabelaDashboard(clientesFiltrados);
}

// =======================================
// AUXILIAR: RENDERIZAR LINHAS DA TABELA
// =======================================
function renderizarTabelaDashboard(lista) {
    const tabela = document.getElementById("tabelaDashboard");
    if (!tabela) return;

    tabela.innerHTML = "";

    if (lista.length === 0) {
        tabela.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Nenhum cliente encontrado.</td></tr>";
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
                <td><span class="status ${stClasse}">${cliente.status}</span></td>
            </tr>
        `;
    });
}