// =======================================
// 🔐 LOGIN
// =======================================
async function login() {
    const usuarioInput = document.getElementById("usuario").value;
    const senhaInput   = document.getElementById("senha").value;

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput })
        });

        const data = await response.json();

        if (!response.ok) {
            toast.erro(data.message || "Erro ao fazer login");
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erro no login:", error);
        toast.erro("Erro ao conectar ao servidor");
    }
}

// =======================================
// 🔎 VERIFICAR LOGIN + CONTROLE DE MENU
// =======================================
function verificarLogin() {
    const token   = localStorage.getItem("token");
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!token || !usuario) {
        window.location.href = "index.html";
        return;
    }

    // Menu "Usuários" — somente master
    const menuUsuarios = document.getElementById("menuUsuarios");
    if (menuUsuarios) {
        menuUsuarios.style.display = (usuario.perfil === "master" || usuario.perfil === "admin") ? "" : "none";
    }

    // Agenda alerta de SPED pendentes uma vez por dia
    agendarAlertaSped();
}

// =======================================
// 🔔 ALERTA DIÁRIO — SPED PENDENTES
// =======================================
async function agendarAlertaSped() {
    const hoje = new Date().toDateString();
    const ultimoAlerta = localStorage.getItem("ultimoAlertaSped");

    // Só exibe uma vez por dia
    if (ultimoAlerta === hoje) return;

    try {
        const token = localStorage.getItem("token");
        const res   = await fetch("/api/alertas/sped-pendentes", {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) return;

        const { total } = await res.json();

        if (total > 0) {
            // Pequeno delay para o toast aparecer depois do carregamento da página
            setTimeout(() => {
                toast.aviso(
                    total === 1
                        ? "⚠️ Há 1 cliente com SPED pendente este mês!"
                        : "⚠️ Há " + total + " clientes com SPED pendente este mês!",
                    7000
                );
            }, 1200);

            localStorage.setItem("ultimoAlertaSped", hoje);
        }
    } catch (e) {
        // silencioso — alerta é não-crítico
    }
}

// =======================================
// 🙋 MOSTRAR USUÁRIO LOGADO
// =======================================
function mostrarUsuarioLogado() {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    if (!usuario) return;

    const nomeEl = document.getElementById("usuarioLogado");
    if (nomeEl) nomeEl.innerText = usuario.nome;

    const roleEl = document.querySelector(".user-role");
    if (roleEl) {
        const labels = { master: "Mestre", admin: "Administrador", user: "Usuário" };
        roleEl.innerText = labels[usuario.perfil] || usuario.perfil;
    }

    const partesNome = usuario.nome.trim().split(" ");
    const iniciais = partesNome.length === 1
        ? partesNome[0][0]
        : partesNome[0][0] + partesNome[partesNome.length - 1][0];

    const avatar = document.getElementById("userAvatar");
    if (avatar) {
        avatar.src = "https://ui-avatars.com/api/?name=" + iniciais.toUpperCase() + "&background=0D8ABC&color=fff&bold=true";
    }
}

// =======================================
// 🚪 LOGOUT
// =======================================
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
}
