// scripts/management.js
// 从原 pages/management.html 内联脚本迁移而来

import { logDebug, logInfo } from './debug.js';

(async function() {
  // 读取运行时配置
  let envCfg = {};
  try {
    const r = await fetch('/api/env');
    if(r.ok) envCfg = await r.json();
  } catch(e){ console.warn('无法获取 /api/env', e); }

  // 应用默认设置
  if(localStorage.getItem('autoSave') === null && typeof envCfg.defaultAutoSave === 'boolean'){
    localStorage.setItem('autoSave', envCfg.defaultAutoSave);
  }
  if(localStorage.getItem('theme') === null && typeof envCfg.defaultDark === 'boolean'){
    localStorage.setItem('theme', envCfg.defaultDark ? 'dark' : 'light');
  }
  if(envCfg.debug){ window.debug = true; }
  if(envCfg.fontUrl){ const link=document.createElement('link'); link.rel='stylesheet'; link.href=envCfg.fontUrl; document.head.appendChild(link); }

  logDebug('管理页面脚本启动');
  const STORAGE_KEY_CAT = 'assetCategories';
  const DEFAULT_CATEGORIES = ['设备', '软件', '零件', '其他'];
  const DEFAULT_CHANNELS = ['淘宝', '京东', '拼多多', '闲鱼', '其他'];

  // 列管理 UI的所有列配置，需先定义，后面 fetch 中会用到
  let allColumns = [
    { key:'name', label:'资产名称' },
    { key:'category', label:'资产分类' },
    { key:'subcategory', label:'分类' },
    { key:'amount', label:'金额' },
    { key:'date', label:'时间' },
    { key:'channel', label:'购入渠道' },
    { key:'image', label:'附件' },
    { key:'note', label:'备注' }
  ];

  // 从服务器拉取数据
  let categories = [];
  let channels = [];
  let tags = [];
  let assetsCache = [];
  let hiddenColumns = [];
  let columnOrder = [];

  await fetch('/api/data').then(r=>r.json()).then(d=>{
    categories = d.categories || DEFAULT_CATEGORIES.slice();
    channels = d.channels || DEFAULT_CHANNELS.slice();
    tags = d.tags || [];
    assetsCache = d.assets || [];
    hiddenColumns = d.hiddenColumns || [];
    if(Array.isArray(d.columns) && d.columns.length){ allColumns = d.columns; }
    columnOrder = Array.isArray(d.columnOrder) && d.columnOrder.length ? d.columnOrder : allColumns.map(c=>c.key);
  });

  const labelMap = { name:'名称', category:'分类', subcategory:'标签' };
  allColumns.forEach(c=>{ if(labelMap[c.key]) c.label = labelMap[c.key]; });

  const listEl = document.getElementById('categoryList');
  const addBtn = document.getElementById('addCategory');
  const exportBtn = document.getElementById('exportData');
  const editDataBtn = document.getElementById('editDataBtn');
  const importInput = document.getElementById('importFile');
  const channelListEl = document.getElementById('channelList');
  const addChannelBtn = document.getElementById('addChannel');
  const columnToggleBox = document.getElementById('columnToggles');
  const addColumnBtn = document.getElementById('addColumnBtn');
  const deleteColumnBtn = document.getElementById('deleteColumnBtn');
  const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');
  const deleteChannelBtn = document.getElementById('deleteChannelBtn');
  const tagListEl = document.getElementById('tagList');
  const addTagBtn = document.getElementById('addTag');
  const deleteTagBtn = document.getElementById('deleteTagBtn');
  const viewDataBtn = document.getElementById('viewDataBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');

  // 标记是否有未保存修改
  let pendingChanges = false;

  // -------------- 新增：暗黑模式与自动保存 --------------
  const THEME_KEY = 'theme'; // "dark" | "light"
  const AUTO_SAVE_KEY = 'autoSave'; // "true" | "false"

  // 读取用户偏好
  let autoSaveEnabled = localStorage.getItem(AUTO_SAVE_KEY) === 'true';
  const isDark = localStorage.getItem(THEME_KEY) === 'dark';
  if(isDark){ document.body.classList.add('dark'); }

  // DOM 元素在页面解析后才存在，稍后赋值
  let darkToggleEl, autoSaveToggleEl;

  function initToggles(){
    /* 顶部控制栏容器 */
    const switchBar = document.querySelector('.switch-bar');

    darkToggleEl = document.getElementById('darkModeToggle');
    autoSaveToggleEl = document.getElementById('autoSaveToggle');

    if(darkToggleEl){
      darkToggleEl.checked = isDark;
      darkToggleEl.addEventListener('change', ()=>{
        const nowDark = darkToggleEl.checked;
        document.body.classList.toggle('dark', nowDark);
        localStorage.setItem(THEME_KEY, nowDark ? 'dark' : 'light');
        logInfo('Theme changed', nowDark ? 'dark' : 'light');
      });
    }

    if(autoSaveToggleEl){
      autoSaveToggleEl.checked = autoSaveEnabled;
      autoSaveToggleEl.addEventListener('change', ()=>{
        autoSaveEnabled = autoSaveToggleEl.checked;
        localStorage.setItem(AUTO_SAVE_KEY, autoSaveEnabled);
        logInfo('AutoSave toggled', autoSaveEnabled);
        if(autoSaveEnabled && pendingChanges){
          syncToServer(true);
          alert('已开启自动保存，现有修改已同步');
        }
      });
    }

    /* -------- 使用图标按钮替代开关 -------- */
    const addIconButton=(icon, title, onClick)=>{
      const btn=document.createElement('button');
      btn.className='icon-btn';
      btn.textContent=icon;
      btn.title=title;
      btn.addEventListener('click', onClick);
      switchBar.appendChild(btn);
      return btn;
    };

    /* ---------- 底部浮动保存按钮删除 ---------- */
    const bottomSave=document.getElementById('saveDataBtn');
    if(bottomSave) bottomSave.remove();

    /* ---------- 手动保存按钮 ---------- */
    addIconButton('💾','保存数据',()=>{
      syncToServer(true);
      alert('数据已保存！');
    });

    /* ---------- 自动保存按钮 ---------- */
    const updateAutoIcon=()=> {
      const on = autoSaveToggleEl.checked;
      autoBtn.textContent = on ? '🟢' : '🔴';
      autoBtn.classList.toggle('active', on);
    };
    const autoBtn=addIconButton('', '自动保存', ()=>{
      autoSaveToggleEl.checked=!autoSaveToggleEl.checked;
      autoSaveToggleEl.dispatchEvent(new Event('change'));
      updateAutoIcon();
    });
    updateAutoIcon();

    /* ---------- 设置弹窗 ---------- */
    addIconButton('❓','设置',openSettingsModal);

    function openSettingsModal(){
      const overlay=document.createElement('div'); overlay.className='overlay';
      const modal=document.createElement('div'); modal.className='modal'; modal.style.width='300px';
      const title=document.createElement('h3'); title.textContent='界面设置'; modal.appendChild(title);

      const formWrap=document.createElement('div'); formWrap.style.display='flex'; formWrap.style.flexDirection='column'; formWrap.style.gap='12px';

      // 主宽度
      const wLabel=document.createElement('label'); wLabel.textContent='主区域宽度(px)';
      wLabel.style.display='flex'; wLabel.style.alignItems='center'; wLabel.style.justifyContent='space-between';
      const widthInput=document.createElement('input'); widthInput.type='number'; widthInput.min=600; widthInput.max=2400; widthInput.step=100;
      widthInput.style.width='100px'; widthInput.style.marginLeft='12px';
      widthInput.value=parseInt(localStorage.getItem('mainWidth')||'1200',10);
      wLabel.appendChild(widthInput);
      formWrap.appendChild(wLabel);

      // 站点缩放
      const zLabel=document.createElement('label'); zLabel.textContent='字体缩放(%)';
      zLabel.style.display='flex'; zLabel.style.alignItems='center'; zLabel.style.justifyContent='space-between';
      const zoomInput=document.createElement('input'); zoomInput.type='number'; zoomInput.min=80; zoomInput.max=150; zoomInput.step=10;
      zoomInput.style.width='100px'; zoomInput.style.marginLeft='12px';
      zoomInput.value=parseInt(localStorage.getItem('siteZoom')||'100',10);
      zLabel.appendChild(zoomInput);
      formWrap.appendChild(zLabel);

      modal.appendChild(formWrap);

      const actions=document.createElement('div'); actions.className='actions';
      const okBtn=document.createElement('button'); okBtn.textContent='应用'; okBtn.className='btn-like';
      const cancelBtn=document.createElement('button'); cancelBtn.textContent='取消'; cancelBtn.className='btn-like btn-danger btn-small';

      okBtn.onclick=()=>{
        const w=parseInt(widthInput.value,10); const z=parseInt(zoomInput.value,10);
        if(!isNaN(w)&&w>=600&&w<=2400){ localStorage.setItem('mainWidth',w); document.documentElement.style.setProperty('--main-max-width', w+'px'); }
        if(!isNaN(z)&&z>=80&&z<=150){ localStorage.setItem('siteZoom',z); document.documentElement.style.setProperty('--site-zoom', z+'%'); }
        document.body.removeChild(overlay);
      };
      cancelBtn.onclick=()=> document.body.removeChild(overlay);

      actions.appendChild(okBtn); actions.appendChild(cancelBtn); modal.appendChild(actions);
      overlay.appendChild(modal); document.body.appendChild(overlay);
    }

    /* ---------- 全局函数 ---------- */
    window.setMainWidth = function(px){
      px = parseInt(px,10);
      if(isNaN(px)) return; px = Math.max(600, Math.min(2400, px));
      localStorage.setItem('mainWidth', px);
      document.documentElement.style.setProperty('--main-max-width', px+'px');
      console.info('Main width set to', px);
    };
    if(!window.setFontScale){
      window.setFontScale = function(pct){
        pct = parseInt(pct,10);
        if(isNaN(pct)) return; pct = Math.max(80, Math.min(150, pct));
        localStorage.setItem('siteZoom', pct);
        document.documentElement.style.setProperty('--site-zoom', pct + '%');
        console.info('Site zoom set', pct);
      };
    }

    // 先移除文字标签，隐藏原开关
    document.querySelectorAll('.switch-bar .switch-label').forEach(el=>el.remove());
    document.querySelectorAll('.switch-bar .switch').forEach(el=>el.style.display='none');

    // 暗黑模式按钮（月亮 / 太阳）
    const updateDarkIcon=()=> darkBtn.textContent = document.body.classList.contains('dark') ? '🌙' : '🌕';
    const darkBtn = addIconButton('', '暗黑模式', ()=>{
      darkToggleEl.checked = !darkToggleEl.checked;
      darkToggleEl.dispatchEvent(new Event('change'));
      updateDarkIcon();
    });
    updateDarkIcon();

    /* -------- 主区域宽度调节 -------- */
    const MAIN_WIDTH_KEY = 'mainWidth';
    if(switchBar){
      const stored = parseInt(localStorage.getItem(MAIN_WIDTH_KEY) || '1200', 10);
      document.documentElement.style.setProperty('--main-max-width', stored + 'px');
    }
    /* -------- 全局字体缩放 -------- */
    const FONT_SCALE_KEY = 'siteZoom';
    {
      const storedScale = parseInt(localStorage.getItem(FONT_SCALE_KEY) || '100', 10);
      document.documentElement.style.setProperty('--site-zoom', storedScale + '%');
    }
  }

  // 立即尝试初始化
  initToggles();

  // 若 DOM 尚未准备好，则再监听一次
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initToggles);
  }

