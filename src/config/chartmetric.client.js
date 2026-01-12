const axios = require('axios');
const { assertChartmetricEnabled } = require('./chartmetric.guard');

const client = axios.create({
  baseURL: 'https://api.chartmetric.com/api',
  timeout: 20000,
});

// 🚨 BLOCK ALL REQUESTS WHEN OFFLINE
client.interceptors.request.use((config) => {
  assertChartmetricEnabled();

  const token = process.env.CHARTMETRIC_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Missing CHARTMETRIC_ACCESS_TOKEN');
  }

  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 🚫 NO RETRIES ON 429 — EVER
client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 429) {
      err.isRateLimit = true;
      throw err;
    }
    throw err;
  }
);

module.exports = client;
