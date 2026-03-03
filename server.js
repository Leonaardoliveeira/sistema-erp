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

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado ao MongoDB"))
  .catch(err => console.error("❌ Erro ao conectar:", err));

// SCHEMAS
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
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true }, // VINCULA AO USUÁRIO
  criadoEm: { type: Date, default: Date.now }
});

const SpedSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente", required: true },
  mes: { type: String, required: true },
  status: { type: String, enum: ["nao", "gerado", "ok"], default: "nao" },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" } // Opcional: para filtros rápidos no SPED
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Cliente = mongoose.model("Cliente", ClienteSchema);
const Sped = mongoose.model("Sped", SpedSchema);

// MIDDLEWARES
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token não enviado" });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token inválido" });
    req.usuario = decoded; // Aqui pegamos o ID do usuário logado
    next();
  });
}

function verificarAdmin(req, res, next) {
  if (req.usuario.perfil !== "admin") return res.status(403).json({ message: "Acesso negado" });
  next();
}

// ROTAS DE LOGIN E USUÁRIOS (MANTIDAS)
app.post("/api/login", async (req, res) => {
  const { usuario, senha } = req.body;
  const user = await Usuario.findOne({ usuario });
  if (!user || !(await bcrypt.compare(senha, user.senha))) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }
  const token = jwt.sign({ id: user._id, perfil: user.perfil }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, usuario: { nome: user.nome, usuario: user.usuario, perfil: user.perfil } });
});

// ROTAS DE CLIENTES (AGORA POR USUÁRIO)
app.get("/api/clientes", verificarToken, async (req, res) => {
  // Se for admin, vê tudo. Se for user, vê só os dele.
  const filtro = req.usuario.perfil === "admin" ? {} : { usuarioId: req.usuario.id };
  const clientes = await Cliente.find(filtro).sort({ nome: 1 });
  res.json(clientes);
});

app.post("/api/clientes", verificarToken, async (req, res) => {
  // Injeta automaticamente o ID do usuário logado no novo cliente
  const dadosCliente = { ...req.body, usuarioId: req.usuario.id };
  const novoCliente = await Cliente.create(dadosCliente);
  res.status(201).json(novoCliente);
});

app.put("/api/clientes/:id", verificarToken, async (req, res) => {
  const filtro = req.usuario.perfil === "admin" ? { _id: req.params.id } : { _id: req.params.id, usuarioId: req.usuario.id };
  const clienteAtualizado = await Cliente.findOneAndUpdate(filtro, req.body, { new: true });
  if (!clienteAtualizado) return res.status(404).json({ message: "Cliente não encontrado ou sem permissão" });
  res.json(clienteAtualizado);
});

app.delete("/api/clientes/:id", verificarToken, async (req, res) => {
  const filtro = req.usuario.perfil === "admin" ? { _id: req.params.id } : { _id: req.params.id, usuarioId: req.usuario.id };
  const removido = await Cliente.findOneAndDelete(filtro);
  if (!removido) return res.status(404).json({ message: "Não autorizado" });
  res.json({ message: "Cliente removido" });
});

// SPED (Filtrado por clientes do usuário)
app.get("/api/sped/:mes", verificarToken, async (req, res) => {
  const clientesMeus = await Cliente.find(req.usuario.perfil === "admin" ? {} : { usuarioId: req.usuario.id });
  const idsMeus = clientesMeus.map(c => c._id);
  const speds = await Sped.find({ mes: req.params.mes, clienteId: { $in: idsMeus } }).populate("clienteId");
  res.json(speds);
});

app.post("/api/sped", verificarToken, async (req, res) => {
  const { clienteId, mes, status } = req.body;
  // Verifica se o cliente pertence ao usuário antes de salvar o SPED
  const cliente = await Cliente.findOne({ _id: clienteId, usuarioId: req.usuario.id });
  if (!cliente && req.usuario.perfil !== "admin") return res.status(403).json({ message: "Não autorizado" });

  let registro = await Sped.findOne({ clienteId, mes });
  if (registro) {
    registro.status = status;
    await registro.save();
  } else {
    registro = await Sped.create({ clienteId, mes, status });
  }
  res.json(registro);
});

// Restante das rotas de usuários (Admin apenas)...
app.get("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
    const usuarios = await Usuario.find().select("-senha");
    res.json(usuarios);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));