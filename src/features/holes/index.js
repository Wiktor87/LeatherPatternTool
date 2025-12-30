/**
 * Holes Feature Module
 * Comprehensive utilities for hole creation, editing, validation, and rendering
 * in the LeatherPatternTool application
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const HOLE_TYPES = {
  ROUND: 'round',
  OVAL: 'oval',
  RECTANGULAR: 'rectangular',
  DIAMOND: 'diamond',
  CUSTOM: 'custom'
};

const HOLE_DEFAULTS = {
  type: HOLE_TYPES.ROUND,
  diameter: 5,
  width: 5,
  height: 5,
  rotation: 0,
  fillColor: '#000000',
  strokeColor: '#000000',
  strokeWidth: 0.5,
  opacity: 1
};

const MIN_DIMENSIONS = {
  diameter: 1,
  width: 1,
  height: 1
};

const MAX_DIMENSIONS = {
  diameter: 100,
  width: 100,
  height: 100
};

const VALIDATION_RULES = {
  minDiameter: 1,
  maxDiameter: 100,
  minWidth: 1,
  maxWidth: 100,
  minHeight: 1,
  maxHeight: 100,
  minRotation: 0,
  maxRotation: 360,
  minOpacity: 0,
  maxOpacity: 1,
  minStrokeWidth: 0,
  maxStrokeWidth: 10
};

// ============================================================================
// CREATION UTILITIES
// ============================================================================

/**
 * Create a new hole object with default values
 * @param {Object} options - Custom options to override defaults
 * @returns {Object} New hole object
 */
function createHole(options = {}) {
  const hole = {
    id: generateHoleId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...HOLE_DEFAULTS,
    ...options
  };

  return hole;
}

/**
 * Generate a unique hole ID
 * @returns {string} Unique hole ID
 */
