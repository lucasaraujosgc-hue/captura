/* Backend API Server using Express + Vite middleware */
import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import archiver from "archiver";
import { initDB, getDB } from "./src/db/db.js";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acesso negado. Token não informado." });
  }
  const token = authHeader.split(" ")[1];
  
  const db = getDB();
  const empresa = await db.get("SELECT * FROM empresas WHERE token = ?", [token]);
  
  if (!empresa) {
    return res.status(401).json({ error: "Acesso negado. Token inválido." });
  }

  // We assign the empresa to the request so upload knows which company it belongs to
  (req as any).empresa_id = empresa.id;
  (req as any).cnpj_empresa = empresa.cnpj;
  next();
};

// Web Auth Middleware (Frontend Dashboard)
const webAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const envPassword = process.env.PASSWORD || "admin";
  const expectedToken = crypto.createHmac('sha256', "app_secret_salt").update(envPassword).digest('hex');
  
  // Exclude upload route and login route from this auth check
  // Note: Since this is mounted on '/api', req.path is relative (e.g. '/login')
  if (req.path === '/upload' || req.path === '/login') {
    return next();
  }

  // Allow downloading directly from query string (for the window.open calls)
  if (req.query.token === expectedToken) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: "Acesso negado ao painel. Faça login." });
  }

  next();
};

app.use('/api', webAuthMiddleware);

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const envPassword = process.env.PASSWORD || "admin";

  if (password === envPassword) {
    const token = crypto.createHmac('sha256', "app_secret_salt").update(envPassword).digest('hex');
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: "Senha incorreta." });
  }
});

