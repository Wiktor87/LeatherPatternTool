// Main Application  
// Refactored from inline script in index.html

import { SCALE, CFG, HOVER_TOLERANCE, HOVER_SCALE, MAX_HISTORY } from './config.js';
import { M } from './math.js';

// Make config available globally for backwards compatibility
window.CFG = CFG;
window.SCALE = SCALE;
window.M = M;
window.HOVER_TOLERANCE = HOVER_TOLERANCE;
window.HOVER_SCALE = HOVER_SCALE;
window.MAX_HISTORY = MAX_HISTORY;

// Initialize global state
const VIEW = { x: 0, y: 0, zoom: 1 };
const HOLSTER = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, locked: false };

// Create wrapper functions for M that use HOLSTER
M.holsterToWorld = function(l) { return M.localToWorld(l, HOLSTER); };
M.worldToHolster = function(w) { return M.worldToLocal(w, HOLSTER); };





let MODE='select',LAYER='symmetric',SELECTED=null,TEMP_STITCH=null,TEMP_SHAPE=null,TEMP_CUSTOMHOLE=null,SHIFT_HELD=false,isPanning=false,DRAG={active:false},HOVER=null,PUBLISH_MODE=false;
let HISTORY=[],HISTORY_IDX=-1;
let PUBLISH_VIEW={x:0,y:0,scale:1}; // Offset and scale for publish mode layout
let REF_IMAGE={img:null,x:0,y:0,scale:1,width:0,height:0,calibrating:false,calPt1:null,calPt2:null}; // Reference image state
let NODES=[{x:0,y:-180,h1:{x:0,y:0},h2:{x:45,y:0}},{x:70,y:-180,h1:{x:-20,y:0},h2:{x:20,y:20}},{x:90,y:-140,h1:{x:0,y:-20},h2:{x:0,y:30}},{x:70,y:-50,h1:{x:10,y:-25},h2:{x:-5,y:30}},{x:55,y:80,h1:{x:5,y:-30},h2:{x:-5,y:40}},{x:45,y:180,h1:{x:5,y:-35},h2:{x:-15,y:0}},{x:0,y:180,h1:{x:15,y:0},h2:{x:0,y:0}}];
let EDGE_RANGES=[{start:0,end:1}];
let MERGED_EDGE_RANGES=[]; // Ranges on full merged perimeter (including extensions)
let EDGE_STITCHES=[]; // New: stitches bound to edge ranges
let SYM_HOLES=[],SYM_STITCHES=[],ASYM_SHAPES=[],ASYM_HOLES=[],ASYM_STITCHES=[],SYM_CUSTOM_HOLES=[],ASYM_CUSTOM_HOLES=[],TEXT_ANNOTATIONS=[];

// Two-Layer Mode: State for front and back layers
let CURRENT_LAYER='front'; // 'front' or 'back'
let FRONT_LAYER=null; // Will store front layer state
let BACK_LAYER=null; // Will store back layer state
let GHOST_OFFSET={x:0,y:0}; // Offset for positioning the ghost layer

