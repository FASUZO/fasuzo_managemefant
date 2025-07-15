/****
 * Asset Manager API Server (Express)
 * ----------------------------------
 * 环境变量一览（全部可选）：
 *   PORT               监听端口（默认 3000）
 *   LOG_LEVEL          日志级别：debug | info | error （默认 info）
 *   JSON_LIMIT         最大请求体大小（如 "100mb"，默认 50mb）
 *   DATA_DIR           数据目录，支持绝对路径或相对项目根目录（默认 "data"）
 *   DEFAULT_DARK       前端默认暗黑模式："true" | "false"
 *   DEFAULT_AUTO_SAVE  前端默认自动保存："true" | "false"
 *   DEFAULT_DEBUG      前端默认开启调试输出："true" | "false"
 *   FONT_URL           供前端动态加载的字体样式链接
 *
 * 提示：可在根目录创建 .env 文件来持久化配置；运行 `npm run setup` 会自动生成 .env（第一次使用）。
 ****/
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// 可配置参数
const LOG_LEVEL   = process.env.LOG_LEVEL   || 'info';   // debug | info | error
const JSON_LIMIT  = process.env.JSON_LIMIT  || '50mb';   // eg. 100mb
const DATA_DIR_ENV= process.env.DATA_DIR    || 'data';   // 绝对路径或相对项目根目录

// 前端默认行为配置
const DEFAULT_DARK        = process.env.DEFAULT_DARK   === 'true';
const DEFAULT_AUTO_SAVE   = process.env.DEFAULT_AUTO_SAVE === 'true';
const DEFAULT_DEBUG_FRONT = process.env.DEFAULT_DEBUG  === 'true';
let FONT_URL            = process.env.FONT_URL || '';

// 若设置了 FONT_URL，但文件不存在，则自动禁用
if(FONT_URL){
  try{
    // 仅处理相对路径，以 / 或 ./ 开头的情况；远程 URL 不作校验
    if(!/^https?:\/\//i.test(FONT_URL)){
      const abs = path.isAbsolute(FONT_URL) ? FONT_URL : path.join(ROOT_DIR, FONT_URL.replace(/^\//,''));
      if(!fs.existsSync(abs)){
        logger.info('FONT_URL 指向的文件不存在，已忽略:', FONT_URL);
        FONT_URL = '';
      }
    }
  }catch(e){ FONT_URL=''; }
}

// 简易日志封装
const logger = {
  debug: (...args)=> { if(LOG_LEVEL === 'debug') console.log('[DEBUG]', ...args); },
  info : (...args)=> { if(['debug','info'].includes(LOG_LEVEL)) console.log('[INFO ]', ...args); },
  error: (...args)=> console.error('[ERROR]', ...args)
};

// ----------------- 新增: 初始数据常量 -----------------
const DEFAULT_DATA = {
  categories: ['设备', '软件', '零件', '其他'],
  channels: ['淘宝', '京东', '拼多多', '闲鱼', '其他'],
  tags: [],
  assets: []
};
// -----------------------------------------------------

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..');

// 若存在 Vite 打包后的 dist 目录，则优先使用
const STATIC_DIR = fs.existsSync(path.join(ROOT_DIR, 'dist'))
  ? path.join(ROOT_DIR, 'dist')
  : ROOT_DIR;

// 数据目录及文件路径 (支持自定义)
const DATA_DIR = path.isAbsolute(DATA_DIR_ENV) ? DATA_DIR_ENV : path.join(ROOT_DIR, DATA_DIR_ENV);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DATA_PATH = path.join(DATA_DIR, 'data.json');

// 图片上传目录（位于 data/uploads）
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// 如果 data.json 不存在，创建默认结构
if (!fs.existsSync(DATA_PATH)) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
}

// 允许更大的 JSON 体（最多 50MB），以保存包含 Base64 图片的数据
app.use(express.json({ limit: JSON_LIMIT }));

// 全局错误处理（捕获过大请求体等）
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    console.error('Payload too large:', err.length);
    return res.status(413).json({ ok: false, message: 'Payload too large', max: '50mb' });
  }
  return next(err);
});

