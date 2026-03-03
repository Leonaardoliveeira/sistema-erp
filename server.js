require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

// =======================
// 🔧 MIDDLEWARES
// =======================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =======================
// 🔥 CONEXÃO MONGODB
// =======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado ao MongoDB"))
  .catch(err => console.error("❌ Erro ao conectar:", err));

// =======================
// 📦 SCHEMAS
// =======================

// 👤 USUÁRIO
const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  usuario: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  perfil: { type: String, enum: ["admin", "user"], default: "user" }
});

// 👥 CLIENTE
const ClienteSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  documento: String,
  email: String,
  telefone: String,
  regime: String,
  status: { type: String, default: "Pendente" },
  criadoEm: { type: Date, default: Date.now }
});

// 📑 SPED
const SpedSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente", required: true },
  mes: { type: String, required: true },
  status: { type: String, enum: ["nao", "gerado", "ok"], default: "nao" }
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Cliente = mongoose.model("Cliente", ClienteSchema);
const Sped = mongoose.model("Sped", SpedSchema);

// =======================
// 👑 CRIAR ADMIN PADRÃO
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

    console.log("👑 Admin criado: admin | 123");
  }
}
criarAdmin();

// =======================
// 🔐 MIDDLEWARE TOKEN
// =======================
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ message: "Token não enviado" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(401).json({ message: "Token inválido ou expirado" });

    req.usuario = decoded;
    next();
  });
}

function verificarAdmin(req, res, next) {
  if (req.usuario.perfil !== "admin")
    return res.status(403).json({ message: "Apenas administradores" });

  next();
}

// =======================
// 🔑 LOGIN
// =======================
app.post("/api/login", async (req, res) => {
  const { usuario, senha } = req.body;

  const user = await Usuario.findOne({ usuario });

  if (!user || !(await bcrypt.compare(senha, user.senha)))
    return res.status(401).json({ message: "Usuário ou senha incorretos" });

  const token = jwt.sign(
    { id: user._id, perfil: user.perfil },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    usuario: {
      nome: user.nome,
      usuario: user.usuario,
      perfil: user.perfil
    }
  });
});

// =======================
// 👤 USUÁRIOS (ADMIN)
// =======================

app.get("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  const usuarios = await Usuario.find().select("-senha");
  res.json(usuarios);
});

app.post("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {

  const { nome, usuario, senha, perfil } = req.body;

  const existe = await Usuario.findOne({ usuario });
  if (existe)
    return res.status(400).json({ message: "Usuário já existe" });

  const senhaHash = await bcrypt.hash(senha, 10);

  const novoUsuario = await Usuario.create({
    nome,
    usuario,
    senha: senhaHash,
    perfil
  });

  res.status(201).json({
    _id: novoUsuario._id,
    nome: novoUsuario.nome,
    usuario: novoUsuario.usuario,
    perfil: novoUsuario.perfil
  });
});

app.put("/api/usuarios/:id", verificarToken, verificarAdmin, async (req, res) => {

  const { nome, usuario, senha, perfil } = req.body;

  const dadosAtualizados = { nome, usuario, perfil };

  if (senha)
    dadosAtualizados.senha = await bcrypt.hash(senha, 10);

  const usuarioAtualizado = await Usuario.findByIdAndUpdate(
    req.params.id,
    dadosAtualizados,
    { new: true }
  ).select("-senha");

  res.json(usuarioAtualizado);
});

app.delete("/api/usuarios/:id", verificarToken, verificarAdmin, async (req, res) => {

  const usuario = await Usuario.findById(req.params.id);

  if (usuario.usuario === "admin")
    return res.status(400).json({ message: "Não é possível remover o admin principal" });

  await Usuario.findByIdAndDelete(req.params.id);

  res.json({ message: "Usuário removido" });
});

// =======================
// 👥 CLIENTES
// =======================

app.get("/api/clientes", verificarToken, async (req, res) => {
  const clientes = await Cliente.find().sort({ criadoEm: -1 });
  res.json(clientes);
});

app.post("/api/clientes", verificarToken, verificarAdmin, async (req, res) => {
  const novoCliente = await Cliente.create(req.body);
  res.status(201).json(novoCliente);
});

app.put("/api/clientes/:id", verificarToken, verificarAdmin, async (req, res) => {
  const clienteAtualizado = await Cliente.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(clienteAtualizado);
});

app.delete("/api/clientes/:id", verificarToken, verificarAdmin, async (req, res) => {
  await Cliente.findByIdAndDelete(req.params.id);
  res.json({ message: "Cliente removido" });
});

// =======================
// 📑 SPED
// =======================

app.get("/api/sped/:mes", verificarToken, async (req, res) => {
  const speds = await Sped.find({ mes: req.params.mes }).populate("clienteId");
  res.json(speds);
});

app.post("/api/sped", verificarToken, async (req, res) => {

  const { clienteId, mes, status } = req.body;

  let registro = await Sped.findOne({ clienteId, mes });

  if (registro) {
    registro.status = status;
    await registro.save();
  } else {
    registro = await Sped.create({ clienteId, mes, status });
  }

  res.json(registro);
});

// =======================
// 🌍 FRONTEND
// =======================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));