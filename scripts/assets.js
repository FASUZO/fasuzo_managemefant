import { logInfo, logDebug } from './debug.js';

(async function () {
  // 读取运行时配置
  let envCfg = {};
  try {
    const r = await fetch('/api/env');
    if(r.ok) envCfg = await r.json();
  } catch(e) { console.warn('无法获取 /api/env', e); }

  // 应用默认主题 / 自动保存 / 调试开关
  if(localStorage.getItem('autoSave') === null && typeof envCfg.defaultAutoSave === 'boolean'){
    localStorage.setItem('autoSave', envCfg.defaultAutoSave);
  }
  if(localStorage.getItem('theme') === null && typeof envCfg.defaultDark === 'boolean'){
    localStorage.setItem('theme', envCfg.defaultDark ? 'dark' : 'light');
  }
  if(envCfg.debug){ window.debug = true; }
  if(envCfg.fontUrl){ const link=document.createElement('link'); link.rel='stylesheet'; link.href=envCfg.fontUrl; document.head.appendChild(link); }

  // 拉取服务器数据
  const resp = await fetch('/api/data');
  const serverData = await resp.json();
  logDebug('加载 serverData', serverData);

  // 检测自动保存偏好
  const autoSaveEnabled = localStorage.getItem('autoSave') === 'true';
  logInfo('AutoSave status (assets page):', autoSaveEnabled);

  let autoSaveTimer = null;
  // 列宽正在调整标志
  window.__colResizing = false;
  function triggerAutoSave(){
    if(!autoSaveEnabled) return;
    if(autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(()=>{
      logDebug('AutoSave - debounced save');
      saveTableToServer(false);
    }, 800); // 800ms 无操作后保存
  }

  // 新增：金额统一保留两位小数的工具函数
  function formatTwoDecimal(val){
    if(val===undefined || val===null) return '';
    if(typeof val !== 'string') val = String(val);
    val = val.trim();
    if(val==='') return '';
    // 支持诸如 "12.5/年"、"99/月" 的格式
    const slashIdx = val.indexOf('/');
    const numPart = slashIdx>=0 ? val.slice(0, slashIdx).trim() : val;
    const unitPart = slashIdx>=0 ? val.slice(slashIdx) : '';
    const num = Number(numPart);
    if(Number.isNaN(num)) return val; // 若无法解析数字，保持原样
    return num.toFixed(2) + unitPart;
  }

  const DEFAULT_CATEGORIES = ['股票', '基金', '债券', '不动产', '现金', '其他'];
  const DEFAULT_CHANNELS = ['证券账户', '银行', '支付宝', '微信', '其他'];

  const categories = serverData.categories || DEFAULT_CATEGORIES;
  const channels = serverData.channels || DEFAULT_CHANNELS;
  const tags = serverData.tags || [];

  const columnsMeta = Array.isArray(serverData.columns) && serverData.columns.length ? serverData.columns : [
    { key:'name', label:'名称' },
    { key:'category', label:'分类' },
    { key:'subcategory', label:'标签' },
    { key:'amount', label:'金额' },
    { key:'date', label:'时间' },
    { key:'channel', label:'购入渠道' },
    { key:'image', label:'附件' },
    { key:'note', label:'备注' }
  ];
  const labelMap = { name:'名称', category:'分类', subcategory:'标签' };
  columnsMeta.forEach(c=>{ if(labelMap[c.key]) c.label = labelMap[c.key]; });
  const columnOrder = Array.isArray(serverData.columnOrder) && serverData.columnOrder.length ? serverData.columnOrder : columnsMeta.map(c=>c.key);

  const storedData = serverData.assets || [];

  // After storedData declaration, build id set and generator
  const existingIds = new Set(storedData.map(a=>a.originId).filter(Boolean));
  function generateUniqueId(){
    let id;
    do{ id = 'ID_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6); }
    while(existingIds.has(id));
    existingIds.add(id); return id;
  }

  // 打开标签选择弹窗
  function openTagPicker(current, onSelect){
    const overlay=document.createElement('div'); overlay.className='overlay';
    const modal=document.createElement('div'); modal.className='modal'; modal.style.width='300px';
    modal.innerHTML = '<h3>选择标签</h3>';
    const body=document.createElement('div'); body.className='modal-body'; body.style.display='flex'; body.style.flexWrap='wrap'; body.style.gap='6px'; modal.appendChild(body);
    const addChip=(label,val)=>{ const c=document.createElement('span'); c.className='chip'; c.textContent=label; if(val===current) c.style.background='rgba(25,118,210,0.25)';
      c.addEventListener('click',()=>{ onSelect(val); document.body.removeChild(overlay);} ); body.appendChild(c);} ;
    addChip('(无)','');
    tags.forEach(t=> addChip(t,t));
    const cancel=document.createElement('button'); cancel.textContent='取消'; cancel.className='btn-like btn-small btn-danger'; cancel.style.marginTop='10px'; cancel.style.alignSelf='center'; cancel.onclick=()=>document.body.removeChild(overlay);
    modal.appendChild(cancel);
    overlay.appendChild(modal); document.body.appendChild(overlay);
  }

  const addRowBtn = document.getElementById('addRowBtn');
  const tableBody = document.querySelector('#assetsTable tbody');

  const columnLabels = {}; columnsMeta.forEach(c=>{ columnLabels[c.key]=c.label; });

  // 重新构建表头（在列标签确定之后）
  const headerTr = document.querySelector('#assetsTable thead tr');
  const assetsTable = document.getElementById('assetsTable');
  headerTr.innerHTML = '';
  columnOrder.forEach(key=>{
    const th=document.createElement('th');
    th.textContent = columnLabels[key] || key;
    if(key==='note') th.classList.add('note-col');
    if(key==='date') th.classList.add('date-col');
    if(key==='subcategory') th.classList.add('tag-col');
    // 应用初始宽度
    const colDef = columnsMeta.find(c=>c.key===key) || {};
    if(colDef.width){ th.style.width = colDef.width + 'px'; }
    // 拖拽调整列宽
    const handle=document.createElement('span'); handle.className='col-resize-handle'; th.appendChild(handle);
    handle.addEventListener('mousedown', e=>{
      e.preventDefault(); e.stopPropagation();
      const startX = e.clientX;
      const startW = th.offsetWidth;
      let moved=false;
      function onMove(ev){
        const diff = ev.clientX - startX;
        const newW = Math.max(60, startW + diff);
        colDef.width = newW;
        // 立即更新当前列的宽度，使拖拽效果实时可见
        th.style.width = newW + 'px';
        applyColumnWidths();
        if(Math.abs(diff)>2){ moved=true; window.__colResizing=true; }
      }
      function onUp(){
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        triggerAutoSave();
        if(moved){
          window.__colResizing=true;
          setTimeout(()=>{ window.__colResizing=false; },150);
        }
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    headerTr.appendChild(th);
  });
  // 新增"操作"列
  const actionTh = document.createElement('th');
  actionTh.textContent = '操作';
  actionTh.classList.add('action-cell');
  headerTr.appendChild(actionTh);

  // 用于索引映射
  let idxMap = {};
  function updateIdxMap(){ idxMap = {}; columnOrder.forEach((k,i)=> idxMap[k]=i); }
  updateIdxMap();

  // 渲染已有数据
  if (storedData.length) {
    storedData.forEach(data => createRow(data));
  } else {
    createRow();
  }

  // 初次应用列宽
  applyColumnWidths();

  // 创建行，可传入数据进行填充
  function createRow(prefill = {}) {
    logDebug('createRow 调用', prefill);
    const tr = document.createElement('tr');
    // 将完整对象保存在行上，供后续编辑使用
    if(!prefill.originId){ prefill.originId = generateUniqueId(); }
    tr.dataset.extra = JSON.stringify(prefill || {});

    // 资产分类 下拉提前生成，其他同理
    const selectTd_category = document.createElement('td');
    const select_category = document.createElement('select');
    categories.forEach(c => {
      const option = document.createElement('option');
      option.value = c;
      option.textContent = c;
      if (prefill.category === c) option.selected = true;
      select_category.appendChild(option);
    });
    attachSaveListener(select_category, 'category');
    selectTd_category.appendChild(select_category);

    // 购入渠道 下拉
    const channelTd = document.createElement('td');
    const channelSelect = document.createElement('select');
    channels.forEach(ch => {
      const option = document.createElement('option');
      option.value = ch;
      option.textContent = ch;
      if (prefill.channel === ch) option.selected = true;
      channelSelect.appendChild(option);
    });
    attachSaveListener(channelSelect);
    channelTd.appendChild(channelSelect);

    // 附件单元格构造函数生成
    const buildImageCell = () => {
      const imgTd = document.createElement('td');
      const img = document.createElement('img');
      img.style.maxHeight = '40px';
      img.style.cursor = 'pointer';
      img.style.display = prefill.image ? 'block' : 'none';
      if (prefill.image) img.src = prefill.image;

      const placeholder = document.createElement('span');
      placeholder.textContent = '无';
      placeholder.style.cursor = 'pointer';
      placeholder.style.display = prefill.image ? 'none' : 'inline';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      const openPicker = () => fileInput.click();
      placeholder.addEventListener('click', openPicker);

      let pressTimer = null;
      const viewImage = () => {
        console.log('View image, size(base64 chars):', img.src.length);
        const win = window.open('about:blank');
        if(win){
          win.document.write('<title>附件预览</title>');
          win.document.write('<img src="'+img.src+'" style="max-width:100%;height:auto;display:block;margin:0 auto;">');
        }
      };

      img.addEventListener('mousedown', ()=>{
        pressTimer = setTimeout(()=>{ openPicker(); pressTimer=null; },600);
      });
      img.addEventListener('mouseup', ()=>{
        if(pressTimer){ clearTimeout(pressTimer); viewImage(); }
      });
      img.addEventListener('mouseleave', ()=>{ if(pressTimer) clearTimeout(pressTimer); });
      img.addEventListener('touchstart', ()=>{ pressTimer=setTimeout(()=>{ openPicker(); pressTimer=null; },600); });
      img.addEventListener('touchend', ()=>{ if(pressTimer){ clearTimeout(pressTimer); viewImage(); } });

      fileInput.addEventListener('change', ()=>{
        if(fileInput.files[0]){
          const reader = new FileReader();
          reader.onload = e=>{
            img.src = e.target.result;
            img.style.display='block';
            placeholder.style.display='none';
            console.log('Uploaded image base64 length:', img.src.length);
            // 更新表格数据并立即保存
            const row = img.closest('tr');
            if(row){ updateAssetFromRow(row); triggerAutoSave(); }
          };
          reader.readAsDataURL(fileInput.files[0]);
        }
      });

      imgTd.appendChild(placeholder);
      imgTd.appendChild(img);
      imgTd.appendChild(fileInput);
      return imgTd;
    };

    // 日期单元格：显示 YYMMDD，编辑时使用隐藏的 date 输入
    const buildDateCell = (initialVal) => {
      const td = document.createElement('td'); td.classList.add('date-cell');
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.value = initialVal || new Date().toISOString().split('T')[0];
      dateInput.style.display = 'none';
      attachSaveListener(dateInput);

      const span = document.createElement('span');
      span.style.cursor = 'pointer';

      const fmt = (str) => {
        if(!str || !/\d{4}-\d{2}-\d{2}/.test(str)) return '';
        const [y,m,d] = str.split('-');
        return y.slice(-2) + m + d;
      };
      span.textContent = fmt(dateInput.value);

      // 点击标签进入编辑
      span.addEventListener('click', ()=>{
        span.style.display = 'none';
        dateInput.style.display = 'inline-block';
        dateInput.focus();
      });

      // 离开输入框或修改值后，更新显示
      const updateAndHide = () => {
        span.textContent = fmt(dateInput.value);
        dateInput.style.display = 'none';
        span.style.display = 'inline';
      };
      dateInput.addEventListener('blur', updateAndHide);
      dateInput.addEventListener('change', updateAndHide);

      td.appendChild(dateInput);
      td.appendChild(span);
      return td;
    };

    const specialFactories = {
      category: () => selectTd_category,
      channel: () => channelTd,
      image: () => buildImageCell(),
      date: () => buildDateCell(prefill.date),
      subcategory: () => {
        const td=document.createElement('td');
        td.classList.add('tag-cell');
        // 支持数组，如果旧数据是字符串则转换
        let tagArr = Array.isArray(prefill.subcategory)? [...prefill.subcategory]
          : (typeof prefill.subcategory === 'string' && prefill.subcategory.trim()) ? prefill.subcategory.split(',').map(s=>s.trim()).filter(Boolean) : [];
        td.dataset.tags = JSON.stringify(tagArr);

        const render = ()=>{
          td.innerHTML='';
          tagArr.forEach(t=>{
            const chip=document.createElement('span'); chip.className='chip'; chip.textContent=t;
            let timer=null;
            chip.addEventListener('mousedown',()=>{ timer=setTimeout(()=>{ removeTag(t); timer=null; },600);});
            chip.addEventListener('mouseup',()=>{ if(timer){ clearTimeout(timer); timer=null; openPicker(); } });
            chip.addEventListener('mouseleave',()=>{ if(timer){ clearTimeout(timer); timer=null;} });
            td.appendChild(chip);
          });
          // 仅在没有标签时显示"＋"
          if(tagArr.length===0){
            const plus=document.createElement('span'); plus.className='chip plus'; plus.textContent='＋'; plus.addEventListener('click',openPicker);
            td.appendChild(plus);
          }
        };

        function openPicker(){
          openTagPicker('', (val)=>{ if(!val) return; if(tagArr.includes(val)){ alert('已存在该标签'); return;} tagArr.push(val); update(); logInfo('add tag', val); logDebug('current tags', tagArr); });
        }

        function removeTag(target){ tagArr = tagArr.filter(x=>x!==target); update(); logInfo('remove tag', target); }

        function update(){ td.dataset.tags = JSON.stringify(tagArr); render();
          const row=td.closest('tr'); if(row){ updateAssetFromRow(row); triggerAutoSave();} }

        render();
        return td;
      }
    };

    const getCellByKey = (key)=>{
       if(specialFactories[key]) return specialFactories[key]();
       const colDef = columnsMeta.find(c=>c.key===key) || {type:'text'};
       const type = colDef.type || 'text';
       const td=document.createElement('td');
       if(key==='note') td.classList.add('note-cell');
       switch(type){
         case 'text':
           addInputCellDesp(td,'text',prefill[key]||''); break;
         case 'number':
           addInputCellDesp(td,'number',prefill[key]||''); break;
         case 'date':
           return buildDateCell(prefill[key]);
         case 'boolean': {
           const cb=document.createElement('input'); cb.type='checkbox'; cb.checked= !!prefill[key]; td.appendChild(cb); attachSaveListener(cb); break; }
         case 'image':
           return buildImageCell();
         default:
           addInputCellDesp(td,'text',prefill[key]||'');
       }
       return td;
    };

    columnOrder.forEach(key=>{ const cell=getCellByKey(key); if(cell) tr.appendChild(cell); });

    // 应用列宽到新行
    applyColumnWidths();

    // 操作列
    const actionTd = document.createElement('td');
    actionTd.className = 'action-cell';
    const editBtn = document.createElement('button'); editBtn.textContent='编辑'; editBtn.className='btn-like btn-small';
    const viewBtn = document.createElement('button'); viewBtn.textContent='查看'; viewBtn.className='btn-like btn-small'; viewBtn.style.marginLeft='6px';
    actionTd.appendChild(editBtn); actionTd.appendChild(viewBtn);
    tr.appendChild(actionTd);

    editBtn.addEventListener('click', ()=> openAssetModal(tr,false));
    viewBtn.addEventListener('click', ()=> openAssetModal(tr,true));

    // 将生成的行插入到 tbody
    tableBody.appendChild(tr);

    function addInputCellDesp(td,type,val=''){
      const input=document.createElement('input');
      input.type=type;
      if(type==='number') input.step='0.01';
      if(type==='date' && !val) val = new Date().toISOString().split('T')[0];
      // 新增：数字类型默认格式化两位小数
      if(type==='number' && val!=='') val = formatTwoDecimal(val);
      if(val!==undefined) input.value=val;
      // 失焦时统一格式化（包括带单位）
      input.addEventListener('blur',()=>{ if(input.value!==undefined) input.value = formatTwoDecimal(input.value); });
      attachSaveListener(input);
      td.appendChild(input);
    }

    logDebug('行已添加', tr);
  }

  function attachSaveListener(el, key) {
    // 当表格单元发生变化时，同步到行 dataset.extra，实现双向数据更新
    ['change','input'].forEach(evt=>{
      el.addEventListener(evt, ()=>{
        const row = el.closest('tr');
        if(!row) return;
        updateAssetFromRow(row, {} /* no asset provided, will pull current */);
        triggerAutoSave();
      });
    });
  }

  function getTableData() {
    return Array.from(tableBody.querySelectorAll('tr'))
      .map(row => {
        const cells = row.cells;
        const getVal = (key) => {
          const idx = idxMap[key];
          if(idx === undefined) return '';
          const cell = cells[idx];
          if(!cell) return '';
          switch(key){
            case 'category':
            case 'channel':
              return cell.querySelector('select').value;
            case 'image':
              return (cell.querySelector('img')) ? (cell.querySelector('img').style.display!=='none'? cell.querySelector('img').src : '') : '';
            case 'boolean':
              return cell.querySelector('input').checked;
            case 'subcategory':
              return cell.dataset.tags ? JSON.parse(cell.dataset.tags) : [];
            default: {
              const inp = cell.querySelector('input');
              if(inp){
                const raw = inp.value.trim();
                return inp.type==='number' ? formatTwoDecimal(raw) : raw;
              }
              const sel = cell.querySelector('select');
              if(sel) return sel.value;
              return cell.textContent.trim();
            }
          }
        };
        const rowObj = {};
        columnOrder.forEach(k=>{ rowObj[k]=getVal(k); });
        // 合并保存在行上的完整对象，确保额外字段不会丢失
        let extra = {};
        try{ extra = JSON.parse(row.dataset.extra||'{}'); }catch(e){}
        return { ...extra, ...rowObj };
      })
      .filter(item => item.name);
  }

  // 列排序
  headerTr.querySelectorAll('th').forEach((th, index)=>{
    let asc=true;
    th.addEventListener('click', ()=>{
      if(window.__colResizing) return;
      const rows=Array.from(tableBody.querySelectorAll('tr'));
      rows.sort((a,b)=>{
        const aVal=getCellValue(a,index);
        const bVal=getCellValue(b,index);
        const cmp=isNaN(aVal) || isNaN(bVal) ? aVal.localeCompare(bVal) : Number(aVal)-Number(bVal);
        return asc?cmp:-cmp;
      });
      tableBody.innerHTML=''; rows.forEach(r=>tableBody.appendChild(r)); asc=!asc;
    });
  });

  function getCellValue(row, idx) {
    const el = row.cells[idx].querySelector('input, select');
    return el ? el.value : row.cells[idx].textContent;
  }

  addRowBtn.addEventListener('click', () => {
    console.log('点击新增行');
    createRow();
    applyHiddenColumns();
  });

  function saveTableToServer(showAlert=true){
    const payload = {
      categories,
      channels,
      tags,
      assets: getTableData(),
      hiddenColumns: serverData.hiddenColumns || [],
      columnOrder,
      columns: columnsMeta
    };
    logInfo('保存资产，条目:', payload.assets.length, 'payload大小:', JSON.stringify(payload).length);
    fetch('/api/data', {
      method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    })
    .then(r=>r.json()).then(()=>{
       if(showAlert) alert('数据已保存！');
       // 自动保存完成后，同步服务器数据，避免重复上传 base64 图片
       if(!showAlert){
         fetch('/api/data')
          .then(res=>res.json())
          .then(syncServerAssets)
          .catch(console.error);
       }
    })
    .catch(console.error);
  }

  function syncServerAssets(fresh){
     if(!Array.isArray(fresh.assets)) return;
     const map = new Map(fresh.assets.map(a=>[a.originId, a.image]));
     document.querySelectorAll('#assetsTable tbody tr').forEach(tr=>{
        try{
          const extra = JSON.parse(tr.dataset.extra||'{}');
          if(extra.originId && map.has(extra.originId)){
            const url = map.get(extra.originId);
            if(url && !url.startsWith('data:image')){
               extra.image = url;
               tr.dataset.extra = JSON.stringify(extra);
               // 更新单元格展示
               const imgEl = tr.querySelector('td img');
               const ph = tr.querySelector('td span');
               if(imgEl){ imgEl.src = url; imgEl.style.display='block'; if(ph) ph.style.display='none'; }
            }
          }
        }catch(e){}
     });
  }

  const saveBtn = document.getElementById('saveDataBtn');
  saveBtn.addEventListener('click', ()=> saveTableToServer(true));

  // 处理隐藏列
  const hiddenColumns = serverData.hiddenColumns || [];
  function applyHiddenColumns() {
    console.log('applyHiddenColumns', hiddenColumns);
    columnOrder.forEach((key, idx) => {
      const hide = hiddenColumns.includes(key);
      const th = document.querySelector(`#assetsTable thead th:nth-child(${idx+1})`);
      if(th) th.classList.toggle('hidden-col', hide);
      document.querySelectorAll(`#assetsTable tbody tr`).forEach(row=>{
        const cell = row.cells[idx];
        if(cell) cell.classList.toggle('hidden-col', hide);
      });
    });
  }

  applyHiddenColumns();

  /* -------------------- 资产编辑模态框 -------------------- */
  function openAssetModal(row, readonly=false){
    let asset = {};
    try{ asset = JSON.parse(row.dataset.extra||'{}'); }catch(e){}

    const overlay=document.createElement('div'); overlay.className='overlay';
    const modal=document.createElement('div'); modal.className='modal'; modal.style.maxHeight='90vh'; modal.style.overflowY='auto';
    const title=document.createElement('h3'); title.textContent = readonly ? '查看资产' : '编辑资产';

    // 内容滚动容器，保持 modal 圆角
    const bodyWrap=document.createElement('div'); bodyWrap.className='modal-body';
    modal.appendChild(title);

    const sections=[
      { title:'编辑详情', fields:[
        {label:'名称', key:'name'},
        {label:'分类', key:'category'},
        {label:'标签', key:'subcategory'},
        {label:'说明', key:'description'},
        {label:'序列号', key:'serialNumber'},
        {label:'型号', key:'model'},
        {label:'制造商', key:'manufacturer'},
        {label:'原始ID', key:'originId'}
      ]},
      { title:'附件', custom: buildAttachmentPart },
      { title:'购买详情', fields:[
        {label:'购买地址', key:'purchaseAddress'},
        {label:'购买价格', key:'purchasePrice', type:'number'},
        {label:'购买日期', key:'purchaseDate', type:'date'}
      ]},
      { title:'保修详情', fields:[
        {label:'保修时间', key:'warrantyPeriod', type:'date'},
        {label:'保修详情', key:'warrantyDetails'}
      ]},
      { title:'售出详情', fields:[
        {label:'售出对象', key:'saleTarget'},
        {label:'售出价格', key:'salePrice', type:'number'},
        {label:'售出日期', key:'saleDate', type:'date'}
      ]}
    ];

    const fieldRefs=[]; // {key,input}

    sections.forEach(sec=>{
      const secWrap=document.createElement('div');
      secWrap.className = 'modal-section';
      const h4=document.createElement('h4'); h4.textContent=sec.title; h4.style.margin='8px 0 4px';
      secWrap.appendChild(h4);
      if(sec.custom){ sec.custom(secWrap); }
      if(sec.fields){
        sec.fields.forEach(f=>{
          const wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.gap='8px'; wrap.style.margin='4px 0';
          const label=document.createElement('label'); label.textContent=f.label; label.style.flex='0 0 100px';
          let input;
          if(f.key==='category'){
            input=document.createElement('select');
            categories.forEach(c=>{ const opt=document.createElement('option'); opt.value=c; opt.textContent=c; if(asset.category===c) opt.selected=true; input.appendChild(opt); });
          }else if(f.key==='subcategory'){
            // 创建自定义 chip UI 作为标签选择
            let tagArr = Array.isArray(asset.subcategory)? [...asset.subcategory]
              : (typeof asset.subcategory==='string' && asset.subcategory.trim()) ? asset.subcategory.split(',').map(s=>s.trim()).filter(Boolean) : [];
            const wrapChipContainer=()=>{
              tagSpanContainer.innerHTML='';
              tagArr.forEach(t=>{ const c=document.createElement('span'); c.className='chip'; c.textContent=t;
                let timer=null;
                c.addEventListener('mousedown',()=>{ timer=setTimeout(()=>{ removeTag(t); timer=null; },600);} );
                c.addEventListener('mouseup',()=>{ if(timer){ clearTimeout(timer); timer=null; openAdd(); } });
                c.addEventListener('mouseleave',()=>{ if(timer){ clearTimeout(timer); timer=null;} });
                tagSpanContainer.appendChild(c);
              });
              // 若无标签，显示"＋"
              if(tagArr.length===0){
                const plus=document.createElement('span'); plus.className='chip plus'; plus.textContent='＋'; plus.addEventListener('click',openAdd);
                tagSpanContainer.appendChild(plus);
              }

              function openAdd(){
                openTagPicker('', val=>{ if(!val|| tagArr.includes(val)) return; tagArr.push(val); wrapChipContainer(); logInfo('add tag (modal)', val);} );
              }
            };

            const tagSpanContainer=document.createElement('div'); tagSpanContainer.style.display='flex'; tagSpanContainer.style.gap='4px';
            // 初始化 dataset
            tagSpanContainer.dataset.tags = JSON.stringify(tagArr);
            const removeTag=(val)=>{ tagArr = tagArr.filter(x=>x!==val); wrapChipContainer(); logInfo('remove tag(modal)', val);} ;
            wrapChipContainer();
            input=tagSpanContainer;
          }else if(f.type==='date'){
            input=document.createElement('input'); input.type='date';
          }else if(f.type==='number'){
            input=document.createElement('input'); input.type='number'; input.step='0.01';
            // 数值初始化为两位小数
            if(asset[f.key]) asset[f.key] = formatTwoDecimal(asset[f.key]);
          }else{
            input=document.createElement('input'); input.type='text';
            if(f.key==='originId'){
              if(!asset.originId){ asset.originId = generateUniqueId(); }
              input.disabled=true;
            }
          }
          input.value = asset[f.key] || '';
          input.style.flex='1';
          if(readonly) input.disabled=true;
          // 失焦时统一格式化
          input.addEventListener('blur',()=>{ if(input.value!==undefined) input.value = formatTwoDecimal(input.value); });
          wrap.appendChild(label); wrap.appendChild(input);
          secWrap.appendChild(wrap);
          fieldRefs.push({key:f.key, input});
        });
      }
      bodyWrap.appendChild(secWrap);
    });

    function buildAttachmentPart(container){
      const img=document.createElement('img'); img.style.maxWidth='100%'; img.style.display= asset.image ? 'block' : 'none'; if(asset.image) img.src=asset.image;
      const placeholder=document.createElement('div'); placeholder.textContent='无附件'; placeholder.style.color='#888'; placeholder.style.display = asset.image ? 'none' : 'block';
      const fileInput=document.createElement('input'); fileInput.type='file'; fileInput.accept='image/*'; fileInput.style.display='none'; if(readonly) fileInput.disabled=true;
      fileInput.addEventListener('change',()=>{
        if(fileInput.files[0]){
          const reader=new FileReader();
          reader.onload=e=>{ asset.image=e.target.result; img.src=asset.image; img.style.display='block'; placeholder.style.display='none'; };
          reader.readAsDataURL(fileInput.files[0]);
        }
      });
      container.appendChild(img); container.appendChild(placeholder);
      if(!readonly){
        const btnWrap=document.createElement('div'); btnWrap.style.marginTop='8px';
        btnWrap.style.display='flex'; btnWrap.style.gap='8px';
        btnWrap.style.alignItems='center';

        const uploadBtn=document.createElement('button'); uploadBtn.textContent='上传附件'; uploadBtn.className='btn-like btn-small';
        uploadBtn.onclick=()=> fileInput.click();

        const delBtn=document.createElement('button'); delBtn.textContent='删除附件'; delBtn.className='btn-like btn-danger btn-small';
        delBtn.onclick=()=>{ asset.image=''; img.style.display='none'; placeholder.style.display='block'; fileInput.value=''; };

        btnWrap.appendChild(uploadBtn);
        btnWrap.appendChild(delBtn);
        container.appendChild(btnWrap);
        container.appendChild(fileInput);
      }
    }

    const actions=document.createElement('div'); actions.className='actions';
    const closeBtn=document.createElement('button'); closeBtn.textContent='关闭'; closeBtn.className='btn-like btn-small';
    closeBtn.onclick=()=> document.body.removeChild(overlay);
    actions.appendChild(closeBtn);
    if(!readonly){
      const saveBtn=document.createElement('button'); saveBtn.textContent='保存'; saveBtn.className='btn-like';
      saveBtn.onclick=()=>{
        // 更新 asset 对象
        fieldRefs.forEach(r=>{
          let val;
          if(r.key==='subcategory'){
            // 对应标签容器
            val = r.input.dataset.tags ? JSON.parse(r.input.dataset.tags) : [];
          }else{
            val = (typeof r.input.value === 'string') ? r.input.value.trim() : r.input.value;
          }
          // 数值字段保存时统一两位小数
          if(r.input.type === 'number'){
            val = formatTwoDecimal(val);
          }
          asset[r.key] = val;
        });
        // 同步到行
        updateRowFromAsset(row, asset);
        row.dataset.extra = JSON.stringify(asset);
        document.body.removeChild(overlay);
        saveTableToServer(false);
      };
      actions.appendChild(saveBtn);
    }
    modal.appendChild(bodyWrap);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // 根据 asset 内容同步更新表格行
  function updateRowFromAsset(row, asset){
    const map={
      name:'name',
      category:'category',
      purchasePrice:'amount',
      purchaseDate:'date',
      purchaseAddress:'channel',
      description:'note',
      image:'image'
    };
    Object.entries(map).forEach(([assetKey,colKey])=>{
      const colIdx = idxMap[colKey];
      if(colIdx===undefined) return;
      const cell = row.cells[colIdx];
      if(!cell) return;
      switch(colKey){
        case 'category':
        case 'channel':
          const sel=cell.querySelector('select'); if(sel) sel.value = asset[assetKey] || '';
          break;
        case 'image':{
          const img=cell.querySelector('img'); const placeholder=cell.querySelector('span');
          if(asset.image){ img.src=asset.image; img.style.display='block'; if(placeholder) placeholder.style.display='none'; }
          else{ if(img) img.style.display='none'; if(placeholder) placeholder.style.display='inline'; }
          break; }
        case 'date':{
          const dateInput=cell.querySelector('input[type="date"]'); const span=cell.querySelector('span');
          if(dateInput){ dateInput.value = asset[assetKey] || ''; if(span){ const v=dateInput.value; const fmt=v? v.slice(2,4)+v.slice(5,7)+v.slice(8,10):''; span.textContent=fmt; } }
          break; }
        case 'subcategory':{
          const newTags = Array.isArray(asset[assetKey])? asset[assetKey] : (asset[assetKey]? [asset[assetKey]]:[]);
          cell.dataset.tags = JSON.stringify(newTags);
          // 重新渲染 cell
          cell.innerHTML='';
          newTags.forEach(t=>{
            const chip=document.createElement('span'); chip.className='chip'; chip.textContent=t;
            cell.appendChild(chip);
          });
          if(newTags.length===0){
            const plus=document.createElement('span'); plus.className='chip plus'; plus.textContent='＋';
            cell.appendChild(plus);
          }
          break;}
        default:{
          const inp=cell.querySelector('input');
          if(inp){
            // 若为数字输入，自动补足两位小数
            if(inp.type==='number') inp.value = formatTwoDecimal(asset[assetKey] || '');
            else inp.value = asset[assetKey] || '';
          }
        }
      }
    });
  }

  // 从表格单元反推 asset 并写入 row.dataset.extra
  function updateAssetFromRow(row){
    const tableToAsset={
      name:'name',
      category:'category',
      subcategory:'subcategory',
      amount:'purchasePrice',
      date:'purchaseDate',
      channel:'purchaseAddress',
      note:'description',
      image:'image'
    };
    const asset={};
    Object.entries(tableToAsset).forEach(([tableKey,assetKey])=>{
      const idx=idxMap[tableKey]; if(idx===undefined) return;
      const cell=row.cells[idx]; if(!cell) return;
      let val='';
      switch(tableKey){
        case 'category':
        case 'channel': val=cell.querySelector('select').value; break;
        case 'image':{
          const img=cell.querySelector('img'); val=(img && img.style.display!=='none')?img.src:''; break;}
        case 'subcategory': {
          val = cell.dataset.tags ? JSON.parse(cell.dataset.tags) : [];
          break;
        }
        default: val=cell.querySelector('input').value.trim();
      }
      asset[assetKey]=val;
    });
    row.dataset.extra=JSON.stringify({...JSON.parse(row.dataset.extra||'{}'), ...asset});
  }

  function applyColumnWidths(){
    let hasCustom=false;
    const total = columnOrder.reduce((acc,key)=>{
      const def=columnsMeta.find(c=>c.key===key)||{};
      if(def.width){ hasCustom=true; acc += def.width; }
      else{ acc += 0; }
      return acc;
    },0) + 120; // 操作列保守估计

    const wrapper = assetsTable.closest('.table-wrapper');
    if(wrapper){
      const wrapW = wrapper.clientWidth;
      if(hasCustom && total > wrapW){ assetsTable.style.minWidth = total + 'px'; }
      else{ assetsTable.style.minWidth = ''; }
    }
  }
})(); 