/**
 * State Management System
 * Implements a centralized store with subscribe/dispatch pattern
 * for the Leather Pattern Tool application
 */

/**
 * Initial state object
 */
const initialState = {
  // Project management
  project: {
    name: '',
    description: '',
    width: 0,
    height: 0,
    unit: 'mm', // mm, cm, in
    created: null,
    modified: null,
    saved: true,
  },

  // Canvas and view
  canvas: {
    zoom: 1,
    panX: 0,
    panY: 0,
    width: 800,
    height: 600,
    gridEnabled: true,
    gridSize: 10,
    showRulers: true,
  },

  // Patterns and layers
  patterns: [], // Array of pattern objects
  selectedPatternId: null,
  layers: [], // Array of layer objects
  selectedLayerId: null,

  // Tools
  activeTool: 'pointer', // pointer, line, rectangle, circle, bezier, text
  toolOptions: {
    strokeColor: '#000000',
    fillColor: '#ffffff',
    strokeWidth: 1,
    opacity: 1,
  },

  // UI State
  ui: {
    showSidebar: true,
    showLayers: true,
    showProperties: true,
    showTools: true,
    activePanel: 'properties', // properties, layers, history
    isDarkMode: false,
    selectedTool: 'pointer',
  },

  // History/Undo-Redo
  history: {
    past: [],
    present: null,
    future: [],
    maxHistorySize: 50,
  },

  // User preferences
  preferences: {
    autoSave: true,
    autoSaveInterval: 5000, // ms
    showGridByDefault: true,
    defaultUnit: 'mm',
    snapToGrid: true,
    snapTolerance: 5,
  },

  // Application state
  app: {
    isLoading: false,
    error: null,
    notification: null,
    isEditingText: false,
    clipboard: null,
  },

  // Undo/Redo stacks
  undoStack: [],
  redoStack: [],
};

/**
 * Action types
 */
const ACTION_TYPES = {
  // Project actions
  CREATE_PROJECT: 'CREATE_PROJECT',
  UPDATE_PROJECT: 'UPDATE_PROJECT',
  LOAD_PROJECT: 'LOAD_PROJECT',

  // Canvas actions
  SET_ZOOM: 'SET_ZOOM',
  SET_PAN: 'SET_PAN',
  SET_GRID_ENABLED: 'SET_GRID_ENABLED',
  SET_GRID_SIZE: 'SET_GRID_SIZE',
  RESET_VIEW: 'RESET_VIEW',

  // Pattern actions
  ADD_PATTERN: 'ADD_PATTERN',
  UPDATE_PATTERN: 'UPDATE_PATTERN',
  DELETE_PATTERN: 'DELETE_PATTERN',
  SELECT_PATTERN: 'SELECT_PATTERN',
  DUPLICATE_PATTERN: 'DUPLICATE_PATTERN',

  // Layer actions
  ADD_LAYER: 'ADD_LAYER',
  UPDATE_LAYER: 'UPDATE_LAYER',
  DELETE_LAYER: 'DELETE_LAYER',
  SELECT_LAYER: 'SELECT_LAYER',
  REORDER_LAYERS: 'REORDER_LAYERS',
  TOGGLE_LAYER_VISIBILITY: 'TOGGLE_LAYER_VISIBILITY',

  // Tool actions
  SET_ACTIVE_TOOL: 'SET_ACTIVE_TOOL',
  UPDATE_TOOL_OPTIONS: 'UPDATE_TOOL_OPTIONS',

  // UI actions
  TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
  TOGGLE_LAYERS_PANEL: 'TOGGLE_LAYERS_PANEL',
  TOGGLE_PROPERTIES_PANEL: 'TOGGLE_PROPERTIES_PANEL',
  SET_ACTIVE_PANEL: 'SET_ACTIVE_PANEL',
  TOGGLE_DARK_MODE: 'TOGGLE_DARK_MODE',

  // History actions
  PUSH_UNDO: 'PUSH_UNDO',
  UNDO: 'UNDO',
  REDO: 'REDO',
  CLEAR_HISTORY: 'CLEAR_HISTORY',

  // App state actions
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_NOTIFICATION: 'SET_NOTIFICATION',
  CLEAR_NOTIFICATION: 'CLEAR_NOTIFICATION',
  SET_CLIPBOARD: 'SET_CLIPBOARD',

  // Preference actions
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
};

/**
 * Reducer function that handles state mutations
 */
