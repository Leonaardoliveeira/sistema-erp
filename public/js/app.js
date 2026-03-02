async function carregarDashboard() {
    const res = await apiFetch('/api/clientes');
    const clientes = await res.json();

    document.getElementById("totalClientes").innerText = clientes.length;
    document.getElementById("gerados").innerText = clientes.filter(c => c.status === "Gerado").length;
    document.getElementById("pendentes").innerText = clientes.filter(c => c.status === "Pendente").length;
    document.getElementById("erros").innerText = clientes.filter(c => c.status === "Erro").length;

    renderizarTabelaDashboard(clientes);
}

function renderizarTabelaDashboard(lista) {
    const tabela = document.getElementById("tabelaDashboard");
    if (!tabela) return;
    tabela.innerHTML = lista.map(c => `
        <tr>
            <td>${c.nome}</td>
            <td>${c.documento || "-"}</td>
            <td>${c.regime || "-"}</td>
            <td>${c.telefone || "-"}</td>
            <td><span class="status ${c.status.toLowerCase()}">${c.status}</span></td>
        </tr>
    `).join('');
}