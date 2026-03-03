// =======================================
// LISTAR CLIENTES (VINDO DO BACKEND)
// =======================================
async function listarClientes() {

    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    tabela.innerHTML = "";

    try {
        const response = await apiFetch("/api/clientes", {
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
        console.error("Erro ao listar clientes:", error);
    }
}

// =======================================
// ALTERAR STATUS NO BANCO
// =======================================
async function alterarStatus(id, novoStatus) {

    try {
        await apiFetch(`/api/clientes/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify({ status: novoStatus })
        });

        listarClientes(); // Atualiza tabela

    } catch (error) {
        console.error("Erro ao atualizar status:", error);
    }
}