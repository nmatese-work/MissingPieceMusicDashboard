let lastCall = 0;

// Default throttle increased to 3 seconds to avoid rate limiting
async function throttle(minMs = 3000) {
  const now = Date.now();
  const wait = Math.max(0, minMs - (now - lastCall));
  if (wait) {
    await new Promise(res => setTimeout(res, wait));
  }
  lastCall = Date.now();
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff on rate limit errors
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 30000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err.response?.status === 429 || err.isRateLimit;
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff: 30s, 60s, 120s
        console.warn(`Rate limited (429). Waiting ${delay / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(delay);
        continue;
      }
      
      throw err;
    }
  }
}

module.exports = { throttle, sleep, retryWithBackoff };
