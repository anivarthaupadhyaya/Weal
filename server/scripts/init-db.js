const path = require('path');
const fs = require('fs');
const EmbeddedPostgres = require('embedded-postgres').default;

const dbDir = path.resolve(__dirname, '../.postgres-data');

async function main() {
  const isInitialised = fs.existsSync(dbDir) && fs.existsSync(path.join(dbDir, 'PG_VERSION'));
  
  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: 5432,
    user: 'postgres',
    password: 'password',
    persistent: true
  });

  if (!isInitialised) {
    console.log('Initialising PostgreSQL cluster in:', dbDir);
    await pg.initialise();
  }

  console.log('Starting PostgreSQL server on port 5432...');
  await pg.start();
  console.log('PostgreSQL server started successfully on port 5432!');

  try {
    await pg.createDatabase('weal_db');
    console.log('Created database: weal_db');
  } catch (err) {
    console.log('Database check:', err.message);
  }

  console.log('PostgreSQL is ready for connections.');
}

main().catch(err => {
  console.error('Failed to run PostgreSQL:', err);
  process.exit(1);
});
