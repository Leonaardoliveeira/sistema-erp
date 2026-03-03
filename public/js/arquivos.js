async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    try {
        const response = await fetch(`/api/clientes?usuarioId=${getUsuarioId()}`, {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        const clientes = await response.json();

        tabela.innerHTML = clientes.map(cliente => `
            <tr>
                <td>${cliente.nome}</td>
                <td><span class="status ${cliente.status?.toLowerCase() || "pendente"}">${cliente.status || "Pendente"}</span></td>
                <td>
                    <select onchange="alterarStatus('${cliente._id}', this.value)">
                        <option ${cliente.status === "Pendente" ? "selected" : ""}>Pendente</option>
                        <option ${cliente.status === "Gerado" ? "selected" : ""}>Gerado</option>
                        <option ${cliente.status === "Erro" ? "selected" : ""}>Erro</option>
                    </select>
                </td>
            </tr>
        `).join("");
    } catch (error) { console.error(error); }
}