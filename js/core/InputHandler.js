/**
 * InputHandler - Handles all mouse and touch input
 * 
 * Manages:
 * - Mouse down/move/up events
 * - Touch events (single and multi-touch)
 * - Double-click handling
 * - Hover state detection
 * - Drag operations
 * - Coordinate transformation
 * 
 * Note: Keyboard input remains in app.js (keydown/keyup event handlers)
 * 
 * Extracted from app.js (lines 2334-2770) as part of Phase 5B refactoring
 */

import { M } from '../math.js';

export class InputHandler {
  constructor(app) {
    this.app = app;
  }

  // Convert screen coordinates to world coordinates
  getWorld(e){const r=this.app.canvas.getBoundingClientRect();return{x:(e.clientX-r.left-VIEW.x)/VIEW.zoom,y:(e.clientY-r.top-VIEW.y)/VIEW.zoom}}
onDblClick(e){const w=this.getWorld(e);if(MODE==='stitch'&&TEMP_STITCH&&TEMP_STITCH.points.length>=2){this.app.finishMode();return}if(MODE==='shape'&&TEMP_SHAPE&&TEMP_SHAPE.points.length>=3){this.app.finishMode();return}if(MODE==='customhole'&&TEMP_CUSTOMHOLE&&TEMP_CUSTOMHOLE.points.length>=3){this.app.finishMode();return}
// Double-click on text to edit inline
for(let i=TEXT_ANNOTATIONS.length-1;i>=0;i--){
const t=TEXT_ANNOTATIONS[i];
if(t.hidden)continue;
const fs=(t.fontSize||12)/VIEW.zoom;
const tw=this.app.ctx.measureText(t.text||'').width/VIEW.zoom;
const th=fs*1.2;
if(w.x>=t.x-5/VIEW.zoom&&w.x<=t.x+tw+5/VIEW.zoom&&w.y>=t.y-5/VIEW.zoom&&w.y<=t.y+th+5/VIEW.zoom){
SELECTED={type:'textAnnotation',idx:i};
this.app.updateInfo();
this.app.startTextEdit(i);
return;
}
}
if(MODE==='select'&&!HOLSTER.locked){const local=this.app.getPatternLocalPath(),lw=M.worldToHolster(w);let minD=Infinity,ins=-1;for(const p of local){const d=M.dist(lw,p);if(d<minD&&p.segIdx>=0){minD=d;ins=p.segIdx}}if(minD<30/(VIEW.zoom*Math.min(HOLSTER.scaleX||1,HOLSTER.scaleY||1))&&ins>=0){NODES.splice(ins+1,0,{x:CFG.asymmetricOutline?lw.x:Math.max(0,lw.x),y:lw.y,h1:{x:0,y:0},h2:{x:0,y:0}});this.app.draw()}}}
onDown(e){e.preventDefault();
// Clear hover state when starting any interaction
HOVER=null;
// Handle calibration mode
if(REF_IMAGE.calibrating){
const w=this.getWorld(e);
this.app.handleCalibrationClick(w);
return;
}
// Handle publish mode panning
if(PUBLISH_MODE){
DRAG={active:true,type:'publishPan',sx:e.clientX,sy:e.clientY,vx:PUBLISH_VIEW.x,vy:PUBLISH_VIEW.y};
this.app.canvas.style.cursor='grabbing';
return;
}
const w=this.getWorld(e);
if(e.button===1||e.button===2||isPanning){DRAG={active:true,type:'pan',sx:e.clientX,sy:e.clientY,vx:VIEW.x,vy:VIEW.y};this.app.canvas.style.cursor='grabbing';return}
if(MODE==='hole'){const lw=M.worldToHolster(w);const nh={x:LAYER==='asymmetric'?w.x:Math.abs(lw.x),y:LAYER==='asymmetric'?w.y:lw.y,width:CFG.defaultHoleWidth,height:CFG.defaultHoleShape==='circle'?CFG.defaultHoleWidth:CFG.defaultHoleHeight,rotation:0,shape:CFG.defaultHoleShape,stitchBorder:CFG.defaultHoleStitchBorder,stitchMargin:CFG.defaultHoleStitchMargin,stitchSpacing:CFG.defaultHoleStitchSpacing};if(LAYER==='asymmetric'){ASYM_HOLES.push(nh);SELECTED={type:'asymHole',idx:ASYM_HOLES.length-1}}else{SYM_HOLES.push(nh);SELECTED={type:'symHole',idx:SYM_HOLES.length-1}}this.app.updateInfo();this.app.draw();this.app.saveState();return}
if(MODE==='text'){
// Create new text annotation with simple structure
TEXT_ANNOTATIONS.push({
x:w.x,
y:w.y,
text:'Text',
fontSize:12,
bold:false,
italic:false,
style:'normal', // "normal" | "header" | "subheader"
listType:'none' // "none" | "bullet" | "numbered"
});
SELECTED={type:'textAnnotation',idx:TEXT_ANNOTATIONS.length-1};
this.app.updateInfo();
this.app.startTextEdit(TEXT_ANNOTATIONS.length-1);
return;
}
if(MODE==='stitch'){if(!TEMP_STITCH)TEMP_STITCH={points:[{x:w.x,y:w.y}]};else TEMP_STITCH.points.push({x:w.x,y:w.y});document.getElementById('mode-indicator').querySelector('.mode-text').textContent=(LAYER==='asymmetric'?'◧':'〰')+' '+TEMP_STITCH.points.length+' pts';this.app.draw();return}
if(MODE==='shape'){if(!TEMP_SHAPE)TEMP_SHAPE={points:[{x:w.x,y:w.y}]};else TEMP_SHAPE.points.push({x:w.x,y:w.y});document.getElementById('mode-indicator').querySelector('.mode-text').textContent='◧ '+TEMP_SHAPE.points.length+' pts';this.app.draw();return}
if(MODE==='customhole'){if(!TEMP_CUSTOMHOLE)TEMP_CUSTOMHOLE={points:[{x:w.x,y:w.y}]};else TEMP_CUSTOMHOLE.points.push({x:w.x,y:w.y});document.getElementById('mode-indicator').querySelector('.mode-text').textContent='✏ '+TEMP_CUSTOMHOLE.points.length+' pts';this.app.draw();return}
// Check for ghost layer drag in two-layer mode
if(MODE==='select'&&CFG.projectType==='two-layer'&&CFG.showGhostLayer){
const ghostState=CURRENT_LAYER==='front'?BACK_LAYER:FRONT_LAYER;
if(ghostState){
// Temporarily apply ghost layer state to get its outline
const savedNODES=NODES;
NODES=ghostState.NODES;
const ghostPat=this.app.getMergedPatternPath();
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
this.app.canvas.style.cursor='move';
return;
}
}
}
// Gizmo checks
if(SELECTED?.type==='holster'&&!HOLSTER.locked){const gizmo=this.app.getGizmos(HOLSTER,'holster');for(const g of gizmo.handles){if(M.dist(w,g)<15/VIEW.zoom){DRAG={active:true,type:'holsterGizmo',gizmoType:g.type,sx:w.x,sy:w.y,shx:HOLSTER.x,shy:HOLSTER.y,ssx:HOLSTER.scaleX,ssy:HOLSTER.scaleY,sr:HOLSTER.rotation};if(g.type==='rotate'){this.app.canvas.style.cursor='crosshair'}else if(g.type==='scale'||g.type.includes('e')||g.type.includes('w')||g.type.includes('n')||g.type.includes('s')){this.app.canvas.style.cursor='nwse-resize'}else{this.app.canvas.style.cursor='move'}return}}}
if(SELECTED?.type==='symHole'){const hole=SYM_HOLES[SELECTED.idx];if(!hole.locked){const wh=this.app.getSymHoleWorld(hole,1),gizmo=this.app.getGizmos(wh,'hole');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'symHoleGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:hole.x,shy:hole.y,sw:hole.width,sh:hole.height,sr:hole.rotation||0};if(g.type==='rotate'){this.app.canvas.style.cursor='crosshair'}else if(g.type==='scale'||g.type.includes('e')||g.type.includes('w')||g.type.includes('n')||g.type.includes('s')){this.app.canvas.style.cursor='nwse-resize'}else{this.app.canvas.style.cursor='move'}return}}}}
if(SELECTED?.type==='asymHole'){const hole=ASYM_HOLES[SELECTED.idx];if(!hole.locked){const gizmo=this.app.getGizmos(hole,'hole');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'asymHoleGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:hole.x,shy:hole.y,sw:hole.width,sh:hole.height,sr:hole.rotation||0};if(g.type==='rotate'){this.app.canvas.style.cursor='crosshair'}else if(g.type==='scale'||g.type.includes('e')||g.type.includes('w')||g.type.includes('n')||g.type.includes('s')){this.app.canvas.style.cursor='nwse-resize'}else{this.app.canvas.style.cursor='move'}return}}}}
if(SELECTED?.type==='asymShape'){const s=ASYM_SHAPES[SELECTED.idx];if(!s.locked){
// Check for vertex drag first (higher priority than bezier handles)
const pts=s.points.map((p,i)=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y,idx:i}});
for(let i=0;i<pts.length;i++){if(M.dist(w,pts[i])<10/VIEW.zoom){DRAG={active:true,type:'asymShapeVertex',idx:SELECTED.idx,ptIdx:i,sx:w.x,sy:w.y};return}}
// Then check for bezier handle drag
const cpts=this.app.getShapeControlPts(s);
for(let i=0;i<cpts.length;i++){
const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};
if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'asymShapeH1',idx:SELECTED.idx,ptIdx:i};return}
if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'asymShapeH2',idx:SELECTED.idx,ptIdx:i};return}
}
// Then check gizmo handles
const gizmo=this.app.getGizmos(s,'asymShape');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'asymShapeGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:s.x,shy:s.y,ssx:s.scaleX||1,ssy:s.scaleY||1,sr:s.rotation||0};return}}}}
if(SELECTED?.type==='symShape'){const s=SYM_SHAPES[SELECTED.idx];if(!s.locked){
// Check for vertex drag first (higher priority than bezier handles)
const wShp=this.app.getSymShapeWorld(s,1);
const pts=wShp.points.map((p,i)=>{const sc={x:p.x*(wShp.scaleX||1),y:p.y*(wShp.scaleY||1)};const r=M.rotate(sc,wShp.rotation||0);return{x:r.x+wShp.x,y:r.y+wShp.y,idx:i}});
for(const pt of pts){if(M.dist(w,pt)<12/VIEW.zoom){DRAG={active:true,type:'symShapeVertex',idx:SELECTED.idx,ptIdx:pt.idx};return}}
// Check bezier handles
const cpts=this.app.getShapeControlPts(wShp);
for(let i=0;i<cpts.length;i++){
const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};
if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'symShapeH1',idx:SELECTED.idx,ptIdx:i};return}
if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'symShapeH2',idx:SELECTED.idx,ptIdx:i};return}
}
// Then check gizmo handles
const gizmo=this.app.getGizmos(wShp,'asymShape');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'symShapeGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:s.x,shy:s.y,ssx:s.scaleX||1,ssy:s.scaleY||1,sr:s.rotation||0};return}}}}
// Check for canvas "+ Stitch" button clicks - check merged first
if(this.app._mergedStitchBtnBounds){
const b=this.app._mergedStitchBtnBounds;
if(w.x>=b.x&&w.x<=b.x+b.w&&w.y>=b.y&&w.y<=b.y+b.h){
SELECTED={type:'mergedEdgeRange',idx:b.rangeIdx};
this.app.createStitchFromMergedRange();
return;
}}
if(this.app._stitchBtnBounds){
const b=this.app._stitchBtnBounds;
if(w.x>=b.x&&w.x<=b.x+b.w&&w.y>=b.y&&w.y<=b.y+b.h){
SELECTED={type:'edgeRange',idx:b.rangeIdx};
this.app.createStitchFromRange();
return;
}}
if(SELECTED?.type==='symCustomHole'){const h=SYM_CUSTOM_HOLES[SELECTED.idx];if(!h.locked){const pts=this.app.getCustomHoleWorld(h,1),b=M.getBounds(pts),gizmo=this.app.getGizmos({x:b.cx,y:b.cy,points:h.points,scaleX:h.scaleX||1,scaleY:h.scaleY||1,rotation:h.rotation||0},'asymShape');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'symCustomHoleGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:h.x,shy:h.y,ssx:h.scaleX||1,ssy:h.scaleY||1,sr:h.rotation||0};return}}const cpts=this.app.getCustomHoleControlPts(h,1);for(let i=0;i<cpts.length;i++){const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'symCustomHoleH1',idx:SELECTED.idx,ptIdx:i};return}if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'symCustomHoleH2',idx:SELECTED.idx,ptIdx:i};return}if(M.dist(w,n)<12/VIEW.zoom){DRAG={active:true,type:'symCustomHoleNode',idx:SELECTED.idx,ptIdx:i};return}}}}
if(SELECTED?.type==='asymCustomHole'){const h=ASYM_CUSTOM_HOLES[SELECTED.idx];if(!h.locked){const gizmo=this.app.getGizmos(h,'asymShape');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'asymCustomHoleGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:h.x,shy:h.y,ssx:h.scaleX||1,ssy:h.scaleY||1,sr:h.rotation||0};return}}const cpts=this.app.getCustomHoleControlPtsAsym(h);for(let i=0;i<cpts.length;i++){const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'asymCustomHoleH1',idx:SELECTED.idx,ptIdx:i};return}if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'asymCustomHoleH2',idx:SELECTED.idx,ptIdx:i};return}if(M.dist(w,n)<12/VIEW.zoom){DRAG={active:true,type:'asymCustomHoleNode',idx:SELECTED.idx,ptIdx:i};return}}}}
// Stitch point selection
if(SELECTED?.type==='symStitch'){const sl=SYM_STITCHES[SELECTED.idx];if(!sl.locked){const pts=this.app.getSymStitchWorld(sl,1);for(let i=0;i<pts.length;i++){if(M.dist(w,pts[i])<8/VIEW.zoom){DRAG={active:true,type:'symStitchPt',idx:SELECTED.idx,ptIdx:i,sx:w.x,sy:w.y};return}}}}
if(SELECTED?.type==='asymStitch'){const sl=ASYM_STITCHES[SELECTED.idx];if(!sl.locked){for(let i=0;i<sl.points.length;i++){if(M.dist(w,sl.points[i])<8/VIEW.zoom){DRAG={active:true,type:'asymStitchPt',idx:SELECTED.idx,ptIdx:i,sx:w.x,sy:w.y};return}}}}
// Edge range handles - check BEFORE object selection so handles take priority
const rightHalf=this.app.getRightHalfPath();
const rightWorld=rightHalf.map(p=>M.holsterToWorld(p));
const rightSt=rightWorld.length>2?this.app.offsetPathStable(rightWorld,-CFG.stitchMargin):[];
const mergedPath=this.app.getMergedPatternPath();
// Helper to check edge range handles
const checkEdgeHandles=()=>{
if(rightSt.length>2){
const arc=M.buildArc(rightSt),tot=arc[arc.length-1].d;
for(let i=0;i<EDGE_RANGES.length;i++){
const r=EDGE_RANGES[i],sp=M.ptAtDist(arc,tot*r.start),ep=M.ptAtDist(arc,tot*r.end);
if(sp&&M.dist(w,sp)<18/VIEW.zoom){SELECTED={type:'edgeRange',idx:i};DRAG={active:true,type:'rangeStart',idx:i,path:rightSt,arc,tot};this.app.canvas.style.cursor='ew-resize';this.app.updateInfo();this.app.draw();return true}
if(ep&&M.dist(w,ep)<18/VIEW.zoom){SELECTED={type:'edgeRange',idx:i};DRAG={active:true,type:'rangeEnd',idx:i,path:rightSt,arc,tot};this.app.canvas.style.cursor='ew-resize';this.app.updateInfo();this.app.draw();return true}
}}return false};
// Helper to check merged range handles
const checkMergedHandles=()=>{
if(mergedPath.length>2&&MERGED_EDGE_RANGES.length){
const mergedOffset=this.app.offsetPathStableClosed(mergedPath,-CFG.stitchMargin);
if(mergedOffset.length>2){
const mergedArc=M.buildArcClosed(mergedOffset),mergedTot=mergedArc[mergedArc.length-1].d;
for(let i=0;i<MERGED_EDGE_RANGES.length;i++){
const r=MERGED_EDGE_RANGES[i],sp=M.ptAtDist(mergedArc,mergedTot*r.start),ep=M.ptAtDist(mergedArc,mergedTot*r.end);
if(sp&&M.dist(w,sp)<18/VIEW.zoom){SELECTED={type:'mergedEdgeRange',idx:i};DRAG={active:true,type:'mergedRangeStart',idx:i,path:mergedOffset,arc:mergedArc,tot:mergedTot};this.app.canvas.style.cursor='ew-resize';this.app.updateInfo();this.app.draw();return true}
if(ep&&M.dist(w,ep)<18/VIEW.zoom){SELECTED={type:'mergedEdgeRange',idx:i};DRAG={active:true,type:'mergedRangeEnd',idx:i,path:mergedOffset,arc:mergedArc,tot:mergedTot};this.app.canvas.style.cursor='ew-resize';this.app.updateInfo();this.app.draw();return true}
}}}return false};
// Check based on current selection - prioritize the type that's already selected
if(SELECTED?.type==='edgeRange'){if(checkEdgeHandles())return;if(checkMergedHandles())return}
else if(SELECTED?.type==='mergedEdgeRange'){if(checkMergedHandles())return;if(checkEdgeHandles())return}
else{if(checkEdgeHandles())return;if(checkMergedHandles())return}
// Object selection
for(let i=SYM_SHAPES.length-1;i>=0;i--){const s=SYM_SHAPES[i];
for(const side of[1,-1]){
const wShp=this.app.getSymShapeWorld(s,side);
// Handle linked circles
if(wShp.isLinkedCircle){const cd=this.app.getLinkedCircleData(wShp);if(cd){const d=M.dist(w,{x:wShp.x,y:wShp.y});if(d<cd.radius*(wShp.scaleX||1)+10){SELECTED={type:'symShape',idx:i};this.app.updateInfo();this.app.draw();return}}}
else{
// Regular shape
const pts=wShp.points.map(p=>{const sc={x:p.x*(wShp.scaleX||1),y:p.y*(wShp.scaleY||1)};const r=M.rotate(sc,wShp.rotation||0);return{x:r.x+wShp.x,y:r.y+wShp.y}});
if(M.insidePoly(w,pts)){SELECTED={type:'symShape',idx:i};this.app.updateInfo();this.app.draw();return}
}
}}
for(let i=ASYM_SHAPES.length-1;i>=0;i--){const s=ASYM_SHAPES[i];
// Handle linked circles
if(s.isLinkedCircle){const cd=this.app.getLinkedCircleData(s);if(cd){const d=M.dist(w,{x:s.x,y:s.y});if(d<cd.radius*(s.scaleX||1)+10){SELECTED={type:'asymShape',idx:i};this.app.updateInfo();this.app.draw();return}}continue}
// Regular shape
const pts=s.points.map(p=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y}});if(M.insidePoly(w,pts)){SELECTED={type:'asymShape',idx:i};this.app.updateInfo();this.app.draw();return}}
for(let i=ASYM_HOLES.length-1;i>=0;i--){if(M.insideShape(w,ASYM_HOLES[i])){SELECTED={type:'asymHole',idx:i};this.app.updateInfo();this.app.draw();return}}
for(let i=ASYM_CUSTOM_HOLES.length-1;i>=0;i--){const pts=this.app.getCustomHoleWorldAsym(ASYM_CUSTOM_HOLES[i]);if(M.insidePoly(w,pts)){SELECTED={type:'asymCustomHole',idx:i};this.app.updateInfo();this.app.draw();return}}
for(let i=SYM_HOLES.length-1;i>=0;i--){const hole=SYM_HOLES[i];for(const side of[1,-1]){const wh=this.app.getSymHoleWorld(hole,side);if(M.insideShape(w,wh)){SELECTED={type:'symHole',idx:i};this.app.updateInfo();this.app.draw();return}}}
for(let i=SYM_CUSTOM_HOLES.length-1;i>=0;i--){const h=SYM_CUSTOM_HOLES[i];for(const side of[1,-1]){const pts=this.app.getCustomHoleWorld(h,side);if(M.insidePoly(w,pts)){SELECTED={type:'symCustomHole',idx:i};this.app.updateInfo();this.app.draw();return}}}
// Stitch line selection
for(let i=SYM_STITCHES.length-1;i>=0;i--){const sl=SYM_STITCHES[i];for(const side of[1,-1]){const pts=this.app.getSymStitchWorld(sl,side);const smp=M.sampleBezier(pts,30);if(M.ptOnBezier(smp,w,10/VIEW.zoom)){SELECTED={type:'symStitch',idx:i};this.app.updateInfo();this.app.draw();return}}}
for(let i=ASYM_STITCHES.length-1;i>=0;i--){const sl=ASYM_STITCHES[i];const smp=M.sampleBezier(sl.points,30);if(M.ptOnBezier(smp,w,10/VIEW.zoom)){SELECTED={type:'asymStitch',idx:i};this.app.updateInfo();this.app.draw();return}}
// Text annotation selection
for(let i=TEXT_ANNOTATIONS.length-1;i>=0;i--){
const t=TEXT_ANNOTATIONS[i];
if(t.hidden)continue;
// Handle both old and new format
const lines=t.lines||[{text:t.text||'',style:t.style||'normal',listType:t.listType||'none',listIndex:t.listIndex}];
let yOffset=0;
const lineHeight=1.3;
let hitDetected=false;
// Check each line for hit
lines.forEach((line,lineIdx)=>{
if(hitDetected)return;
// Calculate font size based on style
let fs=12;
if(line.style==='header'){fs=24}
else if(line.style==='subheader'){fs=18}
// Set the correct font for measuring
this.app.ctx.font=`${(line.style==='header'||line.style==='subheader')?'bold ':''}${fs/VIEW.zoom}px "Segoe UI", sans-serif`;
// Measure text with list prefix if present
let textToShow=line.text||'';
if(line.listType&&line.listType!=='none'){
const listIdx=line.listIndex||lineIdx+1;
let prefix='';
if(line.listType==='bullet'){prefix='• '}
else if(line.listType==='numbered'){prefix=`${listIdx}. `}
else if(line.listType==='lettered'){prefix=`${String.fromCharCode(97+listIdx-1)}. `}
textToShow=prefix+textToShow;
}
const tw=this.app.ctx.measureText(textToShow).width;
const fh=fs*lineHeight;
const lineY=t.y+yOffset;
if(w.x>=t.x&&w.x<=t.x+tw+20&&w.y>=lineY&&w.y<=lineY+fh){
hitDetected=true;
}
yOffset+=fh;
});
if(hitDetected){
SELECTED={type:'textAnnotation',idx:i};
if(!t.locked){DRAG={active:true,type:'textMove',idx:i,ox:w.x-t.x,oy:w.y-t.y}}
this.app.updateInfo();this.app.draw();return
}
}
if(!HOLSTER.locked){for(let i=0;i<NODES.length;i++){const n=NODES[i],nw=M.holsterToWorld(n),h1w=M.holsterToWorld({x:n.x+n.h1.x,y:n.y+n.h1.y}),h2w=M.holsterToWorld({x:n.x+n.h2.x,y:n.y+n.h2.y});if(M.dist(w,nw)<12/VIEW.zoom){DRAG={active:true,type:'node',idx:i};SELECTED={type:'node',idx:i};this.app.canvas.style.cursor='grabbing';this.app.updateInfo();this.app.draw();return}if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'h1',idx:i};SELECTED=null;this.app.canvas.style.cursor='grabbing';this.app.updateInfo();this.app.draw();return}if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'h2',idx:i};SELECTED=null;this.app.canvas.style.cursor='grabbing';this.app.updateInfo();this.app.draw();return}}}
const pat=this.app.getPatternPath();
if(M.insidePoly(w,pat)){SELECTED={type:'holster'};this.app.updateInfo();this.app.draw();return}
// Check for click on reference image (to drag it)
if(REF_IMAGE.img&&CFG.showRefImage){
const rw=REF_IMAGE.width*REF_IMAGE.scale;
const rh=REF_IMAGE.height*REF_IMAGE.scale;
const rx=REF_IMAGE.x-rw/2,ry=REF_IMAGE.y-rh/2;
if(w.x>=rx&&w.x<=rx+rw&&w.y>=ry&&w.y<=ry+rh){
SELECTED={type:'refImage'};
DRAG={active:true,type:'refImage',sx:w.x,sy:w.y,ox:REF_IMAGE.x,oy:REF_IMAGE.y};
this.app.updateInfo();this.app.draw();return;
}}
SELECTED=null;this.app.updateInfo();this.app.draw()
}
onMove(e){const w=this.getWorld(e);
// Add hover detection when not dragging
if(!DRAG.active&&MODE==='select'){
const prevHover=HOVER;
HOVER=null;
// Check nodes first (higher priority than bezier handles) - only when holster unlocked
if(!HOLSTER.locked){
for(let i=0;i<NODES.length;i++){
const n=NODES[i];
const nw=M.holsterToWorld(n);
const h1w=M.holsterToWorld({x:n.x+n.h1.x,y:n.y+n.h1.y});
const h2w=M.holsterToWorld({x:n.x+n.h2.x,y:n.y+n.h2.y});
if(M.dist(w,nw)<HOVER_TOLERANCE.node/VIEW.zoom){HOVER={type:'node',idx:i};break}
if(M.dist(w,h1w)<HOVER_TOLERANCE.handle/VIEW.zoom){HOVER={type:'h1',idx:i};break}
if(M.dist(w,h2w)<HOVER_TOLERANCE.handle/VIEW.zoom){HOVER={type:'h2',idx:i};break}
}
}
// Check edge range handles
if(!HOVER){
for(let ri=0;ri<EDGE_RANGES.length;ri++){
const range=EDGE_RANGES[ri];
const rightHalf=this.app.getRightHalfPath();
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
gizmo=this.app.getGizmos(HOLSTER,'holster');
}else if(SELECTED.type==='asymShape'){
gizmo=this.app.getGizmos(ASYM_SHAPES[SELECTED.idx],'asymShape');
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
const ghostPat=this.app.getMergedPatternPath();
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
    this.app.canvas.style.cursor = 'grab';
  } else if(HOVER.type === 'gizmo') {
    if(HOVER.gizmoType === 'rotate') {
      this.app.canvas.style.cursor = 'crosshair';
    } else if(HOVER.gizmoType === 'scale' || HOVER.gizmoType === 'scaleX' || HOVER.gizmoType === 'scaleY') {
      this.app.canvas.style.cursor = 'nwse-resize';
    } else {
      this.app.canvas.style.cursor = 'move';
    }
  } else if(HOVER.type === 'rangeStart' || HOVER.type === 'rangeEnd') {
    this.app.canvas.style.cursor = 'ew-resize';
  } else if(HOVER.type === 'ghostLayer') {
    this.app.canvas.style.cursor = 'move';
  } else {
    this.app.canvas.style.cursor = 'pointer';
  }
} else {
  this.app.canvas.style.cursor = 'default';
}
// Only redraw if hover state changed (performance optimization)
if(!M.hoverEq(prevHover,HOVER)){
this.app.draw();
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
this.app.showToast('✓ Snapped to alignment','success');
}
}else{
GHOST_OFFSET.x=newOffsetX;
GHOST_OFFSET.y=newOffsetY;
}
break;
}
case'refImage':REF_IMAGE.x=DRAG.ox+(w.x-DRAG.sx);REF_IMAGE.y=DRAG.oy+(w.y-DRAG.sy);break;
case'holsterGizmo':if(DRAG.gizmoType==='move'){const oldX=HOLSTER.x,oldY=HOLSTER.y;HOLSTER.x=DRAG.shx+(w.x-DRAG.sx);HOLSTER.y=DRAG.shy+(w.y-DRAG.sy);const dx=HOLSTER.x-oldX,dy=HOLSTER.y-oldY;if(dx!==0||dy!==0){this.app.propagateTransformToChildren('holster',0,dx,dy)}}else if(DRAG.gizmoType==='rotate'){HOLSTER.rotation=Math.atan2(w.y-HOLSTER.y,w.x-HOLSTER.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-HOLSTER.x,DRAG.sy-HOLSTER.y),dn=Math.hypot(w.x-HOLSTER.x,w.y-HOLSTER.y),sf=dn/ds;if(SHIFT_HELD){const lw=M.worldToLocal(w,{x:HOLSTER.x,y:HOLSTER.y,rotation:HOLSTER.rotation,scaleX:1,scaleY:1}),b=M.getBounds(this.getPatternLocalPath());if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))HOLSTER.scaleX=Math.max(.1,Math.abs(lw.x)/(b.w/2+20));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))HOLSTER.scaleY=Math.max(.1,Math.abs(lw.y)/(b.h/2+20))}else{HOLSTER.scaleX=Math.max(.1,DRAG.ssx*sf);HOLSTER.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.app.updateInfo();break;
case'symHoleGizmo':{const hole=SYM_HOLES[DRAG.idx],lw=M.worldToHolster(w);if(DRAG.gizmoType==='move'){const oldX=hole.x,oldY=hole.y;const s=snapLocal({x:Math.abs(lw.x),y:lw.y});hole.x=s.x;hole.y=s.y;const dx=hole.x-oldX,dy=hole.y-oldY;if(dx!==0||dy!==0){this.app.propagateTransformToChildren('symHole',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){const wh=this.app.getSymHoleWorld(hole,1);hole.rotation=Math.atan2(w.y-wh.y,w.x-wh.x)-(CFG.lockFoldLine?0:(HOLSTER.rotation||0))+Math.PI/4}else{const wh=this.app.getSymHoleWorld(hole,1),ds=Math.hypot(DRAG.sx-wh.x,DRAG.sy-wh.y),dn=Math.hypot(w.x-wh.x,w.y-wh.y),sf=dn/ds;if(SHIFT_HELD){const rot=(CFG.lockFoldLine?0:(HOLSTER.rotation||0))+(hole.rotation||0),lh=M.worldToLocal(w,{x:wh.x,y:wh.y,rotation:rot,scaleX:1,scaleY:1});if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))hole.width=Math.max(1,Math.abs(lh.x)*2/HOLSTER.scaleX);if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))hole.height=Math.max(1,Math.abs(lh.y)*2/HOLSTER.scaleY)}else{hole.width=Math.max(1,DRAG.sw*sf);hole.height=Math.max(1,DRAG.sh*sf)}}this.app.updateInfo();break}
case'asymHoleGizmo':{const hole=ASYM_HOLES[DRAG.idx];if(DRAG.gizmoType==='move'){const oldX=hole.x,oldY=hole.y;const s=snapWorld(w);hole.x=s.x;hole.y=s.y;const dx=hole.x-oldX,dy=hole.y-oldY;if(dx!==0||dy!==0){this.app.propagateTransformToChildren('asymHole',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){hole.rotation=Math.atan2(w.y-hole.y,w.x-hole.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-DRAG.shx,DRAG.sy-DRAG.shy),dn=Math.hypot(w.x-hole.x,w.y-hole.y),sf=dn/ds;if(SHIFT_HELD){const lh=M.worldToLocal(w,{x:hole.x,y:hole.y,rotation:hole.rotation||0,scaleX:1,scaleY:1});if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))hole.width=Math.max(1,Math.abs(lh.x)*2);if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))hole.height=Math.max(1,Math.abs(lh.y)*2)}else{hole.width=Math.max(1,DRAG.sw*sf);hole.height=Math.max(1,DRAG.sh*sf)}}this.app.updateInfo();break}
case'asymShapeGizmo':{const s=ASYM_SHAPES[DRAG.idx];if(DRAG.gizmoType==='move'){const oldX=s.x,oldY=s.y;const sn=snapWorld(w);s.x=sn.x;s.y=sn.y;const dx=s.x-oldX,dy=s.y-oldY;if(dx!==0||dy!==0){this.app.propagateTransformToChildren('asymShape',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){s.rotation=Math.atan2(w.y-s.y,w.x-s.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-DRAG.shx,DRAG.sy-DRAG.shy),dn=Math.hypot(w.x-s.x,w.y-s.y),sf=dn/ds;if(SHIFT_HELD&&s.points){const ls=M.worldToLocal(w,{x:s.x,y:s.y,rotation:s.rotation||0,scaleX:1,scaleY:1}),b=M.getBounds(s.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))s.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))s.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{s.scaleX=Math.max(.1,DRAG.ssx*sf);s.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.app.updateInfo();break}
case'asymShapeVertex':{const s=ASYM_SHAPES[DRAG.idx];
// Convert world coords to local shape coords
const localW=M.worldToLocal(w,{x:s.x,y:s.y,rotation:s.rotation||0,scaleX:s.scaleX||1,scaleY:s.scaleY||1});
s.points[DRAG.ptIdx].x=localW.x;
s.points[DRAG.ptIdx].y=localW.y;
break}
case'asymShapeH1':{const s=ASYM_SHAPES[DRAG.idx],p=s.points[DRAG.ptIdx];
const cpts=this.app.getShapeControlPts(s),cp=cpts[DRAG.ptIdx];
const dx=w.x-cp.x,dy=w.y-cp.y;
const rot=-(s.rotation||0);
const rd=M.rotate({x:dx,y:dy},rot);
p.h1={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};
break}
case'asymShapeH2':{const s=ASYM_SHAPES[DRAG.idx],p=s.points[DRAG.ptIdx];
const cpts=this.app.getShapeControlPts(s),cp=cpts[DRAG.ptIdx];
const dx=w.x-cp.x,dy=w.y-cp.y;
const rot=-(s.rotation||0);
const rd=M.rotate({x:dx,y:dy},rot);
p.h2={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};
break}
case'symShapeGizmo':{const s=SYM_SHAPES[DRAG.idx],lw=M.worldToHolster(w);if(DRAG.gizmoType==='move'){const oldX=s.x,oldY=s.y;const sn=snapLocal({x:Math.abs(lw.x),y:lw.y});s.x=sn.x;s.y=sn.y;const dx=s.x-oldX,dy=s.y-oldY;if(dx!==0||dy!==0){this.app.propagateTransformToChildren('symShape',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){const wShp=this.app.getSymShapeWorld(s,1);s.rotation=Math.atan2(w.y-wShp.y,w.x-wShp.x)-(HOLSTER.rotation||0)+Math.PI/4}else{const wShp=this.app.getSymShapeWorld(s,1),ds=Math.hypot(DRAG.sx-wShp.x,DRAG.sy-wShp.y),dn=Math.hypot(w.x-wShp.x,w.y-wShp.y),sf=dn/ds;if(SHIFT_HELD&&s.points){const ls=M.worldToLocal(w,{x:wShp.x,y:wShp.y,rotation:wShp.rotation||0,scaleX:1,scaleY:1}),b=M.getBounds(s.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))s.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))s.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{s.scaleX=Math.max(.1,DRAG.ssx*sf);s.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.app.updateInfo();break}
case'symShapeVertex':{const s=SYM_SHAPES[DRAG.idx],lw=M.worldToHolster(w);const localW={x:Math.abs(lw.x),y:lw.y};s.points[DRAG.ptIdx].x=localW.x;s.points[DRAG.ptIdx].y=localW.y;break}
case'symShapeH1':{const s=SYM_SHAPES[DRAG.idx],p=s.points[DRAG.ptIdx];const wShp=this.app.getSymShapeWorld(s,1);const cpts=this.app.getShapeControlPts(wShp),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(s.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx/HOLSTER.scaleX,y:dy/HOLSTER.scaleY},rot);p.h1={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};break}
case'symShapeH2':{const s=SYM_SHAPES[DRAG.idx],p=s.points[DRAG.ptIdx];const wShp=this.app.getSymShapeWorld(s,1);const cpts=this.app.getShapeControlPts(wShp),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(s.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx/HOLSTER.scaleX,y:dy/HOLSTER.scaleY},rot);p.h2={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};break}
case'symCustomHoleGizmo':{const h=SYM_CUSTOM_HOLES[DRAG.idx],lw=M.worldToHolster(w);if(DRAG.gizmoType==='move'){const oldX=h.x,oldY=h.y;const s=snapLocal({x:Math.abs(lw.x),y:lw.y});h.x=s.x;h.y=s.y;const dx=h.x-oldX,dy=h.y-oldY;if(dx!==0||dy!==0){this.app.propagateTransformToChildren('symCustomHole',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){const pts=this.app.getCustomHoleWorld(h,1),b=M.getBounds(pts);h.rotation=Math.atan2(w.y-b.cy,w.x-b.cx)-(HOLSTER.rotation||0)+Math.PI/4}else{const pts=this.app.getCustomHoleWorld(h,1),b=M.getBounds(pts),ds=Math.hypot(DRAG.sx-b.cx,DRAG.sy-b.cy),dn=Math.hypot(w.x-b.cx,w.y-b.cy),sf=dn/ds;if(SHIFT_HELD){const ls=M.worldToLocal(w,{x:b.cx,y:b.cy,rotation:(HOLSTER.rotation||0)+(h.rotation||0),scaleX:1,scaleY:1}),hb=M.getBounds(h.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))h.scaleX=Math.max(.1,Math.abs(ls.x)/(hb.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))h.scaleY=Math.max(.1,Math.abs(ls.y)/(hb.h/2+10))}else{h.scaleX=Math.max(.1,DRAG.ssx*sf);h.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.app.updateInfo();break}
case'asymCustomHoleGizmo':{const h=ASYM_CUSTOM_HOLES[DRAG.idx];if(DRAG.gizmoType==='move'){const oldX=h.x,oldY=h.y;const s=snapWorld(w);h.x=s.x;h.y=s.y;const dx=h.x-oldX,dy=h.y-oldY;if(dx!==0||dy!==0){this.app.propagateTransformToChildren('asymCustomHole',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){h.rotation=Math.atan2(w.y-h.y,w.x-h.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-DRAG.shx,DRAG.sy-DRAG.shy),dn=Math.hypot(w.x-h.x,w.y-h.y),sf=dn/ds;if(SHIFT_HELD){const ls=M.worldToLocal(w,{x:h.x,y:h.y,rotation:h.rotation||0,scaleX:1,scaleY:1}),b=M.getBounds(h.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))h.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))h.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{h.scaleX=Math.max(.1,DRAG.ssx*sf);h.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.app.updateInfo();break}
case'symStitchPt':{const sl=SYM_STITCHES[DRAG.idx],lw=M.worldToHolster(w);const s=snapLocal({x:Math.abs(lw.x),y:lw.y});sl.points[DRAG.ptIdx].x=s.x;sl.points[DRAG.ptIdx].y=s.y;break}
case'asymStitchPt':{const sl=ASYM_STITCHES[DRAG.idx];const s=snapWorld(w);sl.points[DRAG.ptIdx].x=s.x;sl.points[DRAG.ptIdx].y=s.y;break}
case'symCustomHoleNode':{const h=SYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.app.getCustomHoleControlPts(h,1),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx/HOLSTER.scaleX,y:dy/HOLSTER.scaleY},rot);p.x+=rd.x/(h.scaleX||1);p.y+=rd.y/(h.scaleY||1);break}
case'symCustomHoleH1':{const h=SYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.app.getCustomHoleControlPts(h,1),cp=cpts[DRAG.ptIdx];const dx=(w.x-cp.x)/HOLSTER.scaleX,dy=(w.y-cp.y)/HOLSTER.scaleY;const rot=-(h.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.h1={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'symCustomHoleH2':{const h=SYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.app.getCustomHoleControlPts(h,1),cp=cpts[DRAG.ptIdx];const dx=(w.x-cp.x)/HOLSTER.scaleX,dy=(w.y-cp.y)/HOLSTER.scaleY;const rot=-(h.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.h2={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'asymCustomHoleNode':{const h=ASYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.app.getCustomHoleControlPtsAsym(h),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.x+=rd.x/(h.scaleX||1);p.y+=rd.y/(h.scaleY||1);break}
case'asymCustomHoleH1':{const h=ASYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.app.getCustomHoleControlPtsAsym(h),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.h1={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'asymCustomHoleH2':{const h=ASYM_CUSTOM_HOLES[DRAG.idx],p=h.points[DRAG.ptIdx];const cpts=this.app.getCustomHoleControlPtsAsym(h),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0);const rd=M.rotate({x:dx,y:dy},rot);p.h2={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'rangeStart':EDGE_RANGES[DRAG.idx].start=Math.max(0,Math.min(EDGE_RANGES[DRAG.idx].end-.01,M.projectToPath(DRAG.path,DRAG.arc,w)));break;
case'rangeEnd':EDGE_RANGES[DRAG.idx].end=Math.max(EDGE_RANGES[DRAG.idx].start+.01,Math.min(1,M.projectToPath(DRAG.path,DRAG.arc,w)));break;
case'mergedRangeStart':MERGED_EDGE_RANGES[DRAG.idx].start=Math.max(0,Math.min(MERGED_EDGE_RANGES[DRAG.idx].end-.01,M.projectToPath(DRAG.path,DRAG.arc,w)));break;
case'mergedRangeEnd':MERGED_EDGE_RANGES[DRAG.idx].end=Math.max(MERGED_EDGE_RANGES[DRAG.idx].start+.01,Math.min(1,M.projectToPath(DRAG.path,DRAG.arc,w)));break;
case'textMove':{const t=TEXT_ANNOTATIONS[DRAG.idx];const oldX=t.x,oldY=t.y;const s=snapWorld({x:w.x-DRAG.ox,y:w.y-DRAG.oy});t.x=s.x;t.y=s.y;const dx=t.x-oldX,dy=t.y-oldY;if(dx!==0||dy!==0){this.app.propagateTransformToChildren('textAnnotation',DRAG.idx,dx,dy)}break}
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
this.app.draw();
}
onUp(){if(DRAG.active&&DRAG.type&&DRAG.type!=='publishPan'){this.app.saveState()}DRAG.active=false;if(PUBLISH_MODE){this.app.canvas.style.cursor='grab'}else if(!isPanning){this.app.canvas.style.cursor='default'}}
}
