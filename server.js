const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =======================
// 🔥 CONEXÃO MONGODB (DIRETO NO CÓDIGO)
// =======================

mongoose.connect(
  "mongodb+srv://clienteserp:lele123321@clienteserp.de3xysi.mongodb.net/clienteserp?retryWrites=true&w=majority"
)
.then(() => console.log("✅ Conectado ao MongoDB"))
.catch(err => console.log("❌ Erro ao conectar:", err));


// =======================
// 📦 SCHEMAS
// =======================

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  usuario: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  perfil: { type: String, default: "user" }
});

const ClienteSchema = new mongoose.Schema({
  nome: String,
  email: String,
  telefone: String,
  criadoEm: { type: Date, default: Date.now }
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Cliente = mongoose.model("Cliente", ClienteSchema);


// =======================
// 👑 CRIAR ADMIN AUTOMÁTICO
// =======================

async function criarAdmin() {
  const existe = await Usuario.findOne({ usuario: "admin" });

  if (!existe) {
    const senhaHash = await bcrypt.hash("123", 10);

    await Usuario.create({
      nome: "Administrador",
      usuario: "admin",
      senha: senhaHash,
      perfil: "admin"
    });

    console.log("👑 Admin criado -> usuario: admin | senha: 123");
  }
}

criarAdmin();


// =======================
// 🔐 LOGIN SEGURO
// =======================

app.post('/api/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    const user = await Usuario.findOne({ usuario });

    if (!user) {
      return res.status(401).json({ success: false, message: "Usuário não encontrado" });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);

    if (!senhaValida) {
      return res.status(401).json({ success: false, message: "Senha incorreta" });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        nome: user.nome,
        usuario: user.usuario,
        perfil: user.perfil
      }
    });

  } catch (error) {
    res.status(500).json({ error: "Erro no servidor" });
  }
});


// =======================
// 👥 USUÁRIOS
// =======================

app.post('/api/usuarios', async (req, res) => {
  try {
    const { nome, usuario, senha, perfil } = req.body;

    const senhaHash = await bcrypt.hash(senha, 10);

    const novoUsuario = await Usuario.create({
      nome,
      usuario,
      senha: senhaHash,
      perfil
    });

    res.json(novoUsuario);

  } catch (error) {
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});


// =======================
// 👤 CLIENTES (CRUD COMPLETO)
// =======================

app.get('/api/clientes', async (req, res) => {
  const clientes = await Cliente.find();
  res.json(clientes);
});

app.post('/api/clientes', async (req, res) => {
  const novoCliente = await Cliente.create(req.body);
  res.json(novoCliente);
});

app.put('/api/clientes/:id', async (req, res) => {
  await Cliente.findByIdAndUpdate(req.params.id, req.body);
  res.json({ message: "Cliente atualizado" });
});

app.delete('/api/clientes/:id', async (req, res) => {
  await Cliente.findByIdAndDelete(req.params.id);
  res.json({ message: "Cliente removido" });
});


// =======================
// 🌍 ROTA CORINGA
// =======================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Rodando na porta ${PORT}`));