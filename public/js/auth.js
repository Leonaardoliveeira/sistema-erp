// =======================================
// 🔐 LOGIN USANDO API
// =======================================

async function login() {
    const usuarioInput = document.getElementById("usuario").value;
    const senhaInput = document.getElementById("senha").value;

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput })
        });

        const data = await response.json();

        if (!response.ok) {
            toast.erro(data.message || "Erro ao fazer login");
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erro no login:", error);
        toast.erro("Erro ao conectar ao servidor");
    }
}

// =======================================
// 🔎 VERIFICAR SE ESTÁ LOGADO
// =======================================
function verificarLogin() {
    const token = localStorage.getItem("token");
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!token || !usuario) {
        window.location.href = "index.html";
        return;
    }

    // Esconde menu de usuários se não for admin
    const menuAdmin = document.getElementById("menuUsuarios");
    if (menuAdmin) {
        menuAdmin.style.display = usuario.perfil === "admin" ? "block" : "none";
    }
}

// =======================================
// 🙋‍♂️ USUÁRIO LOGADO
// =======================================
function mostrarUsuarioLogado() {
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (usuario) {

        // 🔤 Nome
        const nomeElemento = document.getElementById("usuarioLogado");
        if (nomeElemento) {
            nomeElemento.innerText = usuario.nome;
        }

        // 🎯 Perfil (TRADUZIDO)
        const cargoElemento = document.querySelector(".user-role");
        if (cargoElemento) {

            const perfis = {
                admin: "Administrador",
                user: "Usuário"
            };

            const perfilFormatado = perfis[usuario.perfil] || usuario.perfil;

            cargoElemento.innerText = perfilFormatado;
        }

        // 🧠 GERAR INICIAIS
        const partesNome = usuario.nome.trim().split(" ");
        let iniciais = "";

        if (partesNome.length === 1) {
            iniciais = partesNome[0][0];
        } else {
            iniciais =
                partesNome[0][0] +
                partesNome[partesNome.length - 1][0];
        }

        iniciais = iniciais.toUpperCase();

        // 🖼️ Atualizar avatar
        const avatar = document.getElementById("userAvatar");

        if (avatar) {
            avatar.src = `https://ui-avatars.com/api/?name=${iniciais}&background=0D8ABC&color=fff&bold=true`;
        }
    }
}
// =======================================
// 🚪 LOGOUT
// =======================================
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
}