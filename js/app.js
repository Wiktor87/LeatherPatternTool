// Main Application  
// Refactored from inline script in index.html

import { SCALE, CFG, HOVER_TOLERANCE, HOVER_SCALE, MAX_HISTORY } from './config.js';
import { M } from './math.js';
import { ToastManager } from './ui/ToastManager.js';
import { HistoryManager } from './state/HistoryManager.js';
import { FileManager } from './io/FileManager.js';
import { RefImageManager } from './io/RefImageManager.js';
import { OutlinerManager } from './ui/OutlinerManager.js';
import { ToolManager } from './tools/ToolManager.js';
import { LayerManager } from './layers/LayerManager.js';
import { PropertiesPanel } from './ui/PropertiesPanel.js';
import { PublishManager } from './publish/PublishManager.js';

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
let PUBLISH_VIEW={x:0,y:0,scale:1}; // Offset and scale for publish mode layout
let REF_IMAGE={img:null,x:0,y:0,scale:1,width:0,height:0,calibrating:false,calPt1:null,calPt2:null}; // Reference image state
let NODES=[{x:0,y:-180,h1:{x:0,y:0},h2:{x:45,y:0}},{x:70,y:-180,h1:{x:-20,y:0},h2:{x:20,y:20}},{x:90,y:-140,h1:{x:0,y:-20},h2:{x:0,y:30}},{x:70,y:-50,h1:{x:10,y:-25},h2:{x:-5,y:30}},{x:55,y:80,h1:{x:5,y:-30},h2:{x:-5,y:40}},{x:45,y:180,h1:{x:5,y:-35},h2:{x:-15,y:0}},{x:0,y:180,h1:{x:15,y:0},h2:{x:0,y:0}}];
let EDGE_RANGES=[{start:0,end:1}];
let MERGED_EDGE_RANGES=[]; // Ranges on full merged perimeter (including extensions)
let EDGE_STITCHES=[]; // New: stitches bound to edge ranges
let SYM_HOLES=[],SYM_STITCHES=[],SYM_SHAPES=[],ASYM_SHAPES=[],ASYM_HOLES=[],ASYM_STITCHES=[],SYM_CUSTOM_HOLES=[],ASYM_CUSTOM_HOLES=[],TEXT_ANNOTATIONS=[];

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
  constructor(){
    this.canvas = document.getElementById('c');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = devicePixelRatio || 1;
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    // Initialize history manager
    this.historyManager = new HistoryManager({
      maxHistory: MAX_HISTORY,
      onUpdate: () => this.updateUndoRedoButtons()
    });
    // Initialize file manager
    this.fileManager = new FileManager({
      getState: () => this.getProjectState(),
      setState: (project) => this.setProjectState(project),
      onLoad: () => {
        this.updateInfo();
        this.updateOutliner();
        this.draw();
        this.saveState();
        this.showToast('Project loaded!', 'success');
      },
      onSave: () => {
        this.showToast('Project saved!', 'success');
      },
      validateProject: (project) => {
        return project && project.NODES && project.HOLSTER;
      }
    });
    // Initialize reference image manager
    this.refImageManager = new RefImageManager({
      onUpdate: () => this.draw(),
      getDistance: (p1, p2) => M.dist(p1, p2),
      closeSettings: () => {
        if (this.settingsOpen) this.toggleSettings();
      }
    });
    // Initialize outliner manager
    this.outlinerManager = new OutlinerManager({
      getState: () => ({
        EDGE_RANGES,
        MERGED_EDGE_RANGES,
        SYM_HOLES,
        ASYM_HOLES,
        SYM_CUSTOM_HOLES,
        ASYM_CUSTOM_HOLES,
        EDGE_STITCHES,
        SYM_STITCHES,
        ASYM_STITCHES,
        SYM_SHAPES,
        ASYM_SHAPES,
        TEXT_ANNOTATIONS,
        CURRENT_LAYER
      }),
      getSelected: () => SELECTED,
      setSelected: (sel) => {
        SELECTED = sel;
        this.updateInfo();
      },
      getConfig: () => CFG,
      getHolster: () => HOLSTER,
      onUpdate: () => this.draw(),
      onSaveState: () => this.saveState(),
      showToast: (msg, type) => this.showToast(msg, type),
      closeSettings: () => {
        if (this.settingsOpen) this.toggleSettings();
      }
    });
    // Initialize tool manager
    this.toolManager = new ToolManager({
      getMode: () => MODE,
      setModeState: (m) => { MODE = m; },
      getLayer: () => LAYER,
      setLayer: (l) => this.setLayer(l),
      getTempStitch: () => TEMP_STITCH,
      setTempStitch: (s) => { TEMP_STITCH = s; },
      getTempShape: () => TEMP_SHAPE,
      setTempShape: (s) => { TEMP_SHAPE = s; },
      getTempCustomHole: () => TEMP_CUSTOMHOLE,
      setTempCustomHole: (h) => { TEMP_CUSTOMHOLE = h; },
      getCanvas: () => this.canvas,
      draw: () => this.draw(),
      finishStitch: () => this._finishStitch(),
      finishShape: () => this._finishShape(),
      finishCustomHole: () => this._finishCustomHole()
    });
    // Initialize layer manager
    this.layerManager = new LayerManager({
      getConfig: () => CFG,
      getCurrentLayer: () => CURRENT_LAYER,
      setCurrentLayer: (l) => { CURRENT_LAYER = l; },
      getFrontLayer: () => FRONT_LAYER,
      setFrontLayer: (l) => { FRONT_LAYER = l; },
      getBackLayer: () => BACK_LAYER,
      setBackLayer: (l) => { BACK_LAYER = l; },
      getGhostOffset: () => GHOST_OFFSET,
      setGhostOffset: (o) => { GHOST_OFFSET = o; },
      captureState: () => this.captureLayerState(),
      restoreState: (s) => this.restoreLayerState(s),
      getCanvas: () => this.canvas,
      draw: () => this.draw(),
      updateInfo: () => this.updateInfo(),
      updateOutliner: () => this.updateOutliner(),
      saveState: () => this.saveState(),
      showToast: (msg, type) => this.showToast(msg, type),
      clearSelection: () => { SELECTED = null; }
    });
    // Initialize properties panel
    this.propertiesPanel = new PropertiesPanel({
      getSelected: () => SELECTED,
      getConfig: () => CFG,
      getCurrentLayer: () => CURRENT_LAYER,
      getHolster: () => HOLSTER,
      getNodes: () => NODES,
      getSymHoles: () => SYM_HOLES,
      getAsymHoles: () => ASYM_HOLES,
      getSymCustomHoles: () => SYM_CUSTOM_HOLES,
      getAsymCustomHoles: () => ASYM_CUSTOM_HOLES,
      getSymShapes: () => SYM_SHAPES,
      getAsymShapes: () => ASYM_SHAPES,
      getSymStitches: () => SYM_STITCHES,
      getAsymStitches: () => ASYM_STITCHES,
      getEdgeStitches: () => EDGE_STITCHES,
      getEdgeRanges: () => EDGE_RANGES,
      getMergedEdgeRanges: () => MERGED_EDGE_RANGES,
      getTextAnnotations: () => TEXT_ANNOTATIONS,
      draw: () => this.draw(),
      saveState: () => this.saveState(),
      updateOutliner: () => this.updateOutliner()
    });
    // Initialize publish manager
    this.publishManager = new PublishManager({
      getCanvas: () => this.canvas,
      getCtx: () => this.ctx,
      getDpr: () => this.dpr,
      getConfig: () => CFG,
      getHolster: () => HOLSTER,
      getNodes: () => NODES,
      getCurrentLayer: () => CURRENT_LAYER,
      getFrontLayer: () => FRONT_LAYER,
      getBackLayer: () => BACK_LAYER,
      getEdgeRanges: () => EDGE_RANGES,
      getEdgeStitches: () => EDGE_STITCHES,
      getSymHoles: () => SYM_HOLES,
      getAsymHoles: () => ASYM_HOLES,
      getSymCustomHoles: () => SYM_CUSTOM_HOLES,
      getAsymCustomHoles: () => ASYM_CUSTOM_HOLES,
      getAsymShapes: () => ASYM_SHAPES,
      getTextAnnotations: () => TEXT_ANNOTATIONS,
      getMergedPatternPath: () => this.getMergedPatternPath(),
      getRightHalfPath: () => this.getRightHalfPath(),
      offsetPathStable: (path, delta) => this.offsetPathStable(path, delta),
      offsetPathStableClosed: (path, delta) => this.offsetPathStableClosed(path, delta),
      holsterToWorld: (p) => M.holsterToWorld(p),
      getSymHoleWorld: (hole, side) => this.getSymHoleWorld(hole, side),
      getCustomHoleWorld: (h, side) => this.getCustomHoleWorld(h, side),
      getCustomHoleWorldAsym: (h) => this.getCustomHoleWorldAsym(h),
      drawHole: (ctx, cx, cy, rot, w, h, shape) => this.drawHole(ctx, cx, cy, rot, w, h, shape),
      showToast: (msg, type) => this.showToast(msg, type),
      updateInfo: () => this.updateInfo(),
      resize: () => this.resize(),
      draw: () => this.draw(),
      getPublishMode: () => PUBLISH_MODE,
      setPublishMode: (val) => { PUBLISH_MODE = val; },
      getPublishView: () => PUBLISH_VIEW,
      setPublishView: (val) => { PUBLISH_VIEW = val; },
      getSelected: () => SELECTED,
      setSelected: (val) => { SELECTED = val; },
      getMath: () => M
    });
    this.init();
  }
init(){
this.setupEvents();
this.resize();
this.settingsOpen=false;
this.outlinerOpen=false;
// Initialize accordion UI
this.initAccordion();
// Initialize UI based on default project type
this.onProjectTypeChange(CFG.projectType);
this.saveState();
// Show onboarding for first-time users
if(window.OnboardingUI){
setTimeout(()=>window.OnboardingUI.show(),500);
}
}
showToast(message, type = 'info') {
  ToastManager.show(message, type);
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
    SYM_SHAPES:JSON.parse(JSON.stringify(SYM_SHAPES)),
    SYM_CUSTOM_HOLES:JSON.parse(JSON.stringify(SYM_CUSTOM_HOLES)),
    ASYM_HOLES:JSON.parse(JSON.stringify(ASYM_HOLES)),
    ASYM_STITCHES:JSON.parse(JSON.stringify(ASYM_STITCHES)),
    ASYM_CUSTOM_HOLES:JSON.parse(JSON.stringify(ASYM_CUSTOM_HOLES)),
    ASYM_SHAPES:JSON.parse(JSON.stringify(ASYM_SHAPES)),
    TEXT_ANNOTATIONS:JSON.parse(JSON.stringify(TEXT_ANNOTATIONS))
  };
  this.historyManager.saveState(state);
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
SYM_SHAPES=JSON.parse(JSON.stringify(state.SYM_SHAPES||[]));
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
  const prevState = this.historyManager.undo();
  if(prevState){
    this.restoreState(prevState);
    this.showToast('Undo', 'info');
  }
}
redo(){
  const nextState = this.historyManager.redo();
  if(nextState){
    this.restoreState(nextState);
    this.showToast('Redo', 'info');
  }
}
updateUndoRedoButtons(){
  document.getElementById('undo-btn').disabled = !this.historyManager.canUndo();
  document.getElementById('redo-btn').disabled = !this.historyManager.canRedo();
}
/**
 * Get current project state for saving
 * @returns {Object} Complete project state
 */
