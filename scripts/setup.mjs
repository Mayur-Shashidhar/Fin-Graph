import { access, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
try { await access('.env.local'); console.log('.env.local already exists. Its settings were preserved.'); }
catch {
  const postgres=randomBytes(18).toString('hex'),neo4j=randomBytes(18).toString('hex'),token=randomBytes(24).toString('hex');
  await writeFile('.env.local',[
    '# Generated local credentials. Do not commit this file.',
    `DATABASE_URL="postgresql://postgres:${postgres}@localhost:5432/fingraph_db"`,
    `POSTGRES_PASSWORD="${postgres}"`,
    'NEO4J_URI="neo4j://localhost:7687"',
    'NEO4J_USERNAME="neo4j"',
    `NEO4J_PASSWORD="${neo4j}"`,
    'NEO4J_DATABASE="neo4j"',
    `GRAPH_API_TOKEN="${token}"`,
    'APP_URL="http://localhost:3000"',
    'NODE_ENV="development"','',
  ].join('\n'),{flag:'wx',mode:0o600});
  console.log(`Created .env.local. Workspace access key: ${token}`);
}
console.log('Start the full stack with: npm run stack');
