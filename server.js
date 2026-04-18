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

// --------------------
// Conexão MongoDB
// --------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado ao MongoDB"))
  .catch(err => console.error("❌ Erro ao conectar:", err));


// --------------------
// SCHEMAS
// --------------------
const UsuarioSchema = new mongoose.Schema({
  nome:    { type: String, required: true },
  usuario: { type: String, required: true, unique: true },
  senha:   { type: String, required: true },
  // master: vê todos os clientes + gerencia usuários + cadastra clientes
  // admin:  vê apenas os próprios clientes + gerencia usuários + cadastra clientes
  // user:   vê apenas os próprios clientes + cadastra clientes
  perfil:  { type: String, enum: ["master", "admin", "user"], default: "user" }
});

const ClienteSchema = new mongoose.Schema({
  nome:      { type: String, required: true },
  documento: String,
  email:     String,
  telefone:  String,
  regime:    String,
  sped: {
    type: String,
    enum: ["Sim", "Nao"],
    default: "Nao"
  },
  acessosRemotos: [
    {
      nome:    String,
      anydesk: String
    }
  ],
  status:    { type: String, default: "Pendente" },
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true
  },
  criadoEm: { type: Date, default: Date.now }
});

const SpedSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente", required: true },
  mes:       { type: String, required: true },
  status:    { type: String, enum: ["nao", "gerado", "ok"], default: "nao" },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" }
});

const ConfigSchema = new mongoose.Schema({
  chave: { type: String, unique: true },
  mes:   Number,
  ano:   Number
});

// Schema para configuração de alertas SPED por usuário
const AlertaConfigSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true, unique: true },
  ativo:     { type: Boolean, default: true },
  horarios:  { type: [String], default: ["08:00"] }
});

const Usuario      = mongoose.model("Usuario", UsuarioSchema);
const Cliente      = mongoose.model("Cliente", ClienteSchema);
const Sped         = mongoose.model("Sped", SpedSchema);
const Config       = mongoose.model("Config", ConfigSchema);
const AlertaConfig = mongoose.model("AlertaConfig", AlertaConfigSchema);


// --------------------
// RESET MENSAL
// --------------------
async function verificarResetMensal() {
  try {
    // Força timezone do Brasil
    const agoraBrasil = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );

    const mesAtual = agoraBrasil.getMonth();
    const anoAtual = agoraBrasil.getFullYear();

    console.log("🕒 Data servidor UTC:", new Date());
    console.log("🇧🇷 Data Brasil:", agoraBrasil);

    const config = await Config.findOne({ chave: "resetMensalClientes" });

    console.log("📦 Config atual:", config);

    if (config && config.mes === mesAtual && config.ano === anoAtual) {
      console.log("✅ Reset já executado este mês");
      return;
    }

    console.log("🔄 Executando reset mensal automático...");

    const result = await Cliente.updateMany(
      { sped: "Sim" },
      { $set: { status: "Pendente" } }
    );

    console.log(`✅ ${result.modifiedCount} clientes resetados`);

    await Config.findOneAndUpdate(
      { chave: "resetMensalClientes" },
      { chave: "resetMensalClientes", mes: mesAtual, ano: anoAtual },
      { upsert: true, new: true }
    );

    console.log("💾 Config atualizada com sucesso");

  } catch (err) {
    console.error("❌ Erro no reset automático:", err);
  }
}


// --------------------
// HELPER: filtro por perfil
// master vê todos; admin e user veem apenas os próprios
// --------------------
function filtroPerfil(req) {
  if (req.usuario.perfil === "master") return {};
  return { usuarioId: req.usuario.id };
}


// --------------------
// MIDDLEWARES
// --------------------
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token não enviado" });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token inválido" });
    req.usuario = decoded; // { id, perfil }
    next();
  });
}

// master e admin gerenciam usuários; user não pode
function verificarAdmin(req, res, next) {
  if (req.usuario.perfil === "user")
    return res.status(403).json({ message: "Acesso negado" });
  next();
}