getProjectState() {
  const state = {
    NODES: NODES,
    HOLSTER: HOLSTER,
    EDGE_RANGES: EDGE_RANGES,
    MERGED_EDGE_RANGES: MERGED_EDGE_RANGES,
    EDGE_STITCHES: EDGE_STITCHES,
    SYM_HOLES: SYM_HOLES,
    SYM_STITCHES: SYM_STITCHES,
    SYM_SHAPES: SYM_SHAPES,
    SYM_CUSTOM_HOLES: SYM_CUSTOM_HOLES,
    ASYM_HOLES: ASYM_HOLES,
    ASYM_STITCHES: ASYM_STITCHES,
    ASYM_CUSTOM_HOLES: ASYM_CUSTOM_HOLES,
    ASYM_SHAPES: ASYM_SHAPES,
    TEXT_ANNOTATIONS: TEXT_ANNOTATIONS,
    CFG: CFG
  };
  // Add two-layer data if in two-layer mode
  if (CFG.projectType === 'two-layer') {
    // Save current layer before exporting
    if (CURRENT_LAYER === 'front') {
      FRONT_LAYER = this.captureLayerState();
    } else {
      BACK_LAYER = this.captureLayerState();
    }
    state.CURRENT_LAYER = CURRENT_LAYER;
    state.FRONT_LAYER = FRONT_LAYER;
    state.BACK_LAYER = BACK_LAYER;
    state.GHOST_OFFSET = GHOST_OFFSET;
  }
  return state;
}
/**
 * Set project state from loaded data
 * @param {Object} project - Project data to load
 */
