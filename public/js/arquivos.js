function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    const isAdmin = usuarioAtivo.perfil === "admin";

    tabela.innerHTML = "";

    clientes.forEach((cliente, index) => {
        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td><span class="status ${cliente.status.toLowerCase()}">${cliente.status}</span></td>
                <td>
                    <select ${!isAdmin ? 'disabled' : ''} onchange="alterarStatus(${index}, this.value)" 
                            style="${!isAdmin ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
                        <option ${cliente.status === "Pendente" ? "selected" : ""}>Pendente</option>
                        <option ${cliente.status === "Gerado" ? "selected" : ""}>Gerado</option>
                        <option ${cliente.status === "Erro" ? "selected" : ""}>Erro</option>
                    </select>
                </td>
            </tr>`;
    });
}

function alterarStatus(index, novoStatus) {
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    if (usuarioAtivo.perfil !== "admin") return;

    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    clientes[index].status = novoStatus;
    localStorage.setItem("clientes", JSON.stringify(clientes));
    listarClientes();
}