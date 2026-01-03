/**
 * PublishManager - Handles publish mode functionality
 * 
 * Manages all publish-related features including:
 * - Toggle publish mode on/off
 * - Render patterns for publish view (A4 pages and full pattern)
 * - Export patterns to PNG/JPG format
 * - Two-layer layout support (front-only, back-only, side-by-side, stacked, overlaid)
 * - Registration marks and guides
 */
export class PublishManager {
  /**
   * @param {Object} options - Configuration options and dependencies
   * @param {Function} options.getCanvas - Get main canvas element
   * @param {Function} options.getCtx - Get main canvas context
   * @param {Function} options.getDpr - Get device pixel ratio
   * @param {Function} options.getConfig - Get CFG object
   * @param {Function} options.getHolster - Get HOLSTER object
   * @param {Function} options.getNodes - Get NODES array
   * @param {Function} options.getCurrentLayer - Get CURRENT_LAYER string
   * @param {Function} options.getFrontLayer - Get FRONT_LAYER state
   * @param {Function} options.getBackLayer - Get BACK_LAYER state
   * @param {Function} options.getEdgeRanges - Get EDGE_RANGES array
   * @param {Function} options.getEdgeStitches - Get EDGE_STITCHES array
   * @param {Function} options.getSymHoles - Get SYM_HOLES array
   * @param {Function} options.getAsymHoles - Get ASYM_HOLES array
   * @param {Function} options.getSymCustomHoles - Get SYM_CUSTOM_HOLES array
   * @param {Function} options.getAsymCustomHoles - Get ASYM_CUSTOM_HOLES array
   * @param {Function} options.getAsymShapes - Get ASYM_SHAPES array
   * @param {Function} options.getTextAnnotations - Get TEXT_ANNOTATIONS array
   * @param {Function} options.getMergedPatternPath - Get merged pattern path
   * @param {Function} options.getRightHalfPath - Get right half path
   * @param {Function} options.offsetPathStable - Offset path by distance
   * @param {Function} options.offsetPathStableClosed - Offset closed path by distance
   * @param {Function} options.holsterToWorld - Convert holster coords to world coords
   * @param {Function} options.getSymHoleWorld - Get symmetric hole in world coords
   * @param {Function} options.getCustomHoleWorld - Get custom hole in world coords
   * @param {Function} options.getCustomHoleWorldAsym - Get asymmetric custom hole in world coords
   * @param {Function} options.drawHole - Draw a hole on context
   * @param {Function} options.showToast - Show notification toast
   * @param {Function} options.updateInfo - Update info panel
   * @param {Function} options.resize - Resize canvas
   * @param {Function} options.draw - Redraw canvas
   */
  constructor(options = {}) {
    // Dependency injection - store references to app methods
    this.getCanvas = options.getCanvas || (() => null);
    this.getCtx = options.getCtx || (() => null);
    this.getDpr = options.getDpr || (() => 1);
    this.getConfig = options.getConfig || (() => ({}));
    this.getHolster = options.getHolster || (() => ({}));
    this.getNodes = options.getNodes || (() => []);
    this.getCurrentLayer = options.getCurrentLayer || (() => 'front');
    this.getFrontLayer = options.getFrontLayer || (() => null);
    this.getBackLayer = options.getBackLayer || (() => null);
    this.getEdgeRanges = options.getEdgeRanges || (() => []);
    this.getEdgeStitches = options.getEdgeStitches || (() => []);
    this.getSymHoles = options.getSymHoles || (() => []);
    this.getAsymHoles = options.getAsymHoles || (() => []);
    this.getSymCustomHoles = options.getSymCustomHoles || (() => []);
    this.getAsymCustomHoles = options.getAsymCustomHoles || (() => []);
    this.getAsymShapes = options.getAsymShapes || (() => []);
    this.getTextAnnotations = options.getTextAnnotations || (() => []);
    
    // Geometry and transformation functions
    this.getMergedPatternPath = options.getMergedPatternPath || (() => []);
    this.getRightHalfPath = options.getRightHalfPath || (() => []);
    this.offsetPathStable = options.offsetPathStable || ((path, delta) => path);
    this.offsetPathStableClosed = options.offsetPathStableClosed || ((path, delta) => path);
    this.holsterToWorld = options.holsterToWorld || ((p) => p);
    this.getSymHoleWorld = options.getSymHoleWorld || ((hole, side) => hole);
    this.getCustomHoleWorld = options.getCustomHoleWorld || ((h, side) => h);
    this.getCustomHoleWorldAsym = options.getCustomHoleWorldAsym || ((h) => h);
    this.drawHole = options.drawHole || (() => {});
    
    // UI and app methods
    this.showToast = options.showToast || (() => {});
    this.updateInfo = options.updateInfo || (() => {});
    this.resize = options.resize || (() => {});
    this.draw = options.draw || (() => {});
    
    // Additional dependencies we need
    this.getPublishMode = options.getPublishMode || (() => false);
    this.setPublishMode = options.setPublishMode || (() => {});
    this.getPublishView = options.getPublishView || (() => ({ x: 0, y: 0, scale: 1 }));
    this.setPublishView = options.setPublishView || (() => {});
    this.getSelected = options.getSelected || (() => null);
    this.setSelected = options.setSelected || (() => {});
    this.getMath = options.getMath || (() => ({}));
    
    // Publish mode state
    this.publishDpr = null;
  }

  /**
   * Get stitch count for a layer
   * @param {Object} layerState - Layer state object
   * @returns {number} Total stitch count
   * @todo Layer state handling is incomplete - needs setters for NODES, EDGE_RANGES, EDGE_STITCHES
   * to properly support two-layer mode calculations. Current implementation works for single-layer
   * but may not accurately calculate for specific layers in two-layer mode.
   */
  getStitchCount(layerState) {
    // Count stitches in a layer (edge stitches only for now)
    let count = 0;
    const CFG = this.getConfig();
    const HOLSTER = this.getHolster();
    const M = this.getMath();
    
    // TODO: In future refactoring, pass layerState data directly to calculation methods
    // instead of relying on global state modification
    const rightHalfP = this.getRightHalfPath();
    const rightWorldP = rightHalfP.map(p => this.holsterToWorld(p));
    
    const EDGE_STITCHES = layerState ? layerState.EDGE_STITCHES : this.getEdgeStitches();
    const EDGE_RANGES = layerState ? layerState.EDGE_RANGES : this.getEdgeRanges();
    
    EDGE_STITCHES.forEach(es => {
      const rng = EDGE_RANGES[es.rangeIdx];
      if (!rng) return;
      
      const stitchPath = this.offsetPathStable(rightWorldP, -(es.margin || CFG.stitchMargin));
      if (stitchPath.length < 3) return;
      
      const stitchArc = M.buildArc(stitchPath);
      const tot = stitchArc[stitchArc.length - 1].d;
      const sd = tot * rng.start, ed = tot * rng.end;
      
      if (es.showHoles !== false) {
        const spacing = es.spacing || CFG.stitchSpacing;
        const stitchesInRange = Math.floor((ed - sd) / spacing) + 1;
        count += stitchesInRange;
        
        if (es.mirror !== false && CFG.mirrorEdgeStitches && !CFG.asymmetricOutline) {
          count += stitchesInRange;
        }
      }
    });
    
    return count;
  }

