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
  /**
   * @param {Object} options - Configuration options and dependencies
   */
  constructor(options = {}) {
    // Canvas access
    this.getCanvas = options.getCanvas || (() => null);
    this.getCtx = options.getCtx || (() => null);
    
    // View state
    this.getView = options.getView || (() => ({ x: 0, y: 0, zoom: 1 }));
    this.setView = options.setView || (() => {});
    
    // Mode
    this.getMode = options.getMode || (() => 'select');
    
    // Selection
    this.getSelected = options.getSelected || (() => null);
    this.setSelected = options.setSelected || (() => {});
    
    // Drag state
    this.getDrag = options.getDrag || (() => ({ active: false }));
    this.setDrag = options.setDrag || (() => {});
    
    // Hover state
    this.getHover = options.getHover || (() => null);
    this.setHover = options.setHover || (() => {});
    
    // Pattern state
    this.getHolster = options.getHolster || (() => ({}));
    this.getNodes = options.getNodes || (() => []);
    this.setNodes = options.setNodes || (() => {});
    this.getCfg = options.getCfg || (() => ({}));
    
    // Publish mode
    this.getPublishMode = options.getPublishMode || (() => false);
    this.getPublishView = options.getPublishView || (() => ({ x: 0, y: 0, scale: 1 }));
    this.setPublishView = options.setPublishView || (() => {});
    
    // Reference image
    this.getRefImage = options.getRefImage || (() => ({}));
    
    // Layer state
    this.getLayer = options.getLayer || (() => 'symmetric');
    this.getCurrentLayer = options.getCurrentLayer || (() => 'front');
    this.getFrontLayer = options.getFrontLayer || (() => null);
    this.getBackLayer = options.getBackLayer || (() => null);
    this.getGhostOffset = options.getGhostOffset || (() => ({ x: 0, y: 0 }));
    this.setGhostOffset = options.setGhostOffset || (() => {});
    
    // Input flags
    this.getIsPanning = options.getIsPanning || (() => false);
    this.getShiftHeld = options.getShiftHeld || (() => false);
    
    // Temp state
    this.getTempStitch = options.getTempStitch || (() => null);
    this.setTempStitch = options.setTempStitch || (() => {});
    this.getTempShape = options.getTempShape || (() => null);
    this.setTempShape = options.setTempShape || (() => {});
    this.getTempCustomHole = options.getTempCustomHole || (() => null);
    this.setTempCustomHole = options.setTempCustomHole || (() => {});
    
    // Element arrays
    this.getSymHoles = options.getSymHoles || (() => []);
    this.getAsymHoles = options.getAsymHoles || (() => []);
    this.getSymShapes = options.getSymShapes || (() => []);
    this.getAsymShapes = options.getAsymShapes || (() => []);
    this.getSymStitches = options.getSymStitches || (() => []);
    this.getAsymStitches = options.getAsymStitches || (() => []);
    this.getSymCustomHoles = options.getSymCustomHoles || (() => []);
    this.getAsymCustomHoles = options.getAsymCustomHoles || (() => []);
    this.getEdgeRanges = options.getEdgeRanges || (() => []);
    this.getMergedEdgeRanges = options.getMergedEdgeRanges || (() => []);
    this.getEdgeStitches = options.getEdgeStitches || (() => []);
    this.getTextAnnotations = options.getTextAnnotations || (() => []);
    
    // Helper functions
    this.snapWorld = options.snapWorld || ((pt) => pt);
    this.snapLocal = options.snapLocal || ((pt) => pt);
    this.getHoverTolerance = options.getHoverTolerance || (() => ({ node: 12, handle: 10, range: 18, gizmo: 12 }));
    
    // App method callbacks
    this.draw = options.draw || (() => {});
    this.updateInfo = options.updateInfo || (() => {});
    this.saveState = options.saveState || (() => {});
    this.showToast = options.showToast || (() => {});
    this.finishMode = options.finishMode || (() => {});
    this.handleCalibrationClick = options.handleCalibrationClick || (() => {});
    this.startTextEdit = options.startTextEdit || (() => {});
    this.createStitchFromRange = options.createStitchFromRange || (() => {});
    this.createStitchFromMergedRange = options.createStitchFromMergedRange || (() => {});
    
    // Pattern helper methods
    this.getPatternPath = options.getPatternPath || (() => []);
    this.getPatternLocalPath = options.getPatternLocalPath || (() => []);
    this.getMergedPatternPath = options.getMergedPatternPath || (() => []);
    this.getRightHalfPath = options.getRightHalfPath || (() => []);
    this.getSymHoleWorld = options.getSymHoleWorld || ((hole, side) => hole);
    this.getSymShapeWorld = options.getSymShapeWorld || ((shape, side) => shape);
    this.getSymStitchWorld = options.getSymStitchWorld || ((sl, side) => []);
    this.getCustomHoleWorld = options.getCustomHoleWorld || ((h, side) => []);
    this.getCustomHoleWorldAsym = options.getCustomHoleWorldAsym || ((h) => []);
    this.getShapeControlPts = options.getShapeControlPts || ((s) => []);
    this.getCustomHoleControlPts = options.getCustomHoleControlPts || ((h, side) => []);
    this.getCustomHoleControlPtsAsym = options.getCustomHoleControlPtsAsym || ((h) => []);
    this.getGizmos = options.getGizmos || ((obj, type) => ({ handles: [] }));
    this.getLinkedCircleData = options.getLinkedCircleData || ((shape) => null);
    this.offsetPathStable = options.offsetPathStable || ((path, delta) => path);
    this.offsetPathStableClosed = options.offsetPathStableClosed || ((path, delta) => path);
    this.propagateTransformToChildren = options.propagateTransformToChildren || (() => {});
    
    // Button bounds
    this.getStitchBtnBounds = options.getStitchBtnBounds || (() => null);
    this.getMergedStitchBtnBounds = options.getMergedStitchBtnBounds || (() => null);
    
    // Math utilities
    this.M = options.getMath ? options.getMath() : M;
  }

  // Convert screen coordinates to world coordinates
  getWorld(e){
    const canvas = this.getCanvas();
    const VIEW = this.getView();
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - VIEW.x) / VIEW.zoom,
      y: (e.clientY - r.top - VIEW.y) / VIEW.zoom
    };
  }
