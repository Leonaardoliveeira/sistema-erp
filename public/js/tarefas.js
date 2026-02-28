document.addEventListener("DOMContentLoaded", function () {

    document.getElementById("mesSelecionado")
        .addEventListener("change", renderSped);

});

function renderSped() {

    const mes = document.getElementById("mesSelecionado").value;
    const tabela = document.getElementById("tabelaSped");
    let tarefasSped = JSON.parse(localStorage.getItem("tarefasSped")) || {};

    if (!mes) {
        tabela.innerHTML = "<tr><td colspan='3'>Selecione um mês</td></tr>";
        return;
    }

    const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
    const clientesSped = clientes.filter(c => c.geraSped === true);

    tabela.innerHTML = "";

    clientesSped.forEach(c => {

        const chave = mes + "_" + c.codigo;

        if (!tarefasSped[chave]) {
            tarefasSped[chave] = "nao";
        }

        tabela.innerHTML += `
        <tr>
            <td>${c.razao}</td>
            <td>${c.cnpj}</td>
            <td>
                <select onchange="alterarStatus('${chave}', this.value)">
                    <option value="nao" ${tarefasSped[chave]=="nao"?"selected":""}>Não Gerado</option>
                    <option value="gerado" ${tarefasSped[chave]=="gerado"?"selected":""}>Gerado</option>
                    <option value="ok" ${tarefasSped[chave]=="ok"?"selected":""}>OK</option>
                </select>
            </td>
        </tr>`;
    });

    localStorage.setItem("tarefasSped", JSON.stringify(tarefasSped));
}

function alterarStatus(chave, status) {
    let tarefasSped = JSON.parse(localStorage.getItem("tarefasSped")) || {};
    tarefasSped[chave] = status;
    localStorage.setItem("tarefasSped", JSON.stringify(tarefasSped));
}