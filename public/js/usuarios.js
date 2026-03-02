async function listarUsuarios() {
    const tabela = document.getElementById("tabelaUsuarios");
    const res = await apiFetch('/api/usuarios');
    const usuarios = await res.json();

    tabela.innerHTML = usuarios.map(u => `
        <tr>
            <td>${u.nome}</td>
            <td>${u.usuario}</td>
            <td>${u.perfil}</td>
            <td>
                ${u.usuario !== 'admin' ? `<button onclick="excluirUsuario('${u._id}')">Remover</button>` : 'Mestre'}
            </td>
        </tr>
    `).join('');
}

async function salvarUsuario() {
    const dados = {
        nome: document.getElementById("uNome").value,
        usuario: document.getElementById("uLogin").value,
        senha: document.getElementById("uSenha").value,
        perfil: document.getElementById("uPerfil").value
    };

    const res = await apiFetch('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify(dados)
    });

    if (res.ok) {
        fecharModal();
        listarUsuarios();
    }
}