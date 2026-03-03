function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    const todosClientes = JSON.parse(localStorage.getItem("clientes")) || [];
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));

    // Exibe apenas os que pertencem ao usuário logado
    const meusClientes = todosClientes.filter(c => c.usuarioDono === usuarioAtivo.usuario);

    tabela.innerHTML = "";

    meusClientes.forEach((cliente) => {
        // Encontra o index real no banco de dados para salvar a alteração corretamente
        const indexOriginal = todosClientes.findIndex(c => c.codigo === cliente.codigo);
        
        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td><span class="status ${cliente.status.toLowerCase()}">${cliente.status}</span></td>
                <td>
                    <select onchange="alterarStatus(${indexOriginal}, this.value)">
                        <option ${cliente.status === "Pendente" ? "selected" : ""}>Pendente</option>
                        <option ${cliente.status === "Gerado" ? "selected" : ""}>Gerado</option>
                        <option ${cliente.status === "Erro" ? "selected" : ""}>Erro</option>
                    </select>
                </td>
            </tr>`;
    });
}