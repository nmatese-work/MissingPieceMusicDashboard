/**
 * Central guard for Chartmetric usage.
 * Any attempt to hit Chartmetric while OFFLINE=true will throw immediately.
 */

function assertChartmetricEnabled() {
    if (
      process.env.OFFLINE === 'true' ||
      process.env.CHARTMETRIC_DISABLED === 'true'
    ) {
      const err = new Error(
        'Chartmetric access blocked (OFFLINE / CHARTMETRIC_DISABLED)'
      );
      err.code = 'CHARTMETRIC_DISABLED';
      throw err;
    }
  }
  
  module.exports = { assertChartmetricEnabled };
  