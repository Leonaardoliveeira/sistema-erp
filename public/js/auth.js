// =======================================
// 🔐 PEGAR TOKEN
// =======================================
function getToken() {
    return localStorage.getItem("token");
}

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
            body: JSON.stringify({
                usuario: usuarioInput,
                senha: senhaInput
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Erro ao fazer login");
            return;
        }

        // Salva token e dados do usuário
        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao conectar ao servidor");
    }
}

// =======================================
// 🔎 VERIFICAR SE ESTÁ LOGADO
// =======================================
function verificarLogin() {

    const token = getToken();
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!token || !usuario) {
        window.location.href = "index.html";
        return;
    }

    // Esconde menu de usuários se não for admin
    const menuAdmin = document.getElementById("menuUsuarios");
    if (menuAdmin) menuAdmin.style.display = (usuario.perfil === "admin") ? "block" : "none";
}

// =======================================
// 🚪 LOGOUT
// =======================================
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
}