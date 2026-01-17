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
        youtubeViews: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        // Additional track metrics from cm_statistics
        tiktokVideos: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        spotifyPlaylists: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        spotifyEditorialPlaylists: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        appleMusicPlaylists: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        appleMusicEditorialPlaylists: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        spotifyPlaylistReach: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        shazamCounts: {
          type: DataTypes.INTEGER,
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
  