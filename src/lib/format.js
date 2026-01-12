// src/lib/format.js
function percentChange(curr, prev) {
    if (curr == null || prev == null || prev === 0) return '0.00%';
    return (((curr - prev) / prev) * 100).toFixed(2) + '%';
  }
  
  function formatNumber(num) {
    if (num === null || num === undefined) return '';
    return Number(num).toLocaleString();
  }
  
  function formatWeekLabel(dateString) {
    const d = new Date(dateString);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  
  module.exports = { percentChange, formatNumber, formatWeekLabel };
  