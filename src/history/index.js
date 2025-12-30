/**
 * History Management System
 * Implements undo/redo functionality using state snapshots and command pattern
 */

/**
 * Command base class
 * All commands should inherit from this class
 */
class Command {
  /**
   * Execute the command
   */
  execute() {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Undo the command
   */
  undo() {
    throw new Error('undo() must be implemented by subclass');
  }

  /**
   * Get command description for UI display
   * @returns {string} Command description
   */
  getDescription() {
    return 'Command';
  }

  /**
   * Check if command can be merged with another command
   * @param {Command} command - Another command to merge with
   * @returns {boolean} True if commands can be merged
   */
  canMergeWith(command) {
    return false;
  }

  /**
   * Merge with another command
   * @param {Command} command - Another command to merge with
   */
  mergeWith(command) {
    // Override in subclass if merging is supported
  }
}

/**
 * StateCommand class
 * Manages state changes using snapshots
 */
class StateCommand extends Command {
  /**
   * @param {object} state - The state object to manage
   * @param {object} changes - The changes to apply
   * @param {string} description - Command description
   */
  constructor(state, changes, description = 'State Change') {
    super();
    this.state = state;
    this.changes = changes;
    this.description = description;
    this.previousState = null;
    this.timestamp = Date.now();
  }

  /**
   * Execute the command
   */
  execute() {
    // Store previous state before applying changes
    this.previousState = this.deepClone(this.state);
    this.applyChanges(this.state, this.changes);
  }

  /**
   * Undo the command by restoring previous state
   */
  undo() {
    if (this.previousState !== null) {
      this.restoreState(this.state, this.previousState);
    }
  }

  /**
   * Apply changes to state
   * @private
   * @param {object} target - Target state object
   * @param {object} changes - Changes to apply
   */
  applyChanges(target, changes) {
    for (const key in changes) {
      if (changes.hasOwnProperty(key)) {
        target[key] = this.deepClone(changes[key]);
      }
    }
  }

  /**
   * Restore state from snapshot
   * @private
   * @param {object} target - Target state object
   * @param {object} snapshot - State snapshot to restore
   */
  restoreState(target, snapshot) {
    // Clear existing properties
    for (const key in target) {
      if (target.hasOwnProperty(key)) {
        delete target[key];
      }
    }
    // Restore from snapshot
    for (const key in snapshot) {
      if (snapshot.hasOwnProperty(key)) {
        target[key] = this.deepClone(snapshot[key]);
      }
    }
  }

  /**
   * Deep clone an object
   * @private
   * @param {any} obj - Object to clone
   * @returns {any} Cloned object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }

    if (obj instanceof Object) {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  }

  /**
   * Get command description
   * @returns {string} Command description
   */
  getDescription() {
    return this.description;
  }

  /**
   * Get timestamp of command execution
   * @returns {number} Timestamp in milliseconds
   */
  getTimestamp() {
    return this.timestamp;
  }
}

/**
 * CompositeCommand class
 * Executes multiple commands as a single unit
 */
class CompositeCommand extends Command {
  /**
   * @param {Array<Command>} commands - Array of commands to execute
   * @param {string} description - Command description
   */
  constructor(commands = [], description = 'Composite Command') {
    super();
    this.commands = commands;
    this.description = description;
  }

  /**
   * Add a command to the composite
   * @param {Command} command - Command to add
   */
  addCommand(command) {
    if (!(command instanceof Command)) {
      throw new Error('Invalid command: must be instance of Command');
    }
    this.commands.push(command);
  }

  /**
   * Execute all commands in order
   */
  execute() {
    for (const command of this.commands) {
      command.execute();
    }
  }

  /**
   * Undo all commands in reverse order
   */
  undo() {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  /**
   * Get command description
   * @returns {string} Command description
   */
  getDescription() {
    return this.description;
  }

  /**
   * Get number of commands in composite
   * @returns {number} Number of commands
   */
  getCommandCount() {
    return this.commands.length;
  }

  /**
   * Get all commands
   * @returns {Array<Command>} Array of commands
   */
  getCommands() {
    return [...this.commands];
  }
}

/**
 * BatchCommand class
 * Groups related commands together with atomic execution
 */
class BatchCommand extends CompositeCommand {
  /**
   * @param {Array<Command>} commands - Array of commands to batch
   * @param {string} description - Command description
   */
  constructor(commands = [], description = 'Batch Command') {
    super(commands, description);
    this.batchId = this.generateBatchId();
    this.executedSuccessfully = false;
  }

  /**
   * Generate unique batch ID
   * @private
   * @returns {string} Unique batch ID
   */
  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute all commands atomically
   * @throws {Error} If any command fails
   */
  execute() {
    const successfulCommands = [];
    
    try {
      for (const command of this.commands) {
        command.execute();
        successfulCommands.push(command);
      }
      this.executedSuccessfully = true;
    } catch (error) {
      // Rollback on failure
      for (let i = successfulCommands.length - 1; i >= 0; i--) {
        successfulCommands[i].undo();
      }
      this.executedSuccessfully = false;
      throw new Error(`Batch execution failed: ${error.message}`);
    }
  }

  /**
   * Check if batch was executed successfully
   * @returns {boolean} True if executed successfully
   */
  isExecutedSuccessfully() {
    return this.executedSuccessfully;
  }

