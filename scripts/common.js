// scripts/common.js
// 全站通用脚本：导航栏注入 + 首页时钟

const navItems = [
  { href: '/index.html', label: '首页' },
  { href: '/pages/assets.html', label: '资产' },
  { href: '/pages/planning.html', label: '规划' },
  { href: '/pages/management.html', label: '管理' }
];

function buildNav() {
  let nav = document.querySelector('nav');
  if (!nav) {
    nav = document.createElement('nav');
    document.body.appendChild(nav);
  }
  // 读取主题
  const isDark = localStorage.getItem('theme') === 'dark';
  document.body.classList.toggle('dark', isDark);
  console.debug('[common] apply theme', isDark ? 'dark' : 'light');
  const currentPath = location.pathname.replace(/\\/g, '/'); // 兼容 Windows 路径
  nav.innerHTML = navItems
    .map(item => {
      const active = currentPath === item.href || currentPath.endsWith(item.href.replace(/^\//, ''));
      return `<a href="${item.href}" ${active ? 'aria-current="page" class="active"' : ''}>${item.label}</a>`;
    })
    .join('');
}

function setupClock() {
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  if (!clockEl || !dateEl) return; // 只有首页才有时钟元素

  const pad = n => n.toString().padStart(2, '0');
  const cnWeek = ['日', '一', '二', '三', '四', '五', '六'];
  const update = () => {
    const now = new Date();
    clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    dateEl.textContent = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 星期${cnWeek[now.getDay()]}`;
  };
  update();
  setInterval(update, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  buildNav();
  setupClock();

  /* ---------- 全站字体缩放 ---------- */
  const ZOOM_KEY = 'siteZoom';
  const stored = parseInt(localStorage.getItem(ZOOM_KEY) || '100', 10);
  document.documentElement.style.setProperty('--site-zoom', stored + '%');

  if(!window.setFontScale){
    window.setFontScale = function(pct){
      pct = parseInt(pct,10);
      if(isNaN(pct)) return; pct = Math.max(80, Math.min(150, pct));
      localStorage.setItem(ZOOM_KEY, pct);
      document.documentElement.style.setProperty('--site-zoom', pct + '%');
      console.info('Site zoom set', pct);
    };
  }
});

/* -------- 轻量级全局提示 -------- */
if(!window.showToast){
  window.showToast = function(msg,duration=2000){
    const el=document.createElement('div');
    el.className='toast';
    if(document.body.classList.contains('dark')) el.classList.add('dark');
    el.textContent=msg;
    document.body.appendChild(el);
    // 触发过渡
    requestAnimationFrame(()=> el.classList.add('show'));
    setTimeout(()=>{
      el.classList.remove('show');
      setTimeout(()=> el.remove(),300);
    }, duration);
  };
} 