function reducer(state = initialState, action) {
  switch (action.type) {
    // Project actions
    case ACTION_TYPES.CREATE_PROJECT:
      return {
        ...state,
        project: {
          ...initialState.project,
          ...action.payload,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        patterns: [],
        layers: [],
      };

    case ACTION_TYPES.UPDATE_PROJECT:
      return {
        ...state,
        project: {
          ...state.project,
          ...action.payload,
          modified: new Date().toISOString(),
          saved: false,
        },
      };

    case ACTION_TYPES.LOAD_PROJECT:
      return {
        ...state,
        ...action.payload,
        app: { ...state.app, isLoading: false },
      };

    // Canvas actions
    case ACTION_TYPES.SET_ZOOM:
      return {
        ...state,
        canvas: { ...state.canvas, zoom: action.payload },
      };

    case ACTION_TYPES.SET_PAN:
      return {
        ...state,
        canvas: {
          ...state.canvas,
          panX: action.payload.x,
          panY: action.payload.y,
        },
      };

    case ACTION_TYPES.SET_GRID_ENABLED:
      return {
        ...state,
        canvas: { ...state.canvas, gridEnabled: action.payload },
      };

    case ACTION_TYPES.SET_GRID_SIZE:
      return {
        ...state,
        canvas: { ...state.canvas, gridSize: action.payload },
      };

    case ACTION_TYPES.RESET_VIEW:
      return {
        ...state,
        canvas: {
          ...state.canvas,
          zoom: 1,
          panX: 0,
          panY: 0,
        },
      };

    // Pattern actions
    case ACTION_TYPES.ADD_PATTERN: {
      const newPattern = {
        id: `pattern_${Date.now()}`,
        created: new Date().toISOString(),
        ...action.payload,
      };
      return {
        ...state,
        patterns: [...state.patterns, newPattern],
        project: { ...state.project, saved: false },
      };
    }

    case ACTION_TYPES.UPDATE_PATTERN:
      return {
        ...state,
        patterns: state.patterns.map(p =>
          p.id === action.payload.id
            ? { ...p, ...action.payload.data }
            : p
        ),
        project: { ...state.project, saved: false },
      };

    case ACTION_TYPES.DELETE_PATTERN:
      return {
        ...state,
        patterns: state.patterns.filter(p => p.id !== action.payload),
        selectedPatternId: state.selectedPatternId === action.payload ? null : state.selectedPatternId,
        project: { ...state.project, saved: false },
      };

    case ACTION_TYPES.SELECT_PATTERN:
      return {
        ...state,
        selectedPatternId: action.payload,
      };

    case ACTION_TYPES.DUPLICATE_PATTERN: {
      const patternToDuplicate = state.patterns.find(p => p.id === action.payload);
      if (!patternToDuplicate) return state;
      
      const duplicated = {
        ...patternToDuplicate,
        id: `pattern_${Date.now()}`,
        name: `${patternToDuplicate.name} (copy)`,
      };
      return {
        ...state,
        patterns: [...state.patterns, duplicated],
        project: { ...state.project, saved: false },
      };
    }

    // Layer actions
    case ACTION_TYPES.ADD_LAYER: {
      const newLayer = {
        id: `layer_${Date.now()}`,
        visible: true,
        locked: false,
        created: new Date().toISOString(),
        ...action.payload,
      };
      return {
        ...state,
        layers: [...state.layers, newLayer],
        project: { ...state.project, saved: false },
      };
    }

    case ACTION_TYPES.UPDATE_LAYER:
      return {
        ...state,
        layers: state.layers.map(l =>
          l.id === action.payload.id
            ? { ...l, ...action.payload.data }
            : l
        ),
        project: { ...state.project, saved: false },
      };

    case ACTION_TYPES.DELETE_LAYER:
      return {
        ...state,
        layers: state.layers.filter(l => l.id !== action.payload),
        selectedLayerId: state.selectedLayerId === action.payload ? null : state.selectedLayerId,
        project: { ...state.project, saved: false },
      };

    case ACTION_TYPES.SELECT_LAYER:
      return {
        ...state,
        selectedLayerId: action.payload,
      };

    case ACTION_TYPES.REORDER_LAYERS:
      return {
        ...state,
        layers: action.payload,
        project: { ...state.project, saved: false },
      };

    case ACTION_TYPES.TOGGLE_LAYER_VISIBILITY:
      return {
        ...state,
        layers: state.layers.map(l =>
          l.id === action.payload
            ? { ...l, visible: !l.visible }
            : l
        ),
        project: { ...state.project, saved: false },
      };

    // Tool actions
    case ACTION_TYPES.SET_ACTIVE_TOOL:
      return {
        ...state,
        activeTool: action.payload,
        ui: { ...state.ui, selectedTool: action.payload },
      };

    case ACTION_TYPES.UPDATE_TOOL_OPTIONS:
      return {
        ...state,
        toolOptions: {
          ...state.toolOptions,
          ...action.payload,
        },
      };

    // UI actions
    case ACTION_TYPES.TOGGLE_SIDEBAR:
      return {
        ...state,
        ui: { ...state.ui, showSidebar: !state.ui.showSidebar },
      };

    case ACTION_TYPES.TOGGLE_LAYERS_PANEL:
      return {
        ...state,
        ui: { ...state.ui, showLayers: !state.ui.showLayers },
      };

    case ACTION_TYPES.TOGGLE_PROPERTIES_PANEL:
      return {
        ...state,
        ui: { ...state.ui, showProperties: !state.ui.showProperties },
      };

    case ACTION_TYPES.SET_ACTIVE_PANEL:
      return {
        ...state,
        ui: { ...state.ui, activePanel: action.payload },
      };

    case ACTION_TYPES.TOGGLE_DARK_MODE:
      return {
        ...state,
        ui: { ...state.ui, isDarkMode: !state.ui.isDarkMode },
      };

    // History actions
    case ACTION_TYPES.PUSH_UNDO: {
      const newUndoStack = [...state.undoStack];
      if (newUndoStack.length >= state.history.maxHistorySize) {
        newUndoStack.shift();
      }
      newUndoStack.push(action.payload);
      return {
        ...state,
        undoStack: newUndoStack,
        redoStack: [],
      };
    }

    case ACTION_TYPES.UNDO:
      if (state.undoStack.length === 0) return state;
      const lastState = state.undoStack[state.undoStack.length - 1];
      return {
        ...lastState,
        redoStack: [...state.redoStack, state],
        undoStack: state.undoStack.slice(0, -1),
      };

    case ACTION_TYPES.REDO:
      if (state.redoStack.length === 0) return state;
      const nextState = state.redoStack[state.redoStack.length - 1];
      return {
        ...nextState,
        undoStack: [...state.undoStack, state],
        redoStack: state.redoStack.slice(0, -1),
      };

    case ACTION_TYPES.CLEAR_HISTORY:
      return {
        ...state,
        undoStack: [],
        redoStack: [],
      };

    // App state actions
    case ACTION_TYPES.SET_LOADING:
      return {
        ...state,
        app: { ...state.app, isLoading: action.payload },
      };

    case ACTION_TYPES.SET_ERROR:
      return {
        ...state,
        app: { ...state.app, error: action.payload },
      };

    case ACTION_TYPES.SET_NOTIFICATION:
      return {
        ...state,
        app: { ...state.app, notification: action.payload },
      };

    case ACTION_TYPES.CLEAR_NOTIFICATION:
      return {
        ...state,
        app: { ...state.app, notification: null },
      };

    case ACTION_TYPES.SET_CLIPBOARD:
      return {
        ...state,
        app: { ...state.app, clipboard: action.payload },
      };

    // Preference actions
    case ACTION_TYPES.UPDATE_PREFERENCES:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload,
        },
      };

    default:
      return state;
  }
}

