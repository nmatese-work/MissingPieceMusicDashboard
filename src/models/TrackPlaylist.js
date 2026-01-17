// src/models/TrackPlaylist.js
module.exports = (sequelize, DataTypes) => {
    const TrackPlaylist = sequelize.define(
      'TrackPlaylist',
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
  
        playlistName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
  
        followers: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
  
        addedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
  
        curator: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        platform: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: 'spotify',
        },
  
        meta: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      {
        tableName: 'TrackPlaylists',
      }
    );
  
    TrackPlaylist.associate = (models) => {
      TrackPlaylist.belongsTo(models.Track, { foreignKey: 'trackId' });
    };
  
    return TrackPlaylist;
  };
  