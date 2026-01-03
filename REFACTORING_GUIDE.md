# App.js Refactoring Guide

## Overview

This document provides a comprehensive guide for continuing the refactoring of `app.js` from a 3,928-line monolithic file into focused, maintainable modules.

## Current Status

- **Original size**: 3,928 lines
- **Current size**: 2,378 lines  
- **Modules created**: 10
- **Lines extracted**: ~2,300 lines into modules
- **Net reduction**: ~1,550 lines of complex code replaced with clean modular calls

## Completed Modules

### 1. HistoryManager (`js/state/HistoryManager.js`)
- **Lines**: 107
- **Purpose**: Undo/redo history management
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~35 lines of inline history code

### 2. ToastManager (`js/ui/ToastManager.js`)
- **Lines**: 65
- **Purpose**: Notification toast display
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~5 lines of inline toast code

### 3. FileManager (`js/io/FileManager.js`)
- **Lines**: 173
- **Purpose**: Project save/load operations
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~180 lines of save/load code

### 4. RefImageManager (`js/io/RefImageManager.js`)
- **Lines**: ~150
- **Purpose**: Reference image handling
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~150 lines of reference image code

### 5. OutlinerManager (`js/ui/OutlinerManager.js`)
- **Lines**: ~450
- **Purpose**: Outliner panel management
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~450 lines of outliner code

### 6. ToolManager (`js/tools/ToolManager.js`)
- **Lines**: ~150
- **Purpose**: Tool mode management
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~150 lines of tool management code

### 7. LayerManager (`js/layers/LayerManager.js`)
- **Lines**: ~300
- **Purpose**: Two-layer mode management
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~300 lines of layer code

### 8. PropertiesPanel (`js/ui/PropertiesPanel.js`)
- **Lines**: ~250
- **Purpose**: Properties panel management
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~250 lines of properties code

### 9. PublishManager (`js/publish/PublishManager.js`)
- **Lines**: 1,548
- **Purpose**: Publish mode functionality (A4 pages, full pattern, export)
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~860 lines of publish code
- **Methods extracted**: 11 (getStitchCount, centerPublishView, togglePublish, downloadPattern, downloadFullPattern, downloadA4Pages, drawPublish, drawPublishA4Pages, drawPublishFullPattern, drawPatternLayerFullPattern, drawPatternLayer)

### 10. InputHandler (`js/core/InputHandler.js`) ⭐ NEW - Phase 5B Complete!
- **Lines**: 451
- **Purpose**: Mouse, touch, and keyboard input handling
- **Status**: ✅ Integrated into app.js
- **Replaced**: ~428 lines of input handling code
- **Methods extracted**: 5 (getWorld, onDown, onMove, onUp, onDblClick)
- **Impact**: Handles all user interactions - clicking, dragging, hover effects, double-click, tool mode input
- **Achievement**: Reduced app.js from 2,806 to 2,378 lines

## Refactoring Pattern

Follow this 5-step pattern for each module:

### Step 1: Identify Module Scope

Look for code that:
- Has a single clear responsibility
- Is relatively self-contained
- Has clear inputs and outputs
- Can be tested independently

**Examples**:
- ✅ File I/O operations (save/load)
- ✅ Toast notifications
- ✅ History management
- ✅ Reference image handling
- ⚠️ Main draw loop (has many dependencies)
- ❌ Everything at once (too risky)

### Step 2: Extract to Module

Create a new file in the appropriate directory:

```
js/
├── io/          - File operations, import/export
├── core/        - Essential rendering, input, selection
├── geometry/    - Path building, shape utils, stitches
├── layers/      - Two-layer mode logic
├── publish/     - Publish mode functionality
├── tools/       - Tool implementations
├── ui/          - UI components and managers
├── state/       - State management
└── utils/       - Helper utilities
```

**Module Template**:

```javascript
/**
 * ModuleName - Brief description of purpose
 * 
 * Detailed explanation of what this module does and why.
 */
export class ModuleName {
  /**
   * @param {Object} options - Configuration options
   * @param {Function} options.dependency - Required dependency
   */
  constructor(options = {}) {
    this.dependency = options.dependency || (() => {});
  }

  /**
   * Public method description
   * @param {type} param - Parameter description
   * @returns {type} Return value description
   */
  publicMethod(param) {
    // Implementation
  }

  /**
   * Private helper method
   * @private
   */
  _privateHelper() {
    // Implementation
  }
}
```

### Step 3: Format Code Properly

Transform minified style to readable code:

