function salvarCliente() {
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    
    // BLOQUEIO DE SEGURANÇA
    if (usuarioAtivo.perfil !== "admin") {
        alert("Atenção: Apenas administradores podem cadastrar novos clientes.");
        return;
    }

    const nome = document.getElementById("nome").value;
    const documento = document.getElementById("documento").value;
    const email = document.getElementById("email").value;
    const telefone = document.getElementById("telefone").value;
    const regime = document.getElementById("regime").value;

    if (!nome) {
        alert("O nome é obrigatório!");
        return;
    }

    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    clientes.push({
        nome, documento, email, telefone, regime,
        status: "Pendente",
        codigo: Date.now()
    });

    localStorage.setItem("clientes", JSON.stringify(clientes));
    alert("Cliente cadastrado com sucesso!");
    window.location.href = "clientes.html";
}

function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    const isAdmin = usuarioAtivo.perfil === "admin";

    tabela.innerHTML = "";

    clientes.forEach((cliente, index) => {
        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento}</td>
                <td>${cliente.regime}</td>
                <td><span class="status ${cliente.status.toLowerCase()}">${cliente.status}</span></td>
                <td>
                    ${isAdmin ? `
                        <button class="btn-primary" style="background-color: #f59e0b; margin-right: 5px;" onclick="prepararEdicao(${index})">Editar</button>
                        <button class="btn-danger" onclick="excluirCliente(${index})">Excluir</button>
                    ` : `<span style="color: #6b7280; font-size: 12px;">Visualização</span>`}
                </td>
            </tr>`;
    });
}

function excluirCliente(index) {
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    if (usuarioAtivo.perfil !== "admin") return; // Dupla checagem

    if (confirm("Deseja excluir este cliente?")) {
        let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
        clientes.splice(index, 1);
        localStorage.setItem("clientes", JSON.stringify(clientes));
        listarClientes();
    }
}