function generateHoleId() {
  return `hole_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a round hole
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} diameter - Hole diameter
 * @param {Object} options - Additional options
 * @returns {Object} Round hole object
 */
function createRoundHole(x, y, diameter, options = {}) {
  return createHole({
    type: HOLE_TYPES.ROUND,
    x,
    y,
    diameter,
    ...options
  });
}

/**
 * Create an oval hole
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Oval width
 * @param {number} height - Oval height
 * @param {number} rotation - Rotation in degrees
 * @param {Object} options - Additional options
 * @returns {Object} Oval hole object
 */
function createOvalHole(x, y, width, height, rotation = 0, options = {}) {
  return createHole({
    type: HOLE_TYPES.OVAL,
    x,
    y,
    width,
    height,
    rotation,
    ...options
  });
}

/**
 * Create a rectangular hole
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @param {number} rotation - Rotation in degrees
 * @param {Object} options - Additional options
 * @returns {Object} Rectangular hole object
 */
function createRectangularHole(x, y, width, height, rotation = 0, options = {}) {
  return createHole({
    type: HOLE_TYPES.RECTANGULAR,
    x,
    y,
    width,
    height,
    rotation,
    ...options
  });
}

/**
 * Create a diamond hole
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Diamond width
 * @param {number} height - Diamond height
 * @param {number} rotation - Rotation in degrees
 * @param {Object} options - Additional options
 * @returns {Object} Diamond hole object
 */
function createDiamondHole(x, y, width, height, rotation = 0, options = {}) {
  return createHole({
    type: HOLE_TYPES.DIAMOND,
    x,
    y,
    width,
    height,
    rotation,
    ...options
  });
}

/**
 * Create multiple holes in a grid pattern
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} cols - Number of columns
 * @param {number} rows - Number of rows
 * @param {number} spacing - Spacing between holes
 * @param {Object} holeOptions - Hole options
 * @returns {Array} Array of hole objects
 */
function createHoleGrid(startX, startY, cols, rows, spacing, holeOptions = {}) {
  const holes = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = startX + col * spacing;
      const y = startY + row * spacing;
      holes.push(createHole({ x, y, ...holeOptions }));
    }
  }

  return holes;
}

/**
 * Create holes in a circular pattern
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} radius - Radius from center
 * @param {number} count - Number of holes
 * @param {Object} holeOptions - Hole options
 * @returns {Array} Array of hole objects
 */
function createHoleCirclePattern(centerX, centerY, radius, count, holeOptions = {}) {
  const holes = [];
  const angleStep = (2 * Math.PI) / count;

  for (let i = 0; i < count; i++) {
    const angle = i * angleStep;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    holes.push(createHole({ x, y, ...holeOptions }));
  }

  return holes;
}

// ============================================================================
// EDITING UTILITIES
// ============================================================================

/**
 * Update hole properties
 * @param {Object} hole - Original hole object
 * @param {Object} updates - Properties to update
 * @returns {Object} Updated hole object
 */
function updateHole(hole, updates) {
  return {
    ...hole,
    ...updates,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Move a hole to a new position
 * @param {Object} hole - Hole object
 * @param {number} x - New X coordinate
 * @param {number} y - New Y coordinate
 * @returns {Object} Updated hole object
 */
function moveHole(hole, x, y) {
  return updateHole(hole, { x, y });
}

/**
 * Resize a hole
 * @param {Object} hole - Hole object
 * @param {number} width - New width
 * @param {number} height - New height
 * @returns {Object} Updated hole object
 */
function resizeHole(hole, width, height) {
  if (hole.type === HOLE_TYPES.ROUND) {
    return updateHole(hole, { diameter: width });
  }
  return updateHole(hole, { width, height });
}

/**
 * Rotate a hole
 * @param {Object} hole - Hole object
 * @param {number} rotation - New rotation in degrees
 * @returns {Object} Updated hole object
 */
function rotateHole(hole, rotation) {
  const normalizedRotation = rotation % 360;
  return updateHole(hole, { rotation: normalizedRotation >= 0 ? normalizedRotation : 360 + normalizedRotation });
}

/**
 * Change hole type
 * @param {Object} hole - Hole object
 * @param {string} newType - New hole type
 * @param {Object} options - Additional options for new type
 * @returns {Object} Updated hole object
 */
function changeHoleType(hole, newType, options = {}) {
  if (!Object.values(HOLE_TYPES).includes(newType)) {
    throw new Error(`Invalid hole type: ${newType}`);
  }

  const updates = { type: newType, ...options };
  return updateHole(hole, updates);
}

/**
 * Duplicate a hole
 * @param {Object} hole - Hole object to duplicate
 * @param {Object} offsetOptions - Offset position options
 * @returns {Object} Duplicated hole object
 */
function duplicateHole(hole, offsetOptions = {}) {
  const { offsetX = 0, offsetY = 0 } = offsetOptions;
  const newHole = createHole({
    ...hole,
    x: hole.x + offsetX,
    y: hole.y + offsetY
  });
  delete newHole.id;
  newHole.id = generateHoleId();
  return newHole;
}

/**
 * Flip a hole horizontally
 * @param {Object} hole - Hole object
 * @param {number} axisX - X axis to flip around
 * @returns {Object} Updated hole object
 */
function flipHoleHorizontal(hole, axisX) {
  const newX = 2 * axisX - hole.x;
  return moveHole(hole, newX, hole.y);
}

/**
 * Flip a hole vertically
 * @param {Object} hole - Hole object
 * @param {number} axisY - Y axis to flip around
 * @returns {Object} Updated hole object
 */
function flipHoleVertical(hole, axisY) {
  const newY = 2 * axisY - hole.y;
  return moveHole(hole, hole.x, newY);
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate a hole object
 * @param {Object} hole - Hole object to validate
 * @returns {Object} Validation result { valid: boolean, errors: Array }
 */
function validateHole(hole) {
  const errors = [];

  // Validate required properties
  if (!hole.id) errors.push('Missing hole ID');
  if (hole.x === undefined || hole.x === null) errors.push('Missing X coordinate');
  if (hole.y === undefined || hole.y === null) errors.push('Missing Y coordinate');
  if (!hole.type) errors.push('Missing hole type');

  // Validate type
  if (hole.type && !Object.values(HOLE_TYPES).includes(hole.type)) {
    errors.push(`Invalid hole type: ${hole.type}`);
  }

  // Validate dimensions based on type
  if (hole.type === HOLE_TYPES.ROUND) {
    if (!validateDimension(hole.diameter, VALIDATION_RULES.minDiameter, VALIDATION_RULES.maxDiameter)) {
      errors.push(`Diameter must be between ${VALIDATION_RULES.minDiameter} and ${VALIDATION_RULES.maxDiameter}`);
    }
  } else {
    if (!validateDimension(hole.width, VALIDATION_RULES.minWidth, VALIDATION_RULES.maxWidth)) {
      errors.push(`Width must be between ${VALIDATION_RULES.minWidth} and ${VALIDATION_RULES.maxWidth}`);
    }
    if (!validateDimension(hole.height, VALIDATION_RULES.minHeight, VALIDATION_RULES.maxHeight)) {
      errors.push(`Height must be between ${VALIDATION_RULES.minHeight} and ${VALIDATION_RULES.maxHeight}`);
    }
  }

  // Validate rotation
  if (hole.rotation !== undefined && hole.rotation !== null) {
    if (!validateDimension(hole.rotation, VALIDATION_RULES.minRotation, VALIDATION_RULES.maxRotation)) {
      errors.push(`Rotation must be between ${VALIDATION_RULES.minRotation} and ${VALIDATION_RULES.maxRotation}`);
    }
  }

  // Validate opacity
  if (hole.opacity !== undefined && hole.opacity !== null) {
    if (!validateDimension(hole.opacity, VALIDATION_RULES.minOpacity, VALIDATION_RULES.maxOpacity)) {
      errors.push(`Opacity must be between ${VALIDATION_RULES.minOpacity} and ${VALIDATION_RULES.maxOpacity}`);
    }
  }

  // Validate stroke width
  if (hole.strokeWidth !== undefined && hole.strokeWidth !== null) {
    if (!validateDimension(hole.strokeWidth, VALIDATION_RULES.minStrokeWidth, VALIDATION_RULES.maxStrokeWidth)) {
      errors.push(`Stroke width must be between ${VALIDATION_RULES.minStrokeWidth} and ${VALIDATION_RULES.maxStrokeWidth}`);
    }
  }

  // Validate colors
  if (hole.fillColor && !isValidColor(hole.fillColor)) {
    errors.push(`Invalid fill color: ${hole.fillColor}`);
  }
  if (hole.strokeColor && !isValidColor(hole.strokeColor)) {
    errors.push(`Invalid stroke color: ${hole.strokeColor}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a single dimension value
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {boolean} True if valid
 */
function validateDimension(value, min, max) {
  return typeof value === 'number' && value >= min && value <= max;
}

/**
 * Check if a color is valid (hex or rgb format)
 * @param {string} color - Color string to validate
 * @returns {boolean} True if valid color
 */
function isValidColor(color) {
  // Check for hex color
  if (/^#[0-9A-F]{6}$/i.test(color)) {
    return true;
  }
  // Check for rgb color
  if (/^rgb\(\d+,\s*\d+,\s*\d+\)$/i.test(color)) {
    return true;
  }
  // Check for rgba color
  if (/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/i.test(color)) {
    return true;
  }
  return false;
}

/**
 * Validate multiple holes
 * @param {Array} holes - Array of hole objects
 * @returns {Object} Validation result { valid: boolean, results: Array }
 */
function validateHoles(holes) {
  const results = holes.map((hole, index) => ({
    index,
    hole: hole.id,
    ...validateHole(hole)
  }));

  return {
    valid: results.every(r => r.valid),
    results
  };
}

// ============================================================================
// RENDERING UTILITIES
// ============================================================================

/**
 * Get SVG path for a hole shape
 * @param {Object} hole - Hole object
 * @returns {string} SVG path string
 */
function getHolePath(hole) {
  switch (hole.type) {
    case HOLE_TYPES.ROUND:
      return getCirclePath(hole.x, hole.y, hole.diameter / 2);
    case HOLE_TYPES.OVAL:
      return getEllipsePath(hole.x, hole.y, hole.width / 2, hole.height / 2, hole.rotation);
    case HOLE_TYPES.RECTANGULAR:
      return getRectanglePath(hole.x, hole.y, hole.width, hole.height, hole.rotation);
    case HOLE_TYPES.DIAMOND:
      return getDiamondPath(hole.x, hole.y, hole.width, hole.height, hole.rotation);
    default:
      return '';
  }
}

/**
 * Get SVG circle path
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {number} r - Radius
 * @returns {string} SVG path
 */
function getCirclePath(x, y, r) {
  return `M ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y}`;
}

/**
 * Get SVG ellipse path
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} rx - Horizontal radius
 * @param {number} ry - Vertical radius
 * @param {number} rotation - Rotation in degrees
 * @returns {string} SVG path
 */
function getEllipsePath(cx, cy, rx, ry, rotation = 0) {
  const rad = (rotation * Math.PI) / 180;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotation} ${cx} ${cy})"/>`;
}

