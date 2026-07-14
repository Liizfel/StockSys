const resolvedDatabaseUrl = process.env.POSTGRES_PRISMA_URL || 
                            process.env.POSTGRES_URL || 
                            process.env.DATABASE_URL || 
                            process.env.URL_DO_BANCO_DE_DADOS || "";

if (resolvedDatabaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
}

import app from '../prisma-server';

export default app;
