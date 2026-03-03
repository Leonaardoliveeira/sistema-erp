// ===============================
// 🔐 LOGIN
// ===============================

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
            alert(data.message || "Erro ao fazer login");
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao conectar ao servidor");
    }
}


// ===============================
// 🔎 VERIFICAR LOGIN
// ===============================

function verificarLogin() {

    const token = localStorage.getItem("token");
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!token || !usuario) {
        window.location.href = "index.html";
        return;
    }

    const menuAdmin = document.getElementById("menuUsuarios");

    if (menuAdmin) {
        menuAdmin.style.display =
            usuario.perfil === "admin" ? "block" : "none";
    }
}


// ===============================
// 🚪 LOGOUT
// ===============================

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
}