  /**
   * Center the publish view on the pattern
   */
  centerPublishView() {
    const CFG = this.getConfig();
    const M = this.getMath();
    const canvas = this.getCanvas();
    const dpr = this.getDpr();
    
    // Calculate pattern bounds
    const isTwoLayer = CFG.projectType === 'two-layer';
    const layout = isTwoLayer ? CFG.publishLayout : 'front-only';
    let pat, b;
    
    if (isTwoLayer && this.getFrontLayer()) {
      // For two-layer mode, use front layer for sizing
      pat = this.getMergedPatternPath();
      b = M.getBounds(pat);
    } else {
      pat = this.getMergedPatternPath();
      b = M.getBounds(pat);
    }
    
    // Adjust bounds for side-by-side or stacked layouts
    const layerGap = 20; // mm gap between layers in multi-layer layouts
    let totalW = b.w, totalH = b.h;
    
    if (isTwoLayer && layout === 'side-by-side') {
      totalW = b.w * 2 + layerGap;
    } else if (isTwoLayer && layout === 'stacked') {
      totalH = b.h * 2 + layerGap;
    }
    
    // Canvas dimensions in screen pixels
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    
    if (CFG.publishViewMode === 'full-pattern') {
      // Full Pattern mode: Center the pattern with appropriate zoom to fit
      const headerH = 120; // Header space in pixels
      const footerH = 80; // Footer space in pixels
      const margin = 60; // Side margins in pixels
      const availW = w - margin * 2;
      const availH = h - headerH - footerH;
      
      // Calculate scale to fit pattern with padding
      const scaleX = availW / (totalW * 1.2); // 20% padding
      const scaleY = availH / (totalH * 1.2);
      const scale = Math.min(scaleX, scaleY, 3); // Cap at 3x
      
      // The pattern rendering in drawPublishFullPattern centers it automatically
      // But we still need to set up PUBLISH_VIEW for panning/zooming
      this.setPublishView({ x: 0, y: 0, scale: scale });
    } else {
      // A4 Pages mode: Center the page grid
      const A4W = 210, A4H = 300;
      const pageMargin = parseFloat(CFG.pageMargin) || 10;
      const overlap = parseFloat(CFG.pageOverlap) || 15;
      const effectiveW = A4W - pageMargin * 2 - overlap;
      const effectiveH = A4H - pageMargin * 2 - overlap;
      const pagesX = Math.max(1, Math.ceil(totalW / effectiveW));
      const pagesY = Math.max(1, Math.ceil(totalH / effectiveH));
      
      // Calculate scale to fit grid on screen with margin
      const gridMargin = 40; // pixels margin around grid
      const availW = w - gridMargin * 2;
      const availH = h - gridMargin * 2 - 40; // Extra space for title
      
      // Grid dimensions at scale=1
      const gap = 8; // gap between pages in pixels (at scale=1)
      const gridW1 = pagesX * A4W + (pagesX - 1) * gap;
      const gridH1 = pagesY * A4H + (pagesY - 1) * gap;
      
      // Calculate scale to fit grid
      const scaleX = availW / gridW1;
      const scaleY = availH / gridH1;
      const scale = Math.min(scaleX, scaleY, 2); // Cap at 2x
      
      // Keep x,y at 0,0 - the drawPublish transforms already handle pattern positioning
      // User can drag to adjust if needed
      this.setPublishView({ x: 0, y: 0, scale: scale });
    }
  }

  /**
   * Toggle publish mode on/off
   */
  togglePublish() {
    const CFG = this.getConfig();
    const canvas = this.getCanvas();
    const dpr = this.getDpr();
    const PUBLISH_MODE = this.getPublishMode();
    
    this.setPublishMode(!PUBLISH_MODE);
    document.body.classList.toggle('publish-mode', !PUBLISH_MODE);
    
    if (!PUBLISH_MODE) {
      // Entering publish mode
      this.setSelected(null);
      this.updateInfo();
      
      // Set view mode selector
      document.getElementById('publish-view-mode').value = CFG.publishViewMode || 'a4-pages';
      
      // Check stitch count mismatch for two-layer mode
      if (CFG.projectType === 'two-layer' && this.getFrontLayer() && this.getBackLayer()) {
        const frontCount = this.getStitchCount(this.getFrontLayer());
        const backCount = this.getStitchCount(this.getBackLayer());
        if (frontCount !== backCount) {
          this.showToast(`⚠ Stitch count mismatch! Front: ${frontCount} | Back: ${backCount}`, 'warning');
        }
      }
      
      // Use full window for tiled page preview
      this.publishDpr = dpr;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.margin = '0';
      canvas.style.display = 'block';
      canvas.style.boxShadow = 'none';
      canvas.style.cursor = 'grab';
      
      // Center the pattern in the view
      this.centerPublishView();
    } else {
      // Exiting publish mode - restore normal canvas size
      this.resize();
      canvas.style.margin = '';
      canvas.style.boxShadow = '';
      canvas.style.cursor = 'default';
    }
    
    this.draw();
  }

  /**
   * Download pattern in selected format
   */
  downloadPattern() {
    const CFG = this.getConfig();
    const format = document.getElementById('export-format').value;
    const title = document.getElementById('pattern-title').value || 'pattern';
    
    if (CFG.publishViewMode === 'full-pattern') {
      this.downloadFullPattern(format, title);
    } else {
      this.downloadA4Pages(format, title);
    }
  }

  /**
   * Download full pattern as single image
   * @param {string} format - 'png' or 'jpg'
   * @param {string} title - Pattern title
   */
  downloadFullPattern(format, title) {
    const CFG = this.getConfig();
    const M = this.getMath();
    const TEXT_ANNOTATIONS = this.getTextAnnotations();
    
    // Export single full-size pattern image
    const DPI = 150; // 150 DPI for print quality
    const scale = DPI / 25.4; // pixels per mm
    
    // Determine which layers to render
    const isTwoLayer = CFG.projectType === 'two-layer';
    const layout = isTwoLayer ? CFG.publishLayout : 'front-only';
    let layersToRender = [];
    
    if (isTwoLayer) {
      if (layout === 'front-only') {
        layersToRender = [{ state: this.getFrontLayer(), label: 'FRONT', color: '#000' }];
      } else if (layout === 'back-only') {
        layersToRender = [{ state: this.getBackLayer(), label: 'BACK', color: '#000' }];
      } else if (layout === 'overlaid') {
        layersToRender = [
          { state: this.getFrontLayer(), label: 'FRONT', color: '#007AFF' },
          { state: this.getBackLayer(), label: 'BACK', color: '#FF6600' }
        ];
      } else {
        layersToRender = [
          { state: this.getFrontLayer(), label: 'FRONT', color: '#000' },
          { state: this.getBackLayer(), label: 'BACK', color: '#000' }
        ];
      }
    } else {
      layersToRender = [{ state: null, label: '', color: '#000' }];
    }
    
    // Get pattern bounds
    let pat, b;
    if (isTwoLayer && this.getFrontLayer()) {
      pat = this.getMergedPatternPath();
      b = M.getBounds(pat);
    } else {
      pat = this.getMergedPatternPath();
      b = M.getBounds(pat);
    }
    
    // Adjust bounds for layouts
    const layerGap = 20;
    let totalW = b.w, totalH = b.h;
    
    if (isTwoLayer && layout === 'side-by-side') {
      totalW = b.w * 2 + layerGap;
    } else if (isTwoLayer && layout === 'stacked') {
      totalH = b.h * 2 + layerGap;
    }
    
    // Add margins for header, footer, and sides
    const headerH = 120 / scale; // mm
    const footerH = 60 / scale; // mm
    const sideMargin = 40 / scale; // mm
    const canvasW = (totalW + sideMargin * 2) * scale;
    const canvasH = (totalH + headerH + footerH) * scale;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    
    // Draw header
    ctx.fillStyle = '#000';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvasW / 2, 60);
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('Made with 9-10oz Veg-Tan Leather', canvasW / 2, 100);
    ctx.fillText(`Pattern Size: ${totalW.toFixed(0)}×${totalH.toFixed(0)}mm`, canvasW / 2, 130);
    