/**
 * Store implementation with subscribe/dispatch pattern
 */
class Store {
  constructor(initialState, reducer) {
    this.state = initialState;
    this.reducer = reducer;
    this.subscribers = [];
    this.middleware = [];
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Function to call when state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  /**
   * Dispatch an action
   * @param {Object} action - Action object with type and optional payload
   */
  dispatch(action) {
    if (!action.type) {
      throw new Error('Action must have a type property');
    }

    // Run middleware
    for (const mw of this.middleware) {
      action = mw(action) || action;
    }

    // Update state using reducer
    const previousState = this.state;
    this.state = this.reducer(this.state, action);

    // Only notify subscribers if state actually changed
    if (previousState !== this.state) {
      this.notifySubscribers();
    }

    return action;
  }

  /**
   * Notify all subscribers of state changes
   * @private
   */
  notifySubscribers() {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in subscriber callback:', error);
      }
    });
  }

  /**
   * Add middleware function
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Reset state to initial state
   */
  reset() {
    this.state = { ...initialState };
    this.notifySubscribers();
  }

  /**
   * Get action creators
   */
  static getActions() {
    return ACTION_TYPES;
  }
}

/**
 * Create and export store instance
 */
const store = new Store(initialState, reducer);

/**
 * Export action creators for convenience
 */
