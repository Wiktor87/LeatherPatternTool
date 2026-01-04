// Configuration constants and defaults
export const SCALE = 100;

export const CFG = {
  thickness: 3,
  stitchMargin: 5,
  stitchSpacing: 4,
  holeSize: 1.5,
  defaultHoleShape: 'circle',
  defaultHoleWidth: 4,
  defaultHoleHeight: 4,
  defaultHoleStitchBorder: false,
  defaultHoleStitchMargin: 3,
  defaultHoleStitchSpacing: 3,
  showCavity: true,
  showFoldLine: true,
  lockFoldLine: false,
  mirrorEdgeStitches: true,
  gridOpacity: 0.6,
  leatherColor: '#b4783c',
  showSymmetric: true,
  showAsymmetric: true,
  showRegMarks: true,
  showCenterMarks: true,
  pageOverlap: 15,
  pageMargin: 10,
  showOutline: true,
  showEdgeStitches: true,
  showStitchLines: true,
  showText: true,
  snapGrid: false,
  gridSize: 5,
  snapFold: false,
  showRefImage: true,
  refImageOpacity: 0.3,
  projectType: 'fold-over', // 'fold-over' or 'two-layer'
  syncEdgeStitches: true,
  syncOutline: true,
  publishLayout: 'side-by-side', // 'front-only', 'back-only', 'side-by-side', 'stacked', 'overlaid'
  publishViewMode: 'a4-pages', // 'full-pattern' or 'a4-pages'
  showGhostLayer: true, // Show other layer as ghost/overlay in two-layer mode
  ghostLayerOpacity: 0.25, // Opacity of ghost layer (0.1 - 0.5)
  asymmetricOutline: false, // When true, nodes define full perimeter instead of right half only
  realisticRendering: true // Enable realistic leather rendering with gradients and stitches
};

// Touch-aware hover tolerances
const isTouch = window.matchMedia('(pointer: coarse)').matches;
export const HOVER_TOLERANCE = {
  node: isTouch ? 24 : 12,
  handle: isTouch ? 20 : 10,
  range: isTouch ? 20 : 10,
  gizmo: isTouch ? 28 : 15
};

export const HOVER_SCALE = 1.4;
export const MAX_HISTORY = 50;
