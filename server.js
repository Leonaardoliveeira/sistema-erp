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
   SERVIR FRONTEND (PASTA PUBLIC)
================================ */
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ===============================
   CONEXÃO MONGODB
================================ */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.log("❌ Erro MongoDB:", err));

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

const TarefaSpedSchema = new mongoose.Schema({
  mes: String,
  status: String,
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cliente"
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true
  }
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Cliente = mongoose.model("Cliente", ClienteSchema);
const TarefaSped = mongoose.model("TarefaSped", TarefaSpedSchema);

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
   CRIAR ADMIN AUTOMÁTICO
================================ */
async function criarAdminInicial() {
  const admin = await Usuario.findOne({ usuario: "admin" });
  if (!admin) {
    await Usuario.create({
      nome: "Administrador",
      usuario: "admin",
      senha: "123",
      perfil: "admin"
    });
    console.log("👑 Admin criado automaticamente");
  }
}
criarAdminInicial();

/* ===============================
   LOGIN
================================ */

app.post("/api/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    const user = await Usuario.findOne({ usuario, senha });
    if (!user)
      return res.status(400).json({ erro: "Usuário ou senha inválidos" });

    const token = jwt.sign(
      { id: user._id, perfil: user.perfil },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, usuario: user });
  } catch {
    res.status(500).json({ erro: "Erro no login" });
  }
});

/* ===============================
   USUÁRIOS (ADMIN)
================================ */

app.get("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.json(usuarios);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar usuários" });
  }
});

app.post("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const usuario = new Usuario(req.body);
    await usuario.save();
    res.json(usuario);
  } catch {
    res.status(400).json({ erro: "Erro ao criar usuário" });
  }
});

app.put("/api/usuarios/:id", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(usuario);
  } catch {
    res.status(400).json({ erro: "Erro ao atualizar usuário" });
  }
});

app.delete("/api/usuarios/:id", verificarToken, verificarAdmin, async (req, res) => {
  try {
    await Usuario.findByIdAndDelete(req.params.id);
    res.json({ msg: "Usuário removido" });
  } catch {
    res.status(400).json({ erro: "Erro ao excluir usuário" });
  }
});

/* ===============================
   CLIENTES (ISOLADO POR USUÁRIO)
================================ */

app.get("/api/clientes", verificarToken, async (req, res) => {
  try {
    const clientes = await Cliente.find({ usuario: req.usuario.id });
    res.json(clientes);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar clientes" });
  }
});

app.post("/api/clientes", verificarToken, async (req, res) => {
  try {
    const cliente = new Cliente({
      ...req.body,
      usuario: req.usuario.id
    });

    await cliente.save();
    res.json(cliente);
  } catch {
    res.status(400).json({ erro: "Erro ao criar cliente" });
  }
});

app.put("/api/clientes/:id", verificarToken, async (req, res) => {
  try {
    const cliente = await Cliente.findOneAndUpdate(
      { _id: req.params.id, usuario: req.usuario.id },
      req.body,
      { new: true }
    );

    res.json(cliente);
  } catch {
    res.status(400).json({ erro: "Erro ao atualizar cliente" });
  }
});

app.delete("/api/clientes/:id", verificarToken, async (req, res) => {
  try {
    await Cliente.findOneAndDelete({
      _id: req.params.id,
      usuario: req.usuario.id
    });

    res.json({ msg: "Cliente removido" });
  } catch {
    res.status(400).json({ erro: "Erro ao excluir cliente" });
  }
});

/* ===============================
   TAREFAS SPED
================================ */

app.get("/api/sped/:mes", verificarToken, async (req, res) => {
  try {
    const tarefas = await TarefaSped.find({
      mes: req.params.mes,
      usuario: req.usuario.id
    }).populate("cliente");

    res.json(tarefas);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar tarefas" });
  }
});

app.post("/api/sped", verificarToken, async (req, res) => {
  try {
    const tarefa = new TarefaSped({
      ...req.body,
      usuario: req.usuario.id
    });

    await tarefa.save();
    res.json(tarefa);
  } catch {
    res.status(400).json({ erro: "Erro ao salvar tarefa" });
  }
});

/* ===============================
   START
================================ */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🚀 Servidor rodando na porta", PORT);
});