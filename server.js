require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   CONEXÃO MONGODB
========================= */

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado ao MongoDB");

    await criarAdmin();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () =>
      console.log(`🚀 Servidor rodando na porta ${PORT}`)
    );

  } catch (err) {
    console.error("❌ Erro ao iniciar:", err);
  }
}

/* =========================
   SCHEMAS
========================= */

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  usuario: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  perfil: { type: String, enum: ["admin", "user"], default: "user" }
});

const ClienteSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  documento: String,
  email: String,
  telefone: String,
  regime: String,
  status: { type: String, default: "Pendente" },
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true
  },
  criadoEm: { type: Date, default: Date.now }
});

const SpedSchema = new mongoose.Schema({
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cliente",
    required: true
  },
  mes: { type: String, required: true },
  status: { type: String, enum: ["nao", "gerado", "ok"], default: "nao" }
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Cliente = mongoose.model("Cliente", ClienteSchema);
const Sped = mongoose.model("Sped", SpedSchema);

/* =========================
   CRIAR ADMIN PADRÃO
========================= */

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

/* =========================
   MIDDLEWARE TOKEN
========================= */

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "Token não enviado" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(401).json({ message: "Token inválido" });

    req.usuario = decoded;
    next();
  });
}

function verificarAdmin(req, res, next) {
  if (req.usuario.perfil !== "admin")
    return res.status(403).json({ message: "Acesso negado" });

  next();
}

/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {
  const { usuario, senha } = req.body;

  const user = await Usuario.findOne({ usuario });
  if (!user) return res.status(401).json({ message: "Usuário não encontrado" });

  const senhaValida = await bcrypt.compare(senha, user.senha);
  if (!senhaValida)
    return res.status(401).json({ message: "Senha incorreta" });

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
});

/* =========================
   CLIENTES (POR USUÁRIO)
========================= */

app.get("/api/clientes", verificarToken, async (req, res) => {

  const filtro =
    req.usuario.perfil === "admin"
      ? {}
      : { usuarioId: req.usuario.id };

  const clientes = await Cliente.find(filtro).sort({ nome: 1 });

  res.json(clientes);
});

app.post("/api/clientes", verificarToken, async (req, res) => {

  const novoCliente = await Cliente.create({
    ...req.body,
    usuarioId: req.usuario.id
  });

  res.status(201).json(novoCliente);
});

app.put("/api/clientes/:id", verificarToken, async (req, res) => {

  const filtro =
    req.usuario.perfil === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, usuarioId: req.usuario.id };

  const atualizado = await Cliente.findOneAndUpdate(
    filtro,
    req.body,
    { new: true }
  );

  if (!atualizado)
    return res.status(404).json({ message: "Não autorizado" });

  res.json(atualizado);
});

app.delete("/api/clientes/:id", verificarToken, async (req, res) => {

  const filtro =
    req.usuario.perfil === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, usuarioId: req.usuario.id };

  const removido = await Cliente.findOneAndDelete(filtro);

  if (!removido)
    return res.status(404).json({ message: "Não autorizado" });

  res.json({ message: "Cliente removido" });
});

/* =========================
   SPED (FILTRADO PELO DONO)
========================= */

app.get("/api/sped/:mes", verificarToken, async (req, res) => {

  const filtroClientes =
    req.usuario.perfil === "admin"
      ? {}
      : { usuarioId: req.usuario.id };

  const meusClientes = await Cliente.find(filtroClientes);
  const ids = meusClientes.map(c => c._id);

  const speds = await Sped.find({
    mes: req.params.mes,
    clienteId: { $in: ids }
  }).populate("clienteId");

  res.json(speds);
});

app.post("/api/sped", verificarToken, async (req, res) => {

  const { clienteId, mes, status } = req.body;

  const cliente = await Cliente.findById(clienteId);

  if (!cliente)
    return res.status(404).json({ message: "Cliente não encontrado" });

  if (
    req.usuario.perfil !== "admin" &&
    cliente.usuarioId.toString() !== req.usuario.id
  ) {
    return res.status(403).json({ message: "Não autorizado" });
  }

  let registro = await Sped.findOne({ clienteId, mes });

  if (registro) {
    registro.status = status;
    await registro.save();
  } else {
    registro = await Sped.create({ clienteId, mes, status });
  }

  res.json(registro);
});

/* =========================
   USUÁRIOS (ADMIN)
========================= */

app.get("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  const usuarios = await Usuario.find().select("-senha");
  res.json(usuarios);
});

/* =========================
   START
========================= */

startServer();