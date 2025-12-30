/**
 * Leather Pattern Tool - Main Application
 * A comprehensive tool for designing and generating leather patterns
 * 
 * Features:
 * - Canvas-based drawing with multiple tools
 * - Pattern generation and customization
 * - Export functionality
 * - Full UI interactions
 */

class LeatherPatternTool {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentColor = '#000000';
    this.currentSize = 2;
    this.patterns = [];
    this.history = [];
    this.historyStep = 0;
    this.selectedPattern = null;
    
    // Tool settings
    this.toolSettings = {
      pen: { size: 2, opacity: 1 },
      eraser: { size: 10, opacity: 1 },
      brush: { size: 5, opacity: 0.7 },
      line: { size: 2, opacity: 1 },
      circle: { size: 2, opacity: 1 },
      rectangle: { size: 2, opacity: 1 }
    };
    
    this.startX = 0;
    this.startY = 0;
    this.isShapeDrawing = false;
    
    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupCanvas();
    this.setupEventListeners();
    this.loadPredefinedPatterns();
    this.saveState();
    this.updateUI();
  }

  /**
   * Setup canvas element and context
   */
  setupCanvas() {
    this.canvas = document.getElementById('patternCanvas');
    if (!this.canvas) {
      console.error('Canvas element not found');
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size
    const container = this.canvas.parentElement;
    this.canvas.width = container.offsetWidth || 800;
    this.canvas.height = container.offsetHeight || 600;
    
    // Set default canvas properties
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    
    // Add white background
    this.clearCanvas();
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
    this.canvas.addEventListener('mouseout', (e) => this.handleCanvasMouseOut(e));
    
    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => this.handleCanvasTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleCanvasTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handleCanvasTouchEnd(e));
    
    // Tool selection
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', (e) => this.selectTool(e.target.dataset.tool));
    });
    
    // Color picker
    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) {
      colorPicker.addEventListener('change', (e) => this.setColor(e.target.value));
    }
    
    // Size slider
    const sizeSlider = document.getElementById('sizeSlider');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', (e) => this.setSize(e.target.value));
    }
    
    // Action buttons
    this.setupActionButtons();
    
    // Pattern buttons
    document.querySelectorAll('[data-pattern]').forEach(btn => {
      btn.addEventListener('click', (e) => this.applyPattern(e.target.dataset.pattern));
    });
    
    // Window resize
    window.addEventListener('resize', () => this.handleWindowResize());
  }

  /**
   * Setup action button listeners
   */
  setupActionButtons() {
    const clearBtn = document.getElementById('clearBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const exportBtn = document.getElementById('exportBtn');
    const savePBtn = document.getElementById('savePatternBtn');
    const loadPBtn = document.getElementById('loadPatternBtn');
    
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearCanvas());
    if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
    if (redoBtn) redoBtn.addEventListener('click', () => this.redo());
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportCanvas());
    if (savePBtn) savePBtn.addEventListener('click', () => this.savePattern());
    if (loadPBtn) loadPBtn.addEventListener('click', () => this.loadPattern());
  }

  /**
   * Handle mouse down on canvas
   */
  handleCanvasMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    this.isDrawing = true;
    this.startX = x;
    this.startY = y;
    
    if (['line', 'circle', 'rectangle'].includes(this.currentTool)) {
      this.isShapeDrawing = true;
      this.saveState();
    } else {
      this.startPath(x, y);
    }
  }

  /**
   * Handle mouse move on canvas
   */
  handleCanvasMouseMove(e) {
    if (!this.isDrawing) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (this.isShapeDrawing) {
      this.previewShape(x, y);
    } else {
      this.drawPoint(x, y);
    }
  }

  /**
   * Handle mouse up on canvas
   */
  handleCanvasMouseUp(e) {
    if (!this.isDrawing) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (this.isShapeDrawing) {
      this.drawShape(x, y);
      this.isShapeDrawing = false;
      this.saveState();
    } else {
      this.endPath();
    }
    
    this.isDrawing = false;
  }

  /**
   * Handle mouse out of canvas
   */
  handleCanvasMouseOut(e) {
    if (this.isDrawing && !this.isShapeDrawing) {
      this.endPath();
      this.isDrawing = false;
    }
  }

  /**
   * Handle touch start on canvas
   */
  handleCanvasTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    this.isDrawing = true;
    this.startX = x;
    this.startY = y;
    
    if (!['line', 'circle', 'rectangle'].includes(this.currentTool)) {
      this.startPath(x, y);
    }
  }

  /**
   * Handle touch move on canvas
   */
  handleCanvasTouchMove(e) {
    e.preventDefault();
    if (!this.isDrawing) return;
    
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    this.drawPoint(x, y);
  }

  /**
   * Handle touch end on canvas
   */
  handleCanvasTouchEnd(e) {
    e.preventDefault();
    if (!this.isDrawing) return;
    
    this.endPath();
    this.isDrawing = false;
  }

  /**
   * Start drawing path
   */
  startPath(x, y) {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  /**
   * Draw point along path
   */
  drawPoint(x, y) {
    this.updateContextForTool();
    
    switch (this.currentTool) {
      case 'pen':
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        break;
      case 'eraser':
        this.ctx.clearRect(x - this.currentSize / 2, y - this.currentSize / 2, this.currentSize, this.currentSize);
        break;
      case 'brush':
        this.drawBrushStroke(x, y);
        break;
    }
  }

  /**
   * End drawing path
   */
  endPath() {
    this.ctx.closePath();
    this.saveState();
  }

  /**
   * Draw brush stroke with multiple points
   */
  drawBrushStroke(x, y) {
    const size = this.currentSize;
    const opacity = this.toolSettings.brush.opacity;
    
    // Create soft brush effect
    this.ctx.globalAlpha = opacity;
    this.ctx.fillStyle = this.currentColor;
    
    for (let i = 0; i < 3; i++) {
      const offsetX = (Math.random() - 0.5) * size;
      const offsetY = (Math.random() - 0.5) * size;
      this.ctx.beginPath();
      this.ctx.arc(x + offsetX, y + offsetY, size / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.globalAlpha = 1;
  }

  /**
   * Preview shape before finalizing
   */
  previewShape(x, y) {
    // Restore canvas to last state
    this.redrawCanvas();
    this.updateContextForTool();
    
    switch (this.currentTool) {
      case 'line':
        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(x - this.startX, 2) + Math.pow(y - this.startY, 2));
        this.ctx.beginPath();
        this.ctx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        break;
      case 'rectangle':
        const width = x - this.startX;
        const height = y - this.startY;
        this.ctx.strokeRect(this.startX, this.startY, width, height);
        break;
    }
  }

  /**
   * Draw final shape
   */
  drawShape(x, y) {
    this.updateContextForTool();
    
    switch (this.currentTool) {
      case 'line':
        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(x - this.startX, 2) + Math.pow(y - this.startY, 2));
        this.ctx.beginPath();
        this.ctx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        break;
      case 'rectangle':
        const width = x - this.startX;
        const height = y - this.startY;
        this.ctx.strokeRect(this.startX, this.startY, width, height);
        break;
    }
  }

  /**
   * Select drawing tool
   */
  selectTool(tool) {
    this.currentTool = tool;
    
    // Update UI
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');
    
    // Update cursor
    this.updateCanvasCursor();
    
    // Update size based on tool
    if (this.toolSettings[tool]) {
      const sizeSlider = document.getElementById('sizeSlider');
      if (sizeSlider) {
        sizeSlider.value = this.toolSettings[tool].size;
        this.currentSize = this.toolSettings[tool].size;
      }
    }
  }

  /**
   * Update canvas cursor based on current tool
   */
  updateCanvasCursor() {
    const cursors = {
      pen: 'crosshair',
      eraser: 'cell',
      brush: 'pointer',
      line: 'crosshair',
      circle: 'cell',
      rectangle: 'cell'
    };
    this.canvas.style.cursor = cursors[this.currentTool] || 'crosshair';
  }

  /**
   * Set drawing color
   */
  setColor(color) {
    this.currentColor = color;
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    
    // Update color display
    const colorDisplay = document.getElementById('colorDisplay');
    if (colorDisplay) {
      colorDisplay.textContent = color;
    }
  }

  /**
   * Set brush size
   */
  setSize(size) {
    this.currentSize = parseInt(size);
    this.ctx.lineWidth = this.currentSize;
    this.toolSettings[this.currentTool].size = this.currentSize;
    
    // Update size display
    const sizeDisplay = document.getElementById('sizeDisplay');
    if (sizeDisplay) {
      sizeDisplay.textContent = size + 'px';
    }
  }

  /**
   * Update context properties for current tool
   */
  updateContextForTool() {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.fillStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    
    if (this.toolSettings[this.currentTool]) {
      this.ctx.globalAlpha = this.toolSettings[this.currentTool].opacity;
    }
  }

  /**
   * Clear entire canvas
   */
  clearCanvas() {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.saveState();
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      this.redrawCanvas();
    }
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.historyStep < this.history.length - 1) {
      this.historyStep++;
      this.redrawCanvas();
    }
  }

  /**
   * Save current state to history
   */
  saveState() {
    // Remove any states after current step
    this.history = this.history.slice(0, this.historyStep + 1);
    
    // Add new state
    this.history.push(this.canvas.toDataURL());
    this.historyStep = this.history.length - 1;
    
    // Limit history to 50 states
    if (this.history.length > 50) {
      this.history.shift();
      this.historyStep--;
    }
  }

  /**
   * Redraw canvas from history
   */
  redrawCanvas() {
    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = this.history[this.historyStep];
  }

  /**
   * Load predefined patterns
   */
  loadPredefinedPatterns() {
    this.patterns = [
      {
        id: 'geometric',
        name: 'Geometric Pattern',
        generator: () => this.generateGeometricPattern()
      },
      {
        id: 'floral',
        name: 'Floral Pattern',
        generator: () => this.generateFloralPattern()
      },
      {
        id: 'grid',
        name: 'Grid Pattern',
        generator: () => this.generateGridPattern()
      },
      {
        id: 'diamond',
        name: 'Diamond Pattern',
        generator: () => this.generateDiamondPattern()
      },
      {
        id: 'waves',
        name: 'Wave Pattern',
        generator: () => this.generateWavePattern()
      },
      {
        id: 'dots',
        name: 'Dot Pattern',
        generator: () => this.generateDotPattern()
      }
    ];
  }

  /**
   * Apply pattern to canvas
   */
  applyPattern(patternId) {
    const pattern = this.patterns.find(p => p.id === patternId);
    if (pattern) {
      this.saveState();
      this.selectedPattern = pattern;
      pattern.generator();
      this.saveState();
    }
  }

  /**
   * Generate geometric pattern
   */
  generateGeometricPattern() {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    
    const spacing = 40;
    const size = 20;
    
    for (let x = 0; x < this.canvas.width; x += spacing) {
      for (let y = 0; y < this.canvas.height; y += spacing) {
        // Draw alternating triangles and squares
        if ((x / spacing + y / spacing) % 2 === 0) {
          // Draw triangle
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(x + size, y + size);
          this.ctx.lineTo(x - size, y + size);
          this.ctx.closePath();
          this.ctx.stroke();
        } else {
          // Draw square
          this.ctx.strokeRect(x - size / 2, y - size / 2, size, size);
        }
      }
    }
  }

  /**
   * Generate floral pattern
   */
  generateFloralPattern() {
    this.ctx.fillStyle = this.currentColor;
    
    const spacing = 50;
    const petalRadius = 8;
    const centerRadius = 4;
    
    for (let x = 0; x < this.canvas.width; x += spacing) {
      for (let y = 0; y < this.canvas.height; y += spacing) {
        this.drawFlower(x, y, petalRadius, centerRadius, 5);
      }
    }
  }

  /**
   * Draw a flower shape
   */
  drawFlower(x, y, petalRadius, centerRadius, petals) {
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2;
      const petalX = x + Math.cos(angle) * petalRadius * 2;
      const petalY = y + Math.sin(angle) * petalRadius * 2;
      
      this.ctx.beginPath();
      this.ctx.arc(petalX, petalY, petalRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Draw center
    this.ctx.beginPath();
    this.ctx.arc(x, y, centerRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Generate grid pattern
   */
  generateGridPattern() {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    
    const spacing = 30;
    
    // Vertical lines
    for (let x = 0; x < this.canvas.width; x += spacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < this.canvas.height; y += spacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  /**
   * Generate diamond pattern
   */
  generateDiamondPattern() {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    
    const spacing = 40;
    const size = 15;
    
    for (let x = 0; x < this.canvas.width; x += spacing) {
      for (let y = 0; y < this.canvas.height; y += spacing) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - size);
        this.ctx.lineTo(x + size, y);
        this.ctx.lineTo(x, y + size);
        this.ctx.lineTo(x - size, y);
        this.ctx.closePath();
        this.ctx.stroke();
      }
    }
  }

  /**
   * Generate wave pattern
   */
  generateWavePattern() {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    
    const spacing = 40;
    const amplitude = 15;
    const frequency = 0.05;
    
    for (let startY = 0; startY < this.canvas.height; startY += spacing) {
      this.ctx.beginPath();
      
      for (let x = 0; x < this.canvas.width; x += 5) {
        const y = startY + Math.sin(x * frequency) * amplitude;
        
        if (x === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      
      this.ctx.stroke();
    }
  }

  /**
   * Generate dot pattern
   */
  generateDotPattern() {
    this.ctx.fillStyle = this.currentColor;
    
    const spacing = 30;
    const radius = 4;
    
    for (let x = 0; x < this.canvas.width; x += spacing) {
      for (let y = 0; y < this.canvas.height; y += spacing) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  /**
   * Export canvas as image
   */
  exportCanvas() {
    const link = document.createElement('a');
    link.href = this.canvas.toDataURL('image/png');
    link.download = `leather-pattern-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Save current pattern to local storage
   */
  savePattern() {
    const name = prompt('Enter pattern name:');
    if (name) {
      const savedPattern = {
        id: Date.now(),
        name: name,
        data: this.canvas.toDataURL()
      };
      
      let saved = JSON.parse(localStorage.getItem('savedPatterns') || '[]');
      saved.push(savedPattern);
      localStorage.setItem('savedPatterns', JSON.stringify(saved));
      
      alert('Pattern saved successfully!');
      this.updateSavedPatternsList();
    }
  }

  /**
   * Load pattern from local storage
   */
  loadPattern() {
    const saved = JSON.parse(localStorage.getItem('savedPatterns') || '[]');
    
    if (saved.length === 0) {
      alert('No saved patterns found.');
      return;
    }
    
    const patternNames = saved.map(p => p.name).join('\n');
    const selected = prompt(`Available patterns:\n${patternNames}\n\nEnter pattern name to load:`);
    
    if (selected) {
      const pattern = saved.find(p => p.name === selected);
      if (pattern) {
        const img = new Image();
        img.onload = () => {
          this.ctx.drawImage(img, 0, 0);
          this.saveState();
        };
        img.src = pattern.data;
      }
    }
  }

  /**
   * Update saved patterns list in UI
   */
  updateSavedPatternsList() {
    const saved = JSON.parse(localStorage.getItem('savedPatterns') || '[]');
    const listContainer = document.getElementById('savedPatternsList');
    
    if (listContainer && saved.length > 0) {
      listContainer.innerHTML = saved.map(p => 
        `<button class="saved-pattern-btn" onclick="app.loadPatternById('${p.id}')">${p.name}</button>`
      ).join('');
    }
  }

  /**
   * Load pattern by ID
   */
  loadPatternById(id) {
    const saved = JSON.parse(localStorage.getItem('savedPatterns') || '[]');
    const pattern = saved.find(p => p.id == id);
    
    if (pattern) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0);
        this.saveState();
      };
      img.src = pattern.data;
    }
  }

  /**
   * Handle window resize
   */
  handleWindowResize() {
    const currentData = this.canvas.toDataURL();
    const container = this.canvas.parentElement;
    this.canvas.width = container.offsetWidth || 800;
    this.canvas.height = container.offsetHeight || 600;
    
    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = currentData;
  }

  /**
   * Update UI elements
   */
  updateUI() {
    // Update initial values
    const colorPicker = document.getElementById('colorPicker');
    const sizeSlider = document.getElementById('sizeSlider');
    
    if (colorPicker) {
      colorPicker.value = this.currentColor;
    }
    
    if (sizeSlider) {
      sizeSlider.value = this.currentSize;
    }
    
    this.updateSavedPatternsList();
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new LeatherPatternTool();
  console.log('Leather Pattern Tool initialized successfully');
});
