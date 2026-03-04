// =======================================
// 🔐 FUNÇÃO PARA PEGAR TOKEN
// =======================================
function getToken() {
    return localStorage.getItem("token");
}

// =======================================
// 📡 BUSCAR CLIENTES DO BACKEND
// =======================================
async function buscarClientes() {
    try {
        const response = await fetch("/api/clientes", {
            headers: {
                "Authorization": "Bearer " + getToken()
            }
        });

        if (!response.ok) {
            throw new Error("Erro ao buscar clientes");
        }

        return await response.json();
    } catch (error) {
        console.error("Erro:", error);
        return [];
    }
}

// =======================================
// 📝 CADASTRAR NOVO CLIENTE
// =======================================
async function cadastrarCliente(cliente) {
    try {
        const response = await fetch("/api/clientes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
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
        console.error("Erro:", error);
        alert("Não foi possível cadastrar o cliente: " + error.message);
        return null;
    }
}

// =======================================
// 📊 CARREGAR DASHBOARD
// =======================================
async function carregarDashboard() {

    if (typeof verificarViradaDeMes === "function") {
        verificarViradaDeMes();
    }

    const clientes = await buscarClientes();

    document.getElementById("totalClientes").innerText = clientes.length;
    document.getElementById("gerados").innerText = clientes.filter(c => c.status === "Gerado").length;
    document.getElementById("pendentes").innerText = clientes.filter(c => c.status === "Pendente").length;
    document.getElementById("erros").innerText = clientes.filter(c => c.status === "Erro").length;

    renderizarTabelaDashboard(clientes);
}

// =======================================
// 📋 LISTAGEM PADRÃO
// =======================================
async function listarClientesDashboard() {
    const clientes = await buscarClientes();
    renderizarTabelaDashboard(clientes);
}

// =======================================
// 🔍 FILTRO DE PESQUISA
// =======================================
async function filtrarClientes() {
    const termo = document.getElementById("campoPesquisa").value.toLowerCase();
    const clientes = await buscarClientes();

    const filtrados = clientes.filter(c =>
        (c.nome && c.nome.toLowerCase().includes(termo)) ||
        (c.documento && c.documento.toLowerCase().includes(termo))
    );

    renderizarTabelaDashboard(filtrados);
}

// =======================================
// 🧱 RENDERIZAR TABELA
// =======================================
function renderizarTabelaDashboard(lista) {

    const tabela = document.getElementById("tabelaDashboard");
    if (!tabela) return;

    tabela.innerHTML = "";

    if (lista.length === 0) {
        tabela.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Nenhum cliente cadastrado.</td></tr>";
        return;
    }

    lista.forEach(cliente => {

        const stClasse = cliente.status ? cliente.status.toLowerCase() : "pendente";

        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento || "-"}</td>
                <td>${cliente.regime || "-"}</td>
                <td>${cliente.telefone || "-"}</td>
                <td><span class="status ${stClasse}">${cliente.status || "Pendente"}</span></td>
            </tr>
        `;
    });
}

// =======================================
// 🟢 EVENTO FORMULÁRIO DE CADASTRO
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
            listarClientesDashboard(); // atualiza a tabela só com os clientes do usuário
        }
    });
}