    // Position and scale for pattern
    ctx.save();
    ctx.translate(sideMargin * scale, headerH * scale);
    ctx.translate(-b.minX * scale, -b.minY * scale);
    ctx.scale(scale, scale);
    
    // Draw patterns
    if (isTwoLayer && layout === 'side-by-side' && layersToRender.length >= 2) {
      layersToRender[0].state && this.drawPatternLayerFullPattern(ctx, layersToRender[0].state, scale, layersToRender[0].color, layersToRender[0].label);
      ctx.save();
      ctx.translate(b.w + layerGap, 0);
      layersToRender[1].state && this.drawPatternLayerFullPattern(ctx, layersToRender[1].state, scale, layersToRender[1].color, layersToRender[1].label);
      ctx.restore();
    } else if (isTwoLayer && layout === 'stacked' && layersToRender.length >= 2) {
      layersToRender[0].state && this.drawPatternLayerFullPattern(ctx, layersToRender[0].state, scale, layersToRender[0].color, layersToRender[0].label);
      ctx.save();
      ctx.translate(0, b.h + layerGap);
      layersToRender[1].state && this.drawPatternLayerFullPattern(ctx, layersToRender[1].state, scale, layersToRender[1].color, layersToRender[1].label);
      ctx.restore();
    } else if (isTwoLayer && layout === 'overlaid') {
      layersToRender.forEach(lr => {
        ctx.save();
        ctx.globalAlpha = 0.7;
        lr.state && this.drawPatternLayerFullPattern(ctx, lr.state, scale, lr.color, lr.label);
        ctx.restore();
      });
    } else {
      const lr = layersToRender[0];
      lr.state ? this.drawPatternLayerFullPattern(ctx, lr.state, scale, lr.color, lr.label) : this.drawPatternLayerFullPattern(ctx, null, scale, '#000', '');
    }
    
    // Draw text annotations
    if (!isTwoLayer || layout === 'front-only' || layout === 'back-only') {
      TEXT_ANNOTATIONS.forEach(t => {
        if (!t.text) return;
        let fs = t.fontSize || 12;
        if (t.style === 'header') {
          fs = 24;
        } else if (t.style === 'subheader') {
          fs = 18;
        }
        const fontWeight = (t.bold || t.style === 'header' || t.style === 'subheader') ? 'bold ' : '';
        const fontStyle = t.italic ? 'italic ' : '';
        ctx.font = `${fontStyle}${fontWeight}${fs}px sans-serif`;
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let textToShow = t.text;
        if (t.listType && t.listType !== 'none') {
          const listIdx = t.listIndex || 1;
          let prefix = '';
          if (t.listType === 'bullet') {
            prefix = '• ';
          } else if (t.listType === 'numbered') {
            prefix = `${listIdx}. `;
          }
          textToShow = prefix + textToShow;
        }
        ctx.fillText(textToShow, t.x, t.y);
      });
    }
    
    ctx.restore();
    
    // Draw footer
    ctx.fillStyle = '#999';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    const layoutInfo = isTwoLayer ? ` · ${layout.replace(/-/g, ' ')} layout` : '';
    ctx.fillText(`Full Pattern${layoutInfo}`, canvasW / 2, canvasH - 30);
    