// Ensure uploads folder exists
const isBackupMounted = fs.existsSync('/backup');
const uploadDir = isBackupMounted ? '/backup/uploads' : path.join(process.cwd(), "uploads");
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
    if (!data.chave_nfe || !data.modelo) {
      return res.status(400).json({ error: "Dados extraídos incompletos." });
    }

    const {
      chave_nfe,
      data_emissao,
      valor_total,
      modelo,
      cnpj_fornecedor,
      nome_fornecedor,
      tipo,
      status,
      hostname
    } = data;

    // The enterprise comes from the token
    const empresa_id = (req as any).empresa_id;
    const cnpj_destinatario = (req as any).cnpj_empresa;

    // Check if duplicate
    const checkDupe = await db.get("SELECT * FROM notas WHERE chave_nfe = ?", [chave_nfe]);
    if (checkDupe) {
      fs.unlinkSync(file.path); // remove tmp
      return res.status(409).json({ error: "XML já processado." });
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
        data_emissao, valor_total, modelo, caminho_arquivo, tipo, status, hostname, tamanho_arquivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      empresa_id,
      chave_nfe,
      nome_fornecedor || "Desconhecido",
      cnpj_fornecedor || "000",
      data_emissao || null,
      parseFloat(valor_total) || 0.0,
      modelo,
      `/uploads/empresas/${cnpj_destinatario}/${ano}/${mes}/${chave_nfe}.xml`, // Relative URL path
      tipo || null,
      status || null,
      hostname || "Desconhecido",
      file.size || 0
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
    const totalEmpresas = await db.get("SELECT COUNT(*) as count FROM empresas");
    
    // Top empresas faturamento
    const topFaturamento = await db.all(`
      SELECT e.nome, e.cnpj, SUM(n.valor_total) as totalFaturamento
      FROM empresas e
      JOIN notas n ON e.id = n.empresa_id
      GROUP BY e.id
      ORDER BY totalFaturamento DESC
      LIMIT 6
    `);

    // Top empresas volume de arquivos
    const topVolume = await db.all(`
      SELECT e.nome, e.cnpj, COUNT(n.id) as totalArquivos
      FROM empresas e
      JOIN notas n ON e.id = n.empresa_id
      GROUP BY e.id
      ORDER BY totalArquivos DESC
      LIMIT 6
    `);

    res.json({
      total_notas: totalNotas?.count || 0,
      total_empresas: totalEmpresas?.count || 0,
      topFaturamento: topFaturamento || [],
      topVolume: topVolume || []
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

// Storage Info
function getDirectorySize(dirPath: string): number {
  let totalSize = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      totalSize += getDirectorySize(fullPath);
    } else {
      totalSize += stats.size;
    }
  }
  return totalSize;
}

app.get("/api/storage", async (req, res) => {
  try {
    const dir = path.join(uploadDir, "empresas");
    const bytes = getDirectorySize(dir);
    res.json({ bytes });
  } catch(error) {
    res.status(500).json({ error: "Erro ao calcular armazenamento." });
  }
});

// Delete Notas in batch
app.delete("/api/notas", async (req, res) => {
  try {
    const db = getDB();
    const { empresa_id, data_inicio, data_fim, tamanho_min, tamanho_max } = req.query;

    let query = "SELECT id, caminho_arquivo FROM notas WHERE 1=1";
    const params: any[] = [];

    if (empresa_id) {
      query += " AND empresa_id = ?";
      params.push(empresa_id);
    }
    if (data_inicio) {
      query += " AND data_emissao >= ?";
      params.push(data_inicio);
    }
    if (data_fim) {
      query += " AND data_emissao <= ?";
      params.push(data_fim + 'T23:59:59');
    }
    if (tamanho_min) {
      query += " AND tamanho_arquivo >= ?";
      params.push(tamanho_min);
    }
    if (tamanho_max) {
      query += " AND tamanho_arquivo <= ?";
      params.push(tamanho_max);
    }

    const notasToDelete = await db.all(query, params);
    let deletedCount = 0;

    for (const nota of notasToDelete) {
      let relativePath = nota.caminho_arquivo;
      if (relativePath.startsWith("/uploads/")) {
        relativePath = relativePath.substring(9);
      }
      const fullPath = path.join(uploadDir, relativePath);
      
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        await db.run("DELETE FROM notas WHERE id = ?", [nota.id]);
        deletedCount++;
      } catch (err) {
        console.error("Error deleting nota ID:", nota.id, err);
      }
    }

    res.json({ success: true, deleted: deletedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir notas." });
  }
});

app.post("/api/empresas", async (req, res) => {
  try {
    const db = getDB();
    const { nome, cnpj } = req.body;
    if (!nome || !cnpj) return res.status(400).json({ error: "Nome e CNPJ são obrigatórios." });

    const check = await db.get("SELECT id FROM empresas WHERE cnpj = ?", [cnpj]);
    if (check) return res.status(400).json({ error: "Empresa com este CNPJ já existe." });

    const token = crypto.randomBytes(32).toString("hex");
    const result = await db.run("INSERT INTO empresas (nome, cnpj, token) VALUES (?, ?, ?)", [nome, cnpj, token]);
    
    res.status(201).json({ success: true, id: result.lastID, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao cadastrar empresa." });
  }
});

// 4. Fetch Notas (with filters)
app.get("/api/notas", async (req, res) => {
  try {
    const db = getDB();
    const { empresa_id, data_inicio, data_fim, fornecedor, tipo, modelo, status, tamanho_min, tamanho_max, page = '1', limit = '20' } = req.query;
    
    let baseQuery = `
      FROM notas n
      JOIN empresas e ON n.empresa_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (empresa_id) {
      baseQuery += " AND n.empresa_id = ?";
      params.push(empresa_id);
    }
    if (data_inicio) {
      baseQuery += " AND n.data_emissao >= ?";
      params.push(data_inicio);
    }
    if (data_fim) {
      baseQuery += " AND n.data_emissao <= ?";
      params.push(data_fim + 'T23:59:59'); 
    }
    if (fornecedor && typeof fornecedor === 'string') {
      baseQuery += " AND n.fornecedor LIKE ?";
      params.push('%' + fornecedor + '%');
    }
    if (tipo && typeof tipo === 'string') {
      baseQuery += " AND n.tipo = ?";
      params.push(tipo);
    }
    if (modelo && typeof modelo === 'string') {
      baseQuery += " AND n.modelo = ?";
      params.push(modelo);
    }
    if (status && typeof status === 'string') {
      baseQuery += " AND n.status = ?";
      params.push(status);
    }
    if (tamanho_min) {
      baseQuery += " AND n.tamanho_arquivo >= ?";
      params.push(tamanho_min);
    }
    if (tamanho_max) {
      baseQuery += " AND n.tamanho_arquivo <= ?";
      params.push(tamanho_max);
    }

    // Count total match
    const countRow = await db.get(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const total = countRow ? countRow.total : 0;

    const sumRow = await db.get(`SELECT SUM(tamanho_arquivo) as totalSize ${baseQuery}`, params);
    const totalSize = sumRow && sumRow.totalSize ? sumRow.totalSize : 0;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    baseQuery += " ORDER BY n.data_emissao DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offset);

    const notas = await db.all(`SELECT n.*, e.nome as nome_empresa, e.cnpj as cnpj_empresa ${baseQuery}`, params);
    
    res.json({
      notas,
      total,
      totalSize,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar notas." });
  }
});

// 5. Download in Lote by Filter
app.get("/api/download-filter", async (req, res) => {
  try {
    const db = getDB();
    const { empresa_id, data_inicio, data_fim, fornecedor, tipo, modelo, status } = req.query;
    
    let query = `SELECT caminho_arquivo, chave_nfe FROM notas n WHERE 1=1`;
    const params: any[] = [];

    if (empresa_id) {
      query += " AND n.empresa_id = ?";
      params.push(empresa_id);
    }
    if (data_inicio) {
      query += " AND n.data_emissao >= ?";
      params.push(data_inicio);
    }
    if (data_fim) {
      query += " AND n.data_emissao <= ?";
      params.push(data_fim + 'T23:59:59'); 
    }
    if (fornecedor && typeof fornecedor === 'string') {
      query += " AND n.fornecedor LIKE ?";
      params.push('%' + fornecedor + '%');
    }
    if (tipo && typeof tipo === 'string') {
      query += " AND n.tipo = ?";
      params.push(tipo);
    }
    if (modelo && typeof modelo === 'string') {
      query += " AND n.modelo = ?";
      params.push(modelo);
    }
    if (status && typeof status === 'string') {
      query += " AND n.status = ?";
      params.push(status);
    }

    const notas = await db.all(query, params);

    if (notas.length === 0) return res.status(404).json({ error: "Nenhuma nota encontrada para os filtros." });

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-disposition': `attachment; filename=notas_${Date.now()}.zip`
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const nota of notas) {
      const filePathRelative = nota.caminho_arquivo.startsWith("/uploads/") ? nota.caminho_arquivo.substring(9) : nota.caminho_arquivo;
      const fullPath = path.join(uploadDir, filePathRelative);
      if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: `${nota.chave_nfe}.xml` });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar arquivo zip." });
  }
});

// 6. Download in Lote (by IDs - keeping for backward compatibility if needed)
app.get("/api/download-batch", async (req, res) => {
  try {
    const db = getDB();
    const { ids } = req.query;
    if (!ids || typeof ids !== 'string') return res.status(400).json({ error: "IDs não fornecidos." });

    const idsArray = ids.split(",").map(id => parseInt(id)).filter(id => !isNaN(id));
    if (idsArray.length === 0) return res.status(400).json({ error: "Nenhum ID válido fornecido." });

    const placeholders = idsArray.map(() => '?').join(',');
    const notas = await db.all(`SELECT caminho_arquivo, chave_nfe FROM notas WHERE id IN (${placeholders})`, idsArray);

    if (notas.length === 0) return res.status(404).json({ error: "Nenhuma nota encontrada." });

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-disposition': `attachment; filename=notas_${Date.now()}.zip`
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const nota of notas) {
      const filePathRelative = nota.caminho_arquivo.startsWith("/uploads/") ? nota.caminho_arquivo.substring(9) : nota.caminho_arquivo;
      const fullPath = path.join(uploadDir, filePathRelative);
      if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: `${nota.chave_nfe}.xml` });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar arquivo zip." });
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