// 提供静态资源（HTML/CSS/JS）
app.use(express.static(STATIC_DIR));

// 提供上传图片静态访问
app.use('/uploads', express.static(UPLOAD_DIR));

// 提供前端运行时配置
app.get('/api/env', (_,res)=>{
  res.json({
    defaultDark: DEFAULT_DARK,
    defaultAutoSave: DEFAULT_AUTO_SAVE,
    debug: DEFAULT_DEBUG_FRONT,
    fontUrl: FONT_URL
  });
});

// 读取数据
app.get('/api/data', (_, res) => {
  res.sendFile(DATA_PATH);
});

// 保存数据（整包覆盖）
app.post('/api/data', (req, res) => {
  // 打印调试信息：请求体大小
  const bodySize = Buffer.byteLength(JSON.stringify(req.body));
  logger.info('Saving data, size:', bodySize, 'bytes');

  try {
    const newData = req.body;

    // ---------- 处理图片字段 ----------
    if(Array.isArray(newData.assets)){
      newData.assets = newData.assets.map(a=>{
        if(a.image && a.image.startsWith('data:image')){
          try{
            const match = a.image.match(/^data:image\/(\w+);base64,(.+)$/);
            if(match){
              const ext = match[1];
              const b64 = match[2];
              const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
              const filePath = path.join(UPLOAD_DIR, fileName);
              fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
              a.image = `/uploads/${fileName}`;
            }
          }catch(e){ console.error('保存图片失败', e); }
        }
        return a;
      });
    }

    // ---------- 清理已删除的本地图片 ----------
    let oldImages = [];
    try{
      if(fs.existsSync(DATA_PATH)){
        const prev = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
        if(Array.isArray(prev.assets)){
          oldImages = prev.assets
            .map(a=>a.image)
            .filter(img=> typeof img === 'string' && img.startsWith('/uploads/'));
        }
      }
    }catch(e){ logger.error('读取旧数据时出错', e); }

    const newImages = (newData.assets||[])
      .map(a=>a.image)
      .filter(img=> typeof img === 'string' && img.startsWith('/uploads/'));

    const toDelete = oldImages.filter(img=> !newImages.includes(img));
    toDelete.forEach(relPath=>{
      try{
        const abs = path.join(ROOT_DIR, relPath.replace(/^\//, ''));
        if(fs.existsSync(abs)){
          fs.unlinkSync(abs);
          logger.info('已删除未使用的图片文件:', abs);
        }
      }catch(e){ logger.error('删除图片失败', e); }
    });

    // ---------- 写入新数据 ----------
    fs.writeFileSync(DATA_PATH, JSON.stringify(newData, null, 2));
    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, err: err.message });
  }
});

// 重置数据为初始状态
app.post('/api/reset', (req, res) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  res.json({ ok: true });
});

// 修复数据：清理不存在的附件引用并删除冗余文件
app.post('/api/fix', (req, res) => {
  try{
    // 读取现有数据
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

    if(!Array.isArray(data.assets)) data.assets = [];

    // 收集引用的本地图片
    const referenced = new Set();
    let cleaned = 0;

    data.assets.forEach(a=>{
      if(a.image && typeof a.image === 'string' && a.image.startsWith('/uploads/')){
        const abs = path.join(ROOT_DIR, a.image.replace(/^\//, ''));
        if(fs.existsSync(abs)){
          referenced.add(abs);
        }else{
          // 文件已不存在，清空引用
          a.image = '';
          cleaned++;
        }
      }
    });

    // 删除未被引用的文件
    let deleted = 0;
    const files = fs.readdirSync(UPLOAD_DIR);
    files.forEach(f=>{
      const abs = path.join(UPLOAD_DIR, f);
      if(!referenced.has(abs)){
        fs.unlinkSync(abs);
        deleted++;
      }
    });

    // 保存回数据
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

    logger.info(`修复数据完成，清理引用 ${cleaned} 个，删除文件 ${deleted} 个`);
    res.json({ ok:true, cleaned, deleted });

  }catch(err){
    logger.error('修复数据失败', err);
    res.status(500).json({ ok:false, message:err.message });
  }
});

app.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`);
}); 