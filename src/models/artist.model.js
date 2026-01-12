const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Artist = sequelize.define(
  'Artist',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    chartmetricArtistId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    spotifyArtistId: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // 🔹 NEW – persistent artist metrics
    spotifyFollowers: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    spotifyMonthlyListeners: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // raw API blob for debugging / backfill
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: 'artists',
    timestamps: true,
  }
);

module.exports = Artist;
