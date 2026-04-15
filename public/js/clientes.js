function getToken() { return localStorage.getItem("token"); }

function mostrarLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "flex";
}
function esconderLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "none";
}

// =======================================
// FILTRAR CLIENTES (busca na tabela)
// =======================================
function filtrarClientes() {
    const termo = document.getElementById("campoPesquisa")?.value.toLowerCase() || "";
    document.querySelectorAll("#tabelaClientes tr").forEach(linha => {
        linha.style.display = linha.innerText.toLowerCase().includes(termo) ? "" : "none";
    });
}

// =======================================
// SALVAR NOVO CLIENTE
// =======================================
async function salvarCliente() {
    const nome      = document.getElementById("editNome").value.trim();
    const documento = document.getElementById("editDocumento").value;
    const email     = document.getElementById("editEmail").value;
    const telefone  = document.getElementById("editTelefone").value;
    const regime    = document.getElementById("editRegime").value;
    const sped      = document.getElementById("editSped").value;

    if (!nome) { toast.aviso("O nome é obrigatório!"); return; }

    mostrarLoading();

    const acessosRemotos = [];
    document.querySelectorAll("#listaAcessos .acesso").forEach(div => {
        const inputs = div.querySelectorAll("input");
        if (inputs[1]?.value) {
            acessosRemotos.push({ nome: inputs[0].value, anydesk: inputs[1].value });
        }
    });

    try {
        const response = await fetch("/api/clientes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ nome, documento, email, telefone, regime, sped, acessosRemotos })
        });

        if (!response.ok) {
            const erro = await response.json();
            toast.erro(erro.message || "Erro ao salvar cliente");
            return;
        }

        toast.sucesso("Cliente cadastrado com sucesso!");
        fecharModal();

        // Recarrega a lista na página correta (não redireciona)
        if (window.location.pathname.includes("cadastro.html")) {
            listarClientesCadastro();
        } else {
            listarClientes();
        }

    } catch (error) {
        toast.erro("Erro ao conectar ao servidor");
    } finally {
        esconderLoading();
    }
}

// =======================================
// LISTAR CLIENTES — tela Gerenciamento SPED
// =======================================
async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    mostrarLoading();
    tabela.innerHTML = "";

    try {
        const response = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        const clientes = await response.json();
        const clientesSped = clientes.filter(c => c.sped === "Sim");

        if (clientesSped.length === 0) {
            tabela.innerHTML = "<tr><td colspan='5' style='text-align:center;padding:20px;'>Nenhum cliente com SPED cadastrado.</td></tr>";
            return;
        }

        clientesSped.forEach(cliente => {
            const st = (cliente.status || "Pendente").toLowerCase();
            tabela.innerHTML += `
                <tr>
                    <td data-label="Nome">${cliente.nome}</td>
                    <td data-label="Documento">${cliente.documento || "-"}</td>
                    <td data-label="Regime">${cliente.regime || "-"}</td>
                    <td data-label="Status">
                        <div class="status-botoes">
                            <button class="btn-status pendente ${st === 'pendente' ? 'ativo' : ''}" onclick="alterarStatusCliente('${cliente._id}','Pendente')">Pendente</button>
                            <button class="btn-status enviado ${st === 'enviado' ? 'ativo' : ''}" onclick="alterarStatusCliente('${cliente._id}','Enviado')">Enviado</button>
                            <button class="btn-status gerado ${st === 'gerado' ? 'ativo' : ''}" onclick="alterarStatusCliente('${cliente._id}','Gerado')">Gerado</button>
                            <button class="btn-status erro ${st === 'erro' ? 'ativo' : ''}" onclick="alterarStatusCliente('${cliente._id}','Erro')">Erro</button>
                        </div>
                        <select class="status-select ${st}" onchange="alterarStatusCliente('${cliente._id}',this.value); atualizarCorSelect(this)">
                            <option value="Pendente" ${st === 'pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="Enviado"  ${st === 'enviado'  ? 'selected' : ''}>Enviado</option>
                            <option value="Gerado"   ${st === 'gerado'   ? 'selected' : ''}>Gerado</option>
                            <option value="Erro"     ${st === 'erro'     ? 'selected' : ''}>Erro</option>
                        </select>
                    </td>
                    <td class="td-acoes-cell">
                        <div class="td-acoes">
                            <button class="btn-primary" style="background:#f59e0b;" onclick="abrirModalEdicao('${cliente._id}')">Editar</button>
                            <button class="btn-danger" onclick="excluirCliente('${cliente._id}')">Excluir</button>
                        </div>
                    </td>
                </tr>`;
        });

    } catch (error) {
        console.error("Erro ao listar clientes:", error);
    } finally {
        esconderLoading();
    }
}

