// scripts/planning.js
// --------------------------------------------
// 规划 Todo 功能脚本
// 调试提示：
//   1. localStorage key "todoTasks" 保存任务 JSON 数组
//   2. 在控制台执行 tasks 查看当前内存任务；修改后调用 saveTasks() 手动保存
//   3. 调用 loadTasks() 可重新从 localStorage 读取
// --------------------------------------------
// 规划 / Todo 清单功能

import { logInfo, logDebug } from './debug.js';

const STORAGE_KEY = 'todoTasks';

/** @typedef {{id:string,title:string,date:string,done:boolean}} Todo */

let tasks /** @type Todo[] */ = [];
// 日期过滤功能已移除

function loadTasks(){
  try{
    tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
    if(!Array.isArray(tasks)) tasks=[];
  }catch{tasks=[];}
}
function saveTasks(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// 构建日期条
// buildDateBar 已移除

// 横向日历逻辑已移除

// FAB 添加任务
document.getElementById('fabAdd').onclick=()=>{
  const overlay=document.createElement('div'); overlay.className='overlay';
  const modal=document.createElement('div'); modal.className='modal'; modal.style.width='300px';
  modal.innerHTML='<h3>新增待办</h3>';
  const input=document.createElement('input'); input.type='text'; input.placeholder='事项'; input.style.width='100%';
  const date=document.createElement('input'); date.type='date'; date.style.width='100%';
  date.value=(new Date()).toISOString().split('T')[0];
  const ok=document.createElement('button'); ok.textContent='添加'; ok.className='btn-like';
  const cancel=document.createElement('button'); cancel.textContent='取消'; cancel.className='btn-like btn-danger btn-small';
  ok.onclick=()=>{ if(!input.value.trim()){alert('请输入');return;} tasks.push({id:Date.now().toString(),title:input.value.trim(),date:date.value,done:false}); saveTasks(); render(); document.body.removeChild(overlay); };
  cancel.onclick=()=>document.body.removeChild(overlay);
  modal.appendChild(input); modal.appendChild(date); modal.appendChild(ok); modal.appendChild(cancel);
  overlay.appendChild(modal); document.body.appendChild(overlay);
};

// DOM refs
const listEl = document.getElementById('todoList');
const titleInput = document.getElementById('todoTitle');
const dateInput = document.getElementById('todoDate');
const addBtn = document.getElementById('addTodoBtn');

function render(){
  listEl.innerHTML='';
  if(tasks.length===0){ listEl.textContent='暂无待办'; return; }
  // 按日期分组排序
  const grouped = tasks.reduce((acc,t)=>{
    const d = t.date || '无日期';
    (acc[d]=acc[d]||[]).push(t); return acc;},{});
  const dates = Object.keys(grouped).sort();
  dates.forEach(d=>{
    const sec=document.createElement('div'); sec.className='todo-date-section';
    const h=document.createElement('h3'); h.textContent=d==='无日期'? '无日期' : d; sec.appendChild(h);
    grouped[d].forEach(task=>{
      const row=document.createElement('div'); row.className='todo-row';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=task.done;
      cb.addEventListener('change',()=>{ task.done=cb.checked; saveTasks(); render(); });
      const span=document.createElement('span'); span.textContent=task.title; if(task.done) span.style.textDecoration='line-through';
      const del=document.createElement('button'); del.textContent='🗑'; del.className='btn-like btn-small btn-danger';
      del.style.marginLeft='auto';
      del.onclick=()=>{ tasks = tasks.filter(t=>t.id!==task.id); saveTasks(); render(); };
      row.appendChild(cb); row.appendChild(span); row.appendChild(del);
      sec.appendChild(row);
    });
    listEl.appendChild(sec);
  });
}

function addTask(){
  const title=titleInput.value.trim(); if(!title){ alert('请输入内容'); return; }
  const date=dateInput.value; const id=Date.now().toString();
  tasks.push({id,title,date,done:false});
  titleInput.value=''; saveTasks(); render();
}

addBtn.addEventListener('click', addTask);

// 初始
loadTasks(); logInfo('[planning] loaded tasks', tasks); render(); 