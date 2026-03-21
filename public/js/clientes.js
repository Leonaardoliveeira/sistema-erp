// =======================================
// 🔐 PEGAR TOKEN
// =======================================
function getToken() {
    return localStorage.getItem("token");
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

    // =======================================
    // 🖥 ACESSOS REMOTOS (NOVO)
    // =======================================
    const acessosRemotos = [
        {
            nome: document.getElementById("nome1")?.value || "",
            anydesk: document.getElementById("anydesk1")?.value || ""
        },
        {
            nome: document.getElementById("nome2")?.value || "",
            anydesk: document.getElementById("anydesk2")?.value || ""
        },
        {
            nome: document.getElementById("nome3")?.value || "",
            anydesk: document.getElementById("anydesk3")?.value || ""
        },
        {
            nome: document.getElementById("nome4")?.value || "",
            anydesk: document.getElementById("anydesk4")?.value || ""
        },
        {
            nome: document.getElementById("nome5")?.value || "",
            anydesk: document.getElementById("anydesk5")?.value || ""
        }
    ].filter(a => a.anydesk !== "");

    if (!nome) {
        alert("O nome é obrigatório!");
        return;
    }

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
                acessosRemotos // 👈 NOVO CAMPO
            })
        });

        if (!response.ok) {
            const erro = await response.json();
            alert(erro.message || "Erro ao salvar cliente");
            return;
        }

        alert("Cliente cadastrado com sucesso!");
        window.location.href = "clientes.html";

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao conectar ao servidor");
    }
}

// =======================================
// 📋 LISTAR CLIENTES
// =======================================
async function listarClientes() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    tabela.innerHTML = "";

    try {
        const response = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });

        const clientes = await response.json();

        clientes.forEach(cliente => {
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
    }
}

// =======================================
// 📋 LISTAR CLIENTES (CADASTRO)
// =======================================
async function listarClientesCadastro() {
    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    tabela.innerHTML = "";

    try {
        const response = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });

        const clientes = await response.json();

        clientes.forEach(cliente => {
            tabela.innerHTML += `
                <tr>
                    <td>${cliente.nome}</td>
                    <td>${cliente.documento || "-"}</td>
                    <td>${cliente.regime || "-"}</td>
                    <td>${cliente.telefone || "-"}</td>
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
    }
}

// =======================================
// 🎨 ATUALIZAR COR DO SELECT
// =======================================
function atualizarCorSelect(select) {
    const valor = select.value.toLowerCase();
    select.classList.remove("pendente", "enviado", "gerado", "erro");
    select.classList.add(valor);
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

        if (!response.ok) {
            throw new Error("Erro ao buscar cliente");
        }

        const cliente = await response.json();

        // 🔹 Preencher dados básicos
        document.getElementById("editId").value = cliente._id;
        document.getElementById("editNome").value = cliente.nome || "";
        document.getElementById("editDocumento").value = cliente.documento || "";
        document.getElementById("editEmail").value = cliente.email || "";
        document.getElementById("editTelefone").value = cliente.telefone || "";
        document.getElementById("editRegime").value = cliente.regime || "";

        // 🔥 Limpar campos de acessos
        for (let i = 1; i <= 5; i++) {
            document.getElementById(`nome${i}`).value = "";
            document.getElementById(`anydesk${i}`).value = "";
        }

        // 🔥 Preencher acessos remotos
        if (cliente.acessosRemotos && cliente.acessosRemotos.length > 0) {
            cliente.acessosRemotos.forEach((acesso, index) => {
                const i = index + 1;

                if (i <= 5) {
                    document.getElementById(`nome${i}`).value = acesso.nome || "";
                    document.getElementById(`anydesk${i}`).value = acesso.anydesk || "";
                }
            });
        }

        document.getElementById("modalEdicao").style.display = "flex";

    } catch (error) {
        console.error("Erro ao carregar cliente:", error);
        alert("Erro ao carregar dados do cliente");
    }
}
// =======================================
// 💾 SALVAR EDIÇÃO
// =======================================
async function salvarEdicao() {
    const id = document.getElementById("editId").value;

    const acessosRemotos = [
        {
            nome: document.getElementById("nome1")?.value || "",
            anydesk: document.getElementById("anydesk1")?.value || ""
        },
        {
            nome: document.getElementById("nome2")?.value || "",
            anydesk: document.getElementById("anydesk2")?.value || ""
        },
        {
            nome: document.getElementById("nome3")?.value || "",
            anydesk: document.getElementById("anydesk3")?.value || ""
        },
        {
            nome: document.getElementById("nome4")?.value || "",
            anydesk: document.getElementById("anydesk4")?.value || ""
        },
        {
            nome: document.getElementById("nome5")?.value || "",
            anydesk: document.getElementById("anydesk5")?.value || ""
        }
    ].filter(a => a.anydesk !== "");

    const dadosAtualizados = {
        nome: document.getElementById("editNome").value,
        documento: document.getElementById("editDocumento").value,
        email: document.getElementById("editEmail").value,
        telefone: document.getElementById("editTelefone").value,
        regime: document.getElementById("editRegime").value,
        acessosRemotos // 🔥 agora salva também
    };

    try {
        const response = await fetch(`/api/clientes/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify(dadosAtualizados)
        });

        if (!response.ok) {
            throw new Error("Erro ao salvar");
        }

        fecharModal();

        if (document.getElementById("campoPesquisa")) {
            listarClientes();
        } else {
            listarClientesCadastro();
        }

    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar cliente");
    }
}
// =======================================
// 🔄 ALTERAR STATUS
// =======================================
async function alterarStatusCliente(id, novoStatus) {
    await fetch(`/api/clientes/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken()
        },
        body: JSON.stringify({ status: novoStatus })
    });

    listarClientes();
}

// =======================================
// 🗑 EXCLUIR CLIENTE
// =======================================
async function excluirCliente(id) {
    if (!confirm("Deseja excluir este cliente?")) return;

    await fetch(`/api/clientes/${id}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + getToken() }
    });

    if (document.getElementById("campoPesquisa")) {
        listarClientes(); // clientes.html
    } else {
        listarClientesCadastro(); // cadastro.html
    }
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