const actions = {
  // Project
  createProject: (payload) => ({ type: ACTION_TYPES.CREATE_PROJECT, payload }),
  updateProject: (payload) => ({ type: ACTION_TYPES.UPDATE_PROJECT, payload }),
  loadProject: (payload) => ({ type: ACTION_TYPES.LOAD_PROJECT, payload }),

  // Canvas
  setZoom: (zoom) => ({ type: ACTION_TYPES.SET_ZOOM, payload: zoom }),
  setPan: (x, y) => ({ type: ACTION_TYPES.SET_PAN, payload: { x, y } }),
  setGridEnabled: (enabled) => ({ type: ACTION_TYPES.SET_GRID_ENABLED, payload: enabled }),
  setGridSize: (size) => ({ type: ACTION_TYPES.SET_GRID_SIZE, payload: size }),
  resetView: () => ({ type: ACTION_TYPES.RESET_VIEW }),

  // Patterns
  addPattern: (payload) => ({ type: ACTION_TYPES.ADD_PATTERN, payload }),
  updatePattern: (id, data) => ({ type: ACTION_TYPES.UPDATE_PATTERN, payload: { id, data } }),
  deletePattern: (id) => ({ type: ACTION_TYPES.DELETE_PATTERN, payload: id }),
  selectPattern: (id) => ({ type: ACTION_TYPES.SELECT_PATTERN, payload: id }),
  duplicatePattern: (id) => ({ type: ACTION_TYPES.DUPLICATE_PATTERN, payload: id }),

  // Layers
  addLayer: (payload) => ({ type: ACTION_TYPES.ADD_LAYER, payload }),
  updateLayer: (id, data) => ({ type: ACTION_TYPES.UPDATE_LAYER, payload: { id, data } }),
  deleteLayer: (id) => ({ type: ACTION_TYPES.DELETE_LAYER, payload: id }),
  selectLayer: (id) => ({ type: ACTION_TYPES.SELECT_LAYER, payload: id }),
  reorderLayers: (layers) => ({ type: ACTION_TYPES.REORDER_LAYERS, payload: layers }),
  toggleLayerVisibility: (id) => ({ type: ACTION_TYPES.TOGGLE_LAYER_VISIBILITY, payload: id }),

  // Tools
  setActiveTool: (tool) => ({ type: ACTION_TYPES.SET_ACTIVE_TOOL, payload: tool }),
  updateToolOptions: (options) => ({ type: ACTION_TYPES.UPDATE_TOOL_OPTIONS, payload: options }),

  // UI
  toggleSidebar: () => ({ type: ACTION_TYPES.TOGGLE_SIDEBAR }),
  toggleLayersPanel: () => ({ type: ACTION_TYPES.TOGGLE_LAYERS_PANEL }),
  togglePropertiesPanel: () => ({ type: ACTION_TYPES.TOGGLE_PROPERTIES_PANEL }),
  setActivePanel: (panel) => ({ type: ACTION_TYPES.SET_ACTIVE_PANEL, payload: panel }),
  toggleDarkMode: () => ({ type: ACTION_TYPES.TOGGLE_DARK_MODE }),

  // History
  pushUndo: (state) => ({ type: ACTION_TYPES.PUSH_UNDO, payload: state }),
  undo: () => ({ type: ACTION_TYPES.UNDO }),
  redo: () => ({ type: ACTION_TYPES.REDO }),
  clearHistory: () => ({ type: ACTION_TYPES.CLEAR_HISTORY }),

  // App
  setLoading: (loading) => ({ type: ACTION_TYPES.SET_LOADING, payload: loading }),
  setError: (error) => ({ type: ACTION_TYPES.SET_ERROR, payload: error }),
  setNotification: (notification) => ({ type: ACTION_TYPES.SET_NOTIFICATION, payload: notification }),
  clearNotification: () => ({ type: ACTION_TYPES.CLEAR_NOTIFICATION }),
  setClipboard: (clipboard) => ({ type: ACTION_TYPES.SET_CLIPBOARD, payload: clipboard }),

  // Preferences
  updatePreferences: (preferences) => ({ type: ACTION_TYPES.UPDATE_PREFERENCES, payload: preferences }),
};

// Export
export { store, actions, ACTION_TYPES, initialState, reducer };
