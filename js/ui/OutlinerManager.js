/**
 * OutlinerManager - Handles outliner panel operations
 * 
 * Manages the outliner panel that shows all items in a hierarchical tree,
 * allowing visibility/lock toggling, renaming, drag-drop parenting, and selection.
 */
export class OutlinerManager {
  /**
   * @param {Object} options - Configuration options
   * @param {Function} options.getState - Function to get all state arrays
   * @param {Function} options.getSelected - Function to get currently selected item
   * @param {Function} options.setSelected - Function to set selected item
   * @param {Function} options.getConfig - Function to get config object
   * @param {Function} options.getHolster - Function to get holster object
   * @param {Function} options.onUpdate - Callback when outliner needs to update display
   * @param {Function} options.onSaveState - Callback to save state after changes
   * @param {Function} options.showToast - Function to show toast messages
   * @param {Function} options.closeSettings - Function to close settings panel
   */
  constructor(options = {}) {
    this.getState = options.getState || (() => ({}));
    this.getSelected = options.getSelected || (() => null);
    this.setSelected = options.setSelected || (() => {});
    this.getConfig = options.getConfig || (() => ({}));
    this.getHolster = options.getHolster || (() => ({}));
    this.onUpdate = options.onUpdate || (() => {});
    this.onSaveState = options.onSaveState || (() => {});
    this.showToast = options.showToast || (() => {});
    this.closeSettings = options.closeSettings || (() => {});
    
    this.isOpen = false;
  }

  /**
   * Toggle outliner panel open/closed
   */
  toggleOutliner() {
    this.isOpen = !this.isOpen;
    document.getElementById('outliner-panel').classList.toggle('open', this.isOpen);
    document.getElementById('outliner-btn').style.display = this.isOpen ? 'none' : 'flex';
    document.getElementById('settings-btn').style.display = this.isOpen ? 'none' : 'flex';
    
    if (this.isOpen) {
      this.updateOutliner();
      this.closeSettings();
    }
  }