/**
 * Get SVG rectangle path
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} rotation - Rotation in degrees
 * @returns {string} SVG path
 */
function getRectanglePath(x, y, width, height, rotation = 0) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const left = x - halfWidth;
  const top = y - halfHeight;
  return `<rect x="${left}" y="${top}" width="${width}" height="${height}" transform="rotate(${rotation} ${x} ${y})"/>`;
}

/**
 * Get SVG diamond path
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} rotation - Rotation in degrees
 * @returns {string} SVG path
 */
function getDiamondPath(cx, cy, width, height, rotation = 0) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const points = [
    [cx, cy - halfHeight],
    [cx + halfWidth, cy],
    [cx, cy + halfHeight],
    [cx - halfWidth, cy]
  ];
  const rotatedPoints = points.map(p => rotatePoint(p[0], p[1], cx, cy, rotation));
  const pathString = rotatedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
  return pathString;
}

/**
 * Rotate a point around a center
 * @param {number} x - Point X
 * @param {number} y - Point Y
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} angle - Rotation angle in degrees
 * @returns {Array} [newX, newY]
 */
function rotatePoint(x, y, cx, cy, angle) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const nx = (x - cx) * cos - (y - cy) * sin + cx;
  const ny = (x - cx) * sin + (y - cy) * cos + cy;
  return [nx, ny];
}

