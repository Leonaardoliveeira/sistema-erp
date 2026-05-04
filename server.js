require("dotenv").config();
const express   = require("express");
const path      = require("path");
const cors      = require("cors");
const mongoose  = require("mongoose");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --------------------
// CONEXÃO MONGODB
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
  // master: vê todos os clientes + gerencia usuários
  // admin:  vê apenas os próprios + gerencia usuários
  // user:   vê apenas os próprios, não gerencia usuários
  perfil:  { type: String, enum: ["master", "admin", "user"], default: "user" }
});

const ClienteSchema = new mongoose.Schema({
  nome:           { type: String, required: true },
  documento:      String,
  email:          String,
  telefone:       String,
  regime:         String,
  sped:           { type: String, enum: ["Sim", "Nao"], default: "Nao" },
  acessosRemotos: [{ nome: String, anydesk: String }],
  status:         { type: String, default: "Pendente" },
  usuarioId:      { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  criadoEm:       { type: Date, default: Date.now }
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

const AlertaConfigSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true, unique: true },
  ativo:     { type: Boolean, default: true },
  horarios:  { type: [String], default: ["08:00"] }
});

const BackupSchema = new mongoose.Schema({
  clienteId:  { type: mongoose.Schema.Types.ObjectId, ref: "Cliente", required: true },
  usuarioId:  { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  status:     { type: String, enum: ["ok", "falha", "pendente"], default: "pendente" },
  tamanho:    { type: String },
  destino:    { type: String },
  observacao: { type: String },
  dataBackup: { type: Date, required: true },
  criadoEm:  { type: Date, default: Date.now }
});

// Registra models apenas uma vez (evita erro no Vercel com hot-reload)
const Usuario      = mongoose.models.Usuario      || mongoose.model("Usuario",      UsuarioSchema);
const Cliente      = mongoose.models.Cliente      || mongoose.model("Cliente",      ClienteSchema);
const Sped         = mongoose.models.Sped         || mongoose.model("Sped",         SpedSchema);
const Config       = mongoose.models.Config       || mongoose.model("Config",       ConfigSchema);
const AlertaConfig = mongoose.models.AlertaConfig || mongoose.model("AlertaConfig", AlertaConfigSchema);
const Backup       = mongoose.models.Backup       || mongoose.model("Backup",       BackupSchema);

// --------------------
// RESET MENSAL
// --------------------
async function verificarResetMensal() {
  try {
    const agoraBrasil = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mesAtual = agoraBrasil.getMonth();
    const anoAtual = agoraBrasil.getFullYear();
    const config = await Config.findOne({ chave: "resetMensalClientes" });
    if (config && config.mes === mesAtual && config.ano === anoAtual) return;
    const result = await Cliente.updateMany({ sped: "Sim" }, { $set: { status: "Pendente" } });
    console.log("Reset mensal: " + result.modifiedCount + " clientes resetados");
    await Config.findOneAndUpdate(
      { chave: "resetMensalClientes" },
      { chave: "resetMensalClientes", mes: mesAtual, ano: anoAtual },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("Erro no reset:", err);
  }
}

// --------------------
// HELPERS
// --------------------
// master vê todos; admin e user veem só os próprios
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
    req.usuario = decoded;
    next();
  });
}

