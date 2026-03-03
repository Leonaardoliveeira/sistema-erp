function getUsuarioId() {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    return usuario ? usuario._id : null;
}

async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    tabela.innerHTML = "";

    try {
        // Filtra os clientes pelo usuário logado para gestão de arquivos
        const response = await fetch(`/api/clientes?usuarioId=${getUsuarioId()}`, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("token")
            }
        });

        const clientes = await response.json();

        clientes.forEach((cliente) => {
            tabela.innerHTML += `
                <tr>
                    <td>${cliente.nome}</td>
                    <td><span class="status ${cliente.status?.toLowerCase() || "pendente"}">
                        ${cliente.status || "Pendente"}
                    </span></td>
                    <td>
                        <select onchange="alterarStatus('${cliente._id}', this.value)">
                            <option ${cliente.status === "Pendente" ? "selected" : ""}>Pendente</option>
                            <option ${cliente.status === "Gerado" ? "selected" : ""}>Gerado</option>
                            <option ${cliente.status === "Erro" ? "selected" : ""}>Erro</option>
                        </select>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Erro ao listar clientes para arquivos:", error);
    }
}

async function alterarStatus(id, novoStatus) {
    try {
        await fetch(`/api/clientes/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify({ status: novoStatus })
        });
        listarClientes(); 
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
    }
}