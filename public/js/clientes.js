function getToken() { return localStorage.getItem("token"); }

async function salvarCliente() {
    const nome = document.getElementById("nome").value;
    const documento = document.getElementById("documento").value;
    const email = document.getElementById("email").value;
    const telefone = document.getElementById("telefone").value;
    const regime = document.getElementById("regime").value;
    const usuarioId = getUsuarioId(); // Pega o ID do utilizador logado

    if (!nome) { alert("O nome é obrigatório!"); return; }

    try {
        const response = await fetch("/api/clientes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify({ nome, documento, email, telefone, regime, usuarioId })
        });

        if (response.ok) {
            alert("Cliente cadastrado com sucesso!");
            window.location.href = "clientes.html";
        }
    } catch (error) { console.error("Erro:", error); }
}

async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;
    tabela.innerHTML = "";

    try {
        // Filtra os clientes enviando o usuarioId como parâmetro
        const response = await fetch(`/api/clientes?usuarioId=${getUsuarioId()}`, {
            headers: { "Authorization": "Bearer " + getToken() }
        });

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
                            <button class="btn-status pendente ${st === 'pendente' ? 'ativo' : ''}" onclick="alterarStatusCliente('${cliente._id}', 'Pendente')">Pendente</button>
                            <button class="btn-status gerado ${st === 'gerado' ? 'ativo' : ''}" onclick="alterarStatusCliente('${cliente._id}', 'Gerado')">Gerado</button>
                            <button class="btn-status erro ${st === 'erro' ? 'ativo' : ''}" onclick="alterarStatusCliente('${cliente._id}', 'Erro')">Erro</button>
                        </div>
                    </td>
                    <td>
                        <button class="btn-primary" onclick="abrirModalEdicao('${cliente._id}', '${cliente.nome}', '${cliente.documento}', '${cliente.email}', '${cliente.telefone}', '${cliente.regime}')">Editar</button>
                        <button class="btn-danger" onclick="excluirCliente('${cliente._id}')">Excluir</button>
                    </td>
                </tr>`;
        });
    } catch (error) { console.error("Erro:", error); }
}