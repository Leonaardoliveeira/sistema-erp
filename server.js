require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

/* ===============================
   SERVIR FRONTEND
================================ */
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ===============================
   SCHEMAS
================================ */

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  usuario: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  perfil: { type: String, enum: ["admin", "user"], default: "user" }
});

const ClienteSchema = new mongoose.Schema({
  nome: String,
  documento: String,
  email: String,
  telefone: String,
  regime: String,
  status: { type: String, default: "Pendente" },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true
  }
}, { timestamps: true });

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Cliente = mongoose.model("Cliente", ClienteSchema);

/* ===============================
   MIDDLEWARE TOKEN
================================ */

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ erro: "Token não fornecido" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido" });
  }
}

function verificarAdmin(req, res, next) {
  if (req.usuario.perfil !== "admin") {
    return res.status(403).json({ erro: "Acesso negado" });
  }
  next();
}

/* ===============================
   LOGIN
================================ */

app.post("/api/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    if (!usuario || !senha)
      return res.status(400).json({ erro: "Preencha usuário e senha" });

    const user = await Usuario.findOne({ usuario });

    if (!user)
      return res.status(400).json({ erro: "Usuário não encontrado" });

    if (user.senha !== senha)
      return res.status(400).json({ erro: "Senha incorreta" });

    const token = jwt.sign(
      { id: user._id, perfil: user.perfil },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, usuario: user });

  } catch (err) {
    console.log("Erro login:", err);
    res.status(500).json({ erro: "Erro no login" });
  }
});

/* ===============================
   USUÁRIOS (ADMIN)
================================ */

app.get("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  const usuarios = await Usuario.find();
  res.json(usuarios);
});

app.post("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const usuario = new Usuario(req.body);
    await usuario.save();
    res.json(usuario);
  } catch (err) {
    res.status(400).json({ erro: "Erro ao criar usuário" });
  }
});

/* ===============================
   CLIENTES
================================ */

app.get("/api/clientes", verificarToken, async (req, res) => {
  const clientes = await Cliente.find({ usuario: req.usuario.id });
  res.json(clientes);
});

app.post("/api/clientes", verificarToken, async (req, res) => {
  const cliente = new Cliente({
    ...req.body,
    usuario: req.usuario.id
  });

  await cliente.save();
  res.json(cliente);
});

/* ===============================
   CONEXÃO E START GARANTIDO
================================ */

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB conectado");

    // 🔥 GARANTE ADMIN SEMPRE
    let admin = await Usuario.findOne({ usuario: "admin" });

    if (!admin) {
      await Usuario.create({
        nome: "Administrador",
        usuario: "admin",
        senha: "123",
        perfil: "admin"
      });
      console.log("👑 Admin criado: admin / 123");
    } else {
      console.log("👑 Admin já existe");
    }

    const PORT = process.env.PORT || 10000;

    app.listen(PORT, () => {
      console.log("🚀 Servidor rodando na porta", PORT);
    });

  } catch (err) {
    console.log("❌ Erro ao iniciar servidor:", err);
  }
}

startServer();