// Snap helper functions
function snapWorld(pt){
let x=pt.x,y=pt.y;
const foldX=HOLSTER.x; // Fold line X in world coords
// Snap to grid
if(CFG.snapGrid){
const gs=parseFloat(CFG.gridSize)||5;
x=Math.round(x/gs)*gs;
y=Math.round(y/gs)*gs;
}
// Snap to fold line (takes priority)
if(CFG.snapFold){
const snapDist=5; // mm threshold
if(Math.abs(x-foldX)<snapDist)x=foldX;
}
return{x,y};
}
function snapLocal(pt){
// Snap in holster-local coords (for symmetric items)
let x=pt.x,y=pt.y;
// Snap to grid
if(CFG.snapGrid){
const gs=parseFloat(CFG.gridSize)||5;
x=Math.round(x/gs)*gs;
y=Math.round(y/gs)*gs;
}
// Snap to fold line (x=0 in local coords)
if(CFG.snapFold){
const snapDist=5;
if(Math.abs(x)<snapDist)x=0;
}
return{x,y};
}
class App{
constructor(){this.canvas=document.getElementById('c');this.ctx=this.canvas.getContext('2d');this.dpr=devicePixelRatio||1;this.off=document.createElement('canvas');this.offCtx=this.off.getContext('2d');this.init()}
init(){
this.setupEvents();
this.resize();
this.settingsOpen=false;
this.outlinerOpen=false;
// Initialize UI based on default project type
this.onProjectTypeChange(CFG.projectType);
this.saveState();
}
showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
updateZoomIndicator() {
  const pct = Math.round(VIEW.zoom * 100);
  document.getElementById('zoom-indicator').textContent = pct + '%';
}
// History management for undo/redo
saveState(){
const state={
NODES:JSON.parse(JSON.stringify(NODES)),
HOLSTER:JSON.parse(JSON.stringify(HOLSTER)),
EDGE_RANGES:JSON.parse(JSON.stringify(EDGE_RANGES)),
MERGED_EDGE_RANGES:JSON.parse(JSON.stringify(MERGED_EDGE_RANGES)),
EDGE_STITCHES:JSON.parse(JSON.stringify(EDGE_STITCHES)),
SYM_HOLES:JSON.parse(JSON.stringify(SYM_HOLES)),
SYM_STITCHES:JSON.parse(JSON.stringify(SYM_STITCHES)),
SYM_CUSTOM_HOLES:JSON.parse(JSON.stringify(SYM_CUSTOM_HOLES)),
ASYM_HOLES:JSON.parse(JSON.stringify(ASYM_HOLES)),
ASYM_STITCHES:JSON.parse(JSON.stringify(ASYM_STITCHES)),
ASYM_CUSTOM_HOLES:JSON.parse(JSON.stringify(ASYM_CUSTOM_HOLES)),
ASYM_SHAPES:JSON.parse(JSON.stringify(ASYM_SHAPES)),
TEXT_ANNOTATIONS:JSON.parse(JSON.stringify(TEXT_ANNOTATIONS))
};
// Remove any redo states after current position
if(HISTORY_IDX<HISTORY.length-1){
HISTORY=HISTORY.slice(0,HISTORY_IDX+1);
}
HISTORY.push(state);
// Limit history size
if(HISTORY.length>MAX_HISTORY){
HISTORY.shift();
}else{
HISTORY_IDX++;
}
this.updateUndoRedoButtons();
// Sync to back layer if in two-layer mode and on front layer
if(CFG.projectType==='two-layer'&&CURRENT_LAYER==='front'){
this.syncOutlineToBack();
this.syncEdgeStitchesToBack();
}
}
restoreState(state){
NODES=JSON.parse(JSON.stringify(state.NODES));
HOLSTER.x=state.HOLSTER.x;HOLSTER.y=state.HOLSTER.y;HOLSTER.rotation=state.HOLSTER.rotation;HOLSTER.scaleX=state.HOLSTER.scaleX;HOLSTER.scaleY=state.HOLSTER.scaleY;
EDGE_RANGES=JSON.parse(JSON.stringify(state.EDGE_RANGES));
MERGED_EDGE_RANGES=JSON.parse(JSON.stringify(state.MERGED_EDGE_RANGES||[]));
EDGE_STITCHES=JSON.parse(JSON.stringify(state.EDGE_STITCHES));
SYM_HOLES=JSON.parse(JSON.stringify(state.SYM_HOLES));
SYM_STITCHES=JSON.parse(JSON.stringify(state.SYM_STITCHES));
SYM_CUSTOM_HOLES=JSON.parse(JSON.stringify(state.SYM_CUSTOM_HOLES));
ASYM_HOLES=JSON.parse(JSON.stringify(state.ASYM_HOLES));
ASYM_STITCHES=JSON.parse(JSON.stringify(state.ASYM_STITCHES));
ASYM_CUSTOM_HOLES=JSON.parse(JSON.stringify(state.ASYM_CUSTOM_HOLES));
ASYM_SHAPES=JSON.parse(JSON.stringify(state.ASYM_SHAPES));
TEXT_ANNOTATIONS=JSON.parse(JSON.stringify(state.TEXT_ANNOTATIONS));
SELECTED=null;
this.updateInfo();
this.updateOutliner();
this.draw();
}
undo(){
if(HISTORY_IDX>0){
HISTORY_IDX--;
this.restoreState(HISTORY[HISTORY_IDX]);
this.updateUndoRedoButtons();
this.showToast('Undo', 'info');
}
}
redo(){
if(HISTORY_IDX<HISTORY.length-1){
HISTORY_IDX++;
this.restoreState(HISTORY[HISTORY_IDX]);
this.updateUndoRedoButtons();
this.showToast('Redo', 'info');
}
}
updateUndoRedoButtons(){
document.getElementById('undo-btn').disabled=HISTORY_IDX<=0;
document.getElementById('redo-btn').disabled=HISTORY_IDX>=HISTORY.length-1;
}
toggleFileMenu(){
const menu=document.getElementById('file-menu');
menu.classList.toggle('open');
// Close on click outside
if(menu.classList.contains('open')){
setTimeout(()=>{
const closeHandler=(e)=>{
if(!menu.contains(e.target)&&!e.target.closest('.hdr-btn')){
menu.classList.remove('open');
document.removeEventListener('click',closeHandler);
}
};
document.addEventListener('click',closeHandler);
},10);
}
}
renameProject(){
const currentName=document.getElementById('project-title').textContent;
document.getElementById('rename-input').value=currentName;
document.getElementById('rename-modal').style.display='flex';
document.getElementById('rename-input').focus();
document.getElementById('rename-input').select();
}
cancelRename(){
document.getElementById('rename-modal').style.display='none';
}
applyRename(){
const newName=document.getElementById('rename-input').value;
document.getElementById('rename-modal').style.display='none';
if(newName&&newName.trim()){
document.getElementById('project-title').textContent=newName.trim();
// Also sync with publish mode title input
const publishTitle=document.getElementById('pattern-title');
if(publishTitle)publishTitle.value=newName.trim();
}
}
saveProject(){
document.getElementById('file-menu').classList.remove('open');
const projectName=document.getElementById('project-title').textContent||'Leather Pattern';
const project={
version:2, // Increment version for two-layer support
name:projectName,
NODES:NODES,
HOLSTER:HOLSTER,
EDGE_RANGES:EDGE_RANGES,
MERGED_EDGE_RANGES:MERGED_EDGE_RANGES,
EDGE_STITCHES:EDGE_STITCHES,
SYM_HOLES:SYM_HOLES,
SYM_STITCHES:SYM_STITCHES,
SYM_CUSTOM_HOLES:SYM_CUSTOM_HOLES,
ASYM_HOLES:ASYM_HOLES,
ASYM_STITCHES:ASYM_STITCHES,
ASYM_CUSTOM_HOLES:ASYM_CUSTOM_HOLES,
ASYM_SHAPES:ASYM_SHAPES,
TEXT_ANNOTATIONS:TEXT_ANNOTATIONS,
CFG:CFG
};
// Add two-layer data if in two-layer mode
if(CFG.projectType==='two-layer'){
// Save current layer before exporting
if(CURRENT_LAYER==='front'){
FRONT_LAYER=this.captureLayerState();
}else{
BACK_LAYER=this.captureLayerState();
}
project.CURRENT_LAYER=CURRENT_LAYER;
project.FRONT_LAYER=FRONT_LAYER;
project.BACK_LAYER=BACK_LAYER;
project.GHOST_OFFSET=GHOST_OFFSET;
}
const json=JSON.stringify(project,null,2);
const blob=new Blob([json],{type:'application/json'});
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
a.download=(project.name.replace(/[^a-z0-9]/gi,'_')||'holster-pattern')+'.json';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
this.showToast('Project saved!', 'success');
}
loadProject(){
document.getElementById('file-menu').classList.remove('open');
document.getElementById('file-input').click();
}
handleFileLoad(e){
const file=e.target.files[0];
if(!file)return;
const reader=new FileReader();
reader.onload=(evt)=>{
try{
const project=JSON.parse(evt.target.result);
// Validate basic structure
if(!project.NODES||!project.HOLSTER){
alert('Invalid project file');
return;
}
// Restore state
NODES=project.NODES;
HOLSTER.x=project.HOLSTER.x||0;
HOLSTER.y=project.HOLSTER.y||0;
HOLSTER.rotation=project.HOLSTER.rotation||0;
HOLSTER.scaleX=project.HOLSTER.scaleX||1;
HOLSTER.scaleY=project.HOLSTER.scaleY||1;
HOLSTER.locked=project.HOLSTER.locked||false;
EDGE_RANGES=project.EDGE_RANGES||[{start:0,end:1}];
MERGED_EDGE_RANGES=project.MERGED_EDGE_RANGES||[];
EDGE_STITCHES=project.EDGE_STITCHES||[];
SYM_HOLES=project.SYM_HOLES||[];
SYM_STITCHES=project.SYM_STITCHES||[];
SYM_CUSTOM_HOLES=project.SYM_CUSTOM_HOLES||[];
ASYM_HOLES=project.ASYM_HOLES||[];
ASYM_STITCHES=project.ASYM_STITCHES||[];
ASYM_CUSTOM_HOLES=project.ASYM_CUSTOM_HOLES||[];
ASYM_SHAPES=project.ASYM_SHAPES||[];
TEXT_ANNOTATIONS=project.TEXT_ANNOTATIONS||[];
// Restore CFG if present
if(project.CFG){
Object.keys(project.CFG).forEach(k=>{
if(CFG.hasOwnProperty(k))CFG[k]=project.CFG[k];
});
}
// Load two-layer data if present
if(project.FRONT_LAYER&&project.BACK_LAYER){
FRONT_LAYER=project.FRONT_LAYER;
BACK_LAYER=project.BACK_LAYER;
CURRENT_LAYER=project.CURRENT_LAYER||'front';
GHOST_OFFSET=project.GHOST_OFFSET||{x:0,y:0};
// Restore the current layer
const targetState=CURRENT_LAYER==='front'?FRONT_LAYER:BACK_LAYER;
this.restoreLayerState(targetState);
// Update project type in UI
document.getElementById('cfg-projectType').value='two-layer';
this.onProjectTypeChange('two-layer');
}else{
// Legacy file or fold-over mode
FRONT_LAYER=null;
BACK_LAYER=null;
CURRENT_LAYER='front';
GHOST_OFFSET={x:0,y:0};
// Ensure project type is set to fold-over
if(!project.CFG||!project.CFG.projectType){
CFG.projectType='fold-over';
document.getElementById('cfg-projectType').value='fold-over';
this.onProjectTypeChange('fold-over');
}
}
// Update pattern title
if(project.name){
document.getElementById('project-title').textContent=project.name;
const titleInput=document.getElementById('pattern-title');
if(titleInput)titleInput.value=project.name;
// Sync UI checkboxes with loaded CFG values
document.getElementById('cfg-asymmetricOutline').checked=CFG.asymmetricOutline||false;
document.getElementById('cfg-syncOutline').checked=CFG.syncOutline!==false;
document.getElementById('cfg-syncEdgeStitches').checked=CFG.syncEdgeStitches!==false;
}
SELECTED=null;
this.updateInfo();
this.updateOutliner();
this.draw();
this.saveState();
this.showToast('Project loaded!', 'success');
}catch(err){
alert('Error loading project: '+err.message);
this.showToast('Error loading project', 'error');
}
};
reader.readAsText(file);
// Reset input so same file can be loaded again
e.target.value='';
}
toggleSettings(){this.settingsOpen=!this.settingsOpen;document.getElementById('settings-panel').classList.toggle('open',this.settingsOpen);document.getElementById('settings-overlay').classList.toggle('open',this.settingsOpen);document.getElementById('settings-btn').style.display=this.settingsOpen?'none':'flex';if(this.settingsOpen&&this.outlinerOpen)this.toggleOutliner()}
loadRefImage(e){
const file=e.target.files[0];
if(!file)return;
const reader=new FileReader();
reader.onload=(ev)=>{
const img=new Image();
img.onload=()=>{
// Convert to mm - assume 96 DPI for now, user can scale
// Default: 1 pixel = 0.2645mm (at 96 DPI)
const pxToMm=0.2645;
REF_IMAGE.img=img;
REF_IMAGE.width=img.width*pxToMm;
REF_IMAGE.height=img.height*pxToMm;
REF_IMAGE.x=0;
REF_IMAGE.y=0;
REF_IMAGE.scale=1;
document.getElementById('cfg-refScale').value=1;
document.getElementById('cfg-refScale-num').value=1;
this.draw();
};
img.src=ev.target.result;
};
reader.readAsDataURL(file);
e.target.value='';
}
updateRefScale(val){
REF_IMAGE.scale=parseFloat(val)||1;
document.getElementById('cfg-refScale').value=REF_IMAGE.scale;
document.getElementById('cfg-refScale-num').value=REF_IMAGE.scale;
this.draw();
}
clearRefImage(){
REF_IMAGE.img=null;
REF_IMAGE.width=0;
REF_IMAGE.height=0;
REF_IMAGE.calibrating=false;
REF_IMAGE.calPt1=null;
REF_IMAGE.calPt2=null;
this.draw();
}
startCalibration(){
if(!REF_IMAGE.img){alert('Load an image first');return}
REF_IMAGE.calibrating=true;
REF_IMAGE.calPt1=null;
REF_IMAGE.calPt2=null;
document.getElementById('btn-calibrate').textContent='📏 Click point 1...';
document.getElementById('btn-calibrate').style.background='#5a2a2a';
// Close settings panel so clicks go to canvas
if(this.settingsOpen)this.toggleSettings();
this.draw();
}
handleCalibrationClick(w){
console.log('Calibration click:', w, 'calPt1:', REF_IMAGE.calPt1, 'calPt2:', REF_IMAGE.calPt2);
if(!REF_IMAGE.calPt1){
REF_IMAGE.calPt1={x:w.x,y:w.y};
console.log('Set calPt1');
this.draw();
}else if(!REF_IMAGE.calPt2){
REF_IMAGE.calPt2={x:w.x,y:w.y};
console.log('Set calPt2, showing modal');
this.draw();
// Show custom modal instead of prompt (prompt doesn't work on iOS)
document.getElementById('calibration-modal').style.display='flex';
document.getElementById('calibration-distance').focus();
document.getElementById('calibration-distance').select();
}
}
cancelCalibration(){
document.getElementById('calibration-modal').style.display='none';
REF_IMAGE.calibrating=false;
REF_IMAGE.calPt1=null;
REF_IMAGE.calPt2=null;
document.getElementById('btn-calibrate').textContent='📏 Calibrate Scale';
document.getElementById('btn-calibrate').style.background='#2a5a2a';
this.draw();
}
applyCalibration(){
const realDist=document.getElementById('calibration-distance').value;
document.getElementById('calibration-modal').style.display='none';
if(realDist&&!isNaN(parseFloat(realDist))){
const pxDist=M.dist(REF_IMAGE.calPt1,REF_IMAGE.calPt2);
const realMm=parseFloat(realDist);
const newScale=realMm/pxDist*REF_IMAGE.scale;
REF_IMAGE.scale=newScale;
document.getElementById('cfg-refScale').value=Math.min(5,newScale);
document.getElementById('cfg-refScale-num').value=newScale.toFixed(3);
}
REF_IMAGE.calibrating=false;
REF_IMAGE.calPt1=null;
REF_IMAGE.calPt2=null;
document.getElementById('btn-calibrate').textContent='📏 Calibrate Scale';
document.getElementById('btn-calibrate').style.background='#2a5a2a';
this.draw();
}
toggleOutliner(){this.outlinerOpen=!this.outlinerOpen;document.getElementById('outliner-panel').classList.toggle('open',this.outlinerOpen);document.getElementById('outliner-btn').style.display=this.outlinerOpen?'none':'flex';document.getElementById('settings-btn').style.display=this.outlinerOpen?'none':'flex';if(this.outlinerOpen){this.updateOutliner();if(this.settingsOpen)this.toggleSettings()}}
updateOutliner(){
const c=document.getElementById('outliner-content');
const makeItem=(type,idx,icon,name,item)=>{
const sel=SELECTED?.type===type&&SELECTED?.idx===idx;
const hidden=item?.hidden;
const locked=item?.locked;
return '<div class="outliner-item'+(sel?' selected':'')+(hidden?' hidden-item':'')+(locked?' locked-item':'')+'" draggable="true" data-type="'+type+'" data-idx="'+idx+'" onclick="app.selectOutlinerItem(\''+type+'\','+idx+')" ondblclick="event.stopPropagation();app.renameItem(\''+type+'\','+idx+')" ondragstart="app.outlinerDragStart(event)" ondragover="app.outlinerDragOver(event)" ondrop="app.outlinerDrop(event,\''+type+'\','+idx+')"><span class="vis-toggle" onclick="event.stopPropagation();app.toggleItemVis(\''+type+'\','+idx+')">'+(hidden?'○':'●')+'</span><span class="lock-toggle" onclick="event.stopPropagation();app.toggleItemLock(\''+type+'\','+idx+')">'+(locked?'🔒':'🔓')+'</span><span class="icon">'+icon+'</span><span class="name">'+name+'</span></div>';
};
let html='';
// Show current layer info in two-layer mode
if(CFG.projectType==='two-layer'){
html+='<h3 style="color:'+(CURRENT_LAYER==='front'?'#007AFF':'#FF9500')+'">'+(CURRENT_LAYER==='front'?'Front':'Back')+' Layer</h3>';
}else{
html+='<h3>Pattern</h3>';
}
const holsterSel=SELECTED?.type==='holster';
html+='<div class="outliner-item'+(holsterSel?' selected':'')+(HOLSTER.locked?' locked-item':'')+'" onclick="app.selectOutlinerItem(\'holster\',0)"><span class="lock-toggle" onclick="event.stopPropagation();app.toggleItemLock(\'holster\',0)">'+(HOLSTER.locked?'🔒':'🔓')+'</span><span class="icon">◇</span><span class="name">Main Shape</span></div>';
if(EDGE_RANGES.length||MERGED_EDGE_RANGES.length){
html+='<h3>Edge Ranges</h3>';
EDGE_RANGES.forEach((r,i)=>{html+=makeItem('edgeRange',i,'⊢',r.name||'Range '+(i+1),r)});
MERGED_EDGE_RANGES.forEach((r,i)=>{html+=makeItem('mergedEdgeRange',i,'⊡',r.name||'Perimeter '+(i+1),r)});
}
if(SYM_HOLES.length||ASYM_HOLES.length){
html+='<h3>Holes</h3>';
SYM_HOLES.forEach((h,i)=>{html+=makeItem('symHole',i,'○',h.name||'Sym Hole '+(i+1),h)});
ASYM_HOLES.forEach((h,i)=>{html+=makeItem('asymHole',i,'○',h.name||'Asym Hole '+(i+1),h)});
}
if(SYM_CUSTOM_HOLES.length||ASYM_CUSTOM_HOLES.length){
html+='<h3>Custom Holes</h3>';
SYM_CUSTOM_HOLES.forEach((h,i)=>{html+=makeItem('symCustomHole',i,'✏',h.name||'Sym Custom '+(i+1),h)});
ASYM_CUSTOM_HOLES.forEach((h,i)=>{html+=makeItem('asymCustomHole',i,'✏',h.name||'Asym Custom '+(i+1),h)});
}
if(SYM_STITCHES.length||ASYM_STITCHES.length||EDGE_STITCHES.length){
html+='<h3>Stitch Lines</h3>';
EDGE_STITCHES.forEach((s,i)=>{
const icon=s.isMerged?'⊡':'⊢';
const name=s.name||(s.isMerged?'Perim Stitch':'Edge Stitch')+' '+(i+1);
html+=makeItem('edgeStitch',i,icon,name,s);
});
SYM_STITCHES.forEach((s,i)=>{html+=makeItem('symStitch',i,'┅',s.name||'Sym Stitch '+(i+1),s)});
ASYM_STITCHES.forEach((s,i)=>{html+=makeItem('asymStitch',i,'┅',s.name||'Asym Stitch '+(i+1),s)});
}
if(ASYM_SHAPES.length){
html+='<h3>Shapes</h3>';
ASYM_SHAPES.forEach((s,i)=>{
const icon=s.isExtension?'⊕':s.isLinkedCircle?'◎':'◇';
const name=s.name||(s.isExtension?'Extension':s.isLinkedCircle?'Linked Circle':'Shape')+' '+(i+1);
html+=makeItem('asymShape',i,icon,name,s);
});
}
if(TEXT_ANNOTATIONS.length){
html+='<h3>Text</h3>';
TEXT_ANNOTATIONS.forEach((t,i)=>{html+=makeItem('textAnnotation',i,'T',t.name||t.text||'(empty)',t)});
}
c.innerHTML=html;
}
toggleItemVis(type,idx){
const item=this.getItemByTypeIdx(type,idx);
if(item){item.hidden=!item.hidden;this.updateOutliner();this.draw()}
}
toggleItemLock(type,idx){
if(type==='holster'){
HOLSTER.locked=!HOLSTER.locked;
}else{
const item=this.getItemByTypeIdx(type,idx);
if(item){item.locked=!item.locked}
}
this.updateOutliner();this.draw();
}
getItemByTypeIdx(type,idx){
if(type==='symHole')return SYM_HOLES[idx];
if(type==='asymHole')return ASYM_HOLES[idx];
if(type==='symCustomHole')return SYM_CUSTOM_HOLES[idx];
if(type==='asymCustomHole')return ASYM_CUSTOM_HOLES[idx];
if(type==='symStitch')return SYM_STITCHES[idx];
if(type==='asymStitch')return ASYM_STITCHES[idx];
if(type==='edgeStitch')return EDGE_STITCHES[idx];
if(type==='edgeRange')return EDGE_RANGES[idx];
if(type==='mergedEdgeRange')return MERGED_EDGE_RANGES[idx];
if(type==='asymShape')return ASYM_SHAPES[idx];
if(type==='textAnnotation')return TEXT_ANNOTATIONS[idx];
return null;
}
outlinerDragStart(e){
const item=e.target.closest('.outliner-item');
if(!item)return;
e.dataTransfer.setData('text/plain',item.dataset.type+','+item.dataset.idx);
e.dataTransfer.effectAllowed='move';
}
outlinerDragOver(e){
e.preventDefault();
e.dataTransfer.dropEffect='move';
document.querySelectorAll('.outliner-item').forEach(i=>i.classList.remove('drag-over'));
const item=e.target.closest('.outliner-item');
if(item)item.classList.add('drag-over');
}
outlinerDrop(e,targetType,targetIdx){
e.preventDefault();
document.querySelectorAll('.outliner-item').forEach(i=>i.classList.remove('drag-over'));
const data=e.dataTransfer.getData('text/plain').split(',');
if(data.length!==2)return;
const srcType=data[0],srcIdx=parseInt(data[1]);
if(srcType===targetType&&srcIdx===targetIdx)return;
const srcObj=this.getObjByTypeIdx(srcType,srcIdx);
const targetObj=this.getObjByTypeIdx(targetType,targetIdx);
if(srcObj){
srcObj.parent={type:targetType,idx:targetIdx};
this.updateOutliner();
}
}
renameItem(type,idx){
const obj=this.getObjByTypeIdx(type,idx);
if(!obj)return;
const item=document.querySelector(`.outliner-item[data-type="${type}"][data-idx="${idx}"]`);
if(!item)return;
const nameSpan=item.querySelector('.name');
if(!nameSpan)return;
const current=obj.name||nameSpan.textContent;
// Create inline input
const input=document.createElement('input');
input.type='text';
input.value=current;
input.style.cssText='width:100%;padding:2px;font-size:12px;border:1px solid #007AFF;border-radius:3px;background:#333;color:#fff;';
nameSpan.innerHTML='';
nameSpan.appendChild(input);
input.focus();
input.select();
const finishEdit=()=>{
obj.name=input.value||current;
this.updateOutliner();
this.saveState();
};
input.addEventListener('blur',finishEdit);
input.addEventListener('keydown',e=>{
if(e.key==='Enter'){e.preventDefault();finishEdit();}
if(e.key==='Escape'){e.preventDefault();this.updateOutliner();}
});
}
selectOutlinerItem(type,idx){SELECTED={type,idx};this.updateInfo();this.updateOutliner();this.draw()}
getObjByTypeIdx(type,idx){
if(type==='symHole')return SYM_HOLES[idx];
if(type==='asymHole')return ASYM_HOLES[idx];
if(type==='symStitch')return SYM_STITCHES[idx];
if(type==='asymStitch')return ASYM_STITCHES[idx];
if(type==='symCustomHole')return SYM_CUSTOM_HOLES[idx];
if(type==='asymCustomHole')return ASYM_CUSTOM_HOLES[idx];
if(type==='asymShape')return ASYM_SHAPES[idx];
if(type==='textAnnotation')return TEXT_ANNOTATIONS[idx];
if(type==='edgeRange')return EDGE_RANGES[idx];
if(type==='edgeStitch')return EDGE_STITCHES[idx];
return null;
}
updateCfg(key,val){
if(typeof CFG[key]==='number')CFG[key]=parseFloat(val);
else if(typeof CFG[key]==='boolean')CFG[key]=!!val;
else CFG[key]=val;
// Handle project type change
if(key==='projectType'){
this.onProjectTypeChange(val);
}
// Handle asymmetric outline toggle
if(key==='asymmetricOutline'){
this.onAsymmetricOutlineChange(val);
}
this.draw();
}
setupEvents(){
window.addEventListener('resize',()=>this.resize());
this.canvas.addEventListener('wheel',e=>{e.preventDefault();if(PUBLISH_MODE){PUBLISH_VIEW.scale*=e.deltaY>0?.9:1.1;PUBLISH_VIEW.scale=Math.max(.3,Math.min(3,PUBLISH_VIEW.scale))}else{VIEW.zoom*=e.deltaY>0?.9:1.1;VIEW.zoom=Math.max(.2,Math.min(4,VIEW.zoom));this.updateZoomIndicator()}this.draw()},{passive:false});
this.canvas.addEventListener('mousedown',e=>this.onDown(e));
this.canvas.addEventListener('mousemove',e=>this.onMove(e));
window.addEventListener('mouseup',()=>this.onUp());
// Touch support with 2-finger pan and pinch zoom
let lastTouches=null;
this.canvas.addEventListener('touchstart',e=>{
e.preventDefault();
if(e.touches.length===1){
// Create a mouse-like event object from touch
const touch=e.touches[0];
const fakeEvent={clientX:touch.clientX,clientY:touch.clientY,button:0,preventDefault:()=>{}};
this.onDown(fakeEvent);
}
else if(e.touches.length===2){lastTouches=[{x:e.touches[0].clientX,y:e.touches[0].clientY},{x:e.touches[1].clientX,y:e.touches[1].clientY}];isPanning=true}
},{passive:false});
this.canvas.addEventListener('touchmove',e=>{
e.preventDefault();
if(e.touches.length===1&&!isPanning){
const touch=e.touches[0];
const fakeEvent={clientX:touch.clientX,clientY:touch.clientY,button:0,preventDefault:()=>{}};
this.onMove(fakeEvent);
}
else if(e.touches.length===2&&lastTouches){
const t=[{x:e.touches[0].clientX,y:e.touches[0].clientY},{x:e.touches[1].clientX,y:e.touches[1].clientY}];
// Pan: move by average delta
const dx=((t[0].x+t[1].x)-(lastTouches[0].x+lastTouches[1].x))/2;
const dy=((t[0].y+t[1].y)-(lastTouches[0].y+lastTouches[1].y))/2;
VIEW.x+=dx;VIEW.y+=dy;
// Pinch zoom
const d0=Math.hypot(lastTouches[1].x-lastTouches[0].x,lastTouches[1].y-lastTouches[0].y);
const d1=Math.hypot(t[1].x-t[0].x,t[1].y-t[0].y);
if(d0>10){VIEW.zoom*=d1/d0;VIEW.zoom=Math.max(.2,Math.min(4,VIEW.zoom))}
lastTouches=t;this.draw()}
},{passive:false});
this.canvas.addEventListener('touchend',e=>{if(e.touches.length<2){lastTouches=null;isPanning=false}if(e.touches.length===0)this.onUp()});
this.canvas.addEventListener('dblclick',e=>{e.preventDefault();this.onDblClick(e)});
this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
const ae=document.activeElement;
const isInput=ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.tagName==='SELECT');
if(e.code==='Space'&&!e.repeat&&!isInput){e.preventDefault();isPanning=true;this.canvas.style.cursor='grab'}
if(e.shiftKey)SHIFT_HELD=true;
if(e.code==='Escape'){if(this.editingTextIdx!==undefined)this.stopTextEdit();else if(MODE!=='select')this.cancelMode();else{SELECTED=null;this.updateInfo();this.draw()}}
if(e.code==='Enter'&&MODE!=='select'&&!isInput)this.finishMode();
if((e.code==='Delete'||e.code==='Backspace')&&!isInput){e.preventDefault();this.deleteSelected()}
// Undo/Redo shortcuts
if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'&&!e.shiftKey&&!isInput){e.preventDefault();this.undo()}
if((e.ctrlKey||e.metaKey)&&(e.code==='KeyY'||(e.code==='KeyZ'&&e.shiftKey))&&!isInput){e.preventDefault();this.redo()}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){isPanning=false;this.canvas.style.cursor='default'}if(!e.shiftKey)SHIFT_HELD=false});
}
resize(){const w=innerWidth,h=innerHeight;this.canvas.width=w*this.dpr;this.canvas.height=h*this.dpr;this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.off.width=this.canvas.width;this.off.height=this.canvas.height;VIEW.x=w/2;VIEW.y=h/2;this.draw()}
resetView(){VIEW.zoom=1;VIEW.x=innerWidth/2;VIEW.y=innerHeight/2;this.updateZoomIndicator();this.draw()}
setLayer(l){LAYER=l;document.querySelector('.layer-btn.sym').classList.toggle('active',l==='symmetric');document.querySelector('.layer-btn.asym').classList.toggle('active',l==='asymmetric');CFG.showSymmetric=true;CFG.showAsymmetric=true;this.draw()}
// Two-Layer Mode functions
onProjectTypeChange(type){
// Toggle UI elements based on project type
const isTwoLayer=type==='two-layer';
document.getElementById('layer-toggle').style.display=isTwoLayer?'none':'flex';
document.getElementById('two-layer-toggle').style.display=isTwoLayer?'flex':'none';
document.getElementById('two-layer-sync').style.display=isTwoLayer?'block':'none';
document.getElementById('two-layer-ghost').style.display=isTwoLayer?'block':'none';
document.getElementById('two-layer-actions').style.display=isTwoLayer?'flex':'none';
document.getElementById('publish-layout').style.display=isTwoLayer?'inline-block':'none';
// Initialize layers if switching to two-layer mode
if(isTwoLayer&&!FRONT_LAYER){
this.initializeLayers();
CURRENT_LAYER='front';
this.updateLayerUI();
}
// Show notification
this.showToast(isTwoLayer?'Switched to Two-Layer Mode':'Switched to Fold-Over Mode','info');
}
onAsymmetricOutlineChange(enabled){
// When enabling asymmetric mode, convert current mirrored outline to full perimeter
if(enabled){
// Get the current mirrored pattern path
const rightPath=this.getRightHalfPath(false);
// Create full perimeter by combining right side and mirrored left side
const fullPerimeter=[];
// Add right side nodes (top to bottom)
rightPath.forEach(p=>fullPerimeter.push({x:p.x,y:p.y}));
// Add mirrored left side nodes (bottom to top, reversed)
for(let i=rightPath.length-1;i>=0;i--){
const p=rightPath[i];
fullPerimeter.push({x:-p.x,y:p.y});
}
// Convert to nodes with handles
const newNodes=[];
const step=Math.max(1,Math.floor(fullPerimeter.length/(NODES.length||10))); // Sample to keep reasonable node count
for(let i=0;i<fullPerimeter.length;i+=step){
const p=fullPerimeter[i];
newNodes.push({x:p.x,y:p.y,h1:{x:0,y:0},h2:{x:0,y:0}});
}
// Ensure we have at least the last point (use tolerance for floating-point comparison)
if(newNodes.length>0&&(Math.abs(newNodes[newNodes.length-1].x-fullPerimeter[fullPerimeter.length-1].x)>0.001||Math.abs(newNodes[newNodes.length-1].y-fullPerimeter[fullPerimeter.length-1].y)>0.001)){
const p=fullPerimeter[fullPerimeter.length-1];
newNodes.push({x:p.x,y:p.y,h1:{x:0,y:0},h2:{x:0,y:0}});
}
NODES=newNodes;
this.smoothHandlesClosed(NODES);
this.showToast('Asymmetric Outline enabled - nodes now define full perimeter','info');
}else{
// When disabling, convert back to right-half only
// Keep only nodes with x >= 0, and ensure first/last are on fold line
NODES=NODES.filter(n=>n.x>=0);
if(NODES.length>0){
NODES[0].x=0;
NODES[NODES.length-1].x=0;
}
this.showToast('Asymmetric Outline disabled - nodes define right half only','info');
}
this.saveState();
this.draw();
}
initializeLayers(){
// Save current state as front layer
FRONT_LAYER=this.captureLayerState();
// Initialize back layer as copy of front
BACK_LAYER=JSON.parse(JSON.stringify(FRONT_LAYER));
}
captureLayerState(){
return{
NODES:JSON.parse(JSON.stringify(NODES)),
EDGE_RANGES:JSON.parse(JSON.stringify(EDGE_RANGES)),
MERGED_EDGE_RANGES:JSON.parse(JSON.stringify(MERGED_EDGE_RANGES)),
EDGE_STITCHES:JSON.parse(JSON.stringify(EDGE_STITCHES)),
SYM_HOLES:JSON.parse(JSON.stringify(SYM_HOLES)),
SYM_STITCHES:JSON.parse(JSON.stringify(SYM_STITCHES)),
SYM_CUSTOM_HOLES:JSON.parse(JSON.stringify(SYM_CUSTOM_HOLES)),
ASYM_HOLES:JSON.parse(JSON.stringify(ASYM_HOLES)),
ASYM_STITCHES:JSON.parse(JSON.stringify(ASYM_STITCHES)),
ASYM_CUSTOM_HOLES:JSON.parse(JSON.stringify(ASYM_CUSTOM_HOLES)),
ASYM_SHAPES:JSON.parse(JSON.stringify(ASYM_SHAPES)),
TEXT_ANNOTATIONS:JSON.parse(JSON.stringify(TEXT_ANNOTATIONS))
};
}
restoreLayerState(state){
NODES=JSON.parse(JSON.stringify(state.NODES));
EDGE_RANGES=JSON.parse(JSON.stringify(state.EDGE_RANGES));
MERGED_EDGE_RANGES=JSON.parse(JSON.stringify(state.MERGED_EDGE_RANGES));
EDGE_STITCHES=JSON.parse(JSON.stringify(state.EDGE_STITCHES));
SYM_HOLES=JSON.parse(JSON.stringify(state.SYM_HOLES));
SYM_STITCHES=JSON.parse(JSON.stringify(state.SYM_STITCHES));
SYM_CUSTOM_HOLES=JSON.parse(JSON.stringify(state.SYM_CUSTOM_HOLES));
ASYM_HOLES=JSON.parse(JSON.stringify(state.ASYM_HOLES));
ASYM_STITCHES=JSON.parse(JSON.stringify(state.ASYM_STITCHES));
ASYM_CUSTOM_HOLES=JSON.parse(JSON.stringify(state.ASYM_CUSTOM_HOLES));
ASYM_SHAPES=JSON.parse(JSON.stringify(state.ASYM_SHAPES));
TEXT_ANNOTATIONS=JSON.parse(JSON.stringify(state.TEXT_ANNOTATIONS));
}
switchLayer(layer){
if(CFG.projectType!=='two-layer')return;
// Save current layer state
if(CURRENT_LAYER==='front'){
FRONT_LAYER=this.captureLayerState();
}else{
BACK_LAYER=this.captureLayerState();
}
// Switch to new layer
CURRENT_LAYER=layer;
const targetState=layer==='front'?FRONT_LAYER:BACK_LAYER;
this.restoreLayerState(targetState);
// Update UI
this.updateLayerUI();
SELECTED=null;
this.updateInfo();
this.updateOutliner();
this.draw();
this.showToast(`Editing ${layer==='front'?'Front':'Back'} Layer`,layer==='front'?'info':'success');
}
updateLayerUI(){
// Update toggle buttons
document.querySelector('.layer-btn.front')?.classList.toggle('active',CURRENT_LAYER==='front');
document.querySelector('.layer-btn.back')?.classList.toggle('active',CURRENT_LAYER==='back');
// Update canvas background tint
this.canvas.classList.remove('layer-front','layer-back');
if(CFG.projectType==='two-layer'){
this.canvas.classList.add('layer-'+CURRENT_LAYER);
}
// Update properties bar prefix
const selTitle=document.getElementById('sel-type');
if(selTitle&&CFG.projectType==='two-layer'){
const prefix=CURRENT_LAYER==='front'?'[Front] ':'[Back] ';
const baseText=selTitle.textContent.replace(/^\[(Front|Back)\] /,'');
selTitle.textContent=prefix+baseText;
}
}
duplicateLayer(direction){
if(CFG.projectType!=='two-layer')return;
const msg=direction==='toBack'?
'Copy all Front layer data to Back layer? This will overwrite the Back layer.':
'Copy all Back layer data to Front layer? This will overwrite the Front layer.';
if(!confirm(msg))return;
if(direction==='toBack'){
// Save current front state and copy to back
if(CURRENT_LAYER==='front'){
FRONT_LAYER=this.captureLayerState();
}
BACK_LAYER=JSON.parse(JSON.stringify(FRONT_LAYER));
if(CURRENT_LAYER==='back'){
this.restoreLayerState(BACK_LAYER);
}
this.showToast('Front layer copied to Back','success');
}else{
// Save current back state and copy to front
if(CURRENT_LAYER==='back'){
BACK_LAYER=this.captureLayerState();
}
FRONT_LAYER=JSON.parse(JSON.stringify(BACK_LAYER));
if(CURRENT_LAYER==='front'){
this.restoreLayerState(FRONT_LAYER);
}
this.showToast('Back layer copied to Front','success');
}
this.updateInfo();
this.updateOutliner();
this.draw();
this.saveState();
}
resetToMaster(){
if(CFG.projectType!=='two-layer')return;
if(!confirm('Reset Back layer to match Front layer? This will overwrite all Back layer data.'))return;
// Copy front to back
BACK_LAYER=JSON.parse(JSON.stringify(FRONT_LAYER));
// If currently on back layer, restore it
if(CURRENT_LAYER==='back'){
this.restoreLayerState(BACK_LAYER);
this.updateInfo();
this.updateOutliner();
this.draw();
}
this.showToast('Back layer reset to master','success');
this.saveState();
}
resetGhostPosition(){
if(CFG.projectType!=='two-layer')return;
GHOST_OFFSET.x=0;
GHOST_OFFSET.y=0;
this.draw();
this.showToast('Ghost layer position reset','info');
}
// Sync functions for two-layer mode
syncOutlineToBack(){
if(CFG.projectType!=='two-layer'||!CFG.syncOutline||CURRENT_LAYER!=='front')return;
// Save current front layer
FRONT_LAYER=this.captureLayerState();
// Update back layer's outline
if(BACK_LAYER){
BACK_LAYER.NODES=JSON.parse(JSON.stringify(FRONT_LAYER.NODES));
BACK_LAYER.EDGE_RANGES=JSON.parse(JSON.stringify(FRONT_LAYER.EDGE_RANGES));
BACK_LAYER.MERGED_EDGE_RANGES=JSON.parse(JSON.stringify(FRONT_LAYER.MERGED_EDGE_RANGES));
}
}
syncEdgeStitchesToBack(){
if(CFG.projectType!=='two-layer'||!CFG.syncEdgeStitches||CURRENT_LAYER!=='front')return;
// Save current front layer
FRONT_LAYER=this.captureLayerState();
// Update back layer's edge stitches
if(BACK_LAYER){
BACK_LAYER.EDGE_STITCHES=JSON.parse(JSON.stringify(FRONT_LAYER.EDGE_STITCHES));
}
}
selectHolster(){SELECTED={type:'holster'};this.updateInfo();this.draw()}
setMode(m){MODE=m;TEMP_STITCH=null;TEMP_SHAPE=null;TEMP_CUSTOMHOLE=null;
document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active','orange','purple'));
const toolId='tool-'+m;const btn=document.getElementById(toolId);
if(btn){btn.classList.add('active');if(m==='shape'||m==='hole'||m==='customhole')btn.classList.add('orange');if(m==='stitch')btn.classList.add('purple')}
else document.getElementById('tool-select').classList.add('active');
const ind=document.getElementById('mode-indicator');
if(m==='hole'){ind.querySelector('.mode-text').textContent=LAYER==='asymmetric'?'○ Single Hole':'○ Mirrored Hole';ind.className='active orange';this.canvas.style.cursor='copy'}
else if(m==='customhole'){ind.querySelector('.mode-text').textContent=LAYER==='asymmetric'?'✎ Single Custom':'✎ Mirrored Custom';ind.className='active orange';this.canvas.style.cursor='crosshair'}
else if(m==='stitch'){ind.querySelector('.mode-text').textContent=LAYER==='asymmetric'?'┅ Single Stitch':'┅ Mirrored Stitch';ind.className='active purple';this.canvas.style.cursor='copy'}
else if(m==='text'){ind.querySelector('.mode-text').textContent='T Add Text';ind.className='active';this.canvas.style.cursor='text'}
else if(m==='shape'){ind.querySelector('.mode-text').textContent='◇ Single Shape';ind.className='active orange';this.canvas.style.cursor='crosshair';LAYER='asymmetric';this.setLayer('asymmetric')}
else{ind.className='';this.canvas.style.cursor='default'}
this.draw()}
finishMode(){if(MODE==='stitch'&&TEMP_STITCH&&TEMP_STITCH.points.length>=2){const ns={points:TEMP_STITCH.points.map(p=>({x:p.x,y:p.y,h1:{x:0,y:0},h2:{x:0,y:0}})),spacing:4};this.smoothHandles(ns.points);if(LAYER==='asymmetric')ASYM_STITCHES.push(ns);else{ns.points=ns.points.map(p=>{const lp=M.worldToHolster(p);return{x:Math.abs(lp.x),y:lp.y,h1:p.h1,h2:p.h2}});SYM_STITCHES.push(ns)}TEMP_STITCH=null;this.saveState()}if(MODE==='shape'&&TEMP_SHAPE&&TEMP_SHAPE.points.length>=3){const b=M.getBounds(TEMP_SHAPE.points);ASYM_SHAPES.push({points:TEMP_SHAPE.points.map(p=>({x:p.x-b.cx,y:p.y-b.cy})),x:b.cx,y:b.cy,rotation:0,scaleX:1,scaleY:1,stitchBorder:false,stitchMargin:3,stitchSpacing:3});TEMP_SHAPE=null;this.saveState()}if(MODE==='customhole'&&TEMP_CUSTOMHOLE&&TEMP_CUSTOMHOLE.points.length>=3){const b=M.getBounds(TEMP_CUSTOMHOLE.points);const pts=TEMP_CUSTOMHOLE.points.map(p=>({x:p.x-b.cx,y:p.y-b.cy,h1:{x:0,y:0},h2:{x:0,y:0}}));this.smoothHandlesClosed(pts);if(LAYER==='asymmetric'){ASYM_CUSTOM_HOLES.push({points:pts,x:b.cx,y:b.cy,rotation:0,scaleX:1,scaleY:1,stitchBorder:false,stitchMargin:3,stitchSpacing:3})}else{const lc=M.worldToHolster({x:b.cx,y:b.cy});const localPts=pts.map(p=>{const wp={x:p.x+b.cx,y:p.y+b.cy};const lp=M.worldToHolster(wp);return{x:lp.x-lc.x,y:lp.y-lc.y,h1:{x:p.h1.x/HOLSTER.scaleX,y:p.h1.y/HOLSTER.scaleY},h2:{x:p.h2.x/HOLSTER.scaleX,y:p.h2.y/HOLSTER.scaleY}}});SYM_CUSTOM_HOLES.push({points:localPts,x:Math.abs(lc.x),y:lc.y,rotation:0,scaleX:1,scaleY:1,stitchBorder:false,stitchMargin:3,stitchSpacing:3})}TEMP_CUSTOMHOLE=null;this.saveState()}this.setMode('select')}
smoothHandles(pts){if(pts.length<2)return;for(let i=0;i<pts.length;i++){const p=pts[i-1],c=pts[i],n=pts[i+1];if(p&&n){const dx=n.x-p.x,dy=n.y-p.y,len=Math.hypot(dx,dy)*.25,ang=Math.atan2(dy,dx);c.h1={x:-Math.cos(ang)*len,y:-Math.sin(ang)*len};c.h2={x:Math.cos(ang)*len,y:Math.sin(ang)*len}}else if(n){c.h2={x:(n.x-c.x)*.25,y:(n.y-c.y)*.25};c.h1={x:0,y:0}}else if(p){c.h1={x:-(c.x-p.x)*.25,y:-(c.y-p.y)*.25};c.h2={x:0,y:0}}}}
smoothHandlesClosed(pts){if(pts.length<3)return;for(let i=0;i<pts.length;i++){const p=pts[(i-1+pts.length)%pts.length],c=pts[i],n=pts[(i+1)%pts.length];const dx=n.x-p.x,dy=n.y-p.y,len=Math.hypot(dx,dy)*.25,ang=Math.atan2(dy,dx);c.h1={x:-Math.cos(ang)*len,y:-Math.sin(ang)*len};c.h2={x:Math.cos(ang)*len,y:Math.sin(ang)*len}}}
cancelMode(){TEMP_STITCH=null;TEMP_SHAPE=null;TEMP_CUSTOMHOLE=null;this.setMode('select')}
addEdgeRange(){EDGE_RANGES.push({start:0.1,end:0.9});SELECTED={type:'edgeRange',idx:EDGE_RANGES.length-1};this.updateInfo();this.draw();this.saveState()}
addMergedEdgeRange(){MERGED_EDGE_RANGES.push({start:0.1,end:0.9});SELECTED={type:'mergedEdgeRange',idx:MERGED_EDGE_RANGES.length-1};this.updateInfo();this.draw();this.saveState()}
generateMatchingCircle(){
try{
// Get the selected edge range index (default to 0)
let sourceRangeIdx=0;
if(SELECTED?.type==='edgeRange'){
sourceRangeIdx=SELECTED.idx;
}
// Create a linked circle that references the source edge range
ASYM_SHAPES.push({
isLinkedCircle:true,
sourceRangeIdx:sourceRangeIdx,
x:HOLSTER.x+200,y:HOLSTER.y,
rotation:0,scaleX:1,scaleY:1,
stitchBorder:true,
stitchMargin:CFG.stitchMargin
});
SELECTED={type:'asymShape',idx:ASYM_SHAPES.length-1};
this.updateInfo();
this.draw();
}catch(e){console.error('generateMatchingCircle error:',e);}
}
getLinkedCircleData(shape){
try{
const rightHalf=this.getRightHalfPath();
const rightWorld=rightHalf.map(p=>M.holsterToWorld(p));
if(rightWorld.length<3)return null;
// Use base (unoffset) path for stable percentage mapping
const baseArc=M.buildArc(rightWorld);
const baseTot=baseArc[baseArc.length-1].d;
if(baseTot<=0)return null;
const rng=EDGE_RANGES[shape.sourceRangeIdx]||EDGE_RANGES[0];
if(!rng)return null;
// Calculate length along the base path
const baseLen=baseTot*(rng.end-rng.start);
if(baseLen<=0)return null;
const radius=baseLen/(2*Math.PI);
// Calculate stitch positions
const stitchPositions=[];
const sd=baseTot*rng.start;
for(let d=sd;d<=baseTot*rng.end;d+=CFG.stitchSpacing){
stitchPositions.push((d-sd)/baseLen);
}
const circlePoints=[];
const segments=72;
for(let i=0;i<segments;i++){
const angle=(i/segments)*Math.PI*2-Math.PI/2;
circlePoints.push({x:Math.cos(angle)*radius,y:Math.sin(angle)*radius});
}
return{points:circlePoints,radius:radius,edgeLength:baseLen,stitchPositions:stitchPositions,stitchCount:stitchPositions.length};
}catch(e){console.error('getLinkedCircleData error:',e);return null;}
}
deleteSelected(){if(!SELECTED)return;if(SELECTED.type==='symHole')SYM_HOLES.splice(SELECTED.idx,1);else if(SELECTED.type==='symStitch')SYM_STITCHES.splice(SELECTED.idx,1);else if(SELECTED.type==='symCustomHole')SYM_CUSTOM_HOLES.splice(SELECTED.idx,1);else if(SELECTED.type==='asymShape')ASYM_SHAPES.splice(SELECTED.idx,1);else if(SELECTED.type==='asymHole')ASYM_HOLES.splice(SELECTED.idx,1);else if(SELECTED.type==='asymStitch')ASYM_STITCHES.splice(SELECTED.idx,1);else if(SELECTED.type==='asymCustomHole')ASYM_CUSTOM_HOLES.splice(SELECTED.idx,1);else if(SELECTED.type==='textAnnotation')TEXT_ANNOTATIONS.splice(SELECTED.idx,1);else if(SELECTED.type==='edgeRange'&&EDGE_RANGES.length>1)EDGE_RANGES.splice(SELECTED.idx,1);else if(SELECTED.type==='mergedEdgeRange')MERGED_EDGE_RANGES.splice(SELECTED.idx,1);else if(SELECTED.type==='edgeStitch')EDGE_STITCHES.splice(SELECTED.idx,1);SELECTED=null;this.updateInfo();this.updateOutliner();this.draw();this.saveState();this.showToast('Deleted', 'info')}
changeHoleShape(s){const h=this.getSelectedObj();if(h&&h.shape!==undefined){h.shape=s;if(s==='circle')h.width=h.height=Math.max(h.width,h.height);this.updateInfo();this.draw();this.saveState()}}
changeHoleWidth(v){const h=this.getSelectedObj();if(h&&h.width!==undefined){h.width=parseFloat(v);document.getElementById('sel-width').value=v;document.getElementById('sel-width-slider').value=v;this.draw()}}
changeHoleHeight(v){const h=this.getSelectedObj();if(h&&h.height!==undefined){h.height=parseFloat(v);document.getElementById('sel-height').value=v;document.getElementById('sel-height-slider').value=v;this.draw()}}
toggleStitchBorder(v){const h=this.getSelectedObj();if(h){h.stitchBorder=v;this.updateInfo();this.draw();this.saveState()}}
changeStitchMargin(v){const h=this.getSelectedObj();if(h){if(SELECTED?.type==='edgeStitch'){h.margin=parseFloat(v)}else{h.stitchMargin=parseFloat(v)}document.getElementById('sel-stitch-margin').value=v;document.getElementById('sel-stitch-margin-slider').value=v;this.draw()}}
changeStitchSpacing(v){const h=this.getSelectedObj();if(h){if(SELECTED?.type==='edgeStitch'){h.spacing=parseFloat(v)}else{h.stitchSpacing=parseFloat(v)}document.getElementById('sel-stitch-spacing').value=v;document.getElementById('sel-stitch-spacing-slider').value=v;this.draw()}}
// Text editing functions
startTextEdit(idx){
const t=TEXT_ANNOTATIONS[idx];
const ed=document.getElementById('text-editor');
const inp=document.getElementById('text-input');
// Position editor at text location
const sx=VIEW.x+t.x*VIEW.zoom,sy=VIEW.y+t.y*VIEW.zoom;
ed.style.left=sx+'px';ed.style.top=sy+'px';
inp.style.fontSize=(t.fontSize*VIEW.zoom)+'px';
inp.style.fontWeight=t.bold?'bold':'normal';
inp.style.fontStyle=t.italic?'italic':'normal';
inp.value=t.text;
ed.classList.add('active');
inp.focus();
this.editingTextIdx=idx;
this.draw();
}
stopTextEdit(){
const ed=document.getElementById('text-editor');
ed.classList.remove('active');
if(this.editingTextIdx!==undefined){
const t=TEXT_ANNOTATIONS[this.editingTextIdx];
if(t&&t.text===''){TEXT_ANNOTATIONS.splice(this.editingTextIdx,1);SELECTED=null}
}
this.editingTextIdx=undefined;
this.setMode('select');
this.updateInfo();
this.draw();
this.saveState();
}
onTextInput(e){
if(this.editingTextIdx!==undefined){
TEXT_ANNOTATIONS[this.editingTextIdx].text=e.target.value;
this.draw();
}
}
onTextKey(e){
if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();this.stopTextEdit()}
}
changeText(v){
if(SELECTED?.type==='textAnnotation'){
TEXT_ANNOTATIONS[SELECTED.idx].text=v;
this.draw();
}
}
changeFontSize(v){
if(SELECTED?.type==='textAnnotation'){
TEXT_ANNOTATIONS[SELECTED.idx].fontSize=parseInt(v)||12;
document.getElementById('sel-fontsize').value=v;
this.draw();
}
}
toggleBold(){
if(SELECTED?.type==='textAnnotation'){
const t=TEXT_ANNOTATIONS[SELECTED.idx];
t.bold=!t.bold;
document.getElementById('btn-bold').style.background=t.bold?'var(--accent)':'#333';
this.draw();
}
}
toggleItalic(){
if(SELECTED?.type==='textAnnotation'){
const t=TEXT_ANNOTATIONS[SELECTED.idx];
t.italic=!t.italic;
document.getElementById('btn-italic').style.background=t.italic?'var(--accent)':'#333';
this.draw();
}
}
// Edge stitch functions
createStitchFromRange(){
if(SELECTED?.type!=='edgeRange')return;
const rangeIdx=SELECTED.idx;
const es={
rangeIdx:rangeIdx,
isMerged:false,
margin:CFG.stitchMargin,
spacing:CFG.stitchSpacing,
holeSize:CFG.holeSize,
showLine:true,
showHoles:true,
mirror:LAYER==='symmetric', // Only mirror if in symmetric mode
name:'Stitch from Range '+(rangeIdx+1)
};
EDGE_STITCHES.push(es);
SELECTED={type:'edgeStitch',idx:EDGE_STITCHES.length-1};
this.updateInfo();
this.updateOutliner();
this.draw();
this.saveState();
}
createStitchFromMergedRange(){
if(SELECTED?.type!=='mergedEdgeRange')return;
const rangeIdx=SELECTED.idx;
const es={
rangeIdx:rangeIdx,
isMerged:true,
margin:CFG.stitchMargin,
spacing:CFG.stitchSpacing,
holeSize:CFG.holeSize,
showLine:true,
showHoles:true,
mirror:false, // No mirroring for full perimeter
name:'Stitch from Perimeter '+(rangeIdx+1)
};
EDGE_STITCHES.push(es);
SELECTED={type:'edgeStitch',idx:EDGE_STITCHES.length-1};
this.updateInfo();
this.updateOutliner();
this.draw();
this.saveState();
}
toggleEdgeStitchLine(val){
if(SELECTED?.type!=='edgeStitch')return;
EDGE_STITCHES[SELECTED.idx].showLine=val;
this.draw();
this.saveState();
}
toggleEdgeStitchHoles(val){
if(SELECTED?.type!=='edgeStitch')return;
EDGE_STITCHES[SELECTED.idx].showHoles=val;
this.draw();
this.saveState();
}
toggleEdgeStitchMirror(val){
if(SELECTED?.type!=='edgeStitch')return;
EDGE_STITCHES[SELECTED.idx].mirror=val;
this.draw();
this.saveState();
}
toggleShapeExtension(val){
if(SELECTED?.type!=='asymShape')return;
ASYM_SHAPES[SELECTED.idx].isExtension=val;
this.updateInfo();
this.draw();
this.saveState();
}
linkHandles(){
if(SELECTED?.type!=='node')return;
const n=NODES[SELECTED.idx];
if(!n)return;
// Calculate the average length of both handles
const len1=Math.hypot(n.h1.x,n.h1.y);
const len2=Math.hypot(n.h2.x,n.h2.y);
const avgLen=(len1+len2)/2||10;
// Use h2's direction, make h1 opposite
const angle=Math.atan2(n.h2.y,n.h2.x);
n.h2={x:Math.cos(angle)*avgLen,y:Math.sin(angle)*avgLen};
n.h1={x:-n.h2.x,y:-n.h2.y};
// Mark as linked
n.linked=true;
this.updateInfo(); // Update button text
this.draw();
this.saveState();
}
breakHandles(){
if(SELECTED?.type!=='node')return;
const n=NODES[SELECTED.idx];
if(!n)return;
n.linked=false;
this.updateInfo(); // Update button text
this.draw();
this.saveState();
}
toggleHandleLink(){
if(SELECTED?.type!=='node')return;
const n=NODES[SELECTED.idx];
if(!n)return;
if(n.linked){
this.breakHandles();
}else{
this.linkHandles();
}
}
getSelectedObj(){if(SELECTED?.type==='symHole')return SYM_HOLES[SELECTED.idx];if(SELECTED?.type==='asymHole')return ASYM_HOLES[SELECTED.idx];if(SELECTED?.type==='symCustomHole')return SYM_CUSTOM_HOLES[SELECTED.idx];if(SELECTED?.type==='asymCustomHole')return ASYM_CUSTOM_HOLES[SELECTED.idx];if(SELECTED?.type==='asymShape')return ASYM_SHAPES[SELECTED.idx];if(SELECTED?.type==='symStitch')return SYM_STITCHES[SELECTED.idx];if(SELECTED?.type==='asymStitch')return ASYM_STITCHES[SELECTED.idx];if(SELECTED?.type==='edgeStitch')return EDGE_STITCHES[SELECTED.idx];return null}
updateInfo(){
if(this.outlinerOpen)this.updateOutliner();
const bar=document.getElementById('props-bar'),stats=document.getElementById('stats');
if(!SELECTED){bar.classList.remove('active');stats.classList.remove('hidden');return}
bar.classList.add('active');stats.classList.add('hidden');
const propShape=document.getElementById('prop-shape'),propWidth=document.getElementById('prop-width'),propHeight=document.getElementById('prop-height'),propSize=document.getElementById('prop-size'),propText=document.getElementById('prop-text'),propFontsize=document.getElementById('prop-fontsize'),propFontstyle=document.getElementById('prop-fontstyle'),propStitch=document.getElementById('prop-stitch'),propMargin=document.getElementById('prop-margin'),propSpacing=document.getElementById('prop-spacing'),propCreateStitch=document.getElementById('prop-create-stitch'),propEsLine=document.getElementById('prop-es-line'),propEsHoles=document.getElementById('prop-es-holes'),propEsMirror=document.getElementById('prop-es-mirror'),propExtension=document.getElementById('prop-extension'),propLinkHandles=document.getElementById('prop-link-handles');
[propShape,propWidth,propHeight,propSize,propText,propFontsize,propFontstyle,propStitch,propMargin,propSpacing,propCreateStitch,propEsLine,propEsHoles,propEsMirror,propExtension,propLinkHandles].forEach(p=>p.style.display='none');
// Layer prefix for two-layer mode
const layerPrefix=CFG.projectType==='two-layer'?(CURRENT_LAYER==='front'?'[Front] ':'[Back] '):'';
if(SELECTED.type==='holster'){document.getElementById('sel-type').textContent=layerPrefix+'Main Pattern';propSize.style.display='flex';document.getElementById('sel-size').textContent=HOLSTER.scaleX.toFixed(2)+' × '+HOLSTER.scaleY.toFixed(2)}
else if(SELECTED.type==='symHole'||SELECTED.type==='asymHole'){const h=this.getSelectedObj();document.getElementById('sel-type').textContent=layerPrefix+(SELECTED.type==='symHole'?'Sym Hole':'Asym Hole');propShape.style.display='flex';propWidth.style.display='flex';propHeight.style.display='flex';propStitch.style.display='flex';document.getElementById('sel-shape').value=h.shape||'ellipse';document.getElementById('sel-width').value=h.width;document.getElementById('sel-width-slider').value=h.width;document.getElementById('sel-height').value=h.height;document.getElementById('sel-height-slider').value=h.height;document.getElementById('sel-stitch-border').checked=h.stitchBorder||false;if(h.stitchBorder){propMargin.style.display='flex';propSpacing.style.display='flex';document.getElementById('sel-stitch-margin').value=h.stitchMargin||3;document.getElementById('sel-stitch-margin-slider').value=h.stitchMargin||3;document.getElementById('sel-stitch-spacing').value=h.stitchSpacing||3;document.getElementById('sel-stitch-spacing-slider').value=h.stitchSpacing||3}}
else if(SELECTED.type==='asymShape'){const s=this.getSelectedObj();document.getElementById('sel-type').textContent=layerPrefix+(s.isExtension?'Extension Shape':s.isLinkedCircle?'Linked Circle':'Asym Shape');propSize.style.display='flex';propStitch.style.display='flex';propExtension.style.display='flex';document.getElementById('sel-size').textContent=(s.scaleX||1).toFixed(2)+' × '+(s.scaleY||1).toFixed(2);document.getElementById('sel-stitch-border').checked=s.stitchBorder||false;document.getElementById('sel-extension').checked=s.isExtension||false;if(s.stitchBorder&&!s.isExtension){propMargin.style.display='flex';propSpacing.style.display='flex';document.getElementById('sel-stitch-margin').value=s.stitchMargin||3;document.getElementById('sel-stitch-margin-slider').value=s.stitchMargin||3;document.getElementById('sel-stitch-spacing').value=s.stitchSpacing||3;document.getElementById('sel-stitch-spacing-slider').value=s.stitchSpacing||3}}
else if(SELECTED.type==='symStitch'||SELECTED.type==='asymStitch'){const st=this.getSelectedObj();document.getElementById('sel-type').textContent=layerPrefix+(SELECTED.type==='symStitch'?'Sym Stitch':'Asym Stitch');propSpacing.style.display='flex';document.getElementById('sel-stitch-spacing').value=st.spacing||4;document.getElementById('sel-stitch-spacing-slider').value=st.spacing||4}
else if(SELECTED.type==='symCustomHole'||SELECTED.type==='asymCustomHole'){const h=this.getSelectedObj();document.getElementById('sel-type').textContent=layerPrefix+(SELECTED.type==='symCustomHole'?'Sym Custom':'Asym Custom');propSize.style.display='flex';propStitch.style.display='flex';document.getElementById('sel-size').textContent=(h.scaleX||1).toFixed(2)+' × '+(h.scaleY||1).toFixed(2);document.getElementById('sel-stitch-border').checked=h.stitchBorder||false;if(h.stitchBorder){propMargin.style.display='flex';propSpacing.style.display='flex';document.getElementById('sel-stitch-margin').value=h.stitchMargin||3;document.getElementById('sel-stitch-margin-slider').value=h.stitchMargin||3;document.getElementById('sel-stitch-spacing').value=h.stitchSpacing||3;document.getElementById('sel-stitch-spacing-slider').value=h.stitchSpacing||3}}
else if(SELECTED.type==='textAnnotation'){const t=TEXT_ANNOTATIONS[SELECTED.idx];document.getElementById('sel-type').textContent=layerPrefix+'Text';propText.style.display='flex';propFontsize.style.display='flex';propFontstyle.style.display='flex';document.getElementById('sel-text').value=t.text;document.getElementById('sel-fontsize').value=t.fontSize||12;document.getElementById('btn-bold').style.background=t.bold?'var(--accent)':'#333';document.getElementById('btn-italic').style.background=t.italic?'var(--accent)':'#333'}
else if(SELECTED.type==='edgeRange'){document.getElementById('sel-type').textContent=layerPrefix+'Edge Range #'+(SELECTED.idx+1);propSize.style.display='flex';propCreateStitch.style.display='flex';const rng=EDGE_RANGES[SELECTED.idx];document.getElementById('sel-size').textContent=((rng.end-rng.start)*100).toFixed(0)+'%'}
else if(SELECTED.type==='mergedEdgeRange'){document.getElementById('sel-type').textContent=layerPrefix+'Perimeter #'+(SELECTED.idx+1);propSize.style.display='flex';propCreateStitch.style.display='flex';const rng=MERGED_EDGE_RANGES[SELECTED.idx];document.getElementById('sel-size').textContent=((rng.end-rng.start)*100).toFixed(0)+'%'}
else if(SELECTED.type==='edgeStitch'){const es=EDGE_STITCHES[SELECTED.idx];document.getElementById('sel-type').textContent=layerPrefix+(es.isMerged?'Perim Stitch #'+(SELECTED.idx+1):'Edge Stitch #'+(SELECTED.idx+1));propMargin.style.display='flex';propSpacing.style.display='flex';propEsLine.style.display='flex';propEsHoles.style.display='flex';if(!es.isMerged)propEsMirror.style.display='flex';document.getElementById('sel-stitch-margin').value=es.margin||CFG.stitchMargin;document.getElementById('sel-stitch-margin-slider').value=es.margin||CFG.stitchMargin;document.getElementById('sel-stitch-spacing').value=es.spacing||CFG.stitchSpacing;document.getElementById('sel-stitch-spacing-slider').value=es.spacing||CFG.stitchSpacing;document.getElementById('sel-es-line').checked=es.showLine!==false;document.getElementById('sel-es-holes').checked=es.showHoles!==false;document.getElementById('sel-es-mirror').checked=es.mirror!==false}
else if(SELECTED.type==='node'){const n=NODES[SELECTED.idx];document.getElementById('sel-type').textContent=layerPrefix+'Node #'+(SELECTED.idx+1);propLinkHandles.style.display='flex';
// Update button text based on linked state
const btn=document.getElementById('btn-link-handles');
if(n.linked){
btn.textContent='Break Handles';
btn.style.background='#FF9500'; // Orange for "break" action
}else{
btn.textContent='Link Handles';
btn.style.background='#007AFF'; // Blue for "link" action
}
}
else{document.getElementById('sel-type').textContent=layerPrefix+SELECTED.type}}
getPatternLocalPath(){const pts=[],steps=20;for(let i=0;i<NODES.length;i++){const c=NODES[i],nx=NODES[(i+1)%NODES.length];for(let k=0;k<steps;k++){const pt=M.bezier({x:c.x,y:c.y},{x:c.x+c.h2.x,y:c.y+c.h2.y},{x:nx.x+nx.h1.x,y:nx.y+nx.h1.y},{x:nx.x,y:nx.y},k/steps);pt.segIdx=i;pts.push(pt)}}return pts}
getRightHalfPath(includeFoldSegments=true){
// In asymmetric mode, return full perimeter
if(CFG.asymmetricOutline){
const pts=[],steps=20;
for(let i=0;i<NODES.length;i++){
const c=NODES[i],nx=NODES[(i+1)%NODES.length];
for(let k=0;k<steps;k++){
const pt=M.bezier({x:c.x,y:c.y},{x:c.x+c.h2.x,y:c.y+c.h2.y},{x:nx.x+nx.h1.x,y:nx.y+nx.h1.y},{x:nx.x,y:nx.y},k/steps);
pt.segIdx=i;pts.push(pt);
}}
return pts;
}
// Get just the right half (from top fold point down to bottom fold point)
const pts=[],steps=20;
// Add top fold segment (from fold line x=0 to first node)
if(includeFoldSegments){
const firstNode=NODES[0];
const foldSteps=Math.max(5,Math.ceil(firstNode.x/5)); // ~5mm spacing
for(let k=0;k<=foldSteps;k++){
pts.push({x:firstNode.x*k/foldSteps,y:firstNode.y,segIdx:-1});
}
}
// Add the curved edge
for(let i=0;i<NODES.length-1;i++){
const c=NODES[i],nx=NODES[i+1];
for(let k=0;k<steps;k++){
const pt=M.bezier({x:c.x,y:c.y},{x:c.x+c.h2.x,y:c.y+c.h2.y},{x:nx.x+nx.h1.x,y:nx.y+nx.h1.y},{x:nx.x,y:nx.y},k/steps);
pt.segIdx=i;pts.push(pt);
}}
// Add final node point
pts.push({x:NODES[NODES.length-1].x,y:NODES[NODES.length-1].y,segIdx:NODES.length-1});
// Add bottom fold segment (from last node back to fold line x=0)
if(includeFoldSegments){
const lastNode=NODES[NODES.length-1];
const foldSteps=Math.max(5,Math.ceil(lastNode.x/5));
for(let k=1;k<=foldSteps;k++){
pts.push({x:lastNode.x*(1-k/foldSteps),y:lastNode.y,segIdx:-1});
}
}
return pts;
}
getPatternPath(){
const right=this.getRightHalfPath(false),pts=[];
// In asymmetric mode, just transform the full perimeter to world coords
if(CFG.asymmetricOutline){
right.forEach(p=>{const wp=M.holsterToWorld(p);wp.segIdx=p.segIdx;pts.push(wp)});
return pts;
}
// Right side: top to bottom (as-is)
right.forEach(p=>{const wp=M.holsterToWorld(p);wp.segIdx=p.segIdx;pts.push(wp)});
// Left side: bottom to top (mirrored x, reverse order)
for(let i=right.length-1;i>=0;i--){
const p=right[i];
const wp=M.holsterToWorld({x:-p.x,y:p.y});
wp.segIdx=-1;
pts.push(wp);
}
return pts;
}
// Returns the pattern path with extension shapes unioned in
getMergedPatternPath(){
const basePath=this.getPatternPath();
// Find extension shapes
const extensions=ASYM_SHAPES.filter(s=>s.isExtension&&!s.hidden);
if(!extensions.length)return basePath;
// Convert base path to Clipper format
const cl=new ClipperLib.Clipper();
const basePoly=basePath.map(p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)}));
cl.AddPath(basePoly,ClipperLib.PolyType.ptSubject,true);
// Add each extension shape
extensions.forEach(s=>{
const pts=s.points.map(p=>{
const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};
const r=M.rotate(sc,s.rotation||0);
return{X:Math.round((r.x+s.x)*SCALE),Y:Math.round((r.y+s.y)*SCALE)};
});
cl.AddPath(pts,ClipperLib.PolyType.ptClip,true);
});
// Union all shapes
const solution=[];
cl.Execute(ClipperLib.ClipType.ctUnion,solution,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
if(!solution.length)return basePath;
// Convert back to world coordinates
// Find the outer path (largest area)
let maxArea=0,outerPath=solution[0];
solution.forEach(path=>{
const area=Math.abs(ClipperLib.Clipper.Area(path));
if(area>maxArea){maxArea=area;outerPath=path;}
});
return outerPath.map(p=>({x:p.X/SCALE,y:p.Y/SCALE,segIdx:-1}));
}
offsetPath(path,delta){if(!ClipperLib||path.length<3)return[];const co=new ClipperLib.ClipperOffset(),cp=path.map(p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)}));co.AddPaths([cp],ClipperLib.JoinType.jtRound,ClipperLib.EndType.etClosedPolygon);const sol=[];co.Execute(sol,delta*SCALE);if(!sol.length)return[];return sol[0].map(p=>({x:p.X/SCALE,y:p.Y/SCALE}))}
// Hybrid offset: ClipperLib for curved edge (good corners), manual for fold segments (reach center)
// Simple manual offset for open paths - offsets each point perpendicular to path
offsetPathStable(path,delta){
if(path.length<2)return path;
const result=[];
const n=path.length;
// Use HOLSTER position as the center reference (always inside the pattern)
const cx=HOLSTER.x,cy=HOLSTER.y;
for(let i=0;i<n;i++){
const curr=path[i];
// Get direction from neighboring points
let dx,dy;
if(i===0){
dx=path[1].x-path[0].x;
dy=path[1].y-path[0].y;
}else if(i===n-1){
dx=path[n-1].x-path[n-2].x;
dy=path[n-1].y-path[n-2].y;
}else{
dx=path[i+1].x-path[i-1].x;
dy=path[i+1].y-path[i-1].y;
}
const len=Math.hypot(dx,dy)||1;
// Two possible perpendicular normals
const nx1=dy/len,ny1=-dx/len;
const nx2=-dy/len,ny2=dx/len;
// Pick the one that points AWAY from center (since delta is negative, this goes inward)
const d1=Math.hypot((curr.x+nx1)-cx,(curr.y+ny1)-cy);
const d2=Math.hypot((curr.x+nx2)-cx,(curr.y+ny2)-cy);
const nx=d1>d2?nx1:nx2;
const ny=d1>d2?ny1:ny2;
result.push({x:curr.x+nx*delta,y:curr.y+ny*delta});
}
return result;
}
// Stable offset for closed paths - maintains point order
offsetPathStableClosed(path,delta){
if(path.length<3)return path;
const result=[];
const n=path.length;
const cx=HOLSTER.x,cy=HOLSTER.y;
for(let i=0;i<n;i++){
const curr=path[i];
const prev=path[(i-1+n)%n];
const next=path[(i+1)%n];
const dx=next.x-prev.x;
const dy=next.y-prev.y;
const len=Math.hypot(dx,dy)||1;
const nx1=dy/len,ny1=-dx/len;
const nx2=-dy/len,ny2=dx/len;
const d1=Math.hypot((curr.x+nx1)-cx,(curr.y+ny1)-cy);
const d2=Math.hypot((curr.x+nx2)-cx,(curr.y+ny2)-cy);
const nx=d1>d2?nx1:nx2;
const ny=d1>d2?ny1:ny2;
result.push({x:curr.x+nx*delta,y:curr.y+ny*delta});
}
return result;
}
getSymHoleWorld(hole,side){
const lx=hole.x*side,wp=M.holsterToWorld({x:lx,y:hole.y}),rot=(HOLSTER.rotation||0)+(hole.rotation||0)*side,w=hole.width*HOLSTER.scaleX,h=hole.height*HOLSTER.scaleY;
return{x:wp.x,y:wp.y,rotation:rot,width:w,height:h,shape:hole.shape,stitchBorder:hole.stitchBorder,stitchMargin:hole.stitchMargin,stitchSpacing:hole.stitchSpacing}
}
getGizmos(obj,type){const hs=[];let cx,cy,hw,hh,rot;if(type==='holster'){const b=M.getBounds(this.getPatternPath());cx=HOLSTER.x;cy=HOLSTER.y;hw=b.w/2+20;hh=b.h/2+20;rot=HOLSTER.rotation||0}else if(type==='asymShape'){
// Handle linked circles
if(obj.isLinkedCircle){const cd=this.getLinkedCircleData(obj);if(cd){cx=obj.x;cy=obj.y;hw=cd.radius*(obj.scaleX||1)+10;hh=cd.radius*(obj.scaleY||1)+10;rot=obj.rotation||0}else{cx=obj.x;cy=obj.y;hw=50;hh=50;rot=0}}
else{const pts=obj.points.map(p=>{const s={x:p.x*(obj.scaleX||1),y:p.y*(obj.scaleY||1)};const r=M.rotate(s,obj.rotation||0);return{x:r.x+obj.x,y:r.y+obj.y}});const b=M.getBounds(pts);cx=obj.x;cy=obj.y;hw=b.w/2+10;hh=b.h/2+10;rot=obj.rotation||0}
}else{cx=obj.x;cy=obj.y;hw=obj.width/2+10;hh=obj.height/2+10;rot=obj.rotation||0}
[{x:hw,y:0,t:'e'},{x:-hw,y:0,t:'w'},{x:0,y:-hh,t:'n'},{x:0,y:hh,t:'s'},{x:hw,y:-hh,t:'ne'},{x:-hw,y:-hh,t:'nw'},{x:hw,y:hh,t:'se'},{x:-hw,y:hh,t:'sw'}].forEach(s=>{const r=M.rotate(s,rot);hs.push({x:cx+r.x,y:cy+r.y,type:'scale-'+s.t})});const rp=M.rotate({x:hw+25,y:-hh-25},rot);hs.push({x:cx+rp.x,y:cy+rp.y,type:'rotate'});hs.push({x:cx,y:cy,type:'move'});return{handles:hs,cx,cy,hw,hh,rot}}
drawHole(ctx,cx,cy,rot,w,h,shape){const hw=w/2,hh=h/2;ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);ctx.beginPath();if(shape==='rectangle')ctx.rect(-hw,-hh,w,h);else if(shape==='pill'){const r=Math.min(hw,hh);if(hw>=hh){const l=hw-r;ctx.moveTo(-l,-r);ctx.lineTo(l,-r);ctx.arc(l,0,r,-Math.PI/2,Math.PI/2);ctx.lineTo(-l,r);ctx.arc(-l,0,r,Math.PI/2,-Math.PI/2)}else{const l=hh-r;ctx.moveTo(-r,-l);ctx.arc(0,-l,r,Math.PI,0);ctx.lineTo(r,l);ctx.arc(0,l,r,0,Math.PI)}ctx.closePath()}else ctx.ellipse(0,0,hw,hh,0,0,Math.PI*2);ctx.restore()}
drawShape(ctx,shape){const pts=shape.points.map(p=>{const s={x:p.x*(shape.scaleX||1),y:p.y*(shape.scaleY||1)};const r=M.rotate(s,shape.rotation||0);return{x:r.x+shape.x,y:r.y+shape.y}});ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath()}
drawGizmo(ctx,gizmo,color){color=color||'#007AFF';const hw=gizmo.hw,hh=gizmo.hh,cx=gizmo.cx,cy=gizmo.cy,rot=gizmo.rot;ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);ctx.strokeStyle=color+'99';ctx.lineWidth=1.5/VIEW.zoom;ctx.setLineDash([4/VIEW.zoom,4/VIEW.zoom]);ctx.strokeRect(-hw,-hh,hw*2,hh*2);ctx.setLineDash([]);ctx.restore();gizmo.handles.forEach(g=>{if(g.type==='move'){const sz=12/VIEW.zoom;ctx.strokeStyle=color;ctx.lineWidth=2/VIEW.zoom;ctx.beginPath();ctx.moveTo(g.x-sz,g.y);ctx.lineTo(g.x+sz,g.y);ctx.moveTo(g.x,g.y-sz);ctx.lineTo(g.x,g.y+sz);ctx.stroke()}else if(g.type==='rotate'){ctx.fillStyle='#FF9500';ctx.strokeStyle='#fff';ctx.lineWidth=2/VIEW.zoom;ctx.beginPath();ctx.arc(g.x,g.y,7/VIEW.zoom,0,Math.PI*2);ctx.fill();ctx.stroke()}else{const r=5/VIEW.zoom;ctx.fillStyle='#34C759';ctx.strokeStyle='#fff';ctx.lineWidth=1.5/VIEW.zoom;ctx.fillRect(g.x-r,g.y-r,r*2,r*2);ctx.strokeRect(g.x-r,g.y-r,r*2,r*2)}})}
getSymStitchWorld(sl,side){
return sl.points.map(p=>{const lp={x:p.x*side,y:p.y};const wp=M.holsterToWorld(lp);return{x:wp.x,y:wp.y,h1:{x:(p.h1?.x||0)*side*HOLSTER.scaleX,y:(p.h1?.y||0)*HOLSTER.scaleY},h2:{x:(p.h2?.x||0)*side*HOLSTER.scaleX,y:(p.h2?.y||0)*HOLSTER.scaleY}}})
}
getCustomHoleWorld(h,side){
// Transform custom hole points for symmetric layer with bezier curves
const pts=[],steps=10,n=h.points.length;
for(let i=0;i<n;i++){
const c=h.points[i],nx=h.points[(i+1)%n];
const scx=c.x*(h.scaleX||1),scy=c.y*(h.scaleY||1);
const snx=nx.x*(h.scaleX||1),sny=nx.y*(h.scaleY||1);
const sh1x=(c.h1?.x||0)*(h.scaleX||1),sh1y=(c.h1?.y||0)*(h.scaleY||1);
const sh2x=(c.h2?.x||0)*(h.scaleX||1),sh2y=(c.h2?.y||0)*(h.scaleY||1);
const snh1x=(nx.h1?.x||0)*(h.scaleX||1),snh1y=(nx.h1?.y||0)*(h.scaleY||1);
const rc=M.rotate({x:scx,y:scy},h.rotation||0);
const rn=M.rotate({x:snx,y:sny},h.rotation||0);
const rh2=M.rotate({x:sh2x,y:sh2y},h.rotation||0);
const rnh1=M.rotate({x:snh1x,y:snh1y},h.rotation||0);
for(let k=0;k<steps;k++){
const t=k/steps;
const pt=M.bezier({x:rc.x,y:rc.y},{x:rc.x+rh2.x,y:rc.y+rh2.y},{x:rn.x+rnh1.x,y:rn.y+rnh1.y},{x:rn.x,y:rn.y},t);
const lp={x:(h.x+pt.x)*side,y:h.y+pt.y};
pts.push(M.holsterToWorld(lp));
}}
return pts;
}
getCustomHoleWorldAsym(h){
// Transform custom hole points for asymmetric layer with bezier curves
const pts=[],steps=10,n=h.points.length;
for(let i=0;i<n;i++){
const c=h.points[i],nx=h.points[(i+1)%n];
const scx=c.x*(h.scaleX||1),scy=c.y*(h.scaleY||1);
const snx=nx.x*(h.scaleX||1),sny=nx.y*(h.scaleY||1);
const sh2x=(c.h2?.x||0)*(h.scaleX||1),sh2y=(c.h2?.y||0)*(h.scaleY||1);
const snh1x=(nx.h1?.x||0)*(h.scaleX||1),snh1y=(nx.h1?.y||0)*(h.scaleY||1);
const rc=M.rotate({x:scx,y:scy},h.rotation||0);
const rn=M.rotate({x:snx,y:sny},h.rotation||0);
const rh2=M.rotate({x:sh2x,y:sh2y},h.rotation||0);
const rnh1=M.rotate({x:snh1x,y:snh1y},h.rotation||0);
for(let k=0;k<steps;k++){
const t=k/steps;
const pt=M.bezier({x:rc.x,y:rc.y},{x:rc.x+rh2.x,y:rc.y+rh2.y},{x:rn.x+rnh1.x,y:rn.y+rnh1.y},{x:rn.x,y:rn.y},t);
pts.push({x:h.x+pt.x,y:h.y+pt.y});
}}
return pts;
}
getCustomHoleControlPts(h,side){
// Get raw control points (not bezier sampled) for handle drawing
return h.points.map(p=>{
const sx=p.x*(h.scaleX||1),sy=p.y*(h.scaleY||1);
const sh1x=(p.h1?.x||0)*(h.scaleX||1),sh1y=(p.h1?.y||0)*(h.scaleY||1);
const sh2x=(p.h2?.x||0)*(h.scaleX||1),sh2y=(p.h2?.y||0)*(h.scaleY||1);
const rc=M.rotate({x:sx,y:sy},h.rotation||0);
const rh1=M.rotate({x:sh1x,y:sh1y},h.rotation||0);
const rh2=M.rotate({x:sh2x,y:sh2y},h.rotation||0);
const lp={x:(h.x+rc.x)*side,y:h.y+rc.y};
const wp=M.holsterToWorld(lp);
return{x:wp.x,y:wp.y,h1:{x:rh1.x*side*HOLSTER.scaleX,y:rh1.y*HOLSTER.scaleY},h2:{x:rh2.x*side*HOLSTER.scaleX,y:rh2.y*HOLSTER.scaleY}};
});
}
getCustomHoleControlPtsAsym(h){
return h.points.map(p=>{
const sx=p.x*(h.scaleX||1),sy=p.y*(h.scaleY||1);
const sh1x=(p.h1?.x||0)*(h.scaleX||1),sh1y=(p.h1?.y||0)*(h.scaleY||1);
const sh2x=(p.h2?.x||0)*(h.scaleX||1),sh2y=(p.h2?.y||0)*(h.scaleY||1);
const rc=M.rotate({x:sx,y:sy},h.rotation||0);
const rh1=M.rotate({x:sh1x,y:sh1y},h.rotation||0);
const rh2=M.rotate({x:sh2x,y:sh2y},h.rotation||0);
return{x:h.x+rc.x,y:h.y+rc.y,h1:rh1,h2:rh2};
});
}
draw(){
if(PUBLISH_MODE){this.drawPublish();return}
const ctx=this.ctx,oc=this.offCtx,w=this.canvas.width/this.dpr,h=this.canvas.height/this.dpr;
ctx.fillStyle='#e8e8e0';ctx.fillRect(0,0,w,h);
if(CFG.gridOpacity>0){ctx.globalAlpha=CFG.gridOpacity;this.drawGrid(ctx,w,h);ctx.globalAlpha=1}
// Draw reference image behind everything
if(REF_IMAGE.img&&CFG.showRefImage){
ctx.save();
ctx.translate(VIEW.x,VIEW.y);
ctx.scale(VIEW.zoom,VIEW.zoom);
ctx.globalAlpha=parseFloat(CFG.refImageOpacity)||0.3;
const rw=REF_IMAGE.width*REF_IMAGE.scale;
const rh=REF_IMAGE.height*REF_IMAGE.scale;
ctx.drawImage(REF_IMAGE.img,REF_IMAGE.x-rw/2,REF_IMAGE.y-rh/2,rw,rh);
ctx.globalAlpha=1;
// Draw selection border if selected
if(SELECTED?.type==='refImage'){
ctx.strokeStyle='#007AFF';
ctx.lineWidth=2/VIEW.zoom;
ctx.setLineDash([5/VIEW.zoom,5/VIEW.zoom]);
ctx.strokeRect(REF_IMAGE.x-rw/2,REF_IMAGE.y-rh/2,rw,rh);
ctx.setLineDash([]);
}
ctx.restore();
}
// Draw calibration points and line (always visible when calibrating)
if(REF_IMAGE.calibrating){
ctx.save();
ctx.translate(VIEW.x,VIEW.y);
ctx.scale(VIEW.zoom,VIEW.zoom);
const ptSize=8/VIEW.zoom;
// Draw instruction text on canvas
ctx.font=`bold ${16/VIEW.zoom}px sans-serif`;
ctx.fillStyle='#ff0000';
ctx.textAlign='center';
const instrY=-200/VIEW.zoom;
if(!REF_IMAGE.calPt1){
ctx.fillText('Click FIRST point on ruler',0,instrY);
}else if(!REF_IMAGE.calPt2){
ctx.fillText('Click SECOND point on ruler',0,instrY);
}
if(REF_IMAGE.calPt1){
ctx.fillStyle='#ff0000';
ctx.beginPath();ctx.arc(REF_IMAGE.calPt1.x,REF_IMAGE.calPt1.y,ptSize,0,Math.PI*2);ctx.fill();
ctx.strokeStyle='#fff';ctx.lineWidth=2/VIEW.zoom;ctx.stroke();
// Label it
ctx.font=`${12/VIEW.zoom}px sans-serif`;ctx.fillStyle='#ff0000';ctx.textAlign='left';
ctx.fillText('1',REF_IMAGE.calPt1.x+ptSize+2/VIEW.zoom,REF_IMAGE.calPt1.y+4/VIEW.zoom);
}
if(REF_IMAGE.calPt2){
ctx.fillStyle='#00ff00';
ctx.beginPath();ctx.arc(REF_IMAGE.calPt2.x,REF_IMAGE.calPt2.y,ptSize,0,Math.PI*2);ctx.fill();
ctx.strokeStyle='#fff';ctx.lineWidth=2/VIEW.zoom;ctx.stroke();
// Label it
ctx.font=`${12/VIEW.zoom}px sans-serif`;ctx.fillStyle='#00ff00';ctx.textAlign='left';
ctx.fillText('2',REF_IMAGE.calPt2.x+ptSize+2/VIEW.zoom,REF_IMAGE.calPt2.y+4/VIEW.zoom);
// Draw line between points
ctx.strokeStyle='#ff0000';ctx.lineWidth=2/VIEW.zoom;
ctx.setLineDash([5/VIEW.zoom,5/VIEW.zoom]);
ctx.beginPath();ctx.moveTo(REF_IMAGE.calPt1.x,REF_IMAGE.calPt1.y);ctx.lineTo(REF_IMAGE.calPt2.x,REF_IMAGE.calPt2.y);ctx.stroke();
ctx.setLineDash([]);
// Show current distance
const dist=M.dist(REF_IMAGE.calPt1,REF_IMAGE.calPt2);
const midX=(REF_IMAGE.calPt1.x+REF_IMAGE.calPt2.x)/2;
const midY=(REF_IMAGE.calPt1.y+REF_IMAGE.calPt2.y)/2;
ctx.font=`${14/VIEW.zoom}px sans-serif`;ctx.fillStyle='#ff0000';ctx.textAlign='center';
ctx.fillText((dist*REF_IMAGE.scale).toFixed(1)+'mm (current)',midX,midY-10/VIEW.zoom);
}
ctx.restore();
}
oc.setTransform(this.dpr,0,0,this.dpr,0,0);oc.clearRect(0,0,w,h);oc.save();oc.translate(VIEW.x,VIEW.y);oc.scale(VIEW.zoom,VIEW.zoom);
// Clear button bounds each frame
this._stitchBtnBounds=null;
this._mergedStitchBtnBounds=null;
const pat=this.getMergedPatternPath(),st=this.offsetPath(pat,-CFG.stitchMargin),cav=this.offsetPath(st,-CFG.thickness*2);
oc.beginPath();pat.forEach((p,i)=>i===0?oc.moveTo(p.x,p.y):oc.lineTo(p.x,p.y));oc.closePath();oc.fillStyle=CFG.leatherColor;oc.globalAlpha=.4;oc.fill();oc.globalAlpha=1;
// Draw non-extension asymmetric shapes separately
if(CFG.showAsymmetric)ASYM_SHAPES.filter(s=>!s.isExtension).forEach(s=>{if(s.isLinkedCircle){const cd=this.getLinkedCircleData(s);if(cd){const pts=cd.points.map(p=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y}});oc.beginPath();pts.forEach((p,i)=>i===0?oc.moveTo(p.x,p.y):oc.lineTo(p.x,p.y));oc.closePath();oc.fillStyle=CFG.leatherColor;oc.globalAlpha=.5;oc.fill();oc.globalAlpha=1}}else{this.drawShape(oc,s);oc.fillStyle=CFG.leatherColor;oc.globalAlpha=.5;oc.fill();oc.globalAlpha=1}});
oc.globalCompositeOperation='destination-out';
if(CFG.showSymmetric)SYM_HOLES.forEach(hole=>{[1,-1].forEach(side=>{const wh=this.getSymHoleWorld(hole,side);this.drawHole(oc,wh.x,wh.y,wh.rotation,wh.width,wh.height,wh.shape);oc.fill()})});
if(CFG.showAsymmetric)ASYM_HOLES.forEach(hole=>{this.drawHole(oc,hole.x,hole.y,hole.rotation||0,hole.width,hole.height,hole.shape);oc.fill()});
if(CFG.showSymmetric)SYM_CUSTOM_HOLES.forEach(h=>{
const ptsR=this.getCustomHoleWorld(h,1),ptsL=this.getCustomHoleWorld(h,-1);
// Use Clipper to union both sides
const cl=new ClipperLib.Clipper();
const pathR=ptsR.map(p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)}));
const pathL=ptsL.map(p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)}));
cl.AddPath(pathR,ClipperLib.PolyType.ptSubject,true);
cl.AddPath(pathL,ClipperLib.PolyType.ptClip,true);
const sol=[];
cl.Execute(ClipperLib.ClipType.ctUnion,sol,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
if(sol.length){sol.forEach(path=>{oc.beginPath();path.forEach((p,i)=>i===0?oc.moveTo(p.X/SCALE,p.Y/SCALE):oc.lineTo(p.X/SCALE,p.Y/SCALE));oc.closePath();oc.fill()})}
});
if(CFG.showAsymmetric)ASYM_CUSTOM_HOLES.forEach(h=>{const pts=this.getCustomHoleWorldAsym(h);oc.beginPath();pts.forEach((p,i)=>i===0?oc.moveTo(p.x,p.y):oc.lineTo(p.x,p.y));oc.closePath();oc.fill()});
oc.globalCompositeOperation='source-over';oc.restore();
ctx.drawImage(this.off,0,0,w,h);
ctx.save();ctx.translate(VIEW.x,VIEW.y);ctx.scale(VIEW.zoom,VIEW.zoom);
const b=M.getBounds(pat);document.getElementById('patternSize').textContent=b.w.toFixed(0)+'×'+b.h.toFixed(0)+'mm';document.getElementById('maxInterior').textContent=Math.max(0,b.w-(CFG.stitchMargin+CFG.thickness*2)*2).toFixed(1)+'mm';
// Fold line - when locked, draw vertical at origin regardless of holster transforms
if(CFG.showFoldLine&&!CFG.asymmetricOutline){
ctx.strokeStyle='#888';ctx.lineWidth=1/VIEW.zoom;
ctx.setLineDash([8/VIEW.zoom,4/VIEW.zoom]);
ctx.beginPath();
if(CFG.lockFoldLine){
// Locked: always vertical at world origin
ctx.moveTo(0,-300);ctx.lineTo(0,300);
}else{
// Normal: follows holster transform
const top=M.holsterToWorld({x:0,y:-300}),bot=M.holsterToWorld({x:0,y:300});
ctx.moveTo(top.x,top.y);ctx.lineTo(bot.x,bot.y);
}
ctx.stroke();ctx.setLineDash([]);
ctx.fillStyle='#888';ctx.font=(10/VIEW.zoom)+'px sans-serif';ctx.textAlign='center';
if(CFG.lockFoldLine){ctx.fillText('FOLD',0,-280)}else{const lbl=M.holsterToWorld({x:0,y:-280});ctx.fillText('FOLD',lbl.x,lbl.y)}
}
// Center reference line for asymmetric mode
if(CFG.showFoldLine&&CFG.asymmetricOutline){
ctx.strokeStyle='#666';ctx.lineWidth=1/VIEW.zoom;
ctx.setLineDash([4/VIEW.zoom,4/VIEW.zoom]);
ctx.beginPath();
if(CFG.lockFoldLine){
ctx.moveTo(0,-300);ctx.lineTo(0,300);
}else{
const top=M.holsterToWorld({x:0,y:-300}),bot=M.holsterToWorld({x:0,y:300});
ctx.moveTo(top.x,top.y);ctx.lineTo(bot.x,bot.y);
}
ctx.stroke();ctx.setLineDash([]);
ctx.fillStyle='#666';ctx.font=(10/VIEW.zoom)+'px sans-serif';ctx.textAlign='center';
if(CFG.lockFoldLine){ctx.fillText('CENTER',0,-280)}else{const lbl=M.holsterToWorld({x:0,y:-280});ctx.fillText('CENTER',lbl.x,lbl.y)}
}
if(CFG.showCavity&&cav.length){ctx.beginPath();cav.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fillStyle='rgba(100,200,255,.12)';ctx.fill();ctx.strokeStyle='rgba(0,150,200,.35)';ctx.lineWidth=1.5/VIEW.zoom;ctx.setLineDash([3/VIEW.zoom,3/VIEW.zoom]);ctx.stroke();ctx.setLineDash([])}
if(CFG.showOutline){ctx.beginPath();pat.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.strokeStyle='#333';ctx.lineWidth=2/VIEW.zoom;ctx.stroke()}
if(SELECTED?.type==='holster')this.drawGizmo(ctx,this.getGizmos(HOLSTER,'holster'),'#007AFF');
let hsc=0;
if(CFG.showSymmetric){
SYM_HOLES.forEach((hole,idx)=>{if(hole.hidden)return;const sel=SELECTED?.type==='symHole'&&SELECTED?.idx===idx;[1,-1].forEach(side=>{const wh=this.getSymHoleWorld(hole,side);this.drawHole(ctx,wh.x,wh.y,wh.rotation,wh.width,wh.height,wh.shape);ctx.strokeStyle=sel?'#007AFF':'#555';ctx.lineWidth=(sel?2:1.5)/VIEW.zoom;ctx.stroke();if(hole.stitchBorder){const outline=M.getHoleOutline(wh.width,wh.height,wh.x,wh.y,wh.rotation,wh.shape);const sp=this.offsetPath(outline,hole.stitchMargin||3);if(sp.length){const sa=M.buildArcClosed(sp),tot=sa[sa.length-1].d,spc=hole.stitchSpacing||3;ctx.fillStyle=sel?'#007AFF':'#444';for(let d=0;d<tot;d+=spc){const pt=M.ptAtDist(sa,d);ctx.beginPath();ctx.arc(pt.x,pt.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill();hsc++}}}});if(sel){const wh=this.getSymHoleWorld(hole,1);this.drawGizmo(ctx,this.getGizmos(wh,'hole'),'#007AFF')}});
SYM_CUSTOM_HOLES.forEach((h,idx)=>{if(h.hidden)return;const sel=SELECTED?.type==='symCustomHole'&&SELECTED?.idx===idx;
// Draw both sides
[1,-1].forEach(side=>{
const pts=this.getCustomHoleWorld(h,side);
ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle=sel?'#007AFF':'#555';ctx.lineWidth=(sel?2:1.5)/VIEW.zoom;ctx.stroke();
// Draw stitch border for this side
if(h.stitchBorder){const sp=this.offsetPath(pts,h.stitchMargin||3);if(sp.length){const sa=M.buildArcClosed(sp),tot=sa[sa.length-1].d,spc=h.stitchSpacing||3;ctx.fillStyle=sel?'#007AFF':'#444';for(let d=0;d<tot;d+=spc){const pt=M.ptAtDist(sa,d);ctx.beginPath();ctx.arc(pt.x,pt.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill();hsc++}}}
});
if(sel){const ptsR=this.getCustomHoleWorld(h,1);const b=M.getBounds(ptsR);this.drawGizmo(ctx,this.getGizmos({x:b.cx,y:b.cy,points:h.points,scaleX:h.scaleX||1,scaleY:h.scaleY||1,rotation:h.rotation||0},'asymShape'),'#007AFF');const cpts=this.getCustomHoleControlPts(h,1);const ns=8/VIEW.zoom,hs=5/VIEW.zoom;cpts.forEach(n=>{const h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};ctx.strokeStyle='rgba(0,122,255,.5)';ctx.lineWidth=1/VIEW.zoom;ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(h1w.x,h1w.y);ctx.stroke();ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(h2w.x,h2w.y);ctx.stroke();ctx.fillStyle='#FF3B30';ctx.beginPath();ctx.arc(h1w.x,h1w.y,hs,0,Math.PI*2);ctx.fill();ctx.fillStyle='#00C7BE';ctx.beginPath();ctx.arc(h2w.x,h2w.y,hs,0,Math.PI*2);ctx.fill();ctx.fillStyle='#007AFF';ctx.fillRect(n.x-ns/2,n.y-ns/2,ns,ns);ctx.strokeStyle='#fff';ctx.lineWidth=1.5/VIEW.zoom;ctx.strokeRect(n.x-ns/2,n.y-ns/2,ns,ns)})}});
}
if(CFG.showAsymmetric){
ASYM_SHAPES.forEach((shape,idx)=>{if(shape.hidden)return;try{const sel=SELECTED?.type==='asymShape'&&SELECTED?.idx===idx;
// Handle linked circles specially
if(shape.isLinkedCircle){
const circleData=this.getLinkedCircleData(shape);
if(!circleData)return;
const pts=circleData.points.map(p=>{const s={x:p.x*(shape.scaleX||1),y:p.y*(shape.scaleY||1)};const r=M.rotate(s,shape.rotation||0);return{x:r.x+shape.x,y:r.y+shape.y}});
// Draw circle outline
ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle=sel?'#FF9500':'#885500';ctx.lineWidth=(sel?2:1.5)/VIEW.zoom;ctx.stroke();
// Draw stitches at exact matching positions
if(shape.stitchBorder){
ctx.fillStyle=sel?'#FF9500':'#444';
circleData.stitchPositions.forEach(pos=>{
const angle=pos*Math.PI*2-Math.PI/2;
const sx=Math.cos(angle)*(circleData.radius+CFG.stitchMargin)*(shape.scaleX||1);
const sy=Math.sin(angle)*(circleData.radius+CFG.stitchMargin)*(shape.scaleY||1);
const r=M.rotate({x:sx,y:sy},shape.rotation||0);
ctx.beginPath();ctx.arc(shape.x+r.x,shape.y+r.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill();hsc++;
});
}
// Draw info label
ctx.font=`${10/VIEW.zoom}px sans-serif`;ctx.fillStyle='#FF9500';ctx.textAlign='center';
ctx.fillText(`D${(circleData.radius*2).toFixed(1)}mm (${circleData.stitchCount} stitches)`,shape.x,shape.y-circleData.radius*(shape.scaleY||1)-15/VIEW.zoom);
if(sel){
const gizmo=this.getGizmos({x:shape.x,y:shape.y,width:circleData.radius*2*(shape.scaleX||1),height:circleData.radius*2*(shape.scaleY||1),rotation:shape.rotation||0},'hole');
this.drawGizmo(ctx,gizmo,'#FF9500');
}
return;
}
// Regular shape rendering
const isExt=shape.isExtension;
this.drawShape(ctx,shape);
// Extensions: solid line when selected, otherwise subtle since they're part of outline
ctx.strokeStyle=sel?(isExt?'#34C759':'#FF9500'):(isExt?'rgba(52,199,89,.3)':'#885500');
ctx.lineWidth=(sel?2:1.5)/VIEW.zoom;
ctx.setLineDash(sel||isExt?[]:[5/VIEW.zoom,3/VIEW.zoom]);
ctx.stroke();ctx.setLineDash([]);
// Don't draw stitch border for extensions (they're part of main outline)
if(shape.stitchBorder&&!isExt){const pts=shape.points.map(p=>{const s={x:p.x*(shape.scaleX||1),y:p.y*(shape.scaleY||1)};const r=M.rotate(s,shape.rotation||0);return{x:r.x+shape.x,y:r.y+shape.y}});const sp=this.offsetPath(pts,shape.stitchMargin||3);if(sp.length){const sa=M.buildArcClosed(sp),tot=sa[sa.length-1].d,spc=shape.stitchSpacing||3;ctx.fillStyle=sel?'#FF9500':'#444';for(let d=0;d<tot;d+=spc){const pt=M.ptAtDist(sa,d);ctx.beginPath();ctx.arc(pt.x,pt.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill();hsc++}}}
// Label for extension
if(isExt&&sel){ctx.font=`${10/VIEW.zoom}px sans-serif`;ctx.fillStyle='#34C759';ctx.textAlign='center';const b=M.getBounds(shape.points.map(p=>{const s={x:p.x*(shape.scaleX||1),y:p.y*(shape.scaleY||1)};const r=M.rotate(s,shape.rotation||0);return{x:r.x+shape.x,y:r.y+shape.y}}));ctx.fillText('EXTENSION',b.cx,b.cy-b.h/2-10/VIEW.zoom)}
if(sel){
this.drawGizmo(ctx,this.getGizmos(shape,'asymShape'),isExt?'#34C759':'#FF9500');
// Draw vertex handles for editing
const ns=7/VIEW.zoom;
const vpts=shape.points.map(p=>{const sc={x:p.x*(shape.scaleX||1),y:p.y*(shape.scaleY||1)};const r=M.rotate(sc,shape.rotation||0);return{x:r.x+shape.x,y:r.y+shape.y}});
vpts.forEach((vp,vi)=>{
ctx.fillStyle=isExt?'#34C759':'#FF9500';
ctx.strokeStyle='#fff';
ctx.lineWidth=2/VIEW.zoom;
ctx.beginPath();ctx.arc(vp.x,vp.y,ns,0,Math.PI*2);ctx.fill();ctx.stroke();
});
}}catch(e){console.error('ASYM_SHAPES render error:',e,shape)}});
ASYM_HOLES.forEach((hole,idx)=>{if(hole.hidden)return;const sel=SELECTED?.type==='asymHole'&&SELECTED?.idx===idx;this.drawHole(ctx,hole.x,hole.y,hole.rotation||0,hole.width,hole.height,hole.shape);ctx.strokeStyle=sel?'#FF9500':'#885500';ctx.lineWidth=(sel?2:1.5)/VIEW.zoom;ctx.setLineDash([5/VIEW.zoom,3/VIEW.zoom]);ctx.stroke();ctx.setLineDash([]);if(hole.stitchBorder){const outline=M.getHoleOutline(hole.width,hole.height,hole.x,hole.y,hole.rotation||0,hole.shape);const sp=this.offsetPath(outline,hole.stitchMargin||3);if(sp.length){const sa=M.buildArcClosed(sp),tot=sa[sa.length-1].d,spc=hole.stitchSpacing||3;ctx.fillStyle=sel?'#FF9500':'#444';for(let d=0;d<tot;d+=spc){const pt=M.ptAtDist(sa,d);ctx.beginPath();ctx.arc(pt.x,pt.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill();hsc++}}}if(sel)this.drawGizmo(ctx,this.getGizmos(hole,'hole'),'#FF9500')});
ASYM_CUSTOM_HOLES.forEach((h,idx)=>{if(h.hidden)return;const sel=SELECTED?.type==='asymCustomHole'&&SELECTED?.idx===idx;const pts=this.getCustomHoleWorldAsym(h);ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.strokeStyle=sel?'#FF9500':'#885500';ctx.lineWidth=(sel?2:1.5)/VIEW.zoom;ctx.setLineDash([5/VIEW.zoom,3/VIEW.zoom]);ctx.stroke();ctx.setLineDash([]);if(h.stitchBorder){const sp=this.offsetPath(pts,h.stitchMargin||3);if(sp.length){const sa=M.buildArcClosed(sp),tot=sa[sa.length-1].d,spc=h.stitchSpacing||3;ctx.fillStyle=sel?'#FF9500':'#444';for(let d=0;d<tot;d+=spc){const pt=M.ptAtDist(sa,d);ctx.beginPath();ctx.arc(pt.x,pt.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill();hsc++}}}if(sel){this.drawGizmo(ctx,this.getGizmos(h,'asymShape'),'#FF9500');const cpts=this.getCustomHoleControlPtsAsym(h);const ns=8/VIEW.zoom,hs=5/VIEW.zoom;cpts.forEach(n=>{const h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};ctx.strokeStyle='rgba(255,149,0,.5)';ctx.lineWidth=1/VIEW.zoom;ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(h1w.x,h1w.y);ctx.stroke();ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(h2w.x,h2w.y);ctx.stroke();ctx.fillStyle='#FF3B30';ctx.beginPath();ctx.arc(h1w.x,h1w.y,hs,0,Math.PI*2);ctx.fill();ctx.fillStyle='#00C7BE';ctx.beginPath();ctx.arc(h2w.x,h2w.y,hs,0,Math.PI*2);ctx.fill();ctx.fillStyle='#FF9500';ctx.fillRect(n.x-ns/2,n.y-ns/2,ns,ns);ctx.strokeStyle='#fff';ctx.lineWidth=1.5/VIEW.zoom;ctx.strokeRect(n.x-ns/2,n.y-ns/2,ns,ns)})}});
}
let ec=0;
// Get the right half path for edge work
const rightHalf=this.getRightHalfPath();
const rightWorld=rightHalf.map(p=>M.holsterToWorld(p));
// Draw edge ranges (visual indicators and handles)
if(rightWorld.length>2){
// Use stable offset for consistent handle positions
const offsetPath=this.offsetPathStable(rightWorld,-CFG.stitchMargin);
if(offsetPath.length>2){
const offsetArc=M.buildArc(offsetPath);
const offsetTot=offsetArc[offsetArc.length-1].d;
// Draw edge range indicators and handles
EDGE_RANGES.forEach((rng,ri)=>{
const sel=SELECTED?.type==='edgeRange'&&SELECTED?.idx===ri;
const sd=offsetTot*rng.start,ed=offsetTot*rng.end;
// Draw range line (thin indicator) when selected
if(sel){
ctx.strokeStyle='rgba(0,122,255,.4)';ctx.lineWidth=3/VIEW.zoom;
ctx.beginPath();
for(let d=sd;d<=ed;d+=2){
const pt=M.ptAtDist(offsetArc,d);
if(pt){d===sd?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y)}
}
ctx.stroke();
}
// Draw range handles
const sp=M.ptAtDist(offsetArc,sd),ep=M.ptAtDist(offsetArc,ed),mr=6/VIEW.zoom;
if(sp&&ep){
// Draw range start point (green) with hover effect
const isStartHovered=HOVER?.type==='rangeStart'&&HOVER.idx===ri;
const startSize=isStartHovered?mr*HOVER_SCALE:mr;
ctx.fillStyle=isStartHovered?'#5AE07A':'#34C759';
ctx.strokeStyle=sel?'#007AFF':'#fff';
ctx.lineWidth=(isStartHovered||sel?3:2)/VIEW.zoom;
ctx.beginPath();ctx.arc(sp.x,sp.y,startSize,0,Math.PI*2);ctx.fill();ctx.stroke();
// Draw range end point (red) with hover effect
const isEndHovered=HOVER?.type==='rangeEnd'&&HOVER.idx===ri;
const endSize=isEndHovered?mr*HOVER_SCALE:mr;
ctx.fillStyle=isEndHovered?'#FF6B6B':'#FF3B30';
ctx.beginPath();ctx.arc(ep.x,ep.y,endSize,0,Math.PI*2);ctx.fill();ctx.stroke();
// Draw "+ Stitch" button on canvas when range is selected and has no stitch yet
if(sel){
const hasStitch=EDGE_STITCHES.some(es=>!es.isMerged&&es.rangeIdx===ri);
if(!hasStitch){
const mid=M.ptAtDist(offsetArc,(sd+ed)/2);
if(mid){
const btnX=mid.x,btnY=mid.y;
ctx.fillStyle='#007AFF';
ctx.beginPath();
ctx.roundRect(btnX-30/VIEW.zoom,btnY-12/VIEW.zoom,60/VIEW.zoom,24/VIEW.zoom,4/VIEW.zoom);
ctx.fill();
ctx.fillStyle='#fff';ctx.font=`${11/VIEW.zoom}px "Segoe UI", sans-serif`;
ctx.textAlign='center';ctx.textBaseline='middle';
ctx.fillText('+ Stitch',btnX,btnY);
// Store button bounds for click detection
this._stitchBtnBounds={x:btnX-30/VIEW.zoom,y:btnY-12/VIEW.zoom,w:60/VIEW.zoom,h:24/VIEW.zoom,rangeIdx:ri};
}}}
}
});
}}
// Draw merged edge ranges (full perimeter)
const mergedPath=this.getMergedPatternPath();
if(mergedPath.length>2&&MERGED_EDGE_RANGES.length){
const mergedOffset=this.offsetPathStableClosed(mergedPath,-CFG.stitchMargin);
if(mergedOffset.length>2){
const mergedArc=M.buildArcClosed(mergedOffset);
const mergedTot=mergedArc[mergedArc.length-1].d;
MERGED_EDGE_RANGES.forEach((rng,ri)=>{
const sel=SELECTED?.type==='mergedEdgeRange'&&SELECTED?.idx===ri;
const sd=mergedTot*rng.start,ed=mergedTot*rng.end;
// Draw range line when selected
if(sel){
ctx.strokeStyle='rgba(147,112,219,.5)';ctx.lineWidth=3/VIEW.zoom;
ctx.beginPath();
for(let d=sd;d<=ed;d+=2){
const pt=M.ptAtDist(mergedArc,d);
if(pt){d===sd?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y)}
}
ctx.stroke();
}
// Draw range handles (purple theme for merged)
const sp=M.ptAtDist(mergedArc,sd),ep=M.ptAtDist(mergedArc,ed),mr=6/VIEW.zoom;
if(sp&&ep){
ctx.fillStyle='#9370DB';ctx.strokeStyle=sel?'#8B5CF6':'#fff';ctx.lineWidth=(sel?3:2)/VIEW.zoom;
ctx.beginPath();ctx.arc(sp.x,sp.y,mr,0,Math.PI*2);ctx.fill();ctx.stroke();
ctx.fillStyle='#E879F9';ctx.beginPath();ctx.arc(ep.x,ep.y,mr,0,Math.PI*2);ctx.fill();ctx.stroke();
// Draw "+ Stitch" button when selected
if(sel){
const hasStitch=EDGE_STITCHES.some(es=>es.rangeIdx===ri&&es.isMerged);
if(!hasStitch){
const mid=M.ptAtDist(mergedArc,(sd+ed)/2);
if(mid){
const btnX=mid.x,btnY=mid.y;
ctx.fillStyle='#8B5CF6';
ctx.beginPath();
ctx.roundRect(btnX-30/VIEW.zoom,btnY-12/VIEW.zoom,60/VIEW.zoom,24/VIEW.zoom,4/VIEW.zoom);
ctx.fill();
ctx.fillStyle='#fff';ctx.font=`${11/VIEW.zoom}px "Segoe UI", sans-serif`;
ctx.textAlign='center';ctx.textBaseline='middle';
ctx.fillText('+ Stitch',btnX,btnY);
this._mergedStitchBtnBounds={x:btnX-30/VIEW.zoom,y:btnY-12/VIEW.zoom,w:60/VIEW.zoom,h:24/VIEW.zoom,rangeIdx:ri};
}}}
}
});
}}
if(CFG.showEdgeStitches)EDGE_STITCHES.filter(es=>!es.isMerged).forEach((es,idx)=>{
if(es.hidden)return;
// Find actual index in EDGE_STITCHES for selection check
const actualIdx=EDGE_STITCHES.indexOf(es);
const sel=SELECTED?.type==='edgeStitch'&&SELECTED?.idx===actualIdx;
const rng=EDGE_RANGES[es.rangeIdx];
if(!rng)return;
const margin=es.margin||CFG.stitchMargin;
// Use the SAME offset approach as the handles, just with stitch's margin
const stitchPath=this.offsetPathStable(rightWorld,-margin);
if(stitchPath.length<3)return;
const stitchArc=M.buildArc(stitchPath);
const stitchTot=stitchArc[stitchArc.length-1].d;
const sd=stitchTot*rng.start,ed=stitchTot*rng.end;
// Draw guide line
if(es.showLine!==false){
ctx.strokeStyle=sel?'rgba(0,122,255,.5)':'rgba(100,100,100,.3)';ctx.lineWidth=(sel?2:1)/VIEW.zoom;
ctx.beginPath();
let started=false;
for(let d=sd;d<=ed;d+=1){
const pt=M.ptAtDist(stitchArc,d);
if(pt){if(!started){ctx.moveTo(pt.x,pt.y);started=true}else{ctx.lineTo(pt.x,pt.y)}}
}
ctx.stroke();
if(es.mirror!==false&&CFG.mirrorEdgeStitches&&!CFG.asymmetricOutline){
ctx.beginPath();started=false;
for(let d=sd;d<=ed;d+=1){
const pt=M.ptAtDist(stitchArc,d);
if(pt){const mx=2*HOLSTER.x-pt.x;if(!started){ctx.moveTo(mx,pt.y);started=true}else{ctx.lineTo(mx,pt.y)}}
}
ctx.stroke();
}}
// Draw stitch holes
if(es.showHoles!==false){
const spacing=es.spacing||CFG.stitchSpacing;
ctx.fillStyle=sel?'#007AFF':['#222','#0066cc','#cc6600','#009944'][idx%4];
for(let d=sd;d<=ed;d+=spacing){
const pt=M.ptAtDist(stitchArc,d);
if(!pt)continue;
ctx.beginPath();ctx.arc(pt.x,pt.y,(es.holeSize||CFG.holeSize)/2,0,Math.PI*2);ctx.fill();ec++;
if(es.mirror!==false&&CFG.mirrorEdgeStitches&&!CFG.asymmetricOutline){
const mx=2*HOLSTER.x-pt.x;
ctx.beginPath();ctx.arc(mx,pt.y,(es.holeSize||CFG.holeSize)/2,0,Math.PI*2);ctx.fill();ec++;
}}
}
});
// Draw merged edge stitches (full perimeter)
if(CFG.showEdgeStitches&&mergedPath.length>2)EDGE_STITCHES.filter(es=>es.isMerged).forEach((es)=>{
if(es.hidden)return;
const actualIdx=EDGE_STITCHES.indexOf(es);
const sel=SELECTED?.type==='edgeStitch'&&SELECTED?.idx===actualIdx;
const rng=MERGED_EDGE_RANGES[es.rangeIdx];
if(!rng)return;
const margin=es.margin||CFG.stitchMargin;
const stitchOffset=this.offsetPathStableClosed(mergedPath,-margin);
if(stitchOffset.length<3)return;
const stitchArc=M.buildArcClosed(stitchOffset);
const stitchTot=stitchArc[stitchArc.length-1].d;
const sd=stitchTot*rng.start,ed=stitchTot*rng.end;
// Draw guide line
if(es.showLine!==false){
ctx.strokeStyle=sel?'rgba(139,92,246,.5)':'rgba(147,112,219,.3)';ctx.lineWidth=(sel?2:1)/VIEW.zoom;
ctx.beginPath();
let started=false;
for(let d=sd;d<=ed;d+=1){
const pt=M.ptAtDist(stitchArc,d);
if(pt){if(!started){ctx.moveTo(pt.x,pt.y);started=true}else{ctx.lineTo(pt.x,pt.y)}}
}
ctx.stroke();
}
// Draw stitch holes
if(es.showHoles!==false){
const spacing=es.spacing||CFG.stitchSpacing;
ctx.fillStyle=sel?'#8B5CF6':'#9370DB';
for(let d=sd;d<=ed;d+=spacing){
const pt=M.ptAtDist(stitchArc,d);
if(!pt)continue;
ctx.beginPath();ctx.arc(pt.x,pt.y,(es.holeSize||CFG.holeSize)/2,0,Math.PI*2);ctx.fill();ec++;
}}
});
document.getElementById('stitchCount').textContent=ec+hsc;
if(CFG.showStitchLines&&CFG.showSymmetric)SYM_STITCHES.forEach((sl,idx)=>{if(sl.hidden)return;const sel=SELECTED?.type==='symStitch'&&SELECTED?.idx===idx;[1,-1].forEach(side=>{const pts=this.getSymStitchWorld(sl,side);if(pts.length>=2){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=0;i<pts.length-1;i++){const c=pts[i],n=pts[i+1];ctx.bezierCurveTo(c.x+c.h2.x,c.y+c.h2.y,n.x+n.h1.x,n.y+n.h1.y,n.x,n.y)}ctx.strokeStyle=sel?'rgba(175,82,222,.6)':'rgba(100,100,100,.4)';ctx.lineWidth=(sel?2:1)/VIEW.zoom;ctx.stroke();const smp=M.sampleBezier(pts,30);if(smp.length){const la=M.buildArc(smp),lt=la[la.length-1].d;ctx.fillStyle=sel?'#AF52DE':'#444';for(let d=0;d<=lt;d+=sl.spacing){const pt=M.ptAtDist(la,d);ctx.beginPath();ctx.arc(pt.x,pt.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill()}}}});if(sel){const pts=this.getSymStitchWorld(sl,1);pts.forEach(pt=>{const r=4/VIEW.zoom;ctx.fillStyle='#AF52DE';ctx.strokeStyle='#fff';ctx.lineWidth=1.5/VIEW.zoom;ctx.beginPath();ctx.arc(pt.x,pt.y,r,0,Math.PI*2);ctx.fill();ctx.stroke()})}});
if(CFG.showStitchLines&&CFG.showAsymmetric)ASYM_STITCHES.forEach((sl,idx)=>{if(sl.hidden)return;const sel=SELECTED?.type==='asymStitch'&&SELECTED?.idx===idx;const pts=sl.points;if(pts.length>=2){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=0;i<pts.length-1;i++){const c=pts[i],n=pts[i+1];ctx.bezierCurveTo(c.x+(c.h2?.x||0),c.y+(c.h2?.y||0),n.x+(n.h1?.x||0),n.y+(n.h1?.y||0),n.x,n.y)}ctx.strokeStyle=sel?'rgba(255,149,0,.6)':'rgba(136,85,0,.4)';ctx.lineWidth=(sel?2:1)/VIEW.zoom;ctx.setLineDash([5/VIEW.zoom,3/VIEW.zoom]);ctx.stroke();ctx.setLineDash([]);const smp=M.sampleBezier(pts,30);if(smp.length){const la=M.buildArc(smp),lt=la[la.length-1].d;ctx.fillStyle=sel?'#FF9500':'#444';for(let d=0;d<=lt;d+=sl.spacing){const pt=M.ptAtDist(la,d);ctx.beginPath();ctx.arc(pt.x,pt.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill()}}}if(sel){pts.forEach(pt=>{const r=4/VIEW.zoom;ctx.fillStyle='#FF9500';ctx.strokeStyle='#fff';ctx.lineWidth=1.5/VIEW.zoom;ctx.beginPath();ctx.arc(pt.x,pt.y,r,0,Math.PI*2);ctx.fill();ctx.stroke()})}});
if(TEMP_STITCH&&TEMP_STITCH.points.length){ctx.beginPath();ctx.moveTo(TEMP_STITCH.points[0].x,TEMP_STITCH.points[0].y);TEMP_STITCH.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle=LAYER==='asymmetric'?'rgba(255,149,0,.8)':'rgba(175,82,222,.8)';ctx.lineWidth=2/VIEW.zoom;ctx.setLineDash([4/VIEW.zoom,4/VIEW.zoom]);ctx.stroke();ctx.setLineDash([]);TEMP_STITCH.points.forEach(pt=>{ctx.fillStyle=LAYER==='asymmetric'?'#FF9500':'#AF52DE';ctx.strokeStyle='#fff';ctx.lineWidth=2/VIEW.zoom;ctx.beginPath();ctx.arc(pt.x,pt.y,5/VIEW.zoom,0,Math.PI*2);ctx.fill();ctx.stroke()})}
if(TEMP_SHAPE&&TEMP_SHAPE.points.length){ctx.beginPath();ctx.moveTo(TEMP_SHAPE.points[0].x,TEMP_SHAPE.points[0].y);TEMP_SHAPE.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));if(TEMP_SHAPE.points.length>2)ctx.closePath();ctx.strokeStyle='rgba(255,149,0,.8)';ctx.fillStyle='rgba(255,149,0,.2)';ctx.lineWidth=2/VIEW.zoom;ctx.stroke();if(TEMP_SHAPE.points.length>2)ctx.fill();TEMP_SHAPE.points.forEach(pt=>{ctx.fillStyle='#FF9500';ctx.strokeStyle='#fff';ctx.lineWidth=2/VIEW.zoom;ctx.beginPath();ctx.arc(pt.x,pt.y,5/VIEW.zoom,0,Math.PI*2);ctx.fill();ctx.stroke()})}
if(TEMP_CUSTOMHOLE&&TEMP_CUSTOMHOLE.points.length){ctx.beginPath();ctx.moveTo(TEMP_CUSTOMHOLE.points[0].x,TEMP_CUSTOMHOLE.points[0].y);TEMP_CUSTOMHOLE.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));if(TEMP_CUSTOMHOLE.points.length>2)ctx.closePath();ctx.strokeStyle=LAYER==='asymmetric'?'rgba(255,149,0,.8)':'rgba(0,122,255,.8)';ctx.fillStyle=LAYER==='asymmetric'?'rgba(255,149,0,.2)':'rgba(0,122,255,.2)';ctx.lineWidth=2/VIEW.zoom;ctx.stroke();if(TEMP_CUSTOMHOLE.points.length>2)ctx.fill();TEMP_CUSTOMHOLE.points.forEach(pt=>{ctx.fillStyle=LAYER==='asymmetric'?'#FF9500':'#007AFF';ctx.strokeStyle='#fff';ctx.lineWidth=2/VIEW.zoom;ctx.beginPath();ctx.arc(pt.x,pt.y,5/VIEW.zoom,0,Math.PI*2);ctx.fill();ctx.stroke()})}
// Draw text annotations
if(CFG.showText)TEXT_ANNOTATIONS.forEach((t,idx)=>{
if(t.hidden)return;
const sel=SELECTED?.type==='textAnnotation'&&SELECTED?.idx===idx;
const fs=(t.fontSize||12)/VIEW.zoom;
const fontStyle=(t.italic?'italic ':'')+(t.bold?'bold ':'');
ctx.font=`${fontStyle}${fs}px "Segoe UI", sans-serif`;
ctx.fillStyle=sel?'#007AFF':'#333';
ctx.textAlign='left';ctx.textBaseline='top';
if(t.text)ctx.fillText(t.text,t.x,t.y);
// Draw arrow if present
if(t.arrowTo){
ctx.strokeStyle=sel?'#007AFF':'#333';ctx.lineWidth=1.5/VIEW.zoom;
ctx.beginPath();ctx.moveTo(t.x,t.y+fs/2);ctx.lineTo(t.arrowTo.x,t.arrowTo.y);ctx.stroke();
// Arrowhead
const ang=Math.atan2(t.arrowTo.y-(t.y+fs/2),t.arrowTo.x-t.x);
const al=8/VIEW.zoom;
ctx.beginPath();ctx.moveTo(t.arrowTo.x,t.arrowTo.y);
ctx.lineTo(t.arrowTo.x-al*Math.cos(ang-0.4),t.arrowTo.y-al*Math.sin(ang-0.4));
ctx.moveTo(t.arrowTo.x,t.arrowTo.y);
ctx.lineTo(t.arrowTo.x-al*Math.cos(ang+0.4),t.arrowTo.y-al*Math.sin(ang+0.4));
ctx.stroke();
}
// Selection indicator
if(sel){const tw=ctx.measureText(t.text||'').width||20;ctx.strokeStyle='#007AFF';ctx.lineWidth=1/VIEW.zoom;ctx.setLineDash([3/VIEW.zoom,3/VIEW.zoom]);ctx.strokeRect(t.x-3/VIEW.zoom,t.y-3/VIEW.zoom,tw+6/VIEW.zoom,fs+6/VIEW.zoom);ctx.setLineDash([])}
});
// Draw ghost layer in two-layer mode
if(CFG.projectType==='two-layer'&&CFG.showGhostLayer){
const ghostState=CURRENT_LAYER==='front'?BACK_LAYER:FRONT_LAYER;
if(ghostState){
const tintColor=CURRENT_LAYER==='front'?'#FF9500':'#007AFF';
this.drawGhostLayer(ctx,ghostState,tintColor);
}
}
this.drawNodes(ctx);
ctx.restore();
this.updateZoomIndicator();
}
drawGrid(ctx,w,h){const gs=25*VIEW.zoom;ctx.strokeStyle='#ccc';ctx.lineWidth=.5;ctx.beginPath();for(let x=VIEW.x%gs;x<w;x+=gs){ctx.moveTo(x,0);ctx.lineTo(x,h)}for(let y=VIEW.y%gs;y<h;y+=gs){ctx.moveTo(0,y);ctx.lineTo(w,y)}ctx.stroke();const ms=100*VIEW.zoom;ctx.strokeStyle='#aaa';ctx.lineWidth=1;ctx.beginPath();for(let x=VIEW.x%ms;x<w;x+=ms){ctx.moveTo(x,0);ctx.lineTo(x,h)}for(let y=VIEW.y%ms;y<h;y+=ms){ctx.moveTo(0,y);ctx.lineTo(w,y)}ctx.stroke()}
drawNodes(ctx){
// Don't show node handles if main shape is locked
if(HOLSTER.locked)return;
const ns=8/VIEW.zoom,hs=5/VIEW.zoom;
// Show bezier handles when dragging OR hovering over this node or its handles
const showHandlesForIdx = (DRAG.active && (DRAG.type==='node'||DRAG.type==='h1'||DRAG.type==='h2')) ? DRAG.idx 
                        : (HOVER?.type==='node' || HOVER?.type==='h1' || HOVER?.type==='h2') ? HOVER.idx 
                        : (SELECTED?.type==='node') ? SELECTED.idx
                        : null;
NODES.forEach((n,idx)=>{
const wp=M.holsterToWorld(n);
const h1w=M.holsterToWorld({x:n.x+n.h1.x,y:n.y+n.h1.y});
const h2w=M.holsterToWorld({x:n.x+n.h2.x,y:n.y+n.h2.y});
// Only show bezier handles for the node being dragged or hovered
if(showHandlesForIdx===idx){
ctx.strokeStyle='rgba(100,100,100,.5)';ctx.lineWidth=1/VIEW.zoom;
ctx.beginPath();ctx.moveTo(wp.x,wp.y);ctx.lineTo(h1w.x,h1w.y);ctx.stroke();
ctx.beginPath();ctx.moveTo(wp.x,wp.y);ctx.lineTo(h2w.x,h2w.y);ctx.stroke();
// Draw h1 handle with hover effect
const isH1Hovered=HOVER?.type==='h1'&&HOVER.idx===idx;
const h1Size=isH1Hovered?hs*HOVER_SCALE:hs;
ctx.fillStyle=isH1Hovered?'#FF6B6B':'#FF3B30';
ctx.beginPath();ctx.arc(h1w.x,h1w.y,h1Size,0,Math.PI*2);ctx.fill();
// Draw h2 handle with hover effect
const isH2Hovered=HOVER?.type==='h2'&&HOVER.idx===idx;
const h2Size=isH2Hovered?hs*HOVER_SCALE:hs;
ctx.fillStyle=isH2Hovered?'#5DD3D8':'#00C7BE';
ctx.beginPath();ctx.arc(h2w.x,h2w.y,h2Size,0,Math.PI*2);ctx.fill();
}
// Draw node square with hover effect
const isNodeHovered=HOVER?.type==='node'&&HOVER.idx===idx;
const nodeSize=isNodeHovered?ns*HOVER_SCALE:ns;
ctx.fillStyle=isNodeHovered?'#FFA500':'#007AFF';
ctx.fillRect(wp.x-nodeSize/2,wp.y-nodeSize/2,nodeSize,nodeSize);
ctx.strokeStyle='#fff';ctx.lineWidth=(isNodeHovered?2:1.5)/VIEW.zoom;
ctx.strokeRect(wp.x-nodeSize/2,wp.y-nodeSize/2,nodeSize,nodeSize);
});
}
drawGhostLayer(ctx,layerState,tintColor){
// Save current state
ctx.save();
ctx.globalAlpha=CFG.ghostLayerOpacity;
// Apply ghost layer offset
ctx.translate(GHOST_OFFSET.x,GHOST_OFFSET.y);
// Temporarily store current state
const savedNODES=NODES;
const savedEDGE_RANGES=EDGE_RANGES;
const savedMERGED_EDGE_RANGES=MERGED_EDGE_RANGES;
const savedEDGE_STITCHES=EDGE_STITCHES;
const savedSYM_HOLES=SYM_HOLES;
const savedSYM_CUSTOM_HOLES=SYM_CUSTOM_HOLES;
const savedASYM_HOLES=ASYM_HOLES;
const savedASYM_CUSTOM_HOLES=ASYM_CUSTOM_HOLES;
const savedASYM_SHAPES=ASYM_SHAPES;
// Apply ghost layer state
NODES=layerState.NODES;
EDGE_RANGES=layerState.EDGE_RANGES;
MERGED_EDGE_RANGES=layerState.MERGED_EDGE_RANGES;
EDGE_STITCHES=layerState.EDGE_STITCHES;
SYM_HOLES=layerState.SYM_HOLES;
SYM_CUSTOM_HOLES=layerState.SYM_CUSTOM_HOLES;
ASYM_HOLES=layerState.ASYM_HOLES;
ASYM_CUSTOM_HOLES=layerState.ASYM_CUSTOM_HOLES;
ASYM_SHAPES=layerState.ASYM_SHAPES;
// Draw ghost layer elements
const pat=this.getMergedPatternPath();
// Draw outline with tint
ctx.beginPath();pat.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle=tintColor;ctx.lineWidth=1.5/VIEW.zoom;ctx.stroke();
// Draw stitch holes with tint
const rightHalfP=this.getRightHalfPath();
const rightWorld=rightHalfP.map(p=>M.holsterToWorld(p));
EDGE_STITCHES.forEach(es=>{
const rng=EDGE_RANGES[es.rangeIdx];if(!rng)return;
const stitchPath=this.offsetPathStable(rightWorld,-(es.margin||CFG.stitchMargin));
if(stitchPath.length<3)return;
const stitchArc=M.buildArc(stitchPath);
const tot=stitchArc[stitchArc.length-1].d;
const sd=tot*rng.start,ed=tot*rng.end;
if(es.showHoles!==false){
const spacing=es.spacing||CFG.stitchSpacing;
ctx.fillStyle=tintColor;
for(let d=sd;d<=ed;d+=spacing){
const pt=M.ptAtDist(stitchArc,d);if(!pt)continue;
ctx.beginPath();ctx.arc(pt.x,pt.y,(es.holeSize||CFG.holeSize)/2,0,Math.PI*2);ctx.fill();
if(es.mirror!==false&&CFG.mirrorEdgeStitches&&!CFG.asymmetricOutline){
const mx=2*HOLSTER.x-pt.x;
ctx.beginPath();ctx.arc(mx,pt.y,(es.holeSize||CFG.holeSize)/2,0,Math.PI*2);ctx.fill();
}}}
});
// Draw holes with tint
SYM_HOLES.forEach(hole=>{[1,-1].forEach(side=>{const wh=this.getSymHoleWorld(hole,side);this.drawHole(ctx,wh.x,wh.y,wh.rotation,wh.width,wh.height,wh.shape);ctx.strokeStyle=tintColor;ctx.lineWidth=1/VIEW.zoom;ctx.stroke()})});
ASYM_HOLES.forEach(hole=>{this.drawHole(ctx,hole.x,hole.y,hole.rotation||0,hole.width,hole.height,hole.shape);ctx.strokeStyle=tintColor;ctx.lineWidth=1/VIEW.zoom;ctx.stroke()});
// Draw custom holes with tint
SYM_CUSTOM_HOLES.forEach(h=>{[1,-1].forEach(side=>{const pts=this.getCustomHoleWorld(h,side);ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.strokeStyle=tintColor;ctx.lineWidth=1/VIEW.zoom;ctx.stroke()})});
ASYM_CUSTOM_HOLES.forEach(h=>{const pts=this.getCustomHoleWorldAsym(h);ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.strokeStyle=tintColor;ctx.lineWidth=1/VIEW.zoom;ctx.stroke()});
// Draw shapes with tint
ASYM_SHAPES.filter(s=>!s.isExtension).forEach(s=>{
const pts=s.points.map(p=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y}});
ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle=tintColor;ctx.lineWidth=1/VIEW.zoom;ctx.stroke();
});
// Draw alignment guides when dragging ghost layer
if(DRAG.active&&DRAG.type==='ghostLayer'){
// Draw crosshairs at origin for alignment
ctx.globalAlpha=1;
ctx.strokeStyle='#00ff00';
ctx.lineWidth=1/VIEW.zoom;
ctx.setLineDash([5/VIEW.zoom,5/VIEW.zoom]);
// Vertical line
ctx.beginPath();
ctx.moveTo(-GHOST_OFFSET.x,-1000);
ctx.lineTo(-GHOST_OFFSET.x,1000);
ctx.stroke();
// Horizontal line
ctx.beginPath();
ctx.moveTo(-1000,-GHOST_OFFSET.y);
ctx.lineTo(1000,-GHOST_OFFSET.y);
ctx.stroke();
ctx.setLineDash([]);
}
// Restore original state
NODES=savedNODES;
EDGE_RANGES=savedEDGE_RANGES;
MERGED_EDGE_RANGES=savedMERGED_EDGE_RANGES;
EDGE_STITCHES=savedEDGE_STITCHES;
SYM_HOLES=savedSYM_HOLES;
SYM_CUSTOM_HOLES=savedSYM_CUSTOM_HOLES;
ASYM_HOLES=savedASYM_HOLES;
ASYM_CUSTOM_HOLES=savedASYM_CUSTOM_HOLES;
ASYM_SHAPES=savedASYM_SHAPES;
ctx.restore();
}
getWorld(e){const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left-VIEW.x)/VIEW.zoom,y:(e.clientY-r.top-VIEW.y)/VIEW.zoom}}
onDblClick(e){const w=this.getWorld(e);if(MODE==='stitch'&&TEMP_STITCH&&TEMP_STITCH.points.length>=2){this.finishMode();return}if(MODE==='shape'&&TEMP_SHAPE&&TEMP_SHAPE.points.length>=3){this.finishMode();return}if(MODE==='customhole'&&TEMP_CUSTOMHOLE&&TEMP_CUSTOMHOLE.points.length>=3){this.finishMode();return}
// Double-click on selected text to edit or add arrow
if(SELECTED?.type==='textAnnotation'){const t=TEXT_ANNOTATIONS[SELECTED.idx];const fs=t.fontSize||12;const tw=this.ctx.measureText(t.text).width/VIEW.zoom;
// Check if clicking on text itself (edit) or elsewhere (add arrow)
if(w.x>=t.x&&w.x<=t.x+tw+20&&w.y>=t.y&&w.y<=t.y+fs+10){
const newText=prompt('Edit text:',t.text);if(newText!==null)t.text=newText;
}else{t.arrowTo={x:w.x,y:w.y}}
this.updateInfo();this.draw();return}
if(MODE==='select'&&!HOLSTER.locked){const local=this.getPatternLocalPath(),lw=M.worldToHolster(w);let minD=Infinity,ins=-1;for(const p of local){const d=M.dist(lw,p);if(d<minD&&p.segIdx>=0){minD=d;ins=p.segIdx}}if(minD<30/(VIEW.zoom*Math.min(HOLSTER.scaleX||1,HOLSTER.scaleY||1))&&ins>=0){NODES.splice(ins+1,0,{x:CFG.asymmetricOutline?lw.x:Math.max(0,lw.x),y:lw.y,h1:{x:0,y:0},h2:{x:0,y:0}});this.draw()}}}
onDown(e){e.preventDefault();
// Clear hover state when starting any interaction
HOVER=null;
// Handle calibration mode
if(REF_IMAGE.calibrating){
const w=this.getWorld(e);
this.handleCalibrationClick(w);
return;
}
// Handle publish mode panning
if(PUBLISH_MODE){
DRAG={active:true,type:'publishPan',sx:e.clientX,sy:e.clientY,vx:PUBLISH_VIEW.x,vy:PUBLISH_VIEW.y};
this.canvas.style.cursor='grabbing';
return;
}
const w=this.getWorld(e);
if(e.button===1||e.button===2||isPanning){DRAG={active:true,type:'pan',sx:e.clientX,sy:e.clientY,vx:VIEW.x,vy:VIEW.y};this.canvas.style.cursor='grabbing';return}
if(MODE==='hole'){const lw=M.worldToHolster(w);const nh={x:LAYER==='asymmetric'?w.x:Math.abs(lw.x),y:LAYER==='asymmetric'?w.y:lw.y,width:CFG.defaultHoleWidth,height:CFG.defaultHoleShape==='circle'?CFG.defaultHoleWidth:CFG.defaultHoleHeight,rotation:0,shape:CFG.defaultHoleShape,stitchBorder:CFG.defaultHoleStitchBorder,stitchMargin:CFG.defaultHoleStitchMargin,stitchSpacing:CFG.defaultHoleStitchSpacing};if(LAYER==='asymmetric'){ASYM_HOLES.push(nh);SELECTED={type:'asymHole',idx:ASYM_HOLES.length-1}}else{SYM_HOLES.push(nh);SELECTED={type:'symHole',idx:SYM_HOLES.length-1}}this.updateInfo();this.draw();this.saveState();return}
if(MODE==='text'){
// Create new text annotation with inline editing
TEXT_ANNOTATIONS.push({x:w.x,y:w.y,text:'',fontSize:12,bold:false,italic:false});
SELECTED={type:'textAnnotation',idx:TEXT_ANNOTATIONS.length-1};
this.updateInfo();
this.startTextEdit(TEXT_ANNOTATIONS.length-1);
return;
}
if(MODE==='stitch'){if(!TEMP_STITCH)TEMP_STITCH={points:[{x:w.x,y:w.y}]};else TEMP_STITCH.points.push({x:w.x,y:w.y});document.getElementById('mode-indicator').querySelector('.mode-text').textContent=(LAYER==='asymmetric'?'◧':'〰')+' '+TEMP_STITCH.points.length+' pts';this.draw();return}
if(MODE==='shape'){if(!TEMP_SHAPE)TEMP_SHAPE={points:[{x:w.x,y:w.y}]};else TEMP_SHAPE.points.push({x:w.x,y:w.y});document.getElementById('mode-indicator').querySelector('.mode-text').textContent='◧ '+TEMP_SHAPE.points.length+' pts';this.draw();return}
if(MODE==='customhole'){if(!TEMP_CUSTOMHOLE)TEMP_CUSTOMHOLE={points:[{x:w.x,y:w.y}]};else TEMP_CUSTOMHOLE.points.push({x:w.x,y:w.y});document.getElementById('mode-indicator').querySelector('.mode-text').textContent='✏ '+TEMP_CUSTOMHOLE.points.length+' pts';this.draw();return}
// Check for ghost layer drag in two-layer mode
if(MODE==='select'&&CFG.projectType==='two-layer'&&CFG.showGhostLayer){
const ghostState=CURRENT_LAYER==='front'?BACK_LAYER:FRONT_LAYER;
if(ghostState){
// Temporarily apply ghost layer state to get its outline
const savedNODES=NODES;
NODES=ghostState.NODES;
const ghostPat=this.getMergedPatternPath();
NODES=savedNODES;
// Check if click is near the ghost layer outline (with offset applied)
const ghostPatOffset=ghostPat.map(p=>({x:p.x+GHOST_OFFSET.x,y:p.y+GHOST_OFFSET.y}));
// Check if click is on or near the ghost outline using distance to edge segments
let onGhostOutline=false;
const threshold=10/VIEW.zoom;
for(let i=0;i<ghostPatOffset.length;i++){
const a=ghostPatOffset[i];
const b=ghostPatOffset[(i+1)%ghostPatOffset.length];
const sl=(b.x-a.x)**2+(b.y-a.y)**2;
if(sl===0)continue;
let t=((w.x-a.x)*(b.x-a.x)+(w.y-a.y)*(b.y-a.y))/sl;
t=Math.max(0,Math.min(1,t));
const pr={x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)};
if(M.dist(w,pr)<threshold){
onGhostOutline=true;
break;
}
}
if(onGhostOutline){
DRAG={active:true,type:'ghostLayer',sx:w.x,sy:w.y,gox:GHOST_OFFSET.x,goy:GHOST_OFFSET.y};
this.canvas.style.cursor='move';
return;
}
}
}
// Gizmo checks
if(SELECTED?.type==='holster'&&!HOLSTER.locked){const gizmo=this.getGizmos(HOLSTER,'holster');for(const g of gizmo.handles){if(M.dist(w,g)<15/VIEW.zoom){DRAG={active:true,type:'holsterGizmo',gizmoType:g.type,sx:w.x,sy:w.y,shx:HOLSTER.x,shy:HOLSTER.y,ssx:HOLSTER.scaleX,ssy:HOLSTER.scaleY,sr:HOLSTER.rotation};if(g.type==='rotate'){this.canvas.style.cursor='crosshair'}else if(g.type==='scale'||g.type.includes('e')||g.type.includes('w')||g.type.includes('n')||g.type.includes('s')){this.canvas.style.cursor='nwse-resize'}else{this.canvas.style.cursor='move'}return}}}
if(SELECTED?.type==='symHole'){const hole=SYM_HOLES[SELECTED.idx];if(!hole.locked){const wh=this.getSymHoleWorld(hole,1),gizmo=this.getGizmos(wh,'hole');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'symHoleGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:hole.x,shy:hole.y,sw:hole.width,sh:hole.height,sr:hole.rotation||0};if(g.type==='rotate'){this.canvas.style.cursor='crosshair'}else if(g.type==='scale'||g.type.includes('e')||g.type.includes('w')||g.type.includes('n')||g.type.includes('s')){this.canvas.style.cursor='nwse-resize'}else{this.canvas.style.cursor='move'}return}}}}
if(SELECTED?.type==='asymHole'){const hole=ASYM_HOLES[SELECTED.idx];if(!hole.locked){const gizmo=this.getGizmos(hole,'hole');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'asymHoleGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:hole.x,shy:hole.y,sw:hole.width,sh:hole.height,sr:hole.rotation||0};if(g.type==='rotate'){this.canvas.style.cursor='crosshair'}else if(g.type==='scale'||g.type.includes('e')||g.type.includes('w')||g.type.includes('n')||g.type.includes('s')){this.canvas.style.cursor='nwse-resize'}else{this.canvas.style.cursor='move'}return}}}}
if(SELECTED?.type==='asymShape'){const s=ASYM_SHAPES[SELECTED.idx];if(!s.locked){
// Check for vertex drag first
const pts=s.points.map((p,i)=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y,idx:i}});
for(let i=0;i<pts.length;i++){if(M.dist(w,pts[i])<10/VIEW.zoom){DRAG={active:true,type:'asymShapeVertex',idx:SELECTED.idx,ptIdx:i,sx:w.x,sy:w.y};return}}
// Then check gizmo handles
const gizmo=this.getGizmos(s,'asymShape');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'asymShapeGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:s.x,shy:s.y,ssx:s.scaleX||1,ssy:s.scaleY||1,sr:s.rotation||0};return}}}}
// Check for canvas "+ Stitch" button clicks - check merged first
if(this._mergedStitchBtnBounds){
const b=this._mergedStitchBtnBounds;
if(w.x>=b.x&&w.x<=b.x+b.w&&w.y>=b.y&&w.y<=b.y+b.h){
SELECTED={type:'mergedEdgeRange',idx:b.rangeIdx};
this.createStitchFromMergedRange();
return;
}}
if(this._stitchBtnBounds){
const b=this._stitchBtnBounds;
if(w.x>=b.x&&w.x<=b.x+b.w&&w.y>=b.y&&w.y<=b.y+b.h){
SELECTED={type:'edgeRange',idx:b.rangeIdx};
this.createStitchFromRange();
return;
}}
if(SELECTED?.type==='symCustomHole'){const h=SYM_CUSTOM_HOLES[SELECTED.idx];if(!h.locked){const pts=this.getCustomHoleWorld(h,1),b=M.getBounds(pts),gizmo=this.getGizmos({x:b.cx,y:b.cy,points:h.points,scaleX:h.scaleX||1,scaleY:h.scaleY||1,rotation:h.rotation||0},'asymShape');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'symCustomHoleGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:h.x,shy:h.y,ssx:h.scaleX||1,ssy:h.scaleY||1,sr:h.rotation||0};return}}const cpts=this.getCustomHoleControlPts(h,1);for(let i=0;i<cpts.length;i++){const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'symCustomHoleH1',idx:SELECTED.idx,ptIdx:i};return}if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'symCustomHoleH2',idx:SELECTED.idx,ptIdx:i};return}if(M.dist(w,n)<12/VIEW.zoom){DRAG={active:true,type:'symCustomHoleNode',idx:SELECTED.idx,ptIdx:i};return}}}}
if(SELECTED?.type==='asymCustomHole'){const h=ASYM_CUSTOM_HOLES[SELECTED.idx];if(!h.locked){const gizmo=this.getGizmos(h,'asymShape');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'asymCustomHoleGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:h.x,shy:h.y,ssx:h.scaleX||1,ssy:h.scaleY||1,sr:h.rotation||0};return}}const cpts=this.getCustomHoleControlPtsAsym(h);for(let i=0;i<cpts.length;i++){const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'asymCustomHoleH1',idx:SELECTED.idx,ptIdx:i};return}if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'asymCustomHoleH2',idx:SELECTED.idx,ptIdx:i};return}if(M.dist(w,n)<12/VIEW.zoom){DRAG={active:true,type:'asymCustomHoleNode',idx:SELECTED.idx,ptIdx:i};return}}}}
// Stitch point selection
if(SELECTED?.type==='symStitch'){const sl=SYM_STITCHES[SELECTED.idx];if(!sl.locked){const pts=this.getSymStitchWorld(sl,1);for(let i=0;i<pts.length;i++){if(M.dist(w,pts[i])<8/VIEW.zoom){DRAG={active:true,type:'symStitchPt',idx:SELECTED.idx,ptIdx:i,sx:w.x,sy:w.y};return}}}}
if(SELECTED?.type==='asymStitch'){const sl=ASYM_STITCHES[SELECTED.idx];if(!sl.locked){for(let i=0;i<sl.points.length;i++){if(M.dist(w,sl.points[i])<8/VIEW.zoom){DRAG={active:true,type:'asymStitchPt',idx:SELECTED.idx,ptIdx:i,sx:w.x,sy:w.y};return}}}}
// Edge range handles - check BEFORE object selection so handles take priority
const rightHalf=this.getRightHalfPath();
const rightWorld=rightHalf.map(p=>M.holsterToWorld(p));
const rightSt=rightWorld.length>2?this.offsetPathStable(rightWorld,-CFG.stitchMargin):[];
const mergedPath=this.getMergedPatternPath();
// Helper to check edge range handles
const checkEdgeHandles=()=>{
if(rightSt.length>2){
const arc=M.buildArc(rightSt),tot=arc[arc.length-1].d;
for(let i=0;i<EDGE_RANGES.length;i++){
const r=EDGE_RANGES[i],sp=M.ptAtDist(arc,tot*r.start),ep=M.ptAtDist(arc,tot*r.end);
if(sp&&M.dist(w,sp)<18/VIEW.zoom){SELECTED={type:'edgeRange',idx:i};DRAG={active:true,type:'rangeStart',idx:i,path:rightSt,arc,tot};this.canvas.style.cursor='ew-resize';this.updateInfo();this.draw();return true}
if(ep&&M.dist(w,ep)<18/VIEW.zoom){SELECTED={type:'edgeRange',idx:i};DRAG={active:true,type:'rangeEnd',idx:i,path:rightSt,arc,tot};this.canvas.style.cursor='ew-resize';this.updateInfo();this.draw();return true}
}}return false};
// Helper to check merged range handles
const checkMergedHandles=()=>{
if(mergedPath.length>2&&MERGED_EDGE_RANGES.length){
const mergedOffset=this.offsetPathStableClosed(mergedPath,-CFG.stitchMargin);
if(mergedOffset.length>2){
const mergedArc=M.buildArcClosed(mergedOffset),mergedTot=mergedArc[mergedArc.length-1].d;
for(let i=0;i<MERGED_EDGE_RANGES.length;i++){
const r=MERGED_EDGE_RANGES[i],sp=M.ptAtDist(mergedArc,mergedTot*r.start),ep=M.ptAtDist(mergedArc,mergedTot*r.end);
if(sp&&M.dist(w,sp)<18/VIEW.zoom){SELECTED={type:'mergedEdgeRange',idx:i};DRAG={active:true,type:'mergedRangeStart',idx:i,path:mergedOffset,arc:mergedArc,tot:mergedTot};this.canvas.style.cursor='ew-resize';this.updateInfo();this.draw();return true}
if(ep&&M.dist(w,ep)<18/VIEW.zoom){SELECTED={type:'mergedEdgeRange',idx:i};DRAG={active:true,type:'mergedRangeEnd',idx:i,path:mergedOffset,arc:mergedArc,tot:mergedTot};this.canvas.style.cursor='ew-resize';this.updateInfo();this.draw();return true}
}}}return false};
// Check based on current selection - prioritize the type that's already selected
if(SELECTED?.type==='edgeRange'){if(checkEdgeHandles())return;if(checkMergedHandles())return}
else if(SELECTED?.type==='mergedEdgeRange'){if(checkMergedHandles())return;if(checkEdgeHandles())return}
else{if(checkEdgeHandles())return;if(checkMergedHandles())return}
// Object selection
for(let i=ASYM_SHAPES.length-1;i>=0;i--){const s=ASYM_SHAPES[i];
// Handle linked circles
if(s.isLinkedCircle){const cd=this.getLinkedCircleData(s);if(cd){const d=M.dist(w,{x:s.x,y:s.y});if(d<cd.radius*(s.scaleX||1)+10){SELECTED={type:'asymShape',idx:i};this.updateInfo();this.draw();return}}continue}
// Regular shape
const pts=s.points.map(p=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y}});if(M.insidePoly(w,pts)){SELECTED={type:'asymShape',idx:i};this.updateInfo();this.draw();return}}
for(let i=ASYM_HOLES.length-1;i>=0;i--){if(M.insideShape(w,ASYM_HOLES[i])){SELECTED={type:'asymHole',idx:i};this.updateInfo();this.draw();return}}
for(let i=ASYM_CUSTOM_HOLES.length-1;i>=0;i--){const pts=this.getCustomHoleWorldAsym(ASYM_CUSTOM_HOLES[i]);if(M.insidePoly(w,pts)){SELECTED={type:'asymCustomHole',idx:i};this.updateInfo();this.draw();return}}
for(let i=SYM_HOLES.length-1;i>=0;i--){const hole=SYM_HOLES[i];for(const side of[1,-1]){const wh=this.getSymHoleWorld(hole,side);if(M.insideShape(w,wh)){SELECTED={type:'symHole',idx:i};this.updateInfo();this.draw();return}}}
for(let i=SYM_CUSTOM_HOLES.length-1;i>=0;i--){const h=SYM_CUSTOM_HOLES[i];for(const side of[1,-1]){const pts=this.getCustomHoleWorld(h,side);if(M.insidePoly(w,pts)){SELECTED={type:'symCustomHole',idx:i};this.updateInfo();this.draw();return}}}
// Stitch line selection
for(let i=SYM_STITCHES.length-1;i>=0;i--){const sl=SYM_STITCHES[i];for(const side of[1,-1]){const pts=this.getSymStitchWorld(sl,side);const smp=M.sampleBezier(pts,30);if(M.ptOnBezier(smp,w,10/VIEW.zoom)){SELECTED={type:'symStitch',idx:i};this.updateInfo();this.draw();return}}}
for(let i=ASYM_STITCHES.length-1;i>=0;i--){const sl=ASYM_STITCHES[i];const smp=M.sampleBezier(sl.points,30);if(M.ptOnBezier(smp,w,10/VIEW.zoom)){SELECTED={type:'asymStitch',idx:i};this.updateInfo();this.draw();return}}
// Text annotation selection
for(let i=TEXT_ANNOTATIONS.length-1;i>=0;i--){const t=TEXT_ANNOTATIONS[i];const fs=t.fontSize||12;const tw=this.ctx.measureText(t.text).width/VIEW.zoom;if(w.x>=t.x&&w.x<=t.x+tw+20&&w.y>=t.y&&w.y<=t.y+fs+10){SELECTED={type:'textAnnotation',idx:i};if(!t.locked){DRAG={active:true,type:'textMove',idx:i,ox:w.x-t.x,oy:w.y-t.y}}this.updateInfo();this.draw();return}}
if(!HOLSTER.locked){for(let i=0;i<NODES.length;i++){const n=NODES[i],nw=M.holsterToWorld(n),h1w=M.holsterToWorld({x:n.x+n.h1.x,y:n.y+n.h1.y}),h2w=M.holsterToWorld({x:n.x+n.h2.x,y:n.y+n.h2.y});if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'h1',idx:i};SELECTED=null;this.canvas.style.cursor='grabbing';this.updateInfo();this.draw();return}if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'h2',idx:i};SELECTED=null;this.canvas.style.cursor='grabbing';this.updateInfo();this.draw();return}if(M.dist(w,nw)<12/VIEW.zoom){DRAG={active:true,type:'node',idx:i};SELECTED={type:'node',idx:i};this.canvas.style.cursor='grabbing';this.updateInfo();this.draw();return}}}
const pat=this.getPatternPath();
if(M.insidePoly(w,pat)){SELECTED={type:'holster'};this.updateInfo();this.draw();return}
// Check for click on reference image (to drag it)
if(REF_IMAGE.img&&CFG.showRefImage){
const rw=REF_IMAGE.width*REF_IMAGE.scale;
const rh=REF_IMAGE.height*REF_IMAGE.scale;
const rx=REF_IMAGE.x-rw/2,ry=REF_IMAGE.y-rh/2;
if(w.x>=rx&&w.x<=rx+rw&&w.y>=ry&&w.y<=ry+rh){
SELECTED={type:'refImage'};
DRAG={active:true,type:'refImage',sx:w.x,sy:w.y,ox:REF_IMAGE.x,oy:REF_IMAGE.y};
this.updateInfo();this.draw();return;
}}
SELECTED=null;this.updateInfo();this.draw()
}
onMove(e){const w=this.getWorld(e);
// Add hover detection when not dragging
if(!DRAG.active&&MODE==='select'){
const prevHover=HOVER;
HOVER=null;
// Check node bezier handles first (h1, h2) - only when holster unlocked
if(!HOLSTER.locked){
for(let i=0;i<NODES.length;i++){
const n=NODES[i];
const nw=M.holsterToWorld(n);
const h1w=M.holsterToWorld({x:n.x+n.h1.x,y:n.y+n.h1.y});
const h2w=M.holsterToWorld({x:n.x+n.h2.x,y:n.y+n.h2.y});
if(M.dist(w,h1w)<HOVER_TOLERANCE.handle/VIEW.zoom){HOVER={type:'h1',idx:i};break}
if(M.dist(w,h2w)<HOVER_TOLERANCE.handle/VIEW.zoom){HOVER={type:'h2',idx:i};break}
if(M.dist(w,nw)<HOVER_TOLERANCE.node/VIEW.zoom){HOVER={type:'node',idx:i};break}
}
}
// Check edge range handles
if(!HOVER){
for(let ri=0;ri<EDGE_RANGES.length;ri++){
const range=EDGE_RANGES[ri];
const rightHalf=this.getRightHalfPath();
const rightWorld=rightHalf.map(p=>M.holsterToWorld(p));
const arc=M.buildArc(rightWorld);
if(!arc||!arc.length)continue;
const arcLen=arc[arc.length-1].d;
const sd=range.start*arcLen,ed=range.end*arcLen;
const sp=M.ptAtDist(arc,sd),ep=M.ptAtDist(arc,ed);
if(sp&&M.dist(w,sp)<HOVER_TOLERANCE.range/VIEW.zoom){HOVER={type:'rangeStart',idx:ri};break}
if(ep&&M.dist(w,ep)<HOVER_TOLERANCE.range/VIEW.zoom){HOVER={type:'rangeEnd',idx:ri};break}
}
}
// Check gizmo handles if something is selected
if(!HOVER&&SELECTED){
let gizmo=null;
if(SELECTED.type==='holster'&&!HOLSTER.locked){
gizmo=this.getGizmos(HOLSTER,'holster');
}else if(SELECTED.type==='asymShape'){
gizmo=this.getGizmos(ASYM_SHAPES[SELECTED.idx],'asymShape');
}
if(gizmo){
for(const g of gizmo.handles){
if(M.dist(w,g)<HOVER_TOLERANCE.gizmo/VIEW.zoom){HOVER={type:'gizmo',gizmoType:g.type};break}
}
}
}
// Check ghost layer hover in two-layer mode
if(!HOVER&&CFG.projectType==='two-layer'&&CFG.showGhostLayer){
const ghostState=CURRENT_LAYER==='front'?BACK_LAYER:FRONT_LAYER;
if(ghostState){
const savedNODES=NODES;
NODES=ghostState.NODES;
const ghostPat=this.getMergedPatternPath();
NODES=savedNODES;
const ghostPatOffset=ghostPat.map(p=>({x:p.x+GHOST_OFFSET.x,y:p.y+GHOST_OFFSET.y}));
const threshold=10/VIEW.zoom;
for(let i=0;i<ghostPatOffset.length;i++){
const a=ghostPatOffset[i];
const b=ghostPatOffset[(i+1)%ghostPatOffset.length];
const sl=(b.x-a.x)**2+(b.y-a.y)**2;
if(sl===0)continue;
let t=((w.x-a.x)*(b.x-a.x)+(w.y-a.y)*(b.y-a.y))/sl;
t=Math.max(0,Math.min(1,t));
const pr={x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)};
if(M.dist(w,pr)<threshold){
HOVER={type:'ghostLayer'};
break;
}
}
}
}
// Update cursor based on hover state
if(HOVER){
  if(HOVER.type === 'node' || HOVER.type === 'h1' || HOVER.type === 'h2') {
    this.canvas.style.cursor = 'grab';
  } else if(HOVER.type === 'gizmo') {
    if(HOVER.gizmoType === 'rotate') {
      this.canvas.style.cursor = 'crosshair';
    } else if(HOVER.gizmoType === 'scale' || HOVER.gizmoType === 'scaleX' || HOVER.gizmoType === 'scaleY') {
      this.canvas.style.cursor = 'nwse-resize';
    } else {
      this.canvas.style.cursor = 'move';
    }
  } else if(HOVER.type === 'rangeStart' || HOVER.type === 'rangeEnd') {
    this.canvas.style.cursor = 'ew-resize';
  } else if(HOVER.type === 'ghostLayer') {
    this.canvas.style.cursor = 'move';
  } else {
    this.canvas.style.cursor = 'pointer';
  }
} else {
  this.canvas.style.cursor = 'default';
}
// Only redraw if hover state changed (performance optimization)
if(!M.hoverEq(prevHover,HOVER)){
this.draw();
}
return;
}
if(!DRAG.active)return;e.preventDefault();
switch(DRAG.type){
case'publishPan':{
// Convert screen pixel delta to mm offset
const dx=(e.clientX-DRAG.sx)/PUBLISH_VIEW.scale;
const dy=(e.clientY-DRAG.sy)/PUBLISH_VIEW.scale;
PUBLISH_VIEW.x=DRAG.vx+dx;
PUBLISH_VIEW.y=DRAG.vy+dy;
break;
}
case'pan':VIEW.x=DRAG.vx+(e.clientX-DRAG.sx);VIEW.y=DRAG.vy+(e.clientY-DRAG.sy);break;
case'ghostLayer':{
// Update ghost offset with drag delta
const newOffsetX=DRAG.gox+(w.x-DRAG.sx);
const newOffsetY=DRAG.goy+(w.y-DRAG.sy);
// Snap to alignment when close to (0, 0) - within 10mm threshold
const snapThreshold=10;
if(Math.abs(newOffsetX)<snapThreshold&&Math.abs(newOffsetY)<snapThreshold){
GHOST_OFFSET.x=0;
GHOST_OFFSET.y=0;
// Show snap feedback
if(Math.abs(newOffsetX)>=snapThreshold-0.5||Math.abs(newOffsetY)>=snapThreshold-0.5){
this.showToast('✓ Snapped to alignment','success');
}
}else{
GHOST_OFFSET.x=newOffsetX;
GHOST_OFFSET.y=newOffsetY;
}
break;
}
case'refImage':REF_IMAGE.x=DRAG.ox+(w.x-DRAG.sx);REF_IMAGE.y=DRAG.oy+(w.y-DRAG.sy);break;
case'holsterGizmo':if(DRAG.gizmoType==='move'){HOLSTER.x=DRAG.shx+(w.x-DRAG.sx);HOLSTER.y=DRAG.shy+(w.y-DRAG.sy)}else if(DRAG.gizmoType==='rotate'){HOLSTER.rotation=Math.atan2(w.y-HOLSTER.y,w.x-HOLSTER.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-HOLSTER.x,DRAG.sy-HOLSTER.y),dn=Math.hypot(w.x-HOLSTER.x,w.y-HOLSTER.y),sf=dn/ds;if(SHIFT_HELD){const lw=M.worldToLocal(w,{x:HOLSTER.x,y:HOLSTER.y,rotation:HOLSTER.rotation,scaleX:1,scaleY:1}),b=M.getBounds(this.getPatternLocalPath());if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))HOLSTER.scaleX=Math.max(.1,Math.abs(lw.x)/(b.w/2+20));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))HOLSTER.scaleY=Math.max(.1,Math.abs(lw.y)/(b.h/2+20))}else{HOLSTER.scaleX=Math.max(.1,DRAG.ssx*sf);HOLSTER.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.updateInfo();break;
case'symHoleGizmo':{const hole=SYM_HOLES[DRAG.idx],lw=M.worldToHolster(w);if(DRAG.gizmoType==='move'){const s=snapLocal({x:Math.abs(lw.x),y:lw.y});hole.x=s.x;hole.y=s.y}else if(DRAG.gizmoType==='rotate'){const wh=this.getSymHoleWorld(hole,1);hole.rotation=Math.atan2(w.y-wh.y,w.x-wh.x)-(CFG.lockFoldLine?0:(HOLSTER.rotation||0))+Math.PI/4}else{const wh=this.getSymHoleWorld(hole,1),ds=Math.hypot(DRAG.sx-wh.x,DRAG.sy-wh.y),dn=Math.hypot(w.x-wh.x,w.y-wh.y),sf=dn/ds;if(SHIFT_HELD){const rot=(CFG.lockFoldLine?0:(HOLSTER.rotation||0))+(hole.rotation||0),lh=M.worldToLocal(w,{x:wh.x,y:wh.y,rotation:rot,scaleX:1,scaleY:1});if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))hole.width=Math.max(1,Math.abs(lh.x)*2/HOLSTER.scaleX);if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))hole.height=Math.max(1,Math.abs(lh.y)*2/HOLSTER.scaleY)}else{hole.width=Math.max(1,DRAG.sw*sf);hole.height=Math.max(1,DRAG.sh*sf)}}this.updateInfo();break}
case'asymHoleGizmo':{const hole=ASYM_HOLES[DRAG.idx];if(DRAG.gizmoType==='move'){const s=snapWorld(w);hole.x=s.x;hole.y=s.y}else if(DRAG.gizmoType==='rotate'){hole.rotation=Math.atan2(w.y-hole.y,w.x-hole.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-DRAG.shx,DRAG.sy-DRAG.shy),dn=Math.hypot(w.x-hole.x,w.y-hole.y),sf=dn/ds;if(SHIFT_HELD){const lh=M.worldToLocal(w,{x:hole.x,y:hole.y,rotation:hole.rotation||0,scaleX:1,scaleY:1});if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))hole.width=Math.max(1,Math.abs(lh.x)*2);if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))hole.height=Math.max(1,Math.abs(lh.y)*2)}else{hole.width=Math.max(1,DRAG.sw*sf);hole.height=Math.max(1,DRAG.sh*sf)}}this.updateInfo();break}
case'asymShapeGizmo':{const s=ASYM_SHAPES[DRAG.idx];if(DRAG.gizmoType==='move'){const sn=snapWorld(w);s.x=sn.x;s.y=sn.y}else if(DRAG.gizmoType==='rotate'){s.rotation=Math.atan2(w.y-s.y,w.x-s.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-DRAG.shx,DRAG.sy-DRAG.shy),dn=Math.hypot(w.x-s.x,w.y-s.y),sf=dn/ds;if(SHIFT_HELD&&s.points){const ls=M.worldToLocal(w,{x:s.x,y:s.y,rotation:s.rotation||0,scaleX:1,scaleY:1}),b=M.getBounds(s.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))s.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))s.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{s.scaleX=Math.max(.1,DRAG.ssx*sf);s.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.updateInfo();break}
case'asymShapeVertex':{const s=ASYM_SHAPES[DRAG.idx];
// Convert world coords to local shape coords
const localW=M.worldToLocal(w,{x:s.x,y:s.y,rotation:s.rotation||0,scaleX:s.scaleX||1,scaleY:s.scaleY||1});
s.points[DRAG.ptIdx].x=localW.x;
s.points[DRAG.ptIdx].y=localW.y;
break}
case'symCustomHoleGizmo':{const h=SYM_CUSTOM_HOLES[DRAG.idx],lw=M.worldToHolster(w);if(DRAG.gizmoType==='move'){const s=snapLocal({x:Math.abs(lw.x),y:lw.y});h.x=s.x;h.y=s.y}else if(DRAG.gizmoType==='rotate'){const pts=this.getCustomHoleWorld(h,1),b=M.getBounds(pts);h.rotation=Math.atan2(w.y-b.cy,w.x-b.cx)-(HOLSTER.rotation||0)+Math.PI/4}else{const pts=this.getCustomHoleWorld(h,1),b=M.getBounds(pts),ds=Math.hypot(DRAG.sx-b.cx,DRAG.sy-b.cy),dn=Math.hypot(w.x-b.cx,w.y-b.cy),sf=dn/ds;if(SHIFT_HELD){const ls=M.worldToLocal(w,{x:b.cx,y:b.cy,rotation:(HOLSTER.rotation||0)+(h.rotation||0),scaleX:1,scaleY:1}),hb=M.getBounds(h.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))h.scaleX=Math.max(.1,Math.abs(ls.x)/(hb.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))h.scaleY=Math.max(.1,Math.abs(ls.y)/(hb.h/2+10))}else{h.scaleX=Math.max(.1,DRAG.ssx*sf);h.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.updateInfo();break}
case'asymCustomHoleGizmo':{const h=ASYM_CUSTOM_HOLES[DRAG.idx];if(DRAG.gizmoType==='move'){const s=snapWorld(w);h.x=s.x;h.y=s.y}else if(DRAG.gizmoType==='rotate'){h.rotation=Math.atan2(w.y-h.y,w.x-h.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-DRAG.shx,DRAG.sy-DRAG.shy),dn=Math.hypot(w.x-h.x,w.y-h.y),sf=dn/ds;if(SHIFT_HELD){const ls=M.worldToLocal(w,{x:h.x,y:h.y,rotation:h.rotation||0,scaleX:1,scaleY:1}),b=M.getBounds(h.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))h.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))h.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{h.scaleX=Math.max(.1,DRAG.ssx*sf);h.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.updateInfo();break}
case'symStitchPt':{const sl=SYM_STITCHES[DRAG.idx],lw=M.worldToHolster(w);const s=snapLocal({x:Math.abs(lw.x),y:lw.y});sl.points[DRAG.ptIdx].x=s.x;sl.points[DRAG.ptIdx].y=s.y;break}
case'asymStitchPt':{const sl=ASYM_STITCHES[DRAG.idx];const s=snapWorld(w);sl.points[DRAG.ptIdx].x=s.x;sl.points[DRAG.ptIdx].y=s.y;break}
case'symCustomHoleNode':{const h=SYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.getCustomHoleControlPts(h,1),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx/HOLSTER.scaleX,y:dy/HOLSTER.scaleY},rot);p.x+=rd.x/(h.scaleX||1);p.y+=rd.y/(h.scaleY||1);break}
case'symCustomHoleH1':{const h=SYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.getCustomHoleControlPts(h,1),cp=cpts[DRAG.ptIdx];const dx=(w.x-cp.x)/HOLSTER.scaleX,dy=(w.y-cp.y)/HOLSTER.scaleY;const rot=-(h.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.h1={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'symCustomHoleH2':{const h=SYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.getCustomHoleControlPts(h,1),cp=cpts[DRAG.ptIdx];const dx=(w.x-cp.x)/HOLSTER.scaleX,dy=(w.y-cp.y)/HOLSTER.scaleY;const rot=-(h.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.h2={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'asymCustomHoleNode':{const h=ASYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.getCustomHoleControlPtsAsym(h),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.x+=rd.x/(h.scaleX||1);p.y+=rd.y/(h.scaleY||1);break}
case'asymCustomHoleH1':{const h=ASYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.getCustomHoleControlPtsAsym(h),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.h1={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'asymCustomHoleH2':{const h=ASYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.getCustomHoleControlPtsAsym(h),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.h2={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'rangeStart':EDGE_RANGES[DRAG.idx].start=Math.max(0,Math.min(EDGE_RANGES[DRAG.idx].end-.01,M.projectToPath(DRAG.path,DRAG.arc,w)));break;
case'rangeEnd':EDGE_RANGES[DRAG.idx].end=Math.max(EDGE_RANGES[DRAG.idx].start+.01,Math.min(1,M.projectToPath(DRAG.path,DRAG.arc,w)));break;
case'mergedRangeStart':MERGED_EDGE_RANGES[DRAG.idx].start=Math.max(0,Math.min(MERGED_EDGE_RANGES[DRAG.idx].end-.01,M.projectToPath(DRAG.path,DRAG.arc,w)));break;
case'mergedRangeEnd':MERGED_EDGE_RANGES[DRAG.idx].end=Math.max(MERGED_EDGE_RANGES[DRAG.idx].start+.01,Math.min(1,M.projectToPath(DRAG.path,DRAG.arc,w)));break;
case'textMove':{const t=TEXT_ANNOTATIONS[DRAG.idx];const s=snapWorld({x:w.x-DRAG.ox,y:w.y-DRAG.oy});t.x=s.x;t.y=s.y;break}
case'textArrow':{const t=TEXT_ANNOTATIONS[DRAG.idx];t.arrowTo={x:w.x,y:w.y};break}
case'node':{const lw=M.worldToHolster(w);const s=CFG.asymmetricOutline?snapLocal({x:lw.x,y:lw.y}):snapLocal({x:Math.max(0,lw.x),y:lw.y});NODES[DRAG.idx].x=s.x;NODES[DRAG.idx].y=s.y;break}
case'h1':{const lw=M.worldToHolster(w);const n=NODES[DRAG.idx];n.h1={x:lw.x-n.x,y:lw.y-n.y};
// When dragging h1, update h2 if linked OR if Shift is held
if(n.linked||SHIFT_HELD){n.h2={x:-n.h1.x,y:-n.h1.y}}
break}
case'h2':{const lw=M.worldToHolster(w);const n=NODES[DRAG.idx];n.h2={x:lw.x-n.x,y:lw.y-n.y};
// When dragging h2, update h1 if linked OR if Shift is held
if(n.linked||SHIFT_HELD){n.h1={x:-n.h2.x,y:-n.h2.y}}
break}
}
this.draw();
}
onUp(){if(DRAG.active&&DRAG.type&&DRAG.type!=='publishPan'){this.saveState()}DRAG.active=false;if(PUBLISH_MODE){this.canvas.style.cursor='grab'}else if(!isPanning){this.canvas.style.cursor='default'}}
getStitchCount(layerState){
// Count stitches in a layer (edge stitches only for now)
let count=0;
const savedNODES=NODES;
const savedEDGE_RANGES=EDGE_RANGES;
const savedEDGE_STITCHES=EDGE_STITCHES;
if(layerState){
NODES=layerState.NODES;
EDGE_RANGES=layerState.EDGE_RANGES;
EDGE_STITCHES=layerState.EDGE_STITCHES;
}
const rightHalfP=this.getRightHalfPath();
const rightWorldP=rightHalfP.map(p=>M.holsterToWorld(p));
EDGE_STITCHES.forEach(es=>{
const rng=EDGE_RANGES[es.rangeIdx];if(!rng)return;
const stitchPath=this.offsetPathStable(rightWorldP,-(es.margin||CFG.stitchMargin));
if(stitchPath.length<3)return;
const stitchArc=M.buildArc(stitchPath);
const tot=stitchArc[stitchArc.length-1].d;
const sd=tot*rng.start,ed=tot*rng.end;
if(es.showHoles!==false){
const spacing=es.spacing||CFG.stitchSpacing;
const stitchesInRange=Math.floor((ed-sd)/spacing)+1;
count+=stitchesInRange;
if(es.mirror!==false&&CFG.mirrorEdgeStitches&&!CFG.asymmetricOutline){
count+=stitchesInRange;
}}
});
if(layerState){
NODES=savedNODES;
EDGE_RANGES=savedEDGE_RANGES;
EDGE_STITCHES=savedEDGE_STITCHES;
}
return count;
}
centerPublishView(){
// Calculate pattern bounds
const isTwoLayer=CFG.projectType==='two-layer';
const layout=isTwoLayer?CFG.publishLayout:'front-only';
let pat,b;
if(isTwoLayer&&FRONT_LAYER){
const savedNODES=NODES;
NODES=FRONT_LAYER.NODES;
pat=this.getMergedPatternPath();
b=M.getBounds(pat);
NODES=savedNODES;
}else{
pat=this.getMergedPatternPath();
b=M.getBounds(pat);
}
// Adjust bounds for side-by-side or stacked layouts
const layerGap=20; // mm gap between layers in multi-layer layouts
let totalW=b.w,totalH=b.h;
if(isTwoLayer&&layout==='side-by-side'){
totalW=b.w*2+layerGap;
}else if(isTwoLayer&&layout==='stacked'){
totalH=b.h*2+layerGap;
}
// Canvas dimensions in screen pixels
const w=this.canvas.width/this.dpr;
const h=this.canvas.height/this.dpr;
if(CFG.publishViewMode==='full-pattern'){
// Full Pattern mode: Center the pattern with appropriate zoom to fit
const headerH=120; // Header space in pixels
const footerH=80; // Footer space in pixels
const margin=60; // Side margins in pixels
const availW=w-margin*2;
const availH=h-headerH-footerH;
// Calculate scale to fit pattern with padding
const scaleX=availW/(totalW*1.2); // 20% padding
const scaleY=availH/(totalH*1.2);
const scale=Math.min(scaleX,scaleY,3); // Cap at 3x
// The pattern rendering in drawPublishFullPattern centers it automatically
// But we still need to set up PUBLISH_VIEW for panning/zooming
PUBLISH_VIEW={x:0,y:0,scale:scale};
}else{
// A4 Pages mode: Center the page grid
const A4W=210,A4H=300;
const pageMargin=parseFloat(CFG.pageMargin)||10;
const overlap=parseFloat(CFG.pageOverlap)||15;
const effectiveW=A4W-pageMargin*2-overlap;
const effectiveH=A4H-pageMargin*2-overlap;
const pagesX=Math.max(1,Math.ceil(totalW/effectiveW));
const pagesY=Math.max(1,Math.ceil(totalH/effectiveH));
// Calculate scale to fit grid on screen with margin
const gridMargin=40; // pixels margin around grid
const availW=w-gridMargin*2;
const availH=h-gridMargin*2-40; // Extra space for title
// Grid dimensions at scale=1
const gap=8; // gap between pages in pixels (at scale=1)
const gridW1=pagesX*A4W+(pagesX-1)*gap;
const gridH1=pagesY*A4H+(pagesY-1)*gap;
// Calculate scale to fit grid
const scaleX=availW/gridW1;
const scaleY=availH/gridH1;
const scale=Math.min(scaleX,scaleY,2); // Cap at 2x
// Keep x,y at 0,0 - the drawPublish transforms already handle pattern positioning
// User can drag to adjust if needed
PUBLISH_VIEW={x:0,y:0,scale:scale};
}
}
togglePublish(){
PUBLISH_MODE=!PUBLISH_MODE;
document.body.classList.toggle('publish-mode',PUBLISH_MODE);
if(PUBLISH_MODE){
SELECTED=null;this.updateInfo();
// Set view mode selector
document.getElementById('publish-view-mode').value=CFG.publishViewMode||'a4-pages';
// Check stitch count mismatch for two-layer mode
if(CFG.projectType==='two-layer'&&FRONT_LAYER&&BACK_LAYER){
const frontCount=this.getStitchCount(FRONT_LAYER);
const backCount=this.getStitchCount(BACK_LAYER);
if(frontCount!==backCount){
this.showToast(`⚠ Stitch count mismatch! Front: ${frontCount} | Back: ${backCount}`,'warning');
}
}
// Use full window for tiled page preview
this.publishDpr=this.dpr;
this.canvas.width=window.innerWidth*this.dpr;
this.canvas.height=window.innerHeight*this.dpr;
this.canvas.style.width='100%';
this.canvas.style.height='100%';
this.canvas.style.margin='0';
this.canvas.style.display='block';
this.canvas.style.boxShadow='none';
this.canvas.style.cursor='grab';
// Center the pattern in the view
this.centerPublishView();
}else{
// Restore normal canvas size
this.resize();
this.canvas.style.margin='';
this.canvas.style.boxShadow='';
this.canvas.style.cursor='default';
}
this.draw();
}
downloadPattern(){
const format=document.getElementById('export-format').value;
const title=document.getElementById('pattern-title').value||'pattern';
if(CFG.publishViewMode==='full-pattern'){
this.downloadFullPattern(format,title);
}else{
this.downloadA4Pages(format,title);
}
}
downloadFullPattern(format,title){
// Export single full-size pattern image
const DPI=150; // 150 DPI for print quality
const scale=DPI/25.4; // pixels per mm
// Determine which layers to render
const isTwoLayer=CFG.projectType==='two-layer';
const layout=isTwoLayer?CFG.publishLayout:'front-only';
let layersToRender=[];
if(isTwoLayer){
if(layout==='front-only'){layersToRender=[{state:FRONT_LAYER,label:'FRONT',color:'#000'}]}
else if(layout==='back-only'){layersToRender=[{state:BACK_LAYER,label:'BACK',color:'#000'}]}
else if(layout==='overlaid'){layersToRender=[{state:FRONT_LAYER,label:'FRONT',color:'#007AFF'},{state:BACK_LAYER,label:'BACK',color:'#FF6600'}]}
else{layersToRender=[{state:FRONT_LAYER,label:'FRONT',color:'#000'},{state:BACK_LAYER,label:'BACK',color:'#000'}]}
}else{
layersToRender=[{state:null,label:'',color:'#000'}];
}
// Get pattern bounds
let pat,b;
if(isTwoLayer&&FRONT_LAYER){
const savedNODES=NODES;
NODES=FRONT_LAYER.NODES;
pat=this.getMergedPatternPath();
b=M.getBounds(pat);
NODES=savedNODES;
}else{
pat=this.getMergedPatternPath();
b=M.getBounds(pat);
}
// Adjust bounds for layouts
const layerGap=20;
let totalW=b.w,totalH=b.h;
if(isTwoLayer&&layout==='side-by-side'){
totalW=b.w*2+layerGap;
}else if(isTwoLayer&&layout==='stacked'){
totalH=b.h*2+layerGap;
}
// Add margins for header, footer, and sides
const headerH=120/scale; // mm
const footerH=60/scale; // mm
const sideMargin=40/scale; // mm
const canvasW=(totalW+sideMargin*2)*scale;
const canvasH=(totalH+headerH+footerH)*scale;
// Create canvas
const canvas=document.createElement('canvas');
canvas.width=canvasW;
canvas.height=canvasH;
const ctx=canvas.getContext('2d');
// White background
ctx.fillStyle='#fff';
ctx.fillRect(0,0,canvasW,canvasH);
// Draw header
ctx.fillStyle='#000';
ctx.font='bold 48px sans-serif';
ctx.textAlign='center';
ctx.fillText(title,canvasW/2,60);
ctx.font='24px sans-serif';
ctx.fillStyle='#555';
ctx.fillText('Made with 9-10oz Veg-Tan Leather',canvasW/2,100);
ctx.fillText(`Pattern Size: ${totalW.toFixed(0)}×${totalH.toFixed(0)}mm`,canvasW/2,130);
// Position and scale for pattern
ctx.save();
ctx.translate(sideMargin*scale,headerH*scale);
ctx.translate(-b.minx*scale,-b.miny*scale);
ctx.scale(scale,scale);
// Draw patterns
if(isTwoLayer&&layout==='side-by-side'&&layersToRender.length>=2){
layersToRender[0].state&&this.drawPatternLayerFullPattern(ctx,layersToRender[0].state,scale,layersToRender[0].color,layersToRender[0].label);
ctx.save();
ctx.translate(b.w+layerGap,0);
layersToRender[1].state&&this.drawPatternLayerFullPattern(ctx,layersToRender[1].state,scale,layersToRender[1].color,layersToRender[1].label);
ctx.restore();
}else if(isTwoLayer&&layout==='stacked'&&layersToRender.length>=2){
layersToRender[0].state&&this.drawPatternLayerFullPattern(ctx,layersToRender[0].state,scale,layersToRender[0].color,layersToRender[0].label);
ctx.save();
ctx.translate(0,b.h+layerGap);
layersToRender[1].state&&this.drawPatternLayerFullPattern(ctx,layersToRender[1].state,scale,layersToRender[1].color,layersToRender[1].label);
ctx.restore();
}else if(isTwoLayer&&layout==='overlaid'){
layersToRender.forEach(lr=>{
ctx.save();
ctx.globalAlpha=0.7;
lr.state&&this.drawPatternLayerFullPattern(ctx,lr.state,scale,lr.color,lr.label);
ctx.restore();
});
}else{
const lr=layersToRender[0];
lr.state?this.drawPatternLayerFullPattern(ctx,lr.state,scale,lr.color,lr.label):this.drawPatternLayerFullPattern(ctx,null,scale,'#000','');
}
// Draw text annotations
if(!isTwoLayer||layout==='front-only'||layout==='back-only'){
TEXT_ANNOTATIONS.forEach(t=>{
if(!t.text)return;
const fs=t.fontSize||12;
ctx.font=`${t.italic?'italic ':''}${t.bold?'bold ':''}${fs}px sans-serif`;
ctx.fillStyle='#000';ctx.textAlign='left';ctx.textBaseline='top';
ctx.fillText(t.text,t.x,t.y);
});
}
ctx.restore();
// Draw footer
ctx.fillStyle='#999';
ctx.font='20px sans-serif';
ctx.textAlign='center';
const layoutInfo=isTwoLayer?` · ${layout.replace(/-/g,' ')} layout`:'';
ctx.fillText(`Full Pattern${layoutInfo}`,canvasW/2,canvasH-30);
// Download
const link=document.createElement('a');
link.download=title+'_full.'+(format==='jpg'?'jpg':'png');
link.href=canvas.toDataURL(format==='jpg'?'image/jpeg':'image/png',0.95);
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
}
downloadA4Pages(format,title){
// Get page layout info
const A4W=210,A4H=300;
const pageMargin=parseFloat(CFG.pageMargin)||10;
const overlap=parseFloat(CFG.pageOverlap)||15;
const printW=A4W-pageMargin*2;
const printH=A4H-pageMargin*2;
const effectiveW=printW-overlap;
const effectiveH=printH-overlap;
const pat=this.getMergedPatternPath();
const b=M.getBounds(pat);
const pagesX=Math.max(1,Math.ceil(b.w/effectiveW));
const pagesY=Math.max(1,Math.ceil(b.h/effectiveH));
const totalPages=pagesX*pagesY;
// DPI for export (150 DPI for print quality)
const DPI=150;
const pageWpx=Math.round(A4W/25.4*DPI);
const pageHpx=Math.round(A4H/25.4*DPI);
const scale=DPI/25.4; // pixels per mm
const gap=20; // gap between pages in pixels
const dragX=PUBLISH_VIEW.x;
const dragY=PUBLISH_VIEW.y;
// Create one big canvas with all pages in a grid
const totalW=pagesX*pageWpx+(pagesX-1)*gap;
const totalH=pagesY*pageHpx+(pagesY-1)*gap;
const bigCanvas=document.createElement('canvas');
bigCanvas.width=totalW;
bigCanvas.height=totalH;
const bigCtx=bigCanvas.getContext('2d');
bigCtx.fillStyle='#888';
bigCtx.fillRect(0,0,totalW,totalH);
// Draw each page
for(let py=0;py<pagesY;py++){
for(let px=0;px<pagesX;px++){
const pageNum=py*pagesX+px+1;
const pageX=px*(pageWpx+gap);
const pageY=py*(pageHpx+gap);
// White page background
bigCtx.fillStyle='#fff';
bigCtx.fillRect(pageX,pageY,pageWpx,pageHpx);
// Calculate pattern offset for this page
const marginPx=pageMargin*scale;
bigCtx.save();
bigCtx.translate(pageX,pageY);
bigCtx.beginPath();
bigCtx.rect(0,0,pageWpx,pageHpx);
bigCtx.clip();
bigCtx.translate(marginPx,marginPx);
bigCtx.translate(dragX*scale,dragY*scale);
bigCtx.translate(-px*effectiveW*scale,-py*effectiveH*scale);
bigCtx.translate(-b.minx*scale,-b.miny*scale);
bigCtx.scale(scale,scale);
// Draw pattern outline
bigCtx.beginPath();
pat.forEach((p,i)=>i===0?bigCtx.moveTo(p.x,p.y):bigCtx.lineTo(p.x,p.y));
bigCtx.closePath();
bigCtx.strokeStyle='#000';
bigCtx.lineWidth=0.5;
bigCtx.stroke();
// Draw fold line
bigCtx.strokeStyle='#000';
bigCtx.lineWidth=0.3;
bigCtx.setLineDash([3,2]);
bigCtx.beginPath();
bigCtx.moveTo(HOLSTER.x,b.miny-5);
bigCtx.lineTo(HOLSTER.x,b.maxy+5);
bigCtx.stroke();
bigCtx.setLineDash([]);
// Draw edge stitches
const rightHalfP=this.getRightHalfPath();
const rightWorldP=rightHalfP.map(p=>M.holsterToWorld(p));
EDGE_STITCHES.forEach(es=>{
const rng=EDGE_RANGES[es.rangeIdx];if(!rng)return;
const stitchPath=this.offsetPathStable(rightWorldP,-(es.margin||CFG.stitchMargin));
if(stitchPath.length<3)return;
const stitchArc=M.buildArc(stitchPath);
const tot=stitchArc[stitchArc.length-1].d;
const sd=tot*rng.start,ed=tot*rng.end;
if(es.showHoles!==false){
bigCtx.fillStyle='#000';
for(let d=sd;d<=ed;d+=(es.spacing||CFG.stitchSpacing)){
const pt=M.ptAtDist(stitchArc,d);if(!pt)continue;
bigCtx.beginPath();bigCtx.arc(pt.x,pt.y,(es.holeSize||CFG.holeSize)/2,0,Math.PI*2);bigCtx.fill();
if(es.mirror!==false&&CFG.mirrorEdgeStitches&&!CFG.asymmetricOutline){
bigCtx.beginPath();bigCtx.arc(2*HOLSTER.x-pt.x,pt.y,(es.holeSize||CFG.holeSize)/2,0,Math.PI*2);bigCtx.fill();
}}}
});
// Draw symmetric holes
if(CFG.showSymmetric)SYM_HOLES.forEach(hole=>{
[1,-1].forEach(side=>{
const wh=this.getSymHoleWorld(hole,side);
bigCtx.strokeStyle='#000';bigCtx.lineWidth=0.4;
bigCtx.beginPath();bigCtx.arc(wh.x,wh.y,wh.width/2,0,Math.PI*2);bigCtx.stroke();
});
});
bigCtx.restore();
// Draw guides on this page (not clipped)
bigCtx.save();
bigCtx.translate(pageX,pageY);
// Draw margin guide (gray dashed)
bigCtx.strokeStyle='#aaa';bigCtx.lineWidth=1;bigCtx.setLineDash([4,4]);
bigCtx.strokeRect(marginPx,marginPx,printW*scale,printH*scale);
bigCtx.setLineDash([]);
// Draw overlap guides (orange dashed)
bigCtx.strokeStyle='#f80';bigCtx.lineWidth=1.5;bigCtx.setLineDash([6,3]);
const overlapPx=overlap*scale;
if(px<pagesX-1){
const ox=pageWpx-marginPx-overlapPx;
bigCtx.beginPath();bigCtx.moveTo(ox,marginPx);bigCtx.lineTo(ox,pageHpx-marginPx);bigCtx.stroke();
}
if(py<pagesY-1){
const oy=pageHpx-marginPx-overlapPx;
bigCtx.beginPath();bigCtx.moveTo(marginPx,oy);bigCtx.lineTo(pageWpx-marginPx,oy);bigCtx.stroke();
}
if(px>0){
const ox=marginPx+overlapPx;
bigCtx.beginPath();bigCtx.moveTo(ox,marginPx);bigCtx.lineTo(ox,pageHpx-marginPx);bigCtx.stroke();
}
if(py>0){
const oy=marginPx+overlapPx;
bigCtx.beginPath();bigCtx.moveTo(marginPx,oy);bigCtx.lineTo(pageWpx-marginPx,oy);bigCtx.stroke();
}
bigCtx.setLineDash([]);
// Registration marks
if(CFG.showRegMarks){
bigCtx.strokeStyle='#000';bigCtx.lineWidth=2;
const rm=15,mo=marginPx/2;
[[mo,mo],[pageWpx-mo,mo],[mo,pageHpx-mo],[pageWpx-mo,pageHpx-mo]].forEach(([x,y])=>{
bigCtx.beginPath();bigCtx.moveTo(x-rm,y);bigCtx.lineTo(x+rm,y);bigCtx.stroke();
bigCtx.beginPath();bigCtx.moveTo(x,y-rm);bigCtx.lineTo(x,y+rm);bigCtx.stroke();
bigCtx.beginPath();bigCtx.arc(x,y,3,0,Math.PI*2);bigCtx.stroke();
});
}
// Page number
bigCtx.fillStyle='#999';bigCtx.font='24px sans-serif';bigCtx.textAlign='center';
bigCtx.fillText(`Page ${pageNum}`,pageWpx/2,pageHpx-20);
bigCtx.restore();
}}
// Download the combined image
const link=document.createElement('a');
link.download=title+'_all_pages.'+(format==='jpg'?'jpg':'png');
link.href=bigCanvas.toDataURL(format==='jpg'?'image/jpeg':'image/png',0.95);
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
}
drawPublish(){
// Dispatch to appropriate render mode
if(CFG.publishViewMode==='full-pattern'){
this.drawPublishFullPattern();
}else{
this.drawPublishA4Pages();
}
}
drawPublishA4Pages(){
const dpr=this.dpr;
const ctx=this.ctx,w=this.canvas.width/dpr,h=this.canvas.height/dpr;
ctx.setTransform(dpr,0,0,dpr,0,0);
// Gray background
ctx.fillStyle='#555';ctx.fillRect(0,0,w,h);
// A4 page dimensions in mm (21cm x 30cm)
const A4W=210,A4H=300;
const pageMargin=parseFloat(CFG.pageMargin)||10; // mm
const overlap=parseFloat(CFG.pageOverlap)||15; // mm
// Printable area per page
const printW=A4W-pageMargin*2;
const printH=A4H-pageMargin*2;
// Effective unique area per page (excluding overlap)
const effectiveW=printW-overlap;
const effectiveH=printH-overlap;
// Determine which layers to render for two-layer mode
const isTwoLayer=CFG.projectType==='two-layer';
const layout=isTwoLayer?CFG.publishLayout:'front-only';
let layersToRender=[];
if(isTwoLayer){
if(layout==='front-only'){layersToRender=[{state:FRONT_LAYER,label:'FRONT',color:'#000'}]}
else if(layout==='back-only'){layersToRender=[{state:BACK_LAYER,label:'BACK',color:'#000'}]}
else if(layout==='overlaid'){layersToRender=[{state:FRONT_LAYER,label:'FRONT',color:'#007AFF'},{state:BACK_LAYER,label:'BACK',color:'#FF6600'}]}
else{layersToRender=[{state:FRONT_LAYER,label:'FRONT',color:'#000'},{state:BACK_LAYER,label:'BACK',color:'#000'}]}
}else{
layersToRender=[{state:null,label:'',color:'#000'}];
}
// Get pattern bounds (use front layer for sizing in two-layer mode)
let pat,b;
if(isTwoLayer&&FRONT_LAYER){
const savedNODES=NODES;
NODES=FRONT_LAYER.NODES;
pat=this.getMergedPatternPath();
b=M.getBounds(pat);
NODES=savedNODES;
}else{
pat=this.getMergedPatternPath();
b=M.getBounds(pat);
}
// Adjust bounds for side-by-side or stacked layouts
const layerGap=20; // mm gap between layers in multi-layer layouts
let totalW=b.w,totalH=b.h;
if(isTwoLayer&&layout==='side-by-side'){
totalW=b.w*2+layerGap;
}else if(isTwoLayer&&layout==='stacked'){
totalH=b.h*2+layerGap;
}
// Fixed page count based on pattern size only
const pagesX=Math.max(1,Math.ceil(totalW/effectiveW));
const pagesY=Math.max(1,Math.ceil(totalH/effectiveH));
// Scale for display
const scale=PUBLISH_VIEW.scale;
const pageW=A4W*scale;
const pageH=A4H*scale;
const gap=8;
// Grid dimensions
const gridW=pagesX*pageW+(pagesX-1)*gap;
const gridH=pagesY*pageH+(pagesY-1)*gap;
// Center grid on screen
const gridStartX=(w-gridW)/2;
const gridStartY=(h-gridH)/2+20;
// User drag offset (in mm, will be scaled to pixels)
const dragX=PUBLISH_VIEW.x;
const dragY=PUBLISH_VIEW.y;
// Draw pages
for(let py=0;py<pagesY;py++){
for(let px=0;px<pagesX;px++){
const pageX=gridStartX+px*(pageW+gap);
const pageY=gridStartY+py*(pageH+gap);
// White page with shadow
ctx.fillStyle='#fff';
ctx.shadowColor='rgba(0,0,0,0.3)';ctx.shadowBlur=8;ctx.shadowOffsetX=2;ctx.shadowOffsetY=2;
ctx.fillRect(pageX,pageY,pageW,pageH);
ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
// Clip to page
ctx.save();
ctx.beginPath();
ctx.rect(pageX,pageY,pageW,pageH);
ctx.clip();
// Calculate pattern position - simple approach
const marginPx = pageMargin * scale;
// Each page shows a window into the pattern
// Page (0,0) shows pattern starting at its top-left (b.minx, b.miny)
// Page (1,0) shows pattern offset by effectiveW mm to the left, etc.
ctx.save();
// Move to page's printable area
ctx.translate(pageX + marginPx, pageY + marginPx);
// Add user drag (in mm, scaled to pixels)
ctx.translate(dragX * scale, dragY * scale);
// Offset for which page we're on
ctx.translate(-px * effectiveW * scale, -py * effectiveH * scale);
// Offset so pattern's top-left corner (b.minx, b.miny) is at origin
ctx.translate(-b.minx * scale, -b.miny * scale);
// Scale pattern coordinates to screen
ctx.scale(scale, scale);
// Draw patterns based on layout
if(isTwoLayer&&layout==='side-by-side'&&layersToRender.length>=2){
// Draw front layer on left
layersToRender[0].state&&this.drawPatternLayer(ctx,layersToRender[0].state,scale,layersToRender[0].color,layersToRender[0].label);
// Draw back layer on right (offset by pattern width + gap)
ctx.save();
ctx.translate(b.w+layerGap,0);
layersToRender[1].state&&this.drawPatternLayer(ctx,layersToRender[1].state,scale,layersToRender[1].color,layersToRender[1].label);
ctx.restore();
}else if(isTwoLayer&&layout==='stacked'&&layersToRender.length>=2){
// Draw front layer on top
layersToRender[0].state&&this.drawPatternLayer(ctx,layersToRender[0].state,scale,layersToRender[0].color,layersToRender[0].label);
// Draw back layer on bottom (offset by pattern height + gap)
ctx.save();
ctx.translate(0,b.h+layerGap);
layersToRender[1].state&&this.drawPatternLayer(ctx,layersToRender[1].state,scale,layersToRender[1].color,layersToRender[1].label);
ctx.restore();
}else if(isTwoLayer&&layout==='overlaid'){
// Draw both layers overlaid with different colors
layersToRender.forEach(lr=>{
ctx.save();
ctx.globalAlpha=0.7;
lr.state&&this.drawPatternLayer(ctx,lr.state,scale,lr.color,lr.label);
ctx.restore();
});
}else{
// Single layer or front-only/back-only
const lr=layersToRender[0];
lr.state?this.drawPatternLayer(ctx,lr.state,scale,lr.color,lr.label):this.drawPatternLayer(ctx,null,scale,'#000','');
}
// Draw text annotations (only for current layer in non-overlaid modes)
if(!isTwoLayer||layout==='front-only'||layout==='back-only'){
TEXT_ANNOTATIONS.forEach(t=>{
if(!t.text)return;
const fs=t.fontSize||12;
ctx.font=`${t.italic?'italic ':''}${t.bold?'bold ':''}${fs}px sans-serif`;
ctx.fillStyle='#000';ctx.textAlign='left';ctx.textBaseline='top';
ctx.fillText(t.text,t.x,t.y);
});
}
ctx.restore(); // pattern transform
// Draw margin and overlap guide lines
const margPx=pageMargin*scale;
const overlapPx=overlap*scale;
// Margin lines (where content should stay inside)
ctx.strokeStyle='#aaa';ctx.lineWidth=0.5;ctx.setLineDash([4,4]);
// Inner margin rectangle
ctx.strokeRect(pageX+margPx,pageY+margPx,pageW-margPx*2,pageH-margPx*2);
ctx.setLineDash([]);
// Overlap zones - dashed lines showing where pages overlap
ctx.strokeStyle='#f80';ctx.lineWidth=1;ctx.setLineDash([6,3]);
// Right overlap (if not last column)
if(px<pagesX-1){
const ox=pageX+pageW-margPx-overlapPx;
ctx.beginPath();ctx.moveTo(ox,pageY+margPx);ctx.lineTo(ox,pageY+pageH-margPx);ctx.stroke();
}
// Bottom overlap (if not last row)
if(py<pagesY-1){
const oy=pageY+pageH-margPx-overlapPx;
ctx.beginPath();ctx.moveTo(pageX+margPx,oy);ctx.lineTo(pageX+pageW-margPx,oy);ctx.stroke();
}
// Left overlap indicator (if not first column) - shows where to align
if(px>0){
const ox=pageX+margPx+overlapPx;
ctx.beginPath();ctx.moveTo(ox,pageY+margPx);ctx.lineTo(ox,pageY+pageH-margPx);ctx.stroke();
}
// Top overlap indicator (if not first row)
if(py>0){
const oy=pageY+margPx+overlapPx;
ctx.beginPath();ctx.moveTo(pageX+margPx,oy);ctx.lineTo(pageX+pageW-margPx,oy);ctx.stroke();
}
ctx.setLineDash([]);
// Draw registration marks on this page (after pattern, so they're on top)
if(CFG.showRegMarks){
ctx.strokeStyle='#000';ctx.lineWidth=1.5;
const rm=10; // mark size in screen pixels
const mo=margPx/2; // mark at half margin
// Corner marks
[[pageX+mo,pageY+mo],[pageX+pageW-mo,pageY+mo],[pageX+mo,pageY+pageH-mo],[pageX+pageW-mo,pageY+pageH-mo]].forEach(([x,y])=>{
ctx.beginPath();ctx.moveTo(x-rm,y);ctx.lineTo(x+rm,y);ctx.stroke();
ctx.beginPath();ctx.moveTo(x,y-rm);ctx.lineTo(x,y+rm);ctx.stroke();
ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.stroke();
});
// Center marks
if(CFG.showCenterMarks){
const cms=8;
[[pageX+pageW/2,pageY+mo],[pageX+pageW/2,pageY+pageH-mo],[pageX+mo,pageY+pageH/2],[pageX+pageW-mo,pageY+pageH/2]].forEach(([x,y],i)=>{
if(i<2){ctx.beginPath();ctx.moveTo(x,y-cms);ctx.lineTo(x,y+cms);ctx.stroke();}
else{ctx.beginPath();ctx.moveTo(x-cms,y);ctx.lineTo(x+cms,y);ctx.stroke();}
});
}
}
// Page number
ctx.fillStyle='#999';ctx.font='10px sans-serif';ctx.textAlign='center';
ctx.fillText(`${py*pagesX+px+1}`,pageX+pageW/2,pageY+pageH-8);
ctx.restore(); // clip
}}
// Title
ctx.fillStyle='#fff';ctx.font='bold 16px sans-serif';ctx.textAlign='center';
ctx.fillText(document.getElementById('pattern-title').value||'Holster Pattern',w/2,20);
// Info
ctx.font='12px sans-serif';ctx.fillStyle='#ccc';
const layoutInfo=isTwoLayer?` · ${layout.replace(/-/g,' ')} layout`:'';
let stitchInfo='';
if(isTwoLayer&&FRONT_LAYER&&BACK_LAYER){
const frontCount=this.getStitchCount(FRONT_LAYER);
const backCount=this.getStitchCount(BACK_LAYER);
const match=frontCount===backCount;
stitchInfo=` · Front: ${frontCount} | Back: ${backCount} ${match?'✓':'⚠'}`;
}
const viewZoomPercent=Math.round(scale*100);
ctx.fillText(`Pattern Size: ${b.w.toFixed(0)}×${b.h.toFixed(0)}mm · ${pagesX}×${pagesY} pages${layoutInfo}${stitchInfo} · ${overlap}mm overlap`,w/2,h-30);
ctx.fillText(`View: ${viewZoomPercent}% · Drag to reposition · Scroll to zoom · Print at 100% scale`,w/2,h-15);
}
drawPublishFullPattern(){
const dpr=this.dpr;
const ctx=this.ctx,w=this.canvas.width/dpr,h=this.canvas.height/dpr;
ctx.setTransform(dpr,0,0,dpr,0,0);
// White background for professional output
ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
// Determine which layers to render for two-layer mode
const isTwoLayer=CFG.projectType==='two-layer';
const layout=isTwoLayer?CFG.publishLayout:'front-only';
let layersToRender=[];
if(isTwoLayer){
if(layout==='front-only'){layersToRender=[{state:FRONT_LAYER,label:'FRONT',color:'#000'}]}
else if(layout==='back-only'){layersToRender=[{state:BACK_LAYER,label:'BACK',color:'#000'}]}
else if(layout==='overlaid'){layersToRender=[{state:FRONT_LAYER,label:'FRONT',color:'#007AFF'},{state:BACK_LAYER,label:'BACK',color:'#FF6600'}]}
else{layersToRender=[{state:FRONT_LAYER,label:'FRONT',color:'#000'},{state:BACK_LAYER,label:'BACK',color:'#000'}]}
}else{
layersToRender=[{state:null,label:'',color:'#000'}];
}
// Get pattern bounds (use front layer for sizing in two-layer mode)
let pat,b;
if(isTwoLayer&&FRONT_LAYER){
const savedNODES=NODES;
NODES=FRONT_LAYER.NODES;
pat=this.getMergedPatternPath();
b=M.getBounds(pat);
NODES=savedNODES;
}else{
pat=this.getMergedPatternPath();
b=M.getBounds(pat);
}
// Adjust bounds for side-by-side or stacked layouts
const layerGap=20; // mm gap between layers in multi-layer layouts
let totalW=b.w,totalH=b.h;
if(isTwoLayer&&layout==='side-by-side'){
totalW=b.w*2+layerGap;
}else if(isTwoLayer&&layout==='stacked'){
totalH=b.h*2+layerGap;
}
// Calculate scale to fit pattern on screen with margins
const headerH=120; // Header space in pixels
const footerH=80; // Footer space in pixels
const margin=60; // Side margins in pixels
const availW=w-margin*2;
const availH=h-headerH-footerH;
// Scale based on pattern size - aim for good visibility
const scaleX=availW/(totalW*1.1); // Add 10% padding
const scaleY=availH/(totalH*1.1);
const scale=Math.min(scaleX,scaleY,3); // Cap at 3x for very small patterns
// Center the pattern
const patternW=totalW*scale;
const patternH=totalH*scale;
const offsetX=(w-patternW)/2;
const offsetY=headerH+(availH-patternH)/2;
// Draw header section
ctx.save();
const title=document.getElementById('pattern-title').value||'Holster Pattern';
ctx.fillStyle='#000';
ctx.font='bold 28px sans-serif';
ctx.textAlign='center';
ctx.fillText(title,w/2,40);
// Specifications
ctx.font='14px sans-serif';
ctx.fillStyle='#555';
ctx.fillText('Made with 9-10oz Veg-Tan Leather',w/2,70);
ctx.fillText(`Pattern Size: ${b.w.toFixed(0)}×${b.h.toFixed(0)}mm`,w/2,92);
ctx.restore();
// Draw pattern(s)
ctx.save();
ctx.translate(offsetX,offsetY);
ctx.translate(-b.minx*scale,-b.miny*scale);
ctx.scale(scale,scale);
// Draw patterns based on layout
if(isTwoLayer&&layout==='side-by-side'&&layersToRender.length>=2){
// Draw front layer on left
layersToRender[0].state&&this.drawPatternLayerFullPattern(ctx,layersToRender[0].state,scale,layersToRender[0].color,layersToRender[0].label);
// Draw back layer on right (offset by pattern width + gap)
ctx.save();
ctx.translate(b.w+layerGap,0);
layersToRender[1].state&&this.drawPatternLayerFullPattern(ctx,layersToRender[1].state,scale,layersToRender[1].color,layersToRender[1].label);
ctx.restore();
}else if(isTwoLayer&&layout==='stacked'&&layersToRender.length>=2){
// Draw front layer on top
layersToRender[0].state&&this.drawPatternLayerFullPattern(ctx,layersToRender[0].state,scale,layersToRender[0].color,layersToRender[0].label);
// Draw back layer on bottom (offset by pattern height + gap)
ctx.save();
ctx.translate(0,b.h+layerGap);
layersToRender[1].state&&this.drawPatternLayerFullPattern(ctx,layersToRender[1].state,scale,layersToRender[1].color,layersToRender[1].label);
ctx.restore();
}else if(isTwoLayer&&layout==='overlaid'){
// Draw both layers overlaid with different colors
layersToRender.forEach(lr=>{
ctx.save();
ctx.globalAlpha=0.7;
lr.state&&this.drawPatternLayerFullPattern(ctx,lr.state,scale,lr.color,lr.label);
ctx.restore();
});
}else{
// Single layer or front-only/back-only
const lr=layersToRender[0];
lr.state?this.drawPatternLayerFullPattern(ctx,lr.state,scale,lr.color,lr.label):this.drawPatternLayerFullPattern(ctx,null,scale,'#000','');
}
// Draw text annotations
if(!isTwoLayer||layout==='front-only'||layout==='back-only'){
TEXT_ANNOTATIONS.forEach(t=>{
if(!t.text)return;
const fs=t.fontSize||12;
ctx.font=`${t.italic?'italic ':''}${t.bold?'bold ':''}${fs}px sans-serif`;
ctx.fillStyle='#000';ctx.textAlign='left';ctx.textBaseline='top';
ctx.fillText(t.text,t.x,t.y);
});
}
ctx.restore();
// Draw footer
ctx.fillStyle='#999';
ctx.font='12px sans-serif';
ctx.textAlign='center';
const layoutInfo=isTwoLayer?` · ${layout.replace(/-/g,' ')} layout`:'';
let stitchInfo='';
if(isTwoLayer&&FRONT_LAYER&&BACK_LAYER){
const frontCount=this.getStitchCount(FRONT_LAYER);
const backCount=this.getStitchCount(BACK_LAYER);
const match=frontCount===backCount;
stitchInfo=` · Front: ${frontCount} | Back: ${backCount} ${match?'✓':'⚠'}`;
}
const viewZoomPercent=Math.round(scale*100);
ctx.fillText(`Pattern Size: ${b.w.toFixed(0)}×${b.h.toFixed(0)}mm${layoutInfo}${stitchInfo}`,w/2,h-50);
ctx.fillText(`View: ${viewZoomPercent}% · Scroll to zoom · Drag to pan · Print at 100% scale`,w/2,h-30);
}
drawPatternLayerFullPattern(ctx,layerState,scale,strokeColor='#000',labelText=''){
// Similar to drawPatternLayer but with professional styling for full pattern view
let savedNODES,savedEDGE_RANGES,savedMERGED_EDGE_RANGES,savedEDGE_STITCHES;
let savedSYM_HOLES,savedSYM_CUSTOM_HOLES,savedASYM_HOLES,savedASYM_CUSTOM_HOLES,savedASYM_SHAPES;
if(layerState){
savedNODES=NODES;savedEDGE_RANGES=EDGE_RANGES;savedMERGED_EDGE_RANGES=MERGED_EDGE_RANGES;
savedEDGE_STITCHES=EDGE_STITCHES;savedSYM_HOLES=SYM_HOLES;savedSYM_CUSTOM_HOLES=SYM_CUSTOM_HOLES;
savedASYM_HOLES=ASYM_HOLES;savedASYM_CUSTOM_HOLES=ASYM_CUSTOM_HOLES;savedASYM_SHAPES=ASYM_SHAPES;
NODES=layerState.NODES;EDGE_RANGES=layerState.EDGE_RANGES;MERGED_EDGE_RANGES=layerState.MERGED_EDGE_RANGES;
EDGE_STITCHES=layerState.EDGE_STITCHES;SYM_HOLES=layerState.SYM_HOLES;SYM_CUSTOM_HOLES=layerState.SYM_CUSTOM_HOLES;
ASYM_HOLES=layerState.ASYM_HOLES;ASYM_CUSTOM_HOLES=layerState.ASYM_CUSTOM_HOLES;ASYM_SHAPES=layerState.ASYM_SHAPES;
}
const pat=this.getMergedPatternPath();
const b=M.getBounds(pat);
// Draw label if provided
if(labelText){
ctx.save();
ctx.fillStyle=strokeColor;ctx.font=`bold ${18/scale}px sans-serif`;
ctx.textAlign='center';ctx.textBaseline='top';
ctx.fillText(labelText,b.cx,b.miny-25/scale);
ctx.restore();
}
// Draw pattern outline - clean black line
ctx.beginPath();pat.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle=strokeColor;ctx.lineWidth=2/scale;ctx.stroke();
// Draw fold line with dashed style
if(CFG.showFoldLine){
ctx.strokeStyle=strokeColor;ctx.lineWidth=1/scale;ctx.setLineDash([8/scale,4/scale]);
ctx.beginPath();ctx.moveTo(HOLSTER.x,b.miny-10);ctx.lineTo(HOLSTER.x,b.maxy+10);ctx.stroke();
ctx.setLineDash([]);
// Add fold line label
ctx.save();
ctx.fillStyle=strokeColor;ctx.font=`${10/scale}px sans-serif`;
ctx.textAlign='center';ctx.textBaseline='bottom';
ctx.fillText('FOLD LINE',HOLSTER.x,b.miny-12/scale);
ctx.restore();
}
// Draw edge stitches with dotted style for professional look
const rightHalfP=this.getRightHalfPath();
const rightWorldP=rightHalfP.map(p=>M.holsterToWorld(p));
EDGE_STITCHES.forEach(es=>{
const rng=EDGE_RANGES[es.rangeIdx];if(!rng)return;
const esMargin=es.margin||CFG.stitchMargin;
const stitchPath=this.offsetPathStable(rightWorldP,-esMargin);
if(stitchPath.length<3)return;
const stitchArc=M.buildArc(stitchPath);
const stitchTot=stitchArc[stitchArc.length-1].d;
const sd=stitchTot*rng.start,ed=stitchTot*rng.end;
if(es.showHoles!==false){
const spacing=es.spacing||CFG.stitchSpacing;
ctx.fillStyle=strokeColor;
// Draw as small dots for professional template
for(let d=sd;d<=ed;d+=spacing){
const pt=M.ptAtDist(stitchArc,d);if(!pt)continue;
ctx.beginPath();ctx.arc(pt.x,pt.y,(es.holeSize||CFG.holeSize)/3,0,Math.PI*2);ctx.fill();
if(es.mirror!==false&&CFG.mirrorEdgeStitches&&!CFG.asymmetricOutline){
const mx=2*HOLSTER.x-pt.x;
ctx.beginPath();ctx.arc(mx,pt.y,(es.holeSize||CFG.holeSize)/3,0,Math.PI*2);ctx.fill();
}}}
});
// Draw holes with outline only
if(CFG.showSymmetric)SYM_HOLES.forEach(hole=>{[1,-1].forEach(side=>{const wh=this.getSymHoleWorld(hole,side);this.drawHole(ctx,wh.x,wh.y,wh.rotation,wh.width,wh.height,wh.shape);ctx.strokeStyle=strokeColor;ctx.lineWidth=1.5/scale;ctx.stroke()})});
if(CFG.showAsymmetric)ASYM_HOLES.forEach(hole=>{this.drawHole(ctx,hole.x,hole.y,hole.rotation||0,hole.width,hole.height,hole.shape);ctx.strokeStyle=strokeColor;ctx.lineWidth=1.5/scale;ctx.stroke()});
// Draw custom holes
if(CFG.showSymmetric)SYM_CUSTOM_HOLES.forEach(h=>{[1,-1].forEach(side=>{const pts=this.getCustomHoleWorld(h,side);ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.strokeStyle=strokeColor;ctx.lineWidth=1.5/scale;ctx.stroke()})});
if(CFG.showAsymmetric)ASYM_CUSTOM_HOLES.forEach(h=>{const pts=this.getCustomHoleWorldAsym(h);ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.strokeStyle=strokeColor;ctx.lineWidth=1.5/scale;ctx.stroke()});
// Draw shapes
if(CFG.showAsymmetric)ASYM_SHAPES.filter(s=>!s.isExtension).forEach(s=>{
const pts=s.points.map(p=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y}});
ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle=strokeColor;ctx.lineWidth=1.5/scale;ctx.stroke();
});
// Restore original state
if(layerState){
NODES=savedNODES;EDGE_RANGES=savedEDGE_RANGES;MERGED_EDGE_RANGES=savedMERGED_EDGE_RANGES;
EDGE_STITCHES=savedEDGE_STITCHES;SYM_HOLES=savedSYM_HOLES;SYM_CUSTOM_HOLES=savedSYM_CUSTOM_HOLES;
ASYM_HOLES=savedASYM_HOLES;ASYM_CUSTOM_HOLES=savedASYM_CUSTOM_HOLES;ASYM_SHAPES=savedASYM_SHAPES;
}
return b;
}
drawPatternLayer(ctx,layerState,scale,strokeColor='#000',labelText=''){
// Temporarily swap to layer state if provided
let savedNODES,savedEDGE_RANGES,savedMERGED_EDGE_RANGES,savedEDGE_STITCHES;
let savedSYM_HOLES,savedSYM_CUSTOM_HOLES,savedASYM_HOLES,savedASYM_CUSTOM_HOLES,savedASYM_SHAPES;
if(layerState){
savedNODES=NODES;savedEDGE_RANGES=EDGE_RANGES;savedMERGED_EDGE_RANGES=MERGED_EDGE_RANGES;
savedEDGE_STITCHES=EDGE_STITCHES;savedSYM_HOLES=SYM_HOLES;savedSYM_CUSTOM_HOLES=SYM_CUSTOM_HOLES;
savedASYM_HOLES=ASYM_HOLES;savedASYM_CUSTOM_HOLES=ASYM_CUSTOM_HOLES;savedASYM_SHAPES=ASYM_SHAPES;
NODES=layerState.NODES;EDGE_RANGES=layerState.EDGE_RANGES;MERGED_EDGE_RANGES=layerState.MERGED_EDGE_RANGES;
EDGE_STITCHES=layerState.EDGE_STITCHES;SYM_HOLES=layerState.SYM_HOLES;SYM_CUSTOM_HOLES=layerState.SYM_CUSTOM_HOLES;
ASYM_HOLES=layerState.ASYM_HOLES;ASYM_CUSTOM_HOLES=layerState.ASYM_CUSTOM_HOLES;ASYM_SHAPES=layerState.ASYM_SHAPES;
}
const pat=this.getMergedPatternPath();
const b=M.getBounds(pat);
// Draw label if provided
if(labelText){
ctx.save();
ctx.fillStyle=strokeColor;ctx.font=`bold ${14/scale}px sans-serif`;
ctx.textAlign='center';ctx.textBaseline='top';
ctx.fillText(labelText,b.cx,b.miny-20/scale);
ctx.restore();
}
// Draw pattern outline
ctx.beginPath();pat.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle=strokeColor;ctx.lineWidth=1.5/scale;ctx.stroke();
// Draw fold line
ctx.strokeStyle=strokeColor;ctx.lineWidth=0.5/scale;ctx.setLineDash([5/scale,3/scale]);
ctx.beginPath();ctx.moveTo(HOLSTER.x,b.miny-10);ctx.lineTo(HOLSTER.x,b.maxy+10);ctx.stroke();
ctx.setLineDash([]);
// Draw edge stitches
const rightHalfP=this.getRightHalfPath();
const rightWorldP=rightHalfP.map(p=>M.holsterToWorld(p));
EDGE_STITCHES.forEach(es=>{
const rng=EDGE_RANGES[es.rangeIdx];if(!rng)return;
const esMargin=es.margin||CFG.stitchMargin;
const stitchPath=this.offsetPathStable(rightWorldP,-esMargin);
if(stitchPath.length<3)return;
const stitchArc=M.buildArc(stitchPath);
const stitchTot=stitchArc[stitchArc.length-1].d;
const sd=stitchTot*rng.start,ed=stitchTot*rng.end;
if(es.showHoles!==false){
const spacing=es.spacing||CFG.stitchSpacing;
ctx.fillStyle=strokeColor;
for(let d=sd;d<=ed;d+=spacing){
const pt=M.ptAtDist(stitchArc,d);if(!pt)continue;
ctx.beginPath();ctx.arc(pt.x,pt.y,(es.holeSize||CFG.holeSize)/2,0,Math.PI*2);ctx.fill();
if(es.mirror!==false&&CFG.mirrorEdgeStitches&&!CFG.asymmetricOutline){
const mx=2*HOLSTER.x-pt.x;
ctx.beginPath();ctx.arc(mx,pt.y,(es.holeSize||CFG.holeSize)/2,0,Math.PI*2);ctx.fill();
}}}
});
// Draw holes
if(CFG.showSymmetric)SYM_HOLES.forEach(hole=>{[1,-1].forEach(side=>{const wh=this.getSymHoleWorld(hole,side);this.drawHole(ctx,wh.x,wh.y,wh.rotation,wh.width,wh.height,wh.shape);ctx.strokeStyle=strokeColor;ctx.lineWidth=1/scale;ctx.stroke()})});
if(CFG.showAsymmetric)ASYM_HOLES.forEach(hole=>{this.drawHole(ctx,hole.x,hole.y,hole.rotation||0,hole.width,hole.height,hole.shape);ctx.strokeStyle=strokeColor;ctx.lineWidth=1/scale;ctx.stroke()});
// Draw custom holes
if(CFG.showSymmetric)SYM_CUSTOM_HOLES.forEach(h=>{[1,-1].forEach(side=>{const pts=this.getCustomHoleWorld(h,side);ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.strokeStyle=strokeColor;ctx.lineWidth=1/scale;ctx.stroke()})});
if(CFG.showAsymmetric)ASYM_CUSTOM_HOLES.forEach(h=>{const pts=this.getCustomHoleWorldAsym(h);ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.strokeStyle=strokeColor;ctx.lineWidth=1/scale;ctx.stroke()});
// Draw shapes
if(CFG.showAsymmetric)ASYM_SHAPES.filter(s=>!s.isExtension).forEach(s=>{
const pts=s.points.map(p=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y}});
ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle=strokeColor;ctx.lineWidth=1/scale;ctx.stroke();
});
// Restore original state
if(layerState){
NODES=savedNODES;EDGE_RANGES=savedEDGE_RANGES;MERGED_EDGE_RANGES=savedMERGED_EDGE_RANGES;
EDGE_STITCHES=savedEDGE_STITCHES;SYM_HOLES=savedSYM_HOLES;SYM_CUSTOM_HOLES=savedSYM_CUSTOM_HOLES;
ASYM_HOLES=savedASYM_HOLES;ASYM_CUSTOM_HOLES=savedASYM_CUSTOM_HOLES;ASYM_SHAPES=savedASYM_SHAPES;
}
return b;
}
}
const app=new App();
window.app = app;
