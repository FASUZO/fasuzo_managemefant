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

/**
 * 控制日志输出等级：
 * 1. 浏览器中可直接执行 `window.debug = true` 开启详细日志，再次设为 `false` 关闭。
 * 2. 也可在服务端通过环境变量 `DEFAULT_DEBUG=true` 让前端默认开启（见 server/server.js）。
 *
 * @example <caption>在代码中条件输出调试信息</caption>
 * import { logDebug } from './debug.js';
 * logDebug('当前状态', someObj);
 *
 * @example <caption>在浏览器控制台动态开关</caption>
 * // 打开详细调试
 * > debug = true;
 * // 关闭详细调试
 * > debug = false;
 */
export const logInfo = (...args) => console.log('%c[INFO]', 'color:#1976d2', ...args);

/**
 * 详细调试日志，仅当 `window.debug === true` 时输出。
 * @param {...any} args  要打印的内容
 */
export const logDebug = (...args) => { if (DEBUG) console.debug('%c[DEBUG]', 'color:#9c27b0', ...args); };

// 向后兼容：挂到 window，供非模块脚本或手动调用
window.logInfo = logInfo;
window.logDebug = logDebug;

export { DEBUG };

/**
 * 启用光标状态调试：
 *   1. 监听 `mousemove`，实时检查所在元素的 `cursor` 计算样式。
 *   2. 当光标样式发生变化时打印日志（仅在 debug=true 时输出）。
 *   3. 返回一个关闭函数，调用后停止监听。
 *
 * 使用示例：
 *   import { enableCursorDebug } from './debug.js';
 *   const stop = enableCursorDebug();
 *   // ... 调试结束后
 *   stop();
 */
export function enableCursorDebug(){
  let lastCursor='';
  const handler=(e)=>{
    // 获取当前鼠标下元素的光标样式
    const cur = getComputedStyle(e.target).cursor || 'auto';
    if(cur!==lastCursor){
      lastCursor=cur;
      if(DEBUG){
        console.debug('%c[CURSOR]', 'color:#ff5722', cur, e.target);
      }
    }
  };
  document.addEventListener('mousemove', handler, { passive:true });
  console.log('%c[DEBUG] 光标状态调试已启用', 'color:#ff5722');
  const stop=()=>{
    document.removeEventListener('mousemove', handler);
    console.log('%c[DEBUG] 光标状态调试已关闭', 'color:#ff5722');
  };
  return stop;
}

// 同步到 window 方便在控制台快速启用/关闭
window.enableCursorDebug = enableCursorDebug; 