  /**
   * Get batch ID
   * @returns {string} Batch ID
   */
  getBatchId() {
    return this.batchId;
  }
}

/**
 * CommandHistory class
 * Manages command execution history with undo/redo support
 */
class CommandHistory {
  /**
   * @param {number} maxHistorySize - Maximum number of commands to keep in history
   */
  constructor(maxHistorySize = 100) {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Execute a command and add it to history
   * @param {Command} command - Command to execute
   * @throws {Error} If command fails
   */
  executeCommand(command) {
    if (!(command instanceof Command)) {
      throw new Error('Invalid command: must be instance of Command');
    }

    // Remove any commands after current index (when new command is executed)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Execute the command
    command.execute();

    // Add to history
    this.history.push(command);
    this.currentIndex++;

    // Maintain max history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * Undo the last command
   * @returns {boolean} True if undo was successful
   */
  undo() {
    if (!this.canUndo()) {
      return false;
    }

    const command = this.history[this.currentIndex];
    command.undo();
    this.currentIndex--;
    return true;
  }

  /**
   * Redo the last undone command
   * @returns {boolean} True if redo was successful
   */
  redo() {
    if (!this.canRedo()) {
      return false;
    }

    this.currentIndex++;
    const command = this.history[this.currentIndex];
    command.execute();
    return true;
  }

  /**
   * Check if undo is possible
   * @returns {boolean} True if undo is available
   */
  canUndo() {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is possible
   * @returns {boolean} True if redo is available
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get the description of the command that will be undone
   * @returns {string|null} Command description or null if no undo available
   */
  getUndoDescription() {
    if (!this.canUndo()) {
      return null;
    }
    return this.history[this.currentIndex].getDescription();
  }

  /**
   * Get the description of the command that will be redone
   * @returns {string|null} Command description or null if no redo available
   */
  getRedoDescription() {
    if (!this.canRedo()) {
      return null;
    }
    return this.history[this.currentIndex + 1].getDescription();
  }

  /**
   * Get the entire history
   * @returns {Array<Command>} Array of commands in history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Get current index in history
   * @returns {number} Current index
   */
  getCurrentIndex() {
    return this.currentIndex;
  }

  /**
   * Get history size
   * @returns {number} Number of commands in history
   */
  getHistorySize() {
    return this.history.length;
  }

  /**
   * Clear the entire history
   */
  clear() {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get commands that can be undone
   * @returns {Array<Command>} Array of undoable commands
   */
  getUndoableCommands() {
    return this.history.slice(0, this.currentIndex + 1);
  }

  /**
   * Get commands that can be redone
   * @returns {Array<Command>} Array of redoable commands
   */
  getRedoableCommands() {
    return this.history.slice(this.currentIndex + 1);
  }
}

/**
 * History class
 * Main history manager that coordinates command history and state management
 */
class History {
  /**
   * @param {object} initialState - Initial state object
   * @param {number} maxHistorySize - Maximum number of commands to keep
   */
  constructor(initialState = {}, maxHistorySize = 100) {
    this.state = initialState;
    this.commandHistory = new CommandHistory(maxHistorySize);
    this.observers = [];
  }

  /**
   * Execute a command
   * @param {Command} command - Command to execute
   */
  executeCommand(command) {
    this.commandHistory.executeCommand(command);
    this.notifyObservers('commandExecuted', command);
  }

  /**
   * Undo the last command
   * @returns {boolean} True if undo was successful
   */
  undo() {
    const success = this.commandHistory.undo();
    if (success) {
      this.notifyObservers('undoExecuted');
    }
    return success;
  }

  /**
   * Redo the last undone command
   * @returns {boolean} True if redo was successful
   */
  redo() {
    const success = this.commandHistory.redo();
    if (success) {
      this.notifyObservers('redoExecuted');
    }
    return success;
  }

  /**
   * Check if undo is available
   * @returns {boolean} True if undo is available
   */
  canUndo() {
    return this.commandHistory.canUndo();
  }

  /**
   * Check if redo is available
   * @returns {boolean} True if redo is available
   */
  canRedo() {
    return this.commandHistory.canRedo();
  }

  /**
   * Get undo description
   * @returns {string|null} Description of command to be undone
   */
  getUndoDescription() {
    return this.commandHistory.getUndoDescription();
  }

  /**
   * Get redo description
   * @returns {string|null} Description of command to be redone
   */
  getRedoDescription() {
    return this.commandHistory.getRedoDescription();
  }

  /**
   * Get current state
   * @returns {object} Current state object
   */
  getState() {
    return this.state;
  }

  /**
   * Get command history
   * @returns {CommandHistory} Command history instance
   */
  getCommandHistory() {
    return this.commandHistory;
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.commandHistory.clear();
    this.notifyObservers('historyCleared');
  }

  /**
   * Subscribe to history changes
   * @param {Function} callback - Callback function(event, data)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.observers.push(callback);
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all observers of a change
   * @private
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  notifyObservers(event, data = null) {
    for (const observer of this.observers) {
      observer(event, data);
    }
  }

  /**
   * Get history statistics
   * @returns {object} Statistics object
   */
  getStatistics() {
    return {
      totalCommands: this.commandHistory.getHistorySize(),
      currentIndex: this.commandHistory.getCurrentIndex(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoableCount: this.commandHistory.getUndoableCommands().length,
      redoableCount: this.commandHistory.getRedoableCommands().length,
    };
  }
}

// Export classes
module.exports = {
  Command,
  StateCommand,
  CompositeCommand,
  BatchCommand,
  CommandHistory,
  History,
};
