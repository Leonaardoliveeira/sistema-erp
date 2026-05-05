function getToken() { return localStorage.getItem("token"); }
function mostrarLoading() { const el = document.getElementById("loading"); if (el) el.style.display = "flex"; }
function esconderLoading() { const el = document.getElementById("loading"); if (el) el.style.display = "none"; }

const LABELS_PERFIL = { master: "Mestre", admin: "Administrador", user: "Usuário" };

// =======================================
// LISTAR USUÁRIOS
// =======================================
async function listarUsuarios() {
    const tabela  = document.getElementById("tabelaUsuarios");
    if (!tabela) return;
    mostrarLoading();
    tabela.innerHTML = "";

    const usuarioLogado = JSON.parse(localStorage.getItem("usuario"));
    const isMaster = usuarioLogado?.perfil === "master";

    try {
        const url = isMaster ? "/api/backup-permissoes" : "/api/usuarios";
        const response = await fetch(url, { headers: { "Authorization": "Bearer " + getToken() } });
        if (!response.ok) {
            tabela.innerHTML = "<tr><td colspan='6' style='text-align:center;padding:20px;'>Acesso negado</td></tr>";
            return;
        }
        const usuarios = await response.json();
        if (!usuarios.length) {
            tabela.innerHTML = "<tr><td colspan='6' style='text-align:center;padding:20px;'>Nenhum usuário cadastrado</td></tr>";
            return;
        }

        usuarios.forEach(user => {
            const labelPerfil = LABELS_PERFIL[user.perfil] || user.perfil;
            const ehMaster    = user.usuario === "admin" || user.perfil === "master";

            let colVer, colEditar;
            if (ehMaster) {
                colVer    = '<span style="font-size:11px;color:var(--text-muted);">Sempre</span>';
                colEditar = '<span style="font-size:11px;color:var(--text-muted);">Sempre</span>';
            } else if (isMaster) {
                const chkV = (user.visualizar || user.editar) ? "checked" : "";
                const chkE = user.editar ? "checked" : "";
                colVer    = `<label class="toggle-switch"><input type="checkbox" ${chkV} onchange="alterarPermBackup('${user._id}','visualizar',this)"><span class="toggle-slider"></span></label>`;
                colEditar = `<label class="toggle-switch"><input type="checkbox" ${chkE} onchange="alterarPermBackup('${user._id}','editar',this)"><span class="toggle-slider"></span></label>`;
            } else {
                colVer    = '<span style="font-size:11px;color:var(--text-muted);">—</span>';
                colEditar = '<span style="font-size:11px;color:var(--text-muted);">—</span>';
            }

            tabela.innerHTML += `
                <tr id="urow-${user._id}">
                    <td data-label="Nome">${user.nome}</td>
                    <td data-label="Usuário">${user.usuario}</td>
                    <td data-label="Perfil"><span class="status ${user.perfil}">${labelPerfil}</span></td>
                    <td data-label="Backup: Ver">${colVer}</td>
                    <td data-label="Backup: Editar">${colEditar}</td>
                    <td class="td-acoes-cell">
                        ${!ehMaster
                            ? `<div class="td-acoes">
                                <button class="btn-primary" style="background:#f59e0b;" onclick="prepararEdicao('${user._id}','${user.nome}','${user.usuario}','${user.perfil}')">Editar</button>
                                <button class="btn-danger" onclick="excluirUsuario('${user._id}')">Excluir</button>
                               </div>`
                            : "<small>Sistema (Mestre)</small>"
                        }
                    </td>
                </tr>`;
        });
    } catch (error) {
        tabela.innerHTML = "<tr><td colspan='6' style='text-align:center;padding:20px;'>Erro ao carregar</td></tr>";
    } finally {
        esconderLoading();
    }
}

async function alterarPermBackup(uid, campo, el) {
    const row    = document.getElementById("urow-" + uid);
    const checks = row ? [...row.querySelectorAll("input[type=checkbox]")] : [];
    let visualizar = checks[0]?.checked || false;
    let editar     = checks[1]?.checked || false;
    if (campo === "editar" && editar)          { if(checks[0]) checks[0].checked = true; visualizar = true; }
    if (campo === "visualizar" && !visualizar) { if(checks[1]) checks[1].checked = false; editar = false; }
    try {
        const r = await fetch("/api/backup-permissoes/" + uid, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ visualizar, editar })
        });
        if (!r.ok) { toast.erro("Erro ao alterar permissão"); listarUsuarios(); return; }
        const desc = [visualizar && "Ver", editar && "Editar"].filter(Boolean).join(" + ");
        toast.sucesso(desc ? "Permissão Backup: " + desc + "!" : "Permissão de Backup revogada!");
    } catch(e) { toast.erro("Erro"); listarUsuarios(); }
}

// =======================================
// MODAL USUÁRIO
// =======================================
function abrirModal() {
    document.getElementById("modalUsuario").style.display = "flex";
    document.getElementById("uTitulo").innerText = "Novo Usuário";
    document.getElementById("editId").value  = "";
    document.getElementById("uNome").value   = "";
    document.getElementById("uLogin").value  = "";
    document.getElementById("uSenha").value  = "";
    document.getElementById("uPerfil").value = "user";
}

function prepararEdicao(id, nome, login, perfil) {
    document.getElementById("editId").value  = id;
    document.getElementById("uNome").value   = nome;
    document.getElementById("uLogin").value  = login;
    document.getElementById("uSenha").value  = "";
    document.getElementById("uPerfil").value = perfil;
    document.getElementById("uTitulo").innerText = "Editar Usuário";
    document.getElementById("modalUsuario").style.display = "flex";
}

