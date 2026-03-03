// =======================================
// CARREGAR DADOS DO DASHBOARD
// =======================================
function carregarDashboard() {
    if (typeof verificarViradaDeMes === "function") {
        verificarViradaDeMes();
    }

    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    const todosClientes = JSON.parse(localStorage.getItem("clientes")) || [];

    // FILTRO: Pega apenas os clientes que pertencem ao usuário logado
    const meusClientes = todosClientes.filter(c => c.usuarioDono === usuarioAtivo.usuario);

    // Atualiza os cards numéricos usando apenas os meus clientes
    document.getElementById("totalClientes").innerText = meusClientes.length;
    document.getElementById("gerados").innerText = meusClientes.filter(c => c.status === "Gerado").length;
    document.getElementById("pendentes").innerText = meusClientes.filter(c => c.status === "Pendente").length;
    document.getElementById("erros").innerText = meusClientes.filter(c => c.status === "Erro").length;

    // Chama a listagem passando apenas os meus clientes para a tabela
    renderizarTabelaDashboard(meusClientes);
}

// =======================================
// LISTAGEM PADRÃO NO DASHBOARD
// =======================================
function listarClientesDashboard() {
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    const todosClientes = JSON.parse(localStorage.getItem("clientes")) || [];
    
    // Filtra para garantir que a tabela inicial mostre apenas os do usuário
    const meusClientes = todosClientes.filter(c => c.usuarioDono === usuarioAtivo.usuario);
    renderizarTabelaDashboard(meusClientes);
}

// =======================================
// FUNÇÃO DE PESQUISA (FILTRO)
// =======================================
function filtrarClientes() {
    const termo = document.getElementById("campoPesquisa").value.toLowerCase();
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    const todosClientes = JSON.parse(localStorage.getItem("clientes")) || [];

    // Primeiro filtra por dono, depois pelo termo de pesquisa
    const filtrados = todosClientes.filter(c => {
        const ehMeu = c.usuarioDono === usuarioAtivo.usuario;
        const bateComBusca = (c.nome && c.nome.toLowerCase().includes(termo)) || 
                             (c.documento && c.documento.toLowerCase().includes(termo));
        return ehMeu && bateComBusca;
    });

    renderizarTabelaDashboard(filtrados);
}

// =======================================
// AUXILIAR: RENDERIZAR LINHAS DA TABELA
// =======================================
function renderizarTabelaDashboard(lista) {
    const tabela = document.getElementById("tabelaDashboard");
    if (!tabela) return;

    tabela.innerHTML = "";

    if (lista.length === 0) {
        tabela.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Nenhum cliente cadastrado por você.</td></tr>";
        return;
    }

    // O visual permanece o mesmo do seu arquivo original
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