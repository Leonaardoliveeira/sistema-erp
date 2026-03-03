// =======================================
// 🔐 VERIFICAR TOKEN
// =======================================

function getToken() {
    return localStorage.getItem("token");
}

function verificarAutenticacao() {
    if (!getToken()) {
        window.location.href = "index.html";
    }
}

verificarAutenticacao();


// =======================================
// 📡 FUNÇÃO PADRÃO DE REQUISIÇÃO
// =======================================

async function apiRequest(url, options = {}) {

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken(),
            ...options.headers
        }
    });

    if (response.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        localStorage.clear();
        window.location.href = "index.html";
        return null;
    }

    return response;
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

    const response = await apiRequest("/api/clientes", {
        method: "POST",
        body: JSON.stringify({
            nome,
            documento,
            email,
            telefone,
            regime
        })
    });

    if (!response) return;

    if (!response.ok) {
        alert("Erro ao salvar cliente");
        return;
    }

    alert("Cliente cadastrado com sucesso!");
    window.location.href = "clientes.html";
}


// =======================================
// 📋 LISTAR CLIENTES
// =======================================

async function listarClientes() {

    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    tabela.innerHTML = "";

    const response = await apiRequest("/api/clientes");

    if (!response) return;

    const clientes = await response.json();

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
}


// =======================================
// ✏️ ABRIR MODAL
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

    const response = await apiRequest(`/api/clientes/${id}`, {
        method: "PUT",
        body: JSON.stringify(dadosAtualizados)
    });

    if (!response) return;

    alert("Cliente atualizado!");
    fecharModal();
    listarClientes();
}


// =======================================
// 🔄 ALTERAR STATUS
// =======================================

async function alterarStatusCliente(id, novoStatus) {

    const response = await apiRequest(`/api/clientes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: novoStatus })
    });

    if (!response) return;

    listarClientes();
}


// =======================================
// 🗑 EXCLUIR
// =======================================

async function excluirCliente(id) {

    if (!confirm("Deseja excluir este cliente?")) return;

    const response = await apiRequest(`/api/clientes/${id}`, {
        method: "DELETE"
    });

    if (!response) return;

    listarClientes();
}