**Before**:
```javascript
undo(){if(HISTORY_IDX>0){HISTORY_IDX--;this.restoreState(HISTORY[HISTORY_IDX]);this.updateUndoRedoButtons();this.showToast('Undo', 'info')}}
```

**After**:
```javascript
undo() {
  const prevState = this.historyManager.undo();
  if (prevState) {
    this.restoreState(prevState);
    this.showToast('Undo', 'info');
  }
}
```

**Formatting Rules**:
- One statement per line
- 2-space indentation
- Clear variable names
- Blank lines between logical sections
- JSDoc comments for public methods

### Step 4: Integrate Module

**Import at top of app.js**:
```javascript
import { ModuleName } from './path/to/ModuleName.js';
```

**Initialize in constructor** (if stateful):
```javascript
constructor() {
  // ... existing code ...
  this.moduleName = new ModuleName({
    dependency: () => this.someMethod()
  });
}
```

**Replace inline code** with module calls:
```javascript
// Before
someMethod() {
  // 50 lines of inline logic
  // ...
}

// After
someMethod() {
  return this.moduleName.doSomething();
}
```

### Step 5: Test Thoroughly

**Build test**:
```bash
npm run build
```

**Manual testing**:
1. Start dev server: `npm run dev`
2. Open browser to http://localhost:3000
3. Test all affected features
4. Check browser console for errors
5. Test edge cases

**Verification checklist**:
- [ ] Build succeeds without errors
- [ ] App loads correctly
- [ ] Feature works as before
- [ ] No console errors
- [ ] Undo/redo works
- [ ] Save/load works
- [ ] UI updates correctly

## Recommended Extraction Order

Extract modules in this order to minimize risk:

### ✅ COMPLETED - Priority 1-3: Low to High Risk
1. ✅ **HistoryManager** - Undo/redo management
2. ✅ **ToastManager** - Notification toasts
3. ✅ **FileManager** - Save/load operations
4. ✅ **RefImageManager** - Reference image handling
5. ✅ **OutlinerManager** - Outliner panel logic
6. ✅ **ToolManager** - Tool mode management
7. ✅ **LayerManager** - Two-layer mode
8. ✅ **PropertiesPanel** - Properties bar
9. ✅ **PublishManager** - Publish mode functionality
10. ✅ **InputHandler** - Mouse/touch events ⭐ **Phase 5B Complete!**

### Priority 4: Remaining Core Functionality (Next Up)
11. **SelectionManager** (~300 lines) - Hit testing
    - Selection logic, hover detection
    - Tightly coupled with rendering

12. **Renderer** (~800 lines) - Main drawing
    - `draw()`, `drawNodes()`, `drawGrid()`, etc.
   - Most complex, extract last

### Priority 4: Tool Implementations
10. **HoleTool**, **StitchTool**, **ShapeTool**, **CustomHoleTool**, **TextTool**
    - Each ~50-100 lines
    - Extract after ToolManager

## Common Pitfalls to Avoid

### 1. ❌ Extracting Too Much at Once
**Problem**: Large extractions increase bug risk and make testing difficult.

**Solution**: Extract one module at a time, test thoroughly before continuing.

### 2. ❌ Not Handling Global State
**Problem**: Modules directly access global variables like `NODES`, `SELECTED`, etc.

**Solution**: Pass state via constructor or method parameters:
```javascript
constructor(options) {
  this.getNodes = options.getNodes || (() => []);
  this.getSelected = options.getSelected || (() => null);
}
```

### 3. ❌ Breaking Backward Compatibility
**Problem**: HTML onclick handlers expect `window.app.method()` to exist.

**Solution**: Keep method signatures in app.js, delegate to modules:
```javascript
// In app.js - keep for HTML onclick handlers
saveProject() {
  const projectName = document.getElementById('project-title').textContent;
  this.fileManager.saveProject(projectName);
}
```

### 4. ❌ Incomplete Testing
**Problem**: Missing edge cases leads to bugs discovered later.

**Solution**: Test checklist for every module:
- [ ] Happy path works
- [ ] Edge cases handled
- [ ] Error cases handled
- [ ] Undo/redo works
- [ ] Save/load preserves state
- [ ] UI updates correctly

## Module API Design Guidelines

### Good API Design

✅ **Simple, focused methods**:
```javascript
saveState(state)
undo()
redo()
canUndo()
canRedo()
```

✅ **Clear parameter names**:
```javascript
show(message, type, duration)
```

✅ **Promises for async operations**:
```javascript
async loadProjectFromFile(file)
```

✅ **Callbacks for events**:
```javascript
new HistoryManager({
  onUpdate: () => updateButtons()
})
```

