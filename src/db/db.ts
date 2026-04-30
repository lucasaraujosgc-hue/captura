import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let dbInstance: Database;

export async function initDB() {
  const isBackupMounted = fs.existsSync('/backup');
  const dataDir = isBackupMounted ? '/backup/data' : path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbInstance = await open({
    filename: path.join(dataDir, 'notas.db'),
    driver: sqlite3.Database
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS empresas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cnpj TEXT NOT NULL UNIQUE,
      token TEXT
    );

    CREATE TABLE IF NOT EXISTS notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL,
      chave_nfe TEXT NOT NULL,
      fornecedor TEXT,
      cnpj_fornecedor TEXT,
      data_emissao TEXT,
      valor_total REAL,
      modelo TEXT,
      caminho_arquivo TEXT,
      tipo TEXT,
      status TEXT,
      hostname TEXT,
      UNIQUE(empresa_id, chave_nfe),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    );
  `);

  try { await dbInstance.exec("ALTER TABLE empresas ADD COLUMN token TEXT;"); } catch (e) {}
  try { await dbInstance.exec("ALTER TABLE notas ADD COLUMN tipo TEXT;"); } catch (e) {}
  try { await dbInstance.exec("ALTER TABLE notas ADD COLUMN status TEXT;"); } catch (e) {}
  try { await dbInstance.exec("ALTER TABLE notas ADD COLUMN hostname TEXT;"); } catch (e) {}
  try { await dbInstance.exec("ALTER TABLE notas ADD COLUMN tamanho_arquivo INTEGER;"); } catch (e) {}
  try { await dbInstance.exec("ALTER TABLE notas ADD COLUMN cfop TEXT;"); } catch (e) {}

  // Migrate older databases holding the global UNIQUE constraint on chave_nfe
  const tableInfo = await dbInstance.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='notas'");
  if (tableInfo && tableInfo.sql.includes('chave_nfe TEXT NOT NULL UNIQUE')) {
    console.log("Migrating notas table to remove global unique constraint on chave_nfe...");
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS notas_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        chave_nfe TEXT NOT NULL,
        fornecedor TEXT,
        cnpj_fornecedor TEXT,
        data_emissao TEXT,
        valor_total REAL,
        modelo TEXT,
        caminho_arquivo TEXT,
        tipo TEXT,
        status TEXT,
        hostname TEXT,
        tamanho_arquivo INTEGER,
        cfop TEXT,
        UNIQUE(empresa_id, chave_nfe),
        FOREIGN KEY (empresa_id) REFERENCES empresas(id)
      );
      INSERT OR IGNORE INTO notas_new SELECT id, empresa_id, chave_nfe, fornecedor, cnpj_fornecedor, data_emissao, valor_total, modelo, caminho_arquivo, tipo, status, hostname, tamanho_arquivo, cfop FROM notas;
      DROP TABLE notas;
      ALTER TABLE notas_new RENAME TO notas;
    `);
  }
}

export function getDB() {
  if (!dbInstance) {
    throw new Error("DB not initialized!");
  }
  return dbInstance;
}
