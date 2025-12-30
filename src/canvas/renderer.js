/**
 * Canvas Renderer Module
 * Provides utilities for drawing shapes, text, grids, and handling image operations on HTML5 canvas
 */

class CanvasRenderer {
  /**
   * Initialize the canvas renderer
   * @param {HTMLCanvasElement} canvas - The canvas element to render on
   * @param {Object} options - Configuration options
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Default options
    this.options = {
      backgroundColor: options.backgroundColor || '#ffffff',
      defaultLineWidth: options.defaultLineWidth || 2,
      defaultFillColor: options.defaultFillColor || '#000000',
      defaultStrokeColor: options.defaultStrokeColor || '#000000',
      ...options
    };
    
    // Initialize canvas
    this.clear();
  }

  /**
   * Clear the entire canvas
   * @param {string} color - Background color (defaults to configured color)
   */
  clear(color = this.options.backgroundColor) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Resize the canvas
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.clear();
  }

  /**
   * Get current canvas dimensions
   * @returns {Object} {width, height}
   */
  getDimensions() {
    return {
      width: this.width,
      height: this.height
    };
  }

  // ============ SHAPE DRAWING UTILITIES ============

  /**
   * Draw a rectangle
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {Object} options - Drawing options
   */
  drawRectangle(x, y, width, height, options = {}) {
    const {
      fill = true,
      stroke = false,
      fillColor = this.options.defaultFillColor,
      strokeColor = this.options.defaultStrokeColor,
      lineWidth = this.options.defaultLineWidth,
      rotation = 0
    } = options;

    this.ctx.save();
    
    if (rotation !== 0) {
      this.ctx.translate(x + width / 2, y + height / 2);
      this.ctx.rotate(rotation);
      x = -width / 2;
      y = -height / 2;
    }

    if (fill) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(x, y, width, height);
    }

    if (stroke) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.strokeRect(x, y, width, height);
    }

    this.ctx.restore();
  }

  /**
   * Draw a circle
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} radius - Circle radius
   * @param {Object} options - Drawing options
   */
  drawCircle(x, y, radius, options = {}) {
    const {
      fill = true,
      stroke = false,
      fillColor = this.options.defaultFillColor,
      strokeColor = this.options.defaultStrokeColor,
      lineWidth = this.options.defaultLineWidth
    } = options;

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);

    if (fill) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (stroke) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }

  /**
   * Draw an ellipse
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} radiusX - Horizontal radius
   * @param {number} radiusY - Vertical radius
   * @param {Object} options - Drawing options
   */
  drawEllipse(x, y, radiusX, radiusY, options = {}) {
    const {
      fill = true,
      stroke = false,
      fillColor = this.options.defaultFillColor,
      strokeColor = this.options.defaultStrokeColor,
      lineWidth = this.options.defaultLineWidth,
      rotation = 0
    } = options;

    this.ctx.save();
    
    if (rotation !== 0) {
      this.ctx.translate(x, y);
      this.ctx.rotate(rotation);
      x = 0;
      y = 0;
    }

    this.ctx.beginPath();
    this.ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);

    if (fill) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (stroke) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * Draw a polygon
   * @param {Array<Array<number>>} points - Array of [x, y] points
   * @param {Object} options - Drawing options
   */
  drawPolygon(points, options = {}) {
    if (points.length < 3) {
      console.warn('Polygon requires at least 3 points');
      return;
    }

    const {
      fill = true,
      stroke = false,
      fillColor = this.options.defaultFillColor,
      strokeColor = this.options.defaultStrokeColor,
      lineWidth = this.options.defaultLineWidth,
      closed = true
    } = options;

    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i][0], points[i][1]);
    }

    if (closed) {
      this.ctx.closePath();
    }

    if (fill) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (stroke) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }

  /**
   * Draw a line
   * @param {number} x1 - Start X coordinate
   * @param {number} y1 - Start Y coordinate
   * @param {number} x2 - End X coordinate
   * @param {number} y2 - End Y coordinate
   * @param {Object} options - Drawing options
   */
  drawLine(x1, y1, x2, y2, options = {}) {
    const {
      strokeColor = this.options.defaultStrokeColor,
      lineWidth = this.options.defaultLineWidth,
      lineCap = 'round',
      lineJoin = 'round'
    } = options;

    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = lineCap;
    this.ctx.lineJoin = lineJoin;
    this.ctx.stroke();
  }

  /**
   * Draw a bezier curve
   * @param {number} x1 - Start X
   * @param {number} y1 - Start Y
   * @param {number} cp1x - Control point 1 X
   * @param {number} cp1y - Control point 1 Y
   * @param {number} cp2x - Control point 2 X
   * @param {number} cp2y - Control point 2 Y
   * @param {number} x2 - End X
   * @param {number} y2 - End Y
   * @param {Object} options - Drawing options
   */
  drawBezierCurve(x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2, options = {}) {
    const {
      strokeColor = this.options.defaultStrokeColor,
      lineWidth = this.options.defaultLineWidth
    } = options;

    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.stroke();
  }

  /**
   * Draw an arc
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Radius
   * @param {number} startAngle - Start angle in radians
   * @param {number} endAngle - End angle in radians
   * @param {Object} options - Drawing options
   */
  drawArc(x, y, radius, startAngle, endAngle, options = {}) {
    const {
      fill = false,
      stroke = true,
      fillColor = this.options.defaultFillColor,
      strokeColor = this.options.defaultStrokeColor,
      lineWidth = this.options.defaultLineWidth,
      counterClockwise = false
    } = options;

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, startAngle, endAngle, counterClockwise);

    if (fill) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (stroke) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }

  /**
   * Draw a sector (pie slice)
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Radius
   * @param {number} startAngle - Start angle in radians
   * @param {number} endAngle - End angle in radians
   * @param {Object} options - Drawing options
   */
  drawSector(x, y, radius, startAngle, endAngle, options = {}) {
    const {
      fill = true,
      stroke = false,
      fillColor = this.options.defaultFillColor,
      strokeColor = this.options.defaultStrokeColor,
      lineWidth = this.options.defaultLineWidth
    } = options;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.arc(x, y, radius, startAngle, endAngle);
    this.ctx.closePath();

    if (fill) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (stroke) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }

  // ============ TEXT DRAWING UTILITIES ============

  /**
   * Draw text
   * @param {string} text - Text to draw
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} options - Drawing options
   */
  drawText(text, x, y, options = {}) {
    const {
      fontSize = 16,
      fontFamily = 'Arial',
      fillColor = this.options.defaultFillColor,
      strokeColor = null,
      lineWidth = 1,
      textAlign = 'left',
      textBaseline = 'top',
      maxWidth = null,
      rotation = 0,
      fontWeight = 'normal',
      fontStyle = 'normal'
    } = options;

    this.ctx.save();

    if (rotation !== 0) {
      this.ctx.translate(x, y);
      this.ctx.rotate(rotation);
      x = 0;
      y = 0;
    }

    const font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    this.ctx.font = font;
    this.ctx.textAlign = textAlign;
    this.ctx.textBaseline = textBaseline;

    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fillText(text, x, y, maxWidth);
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.strokeText(text, x, y, maxWidth);
    }

    this.ctx.restore();
  }

  /**
   * Draw multi-line text
   * @param {string} text - Text to draw
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} lineHeight - Height between lines
   * @param {Object} options - Drawing options
   */
  drawMultilineText(text, x, y, lineHeight = 20, options = {}) {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      this.drawText(line, x, y + index * lineHeight, options);
    });
  }

  /**
   * Get text metrics
   * @param {string} text - Text to measure
   * @param {Object} options - Font options
   * @returns {TextMetrics} Text metrics
   */
  getTextMetrics(text, options = {}) {
    const {
      fontSize = 16,
      fontFamily = 'Arial',
      fontWeight = 'normal',
      fontStyle = 'normal'
    } = options;

    const font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    this.ctx.font = font;
    return this.ctx.measureText(text);
  }

  // ============ GRID DRAWING UTILITIES ============

  /**
   * Draw a grid
   * @param {number} cellSize - Size of each grid cell
   * @param {Object} options - Drawing options
   */
  drawGrid(cellSize, options = {}) {
    const {
      strokeColor = '#cccccc',
      lineWidth = 1,
      offsetX = 0,
      offsetY = 0
    } = options;

    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = lineWidth;

    // Vertical lines
    for (let x = offsetX % cellSize; x < this.width; x += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY % cellSize; y < this.height; y += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
  }

  /**
   * Draw a dotted grid
   * @param {number} cellSize - Size of each grid cell
   * @param {Object} options - Drawing options
   */
  drawDottedGrid(cellSize, options = {}) {
    const {
      dotColor = '#cccccc',
      dotRadius = 2,
      offsetX = 0,
      offsetY = 0
    } = options;

    this.ctx.fillStyle = dotColor;

    for (let x = offsetX % cellSize; x < this.width; x += cellSize) {
      for (let y = offsetY % cellSize; y < this.height; y += cellSize) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  /**
   * Draw axis indicators
   * @param {Object} options - Drawing options
   */
  drawAxisIndicators(options = {}) {
    const {
      showOrigin = true,
      originX = 0,
      originY = 0,
      axisColor = '#ff0000',
      axisWidth = 2,
      labelFontSize = 12
    } = options;

    this.ctx.strokeStyle = axisColor;
    this.ctx.lineWidth = axisWidth;

    // X-axis (red)
    this.ctx.beginPath();
    this.ctx.moveTo(0, originY);
    this.ctx.lineTo(this.width, originY);
    this.ctx.stroke();

    // Y-axis (blue)
    this.ctx.strokeStyle = '#0000ff';
    this.ctx.beginPath();
    this.ctx.moveTo(originX, 0);
    this.ctx.lineTo(originX, this.height);
    this.ctx.stroke();

    if (showOrigin) {
      this.drawCircle(originX, originY, 5, {
        fill: true,
        fillColor: '#000000'
      });
    }
  }

  // ============ IMAGE OPERATIONS ============

  /**
   * Draw an image on the canvas
   * @param {HTMLImageElement|HTMLCanvasElement} image - Image to draw
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} options - Drawing options
   */
  drawImage(image, x, y, options = {}) {
    const {
      width = image.width,
      height = image.height,
      rotation = 0,
      opacity = 1,
      scaleX = 1,
      scaleY = 1
    } = options;

    this.ctx.save();
    this.ctx.globalAlpha = opacity;

    if (rotation !== 0) {
      this.ctx.translate(x + width / 2, y + height / 2);
      this.ctx.rotate(rotation);
      this.ctx.scale(scaleX, scaleY);
      this.ctx.drawImage(image, -width / 2, -height / 2, width, height);
    } else {
      this.ctx.scale(scaleX, scaleY);
      this.ctx.drawImage(image, x, y, width, height);
    }

    this.ctx.restore();
  }

  /**
   * Draw an image with tiling
   * @param {HTMLImageElement} image - Image to tile
   * @param {number} offsetX - Horizontal offset
   * @param {number} offsetY - Vertical offset
   * @param {Object} options - Drawing options
   */
  drawTiledImage(image, offsetX = 0, offsetY = 0, options = {}) {
    const { opacity = 1 } = options;

    const pattern = this.ctx.createPattern(image, 'repeat');
    
    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    this.ctx.translate(offsetX, offsetY);
    this.ctx.fillStyle = pattern;
    this.ctx.fillRect(-offsetX, -offsetY, this.width, this.height);
    this.ctx.restore();
  }

  /**
   * Load an image from URL
   * @param {string} url - Image URL
   * @returns {Promise<HTMLImageElement>} Loaded image
   */
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  /**
   * Get canvas as image data
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} width - Width
   * @param {number} height - Height
   * @returns {ImageData} Image data
   */
  getImageData(x, y, width, height) {
    return this.ctx.getImageData(x, y, width, height);
  }

  /**
   * Put image data on canvas
   * @param {ImageData} imageData - Image data to put
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  putImageData(imageData, x, y) {
    this.ctx.putImageData(imageData, x, y);
  }

  /**
   * Apply a filter/effect to the canvas (using canvas filters)
   * @param {string} filter - CSS filter string (e.g., 'blur(5px)', 'grayscale(100%)')
   */
  applyFilter(filter) {
    this.ctx.filter = filter;
  }

  /**
   * Export canvas as data URL
   * @param {string} type - Image type (default: 'image/png')
   * @param {number} quality - Quality (0-1, for jpeg)
   * @returns {string} Data URL
   */
  exportAsDataURL(type = 'image/png', quality = 1) {
    return this.canvas.toDataURL(type, quality);
  }

  /**
   * Download canvas as image file
   * @param {string} filename - Output filename
   * @param {string} type - Image type (default: 'image/png')
   */
  downloadAsImage(filename = 'canvas.png', type = 'image/png') {
    const link = document.createElement('a');
    link.href = this.exportAsDataURL(type);
    link.download = filename;
    link.click();
  }

  // ============ TRANSFORMATION UTILITIES ============

  /**
   * Save canvas state
   */
  save() {
    this.ctx.save();
  }

  /**
   * Restore canvas state
   */
  restore() {
    this.ctx.restore();
  }

  /**
   * Translate the canvas
   * @param {number} x - X offset
   * @param {number} y - Y offset
   */
  translate(x, y) {
    this.ctx.translate(x, y);
  }

  /**
   * Rotate the canvas
   * @param {number} angle - Rotation angle in radians
   */
  rotate(angle) {
    this.ctx.rotate(angle);
  }

  /**
   * Scale the canvas
   * @param {number} scaleX - Horizontal scale
   * @param {number} scaleY - Vertical scale
   */
  scale(scaleX, scaleY) {
    this.ctx.scale(scaleX, scaleY);
  }

  /**
   * Set global alpha (opacity)
   * @param {number} alpha - Opacity (0-1)
   */
  setAlpha(alpha) {
    this.ctx.globalAlpha = alpha;
  }

  /**
   * Set composite operation
   * @param {string} operation - Composite operation
   */
  setCompositeOperation(operation) {
    this.ctx.globalCompositeOperation = operation;
  }
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasRenderer;
}
