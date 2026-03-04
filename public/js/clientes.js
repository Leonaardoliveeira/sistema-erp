// =======================================
// 🔐 PEGAR TOKEN
// =======================================
function getToken() {
    return localStorage.getItem("token");
}

// =======================================
// 📡 SALVAR NOVO CLIENTE
// =======================================
async function salvarCliente() {

    const nome = document.getElementById("nome").value;
    const documento = document.getElementById("documento").value;
    const email = document.getElementById("email").value;
    const telefone = document.getElementById("telefone").value;
    const regime = document.getElementById("regime").value;

    if (!nome) {
        alert("O nome é obrigatório!");
        return;
    }

    try {

        const response = await fetch("/api/clientes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify({ nome, documento, email, telefone, regime })
        });

        if (!response.ok) {
            const msg = await response.json();
            alert(msg.message || "Erro ao salvar cliente");
            return;
        }

        alert("Cliente cadastrado com sucesso!");
        window.location.href = "clientes.html";

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao conectar ao servidor");
    }
}

// =======================================
// 📋 LISTAR CLIENTES (apenas do usuário logado)
// =======================================
async function listarClientes() {

    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    tabela.innerHTML = "";

    try {

        const response = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });

        const clientes = await response.json();

        if (clientes.length === 0) {
            tabela.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhum cliente cadastrado.</td></tr>`;
            return;
        }

        clientes.forEach((cliente) => {

            const st = cliente.status?.toLowerCase() || "pendente";

            tabela.innerHTML += `
                <tr>
                    <td>${cliente.nome}</td>
                    <td>${cliente.documento || "-"}</td>
                    <td>${cliente.regime || "-"}</td>
                    <td>
                        <div class="status-botoes">
                            <button class="btn-status pendente ${st === 'pendente' ? 'ativo' : ''}" 
                                onclick="alterarStatusCliente('${cliente._id}', 'Pendente')">Pendente</button>

                            <button class="btn-status gerado ${st === 'gerado' ? 'ativo' : ''}" 
                                onclick="alterarStatusCliente('${cliente._id}', 'Gerado')">Gerado</button>

                            <button class="btn-status erro ${st === 'erro' ? 'ativo' : ''}" 
                                onclick="alterarStatusCliente('${cliente._id}', 'Erro')">Erro</button>
                        </div>
                    </td>
                    <td>
                        <button class="btn-primary" style="background-color: #f59e0b; margin-right: 5px;" 
                            onclick="abrirModalEdicao('${cliente._id}', '${cliente.nome}', '${cliente.documento || ""}', '${cliente.email || ""}', '${cliente.telefone || ""}', '${cliente.regime || ""}')">Editar</button>

                        <button class="btn-danger" 
                            onclick="excluirCliente('${cliente._id}')">Excluir</button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Erro ao listar clientes:", error);
    }
}

// =======================================
// ✏️ ABRIR MODAL EDIÇÃO
// =======================================
function abrirModalEdicao(id, nome, documento, email, telefone, regime) {
    document.getElementById("editId").value = id;
    document.getElementById("editNome").value = nome;
    document.getElementById("editDocumento").value = documento;
    document.getElementById("editEmail").value = email;
    document.getElementById("editTelefone").value = telefone;
    document.getElementById("editRegime").value = regime;

    document.getElementById("modalEdicao").style.display = "flex";
}

// =======================================
// 💾 SALVAR EDIÇÃO
// =======================================
async function salvarEdicao() {

    const id = document.getElementById("editId").value;

    const dadosAtualizados = {
        nome: document.getElementById("editNome").value,
        documento: document.getElementById("editDocumento").value,
        email: document.getElementById("editEmail").value,
        telefone: document.getElementById("editTelefone").value,
        regime: document.getElementById("editRegime").value
    };

    try {

        await fetch(`/api/clientes/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify(dadosAtualizados)
        });

        alert("Cliente atualizado!");
        fecharModal();
        listarClientes();

    } catch (error) {
        console.error("Erro ao atualizar:", error);
        alert("Não foi possível atualizar o cliente");
    }
}

// =======================================
// 🔄 ALTERAR STATUS
// =======================================
async function alterarStatusCliente(id, novoStatus) {

    try {
        await fetch(`/api/clientes/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify({ status: novoStatus })
        });

        listarClientes();
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
    }
}

// =======================================
// 🗑 EXCLUIR CLIENTE
// =======================================
async function excluirCliente(id) {

    if (!confirm("Deseja excluir este cliente?")) return;

    try {
        await fetch(`/api/clientes/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + getToken() }
        });

        listarClientes();
    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        alert("Não foi possível excluir o cliente");
    }
}