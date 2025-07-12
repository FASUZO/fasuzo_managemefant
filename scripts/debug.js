// scripts/debug.js  -- ES Module 调试工具
// 默认关闭详细调试，浏览器控制台输入 `debug = true` 可实时切换

let DEBUG = false;

Object.defineProperty(window, 'debug', {
  get() { return DEBUG; },
  set(v) {
    DEBUG = !!v;
    console.log('%c[DEBUG] ' + (DEBUG ? '详细模式已开启' : '详细模式已关闭'),
      'color:' + (DEBUG ? '#4caf50' : '#d32f2f'));
  }
});

export const logInfo = (...args) => console.log('%c[INFO]', 'color:#1976d2', ...args);
export const logDebug = (...args) => { if (DEBUG) console.debug('%c[DEBUG]', 'color:#9c27b0', ...args); };

// 向后兼容：挂到 window，供非模块脚本或手动调用
window.logInfo = logInfo;
window.logDebug = logDebug;

export { DEBUG }; 