function fecharModal() {
    document.getElementById("modalUsuario").style.display = "none";
}

async function salvarUsuario() {
    mostrarLoading();
    const id     = document.getElementById("editId").value;
    const nome   = document.getElementById("uNome").value;
    const login  = document.getElementById("uLogin").value;
    const senha  = document.getElementById("uSenha").value;
    const perfil = document.getElementById("uPerfil").value;
    if (!nome || !login) { esconderLoading(); toast.aviso("Preencha os campos obrigatórios"); return; }
    const dados = { nome, usuario: login, perfil };
    if (senha) dados.senha = senha;
    try {
        const url    = id ? "/api/usuarios/" + id : "/api/usuarios";
        const method = id ? "PUT" : "POST";
        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify(dados)
        });
        const resultado = await response.json();
        if (!response.ok) { toast.erro(resultado.message || "Erro ao salvar"); return; }
        toast.sucesso(id ? "Usuário atualizado!" : "Usuário criado!");
        fecharModal();
        listarUsuarios();
    } catch (error) {
        toast.erro("Erro ao salvar usuário");
    } finally {
        esconderLoading();
    }
}

async function excluirUsuario(id) {
    const confirmado = await toastConfirm("Deseja excluir este usuário?");
    if (!confirmado) return;
    mostrarLoading();
    try {
        await fetch("/api/usuarios/" + id, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + getToken() }
        });
        toast.sucesso("Usuário removido");
        listarUsuarios();
    } catch (e) {
        toast.erro("Erro ao excluir");
    } finally {
        esconderLoading();
    }
}

// =======================================
// CONFIGURAÇÃO DE ALERTAS SPED
// =======================================
async function carregarConfigAlertas() {
    try {
        const res = await fetch("/api/alertas/config", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        const cfg = res.ok ? await res.json() : { horarios: ["08:00"], ativo: true };

        // toggle ativo/inativo
        const toggle = document.getElementById("alertaAtivo");
        if (toggle) toggle.checked = cfg.ativo !== false;

        // renderizar horários
        renderizarHorarios(cfg.horarios?.length ? cfg.horarios : ["08:00"]);
        atualizarOpacidadeHorarios();
    } catch (e) {
        renderizarHorarios(["08:00"]);
    }
}

function renderizarHorarios(horarios) {
    const container = document.getElementById("listaHorarios");
    if (!container) return;
    container.innerHTML = "";
    horarios.forEach((h) => adicionarCampoHorario(h, horarios.length === 1));
}

function adicionarCampoHorario(valor = "08:00", desabilitarRemover = false) {
    const container = document.getElementById("listaHorarios");
    if (!container) return;
    const total = container.querySelectorAll(".horario-item").length;
    if (total >= 6) { toast.aviso("Máximo de 6 horários permitidos"); return; }

    const div = document.createElement("div");
    div.className = "horario-item";
    div.innerHTML = `
        <input type="time" class="input-horario" value="${valor}">
        <button type="button" class="btn-remover-horario" title="Remover"
            onclick="removerHorario(this)" ${desabilitarRemover ? "disabled" : ""}>✕</button>
    `;
    container.appendChild(div);

    // Reabilita todos os botões de remover se agora há mais de 1
    const items = container.querySelectorAll(".horario-item");
    if (items.length > 1) {
        items.forEach(item => {
            item.querySelector(".btn-remover-horario").disabled = false;
        });
    }
}

function removerHorario(btn) {
    const container = document.getElementById("listaHorarios");
    const items = container.querySelectorAll(".horario-item");
    if (items.length <= 1) return; // nunca remove o último
    btn.parentElement.remove();
    // Se ficou só 1, desabilita o botão de remover
    const restantes = container.querySelectorAll(".horario-item");
    if (restantes.length === 1) {
        restantes[0].querySelector(".btn-remover-horario").disabled = true;
    }
}

function atualizarOpacidadeHorarios() {
    const toggle = document.getElementById("alertaAtivo");
    const wrap   = document.getElementById("alertaHorariosWrap");
    if (wrap && toggle) wrap.style.opacity = toggle.checked ? "1" : "0.45";
}

async function salvarConfigAlertas() {
    const toggle   = document.getElementById("alertaAtivo");
    const ativo    = toggle ? toggle.checked : true;
    const inputs   = document.querySelectorAll(".input-horario");
    const horarios = [...inputs].map(i => i.value).filter(Boolean);

    if (ativo && horarios.length === 0) { toast.aviso("Adicione ao menos um horário"); return; }

    mostrarLoading();
    try {
        const res = await fetch("/api/alertas/config", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ horarios, ativo })
        });
        if (!res.ok) { toast.erro("Erro ao salvar configuração"); return; }
        // Limpa cache para forçar reavaliação dos alertas
        localStorage.removeItem("alertasSpedExibidos");
        toast.sucesso("Configuração de alertas salva!");
    } catch (e) {
        toast.erro("Erro ao salvar");
    } finally {
        esconderLoading();
    }
}

// =======================================
// DARK MODE
// =======================================
function toggleDark() {
    document.body.classList.toggle("dark");
    localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light");
}
window.addEventListener("load", () => {
    if (localStorage.getItem("tema") === "dark") document.body.classList.add("dark");
});
