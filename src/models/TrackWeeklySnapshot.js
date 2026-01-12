// src/models/TrackWeeklySnapshot.js
module.exports = (sequelize, DataTypes) => {
    const TrackWeeklySnapshot = sequelize.define(
      'TrackWeeklySnapshot',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
  
        trackId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
  
        weekStartDate: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
  
        spotifyListeners: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
  
        spotifySaves: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
  
        spotifySaveRate: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
      },
      {
        tableName: 'TrackWeeklySnapshots',
        indexes: [
          {
            unique: true,
            fields: ['trackId', 'weekStartDate'],
          },
        ],
      }
    );
  
    TrackWeeklySnapshot.associate = (models) => {
      TrackWeeklySnapshot.belongsTo(models.Track, { foreignKey: 'trackId' });
    };
  
    return TrackWeeklySnapshot;
  };
  