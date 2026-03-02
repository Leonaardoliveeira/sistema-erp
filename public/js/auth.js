// js/auth.js

async function login() {
    const usuarioInput = document.getElementById("usuario").value;
    const senhaInput = document.getElementById("senha").value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput })
        });

        const data = await response.json();

        if (response.ok) {
            // Salva o Token e informações do usuário
            localStorage.setItem("token", data.token);
            localStorage.setItem("usuarioAtivo", JSON.stringify(data.usuario));
            localStorage.setItem("logado", "true");
            window.location.href = "dashboard.html";
        } else {
            alert(data.message || "Erro no login");
        }
    } catch (error) {
        alert("Erro ao conectar com o servidor.");
    }
}

function verificarLogin() {
    const logado = localStorage.getItem("logado");
    const token = localStorage.getItem("token");
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));

    if (logado !== "true" || !token) {
        window.location.href = "index.html";
        return;
    }

    // Controle de menu administrativo
    const menuAdmin = document.getElementById("menuUsuarios");
    if (menuAdmin) {
        menuAdmin.style.display = (usuarioAtivo.perfil === "admin") ? "block" : "none";
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}