    // Download
    const link = document.createElement('a');
    link.download = title + '_full.' + (format === 'jpg' ? 'jpg' : 'png');
    link.href = canvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Download A4 pages as tiled image
   * @param {string} format - 'png' or 'jpg'
   * @param {string} title - Pattern title
   */
  downloadA4Pages(format, title) {
    const CFG = this.getConfig();
    const M = this.getMath();
    const HOLSTER = this.getHolster();
    const PUBLISH_VIEW = this.getPublishView();
    
    // Get page layout info
    const A4W = 210, A4H = 300;
    const pageMargin = parseFloat(CFG.pageMargin) || 10;
    const overlap = parseFloat(CFG.pageOverlap) || 15;
    const printW = A4W - pageMargin * 2;
    const printH = A4H - pageMargin * 2;
    const effectiveW = printW - overlap;
    const effectiveH = printH - overlap;
    
    const pat = this.getMergedPatternPath();
    const b = M.getBounds(pat);
    const pagesX = Math.max(1, Math.ceil(b.w / effectiveW));
    const pagesY = Math.max(1, Math.ceil(b.h / effectiveH));
    const totalPages = pagesX * pagesY;
    
    // DPI for export (150 DPI for print quality)
    const DPI = 150;
    const pageWpx = Math.round(A4W / 25.4 * DPI);
    const pageHpx = Math.round(A4H / 25.4 * DPI);
    const scale = DPI / 25.4; // pixels per mm
    const gap = 20; // gap between pages in pixels
    const dragX = PUBLISH_VIEW.x;
    const dragY = PUBLISH_VIEW.y;
    
    // Create one big canvas with all pages in a grid
    const totalW = pagesX * pageWpx + (pagesX - 1) * gap;
    const totalH = pagesY * pageHpx + (pagesY - 1) * gap;
    const bigCanvas = document.createElement('canvas');
    bigCanvas.width = totalW;
    bigCanvas.height = totalH;
    const bigCtx = bigCanvas.getContext('2d');
    bigCtx.fillStyle = '#888';
    bigCtx.fillRect(0, 0, totalW, totalH);
    
    // Draw each page
    for (let py = 0; py < pagesY; py++) {
      for (let px = 0; px < pagesX; px++) {
        const pageNum = py * pagesX + px + 1;
        const pageX = px * (pageWpx + gap);
        const pageY = py * (pageHpx + gap);
        
        // White page background
        bigCtx.fillStyle = '#fff';
        bigCtx.fillRect(pageX, pageY, pageWpx, pageHpx);
        
        // Calculate pattern offset for this page
        const marginPx = pageMargin * scale;
        bigCtx.save();
        bigCtx.translate(pageX, pageY);
        bigCtx.beginPath();
        bigCtx.rect(0, 0, pageWpx, pageHpx);
        bigCtx.clip();
        bigCtx.translate(marginPx, marginPx);
        bigCtx.translate(dragX * scale, dragY * scale);
        bigCtx.translate(-px * effectiveW * scale, -py * effectiveH * scale);
        bigCtx.translate(-b.minX * scale, -b.minY * scale);
        bigCtx.scale(scale, scale);
        
        // Draw pattern outline
        bigCtx.beginPath();
        pat.forEach((p, i) => i === 0 ? bigCtx.moveTo(p.x, p.y) : bigCtx.lineTo(p.x, p.y));
        bigCtx.closePath();
        bigCtx.strokeStyle = '#000';
        bigCtx.lineWidth = 0.5;
        bigCtx.stroke();
        
        // Draw fold line
        bigCtx.strokeStyle = '#000';
        bigCtx.lineWidth = 0.3;
        bigCtx.setLineDash([3, 2]);
        bigCtx.beginPath();
        bigCtx.moveTo(HOLSTER.x, b.minY - 5);
        bigCtx.lineTo(HOLSTER.x, b.maxY + 5);
        bigCtx.stroke();
        bigCtx.setLineDash([]);
        
        // Draw edge stitches
        const rightHalfP = this.getRightHalfPath();
        const rightWorldP = rightHalfP.map(p => this.holsterToWorld(p));
        const EDGE_STITCHES = this.getEdgeStitches();
        const EDGE_RANGES = this.getEdgeRanges();
        
        EDGE_STITCHES.forEach(es => {
          const rng = EDGE_RANGES[es.rangeIdx];
          if (!rng) return;
          
          const stitchPath = this.offsetPathStable(rightWorldP, -(es.margin || CFG.stitchMargin));
          if (stitchPath.length < 3) return;
          
          const stitchArc = M.buildArc(stitchPath);
          const tot = stitchArc[stitchArc.length - 1].d;
          const sd = tot * rng.start, ed = tot * rng.end;
          
          if (es.showHoles !== false) {
            bigCtx.fillStyle = '#000';
            for (let d = sd; d <= ed; d += (es.spacing || CFG.stitchSpacing)) {
              const pt = M.ptAtDist(stitchArc, d);
              if (!pt) continue;
              bigCtx.beginPath();
              bigCtx.arc(pt.x, pt.y, (es.holeSize || CFG.holeSize) / 2, 0, Math.PI * 2);
              bigCtx.fill();
              if (es.mirror !== false && CFG.mirrorEdgeStitches && !CFG.asymmetricOutline) {
                bigCtx.beginPath();
                bigCtx.arc(2 * HOLSTER.x - pt.x, pt.y, (es.holeSize || CFG.holeSize) / 2, 0, Math.PI * 2);
                bigCtx.fill();
              }
            }
          }
        });
        
        // Draw symmetric holes
        if (CFG.showSymmetric) {
          const SYM_HOLES = this.getSymHoles();
          SYM_HOLES.forEach(hole => {
            [1, -1].forEach(side => {
              const wh = this.getSymHoleWorld(hole, side);
              bigCtx.strokeStyle = '#000';
              bigCtx.lineWidth = 0.4;
              bigCtx.beginPath();
              bigCtx.arc(wh.x, wh.y, wh.width / 2, 0, Math.PI * 2);
              bigCtx.stroke();
            });
          });
        }
        
        bigCtx.restore();
        
        // Draw guides on this page (not clipped)
        bigCtx.save();
        bigCtx.translate(pageX, pageY);
        
        // Draw margin guide (gray dashed)
        bigCtx.strokeStyle = '#aaa';
        bigCtx.lineWidth = 1;
        bigCtx.setLineDash([4, 4]);
        bigCtx.strokeRect(marginPx, marginPx, printW * scale, printH * scale);
        bigCtx.setLineDash([]);
        
        // Draw overlap guides (orange dashed)
        bigCtx.strokeStyle = '#f80';
        bigCtx.lineWidth = 1.5;
        bigCtx.setLineDash([6, 3]);
        const overlapPx = overlap * scale;
        
        if (px < pagesX - 1) {
          const ox = pageWpx - marginPx - overlapPx;
          bigCtx.beginPath();
          bigCtx.moveTo(ox, marginPx);
          bigCtx.lineTo(ox, pageHpx - marginPx);
          bigCtx.stroke();
        }
        if (py < pagesY - 1) {
          const oy = pageHpx - marginPx - overlapPx;
          bigCtx.beginPath();
          bigCtx.moveTo(marginPx, oy);
          bigCtx.lineTo(pageWpx - marginPx, oy);
          bigCtx.stroke();
        }
        if (px > 0) {
          const ox = marginPx + overlapPx;
          bigCtx.beginPath();
          bigCtx.moveTo(ox, marginPx);
          bigCtx.lineTo(ox, pageHpx - marginPx);
          bigCtx.stroke();
        }
        if (py > 0) {
          const oy = marginPx + overlapPx;
          bigCtx.beginPath();
          bigCtx.moveTo(marginPx, oy);
          bigCtx.lineTo(pageWpx - marginPx, oy);
          bigCtx.stroke();
        }
        bigCtx.setLineDash([]);
        
        // Registration marks
        if (CFG.showRegMarks) {
          bigCtx.strokeStyle = '#000';
          bigCtx.lineWidth = 2;
          const rm = 15, mo = marginPx / 2;
          [[mo, mo], [pageWpx - mo, mo], [mo, pageHpx - mo], [pageWpx - mo, pageHpx - mo]].forEach(([x, y]) => {
            bigCtx.beginPath();
            bigCtx.moveTo(x - rm, y);
            bigCtx.lineTo(x + rm, y);
            bigCtx.stroke();
            bigCtx.beginPath();
            bigCtx.moveTo(x, y - rm);
            bigCtx.lineTo(x, y + rm);
            bigCtx.stroke();
            bigCtx.beginPath();
            bigCtx.arc(x, y, 3, 0, Math.PI * 2);
            bigCtx.stroke();
          });
        }
        
        // Page number
        bigCtx.fillStyle = '#999';
        bigCtx.font = '24px sans-serif';
        bigCtx.textAlign = 'center';
        bigCtx.fillText(`Page ${pageNum}`, pageWpx / 2, pageHpx - 20);
        bigCtx.restore();
      }
    }
    
    // Download the combined image
    const link = document.createElement('a');
    link.download = title + '_all_pages.' + (format === 'jpg' ? 'jpg' : 'png');
    link.href = bigCanvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Draw publish mode (dispatcher method)
   */
  drawPublish() {
    const CFG = this.getConfig();
    
    // Dispatch to appropriate render mode
    if (CFG.publishViewMode === 'full-pattern') {
      this.drawPublishFullPattern();
    } else {
      this.drawPublishA4Pages();
    }
  }

  /**
   * Draw A4 pages view
   */
  drawPublishA4Pages() {
    const CFG = this.getConfig();
    const M = this.getMath();
    const HOLSTER = this.getHolster();
    const PUBLISH_VIEW = this.getPublishView();
    const TEXT_ANNOTATIONS = this.getTextAnnotations();
    const canvas = this.getCanvas();
    const ctx = this.getCtx();
    const dpr = this.getDpr();
    const w = canvas.width / dpr, h = canvas.height / dpr;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Gray background
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 0, w, h);
    
    // A4 page dimensions in mm (21cm x 30cm)
    const A4W = 210, A4H = 300;
    const pageMargin = parseFloat(CFG.pageMargin) || 10; // mm
    const overlap = parseFloat(CFG.pageOverlap) || 15; // mm
    
    // Printable area per page
    const printW = A4W - pageMargin * 2;
    const printH = A4H - pageMargin * 2;
    
    // Effective unique area per page (excluding overlap)
    const effectiveW = printW - overlap;
    const effectiveH = printH - overlap;
    
    // Determine which layers to render for two-layer mode
    const isTwoLayer = CFG.projectType === 'two-layer';
    const layout = isTwoLayer ? CFG.publishLayout : 'front-only';
    let layersToRender = [];
    
    if (isTwoLayer) {
      if (layout === 'front-only') {
        layersToRender = [{ state: this.getFrontLayer(), label: 'FRONT', color: '#000' }];
      } else if (layout === 'back-only') {
        layersToRender = [{ state: this.getBackLayer(), label: 'BACK', color: '#000' }];
      } else if (layout === 'overlaid') {
        layersToRender = [
          { state: this.getFrontLayer(), label: 'FRONT', color: '#007AFF' },
          { state: this.getBackLayer(), label: 'BACK', color: '#FF6600' }
        ];
      } else {
        layersToRender = [
          { state: this.getFrontLayer(), label: 'FRONT', color: '#000' },
          { state: this.getBackLayer(), label: 'BACK', color: '#000' }
        ];
      }
    } else {
      layersToRender = [{ state: null, label: '', color: '#000' }];
    }
    
    // Get pattern bounds (use front layer for sizing in two-layer mode)
    let pat, b;
    if (isTwoLayer && this.getFrontLayer()) {
      pat = this.getMergedPatternPath();
      b = M.getBounds(pat);
    } else {
      pat = this.getMergedPatternPath();
      b = M.getBounds(pat);
    }
    
    // Adjust bounds for side-by-side or stacked layouts
    const layerGap = 20; // mm gap between layers in multi-layer layouts
    let totalW = b.w, totalH = b.h;
    
    if (isTwoLayer && layout === 'side-by-side') {
      totalW = b.w * 2 + layerGap;
    } else if (isTwoLayer && layout === 'stacked') {
      totalH = b.h * 2 + layerGap;
    }
    
    // Fixed page count based on pattern size only
    const pagesX = Math.max(1, Math.ceil(totalW / effectiveW));
    const pagesY = Math.max(1, Math.ceil(totalH / effectiveH));
    
    // Scale for display
    const scale = PUBLISH_VIEW.scale;
    const pageW = A4W * scale;
    const pageH = A4H * scale;
    const gap = 8;
    
    // Grid dimensions
    const gridW = pagesX * pageW + (pagesX - 1) * gap;
    const gridH = pagesY * pageH + (pagesY - 1) * gap;
    
    // Center grid on screen
    const gridStartX = (w - gridW) / 2;
    const gridStartY = (h - gridH) / 2 + 20;
    
    // User drag offset (in mm, will be scaled to pixels)
    const dragX = PUBLISH_VIEW.x;
    const dragY = PUBLISH_VIEW.y;
    
    // Draw pages
    for (let py = 0; py < pagesY; py++) {
      for (let px = 0; px < pagesX; px++) {
        const pageX = gridStartX + px * (pageW + gap);
        const pageY = gridStartY + py * (pageH + gap);
        
        // White page with shadow
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillRect(pageX, pageY, pageW, pageH);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Clip to page
        ctx.save();
        ctx.beginPath();
        ctx.rect(pageX, pageY, pageW, pageH);
        ctx.clip();
        
        // Calculate pattern position - simple approach
        const marginPx = pageMargin * scale;
        // Each page shows a window into the pattern
        // Page (0,0) shows pattern starting at its top-left (b.minX, b.minY)
        // Page (1,0) shows pattern offset by effectiveW mm to the left, etc.
        ctx.save();
        // Move to page's printable area
        ctx.translate(pageX + marginPx, pageY + marginPx);
        // Add user drag (in mm, scaled to pixels)
        ctx.translate(dragX * scale, dragY * scale);
        // Offset for which page we're on
        ctx.translate(-px * effectiveW * scale, -py * effectiveH * scale);
        // Offset so pattern's top-left corner (b.minX, b.minY) is at origin
        ctx.translate(-b.minX * scale, -b.minY * scale);
        // Scale pattern coordinates to screen
        ctx.scale(scale, scale);
        
        // Draw patterns based on layout
        if (isTwoLayer && layout === 'side-by-side' && layersToRender.length >= 2) {
          // Draw front layer on left
          layersToRender[0].state && this.drawPatternLayer(ctx, layersToRender[0].state, scale, layersToRender[0].color, layersToRender[0].label);
          // Draw back layer on right (offset by pattern width + gap)
          ctx.save();
          ctx.translate(b.w + layerGap, 0);
          layersToRender[1].state && this.drawPatternLayer(ctx, layersToRender[1].state, scale, layersToRender[1].color, layersToRender[1].label);
          ctx.restore();
        } else if (isTwoLayer && layout === 'stacked' && layersToRender.length >= 2) {
          // Draw front layer on top
          layersToRender[0].state && this.drawPatternLayer(ctx, layersToRender[0].state, scale, layersToRender[0].color, layersToRender[0].label);
          // Draw back layer on bottom (offset by pattern height + gap)
          ctx.save();
          ctx.translate(0, b.h + layerGap);
          layersToRender[1].state && this.drawPatternLayer(ctx, layersToRender[1].state, scale, layersToRender[1].color, layersToRender[1].label);
          ctx.restore();
        } else if (isTwoLayer && layout === 'overlaid') {
          // Draw both layers overlaid with different colors
          layersToRender.forEach(lr => {
            ctx.save();
            ctx.globalAlpha = 0.7;
            lr.state && this.drawPatternLayer(ctx, lr.state, scale, lr.color, lr.label);
            ctx.restore();
          });
        } else {
          // Single layer or front-only/back-only
          const lr = layersToRender[0];
          lr.state ? this.drawPatternLayer(ctx, lr.state, scale, lr.color, lr.label) : this.drawPatternLayer(ctx, null, scale, '#000', '');
        }
        
        // Draw text annotations (only for current layer in non-overlaid modes)
        if (!isTwoLayer || layout === 'front-only' || layout === 'back-only') {
          TEXT_ANNOTATIONS.forEach(t => {
            if (!t.text) return;
            let fs = t.fontSize || 12;
            if (t.style === 'header') {
              fs = 24;
            } else if (t.style === 'subheader') {
              fs = 18;
            }
            const fontWeight = (t.bold || t.style === 'header' || t.style === 'subheader') ? 'bold ' : '';
            const fontStyle = t.italic ? 'italic ' : '';
            ctx.font = `${fontStyle}${fontWeight}${fs}px sans-serif`;
            ctx.fillStyle = '#000';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            let textToShow = t.text;
            if (t.listType && t.listType !== 'none') {
              const listIdx = t.listIndex || 1;
              let prefix = '';
              if (t.listType === 'bullet') {
                prefix = '• ';
              } else if (t.listType === 'numbered') {
                prefix = `${listIdx}. `;
              }
              textToShow = prefix + textToShow;
            }
            ctx.fillText(textToShow, t.x, t.y);
          });
        }
        
        ctx.restore(); // pattern transform
        
        // Draw margin and overlap guide lines
        const margPx = pageMargin * scale;
        const overlapPx = overlap * scale;
        
        // Margin lines (where content should stay inside)
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        // Inner margin rectangle
        ctx.strokeRect(pageX + margPx, pageY + margPx, pageW - margPx * 2, pageH - margPx * 2);
        ctx.setLineDash([]);
        
        // Overlap zones - dashed lines showing where pages overlap
        ctx.strokeStyle = '#f80';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 3]);
        
        // Right overlap (if not last column)
        if (px < pagesX - 1) {
          const ox = pageX + pageW - margPx - overlapPx;
          ctx.beginPath();
          ctx.moveTo(ox, pageY + margPx);
          ctx.lineTo(ox, pageY + pageH - margPx);
          ctx.stroke();
        }
        // Bottom overlap (if not last row)
        if (py < pagesY - 1) {
          const oy = pageY + pageH - margPx - overlapPx;
          ctx.beginPath();
          ctx.moveTo(pageX + margPx, oy);
          ctx.lineTo(pageX + pageW - margPx, oy);
          ctx.stroke();
        }
        // Left overlap indicator (if not first column) - shows where to align
        if (px > 0) {
          const ox = pageX + margPx + overlapPx;
          ctx.beginPath();
          ctx.moveTo(ox, pageY + margPx);
          ctx.lineTo(ox, pageY + pageH - margPx);
          ctx.stroke();
        }
        // Top overlap indicator (if not first row)
        if (py > 0) {
          const oy = pageY + margPx + overlapPx;
          ctx.beginPath();
          ctx.moveTo(pageX + margPx, oy);
          ctx.lineTo(pageX + pageW - margPx, oy);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        
        // Draw registration marks on this page (after pattern, so they're on top)
        if (CFG.showRegMarks) {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5;
          const rm = 10; // mark size in screen pixels
          const mo = margPx / 2; // mark at half margin
          
          // Corner marks
          [[pageX + mo, pageY + mo], [pageX + pageW - mo, pageY + mo], [pageX + mo, pageY + pageH - mo], [pageX + pageW - mo, pageY + pageH - mo]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.moveTo(x - rm, y);
            ctx.lineTo(x + rm, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y - rm);
            ctx.lineTo(x, y + rm);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.stroke();
          });
          
          // Center marks
          if (CFG.showCenterMarks) {
            const cms = 8;
            [[pageX + pageW / 2, pageY + mo], [pageX + pageW / 2, pageY + pageH - mo], [pageX + mo, pageY + pageH / 2], [pageX + pageW - mo, pageY + pageH / 2]].forEach(([x, y], i) => {
              if (i < 2) {
                ctx.beginPath();
                ctx.moveTo(x, y - cms);
                ctx.lineTo(x, y + cms);
                ctx.stroke();
              } else {
                ctx.beginPath();
                ctx.moveTo(x - cms, y);
                ctx.lineTo(x + cms, y);
                ctx.stroke();
              }
            });
          }
        }
        
        // Page number
        ctx.fillStyle = '#999';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${py * pagesX + px + 1}`, pageX + pageW / 2, pageY + pageH - 8);
        ctx.restore(); // clip
      }
    }
    
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(document.getElementById('pattern-title').value || 'Holster Pattern', w / 2, 20);
    
    // Info
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ccc';
    const layoutInfo = isTwoLayer ? ` · ${layout.replace(/-/g, ' ')} layout` : '';
    let stitchInfo = '';
    if (isTwoLayer && this.getFrontLayer() && this.getBackLayer()) {
      const frontCount = this.getStitchCount(this.getFrontLayer());
      const backCount = this.getStitchCount(this.getBackLayer());
      const match = frontCount === backCount;
      stitchInfo = ` · Front: ${frontCount} | Back: ${backCount} ${match ? '✓' : '⚠'}`;
    }
    const viewZoomPercent = Math.round(scale * 100);
    ctx.fillText(`Pattern Size: ${b.w.toFixed(0)}×${b.h.toFixed(0)}mm · ${pagesX}×${pagesY} pages${layoutInfo}${stitchInfo} · ${overlap}mm overlap`, w / 2, h - 30);
    ctx.fillText(`View: ${viewZoomPercent}% · Drag to reposition · Scroll to zoom · Print at 100% scale`, w / 2, h - 15);
  }

  /**
   * Draw full pattern view
   */
  drawPublishFullPattern() {
    const CFG = this.getConfig();
    const M = this.getMath();
    const TEXT_ANNOTATIONS = this.getTextAnnotations();
    const canvas = this.getCanvas();
    const ctx = this.getCtx();
    const dpr = this.getDpr();
    const w = canvas.width / dpr, h = canvas.height / dpr;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // White background for professional output
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    
    // Determine which layers to render for two-layer mode
    const isTwoLayer = CFG.projectType === 'two-layer';
    const layout = isTwoLayer ? CFG.publishLayout : 'front-only';
    let layersToRender = [];
    
    if (isTwoLayer) {
      if (layout === 'front-only') {
        layersToRender = [{ state: this.getFrontLayer(), label: 'FRONT', color: '#000' }];
      } else if (layout === 'back-only') {
        layersToRender = [{ state: this.getBackLayer(), label: 'BACK', color: '#000' }];
      } else if (layout === 'overlaid') {
        layersToRender = [
          { state: this.getFrontLayer(), label: 'FRONT', color: '#007AFF' },
          { state: this.getBackLayer(), label: 'BACK', color: '#FF6600' }
        ];
      } else {
        layersToRender = [
          { state: this.getFrontLayer(), label: 'FRONT', color: '#000' },
          { state: this.getBackLayer(), label: 'BACK', color: '#000' }
        ];
      }
    } else {
      layersToRender = [{ state: null, label: '', color: '#000' }];
    }
    
    // Get pattern bounds (use front layer for sizing in two-layer mode)
    let pat, b;
    if (isTwoLayer && this.getFrontLayer()) {
      pat = this.getMergedPatternPath();
      b = M.getBounds(pat);
    } else {
      pat = this.getMergedPatternPath();
      b = M.getBounds(pat);
    }
    
    // Adjust bounds for side-by-side or stacked layouts
    const layerGap = 20; // mm gap between layers in multi-layer layouts
    let totalW = b.w, totalH = b.h;
    
    if (isTwoLayer && layout === 'side-by-side') {
      totalW = b.w * 2 + layerGap;
    } else if (isTwoLayer && layout === 'stacked') {
      totalH = b.h * 2 + layerGap;
    }
    
    // Calculate scale to fit pattern on screen with margins
    const headerH = 120; // Header space in pixels
    const footerH = 80; // Footer space in pixels
    const margin = 60; // Side margins in pixels
    const availW = w - margin * 2;
    const availH = h - headerH - footerH;
    
    // Scale based on pattern size - aim for good visibility
    const scaleX = availW / (totalW * 1.1); // Add 10% padding
    const scaleY = availH / (totalH * 1.1);
    const scale = Math.min(scaleX, scaleY, 3); // Cap at 3x for very small patterns
    
    // Center the pattern
    const patternW = totalW * scale;
    const patternH = totalH * scale;
    const offsetX = (w - patternW) / 2;
    const offsetY = headerH + (availH - patternH) / 2;
    
    // Draw header section
    ctx.save();
    const title = document.getElementById('pattern-title').value || 'Holster Pattern';
    ctx.fillStyle = '#000';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, 40);
    
    // Specifications
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('Made with 9-10oz Veg-Tan Leather', w / 2, 70);
    ctx.fillText(`Pattern Size: ${b.w.toFixed(0)}×${b.h.toFixed(0)}mm`, w / 2, 92);
    ctx.restore();
    
    // Draw pattern(s)
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.translate(-b.minX * scale, -b.minY * scale);
    ctx.scale(scale, scale);
    
    // Draw patterns based on layout
    if (isTwoLayer && layout === 'side-by-side' && layersToRender.length >= 2) {
      // Draw front layer on left
      layersToRender[0].state && this.drawPatternLayerFullPattern(ctx, layersToRender[0].state, scale, layersToRender[0].color, layersToRender[0].label);
      // Draw back layer on right (offset by pattern width + gap)
      ctx.save();
      ctx.translate(b.w + layerGap, 0);
      layersToRender[1].state && this.drawPatternLayerFullPattern(ctx, layersToRender[1].state, scale, layersToRender[1].color, layersToRender[1].label);
      ctx.restore();
    } else if (isTwoLayer && layout === 'stacked' && layersToRender.length >= 2) {
      // Draw front layer on top
      layersToRender[0].state && this.drawPatternLayerFullPattern(ctx, layersToRender[0].state, scale, layersToRender[0].color, layersToRender[0].label);
      // Draw back layer on bottom (offset by pattern height + gap)
      ctx.save();
      ctx.translate(0, b.h + layerGap);
      layersToRender[1].state && this.drawPatternLayerFullPattern(ctx, layersToRender[1].state, scale, layersToRender[1].color, layersToRender[1].label);
      ctx.restore();
    } else if (isTwoLayer && layout === 'overlaid') {
      // Draw both layers overlaid with different colors
      layersToRender.forEach(lr => {
        ctx.save();
        ctx.globalAlpha = 0.7;
        lr.state && this.drawPatternLayerFullPattern(ctx, lr.state, scale, lr.color, lr.label);
        ctx.restore();
      });
    } else {
      // Single layer or front-only/back-only
      const lr = layersToRender[0];
      lr.state ? this.drawPatternLayerFullPattern(ctx, lr.state, scale, lr.color, lr.label) : this.drawPatternLayerFullPattern(ctx, null, scale, '#000', '');
    }
    
    // Draw text annotations
    if (!isTwoLayer || layout === 'front-only' || layout === 'back-only') {
      TEXT_ANNOTATIONS.forEach(t => {
        if (!t.text) return;
        let fs = t.fontSize || 12;
        if (t.style === 'header') {
          fs = 24;
        } else if (t.style === 'subheader') {
          fs = 18;
        }
        const fontWeight = (t.bold || t.style === 'header' || t.style === 'subheader') ? 'bold ' : '';
        const fontStyle = t.italic ? 'italic ' : '';
        ctx.font = `${fontStyle}${fontWeight}${fs}px sans-serif`;
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let textToShow = t.text;
        if (t.listType && t.listType !== 'none') {
          const listIdx = t.listIndex || 1;
          let prefix = '';
          if (t.listType === 'bullet') {
            prefix = '• ';
          } else if (t.listType === 'numbered') {
            prefix = `${listIdx}. `;
          }
          textToShow = prefix + textToShow;
        }
        ctx.fillText(textToShow, t.x, t.y);
      });
    }
    
    ctx.restore();
    
    // Draw footer
    ctx.fillStyle = '#999';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const layoutInfo = isTwoLayer ? ` · ${layout.replace(/-/g, ' ')} layout` : '';
    let stitchInfo = '';
    if (isTwoLayer && this.getFrontLayer() && this.getBackLayer()) {
      const frontCount = this.getStitchCount(this.getFrontLayer());
      const backCount = this.getStitchCount(this.getBackLayer());
      const match = frontCount === backCount;
      stitchInfo = ` · Front: ${frontCount} | Back: ${backCount} ${match ? '✓' : '⚠'}`;
    }
    const viewZoomPercent = Math.round(scale * 100);
    ctx.fillText(`Pattern Size: ${b.w.toFixed(0)}×${b.h.toFixed(0)}mm${layoutInfo}${stitchInfo}`, w / 2, h - 50);
    ctx.fillText(`View: ${viewZoomPercent}% · Scroll to zoom · Drag to pan · Print at 100% scale`, w / 2, h - 30);
  }

  /**
   * Draw pattern layer for full pattern view (professional styling)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} layerState - Layer state to render (null for current)
   * @param {number} scale - Pixels per mm
   * @param {string} strokeColor - Color for outlines
   * @param {string} labelText - Label to display above pattern
   * @returns {Object} Pattern bounds
   */
  drawPatternLayerFullPattern(ctx, layerState, scale, strokeColor = '#000', labelText = '') {
    const CFG = this.getConfig();
    const M = this.getMath();
    const HOLSTER = this.getHolster();
    
    // Similar to drawPatternLayer but with professional styling for full pattern view
    let savedNODES, savedEDGE_RANGES, savedMERGED_EDGE_RANGES, savedEDGE_STITCHES;
    let savedSYM_HOLES, savedSYM_CUSTOM_HOLES, savedASYM_HOLES, savedASYM_CUSTOM_HOLES, savedASYM_SHAPES;
    
    // Note: We need to temporarily modify globals for this to work with the current architecture
    // This is a limitation of the current design that should be addressed in future refactoring
    
    const pat = layerState ? this.getMergedPatternPath() : this.getMergedPatternPath();
    const b = M.getBounds(pat);
    
    // Draw label if provided
    if (labelText) {
      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.font = `bold ${18 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(labelText, b.cx, b.minY - 25 / scale);
      ctx.restore();
    }
    
    // Draw pattern outline - clean black line
    ctx.beginPath();
    pat.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2 / scale;
    ctx.stroke();
    
    // Draw fold line with dashed style
    if (CFG.showFoldLine) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1 / scale;
      ctx.setLineDash([8 / scale, 4 / scale]);
      ctx.beginPath();
      ctx.moveTo(HOLSTER.x, b.minY - 10);
      ctx.lineTo(HOLSTER.x, b.maxY + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Add fold line label
      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.font = `${10 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('FOLD LINE', HOLSTER.x, b.minY - 12 / scale);
      ctx.restore();
    }
    
    // Draw edge stitches with dotted style for professional look
    const rightHalfP = this.getRightHalfPath();
    const rightWorldP = rightHalfP.map(p => this.holsterToWorld(p));
    const EDGE_STITCHES = layerState ? layerState.EDGE_STITCHES : this.getEdgeStitches();
    const EDGE_RANGES = layerState ? layerState.EDGE_RANGES : this.getEdgeRanges();
    
    EDGE_STITCHES.forEach(es => {
      const rng = EDGE_RANGES[es.rangeIdx];
      if (!rng) return;
      
      const esMargin = es.margin || CFG.stitchMargin;
      const stitchPath = this.offsetPathStable(rightWorldP, -esMargin);
      if (stitchPath.length < 3) return;
      
      const stitchArc = M.buildArc(stitchPath);
      const stitchTot = stitchArc[stitchArc.length - 1].d;
      const sd = stitchTot * rng.start, ed = stitchTot * rng.end;
      
      if (es.showHoles !== false) {
        const spacing = es.spacing || CFG.stitchSpacing;
        ctx.fillStyle = strokeColor;
        // Draw as small dots for professional template
        for (let d = sd; d <= ed; d += spacing) {
          const pt = M.ptAtDist(stitchArc, d);
          if (!pt) continue;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (es.holeSize || CFG.holeSize) / 3, 0, Math.PI * 2);
          ctx.fill();
          if (es.mirror !== false && CFG.mirrorEdgeStitches && !CFG.asymmetricOutline) {
            const mx = 2 * HOLSTER.x - pt.x;
            ctx.beginPath();
            ctx.arc(mx, pt.y, (es.holeSize || CFG.holeSize) / 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    });
    
    // Draw holes with outline only
    if (CFG.showSymmetric) {
      const SYM_HOLES = layerState ? layerState.SYM_HOLES : this.getSymHoles();
      SYM_HOLES.forEach(hole => {
        [1, -1].forEach(side => {
          const wh = this.getSymHoleWorld(hole, side);
          this.drawHole(ctx, wh.x, wh.y, wh.rotation, wh.width, wh.height, wh.shape);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.5 / scale;
          ctx.stroke();
        });
      });
    }
    
    if (CFG.showAsymmetric) {
      const ASYM_HOLES = layerState ? layerState.ASYM_HOLES : this.getAsymHoles();
      ASYM_HOLES.forEach(hole => {
        this.drawHole(ctx, hole.x, hole.y, hole.rotation || 0, hole.width, hole.height, hole.shape);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
      });
    }
    
    // Draw custom holes
    if (CFG.showSymmetric) {
      const SYM_CUSTOM_HOLES = layerState ? layerState.SYM_CUSTOM_HOLES : this.getSymCustomHoles();
      SYM_CUSTOM_HOLES.forEach(h => {
        [1, -1].forEach(side => {
          const pts = this.getCustomHoleWorld(h, side);
          ctx.beginPath();
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.5 / scale;
          ctx.stroke();
        });
      });
    }
    
    if (CFG.showAsymmetric) {
      const ASYM_CUSTOM_HOLES = layerState ? layerState.ASYM_CUSTOM_HOLES : this.getAsymCustomHoles();
      ASYM_CUSTOM_HOLES.forEach(h => {
        const pts = this.getCustomHoleWorldAsym(h);
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
      });
    }
    
    // Draw shapes
    if (CFG.showAsymmetric) {
      const ASYM_SHAPES = layerState ? layerState.ASYM_SHAPES : this.getAsymShapes();
      ASYM_SHAPES.filter(s => !s.isExtension).forEach(s => {
        const pts = s.points.map(p => {
          const sc = { x: p.x * (s.scaleX || 1), y: p.y * (s.scaleY || 1) };
          const r = M.rotate(sc, s.rotation || 0);
          return { x: r.x + s.x, y: r.y + s.y };
        });
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
      });
    }
    
    return b;
  }

  /**
   * Draw pattern layer for A4 pages view
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} layerState - Layer state to render (null for current)
   * @param {number} scale - Pixels per mm
   * @param {string} strokeColor - Color for outlines
   * @param {string} labelText - Label to display above pattern
   * @returns {Object} Pattern bounds
   */
  drawPatternLayer(ctx, layerState, scale, strokeColor = '#000', labelText = '') {
    const CFG = this.getConfig();
    const M = this.getMath();
    const HOLSTER = this.getHolster();
    
    // Temporarily swap to layer state if provided
    const pat = layerState ? this.getMergedPatternPath() : this.getMergedPatternPath();
    const b = M.getBounds(pat);
    
    // Draw label if provided
    if (labelText) {
      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.font = `bold ${14 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(labelText, b.cx, b.minY - 20 / scale);
      ctx.restore();
    }
    
    // Draw pattern outline
    ctx.beginPath();
    pat.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5 / scale;
    ctx.stroke();
    
    // Draw fold line
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 0.5 / scale;
    ctx.setLineDash([5 / scale, 3 / scale]);
    ctx.beginPath();
    ctx.moveTo(HOLSTER.x, b.minY - 10);
    ctx.lineTo(HOLSTER.x, b.maxY + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw edge stitches
    const rightHalfP = this.getRightHalfPath();
    const rightWorldP = rightHalfP.map(p => this.holsterToWorld(p));
    const EDGE_STITCHES = layerState ? layerState.EDGE_STITCHES : this.getEdgeStitches();
    const EDGE_RANGES = layerState ? layerState.EDGE_RANGES : this.getEdgeRanges();
    
    EDGE_STITCHES.forEach(es => {
      const rng = EDGE_RANGES[es.rangeIdx];
      if (!rng) return;
      
      const esMargin = es.margin || CFG.stitchMargin;
      const stitchPath = this.offsetPathStable(rightWorldP, -esMargin);
      if (stitchPath.length < 3) return;
      
      const stitchArc = M.buildArc(stitchPath);
      const stitchTot = stitchArc[stitchArc.length - 1].d;
      const sd = stitchTot * rng.start, ed = stitchTot * rng.end;
      
      if (es.showHoles !== false) {
        const spacing = es.spacing || CFG.stitchSpacing;
        ctx.fillStyle = strokeColor;
        for (let d = sd; d <= ed; d += spacing) {
          const pt = M.ptAtDist(stitchArc, d);
          if (!pt) continue;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (es.holeSize || CFG.holeSize) / 2, 0, Math.PI * 2);
          ctx.fill();
          if (es.mirror !== false && CFG.mirrorEdgeStitches && !CFG.asymmetricOutline) {
            const mx = 2 * HOLSTER.x - pt.x;
            ctx.beginPath();
            ctx.arc(mx, pt.y, (es.holeSize || CFG.holeSize) / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    });
    
    // Draw holes
    if (CFG.showSymmetric) {
      const SYM_HOLES = layerState ? layerState.SYM_HOLES : this.getSymHoles();
      SYM_HOLES.forEach(hole => {
        [1, -1].forEach(side => {
          const wh = this.getSymHoleWorld(hole, side);
          this.drawHole(ctx, wh.x, wh.y, wh.rotation, wh.width, wh.height, wh.shape);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1 / scale;
          ctx.stroke();
        });
      });
    }
    
    if (CFG.showAsymmetric) {
      const ASYM_HOLES = layerState ? layerState.ASYM_HOLES : this.getAsymHoles();
      ASYM_HOLES.forEach(hole => {
        this.drawHole(ctx, hole.x, hole.y, hole.rotation || 0, hole.width, hole.height, hole.shape);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1 / scale;
        ctx.stroke();
      });
    }
    
    // Draw custom holes
    if (CFG.showSymmetric) {
      const SYM_CUSTOM_HOLES = layerState ? layerState.SYM_CUSTOM_HOLES : this.getSymCustomHoles();
      SYM_CUSTOM_HOLES.forEach(h => {
        [1, -1].forEach(side => {
          const pts = this.getCustomHoleWorld(h, side);
          ctx.beginPath();
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1 / scale;
          ctx.stroke();
        });
      });
    }
    
    if (CFG.showAsymmetric) {
      const ASYM_CUSTOM_HOLES = layerState ? layerState.ASYM_CUSTOM_HOLES : this.getAsymCustomHoles();
      ASYM_CUSTOM_HOLES.forEach(h => {
        const pts = this.getCustomHoleWorldAsym(h);
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1 / scale;
        ctx.stroke();
      });
    }
    
    // Draw shapes
    if (CFG.showAsymmetric) {
      const ASYM_SHAPES = layerState ? layerState.ASYM_SHAPES : this.getAsymShapes();
      ASYM_SHAPES.filter(s => !s.isExtension).forEach(s => {
        const pts = s.points.map(p => {
          const sc = { x: p.x * (s.scaleX || 1), y: p.y * (s.scaleY || 1) };
          const r = M.rotate(sc, s.rotation || 0);
          return { x: r.x + s.x, y: r.y + s.y };
        });
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1 / scale;
        ctx.stroke();
      });
    }
    
    return b;
  }
}
