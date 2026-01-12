/*
  Usage: set CHARTMETRIC_REFRESH_TOKEN in env, then:
    node scripts/exchange_chartmetric_token.js
*/
const axios = require('axios');

(async () => {
  const refresh = process.env.CHARTMETRIC_REFRESH_TOKEN;
  if (!refresh) {
    console.error('Set CHARTMETRIC_REFRESH_TOKEN in the environment first.');
    process.exit(2);
  }
  try {
    const r = await axios.post('https://api.chartmetric.com/api/token', { refreshtoken: refresh }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });
    console.log('RESPONSE:', JSON.stringify(r.data, null, 2));
    // If response contains an access token field, print a short note:
    const token = r.data?.access_token || r.data?.token || r.data?.data || r.data?.token_value;
    if (token) {
      console.log('\nAccess token looks like (first 20 chars):', String(token).slice(0, 20) + '…');
      console.log('You can save this into .env as CHARTMETRIC_API_TOKEN=<ACCESS_TOKEN>');
    } else {
      console.log('\nNo obvious access token field found — inspect the JSON above.');
    }
  } catch (err) {
    console.error('Exchange failed:', err.response?.data || err.message);
    process.exit(1);
  }
})();
