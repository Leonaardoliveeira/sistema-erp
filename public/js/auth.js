// =======================================
// 🔐 LOGIN
// =======================================

async function login() {

    const usuarioInput = document.getElementById("usuario").value.trim();
    const senhaInput = document.getElementById("senha").value.trim();

    if (!usuarioInput || !senhaInput) {
        alert("Preencha usuário e senha.");
        return;
    }

    try {

        const response = await apiFetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                usuario: usuarioInput,
                senha: senhaInput
            })
        });

        // ⚠️ Verifica se a resposta é JSON válida
        let data;
        try {
            data = await response.json();
        } catch {
            alert("Erro inesperado no servidor.");
            return;
        }

        if (!response.ok) {
            alert(data.erro || "Usuário ou senha inválidos.");
            return;
        }

        // ✅ Salva token e dados do usuário
        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao conectar com o servidor.");
    }
}


// =======================================
// 🔎 VERIFICAR LOGIN
// =======================================

function verificarLogin() {

    const token = localStorage.getItem("token");
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!token || !usuario) {
        window.location.href = "index.html";
        return;
    }

    // 🔐 Controle de menu admin
    const menuAdmin = document.getElementById("menuUsuarios");

    if (menuAdmin) {
        menuAdmin.style.display =
            usuario.perfil === "admin" ? "block" : "none";
    }
}


// =======================================
// 📡 FUNÇÃO AUXILIAR PARA REQUISIÇÕES
// (USE NOS OUTROS JS)
// =======================================

function apiFetch(url, options = {}) {

    const token = localStorage.getItem("token");

    return fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,
            ...options.headers
        }
    });
}


// =======================================
// 🚪 LOGOUT
// =======================================

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
}