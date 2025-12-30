/**
 * Geometry Helper Functions
 * Provides utilities for geometric calculations including distance, rotation, 
 * bezier curves, arc sampling, polygon operations, and bounding boxes.
 */

// ============================================================================
// DISTANCE CALCULATIONS
// ============================================================================

/**
 * Calculate Euclidean distance between two 2D points
 * @param {number} x1 - First point x coordinate
 * @param {number} y1 - First point y coordinate
 * @param {number} x2 - Second point x coordinate
 * @param {number} y2 - Second point y coordinate
 * @returns {number} Distance between points
 */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance between two points (faster, avoids sqrt)
 * @param {number} x1 - First point x coordinate
 * @param {number} y1 - First point y coordinate
 * @param {number} x2 - Second point x coordinate
 * @param {number} y2 - Second point y coordinate
 * @returns {number} Squared distance between points
 */
export function distanceSquared(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * Calculate distance from a point to a line segment
 * @param {number} px - Point x coordinate
 * @param {number} py - Point y coordinate
 * @param {number} x1 - Line segment start x
 * @param {number} y1 - Line segment start y
 * @param {number} x2 - Line segment end x
 * @param {number} y2 - Line segment end y
 * @returns {number} Perpendicular distance from point to line segment
 */
export function pointToLineSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return distance(px, py, x1, y1);
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return distance(px, py, closestX, closestY);
}

// ============================================================================
// ROTATION
// ============================================================================

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Rotate a point around an origin
 * @param {number} x - Point x coordinate
 * @param {number} y - Point y coordinate
 * @param {number} originX - Rotation center x
 * @param {number} originY - Rotation center y
 * @param {number} angle - Rotation angle in radians
 * @returns {Object} Rotated point {x, y}
 */
export function rotatePoint(x, y, originX, originY, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const dx = x - originX;
  const dy = y - originY;

  return {
    x: originX + dx * cos - dy * sin,
    y: originY + dx * sin + dy * cos,
  };
}

/**
 * Get the angle between two points in radians
 * @param {number} x1 - First point x
 * @param {number} y1 - First point y
 * @param {number} x2 - Second point x
 * @param {number} y2 - Second point y
 * @returns {number} Angle in radians (-PI to PI)
 */
export function angleBetweenPoints(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Normalize angle to -PI to PI range
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle
 */
export function normalizeAngle(angle) {
  let normalized = angle % (2 * Math.PI);
  if (normalized > Math.PI) {
    normalized -= 2 * Math.PI;
  } else if (normalized < -Math.PI) {
    normalized += 2 * Math.PI;
  }
  return normalized;
}

// ============================================================================
// BEZIER CURVES
// ============================================================================

/**
 * Calculate a point on a quadratic Bezier curve
 * @param {number} t - Parameter (0 to 1)
 * @param {number} p0 - Start point
 * @param {number} p1 - Control point
 * @param {number} p2 - End point
 * @returns {number} Point on curve
 */
export function quadraticBezier(t, p0, p1, p2) {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

/**
 * Calculate a point on a cubic Bezier curve
 * @param {number} t - Parameter (0 to 1)
 * @param {number} p0 - Start point
 * @param {number} p1 - First control point
 * @param {number} p2 - Second control point
 * @param {number} p3 - End point
 * @returns {number} Point on curve
 */
export function cubicBezier(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
}

/**
 * Sample points along a quadratic Bezier curve
 * @param {Object} p0 - Start point {x, y}
 * @param {Object} p1 - Control point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @param {number} segments - Number of segments (points will be segments + 1)
 * @returns {Array} Array of points along the curve
 */
export function sampleQuadraticBezier(p0, p1, p2, segments = 20) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push({
      x: quadraticBezier(t, p0.x, p1.x, p2.x),
      y: quadraticBezier(t, p0.y, p1.y, p2.y),
    });
  }
  return points;
}

/**
 * Sample points along a cubic Bezier curve
 * @param {Object} p0 - Start point {x, y}
 * @param {Object} p1 - First control point {x, y}
 * @param {Object} p2 - Second control point {x, y}
 * @param {Object} p3 - End point {x, y}
 * @param {number} segments - Number of segments
 * @returns {Array} Array of points along the curve
 */
export function sampleCubicBezier(p0, p1, p2, p3, segments = 20) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push({
      x: cubicBezier(t, p0.x, p1.x, p2.x, p3.x),
      y: cubicBezier(t, p0.y, p1.y, p2.y, p3.y),
    });
  }
  return points;
}

