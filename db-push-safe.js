import { execSync } from 'child_process';

console.log("--------------------------------------------------");
console.log("Iniciando verificação do banco de dados...");

let databaseUrl = process.env.POSTGRES_PRISMA_URL || 
                    process.env.POSTGRES_URL || 
                    process.env.DATABASE_URL || 
                    process.env.URL_DO_BANCO_DE_DADOS;

if (!databaseUrl || databaseUrl.includes('127.0.0.1') || databaseUrl.includes('localhost')) {
  console.log("⚠️ Banco de dados Postgres local ou vazio detectado. Redirecionando para SQLite local (file:./dev.db).");
  databaseUrl = 'file:./dev.db';
  process.env.DATABASE_URL = 'file:./dev.db';
}

try {
  console.log(`Conexão detectada (${databaseUrl.startsWith('file:') ? 'SQLite' : 'PostgreSQL'})! Executando: prisma db push...`);
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  console.log("✅ Tabelas sincronizadas com sucesso no banco de dados!");
} catch (error) {
  console.error("⚠️ Erro na sincronização do banco de dados:", error.message);
  console.error("O build prosseguirá normalmente.");
}
console.log("--------------------------------------------------");
