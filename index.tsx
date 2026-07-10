if (process.env.URL_DO_BANCO_DE_DADOS && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.URL_DO_BANCO_DE_DADOS;
}

import app from '../prisma-server';

export default app;
