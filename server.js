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
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true }, // VINCULO
  criadoEm: { type: Date, default: Date.now }
});

const SpedSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente", required: true },
  mes: { type: String, required: true },
  status: { type: String, enum: ["nao", "gerado", "ok"], default: "nao" }
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Cliente = mongoose.model("Cliente", ClienteSchema);
const Sped = mongoose.model("Sped", SpedSchema);

// =======================
// 🔐 MIDDLEWARES DE AUTENTICAÇÃO
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
// 🔑 ROTA DE LOGIN
// =======================
app.post("/api/login", async (req, res) => {
  const { usuario, senha } = req.body;
  try {
    const user = await Usuario.findOne({ usuario });
    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return res.status(401).json({ message: "Usuário ou senha inválidos" });
    }
    const token = jwt.sign(
      { id: user._id, perfil: user.perfil }, 
      process.env.JWT_SECRET, 
      { expiresIn: "8h" }
    );
    res.json({ token, usuario: { nome: user.nome, usuario: user.usuario, perfil: user.perfil } });
  } catch (error) {
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// =======================
// 👥 ROTAS DE USUÁRIOS (GERENCIAMENTO ADMIN)
// =======================

// Listar todos os usuários
app.get("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  const usuarios = await Usuario.find().select("-senha");
  res.json(usuarios);
});

// Criar novo usuário
app.post("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { nome, usuario, senha, perfil } = req.body;
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);
    
    const novoUsuario = await Usuario.create({
      nome,
      usuario,
      senha: senhaHash,
      perfil
    });
    res.status(201).json({ message: "Usuário criado com sucesso" });
  } catch (error) {
    res.status(400).json({ message: "Erro ao criar usuário. Talvez o login já exista." });
  }
});

// Editar usuário
app.put("/api/usuarios/:id", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { nome, usuario, perfil, senha } = req.body;
    let dadosAtualizados = { nome, usuario, perfil };

    if (senha) {
      const salt = await bcrypt.genSalt(10);
      dadosAtualizados.senha = await bcrypt.hash(senha, salt);
    }

    await Usuario.findByIdAndUpdate(req.params.id, dadosAtualizados);
    res.json({ message: "Usuário atualizado com sucesso" });
  } catch (error) {
    res.status(400).json({ message: "Erro ao atualizar usuário" });
  }
});

// Excluir usuário
app.delete("/api/usuarios/:id", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const user = await Usuario.findById(req.params.id);
    if (user.usuario === 'admin') return res.status(400).json({ message: "Não é possível excluir o admin mestre" });
    
    await Usuario.findByIdAndDelete(req.params.id);
    res.json({ message: "Usuário removido" });
  } catch (error) {
    res.status(400).json({ message: "Erro ao remover usuário" });
  }
});

// =======================
// 📁 ROTAS DE CLIENTES (FILTRADAS POR USUÁRIO)
// =======================

app.get("/api/clientes", verificarToken, async (req, res) => {
  const filtro = req.usuario.perfil === "admin" ? {} : { usuarioId: req.usuario.id };
  const clientes = await Cliente.find(filtro).sort({ nome: 1 });
  res.json(clientes);
});

app.post("/api/clientes", verificarToken, async (req, res) => {
  try {
    const dados = { ...req.body, usuarioId: req.usuario.id };
    const novo = await Cliente.create(dados);
    res.status(201).json(novo);
  } catch (error) {
    res.status(400).json({ message: "Erro ao cadastrar cliente" });
  }
});

app.put("/api/clientes/:id", verificarToken, async (req, res) => {
  const filtro = req.usuario.perfil === "admin" ? { _id: req.params.id } : { _id: req.params.id, usuarioId: req.usuario.id };
  const atualizado = await Cliente.findOneAndUpdate(filtro, req.body, { new: true });
  if (!atualizado) return res.status(404).json({ message: "Cliente não encontrado ou sem permissão" });
  res.json(atualizado);
});

app.delete("/api/clientes/:id", verificarToken, async (req, res) => {
  const filtro = req.usuario.perfil === "admin" ? { _id: req.params.id } : { _id: req.params.id, usuarioId: req.usuario.id };
  const deletado = await Cliente.findOneAndDelete(filtro);
  if (!deletado) return res.status(404).json({ message: "Não autorizado" });
  res.json({ message: "Removido com sucesso" });
});

// =======================
// 📑 SPED
// =======================
app.get("/api/sped/:mes", verificarToken, async (req, res) => {
  const clientesFiltro = await Cliente.find(req.usuario.perfil === "admin" ? {} : { usuarioId: req.usuario.id });
  const ids = clientesFiltro.map(c => c._id);
  const speds = await Sped.find({ mes: req.params.mes, clienteId: { $in: ids } }).populate("clienteId");
  res.json(speds);
});

app.post("/api/sped", verificarToken, async (req, res) => {
  const { clienteId, mes, status } = req.body;
  let registro = await Sped.findOne({ clienteId, mes });
  if (registro) {
    registro.status = status;
    await registro.save();
  } else {
    await Sped.create({ clienteId, mes, status });
  }
  res.json({ message: "Status SPED atualizado" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));