async function login() {
    const usuario = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, senha })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("usuarioAtivo", JSON.stringify(data.usuario));
            localStorage.setItem("logado", "true");
            window.location.href = "dashboard.html";
        } else {
            alert(data.message || "Usuário ou senha inválidos!");
        }
    } catch (error) {
        alert("Erro ao conectar com o servidor.");
    }
}

function verificarLogin() {
    const logado = localStorage.getItem("logado");
    const token = localStorage.getItem("token");
    if (logado !== "true" || !token) {
        window.location.href = "index.html";
        return;
    }
    const user = JSON.parse(localStorage.getItem("usuarioAtivo"));
    const menuAdmin = document.getElementById("menuUsuarios");
    if (menuAdmin) {
        menuAdmin.style.display = (user.perfil === "admin") ? "block" : "none";
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}