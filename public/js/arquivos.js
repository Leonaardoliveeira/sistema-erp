const API_URL = "https://sistema-erp-32e0.onrender.com";

async function listarClientesArquivos() {
    const tabela = document.getElementById("tabelaClientes");
    const usuarioAtivo = JSON.parse(localStorage.getItem("usuarioAtivo"));

    try {
        const res = await fetch(`${API_URL}/clientes?usuarioDono=${usuarioAtivo.usuario}`);
        const clientes = await res.json();
        tabela.innerHTML = "";

        clientes.forEach(c => {
            tabela.innerHTML += `
                <tr>
                    <td>${c.nome}</td>
                    <td><span class="status ${c.status.toLowerCase()}">${c.status}</span></td>
                    <td>
                        <select onchange="atualizarStatusBanco('${c._id}', this.value)">
                            <option value="Pendente" ${c.status==='Pendente'?'selected':''}>Pendente</option>
                            <option value="Gerado" ${c.status==='Gerado'?'selected':''}>Gerado</option>
                            <option value="Erro" ${c.status==='Erro'?'selected':''}>Erro</option>
                        </select>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error(e); }
}

async function atualizarStatusBanco(id, novoStatus) {
    await fetch(`${API_URL}/clientes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus })
    });
    listarClientesArquivos();
}