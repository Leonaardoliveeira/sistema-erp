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
// 📡 FUNÇÃO PADRÃO REQUEST
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
// 📋 LISTAR CLIENTES
// =======================================

async function listarClientes() {

    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    tabela.innerHTML = "";

    const response = await apiRequest("/api/clientes");

    if (!response) return;

    if (!response.ok) {
        console.error("Erro ao buscar clientes");
        return;
    }

    const clientes = await response.json();

    if (clientes.length === 0) {
        tabela.innerHTML =
            "<tr><td colspan='3' style='text-align:center;'>Nenhum cliente cadastrado.</td></tr>";
        return;
    }

    clientes.forEach((cliente) => {

        const statusAtual = cliente.status || "Pendente";
        const classe = statusAtual.toLowerCase();

        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>

                <td>
                    <span class="status ${classe}">
                        ${statusAtual}
                    </span>
                </td>

                <td>
                    <select onchange="alterarStatus('${cliente._id}', this.value)">
                        <option value="Pendente" ${statusAtual === "Pendente" ? "selected" : ""}>Pendente</option>
                        <option value="Gerado" ${statusAtual === "Gerado" ? "selected" : ""}>Gerado</option>
                        <option value="Erro" ${statusAtual === "Erro" ? "selected" : ""}>Erro</option>
                    </select>
                </td>
            </tr>
        `;
    });
}


// =======================================
// 🔄 ALTERAR STATUS
// =======================================

async function alterarStatus(id, novoStatus) {

    const response = await apiRequest(`/api/clientes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: novoStatus })
    });

    if (!response) return;

    if (!response.ok) {
        alert("Erro ao atualizar status");
        return;
    }

    listarClientes();
}