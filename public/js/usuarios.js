// Função para pegar o token e configurar os cabeçalhos das requisições
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// 1. ABRE O MODAL (Limpa os campos para um novo cadastro)
function abrirModal() {
    document.getElementById("modalUsuario").style.display = "flex";
    document.getElementById("uTitulo").innerText = "Novo Acesso";
    document.getElementById("editId").value = ""; // Limpa ID de edição
    
    // Limpa os inputs
    document.getElementById("uNome").value = "";
    document.getElementById("uLogin").value = "";
    document.getElementById("uSenha").value = "";
    document.getElementById("uPerfil").value = "user";
}

// 2. FECHA O MODAL
function fecharModal() {
    document.getElementById("modalUsuario").style.display = "none";
}

// 3. SALVA O USUÁRIO NO MONGODB
async function salvarUsuario() {
    const nome = document.getElementById("uNome").value;
    const usuario = document.getElementById("uLogin").value;
    const senha = document.getElementById("uSenha").value;
    const perfil = document.getElementById("uPerfil").value;

    // Validação simples
    if (!nome || !usuario || !senha) {
        alert("Por favor, preencha todos os campos obrigatórios!");
        return;
    }

    const dados = { nome, usuario, senha, perfil };

    try {
        const response = await fetch('/api/usuarios', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(dados)
        });

        const resultado = await response.json();

        if (response.ok) {
            alert("Usuário cadastrado com sucesso!");
            fecharModal();
            listarUsuarios(); // Recarrega a tabela
        } else {
            alert("Erro: " + (resultado.message || "Não foi possível salvar."));
        }
    } catch (error) {
        console.error("Erro na conexão:", error);
        alert("Erro ao conectar com o servidor Render.");
    }
}

// 4. LISTA OS USUÁRIOS NA TABELA
async function listarUsuarios() {
    const tabela = document.getElementById("tabelaUsuarios");
    if (!tabela) return;

    try {
        const response = await fetch('/api/usuarios', { headers: getHeaders() });
        const usuarios = await response.json();

        tabela.innerHTML = "";
        usuarios.forEach(user => {
            tabela.innerHTML += `
                <tr>
                    <td>${user.nome}</td>
                    <td>${user.usuario}</td>
                    <td><span class="status ${user.perfil}">${user.perfil.toUpperCase()}</span></td>
                    <td>
                        ${user.usuario !== 'admin' 
                            ? `<button class="btn-danger" onclick="excluirUsuario('${user._id}')">Excluir</button>` 
                            : '<small>Mestre (Protegido)</small>'}
                    </td>
                </tr>`;
        });
    } catch (error) {
        console.error("Erro ao buscar usuários:", error);
    }
}

// 5. EXCLUI USUÁRIO DO BANCO
async function excluirUsuario(id) {
    if (!confirm("Tem certeza que deseja remover este acesso?")) return;

    try {
        const response = await fetch(`/api/usuarios/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (response.ok) {
            listarUsuarios();
        } else {
            alert("Erro ao excluir usuário.");
        }
    } catch (error) {
        alert("Erro de conexão.");
    }
}