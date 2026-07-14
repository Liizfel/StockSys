import { execSync } from 'child_process';

console.log("--------------------------------------------------");
console.log("Iniciando verificação do banco de dados...");

const databaseUrl = process.env.POSTGRES_PRISMA_URL || 
                    process.env.POSTGRES_URL || 
                    process.env.DATABASE_URL || 
                    process.env.URL_DO_BANCO_DE_DADOS;

if (!databaseUrl || databaseUrl.includes('127.0.0.1') || databaseUrl.includes('localhost')) {
  console.log("⚠️ Banco de dados local ou vazio detectado. Pulando sincronização de tabelas.");
  console.log("--------------------------------------------------");
  process.exit(0);
}

try {
  console.log("Conexão detectada! Executando: prisma db push...");
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  console.log("✅ Tabelas sincronizadas com sucesso no banco de dados!");
} catch (error) {
  console.error("⚠️ Aviso: Não foi possível conectar ao banco de dados remoto neste momento.");
  console.error("Isso pode ocorrer se as credenciais do Vercel ainda não estiverem ativas.");
  console.error("O build prosseguirá normalmente.");
}
console.log("--------------------------------------------------");
