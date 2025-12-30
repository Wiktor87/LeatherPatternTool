/**
 * Input Event Handling Module
 * Manages mouse, touch, keyboard, and wheel events
 * Provides coordinate transformation and input state tracking
 */

// Input state management
const inputState = {
  mouse: {
    x: 0,
    y: 0,
    deltaX: 0,
    deltaY: 0,
    pressed: false,
    button: null,
    timestamp: 0
  },
  touch: {
    active: false,
    x: 0,
    y: 0,
    deltaX: 0,
    deltaY: 0,
    touches: [],
    timestamp: 0
  },
  keyboard: {
    keys: {},
    lastKey: null,
    timestamp: 0
  },
  wheel: {
    deltaX: 0,
    deltaY: 0,
    deltaZ: 0,
    timestamp: 0
  },
  camera: {
    x: 0,
    y: 0,
    scale: 1.0,
    rotation: 0
  }
};

/**
 * Main input event handler
 * Dispatches events to appropriate handlers based on event type
 * @param {Event} event - The input event
 */
function onInput(event) {
  if (!event) return;

  switch (event.type) {
    case 'mousemove':
      handleMouseMove(event);
      break;
    case 'mousedown':
      handleMouseDown(event);
      break;
    case 'mouseup':
      handleMouseUp(event);
      break;
    case 'wheel':
      handleWheel(event);
      break;
    case 'touchstart':
      handleTouchStart(event);
      break;
    case 'touchmove':
      handleTouchMove(event);
      break;
    case 'touchend':
      handleTouchEnd(event);
      break;
    case 'keydown':
      handleKeyDown(event);
      break;
    case 'keyup':
      handleKeyUp(event);
      break;
  }
}

/**
 * Handle mouse move events
 * @param {MouseEvent} event
 */
function handleMouseMove(event) {
  const prevX = inputState.mouse.x;
  const prevY = inputState.mouse.y;

  inputState.mouse.x = event.clientX;
  inputState.mouse.y = event.clientY;
  inputState.mouse.deltaX = event.clientX - prevX;
  inputState.mouse.deltaY = event.clientY - prevY;
  inputState.mouse.timestamp = Date.now();
}

/**
 * Handle mouse down events
 * @param {MouseEvent} event
 */
function handleMouseDown(event) {
  inputState.mouse.pressed = true;
  inputState.mouse.button = event.button;
  inputState.mouse.x = event.clientX;
  inputState.mouse.y = event.clientY;
  inputState.mouse.timestamp = Date.now();
}

/**
 * Handle mouse up events
 * @param {MouseEvent} event
 */
function handleMouseUp(event) {
  inputState.mouse.pressed = false;
  inputState.mouse.button = null;
  inputState.mouse.x = event.clientX;
  inputState.mouse.y = event.clientY;
  inputState.mouse.timestamp = Date.now();
}

/**
 * Handle wheel events
 * @param {WheelEvent} event
 */
function handleWheel(event) {
  event.preventDefault();

  inputState.wheel.deltaX = event.deltaX;
  inputState.wheel.deltaY = event.deltaY;
  inputState.wheel.deltaZ = event.deltaZ;
  inputState.wheel.timestamp = Date.now();

  // Reset wheel deltas after a short time
  setTimeout(() => {
    inputState.wheel.deltaX = 0;
    inputState.wheel.deltaY = 0;
    inputState.wheel.deltaZ = 0;
  }, 16); // ~1 frame at 60fps
}

/**
 * Handle touch start events
 * @param {TouchEvent} event
 */
function handleTouchStart(event) {
  event.preventDefault();

  inputState.touch.active = true;
  inputState.touch.touches = Array.from(event.touches);
  inputState.touch.timestamp = Date.now();

  if (event.touches.length > 0) {
    const touch = event.touches[0];
    inputState.touch.x = touch.clientX;
    inputState.touch.y = touch.clientY;
  }
}

/**
 * Handle touch move events
 * @param {TouchEvent} event
 */
function handleTouchMove(event) {
  event.preventDefault();

  if (event.touches.length > 0) {
    const prevX = inputState.touch.x;
    const prevY = inputState.touch.y;

    const touch = event.touches[0];
    inputState.touch.x = touch.clientX;
    inputState.touch.y = touch.clientY;
    inputState.touch.deltaX = touch.clientX - prevX;
    inputState.touch.deltaY = touch.clientY - prevY;
  }

  inputState.touch.touches = Array.from(event.touches);
  inputState.touch.timestamp = Date.now();
}

/**
 * Handle touch end events
 * @param {TouchEvent} event
 */
function handleTouchEnd(event) {
  event.preventDefault();

  inputState.touch.touches = Array.from(event.touches);
  inputState.touch.timestamp = Date.now();

  if (event.touches.length === 0) {
    inputState.touch.active = false;
    inputState.touch.deltaX = 0;
    inputState.touch.deltaY = 0;
  }
}

/**
 * Handle keyboard down events
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  inputState.keyboard.keys[key] = true;
  inputState.keyboard.lastKey = key;
  inputState.keyboard.timestamp = Date.now();
}

/**
 * Handle keyboard up events
 * @param {KeyboardEvent} event
 */
function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  inputState.keyboard.keys[key] = false;
  inputState.keyboard.timestamp = Date.now();
}

/**
 * Convert screen coordinates to world coordinates
 * Takes into account camera position, scale, and rotation
 * @param {number} screenX - Screen X coordinate
 * @param {number} screenY - Screen Y coordinate
 * @param {HTMLElement} canvas - Canvas element for reference
 * @returns {{x: number, y: number}} World coordinates
 */
