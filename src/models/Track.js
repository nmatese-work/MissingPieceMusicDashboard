// src/models/Track.js
module.exports = (sequelize, DataTypes) => {
    const Track = sequelize.define(
      'Track',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
  
        artistId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
  
        chartmetricTrackId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          unique: true,
        },
  
        spotifyTrackId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
  
        title: {
          type: DataTypes.STRING,
          allowNull: false,
        },
  
        meta: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      {
        tableName: 'Tracks',
      }
    );
  
    Track.associate = (models) => {
      Track.belongsTo(models.Artist, { foreignKey: 'artistId' });
      Track.hasMany(models.TrackWeeklySnapshot, { foreignKey: 'trackId' });
      Track.hasMany(models.TrackPlaylist, { foreignKey: 'trackId' });
    };
  
    return Track;
  };
  