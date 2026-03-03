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

// 👥 CLIENTE (Alterado para incluir usuarioId)
const ClienteSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  documento: String,
  email: String,
  telefone: String,
  regime: String,
  status: { type: String, default: "Pendente" },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true }, // VINCULA AO DONO
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
// 🔐 MIDDLEWARES DE AUTENTICAÇÃO
// =======================
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token não enviado" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token inválido" });
    req.usuario = decoded; // Salva os dados do usuário logado (id e perfil) na requisição
    next();
  });
}

function verificarAdmin(req, res, next) {
  if (req.usuario.perfil !== "admin") return res.status(403).json({ message: "Acesso negado" });
  next();
}

// =======================
// 🔑 ROTAS DE LOGIN
// =======================
app.post("/api/login", async (req, res) => {
  const { usuario, senha } = req.body;
  try {
    const user = await Usuario.findOne({ usuario });
    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    // Incluímos o ID do usuário no Token
    const token = jwt.sign({ id: user._id, perfil: user.perfil }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, usuario: { nome: user.nome, usuario: user.usuario, perfil: user.perfil } });
  } catch (error) {
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// =======================
// 📁 ROTAS DE CLIENTES (FILTRADAS POR USUÁRIO)
// =======================

// Listar clientes (Só vê os próprios)
app.get("/api/clientes", verificarToken, async (req, res) => {
  // Se for admin, vê tudo. Se for user comum, vê apenas onde usuarioId = seu ID.
  const filtro = req.usuario.perfil === "admin" ? {} : { usuarioId: req.usuario.id };
  const clientes = await Cliente.find(filtro).sort({ nome: 1 });
  res.json(clientes);
});

// Cadastrar cliente (Vincula automaticamente ao usuário logado)
app.post("/api/clientes", verificarToken, async (req, res) => {
  try {
    const dados = { ...req.body, usuarioId: req.usuario.id }; // Injeta o ID do dono
    const novoCliente = await Cliente.create(dados);
    res.status(201).json(novoCliente);
  } catch (error) {
    res.status(400).json({ message: "Erro ao cadastrar cliente" });
  }
});

// Editar cliente (Verifica se é o dono antes de editar)
app.put("/api/clientes/:id", verificarToken, async (req, res) => {
  const filtro = req.usuario.perfil === "admin" ? { _id: req.params.id } : { _id: req.params.id, usuarioId: req.usuario.id };
  
  const clienteAtualizado = await Cliente.findOneAndUpdate(filtro, req.body, { new: true });
  
  if (!clienteAtualizado) return res.status(404).json({ message: "Cliente não encontrado ou você não tem permissão" });
  res.json(clienteAtualizado);
});

// Excluir cliente (Verifica se é o dono antes de deletar)
app.delete("/api/clientes/:id", verificarToken, async (req, res) => {
  const filtro = req.usuario.perfil === "admin" ? { _id: req.params.id } : { _id: req.params.id, usuarioId: req.usuario.id };
  
  const removido = await Cliente.findOneAndDelete(filtro);
  
  if (!removido) return res.status(404).json({ message: "Não autorizado ou cliente inexistente" });
  res.json({ message: "Cliente removido" });
});

// =======================
// 📑 SPED (FILTRADO POR CLIENTES DO USUÁRIO)
// =======================
app.get("/api/sped/:mes", verificarToken, async (req, res) => {
  // Primeiro pegamos os IDs dos clientes que pertencem ao usuário
  const filtroClientes = req.usuario.perfil === "admin" ? {} : { usuarioId: req.usuario.id };
  const meusClientes = await Cliente.find(filtroClientes).select("_id");
  const idsMeusClientes = meusClientes.map(c => c._id);

  // Agora buscamos o SPED apenas desses clientes
  const speds = await Sped.find({ 
    mes: req.params.mes, 
    clienteId: { $in: idsMeusClientes } 
  }).populate("clienteId");
  
  res.json(speds);
});

// =======================
// 👥 USUÁRIOS (GERENCIAMENTO)
// =======================
app.get("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  const usuarios = await Usuario.find().select("-senha");
  res.json(usuarios);
});

// Adicione aqui POST, PUT e DELETE de usuários se precisar gerenciar pelo front-end

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));