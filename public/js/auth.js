const API_URL = "https://sistema-erp-32e0.onrender.com";

async function login() {
    const usuarioInput = document.getElementById("usuario").value;
    const senhaInput = document.getElementById("senha").value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("logado", "true");
            localStorage.setItem("usuarioAtivo", JSON.stringify(data.user));
            window.location.href = "dashboard.html";
        } else {
            alert("Usuário ou senha incorretos no servidor.");
        }
    } catch (error) {
        alert("Não foi possível conectar ao servidor Render.");
    }
}

function verificarLogin() {
    if (localStorage.getItem("logado") !== "true") {
        window.location.href = "index.html";
    }
}