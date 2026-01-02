# Leather Pattern Tool

**Version 0.3 (Pre-Alpha)**

A web-based design tool for creating leather patterns, specifically designed for holster and leathercraft projects. This tool provides an intuitive interface for designing patterns with precise measurements, stitch lines, holes, and annotations.

## What's New in v0.3

### UI/UX Improvements
- ✨ **First-Time User Onboarding** - Welcome modal with tool guide for new users
- 🎨 **Quick Presets** - Holster, Wallet, and Belt presets for common projects
- 📝 **Better Tool Labels** - Clearer names (Edge → Edge Stitch, Perim → Full Border)
- 📝 **Improved Layer Labels** - More descriptive (Mirrored → Symmetric, Single → Asymmetric)
- ❓ **Help Icons** - Contextual help for complex settings
- 📱 **Mobile Optimizations** - Better touch targets and responsive toolbar

### Bug Fixes & Stability
- 🐛 Fixed crash when EDGE_RANGES is empty
- 🐛 Improved ClipperLib CDN fallback with user warnings
- 🐛 Better error handling throughout the application
- 🐛 Fixed title typo (Pre-Apha → Pre-Alpha)

### Developer Experience
- 🔧 Build system with Vite
- 🧪 Unit tests for math utilities (26 tests)
- 📦 NPM package management
- 🏗️ Modular architecture with StateManager, ErrorHandler, PathCache
- 📚 JSDoc comments for new modules

## Features

### Core Tools
- **Select Mode** - Select and manipulate elements on the canvas
- **Hole Tool** - Add circular, elliptical, pill-shaped, or rectangular holes
- **Custom Hole Tool** - Draw custom hole shapes
- **Stitch Line Tool** - Create stitch lines with customizable spacing
- **Shape Tool** - Add geometric shapes to your pattern
- **Text Tool** - Add text annotations and labels

### Pattern Design
- **Two-Layer Mode** - NEW! Design separate front and back pieces with master/inheritance system (see [TWO_LAYER_MODE.md](TWO_LAYER_MODE.md))
- **Symmetric & Asymmetric Layers** - Design on two separate layers for precise pattern creation
- **Bezier Curve Editing** - Smooth, customizable pattern outlines
- **Edge Range Management** - Define and manage edge stitch ranges
- **Fold Line Support** - Visual fold line with locking capability (Fold-Over mode)
- **Reference Images** - Import and calibrate reference images for tracing

### Customization Options
- **Material Settings**
  - Adjustable leather thickness (1.5-8mm)
  - Customizable leather color
- **Stitch Settings**
  - Configurable margin (3-15mm)
  - Adjustable spacing (2-8mm)
  - Variable hole size (0.8-3mm)
  - Mirror edge stitches option
- **Hole Defaults**
  - Multiple shapes: circle, ellipse, pill, rectangle
  - Adjustable width and height (2-30mm)

### Display Features
- **Grid System** - Optional snap-to-grid with adjustable size
- **Snap to Fold** - Align elements to the fold line
- **Cavity Display** - Toggle cavity visualization
- **Outliner Panel** - Hierarchical view of pattern elements
- **Settings Panel** - Comprehensive configuration options

### Publishing & Export
- **Print-Ready Output** - Print at 100% scale for accurate templates
- **Multiple Export Formats** - PNG and JPG export options
- **Page Layout** - Automatic page margin and overlap handling
- **Registration Marks** - Optional registration and center marks for alignment
- **Pattern Sizing** - Real-time pattern and interior measurements

### Project Management
- **Save/Load Projects** - Save your work as JSON files
- **Project Naming** - Rename projects for organization
- **Undo/Redo** - Full history support for easy editing
- **Pattern Selection** - Choose from different pattern templates

## Usage

### Getting Started
1. Open `index.html` in a modern web browser
2. The canvas displays a default pattern with tools on the left sidebar
3. Select a tool from the toolbar and start designing

### Basic Workflow
1. **Select a Pattern** - Click "Select Pattern" to choose a template
2. **Add Elements** - Use the tools to add holes, stitches, shapes, or text
3. **Customize** - Adjust properties in the settings panel (gear icon)
4. **Switch Layers** - Toggle between Symmetric and Asymmetric layers (Fold-Over mode) or Front/Back (Two-Layer mode)
5. **Save** - Use the File menu (💾) to save your project
6. **Publish** - Click "📐 Publish" to prepare for printing or export

### Two-Layer Mode
For patterns with separate front and back pieces:
1. Open Settings (⚙) and change **Project Type** to "Two-Layer"
2. Design on the Front layer (blue) which serves as the master
3. Switch to Back layer (orange) to add back-specific features
4. Use "Copy to Back/Front" buttons to duplicate layers
5. Keep sync options enabled for perfect stitch hole alignment

📖 **See [TWO_LAYER_MODE.md](TWO_LAYER_MODE.md) for detailed guide**

### Keyboard Shortcuts
- **V** - Select mode
- **H** - Hole tool
- **S** - Stitch line tool
- **T** - Text tool
- **Ctrl+Z** - Undo
- **Ctrl+Y** - Redo

### Tips
- Hold **Shift** for additional tool options
- Click the project title to rename your pattern
- Use the Outliner (☰) to manage elements hierarchically
- Enable snap-to-grid in settings for precise alignment
- Import reference images for tracing existing designs

## Technical Details

### Technologies Used
- **HTML5 Canvas** - For rendering the pattern design interface
- **JavaScript** - Pure vanilla JavaScript, no frameworks
- **Clipper.js** - For geometric operations (v6.4.2)
- **CSS3** - Modern styling with CSS variables

### File Structure
```
LeatherPatternTool/
├── index.html           # Main application HTML
├── styles.css           # Application styling
├── package.json         # NPM dependencies and scripts
├── vite.config.js       # Vite build configuration
├── js/
│   ├── main.js          # Entry point
│   ├── app.js           # Main application logic
│   ├── config.js        # Configuration constants
│   ├── math.js          # Mathematical utilities
│   ├── math.test.js     # Unit tests for math utilities
│   ├── state/
│   │   └── StateManager.js  # Central state management
│   ├── ui/
│   │   ├── UIManager.js     # UI coordination helpers
│   │   └── OnboardingUI.js  # First-time user onboarding
│   └── utils/
│       ├── ErrorHandler.js  # Centralized error handling
│       ├── PathCache.js     # Performance optimization
│       └── helpers.js       # Utility functions
└── README.md            # This file
```

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm test             # Run unit tests
```

### Browser Compatibility
- Chrome/Edge (recommended)
- Firefox
- Safari
- Modern mobile browsers (with touch support)

### Canvas Coordinate System
- All measurements are in millimeters (mm)
- Scale: 100 pixels = 1mm for accurate printing
- Pattern coordinates support rotation and scaling

## Project File Format

Projects are saved as JSON files containing:
- Pattern outline nodes and bezier handles
- Symmetric and asymmetric holes
- Stitch lines and edge ranges
- Text annotations
- Holster/pattern transformation data
- Configuration settings

## License

This project is provided as-is for leatherworking and pattern design purposes.

## Credits

Developed for the leatherworking community to create precise, printable patterns for holsters and other leather goods.

---

**Note**: For best results, ensure your browser print settings are configured to print at 100% scale without margins when exporting patterns.