  /**
   * Update the outliner content
   */
  updateOutliner() {
    const c = document.getElementById('outliner-content');
    const state = this.getState();
    const SELECTED = this.getSelected();
    const CFG = this.getConfig();
    const HOLSTER = this.getHolster();
    
    const makeItem = (type, idx, icon, name, item, depth = 0) => {
      const sel = SELECTED?.type === type && SELECTED?.idx === idx;
      const hidden = item?.hidden;
      const locked = item?.locked;
      const indent = depth > 0 ? ` style="padding-left:${depth * 16 + 6}px"` : ' style="padding-left:6px"';
      return '<div class="outliner-item' + (sel ? ' selected' : '') + (hidden ? ' hidden-item' : '') + (locked ? ' locked-item' : '') + '"' + indent + ' draggable="true" data-type="' + type + '" data-idx="' + idx + '" onclick="app.selectOutlinerItem(\'' + type + '\',' + idx + ')" ondblclick="event.stopPropagation();app.renameItem(\'' + type + '\',' + idx + ')" ondragstart="app.outlinerDragStart(event)" ondragover="app.outlinerDragOver(event)" ondrop="app.outlinerDrop(event,\'' + type + '\',' + idx + ')"><span class="vis-toggle" onclick="event.stopPropagation();app.toggleItemVis(\'' + type + '\',' + idx + ')">' + (hidden ? '○' : '●') + '</span><span class="lock-toggle" onclick="event.stopPropagation();app.toggleItemLock(\'' + type + '\',' + idx + ')">' + (locked ? '🔒' : '🔓') + '</span><span class="icon">' + icon + '</span><span class="name">' + name + '</span></div>';
    };
    
    // Build a flat list of all items with their metadata
    const allItems = [];
    state.EDGE_RANGES.forEach((r, i) => { allItems.push({type: 'edgeRange', idx: i, icon: '⊢', name: r.name || 'Range ' + (i + 1), item: r, category: 'Edge Ranges'}) });
    state.MERGED_EDGE_RANGES.forEach((r, i) => { allItems.push({type: 'mergedEdgeRange', idx: i, icon: '⊡', name: r.name || 'Perimeter ' + (i + 1), item: r, category: 'Edge Ranges'}) });
    state.SYM_HOLES.forEach((h, i) => { allItems.push({type: 'symHole', idx: i, icon: '○', name: h.name || 'Sym Hole ' + (i + 1), item: h, category: 'Holes'}) });
    state.ASYM_HOLES.forEach((h, i) => { allItems.push({type: 'asymHole', idx: i, icon: '○', name: h.name || 'Asym Hole ' + (i + 1), item: h, category: 'Holes'}) });
    state.SYM_CUSTOM_HOLES.forEach((h, i) => { allItems.push({type: 'symCustomHole', idx: i, icon: '✏', name: h.name || 'Sym Custom ' + (i + 1), item: h, category: 'Custom Holes'}) });
    state.ASYM_CUSTOM_HOLES.forEach((h, i) => { allItems.push({type: 'asymCustomHole', idx: i, icon: '✏', name: h.name || 'Asym Custom ' + (i + 1), item: h, category: 'Custom Holes'}) });
    state.EDGE_STITCHES.forEach((s, i) => { const icon = s.isMerged ? '⊡' : '⊢'; const name = s.name || (s.isMerged ? 'Perim Stitch' : 'Edge Stitch') + ' ' + (i + 1); allItems.push({type: 'edgeStitch', idx: i, icon: icon, name: name, item: s, category: 'Stitch Lines'}) });
    state.SYM_STITCHES.forEach((s, i) => { allItems.push({type: 'symStitch', idx: i, icon: '┅', name: s.name || 'Sym Stitch ' + (i + 1), item: s, category: 'Stitch Lines'}) });
    state.ASYM_STITCHES.forEach((s, i) => { allItems.push({type: 'asymStitch', idx: i, icon: '┅', name: s.name || 'Asym Stitch ' + (i + 1), item: s, category: 'Stitch Lines'}) });
    state.SYM_SHAPES.forEach((s, i) => { const icon = s.isExtension ? '⊕' : s.isLinkedCircle ? '◎' : '◇'; const name = s.name || (s.isExtension ? 'Extension' : s.isLinkedCircle ? 'Linked Circle' : 'Sym Shape') + ' ' + (i + 1); allItems.push({type: 'symShape', idx: i, icon: icon, name: name, item: s, category: 'Shapes'}) });
    state.ASYM_SHAPES.forEach((s, i) => { const icon = s.isExtension ? '⊕' : s.isLinkedCircle ? '◎' : '◇'; const name = s.name || (s.isExtension ? 'Extension' : s.isLinkedCircle ? 'Linked Circle' : 'Asym Shape') + ' ' + (i + 1); allItems.push({type: 'asymShape', idx: i, icon: icon, name: name, item: s, category: 'Shapes'}) });
    state.TEXT_ANNOTATIONS.forEach((t, i) => {
      const displayName = t.name || (t.text || 'Text');
      allItems.push({type: 'textAnnotation', idx: i, icon: 'T', name: displayName, item: t, category: 'Text'});
    });
    
    // Helper to render item with children recursively
    const renderItemWithChildren = (item, depth = 0, renderedItems) => {
      const key = `${item.type}_${item.idx}`;
      if (renderedItems.has(key)) return ''; // Already rendered as child
      renderedItems.add(key);
      let html = makeItem(item.type, item.idx, item.icon, item.name, item.item, depth);
      // Find children
      allItems.forEach(child => {
        if (child.item?.parent?.type === item.type && child.item?.parent?.idx === item.idx) {
          html += renderItemWithChildren(child, depth + 1, renderedItems);
        }
      });
      return html;
    };
    
    let html = '';
    // Show current layer info in two-layer mode
    if (CFG.projectType === 'two-layer') {
      html += '<h3 style="color:' + (state.CURRENT_LAYER === 'front' ? '#007AFF' : '#FF9500') + '">' + (state.CURRENT_LAYER === 'front' ? 'Front' : 'Back') + ' Layer</h3>';
    } else {
      html += '<h3>Pattern</h3>';
    }
    
    // Add Root container at the top
    const rootSel = SELECTED?.type === 'root';
    html += '<div class="outliner-item' + (rootSel ? ' selected' : '') + (false ? ' locked-item' : '') + '" style="padding-left:6px" ondragover="app.outlinerDragOver(event)" ondrop="app.outlinerDrop(event,\'root\',0)" onclick="app.selectOutlinerItem(\'root\',0)"><span class="icon">📁</span><span class="name">Root</span></div>';
    
    // Main Shape as child of Root
    const holsterSel = SELECTED?.type === 'holster';
    html += '<div class="outliner-item' + (holsterSel ? ' selected' : '') + (HOLSTER.locked ? ' locked-item' : '') + '" style="padding-left:22px" ondragover="app.outlinerDragOver(event)" ondrop="app.outlinerDrop(event,\'holster\',0)" onclick="app.selectOutlinerItem(\'holster\',0)"><span class="lock-toggle" onclick="event.stopPropagation();app.toggleItemLock(\'holster\',0)">' + (HOLSTER.locked ? '🔒' : '🔓') + '</span><span class="icon">◇</span><span class="name">Main Shape</span></div>';
    
    // Group and render items by category
    const categories = ['Edge Ranges', 'Holes', 'Custom Holes', 'Stitch Lines', 'Shapes', 'Text'];
    const renderedItems = new Set();
    
    // First render children of Main Shape (holster) immediately after it
    allItems.forEach(item => {
      if (item.item?.parent?.type === 'holster' && item.item?.parent?.idx === 0) {
        html += renderItemWithChildren(item, 2, renderedItems);
      }
    });
    
    categories.forEach(cat => {
      const catItems = allItems.filter(item => item.category === cat);
      if (catItems.length > 0) {
        html += '<h3>' + cat + '</h3>';
        catItems.forEach(item => {
          // Only render root items (no parent or parent doesn't exist in our items)
          // Items parented to 'holster' should also be rendered but indented
          if (!item.item?.parent || !allItems.some(i => i.type === item.item.parent.type && i.idx === item.item.parent.idx)) {
            html += renderItemWithChildren(item, 0, renderedItems);
          }
        });
      }
    });
    
    c.innerHTML = html;
  }

