// =======================================
// 🔐 TOKEN E PROTEÇÃO
// =======================================

function getToken() {
    return localStorage.getItem("token");
}

function verificarAdminPagina() {

    const token = getToken();
    const usuarioString = localStorage.getItem("usuario");

    if (!token || !usuarioString) {
        window.location.href = "index.html";
        return;
    }

    const usuario = JSON.parse(usuarioString);

    if (usuario.perfil !== "admin") {
        alert("Acesso restrito a administradores.");
        window.location.href = "dashboard.html";
    }
}

verificarAdminPagina();


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

    if (response.status === 403) {
        alert("Você não tem permissão para isso.");
        return null;
    }

    return response;
}


// =======================
// 📋 LISTAR USUÁRIOS
// =======================

async function listarUsuarios() {

    const tabela = document.getElementById("tabelaUsuarios");
    if (!tabela) return;

    tabela.innerHTML = "";

    const response = await apiRequest("/api/usuarios");

    if (!response) return;
    if (!response.ok) {
        console.error("Erro ao buscar usuários");
        return;
    }

    const usuarios = await response.json();

    if (usuarios.length === 0) {
        tabela.innerHTML =
            "<tr><td colspan='4' style='text-align:center;'>Nenhum usuário cadastrado.</td></tr>";
        return;
    }

    usuarios.forEach((user) => {

        tabela.innerHTML += `
            <tr>
                <td>${user.nome}</td>
                <td>${user.usuario}</td>
                <td>
                    <span class="status ${user.perfil}">
                        ${user.perfil.toUpperCase()}
                    </span>
                </td>
                <td>
                    ${user.usuario !== 'admin' 
                        ? `
                        <button class="btn-primary" style="background-color: #f59e0b; margin-right: 5px;" 
                            onclick="prepararEdicao('${user._id}', '${user.nome}', '${user.usuario}', '${user.perfil}')">
                            Editar
                        </button>

                        <button class="btn-danger" 
                            onclick="excluirUsuario('${user._id}')">
                            Excluir
                        </button>
                        `
                        : '<small>Sistema (Mestre)</small>'}
                </td>
            </tr>`;
    });
}


// =======================
// ➕ ABRIR MODAL NOVO
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
// ✏️ PREPARAR EDIÇÃO
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
// 💾 SALVAR USUÁRIO
// =======================

async function salvarUsuario() {

    const id = document.getElementById("editId").value;
    const nome = document.getElementById("uNome").value.trim();
    const login = document.getElementById("uLogin").value.trim();
    const senha = document.getElementById("uSenha").value.trim();
    const perfil = document.getElementById("uPerfil").value;

    if (!nome || !login) {
        alert("Preencha os campos obrigatórios.");
        return;
    }

    const dados = { nome, usuario: login, perfil };
    if (senha) dados.senha = senha;

    let response;

    if (!id) {
        response = await apiRequest("/api/usuarios", {
            method: "POST",
            body: JSON.stringify(dados)
        });
    } else {
        response = await apiRequest(`/api/usuarios/${id}`, {
            method: "PUT",
            body: JSON.stringify(dados)
        });
    }

    if (!response) return;

    if (!response.ok) {
        alert("Erro ao salvar usuário.");
        return;
    }

    fecharModal();
    listarUsuarios();
}


// =======================
// 🗑 EXCLUIR
// =======================

async function excluirUsuario(id) {

    if (!confirm("Tem certeza que deseja remover este usuário?")) return;

    const response = await apiRequest(`/api/usuarios/${id}`, {
        method: "DELETE"
    });

    if (!response) return;

    if (!response.ok) {
        alert("Erro ao excluir usuário.");
        return;
    }

    listarUsuarios();
}