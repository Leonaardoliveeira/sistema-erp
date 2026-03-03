async function buscarClientes() {
    try {
        const response = await fetch(`/api/clientes?usuarioId=${getUsuarioId()}`, {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        return await response.json();
    } catch (error) {
        console.error("Erro:", error);
        return [];
    }
}

async function carregarDashboard() {
    const clientes = await buscarClientes();

    document.getElementById("totalClientes").innerText = clientes.length;
    document.getElementById("gerados").innerText = clientes.filter(c => c.status === "Gerado").length;
    document.getElementById("pendentes").innerText = clientes.filter(c => c.status === "Pendente").length;
    document.getElementById("erros").innerText = clientes.filter(c => c.status === "Erro").length;

    renderizarTabelaDashboard(clientes);
}