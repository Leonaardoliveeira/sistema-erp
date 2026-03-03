function getToken() {
    return localStorage.getItem("token");
}

// =======================
// LISTAR USUÁRIOS
// =======================
async function listarUsuarios() {
    const tabela = document.getElementById("tabelaUsuarios");
    if (!tabela) return;

    tabela.innerHTML = "";

    try {
        const response = await fetch("/api/usuarios", {
            headers: {
                "Authorization": "Bearer " + getToken()
            }
        });

        const usuarios = await response.json();

        usuarios.forEach((user) => {
            tabela.innerHTML += `
                <tr>
                    <td>${user.nome}</td>
                    <td>${user.usuario}</td>
                    <td><span class="status ${user.perfil}">${user.perfil.toUpperCase()}</span></td>
                    <td>
                        ${user.usuario !== 'admin' 
                            ? `<button class="btn-primary" style="background-color: #f59e0b; margin-right: 5px;" 
                                    onclick="prepararEdicao('${user._id}', '${user.nome}', '${user.usuario}', '${user.perfil}')">Editar</button>
                               <button class="btn-danger" 
                                    onclick="excluirUsuario('${user._id}')">Excluir</button>` 
                            : '<small>Sistema (Mestre)</small>'}
                    </td>
                </tr>`;
        });
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
    }
}

// =======================
// SALVAR (NOVO OU EDITAR)
// =======================
async function salvarUsuario() {
    const id = document.getElementById("uId").value;
    const nome = document.getElementById("uNome").value;
    const login = document.getElementById("uLogin").value;
    const senha = document.getElementById("uSenha").value;
    const perfil = document.getElementById("uPerfil").value;

    if (!nome || !login) {
        alert("Preencha os campos obrigatórios.");
        return;
    }

    const dados = { nome, usuario: login, perfil };
    if (senha) dados.senha = senha;

    try {
        const url = id === "" ? "/api/usuarios" : `/api/usuarios/${id}`;
        const metodo = id === "" ? "POST" : "PUT";

        await fetch(url, {
            method: metodo,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify(dados)
        });

        fecharModal();
        listarUsuarios();
    } catch (error) {
        console.error("Erro ao salvar usuário:", error);
    }
}