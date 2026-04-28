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
  perfil:      { type: String, enum: ["master", "admin", "user"], default: "user" },
  acessoBackup: { type: Boolean, default: false },  // master sempre tem acesso, outros só se true
  acessoBoleto: { type: Boolean, default: false }   // pode ver/editar dados de boleto do cliente
});

const ClienteSchema = new mongoose.Schema({
  nome:              { type: String, required: true },
  documento:         String,
  email:             String,
  telefone:          String,
  regime:            String,
  sped:              { type: String, enum: ["Sim", "Nao"], default: "Nao" },
  acessosRemotos:    [{ nome: String, anydesk: String }],
  status:            { type: String, default: "Pendente" },
  usuarioId:         { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  criadoEm:          { type: Date, default: Date.now },
  // Controle de backup
  backupHabilitado:  { type: Boolean, default: false },
  backupClienteNome:  { type: String },  // nome/identificador usado no Backup Agent Pro
  // Controle financeiro / boleto
  boletoVencimento:   { type: Date },                                         // data de vencimento do boleto
  boletoPago:         { type: Boolean, default: true },                       // false = boleto vencido não pago → bloqueia backup
  backupBloqueado:    { type: Boolean, default: false }                       // bloqueio manual pelo sistema
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

// ── Schema de Boletos (parcelas mensais por cliente) ─────────────────────────
const BoletoSchema = new mongoose.Schema({
  clienteId:    { type: mongoose.Schema.Types.ObjectId, ref: "Cliente", required: true },
  usuarioId:    { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  mes:          { type: Number, required: true },   // 1-12
  ano:          { type: Number, required: true },
  parcela:      { type: Number, required: true },   // 1 de 12, 2 de 12 ...
  totalParcelas:{ type: Number, default: 12 },
  vencimento:   { type: Date, required: true },
  valor:        { type: Number, default: 0 },
  pago:         { type: Boolean, default: false },
  dataPagamento:{ type: Date },
  observacao:   { type: String },
  criadoEm:     { type: Date, default: Date.now }
});

// ── Migração: garante que clientes antigos tenham backupHabilitado definido ──
async function migrarCamposBackup() {
  try {
    const resultado = await Cliente.updateMany(
      { backupHabilitado: { $exists: false } },
      { $set: { backupHabilitado: false, boletoPago: true, backupBloqueado: false } }
    );
    if (resultado.modifiedCount > 0)
      console.log(`[MIGRAÇÃO] ${resultado.modifiedCount} cliente(s) atualizados com campos de backup.`);
  } catch (e) {
    console.error("[MIGRAÇÃO] Erro:", e.message);
  }
}

// Registra models apenas uma vez (evita erro no Vercel com hot-reload)
const Usuario      = mongoose.models.Usuario      || mongoose.model("Usuario",      UsuarioSchema);
const Cliente      = mongoose.models.Cliente      || mongoose.model("Cliente",      ClienteSchema);
const Sped         = mongoose.models.Sped         || mongoose.model("Sped",         SpedSchema);
const Config       = mongoose.models.Config       || mongoose.model("Config",       ConfigSchema);
const AlertaConfig = mongoose.models.AlertaConfig || mongoose.model("AlertaConfig", AlertaConfigSchema);
const Backup       = mongoose.models.Backup       || mongoose.model("Backup",       BackupSchema);
const Boleto       = mongoose.models.Boleto       || mongoose.model("Boleto",       BoletoSchema);

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

// Acesso a dados de boleto: master sempre tem, outros precisam de acessoBoleto=true
async function verificarAcessoBoleto(req, res, next) {
  if (req.usuario.perfil === "master") return next();
  const user = await Usuario.findById(req.usuario.id).select("acessoBoleto");
  if (user && user.acessoBoleto) return next();
  return res.status(403).json({ message: "Sem permissão para acessar dados de boleto" });
}

// Acesso à tela de backup: master sempre tem, outros precisam de acessoBackup=true
async function verificarAcessoBackup(req, res, next) {
  if (req.usuario.perfil === "master") return next();
  const user = await Usuario.findById(req.usuario.id).select("acessoBackup");
  if (user && user.acessoBackup) return next();
  return res.status(403).json({ message: "Sem permissão para acessar backups" });
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
    res.json({ token, usuario: { nome: user.nome, usuario: user.usuario, perfil: user.perfil,
      acessoBackup: user.acessoBackup, acessoBoleto: user.acessoBoleto } });
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

// Busca ObjectID por nome — DEVE vir antes de /:id para não ser capturado como id
app.get("/api/clientes/buscar-id", verificarToken, async (req, res) => {
  try {
    const { nome } = req.query;
    const filtro = { ...filtroPerfil(req) };
    if (nome) filtro.nome = { $regex: nome, $options: "i" };
    const clientes = await Cliente.find(filtro).select("_id nome backupClienteNome").limit(10);
    res.json(clientes);
  } catch (e) { res.status(500).json({ message: e.message }); }
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
app.post("/api/backup", verificarToken, verificarAcessoBackup, async (req, res) => {
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

app.get("/api/backup/resumo", verificarToken, verificarAcessoBackup, async (req, res) => {
  try {
    const clientesVisiveis = await Cliente.find({ ...filtroPerfil(req), backupHabilitado: true }).select("_id nome backupBloqueado boletoPago boletoVencimento");
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

    // Clientes com backup bloqueado (boleto vencido ou manual)
    const hoje2 = new Date(); hoje2.setHours(0,0,0,0);
    const suspensos = clientesVisiveis.filter(c =>
      c.backupBloqueado ||
      (c.boletoVencimento && !c.boletoPago && new Date(c.boletoVencimento) <= hoje2)
    );

    res.json({ totalClientes, comBackup, semBackup, semBackupLista, ultimosBackups,
      totalSuspensos: suspensos.length, suspensosLista: suspensos.map(c => ({ _id: c._id, nome: c.nome })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/backup", verificarToken, verificarAcessoBackup, async (req, res) => {
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

app.put("/api/backup/:id", verificarToken, verificarAcessoBackup, async (req, res) => {
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

app.delete("/api/backup/:id", verificarToken, verificarAcessoBackup, async (req, res) => {
  try {
    await Backup.findByIdAndDelete(req.params.id);
    res.json({ message: "Removido" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// --------------------
// PERMISSÃO DE BACKUP — gerenciar acesso por usuário (apenas master)
// --------------------
app.get("/api/backup/permissoes", verificarToken, async (req, res) => {
  if (req.usuario.perfil !== "master")
    return res.status(403).json({ message: "Apenas o mestre pode gerenciar permissões" });
  try {
    const usuarios = await Usuario.find({ perfil: { $ne: "master" } }).select("nome usuario perfil acessoBackup");
    res.json(usuarios);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.patch("/api/usuarios/:id/acesso-backup", verificarToken, async (req, res) => {
  if (req.usuario.perfil !== "master")
    return res.status(403).json({ message: "Apenas o mestre pode alterar permissões" });
  try {
    const { acessoBackup } = req.body;
    const u = await Usuario.findByIdAndUpdate(req.params.id, { acessoBackup }, { new: true }).select("-senha");
    if (!u) return res.status(404).json({ message: "Usuário não encontrado" });
    res.json(u);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// --------------------
// CLIENTES — habilitar/desabilitar backup por cliente (master ou admin)
// --------------------
app.patch("/api/clientes/:id/backup", verificarToken, verificarAcessoBackup, async (req, res) => {
  try {
    const { backupHabilitado, backupClienteNome } = req.body;
    const filtro = { _id: req.params.id, ...filtroPerfil(req) };
    const dados  = {};
    if (backupHabilitado  !== undefined) dados.backupHabilitado  = backupHabilitado;
    if (backupClienteNome !== undefined) dados.backupClienteNome = backupClienteNome;
    const atualizado = await Cliente.findOneAndUpdate(filtro, dados, { new: true });
    if (!atualizado) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(atualizado);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Rota para checar se o usuário logado tem acesso à tela de backup
app.get("/api/backup/meu-acesso", verificarToken, async (req, res) => {
  try {
    if (req.usuario.perfil === "master") return res.json({ acesso: true });
    const user = await Usuario.findById(req.usuario.id).select("acessoBackup");
    res.json({ acesso: !!(user && user.acessoBackup) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// --------------------
// BOLETO — atualizar vencimento e status de pagamento
// --------------------
app.patch("/api/clientes/:id/boleto", verificarToken, verificarAcessoBoleto, async (req, res) => {
  try {
    const { boletoVencimento, boletoPago } = req.body;
    const filtro = { _id: req.params.id, ...filtroPerfil(req) };
    const dados  = {};
    if (boletoVencimento !== undefined) dados.boletoVencimento = boletoVencimento ? new Date(boletoVencimento) : null;
    if (boletoPago       !== undefined) {
      dados.boletoPago    = boletoPago;
      // Quando marcado como pago, desbloqueia backup automaticamente
      if (boletoPago) dados.backupBloqueado = false;
    }
    const atualizado = await Cliente.findOneAndUpdate(filtro, dados, { new: true });
    if (!atualizado) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(atualizado);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Bloquear/desbloquear backup manualmente
app.patch("/api/clientes/:id/bloqueio-backup", verificarToken, verificarAcessoBackup, async (req, res) => {
  try {
    const { backupBloqueado } = req.body;
    const filtro  = { _id: req.params.id, ...filtroPerfil(req) };
    const atualizado = await Cliente.findOneAndUpdate(filtro, { backupBloqueado }, { new: true });
    if (!atualizado) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(atualizado);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Retorna dados de boleto do cliente para o Backup Agent verificar antes de rodar
// Rota pública (autenticada) para o Agent checar status antes de fazer backup
app.get("/api/clientes/:id/status-backup", verificarToken, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, ...filtroPerfil(req) })
      .select("nome boletoVencimento boletoPago backupBloqueado backupHabilitado");
    if (!cliente) return res.status(404).json({ message: "Cliente não encontrado" });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let bloqueado = false;
    let motivo    = null;

    if (cliente.backupBloqueado) {
      bloqueado = true;
      motivo    = "Backup bloqueado manualmente";
    } else if (cliente.boletoVencimento && !cliente.boletoPago) {
      const venc = new Date(cliente.boletoVencimento);
      venc.setHours(0, 0, 0, 0);
      if (venc <= hoje) {
        bloqueado = true;
        motivo    = `Boleto vencido em ${venc.toLocaleDateString("pt-BR")} — marque como pago para liberar o backup`;
      }
    }

    res.json({
      clienteId:        cliente._id,
      nome:             cliente.nome,
      backupHabilitado: cliente.backupHabilitado,
      bloqueado,
      motivo,
      boletoVencimento: cliente.boletoVencimento,
      boletoPago:       cliente.boletoPago,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Clientes com boleto vencido — para o resumo do dashboard de backup
app.get("/api/backup/boletos-vencidos", verificarToken, verificarAcessoBoleto, async (req, res) => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const filtro = {
      ...filtroPerfil(req),
      backupHabilitado: true,
      boletoPago:       false,
      boletoVencimento: { $lte: hoje },
    };
    const clientes = await Cliente.find(filtro).select("nome boletoVencimento boletoPago backupBloqueado");
    res.json(clientes);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Permissão de boleto por usuário (só master)
app.patch("/api/usuarios/:id/acesso-boleto", verificarToken, async (req, res) => {
  if (req.usuario.perfil !== "master")
    return res.status(403).json({ message: "Apenas o mestre pode alterar permissões" });
  try {
    const { acessoBoleto } = req.body;
    const u = await Usuario.findByIdAndUpdate(req.params.id, { acessoBoleto }, { new: true }).select("-senha");
    if (!u) return res.status(404).json({ message: "Usuário não encontrado" });
    res.json(u);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// --------------------
// LIMPEZA DE HISTÓRICO DE BACKUP
// --------------------
// Limpar automaticamente registros com mais de 5 dias
async function limparHistoricoAntigo() {
  try {
    const limite = new Date();
    limite.setDate(limite.getDate() - 5);
    const res = await Backup.deleteMany({ dataBackup: { $lt: limite } });
    if (res.deletedCount > 0) console.log(`[CLEANUP] ${res.deletedCount} registro(s) de backup removidos.`);
  } catch (e) { console.error("[CLEANUP] Erro:", e.message); }
}

// Roda a cada 24h (verifica se passaram 5 dias desde o último)
setInterval(limparHistoricoAntigo, 24 * 60 * 60 * 1000);
// Roda uma vez na inicialização também
limparHistoricoAntigo();

// Limpar manualmente (só master/admin com acesso backup)
app.delete("/api/backup/historico", verificarToken, verificarAcessoBackup, async (req, res) => {
  try {
    const dias   = parseInt(req.query.dias || "0");
    const filtro = {};
    if (req.usuario.perfil !== "master") {
      // admin só limpa seus próprios clientes
      const meus = await Cliente.find(filtroPerfil(req)).select("_id");
      filtro.clienteId = { $in: meus.map(c => c._id) };
    }
    if (dias > 0) {
      const limite = new Date();
      limite.setDate(limite.getDate() - dias);
      filtro.dataBackup = { $lt: limite };
    }
    const result = await Backup.deleteMany(filtro);
    res.json({ ok: true, removidos: result.deletedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// --------------------
// LIMPEZA AUTOMÁTICA DE HISTÓRICO (a cada 5 dias)
// --------------------
async function limparHistoricoAntigo() {
  try {
    const limite = new Date();
    limite.setDate(limite.getDate() - 5);
    const res = await Backup.deleteMany({ criadoEm: { $lt: limite } });
    if (res.deletedCount > 0)
      console.log(`[AUTO-LIMPEZA] ${res.deletedCount} registro(s) de backup removidos.`);
  } catch (e) {
    console.error("[AUTO-LIMPEZA] Erro:", e.message);
  }
}
// Executa na inicialização e a cada 24 horas
limparHistoricoAntigo();
setInterval(limparHistoricoAntigo, 24 * 60 * 60 * 1000);

// Limpeza manual (botão na tela)
app.delete("/api/backup/historico", verificarToken, verificarAcessoBackup, async (req, res) => {
  try {
    const { dias } = req.query; // ?dias=5 ou limpa tudo se não passar
    const filtro = {};
    if (dias) {
      const limite = new Date();
      limite.setDate(limite.getDate() - parseInt(dias));
      filtro.criadoEm = { $lt: limite };
    }
    // Filtra pelo perfil do usuário
    if (req.usuario.perfil !== "master") {
      const clientesIds = (await Cliente.find({ usuarioId: req.usuario.id }).select("_id")).map(c => c._id);
      filtro.clienteId = { $in: clientesIds };
    }
    const result = await Backup.deleteMany(filtro);
    res.json({ ok: true, removidos: result.deletedCount });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// --------------------
// BOLETOS — parcelas mensais
// --------------------

// Gerar 12 parcelas a partir de uma data inicial
app.post("/api/boletos/gerar", verificarToken, verificarAcessoBoleto, async (req, res) => {
  try {
    const { clienteId, primeiroVencimento, valor, totalParcelas } = req.body;
    if (!clienteId || !primeiroVencimento) return res.status(400).json({ message: "clienteId e primeiroVencimento são obrigatórios" });

    // Remove boletos existentes deste cliente antes de gerar novos
    await Boleto.deleteMany({ clienteId, usuarioId: req.usuario.perfil === "master" ? { $exists: true } : req.usuario.id });

    const total = parseInt(totalParcelas) || 12;
    const base  = new Date(primeiroVencimento);
    const parcelas = [];

    for (let i = 0; i < total; i++) {
      const venc = new Date(base);
      venc.setMonth(venc.getMonth() + i);
      parcelas.push({
        clienteId,
        usuarioId:     req.usuario.id,
        mes:           venc.getMonth() + 1,
        ano:           venc.getFullYear(),
        parcela:       i + 1,
        totalParcelas: total,
        vencimento:    venc,
        valor:         parseFloat(valor) || 0,
        pago:          false,
      });
    }

    await Boleto.insertMany(parcelas);
    res.json({ ok: true, geradas: total });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Listar boletos de um cliente
app.get("/api/boletos/:clienteId", verificarToken, verificarAcessoBoleto, async (req, res) => {
  try {
    const boletos = await Boleto.find({ clienteId: req.params.clienteId }).sort({ vencimento: 1 });
    res.json(boletos);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Dar baixa em uma parcela (marcar como pago)
app.patch("/api/boletos/:id/baixa", verificarToken, verificarAcessoBoleto, async (req, res) => {
  try {
    const { pago, dataPagamento, observacao } = req.body;
    const b = await Boleto.findByIdAndUpdate(req.params.id, {
      pago:          pago !== false,
      dataPagamento: pago !== false ? (dataPagamento ? new Date(dataPagamento) : new Date()) : null,
      observacao:    observacao || "",
    }, { new: true });
    if (!b) return res.status(404).json({ message: "Boleto não encontrado" });

    // Se todas as parcelas do cliente estiverem pagas, libera o backup
    const pendentes = await Boleto.countDocuments({ clienteId: b.clienteId, pago: false, vencimento: { $lte: new Date() } });
    if (pendentes === 0) {
      await Cliente.findByIdAndUpdate(b.clienteId, { boletoPago: true, backupBloqueado: false });
    }

    res.json(b);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// Deletar boleto individual
app.delete("/api/boletos/:id", verificarToken, verificarAcessoBoleto, async (req, res) => {
  try {
    await Boleto.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// [buscar-id moved above /:id]

// --------------------
// INICIAR SERVIDOR
// Compatível com Vercel (serverless) e execução local
// --------------------
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));
}
