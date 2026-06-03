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
import { XMLParser } from "fast-xml-parser";

// Helper to remove punctuation from CNPJ
const cleanCnpj = (str: any) => str ? String(str).replace(/[^\d]+/g, '') : "";

app.post("/api/upload", authMiddleware, _tmpUpload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const db = getDB();

    const empresa_id = (req as any).empresa_id;
    const cnpj_empresa = cleanCnpj((req as any).cnpj_empresa);

    const xmlData = fs.readFileSync(file.path, 'utf8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: false,
    });
    const jsonObj = parser.parse(xmlData);

    const nfe = jsonObj?.nfeProc?.NFe?.infNFe || jsonObj?.NFe?.infNFe || jsonObj?.nfeProc?.infNFe;
    if (!nfe) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "XML inválido: não encontrou dados da NFe." });
    }

    const prot = jsonObj?.nfeProc?.protNFe?.infProt;

    // cStat / Status
    let status = "Desconhecido";
    if (prot && prot.cStat != null) {
      const cStat = String(prot.cStat);
      if (cStat === "100") status = "Autorizada";
      else if (cStat === "101" || cStat === "135") status = "Cancelada";
      else status = `cStat: ${cStat}`;
    }

    // Modelo
    let modelo = "Desconhecido";
    if (nfe?.ide?.mod != null) {
      if (String(nfe.ide.mod) === "55") modelo = "NF-e";
      else if (String(nfe.ide.mod) === "65") modelo = "NFC-e";
      else modelo = String(nfe.ide.mod);
    }

    // Identificando Entrada ou Saída e Fornecedor/Cliente
    let tipo = "";
    let nome_fornecedor = "";
    let cnpj_fornecedor = "";

    const emitCnpj = cleanCnpj(nfe?.emit?.CNPJ || nfe?.emit?.CPF || "");
    const emitNome = nfe?.emit?.xNome || "Desconhecido";
    
    const destCnpj = cleanCnpj(nfe?.dest?.CNPJ || nfe?.dest?.CPF || "");
    const destNome = nfe?.dest?.xNome || "Cliente Diverso";

    if (destCnpj === cnpj_empresa) {
      tipo = "Entrada";
      nome_fornecedor = emitNome;
      cnpj_fornecedor = emitCnpj;
    } else if (emitCnpj === cnpj_empresa) {
      tipo = "Saída";
      if (modelo === "NF-e") {
        nome_fornecedor = destNome;
        cnpj_fornecedor = destCnpj;
      } else if (modelo === "NFC-e") {
        nome_fornecedor = nfe?.dest ? destNome : "Cliente Diverso";
        cnpj_fornecedor = destCnpj;
      } else {
        nome_fornecedor = destNome;
        cnpj_fornecedor = destCnpj;
      }
    } else {
      // Se não reconhecer nenhum dos dois, apenas preenche algo
      tipo = "Desconhecido";
      nome_fornecedor = emitNome;
      cnpj_fornecedor = emitCnpj;
    }

    let chave_nfe = nfe["@_Id"] ? nfe["@_Id"].replace("NFe", "") : "";
    if (!chave_nfe && req.body.chave_nfe) {
      chave_nfe = req.body.chave_nfe; // fallback
    }

    if (!chave_nfe) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "XML inválido: sem chave (Id) da NFe." });
    }

    let data_emissao = nfe?.ide?.dhEmi || nfe?.ide?.dEmi;
    let valor_total = nfe?.total?.ICMSTot?.vNF || 0;

    // Use req.body if not found
    if (!data_emissao && req.body.data_emissao) data_emissao = req.body.data_emissao;
    if (!valor_total && req.body.valor_total) valor_total = req.body.valor_total;
    const hostname = req.body.hostname || req.body.computador || "Desconhecido";

    let cfop = "";
    if (nfe?.det) {
      if (Array.isArray(nfe.det) && nfe.det.length > 0 && nfe.det[0].prod) {
        cfop = String(nfe.det[0].prod.CFOP || "");
      } else if (nfe.det.prod) {
        cfop = String(nfe.det.prod.CFOP || "");
      }
    }

    // Check if duplicate
    const checkDupe = await db.get("SELECT * FROM notas WHERE chave_nfe = ? AND empresa_id = ?", [chave_nfe, empresa_id]);
    if (checkDupe) {
      fs.unlinkSync(file.path); // remove tmp
      return res.status(409).json({ error: "XML já processado para esta empresa." });
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

    const finalPathDir = path.join(uploadDir, "empresas", cnpj_empresa, ano, mes);
    if (!fs.existsSync(finalPathDir)) {
      fs.mkdirSync(finalPathDir, { recursive: true });
    }

    const finalFilePath = path.join(finalPathDir, `${chave_nfe}.xml`);
    fs.renameSync(file.path, finalFilePath);
    const finalUrlPath = `/uploads/empresas/${cnpj_empresa}/${ano}/${mes}/${chave_nfe}.xml`;

    // Save into DB
    try {
      await db.run(`
        INSERT INTO notas (
          empresa_id, chave_nfe, fornecedor, cnpj_fornecedor, 
          data_emissao, valor_total, modelo, caminho_arquivo, tipo, status, hostname, tamanho_arquivo, cfop
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        empresa_id,
        chave_nfe,
        nome_fornecedor || "Desconhecido",
        cnpj_fornecedor || "000",
        data_emissao || null,
        parseFloat(valor_total) || 0.0,
        modelo,
        finalUrlPath,
        tipo || null,
        status || null,
        hostname,
        file.size || 0,
        cfop
      ]);

      // --- Espelhamento (Mirroring) ---
      if (cnpj_fornecedor) {
        const empresaDestino = await db.get("SELECT id, nome, cnpj FROM empresas WHERE cnpj = ?", [cnpj_fornecedor]);
        if (empresaDestino) {
          const checkDupeDestino = await db.get("SELECT * FROM notas WHERE chave_nfe = ? AND empresa_id = ?", [chave_nfe, empresaDestino.id]);
          if (!checkDupeDestino) {
            let tipoMirrored = "Desconhecido";
            if (tipo === "Entrada") tipoMirrored = "Saída";
            if (tipo === "Saída" || tipo === "Saida") tipoMirrored = "Entrada";

            await db.run(`
              INSERT INTO notas (
                empresa_id, chave_nfe, fornecedor, cnpj_fornecedor, 
                data_emissao, valor_total, modelo, caminho_arquivo, tipo, status, hostname, tamanho_arquivo, cfop
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              empresaDestino.id,
              chave_nfe,
              nome_empresa || "Desconhecido",
              cnpj_empresa || "000",
              data_emissao || null,
              parseFloat(valor_total) || 0.0,
              modelo,
              finalUrlPath, // Aponta para o mesmo arquivo (armazenamento compartilhado)
              tipoMirrored,
              status || null,
              hostname,
              file.size || 0,
              cfop
            ]);
          }
        }
      }

    } catch (dbError: any) {
      if (dbError.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: "XML já processado (concorrente)." });
      }
      throw dbError;
    }

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
    const { ano, mes } = req.query;

    let dateFilterNotas = "";
    let dateFilterNotasWhere = "";
    const params: any[] = [];
    
    if (ano) {
      if (mes) {
        dateFilterNotasWhere = "WHERE data_emissao LIKE ?";
        dateFilterNotas = "AND n.data_emissao LIKE ?";
        params.push(`${ano}-${String(mes).padStart(2, '0')}%`);
      } else {
        dateFilterNotasWhere = "WHERE data_emissao LIKE ?";
        dateFilterNotas = "AND n.data_emissao LIKE ?";
        params.push(`${ano}-%`);
      }
    }

    const totalNotas = await db.get(`SELECT COUNT(*) as count FROM notas ${dateFilterNotasWhere}`, params);
    const totalEmpresas = await db.get("SELECT COUNT(*) as count FROM empresas");
    
    // Top empresas faturamento
    const topFaturamento = await db.all(`
      SELECT e.nome, e.cnpj, SUM(n.valor_total) as totalFaturamento
      FROM empresas e
      JOIN notas n ON e.id = n.empresa_id
      WHERE (n.tipo = 'Saída' OR n.tipo = 'Saida') ${dateFilterNotas}
      GROUP BY e.id
      ORDER BY totalFaturamento DESC
      LIMIT 5
    `, params);

    // Top empresas volume de arquivos
    const topVolume = await db.all(`
      SELECT e.nome, e.cnpj, COUNT(n.id) as totalArquivos
      FROM empresas e
      JOIN notas n ON e.id = n.empresa_id
      WHERE 1=1 ${dateFilterNotas}
      GROUP BY e.id
      ORDER BY totalArquivos DESC
      LIMIT 5
    `, params);

    const empresasLista = await db.all(`
      SELECT nome, cnpj FROM empresas ORDER BY nome ASC
    `);

    res.json({
      total_notas: totalNotas?.count || 0,
      total_empresas: totalEmpresas?.count || 0,
      topFaturamento: topFaturamento || [],
      topVolume: topVolume || [],
      empresasList: empresasLista || []
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
    
    // Auto-generate missing export_tokens
    for (const emp of empresas) {
      if (!emp.export_token) {
        const newExportToken = crypto.randomBytes(32).toString("hex");
        await db.run("UPDATE empresas SET export_token = ? WHERE id = ?", [newExportToken, emp.id]);
        emp.export_token = newExportToken;
      }
    }

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

app.get("/api/danfe/:id", webAuthMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const nota = await db.get("SELECT * FROM notas WHERE id = ?", [req.params.id]);
    if (!nota) return res.status(404).send("Nota não encontrada.");

    let relativePath = nota.caminho_arquivo;
    if (relativePath.startsWith("/uploads/")) {
      relativePath = relativePath.substring(9);
    }
    const fullPath = path.join(uploadDir, relativePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).send("Arquivo XML não encontrado no disco.");
    }
    const xml = fs.readFileSync(fullPath, "utf-8");

    try {
      const dDanfeModule = (await import("d-danfe")).default || await import("d-danfe");
      const html = dDanfeModule.fromXML(xml).toHtml();
      res.send(html);
    } catch (err) {
      console.error("Erro d-danfe:", err);
      // Fallback
      res.type('text/xml').send(xml);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro interno ao gerar visualização.");
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
    const export_token = crypto.randomBytes(32).toString("hex");
    const result = await db.run("INSERT INTO empresas (nome, cnpj, token, export_token) VALUES (?, ?, ?, ?)", [nome, cnpj, token, export_token]);
    
    res.status(201).json({ success: true, id: result.lastID, token, export_token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao cadastrar empresa." });
  }
});

app.put("/api/empresas/:id", async (req, res) => {
  try {
    const db = getDB();
    const { nome, cnpj } = req.body;
    if (!nome || !cnpj) return res.status(400).json({ error: "Nome e CNPJ são obrigatórios." });

    const check = await db.get("SELECT id FROM empresas WHERE cnpj = ? AND id != ?", [cnpj, req.params.id]);
    if (check) return res.status(400).json({ error: "Outra empresa com este CNPJ já existe." });

    await db.run("UPDATE empresas SET nome = ?, cnpj = ? WHERE id = ?", [nome, cnpj, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar empresa." });
  }
});

app.delete("/api/empresas/:id", async (req, res) => {
  try {
    const db = getDB();
    
    // As notas should ideally be cascaded or checked
    await db.run("DELETE FROM notas WHERE empresa_id = ?", [req.params.id]);
    await db.run("DELETE FROM empresas WHERE id = ?", [req.params.id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir empresa." });
  }
});

app.get("/api/relatorios/:empresa_id", async (req, res) => {
  try {
    const db = getDB();
    const { empresa_id } = req.params;
    const { start, end } = req.query; // 'YYYY-MM-DD'

    let dateFilter = "";
    const params: any[] = [empresa_id];
    if (start && end) {
      dateFilter = "AND data_emissao >= ? AND data_emissao <= ?";
      params.push(start, end);
    }

    // Totals
    const totaisQuery = `
      SELECT 
        SUM(CASE WHEN tipo = 'Entrada' THEN valor_total ELSE 0 END) as total_entrada,
        SUM(CASE WHEN tipo = 'Saída' OR tipo = 'Saida' THEN valor_total ELSE 0 END) as total_saida,
        COUNT(CASE WHEN tipo = 'Entrada' THEN 1 END) as count_entrada,
        COUNT(CASE WHEN tipo = 'Saída' OR tipo = 'Saida' THEN 1 END) as count_saida
      FROM notas 
      WHERE empresa_id = ? ${dateFilter}
    `;
    const totais = await db.get(totaisQuery, params);

    // Mensal Evolution
    const mensalQuery = `
      SELECT 
        strftime('%Y-%m', data_emissao) as mes,
        SUM(CASE WHEN tipo = 'Entrada' THEN valor_total ELSE 0 END) as entrada,
        SUM(CASE WHEN tipo = 'Saída' OR tipo = 'Saida' THEN valor_total ELSE 0 END) as saida
      FROM notas 
      WHERE empresa_id = ? ${dateFilter}
      GROUP BY strftime('%Y-%m', data_emissao)
      ORDER BY mes ASC
    `;
    const mensal = await db.all(mensalQuery, params);

    // Top Fornecedores (Entrada)
    const topFornecedoresQuery = `
      SELECT fornecedor as nome, SUM(valor_total) as valor
      FROM notas
      WHERE empresa_id = ? AND tipo = 'Entrada' ${dateFilter}
      GROUP BY fornecedor
      ORDER BY valor DESC
      LIMIT 10
    `;
    const topFornecedores = await db.all(topFornecedoresQuery, params);

    // Top Clientes (Saída)
    const topClientesQuery = `
      SELECT fornecedor as nome, SUM(valor_total) as valor
      FROM notas
      WHERE empresa_id = ? AND (tipo = 'Saída' OR tipo = 'Saida') ${dateFilter}
      GROUP BY fornecedor
      ORDER BY valor DESC
      LIMIT 10
    `;
    const topClientes = await db.all(topClientesQuery, params);

    const topCfopsEntradaQuery = `
      SELECT cfop as nome, SUM(valor_total) as valor
      FROM notas
      WHERE empresa_id = ? AND tipo = 'Entrada' AND cfop IS NOT NULL AND cfop != '' ${dateFilter}
      GROUP BY cfop
      ORDER BY valor DESC
      LIMIT 10
    `;
    const topCfopsEntrada = await db.all(topCfopsEntradaQuery, params);

    const topCfopsSaidaQuery = `
      SELECT cfop as nome, SUM(valor_total) as valor
      FROM notas
      WHERE empresa_id = ? AND (tipo = 'Saída' OR tipo = 'Saida') AND cfop IS NOT NULL AND cfop != '' ${dateFilter}
      GROUP BY cfop
      ORDER BY valor DESC
      LIMIT 10
    `;
    const topCfopsSaida = await db.all(topCfopsSaidaQuery, params);

    res.json({
      totais: totais || { total_entrada: 0, total_saida: 0, count_entrada: 0, count_saida: 0 },
      mensal: mensal || [],
      topFornecedores: topFornecedores || [],
      topClientes: topClientes || [],
      topCfopsEntrada: topCfopsEntrada || [],
      topCfopsSaida: topCfopsSaida || []
    });

  } catch(error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao gerar relatorio" });
  }
});
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
      if (tipo === 'Saída' || tipo === 'Saida') {
        baseQuery += " AND (n.tipo = 'Saída' OR n.tipo = 'Saida')";
      } else {
        baseQuery += " AND n.tipo = ?";
        params.push(tipo);
      }
    }
    if (modelo && typeof modelo === 'string') {
      if (modelo === 'NF-e' || modelo === '55') {
        baseQuery += " AND (n.modelo = '55' OR n.modelo = 'NF-e' OR n.tipo = 'Entrada')";
      } else if (modelo === 'NFC-e' || modelo === '65') {
        baseQuery += " AND (n.modelo = '65' OR n.modelo = 'NFC-e') AND n.tipo != 'Entrada'";
      } else {
        baseQuery += " AND n.modelo = ?";
        params.push(modelo);
      }
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

    const valueRow = await db.get(`SELECT SUM(valor_total) as totalSum ${baseQuery}`, params);
    const totalSum = valueRow && valueRow.totalSum ? valueRow.totalSum : 0;

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
      totalSum,
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

// 6. Download Agente (by URL or Path)
app.get("/api/download-agente", (req, res) => {
  // Use the external URL if provided in the environment variable
  if (process.env.DOWNLOAD_AGENTE_URL) {
    console.log("Redirecionando para link externo configurado no .env:", process.env.DOWNLOAD_AGENTE_URL);
    return res.redirect(process.env.DOWNLOAD_AGENTE_URL);
  }

  const possiblePaths = [
    "/volumes/backup/Instalador_AgenteNFe.exe",
    "/backup/Instalador_AgenteNFe.exe",
    "/app/backup/Instalador_AgenteNFe.exe",
    "/app/volumes/backup/Instalador_AgenteNFe.exe",
    "/etc/easypanel/projects/pm/captura/volumes/backup/Instalador_AgenteNFe.exe",
    path.join(process.cwd(), "backup", "Instalador_AgenteNFe.exe"),
    path.join(process.cwd(), "volumes", "backup", "Instalador_AgenteNFe.exe"),
    path.join(process.cwd(), "agente_local", "Instalador_AgenteNFe.exe"),
    path.join(process.cwd(), "public", "Instalador_AgenteNFe.exe"),
    path.join(process.cwd(), "Instalador_AgenteNFe.exe")
  ];

  console.log("Tentando baixar instalador. Procurando em:");
  let filePath = "";
  for (const p of possiblePaths) {
    const exists = fs.existsSync(p);
    console.log(`- ${p}: ${exists ? "ENCONTRADO" : "NÃO EXISTE"}`);
    if (exists) {
      filePath = p;
      break;
    }
  }

  if (filePath) {
    res.download(filePath, "Instalador_AgenteNFe.exe");
  } else {
    res.status(404).json({ 
      error: "Arquivo instalador não encontrado no servidor.",
      message: "Verifique se o volume foi montado corretamente no Easypanel/Docker.",
      helper: "O arquivo deve estar acessível dentro do container em um destes caminhos.",
      tried: possiblePaths
    });
  }
});

// Export API (Integration)
app.get("/api/v1/export/notas/:export_token", async (req, res) => {
  try {
    const { export_token } = req.params;
    const { data_inicio } = req.query;
    
    if (!export_token) return res.status(400).json({ error: "Token de exportação não fornecido." });
    
    const db = getDB();
    const empresa = await db.get("SELECT id, nome, cnpj FROM empresas WHERE export_token = ?", [export_token]);
    
    if (!empresa) {
      return res.status(401).json({ error: "Token de exportação inválido ou expirado." });
    }
    
    // Build query to fetch notes
    let query = "SELECT id, chave_nfe, fornecedor, cnpj_fornecedor, data_emissao, valor_total, modelo, tipo, status, cfop FROM notas WHERE empresa_id = ?";
    const params: any[] = [empresa.id];
    
    if (data_inicio && typeof data_inicio === 'string') {
      // allows fetching notes since a certain date (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
      query += " AND data_emissao >= ?";
      params.push(data_inicio);
    }
    
    // For large tables, adding a limit could be a good idea, but avoiding for now to keep it simple
    query += " ORDER BY data_emissao DESC LIMIT 1000";
    
    const notas = await db.all(query, params);
    
    res.json({
      success: true,
      empresa: {
        nome: empresa.nome,
        cnpj: empresa.cnpj
      },
      count: notas.length,
      notas
    });
  } catch (error) {
    console.error("Erro na exportação:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

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
