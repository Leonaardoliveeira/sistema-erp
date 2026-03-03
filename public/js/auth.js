/* ==========================================
   LOGIN
========================================== */
async function login() {
  const usuario = document.getElementById("usuario").value;
  const senha = document.getElementById("senha").value;

  if (!usuario || !senha) {
    alert("Preencha usuário e senha.");
    return;
  }

  try {
    const resposta = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ usuario, senha })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      alert(dados.erro || "Erro no login");
      return;
    }

    // 🔐 Salva token e usuário
    localStorage.setItem("token", dados.token);
    localStorage.setItem("usuarioLogado", JSON.stringify(dados.usuario));

    window.location.href = "dashboard.html";

  } catch (erro) {
    alert("Erro ao conectar com o servidor.");
  }
}

/* ==========================================
   VERIFICAR LOGIN (PROTEÇÃO DE PÁGINAS)
========================================== */
function verificarLogin() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));

  // 🔒 Esconde menu de usuários se não for admin
  const menuAdmin = document.getElementById("menuUsuarios");
  if (menuAdmin && usuario) {
    menuAdmin.style.display =
      usuario.perfil === "admin" ? "block" : "none";
  }
}

/* ==========================================
   LOGOUT
========================================== */
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
}