function screenToWorld(screenX, screenY, canvas = null) {
  let canvasX = screenX;
  let canvasY = screenY;

  // Get canvas reference and adjust coordinates
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    canvasX = screenX - rect.left;
    canvasY = screenY - rect.top;
  }

  // Translate by camera position
  let worldX = canvasX + inputState.camera.x;
  let worldY = canvasY + inputState.camera.y;

  // Apply inverse scale
  if (inputState.camera.scale !== 0) {
    worldX /= inputState.camera.scale;
    worldY /= inputState.camera.scale;
  }

  // Apply inverse rotation
  if (inputState.camera.rotation !== 0) {
    const cos = Math.cos(-inputState.camera.rotation);
    const sin = Math.sin(-inputState.camera.rotation);
    const rotX = worldX * cos - worldY * sin;
    const rotY = worldX * sin + worldY * cos;
    worldX = rotX;
    worldY = rotY;
  }

  return { x: worldX, y: worldY };
}

/**
 * Convert world coordinates to screen coordinates
 * Takes into account camera position, scale, and rotation
 * @param {number} worldX - World X coordinate
 * @param {number} worldY - World Y coordinate
 * @param {HTMLElement} canvas - Canvas element for reference
 * @returns {{x: number, y: number}} Screen coordinates
 */
function worldToScreen(worldX, worldY, canvas = null) {
  let screenX = worldX;
  let screenY = worldY;

  // Apply rotation
  if (inputState.camera.rotation !== 0) {
    const cos = Math.cos(inputState.camera.rotation);
    const sin = Math.sin(inputState.camera.rotation);
    const rotX = screenX * cos - screenY * sin;
    const rotY = screenX * sin + screenY * cos;
    screenX = rotX;
    screenY = rotY;
  }

  // Apply scale
  screenX *= inputState.camera.scale;
  screenY *= inputState.camera.scale;

  // Translate by camera position
  screenX -= inputState.camera.x;
  screenY -= inputState.camera.y;

  // Adjust for canvas offset
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    screenX += rect.left;
    screenY += rect.top;
  }

  return { x: screenX, y: screenY };
}

/**
 * Setup input event handlers on the target element
 * @param {HTMLElement} element - Target element (usually canvas or window)
 * @param {Object} options - Configuration options
 * @returns {Function} Function to remove event listeners
 */
function setupInputHandlers(element = window, options = {}) {
  const target = element || window;
  const {
    handleMouse = true,
    handleTouch = true,
    handleKeyboard = true,
    handleWheel = true
  } = options;

  // Store bound handlers for later removal
  const handlers = {};

  // Mouse events
  if (handleMouse) {
    handlers.mousemove = (e) => onInput(e);
    handlers.mousedown = (e) => onInput(e);
    handlers.mouseup = (e) => onInput(e);

    target.addEventListener('mousemove', handlers.mousemove);
    target.addEventListener('mousedown', handlers.mousedown);
    target.addEventListener('mouseup', handlers.mouseup);
  }

  // Touch events
  if (handleTouch) {
    handlers.touchstart = (e) => onInput(e);
    handlers.touchmove = (e) => onInput(e);
    handlers.touchend = (e) => onInput(e);

    target.addEventListener('touchstart', handlers.touchstart, { passive: false });
    target.addEventListener('touchmove', handlers.touchmove, { passive: false });
    target.addEventListener('touchend', handlers.touchend, { passive: false });
  }

  // Keyboard events
  if (handleKeyboard) {
    handlers.keydown = (e) => onInput(e);
    handlers.keyup = (e) => onInput(e);

    target.addEventListener('keydown', handlers.keydown);
    target.addEventListener('keyup', handlers.keyup);
  }

  // Wheel events
  if (handleWheel) {
    handlers.wheel = (e) => onInput(e);
    target.addEventListener('wheel', handlers.wheel, { passive: false });
  }

  // Return cleanup function
  return () => {
    Object.entries(handlers).forEach(([event, handler]) => {
      target.removeEventListener(event, handler);
    });
  };
}

/**
 * Get the current input state
 * @param {string} type - Optional filter for specific input type ('mouse', 'touch', 'keyboard', 'wheel')
 * @returns {Object} Current input state
 */
function getInputState(type = null) {
  if (type && inputState[type]) {
    return JSON.parse(JSON.stringify(inputState[type]));
  }
  return JSON.parse(JSON.stringify(inputState));
}

/**
 * Check if a specific key is currently pressed
 * @param {string} key - Key name (e.g., 'enter', 'space', 'a', 'control', 'shift')
 * @returns {boolean} True if key is pressed
 */
function isKeyPressed(key) {
  const normalizedKey = key.toLowerCase();
  return inputState.keyboard.keys[normalizedKey] === true;
}

/**
 * Set camera state for coordinate transformation
 * @param {Object} cameraState - Camera configuration
 * @param {number} cameraState.x - Camera X position
 * @param {number} cameraState.y - Camera Y position
 * @param {number} cameraState.scale - Camera zoom level
 * @param {number} cameraState.rotation - Camera rotation in radians
 */
function setCamera(cameraState) {
  Object.assign(inputState.camera, cameraState);
}

/**
 * Get camera state
 * @returns {Object} Current camera state
 */
function getCamera() {
  return JSON.parse(JSON.stringify(inputState.camera));
}

// Export functions
export {
  onInput,
  screenToWorld,
  worldToScreen,
  setupInputHandlers,
  getInputState,
  isKeyPressed,
  setCamera,
  getCamera
};