// =======================================
// LISTAR CLIENTES — tela Cadastro
// =======================================
async function listarClientesCadastro() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    mostrarLoading();
    tabela.innerHTML = "";

    try {
        const response = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        const clientes = await response.json();

        if (clientes.length === 0) {
            tabela.innerHTML = "<tr><td colspan='6' style='text-align:center;padding:20px;'>Nenhum cliente cadastrado.</td></tr>";
            return;
        }

        clientes.forEach(cliente => {
            tabela.innerHTML += `
                <tr>
                    <td data-label="Nome">${cliente.nome}</td>
                    <td data-label="Documento">${cliente.documento || "-"}</td>
                    <td data-label="Regime">${cliente.regime || "-"}</td>
                    <td data-label="Telefone">${cliente.telefone || "-"}</td>
                    <td data-label="SPED" style="text-align:center;">
                        ${cliente.sped === "Sim"
                            ? '<span class="icon-sped sim" title="Gera SPED">●</span>'
                            : '<span class="icon-sped nao" title="Não gera SPED">●</span>'}
                    </td>
                    <td class="td-acoes-cell">
                        <div class="td-acoes">
                            <button class="btn-primary" style="background:#f59e0b;" onclick="abrirModalEdicao('${cliente._id}')">Editar</button>
                            <button class="btn-danger" onclick="excluirCliente('${cliente._id}')">Excluir</button>
                        </div>
                    </td>
                </tr>`;
        });

    } catch (error) {
        console.error("Erro ao listar:", error);
    } finally {
        esconderLoading();
    }
}

// =======================================
// ABRIR MODAL EDIÇÃO
// =======================================
async function abrirModalEdicao(id) {
    try {
        const response = await fetch("/api/clientes/" + id, {
            headers: { "Authorization": "Bearer " + getToken() }
        });

        if (!response.ok) { toast.erro("Erro ao carregar cliente"); return; }

        const cliente = await response.json();

        document.getElementById("editId").value        = cliente._id;
        document.getElementById("editNome").value      = cliente.nome || "";
        document.getElementById("editDocumento").value = mascaraDocumento(cliente.documento || "");
        document.getElementById("editEmail").value     = cliente.email || "";
        document.getElementById("editTelefone").value  = mascaraTelefone(cliente.telefone || "");
        document.getElementById("editRegime").value    = cliente.regime || "";
        document.getElementById("editSped").value      = cliente.sped || "Nao";

        // Atualiza título do modal se existir
        const titulo = document.getElementById("tituloModal");
        if (titulo) titulo.innerText = "Editar Cliente";

        const lista = document.getElementById("listaAcessos");
        lista.innerHTML = "";
        if (cliente.acessosRemotos?.length) {
            cliente.acessosRemotos.forEach(a => adicionarAcesso(a.nome, a.anydesk));
        } else {
            adicionarAcesso();
        }

        document.getElementById("modalEdicao").style.display = "flex";

    } catch (error) {
        console.error(error);
        toast.erro("Erro ao carregar cliente");
    }
}

