const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const safeUrl = (value = '') => { try { const url = new URL(value, location.href); return ['http:','https:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; } };

$('#year').textContent = new Date().getFullYear();

fetch('journey.json').then(r => r.json()).then(items => {
  $('#journeyList').innerHTML = items.map(item => `<div class="journey-item"><time>${escapeHtml(item.date)}</time><div><b>${escapeHtml(item.title)}</b>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</div></div>`).join('');
}).catch(() => {});

fetch('https://api.github.com/users/m161awm2').then(r => r.json()).then(profile => {
  $('#repoCount').textContent = Number(profile.public_repos || 0).toLocaleString();
  $('#followerCount').textContent = Number(profile.followers || 0).toLocaleString();
  $('#followingCount').textContent = Number(profile.following || 0).toLocaleString();
}).catch(() => {});

fetch('projects.json').then(r => r.json()).then(items => {
  $('#projectGrid').innerHTML = items.slice(0, 6).map(item => `<a class="data-card" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer"><span class="meta">${escapeHtml(item.language || 'PROJECT')}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || 'GitHub에서 프로젝트 내용을 확인해보세요.')}</p><span class="arrow">프로젝트 보기 ↗</span></a>`).join('');
}).catch(() => {});

fetch('posts.json').then(r => r.json()).then(items => {
  $('#postGrid').innerHTML = items.slice(0, 6).map(item => `<a class="data-card" href="${safeUrl(item.link || item.url)}" target="_blank" rel="noreferrer"><span class="meta">VELOG NOTE</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || item.summary || '기술을 공부하며 남긴 기록입니다.')}</p><span class="arrow">글 읽기 ↗</span></a>`).join('');
}).catch(() => {});

fetch('links.json').then(r => r.json()).then(items => {
  $('#linksList').innerHTML = items.map(item => `<a class="link-item" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(item.shortTitle || item.title)}</span><b>↗</b></a>`).join('');
}).catch(() => {});

const canvas = $('#previewCanvas');
const graphPanel = $('#networkPreview');
const graphDetail = $('#networkDetail');
const graphColors = { core:'#2563eb', cloud:'#0ea5e9', ops:'#059669', code:'#7c3aed' };
const graphData = [
  ['Ku Bonmu','core','Cloud · DevOps · Backend',0,0,16],
  ['Cloud & Infrastructure','cloud','Kubernetes · AWS · Docker',-210,-105,11],
  ['Languages & Backend','code','Python · JavaScript · PostgreSQL',205,-105,11],
  ['DevOps & Tools','ops','GitHub Actions · Git',0,145,11],
  ['Kubernetes','cloud','Container Orchestration',-430,-220,9],
  ['AWS','cloud','Cloud Infrastructure',-430,-85,8],
  ['Docker','cloud','Container · Image',-365,55,8],
  ['Python','code','Automation · Backend',425,-235,8],
  ['Flask','code','Python Web Framework',430,-115,8],
  ['JavaScript','code','Web Language',420,10,8],
  ['TypeScript','code','Typed JavaScript',325,155,8],
  ['Node.js','code','JavaScript Runtime',250,-245,8],
  ['Gin','code','Go Web Framework',115,-245,8],
  ['PostgreSQL','code','Relational Database',430,160,9],
  ['GitHub Actions','ops','CI · CD · Automation',-145,250,8],
  ['Git','ops','Version Control',145,250,8]
];
const graphLinks = [
  [0,1],[0,2],[0,3],
  [1,4],[1,5],[1,6],
  [2,7],[2,8],[2,9],[2,10],[2,11],[2,12],[2,13],
  [3,14],[3,15],
  [4,6],[7,8],[9,10],[9,11],[10,11],[11,12],[14,15]
];
const nodes = graphData.map(([label,type,tags,x,y,r]) => ({label,type,tags,x,y,r,vx:0,vy:0}));
const view = { x:0, y:0, scale:1 };
let draggedNode = -1;
let selectedNode = -1;
let panStart = null;
let placeholder = null;
let resizingGraph = false;
let resizeZoomRatio = 1;

const fitScale = rect => Math.max(.34, Math.min((rect.width - 70) / 1040, (rect.height - 74) / 570));
const toScreen = (node, rect) => ({x:rect.width/2 + view.x + node.x*view.scale, y:rect.height/2 + view.y + node.y*view.scale});

function resetGraph() {
  const rect = canvas.getBoundingClientRect();
  view.x = 0; view.y = 0; view.scale = fitScale(rect); selectedNode = -1;
  updateGraphDetail();
}

function updateGraphDetail() {
  if (!graphDetail) return;
  const node = selectedNode >= 0 ? nodes[selectedNode] : nodes[0];
  graphDetail.querySelector('b').textContent = node.label;
  graphDetail.querySelector('span').textContent = node.tags;
}

function simulateGraph() {
  for (let firstIndex=0; firstIndex<nodes.length; firstIndex++) {
    for (let secondIndex=firstIndex+1; secondIndex<nodes.length; secondIndex++) {
      const first=nodes[firstIndex], second=nodes[secondIndex], dx=second.x-first.x, dy=second.y-first.y;
      const distance=Math.max(38,Math.hypot(dx,dy)), force=2600/(distance*distance);
      first.vx-=dx/distance*force; first.vy-=dy/distance*force;
      second.vx+=dx/distance*force; second.vy+=dy/distance*force;
    }
  }
  graphLinks.forEach(([a,b]) => {
    const first=nodes[a], second=nodes[b], dx=second.x-first.x, dy=second.y-first.y;
    const distance=Math.max(1,Math.hypot(dx,dy)), force=(distance-145)*.00042;
    first.vx+=dx/distance*force; first.vy+=dy/distance*force;
    second.vx-=dx/distance*force; second.vy-=dy/distance*force;
  });
  nodes.forEach((node,index) => {
    if (index === draggedNode) return;
    node.vx += -node.x*.000015; node.vy += -node.y*.000015;
    node.vx *= .9; node.vy *= .9; node.x += node.vx; node.y += node.vy;
  });
}

function drawGraph() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1,2);
  const width=Math.max(1,Math.round(rect.width*dpr)), height=Math.max(1,Math.round(rect.height*dpr));
  if (canvas.width!==width || canvas.height!==height) { canvas.width=width; canvas.height=height; }
  if (resizingGraph) view.scale = fitScale(rect) * resizeZoomRatio;
  const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height);
  simulateGraph();
  graphLinks.forEach(([a,b]) => {
    const first=toScreen(nodes[a],rect), second=toScreen(nodes[b],rect);
    const highlighted=selectedNode>=0 && (a===selectedNode || b===selectedNode);
    ctx.beginPath(); ctx.moveTo(first.x,first.y); ctx.lineTo(second.x,second.y);
    ctx.strokeStyle=highlighted?'rgba(37,99,235,.9)':selectedNode>=0?'rgba(100,116,139,.08)':'rgba(100,116,139,.25)';
    ctx.lineWidth=highlighted?Math.max(1.8,2.2*view.scale):Math.max(.7,view.scale);
    ctx.shadowBlur=highlighted?14:0; ctx.shadowColor='#60a5fa'; ctx.stroke(); ctx.shadowBlur=0;
  });
  nodes.forEach((node,index) => {
    const point=toScreen(node,rect), radius=Math.max(3.5,node.r*view.scale);
    const related=selectedNode<0 || index===selectedNode || graphLinks.some(([a,b]) => (a===selectedNode&&b===index)||(b===selectedNode&&a===index));
    ctx.beginPath(); ctx.arc(point.x,point.y,radius,0,Math.PI*2);
    ctx.globalAlpha=related?1:.24;
    ctx.shadowBlur=selectedNode>=0&&related?30:index===draggedNode?22:12; ctx.shadowColor=graphColors[node.type]; ctx.fillStyle=graphColors[node.type]; ctx.fill(); ctx.shadowBlur=0;
    if (view.scale>.5 || node.type==='core') {
      ctx.fillStyle='#334155'; ctx.font=`${node.type==='core'?'700':'600'} ${Math.max(8,11*view.scale)}px Pretendard, sans-serif`; ctx.textAlign='center';
      ctx.fillText(node.label,point.x,point.y+radius+Math.max(12,15*view.scale));
    }
    ctx.globalAlpha=1;
  });
  requestAnimationFrame(drawGraph);
}

