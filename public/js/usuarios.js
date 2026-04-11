// =======================================
// 🔐 PEGAR TOKEN
// =======================================
function getToken() {
    return localStorage.getItem("token");
}

// =======================================
// ⏳ LOADING
// =======================================
function mostrarLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "flex";
}

function esconderLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "none";
}


// =======================================
// 📋 LISTAR USUÁRIOS (ADMIN)
// =======================================
async function listarUsuarios() {

    const tabela = document.getElementById("tabelaUsuarios");
    if (!tabela) return;

     mostrarLoading();

    tabela.innerHTML = "";

    try {

        const response = await fetch("/api/usuarios", {
            headers: { "Authorization": "Bearer " + getToken() }
        });

        if (!response.ok) {
            tabela.innerHTML = "<tr><td colspan='4'>Acesso negado</td></tr>";
            return;
        }

        const usuarios = await response.json();

        if (usuarios.length === 0) {
            tabela.innerHTML = "<tr><td colspan='4'>Nenhum usuário cadastrado</td></tr>";
            return;
        }

        usuarios.forEach((user) => {
            tabela.innerHTML += `
                <tr>
                    <td>${user.nome}</td>
                    <td>${user.usuario}</td>
                    <td><span class="status ${user.perfil}">${user.perfil.toUpperCase()}</span></td>
                    <td>
                        ${user.usuario !== "admin"
                    ? `
                            <div class="td-acoes">
                                <button class="btn-primary" style="background:#f59e0b;"
                                    onclick="prepararEdicao('${user._id}','${user.nome}','${user.usuario}','${user.perfil}')">
                                    Editar
                                </button>
                                <button class="btn-danger"
                                    onclick="excluirUsuario('${user._id}')">
                                    Excluir
                                </button>
                            </div>
                            `
                    : "<small>Sistema (Mestre)</small>"
                }
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Erro:", error);
        tabela.innerHTML = "<tr><td colspan='4'>Erro ao carregar usuários</td></tr>";
    } finally {
        esconderLoading(); 
    }
}
// =======================================
// ABRIR MODAL NOVO
// =======================================
function abrirModal() {

    document.getElementById("modalUsuario").style.display = "flex";
    document.getElementById("uTitulo").innerText = "Novo Usuário";

    document.getElementById("editId").value = "";
    document.getElementById("uNome").value = "";
    document.getElementById("uLogin").value = "";
    document.getElementById("uSenha").value = "";
    document.getElementById("uPerfil").value = "user";
}

// =======================================
// PREPARAR EDIÇÃO
// =======================================
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

// =======================================
// SALVAR USUÁRIO
// =======================================
async function salvarUsuario() {

     mostrarLoading();
    const id = document.getElementById("editId").value;
    const nome = document.getElementById("uNome").value;
    const login = document.getElementById("uLogin").value;
    const senha = document.getElementById("uSenha").value;
    const perfil = document.getElementById("uPerfil").value;

    if (!nome || !login) {
        toast.aviso("Preencha os campos obrigatórios");
        return;
    }

    const dados = { nome, usuario: login, perfil };
    if (senha) dados.senha = senha;

    try {

        let response;

        if (id === "") {
            response = await fetch("/api/usuarios", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + getToken()
                },
                body: JSON.stringify(dados)
            });
        } else {
            response = await fetch(`/api/usuarios/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + getToken()
                },
                body: JSON.stringify(dados)
            });
        }

        const resultado = await response.json();

        if (!response.ok) {
            toast.erro(resultado.message || "Erro ao salvar");
            return;
        }

        fecharModal();
        listarUsuarios();

    } catch (error) {
        console.error("Erro:", error);
        toast.erro("Erro ao salvar usuário");
    } finally {
        esconderLoading(); // 👈 AQUI
    }
}
// =======================================
// EXCLUIR
// =======================================
async function excluirUsuario(id) {

    const confirmado = await toastConfirm("Deseja excluir este usuário?");
    if (!confirmado) return;

    mostrarLoading();
    await fetch(`/api/usuarios/${id}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + getToken() }
    });

    listarUsuarios();

     esconderLoading(); 
}

// =======================================
// 🌙 DARK MODE
// =======================================
function toggleDark() {
    document.body.classList.toggle("dark");

    // salva preferência
    if (document.body.classList.contains("dark")) {
        localStorage.setItem("tema", "dark");
    } else {
        localStorage.setItem("tema", "light");
    }
}

// aplicar tema salvo ao carregar.
window.addEventListener("load", () => {
    const tema = localStorage.getItem("tema");

    if (tema === "dark") {
        document.body.classList.add("dark");
    }
});