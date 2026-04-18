function getToken() { return localStorage.getItem("token"); }
function mostrarLoading() { const el = document.getElementById("loading"); if (el) el.style.display = "flex"; }
function esconderLoading() { const el = document.getElementById("loading"); if (el) el.style.display = "none"; }

const LABELS_PERFIL = { master: "Mestre", admin: "Administrador", user: "Usuário" };

// =======================================
// LISTAR USUÁRIOS
// =======================================
async function listarUsuarios() {
    const tabela = document.getElementById("tabelaUsuarios");
    if (!tabela) return;
    mostrarLoading();
    tabela.innerHTML = "";
    try {
        const response = await fetch("/api/usuarios", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!response.ok) {
            tabela.innerHTML = "<tr><td colspan='4' style='text-align:center;padding:20px;'>Acesso negado</td></tr>";
            return;
        }
        const usuarios = await response.json();
        if (usuarios.length === 0) {
            tabela.innerHTML = "<tr><td colspan='4' style='text-align:center;padding:20px;'>Nenhum usuário cadastrado</td></tr>";
            return;
        }
        usuarios.forEach((user) => {
            const labelPerfil = LABELS_PERFIL[user.perfil] || user.perfil;
            tabela.innerHTML += `
                <tr>
                    <td data-label="Nome">${user.nome}</td>
                    <td data-label="Usuário">${user.usuario}</td>
                    <td data-label="Perfil"><span class="status ${user.perfil}">${labelPerfil}</span></td>
                    <td class="td-acoes-cell">
                        ${user.usuario !== "admin"
                            ? `<div class="td-acoes">
                                <button class="btn-primary" style="background:#f59e0b;"
                                    onclick="prepararEdicao('${user._id}','${user.nome}','${user.usuario}','${user.perfil}')">Editar</button>
                                <button class="btn-danger" onclick="excluirUsuario('${user._id}')">Excluir</button>
                               </div>`
                            : "<small>Sistema (Mestre)</small>"
                        }
                    </td>
                </tr>`;
        });
    } catch (error) {
        tabela.innerHTML = "<tr><td colspan='4' style='text-align:center;padding:20px;'>Erro ao carregar</td></tr>";
    } finally {
        esconderLoading();
    }
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
// CONFIG DE ALERTAS SPED
// =======================================
async function carregarConfigAlertas() {
    try {
        const res = await fetch("/api/alertas/config", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        const cfg = res.ok ? await res.json() : { horarios: ["08:00"], ativo: true };
        document.getElementById("alertaAtivo").checked = cfg.ativo !== false;
        renderizarHorarios(cfg.horarios || ["08:00"]);
    } catch (e) {
        renderizarHorarios(["08:00"]);
    }
}

function renderizarHorarios(horarios) {
    const container = document.getElementById("listaHorarios");
    if (!container) return;
    container.innerHTML = "";
    horarios.forEach((h, i) => {
        const div = document.createElement("div");
        div.className = "horario-item";
        div.innerHTML = `
            <input type="time" class="input-horario" value="${h}">
            <button type="button" class="btn-remover" onclick="this.parentElement.remove()" ${horarios.length === 1 ? "disabled" : ""}>✕</button>
        `;
        container.appendChild(div);
    });
}

function adicionarHorario() {
    const container = document.getElementById("listaHorarios");
    const total = container.querySelectorAll(".horario-item").length;
    if (total >= 6) { toast.aviso("Máximo de 6 horários permitidos"); return; }
    const div = document.createElement("div");
    div.className = "horario-item";
    div.innerHTML = `
        <input type="time" class="input-horario" value="12:00">
        <button type="button" class="btn-remover" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);
    // Reabilita botão de remover se havia só 1
    container.querySelectorAll(".btn-remover").forEach(b => b.disabled = false);
}

async function salvarConfigAlertas() {
    const ativo    = document.getElementById("alertaAtivo").checked;
    const inputs   = document.querySelectorAll(".input-horario");
    const horarios = [...inputs].map(i => i.value).filter(Boolean);
    if (horarios.length === 0) { toast.aviso("Adicione ao menos um horário"); return; }

    mostrarLoading();
    try {
        const res = await fetch("/api/alertas/config", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ horarios, ativo })
        });
        if (!res.ok) { toast.erro("Erro ao salvar configuração"); return; }
        // Limpa cache de alertas disparados para forçar reavaliação
        const hoje = new Date().toDateString();
        Object.keys(localStorage).filter(k => k.startsWith("alertaSped_")).forEach(k => localStorage.removeItem(k));
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

// =======================================
// CONFIGURAÇÃO DE ALERTAS SPED
// =======================================
let alertaAtivo = true;

async function carregarConfigAlerta() {
    try {
        const res = await fetch("/api/alertas/config", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        if (!res.ok) return;
        const cfg = await res.json();
        alertaAtivo = cfg.ativo !== false;
        atualizarToggle();
        const lista = document.getElementById("listaHorarios");
        if (!lista) return;
        lista.innerHTML = "";
        const horarios = cfg.horarios?.length ? cfg.horarios : ["08:00"];
        horarios.forEach(h => adicionarHorario(h));
        atualizarVisibilidadeHorarios();
    } catch(e) {}
}

function atualizarToggle() {
    const btn = document.getElementById("toggleAlerta");
    if (!btn) return;
    btn.classList.toggle("ativo", alertaAtivo);
    btn.setAttribute("aria-checked", alertaAtivo);
}

function toggleAtivoAlerta() {
    alertaAtivo = !alertaAtivo;
    atualizarToggle();
    atualizarVisibilidadeHorarios();
}

function atualizarVisibilidadeHorarios() {
    const wrap = document.getElementById("alertaHorariosWrap");
    if (wrap) wrap.style.opacity = alertaAtivo ? "1" : "0.4";
}

function adicionarHorario(valor = "08:00") {
    const lista = document.getElementById("listaHorarios");
    if (!lista) return;
    const total = lista.querySelectorAll(".horario-item").length;
    if (total >= 6) { toast.aviso("Máximo de 6 horários por dia"); return; }
    const div = document.createElement("div");
    div.className = "horario-item";
    div.innerHTML = `
        <input type="time" class="input-horario" value="${valor}">
        <button type="button" class="btn-remover-horario" onclick="this.parentElement.remove()" title="Remover">
            <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>`;
    lista.appendChild(div);
    if (window.lucide) lucide.createIcons();
}

async function salvarConfigAlerta() {
    const horarioEls = document.querySelectorAll(".input-horario");
    const horarios   = [...horarioEls].map(el => el.value).filter(Boolean);
    if (alertaAtivo && horarios.length === 0) {
        toast.aviso("Adicione pelo menos um horário");
        return;
    }
    try {
        const res = await fetch("/api/alertas/config", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ ativo: alertaAtivo, horarios })
        });
        if (res.ok) {
            // Limpa cache de alertas do dia para reprocessar com nova config
            localStorage.removeItem("alertasSpedExibidos");
            toast.sucesso("Configuração de alertas salva!");
        } else {
            toast.erro("Erro ao salvar configuração");
        }
    } catch(e) { toast.erro("Erro ao salvar"); }
}