function hitNode(x,y) {
  const rect=canvas.getBoundingClientRect();
  for (let index=nodes.length-1; index>=0; index--) {
    const point=toScreen(nodes[index],rect);
    if (Math.hypot(x-point.x,y-point.y) < Math.max(17,nodes[index].r*view.scale+7)) return index;
  }
  return -1;
}

canvas.addEventListener('pointerdown', event => {
  canvas.setPointerCapture(event.pointerId);
  draggedNode=hitNode(event.clientX-canvas.getBoundingClientRect().left,event.clientY-canvas.getBoundingClientRect().top);
  if (draggedNode>=0) {
    selectedNode=draggedNode; updateGraphDetail();
  } else { selectedNode=-1; updateGraphDetail(); panStart={x:event.clientX,y:event.clientY,viewX:view.x,viewY:view.y}; }
});
canvas.addEventListener('pointermove', event => {
  const rect=canvas.getBoundingClientRect();
  if (draggedNode>=0) {
    const node=nodes[draggedNode]; node.x=(event.clientX-rect.left-rect.width/2-view.x)/view.scale; node.y=(event.clientY-rect.top-rect.height/2-view.y)/view.scale; node.vx=0; node.vy=0;
  } else if (panStart) { view.x=panStart.viewX+event.clientX-panStart.x; view.y=panStart.viewY+event.clientY-panStart.y; }
});
const releaseGraph = () => { draggedNode=-1; panStart=null; };
canvas.addEventListener('pointerup',releaseGraph); canvas.addEventListener('pointercancel',releaseGraph);
canvas.addEventListener('wheel',event => {
  event.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const pointerX=event.clientX-rect.left-rect.width/2;
  const pointerY=event.clientY-rect.top-rect.height/2;
  const speed=graphPanel.classList.contains('is-expanded')?.003:.0016;
  const delta=event.deltaMode===1?event.deltaY*16:event.deltaMode===2?event.deltaY*rect.height:event.deltaY;
  const oldScale=view.scale;
  const factor=Math.max(.62,Math.min(1.62,Math.exp(-delta*speed)));
  view.scale=Math.max(.22,Math.min(4,oldScale*factor));
  const ratio=view.scale/oldScale;
  view.x=pointerX-(pointerX-view.x)*ratio;
  view.y=pointerY-(pointerY-view.y)*ratio;
},{passive:false});