onDblClick(e){const w=this.getWorld(e);if(this.getMode()==='stitch'&&this.getTempStitch()&&this.getTempStitch().points.length>=2){this.finishMode();return}if(this.getMode()==='shape'&&this.getTempShape()&&this.getTempShape().points.length>=3){this.finishMode();return}if(this.getMode()==='customhole'&&this.getTempCustomHole()&&this.getTempCustomHole().points.length>=3){this.finishMode();return}
// Double-click on text to edit inline
for(let i=this.getTextAnnotations().length-1;i>=0;i--){
const t=this.getTextAnnotations()[i];
if(t.hidden)continue;
const fs=(t.fontSize||12)/this.getView().zoom;
const tw=this.getCtx().measureText(t.text||'').width/this.getView().zoom;
const th=fs*1.2;
if(w.x>=t.x-5/this.getView().zoom&&w.x<=t.x+tw+5/this.getView().zoom&&w.y>=t.y-5/this.getView().zoom&&w.y<=t.y+th+5/this.getView().zoom){
this.setSelected({type:'textAnnotation',idx:i});
this.updateInfo();
this.startTextEdit(i);
return;
}
}
if(this.getMode()==='select'&&!this.getHolster().locked){const local=this.getPatternLocalPath(),lw=this.M.worldToHolster(w);let minD=Infinity,ins=-1;for(const p of local){const d=this.M.dist(lw,p);if(d<minD&&p.segIdx>=0){minD=d;ins=p.segIdx}}if(minD<30/(this.getView().zoom*Math.min(this.getHolster().scaleX||1,this.getHolster().scaleY||1))&&ins>=0){this.getNodes().splice(ins+1,0,{x:this.getCfg().asymmetricOutline?lw.x:Math.max(0,lw.x),y:lw.y,h1:{x:0,y:0},h2:{x:0,y:0}});this.draw()}}}
onDown(e){e.preventDefault();
// Clear hover state when starting any interaction
this.setHover(null);
// Handle calibration mode
if(this.getRefImage().calibrating){
const w=this.getWorld(e);
this.handleCalibrationClick(w);
return;
}
// Handle publish mode panning
if(this.getPublishMode()){
this.setDrag({active:true,type:'publishPan',sx:e.clientX,sy:e.clientY,vx:this.getPublishView().x,vy:this.getPublishView().y});
this.getCanvas().style.cursor='grabbing';
return;
}
const w=this.getWorld(e);
if(e.button===1||e.button===2||this.getIsPanning()){this.setDrag({active:true,type:'pan',sx:e.clientX,sy:e.clientY,vx:this.getView().x,vy:this.getView().y});this.getCanvas().style.cursor='grabbing';return}
if(this.getMode()==='hole'){const lw=this.M.worldToHolster(w);const nh={x:this.getLayer()==='asymmetric'?w.x:Math.abs(lw.x),y:this.getLayer()==='asymmetric'?w.y:lw.y,width:this.getCfg().defaultHoleWidth,height:this.getCfg().defaultHoleShape==='circle'?this.getCfg().defaultHoleWidth:this.getCfg().defaultHoleHeight,rotation:0,shape:this.getCfg().defaultHoleShape,stitchBorder:this.getCfg().defaultHoleStitchBorder,stitchMargin:this.getCfg().defaultHoleStitchMargin,stitchSpacing:this.getCfg().defaultHoleStitchSpacing};if(this.getLayer()==='asymmetric'){this.getAsymHoles().push(nh);this.setSelected({type:'asymHole',idx:this.getAsymHoles().length-1})}else{this.getSymHoles().push(nh);this.setSelected({type:'symHole',idx:this.getSymHoles().length-1})}this.updateInfo();this.draw();this.saveState();return}
if(this.getMode()==='text'){
// Create new text annotation with simple structure
this.getTextAnnotations().push({
x:w.x,
y:w.y,
text:'Text',
fontSize:12,
bold:false,
italic:false,
style:'normal', // "normal" | "header" | "subheader"
listType:'none' // "none" | "bullet" | "numbered"
});
this.setSelected({type:'textAnnotation',idx:this.getTextAnnotations().length-1});
this.updateInfo();
this.startTextEdit(this.getTextAnnotations().length-1);
return;
}
if(this.getMode()==='stitch'){if(!this.getTempStitch())this.setTempStitch({points:[{x:w.x,y:w.y}]});else this.getTempStitch().points.push({x:w.x,y:w.y});document.getElementById('mode-indicator').querySelector('.mode-text').textContent=(this.getLayer()==='asymmetric'?'◧':'〰')+' '+this.getTempStitch().points.length+' pts';this.draw();return}
if(this.getMode()==='shape'){if(!this.getTempShape())this.setTempShape({points:[{x:w.x,y:w.y}]});else this.getTempShape().points.push({x:w.x,y:w.y});document.getElementById('mode-indicator').querySelector('.mode-text').textContent='◧ '+this.getTempShape().points.length+' pts';this.draw();return}
if(this.getMode()==='customhole'){if(!this.getTempCustomHole())this.setTempCustomHole({points:[{x:w.x,y:w.y}]});else this.getTempCustomHole().points.push({x:w.x,y:w.y});document.getElementById('mode-indicator').querySelector('.mode-text').textContent='✏ '+this.getTempCustomHole().points.length+' pts';this.draw();return}
// Check for ghost layer drag in two-layer mode
if(this.getMode()==='select'&&this.getCfg().projectType==='two-layer'&&this.getCfg().showGhostLayer){
const ghostState=this.getCurrentLayer()==='front'?this.getBackLayer():this.getFrontLayer();
if(ghostState){
// Temporarily apply ghost layer state to get its outline
const savedNODES=this.getNodes();
this.setNodes(ghostState.this.getNodes());
const ghostPat=this.getMergedPatternPath();
this.setNodes(savedNODES);
// Check if click is near the ghost layer outline (with offset applied)
const ghostPatOffset=ghostPat.map(p=>({x:p.x+this.getGhostOffset().x,y:p.y+this.getGhostOffset().y}));
// Check if click is on or near the ghost outline using distance to edge segments
let onGhostOutline=false;
const threshold=10/this.getView().zoom;
for(let i=0;i<ghostPatOffset.length;i++){
const a=ghostPatOffset[i];
const b=ghostPatOffset[(i+1)%ghostPatOffset.length];
const sl=(b.x-a.x)**2+(b.y-a.y)**2;
if(sl===0)continue;
let t=((w.x-a.x)*(b.x-a.x)+(w.y-a.y)*(b.y-a.y))/sl;
t=Math.max(0,Math.min(1,t));
const pr={x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)};
if(this.M.dist(w,pr)<threshold){
onGhostOutline=true;
break;
}
}
if(onGhostOutline){
this.setDrag({active:true,type:'ghostLayer',sx:w.x,sy:w.y,gox:this.getGhostOffset().x,goy:this.getGhostOffset().y});
this.getCanvas().style.cursor='move';
return;
}
}
}
// Gizmo checks
if(this.getSelected()?.type==='holster'&&!this.getHolster().locked){const gizmo=this.getGizmos(this.getHolster(),'holster');for(const g of gizmo.handles){if(this.M.dist(w,g)<15/this.getView().zoom){this.setDrag({active:true,type:'holsterGizmo',gizmoType:g.type,sx:w.x,sy:w.y,shx:this.getHolster().x,shy:this.getHolster().y,ssx:this.getHolster().scaleX,ssy:this.getHolster().scaleY,sr:this.getHolster().rotation});if(g.type==='rotate'){this.getCanvas().style.cursor='crosshair'}else if(g.type==='scale'||g.type.includes('e')||g.type.includes('w')||g.type.includes('n')||g.type.includes('s')){this.getCanvas().style.cursor='nwse-resize'}else{this.getCanvas().style.cursor='move'}return}}}
if(this.getSelected()?.type==='symHole'){const hole=this.getSymHoles()[this.getSelected().idx];if(!hole.locked){const wh=this.getSymHoleWorld(hole,1),gizmo=this.getGizmos(wh,'hole');for(const g of gizmo.handles){if(this.M.dist(w,g)<12/this.getView().zoom){this.setDrag({active:true,type:'symHoleGizmo',gizmoType:g.type,idx:this.getSelected().idx,sx:w.x,sy:w.y,shx:hole.x,shy:hole.y,sw:hole.width,sh:hole.height,sr:hole.rotation||0});if(g.type==='rotate'){this.getCanvas().style.cursor='crosshair'}else if(g.type==='scale'||g.type.includes('e')||g.type.includes('w')||g.type.includes('n')||g.type.includes('s')){this.getCanvas().style.cursor='nwse-resize'}else{this.getCanvas().style.cursor='move'}return}}}}
if(this.getSelected()?.type==='asymHole'){const hole=this.getAsymHoles()[this.getSelected().idx];if(!hole.locked){const gizmo=this.getGizmos(hole,'hole');for(const g of gizmo.handles){if(this.M.dist(w,g)<12/this.getView().zoom){this.setDrag({active:true,type:'asymHoleGizmo',gizmoType:g.type,idx:this.getSelected().idx,sx:w.x,sy:w.y,shx:hole.x,shy:hole.y,sw:hole.width,sh:hole.height,sr:hole.rotation||0});if(g.type==='rotate'){this.getCanvas().style.cursor='crosshair'}else if(g.type==='scale'||g.type.includes('e')||g.type.includes('w')||g.type.includes('n')||g.type.includes('s')){this.getCanvas().style.cursor='nwse-resize'}else{this.getCanvas().style.cursor='move'}return}}}}
if(this.getSelected()?.type==='asymShape'){const s=this.getAsymShapes()[this.getSelected().idx];if(!s.locked){
// Check for vertex drag first (higher priority than bezier handles)
const pts=s.points.map((p,i)=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=this.M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y,idx:i}});
for(let i=0;i<pts.length;i++){if(this.M.dist(w,pts[i])<10/this.getView().zoom){this.setDrag({active:true,type:'asymShapeVertex',idx:this.getSelected().idx,ptIdx:i,sx:w.x,sy:w.y});return}}
// Then check for bezier handle drag
const cpts=this.getShapeControlPts(s);
for(let i=0;i<cpts.length;i++){
const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};
if(this.M.dist(w,h1w)<10/this.getView().zoom){this.setDrag({active:true,type:'asymShapeH1',idx:this.getSelected().idx,ptIdx:i});return}
if(this.M.dist(w,h2w)<10/this.getView().zoom){this.setDrag({active:true,type:'asymShapeH2',idx:this.getSelected().idx,ptIdx:i});return}
}
// Then check gizmo handles
const gizmo=this.getGizmos(s,'asymShape');for(const g of gizmo.handles){if(this.M.dist(w,g)<12/this.getView().zoom){this.setDrag({active:true,type:'asymShapeGizmo',gizmoType:g.type,idx:this.getSelected().idx,sx:w.x,sy:w.y,shx:s.x,shy:s.y,ssx:s.scaleX||1,ssy:s.scaleY||1,sr:s.rotation||0});return}}}}
if(this.getSelected()?.type==='symShape'){const s=this.getSymShapes()[this.getSelected().idx];if(!s.locked){
// Check for vertex drag first (higher priority than bezier handles)
const wShp=this.getSymShapeWorld(s,1);
const pts=wShp.points.map((p,i)=>{const sc={x:p.x*(wShp.scaleX||1),y:p.y*(wShp.scaleY||1)};const r=this.M.rotate(sc,wShp.rotation||0);return{x:r.x+wShp.x,y:r.y+wShp.y,idx:i}});
for(const pt of pts){if(this.M.dist(w,pt)<12/this.getView().zoom){this.setDrag({active:true,type:'symShapeVertex',idx:this.getSelected().idx,ptIdx:pt.idx});return}}
// Check bezier handles
const cpts=this.getShapeControlPts(wShp);
for(let i=0;i<cpts.length;i++){
const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};
if(this.M.dist(w,h1w)<10/this.getView().zoom){this.setDrag({active:true,type:'symShapeH1',idx:this.getSelected().idx,ptIdx:i});return}
if(this.M.dist(w,h2w)<10/this.getView().zoom){this.setDrag({active:true,type:'symShapeH2',idx:this.getSelected().idx,ptIdx:i});return}
}
// Then check gizmo handles
const gizmo=this.getGizmos(wShp,'asymShape');for(const g of gizmo.handles){if(this.M.dist(w,g)<12/this.getView().zoom){this.setDrag({active:true,type:'symShapeGizmo',gizmoType:g.type,idx:this.getSelected().idx,sx:w.x,sy:w.y,shx:s.x,shy:s.y,ssx:s.scaleX||1,ssy:s.scaleY||1,sr:s.rotation||0});return}}}}
// Check for canvas "+ Stitch" button clicks - check merged first
if(this.getMergedStitchBtnBounds()){
const b=this.getMergedStitchBtnBounds();
if(w.x>=b.x&&w.x<=b.x+b.w&&w.y>=b.y&&w.y<=b.y+b.h){
this.setSelected({type:'mergedEdgeRange',idx:b.rangeIdx});
this.createStitchFromMergedRange();
return;
}}
if(this.getStitchBtnBounds()){
const b=this.getStitchBtnBounds();
if(w.x>=b.x&&w.x<=b.x+b.w&&w.y>=b.y&&w.y<=b.y+b.h){
this.setSelected({type:'edgeRange',idx:b.rangeIdx});
this.createStitchFromRange();
return;
}}
if(this.getSelected()?.type==='symCustomHole'){const h=this.getSymCustomHoles()[this.getSelected().idx];if(!h.locked){const pts=this.getCustomHoleWorld(h,1),b=this.M.getBounds(pts),gizmo=this.getGizmos({x:b.cx,y:b.cy,points:h.points,scaleX:h.scaleX||1,scaleY:h.scaleY||1,rotation:h.rotation||0},'asymShape');for(const g of gizmo.handles){if(this.M.dist(w,g)<12/this.getView().zoom){this.setDrag({active:true,type:'symCustomHoleGizmo',gizmoType:g.type,idx:this.getSelected().idx,sx:w.x,sy:w.y,shx:h.x,shy:h.y,ssx:h.scaleX||1,ssy:h.scaleY||1,sr:h.rotation||0});return}}const cpts=this.getCustomHoleControlPts(h,1);for(let i=0;i<cpts.length;i++){const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};if(this.M.dist(w,h1w)<10/this.getView().zoom){this.setDrag({active:true,type:'symCustomHoleH1',idx:this.getSelected().idx,ptIdx:i});return}if(this.M.dist(w,h2w)<10/this.getView().zoom){this.setDrag({active:true,type:'symCustomHoleH2',idx:this.getSelected().idx,ptIdx:i});return}if(this.M.dist(w,n)<12/this.getView().zoom){this.setDrag({active:true,type:'symCustomHoleNode',idx:this.getSelected().idx,ptIdx:i});return}}}}
if(this.getSelected()?.type==='asymCustomHole'){const h=this.getAsymCustomHoles()[this.getSelected().idx];if(!h.locked){const gizmo=this.getGizmos(h,'asymShape');for(const g of gizmo.handles){if(this.M.dist(w,g)<12/this.getView().zoom){this.setDrag({active:true,type:'asymCustomHoleGizmo',gizmoType:g.type,idx:this.getSelected().idx,sx:w.x,sy:w.y,shx:h.x,shy:h.y,ssx:h.scaleX||1,ssy:h.scaleY||1,sr:h.rotation||0});return}}const cpts=this.getCustomHoleControlPtsAsym(h);for(let i=0;i<cpts.length;i++){const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};if(this.M.dist(w,h1w)<10/this.getView().zoom){this.setDrag({active:true,type:'asymCustomHoleH1',idx:this.getSelected().idx,ptIdx:i});return}if(this.M.dist(w,h2w)<10/this.getView().zoom){this.setDrag({active:true,type:'asymCustomHoleH2',idx:this.getSelected().idx,ptIdx:i});return}if(this.M.dist(w,n)<12/this.getView().zoom){this.setDrag({active:true,type:'asymCustomHoleNode',idx:this.getSelected().idx,ptIdx:i});return}}}}
// Stitch point selection
if(this.getSelected()?.type==='symStitch'){const sl=this.getSymStitches()[this.getSelected().idx];if(!sl.locked){const pts=this.getSymStitchWorld(sl,1);for(let i=0;i<pts.length;i++){if(this.M.dist(w,pts[i])<8/this.getView().zoom){this.setDrag({active:true,type:'symStitchPt',idx:this.getSelected().idx,ptIdx:i,sx:w.x,sy:w.y});return}}}}
if(this.getSelected()?.type==='asymStitch'){const sl=this.getAsymStitches()[this.getSelected().idx];if(!sl.locked){for(let i=0;i<sl.points.length;i++){if(this.M.dist(w,sl.points[i])<8/this.getView().zoom){this.setDrag({active:true,type:'asymStitchPt',idx:this.getSelected().idx,ptIdx:i,sx:w.x,sy:w.y});return}}}}
// Edge range handles - check BEFORE object selection so handles take priority
const rightHalf=this.getRightHalfPath();
const rightWorld=rightHalf.map(p=>this.M.holsterToWorld(p));
const rightSt=rightWorld.length>2?this.offsetPathStable(rightWorld,-this.getCfg().stitchMargin):[];
const mergedPath=this.getMergedPatternPath();
// Helper to check edge range handles
const checkEdgeHandles=()=>{
if(rightSt.length>2){
const arc=this.M.buildArc(rightSt),tot=arc[arc.length-1].d;
for(let i=0;i<this.getEdgeRanges().length;i++){
const r=this.getEdgeRanges()[i],sp=this.M.ptAtDist(arc,tot*r.start),ep=this.M.ptAtDist(arc,tot*r.end);
if(sp&&this.M.dist(w,sp)<18/this.getView().zoom){this.setSelected({type:'edgeRange',idx:i});this.setDrag({active:true,type:'rangeStart',idx:i,path:rightSt,arc,tot});this.getCanvas().style.cursor='ew-resize';this.updateInfo();this.draw();return true}
if(ep&&this.M.dist(w,ep)<18/this.getView().zoom){this.setSelected({type:'edgeRange',idx:i});this.setDrag({active:true,type:'rangeEnd',idx:i,path:rightSt,arc,tot});this.getCanvas().style.cursor='ew-resize';this.updateInfo();this.draw();return true}
}}return false};
// Helper to check merged range handles
const checkMergedHandles=()=>{
if(mergedPath.length>2&&this.getMergedEdgeRanges().length){
const mergedOffset=this.offsetPathStableClosed(mergedPath,-this.getCfg().stitchMargin);
if(mergedOffset.length>2){
const mergedArc=this.M.buildArcClosed(mergedOffset),mergedTot=mergedArc[mergedArc.length-1].d;
for(let i=0;i<this.getMergedEdgeRanges().length;i++){
const r=this.getMergedEdgeRanges()[i],sp=this.M.ptAtDist(mergedArc,mergedTot*r.start),ep=this.M.ptAtDist(mergedArc,mergedTot*r.end);
if(sp&&this.M.dist(w,sp)<18/this.getView().zoom){this.setSelected({type:'mergedEdgeRange',idx:i});this.setDrag({active:true,type:'mergedRangeStart',idx:i,path:mergedOffset,arc:mergedArc,tot:mergedTot});this.getCanvas().style.cursor='ew-resize';this.updateInfo();this.draw();return true}
if(ep&&this.M.dist(w,ep)<18/this.getView().zoom){this.setSelected({type:'mergedEdgeRange',idx:i});this.setDrag({active:true,type:'mergedRangeEnd',idx:i,path:mergedOffset,arc:mergedArc,tot:mergedTot});this.getCanvas().style.cursor='ew-resize';this.updateInfo();this.draw();return true}
}}}return false};
// Check based on current selection - prioritize the type that's already selected
if(this.getSelected()?.type==='edgeRange'){if(checkEdgeHandles())return;if(checkMergedHandles())return}
else if(this.getSelected()?.type==='mergedEdgeRange'){if(checkMergedHandles())return;if(checkEdgeHandles())return}
else{if(checkEdgeHandles())return;if(checkMergedHandles())return}
// Object selection
for(let i=this.getSymShapes().length-1;i>=0;i--){const s=this.getSymShapes()[i];
for(const side of[1,-1]){
const wShp=this.getSymShapeWorld(s,side);
// Handle linked circles
if(wShp.isLinkedCircle){const cd=this.getLinkedCircleData(wShp);if(cd){const d=this.M.dist(w,{x:wShp.x,y:wShp.y});if(d<cd.radius*(wShp.scaleX||1)+10){this.setSelected({type:'symShape',idx:i});this.updateInfo();this.draw();return}}}
else{
// Regular shape
const pts=wShp.points.map(p=>{const sc={x:p.x*(wShp.scaleX||1),y:p.y*(wShp.scaleY||1)};const r=this.M.rotate(sc,wShp.rotation||0);return{x:r.x+wShp.x,y:r.y+wShp.y}});
if(this.M.insidePoly(w,pts)){this.setSelected({type:'symShape',idx:i});this.updateInfo();this.draw();return}
}
}}
for(let i=this.getAsymShapes().length-1;i>=0;i--){const s=this.getAsymShapes()[i];
// Handle linked circles
if(s.isLinkedCircle){const cd=this.getLinkedCircleData(s);if(cd){const d=this.M.dist(w,{x:s.x,y:s.y});if(d<cd.radius*(s.scaleX||1)+10){this.setSelected({type:'asymShape',idx:i});this.updateInfo();this.draw();return}}continue}
// Regular shape
const pts=s.points.map(p=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=this.M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y}});if(this.M.insidePoly(w,pts)){this.setSelected({type:'asymShape',idx:i});this.updateInfo();this.draw();return}}
for(let i=this.getAsymHoles().length-1;i>=0;i--){if(this.M.insideShape(w,this.getAsymHoles()[i])){this.setSelected({type:'asymHole',idx:i});this.updateInfo();this.draw();return}}
for(let i=this.getAsymCustomHoles().length-1;i>=0;i--){const pts=this.getCustomHoleWorldAsym(this.getAsymCustomHoles()[i]);if(this.M.insidePoly(w,pts)){this.setSelected({type:'asymCustomHole',idx:i});this.updateInfo();this.draw();return}}
for(let i=this.getSymHoles().length-1;i>=0;i--){const hole=this.getSymHoles()[i];for(const side of[1,-1]){const wh=this.getSymHoleWorld(hole,side);if(this.M.insideShape(w,wh)){this.setSelected({type:'symHole',idx:i});this.updateInfo();this.draw();return}}}
for(let i=this.getSymCustomHoles().length-1;i>=0;i--){const h=this.getSymCustomHoles()[i];for(const side of[1,-1]){const pts=this.getCustomHoleWorld(h,side);if(this.M.insidePoly(w,pts)){this.setSelected({type:'symCustomHole',idx:i});this.updateInfo();this.draw();return}}}
// Stitch line selection
for(let i=this.getSymStitches().length-1;i>=0;i--){const sl=this.getSymStitches()[i];for(const side of[1,-1]){const pts=this.getSymStitchWorld(sl,side);const smp=this.M.sampleBezier(pts,30);if(this.M.ptOnBezier(smp,w,10/this.getView().zoom)){this.setSelected({type:'symStitch',idx:i});this.updateInfo();this.draw();return}}}
for(let i=this.getAsymStitches().length-1;i>=0;i--){const sl=this.getAsymStitches()[i];const smp=this.M.sampleBezier(sl.points,30);if(this.M.ptOnBezier(smp,w,10/this.getView().zoom)){this.setSelected({type:'asymStitch',idx:i});this.updateInfo();this.draw();return}}
// Text annotation selection
for(let i=this.getTextAnnotations().length-1;i>=0;i--){
const t=this.getTextAnnotations()[i];
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
this.getCtx().font=`${(line.style==='header'||line.style==='subheader')?'bold ':''}${fs/this.getView().zoom}px "Segoe UI", sans-serif`;
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
const tw=this.getCtx().measureText(textToShow).width;
const fh=fs*lineHeight;
const lineY=t.y+yOffset;
if(w.x>=t.x&&w.x<=t.x+tw+20&&w.y>=lineY&&w.y<=lineY+fh){
hitDetected=true;
}
yOffset+=fh;
});
if(hitDetected){
this.setSelected({type:'textAnnotation',idx:i});
if(!t.locked){this.setDrag({active:true,type:'textMove',idx:i,ox:w.x-t.x,oy:w.y-t.y})}
this.updateInfo();this.draw();return
}
}
if(!this.getHolster().locked){for(let i=0;i<this.getNodes().length;i++){const n=this.getNodes()[i],nw=this.M.holsterToWorld(n),h1w=this.M.holsterToWorld({x:n.x+n.h1.x,y:n.y+n.h1.y}),h2w=this.M.holsterToWorld({x:n.x+n.h2.x,y:n.y+n.h2.y});if(this.M.dist(w,nw)<12/this.getView().zoom){this.setDrag({active:true,type:'node',idx:i});this.setSelected({type:'node',idx:i});this.getCanvas().style.cursor='grabbing';this.updateInfo();this.draw();return}if(this.M.dist(w,h1w)<10/this.getView().zoom){this.setDrag({active:true,type:'h1',idx:i});this.setSelected(null);this.getCanvas().style.cursor='grabbing';this.updateInfo();this.draw();return}if(this.M.dist(w,h2w)<10/this.getView().zoom){this.setDrag({active:true,type:'h2',idx:i});this.setSelected(null);this.getCanvas().style.cursor='grabbing';this.updateInfo();this.draw();return}}}
const pat=this.getPatternPath();
if(this.M.insidePoly(w,pat)){this.setSelected({type:'holster'});this.updateInfo();this.draw();return}
// Check for click on reference image (to drag it)
if(this.getRefImage().img&&this.getCfg().showRefImage){
const rw=this.getRefImage().width*this.getRefImage().scale;
const rh=this.getRefImage().height*this.getRefImage().scale;
const rx=this.getRefImage().x-rw/2,ry=this.getRefImage().y-rh/2;
if(w.x>=rx&&w.x<=rx+rw&&w.y>=ry&&w.y<=ry+rh){
this.setSelected({type:'refImage'});
this.setDrag({active:true,type:'refImage',sx:w.x,sy:w.y,ox:this.getRefImage().x,oy:this.getRefImage().y});
this.updateInfo();this.draw();return;
}}
this.setSelected(null);this.updateInfo();this.draw()
}
onMove(e){const w=this.getWorld(e);
// Add hover detection when not dragging
if(!this.getDrag().active&&this.getMode()==='select'){
const prevHover=this.getHover();
this.setHover(null);
// Check nodes first (higher priority than bezier handles) - only when holster unlocked
if(!this.getHolster().locked){
for(let i=0;i<this.getNodes().length;i++){
const n=this.getNodes()[i];
const nw=this.M.holsterToWorld(n);
const h1w=this.M.holsterToWorld({x:n.x+n.h1.x,y:n.y+n.h1.y});
const h2w=this.M.holsterToWorld({x:n.x+n.h2.x,y:n.y+n.h2.y});
if(this.M.dist(w,nw)<this.getHoverTolerance().node/this.getView().zoom){this.setHover({type:'node',idx:i});break}
if(this.M.dist(w,h1w)<this.getHoverTolerance().handle/this.getView().zoom){this.setHover({type:'h1',idx:i});break}
if(this.M.dist(w,h2w)<this.getHoverTolerance().handle/this.getView().zoom){this.setHover({type:'h2',idx:i});break}
}
}
// Check edge range handles
if(!this.getHover()){
for(let ri=0;ri<this.getEdgeRanges().length;ri++){
const range=this.getEdgeRanges()[ri];
const rightHalf=this.getRightHalfPath();
const rightWorld=rightHalf.map(p=>this.M.holsterToWorld(p));
const arc=this.M.buildArc(rightWorld);
if(!arc||!arc.length)continue;
const arcLen=arc[arc.length-1].d;
const sd=range.start*arcLen,ed=range.end*arcLen;
const sp=this.M.ptAtDist(arc,sd),ep=this.M.ptAtDist(arc,ed);
if(sp&&this.M.dist(w,sp)<this.getHoverTolerance().range/this.getView().zoom){this.setHover({type:'rangeStart',idx:ri});break}
if(ep&&this.M.dist(w,ep)<this.getHoverTolerance().range/this.getView().zoom){this.setHover({type:'rangeEnd',idx:ri});break}
}
}
// Check gizmo handles if something is selected
if(!this.getHover()&&this.getSelected()){
let gizmo=null;
if(this.getSelected().type==='holster'&&!this.getHolster().locked){
gizmo=this.getGizmos(this.getHolster(),'holster');
}else if(this.getSelected().type==='asymShape'){
gizmo=this.getGizmos(this.getAsymShapes()[this.getSelected().idx],'asymShape');
}
if(gizmo){
for(const g of gizmo.handles){
if(this.M.dist(w,g)<this.getHoverTolerance().gizmo/this.getView().zoom){this.setHover({type:'gizmo',gizmoType:g.type});break}
}
}
}
// Check ghost layer hover in two-layer mode
if(!this.getHover()&&this.getCfg().projectType==='two-layer'&&this.getCfg().showGhostLayer){
const ghostState=this.getCurrentLayer()==='front'?this.getBackLayer():this.getFrontLayer();
if(ghostState){
const savedNODES=this.getNodes();
this.setNodes(ghostState.this.getNodes());
const ghostPat=this.getMergedPatternPath();
this.setNodes(savedNODES);
const ghostPatOffset=ghostPat.map(p=>({x:p.x+this.getGhostOffset().x,y:p.y+this.getGhostOffset().y}));
const threshold=10/this.getView().zoom;
for(let i=0;i<ghostPatOffset.length;i++){
const a=ghostPatOffset[i];
const b=ghostPatOffset[(i+1)%ghostPatOffset.length];
const sl=(b.x-a.x)**2+(b.y-a.y)**2;
if(sl===0)continue;
let t=((w.x-a.x)*(b.x-a.x)+(w.y-a.y)*(b.y-a.y))/sl;
t=Math.max(0,Math.min(1,t));
const pr={x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)};
if(this.M.dist(w,pr)<threshold){
this.setHover({type:'ghostLayer'});
break;
}
}
}
}
// Update cursor based on hover state
if(this.getHover()){
  if(this.getHover().type === 'node' || this.getHover().type === 'h1' || this.getHover().type === 'h2') {
    this.getCanvas().style.cursor = 'grab';
  } else if(this.getHover().type === 'gizmo') {
    if(this.getHover().gizmoType === 'rotate') {
      this.getCanvas().style.cursor = 'crosshair';
    } else if(this.getHover().gizmoType === 'scale' || this.getHover().gizmoType === 'scaleX' || this.getHover().gizmoType === 'scaleY') {
      this.getCanvas().style.cursor = 'nwse-resize';
    } else {
      this.getCanvas().style.cursor = 'move';
    }
  } else if(this.getHover().type === 'rangeStart' || this.getHover().type === 'rangeEnd') {
    this.getCanvas().style.cursor = 'ew-resize';
  } else if(this.getHover().type === 'ghostLayer') {
    this.getCanvas().style.cursor = 'move';
  } else {
    this.getCanvas().style.cursor = 'pointer';
  }
} else {
  this.getCanvas().style.cursor = 'default';
}
// Only redraw if hover state changed (performance optimization)
if(!this.M.hoverEq(prevHover,this.getHover())){
this.draw();
}
return;
}
if(!this.getDrag().active)return;e.preventDefault();
switch(this.getDrag().type){
case'publishPan':{
// Convert screen pixel delta to mm offset
const dx=(e.clientX-this.getDrag().sx)/this.getPublishView().scale;
const dy=(e.clientY-this.getDrag().sy)/this.getPublishView().scale;
(() => { const v = this.getPublishView(); v.x = this.getDrag().vx+dx; this.setPublishView(v); })();
(() => { const v = this.getPublishView(); v.y = this.getDrag().vy+dy; this.setPublishView(v); })();
break;
}
case'pan':(() => { const v = this.getView(); v.x = this.getDrag().vx+(e.clientX-this.getDrag().sx); this.setView(v); })();(() => { const v = this.getView(); v.y = this.getDrag().vy+(e.clientY-this.getDrag().sy); this.setView(v); })();break;
case'ghostLayer':{
// Update ghost offset with drag delta
const newOffsetX=this.getDrag().gox+(w.x-this.getDrag().sx);
const newOffsetY=this.getDrag().goy+(w.y-this.getDrag().sy);
// Snap to alignment when close to (0, 0) - within 10mm threshold
const snapThreshold=10;
if(Math.abs(newOffsetX)<snapThreshold&&Math.abs(newOffsetY)<snapThreshold){
(() => { const v = this.getGhostOffset(); v.x = 0; this.setGhostOffset(v); })();
(() => { const v = this.getGhostOffset(); v.y = 0; this.setGhostOffset(v); })();
// Show snap feedback
if(Math.abs(newOffsetX)>=snapThreshold-0.5||Math.abs(newOffsetY)>=snapThreshold-0.5){
this.showToast('✓ Snapped to alignment','success');
}
}else{
(() => { const v = this.getGhostOffset(); v.x = newOffsetX; this.setGhostOffset(v); })();
(() => { const v = this.getGhostOffset(); v.y = newOffsetY; this.setGhostOffset(v); })();
}
break;
}
case'refImage':this.getRefImage().x=this.getDrag().ox+(w.x-this.getDrag().sx);this.getRefImage().y=this.getDrag().oy+(w.y-this.getDrag().sy);break;
case'holsterGizmo':if(this.getDrag().gizmoType==='move'){const oldX=this.getHolster().x,oldY=this.getHolster().y;this.getHolster().x=this.getDrag().shx+(w.x-this.getDrag().sx);this.getHolster().y=this.getDrag().shy+(w.y-this.getDrag().sy);const dx=this.getHolster().x-oldX,dy=this.getHolster().y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('holster',0,dx,dy)}}else if(this.getDrag().gizmoType==='rotate'){this.getHolster().rotation=Math.atan2(w.y-this.getHolster().y,w.x-this.getHolster().x)+Math.PI/4}else{const ds=Math.hypot(this.getDrag().sx-this.getHolster().x,this.getDrag().sy-this.getHolster().y),dn=Math.hypot(w.x-this.getHolster().x,w.y-this.getHolster().y),sf=dn/ds;if(this.getShiftHeld()){const lw=this.M.worldToLocal(w,{x:this.getHolster().x,y:this.getHolster().y,rotation:this.getHolster().rotation,scaleX:1,scaleY:1}),b=this.M.getBounds(this.getPatternLocalPath());if(this.getDrag().gizmoType.includes('e')||this.getDrag().gizmoType.includes('w'))this.getHolster().scaleX=Math.max(.1,Math.abs(lw.x)/(b.w/2+20));if(this.getDrag().gizmoType.includes('n')||this.getDrag().gizmoType.includes('s'))this.getHolster().scaleY=Math.max(.1,Math.abs(lw.y)/(b.h/2+20))}else{this.getHolster().scaleX=Math.max(.1,this.getDrag().ssx*sf);this.getHolster().scaleY=Math.max(.1,this.getDrag().ssy*sf)}}this.updateInfo();break;
case'symHoleGizmo':{const hole=this.getSymHoles()[this.getDrag().idx],lw=this.M.worldToHolster(w);if(this.getDrag().gizmoType==='move'){const oldX=hole.x,oldY=hole.y;const s=this.snapLocal({x:Math.abs(lw.x),y:lw.y});hole.x=s.x;hole.y=s.y;const dx=hole.x-oldX,dy=hole.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('symHole',this.getDrag().idx,dx,dy)}}else if(this.getDrag().gizmoType==='rotate'){const wh=this.getSymHoleWorld(hole,1);hole.rotation=Math.atan2(w.y-wh.y,w.x-wh.x)-(this.getCfg().lockFoldLine?0:(this.getHolster().rotation||0))+Math.PI/4}else{const wh=this.getSymHoleWorld(hole,1),ds=Math.hypot(this.getDrag().sx-wh.x,this.getDrag().sy-wh.y),dn=Math.hypot(w.x-wh.x,w.y-wh.y),sf=dn/ds;if(this.getShiftHeld()){const rot=(this.getCfg().lockFoldLine?0:(this.getHolster().rotation||0))+(hole.rotation||0),lh=this.M.worldToLocal(w,{x:wh.x,y:wh.y,rotation:rot,scaleX:1,scaleY:1});if(this.getDrag().gizmoType.includes('e')||this.getDrag().gizmoType.includes('w'))hole.width=Math.max(1,Math.abs(lh.x)*2/this.getHolster().scaleX);if(this.getDrag().gizmoType.includes('n')||this.getDrag().gizmoType.includes('s'))hole.height=Math.max(1,Math.abs(lh.y)*2/this.getHolster().scaleY)}else{hole.width=Math.max(1,this.getDrag().sw*sf);hole.height=Math.max(1,this.getDrag().sh*sf)}}this.updateInfo();break}
case'asymHoleGizmo':{const hole=this.getAsymHoles()[this.getDrag().idx];if(this.getDrag().gizmoType==='move'){const oldX=hole.x,oldY=hole.y;const s=this.snapWorld(w);hole.x=s.x;hole.y=s.y;const dx=hole.x-oldX,dy=hole.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('asymHole',this.getDrag().idx,dx,dy)}}else if(this.getDrag().gizmoType==='rotate'){hole.rotation=Math.atan2(w.y-hole.y,w.x-hole.x)+Math.PI/4}else{const ds=Math.hypot(this.getDrag().sx-this.getDrag().shx,this.getDrag().sy-this.getDrag().shy),dn=Math.hypot(w.x-hole.x,w.y-hole.y),sf=dn/ds;if(this.getShiftHeld()){const lh=this.M.worldToLocal(w,{x:hole.x,y:hole.y,rotation:hole.rotation||0,scaleX:1,scaleY:1});if(this.getDrag().gizmoType.includes('e')||this.getDrag().gizmoType.includes('w'))hole.width=Math.max(1,Math.abs(lh.x)*2);if(this.getDrag().gizmoType.includes('n')||this.getDrag().gizmoType.includes('s'))hole.height=Math.max(1,Math.abs(lh.y)*2)}else{hole.width=Math.max(1,this.getDrag().sw*sf);hole.height=Math.max(1,this.getDrag().sh*sf)}}this.updateInfo();break}
case'asymShapeGizmo':{const s=this.getAsymShapes()[this.getDrag().idx];if(this.getDrag().gizmoType==='move'){const oldX=s.x,oldY=s.y;const sn=this.snapWorld(w);s.x=sn.x;s.y=sn.y;const dx=s.x-oldX,dy=s.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('asymShape',this.getDrag().idx,dx,dy)}}else if(this.getDrag().gizmoType==='rotate'){s.rotation=Math.atan2(w.y-s.y,w.x-s.x)+Math.PI/4}else{const ds=Math.hypot(this.getDrag().sx-this.getDrag().shx,this.getDrag().sy-this.getDrag().shy),dn=Math.hypot(w.x-s.x,w.y-s.y),sf=dn/ds;if(this.getShiftHeld()&&s.points){const ls=this.M.worldToLocal(w,{x:s.x,y:s.y,rotation:s.rotation||0,scaleX:1,scaleY:1}),b=this.M.getBounds(s.points);if(this.getDrag().gizmoType.includes('e')||this.getDrag().gizmoType.includes('w'))s.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(this.getDrag().gizmoType.includes('n')||this.getDrag().gizmoType.includes('s'))s.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{s.scaleX=Math.max(.1,this.getDrag().ssx*sf);s.scaleY=Math.max(.1,this.getDrag().ssy*sf)}}this.updateInfo();break}
case'asymShapeVertex':{const s=this.getAsymShapes()[this.getDrag().idx];
// Convert world coords to local shape coords
const localW=this.M.worldToLocal(w,{x:s.x,y:s.y,rotation:s.rotation||0,scaleX:s.scaleX||1,scaleY:s.scaleY||1});
s.points[this.getDrag().ptIdx].x=localW.x;
s.points[this.getDrag().ptIdx].y=localW.y;
break}
case'asymShapeH1':{const s=this.getAsymShapes()[this.getDrag().idx],p=s.points[this.getDrag().ptIdx];
const cpts=this.getShapeControlPts(s),cp=cpts[this.getDrag().ptIdx];
const dx=w.x-cp.x,dy=w.y-cp.y;
const rot=-(s.rotation||0);
const rd=this.M.rotate({x:dx,y:dy},rot);
p.h1={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};
break}
case'asymShapeH2':{const s=this.getAsymShapes()[this.getDrag().idx],p=s.points[this.getDrag().ptIdx];
const cpts=this.getShapeControlPts(s),cp=cpts[this.getDrag().ptIdx];
const dx=w.x-cp.x,dy=w.y-cp.y;
const rot=-(s.rotation||0);
const rd=this.M.rotate({x:dx,y:dy},rot);
p.h2={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};
break}
case'symShapeGizmo':{const s=this.getSymShapes()[this.getDrag().idx],lw=this.M.worldToHolster(w);if(this.getDrag().gizmoType==='move'){const oldX=s.x,oldY=s.y;const sn=this.snapLocal({x:Math.abs(lw.x),y:lw.y});s.x=sn.x;s.y=sn.y;const dx=s.x-oldX,dy=s.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('symShape',this.getDrag().idx,dx,dy)}}else if(this.getDrag().gizmoType==='rotate'){const wShp=this.getSymShapeWorld(s,1);s.rotation=Math.atan2(w.y-wShp.y,w.x-wShp.x)-(this.getHolster().rotation||0)+Math.PI/4}else{const wShp=this.getSymShapeWorld(s,1),ds=Math.hypot(this.getDrag().sx-wShp.x,this.getDrag().sy-wShp.y),dn=Math.hypot(w.x-wShp.x,w.y-wShp.y),sf=dn/ds;if(this.getShiftHeld()&&s.points){const ls=this.M.worldToLocal(w,{x:wShp.x,y:wShp.y,rotation:wShp.rotation||0,scaleX:1,scaleY:1}),b=this.M.getBounds(s.points);if(this.getDrag().gizmoType.includes('e')||this.getDrag().gizmoType.includes('w'))s.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(this.getDrag().gizmoType.includes('n')||this.getDrag().gizmoType.includes('s'))s.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{s.scaleX=Math.max(.1,this.getDrag().ssx*sf);s.scaleY=Math.max(.1,this.getDrag().ssy*sf)}}this.updateInfo();break}
case'symShapeVertex':{const s=this.getSymShapes()[this.getDrag().idx],lw=this.M.worldToHolster(w);const localW={x:Math.abs(lw.x),y:lw.y};s.points[this.getDrag().ptIdx].x=localW.x;s.points[this.getDrag().ptIdx].y=localW.y;break}
case'symShapeH1':{const s=this.getSymShapes()[this.getDrag().idx],p=s.points[this.getDrag().ptIdx];const wShp=this.getSymShapeWorld(s,1);const cpts=this.getShapeControlPts(wShp),cp=cpts[this.getDrag().ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(s.rotation||0)-(this.getHolster().rotation||0);const rd=this.M.rotate({x:dx/this.getHolster().scaleX,y:dy/this.getHolster().scaleY},rot);p.h1={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};break}
case'symShapeH2':{const s=this.getSymShapes()[this.getDrag().idx],p=s.points[this.getDrag().ptIdx];const wShp=this.getSymShapeWorld(s,1);const cpts=this.getShapeControlPts(wShp),cp=cpts[this.getDrag().ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(s.rotation||0)-(this.getHolster().rotation||0);const rd=this.M.rotate({x:dx/this.getHolster().scaleX,y:dy/this.getHolster().scaleY},rot);p.h2={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};break}
case'symCustomHoleGizmo':{const h=this.getSymCustomHoles()[this.getDrag().idx],lw=this.M.worldToHolster(w);if(this.getDrag().gizmoType==='move'){const oldX=h.x,oldY=h.y;const s=this.snapLocal({x:Math.abs(lw.x),y:lw.y});h.x=s.x;h.y=s.y;const dx=h.x-oldX,dy=h.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('symCustomHole',this.getDrag().idx,dx,dy)}}else if(this.getDrag().gizmoType==='rotate'){const pts=this.getCustomHoleWorld(h,1),b=this.M.getBounds(pts);h.rotation=Math.atan2(w.y-b.cy,w.x-b.cx)-(this.getHolster().rotation||0)+Math.PI/4}else{const pts=this.getCustomHoleWorld(h,1),b=this.M.getBounds(pts),ds=Math.hypot(this.getDrag().sx-b.cx,this.getDrag().sy-b.cy),dn=Math.hypot(w.x-b.cx,w.y-b.cy),sf=dn/ds;if(this.getShiftHeld()){const ls=this.M.worldToLocal(w,{x:b.cx,y:b.cy,rotation:(this.getHolster().rotation||0)+(h.rotation||0),scaleX:1,scaleY:1}),hb=this.M.getBounds(h.points);if(this.getDrag().gizmoType.includes('e')||this.getDrag().gizmoType.includes('w'))h.scaleX=Math.max(.1,Math.abs(ls.x)/(hb.w/2+10));if(this.getDrag().gizmoType.includes('n')||this.getDrag().gizmoType.includes('s'))h.scaleY=Math.max(.1,Math.abs(ls.y)/(hb.h/2+10))}else{h.scaleX=Math.max(.1,this.getDrag().ssx*sf);h.scaleY=Math.max(.1,this.getDrag().ssy*sf)}}this.updateInfo();break}
case'asymCustomHoleGizmo':{const h=this.getAsymCustomHoles()[this.getDrag().idx];if(this.getDrag().gizmoType==='move'){const oldX=h.x,oldY=h.y;const s=this.snapWorld(w);h.x=s.x;h.y=s.y;const dx=h.x-oldX,dy=h.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('asymCustomHole',this.getDrag().idx,dx,dy)}}else if(this.getDrag().gizmoType==='rotate'){h.rotation=Math.atan2(w.y-h.y,w.x-h.x)+Math.PI/4}else{const ds=Math.hypot(this.getDrag().sx-this.getDrag().shx,this.getDrag().sy-this.getDrag().shy),dn=Math.hypot(w.x-h.x,w.y-h.y),sf=dn/ds;if(this.getShiftHeld()){const ls=this.M.worldToLocal(w,{x:h.x,y:h.y,rotation:h.rotation||0,scaleX:1,scaleY:1}),b=this.M.getBounds(h.points);if(this.getDrag().gizmoType.includes('e')||this.getDrag().gizmoType.includes('w'))h.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(this.getDrag().gizmoType.includes('n')||this.getDrag().gizmoType.includes('s'))h.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{h.scaleX=Math.max(.1,this.getDrag().ssx*sf);h.scaleY=Math.max(.1,this.getDrag().ssy*sf)}}this.updateInfo();break}
case'symStitchPt':{const sl=this.getSymStitches()[this.getDrag().idx],lw=this.M.worldToHolster(w);const s=this.snapLocal({x:Math.abs(lw.x),y:lw.y});sl.points[this.getDrag().ptIdx].x=s.x;sl.points[this.getDrag().ptIdx].y=s.y;break}
case'asymStitchPt':{const sl=this.getAsymStitches()[this.getDrag().idx];const s=this.snapWorld(w);sl.points[this.getDrag().ptIdx].x=s.x;sl.points[this.getDrag().ptIdx].y=s.y;break}
case'symCustomHoleNode':{const h=this.getSymCustomHoles()[this.getDrag().idx],p=h.points[this.getDrag().ptIdx];const cpts=this.getCustomHoleControlPts(h,1),cp=cpts[this.getDrag().ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0)-(this.getHolster().rotation||0);const rd=this.M.rotate({x:dx/this.getHolster().scaleX,y:dy/this.getHolster().scaleY},rot);p.x+=rd.x/(h.scaleX||1);p.y+=rd.y/(h.scaleY||1);break}
case'symCustomHoleH1':{const h=this.getSymCustomHoles()[this.getDrag().idx],p=h.points[this.getDrag().ptIdx];const cpts=this.getCustomHoleControlPts(h,1),cp=cpts[this.getDrag().ptIdx];const dx=(w.x-cp.x)/this.getHolster().scaleX,dy=(w.y-cp.y)/this.getHolster().scaleY;const rot=-(h.rotation||0)-(this.getHolster().rotation||0);const rd=this.M.rotate({x:dx,y:dy},rot);p.h1={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'symCustomHoleH2':{const h=this.getSymCustomHoles()[this.getDrag().idx],p=h.points[this.getDrag().ptIdx];const cpts=this.getCustomHoleControlPts(h,1),cp=cpts[this.getDrag().ptIdx];const dx=(w.x-cp.x)/this.getHolster().scaleX,dy=(w.y-cp.y)/this.getHolster().scaleY;const rot=-(h.rotation||0)-(this.getHolster().rotation||0);const rd=this.M.rotate({x:dx,y:dy},rot);p.h2={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'asymCustomHoleNode':{const h=this.getAsymCustomHoles()[this.getDrag().idx],p=h.points[this.getDrag().ptIdx];const cpts=this.getCustomHoleControlPtsAsym(h),cp=cpts[this.getDrag().ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0);const rd=this.M.rotate({x:dx,y:dy},rot);p.x+=rd.x/(h.scaleX||1);p.y+=rd.y/(h.scaleY||1);break}
case'asymCustomHoleH1':{const h=this.getAsymCustomHoles()[this.getDrag().idx],p=h.points[this.getDrag().ptIdx];const cpts=this.getCustomHoleControlPtsAsym(h),cp=cpts[this.getDrag().ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0);const rd=this.M.rotate({x:dx,y:dy},rot);p.h1={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'asymCustomHoleH2':{const h=this.getAsymCustomHoles()[this.getDrag().idx],p=h.points[this.getDrag().ptIdx];const cpts=this.getCustomHoleControlPtsAsym(h),cp=cpts[this.getDrag().ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(h.rotation||0);const rd=this.M.rotate({x:dx,y:dy},rot);p.h2={x:rd.x/(h.scaleX||1),y:rd.y/(h.scaleY||1)};break}
case'rangeStart':this.getEdgeRanges()[this.getDrag().idx].start=Math.max(0,Math.min(this.getEdgeRanges()[this.getDrag().idx].end-.01,this.M.projectToPath(this.getDrag().path,this.getDrag().arc,w)));break;
case'rangeEnd':this.getEdgeRanges()[this.getDrag().idx].end=Math.max(this.getEdgeRanges()[this.getDrag().idx].start+.01,Math.min(1,this.M.projectToPath(this.getDrag().path,this.getDrag().arc,w)));break;
case'mergedRangeStart':this.getMergedEdgeRanges()[this.getDrag().idx].start=Math.max(0,Math.min(this.getMergedEdgeRanges()[this.getDrag().idx].end-.01,this.M.projectToPath(this.getDrag().path,this.getDrag().arc,w)));break;
case'mergedRangeEnd':this.getMergedEdgeRanges()[this.getDrag().idx].end=Math.max(this.getMergedEdgeRanges()[this.getDrag().idx].start+.01,Math.min(1,this.M.projectToPath(this.getDrag().path,this.getDrag().arc,w)));break;
case'textMove':{const t=this.getTextAnnotations()[this.getDrag().idx];const oldX=t.x,oldY=t.y;const s=this.snapWorld({x:w.x-this.getDrag().ox,y:w.y-this.getDrag().oy});t.x=s.x;t.y=s.y;const dx=t.x-oldX,dy=t.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('textAnnotation',this.getDrag().idx,dx,dy)}break}
case'textArrow':{const t=this.getTextAnnotations()[this.getDrag().idx];t.arrowTo={x:w.x,y:w.y};break}
case'node':{const lw=this.M.worldToHolster(w);const s=this.getCfg().asymmetricOutline?this.snapLocal({x:lw.x,y:lw.y}):this.snapLocal({x:Math.max(0,lw.x),y:lw.y});this.getNodes()[this.getDrag().idx].x=s.x;this.getNodes()[this.getDrag().idx].y=s.y;break}
case'h1':{const lw=this.M.worldToHolster(w);const n=this.getNodes()[this.getDrag().idx];n.h1={x:lw.x-n.x,y:lw.y-n.y};
// When dragging h1, update h2 if linked OR if Shift is held
if(n.linked||this.getShiftHeld()){n.h2={x:-n.h1.x,y:-n.h1.y}}
break}
case'h2':{const lw=this.M.worldToHolster(w);const n=this.getNodes()[this.getDrag().idx];n.h2={x:lw.x-n.x,y:lw.y-n.y};
// When dragging h2, update h1 if linked OR if Shift is held
if(n.linked||this.getShiftHeld()){n.h1={x:-n.h2.x,y:-n.h2.y}}
break}
}
this.draw();
}
onUp(){if(this.getDrag().active&&this.getDrag().type&&this.getDrag().type!=='publishPan'){this.saveState()}this.getDrag().active=false;if(this.getPublishMode()){this.getCanvas().style.cursor='grab'}else if(!this.getIsPanning()){this.getCanvas().style.cursor='default'}}
}
