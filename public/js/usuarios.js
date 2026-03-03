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
}

// =======================
// ABRIR MODAL NOVO
// =======================
function abrirModal() {

    document.getElementById("modalUsuario").style.display = "flex";
    document.getElementById("uTitulo").innerText = "Novo Acesso";

    document.getElementById("editId").value = "";
    document.getElementById("uNome").value = "";
    document.getElementById("uLogin").value = "";
    document.getElementById("uSenha").value = "";
    document.getElementById("uPerfil").value = "user";
}

// =======================
// PREPARAR EDIÇÃO
// =======================
function prepararEdicao(id, nome, login, perfil) {

    document.getElementById("editId").value = id;
    document.getElementById("uNome").value = nome;
    document.getElementById("uLogin").value = login;
    document.getElementById("uSenha").value = "";
    document.getElementById("uPerfil").value = perfil;

    document.getElementById("uTitulo").innerText = "Editar Usuário";
    document.getElementById("modalUsuario").style.display = "flex";
}

function fecharModal() {
    document.getElementById("modalUsuario").style.display = "none";
}

// =======================
// SALVAR USUÁRIO
// =======================
async function salvarUsuario() {

    const id = document.getElementById("editId").value;
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

    if (id === "") {
        // NOVO
        await fetch("/api/usuarios", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify(dados)
        });
    } else {
        // EDITAR
        await fetch(`/api/usuarios/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify(dados)
        });
    }

    fecharModal();
    listarUsuarios();
}

// =======================
// EXCLUIR
// =======================
async function excluirUsuario(id) {

    if (!confirm("Tem certeza que deseja remover este usuário?")) return;

    await fetch(`/api/usuarios/${id}`, {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + getToken()
        }
    });

    listarUsuarios();
}