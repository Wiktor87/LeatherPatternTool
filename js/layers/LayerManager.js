/**
 * LayerManager - Manages two-layer mode state and operations
 * 
 * Handles switching between front and back layers in two-layer mode,
 * capturing and restoring layer state, syncing outline and edge stitches,
 * and managing layer UI updates.
 */
export class LayerManager {
  /**
   * @param {Object} options - Configuration options
   * @param {Function} options.getConfig - Function to get CFG object
   * @param {Function} options.getCurrentLayer - Function to get CURRENT_LAYER
   * @param {Function} options.setCurrentLayer - Function to set CURRENT_LAYER
   * @param {Function} options.getFrontLayer - Function to get FRONT_LAYER
   * @param {Function} options.setFrontLayer - Function to set FRONT_LAYER
   * @param {Function} options.getBackLayer - Function to get BACK_LAYER
   * @param {Function} options.setBackLayer - Function to set BACK_LAYER
   * @param {Function} options.getGhostOffset - Function to get GHOST_OFFSET
   * @param {Function} options.setGhostOffset - Function to set GHOST_OFFSET
   * @param {Function} options.captureState - Function to capture current state
   * @param {Function} options.restoreState - Function to restore state
   * @param {Function} options.getCanvas - Function to get canvas element
   * @param {Function} options.draw - Function to redraw canvas
   * @param {Function} options.updateInfo - Function to update info panel
   * @param {Function} options.updateOutliner - Function to update outliner
   * @param {Function} options.saveState - Function to save history state
   * @param {Function} options.showToast - Function to show toast notification
   * @param {Function} options.clearSelection - Function to clear SELECTED
   */
  constructor(options = {}) {
    this.getConfig = options.getConfig || (() => ({}));
    this.getCurrentLayer = options.getCurrentLayer || (() => 'front');
    this.setCurrentLayer = options.setCurrentLayer || (() => {});
    this.getFrontLayer = options.getFrontLayer || (() => null);
    this.setFrontLayer = options.setFrontLayer || (() => {});
    this.getBackLayer = options.getBackLayer || (() => null);
    this.setBackLayer = options.setBackLayer || (() => {});
    this.getGhostOffset = options.getGhostOffset || (() => ({ x: 0, y: 0 }));
    this.setGhostOffset = options.setGhostOffset || (() => {});
    this.captureState = options.captureState || (() => ({}));
    this.restoreState = options.restoreState || (() => {});
    this.getCanvas = options.getCanvas || (() => null);
    this.draw = options.draw || (() => {});
    this.updateInfo = options.updateInfo || (() => {});
    this.updateOutliner = options.updateOutliner || (() => {});
    this.saveState = options.saveState || (() => {});
    this.showToast = options.showToast || (() => {});
    this.clearSelection = options.clearSelection || (() => {});
  }

  /**
   * Handle project type change (fold-over vs two-layer mode)
   * @param {string} type - 'fold-over' or 'two-layer'
   */
  onProjectTypeChange(type) {
    // Toggle UI elements based on project type
    const isTwoLayer = type === 'two-layer';
    document.getElementById('layer-toggle').style.display = isTwoLayer ? 'none' : 'flex';
    document.getElementById('two-layer-toggle').style.display = isTwoLayer ? 'flex' : 'none';
    document.getElementById('two-layer-sync').style.display = isTwoLayer ? 'block' : 'none';
    document.getElementById('two-layer-ghost').style.display = isTwoLayer ? 'block' : 'none';
    document.getElementById('two-layer-actions').style.display = isTwoLayer ? 'flex' : 'none';
    document.getElementById('publish-layout').style.display = isTwoLayer ? 'inline-block' : 'none';
    
    // Initialize layers if switching to two-layer mode
    if (isTwoLayer && !this.getFrontLayer()) {
      this.initializeLayers();
      this.setCurrentLayer('front');
      this.updateLayerUI();
    }
    
    // Show notification
    this.showToast(
      isTwoLayer ? 'Switched to Two-Layer Mode' : 'Switched to Fold-Over Mode',
      'info'
    );
  }

  /**
   * Initialize front and back layer state
   */
  initializeLayers() {
    // Save current state as front layer
    const currentState = this.captureState();
    this.setFrontLayer(currentState);
    // Initialize back layer as copy of front
    this.setBackLayer(JSON.parse(JSON.stringify(currentState)));
  }

  /**
   * Switch between front and back layers
   * @param {string} layer - 'front' or 'back'
   */
  switchLayer(layer) {
    const cfg = this.getConfig();
    if (cfg.projectType !== 'two-layer') return;
    
    // Save current layer state
    const currentLayer = this.getCurrentLayer();
    if (currentLayer === 'front') {
      this.setFrontLayer(this.captureState());
    } else {
      this.setBackLayer(this.captureState());
    }
    
    // Switch to new layer
    this.setCurrentLayer(layer);
    const targetState = layer === 'front' ? this.getFrontLayer() : this.getBackLayer();
    this.restoreState(targetState);
    
    // Update UI
    this.updateLayerUI();
    this.clearSelection();
    this.updateInfo();
    this.updateOutliner();
    this.draw();
    this.showToast(
      `Editing ${layer === 'front' ? 'Front' : 'Back'} Layer`,
      layer === 'front' ? 'info' : 'success'
    );
  }

