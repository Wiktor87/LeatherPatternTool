/**
 * FileManager - Handles project save/load operations
 */
export class FileManager {
  /**
   * @param {Object} options - Configuration options
   * @param {Function} options.getState - Function to get current application state
   * @param {Function} options.setState - Function to set application state
   * @param {Function} options.onLoad - Callback after successful load
   * @param {Function} options.onSave - Callback after successful save
   * @param {string} options.defaultFilename - Default filename for projects (default: 'pattern')
   * @param {Function} options.validateProject - Function to validate loaded project data
   */
  constructor(options = {}) {
    this.getState = options.getState || (() => ({}));
    this.setState = options.setState || (() => {});
    this.onLoad = options.onLoad || (() => {});
    this.onSave = options.onSave || (() => {});
    this.defaultFilename = options.defaultFilename || 'pattern';
    this.validateProject = options.validateProject || ((project) => {
      // Default validation - check for basic structure
      return project && typeof project === 'object';
    });
  }

  /**
   * Save project to JSON file
   * @param {string} projectName - Name of the project
   * @returns {boolean} Success status
   */
  saveProject(projectName = 'Leather Pattern') {
    try {
      const state = this.getState();
      const project = {
        version: 2,
        name: projectName,
        ...state
      };

      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = (project.name.replace(/[^a-z0-9]/gi, '_') || this.defaultFilename) + '.json';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.onSave(project);
      return true;
    } catch (error) {
      console.error('Error saving project:', error);
      return false;
    }
  }

  /**
   * Load project from JSON file
   * @param {File} file - File object to load
   * @returns {Promise<Object>} Loaded project data
   */
  loadProjectFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const project = JSON.parse(evt.target.result);
          
          // Validate project structure using configurable validator
          if (!this.validateProject(project)) {
            reject(new Error('Invalid project file - validation failed'));
            return;
          }

          // Migrate old text formats if needed
          if (project.TEXT_ANNOTATIONS) {
            project.TEXT_ANNOTATIONS = this.migrateTextAnnotations(project.TEXT_ANNOTATIONS);
          }

          this.setState(project);
          this.onLoad(project);
          resolve(project);
        } catch (err) {
          reject(new Error(`Error loading project: ${err.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Migrate old text annotation format to new format
   * @param {Array} textAnnotations - Array of text annotations
   * @returns {Array} Migrated text annotations
   */
  migrateTextAnnotations(textAnnotations) {
    return textAnnotations.map(t => {
      // Convert lines format to simple format
      if (t.lines && Array.isArray(t.lines)) {
        const firstLine = t.lines[0] || {};
        return {
          x: t.x,
          y: t.y,
          text: firstLine.text || '',
          fontSize: t.fontSize || 12,
          bold: t.bold || false,
          italic: t.italic || false,
          style: firstLine.style || 'normal',
          listType: firstLine.listType || 'none',
          listIndex: firstLine.listIndex || 1,
          name: t.name,
          hidden: t.hidden,
          locked: t.locked,
          parent: t.parent,
          arrowTo: t.arrowTo
        };
      }

      // Ensure all required fields exist
      return {
        x: t.x || 0,
        y: t.y || 0,
        text: t.text || 'Text',
        fontSize: t.fontSize || 12,
        bold: t.bold || false,
        italic: t.italic || false,
        style: t.style || 'normal',
        listType: t.listType || 'none',
        listIndex: t.listIndex || 1,
        name: t.name,
        hidden: t.hidden,
        locked: t.locked,
        parent: t.parent,
        arrowTo: t.arrowTo
      };
    });
  }

  /**
   * Trigger file input dialog
   * @param {string} inputId - ID of file input element
   */
  triggerFileInput(inputId = 'file-input') {
    const input = document.getElementById(inputId);
    if (input) {
      input.click();
    }
  }

  /**
   * Handle file input change event
   * @param {Event} event - File input change event
   * @returns {Promise<Object>} Loaded project data
   */
  async handleFileLoad(event) {
    const file = event.target.files[0];
    
    try {
      const project = await this.loadProjectFromFile(file);
      // Reset input so same file can be loaded again
      event.target.value = '';
      return project;
    } catch (error) {
      // Reset input
      event.target.value = '';
      throw error;
    }
  }
}
