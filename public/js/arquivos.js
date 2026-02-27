function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    tabela.innerHTML = "";

    clientes.forEach((cliente, index) => {
        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>
                    <span class="status ${cliente.status}">
                        ${cliente.status}
                    </span>
                </td>
                <td>
                    <select onchange="alterarStatus(${index}, this.value)">
                        <option ${cliente.status === "Pendente" ? "selected" : ""}>Pendente</option>
                        <option ${cliente.status === "Gerado" ? "selected" : ""}>Gerado</option>
                        <option ${cliente.status === "Erro" ? "selected" : ""}>Erro</option>
                    </select>
                </td>
            </tr>
        `;
    });
}

function alterarStatus(index, novoStatus) {
    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    clientes[index].status = novoStatus;
    localStorage.setItem("clientes", JSON.stringify(clientes));
    listarClientes();
}