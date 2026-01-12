let lastCall = 0;

async function throttle(minMs = 2000) {
  const now = Date.now();
  const wait = Math.max(0, minMs - (now - lastCall));
  if (wait) {
    await new Promise(res => setTimeout(res, wait));
  }
  lastCall = Date.now();
}

module.exports = { throttle };
