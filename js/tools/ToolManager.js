/**
 * ToolManager - Manages tool mode switching and tool state
 * 
 * Handles switching between different tools (select, hole, stitch, shape, custom hole, text),
 * managing temporary tool state, and updating UI indicators.
 */
export class ToolManager {
  /**
   * @param {Object} options - Configuration options
   * @param {Function} options.getMode - Function to get current MODE
   * @param {Function} options.setModeState - Function to set MODE state
   * @param {Function} options.getLayer - Function to get current LAYER
   * @param {Function} options.setLayer - Function to set LAYER
   * @param {Function} options.getTempStitch - Function to get TEMP_STITCH
   * @param {Function} options.setTempStitch - Function to set TEMP_STITCH
   * @param {Function} options.getTempShape - Function to get TEMP_SHAPE
   * @param {Function} options.setTempShape - Function to set TEMP_SHAPE
   * @param {Function} options.getTempCustomHole - Function to get TEMP_CUSTOMHOLE
   * @param {Function} options.setTempCustomHole - Function to set TEMP_CUSTOMHOLE
   * @param {Function} options.getCanvas - Function to get canvas element
   * @param {Function} options.draw - Function to redraw canvas
   * @param {Function} options.finishStitch - Function to finish stitch operation
   * @param {Function} options.finishShape - Function to finish shape operation
   * @param {Function} options.finishCustomHole - Function to finish custom hole operation
   */
  constructor(options = {}) {
    this.getMode = options.getMode || (() => 'select');
    this.setModeState = options.setModeState || (() => {});
    this.getLayer = options.getLayer || (() => 'symmetric');
    this.setLayer = options.setLayer || (() => {});
    this.getTempStitch = options.getTempStitch || (() => null);
    this.setTempStitch = options.setTempStitch || (() => {});
    this.getTempShape = options.getTempShape || (() => null);
    this.setTempShape = options.setTempShape || (() => {});
    this.getTempCustomHole = options.getTempCustomHole || (() => null);
    this.setTempCustomHole = options.setTempCustomHole || (() => {});
    this.getCanvas = options.getCanvas || (() => null);
    this.draw = options.draw || (() => {});
    this.finishStitch = options.finishStitch || (() => {});
    this.finishShape = options.finishShape || (() => {});
    this.finishCustomHole = options.finishCustomHole || (() => {});
  }

  /**
   * Set the current tool mode
   * @param {string} m - Mode name ('select', 'hole', 'stitch', 'shape', 'customhole', 'text')
   */
  setMode(m) {
    this.setModeState(m);
    this.setTempStitch(null);
    this.setTempShape(null);
    this.setTempCustomHole(null);
    
    // Update tool button states
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active', 'orange', 'purple'));
    const toolId = 'tool-' + m;
    const btn = document.getElementById(toolId);
    
    if (btn) {
      btn.classList.add('active');
      if (m === 'shape' || m === 'hole' || m === 'customhole') btn.classList.add('orange');
      if (m === 'stitch') btn.classList.add('purple');
    } else {
      document.getElementById('tool-select').classList.add('active');
    }
    
    const canvas = this.getCanvas();
    const ind = document.getElementById('mode-indicator');
    const layer = this.getLayer();
    
    if (m === 'hole') {
      ind.querySelector('.mode-text').textContent = layer === 'asymmetric' ? '○ Single Hole' : '○ Mirrored Hole';
      ind.className = 'active orange';
      canvas.style.cursor = 'copy';
    } else if (m === 'customhole') {
      ind.querySelector('.mode-text').textContent = layer === 'asymmetric' ? '✎ Single Custom' : '✎ Mirrored Custom';
      ind.className = 'active orange';
      canvas.style.cursor = 'crosshair';
    } else if (m === 'stitch') {
      ind.querySelector('.mode-text').textContent = layer === 'asymmetric' ? '┅ Single Stitch' : '┅ Mirrored Stitch';
      ind.className = 'active purple';
      canvas.style.cursor = 'copy';
    } else if (m === 'text') {
      ind.querySelector('.mode-text').textContent = 'T Add Text';
      ind.className = 'active';
      canvas.style.cursor = 'text';
    } else if (m === 'shape') {
      ind.querySelector('.mode-text').textContent = '◇ Single Shape';
      ind.className = 'active orange';
      canvas.style.cursor = 'crosshair';
      this.setLayer('asymmetric');
    } else {
      ind.className = '';
      canvas.style.cursor = 'default';
    }
    
    this.draw();
  }

  /**
   * Finish the current tool operation
   * Completes stitch/shape/customhole drawing and adds it to the scene
   */
  finishMode() {
    const mode = this.getMode();
    const tempStitch = this.getTempStitch();
    const tempShape = this.getTempShape();
    const tempCustomHole = this.getTempCustomHole();
    
    // Finish stitch
    if (mode === 'stitch' && tempStitch && tempStitch.points.length >= 2) {
      this.finishStitch();
    }
    
    // Finish shape
    if (mode === 'shape' && tempShape && tempShape.points.length >= 3) {
      this.finishShape();
    }
    
    // Finish custom hole
    if (mode === 'customhole' && tempCustomHole && tempCustomHole.points.length >= 3) {
      this.finishCustomHole();
    }
    
    this.setMode('select');
  }

  /**
   * Cancel the current tool operation
   * Discards temporary stitch/shape/customhole and returns to select mode
   */
  cancelMode() {
    this.setTempStitch(null);
    this.setTempShape(null);
    this.setTempCustomHole(null);
    this.setMode('select');
  }
}