// Apenas user não pode gerenciar usuários
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
    const token = jwt.sign({ id: user._id, perfil: user.perfil }, process.env.JWT_SECRET, { expiresIn: "8h" });
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
    await verificarResetMensal();
    const clientes = await Cliente.find(filtroPerfil(req)).sort({ nome: 1 });
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/clientes/:id", verificarToken, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, ...filtroPerfil(req) });
    if (!cliente) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/clientes", verificarToken, async (req, res) => {
  try {
    const { nome, documento, email, telefone, regime, sped, acessosRemotos } = req.body;
    const novoCliente = await Cliente.create({
      nome, documento, email, telefone, regime, sped, acessosRemotos,
      usuarioId: req.usuario.id
    });
    res.status(201).json(novoCliente);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put("/api/clientes/:id", verificarToken, async (req, res) => {
  try {
    const filtro = { _id: req.params.id, ...filtroPerfil(req) };
    const { nome, documento, email, telefone, regime, sped, acessosRemotos, status } = req.body;
    const dados = {};
    if (nome          !== undefined) dados.nome          = nome;
    if (documento     !== undefined) dados.documento     = documento;
    if (email         !== undefined) dados.email         = email;
    if (telefone      !== undefined) dados.telefone      = telefone;
    if (regime        !== undefined) dados.regime        = regime;
    if (sped          !== undefined) dados.sped          = sped;
    if (acessosRemotos!== undefined) dados.acessosRemotos= acessosRemotos;
    if (status        !== undefined) dados.status        = status;
    const atualizado = await Cliente.findOneAndUpdate(filtro, dados, { new: true });
    if (!atualizado) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(atualizado);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete("/api/clientes/:id", verificarToken, async (req, res) => {
  try {
    const removido = await Cliente.findOneAndDelete({ _id: req.params.id, ...filtroPerfil(req) });
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

app.get("/api/alertas/config", verificarToken, async (req, res) => {
  try {
    let config = await AlertaConfig.findOne({ usuarioId: req.usuario.id });
    if (!config) config = { ativo: true, horarios: ["08:00"] };
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
    const cliente = await Cliente.findOne({ _id: clienteId, ...filtroPerfil(req) });
    if (!cliente) return res.status(403).json({ message: "Não autorizado" });
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
// USUÁRIOS
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
// BACKUP
// --------------------
app.post("/api/backup", verificarToken, async (req, res) => {
  try {
    const { clienteId, status, tamanho, destino, observacao, dataBackup } = req.body;
    if (!clienteId || !status) return res.status(400).json({ message: "clienteId e status são obrigatórios" });
    const cliente = await Cliente.findOne({ _id: clienteId, ...filtroPerfil(req) });
    if (!cliente) return res.status(404).json({ message: "Cliente não encontrado" });
    const backup = await Backup.create({
      clienteId, usuarioId: req.usuario.id, status,
      tamanho:    tamanho    || null,
      destino:    destino    || null,
      observacao: observacao || null,
      dataBackup: dataBackup ? new Date(dataBackup) : new Date()
    });
    res.status(201).json(backup);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get("/api/backup/resumo", verificarToken, async (req, res) => {
  try {
    const clientesVisiveis = await Cliente.find(filtroPerfil(req)).select("_id nome");
    const idsVisiveis = clientesVisiveis.map(c => c._id);

    const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    hoje.setHours(0, 0, 0, 0);

    const backupsHoje = await Backup.find({
      clienteId: { $in: idsVisiveis },
      status: "ok",
      dataBackup: { $gte: hoje }
    }).select("clienteId");

    const idsComBackup   = new Set(backupsHoje.map(b => b.clienteId.toString()));
    const totalClientes  = clientesVisiveis.length;
    const comBackup      = idsComBackup.size;
    const semBackup      = totalClientes - comBackup;
    const semBackupLista = clientesVisiveis.filter(c => !idsComBackup.has(c._id.toString()));

    const ultimosBackups = await Backup.aggregate([
      { $match: { clienteId: { $in: idsVisiveis } } },
      { $sort:  { dataBackup: -1 } },
      { $group: { _id: "$clienteId", ultimo: { $first: "$$ROOT" } } }
    ]);

    res.json({ totalClientes, comBackup, semBackup, semBackupLista, ultimosBackups });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/backup", verificarToken, async (req, res) => {
  try {
    const { clienteId, status, dias } = req.query;
    const clientesVisiveis = await Cliente.find(filtroPerfil(req)).select("_id");
    const idsVisiveis = clientesVisiveis.map(c => c._id);

    const filtro = { clienteId: { $in: idsVisiveis } };
    if (clienteId) filtro.clienteId = clienteId;
    if (status)    filtro.status    = status;
    if (dias) {
      const limite = new Date();
      limite.setDate(limite.getDate() - parseInt(dias));
      filtro.dataBackup = { $gte: limite };
    }

    const backups = await Backup.find(filtro)
      .populate("clienteId", "nome documento")
      .populate("usuarioId", "nome")
      .sort({ dataBackup: -1 })
      .limit(500);

    res.json(backups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/backup/:id", verificarToken, async (req, res) => {
  try {
    const { status, tamanho, destino, observacao } = req.body;
    const dados = {};
    if (status     !== undefined) dados.status     = status;
    if (tamanho    !== undefined) dados.tamanho    = tamanho;
    if (destino    !== undefined) dados.destino    = destino;
    if (observacao !== undefined) dados.observacao = observacao;
    const atualizado = await Backup.findByIdAndUpdate(req.params.id, dados, { new: true });
    if (!atualizado) return res.status(404).json({ message: "Registro não encontrado" });
    res.json(atualizado);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete("/api/backup/:id", verificarToken, async (req, res) => {
  try {
    await Backup.findByIdAndDelete(req.params.id);
    res.json({ message: "Removido" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// --------------------
// INICIAR SERVIDOR
// Compatível com Vercel (serverless) e execução local
// --------------------
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));
}