setProjectState(project) {
  // Restore state
  NODES = project.NODES;
  HOLSTER.x = project.HOLSTER.x || 0;
  HOLSTER.y = project.HOLSTER.y || 0;
  HOLSTER.rotation = project.HOLSTER.rotation || 0;
  HOLSTER.scaleX = project.HOLSTER.scaleX || 1;
  HOLSTER.scaleY = project.HOLSTER.scaleY || 1;
  HOLSTER.locked = project.HOLSTER.locked || false;
  EDGE_RANGES = project.EDGE_RANGES || [{start: 0, end: 1}];
  MERGED_EDGE_RANGES = project.MERGED_EDGE_RANGES || [];
  EDGE_STITCHES = project.EDGE_STITCHES || [];
  SYM_HOLES = project.SYM_HOLES || [];
  SYM_STITCHES = project.SYM_STITCHES || [];
  SYM_SHAPES = project.SYM_SHAPES || [];
  SYM_CUSTOM_HOLES = project.SYM_CUSTOM_HOLES || [];
  ASYM_HOLES = project.ASYM_HOLES || [];
  ASYM_STITCHES = project.ASYM_STITCHES || [];
  ASYM_CUSTOM_HOLES = project.ASYM_CUSTOM_HOLES || [];
  ASYM_SHAPES = project.ASYM_SHAPES || [];
  TEXT_ANNOTATIONS = project.TEXT_ANNOTATIONS || [];
  
  // Restore CFG if present
  if (project.CFG) {
    Object.keys(project.CFG).forEach(k => {
      if (CFG.hasOwnProperty(k)) CFG[k] = project.CFG[k];
    });
  }
  
  // Load two-layer data if present
  if (project.FRONT_LAYER && project.BACK_LAYER) {
    FRONT_LAYER = project.FRONT_LAYER;
    BACK_LAYER = project.BACK_LAYER;
    CURRENT_LAYER = project.CURRENT_LAYER || 'front';
    GHOST_OFFSET = project.GHOST_OFFSET || {x: 0, y: 0};
    // Restore the current layer
    const targetState = CURRENT_LAYER === 'front' ? FRONT_LAYER : BACK_LAYER;
    this.restoreLayerState(targetState);
    // Update project type in UI
    document.getElementById('cfg-projectType').value = 'two-layer';
    this.onProjectTypeChange('two-layer');
  } else {
    // Legacy file or fold-over mode
    FRONT_LAYER = null;
    BACK_LAYER = null;
    CURRENT_LAYER = 'front';
    GHOST_OFFSET = {x: 0, y: 0};
    // Ensure project type is set to fold-over
    if (!project.CFG || !project.CFG.projectType) {
      CFG.projectType = 'fold-over';
      document.getElementById('cfg-projectType').value = 'fold-over';
      this.onProjectTypeChange('fold-over');
    }
  }
  
  // Update pattern title
  if (project.name) {
    document.getElementById('project-title').textContent = project.name;
    const titleInput = document.getElementById('pattern-title');
    if (titleInput) titleInput.value = project.name;
    // Sync UI checkboxes with loaded CFG values
    document.getElementById('cfg-asymmetricOutline').checked = CFG.asymmetricOutline || false;
    document.getElementById('cfg-syncOutline').checked = CFG.syncOutline !== false;
    document.getElementById('cfg-syncEdgeStitches').checked = CFG.syncEdgeStitches !== false;
  }
  
  SELECTED = null;
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
saveProject() {
  document.getElementById('file-menu').classList.remove('open');
  const projectName = document.getElementById('project-title').textContent || 'Leather Pattern';
  this.fileManager.saveProject(projectName);
}
loadProject() {
  document.getElementById('file-menu').classList.remove('open');
  this.fileManager.triggerFileInput('file-input');
}
async handleFileLoad(e) {
  try {
    await this.fileManager.handleFileLoad(e);
  } catch (error) {
    alert('Error loading project: ' + error.message);
    this.showToast('Error loading project', 'error');
  }
}
toggleSettings(){
this.settingsOpen=!this.settingsOpen;
document.getElementById('settings-panel').classList.toggle('open',this.settingsOpen);
document.getElementById('settings-btn').style.display=this.settingsOpen?'none':'flex';
if(this.settingsOpen&&this.outlinerOpen)this.toggleOutliner();
}
saveAccordionState(section,expanded){
// Save accordion state to localStorage
try{
const state=JSON.parse(localStorage.getItem('accordionState')||'{}');
state[section]=expanded;
localStorage.setItem('accordionState',JSON.stringify(state));
}catch(e){console.warn('Could not save accordion state',e)}
}
loadAccordionState(){
// Load saved accordion state from localStorage
try{
return JSON.parse(localStorage.getItem('accordionState')||'{}');
}catch(e){console.warn('Could not load accordion state',e);return{}}
}
toggleAccordion(section){
// Toggle accordion section
const sectionEl=document.querySelector(`.accordion-section[data-section="${section}"]`);
if(!sectionEl)return;
const wasExpanded=sectionEl.classList.contains('expanded');
sectionEl.classList.toggle('expanded');
// Save state
this.saveAccordionState(section,!wasExpanded);
}
initAccordion(){
// Load saved accordion state and apply to sections
const state=this.loadAccordionState();
document.querySelectorAll('.accordion-section').forEach(section=>{
const sectionName=section.getAttribute('data-section');
if(state[sectionName]!==undefined){
section.classList.toggle('expanded',state[sectionName]);
}
});
}
loadRefImage(e) { this.refImageManager.loadRefImage(e); REF_IMAGE = this.refImageManager.getState(); }
updateRefScale(val) { this.refImageManager.updateRefScale(val); REF_IMAGE = this.refImageManager.getState(); }
clearRefImage() { this.refImageManager.clearRefImage(); REF_IMAGE = this.refImageManager.getState(); }
startCalibration() { this.refImageManager.startCalibration(); REF_IMAGE = this.refImageManager.getState(); }
handleCalibrationClick(w) { this.refImageManager.handleCalibrationClick(w); REF_IMAGE = this.refImageManager.getState(); }
cancelCalibration() { this.refImageManager.cancelCalibration(); REF_IMAGE = this.refImageManager.getState(); }
applyCalibration() { this.refImageManager.applyCalibration(); REF_IMAGE = this.refImageManager.getState(); }
toggleOutliner() { this.outlinerManager.toggleOutliner(); this.outlinerOpen = this.outlinerManager.isOpen; }
updateOutliner() { this.outlinerManager.updateOutliner(); }
toggleItemVis(type, idx) { this.outlinerManager.toggleItemVis(type, idx); }
toggleItemLock(type, idx) { this.outlinerManager.toggleItemLock(type, idx); }
getItemByTypeIdx(type, idx) { return this.outlinerManager.getItemByTypeIdx(type, idx); }
outlinerDragStart(e) { this.outlinerManager.outlinerDragStart(e); }
outlinerDragOver(e) { this.outlinerManager.outlinerDragOver(e); }
outlinerDrop(e, targetType, targetIdx) { this.outlinerManager.outlinerDrop(e, targetType, targetIdx); }
isDescendantOf(checkType, checkIdx, ancestorType, ancestorIdx) { return this.outlinerManager.isDescendantOf(checkType, checkIdx, ancestorType, ancestorIdx); }
renameItem(type, idx) { this.outlinerManager.renameItem(type, idx); }
selectOutlinerItem(type, idx) { this.outlinerManager.selectOutlinerItem(type, idx); }
getObjByTypeIdx(type, idx) { return this.outlinerManager.getObjByTypeIdx(type, idx); }
propagateTransformToChildren(parentType, parentIdx, dx, dy) {
  // Move all children by the same delta as the parent
  const allArrays = [
    {type: 'symHole', arr: SYM_HOLES}, {type: 'asymHole', arr: ASYM_HOLES},
    {type: 'symStitch', arr: SYM_STITCHES}, {type: 'asymStitch', arr: ASYM_STITCHES},
    {type: 'symCustomHole', arr: SYM_CUSTOM_HOLES}, {type: 'asymCustomHole', arr: ASYM_CUSTOM_HOLES},
    {type: 'symShape', arr: SYM_SHAPES}, {type: 'asymShape', arr: ASYM_SHAPES}, {type: 'textAnnotation', arr: TEXT_ANNOTATIONS},
    {type: 'edgeRange', arr: EDGE_RANGES}, {type: 'edgeStitch', arr: EDGE_STITCHES},
    {type: 'mergedEdgeRange', arr: MERGED_EDGE_RANGES}
  ];
  allArrays.forEach(({type, arr}) => {
    arr.forEach((obj, idx) => {
      if (obj.parent && obj.parent.type === parentType && obj.parent.idx === parentIdx) {
        // Apply transformation to this child
        if (obj.x !== undefined) { obj.x += dx }
        if (obj.y !== undefined) { obj.y += dy }
        // Recursively propagate to grandchildren
        this.propagateTransformToChildren(type, idx, dx, dy);
      }
    });
  });
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
applyPreset(presetName){
const presets={
holster:{thickness:3,stitchMargin:5,stitchSpacing:4,holeSize:1.5,projectType:'fold-over'},
wallet:{thickness:1.5,stitchMargin:3,stitchSpacing:3,holeSize:1.2,projectType:'two-layer'},
belt:{thickness:4,stitchMargin:6,stitchSpacing:5,holeSize:2,projectType:'fold-over'}
};
const preset=presets[presetName];
if(!preset){console.warn('Unknown preset:',presetName);return}
// Apply preset values
Object.entries(preset).forEach(([key,val])=>{
this.updateCfg(key,val);
// Update UI elements
const el=document.getElementById('cfg-'+key);
if(el){
if(el.type==='checkbox')el.checked=val;
else el.value=val;
}
});
this.showToast(`Applied ${presetName} preset`,'success');
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
onProjectTypeChange(type) { this.layerManager.onProjectTypeChange(type); }
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

initializeLayers() { this.layerManager.initializeLayers(); }
captureLayerState() {
  return {
    NODES: JSON.parse(JSON.stringify(NODES)),
    EDGE_RANGES: JSON.parse(JSON.stringify(EDGE_RANGES)),
    MERGED_EDGE_RANGES: JSON.parse(JSON.stringify(MERGED_EDGE_RANGES)),
    EDGE_STITCHES: JSON.parse(JSON.stringify(EDGE_STITCHES)),
    SYM_HOLES: JSON.parse(JSON.stringify(SYM_HOLES)),
    SYM_STITCHES: JSON.parse(JSON.stringify(SYM_STITCHES)),
    SYM_SHAPES: JSON.parse(JSON.stringify(SYM_SHAPES)),
    SYM_CUSTOM_HOLES: JSON.parse(JSON.stringify(SYM_CUSTOM_HOLES)),
    ASYM_HOLES: JSON.parse(JSON.stringify(ASYM_HOLES)),
    ASYM_STITCHES: JSON.parse(JSON.stringify(ASYM_STITCHES)),
    ASYM_CUSTOM_HOLES: JSON.parse(JSON.stringify(ASYM_CUSTOM_HOLES)),
    ASYM_SHAPES: JSON.parse(JSON.stringify(ASYM_SHAPES)),
    TEXT_ANNOTATIONS: JSON.parse(JSON.stringify(TEXT_ANNOTATIONS))
  };
}

restoreLayerState(state) {
  NODES = JSON.parse(JSON.stringify(state.NODES));
  EDGE_RANGES = JSON.parse(JSON.stringify(state.EDGE_RANGES));
  MERGED_EDGE_RANGES = JSON.parse(JSON.stringify(state.MERGED_EDGE_RANGES));
  EDGE_STITCHES = JSON.parse(JSON.stringify(state.EDGE_STITCHES));
  SYM_HOLES = JSON.parse(JSON.stringify(state.SYM_HOLES));
  SYM_STITCHES = JSON.parse(JSON.stringify(state.SYM_STITCHES));
  SYM_SHAPES = JSON.parse(JSON.stringify(state.SYM_SHAPES || []));
  SYM_CUSTOM_HOLES = JSON.parse(JSON.stringify(state.SYM_CUSTOM_HOLES));
  ASYM_HOLES = JSON.parse(JSON.stringify(state.ASYM_HOLES));
  ASYM_STITCHES = JSON.parse(JSON.stringify(state.ASYM_STITCHES));
  ASYM_CUSTOM_HOLES = JSON.parse(JSON.stringify(state.ASYM_CUSTOM_HOLES));
  ASYM_SHAPES = JSON.parse(JSON.stringify(state.ASYM_SHAPES));
  TEXT_ANNOTATIONS = JSON.parse(JSON.stringify(state.TEXT_ANNOTATIONS));
}

switchLayer(layer) { this.layerManager.switchLayer(layer); }
updateLayerUI() { this.layerManager.updateLayerUI(); }
duplicateLayer(direction) { this.layerManager.duplicateLayer(direction); }
resetToMaster() { this.layerManager.resetToMaster(); }
resetGhostPosition() { this.layerManager.resetGhostPosition(); }
// Sync functions for two-layer mode
syncOutlineToBack() { this.layerManager.syncOutlineToBack(); }
syncEdgeStitchesToBack() { this.layerManager.syncEdgeStitchesToBack(); }

selectHolster() {SELECTED={type:'holster'};this.updateInfo();this.draw()}
setMode(m) {
  this.toolManager.setMode(m);
}

_finishStitch() {
  if (!TEMP_STITCH || TEMP_STITCH.points.length < 2) return;
  
  const ns = {
    points: TEMP_STITCH.points.map(p => ({
      x: p.x,
      y: p.y,
      h1: { x: 0, y: 0 },
      h2: { x: 0, y: 0 }
    })),
    spacing: 4
  };
  this.smoothHandles(ns.points);
  
  if (LAYER === 'asymmetric') {
    ASYM_STITCHES.push(ns);
  } else {
    ns.points = ns.points.map(p => {
      const lp = M.worldToHolster(p);
      return {
        x: Math.abs(lp.x),
        y: lp.y,
        h1: p.h1,
        h2: p.h2
      };
    });
    SYM_STITCHES.push(ns);
  }
  
  TEMP_STITCH = null;
  this.saveState();
}

_finishShape() {
  if (!TEMP_SHAPE || TEMP_SHAPE.points.length < 3) return;
  
  const b = M.getBounds(TEMP_SHAPE.points);
  const pts = TEMP_SHAPE.points.map(p => ({
    x: p.x - b.cx,
    y: p.y - b.cy,
    h1: { x: 0, y: 0 },
    h2: { x: 0, y: 0 }
  }));
  this.smoothHandlesClosed(pts);
  
  ASYM_SHAPES.push({
    points: pts,
    x: b.cx,
    y: b.cy,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    stitchBorder: false,
    stitchMargin: 3,
    stitchSpacing: 3
  });
  
  TEMP_SHAPE = null;
  this.saveState();
}

_finishCustomHole() {
  if (!TEMP_CUSTOMHOLE || TEMP_CUSTOMHOLE.points.length < 3) return;
  
  const b = M.getBounds(TEMP_CUSTOMHOLE.points);
  const pts = TEMP_CUSTOMHOLE.points.map(p => ({
    x: p.x - b.cx,
    y: p.y - b.cy,
    h1: { x: 0, y: 0 },
    h2: { x: 0, y: 0 }
  }));
  this.smoothHandlesClosed(pts);
  
  if (LAYER === 'asymmetric') {
    ASYM_CUSTOM_HOLES.push({
      points: pts,
      x: b.cx,
      y: b.cy,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      stitchBorder: false,
      stitchMargin: 3,
      stitchSpacing: 3
    });
  } else {
    const lc = M.worldToHolster({ x: b.cx, y: b.cy });
    const localPts = pts.map(p => {
      const wp = { x: p.x + b.cx, y: p.y + b.cy };
      const lp = M.worldToHolster(wp);
      return {
        x: lp.x - lc.x,
        y: lp.y - lc.y,
        h1: { x: p.h1.x / HOLSTER.scaleX, y: p.h1.y / HOLSTER.scaleY },
        h2: { x: p.h2.x / HOLSTER.scaleX, y: p.h2.y / HOLSTER.scaleY }
      };
    });
    SYM_CUSTOM_HOLES.push({
      points: localPts,
      x: Math.abs(lc.x),
      y: lc.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      stitchBorder: false,
      stitchMargin: 3,
      stitchSpacing: 3
    });
  }
  
  TEMP_CUSTOMHOLE = null;
  this.saveState();
}

finishMode() {
  this.toolManager.finishMode();
}

smoothHandles(pts) {
  if (pts.length < 2) return;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    if (p && n) {
      const dx = n.x - p.x, dy = n.y - p.y, len = Math.hypot(dx, dy) * .25, ang = Math.atan2(dy, dx);
      c.h1 = { x: -Math.cos(ang) * len, y: -Math.sin(ang) * len };
      c.h2 = { x: Math.cos(ang) * len, y: Math.sin(ang) * len };
    } else if (n) {
      c.h2 = { x: (n.x - c.x) * .25, y: (n.y - c.y) * .25 };
      c.h1 = { x: 0, y: 0 };
    } else if (p) {
      c.h1 = { x: -(c.x - p.x) * .25, y: -(c.y - p.y) * .25 };
      c.h2 = { x: 0, y: 0 };
    }
  }
}

smoothHandlesClosed(pts) {
  if (pts.length < 3) return;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[(i - 1 + pts.length) % pts.length], c = pts[i], n = pts[(i + 1) % pts.length];
    const dx = n.x - p.x, dy = n.y - p.y, len = Math.hypot(dx, dy) * .25, ang = Math.atan2(dy, dx);
    c.h1 = { x: -Math.cos(ang) * len, y: -Math.sin(ang) * len };
    c.h2 = { x: Math.cos(ang) * len, y: Math.sin(ang) * len };
  }
}

cancelMode() {
  this.toolManager.cancelMode();
}
addEdgeRange(){EDGE_RANGES.push({start:0.1,end:0.9});SELECTED={type:'edgeRange',idx:EDGE_RANGES.length-1};this.updateInfo();this.draw();this.saveState()}
addMergedEdgeRange(){MERGED_EDGE_RANGES.push({start:0.1,end:0.9});SELECTED={type:'mergedEdgeRange',idx:MERGED_EDGE_RANGES.length-1};this.updateInfo();this.draw();this.saveState()}
generateMatchingCircle(){
try{
// Check if EDGE_RANGES exists and is not empty
if(!EDGE_RANGES||EDGE_RANGES.length===0){
console.warn('No edge ranges defined');
if(window.ErrorHandler){
window.ErrorHandler.handle(new Error('No edge ranges'), 'generateMatchingCircle', 'Could not create circle from edge. Please add an edge range first.');
}else{
this.showToast('Could not create circle from edge. Please add an edge range first.', 'error');
}
return;
}
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
this.saveState();
}catch(e){
console.error('generateMatchingCircle error:',e);
if(window.ErrorHandler){
window.ErrorHandler.handle(e,'generateMatchingCircle');
}
}
}
getLinkedCircleData(shape){
try{
// Check if EDGE_RANGES exists and is not empty
if(!EDGE_RANGES||EDGE_RANGES.length===0){
console.warn('No edge ranges defined');
return null;
}
const rightHalf=this.getRightHalfPath();
const rightWorld=rightHalf.map(p=>M.holsterToWorld(p));
if(rightWorld.length<3)return null;
// Use base (unoffset) path for stable percentage mapping
const baseArc=M.buildArc(rightWorld);
const baseTot=baseArc[baseArc.length-1].d;
if(baseTot<=0)return null;
// Safely get edge range with bounds checking
const rng=EDGE_RANGES[shape.sourceRangeIdx];
if(!rng){
console.warn(`Edge range ${shape.sourceRangeIdx} not found`);
return null;
}
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
deleteSelected(){if(!SELECTED)return;if(SELECTED.type==='symHole')SYM_HOLES.splice(SELECTED.idx,1);else if(SELECTED.type==='symStitch')SYM_STITCHES.splice(SELECTED.idx,1);else if(SELECTED.type==='symCustomHole')SYM_CUSTOM_HOLES.splice(SELECTED.idx,1);else if(SELECTED.type==='symShape')SYM_SHAPES.splice(SELECTED.idx,1);else if(SELECTED.type==='asymShape')ASYM_SHAPES.splice(SELECTED.idx,1);else if(SELECTED.type==='asymHole')ASYM_HOLES.splice(SELECTED.idx,1);else if(SELECTED.type==='asymStitch')ASYM_STITCHES.splice(SELECTED.idx,1);else if(SELECTED.type==='asymCustomHole')ASYM_CUSTOM_HOLES.splice(SELECTED.idx,1);else if(SELECTED.type==='textAnnotation')TEXT_ANNOTATIONS.splice(SELECTED.idx,1);else if(SELECTED.type==='edgeRange'&&EDGE_RANGES.length>1)EDGE_RANGES.splice(SELECTED.idx,1);else if(SELECTED.type==='mergedEdgeRange')MERGED_EDGE_RANGES.splice(SELECTED.idx,1);else if(SELECTED.type==='edgeStitch')EDGE_STITCHES.splice(SELECTED.idx,1);SELECTED=null;this.updateInfo();this.updateOutliner();this.draw();this.saveState();this.showToast('Deleted', 'info')}
changeHoleShape(s) { this.propertiesPanel.changeHoleShape(s); this.updateInfo(); }
changeHoleWidth(v) { this.propertiesPanel.changeHoleWidth(v); }
changeHoleHeight(v) { this.propertiesPanel.changeHoleHeight(v); }
toggleStitchBorder(v) { this.propertiesPanel.toggleStitchBorder(v); this.updateInfo(); }
changeStitchMargin(v) { this.propertiesPanel.changeStitchMargin(v); }
changeStitchSpacing(v) { this.propertiesPanel.changeStitchSpacing(v); }
// Text editing functions
startTextEdit(idx){
const t=TEXT_ANNOTATIONS[idx];
const ed=document.getElementById('inline-text-editor');
// Position editor at text screen location
const sx=VIEW.x+t.x*VIEW.zoom;
const sy=VIEW.y+t.y*VIEW.zoom;
ed.style.left=sx+'px';
ed.style.top=sy+'px';
// Apply text styling
ed.style.fontSize=(t.fontSize||12)+'px';
ed.style.fontWeight=t.bold?'bold':'normal';
ed.style.fontStyle=t.italic?'italic':'normal';
// Set content
ed.textContent=t.text||'';
ed.style.display='block';
ed.focus();
// Select all text for easy editing
const range=document.createRange();
range.selectNodeContents(ed);
const sel=window.getSelection();
sel.removeAllRanges();
sel.addRange(range);
this.editingTextIdx=idx;
// Handle Enter and Escape keys
const keyHandler=(e)=>{
if(e.key==='Enter'&&!e.shiftKey){
e.preventDefault();
this.stopTextEdit(true);
ed.removeEventListener('keydown',keyHandler);
}else if(e.key==='Escape'){
e.preventDefault();
this.stopTextEdit(false);
ed.removeEventListener('keydown',keyHandler);
}
};
ed.addEventListener('keydown',keyHandler);
// Handle click outside to finish editing
const clickHandler=(e)=>{
if(!ed.contains(e.target)){
this.stopTextEdit(true);
document.removeEventListener('click',clickHandler);
ed.removeEventListener('keydown',keyHandler);
}
};
setTimeout(()=>document.addEventListener('click',clickHandler),100);
this.draw();
}
stopTextEdit(apply=true){
const ed=document.getElementById('inline-text-editor');
ed.style.display='none';
if(this.editingTextIdx!==undefined&&apply){
const t=TEXT_ANNOTATIONS[this.editingTextIdx];
const textContent=ed.textContent.trim();
t.text=textContent;
// Remove empty text annotations
if(!textContent){
TEXT_ANNOTATIONS.splice(this.editingTextIdx,1);
SELECTED=null;
}
this.saveState();
}
this.editingTextIdx=undefined;
this.setMode('select');
this.updateInfo();
this.draw();
}
changeText(v) { this.propertiesPanel.changeText(v); }
changeFontSize(v) { this.propertiesPanel.changeFontSize(v); }
toggleBold() { this.propertiesPanel.toggleBold(); }
toggleItalic() { this.propertiesPanel.toggleItalic(); }
changeTextStyle(style) { this.propertiesPanel.changeTextStyle(style); this.updateInfo(); }
changeListType(listType) { this.propertiesPanel.changeListType(listType); this.updateInfo(); }
toggleMirror(checked){
// Toggle between mirrored (symmetric) and single (asymmetric) elements
if(!SELECTED)return;
const type=SELECTED.type;
const idx=SELECTED.idx;
if(type==='symHole'){
// Convert symmetric hole to asymmetric
const hole=SYM_HOLES[idx];
const newHole={
x:M.holsterToWorld({x:hole.x,y:hole.y}).x,
y:M.holsterToWorld({x:hole.x,y:hole.y}).y,
width:hole.width*HOLSTER.scaleX,
height:hole.height*HOLSTER.scaleY,
rotation:(HOLSTER.rotation||0)+(hole.rotation||0),
shape:hole.shape,
stitchBorder:hole.stitchBorder,
stitchMargin:hole.stitchMargin,
stitchSpacing:hole.stitchSpacing,
name:hole.name
};
SYM_HOLES.splice(idx,1);
ASYM_HOLES.push(newHole);
SELECTED={type:'asymHole',idx:ASYM_HOLES.length-1};
}else if(type==='asymHole'){
// Convert asymmetric hole to symmetric
const hole=ASYM_HOLES[idx];
const localPos=M.worldToHolster({x:hole.x,y:hole.y});
const scaleX=Math.max(0.01,HOLSTER.scaleX);
const scaleY=Math.max(0.01,HOLSTER.scaleY);
const newHole={
x:Math.abs(localPos.x),
y:localPos.y,
width:hole.width/scaleX,
height:hole.height/scaleY,
rotation:(hole.rotation||0)-(HOLSTER.rotation||0),
shape:hole.shape,
stitchBorder:hole.stitchBorder,
stitchMargin:hole.stitchMargin,
stitchSpacing:hole.stitchSpacing,
name:hole.name
};
ASYM_HOLES.splice(idx,1);
SYM_HOLES.push(newHole);
SELECTED={type:'symHole',idx:SYM_HOLES.length-1};
}else if(type==='symCustomHole'){
// Convert symmetric custom hole to asymmetric
const hole=SYM_CUSTOM_HOLES[idx];
const worldPos=M.holsterToWorld({x:hole.x,y:hole.y});
const newHole={
x:worldPos.x,
y:worldPos.y,
points:JSON.parse(JSON.stringify(hole.points)),
scaleX:(hole.scaleX||1)*HOLSTER.scaleX,
scaleY:(hole.scaleY||1)*HOLSTER.scaleY,
rotation:(HOLSTER.rotation||0)+(hole.rotation||0),
stitchBorder:hole.stitchBorder,
stitchMargin:hole.stitchMargin,
stitchSpacing:hole.stitchSpacing,
name:hole.name
};
SYM_CUSTOM_HOLES.splice(idx,1);
ASYM_CUSTOM_HOLES.push(newHole);
SELECTED={type:'asymCustomHole',idx:ASYM_CUSTOM_HOLES.length-1};
}else if(type==='asymCustomHole'){
// Convert asymmetric custom hole to symmetric
const hole=ASYM_CUSTOM_HOLES[idx];
const localPos=M.worldToHolster({x:hole.x,y:hole.y});
const scaleX=Math.max(0.01,HOLSTER.scaleX);
const scaleY=Math.max(0.01,HOLSTER.scaleY);
const newHole={
x:Math.abs(localPos.x),
y:localPos.y,
points:JSON.parse(JSON.stringify(hole.points)),
scaleX:(hole.scaleX||1)/scaleX,
scaleY:(hole.scaleY||1)/scaleY,
rotation:(hole.rotation||0)-(HOLSTER.rotation||0),
stitchBorder:hole.stitchBorder,
stitchMargin:hole.stitchMargin,
stitchSpacing:hole.stitchSpacing,
name:hole.name
};
ASYM_CUSTOM_HOLES.splice(idx,1);
SYM_CUSTOM_HOLES.push(newHole);
SELECTED={type:'symCustomHole',idx:SYM_CUSTOM_HOLES.length-1};
}else if(type==='symStitch'){
// Convert symmetric stitch to asymmetric
const stitch=SYM_STITCHES[idx];
const newPoints=stitch.points.map(p=>{
const wp=M.holsterToWorld({x:p.x,y:p.y});
return{
x:wp.x,
y:wp.y,
h1:p.h1?{x:p.h1.x*HOLSTER.scaleX,y:p.h1.y*HOLSTER.scaleY}:{x:0,y:0},
h2:p.h2?{x:p.h2.x*HOLSTER.scaleX,y:p.h2.y*HOLSTER.scaleY}:{x:0,y:0}
};
});
const newStitch={
points:newPoints,
spacing:stitch.spacing,
name:stitch.name
};
SYM_STITCHES.splice(idx,1);
ASYM_STITCHES.push(newStitch);
SELECTED={type:'asymStitch',idx:ASYM_STITCHES.length-1};
}else if(type==='asymStitch'){
// Convert asymmetric stitch to symmetric
const stitch=ASYM_STITCHES[idx];
const scaleX=Math.max(0.01,HOLSTER.scaleX);
const scaleY=Math.max(0.01,HOLSTER.scaleY);
const newPoints=stitch.points.map(p=>{
const lp=M.worldToHolster({x:p.x,y:p.y});
return{
x:Math.abs(lp.x),
y:lp.y,
h1:p.h1?{x:p.h1.x/scaleX,y:p.h1.y/scaleY}:{x:0,y:0},
h2:p.h2?{x:p.h2.x/scaleX,y:p.h2.y/scaleY}:{x:0,y:0}
};
});
const newStitch={
points:newPoints,
spacing:stitch.spacing,
name:stitch.name
};
ASYM_STITCHES.splice(idx,1);
SYM_STITCHES.push(newStitch);
SELECTED={type:'symStitch',idx:SYM_STITCHES.length-1};
}else if(type==='symShape'){
// Convert symmetric shape to asymmetric
const shape=SYM_SHAPES[idx];
const worldPos=M.holsterToWorld({x:shape.x,y:shape.y});
const newShape={
x:worldPos.x,
y:worldPos.y,
points:JSON.parse(JSON.stringify(shape.points)),
scaleX:(shape.scaleX||1)*HOLSTER.scaleX,
scaleY:(shape.scaleY||1)*HOLSTER.scaleY,
rotation:(HOLSTER.rotation||0)+(shape.rotation||0),
stitchBorder:shape.stitchBorder,
stitchMargin:shape.stitchMargin,
stitchSpacing:shape.stitchSpacing,
isExtension:shape.isExtension,
isLinkedCircle:shape.isLinkedCircle,
sourceRangeIdx:shape.sourceRangeIdx,
name:shape.name
};
SYM_SHAPES.splice(idx,1);
ASYM_SHAPES.push(newShape);
SELECTED={type:'asymShape',idx:ASYM_SHAPES.length-1};
}else if(type==='asymShape'){
// Convert asymmetric shape to symmetric
const shape=ASYM_SHAPES[idx];
const localPos=M.worldToHolster({x:shape.x,y:shape.y});
const scaleX=Math.max(0.01,HOLSTER.scaleX);
const scaleY=Math.max(0.01,HOLSTER.scaleY);
const newShape={
x:Math.abs(localPos.x),
y:localPos.y,
points:JSON.parse(JSON.stringify(shape.points)),
scaleX:(shape.scaleX||1)/scaleX,
scaleY:(shape.scaleY||1)/scaleY,
rotation:(shape.rotation||0)-(HOLSTER.rotation||0),
stitchBorder:shape.stitchBorder,
stitchMargin:shape.stitchMargin,
stitchSpacing:shape.stitchSpacing,
isExtension:shape.isExtension,
isLinkedCircle:shape.isLinkedCircle,
sourceRangeIdx:shape.sourceRangeIdx,
name:shape.name
};
ASYM_SHAPES.splice(idx,1);
SYM_SHAPES.push(newShape);
SELECTED={type:'symShape',idx:SYM_SHAPES.length-1};
}
this.updateInfo();
this.updateOutliner();
this.draw();
this.saveState();
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
getSelectedObj() {
  return this.propertiesPanel.getSelectedObj();
}
updateInfo(){
if(this.outlinerOpen)this.updateOutliner();
const bar=document.getElementById('props-bar'),stats=document.getElementById('stats');
if(!SELECTED){bar.classList.remove('active');stats.classList.remove('hidden');return}
bar.classList.add('active');stats.classList.add('hidden');
const propShape=document.getElementById('prop-shape'),propWidth=document.getElementById('prop-width'),propHeight=document.getElementById('prop-height'),propSize=document.getElementById('prop-size'),propText=document.getElementById('prop-text'),propFontsize=document.getElementById('prop-fontsize'),propFontstyle=document.getElementById('prop-fontstyle'),propTextStyle=document.getElementById('prop-textstyle'),propListType=document.getElementById('prop-listtype'),propStitch=document.getElementById('prop-stitch'),propMargin=document.getElementById('prop-margin'),propSpacing=document.getElementById('prop-spacing'),propCreateStitch=document.getElementById('prop-create-stitch'),propEsLine=document.getElementById('prop-es-line'),propEsHoles=document.getElementById('prop-es-holes'),propEsMirror=document.getElementById('prop-es-mirror'),propExtension=document.getElementById('prop-extension'),propMirror=document.getElementById('prop-mirror'),propLinkHandles=document.getElementById('prop-link-handles');
[propShape,propWidth,propHeight,propSize,propText,propFontsize,propFontstyle,propTextStyle,propListType,propStitch,propMargin,propSpacing,propCreateStitch,propEsLine,propEsHoles,propEsMirror,propExtension,propMirror,propLinkHandles].forEach(p=>p.style.display='none');
// Layer prefix for two-layer mode
const layerPrefix=CFG.projectType==='two-layer'?(CURRENT_LAYER==='front'?'[Front] ':'[Back] '):'';
if(SELECTED.type==='holster'){document.getElementById('sel-type').textContent=layerPrefix+'Main Pattern';propSize.style.display='flex';document.getElementById('sel-size').textContent=HOLSTER.scaleX.toFixed(2)+' × '+HOLSTER.scaleY.toFixed(2)}
else if(SELECTED.type==='symHole'||SELECTED.type==='asymHole'){const h=this.getSelectedObj();document.getElementById('sel-type').textContent=layerPrefix+(SELECTED.type==='symHole'?'Sym Hole':'Asym Hole');propShape.style.display='flex';propWidth.style.display='flex';propHeight.style.display='flex';propStitch.style.display='flex';propMirror.style.display='flex';document.getElementById('sel-shape').value=h.shape||'ellipse';document.getElementById('sel-width').value=h.width;document.getElementById('sel-width-slider').value=h.width;document.getElementById('sel-height').value=h.height;document.getElementById('sel-height-slider').value=h.height;document.getElementById('sel-stitch-border').checked=h.stitchBorder||false;document.getElementById('sel-mirror').checked=SELECTED.type==='symHole';if(h.stitchBorder){propMargin.style.display='flex';propSpacing.style.display='flex';document.getElementById('sel-stitch-margin').value=h.stitchMargin||3;document.getElementById('sel-stitch-margin-slider').value=h.stitchMargin||3;document.getElementById('sel-stitch-spacing').value=h.stitchSpacing||3;document.getElementById('sel-stitch-spacing-slider').value=h.stitchSpacing||3}}
else if(SELECTED.type==='symShape'||SELECTED.type==='asymShape'){const s=this.getSelectedObj();document.getElementById('sel-type').textContent=layerPrefix+(s.isExtension?'Extension Shape':s.isLinkedCircle?'Linked Circle':(SELECTED.type==='symShape'?'Sym Shape':'Asym Shape'));propSize.style.display='flex';propStitch.style.display='flex';propExtension.style.display='flex';propMirror.style.display='flex';document.getElementById('sel-size').textContent=(s.scaleX||1).toFixed(2)+' × '+(s.scaleY||1).toFixed(2);document.getElementById('sel-stitch-border').checked=s.stitchBorder||false;document.getElementById('sel-extension').checked=s.isExtension||false;document.getElementById('sel-mirror').checked=SELECTED.type==='symShape';if(s.stitchBorder&&!s.isExtension){propMargin.style.display='flex';propSpacing.style.display='flex';document.getElementById('sel-stitch-margin').value=s.stitchMargin||3;document.getElementById('sel-stitch-margin-slider').value=s.stitchMargin||3;document.getElementById('sel-stitch-spacing').value=s.stitchSpacing||3;document.getElementById('sel-stitch-spacing-slider').value=s.stitchSpacing||3}}
else if(SELECTED.type==='symStitch'||SELECTED.type==='asymStitch'){const st=this.getSelectedObj();document.getElementById('sel-type').textContent=layerPrefix+(SELECTED.type==='symStitch'?'Sym Stitch':'Asym Stitch');propSpacing.style.display='flex';propMirror.style.display='flex';document.getElementById('sel-stitch-spacing').value=st.spacing||4;document.getElementById('sel-stitch-spacing-slider').value=st.spacing||4;document.getElementById('sel-mirror').checked=SELECTED.type==='symStitch'}
else if(SELECTED.type==='symCustomHole'||SELECTED.type==='asymCustomHole'){const h=this.getSelectedObj();document.getElementById('sel-type').textContent=layerPrefix+(SELECTED.type==='symCustomHole'?'Sym Custom':'Asym Custom');propSize.style.display='flex';propStitch.style.display='flex';propMirror.style.display='flex';document.getElementById('sel-size').textContent=(h.scaleX||1).toFixed(2)+' × '+(h.scaleY||1).toFixed(2);document.getElementById('sel-stitch-border').checked=h.stitchBorder||false;document.getElementById('sel-mirror').checked=SELECTED.type==='symCustomHole';if(h.stitchBorder){propMargin.style.display='flex';propSpacing.style.display='flex';document.getElementById('sel-stitch-margin').value=h.stitchMargin||3;document.getElementById('sel-stitch-margin-slider').value=h.stitchMargin||3;document.getElementById('sel-stitch-spacing').value=h.stitchSpacing||3;document.getElementById('sel-stitch-spacing-slider').value=h.stitchSpacing||3}}
else if(SELECTED.type==='textAnnotation'){const t=TEXT_ANNOTATIONS[SELECTED.idx];document.getElementById('sel-type').textContent=layerPrefix+'Text';propText.style.display='flex';propFontsize.style.display='flex';propFontstyle.style.display='flex';propTextStyle.style.display='flex';propListType.style.display='flex';document.getElementById('sel-text').value=t.text||'';document.getElementById('sel-fontsize').value=t.fontSize||12;document.getElementById('btn-bold').style.background=t.bold?'var(--accent)':'#333';document.getElementById('btn-italic').style.background=t.italic?'var(--accent)':'#333';document.getElementById('sel-textstyle').value=t.style||'normal';document.getElementById('sel-listtype').value=t.listType||'none'}
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
// Transform shape points to world coordinates with bezier handles
const ptsWithHandles=s.points.map(p=>{
const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};
const r=M.rotate(sc,s.rotation||0);
// Transform bezier handles
const sh1={x:(p.h1?.x||0)*(s.scaleX||1),y:(p.h1?.y||0)*(s.scaleY||1)};
const sh2={x:(p.h2?.x||0)*(s.scaleX||1),y:(p.h2?.y||0)*(s.scaleY||1)};
const rh1=M.rotate(sh1,s.rotation||0);
const rh2=M.rotate(sh2,s.rotation||0);
return{x:r.x+s.x,y:r.y+s.y,h1:rh1,h2:rh2};
});
// Sample the bezier curve to get linear segments
const sampledPts=M.sampleBezierClosed(ptsWithHandles,20);
// Convert to Clipper format
const clipperPts=sampledPts.map(p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)}));
cl.AddPath(clipperPts,ClipperLib.PolyType.ptClip,true);
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
// Stable offset for closed paths - uses ClipperLib for proper topology handling
offsetPathStableClosed(path,delta){
if(!ClipperLib||path.length<3)return path;
const co=new ClipperLib.ClipperOffset();
const cp=path.map(p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)}));
co.AddPaths([cp],ClipperLib.JoinType.jtRound,ClipperLib.EndType.etClosedPolygon);
const sol=[];
co.Execute(sol,delta*SCALE);
if(!sol.length)return path;
return sol[0].map(p=>({x:p.X/SCALE,y:p.Y/SCALE}));
}
getSymHoleWorld(hole,side){
const lx=hole.x*side,wp=M.holsterToWorld({x:lx,y:hole.y}),rot=(HOLSTER.rotation||0)+(hole.rotation||0)*side,w=hole.width*HOLSTER.scaleX,h=hole.height*HOLSTER.scaleY;
return{x:wp.x,y:wp.y,rotation:rot,width:w,height:h,shape:hole.shape,stitchBorder:hole.stitchBorder,stitchMargin:hole.stitchMargin,stitchSpacing:hole.stitchSpacing}
}
getSymShapeWorld(shape,side){
const lx=shape.x*side,wp=M.holsterToWorld({x:lx,y:shape.y}),rot=(HOLSTER.rotation||0)+(shape.rotation||0)*side;
return{
x:wp.x,
y:wp.y,
rotation:rot,
points:shape.points,
scaleX:(shape.scaleX||1)*HOLSTER.scaleX,
scaleY:(shape.scaleY||1)*HOLSTER.scaleY,
stitchBorder:shape.stitchBorder,
stitchMargin:shape.stitchMargin,
stitchSpacing:shape.stitchSpacing,
isExtension:shape.isExtension,
isLinkedCircle:shape.isLinkedCircle,
sourceRangeIdx:shape.sourceRangeIdx
}
}
getGizmos(obj,type){const hs=[];let cx,cy,hw,hh,rot;if(type==='holster'){const b=M.getBounds(this.getPatternPath());cx=HOLSTER.x;cy=HOLSTER.y;hw=b.w/2+20;hh=b.h/2+20;rot=HOLSTER.rotation||0}else if(type==='asymShape'){
// Handle linked circles
if(obj.isLinkedCircle){const cd=this.getLinkedCircleData(obj);if(cd){cx=obj.x;cy=obj.y;hw=cd.radius*(obj.scaleX||1)+10;hh=cd.radius*(obj.scaleY||1)+10;rot=obj.rotation||0}else{cx=obj.x;cy=obj.y;hw=50;hh=50;rot=0}}
else{const pts=obj.points.map(p=>{const s={x:p.x*(obj.scaleX||1),y:p.y*(obj.scaleY||1)};const r=M.rotate(s,obj.rotation||0);return{x:r.x+obj.x,y:r.y+obj.y}});const b=M.getBounds(pts);cx=obj.x;cy=obj.y;hw=b.w/2+10;hh=b.h/2+10;rot=obj.rotation||0}
}else{cx=obj.x;cy=obj.y;hw=obj.width/2+10;hh=obj.height/2+10;rot=obj.rotation||0}
[{x:hw,y:0,t:'e'},{x:-hw,y:0,t:'w'},{x:0,y:-hh,t:'n'},{x:0,y:hh,t:'s'},{x:hw,y:-hh,t:'ne'},{x:-hw,y:-hh,t:'nw'},{x:hw,y:hh,t:'se'},{x:-hw,y:hh,t:'sw'}].forEach(s=>{const r=M.rotate(s,rot);hs.push({x:cx+r.x,y:cy+r.y,type:'scale-'+s.t})});const rp=M.rotate({x:hw+25,y:-hh-25},rot);hs.push({x:cx+rp.x,y:cy+rp.y,type:'rotate'});hs.push({x:cx,y:cy,type:'move'});return{handles:hs,cx,cy,hw,hh,rot}}
drawHole(ctx,cx,cy,rot,w,h,shape){const hw=w/2,hh=h/2;ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);ctx.beginPath();if(shape==='rectangle')ctx.rect(-hw,-hh,w,h);else if(shape==='pill'){const r=Math.min(hw,hh);if(hw>=hh){const l=hw-r;ctx.moveTo(-l,-r);ctx.lineTo(l,-r);ctx.arc(l,0,r,-Math.PI/2,Math.PI/2);ctx.lineTo(-l,r);ctx.arc(-l,0,r,Math.PI/2,-Math.PI/2)}else{const l=hh-r;ctx.moveTo(-r,-l);ctx.arc(0,-l,r,Math.PI,0);ctx.lineTo(r,l);ctx.arc(0,l,r,0,Math.PI)}ctx.closePath()}else ctx.ellipse(0,0,hw,hh,0,0,Math.PI*2);ctx.restore()}
drawShape(ctx,shape){
// Transform shape points to world coordinates with bezier handles
const pts=shape.points.map(p=>{
const s={x:p.x*(shape.scaleX||1),y:p.y*(shape.scaleY||1)};
const r=M.rotate(s,shape.rotation||0);
// Transform bezier handles
const sh1={x:(p.h1?.x||0)*(shape.scaleX||1),y:(p.h1?.y||0)*(shape.scaleY||1)};
const sh2={x:(p.h2?.x||0)*(shape.scaleX||1),y:(p.h2?.y||0)*(shape.scaleY||1)};
const rh1=M.rotate(sh1,shape.rotation||0);
const rh2=M.rotate(sh2,shape.rotation||0);
return{x:r.x+shape.x,y:r.y+shape.y,h1:rh1,h2:rh2};
});
ctx.beginPath();
if(pts.length>0){
ctx.moveTo(pts[0].x,pts[0].y);
// Draw bezier curves between points
for(let i=0;i<pts.length;i++){
const c=pts[i];
const n=pts[(i+1)%pts.length];
ctx.bezierCurveTo(c.x+c.h2.x,c.y+c.h2.y,n.x+n.h1.x,n.y+n.h1.y,n.x,n.y);
}
}
ctx.closePath();
}
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
getShapeControlPts(s){
// Get control points for asymShape with bezier handles
return s.points.map(p=>{
const sx=p.x*(s.scaleX||1),sy=p.y*(s.scaleY||1);
const sh1x=(p.h1?.x||0)*(s.scaleX||1),sh1y=(p.h1?.y||0)*(s.scaleY||1);
const sh2x=(p.h2?.x||0)*(s.scaleX||1),sh2y=(p.h2?.y||0)*(s.scaleY||1);
const rc=M.rotate({x:sx,y:sy},s.rotation||0);
const rh1=M.rotate({x:sh1x,y:sh1y},s.rotation||0);
const rh2=M.rotate({x:sh2x,y:sh2y},s.rotation||0);
return{x:s.x+rc.x,y:s.y+rc.y,h1:rh1,h2:rh2};
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
// Draw non-extension shapes separately
if(CFG.showSymmetric)SYM_SHAPES.filter(s=>!s.isExtension).forEach(s=>{[1,-1].forEach(side=>{const wShp=this.getSymShapeWorld(s,side);if(wShp.isLinkedCircle){const cd=this.getLinkedCircleData(wShp);if(cd){const pts=cd.points.map(p=>{const sc={x:p.x*(wShp.scaleX||1),y:p.y*(wShp.scaleY||1)};const r=M.rotate(sc,wShp.rotation||0);return{x:r.x+wShp.x,y:r.y+wShp.y}});oc.beginPath();pts.forEach((p,i)=>i===0?oc.moveTo(p.x,p.y):oc.lineTo(p.x,p.y));oc.closePath();oc.fillStyle=CFG.leatherColor;oc.globalAlpha=.5;oc.fill();oc.globalAlpha=1}}else{this.drawShape(oc,wShp);oc.fillStyle=CFG.leatherColor;oc.globalAlpha=.5;oc.fill();oc.globalAlpha=1}})});
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
if(CFG.showSymmetric){
SYM_SHAPES.forEach((shape,idx)=>{if(shape.hidden)return;try{const sel=SELECTED?.type==='symShape'&&SELECTED?.idx===idx;
[1,-1].forEach(side=>{
const wShp=this.getSymShapeWorld(shape,side);
// Handle linked circles specially
if(wShp.isLinkedCircle){
const circleData=this.getLinkedCircleData(wShp);
if(!circleData)return;
const pts=circleData.points.map(p=>{const s={x:p.x*(wShp.scaleX||1),y:p.y*(wShp.scaleY||1)};const r=M.rotate(s,wShp.rotation||0);return{x:r.x+wShp.x,y:r.y+wShp.y}});
ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle=sel?'#007AFF':'#555';ctx.lineWidth=(sel?2:1.5)/VIEW.zoom;ctx.stroke();
if(wShp.stitchBorder){
ctx.fillStyle=sel?'#007AFF':'#444';
circleData.stitchPositions.forEach(pos=>{
const angle=pos*Math.PI*2-Math.PI/2;
const sx=Math.cos(angle)*(circleData.radius+CFG.stitchMargin)*(wShp.scaleX||1);
const sy=Math.sin(angle)*(circleData.radius+CFG.stitchMargin)*(wShp.scaleY||1);
const r=M.rotate({x:sx,y:sy},wShp.rotation||0);
ctx.beginPath();ctx.arc(wShp.x+r.x,wShp.y+r.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill();hsc++;
});
}
return;
}
// Regular shape rendering
const isExt=wShp.isExtension;
this.drawShape(ctx,wShp);
ctx.strokeStyle=sel?(isExt?'#34C759':'#007AFF'):(isExt?'rgba(52,199,89,.3)':'#555');
ctx.lineWidth=(sel?2:1.5)/VIEW.zoom;
ctx.setLineDash(sel||isExt?[]:[5/VIEW.zoom,3/VIEW.zoom]);
ctx.stroke();ctx.setLineDash([]);
if(wShp.stitchBorder&&!isExt){const pts=wShp.points.map(p=>{const s={x:p.x*(wShp.scaleX||1),y:p.y*(wShp.scaleY||1)};const r=M.rotate(s,wShp.rotation||0);return{x:r.x+wShp.x,y:r.y+wShp.y}});const sp=this.offsetPath(pts,wShp.stitchMargin||3);if(sp.length){const sa=M.buildArcClosed(sp),tot=sa[sa.length-1].d,spc=wShp.stitchSpacing||3;ctx.fillStyle=sel?'#007AFF':'#444';for(let d=0;d<tot;d+=spc){const pt=M.ptAtDist(sa,d);ctx.beginPath();ctx.arc(pt.x,pt.y,CFG.holeSize/2,0,Math.PI*2);ctx.fill();hsc++}}}
});
// Only draw gizmo/handles on right side for sym shapes
if(sel){
const wShp=this.getSymShapeWorld(shape,1);
this.drawGizmo(ctx,this.getGizmos(wShp,'asymShape'),wShp.isExtension?'#34C759':'#007AFF');
const cpts=this.getShapeControlPts(wShp);
const ns=8/VIEW.zoom,hs=5/VIEW.zoom;
cpts.forEach(n=>{
const h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};
ctx.strokeStyle=wShp.isExtension?'rgba(52,199,89,.5)':'rgba(0,122,255,.5)';
ctx.lineWidth=1/VIEW.zoom;
ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(h1w.x,h1w.y);ctx.stroke();
ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(h2w.x,h2w.y);ctx.stroke();
ctx.fillStyle='#FF3B30';
ctx.beginPath();ctx.arc(h1w.x,h1w.y,hs,0,Math.PI*2);ctx.fill();
ctx.fillStyle='#00C7BE';
ctx.beginPath();ctx.arc(h2w.x,h2w.y,hs,0,Math.PI*2);ctx.fill();
ctx.fillStyle=wShp.isExtension?'#34C759':'#007AFF';
ctx.fillRect(n.x-ns/2,n.y-ns/2,ns,ns);
ctx.strokeStyle='#fff';
ctx.lineWidth=1.5/VIEW.zoom;
ctx.strokeRect(n.x-ns/2,n.y-ns/2,ns,ns);
});
}}catch(e){console.error('SYM_SHAPES render error:',e,shape)}});
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
// Draw bezier handles and control points
const cpts=this.getShapeControlPts(shape);
const ns=8/VIEW.zoom,hs=5/VIEW.zoom;
cpts.forEach(n=>{
const h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};
// Draw lines from node to handles
ctx.strokeStyle=isExt?'rgba(52,199,89,.5)':'rgba(255,149,0,.5)';
ctx.lineWidth=1/VIEW.zoom;
ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(h1w.x,h1w.y);ctx.stroke();
ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(h2w.x,h2w.y);ctx.stroke();
// Draw handle points (h1 in red, h2 in cyan)
ctx.fillStyle='#FF3B30';
ctx.beginPath();ctx.arc(h1w.x,h1w.y,hs,0,Math.PI*2);ctx.fill();
ctx.fillStyle='#00C7BE';
ctx.beginPath();ctx.arc(h2w.x,h2w.y,hs,0,Math.PI*2);ctx.fill();
// Draw node point
ctx.fillStyle=isExt?'#34C759':'#FF9500';
ctx.fillRect(n.x-ns/2,n.y-ns/2,ns,ns);
ctx.strokeStyle='#fff';
ctx.lineWidth=1.5/VIEW.zoom;
ctx.strokeRect(n.x-ns/2,n.y-ns/2,ns,ns);
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
// Calculate font size based on style
let fs=(t.fontSize||12)/VIEW.zoom;
if(t.style==='header'){fs=24/VIEW.zoom}
else if(t.style==='subheader'){fs=18/VIEW.zoom}
// Build font string
const fontWeight=(t.bold||t.style==='header'||t.style==='subheader')?'bold ':'';
const fontStyle=t.italic?'italic ':'';
ctx.font=`${fontStyle}${fontWeight}${fs}px "Segoe UI", sans-serif`;
ctx.fillStyle=sel?'#007AFF':'#333';
ctx.textAlign='left';ctx.textBaseline='top';
// Add list prefix if list type is set
let textToShow=t.text||'';
if(t.listType&&t.listType!=='none'){
const listIdx=t.listIndex||1;
let prefix='';
if(t.listType==='bullet'){prefix='• '}
else if(t.listType==='numbered'){prefix=`${listIdx}. `}
textToShow=prefix+textToShow;
}
if(textToShow)ctx.fillText(textToShow,t.x,t.y);
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
if(sel){
const tw=ctx.measureText(textToShow).width;
const th=fs*1.2;
ctx.strokeStyle='#007AFF';ctx.lineWidth=1/VIEW.zoom;ctx.setLineDash([3/VIEW.zoom,3/VIEW.zoom]);
ctx.strokeRect(t.x-3/VIEW.zoom,t.y-3/VIEW.zoom,tw+6/VIEW.zoom,th+6/VIEW.zoom);
ctx.setLineDash([]);
}
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
// Double-click on text to edit inline
for(let i=TEXT_ANNOTATIONS.length-1;i>=0;i--){
const t=TEXT_ANNOTATIONS[i];
if(t.hidden)continue;
const fs=(t.fontSize||12)/VIEW.zoom;
const tw=this.ctx.measureText(t.text||'').width/VIEW.zoom;
const th=fs*1.2;
if(w.x>=t.x-5/VIEW.zoom&&w.x<=t.x+tw+5/VIEW.zoom&&w.y>=t.y-5/VIEW.zoom&&w.y<=t.y+th+5/VIEW.zoom){
SELECTED={type:'textAnnotation',idx:i};
this.updateInfo();
this.startTextEdit(i);
return;
}
}
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
// Check for vertex drag first (higher priority than bezier handles)
const pts=s.points.map((p,i)=>{const sc={x:p.x*(s.scaleX||1),y:p.y*(s.scaleY||1)};const r=M.rotate(sc,s.rotation||0);return{x:r.x+s.x,y:r.y+s.y,idx:i}});
for(let i=0;i<pts.length;i++){if(M.dist(w,pts[i])<10/VIEW.zoom){DRAG={active:true,type:'asymShapeVertex',idx:SELECTED.idx,ptIdx:i,sx:w.x,sy:w.y};return}}
// Then check for bezier handle drag
const cpts=this.getShapeControlPts(s);
for(let i=0;i<cpts.length;i++){
const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};
if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'asymShapeH1',idx:SELECTED.idx,ptIdx:i};return}
if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'asymShapeH2',idx:SELECTED.idx,ptIdx:i};return}
}
// Then check gizmo handles
const gizmo=this.getGizmos(s,'asymShape');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'asymShapeGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:s.x,shy:s.y,ssx:s.scaleX||1,ssy:s.scaleY||1,sr:s.rotation||0};return}}}}
if(SELECTED?.type==='symShape'){const s=SYM_SHAPES[SELECTED.idx];if(!s.locked){
// Check for vertex drag first (higher priority than bezier handles)
const wShp=this.getSymShapeWorld(s,1);
const pts=wShp.points.map((p,i)=>{const sc={x:p.x*(wShp.scaleX||1),y:p.y*(wShp.scaleY||1)};const r=M.rotate(sc,wShp.rotation||0);return{x:r.x+wShp.x,y:r.y+wShp.y,idx:i}});
for(const pt of pts){if(M.dist(w,pt)<12/VIEW.zoom){DRAG={active:true,type:'symShapeVertex',idx:SELECTED.idx,ptIdx:pt.idx};return}}
// Check bezier handles
const cpts=this.getShapeControlPts(wShp);
for(let i=0;i<cpts.length;i++){
const n=cpts[i],h1w={x:n.x+n.h1.x,y:n.y+n.h1.y},h2w={x:n.x+n.h2.x,y:n.y+n.h2.y};
if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'symShapeH1',idx:SELECTED.idx,ptIdx:i};return}
if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'symShapeH2',idx:SELECTED.idx,ptIdx:i};return}
}
// Then check gizmo handles
const gizmo=this.getGizmos(wShp,'asymShape');for(const g of gizmo.handles){if(M.dist(w,g)<12/VIEW.zoom){DRAG={active:true,type:'symShapeGizmo',gizmoType:g.type,idx:SELECTED.idx,sx:w.x,sy:w.y,shx:s.x,shy:s.y,ssx:s.scaleX||1,ssy:s.scaleY||1,sr:s.rotation||0};return}}}}
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
for(let i=SYM_SHAPES.length-1;i>=0;i--){const s=SYM_SHAPES[i];
for(const side of[1,-1]){
const wShp=this.getSymShapeWorld(s,side);
// Handle linked circles
if(wShp.isLinkedCircle){const cd=this.getLinkedCircleData(wShp);if(cd){const d=M.dist(w,{x:wShp.x,y:wShp.y});if(d<cd.radius*(wShp.scaleX||1)+10){SELECTED={type:'symShape',idx:i};this.updateInfo();this.draw();return}}}
else{
// Regular shape
const pts=wShp.points.map(p=>{const sc={x:p.x*(wShp.scaleX||1),y:p.y*(wShp.scaleY||1)};const r=M.rotate(sc,wShp.rotation||0);return{x:r.x+wShp.x,y:r.y+wShp.y}});
if(M.insidePoly(w,pts)){SELECTED={type:'symShape',idx:i};this.updateInfo();this.draw();return}
}
}}
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
this.ctx.font=`${(line.style==='header'||line.style==='subheader')?'bold ':''}${fs/VIEW.zoom}px "Segoe UI", sans-serif`;
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
const tw=this.ctx.measureText(textToShow).width;
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
this.updateInfo();this.draw();return
}
}
if(!HOLSTER.locked){for(let i=0;i<NODES.length;i++){const n=NODES[i],nw=M.holsterToWorld(n),h1w=M.holsterToWorld({x:n.x+n.h1.x,y:n.y+n.h1.y}),h2w=M.holsterToWorld({x:n.x+n.h2.x,y:n.y+n.h2.y});if(M.dist(w,nw)<12/VIEW.zoom){DRAG={active:true,type:'node',idx:i};SELECTED={type:'node',idx:i};this.canvas.style.cursor='grabbing';this.updateInfo();this.draw();return}if(M.dist(w,h1w)<10/VIEW.zoom){DRAG={active:true,type:'h1',idx:i};SELECTED=null;this.canvas.style.cursor='grabbing';this.updateInfo();this.draw();return}if(M.dist(w,h2w)<10/VIEW.zoom){DRAG={active:true,type:'h2',idx:i};SELECTED=null;this.canvas.style.cursor='grabbing';this.updateInfo();this.draw();return}}}
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
case'holsterGizmo':if(DRAG.gizmoType==='move'){const oldX=HOLSTER.x,oldY=HOLSTER.y;HOLSTER.x=DRAG.shx+(w.x-DRAG.sx);HOLSTER.y=DRAG.shy+(w.y-DRAG.sy);const dx=HOLSTER.x-oldX,dy=HOLSTER.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('holster',0,dx,dy)}}else if(DRAG.gizmoType==='rotate'){HOLSTER.rotation=Math.atan2(w.y-HOLSTER.y,w.x-HOLSTER.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-HOLSTER.x,DRAG.sy-HOLSTER.y),dn=Math.hypot(w.x-HOLSTER.x,w.y-HOLSTER.y),sf=dn/ds;if(SHIFT_HELD){const lw=M.worldToLocal(w,{x:HOLSTER.x,y:HOLSTER.y,rotation:HOLSTER.rotation,scaleX:1,scaleY:1}),b=M.getBounds(this.getPatternLocalPath());if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))HOLSTER.scaleX=Math.max(.1,Math.abs(lw.x)/(b.w/2+20));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))HOLSTER.scaleY=Math.max(.1,Math.abs(lw.y)/(b.h/2+20))}else{HOLSTER.scaleX=Math.max(.1,DRAG.ssx*sf);HOLSTER.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.updateInfo();break;
case'symHoleGizmo':{const hole=SYM_HOLES[DRAG.idx],lw=M.worldToHolster(w);if(DRAG.gizmoType==='move'){const oldX=hole.x,oldY=hole.y;const s=snapLocal({x:Math.abs(lw.x),y:lw.y});hole.x=s.x;hole.y=s.y;const dx=hole.x-oldX,dy=hole.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('symHole',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){const wh=this.getSymHoleWorld(hole,1);hole.rotation=Math.atan2(w.y-wh.y,w.x-wh.x)-(CFG.lockFoldLine?0:(HOLSTER.rotation||0))+Math.PI/4}else{const wh=this.getSymHoleWorld(hole,1),ds=Math.hypot(DRAG.sx-wh.x,DRAG.sy-wh.y),dn=Math.hypot(w.x-wh.x,w.y-wh.y),sf=dn/ds;if(SHIFT_HELD){const rot=(CFG.lockFoldLine?0:(HOLSTER.rotation||0))+(hole.rotation||0),lh=M.worldToLocal(w,{x:wh.x,y:wh.y,rotation:rot,scaleX:1,scaleY:1});if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))hole.width=Math.max(1,Math.abs(lh.x)*2/HOLSTER.scaleX);if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))hole.height=Math.max(1,Math.abs(lh.y)*2/HOLSTER.scaleY)}else{hole.width=Math.max(1,DRAG.sw*sf);hole.height=Math.max(1,DRAG.sh*sf)}}this.updateInfo();break}
case'asymHoleGizmo':{const hole=ASYM_HOLES[DRAG.idx];if(DRAG.gizmoType==='move'){const oldX=hole.x,oldY=hole.y;const s=snapWorld(w);hole.x=s.x;hole.y=s.y;const dx=hole.x-oldX,dy=hole.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('asymHole',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){hole.rotation=Math.atan2(w.y-hole.y,w.x-hole.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-DRAG.shx,DRAG.sy-DRAG.shy),dn=Math.hypot(w.x-hole.x,w.y-hole.y),sf=dn/ds;if(SHIFT_HELD){const lh=M.worldToLocal(w,{x:hole.x,y:hole.y,rotation:hole.rotation||0,scaleX:1,scaleY:1});if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))hole.width=Math.max(1,Math.abs(lh.x)*2);if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))hole.height=Math.max(1,Math.abs(lh.y)*2)}else{hole.width=Math.max(1,DRAG.sw*sf);hole.height=Math.max(1,DRAG.sh*sf)}}this.updateInfo();break}
case'asymShapeGizmo':{const s=ASYM_SHAPES[DRAG.idx];if(DRAG.gizmoType==='move'){const oldX=s.x,oldY=s.y;const sn=snapWorld(w);s.x=sn.x;s.y=sn.y;const dx=s.x-oldX,dy=s.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('asymShape',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){s.rotation=Math.atan2(w.y-s.y,w.x-s.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-DRAG.shx,DRAG.sy-DRAG.shy),dn=Math.hypot(w.x-s.x,w.y-s.y),sf=dn/ds;if(SHIFT_HELD&&s.points){const ls=M.worldToLocal(w,{x:s.x,y:s.y,rotation:s.rotation||0,scaleX:1,scaleY:1}),b=M.getBounds(s.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))s.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))s.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{s.scaleX=Math.max(.1,DRAG.ssx*sf);s.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.updateInfo();break}
case'asymShapeVertex':{const s=ASYM_SHAPES[DRAG.idx];
// Convert world coords to local shape coords
const localW=M.worldToLocal(w,{x:s.x,y:s.y,rotation:s.rotation||0,scaleX:s.scaleX||1,scaleY:s.scaleY||1});
s.points[DRAG.ptIdx].x=localW.x;
s.points[DRAG.ptIdx].y=localW.y;
break}
case'asymShapeH1':{const s=ASYM_SHAPES[DRAG.idx],p=s.points[DRAG.ptIdx];
const cpts=this.getShapeControlPts(s),cp=cpts[DRAG.ptIdx];
const dx=w.x-cp.x,dy=w.y-cp.y;
const rot=-(s.rotation||0);
const rd=M.rotate({x:dx,y:dy},rot);
p.h1={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};
break}
case'asymShapeH2':{const s=ASYM_SHAPES[DRAG.idx],p=s.points[DRAG.ptIdx];
const cpts=this.getShapeControlPts(s),cp=cpts[DRAG.ptIdx];
const dx=w.x-cp.x,dy=w.y-cp.y;
const rot=-(s.rotation||0);
const rd=M.rotate({x:dx,y:dy},rot);
p.h2={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};
break}
case'symShapeGizmo':{const s=SYM_SHAPES[DRAG.idx],lw=M.worldToHolster(w);if(DRAG.gizmoType==='move'){const oldX=s.x,oldY=s.y;const sn=snapLocal({x:Math.abs(lw.x),y:lw.y});s.x=sn.x;s.y=sn.y;const dx=s.x-oldX,dy=s.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('symShape',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){const wShp=this.getSymShapeWorld(s,1);s.rotation=Math.atan2(w.y-wShp.y,w.x-wShp.x)-(HOLSTER.rotation||0)+Math.PI/4}else{const wShp=this.getSymShapeWorld(s,1),ds=Math.hypot(DRAG.sx-wShp.x,DRAG.sy-wShp.y),dn=Math.hypot(w.x-wShp.x,w.y-wShp.y),sf=dn/ds;if(SHIFT_HELD&&s.points){const ls=M.worldToLocal(w,{x:wShp.x,y:wShp.y,rotation:wShp.rotation||0,scaleX:1,scaleY:1}),b=M.getBounds(s.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))s.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))s.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{s.scaleX=Math.max(.1,DRAG.ssx*sf);s.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.updateInfo();break}
case'symShapeVertex':{const s=SYM_SHAPES[DRAG.idx],lw=M.worldToHolster(w);const localW={x:Math.abs(lw.x),y:lw.y};s.points[DRAG.ptIdx].x=localW.x;s.points[DRAG.ptIdx].y=localW.y;break}
case'symShapeH1':{const s=SYM_SHAPES[DRAG.idx],p=s.points[DRAG.ptIdx];const wShp=this.getSymShapeWorld(s,1);const cpts=this.getShapeControlPts(wShp),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(s.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx/HOLSTER.scaleX,y:dy/HOLSTER.scaleY},rot);p.h1={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};break}
case'symShapeH2':{const s=SYM_SHAPES[DRAG.idx],p=s.points[DRAG.ptIdx];const wShp=this.getSymShapeWorld(s,1);const cpts=this.getShapeControlPts(wShp),cp=cpts[DRAG.ptIdx];const dx=w.x-cp.x,dy=w.y-cp.y;const rot=-(s.rotation||0)-(HOLSTER.rotation||0);const rd=M.rotate({x:dx/HOLSTER.scaleX,y:dy/HOLSTER.scaleY},rot);p.h2={x:rd.x/(s.scaleX||1),y:rd.y/(s.scaleY||1)};break}
case'symCustomHoleGizmo':{const h=SYM_CUSTOM_HOLES[DRAG.idx],lw=M.worldToHolster(w);if(DRAG.gizmoType==='move'){const oldX=h.x,oldY=h.y;const s=snapLocal({x:Math.abs(lw.x),y:lw.y});h.x=s.x;h.y=s.y;const dx=h.x-oldX,dy=h.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('symCustomHole',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){const pts=this.getCustomHoleWorld(h,1),b=M.getBounds(pts);h.rotation=Math.atan2(w.y-b.cy,w.x-b.cx)-(HOLSTER.rotation||0)+Math.PI/4}else{const pts=this.getCustomHoleWorld(h,1),b=M.getBounds(pts),ds=Math.hypot(DRAG.sx-b.cx,DRAG.sy-b.cy),dn=Math.hypot(w.x-b.cx,w.y-b.cy),sf=dn/ds;if(SHIFT_HELD){const ls=M.worldToLocal(w,{x:b.cx,y:b.cy,rotation:(HOLSTER.rotation||0)+(h.rotation||0),scaleX:1,scaleY:1}),hb=M.getBounds(h.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))h.scaleX=Math.max(.1,Math.abs(ls.x)/(hb.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))h.scaleY=Math.max(.1,Math.abs(ls.y)/(hb.h/2+10))}else{h.scaleX=Math.max(.1,DRAG.ssx*sf);h.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.updateInfo();break}
case'asymCustomHoleGizmo':{const h=ASYM_CUSTOM_HOLES[DRAG.idx];if(DRAG.gizmoType==='move'){const oldX=h.x,oldY=h.y;const s=snapWorld(w);h.x=s.x;h.y=s.y;const dx=h.x-oldX,dy=h.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('asymCustomHole',DRAG.idx,dx,dy)}}else if(DRAG.gizmoType==='rotate'){h.rotation=Math.atan2(w.y-h.y,w.x-h.x)+Math.PI/4}else{const ds=Math.hypot(DRAG.sx-DRAG.shx,DRAG.sy-DRAG.shy),dn=Math.hypot(w.x-h.x,w.y-h.y),sf=dn/ds;if(SHIFT_HELD){const ls=M.worldToLocal(w,{x:h.x,y:h.y,rotation:h.rotation||0,scaleX:1,scaleY:1}),b=M.getBounds(h.points);if(DRAG.gizmoType.includes('e')||DRAG.gizmoType.includes('w'))h.scaleX=Math.max(.1,Math.abs(ls.x)/(b.w/2+10));if(DRAG.gizmoType.includes('n')||DRAG.gizmoType.includes('s'))h.scaleY=Math.max(.1,Math.abs(ls.y)/(b.h/2+10))}else{h.scaleX=Math.max(.1,DRAG.ssx*sf);h.scaleY=Math.max(.1,DRAG.ssy*sf)}}this.updateInfo();break}
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
case'textMove':{const t=TEXT_ANNOTATIONS[DRAG.idx];const oldX=t.x,oldY=t.y;const s=snapWorld({x:w.x-DRAG.ox,y:w.y-DRAG.oy});t.x=s.x;t.y=s.y;const dx=t.x-oldX,dy=t.y-oldY;if(dx!==0||dy!==0){this.propagateTransformToChildren('textAnnotation',DRAG.idx,dx,dy)}break}
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
getStitchCount(layerState) {
  return this.publishManager.getStitchCount(layerState);
}
centerPublishView() {
  this.publishManager.centerPublishView();
}
togglePublish() {
  this.publishManager.togglePublish();
}
downloadPattern() {
  this.publishManager.downloadPattern();
}
downloadFullPattern(format, title) {
  this.publishManager.downloadFullPattern(format, title);
}
downloadA4Pages(format, title) {
  this.publishManager.downloadA4Pages(format, title);
}
drawPublish() {
  this.publishManager.drawPublish();
}
drawPublishA4Pages() {
  this.publishManager.drawPublishA4Pages();
}
drawPublishFullPattern() {
  this.publishManager.drawPublishFullPattern();
}
drawPatternLayerFullPattern(ctx, layerState, scale, strokeColor = '#000', labelText = '') {
  return this.publishManager.drawPatternLayerFullPattern(ctx, layerState, scale, strokeColor, labelText);
}
drawPatternLayer(ctx, layerState, scale, strokeColor = '#000', labelText = '') {
  return this.publishManager.drawPatternLayer(ctx, layerState, scale, strokeColor, labelText);
}
}
const app=new App();
window.app = app;
