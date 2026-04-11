// =======================================
// 🔐 PEGAR TOKEN
// =======================================
function getToken() {
    return localStorage.getItem("token");
}

// =======================================
// ⏳ LOADING
// =======================================
function mostrarLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "flex";
}

function esconderLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "none";
}

// =======================================
// FILTRAR CLIENTES
// =======================================
function filtrarClientes() {
    const termo = document.getElementById("campoPesquisa").value.toLowerCase();
    const linhas = document.querySelectorAll("#tabelaClientes tr");

    linhas.forEach(linha => {
        const textoLinha = linha.innerText.toLowerCase();

        if (textoLinha.includes(termo)) {
            linha.style.display = "";
        } else {
            linha.style.display = "none";
        }
    });
}

// =======================================
// 📡 SALVAR NOVO CLIENTE
// =======================================
async function salvarCliente() {

    const nome = document.getElementById("editNome").value;
    const documento = document.getElementById("editDocumento").value;
    const email = document.getElementById("editEmail").value;
    const telefone = document.getElementById("editTelefone").value;
    const regime = document.getElementById("editRegime").value;
    const sped = document.getElementById("editSped").value; // 🔥 NOVO

    if (!nome) {
        toast.aviso("O nome é obrigatório!");
        return;
    }

    mostrarLoading();

    const acessosRemotos = [];

    document.querySelectorAll("#listaAcessos .acesso").forEach(div => {
        const inputs = div.querySelectorAll("input");

        const nomeAcesso = inputs[0].value;
        const anydesk = inputs[1].value;

        if (anydesk) {
            acessosRemotos.push({
                nome: nomeAcesso,
                anydesk: anydesk
            });
        }
    });

    try {
        const response = await fetch("/api/clientes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify({
                nome,
                documento,
                email,
                telefone,
                regime,
                sped,
                acessosRemotos
            })
        });

        if (!response.ok) {
            const erro = await response.json();
            toast.erro(erro.message || "Erro ao salvar cliente");
            return;
        }

        toast.sucesso("Cliente cadastrado com sucesso!");
        setTimeout(() => window.location.href = "clientes.html", 1200);

    } catch (error) {
        console.error("Erro:", error);
        toast.erro("Erro ao conectar ao servidor");

    } finally {
        esconderLoading();
    }
}

