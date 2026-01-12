// scripts/testDb.js
require('dotenv').config();

const sequelize = require('../src/config/db');

(async () => {
  try {
    console.log('Connecting to DB...');
    await sequelize.authenticate();
    console.log('DB connected');

    console.log('Syncing models...');
    await sequelize.sync({ alter: true });
    console.log('Models synced');

    process.exit(0);
  } catch (err) {
    console.error('DB connection FAILED');
    console.error(err.message);
    process.exit(1);
  }
})();