function zoomGraph(multiplier) { view.scale=Math.max(.25,Math.min(2.5,view.scale*multiplier)); }
$('#zoomOut').addEventListener('click',()=>zoomGraph(.82)); $('#zoomIn').addEventListener('click',()=>zoomGraph(1.22)); $('#resetNetwork').addEventListener('click',resetGraph);

function expandGraph() {
  if (graphPanel.classList.contains('is-floating')) return;
  const rect=graphPanel.getBoundingClientRect();
  placeholder=document.createElement('div'); placeholder.className='graph-placeholder'; graphPanel.before(placeholder);
  resizeZoomRatio=view.scale/fitScale(rect); resizingGraph=true;
  Object.assign(graphPanel.style,{transition:'none',top:`${rect.top}px`,left:`${rect.left}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  graphPanel.classList.add('is-floating','is-expanded'); document.body.classList.add('graph-lock'); graphPanel.offsetWidth;
  graphPanel.style.transition='top .48s ease,left .48s ease,width .48s ease,height .48s ease,border-radius .48s ease';
  Object.assign(graphPanel.style,{top:'12px',left:'12px',width:'calc(100vw - 24px)',height:'calc(100dvh - 24px)',borderRadius:'18px'});
  window.setTimeout(()=>{resizingGraph=false},500);
}

function collapseGraph() {
  if (!placeholder) return;
  const rect=graphPanel.getBoundingClientRect(), target=placeholder.getBoundingClientRect();
  resizeZoomRatio=view.scale/fitScale(rect); resizingGraph=true;
  Object.assign(graphPanel.style,{top:`${target.top}px`,left:`${target.left}px`,width:`${target.width}px`,height:`${target.height}px`,borderRadius:'22px'});
  window.setTimeout(()=>{
    graphPanel.classList.remove('is-floating','is-expanded'); graphPanel.removeAttribute('style'); placeholder.remove(); placeholder=null; document.body.classList.remove('graph-lock'); resizingGraph=false;
  },490);
}

$('#openNetwork').addEventListener('click',expandGraph); $('#closeNetwork').addEventListener('click',collapseGraph);
document.addEventListener('keydown',event=>{if(event.key==='Escape')collapseGraph()});
window.addEventListener('resize',()=>{if(graphPanel.classList.contains('is-expanded')) Object.assign(graphPanel.style,{top:'12px',left:'12px',width:'calc(100vw - 24px)',height:'calc(100dvh - 24px)'})});
resetGraph(); requestAnimationFrame(drawGraph);
