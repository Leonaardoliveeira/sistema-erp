// Carrega a tabela ao abrir a página
function listarUsuarios() {
    const tabela = document.getElementById("tabelaUsuarios");
    if (!tabela) return;

    const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    tabela.innerHTML = "";

    usuarios.forEach((user, index) => {
        tabela.innerHTML += `
            <tr>
                <td>${user.nome}</td>
                <td>${user.usuario}</td>
                <td><span class="status ${user.perfil}">${user.perfil.toUpperCase()}</span></td>
                <td>
                    ${user.usuario !== 'admin' 
                        ? `<button class="btn-primary" style="background-color: #f59e0b; margin-right: 5px;" onclick="prepararEdicao(${index})">Editar</button>
                           <button class="btn-danger" onclick="excluirUsuario(${index})">Excluir</button>` 
                        : '<small>Sistema (Mestre)</small>'}
                </td>
            </tr>`;
    });
}

// Prepara o modal para um NOVO usuário
function abrirModal() {
    document.getElementById("modalUsuario").style.display = "flex";
    document.getElementById("uTitulo").innerText = "Novo Acesso";
    document.getElementById("editIndex").value = ""; // Limpa o index para o modo "Criação"
    
    // Limpa os campos
    document.getElementById("uNome").value = "";
    document.getElementById("uLogin").value = "";
    document.getElementById("uSenha").value = "";
    document.getElementById("uPerfil").value = "usuario";
}

// Carrega os dados do usuário no modal para EDITAR
function prepararEdicao(index) {
    const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
    const user = usuarios[index];

    document.getElementById("uNome").value = user.nome;
    document.getElementById("uLogin").value = user.usuario;
    document.getElementById("uSenha").value = user.senha;
    document.getElementById("uPerfil").value = user.perfil;
    document.getElementById("editIndex").value = index; // Define o index para o modo "Edição"

    document.getElementById("uTitulo").innerText = "Editar Usuário";
    document.getElementById("modalUsuario").style.display = "flex";
}

function fecharModal() {
    document.getElementById("modalUsuario").style.display = "none";
}

// Função Única para Salvar (Cria ou Atualiza)
function salvarUsuario() {
    const nome = document.getElementById("uNome").value;
    const login = document.getElementById("uLogin").value;
    const senha = document.getElementById("uSenha").value;
    const perfil = document.getElementById("uPerfil").value;
    const editIndex = document.getElementById("editIndex").value;

    if (!nome || !login || !senha) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

    if (editIndex === "") {
        // MODO NOVO: Verifica se login já existe
        if (usuarios.some(u => u.usuario === login)) {
            alert("Este nome de usuário já está em uso!");
            return;
        }
        usuarios.push({ nome, usuario: login, senha, perfil });
    } else {
        // MODO EDIÇÃO: Atualiza a posição existente
        usuarios[editIndex] = { nome, usuario: login, senha, perfil };
    }

    localStorage.setItem("usuarios", JSON.stringify(usuarios));
    fecharModal();
    listarUsuarios();
}

function excluirUsuario(index) {
    if (confirm("Tem certeza que deseja remover o acesso deste usuário?")) {
        let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
        usuarios.splice(index, 1);
        localStorage.setItem("usuarios", JSON.stringify(usuarios));
        listarUsuarios();
    }
}