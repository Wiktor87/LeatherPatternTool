/**
 * PropertiesPanel - Manages properties bar UI and object property editing
 * 
 * Handles updating the properties bar based on selection and managing
 * property change handlers for holes, stitches, shapes, text, etc.
 */
export class PropertiesPanel {
  /**
   * @param {Object} options - Configuration options
   * @param {Function} options.getSelected - Function to get SELECTED
   * @param {Function} options.getConfig - Function to get CFG object
   * @param {Function} options.getCurrentLayer - Function to get CURRENT_LAYER
   * @param {Function} options.getHolster - Function to get HOLSTER
   * @param {Function} options.getNodes - Function to get NODES
   * @param {Function} options.getSymHoles - Function to get SYM_HOLES
   * @param {Function} options.getAsymHoles - Function to get ASYM_HOLES
   * @param {Function} options.getSymCustomHoles - Function to get SYM_CUSTOM_HOLES
   * @param {Function} options.getAsymCustomHoles - Function to get ASYM_CUSTOM_HOLES
   * @param {Function} options.getSymShapes - Function to get SYM_SHAPES
   * @param {Function} options.getAsymShapes - Function to get ASYM_SHAPES
   * @param {Function} options.getSymStitches - Function to get SYM_STITCHES
   * @param {Function} options.getAsymStitches - Function to get ASYM_STITCHES
   * @param {Function} options.getEdgeStitches - Function to get EDGE_STITCHES
   * @param {Function} options.getEdgeRanges - Function to get EDGE_RANGES
   * @param {Function} options.getMergedEdgeRanges - Function to get MERGED_EDGE_RANGES
   * @param {Function} options.getTextAnnotations - Function to get TEXT_ANNOTATIONS
   * @param {Function} options.draw - Function to redraw canvas
   * @param {Function} options.saveState - Function to save history state
   * @param {Function} options.updateOutliner - Function to update outliner
   */
  constructor(options = {}) {
    this.getSelected = options.getSelected || (() => null);
    this.getConfig = options.getConfig || (() => ({}));
    this.getCurrentLayer = options.getCurrentLayer || (() => 'front');
    this.getHolster = options.getHolster || (() => ({}));
    this.getNodes = options.getNodes || (() => []);
    this.getSymHoles = options.getSymHoles || (() => []);
    this.getAsymHoles = options.getAsymHoles || (() => []);
    this.getSymCustomHoles = options.getSymCustomHoles || (() => []);
    this.getAsymCustomHoles = options.getAsymCustomHoles || (() => []);
    this.getSymShapes = options.getSymShapes || (() => []);
    this.getAsymShapes = options.getAsymShapes || (() => []);
    this.getSymStitches = options.getSymStitches || (() => []);
    this.getAsymStitches = options.getAsymStitches || (() => []);
    this.getEdgeStitches = options.getEdgeStitches || (() => []);
    this.getEdgeRanges = options.getEdgeRanges || (() => []);
    this.getMergedEdgeRanges = options.getMergedEdgeRanges || (() => []);
    this.getTextAnnotations = options.getTextAnnotations || (() => []);
    this.draw = options.draw || (() => {});
    this.saveState = options.saveState || (() => {});
    this.updateOutliner = options.updateOutliner || (() => {});
  }

  /**
   * Get the currently selected object
   * @returns {Object|null} The selected object or null
   */
  getSelectedObj() {
    const SELECTED = this.getSelected();
    if (!SELECTED) return null;
    
    if (SELECTED.type === 'symHole') return this.getSymHoles()[SELECTED.idx];
    if (SELECTED.type === 'asymHole') return this.getAsymHoles()[SELECTED.idx];
    if (SELECTED.type === 'symCustomHole') return this.getSymCustomHoles()[SELECTED.idx];
    if (SELECTED.type === 'asymCustomHole') return this.getAsymCustomHoles()[SELECTED.idx];
    if (SELECTED.type === 'symShape') return this.getSymShapes()[SELECTED.idx];
    if (SELECTED.type === 'asymShape') return this.getAsymShapes()[SELECTED.idx];
    if (SELECTED.type === 'symStitch') return this.getSymStitches()[SELECTED.idx];
    if (SELECTED.type === 'asymStitch') return this.getAsymStitches()[SELECTED.idx];
    if (SELECTED.type === 'edgeStitch') return this.getEdgeStitches()[SELECTED.idx];
    
    return null;
  }

  /**
   * Change hole shape
   * @param {string} s - Shape ('circle', 'ellipse', 'rectangle')
   */
  changeHoleShape(s) {
    const h = this.getSelectedObj();
    if (h && h.shape !== undefined) {
      h.shape = s;
      if (s === 'circle') h.width = h.height = Math.max(h.width, h.height);
      this.draw();
      this.saveState();
    }
  }

