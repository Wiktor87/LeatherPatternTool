/**
 * InspectorPanel - Floating panel for inspecting and editing selected elements
 * 
 * Replaces the bottom properties bar with a more organized floating panel
 * that shows contextual properties based on the selected element type.
 */
export class InspectorPanel {
  /**
   * @param {Object} options - Configuration options
   * @param {Function} options.getSelected - Function to get SELECTED
   * @param {Function} options.propertiesPanel - PropertiesPanel instance for property changes
   * @param {Function} options.deleteSelected - Function to delete selected element
   */
  constructor(options = {}) {
    this.getSelected = options.getSelected || (() => null);
    this.propertiesPanel = options.propertiesPanel || null;
    this.deleteSelected = options.deleteSelected || (() => {});
    
    // Create the inspector panel if it doesn't exist
    this.createPanel();
    
    // Remember position (future enhancement)
    this.position = this.loadPosition();
  }

  /**
   * Create the inspector panel DOM structure
   */
  createPanel() {
    // Check if panel already exists
    let panel = document.getElementById('inspector-panel');
    if (panel) {
      this.panel = panel;
      return;
    }

    // Create new panel
    panel = document.createElement('div');
    panel.id = 'inspector-panel';
    panel.innerHTML = `
      <div class="inspector-header">
        <span class="inspector-title">Properties</span>
        <button class="close-btn" onclick="app.clearSelection()">✕</button>
      </div>
      <div class="inspector-content" id="inspector-content">
        <!-- Dynamic content will be inserted here -->
      </div>
      <div class="inspector-actions">
        <button onclick="app.deleteSelected()">🗑 Delete</button>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.panel = panel;
  }

  /**
   * Update the inspector panel based on current selection
   */
  update() {
    const SELECTED = this.getSelected();
    
    if (!SELECTED) {
      this.hide();
      return;
    }

    const obj = this.propertiesPanel?.getSelectedObj();
    if (!obj) {
      this.hide();
      return;
    }

    // Update title
    const title = this.panel.querySelector('.inspector-title');
    title.textContent = this.getSelectionTitle(SELECTED);

    // Update content
    const content = this.panel.querySelector('#inspector-content');
    content.innerHTML = this.generateContent(SELECTED, obj);

    // Show panel
    this.show();
  }

  /**
   * Get a friendly title for the selection
   */
  getSelectionTitle(selected) {
    const typeMap = {
      'symHole': 'Hole (Mirrored)',
      'asymHole': 'Hole (Single)',
      'symCustomHole': 'Custom Hole (Mirrored)',
      'asymCustomHole': 'Custom Hole (Single)',
      'symShape': 'Shape (Mirrored)',
      'asymShape': 'Shape (Single)',
      'symStitch': 'Stitch Line (Mirrored)',
      'asymStitch': 'Stitch Line (Single)',
      'edgeStitch': 'Edge Stitch',
      'textAnnotation': 'Text',
      'node': 'Pattern Node',
      'holster': 'Pattern'
    };
    return typeMap[selected.type] || 'Selection';
  }

  /**
   * Generate content HTML based on selection type
   */
  generateContent(selected, obj) {
    switch (selected.type) {
      case 'symHole':
      case 'asymHole':
        return this.generateHoleContent(obj);
      case 'symShape':
      case 'asymShape':
        return this.generateShapeContent(obj);
      case 'symStitch':
      case 'asymStitch':
        return this.generateStitchContent(obj);
      case 'edgeStitch':
        return this.generateEdgeStitchContent(obj);
      case 'textAnnotation':
        return this.generateTextContent(obj);
      case 'node':
        return this.generateNodeContent(obj);
      case 'holster':
        return this.generateHolsterContent(obj);
      default:
        return '<p style="padding: 12px; color: #888; font-size: 11px;">No properties available</p>';
    }
  }

  /**
   * Generate content for hole properties
   */
  generateHoleContent(hole) {
    return `
      <div class="inspector-section expanded">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Geometry</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row">
            <label>Shape</label>
            <select onchange="app.propertiesPanel.changeHoleShape(this.value)" value="${hole.shape || 'circle'}">
              <option value="circle" ${hole.shape === 'circle' ? 'selected' : ''}>Circle</option>
              <option value="ellipse" ${hole.shape === 'ellipse' ? 'selected' : ''}>Ellipse</option>
              <option value="pill" ${hole.shape === 'pill' ? 'selected' : ''}>Pill</option>
              <option value="rectangle" ${hole.shape === 'rectangle' ? 'selected' : ''}>Rectangle</option>
            </select>
          </div>
          <div class="inspector-row">
            <label>Width</label>
            <input type="range" min="2" max="40" step="0.5" value="${hole.width || 4}" 
              oninput="app.propertiesPanel.changeHoleWidth(this.value)" 
              onchange="app.saveState()">
            <input type="number" min="2" max="40" step="0.5" value="${hole.width || 4}" 
              onchange="app.propertiesPanel.changeHoleWidth(this.value); app.saveState()">
          </div>
          <div class="inspector-row">
            <label>Height</label>
            <input type="range" min="2" max="40" step="0.5" value="${hole.height || 4}" 
              oninput="app.propertiesPanel.changeHoleHeight(this.value)" 
              onchange="app.saveState()">
            <input type="number" min="2" max="40" step="0.5" value="${hole.height || 4}" 
              onchange="app.propertiesPanel.changeHoleHeight(this.value); app.saveState()">
          </div>
        </div>
      </div>
      <div class="inspector-section">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Stitching</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row">
            <label>Stitch Border</label>
            <input type="checkbox" ${hole.stitchBorder ? 'checked' : ''} 
              onchange="app.propertiesPanel.toggleStitchBorder(this.checked)">
          </div>
          ${hole.stitchBorder ? `
          <div class="inspector-row">
            <label>Margin</label>
            <input type="range" min="1" max="15" step="0.5" value="${hole.stitchMargin || 3}" 
              oninput="app.propertiesPanel.changeStitchMargin(this.value)" 
              onchange="app.saveState()">
            <input type="number" min="1" max="15" step="0.5" value="${hole.stitchMargin || 3}" 
              onchange="app.propertiesPanel.changeStitchMargin(this.value); app.saveState()">
          </div>
          <div class="inspector-row">
            <label>Spacing</label>
            <input type="range" min="1" max="10" step="0.5" value="${hole.stitchSpacing || 3}" 
              oninput="app.propertiesPanel.changeStitchSpacing(this.value)" 
              onchange="app.saveState()">
            <input type="number" min="1" max="10" step="0.5" value="${hole.stitchSpacing || 3}" 
              onchange="app.propertiesPanel.changeStitchSpacing(this.value); app.saveState()">
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Generate content for shape properties
   */
  generateShapeContent(shape) {
    const SELECTED = this.getSelected();
    const isAsymmetric = SELECTED?.type === 'asymShape';
    
    return `
      <div class="inspector-section expanded">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Geometry</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row">
            <label>Width</label>
            <input type="range" min="2" max="40" step="0.5" value="${shape.width || 10}" 
              oninput="app.propertiesPanel.changeHoleWidth(this.value)" 
              onchange="app.saveState()">
            <input type="number" min="2" max="40" step="0.5" value="${shape.width || 10}" 
              onchange="app.propertiesPanel.changeHoleWidth(this.value); app.saveState()">
          </div>
          <div class="inspector-row">
            <label>Height</label>
            <input type="range" min="2" max="40" step="0.5" value="${shape.height || 10}" 
              oninput="app.propertiesPanel.changeHoleHeight(this.value)" 
              onchange="app.saveState()">
            <input type="number" min="2" max="40" step="0.5" value="${shape.height || 10}" 
              onchange="app.propertiesPanel.changeHoleHeight(this.value); app.saveState()">
          </div>
        </div>
      </div>
      ${isAsymmetric ? `
      <div class="inspector-section">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Options</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row">
            <label>Extension</label>
            <input type="checkbox" ${shape.isExtension ? 'checked' : ''} 
              onchange="app.toggleShapeExtension(this.checked)">
          </div>
        </div>
      </div>
      ` : ''}
    `;
  }

  /**
   * Generate content for stitch line properties
   */
  generateStitchContent(stitch) {
    return `
      <div class="inspector-section expanded">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Stitching</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row">
            <label>Spacing</label>
            <input type="range" min="1" max="10" step="0.5" value="${stitch.spacing || 4}" 
              oninput="app.propertiesPanel.changeStitchSpacing(this.value)" 
              onchange="app.saveState()">
            <input type="number" min="1" max="10" step="0.5" value="${stitch.spacing || 4}" 
              onchange="app.propertiesPanel.changeStitchSpacing(this.value); app.saveState()">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate content for edge stitch properties
   */
  generateEdgeStitchContent(edgeStitch) {
    return `
      <div class="inspector-section expanded">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Display</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row">
            <label>Show Line</label>
            <input type="checkbox" ${edgeStitch.showLine !== false ? 'checked' : ''} 
              onchange="app.toggleEdgeStitchLine(this.checked)">
          </div>
          <div class="inspector-row">
            <label>Show Holes</label>
            <input type="checkbox" ${edgeStitch.showHoles !== false ? 'checked' : ''} 
              onchange="app.toggleEdgeStitchHoles(this.checked)">
          </div>
        </div>
      </div>
      <div class="inspector-section">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Stitching</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row">
            <label>Margin</label>
            <input type="range" min="1" max="15" step="0.5" value="${edgeStitch.margin || 5}" 
              oninput="app.propertiesPanel.changeStitchMargin(this.value)" 
              onchange="app.saveState()">
            <input type="number" min="1" max="15" step="0.5" value="${edgeStitch.margin || 5}" 
              onchange="app.propertiesPanel.changeStitchMargin(this.value); app.saveState()">
          </div>
          <div class="inspector-row">
            <label>Spacing</label>
            <input type="range" min="1" max="10" step="0.5" value="${edgeStitch.spacing || 4}" 
              oninput="app.propertiesPanel.changeStitchSpacing(this.value)" 
              onchange="app.saveState()">
            <input type="number" min="1" max="10" step="0.5" value="${edgeStitch.spacing || 4}" 
              onchange="app.propertiesPanel.changeStitchSpacing(this.value); app.saveState()">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate content for text properties
   */
  generateTextContent(text) {
    return `
      <div class="inspector-section expanded">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Content</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row" style="flex-direction: column; align-items: stretch;">
            <label style="margin-bottom: 6px;">Text</label>
            <input type="text" value="${text.text || ''}" 
              style="width: 100%; background: #333; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; font-size: 11px;"
              onchange="app.propertiesPanel.changeText(this.value)">
          </div>
        </div>
      </div>
      <div class="inspector-section">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Style</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row">
            <label>Size</label>
            <input type="number" min="6" max="72" step="1" value="${text.fontSize || 12}" 
              onchange="app.propertiesPanel.changeFontSize(this.value)">
          </div>
          <div class="inspector-row">
            <label>Bold</label>
            <input type="checkbox" ${text.bold ? 'checked' : ''} 
              onchange="app.propertiesPanel.toggleBold()">
          </div>
          <div class="inspector-row">
            <label>Italic</label>
            <input type="checkbox" ${text.italic ? 'checked' : ''} 
              onchange="app.propertiesPanel.toggleItalic()">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate content for node properties
   */
  generateNodeContent(node) {
    return `
      <div class="inspector-section expanded">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Handles</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <p style="font-size: 11px; color: #888; margin: 8px 0;">Control bezier curve handles</p>
          <button onclick="app.toggleHandleLink()" 
            style="width: 100%; padding: 8px; background: var(--accent); color: #fff; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">
            ${node.linkedHandles ? 'Unlink Handles' : 'Link Handles'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Generate content for holster/pattern properties
   */
  generateHolsterContent(holster) {
    return `
      <div class="inspector-section expanded">
        <div class="section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="section-title">Transform</span>
          <span class="section-chevron">›</span>
        </div>
        <div class="section-content">
          <div class="inspector-row">
            <label>Scale</label>
            <span style="color: var(--green); font-size: 11px;">${holster.scaleX?.toFixed(2) || '1.00'}x</span>
          </div>
          <div class="inspector-row">
            <label>Rotation</label>
            <span style="color: var(--green); font-size: 11px;">${holster.rotation?.toFixed(1) || '0'}°</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show the inspector panel
   */
  show() {
    this.panel.classList.add('active');
  }

  /**
   * Hide the inspector panel
   */
  hide() {
    this.panel.classList.remove('active');
  }

  /**
   * Load saved position from localStorage
   */
  loadPosition() {
    const saved = localStorage.getItem('inspectorPanelPosition');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { top: 100, right: 280 };
      }
    }
    return { top: 100, right: 280 };
  }

  /**
   * Save position to localStorage
   */
  savePosition(position) {
    localStorage.setItem('inspectorPanelPosition', JSON.stringify(position));
    this.position = position;
  }
}
