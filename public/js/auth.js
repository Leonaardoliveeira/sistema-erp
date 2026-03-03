// =======================================
// 🔐 LOGIN USANDO API
// =======================================

async function login() {

    const usuarioInput = document.getElementById("usuario").value.trim();
    const senhaInput = document.getElementById("senha").value.trim();

    if (!usuarioInput || !senhaInput) {
        alert("Preencha usuário e senha.");
        return;
    }

    try {

        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                usuario: usuarioInput,
                senha: senhaInput
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Usuário ou senha inválidos");
            return;
        }

        // 🔐 Salva token e usuário logado
        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));

        // Redireciona
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao conectar ao servidor.");
    }
}


// =======================================
// 🔎 VERIFICAR LOGIN EM PÁGINAS PROTEGIDAS
// =======================================

function verificarLogin() {

    const token = localStorage.getItem("token");
    const usuarioString = localStorage.getItem("usuario");

    if (!token || !usuarioString) {
        window.location.href = "index.html";
        return;
    }

    const usuario = JSON.parse(usuarioString);

    // 🔐 Controla menu admin
    const menuAdmin = document.getElementById("menuUsuarios");

    if (menuAdmin) {
        menuAdmin.style.display =
            usuario.perfil === "admin" ? "block" : "none";
    }
}


// =======================================
// 🚪 LOGOUT
// =======================================

function logout() {

    localStorage.clear();
    window.location.href = "index.html";
}