/**
 * Calculate derivative of cubic Bezier at parameter t
 * @param {number} t - Parameter (0 to 1)
 * @param {number} p0 - Start point
 * @param {number} p1 - First control point
 * @param {number} p2 - Second control point
 * @param {number} p3 - End point
 * @returns {number} Derivative value
 */
export function cubicBezierDerivative(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return (
    3 * mt * mt * (p1 - p0) +
    6 * mt * t * (p2 - p1) +
    3 * t * t * (p3 - p2)
  );
}

// ============================================================================
// ARC SAMPLING
// ============================================================================

/**
 * Sample points along a circular arc
 * @param {number} centerX - Arc center x
 * @param {number} centerY - Arc center y
 * @param {number} radius - Arc radius
 * @param {number} startAngle - Start angle in radians
 * @param {number} endAngle - End angle in radians
 * @param {number} segments - Number of segments
 * @returns {Array} Array of points along the arc
 */
export function sampleArc(
  centerX,
  centerY,
  radius,
  startAngle,
  endAngle,
  segments = 20
) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + t * (endAngle - startAngle);
    points.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Sample points along an ellipse
 * @param {number} centerX - Ellipse center x
 * @param {number} centerY - Ellipse center y
 * @param {number} radiusX - Horizontal radius
 * @param {number} radiusY - Vertical radius
 * @param {number} rotation - Rotation angle in radians
 * @param {number} startAngle - Start angle in radians
 * @param {number} endAngle - End angle in radians
 * @param {number} segments - Number of segments
 * @returns {Array} Array of points along the ellipse
 */
export function sampleEllipse(
  centerX,
  centerY,
  radiusX,
  radiusY,
  rotation = 0,
  startAngle = 0,
  endAngle = 2 * Math.PI,
  segments = 40
) {
  const points = [];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + t * (endAngle - startAngle);

    const x =
      centerX +
      radiusX * Math.cos(angle) * cos -
      radiusY * Math.sin(angle) * sin;
    const y =
      centerY +
      radiusX * Math.cos(angle) * sin +
      radiusY * Math.sin(angle) * cos;

    points.push({ x, y });
  }
  return points;
}

/**
 * Calculate arc length between two angles on a circle
 * @param {number} radius - Circle radius
 * @param {number} startAngle - Start angle in radians
 * @param {number} endAngle - End angle in radians
 * @returns {number} Arc length
 */
export function arcLength(radius, startAngle, endAngle) {
  const angle = Math.abs(endAngle - startAngle);
  return radius * angle;
}

// ============================================================================
// POLYGON OPERATIONS
// ============================================================================

/**
 * Calculate the area of a polygon using the shoelace formula
 * @param {Array} points - Array of points [{x, y}, ...]
 * @returns {number} Polygon area
 */
export function polygonArea(points) {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area) / 2;
}

/**
 * Check if a point is inside a polygon using ray casting
 * @param {number} x - Point x coordinate
 * @param {number} y - Point y coordinate
 * @param {Array} points - Array of polygon points [{x, y}, ...]
 * @returns {boolean} True if point is inside polygon
 */
export function pointInPolygon(x, y, points) {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate the centroid (center) of a polygon
 * @param {Array} points - Array of points [{x, y}, ...]
 * @returns {Object} Centroid point {x, y}
 */
export function polygonCentroid(points) {
  if (points.length === 0) return { x: 0, y: 0 };

  let x = 0;
  let y = 0;

  for (let i = 0; i < points.length; i++) {
    x += points[i].x;
    y += points[i].y;
  }

  return {
    x: x / points.length,
    y: y / points.length,
  };
}

/**
 * Check if polygon points are in clockwise order
 * @param {Array} points - Array of points [{x, y}, ...]
 * @returns {boolean} True if clockwise
 */
export function isClockwise(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  return sum > 0;
}

/**
 * Reverse polygon point order
 * @param {Array} points - Array of points [{x, y}, ...]
 * @returns {Array} Reversed points
 */
export function reversePolygon(points) {
  return [...points].reverse();
}

/**
 * Offset a polygon outward or inward by a distance
 * @param {Array} points - Array of polygon points [{x, y}, ...]
 * @param {number} offset - Offset distance (positive = outward, negative = inward)
 * @returns {Array} Offset polygon points
 */
export function offsetPolygon(points, offset) {
  const n = points.length;
  const offsetPoints = [];

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    // Get normals for edges
    const dx1 = p1.x - p0.x;
    const dy1 = p1.y - p0.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const nx1 = -dy1 / len1;
    const ny1 = dx1 / len1;

    const dx2 = p2.x - p1.x;
    const dy2 = p2.y - p1.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const nx2 = -dy2 / len2;
    const ny2 = dx2 / len2;

    // Average normals
    const nx = (nx1 + nx2) / 2;
    const ny = (ny1 + ny2) / 2;
    const len = Math.sqrt(nx * nx + ny * ny);

    offsetPoints.push({
      x: p1.x + (nx / len) * offset,
      y: p1.y + (ny / len) * offset,
    });
  }

  return offsetPoints;
}

