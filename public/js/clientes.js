// =======================================
// SALVAR NOVO CLIENTE (Página cadastro.html)
// =======================================
function salvarCliente() {
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    
    if (!usuarioAtivo) {
        alert("Sessão inválida. Faça login novamente.");
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

    let todosClientes = JSON.parse(localStorage.getItem("clientes")) || [];

    // O SEGREDO: Adicionamos o 'usuarioDono' para amarrar ao ID de quem cadastrou
    todosClientes.push({
        codigo: Date.now(), // ID único do cliente
        nome,
        documento,
        email,
        telefone,
        regime,
        status: "Pendente",
        usuarioDono: usuarioAtivo.usuario // AMARRAÇÃO AQUI
    });

    localStorage.setItem("clientes", JSON.stringify(todosClientes));
    alert("Cliente cadastrado com sucesso!");
    window.location.href = "clientes.html";
}

// =======================================
// LISTAR CLIENTES (Página clientes.html)
// =======================================
function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    const todosClientes = JSON.parse(localStorage.getItem("clientes")) || [];
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));

    // FILTRO: Só exibe o que pertence ao usuário logado
    const meusClientes = todosClientes.filter(c => c.usuarioDono === usuarioAtivo.usuario);

    tabela.innerHTML = "";

    meusClientes.forEach((cliente) => {
        // Buscamos o index real na lista completa para que as funções de editar/excluir funcionem
        const indexOriginal = todosClientes.findIndex(c => c.codigo === cliente.codigo);
        const st = cliente.status ? cliente.status.toLowerCase() : "pendente";

        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento || "-"}</td>
                <td>${cliente.regime || "-"}</td>
                <td>
                    <div class="status-botoes">
                        <button class="btn-status pendente ${st === 'pendente' ? 'ativo' : ''}" 
                            onclick="alterarStatusCliente(${indexOriginal}, 'Pendente')">Pendente</button>
                        <button class="btn-status gerado ${st === 'gerado' ? 'ativo' : ''}" 
                            onclick="alterarStatusCliente(${indexOriginal}, 'Gerado')">Gerado</button>
                        <button class="btn-status erro ${st === 'erro' ? 'ativo' : ''}" 
                            onclick="alterarStatusCliente(${indexOriginal}, 'Erro')">Erro</button>
                    </div>
                </td>
                <td>
                    <button class="btn-primary" style="background-color: #f59e0b; margin-right: 5px;" 
                        onclick="abrirModalEdicao(${indexOriginal})">Editar</button>
                    <button class="btn-danger" 
                        onclick="excluirCliente(${indexOriginal})">Excluir</button>
                </td>
            </tr>`;
    });
}

// As funções abrirModalEdicao, salvarEdicao, alterarStatusCliente e excluirCliente 
// permanecem iguais às originais, pois agora recebem o indexOriginal da lista total.

// =======================================
// LÓGICA DO MODAL DE EDIÇÃO (Página clientes.html)
// =======================================
function abrirModalEdicao(index) {
    const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    const cliente = clientes[index];

    document.getElementById("editIndex").value = index;
    document.getElementById("editNome").value = cliente.nome;
    document.getElementById("editDocumento").value = cliente.documento || "";
    document.getElementById("editEmail").value = cliente.email || "";
    document.getElementById("editTelefone").value = cliente.telefone || "";
    document.getElementById("editRegime").value = cliente.regime || "";

    document.getElementById("modalEdicao").style.display = "flex";
}

function salvarEdicao() {
    const index = document.getElementById("editIndex").value;
    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];

    clientes[index].nome = document.getElementById("editNome").value;
    clientes[index].documento = document.getElementById("editDocumento").value;
    clientes[index].email = document.getElementById("editEmail").value;
    clientes[index].telefone = document.getElementById("editTelefone").value;
    clientes[index].regime = document.getElementById("editRegime").value;

    localStorage.setItem("clientes", JSON.stringify(clientes));
    
    alert("Cliente atualizado!");
    fecharModal();
    listarClientes();
}

// =======================================
// STATUS E EXCLUSÃO
// =======================================
function alterarStatusCliente(index, novoStatus) {
    let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    clientes[index].status = novoStatus;
    localStorage.setItem("clientes", JSON.stringify(clientes));
    listarClientes();
}

function excluirCliente(index) {
    if (confirm("Deseja excluir este cliente?")) {
        let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
        clientes.splice(index, 1);
        localStorage.setItem("clientes", JSON.stringify(clientes));
        listarClientes();
    }
}