//-------------------------------------------------------
// 新增：统一数据同步函数，支持自动保存
function syncToServer(force = false) {
  // 启用自动保存时，忽略外部 force 参数
  if(autoSaveEnabled) force = true;

  if(!force){
    pendingChanges = true;
    logDebug('Change recorded, waiting for manual save');
    return;
  }
  pendingChanges = false;
  const payload = { categories, channels, tags, assets: assetsCache, hiddenColumns, columnOrder, columns: allColumns };
  logInfo('syncToServer', {autoSaveEnabled, size: JSON.stringify(payload).length});
  fetch('/api/data', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  })
  .then(()=> logDebug('Data saved OK'))
  .catch(err=> console.error('Save failed', err));
}

//-------------------------------------------------------
  // 保存按钮事件：真正同步到服务器
  const saveBtn = document.getElementById('saveDataBtn');
  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      syncToServer(true);
      alert('数据已保存！');
    });
  }

  // 字体缩放由 common.js 统一处理，无需本地 zoom 设置

  function openDeleteModal(list, onDelete){
    if(list.length===0){ alert('没有可删除项'); return; }
    const overlay=document.createElement('div'); overlay.className='overlay';
    const modal=document.createElement('div'); modal.className='modal';
    const title=document.createElement('h3'); title.textContent='请选择要删除的项'; modal.appendChild(title);
    const select=document.createElement('select'); select.style.width='100%';
    list.forEach(item=>{ const opt=document.createElement('option'); opt.value=item; opt.textContent=item; select.appendChild(opt); });
    const okBtn=document.createElement('button'); okBtn.textContent='删除'; okBtn.className='btn-like btn-danger';
    const cancelBtn=document.createElement('button'); cancelBtn.textContent='取消'; cancelBtn.className='btn-like'; cancelBtn.style.marginTop='6px';
    okBtn.onclick=()=>{ onDelete(select.value); document.body.removeChild(overlay); };
    cancelBtn.onclick=()=>{ document.body.removeChild(overlay); };
    modal.appendChild(select);
    modal.appendChild(okBtn); modal.appendChild(cancelBtn);
    overlay.appendChild(modal); document.body.appendChild(overlay);
  }

  addColumnBtn.addEventListener('click', ()=>{
    const overlay=document.createElement('div'); overlay.className='overlay';
    const modal=document.createElement('div'); modal.className='modal';
    const title=document.createElement('h3'); title.textContent='新增列'; modal.appendChild(title);
    const nameInput=document.createElement('input'); nameInput.placeholder='列名称'; nameInput.style.width='100%';
    const typeSelect=document.createElement('select'); typeSelect.style.width='100%';
    const typeOptions=[
      {v:'text',l:'文本'},
      {v:'number',l:'数字'},
      {v:'date',l:'日期'},
      {v:'boolean',l:'布尔'},
      {v:'image',l:'附件'}
    ];
    typeOptions.forEach(o=>{ const opt=document.createElement('option'); opt.value=o.v; opt.textContent=o.l; typeSelect.appendChild(opt); });
    const actions=document.createElement('div'); actions.className='actions';
    const btnOk=document.createElement('button'); btnOk.textContent='添加'; btnOk.className='btn-like btn-success';
    const btnCancel=document.createElement('button'); btnCancel.textContent='取消'; btnCancel.className='btn-like btn-small btn-danger';
    btnOk.onclick=()=>{
      const label=nameInput.value.trim(); if(!label){ alert('列名称不能为空'); return; }
      const key='col_'+Date.now(); const type=typeSelect.value;
      allColumns.push({key,label,type}); columnOrder.push(key);
      document.body.removeChild(overlay);
      syncToServer(); renderColumnToggles();
    };
    btnCancel.onclick=()=>{ document.body.removeChild(overlay); };
    modal.appendChild(nameInput); modal.appendChild(typeSelect);
    actions.appendChild(btnOk); actions.appendChild(btnCancel);
    modal.appendChild(actions);
    overlay.appendChild(modal); document.body.appendChild(overlay);
  });

  deleteColumnBtn.addEventListener('click', ()=>{
    if(allColumns.length===0){alert('无可删除列'); return;}
    const overlay = document.createElement('div');
    overlay.className='overlay';
    const modal = document.createElement('div');
    modal.className='modal';
    const title=document.createElement('h3'); title.textContent='删除项'; modal.appendChild(title);
    const select = document.createElement('select');
    select.style.width='100%';
    allColumns.forEach(c=>{
      const opt=document.createElement('option'); opt.value=c.key; opt.textContent=c.label; select.appendChild(opt);
    });
    const actionsDel=document.createElement('div'); actionsDel.className='actions';
    const okBtn=document.createElement('button'); okBtn.textContent='删除'; okBtn.className='btn-like btn-danger';
    const cancelBtn=document.createElement('button'); cancelBtn.textContent='取消'; cancelBtn.className='btn-like'; cancelBtn.style.marginTop='6px';
    okBtn.onclick = ()=>{
      const key = select.value;
      const col = allColumns.find(c=>c.key===key);
      if(!col) return;
      columnOrder = columnOrder.filter(k=>k!==key);
      hiddenColumns = hiddenColumns.filter(k=>k!==key);
      allColumns = allColumns.filter(c=>c.key!==key);
      document.body.removeChild(overlay);
      syncToServer();
      renderColumnToggles();
    };
    cancelBtn.onclick = ()=>{ document.body.removeChild(overlay); };
    actionsDel.appendChild(okBtn); actionsDel.appendChild(cancelBtn);
    modal.appendChild(select);
    modal.appendChild(actionsDel);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });

  function renderList() {
    listEl.innerHTML = '';
    categories.forEach((cat, idx) => {
      const li = document.createElement('li');
      li.textContent = cat; li.dataset.index = idx;
      listEl.appendChild(li);
      attachDrag(li, categories, renderList);
    });
  }

  function renderChannelList() {
    channelListEl.innerHTML = '';
    channels.forEach((ch, idx) => {
      const li = document.createElement('li');
      li.textContent = ch; li.dataset.index = idx;
      channelListEl.appendChild(li);
      attachDrag(li, channels, renderChannelList);
    });
  }

  function renderTagList() {
    tagListEl.innerHTML = '';
    tags.forEach((t, idx) => {
      const li = document.createElement('li');
      li.textContent = t; li.dataset.index = idx;
      tagListEl.appendChild(li);
      attachDrag(li, tags, renderTagList);
    });
  }

  addBtn.addEventListener('click', () => {
    openAddModal('新增分类', '分类名称', (val)=>{
      if(categories.includes(val)){ alert('该分类已存在'); return; }
      categories.push(val); syncToServer(); renderList(); });
  });

  addChannelBtn.addEventListener('click', () => {
    openAddModal('新增渠道', '渠道名称', (val)=>{
      if(channels.includes(val)){ alert('该渠道已存在'); return; }
      channels.push(val); syncToServer(); renderChannelList(); });
  });

  addTagBtn.addEventListener('click', () => {
    openAddModal('新增标签', '标签名称', (val)=>{
      if(tags.includes(val)){ alert('该标签已存在'); return; }
      tags.push(val); syncToServer(); renderTagList(); });
  });

  // 导出
  exportBtn.addEventListener('click', () => {
    const data = {
      categories,
      channels,
      tags,
      assets: assetsCache,
      hiddenColumns,
      columnOrder,
      columns: allColumns
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assets_data.json';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  });

  // 导入
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (obj.categories && Array.isArray(obj.categories)) {
          categories = obj.categories;
        }
        if (obj.channels && Array.isArray(obj.channels)) {
          channels = obj.channels;
        }
        if (obj.tags && Array.isArray(obj.tags)) {
          tags = obj.tags;
        }
        if (obj.assets && Array.isArray(obj.assets)) {
          assetsCache = obj.assets;
        }
        if (obj.hiddenColumns && Array.isArray(obj.hiddenColumns)) {
          hiddenColumns = obj.hiddenColumns;
        }
        if (obj.columnOrder && Array.isArray(obj.columnOrder)) {
          columnOrder = obj.columnOrder;
        }
        if (obj.columns && Array.isArray(obj.columns)) {
          allColumns = obj.columns;
        }
        syncToServer(true);
        renderList();
        renderChannelList();
        renderTagList();
        renderColumnToggles();
        alert('导入成功！刷新相关页面查看效果');
      } catch (err) {
        alert('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file, 'utf-8');
  });

  // 查看数据
  viewDataBtn.addEventListener('click', ()=>{
    fetch('/api/data').then(r=>r.json()).then(d=>{
      const overlay=document.createElement('div'); overlay.className='overlay';
      const modal=document.createElement('div'); modal.className='modal'; modal.style.maxWidth='90%'; modal.style.width='600px';
      const pre=document.createElement('pre'); pre.style.maxHeight='70vh'; pre.style.overflow='auto'; pre.textContent=JSON.stringify(d,null,2);
      const btn=document.createElement('button'); btn.textContent='关闭'; btn.className='btn-like btn-small btn-danger'; btn.onclick=()=>document.body.removeChild(overlay);
      modal.appendChild(pre); modal.appendChild(btn); overlay.appendChild(modal); document.body.appendChild(overlay);
    });
  });

  // 重置数据
  resetDataBtn.addEventListener('click', ()=>{
    if(!confirm('确定要重置所有数据吗？此操作不可撤销')) return;
    fetch('/api/reset', {method:'POST'}).then(r=>r.json()).then(()=>{ alert('数据已重置'); location.reload(); });
  });

  // 修改数据
  editDataBtn.addEventListener('click', () => {
    fetch('/api/data')
      .then(res => res.json())
      .then(json => {
        const overlay = document.createElement('div');
        overlay.className = 'overlay';

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.width = '80vw';
        modal.style.maxWidth = '90vw';
        modal.style.height = '85vh';

        modal.innerHTML = `
          <h3>修改数据 (JSON)</h3>
          <textarea id="editJsonArea" style="flex:1; width:100%; height:100%;">${JSON.stringify(json, null, 2)}</textarea>
          <div class="actions">
            <button id="saveEditBtn" class="btn-like btn-success">保存</button>
            <button id="cancelEditBtn" class="btn-like btn-danger">取消</button>
          </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const saveBtn = modal.querySelector('#saveEditBtn');
        const cancelBtn = modal.querySelector('#cancelEditBtn');

        cancelBtn.addEventListener('click', () => document.body.removeChild(overlay));

        saveBtn.addEventListener('click', () => {
          const text = modal.querySelector('#editJsonArea').value;
          let data;
          try { data = JSON.parse(text); }
          catch (e) { alert('JSON 格式错误！'); return; }

          fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).then(res => res.json())
            .then(r => {
              if (r.success) {
                alert('数据已保存，重启服务后生效');
                document.body.removeChild(overlay);
              } else alert('保存失败！');
            });
        });
      });
  });

  // 列管理 UI
  function renderColumnToggles() {
    columnToggleBox.innerHTML = '';
    columnOrder.forEach((key, idx) => {
      const col = allColumns.find(c=>c.key===key);
      if(!col) return;

      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.marginBottom = '6px';

      const upBtn = document.createElement('button');
      upBtn.textContent = '↑';
      upBtn.style.display = 'inline-block';
      upBtn.style.visibility = idx===0 ? 'hidden' : 'visible';
      upBtn.style.width = '24px';
      upBtn.style.height = '24px';
      upBtn.style.display = 'inline-flex';
      upBtn.style.justifyContent = 'center';
      upBtn.style.alignItems = 'center';
      upBtn.style.marginRight = '4px';
      upBtn.addEventListener('click', ()=>{
        if(idx===0) return;
        [columnOrder[idx-1], columnOrder[idx]] = [columnOrder[idx], columnOrder[idx-1]];
        syncToServer();
        renderColumnToggles();
      });

      const downBtn = document.createElement('button');
      downBtn.textContent = '↓';
      downBtn.style.display = 'inline-block';
      downBtn.style.visibility = idx===columnOrder.length-1 ? 'hidden' : 'visible';
      downBtn.style.width = '24px';
      downBtn.style.height = '24px';
      downBtn.style.display = 'inline-flex';
      downBtn.style.justifyContent = 'center';
      downBtn.style.alignItems = 'center';
      downBtn.style.marginRight = '4px';
      downBtn.addEventListener('click', ()=>{
        if(idx===columnOrder.length-1) return;
        [columnOrder[idx+1], columnOrder[idx]] = [columnOrder[idx], columnOrder[idx+1]];
        syncToServer();
        renderColumnToggles();
      });

      const label = document.createElement('label');
      label.style.display = 'inline-flex';
      label.style.alignItems = 'center';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = col.key;
      cb.checked = !hiddenColumns.includes(col.key);
      cb.style.display = 'inline-block';
      cb.addEventListener('change', ()=>{
        if(cb.checked){
          hiddenColumns = hiddenColumns.filter(k=>k!==col.key);
        }else{
          if(!hiddenColumns.includes(col.key)) hiddenColumns.push(col.key);
        }
        syncToServer();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' '+col.label));

      wrapper.appendChild(upBtn);
      wrapper.appendChild(downBtn);
      wrapper.appendChild(label);

      // 宽度输入框
      const widthInp=document.createElement('input');
      widthInp.type='number';
      widthInp.placeholder='宽(px)';
      widthInp.value = col.width || '';
      widthInp.className='column-width-input';
      widthInp.style.marginLeft='auto';
      widthInp.addEventListener('change',()=>{
        const v=parseInt(widthInp.value,10);
        if(Number.isNaN(v)) delete col.width;
        else col.width = v;
        syncToServer();
      });
      wrapper.appendChild(widthInp);

      columnToggleBox.appendChild(wrapper);
    });
  }

  function openDeleteModal(list, onDelete){
    if(list.length===0){ alert('没有可删除项'); return; }
    const overlay=document.createElement('div'); overlay.className='overlay';
    const modal=document.createElement('div'); modal.className='modal';
    const title=document.createElement('h3'); title.textContent='请选择要删除的项'; modal.appendChild(title);
    const select=document.createElement('select'); select.style.width='100%';
    list.forEach(item=>{ const opt=document.createElement('option'); opt.value=item; opt.textContent=item; select.appendChild(opt); });
    const okBtn=document.createElement('button'); okBtn.textContent='删除'; okBtn.className='btn-like btn-danger';
    const cancelBtn=document.createElement('button'); cancelBtn.textContent='取消'; cancelBtn.className='btn-like'; cancelBtn.style.marginTop='6px';
    okBtn.onclick=()=>{ onDelete(select.value); document.body.removeChild(overlay); };
    cancelBtn.onclick=()=>{ document.body.removeChild(overlay); };
    modal.appendChild(select);
    modal.appendChild(okBtn); modal.appendChild(cancelBtn);
    overlay.appendChild(modal); document.body.appendChild(overlay);
  }

  deleteCategoryBtn.addEventListener('click', ()=>{
    openDeleteModal(categories, (val)=>{
      const idx=categories.indexOf(val);
      if(idx>-1){ categories.splice(idx,1); syncToServer(); renderList(); }
    });
  });

  deleteChannelBtn.addEventListener('click', ()=>{
    openDeleteModal(channels, (val)=>{
      const idx=channels.indexOf(val);
      if(idx>-1){ channels.splice(idx,1); syncToServer(); renderChannelList(); }
    });
  });

  deleteTagBtn.addEventListener('click', ()=>{
    openDeleteModal(tags, (val)=>{
      const idx=tags.indexOf(val);
      if(idx>-1){ tags.splice(idx,1); syncToServer(); renderTagList(); }
    });
  });

  // 通用新增模态
  function openAddModal(title, placeholder, onAdd){
    const overlay=document.createElement('div'); overlay.className='overlay';
    const modal=document.createElement('div'); modal.className='modal';
    const h3=document.createElement('h3'); h3.textContent=title; modal.appendChild(h3);
    const input=document.createElement('input'); input.placeholder=placeholder; input.style.width='100%'; modal.appendChild(input);
    const actions=document.createElement('div'); actions.className='actions';
    const okBtn=document.createElement('button'); okBtn.textContent='添加'; okBtn.className='btn-like btn-success';
    const cancelBtn=document.createElement('button'); cancelBtn.textContent='取消'; cancelBtn.className='btn-like btn-danger';
    okBtn.onclick=()=>{ const val=input.value.trim(); if(!val){ alert('内容不能为空'); return;} onAdd(val); document.body.removeChild(overlay);} ;
    cancelBtn.onclick=()=>document.body.removeChild(overlay);
    actions.appendChild(okBtn); actions.appendChild(cancelBtn); modal.appendChild(actions);
    overlay.appendChild(modal); document.body.appendChild(overlay);
  }

  // 长按移动元素至上一个位置
  function attachLongPress(li, list, renderFn){
    let timer=null;
    li.addEventListener('mousedown', ()=>{ timer=setTimeout(()=>{ moveUp(); timer=null;},600);});
    ['mouseup','mouseleave'].forEach(evt=> li.addEventListener(evt, ()=>{ if(timer){ clearTimeout(timer); timer=null;} }));
    function moveUp(){
      const idx=list.indexOf(li.textContent);
      if(idx>0){ [list[idx-1], list[idx]]=[list[idx], list[idx-1]]; renderFn(); syncToServer(); }
    }
  }

  // 拖拽排序
  function attachDrag(li, arr, renderFn){
    li.draggable = true;
    li.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('text/plain', li.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragover', e=>{ e.preventDefault(); });
    li.addEventListener('drop', e=>{
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/plain'),10);
      const to = parseInt(li.dataset.index,10);
      if(isNaN(from) || isNaN(to) || from===to) return;
      const item = arr.splice(from,1)[0];
      arr.splice(to,0,item);
      renderFn();
      syncToServer();
    });
  }

  // 初次渲染
  renderList();
  renderChannelList();
  renderTagList();
  renderColumnToggles();
})(); 