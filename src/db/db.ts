import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let dbInstance: Database;

export async function initDB() {
  const dataDir = path.join(process.cwd(), 'data');
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
      chave_nfe TEXT NOT NULL UNIQUE,
      fornecedor TEXT,
      cnpj_fornecedor TEXT,
      data_emissao TEXT,
      valor_total REAL,
      modelo TEXT,
      caminho_arquivo TEXT,
      tipo TEXT,
      status TEXT,
      hostname TEXT,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    );
  `);

  try { await dbInstance.exec("ALTER TABLE empresas ADD COLUMN token TEXT;"); } catch (e) {}
  try { await dbInstance.exec("ALTER TABLE notas ADD COLUMN tipo TEXT;"); } catch (e) {}
  try { await dbInstance.exec("ALTER TABLE notas ADD COLUMN status TEXT;"); } catch (e) {}
  try { await dbInstance.exec("ALTER TABLE notas ADD COLUMN hostname TEXT;"); } catch (e) {}
  try { await dbInstance.exec("ALTER TABLE notas ADD COLUMN tamanho_arquivo INTEGER;"); } catch (e) {}
}

export function getDB() {
  if (!dbInstance) {
    throw new Error("DB not initialized!");
  }
  return dbInstance;
}
