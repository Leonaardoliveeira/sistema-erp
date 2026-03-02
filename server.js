require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =======================
// 🔥 CONEXÃO MONGODB
// =======================
// No Render, você deve criar a variável MONGO_URI nas configurações de Environment
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Conectado ao MongoDB Atlas"))
  .catch(err => console.error("❌ Erro ao conectar ao MongoDB:", err));

// =======================
// 📦 SCHEMAS (Modelos de Dados)
// =======================
const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  usuario: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  perfil: { type: String, enum: ["admin", "user"], default: "user" }
});

const ClienteSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: String,
  telefone: String,
  criadoEm: { type: Date, default: Date.now }
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Cliente = mongoose.model("Cliente", ClienteSchema);

// =======================
// 👑 ADMIN INICIAL (Cria se não existir)
// =======================
async function criarAdmin() {
  try {
    const existe = await Usuario.findOne({ usuario: "admin" });
    if (!existe) {
      const senhaHash = await bcrypt.hash("123", 10);
      await Usuario.create({
        nome: "Administrador",
        usuario: "admin",
        senha: senhaHash,
        perfil: "admin"
      });
      console.log("👑 Admin padrão criado: admin | 123");
    }
  } catch (err) {
    console.error("Erro ao criar admin inicial:", err);
  }
}
criarAdmin();

// =======================
// 🔐 MIDDLEWARES DE SEGURANÇA
// =======================
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token não enviado" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token inválido ou expirado" });
    req.usuario = decoded;
    next();
  });
}

function verificarAdmin(req, res, next) {
  if (req.usuario.perfil !== "admin") {
    return res.status(403).json({ message: "Acesso negado. Apenas administradores." });
  }
  next();
}

// =======================
// 🔑 ROTAS DE AUTENTICAÇÃO
// =======================
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const user = await Usuario.findOne({ usuario });

    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return res.status(401).json({ message: "Usuário ou senha incorretos" });
    }

    const token = jwt.sign(
      { id: user._id, perfil: user.perfil },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      usuario: { nome: user.nome, usuario: user.usuario, perfil: user.perfil }
    });
  } catch (error) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// =======================
// 👤 ROTAS DE CLIENTES (Persistência no MongoDB)
// =======================

// Listar todos (Usuários e Admins podem ver)
app.get('/api/clientes', verificarToken, async (req, res) => {
  try {
    const clientes = await Cliente.find().sort({ criadoEm: -1 });
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

// Criar (Apenas Admin)
app.post('/api/clientes', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const novoCliente = await Cliente.create(req.body);
    res.status(201).json(novoCliente);
  } catch (err) {
    res.status(400).json({ error: "Erro ao salvar cliente" });
  }
});

// Deletar (Apenas Admin)
app.delete('/api/clientes/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    await Cliente.findByIdAndDelete(req.params.id);
    res.json({ message: "Cliente removido com sucesso" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar" });
  }
});

// =======================
// 🌍 SERVIR FRONTEND
// =======================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor online na porta ${PORT}`));