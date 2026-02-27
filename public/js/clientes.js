// =======================================
// SALVAR NOVO CLIENTE
// =======================================
function salvarCliente() {
    const nome = document.getElementById("nome").value;
    const documento = document.getElementById("documento").value;
    const email = document.getElementById("email").value;
    const telefone = document.getElementById("telefone").value;
    const regime = document.getElementById("regime").value;
    // Captura se o cliente gera SPED (campo adicionado no HTML abaixo)
    const geraSped = document.getElementById("geraSped") ? document.getElementById("geraSped").checked : false;

    if (!nome) {
        alert("O nome é obrigatório!");
        return;
    }

    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    
    const novoCliente = {
        nome,
        documento,
        email,
        telefone,
        regime,
        geraSped,
        status: "Pendente",
        codigo: Date.now() // Gera um ID único para o tarefas.js
    };

    clientes.push(novoCliente);
    localStorage.setItem("clientes", JSON.stringify(clientes));

    alert("Cliente cadastrado com sucesso!");
    window.location.href = "clientes.html";
}

// =======================================
// LISTAR CLIENTES (TELA CLIENTES.HTML)
// =======================================
function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    tabela.innerHTML = "";

    clientes.forEach((cliente, index) => {
        const st = cliente.status ? cliente.status.toLowerCase() : "pendente";
        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento || "-"}</td>
                <td>${cliente.regime || "-"}</td>
                <td>
                    <div class="status-botoes">
                        <button class="btn-status pendente ${st === 'pendente' ? 'ativo' : ''}" onclick="alterarStatusCliente(${index}, 'Pendente')">Pendente</button>
                        <button class="btn-status gerado ${st === 'gerado' ? 'ativo' : ''}" onclick="alterarStatusCliente(${index}, 'Gerado')">Gerado</button>
                        <button class="btn-status erro ${st === 'erro' ? 'ativo' : ''}" onclick="alterarStatusCliente(${index}, 'Erro')">Erro</button>
                    </div>
                </td>
                <td>
                    <button class="btn-primary" onclick="abrirModal(${index})">Editar</button>
                    <button class="btn-danger" onclick="excluirCliente(${index})">Excluir</button>
                </td>
            </tr>`;
    });
}

// =======================================
// MODAL DE EDIÇÃO
// =======================================
function abrirModal(index) {
    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    const cliente = clientes[index];

    document.getElementById("editIndex").value = index;
    document.getElementById("modalNome").value = cliente.nome || "";
    document.getElementById("modalDocumento").value = cliente.documento || "";
    document.getElementById("modalEmail").value = cliente.email || "";
    document.getElementById("modalTelefone").value = cliente.telefone || "";
    document.getElementById("modalRegime").value = cliente.regime || "";
    
    if(document.getElementById("modalGeraSped")) {
        document.getElementById("modalGeraSped").checked = cliente.geraSped || false;
    }

    document.getElementById("modalEditar").style.display = "flex";
}

function fecharModal() {
    document.getElementById("modalEditar").style.display = "none";
}

function salvarEdicao() {
    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    const index = document.getElementById("editIndex").value;

    clientes[index].nome = document.getElementById("modalNome").value;
    clientes[index].documento = document.getElementById("modalDocumento").value;
    clientes[index].email = document.getElementById("modalEmail").value;
    clientes[index].telefone = document.getElementById("modalTelefone").value;
    clientes[index].regime = document.getElementById("modalRegime").value;
    
    if(document.getElementById("modalGeraSped")) {
        clientes[index].geraSped = document.getElementById("modalGeraSped").checked;
    }

    localStorage.setItem("clientes", JSON.stringify(clientes));
    
    fecharModal();
    listarClientes();
}

function excluirCliente(index) {
    if (!confirm("Deseja excluir este cliente?")) return;
    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    clientes.splice(index, 1);
    localStorage.setItem("clientes", JSON.stringify(clientes));
    listarClientes();
}

function alterarStatusCliente(index, novoStatus) {
    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    clientes[index].status = novoStatus;
    localStorage.setItem("clientes", JSON.stringify(clientes));
    listarClientes();
    if(typeof carregarDashboard === "function") carregarDashboard();
}