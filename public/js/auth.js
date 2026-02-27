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

// LOGIN ATUALIZADO PARA CONSULTAR O BANCO DE USUÁRIOS
function login() {
    const usuarioInput = document.getElementById("usuario").value;
    const senhaInput = document.getElementById("senha").value;
    
    let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    
    // Busca o usuário correspondente
    const userFound = usuarios.find(u => u.usuario === usuarioInput && u.senha === senhaInput);

    if (userFound) {
        localStorage.setItem("logado", "true");
        localStorage.setItem("usuarioAtivo", JSON.stringify(userFound)); // Salva os dados do login
        window.location.href = "dashboard.html";
    } else {
        alert("Usuário ou senha inválidos!");
    }
}

// VERIFICA LOGIN E LIBERA BOTÕES DE ADMIN
function verificarLogin() {
    const logado = localStorage.getItem("logado");
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));

    if (logado !== "true" || !usuarioAtivo) {
        window.location.href = "index.html";
        return;
    }

    // Se o perfil for admin, exibe o link na sidebar e botões extras
    if (usuarioAtivo.perfil === "admin") {
        const menuAdmin = document.getElementById("menuUsuarios");
        if (menuAdmin) {
            menuAdmin.style.display = "block"; // Mostra o botão na sidebar
        }
    }
}

function logout() {
    localStorage.removeItem("logado");
    localStorage.removeItem("usuarioAtivo");
    window.location.href = "index.html";
}