// =======================================
// SALVAR EDIÇÃO
// =======================================
async function salvarEdicao() {
    mostrarLoading();

    const id   = document.getElementById("editId").value;
    const sped = document.getElementById("editSped").value;

    const acessosRemotos = [];
    document.querySelectorAll("#listaAcessos .acesso").forEach(div => {
        const inputs = div.querySelectorAll("input");
        if (inputs[1]?.value) {
            acessosRemotos.push({ nome: inputs[0].value, anydesk: inputs[1].value });
        }
    });

    try {
        const response = await fetch("/api/clientes/" + id, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({
                nome:          document.getElementById("editNome").value,
                documento:     document.getElementById("editDocumento").value,
                email:         document.getElementById("editEmail").value,
                telefone:      document.getElementById("editTelefone").value,
                regime:        document.getElementById("editRegime").value,
                sped,
                acessosRemotos
            })
        });

        if (!response.ok) {
            const erro = await response.json();
            toast.erro(erro.message || "Erro ao salvar");
            return;
        }

        toast.sucesso("Cliente atualizado!");
        fecharModal();

        if (window.location.pathname.includes("clientes.html")) {
            listarClientes();
        } else {
            listarClientesCadastro();
        }

    } catch (error) {
        toast.erro("Erro ao salvar");
    } finally {
        esconderLoading();
    }
}

// dispatcher chamado pelo botão Salvar no modal
async function salvarClienteOuEditar() {
    const id = document.getElementById("editId").value;
    if (id) {
        await salvarEdicao();
    } else {
        await salvarCliente();
    }
}

// =======================================
// ALTERAR STATUS
// =======================================
async function alterarStatusCliente(id, novoStatus) {
    mostrarLoading();
    try {
        await fetch("/api/clientes/" + id, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
            body: JSON.stringify({ status: novoStatus })
        });
        listarClientes();
    } catch (error) {
        console.error("Erro ao alterar status:", error);
    } finally {
        esconderLoading();
    }
}

function atualizarCorSelect(sel) {
    sel.className = "status-select " + sel.value.toLowerCase();
}

// =======================================
// EXCLUIR CLIENTE
// =======================================
async function excluirCliente(id) {
    const confirmado = await toastConfirm("Deseja excluir este cliente?");
    if (!confirmado) return;

    mostrarLoading();
    try {
        await fetch("/api/clientes/" + id, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + getToken() }
        });

        if (window.location.pathname.includes("clientes.html")) {
            listarClientes();
        } else {
            listarClientesCadastro();
        }

    } catch (error) {
        toast.erro("Erro ao excluir cliente");
    } finally {
        esconderLoading();
    }
}

// =======================================
// ACESSO REMOTO
// =======================================
function adicionarAcesso(nome = "", anydesk = "") {
    const lista = document.getElementById("listaAcessos");
    const div   = document.createElement("div");
    div.classList.add("acesso");
    div.innerHTML = `
        <input placeholder="Nome da máquina" value="${nome}">
        <input placeholder="ID AnyDesk" value="${anydesk}">
        <button type="button" class="btn-remover" onclick="this.parentElement.remove()">✕</button>
    `;
    lista.appendChild(div);
}

// =======================================
// MÁSCARAS
// =======================================
function mascaraTelefone(valor) {
    valor = valor.replace(/\D/g, "");
    if (!valor) return "";
    if (valor.length > 11) valor = valor.slice(0, 11);
    if (valor.length > 10) return valor.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    if (valor.length > 6)  return valor.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    if (valor.length > 2)  return valor.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    return valor.replace(/^(\d*)/, "($1");
}

function mascaraDocumento(valor) {
    valor = valor.replace(/\D/g, "");
    if (valor.length <= 11) {
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
        valor = valor.replace(/^(\d{2})(\d)/, "$1.$2");
        valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        valor = valor.replace(/\.(\d{3})(\d)/, ".$1/$2");
        valor = valor.replace(/(\d{4})(\d)/, "$1-$2");
    }
    return valor;
}

// =======================================
// MODAL
// =======================================
function fecharModal() {
    const m = document.getElementById("modalEdicao");
    if (m) m.style.display = "none";
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
