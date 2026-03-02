// Função auxiliar para simplificar as chamadas com Token
const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    
    options.headers = { ...defaultHeaders, ...options.headers };
    const response = await fetch(url, options);
    if (response.status === 401) logout(); // Se o token expirou, desloga
    return response;
};

async function salvarCliente() {
    const dados = {
        nome: document.getElementById("nome").value,
        documento: document.getElementById("documento").value,
        email: document.getElementById("email").value,
        telefone: document.getElementById("telefone").value,
        regime: document.getElementById("regime").value,
        status: "Pendente"
    };

    if (!dados.nome) return alert("Nome é obrigatório");

    const res = await apiFetch('/api/clientes', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

    if (res.ok) {
        alert("Cliente salvo no Banco de Dados!");
        window.location.href = "clientes.html";
    }
}

async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    const res = await apiFetch('/api/clientes');
    const clientes = await res.json();

    tabela.innerHTML = "";
    clientes.forEach(c => {
        tabela.innerHTML += `
            <tr>
                <td>${c.nome}</td>
                <td>${c.documento || '-'}</td>
                <td>${c.regime || '-'}</td>
                <td><span class="status ${c.status.toLowerCase()}">${c.status}</span></td>
                <td>
                    <button class="btn-danger" onclick="excluirCliente('${c._id}')">Excluir</button>
                </td>
            </tr>`;
    });
}

async function excluirCliente(id) {
    if (!confirm("Deseja excluir?")) return;
    const res = await apiFetch(`/api/clientes/${id}`, { method: 'DELETE' });
    if (res.ok) listarClientes();
}