// ============================================================================
// BOUNDING BOXES
// ============================================================================

/**
 * Calculate bounding box for a set of points
 * @param {Array} points - Array of points [{x, y}, ...]
 * @returns {Object} Bounding box {minX, minY, maxX, maxY, width, height}
 */
export function boundingBox(points) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const { x, y } = points[i];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Check if a point is inside a bounding box
 * @param {number} x - Point x coordinate
 * @param {number} y - Point y coordinate
 * @param {Object} bbox - Bounding box {minX, minY, maxX, maxY}
 * @returns {boolean} True if point is inside bbox
 */
export function pointInBbox(x, y, bbox) {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY;
}

/**
 * Check if two bounding boxes intersect
 * @param {Object} bbox1 - First bounding box {minX, minY, maxX, maxY}
 * @param {Object} bbox2 - Second bounding box {minX, minY, maxX, maxY}
 * @returns {boolean} True if bboxes intersect
 */
export function bboxIntersect(bbox1, bbox2) {
  return !(
    bbox1.maxX < bbox2.minX ||
    bbox1.minX > bbox2.maxX ||
    bbox1.maxY < bbox2.minY ||
    bbox1.minY > bbox2.maxY
  );
}

/**
 * Calculate intersection of two bounding boxes
 * @param {Object} bbox1 - First bounding box {minX, minY, maxX, maxY}
 * @param {Object} bbox2 - Second bounding box {minX, minY, maxX, maxY}
 * @returns {Object|null} Intersection bbox or null if no intersection
 */
export function bboxIntersection(bbox1, bbox2) {
  const minX = Math.max(bbox1.minX, bbox2.minX);
  const minY = Math.max(bbox1.minY, bbox2.minY);
  const maxX = Math.min(bbox1.maxX, bbox2.maxX);
  const maxY = Math.min(bbox1.maxY, bbox2.maxY);

  if (minX <= maxX && minY <= maxY) {
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  return null;
}

/**
 * Merge multiple bounding boxes into one
 * @param {Array} bboxes - Array of bounding boxes
 * @returns {Object} Merged bounding box
 */
export function mergeBboxes(bboxes) {
  if (bboxes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = bboxes[0].minX;
  let minY = bboxes[0].minY;
  let maxX = bboxes[0].maxX;
  let maxY = bboxes[0].maxY;

  for (let i = 1; i < bboxes.length; i++) {
    const bbox = bboxes[i];
    if (bbox.minX < minX) minX = bbox.minX;
    if (bbox.minY < minY) minY = bbox.minY;
    if (bbox.maxX > maxX) maxX = bbox.maxX;
    if (bbox.maxY > maxY) maxY = bbox.maxY;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Expand a bounding box by a margin
 * @param {Object} bbox - Bounding box {minX, minY, maxX, maxY}
 * @param {number} margin - Margin to expand by
 * @returns {Object} Expanded bounding box
 */
export function expandBbox(bbox, margin) {
  return {
    minX: bbox.minX - margin,
    minY: bbox.minY - margin,
    maxX: bbox.maxX + margin,
    maxY: bbox.maxY + margin,
    width: bbox.width + 2 * margin,
    height: bbox.height + 2 * margin,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Parameter (0 to 1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check if two floating point numbers are approximately equal
 * @param {number} a - First value
 * @param {number} b - Second value
 * @param {number} epsilon - Tolerance (default: 1e-10)
 * @returns {boolean} True if approximately equal
 */
export function approximatelyEqual(a, b, epsilon = 1e-10) {
  return Math.abs(a - b) < epsilon;
}