  /**
   * Toggle item visibility
   * @param {string} type - Item type
   * @param {number} idx - Item index
   */
  toggleItemVis(type, idx) {
    const item = this.getItemByTypeIdx(type, idx);
    if (item) {
      item.hidden = !item.hidden;
      this.updateOutliner();
      this.onUpdate();
    }
  }

  /**
   * Toggle item lock state
   * @param {string} type - Item type
   * @param {number} idx - Item index
   */
  toggleItemLock(type, idx) {
    const HOLSTER = this.getHolster();
    if (type === 'holster') {
      HOLSTER.locked = !HOLSTER.locked;
    } else {
      const item = this.getItemByTypeIdx(type, idx);
      if (item) {
        item.locked = !item.locked;
      }
    }
    this.updateOutliner();
    this.onUpdate();
  }

  /**
   * Get item by type and index
   * @param {string} type - Item type
   * @param {number} idx - Item index
   * @returns {Object|null} The item or null
   */
  getItemByTypeIdx(type, idx) {
    const state = this.getState();
    if (type === 'symHole') return state.SYM_HOLES[idx];
    if (type === 'asymHole') return state.ASYM_HOLES[idx];
    if (type === 'symCustomHole') return state.SYM_CUSTOM_HOLES[idx];
    if (type === 'asymCustomHole') return state.ASYM_CUSTOM_HOLES[idx];
    if (type === 'symStitch') return state.SYM_STITCHES[idx];
    if (type === 'asymStitch') return state.ASYM_STITCHES[idx];
    if (type === 'edgeStitch') return state.EDGE_STITCHES[idx];
    if (type === 'edgeRange') return state.EDGE_RANGES[idx];
    if (type === 'mergedEdgeRange') return state.MERGED_EDGE_RANGES[idx];
    if (type === 'symShape') return state.SYM_SHAPES[idx];
    if (type === 'asymShape') return state.ASYM_SHAPES[idx];
    if (type === 'textAnnotation') return state.TEXT_ANNOTATIONS[idx];
    return null;
  }

  /**
   * Handle drag start for outliner items
   * @param {DragEvent} e - Drag event
   */
  outlinerDragStart(e) {
    const item = e.target.closest('.outliner-item');
    if (!item) return;
    e.dataTransfer.setData('text/plain', item.dataset.type + ',' + item.dataset.idx);
    e.dataTransfer.effectAllowed = 'move';
  }

