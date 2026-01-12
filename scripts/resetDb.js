// scripts/resetDb.js
require('dotenv').config();
const db = require('../src/models');

(async () => {
  try {
    console.log('Connecting to DB...');
    await db.sequelize.authenticate();
    console.log('DB connected');

    console.log('Dropping & re-creating all tables (force sync) — dev only!');
    await db.sequelize.sync({ force: true });
    console.log('All models synced (tables recreated)');

    // show created tables using Sequelize model names
    console.log('Created models:', Object.keys(db).filter(k => k !== 'sequelize' && k !== 'Sequelize'));

    process.exit(0);
  } catch (err) {
    console.error('Reset failed:');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