// --------------------
// LOGIN
// --------------------
app.post("/api/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const user = await Usuario.findOne({ usuario });
    if (!user) return res.status(401).json({ message: "Credenciais inválidas" });
    const match = await bcrypt.compare(senha, user.senha);
    if (!match) return res.status(401).json({ message: "Credenciais inválidas" });

    const token = jwt.sign(
      { id: user._id, perfil: user.perfil },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, usuario: { nome: user.nome, usuario: user.usuario, perfil: user.perfil } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// --------------------
// CLIENTES
// --------------------
app.get("/api/clientes", verificarToken, async (req, res) => {
  try {
    // Chama o reset automático
    await verificarResetMensal();

    const clientes = await Cliente.find(filtroPerfil(req)).sort({ nome: 1 });
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/clientes/:id", verificarToken, async (req, res) => {
  try {
    const filtro = req.usuario.perfil === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, ...filtroPerfil(req) };

    const cliente = await Cliente.findOne(filtro);
    if (!cliente) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Todos os 3 níveis podem cadastrar clientes
app.post("/api/clientes", verificarToken, async (req, res) => {
  try {
    const dadosCliente = { ...req.body, usuarioId: req.usuario.id };
    const novoCliente = await Cliente.create(dadosCliente);
    res.status(201).json(novoCliente);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put("/api/clientes/:id", verificarToken, async (req, res) => {
  try {
    const filtro = req.usuario.perfil === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, ...filtroPerfil(req) };

    const clienteAtualizado = await Cliente.findOneAndUpdate(filtro, req.body, { new: true });
    if (!clienteAtualizado) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(clienteAtualizado);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete("/api/clientes/:id", verificarToken, async (req, res) => {
  try {
    const filtro = req.usuario.perfil === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, ...filtroPerfil(req) };

    const removido = await Cliente.findOneAndDelete(filtro);
    if (!removido) return res.status(404).json({ message: "Não autorizado" });
    res.json({ message: "Cliente removido" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// --------------------
// ALERTAS — SPED PENDENTES
// --------------------
app.get("/api/alertas/sped-pendentes", verificarToken, async (req, res) => {
  try {
    const filtro = { ...filtroPerfil(req), sped: "Sim", status: "Pendente" };
    const total = await Cliente.countDocuments(filtro);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Ler configuração de alertas do usuário logado
app.get("/api/alertas/config", verificarToken, async (req, res) => {
  try {
    let config = await AlertaConfig.findOne({ usuarioId: req.usuario.id });
    if (!config) config = { ativo: true, horarios: ["08:00"] };
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Salvar configuração de alertas do usuário logado
app.post("/api/alertas/config", verificarToken, async (req, res) => {
  try {
    const { ativo, horarios } = req.body;
    const config = await AlertaConfig.findOneAndUpdate(
      { usuarioId: req.usuario.id },
      { usuarioId: req.usuario.id, ativo, horarios },
      { upsert: true, new: true }
    );
    res.json(config);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// --------------------
// SPED
// --------------------
app.get("/api/sped/:mes", verificarToken, async (req, res) => {
  try {
    const clientesMeus = await Cliente.find(filtroPerfil(req));
    const idsMeus = clientesMeus.map(c => c._id);
    const speds = await Sped.find({ mes: req.params.mes, clienteId: { $in: idsMeus } }).populate("clienteId");
    res.json(speds);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/sped", verificarToken, async (req, res) => {
  try {
    const { clienteId, mes, status } = req.body;
    const cliente = await Cliente.findOne({ _id: clienteId, usuarioId: req.usuario.id });
    if (!cliente && req.usuario.perfil === "user") return res.status(403).json({ message: "Não autorizado" });

    let registro = await Sped.findOne({ clienteId, mes });
    if (registro) {
      registro.status = status;
      await registro.save();
    } else {
      registro = await Sped.create({ clienteId, mes, status, usuarioId: req.usuario.id });
    }
    res.json(registro);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// --------------------
// USUÁRIOS (master e admin)
// --------------------
app.get("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find().select("-senha");
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/usuarios", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { nome, usuario, senha, perfil } = req.body;
    if (!nome || !usuario || !senha) return res.status(400).json({ message: "Campos obrigatórios" });
    const hash = await bcrypt.hash(senha, 10);
    const novo = await Usuario.create({ nome, usuario, senha: hash, perfil });
    res.status(201).json({ message: "Usuário criado", id: novo._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put("/api/usuarios/:id", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { nome, usuario, senha, perfil } = req.body;
    const dados = { nome, usuario, perfil };
    if (senha) dados.senha = await bcrypt.hash(senha, 10);
    const atualizado = await Usuario.findByIdAndUpdate(req.params.id, dados, { new: true });
    if (!atualizado) return res.status(404).json({ message: "Usuário não encontrado" });
    res.json(atualizado);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete("/api/usuarios/:id", verificarToken, verificarAdmin, async (req, res) => {
  try {
    const removido = await Usuario.findByIdAndDelete(req.params.id);
    if (!removido) return res.status(404).json({ message: "Usuário não encontrado" });
    res.json({ message: "Usuário removido" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// --------------------
// INICIAR SERVIDOR
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));