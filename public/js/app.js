function getToken() { return localStorage.getItem("token"); }
function getUsuarioId() {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    return usuario ? usuario._id : null;
}

async function buscarClientes() {
    try {
        const response = await fetch(`/api/clientes?usuarioId=${getUsuarioId()}`, {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        return await response.json();
    } catch (error) {
        return [];
    }
}

async function carregarDashboard() {
    const clientes = await buscarClientes();

    document.getElementById("totalClientes").innerText = clientes.length;
    document.getElementById("gerados").innerText = clientes.filter(c => c.status === "Gerado").length;
    document.getElementById("pendentes").innerText = clientes.filter(c => c.status === "Pendente").length;
    document.getElementById("erros").innerText = clientes.filter(c => c.status === "Erro").length;

    renderizarTabelaDashboard(clientes);
}

function renderizarTabelaDashboard(lista) {
    const tabela = document.getElementById("tabelaDashboard");
    if (!tabela) return;
    tabela.innerHTML = lista.map(cliente => `
        <tr>
            <td>${cliente.nome}</td>
            <td>${cliente.documento || "-"}</td>
            <td>${cliente.regime || "-"}</td>
            <td>${cliente.telefone || "-"}</td>
            <td><span class="status ${cliente.status?.toLowerCase() || 'pendente'}">${cliente.status || 'Pendente'}</span></td>
        </tr>
    `).join("");
}