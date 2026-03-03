const API_URL = "https://sistema-erp-32e0.onrender.com";

async function carregarDashboard() {
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));
    if (!usuarioAtivo) return window.location.href = "index.html";

    try {
        const response = await fetch(`${API_URL}/clientes?usuarioDono=${usuarioAtivo.usuario}`);
        const meusClientes = await response.json();

        document.getElementById("totalClientes").innerText = meusClientes.length;
        document.getElementById("gerados").innerText = meusClientes.filter(c => c.status === "Gerado").length;
        document.getElementById("pendentes").innerText = meusClientes.filter(c => c.status === "Pendente").length;
        document.getElementById("erros").innerText = meusClientes.filter(c => c.status === "Erro").length;

        renderizarTabelaDashboard(meusClientes);
    } catch (error) {
        console.error("Erro ao carregar Dashboard:", error);
    }
}

function renderizarTabelaDashboard(lista) {
    const tabela = document.getElementById("tabelaDashboard");
    if (!tabela) return;
    tabela.innerHTML = "";
    lista.forEach(cliente => {
        const stClasse = cliente.status ? cliente.status.toLowerCase() : "pendente";
        tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento || "-"}</td>
                <td>${cliente.regime || "-"}</td>
                <td>${cliente.telefone || "-"}</td>
                <td><span class="status ${stClasse}">${cliente.status}</span></td>
            </tr>`;
    });
}