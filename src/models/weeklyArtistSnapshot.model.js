// src/models/WeeklyArtistSnapshot.js
module.exports = (sequelize, DataTypes) => {
  const WeeklyArtistSnapshot = sequelize.define('WeeklyArtistSnapshot', {
    artistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    weekStartDate: DataTypes.DATEONLY,

    spotifyStreamsTotal: DataTypes.INTEGER,
    spotifyStreamsWeekly: DataTypes.INTEGER,

    spotifySavesTotal: DataTypes.INTEGER,
    spotifySaveRate: DataTypes.FLOAT,

    spotifyMonthlyListeners: DataTypes.INTEGER,
    spotifyFollowers: DataTypes.INTEGER,

    tiktokFollowers: DataTypes.INTEGER,
    instagramFollowers: DataTypes.INTEGER,
    youtubeSubscribers: DataTypes.INTEGER,
  }, {
    indexes: [
      {
        unique: true,
        fields: ['artistId', 'weekStartDate']
      }
    ]
  });

  WeeklyArtistSnapshot.associate = (models) => {
    WeeklyArtistSnapshot.belongsTo(models.Artist, { foreignKey: 'artistId' });
  };

  return WeeklyArtistSnapshot;
};
