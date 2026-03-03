async function renderSped() {
    const mes = document.getElementById("mesSelecionado").value;
    const tabela = document.getElementById("tabelaSped");
    const uId = getUsuarioId();

    if (!mes) return;

    try {
        // Busca apenas clientes deste utilizador
        const clientesResp = await fetch(`/api/clientes?usuarioId=${uId}`, {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        const clientes = await clientesResp.json();

        // Busca registros do SPED para este utilizador
        const spedResp = await fetch(`/api/sped/${mes}?usuarioId=${uId}`, {
            headers: { "Authorization": "Bearer " + getToken() }
        });
        const speds = await spedResp.json();

        tabela.innerHTML = clientes.map(cliente => {
            const registro = speds.find(s => (s.clienteId?._id || s.clienteId) === cliente._id);
            const statusAtual = registro ? registro.status : "nao";

            return `
            <tr>
                <td>${cliente.nome}</td>
                <td>${cliente.documento || "-"}</td>
                <td>
                    <select onchange="alterarStatusSped('${cliente._id}', '${mes}', this.value)">
                        <option value="nao" ${statusAtual=="nao"?"selected":""}>Não Gerado</option>
                        <option value="gerado" ${statusAtual=="gerado"?"selected":""}>Gerado</option>
                        <option value="ok" ${statusAtual=="ok"?"selected":""}>OK</option>
                    </select>
                </td>
            </tr>`;
        }).join("");
    } catch (error) { console.error(error); }
}