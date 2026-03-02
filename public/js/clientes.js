// Configuração dos headers com o Token de autenticação
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// =======================================
// LISTAR CLIENTES (Com Seletor de Status)
// =======================================
async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    try {
        const response = await fetch('/api/clientes', { headers: getHeaders() });
        const clientes = await response.json();

        tabela.innerHTML = ""; // Limpa a tabela

        clientes.forEach(cliente => {
            const statusClass = cliente.status ? cliente.status.toLowerCase() : "pendente";
            
            tabela.innerHTML += `
                <tr>
                    <td>${cliente.nome}</td>
                    <td>${cliente.documento || "-"}</td>
                    <td>${cliente.regime || "-"}</td>
                    <td>
                        <select class="status-select ${statusClass}" onchange="alterarStatus('${cliente._id}', this.value)">
                            <option value="Pendente" ${cliente.status === "Pendente" ? "selected" : ""}>Pendente</option>
                            <option value="Gerado" ${cliente.status === "Gerado" ? "selected" : ""}>Gerado</option>
                            <option value="Erro" ${cliente.status === "Erro" ? "selected" : ""}>Erro</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn-primary" style="background-color: #f59e0b; margin-right: 5px;" onclick="prepararEdicao('${cliente._id}')">Editar</button>
                        <button class="btn-danger" onclick="excluirCliente('${cliente._id}')">Excluir</button>
                    </td>
                </tr>`;
        });
    } catch (err) {
        console.error("Erro ao carregar clientes do MongoDB:", err);
    }
}

// =======================================
// ALTERAR STATUS NO BANCO DE DADOS
// =======================================
async function alterarStatus(id, novoStatus) {
    try {
        const response = await fetch(`/api/clientes/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ status: novoStatus })
        });

        if (response.ok) {
            console.log("Status atualizado no MongoDB");
            listarClientes(); // Recarrega para aplicar as cores do CSS se houver
        } else {
            alert("Erro ao atualizar status. Verifique suas permissões.");
        }
    } catch (err) {
        console.error("Erro na requisição:", err);
    }
}

// =======================================
// SALVAR NOVO CLIENTE
// =======================================
async function salvarCliente() {
    const nome = document.getElementById("nome").value;
    const documento = document.getElementById("documento").value;
    const email = document.getElementById("email").value;
    const telefone = document.getElementById("telefone").value;
    const regime = document.getElementById("regime").value;

    if (!nome) return alert("O nome é obrigatório!");

    const dados = { nome, documento, email, telefone, regime, status: "Pendente" };

    try {
        const res = await fetch('/api/clientes', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(dados)
        });

        if (res.ok) {
            alert("Cliente cadastrado no Banco de Dados!");
            window.location.href = "clientes.html";
        }
    } catch (err) {
        alert("Erro ao salvar cliente.");
    }
}

// =======================================
// EXCLUIR CLIENTE
// =======================================
async function excluirCliente(id) {
    if (!confirm("Deseja excluir este cliente permanentemente?")) return;

    try {
        const res = await fetch(`/api/clientes/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (res.ok) {
            listarClientes();
        }
    } catch (err) {
        alert("Erro ao excluir.");
    }
}

// Funções de Modal (Permanecem iguais)
function fecharModal() {
    document.getElementById("modalEdicao").style.display = "none";
}