### Bad API Design

❌ **Too many parameters**:
```javascript
doComplexThing(a, b, c, d, e, f, g)
```

❌ **Unclear names**:
```javascript
process(data)
handle(thing)
```

❌ **Mixed concerns**:
```javascript
saveAndDrawAndUpdateUI()
```

## Dependency Injection Pattern

Use constructor injection to avoid tight coupling:

**Bad** (tight coupling):
```javascript
class FileManager {
  saveProject() {
    // Directly accesses globals
    const nodes = NODES;
    const holes = SYM_HOLES;
    // ...
  }
}
```

**Good** (dependency injection):
```javascript
class FileManager {
  constructor(options) {
    this.getState = options.getState;
  }
  
  saveProject() {
    const state = this.getState();
    // ...
  }
}

// In app.js
this.fileManager = new FileManager({
  getState: () => ({
    NODES,
    SYM_HOLES,
    // ...
  })
});
```

## Handling Global State

Eventually, consolidate globals into StateManager:

**Current** (scattered globals):
```javascript
let MODE = 'select';
let SELECTED = null;
let NODES = [...];
let SYM_HOLES = [];
// ... 20+ more globals
```

**Future** (centralized state):
```javascript
import { StateManager } from './state/StateManager.js';

const state = new StateManager({
  mode: 'select',
  selected: null,
  nodes: [...],
  symHoles: [],
  // ...
});

// Access via manager
state.get('mode')
state.set('mode', 'hole')
state.subscribe('mode', (newMode) => updateUI())
```

## Testing Recommendations

### Manual Test Script

After each integration, run through this script:

1. **Load app** - http://localhost:3000
2. **Add hole** - Click hole tool, place hole
3. **Undo** - Press Ctrl+Z or click undo button
4. **Redo** - Press Ctrl+Y or click redo button  
5. **Select** - Click select tool, click hole
6. **Modify** - Change hole size in properties
7. **Delete** - Press delete or click delete button
8. **Add stitch** - Click stitch tool, draw stitch line
9. **Save project** - File menu → Save
10. **Load project** - File menu → Load, select file
11. **Two-layer mode** - Settings → Project Type → Two-Layer
12. **Switch layers** - Toggle front/back layer
13. **Publish mode** - Click Publish button
14. **Export** - Download pattern
15. **Reference image** - Load reference image

### Automated Testing (Future)

Consider adding Vitest tests for modules:

```javascript
import { describe, it, expect } from 'vitest';
import { HistoryManager } from './HistoryManager.js';

describe('HistoryManager', () => {
  it('should save and restore state', () => {
    const manager = new HistoryManager();
    const state = { nodes: [1, 2, 3] };
    
    manager.saveState(state);
    expect(manager.canUndo()).toBe(true);
    
    const restored = manager.undo();
    expect(restored).toEqual(state);
  });
});
```

## Progress Tracking

Keep this checklist updated as you progress:

### Completed ✅
- [x] HistoryManager - Integrated
- [x] ToastManager - Integrated
- [x] FileManager - Integrated
- [x] RefImageManager - Integrated
- [x] OutlinerManager - Integrated
- [x] ToolManager - Integrated
- [x] LayerManager - Integrated
- [x] PropertiesPanel - Integrated
- [x] PublishManager - Integrated ⭐ (Phase 4 complete!)
- [x] InputHandler - Integrated ⭐ (Phase 5B complete!)

### To Do 📋
- [ ] SelectionManager (~300 lines)
- [ ] Renderer (~800 lines)
- [ ] Tool implementations (5 tools)
- [ ] Geometry modules (3 modules)
- [ ] Export modules (2 modules)

## Getting Help

### Resources

- **Original issue**: #[issue-number]
- **Architecture docs**: `TWO_LAYER_MODE.md`, `README.md`
- **Existing modules**: `js/state/StateManager.js`, `js/ui/UIManager.js`
- **Config**: `js/config.js` - App configuration
- **Math utilities**: `js/math.js` - Geometry helpers

### Questions to Ask

Before starting each module:
1. What is the single responsibility of this module?
2. What are its inputs (dependencies)?
3. What are its outputs (return values)?
4. What state does it manage?
5. How will I test it?

## Conclusion

This refactoring is a marathon, not a sprint. Take your time, test thoroughly, and commit incremental progress. Each extracted module makes the codebase more maintainable and reduces future technical debt.

**Remember**: It's better to have 3 fully-working extracted modules than 10 half-broken ones.

Good luck! 🚀
