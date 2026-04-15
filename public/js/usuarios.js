function getToken() { return localStorage.getItem("token"); }

function mostrarLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "flex";
}
function esconderLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "none";
}

// Labels legíveis para cada perfil
const LABELS_PERFIL = { master: "Mestre", admin: "Administrador", user: "Usuário" };

// =======================================
// LISTAR USUÁRIOS
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
            tabela.innerHTML = "<tr><td colspan='4' style='text-align:center;padding:20px;'>Acesso negado</td></tr>";
            return;
        }

        const usuarios = await response.json();

        if (usuarios.length === 0) {
            tabela.innerHTML = "<tr><td colspan='4' style='text-align:center;padding:20px;'>Nenhum usuário cadastrado</td></tr>";
            return;
        }

        usuarios.forEach((user) => {
            const labelPerfil = LABELS_PERFIL[user.perfil] || user.perfil;
            tabela.innerHTML += `
                <tr>
                    <td data-label="Nome">${user.nome}</td>
                    <td data-label="Usuário">${user.usuario}</td>
                    <td data-label="Perfil"><span class="status ${user.perfil}">${labelPerfil}</span></td>
                    <td class="td-acoes-cell">
                        ${user.usuario !== "admin"
                            ? `<div class="td-acoes">
                                <button class="btn-primary" style="background:#f59e0b;"
                                    onclick="prepararEdicao('${user._id}','${user.nome}','${user.usuario}','${user.perfil}')">
                                    Editar
                                </button>
                                <button class="btn-danger" onclick="excluirUsuario('${user._id}')">
                                    Excluir
                                </button>
                               </div>`
                            : "<small>Sistema (Mestre)</small>"
                        }
                    </td>
                </tr>`;
        });

    } catch (error) {
        console.error("Erro:", error);
        tabela.innerHTML = "<tr><td colspan='4' style='text-align:center;padding:20px;'>Erro ao carregar usuários</td></tr>";
    } finally {
        esconderLoading();
    }
}

// =======================================
// MODAL NOVO
// =======================================
function abrirModal() {
    document.getElementById("modalUsuario").style.display = "flex";
    document.getElementById("uTitulo").innerText = "Novo Usuário";
    document.getElementById("editId").value  = "";
    document.getElementById("uNome").value   = "";
    document.getElementById("uLogin").value  = "";
    document.getElementById("uSenha").value  = "";
    document.getElementById("uPerfil").value = "user";
}

function prepararEdicao(id, nome, login, perfil) {
    document.getElementById("editId").value  = id;
    document.getElementById("uNome").value   = nome;
    document.getElementById("uLogin").value  = login;
    document.getElementById("uSenha").value  = "";
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

    const id     = document.getElementById("editId").value;
    const nome   = document.getElementById("uNome").value;
    const login  = document.getElementById("uLogin").value;
    const senha  = document.getElementById("uSenha").value;
    const perfil = document.getElementById("uPerfil").value;

    if (!nome || !login) {
        esconderLoading();
        toast.aviso("Preencha os campos obrigatórios");
        return;
    }

    const dados = { nome, usuario: login, perfil };
    if (senha) dados.senha = senha;

    try {
        const url    = id ? "/api/usuarios/" + id : "/api/usuarios";
        const method = id ? "PUT" : "POST";

        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify(dados)
        });

        const resultado = await response.json();

        if (!response.ok) {
            toast.erro(resultado.message || "Erro ao salvar");
            return;
        }

        toast.sucesso(id ? "Usuário atualizado!" : "Usuário criado!");
        fecharModal();
        listarUsuarios();

    } catch (error) {
        console.error("Erro:", error);
        toast.erro("Erro ao salvar usuário");
    } finally {
        esconderLoading();
    }
}

// =======================================
// EXCLUIR
// =======================================
async function excluirUsuario(id) {
    const confirmado = await toastConfirm("Deseja excluir este usuário?");
    if (!confirmado) return;

    mostrarLoading();
    try {
        await fetch("/api/usuarios/" + id, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + getToken() }
        });
        toast.sucesso("Usuário removido");
        listarUsuarios();
    } catch (e) {
        toast.erro("Erro ao excluir");
    } finally {
        esconderLoading();
    }
}

// =======================================
// DARK MODE
// =======================================
function toggleDark() {
    document.body.classList.toggle("dark");
    localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light");
}

window.addEventListener("load", () => {
    if (localStorage.getItem("tema") === "dark") document.body.classList.add("dark");
});
