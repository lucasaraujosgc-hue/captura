import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database;

export async function initDB() {
  const dataDir = path.join(process.cwd(), 'data');
  import('fs').then(fs => {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  });

  dbInstance = await open({
    filename: path.join(process.cwd(), 'data', 'notas.db'),
    driver: sqlite3.Database
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS empresas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cnpj TEXT NOT NULL UNIQUE
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
      FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    );
  `);
}

export function getDB() {
  if (!dbInstance) {
    throw new Error("DB not initialized!");
  }
  return dbInstance;
}
