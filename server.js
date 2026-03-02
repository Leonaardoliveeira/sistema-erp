require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =======================
// 🔥 CONEXÃO MONGODB
// =======================

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Conectado ao MongoDB");
    criarAdmin(); // só cria admin depois que conectar
  })
  .catch(err => {
    console.log("❌ Erro ao conectar:", err);
    process.exit(1);
  });

// =======================
// 📦 SCHEMAS
// =======================

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  usuario: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  perfil: { type: String, enum: ["admin", "user"], default: "user" }
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
// 👑 CRIAR ADMIN AUTOMÁTICO SE NÃO EXISTIR
// =======================

async function criarAdmin() {
  const existe = await Usuario.findOne({ usuario: process.env.ADMIN_USER });

  if (!existe) {
    const senhaHash = await bcrypt.hash(process.env.ADMIN_PASS, 10);

    await Usuario.create({
      nome: "Administrador",
      usuario: process.env.ADMIN_USER,
      senha: senhaHash,
      perfil: "admin"
    });

    console.log("👑 Admin criado automaticamente");
  }
}

// =======================
// 🔐 MIDDLEWARE TOKEN
// =======================

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token não enviado" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Token inválido" });
    }

    req.usuario = decoded;
    next();
  });
}

// =======================
// 🔐 MIDDLEWARE ADMIN
// =======================

function verificarAdmin(req, res, next) {
  if (req.usuario.perfil !== "admin") {
    return res.status(403).json({ message: "Acesso negado. Apenas administradores." });
  }
  next();
}

// =======================
// 🔐 LOGIN
// =======================

app.post('/api/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    const user = await Usuario.findOne({ usuario });

    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);

    if (!senhaValida) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    const token = jwt.sign(
      { id: user._id, perfil: user.perfil },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      usuario: {
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
// 👥 USUÁRIOS (ADMIN)
// =======================

app.post('/api/usuarios', verificarToken, verificarAdmin, async (req, res) => {
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
// 👤 CLIENTES
// =======================

app.get('/api/clientes', verificarToken, async (req, res) => {
  const clientes = await Cliente.find();
  res.json(clientes);
});

app.post('/api/clientes', verificarToken, verificarAdmin, async (req, res) => {
  const novoCliente = await Cliente.create(req.body);
  res.json(novoCliente);
});

app.put('/api/clientes/:id', verificarToken, verificarAdmin, async (req, res) => {
  await Cliente.findByIdAndUpdate(req.params.id, req.body);
  res.json({ message: "Cliente atualizado" });
});

app.delete('/api/clientes/:id', verificarToken, verificarAdmin, async (req, res) => {
  await Cliente.findByIdAndDelete(req.params.id);
  res.json({ message: "Cliente removido" });
});

// =======================
// 🌍 FRONTEND
// =======================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Rodando na porta ${PORT}`));