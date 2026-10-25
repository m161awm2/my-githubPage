const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const safeUrl = (value = '') => { try { const url = new URL(value, location.href); return ['http:','https:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; } };

$('#year').textContent = new Date().getFullYear();

fetch('journey.json', { cache: 'no-cache' }).then(r => r.json()).then(items => {
  $('#journeyList').innerHTML = items.map(item => `<div class="journey-item"><time>${escapeHtml(item.date)}</time><div><b>${escapeHtml(item.title)}</b>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</div></div>`).join('');
}).catch(() => {});

fetch('https://api.github.com/users/m161awm2').then(r => r.json()).then(profile => {
  $('#repoCount').textContent = Number(profile.public_repos || 0).toLocaleString();
  $('#followerCount').textContent = Number(profile.followers || 0).toLocaleString();
  $('#followingCount').textContent = Number(profile.following || 0).toLocaleString();
}).catch(() => {});

fetch('projects.json', { cache: 'no-cache' }).then(r => r.json()).then(items => {
  $('#projectGrid').innerHTML = items.slice(0, 6).map(item => `<a class="data-card" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer"><span class="meta">${escapeHtml(item.language || 'PROJECT')}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || 'GitHub에서 프로젝트 내용을 확인해보세요.')}</p><span class="arrow">프로젝트 보기 ↗</span></a>`).join('');
}).catch(() => {});

fetch('posts.json', { cache: 'no-cache' }).then(r => r.json()).then(items => {
  $('#postGrid').innerHTML = items.slice(0, 6).map(item => `<a class="data-card" href="${safeUrl(item.link || item.url)}" target="_blank" rel="noreferrer">${item.thumbnail ? `<img class="post-thumb" src="${safeUrl(item.thumbnail)}" alt="" loading="lazy" />` : ''}<span class="meta">VELOG NOTE</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || item.summary || '기술을 공부하며 남긴 기록입니다.')}</p><span class="arrow">글 읽기 ↗</span></a>`).join('');
}).catch(() => {});

fetch('links.json', { cache: 'no-cache' }).then(r => r.json()).then(items => {
  $('#linksList').innerHTML = items.map(item => `<a class="link-item" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(item.shortTitle || item.title)}</span><b>↗</b></a>`).join('');
}).catch(() => {});

const canvas = $('#previewCanvas');
const graphPanel = $('#networkPreview');
const graphDetail = $('#networkDetail');
const graphPalette = ['#0ea5e9','#7c3aed','#059669','#ea580c','#db2777','#ca8a04','#0891b2','#4f46e5'];
const nodes = [{label:'Ku Bonmu',color:'#2563eb',core:true,tags:'Velog Series',x:0,y:0,r:16,vx:0,vy:0}];
const graphLinks = [];
const postLabel = title => (String(title).match(/^\[([^\]]+)\]/)?.[1] || String(title)).slice(0,24);

function buildSeriesGraph(seriesList) {
  const count = seriesList.length;
  nodes[0].tags = seriesList.map(series => series.name).join(' · ') || 'Velog Series';
  seriesList.forEach((series, seriesIndex) => {
    const angle = Math.PI + Math.PI*2*seriesIndex/Math.max(1,count), color = graphPalette[seriesIndex % graphPalette.length];
    const seriesNode = nodes.push({label:series.name,color,tags:`${series.posts.length}개의 글 · Velog Series`,link:series.url,x:Math.cos(angle)*230,y:Math.sin(angle)*150,r:11,vx:0,vy:0}) - 1;
    graphLinks.push([0,seriesNode]);
    series.posts.forEach((post, postIndex) => {
      const spread = series.posts.length > 1 ? (postIndex/(series.posts.length-1) - .5)*1.4 : 0;
      const postNode = nodes.push({label:postLabel(post.title),color,tags:post.title,link:post.link,x:Math.cos(angle+spread)*430,y:Math.sin(angle+spread)*240,r:8,vx:0,vy:0}) - 1;
      graphLinks.push([seriesNode,postNode]);
    });
  });
  resetGraph();
}

fetch('series.json', { cache: 'no-cache' }).then(r => r.json()).then(buildSeriesGraph).catch(() => {});
const view = { x:0, y:0, scale:1 };
let draggedNode = -1;
let selectedNode = -1;
let panStart = null;
let placeholder = null;
let resizingGraph = false;
let resizeZoomRatio = 1;

const graphExtent = () => nodes.reduce((extent,node) => ({x:Math.max(extent.x,Math.abs(node.x)),y:Math.max(extent.y,Math.abs(node.y))}),{x:200,y:120});
const fitScale = rect => { const extent = graphExtent(); return Math.max(.34, Math.min(1.3, (rect.width - 70) / (extent.x*2 + 160), (rect.height - 74) / (extent.y*2 + 90))); };
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
  const detailLink = graphDetail.querySelector('a');
  detailLink.hidden = !node.link;
  if (node.link) detailLink.href = safeUrl(node.link);
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
    ctx.shadowBlur=selectedNode>=0&&related?30:index===draggedNode?22:12; ctx.shadowColor=node.color; ctx.fillStyle=node.color; ctx.fill(); ctx.shadowBlur=0;
    if (view.scale>.5 || node.core) {
      ctx.fillStyle='#334155'; ctx.font=`${node.core?'700':'600'} ${Math.max(8,11*view.scale)}px Pretendard, sans-serif`; ctx.textAlign='center';
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
