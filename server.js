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
   CONEXÃO MONGODB + START
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
    console.error("❌ Erro ao iniciar servidor:", err);
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

const Usuario = mongoose.model("Usuario", UsuarioSchema);

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
  } else {
    console.log("👑 Admin já existe");
  }
}

/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      return res.status(400).json({ message: "Preencha usuário e senha" });
    }

    const user = await Usuario.findOne({ usuario });

    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);

    if (!senhaValida) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

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

  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

/* =========================
   FRONTEND FALLBACK
========================= */

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

startServer();