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
        if (!response.ok) { toast.erro(data.message || "Erro ao fazer login"); return; }
        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));
        window.location.href = "dashboard.html";
    } catch (error) {
        toast.erro("Erro ao conectar ao servidor");
    }
}

function verificarLogin() {
    const token   = localStorage.getItem("token");
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    if (!token || !usuario) { window.location.href = "index.html"; return; }

    const menuUsuarios = document.getElementById("menuUsuarios");
    if (menuUsuarios) {
        menuUsuarios.style.display =
            (usuario.perfil === "master" || usuario.perfil === "admin") ? "" : "none";
    }
    // Oculta link de Backup para quem não tem permissão
    const menuBackup = document.getElementById("menuBackup");
    if (menuBackup) {
        if (usuario.perfil === "master" || usuario.acessoBackup) {
            menuBackup.style.display = "";
        } else {
            menuBackup.style.display = "none";
        }
    }
    agendarAlertasSped();
}

// =======================================
// ALERTA SPED — dispara nos horários configurados
// =======================================
async function agendarAlertasSped() {
    try {
        const token = localStorage.getItem("token");

        // Busca configuração do usuário
        const cfgRes = await fetch("/api/alertas/config", {
            headers: { "Authorization": "Bearer " + token }
        });
        const cfg = cfgRes.ok ? await cfgRes.json() : { ativo: true, horarios: ["08:00"] };
        if (!cfg.ativo) return;

        const horarios = cfg.horarios || ["08:00"];

        // Verifica quais horários ainda não foram exibidos hoje
        const hoje        = new Date().toDateString();
        const exibidosRaw = localStorage.getItem("alertasSpedExibidos");
        let exibidos      = {};
        try { exibidos = JSON.parse(exibidosRaw) || {}; } catch(e) {}
        // Limpa registros de outros dias
        if (exibidos._dia !== hoje) exibidos = { _dia: hoje };

        const agora     = new Date();
        const minAgora  = agora.getHours() * 60 + agora.getMinutes();

        // Para cada horário configurado, verifica se já passou e ainda não foi exibido
        for (const h of horarios) {
            const [hh, mm] = h.split(":").map(Number);
            const minAlerta = hh * 60 + mm;
            if (minAgora >= minAlerta && !exibidos[h]) {
                await exibirAlertaSped(token, h, exibidos, hoje);
            }
        }

        // Agenda verificação a cada 60 segundos para pegar novos horários
        setTimeout(agendarAlertasSped, 60000);

    } catch(e) { /* silencioso */ }
}

async function exibirAlertaSped(token, horario, exibidos, hoje) {
    try {
        const res = await fetch("/api/alertas/sped-pendentes", {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) return;
        const { total } = await res.json();
        if (total > 0) {
            setTimeout(() => {
                toast.aviso(
                    total === 1
                        ? "⚠️ Há 1 cliente com SPED pendente!"
                        : "⚠️ Há " + total + " clientes com SPED pendente!",
                    8000
                );
            }, 800);
        }
        exibidos[horario] = true;
        localStorage.setItem("alertasSpedExibidos", JSON.stringify(exibidos));
    } catch(e) {}
}

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

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
}
