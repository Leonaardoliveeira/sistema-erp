function salvarCliente() {
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    
    if (usuarioAtivo.perfil !== "admin") {
        alert("Apenas administradores podem cadastrar novos clientes.");
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
        nome,
        documento,
        email,
        telefone,
        regime,
        status: "Pendente",
        codigo: Date.now()
    });

    localStorage.setItem("clientes", JSON.stringify(clientes));
    alert("Cliente cadastrado com sucesso!");
    window.location.href = "clientes.html";
}

// =======================================
// LISTAR CLIENTES COM BOTÕES DE STATUS
// =======================================

function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    const isAdmin = usuarioAtivo.perfil === "admin";

    tabela.innerHTML = "";

    clientes.forEach((cliente, index) => {
        const st = cliente.status ? cliente.status.toLowerCase() : "pendente";

        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento || "-"}</td>
                <td>${cliente.regime || "-"}</td>
                <td>
                    ${isAdmin ? `
                        <div class="status-botoes">
                            <button class="btn-status pendente ${st === 'pendente' ? 'ativo' : ''}" 
                                onclick="alterarStatusCliente(${index}, 'Pendente')">Pendente</button>
                            
                            <button class="btn-status gerado ${st === 'gerado' ? 'ativo' : ''}" 
                                onclick="alterarStatusCliente(${index}, 'Gerado')">Gerado</button>
                            
                            <button class="btn-status erro ${st === 'erro' ? 'ativo' : ''}" 
                                onclick="alterarStatusCliente(${index}, 'Erro')">Erro</button>
                        </div>
                    ` : `
                        <span class="status ${st}">${cliente.status}</span>
                    `}
                </td>
                <td>
                    ${isAdmin ? `
                        <button class="btn-primary" style="background-color: #f59e0b; margin-right: 5px;" 
                            onclick="prepararEdicao(${index})">Editar</button>
                        
                        <button class="btn-danger" 
                            onclick="excluirCliente(${index})">Excluir</button>
                    ` : `
                        <span style="color: #6b7280; font-size: 12px;">Visualização</span>
                    `}
                </td>
            </tr>`;
    });
}

// =======================================
// ALTERAR STATUS (SOMENTE ADMIN)
// =======================================

function alterarStatusCliente(index, novoStatus) {
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    if (usuarioAtivo.perfil !== "admin") return;

    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    clientes[index].status = novoStatus;

    localStorage.setItem("clientes", JSON.stringify(clientes));
    listarClientes();

    if (typeof carregarDashboard === "function") {
        carregarDashboard();
    }
}

// =======================================
// EXCLUIR CLIENTE
// =======================================

function excluirCliente(index) {
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    if (usuarioAtivo.perfil !== "admin") return;

    if (confirm("Deseja excluir este cliente?")) {
        let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
        clientes.splice(index, 1);
        localStorage.setItem("clientes", JSON.stringify(clientes));
        listarClientes();
    }
}