  /**
   * Handle drag over for outliner items
   * @param {DragEvent} e - Drag event
   */
  outlinerDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.outliner-item').forEach(i => i.classList.remove('drag-over'));
    const item = e.target.closest('.outliner-item');
    if (item) item.classList.add('drag-over');
  }

  /**
   * Handle drop for outliner items
   * @param {DragEvent} e - Drag event
   * @param {string} targetType - Target item type
   * @param {number} targetIdx - Target item index
   */
  outlinerDrop(e, targetType, targetIdx) {
    e.preventDefault();
    document.querySelectorAll('.outliner-item').forEach(i => i.classList.remove('drag-over'));
    const data = e.dataTransfer.getData('text/plain').split(',');
    if (data.length !== 2) return;
    const srcType = data[0];
    const srcIdx = parseInt(data[1]);
    if (srcType === targetType && srcIdx === targetIdx) return;
    
    const srcObj = this.getObjByTypeIdx(srcType, srcIdx);
    if (!srcObj) return;
    
    // Check if dropping on root - this unparents the item
    if (targetType === 'root') {
      if (srcObj.parent) {
        delete srcObj.parent;
        this.updateOutliner();
        this.onSaveState();
      }
      return;
    }
    
    // Check if dropping on holster - this parents the item TO the holster
    if (targetType === 'holster') {
      // Prevent circular parenting (shouldn't happen with holster but be safe)
      srcObj.parent = {type: 'holster', idx: 0};
      this.updateOutliner();
      this.onSaveState();
      return;
    }
    
    const targetObj = this.getObjByTypeIdx(targetType, targetIdx);
    if (targetObj) {
      // Prevent circular parenting (can't parent to self or to own descendant)
      if (this.isDescendantOf(targetType, targetIdx, srcType, srcIdx)) {
        this.showToast('Cannot create circular parent relationship', 'error');
        return;
      }
      srcObj.parent = {type: targetType, idx: targetIdx};
      this.updateOutliner();
      this.onSaveState();
    }
  }

  /**
   * Check if an item is a descendant of another
   * @param {string} checkType - Type to check
   * @param {number} checkIdx - Index to check
   * @param {string} ancestorType - Ancestor type
   * @param {number} ancestorIdx - Ancestor index
   * @returns {boolean} True if checkType/checkIdx is a descendant of ancestorType/ancestorIdx
   */
  isDescendantOf(checkType, checkIdx, ancestorType, ancestorIdx) {
    // Check if checkType/checkIdx is a descendant of ancestorType/ancestorIdx
    if (checkType === ancestorType && checkIdx === ancestorIdx) return true;
    const checkObj = this.getObjByTypeIdx(checkType, checkIdx);
    if (!checkObj || !checkObj.parent) return false;
    return this.isDescendantOf(checkObj.parent.type, checkObj.parent.idx, ancestorType, ancestorIdx);
  }

  /**
   * Rename an item
   * @param {string} type - Item type
   * @param {number} idx - Item index
   */
  renameItem(type, idx) {
    const obj = this.getObjByTypeIdx(type, idx);
    if (!obj) return;
    const item = document.querySelector(`.outliner-item[data-type="${type}"][data-idx="${idx}"]`);
    if (!item) return;
    const nameSpan = item.querySelector('.name');
    if (!nameSpan) return;
    const current = obj.name || nameSpan.textContent;
    
    // Create inline input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.style.cssText = 'width:100%;padding:2px;font-size:12px;border:1px solid #007AFF;border-radius:3px;background:#333;color:#fff;';
    nameSpan.innerHTML = '';
    nameSpan.appendChild(input);
    input.focus();
    input.select();
    
    const finishEdit = () => {
      obj.name = input.value || current;
      this.updateOutliner();
      this.onSaveState();
    };
    
    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.updateOutliner();
      }
    });
  }

  /**
   * Select an item in the outliner
   * @param {string} type - Item type
   * @param {number} idx - Item index
   */
  selectOutlinerItem(type, idx) {
    this.setSelected({type, idx});
    this.updateOutliner();
    this.onUpdate();
  }

  /**
   * Get object by type and index (similar to getItemByTypeIdx but includes edge ranges)
   * @param {string} type - Item type
   * @param {number} idx - Item index
   * @returns {Object|null} The object or null
   */
  getObjByTypeIdx(type, idx) {
    const state = this.getState();
    if (type === 'symHole') return state.SYM_HOLES[idx];
    if (type === 'asymHole') return state.ASYM_HOLES[idx];
    if (type === 'symStitch') return state.SYM_STITCHES[idx];
    if (type === 'asymStitch') return state.ASYM_STITCHES[idx];
    if (type === 'symCustomHole') return state.SYM_CUSTOM_HOLES[idx];
    if (type === 'asymCustomHole') return state.ASYM_CUSTOM_HOLES[idx];
    if (type === 'symShape') return state.SYM_SHAPES[idx];
    if (type === 'asymShape') return state.ASYM_SHAPES[idx];
    if (type === 'textAnnotation') return state.TEXT_ANNOTATIONS[idx];
    if (type === 'edgeRange') return state.EDGE_RANGES[idx];
    if (type === 'edgeStitch') return state.EDGE_STITCHES[idx];
    return null;
  }
}
