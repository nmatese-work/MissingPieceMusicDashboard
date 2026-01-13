let lastCall = 0;

// Default throttle increased to 5 seconds to avoid rate limiting
async function throttle(minMs = 5000) {
  const now = Date.now();
  const wait = Math.max(0, minMs - (now - lastCall));
  if (wait) {
    await new Promise(res => setTimeout(res, wait));
  }
  lastCall = Date.now();
}

module.exports = { throttle };