/**
 * Create SVG element for a hole
 * @param {Object} hole - Hole object
 * @param {Object} svgOptions - SVG rendering options
 * @returns {string} SVG element string
 */
function createHoleSVG(hole, svgOptions = {}) {
  const {
    strokeWidth = hole.strokeWidth || 0.5,
    fillColor = hole.fillColor || '#000000',
    strokeColor = hole.strokeColor || '#000000',
    opacity = hole.opacity || 1,
    id = hole.id
  } = svgOptions;

  const baseAttributes = `
    id="${id}"
    fill="${fillColor}"
    stroke="${strokeColor}"
    stroke-width="${strokeWidth}"
    opacity="${opacity}"
  `;

  switch (hole.type) {
    case HOLE_TYPES.ROUND:
      return `<circle cx="${hole.x}" cy="${hole.y}" r="${hole.diameter / 2}" ${baseAttributes}/>`;
    case HOLE_TYPES.OVAL:
      return `<ellipse cx="${hole.x}" cy="${hole.y}" rx="${hole.width / 2}" ry="${hole.height / 2}" transform="rotate(${hole.rotation} ${hole.x} ${hole.y})" ${baseAttributes}/>`;
    case HOLE_TYPES.RECTANGULAR:
      return `<rect x="${hole.x - hole.width / 2}" y="${hole.y - hole.height / 2}" width="${hole.width}" height="${hole.height}" transform="rotate(${hole.rotation} ${hole.x} ${hole.y})" ${baseAttributes}/>`;
    case HOLE_TYPES.DIAMOND:
      const path = getDiamondPath(hole.x, hole.y, hole.width, hole.height, hole.rotation);
      return `<path d="${path}" ${baseAttributes}/>`;
    default:
      return '';
  }
}

/**
 * Get bounding box for a hole
 * @param {Object} hole - Hole object
 * @returns {Object} Bounding box { x, y, width, height }
 */
function getHoleBoundingBox(hole) {
  let width, height;

  if (hole.type === HOLE_TYPES.ROUND) {
    width = height = hole.diameter;
  } else {
    width = hole.width;
    height = hole.height;
  }

  // For rotated shapes, calculate the rotated bounding box
  if (hole.rotation && hole.type !== HOLE_TYPES.ROUND) {
    const angle = (hole.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const rotatedWidth = width * cos + height * sin;
    const rotatedHeight = width * sin + height * cos;
    return {
      x: hole.x - rotatedWidth / 2,
      y: hole.y - rotatedHeight / 2,
      width: rotatedWidth,
      height: rotatedHeight
    };
  }

  return {
    x: hole.x - width / 2,
    y: hole.y - height / 2,
    width,
    height
  };
}

/**
 * Check if a point is inside a hole
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {Object} hole - Hole object
 * @returns {boolean} True if point is inside hole
 */
function isPointInHole(px, py, hole) {
  const bbox = getHoleBoundingBox(hole);
  return px >= bbox.x && px <= bbox.x + bbox.width && py >= bbox.y && py <= bbox.y + bbox.height;
}

// ============================================================================
// EXPORT
// ============================================================================

module.exports = {
  // Constants
  HOLE_TYPES,
  HOLE_DEFAULTS,
  MIN_DIMENSIONS,
  MAX_DIMENSIONS,
  VALIDATION_RULES,

  // Creation
  createHole,
  generateHoleId,
  createRoundHole,
  createOvalHole,
  createRectangularHole,
  createDiamondHole,
  createHoleGrid,
  createHoleCirclePattern,

  // Editing
  updateHole,
  moveHole,
  resizeHole,
  rotateHole,
  changeHoleType,
  duplicateHole,
  flipHoleHorizontal,
  flipHoleVertical,

  // Validation
  validateHole,
  validateDimension,
  isValidColor,
  validateHoles,

  // Rendering
  getHolePath,
  getCirclePath,
  getEllipsePath,
  getRectanglePath,
  getDiamondPath,
  rotatePoint,
  createHoleSVG,
  getHoleBoundingBox,
  isPointInHole
};