// =======================================
// 📋 LISTAR CLIENTES (SPED)
// =======================================
async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    mostrarLoading();
    tabela.innerHTML = "";

    try {
        const response = await fetch("/api/clientes", {
            headers: {
                "Authorization": "Bearer " + getToken()
            }
        });

        const clientes = await response.json();

        // 🔥 FILTRA SOMENTE QUEM GERA SPED
        const clientesSped = clientes.filter(c => c.sped === "Sim");

        clientesSped.forEach(cliente => {
            const st = cliente.status?.toLowerCase() || "pendente";

            tabela.innerHTML += `
                <tr>
                    <td>${cliente.nome}</td>
                    <td>${cliente.documento || "-"}</td>
                    <td>${cliente.regime || "-"}</td>
                    <td>
                        <div class="status-botoes">
                            <button class="btn-status pendente ${st === 'pendente' ? 'ativo' : ''}"
                                onclick="alterarStatusCliente('${cliente._id}','Pendente')">
                                Pendente
                            </button>
                            <button class="btn-status enviado ${st === 'enviado' ? 'ativo' : ''}"
                                onclick="alterarStatusCliente('${cliente._id}','Enviado')">
                                Enviado
                            </button>
                            <button class="btn-status gerado ${st === 'gerado' ? 'ativo' : ''}"
                                onclick="alterarStatusCliente('${cliente._id}','Gerado')">
                                Gerado
                            </button>
                            <button class="btn-status erro ${st === 'erro' ? 'ativo' : ''}"
                                onclick="alterarStatusCliente('${cliente._id}','Erro')">
                                Erro
                            </button>
                        </div>

                        <select class="status-select ${st}" 
                            onchange="alterarStatusCliente('${cliente._id}',this.value); atualizarCorSelect(this)">
                            <option value="Pendente" ${st === 'pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="Enviado" ${st === 'enviado' ? 'selected' : ''}>Enviado</option>
                            <option value="Gerado" ${st === 'gerado' ? 'selected' : ''}>Gerado</option>
                            <option value="Erro" ${st === 'erro' ? 'selected' : ''}>Erro</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn-primary"
                            style="background-color:#f59e0b;margin-right:5px;"
                            onclick="abrirModalEdicao('${cliente._id}')">
                            Editar
                        </button>
                        <button class="btn-danger"
                            onclick="excluirCliente('${cliente._id}')">
                            Excluir
                        </button>
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
// 📋 LISTAR CLIENTES (CADASTRO)
// =======================================
async function listarClientesCadastro() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    mostrarLoading();
    tabela.innerHTML = "";

    try {
        const response = await fetch("/api/clientes", {
            headers: {
                "Authorization": "Bearer " + getToken()
            }
        });

        const clientes = await response.json();

        clientes.forEach(cliente => {
            tabela.innerHTML += `
                <tr>
                    <td>${cliente.nome}</td>
                    <td>${cliente.documento || "-"}</td>
                    <td>${cliente.regime || "-"}</td>
                    <td>${cliente.telefone || "-"}</td>
                    <td style="text-align:center;">
                        ${cliente.sped === "Sim"
                    ? '<span class="icon-sped sim" title="Gera SPED">●</span>'
                    : '<span class="icon-sped nao" title="Não gera SPED">●</span>'}
                    </td>
                    <td>
                        <button class="btn-primary"
                            style="background-color:#f59e0b;margin-right:5px;"
                            onclick="abrirModalEdicao('${cliente._id}')">
                            Editar
                        </button>
                        <button class="btn-danger"
                            onclick="excluirCliente('${cliente._id}')">
                            Excluir
                        </button>
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
// ✏️ ABRIR MODAL EDIÇÃO
// =======================================
async function abrirModalEdicao(id) {
    try {
        const response = await fetch(`/api/clientes/${id}`, {
            headers: {
                "Authorization": "Bearer " + getToken()
            }
        });

        const cliente = await response.json();

        document.getElementById("editId").value = cliente._id;
        document.getElementById("editNome").value = cliente.nome || "";
        document.getElementById("editDocumento").value = mascaraDocumento(cliente.documento || "");
        document.getElementById("editEmail").value = cliente.email || "";
        document.getElementById("editTelefone").value = mascaraTelefone(cliente.telefone || "");
        document.getElementById("editRegime").value = cliente.regime || "";
        document.getElementById("editSped").value = cliente.sped || "";

        const lista = document.getElementById("listaAcessos");
        lista.innerHTML = "";

        if (cliente.acessosRemotos?.length) {
            cliente.acessosRemotos.forEach(a => {
                adicionarAcesso(a.nome, a.anydesk);
            });
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
// 💾 SALVAR EDIÇÃO
// =======================================
async function salvarEdicao() {
    mostrarLoading();

    const id = document.getElementById("editId").value;
    const sped = document.getElementById("editSped").value; // 🔥 NOVO

    const acessosRemotos = [];

    document.querySelectorAll("#listaAcessos .acesso").forEach(div => {
        const inputs = div.querySelectorAll("input");

        if (inputs[1].value) {
            acessosRemotos.push({
                nome: inputs[0].value,
                anydesk: inputs[1].value
            });
        }
    });

    try {
        await fetch(`/api/clientes/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify({
                nome: document.getElementById("editNome").value,
                documento: document.getElementById("editDocumento").value,
                email: document.getElementById("editEmail").value,
                telefone: document.getElementById("editTelefone").value,
                regime: document.getElementById("editRegime").value,
                sped, // 🔥 NOVO
                acessosRemotos
            })
        });

        fecharModal();

        if (window.location.pathname.includes("clientes.html")) {
            listarClientes();
        } else if (window.location.pathname.includes("cadastro.html")) {
            listarClientesCadastro();
        }

    } catch (error) {
        console.error(error);
        toast.erro("Erro ao salvar");
    } finally {
        esconderLoading();
    }
}

// =======================================
// 🔄 ALTERAR STATUS
// =======================================
async function alterarStatusCliente(id, novoStatus) {

    mostrarLoading(); // 🔥 inicia

    try {
        await fetch(`/api/clientes/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify({
                status: novoStatus
            })
        });

        listarClientes();

    } catch (error) {
        console.error("Erro ao alterar status:", error);
    } finally {
        esconderLoading(); // 🔥 finaliza
    }
}

// =======================================
// 🗑 EXCLUIR CLIENTE
// =======================================
async function excluirCliente(id) {
    const confirmado = await toastConfirm("Deseja excluir este cliente?");
    if (!confirmado) return;

    mostrarLoading(); // 🔥 inicia loading

    try {
        await fetch(`/api/clientes/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": "Bearer " + getToken()
            }
        });

        if (window.location.pathname.includes("clientes.html")) {
            listarClientes();
        } else if (window.location.pathname.includes("cadastro.html")) {
            listarClientesCadastro();
        }

    } catch (error) {
        console.error("Erro ao excluir:", error);
        toast.erro("Erro ao excluir cliente");
    } finally {
        esconderLoading(); // 🔥 finaliza loading
    }
}

function adicionarAcesso(nome = "", anydesk = "") {
    const lista = document.getElementById("listaAcessos");

    const div = document.createElement("div");
    div.classList.add("acesso");

    div.innerHTML = `
        <input placeholder="Nome da máquina" value="${nome}">
        <input placeholder="ID AnyDesk" value="${anydesk}">
        <button type="button" class="btn-remover" onclick="this.parentElement.remove()">✕</button>
    `;

    lista.appendChild(div);
}

// =======================================
// MASCARA INPUTS TELEFONE/CNPJ
// =======================================
function mascaraTelefone(valor) {
    valor = valor.replace(/\D/g, "");

    // 🔥 SE NÃO TEM NADA, RETORNA VAZIO
    if (!valor) return "";

    if (valor.length > 11) valor = valor.slice(0, 11);

    if (valor.length > 10) {
        return valor.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (valor.length > 6) {
        return valor.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (valor.length > 2) {
        return valor.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    } else {
        return valor.replace(/^(\d*)/, "($1");
    }
}

function mascaraDocumento(valor) {
    valor = valor.replace(/\D/g, "");

    if (valor.length <= 11) {
        // CPF
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
        // CNPJ
        valor = valor.replace(/^(\d{2})(\d)/, "$1.$2");
        valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        valor = valor.replace(/\.(\d{3})(\d)/, ".$1/$2");
        valor = valor.replace(/(\d{4})(\d)/, "$1-$2");
    }

    return valor;
}

// =======================================
// ❌ FECHAR MODAL
// =======================================
function fecharModal() {
    document.getElementById("modalEdicao").style.display = "none";
}

// =======================================
// 🌙 DARK MODE
// =======================================
function toggleDark() {
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
        localStorage.setItem("tema", "dark");
    } else {
        localStorage.setItem("tema", "light");
    }
}

window.addEventListener("load", () => {
    const tema = localStorage.getItem("tema");
    if (tema === "dark") {
        document.body.classList.add("dark");
    }
});