  /**
   * Update layer UI elements (buttons, canvas background, property labels)
   */
  updateLayerUI() {
    const cfg = this.getConfig();
    const currentLayer = this.getCurrentLayer();
    
    // Update toggle buttons
    document.querySelector('.layer-btn.front')?.classList.toggle('active', currentLayer === 'front');
    document.querySelector('.layer-btn.back')?.classList.toggle('active', currentLayer === 'back');
    
    // Update canvas background tint
    const canvas = this.getCanvas();
    canvas.classList.remove('layer-front', 'layer-back');
    if (cfg.projectType === 'two-layer') {
      canvas.classList.add('layer-' + currentLayer);
    }
    
    // Update properties bar prefix
    const selTitle = document.getElementById('sel-type');
    if (selTitle && cfg.projectType === 'two-layer') {
      const prefix = currentLayer === 'front' ? '[Front] ' : '[Back] ';
      const baseText = selTitle.textContent.replace(/^\[(Front|Back)\] /, '');
      selTitle.textContent = prefix + baseText;
    }
  }

  /**
   * Copy layer data between front and back
   * @param {string} direction - 'toBack' or 'toFront'
   */
  duplicateLayer(direction) {
    const cfg = this.getConfig();
    if (cfg.projectType !== 'two-layer') return;
    
    const msg = direction === 'toBack'
      ? 'Copy all Front layer data to Back layer? This will overwrite the Back layer.'
      : 'Copy all Back layer data to Front layer? This will overwrite the Front layer.';
    
    if (!confirm(msg)) return;
    
    const currentLayer = this.getCurrentLayer();
    
    if (direction === 'toBack') {
      // Save current front state and copy to back
      if (currentLayer === 'front') {
        this.setFrontLayer(this.captureState());
      }
      this.setBackLayer(JSON.parse(JSON.stringify(this.getFrontLayer())));
      if (currentLayer === 'back') {
        this.restoreState(this.getBackLayer());
      }
      this.showToast('Front layer copied to Back', 'success');
    } else {
      // Save current back state and copy to front
      if (currentLayer === 'back') {
        this.setBackLayer(this.captureState());
      }
      this.setFrontLayer(JSON.parse(JSON.stringify(this.getBackLayer())));
      if (currentLayer === 'front') {
        this.restoreState(this.getFrontLayer());
      }
      this.showToast('Back layer copied to Front', 'success');
    }
    
    this.updateInfo();
    this.updateOutliner();
    this.draw();
    this.saveState();
  }

  /**
   * Reset back layer to match front layer
   */
  resetToMaster() {
    const cfg = this.getConfig();
    if (cfg.projectType !== 'two-layer') return;
    
    if (!confirm('Reset Back layer to match Front layer? This will overwrite all Back layer data.')) {
      return;
    }
    
    const currentLayer = this.getCurrentLayer();
    
    // Copy front to back
    this.setBackLayer(JSON.parse(JSON.stringify(this.getFrontLayer())));
    
    // If currently on back layer, restore it
    if (currentLayer === 'back') {
      this.restoreState(this.getBackLayer());
      this.updateInfo();
      this.updateOutliner();
      this.draw();
    }
    
    this.showToast('Back layer reset to master', 'success');
    this.saveState();
  }

  /**
   * Reset ghost layer position to default
   */
  resetGhostPosition() {
    const cfg = this.getConfig();
    if (cfg.projectType !== 'two-layer') return;
    
    const ghostOffset = this.getGhostOffset();
    ghostOffset.x = 0;
    ghostOffset.y = 0;
    this.setGhostOffset(ghostOffset);
    
    this.draw();
    this.showToast('Ghost layer position reset', 'info');
  }

  /**
   * Sync outline from front layer to back layer
   */
  syncOutlineToBack() {
    const cfg = this.getConfig();
    const currentLayer = this.getCurrentLayer();
    
    if (cfg.projectType !== 'two-layer' || !cfg.syncOutline || currentLayer !== 'front') {
      return;
    }
    
    // Save current front layer
    this.setFrontLayer(this.captureState());
    
    // Update back layer's outline
    const backLayer = this.getBackLayer();
    if (backLayer) {
      const frontLayer = this.getFrontLayer();
      backLayer.NODES = JSON.parse(JSON.stringify(frontLayer.NODES));
      backLayer.EDGE_RANGES = JSON.parse(JSON.stringify(frontLayer.EDGE_RANGES));
      backLayer.MERGED_EDGE_RANGES = JSON.parse(JSON.stringify(frontLayer.MERGED_EDGE_RANGES));
      this.setBackLayer(backLayer);
    }
  }

  /**
   * Sync edge stitches from front layer to back layer
   */
  syncEdgeStitchesToBack() {
    const cfg = this.getConfig();
    const currentLayer = this.getCurrentLayer();
    
    if (cfg.projectType !== 'two-layer' || !cfg.syncEdgeStitches || currentLayer !== 'front') {
      return;
    }
    
    // Save current front layer
    this.setFrontLayer(this.captureState());
    
    // Update back layer's edge stitches
    const backLayer = this.getBackLayer();
    if (backLayer) {
      const frontLayer = this.getFrontLayer();
      backLayer.EDGE_STITCHES = JSON.parse(JSON.stringify(frontLayer.EDGE_STITCHES));
      this.setBackLayer(backLayer);
    }
  }
}
