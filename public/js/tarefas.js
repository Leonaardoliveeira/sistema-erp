function getUsuarioId() {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    return usuario ? usuario._id : null;
}

async function renderSped() {
    const mes = document.getElementById("mesSelecionado").value;
    const tabela = document.getElementById("tabelaSped");
    const uId = getUsuarioId();

    if (!mes) {
        tabela.innerHTML = "<tr><td colspan='3'>Selecione um mês</td></tr>";
        return;
    }

    try {
        // 1. Busca apenas os clientes do usuário
        const clientesResp = await fetch(`/api/clientes?usuarioId=${uId}`, {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        const clientes = await clientesResp.json();

        // 2. Busca o status das tarefas filtrado pelo usuário
        const spedResp = await fetch(`/api/sped/${mes}?usuarioId=${uId}`, {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        const speds = await spedResp.json();

        tabela.innerHTML = "";

        clientes.forEach(cliente => {
            const registro = speds.find(s => (s.clienteId?._id || s.clienteId) === cliente._id);
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
        console.error("Erro na tela de tarefas:", error);
    }
}