// =======================================
// 🔐 LOGIN E GESTÃO DE ACESSO
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
            alert(data.message || "Erro ao fazer login");
            return;
        }

        // Importante: O objeto data.usuario deve conter o _id do banco de dados
        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));

        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao conectar ao servidor");
    }
}

// Função utilitária global para obter o ID do utilizador logado
function getUsuarioId() {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    return usuario ? usuario._id : null;
}

function verificarLogin() {
    const token = localStorage.getItem("token");
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!token || !usuario) {
        window.location.href = "index.html";
        return;
    }

    const menuAdmin = document.getElementById("menuUsuarios");
    if (menuAdmin) {
        menuAdmin.style.display = (usuario.perfil === "admin") ? "block" : "none";
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}