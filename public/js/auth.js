// Função para criar o admin inicial se o sistema for novo
(function inicializarAdmin() {
    let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    if (usuarios.length === 0) {
        usuarios.push({
            nome: "Administrador",
            usuario: "admin",
            senha: "123",
            perfil: "admin"
        });
        localStorage.setItem("usuarios", JSON.stringify(usuarios));
    }
})();

function login() {
    const usuarioInput = document.getElementById("usuario").value;
    const senhaInput = document.getElementById("senha").value;
    let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    const userFound = usuarios.find(u => u.usuario === usuarioInput && u.senha === senhaInput);

    if (userFound) {
        localStorage.setItem("logado", "true");
        localStorage.setItem("usuarioAtivo", JSON.stringify(userFound));
        window.location.href = "dashboard.html";
    } else {
        alert("Usuário ou senha inválidos!");
    }
}

function verificarLogin() {
    const logado = localStorage.getItem("logado");
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));

    if (logado !== "true" || !usuarioAtivo) {
        window.location.href = "index.html";
        return;
    }

    // TRAVA DE MENU: Esconde "Cadastro de Usuários" para quem não é admin
    const menuAdmin = document.getElementById("menuUsuarios");
    if (menuAdmin) {
        menuAdmin.style.display = (usuarioAtivo.perfil === "admin") ? "block" : "none";
    }
}

function logout() {
    localStorage.removeItem("logado");
    localStorage.removeItem("usuarioAtivo");
    window.location.href = "index.html";
}