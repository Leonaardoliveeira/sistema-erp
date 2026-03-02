const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    try {
        const response = await fetch('/api/clientes', { headers: getHeaders() });
        const clientes = await response.json();

        tabela.innerHTML = "";
        clientes.forEach(cliente => {
            const statusClass = cliente.status ? cliente.status.toLowerCase() : "pendente";
            tabela.innerHTML += `
                <tr>
                    <td>${cliente.nome}</td>
                    <td>${cliente.documento || "-"}</td>
                    <td>${cliente.regime || "-"}</td>
                    <td><span class="status ${statusClass}">${cliente.status || 'Pendente'}</span></td>
                    <td>
                        <button class="btn-primary" style="background-color: #f59e0b;" onclick="prepararEdicao('${cliente._id}')">Editar</button>
                        <button class="btn-danger" onclick="excluirCliente('${cliente._id}')">Excluir</button>
                    </td>
                </tr>`;
        });
    } catch (err) {
        console.error("Erro ao carregar clientes:", err);
    }
}

async function salvarCliente() {
    const dados = {
        nome: document.getElementById("nome").value,
        documento: document.getElementById("documento").value,
        email: document.getElementById("email").value,
        telefone: document.getElementById("telefone").value,
        regime: document.getElementById("regime").value,
        status: "Pendente"
    };

    const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(dados)
    });

    if (res.ok) {
        alert("Cliente salvo!");
        window.location.href = "clientes.html";
    }
}

async function excluirCliente(id) {
    if (!confirm("Excluir este cliente?")) return;
    await fetch(`/api/clientes/${id}`, { method: 'DELETE', headers: getHeaders() });
    listarClientes();
}