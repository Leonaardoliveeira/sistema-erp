async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    const response = await fetch('/api/clientes', { headers: getHeaders() });
    const clientes = await response.json();

    tabela.innerHTML = "";
    clientes.forEach(cliente => {
        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td><span class="status ${cliente.status.toLowerCase()}">${cliente.status}</span></td>
                <td>
                    <select onchange="alterarStatus('${cliente._id}', this.value)">
                        <option value="Pendente" ${cliente.status === "Pendente" ? "selected" : ""}>Pendente</option>
                        <option value="Gerado" ${cliente.status === "Gerado" ? "selected" : ""}>Gerado</option>
                        <option value="Erro" ${cliente.status === "Erro" ? "selected" : ""}>Erro</option>
                    </select>
                </td>
            </tr>`;
    });
}

async function alterarStatus(id, novoStatus) {
    await fetch(`/api/clientes/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: novoStatus })
    });
    listarClientes(); // Atualiza a cor do status na hora
}