  /**
   * Change hole width
   * @param {number} v - Width value
   */
  changeHoleWidth(v) {
    const h = this.getSelectedObj();
    if (h && h.width !== undefined) {
      h.width = parseFloat(v);
      document.getElementById('sel-width').value = v;
      document.getElementById('sel-width-slider').value = v;
      this.draw();
    }
  }

  /**
   * Change hole height
   * @param {number} v - Height value
   */
  changeHoleHeight(v) {
    const h = this.getSelectedObj();
    if (h && h.height !== undefined) {
      h.height = parseFloat(v);
      document.getElementById('sel-height').value = v;
      document.getElementById('sel-height-slider').value = v;
      this.draw();
    }
  }

  /**
   * Toggle stitch border
   * @param {boolean} v - Enable/disable stitch border
   */
  toggleStitchBorder(v) {
    const h = this.getSelectedObj();
    if (h) {
      h.stitchBorder = v;
      this.draw();
      this.saveState();
    }
  }

  /**
   * Change stitch margin
   * @param {number} v - Margin value
   */
  changeStitchMargin(v) {
    const h = this.getSelectedObj();
    const SELECTED = this.getSelected();
    if (h) {
      if (SELECTED?.type === 'edgeStitch') {
        h.margin = parseFloat(v);
      } else {
        h.stitchMargin = parseFloat(v);
      }
      document.getElementById('sel-stitch-margin').value = v;
      document.getElementById('sel-stitch-margin-slider').value = v;
      this.draw();
    }
  }

  /**
   * Change stitch spacing
   * @param {number} v - Spacing value
   */
  changeStitchSpacing(v) {
    const h = this.getSelectedObj();
    const SELECTED = this.getSelected();
    if (h) {
      if (SELECTED?.type === 'edgeStitch') {
        h.spacing = parseFloat(v);
      } else {
        h.stitchSpacing = parseFloat(v);
      }
      document.getElementById('sel-stitch-spacing').value = v;
      document.getElementById('sel-stitch-spacing-slider').value = v;
      this.draw();
    }
  }

  /**
   * Change text content
   * @param {string} v - Text value
   */
  changeText(v) {
    const SELECTED = this.getSelected();
    if (SELECTED?.type === 'textAnnotation') {
      this.getTextAnnotations()[SELECTED.idx].text = v;
      this.draw();
      this.saveState();
    }
  }

  /**
   * Change font size
   * @param {number} v - Font size value
   */
  changeFontSize(v) {
    const SELECTED = this.getSelected();
    if (SELECTED?.type === 'textAnnotation') {
      this.getTextAnnotations()[SELECTED.idx].fontSize = parseInt(v) || 12;
      document.getElementById('sel-fontsize').value = v;
      this.draw();
      this.saveState();
    }
  }

  /**
   * Toggle bold style
   */
  toggleBold() {
    const SELECTED = this.getSelected();
    if (SELECTED?.type === 'textAnnotation') {
      const t = this.getTextAnnotations()[SELECTED.idx];
      t.bold = !t.bold;
      document.getElementById('btn-bold').style.background = t.bold ? 'var(--accent)' : '#333';
      this.draw();
      this.saveState();
    }
  }

  /**
   * Toggle italic style
   */
  toggleItalic() {
    const SELECTED = this.getSelected();
    if (SELECTED?.type === 'textAnnotation') {
      const t = this.getTextAnnotations()[SELECTED.idx];
      t.italic = !t.italic;
      document.getElementById('btn-italic').style.background = t.italic ? 'var(--accent)' : '#333';
      this.draw();
      this.saveState();
    }
  }

  /**
   * Change text style (header, subheader, normal)
   * @param {string} style - Text style
   */
  changeTextStyle(style) {
    const SELECTED = this.getSelected();
    if (SELECTED?.type === 'textAnnotation') {
      const t = this.getTextAnnotations()[SELECTED.idx];
      t.style = style;
      
      // Apply appropriate styling based on text style
      if (style === 'header') {
        t.fontSize = 24;
        t.bold = true;
      } else if (style === 'subheader') {
        t.fontSize = 18;
        t.bold = true;
      } else {
        // normal - keep current settings or reset to defaults
        if (!t.fontSize || t.fontSize > 18) t.fontSize = 12;
      }
      
      this.draw();
      this.saveState();
    }
  }

  /**
   * Change list type (none, bullet, numbered)
   * @param {string} listType - List type
   */
  changeListType(listType) {
    const SELECTED = this.getSelected();
    if (SELECTED?.type === 'textAnnotation') {
      const t = this.getTextAnnotations()[SELECTED.idx];
      t.listType = listType;
      if (listType !== 'none' && !t.listIndex) {
        t.listIndex = 1;
      }
      this.draw();
      this.saveState();
    }
  }
}
