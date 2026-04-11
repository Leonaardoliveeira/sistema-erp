// =======================================
// 🔐 PEGAR TOKEN
// =======================================
function getToken() {
    return localStorage.getItem("token");
}
// =======================================
// 📋 LISTAR CLIENTES (VINDO DO BACKEND)
// =======================================
async function listarClientes() {

    const tabela = document.getElementById("tabelaClientes");
    if (!tabela) return;

    tabela.innerHTML = "";

    try {

        const response = await fetch("/api/clientes", {
            headers: {
                "Authorization": "Bearer " + getToken()
            }
        });

        if (!response.ok) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align:center;">
                        Erro ao carregar clientes
                    </td>
                </tr>
            `;
            return;
        }

        const clientes = await response.json();

        if (clientes.length === 0) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align:center;">
                        Nenhum cliente cadastrado
                    </td>
                </tr>
            `;
            return;
        }

        clientes.forEach((cliente) => {

            const statusAtual = cliente.status || "Pendente";
            const classeStatus = statusAtual.toLowerCase();

            tabela.innerHTML += `
                <tr>
                    <td>${cliente.nome}</td>
                    <td>
                        <span class="status ${classeStatus}">
                            ${statusAtual}
                        </span>
                    </td>
                    <td>
                        <select onchange="alterarStatus('${cliente._id}', this.value)">
                            <option value="Pendente" ${statusAtual === "Pendente" ? "selected" : ""}>Pendente</option>
                            <option value="Gerado" ${statusAtual === "Gerado" ? "selected" : ""}>Gerado</option>
                            <option value="Erro" ${statusAtual === "Erro" ? "selected" : ""}>Erro</option>
                        </select>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Erro ao listar clientes:", error);

        tabela.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center;">
                    Erro ao conectar ao servidor
                </td>
            </tr>
        `;
    }
}

// =======================================
// 🔄 ALTERAR STATUS NO BANCO
// =======================================
async function alterarStatus(id, novoStatus) {

    try {

        const response = await fetch(`/api/clientes/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify({ status: novoStatus })
        });

        if (!response.ok) {
            toast.erro("Erro ao atualizar status");
            return;
        }

        listarClientes(); // Atualiza tabela

    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        toast.erro("Erro ao conectar ao servidor");
    }
}

// =======================================
// 🌙 DARK MODE
// =======================================
function toggleDark() {
    document.body.classList.toggle("dark");

    // salva preferência
    if (document.body.classList.contains("dark")) {
        localStorage.setItem("tema", "dark");
    } else {
        localStorage.setItem("tema", "light");
    }
}

// aplicar tema salvo ao carregar
window.addEventListener("load", () => {
    const tema = localStorage.getItem("tema");

    if (tema === "dark") {
        document.body.classList.add("dark");
    }
});