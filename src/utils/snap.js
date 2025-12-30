/**
 * Snap Utilities for LeatherPatternTool
 * Provides snap-to-grid and guide snapping functionality for precise pattern placement
 */

/**
 * Configuration for snapping behavior
 */
const SnapConfig = {
  GRID_SIZE: 10, // Default grid size in pixels
  SNAP_THRESHOLD: 8, // Distance within which snapping occurs
  GUIDE_THRESHOLD: 5, // Distance threshold for guide snapping
  SNAP_ENABLED: true,
  GRID_SNAP_ENABLED: true,
  GUIDE_SNAP_ENABLED: true,
};

/**
 * Snap a value to the nearest grid increment
 * @param {number} value - The value to snap
 * @param {number} gridSize - The grid size (default: SnapConfig.GRID_SIZE)
 * @returns {number} The snapped value
 */
function snapToGrid(value, gridSize = SnapConfig.GRID_SIZE) {
  if (!SnapConfig.SNAP_ENABLED || !SnapConfig.GRID_SNAP_ENABLED) {
    return value;
  }
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a point (x, y) to the grid
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} gridSize - The grid size (default: SnapConfig.GRID_SIZE)
 * @returns {Object} Object with snapped x and y coordinates
 */
function snapPointToGrid(x, y, gridSize = SnapConfig.GRID_SIZE) {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

/**
 * Check if a value should snap to a guide position
 * @param {number} value - The current value
 * @param {number} guidePosition - The guide position to snap to
 * @param {number} threshold - Snap threshold (default: SnapConfig.GUIDE_THRESHOLD)
 * @returns {Object} Object with shouldSnap (boolean) and snappedValue (number)
 */
function checkGuideSnap(value, guidePosition, threshold = SnapConfig.GUIDE_THRESHOLD) {
  if (!SnapConfig.SNAP_ENABLED || !SnapConfig.GUIDE_SNAP_ENABLED) {
    return { shouldSnap: false, snappedValue: value };
  }

  const distance = Math.abs(value - guidePosition);
  const shouldSnap = distance <= threshold;

  return {
    shouldSnap,
    snappedValue: shouldSnap ? guidePosition : value,
    distance,
  };
}

/**
 * Find the closest guide to snap to from a list of guides
 * @param {number} value - The current value
 * @param {Array<number>} guides - Array of guide positions
 * @param {number} threshold - Snap threshold (default: SnapConfig.GUIDE_THRESHOLD)
 * @returns {Object} Object with shouldSnap, snappedValue, and guideIndex
 */
function findClosestGuideSnap(value, guides = [], threshold = SnapConfig.GUIDE_THRESHOLD) {
  if (!SnapConfig.SNAP_ENABLED || !SnapConfig.GUIDE_SNAP_ENABLED || guides.length === 0) {
    return { shouldSnap: false, snappedValue: value, guideIndex: -1 };
  }

  let closestDistance = threshold;
  let closestIndex = -1;
  let closestGuideValue = value;

  guides.forEach((guide, index) => {
    const distance = Math.abs(value - guide);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
      closestGuideValue = guide;
    }
  });

  return {
    shouldSnap: closestIndex !== -1,
    snappedValue: closestGuideValue,
    guideIndex: closestIndex,
    distance: closestDistance,
  };
}

/**
 * Snap a point to guides (vertical and horizontal)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Array<number>} verticalGuides - Vertical guide positions
 * @param {Array<number>} horizontalGuides - Horizontal guide positions
 * @param {number} threshold - Snap threshold
 * @returns {Object} Object with snapped x, y and information about snapped guides
 */
function snapPointToGuides(
  x,
  y,
  verticalGuides = [],
  horizontalGuides = [],
  threshold = SnapConfig.GUIDE_THRESHOLD
) {
  const xSnap = findClosestGuideSnap(x, verticalGuides, threshold);
  const ySnap = findClosestGuideSnap(y, horizontalGuides, threshold);

  return {
    x: xSnap.snappedValue,
    y: ySnap.snappedValue,
    snappedToVerticalGuide: xSnap.shouldSnap,
    snappedToHorizontalGuide: ySnap.shouldSnap,
    verticalGuideIndex: xSnap.guideIndex,
    horizontalGuideIndex: ySnap.guideIndex,
  };
}

