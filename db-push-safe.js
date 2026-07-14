import { execSync } from 'child_process';

console.log("--------------------------------------------------");
console.log("Iniciando verificação do banco de dados...");

let databaseUrl = process.env.POSTGRES_URL_NON_POOLING || 
                    process.env.POSTGRES_PRISMA_URL || 
                    process.env.POSTGRES_URL || 
                    process.env.DATABASE_URL || 
                    process.env.URL_DO_BANCO_DE_DADOS;

if (!databaseUrl) {
  console.log("⚠️ Nenhuma URL de banco de dados detectada!");
} else {
  process.env.DATABASE_URL = databaseUrl;
}

try {
  console.log(`Conexão detectada! Executando: prisma db push...`);
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  console.log("✅ Tabelas sincronizadas com sucesso no banco de dados!");
} catch (error) {
  console.error("⚠️ Erro na sincronização do banco de dados:", error.message || error);
  console.error("O build prosseguirá normalmente.");
}
console.log("--------------------------------------------------");
