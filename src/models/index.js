// src/models/index.js
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const sequelize = require('../config/db');

const basename = path.basename(__filename);
const db = {};

fs.readdirSync(__dirname)
  .filter((file) => file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js')
  .forEach((file) => {
    const fullPath = path.join(__dirname, file);

    // require the module
    const imported = require(fullPath);

    let model = null;

    // handle `module.exports = (sequelize, DataTypes) => {...}`
    if (typeof imported === 'function') {
      try {
        // many modules export a factory function
        model = imported(sequelize, Sequelize.DataTypes);
      } catch (err) {
        // If calling as a function throws the "Class constructor ... cannot be invoked without 'new'"
        // or other errors, fall back to treating the exported value as a Model/class instance.
        if (
          err instanceof TypeError &&
          /cannot be invoked without 'new'/.test(err.message)
        ) {
          // imported is likely a Model class returned by sequelize.define (a subclass of Model)
          model = imported;
        } else {
          // Not the special-case TypeError — rethrow to not hide real problems
          throw err;
        }
      }
    } else if (imported && typeof imported === 'object') {
      // common pattern: module.exports = Model (an object/function) OR exports.default
      // If it's an ES module default export, use that
      if (imported.default) {
        const maybe = imported.default;
        if (typeof maybe === 'function') {
          try {
            model = maybe(sequelize, Sequelize.DataTypes);
          } catch (err) {
            if (
              err instanceof TypeError &&
              /cannot be invoked without 'new'/.test(err.message)
            ) {
              model = maybe;
            } else {
              throw err;
            }
          }
        } else {
          model = maybe;
        }
      } else {
        // If the module already exported a model instance (sequelize.define returned it)
        model = imported;
      }
    }

    if (!model) {
      // If still nothing, skip gracefully
      return;
    }

    // If model is a Sequelize Model class (subclass), ensure it is registered on sequelize
    // Some files export model classes already initialized by sequelize.define (bound to the same sequelize)
    // To be safe, if model has a name property and options, use it
    const modelName = model.name || (model.options && model.options.name && model.options.name.singular) || path.basename(file, '.js');

    // Attach to db by modelName
    db[modelName] = model;
  });

// run associations if present (many model files use .associate)
Object.keys(db).forEach((modelName) => {
  const model = db[modelName];
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
