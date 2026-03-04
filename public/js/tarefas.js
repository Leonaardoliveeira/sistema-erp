document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("mesSelecionado")
        .addEventListener("change", renderSped);
});

function getToken() {
    return localStorage.getItem("token");
}

async function renderSped() {

    const mes = document.getElementById("mesSelecionado").value;
    const tabela = document.getElementById("tabelaSped");

    if (!mes) {
        tabela.innerHTML = "<tr><td colspan='3'>Selecione um mês</td></tr>";
        return;
    }

    try {
        // Buscar clientes do usuário logado
        const clientesResp = await fetch("/api/clientes", {
            headers: { "Authorization": "Bearer " + getToken() }
        });

        const clientes = await clientesResp.json();

        if (clientes.length === 0) {
            tabela.innerHTML = "<tr><td colspan='3'>Nenhum cliente cadastrado.</td></tr>";
            return;
        }

        // Buscar status SPED do mês (filtrado por usuário no backend)
        const spedResp = await fetch(`/api/sped/${mes}`, {
            headers: { "Authorization": "Bearer " + getToken() }
        });

        const speds = await spedResp.json();

        tabela.innerHTML = "";

        clientes.forEach(cliente => {

            const registro = speds.find(s => s.clienteId._id === cliente._id);
            const statusAtual = registro ? registro.status : "nao";

            tabela.innerHTML += `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento || "-"}</td>
                <td>
                    <select onchange="alterarStatusSped('${cliente._id}', '${mes}', this.value)">
                        <option value="nao" ${statusAtual === "nao" ? "selected" : ""}>Não Gerado</option>
                        <option value="gerado" ${statusAtual === "gerado" ? "selected" : ""}>Gerado</option>
                        <option value="ok" ${statusAtual === "ok" ? "selected" : ""}>OK</option>
                    </select>
                </td>
            </tr>`;
        });

    } catch (error) {
        console.error("Erro SPED:", error);
        tabela.innerHTML = "<tr><td colspan='3'>Erro ao carregar dados do SPED.</td></tr>";
    }
}

async function alterarStatusSped(clienteId, mes, status) {

    try {
        await fetch("/api/sped", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + getToken()
            },
            body: JSON.stringify({ clienteId, mes, status })
        });

        // Atualiza a tabela após alteração
        renderSped();

    } catch (error) {
        console.error("Erro ao alterar status SPED:", error);
        alert("Não foi possível atualizar o status do SPED.");
    }
}