/**
 * Snap a rectangle to guides and grid
 * @param {Object} rect - Rectangle object with x, y, width, height
 * @param {Array<number>} verticalGuides - Vertical guide positions
 * @param {Array<number>} horizontalGuides - Horizontal guide positions
 * @param {number} gridSize - Grid size for snapping
 * @param {boolean} snapToGuides - Whether to snap to guides
 * @returns {Object} Snapped rectangle with metadata
 */
function snapRectangle(
  rect,
  verticalGuides = [],
  horizontalGuides = [],
  gridSize = SnapConfig.GRID_SIZE,
  snapToGuides = true
) {
  let snappedRect = { ...rect };

  // Snap to grid first
  if (SnapConfig.GRID_SNAP_ENABLED) {
    snappedRect.x = snapToGrid(snappedRect.x, gridSize);
    snappedRect.y = snapToGrid(snappedRect.y, gridSize);
    snappedRect.width = snapToGrid(snappedRect.width, gridSize);
    snappedRect.height = snapToGrid(snappedRect.height, gridSize);
  }

  // Then snap to guides
  if (snapToGuides && SnapConfig.GUIDE_SNAP_ENABLED) {
    const guideSnap = snapPointToGuides(
      snappedRect.x,
      snappedRect.y,
      verticalGuides,
      horizontalGuides
    );

    snappedRect.x = guideSnap.x;
    snappedRect.y = guideSnap.y;
    snappedRect.snappedToVerticalGuide = guideSnap.snappedToVerticalGuide;
    snappedRect.snappedToHorizontalGuide = guideSnap.snappedToHorizontalGuide;
  }

  return snappedRect;
}

/**
 * Get grid lines for visualization
 * @param {number} width - Canvas/container width
 * @param {number} height - Canvas/container height
 * @param {number} gridSize - Grid size (default: SnapConfig.GRID_SIZE)
 * @returns {Object} Object with arrays of vertical and horizontal grid line positions
 */
function getGridLines(width, height, gridSize = SnapConfig.GRID_SIZE) {
  const verticalLines = [];
  const horizontalLines = [];

  for (let x = 0; x <= width; x += gridSize) {
    verticalLines.push(x);
  }

  for (let y = 0; y <= height; y += gridSize) {
    horizontalLines.push(y);
  }

  return {
    vertical: verticalLines,
    horizontal: horizontalLines,
  };
}

/**
 * Set snap configuration
 * @param {Object} config - Configuration object with properties to update
 */
function setSnapConfig(config) {
  Object.assign(SnapConfig, config);
}

/**
 * Get current snap configuration
 * @returns {Object} Current snap configuration
 */
function getSnapConfig() {
  return { ...SnapConfig };
}

/**
 * Disable snapping temporarily
 * @param {Function} callback - Function to execute with snapping disabled
 * @returns {*} Return value of the callback
 */
function withSnapDisabled(callback) {
  const wasEnabled = SnapConfig.SNAP_ENABLED;
  SnapConfig.SNAP_ENABLED = false;
  try {
    return callback();
  } finally {
    SnapConfig.SNAP_ENABLED = wasEnabled;
  }
}

/**
 * Enable snapping
 */
function enableSnap() {
  SnapConfig.SNAP_ENABLED = true;
}

/**
 * Disable snapping
 */
function disableSnap() {
  SnapConfig.SNAP_ENABLED = false;
}

/**
 * Check if any snapping is enabled
 * @returns {boolean} True if snapping is enabled
 */
function isSnapEnabled() {
  return SnapConfig.SNAP_ENABLED;
}

export {
  SnapConfig,
  snapToGrid,
  snapPointToGrid,
  checkGuideSnap,
  findClosestGuideSnap,
  snapPointToGuides,
  snapRectangle,
  getGridLines,
  setSnapConfig,
  getSnapConfig,
  withSnapDisabled,
  enableSnap,
  disableSnap,
  isSnapEnabled,
};
