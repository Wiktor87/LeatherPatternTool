# Two-Layer Mode User Guide

## Overview

Two-Layer Mode is a new feature in the Leather Pattern Tool that allows you to design holster patterns where two separate pieces (front and back) are stitched together, rather than using the traditional fold-over design.

This mode is particularly useful for:
- Holster designs that require different features on front and back
- Patterns where stitch hole alignment is critical
- Complex designs with layer-specific cutouts (e.g., thumb breaks on front only)
- Projects that need separate cutting templates for each piece

## Getting Started

### Enabling Two-Layer Mode

1. Click the **Settings** button (⚙) in the top-right corner
2. In the **Project** section at the top, change the **Type** dropdown from "Fold-Over" to "Two-Layer"
3. The UI will automatically update to show two-layer controls

### Understanding the Interface

When Two-Layer Mode is enabled, you'll notice several UI changes:

- **Layer Toggle**: The "Mirrored/Single" toggle is replaced with "Front/Back" buttons
  - **Front** button is blue
  - **Back** button is orange
  
- **Visual Indicators**:
  - Canvas background has a subtle tint (blue for Front, orange for Back)
  - Outliner panel shows layer name in color
  - Properties bar shows `[Front]` or `[Back]` prefix on selected items
  
- **New Controls**:
  - "Copy to Back" and "Copy to Front" buttons in the header
  - Layer Sync section in Settings panel
  - "Reset Back to Master" button

## Working with Layers

### The Master/Inheritance System

In Two-Layer Mode, the **Front layer is the "master"** by default:

- The Front layer is where you typically design the primary pattern
- The Back layer can inherit key features from the Front layer
- This ensures critical elements (like stitch holes) align perfectly

### Switching Between Layers

Click the **Front** or **Back** button to switch layers:

- Your current work is automatically saved when switching
- A toast notification confirms which layer you're now editing
- All tools and features work the same on both layers

### Layer Synchronization

The **Layer Sync** section in Settings lets you control what stays synchronized:

#### Sync Outline (Default: ON)
When enabled, changes to the Front layer's outline automatically update the Back layer:
- Node positions
- Bezier curve handles
- Edge ranges

This ensures both pieces have the same outer shape.

#### Sync Edge Stitches (Default: ON)
When enabled, edge stitch positions and settings stay identical on both layers:
- Stitch spacing
- Margin settings
- Edge stitch ranges

This is critical for proper alignment when sewing the pieces together.

**Pro Tip**: Keep both sync options enabled during initial design. Turn them off later if you need the Back layer to diverge.

## Layer Operations

### Duplicate Layer

The **Copy to Back** and **Copy to Front** buttons let you quickly duplicate an entire layer:

1. Click the appropriate button
2. Confirm the operation (this will overwrite the target layer)
3. All elements are copied: outline, holes, stitches, shapes, text, etc.

**Use Cases**:
- Start with identical front and back, then modify each
- Copy your complete design to the other layer as a template
- Quickly restore a layer from the other

### Reset to Master

The **↻ Reset Back to Master** button (in Layer Sync section) resets the Back layer to match the Front layer completely:

1. Click the button
2. Confirm the reset
3. The Back layer becomes an exact copy of Front

**Use Case**: If you've made experimental changes to the Back layer and want to start over from the Front layer.

## Layer-Specific Elements

Each layer maintains its own independent collection of:

- **Additional Holes**: Symmetric and asymmetric holes
- **Custom Holes**: Cutouts like thumb breaks, mag release clearances
- **Shapes**: Additional geometric elements
- **Text Annotations**: Labels and notes
- **Stitch Lines**: Interior stitch patterns

**Example Workflow**:
1. Design the main outline on Front layer (master)
2. Add common holes and features
3. Switch to Back layer
4. Add back-specific elements (like a thumb break on front only)
5. Toggle back to Front to add front-specific features

## Saving and Loading

### Project Files

Two-Layer projects are saved with version 2 format:

```json
{
  "version": 2,
  "projectType": "two-layer",
  "CURRENT_LAYER": "front",
  "FRONT_LAYER": { ... },
  "BACK_LAYER": { ... },
  "CFG": { ... }
}
```

### Backward Compatibility

- **Old files (version 1)** automatically load as Fold-Over mode
- **New files (version 2)** preserve both layers when in Two-Layer mode
- You can safely switch between Fold-Over and Two-Layer modes
- All existing projects continue to work without modification

## Publishing and Printing

### Layout Options (In Development)

When publishing a two-layer project, you'll be able to choose:

- **Side by Side**: Both layers next to each other on the same page(s)
- **Overlaid**: Preview with both layers stacked to verify alignment
- **Separate Pages**: Each layer on its own set of pages

### Registration Marks (In Development)

Published output will include:
- Corner alignment marks on both layers
- Center marks for precise positioning
- Optional numbered reference points along edges
- Layer labels ("FRONT" and "BACK") printed on each piece

### Stitch Hole Verification (In Development)

The tool will warn you if:
- Stitch hole counts don't match between layers
- Edge stitch spacing differs
- Alignment might be problematic

## Tips and Best Practices

### Getting Started

1. **Start Simple**: Begin with Fold-Over mode to understand the basics
2. **Enable Sync**: Keep synchronization ON while designing the base pattern
3. **Plan Ahead**: Sketch out which features go on which layer before starting

### Design Workflow

1. **Design the Master**: Create the complete Front layer first
2. **Verify Outline**: Ensure the outer shape and edge stitches are correct
3. **Copy to Back**: Use "Copy to Back" to start the Back layer
4. **Add Unique Features**: Switch to Back and add back-specific elements
5. **Refine Both**: Toggle between layers to refine each piece

### Common Patterns

**Holster with Thumb Break** (front only):
1. Front layer: Add thumb break cutout
2. Back layer: Leave smooth (no cutout)

**Different Hole Patterns**:
1. Front layer: Belt loop attachment holes
2. Back layer: Different mounting hole pattern

**Asymmetric Design**:
1. Disable "Sync Outline" if needed
2. Adjust each layer's outline independently
3. Keep "Sync Edge Stitches" ON for proper alignment

### Troubleshooting

**Layers won't stay synchronized**:
- Check that sync toggles are enabled in Settings
- Make sure you're editing the Front layer (master)
- Synchronization only flows from Front to Back

**Lost work when switching layers**:
- Each layer state is saved automatically when switching
- Use Undo/Redo within each layer if needed
- Save your project file frequently

**Can't see layer differences**:
- Check canvas background tint (subtle blue/orange)
- Look for layer name in Outliner (colored)
- Check Properties bar for `[Front]` or `[Back]` prefix

## Keyboard Shortcuts

All existing shortcuts work in Two-Layer Mode:
- **V** - Select mode
- **H** - Hole tool
- **S** - Stitch line tool
- **T** - Text tool
- **Ctrl+Z** - Undo (works per-layer)
- **Ctrl+Y** - Redo (works per-layer)
- **Escape** - Cancel current action/deselect

## Future Enhancements

Planned features for Two-Layer Mode:
- Registration mark output for alignment
- Layer labels on published output
- Stitch hole count verification
- Advanced publish layouts (side-by-side, overlaid, separate pages)
- Layer-specific visibility toggles
- More granular sync controls

## Questions or Issues?

If you encounter any problems or have suggestions for Two-Layer Mode:
1. Check this guide for common solutions
2. Verify you're using the latest version
3. Report issues on the project's GitHub repository

---

**Version**: 0.2
**Last Updated**: 2026-01-01
**Feature Status**: Core functionality complete, publish features in development
