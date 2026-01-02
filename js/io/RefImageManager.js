/**
 * RefImageManager - Handles reference image operations
 * 
 * Manages loading, scaling, and calibration of reference images
 * that can be displayed on the canvas as a drawing guide.
 */
export class RefImageManager {
  /**
   * @param {Object} options - Configuration options
   * @param {Function} options.onUpdate - Callback when reference image changes
   * @param {Function} options.getDistance - Function to calculate distance between points
   * @param {Function} options.closeSettings - Function to close settings panel
   */
  constructor(options = {}) {
    this.onUpdate = options.onUpdate || (() => {});
    this.getDistance = options.getDistance || ((p1, p2) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      return Math.sqrt(dx * dx + dy * dy);
    });
    this.closeSettings = options.closeSettings || (() => {});
    
    // Reference image state
    this.state = {
      img: null,
      x: 0,
      y: 0,
      scale: 1,
      width: 0,
      height: 0,
      calibrating: false,
      calPt1: null,
      calPt2: null
    };
  }

  /**
   * Get the current reference image state
   * @returns {Object} Reference image state
   */
  getState() {
    return this.state;
  }

  /**
   * Load a reference image from file input
   * @param {Event} event - File input change event
   */
  loadRefImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Convert to mm - assume 96 DPI for now, user can scale
        // Default: 1 pixel = 0.2645mm (at 96 DPI)
        const pxToMm = 0.2645;
        this.state.img = img;
        this.state.width = img.width * pxToMm;
        this.state.height = img.height * pxToMm;
        this.state.x = 0;
        this.state.y = 0;
        this.state.scale = 1;
        
        // Update UI controls
        document.getElementById('cfg-refScale').value = 1;
        document.getElementById('cfg-refScale-num').value = 1;
        
        this.onUpdate();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  /**
   * Update the reference image scale
   * @param {number} value - New scale value
   */
  updateRefScale(value) {
    this.state.scale = parseFloat(value) || 1;
    document.getElementById('cfg-refScale').value = this.state.scale;
    document.getElementById('cfg-refScale-num').value = this.state.scale;
    this.onUpdate();
  }

  /**
   * Clear the reference image
   */
  clearRefImage() {
    this.state.img = null;
    this.state.width = 0;
    this.state.height = 0;
    this.state.calibrating = false;
    this.state.calPt1 = null;
    this.state.calPt2 = null;
    this.onUpdate();
  }

  /**
   * Start calibration mode
   */
  startCalibration() {
    if (!this.state.img) {
      alert('Load an image first');
      return;
    }
    
    this.state.calibrating = true;
    this.state.calPt1 = null;
    this.state.calPt2 = null;
    
    document.getElementById('btn-calibrate').textContent = '📏 Click point 1...';
    document.getElementById('btn-calibrate').style.background = '#5a2a2a';
    
    // Close settings panel so clicks go to canvas
    this.closeSettings();
    this.onUpdate();
  }

  /**
   * Handle click during calibration
   * @param {Object} worldPoint - World coordinates of click {x, y}
   */
  handleCalibrationClick(worldPoint) {
    console.log('Calibration click:', worldPoint, 'calPt1:', this.state.calPt1, 'calPt2:', this.state.calPt2);
    
    if (!this.state.calPt1) {
      this.state.calPt1 = {x: worldPoint.x, y: worldPoint.y};
      console.log('Set calPt1');
      this.onUpdate();
    } else if (!this.state.calPt2) {
      this.state.calPt2 = {x: worldPoint.x, y: worldPoint.y};
      console.log('Set calPt2, showing modal');
      this.onUpdate();
      
      // Show custom modal instead of prompt (prompt doesn't work on iOS)
      document.getElementById('calibration-modal').style.display = 'flex';
      document.getElementById('calibration-distance').focus();
      document.getElementById('calibration-distance').select();
    }
  }

  /**
   * Cancel calibration mode
   */
  cancelCalibration() {
    document.getElementById('calibration-modal').style.display = 'none';
    this.state.calibrating = false;
    this.state.calPt1 = null;
    this.state.calPt2 = null;
    document.getElementById('btn-calibrate').textContent = '📏 Calibrate Scale';
    document.getElementById('btn-calibrate').style.background = '#2a5a2a';
    this.onUpdate();
  }

  /**
   * Apply calibration using the known distance
   */
  applyCalibration() {
    const realDist = document.getElementById('calibration-distance').value;
    document.getElementById('calibration-modal').style.display = 'none';
    
    if (realDist && !isNaN(parseFloat(realDist))) {
      const pxDist = this.getDistance(this.state.calPt1, this.state.calPt2);
      const realMm = parseFloat(realDist);
      const newScale = realMm / pxDist * this.state.scale;
      this.state.scale = newScale;
      document.getElementById('cfg-refScale').value = Math.min(5, newScale);
      document.getElementById('cfg-refScale-num').value = newScale.toFixed(3);
    }
    
    this.state.calibrating = false;
    this.state.calPt1 = null;
    this.state.calPt2 = null;
    document.getElementById('btn-calibrate').textContent = '📏 Calibrate Scale';
    document.getElementById('btn-calibrate').style.background = '#2a5a2a';
    this.onUpdate();
  }

  /**
   * Check if currently calibrating
   * @returns {boolean} True if in calibration mode
   */
  isCalibrating() {
    return this.state.calibrating;
  }
}
