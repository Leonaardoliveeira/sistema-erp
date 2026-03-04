// =======================================
// LISTAR CLIENTES (VINDO DO BACKEND)
// =======================================
async function listarClientes() {

    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    tabela.innerHTML = "";

    try {
        const response = await fetch("/api/clientes", {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("token")
            }
        });

        const clientes = await response.json();

        if (clientes.length === 0) {
            tabela.innerHTML = `<tr><td colspan="3" style="text-align:center;">Nenhum cliente cadastrado.</td></tr>`;
            return;
        }

        clientes.forEach((cliente) => {

            tabela.innerHTML += `
                <tr>
                    <td>${cliente.nome}</td>
                    <td><span class="status ${cliente.status?.toLowerCase() || "pendente"}">
                        ${cliente.status || "Pendente"}
                    </span></td>
                    <td>
                        <select onchange="alterarStatus('${cliente._id}', this.value)">
                            <option ${cliente.status === "Pendente" ? "selected" : ""}>Pendente</option>
                            <option ${cliente.status === "Gerado" ? "selected" : ""}>Gerado</option>
                            <option ${cliente.status === "Erro" ? "selected" : ""}>Erro</option>
                        </select>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Erro ao listar clientes:", error);
    }
}

// =======================================
// ALTERAR STATUS NO BANCO
// =======================================
async function alterarStatus(id, novoStatus) {

    try {
        await fetch(`/api/clientes/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify({ status: novoStatus })
        });

        listarClientes(); // Atualiza tabela

    } catch (error) {
        console.error("Erro ao atualizar status:", error);
    }
}

// =======================================
// CADASTRAR NOVO CLIENTE
// =======================================
async function cadastrarCliente(cliente) {
    try {
        const response = await fetch("/api/clientes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify(cliente)
        });

        if (!response.ok) {
            const msg = await response.json();
            throw new Error(msg.message || "Erro ao cadastrar cliente");
        }

        const novoCliente = await response.json();
        return novoCliente;

    } catch (error) {
        console.error("Erro ao cadastrar cliente:", error);
        alert("Não foi possível cadastrar o cliente: " + error.message);
        return null;
    }
}

// =======================================
// EVENTO FORMULÁRIO DE CADASTRO
// =======================================
const formCadastro = document.getElementById("formCadastroCliente");
if (formCadastro) {
    formCadastro.addEventListener("submit", async (e) => {
        e.preventDefault();

        const cliente = {
            nome: document.getElementById("nomeCliente").value,
            documento: document.getElementById("documentoCliente").value,
            telefone: document.getElementById("telefoneCliente").value,
            regime: document.getElementById("regimeCliente").value,
            status: document.getElementById("statusCliente").value
        };

        const novoCliente = await cadastrarCliente(cliente);
        if (novoCliente) {
            formCadastro.reset();
            listarClientes(); // Atualiza tabela só com os clientes do usuário
        }
    });
}