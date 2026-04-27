/* Backend API Server using Express + Vite middleware */
import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { initDB, getDB } from "./src/db/db.js";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Token setup for Agent authentication
const AGENT_TOKEN = process.env.AGENT_TOKEN || "chave-secreta-vps-123";

const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${AGENT_TOKEN}`) {
    return res.status(401).json({ error: "Acesso negado. Token inválido." });
  }
  next();
};

// Ensure uploads folder exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config: temporary store in /uploads/tmp, then we move
const _tmpUpload = multer({ dest: path.join(uploadDir, 'tmp') });

// -- API ROUTES --

// 1. Receive XML from Local Agent
app.post("/api/upload", authMiddleware, _tmpUpload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const db = getDB();

    // Validate parsed metadata from Agent
    const data = req.body;
    if (!data.chave_nfe || !data.cnpj_destinatario || !data.modelo) {
      return res.status(400).json({ error: "Dados extraídos incompletos." });
    }

    const {
      chave_nfe,
      cnpj_destinatario,
      nome_destinatario,
      data_emissao,
      valor_total,
      modelo,
      cnpj_fornecedor,
      nome_fornecedor
    } = data;

    // Check if duplicate
    const checkDupe = await db.get("SELECT * FROM notas WHERE chave_nfe = ?", [chave_nfe]);
    if (checkDupe) {
      fs.unlinkSync(file.path); // remove tmp
      return res.status(409).json({ error: "XML já processado." });
    }

    // Upsert Empresa (Destinatário)
    let empresa = await db.get("SELECT id FROM empresas WHERE cnpj = ?", [cnpj_destinatario]);
    if (!empresa) {
      const result = await db.run("INSERT INTO empresas (nome, cnpj) VALUES (?, ?)", [nome_destinatario || "Desconhecido", cnpj_destinatario]);
      empresa = { id: result.lastID };
    }

    // Determine final path: /uploads/empresa/CNPJ/ANO/MES/CHAVE.xml
    let ano = "0000";
    let mes = "00";
    if (data_emissao) {
      const dt = new Date(data_emissao);
      if (!isNaN(dt.getTime())) {
        ano = dt.getFullYear().toString();
        mes = (dt.getMonth() + 1).toString().padStart(2, "0");
      }
    }

    const finalPathDir = path.join(uploadDir, "empresas", cnpj_destinatario, ano, mes);
    if (!fs.existsSync(finalPathDir)) {
      fs.mkdirSync(finalPathDir, { recursive: true });
    }

    const finalFilePath = path.join(finalPathDir, `${chave_nfe}.xml`);
    fs.renameSync(file.path, finalFilePath);

    // Save into DB
    await db.run(`
      INSERT INTO notas (
        empresa_id, chave_nfe, fornecedor, cnpj_fornecedor, 
        data_emissao, valor_total, modelo, caminho_arquivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      empresa.id,
      chave_nfe,
      nome_fornecedor || "Desconhecido",
      cnpj_fornecedor || "000",
      data_emissao || null,
      parseFloat(valor_total) || 0.0,
      modelo,
      `/uploads/empresas/${cnpj_destinatario}/${ano}/${mes}/${chave_nfe}.xml` // Relative URL path
    ]);

    res.status(201).json({ success: true, message: "Nota processada com sucesso." });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Erro interno ao salvar nota." });
  }
});

// 2. Fetch Dashboard Summary
app.get("/api/dashboard", async (req, res) => {
  try {
    const db = getDB();
    const totalNotas = await db.get("SELECT COUNT(*) as count FROM notas");
    const totalValor = await db.get("SELECT SUM(valor_total) as sum FROM notas");
    const totalEmpresas = await db.get("SELECT COUNT(*) as count FROM empresas");
    
    // Group by month
    const porCompetencia = await db.all(`
      SELECT strftime('%Y-%m', data_emissao) as mes, COUNT(*) as qtd, SUM(valor_total) as valor
      FROM notas
      WHERE data_emissao IS NOT NULL
      GROUP BY strftime('%Y-%m', data_emissao)
      ORDER BY mes DESC
      LIMIT 6
    `);

    res.json({
      total_notas: totalNotas?.count || 0,
      total_valor: totalValor?.sum || 0,
      total_empresas: totalEmpresas?.count || 0,
      competencias: porCompetencia || []
    });
  } catch(error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar dashboard." });
  }
});

// 3. Fetch Empresas
app.get("/api/empresas", async (req, res) => {
  try {
    const db = getDB();
    const empresas = await db.all("SELECT * FROM empresas ORDER BY nome");
    res.json(empresas);
  } catch(error) {
    res.status(500).json({ error: "Erro ao buscar empresas." });
  }
});

// 4. Fetch Notas (with filters)
app.get("/api/notas", async (req, res) => {
  try {
    const db = getDB();
    const { empresa_id, data_inicio, data_fim, fornecedor } = req.query;
    
    let query = `
      SELECT n.*, e.nome as nome_empresa, e.cnpj as cnpj_empresa
      FROM notas n
      JOIN empresas e ON n.empresa_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (empresa_id) {
      query += " AND n.empresa_id = ?";
      params.push(empresa_id);
    }
    if (data_inicio) {
      // Basic approach: comparison operator since format is ISO YYYY-MM-DD
      query += " AND n.data_emissao >= ?";
      params.push(data_inicio);
    }
    if (data_fim) {
      // Append time max to ensure 'YYYY-MM-DD' captures the full day
      query += " AND n.data_emissao <= ?";
      params.push(data_fim + 'T23:59:59'); 
    }
    if (fornecedor && typeof fornecedor === 'string') {
      query += " AND n.fornecedor LIKE ?";
      params.push('%' + fornecedor + '%');
    }

    query += " ORDER BY n.data_emissao DESC LIMIT 100";

    const notas = await db.all(query, params);
    res.json(notas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar notas." });
  }
});

// Serve the uploads directory so users can download their XMLs
app.use('/uploads', express.static(uploadDir));

// -- VITE MULTIPAGE / SPA MIDDLEWARE --
async function startServer() {
  await initDB();

  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer();
