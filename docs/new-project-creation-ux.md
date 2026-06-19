# New Project Creation UX Report

## Purpose

This report maps the new project creation experience for Mountlab, a browser-based 3D rack assembly editor for DIY analog audio engineers. It focuses on the journey from clicking **New Project** to exporting drilled panel files, without proposing implementation work.

The target user works with physical rack equipment: sheet metal panels, drilled holes, PCBs, connectors, potentiometers, switches, rack units, and millimeter measurements. The UI should feel like a fast, precise workshop tool rather than a generic project form.

## Existing Product Context

The app currently:

- Loads an existing project from `public/projects/<name>/` with `assembly.json` and model files.
- Renders a 3D chassis with body, front panel, back panel, and rack ears.
- Supports imported PCB objects with transform controls.
- Supports panel-attached assembly objects such as holes, knobs, and generic objects.
- Saves movable objects and PCB positions in JSON.
- Uses metric units and a center-of-chassis coordinate model.

The current `assembly.json` shape is intentionally small:

- `units`
- `origin`
- `axes`
- `dimensions`
- `chassis`
- `pcb`
- existing generated `objects` in the app state

New project creation should extend this model carefully instead of replacing it.

## Design Principles

- The 3D viewport is the primary workspace.
- The sidebar is for precision, inspection, and batch editing, not for hiding the workflow.
- Chassis creation should be fast and opinionated.
- Every placement operation must support exact millimeter control.
- The app should borrow familiar vector-editor operations from Inkscape: select, duplicate, group, align, distribute, snap, undo.
- Avoid modal-heavy workflows after the initial project start.
- Every edit must support undo and redo.
- The user should always understand the physical consequence of an action.

## Product Stance

The new-project experience should not feel like filling out CAD metadata. It should feel like pulling a blank rack chassis onto the bench, choosing which face to work on, and marking real drill positions.

The app should optimize for three outcomes:

1. A first-time user can create a correctly sized rack chassis in under one minute.
2. A regular user can place a repeated row of 8 connectors in under two minutes.
3. A careful builder can verify exact hole positions and clearances before exporting files for real metalwork.

This leads to one strong UX rule: **create the chassis first, then let the user work directly on panel surfaces**. Avoid a long wizard that asks for every future decision up front.

## Recommended Workspace Model

The app should have clear workspace modes. Modes should not hide data; they should change the active tools, camera bias, and sidebar content.

### Project Setup

Purpose:

- choose or import a chassis
- name the project
- create the initial project folder/state

Primary UI:

- compact start panel
- live chassis preview
- chassis inspector

Exit condition:

- project has dimensions, chassis parts, and an initial `assembly.json` state.

### Panel Layout

Purpose:

- place holes, cutouts, connector templates, controls, and labels on panels

Primary UI:

- panel-focused viewport
- component palette
- object properties
- alignment and array tools
- DRC feedback

Exit condition:

- front/back panel objects are valid enough to export or intentionally accepted with warnings.

### Interior Layout

Purpose:

- place PCBs, check fit, add standoffs, and align board features to panel holes

Primary UI:

- transparent/sectioned chassis view
- PCB list and transforms
- anchors and standoffs

Exit condition:

- PCBs are positioned with clearances reviewed.

### Export Review

Purpose:

- verify manufacturing output before creating files

Primary UI:

- preflight drawer
- panel/object summary
- export target list

Exit condition:

- drilled STL and optional drill/BOM exports are generated.

## Coordinate And Measurement Policy

The current app uses a center-of-chassis origin with axes:

- `x`: left/right
- `y`: up/down
- `z`: front/back

That is good for 3D scene consistency, but panel layout also needs a panel-local mental model.

Recommended policy:

- Store object transforms in the existing chassis/world coordinate model for compatibility.
- Display and edit panel objects through panel-local coordinates.
- For front and back panels, expose local `X` and `Y` in millimeters.
- The local panel origin should be selectable, but default to panel center because it matches the current chassis origin.
- Offer edge-reference readouts at all times: distance from left, right, top, and bottom edges.

Why this matters:

- Center-origin coordinates are useful for symmetry.
- Edge distances are useful for real drilling and fabrication.
- The user should not have to mentally convert between them.

Minimum MVP behavior:

- position fields show `X from center` and `Y from center`
- selected object overlay shows edge distances

Later behavior:

- origin selector: center, top-left, bottom-left
- coordinate fields can switch reference origin without changing stored transforms

## Object Lifecycle

Every panel object should have a predictable lifecycle:

1. `preview`: ghost object under the cursor, not saved.
2. `draft`: placed object saved in `assembly.json`, panel export is dirty.
3. `valid`: object passes current DRC rules.
4. `warning`: object is exportable but needs attention.
5. `conflict`: object blocks clean export unless overridden.
6. `exported`: object is represented in the latest generated panel file.

The UI should make this lifecycle visible without adding complexity:

- ghost preview for `preview`
- normal selected/unselected rendering for `draft` and `valid`
- yellow outline for `warning`
- red outline for `conflict`
- blue or subtle check marker in the object list for `exported`

## 1. Entry Point And First Decision

When the user clicks **New Project**, they should see a compact start panel over the 3D viewport, not a full-screen wizard. The first experience should answer: "What physical chassis am I starting from?"

The first decision is:

1. Start from a rack chassis preset.
2. Start from a blank custom chassis.
3. Import an existing project.

The recommended default is **Rack chassis preset** with a likely DIY audio starting point preselected:

- `2U`
- `19 inch rack`
- `200mm depth`
- front and back panels enabled
- rack ears enabled
- black front/back panels
- aluminum chassis body

The project name should not be the blocking decision. Auto-fill a sensible name such as `untitled-2u-rack`, allow immediate editing, and allow renaming later.

Recommended start panel fields:

- `Project name`
- `Start from`: preset, custom, import
- `Rack units`
- `Rack width`
- `Depth`
- `Create`

Avoid overwhelming the user by hiding advanced controls behind a compact **Customize chassis** disclosure. The first screen should let them produce a physical chassis in under 20 seconds.

Recommended default copy:

- Title: `New rack project`
- Preset label: `Standard 2U rack chassis`
- Primary action: `Create chassis`
- Secondary action: `Import existing project`

Do not call the primary action `Next`. The goal is not to enter a wizard; it is to create a physical starting object.

## 2. Chassis Definition

### Rack Format Selection

Rack height should use explicit physical labels:

- `1U / 44.45mm`
- `2U / 88.90mm`
- `3U / 133.35mm`
- `4U / 177.80mm`
- `5U / 222.25mm`
- `6U / 266.70mm`

Rack width should default to:

- `19 inch / 482.6mm`

Secondary width option:

- `Half-rack / 241.3mm`

Depth should be chosen through common physical presets:

- `100mm`
- `150mm`
- `200mm`
- `250mm`
- `300mm`
- custom numeric input

Preset examples:

- `Shallow 1U`: 1U, 19 inch, 150mm
- `Deep 1U`: 1U, 19 inch, 250mm
- `Standard 2U`: 2U, 19 inch, 200mm
- `Utility 3U`: 3U, 19 inch, 250mm
- `Mixer/Crossover 5U`: 5U, 19 inch, 150mm

The user should be able to enter custom dimensions, but custom entry should not be the primary path. Most users are starting from a real rack envelope and need speed.

### Panel Composition

The chassis definition should expose physical panels:

- front panel
- back panel
- top
- bottom
- left side
- right side
- rack ears
- body/shell

For MVP, front panel, back panel, chassis body, and rack ears are enough. Top and side panels can appear as future options if the geometry pipeline supports them.

Panels should be optional because real builds vary:

- open-frame chassis
- removable top
- separate rack ears
- backless prototype chassis

Material and finish presets should be per panel:

- raw aluminum
- black anodized
- brushed steel
- raw steel

The material selector should be visual: small swatches plus plain material names. It should not require the user to think in metalness/roughness values.

### Immediate 3D Feedback

As soon as the user selects a rack format, the 3D scene should show the chassis. This should happen before the project is fully created.

The preview must support:

- orbit
- pan
- zoom
- front/back inspection
- visible dimension guides

Dimension overlays should show:

- width
- height
- depth
- rack unit count
- panel thickness if known

This is a trust-building moment. The user should feel, "Yes, this is the box I am about to build."

### Chassis Decision Boundaries

The chassis setup screen should ask only for decisions that are expensive to change later:

- rack height
- rack width
- depth
- enabled major panels
- panel thickness if drilling/export depends on it

It should not ask for:

- all connector types
- PCB files
- BOM information
- export formats
- DRC preferences beyond a default profile

Those later decisions belong in the workspace, not in project setup.

## 3. Panel Layout Tools

Once the chassis exists, the main creative workflow is panel population. The user should move into a **Panel Layout** mode with the 3D viewport focused on the selected panel.

Recommended panel focus controls:

- `Front`
- `Back`
- `Top`
- `Sides`
- `Inside`

Selecting `Front` or `Back` should rotate the camera into a panel-facing orthographic view while still allowing 3D orbit. The panel should feel like a work surface.

### Single Hole Placement

Recommended flow:

1. User chooses `Hole` or a component template from the palette.
2. A ghost preview follows the cursor on the active panel.
3. Cursor movement snaps to the selected grid.
4. A live readout shows X/Y position in millimeters.
5. User clicks to place.
6. Sidebar opens the selected object's exact properties.
7. User can type precise coordinates, diameter, label, and host panel.

Hole types should include:

- custom circular hole
- XLR
- 6.35mm jack
- RCA
- potentiometer
- toggle switch
- rocker switch
- LED
- M3/M4/M6 screw
- rectangular cutout
- D-sub
- IEC inlet

The exact-position UI must always be available. Click placement is fast, but typed coordinates are what make the tool trustworthy for metalwork.

Physical confirmation should use:

- crosshair centered on the hole
- live X/Y coordinate
- distance to nearest panel edges
- optional dimension line from selected origin
- diameter label while selected

Recommended MVP precision controls:

- `X` coordinate
- `Y` coordinate
- `Diameter`
- `Host panel`
- `Label`
- `Lock`

Avoid putting raw 3D `Z` controls in the first panel-layout UI. The user is working on a surface; expose panel-local coordinates first and keep the host panel responsible for the locked normal axis.

### Grid And Array Placement

The common task is placing many identical holes quickly, such as 8 jack holes in a row.

Recommended flow:

1. Place or select one object.
2. Click `Array`.
3. Inline array popover appears.
4. User sets:
   - columns
   - rows
   - spacing X
   - spacing Y
   - origin behavior
5. Ghost objects preview immediately.
6. User presses `Enter` or clicks `Apply`.

Alternative mode:

- `Distribute between two points`

This is useful when the user knows the first and last hole positions but wants the app to calculate spacing.

After confirmation, each hole should become an independent object. However, the operation can also create an optional group so the user can move the row together immediately.

MVP array behavior should be deliberately narrow:

- source object: one selected object
- output: flat independent objects
- preview: yes
- automatic grouping: optional but recommended
- editing the array after commit: not required

This keeps the first implementation useful without creating a parametric-history system.

### Hole Clusters And Groups

Clusters represent physical patterns:

- stereo RCA pair
- XLR plus ground lift
- pot plus LED
- input section with switch and jack

Recommended group flow:

1. User selects multiple objects.
2. Presses `Ctrl+G` / `Cmd+G`.
3. Group is created with a visible anchor.
4. Moving the group moves all children.
5. Double-click enters group edit mode.
6. `Shift+Ctrl+G` / `Shift+Cmd+G` ungroups.

Groups should stay transparent in the data model. Child objects remain normal objects; the group stores child IDs and anchor behavior.

Reusable templates should be supported later:

- select group
- `Save as template`
- name template
- appears in component palette

This is valuable but not MVP.

### Predefined Component Templates

The component library is central to speed. The user should browse by category and search by name.

Recommended categories:

- Audio connectors
- Power
- Controls
- Indicators
- Mounting
- Data connectors
- Custom

MVP templates:

- XLR female, Neutrik D-series: main circular hole plus two M3 mounting holes
- IEC C14 inlet: rectangular cutout plus two mounting holes
- fuse holder: circular hole
- mains rocker switch: rectangular cutout
- potentiometer: circular shaft clearance
- Alpha pot with bushing
- toggle switch
- 3mm LED
- 5mm LED
- 6.35mm jack
- RCA phono
- M3/M4/M6 screw hole

Later templates:

- D-sub DB9/DB15/DB25
- Speakon
- binding post pair
- banana sockets
- custom user templates

Template placement should work like a physical stencil:

- select template
- ghost preview appears on panel
- click to place
- exact dimensions are visible in the sidebar

Templates should show drill patterns, not just final components. The user is designing cut metal.

Template records should include enough physical metadata to support DRC and BOM later:

- display name
- category
- child cutouts
- nominal mounting hole sizes
- recommended minimum clearance
- optional manufacturer/source note

The library should start curated and read-only. User-created templates can come later after the placement model is stable.

### Alignment Tools

Alignment should feel like Inkscape:

- align left
- align right
- align top
- align bottom
- align horizontal center
- align vertical center
- distribute horizontally
- distribute vertically

For multi-selection, the last selected object should act as the key object. The user should be able to switch to aligning against:

- selection
- active panel
- key object

This can be added progressively. MVP can align against the selection bounding box.

### Snapping

Snap targets:

- grid
- panel edges
- panel centerlines
- other object centers
- other object edges
- template anchors

Recommended interaction:

- `S` toggles snap.
- Holding `Ctrl` / `Cmd` temporarily disables snap while dragging.
- Snap feedback appears as a thin guide line and small label.

Snapping must not feel sticky or unpredictable. The user should always see what they are snapping to.

### Clearance And DRC

DRC should be continuous and visual.

Validation states:

- green: valid
- yellow: warning
- red: conflict

Checks:

- hole overlap
- cutout overlap
- too close to panel edge
- too close to another hole
- template-specific clearance, such as XLR flange spacing
- mounting holes outside panel
- PCB intersects chassis or panel

The DRC panel should list problems by severity. Clicking a warning selects and zooms to the object.

Export should show a preflight summary. Red errors should block export by default, with an explicit override only if the project owner wants that behavior.

MVP DRC should be limited to checks the app can compute confidently:

- circular hole overlap
- rectangular cutout overlap by bounding box
- hole/cutout outside panel bounds
- minimum edge distance

Template-specific clearances can be added after the template data model is settled.

## 4. PCB Placement

PCB placement happens after the panel has meaningful holes. The user is now checking whether the electronics physically line up with the metal.

Recommended flow:

1. Switch to `Inside`.
2. Click `Add PCB`.
3. Select GLTF/GLB exported from KiCad 8.
4. PCB appears inside the chassis.
5. User drags and rotates using transform controls.
6. Sidebar shows exact X/Y/Z and rotation.
7. User can set height from chassis bottom.

Key alignment problem:

- a pot shaft, jack, LED, or connector on the PCB must align with a panel hole.

Best interaction:

1. User defines or selects a PCB anchor.
2. User selects a panel hole.
3. Clicks `Snap anchor to hole`.
4. PCB translates so the anchor center aligns to the hole center.

If KiCad exports do not provide anchor metadata, the app should allow manual anchor creation:

- place anchor on PCB
- name it, such as `VR1 shaft`
- assign type, such as pot shaft or LED

MVP can support manual PCB movement and numeric transforms first. Snap-to-hole is high-value but can follow after stable panel layout.

### Standoffs

Standoffs are physical objects and should be modeled that way.

Workflow:

1. Add `M3 standoff`.
2. Place on chassis bottom or near PCB mounting hole.
3. Set height.
4. Optionally attach it to a PCB mounting hole.

Future helper:

- `Create standoffs from PCB mounting holes`

This depends on usable metadata or manual anchor definitions.

### PCB Scope Recommendation

PCB import is important, but it should not block the first useful new-project workflow. The first implementation should prioritize panel creation and drilled-panel export. PCB placement can remain close to the existing current behavior until the panel workflow is stable.

Recommended sequence:

1. Preserve current PCB import and transform behavior.
2. Add better interior camera/view controls.
3. Add manual standoff objects.
4. Add manual PCB anchors.
5. Add snap-anchor-to-hole.

## 5. Save, Export, And Project Management

### Save Behavior

Project creation should establish a project folder early. After that, autosave should protect work.

Recommended behavior:

- `Create` creates the project structure.
- App autosaves `assembly.json`.
- Manual `Save` remains available.
- Save status is visible but quiet.

The app should support version naming later, but first usable version only needs explicit save and autosave.

### Save Timing

Save should happen at these points:

- after project creation
- after adding/removing objects
- after transform commits, not every pointer movement
- after importing/removing PCB files
- after export metadata changes

Dragging should update the scene continuously, but persistence should commit on drag end. This keeps undo, save, and panel-dirty tracking understandable.

### Expected Project Contents

At the end of new project creation, `assembly.json` should contain:

- project metadata
- unit system
- coordinate system
- chassis dimensions
- chassis panel/component definitions
- panel objects
- groups
- PCB imports and transforms
- constraints
- export metadata

### Export Outputs

STL exports:

- `front_panel_drilled.stl`
- `back_panel_drilled.stl`
- later: top/side drilled panels

Drill exports:

- CSV with hole/cutout positions
- DXF for CNC, laser, or drilling templates

BOM export:

- component template ID
- label
- quantity
- panel
- relevant hole/cutout dimensions

Preflight should show:

- red conflicts
- yellow warnings
- missing files
- dirty generated panels
- export timestamp

Export naming should be deterministic:

- `front_panel_drilled.stl`
- `back_panel_drilled.stl`
- `front_panel_drill.csv`
- `back_panel_drill.csv`
- `bom.csv`

Avoid timestamped primary filenames for MVP. Put timestamps in metadata or export history later so downstream fabrication references stay stable.

### Versioning

Versioning is useful but not MVP.

Future approaches:

- duplicate project as `project-name-v2`
- save named snapshots
- keep export history
- write `versions/` metadata inside project folder

## 6. Import Existing Project

Import should be a peer to new project creation.

Entry options:

- select project folder
- drag folder into viewport
- upload zip

Import flow:

1. App finds `assembly.json`.
2. Reads units, dimensions, chassis, objects, groups, PCBs.
3. Resolves local model paths.
4. Loads available files.
5. Shows missing files as actionable placeholders.

Missing file behavior:

- do not fail the whole project
- keep the object in the scene/object tree
- show `Missing file`
- offer `Locate`, `Replace`, and `Ignore`

Merge behavior should be future. If needed earlier, support a narrower command:

- `Import objects from project`

This imports panel objects and templates into the active project without merging chassis dimensions.

## 7. Mobile And Responsive Considerations

Primary target is desktop:

- large screen
- mouse
- keyboard shortcuts
- precise numeric input

Tablet use is conceivable in a workshop, especially for review and light edits. The app should degrade gracefully:

- larger touch targets
- collapsible sidebars
- viewport-first layout
- read-only or limited edit mode on small screens
- object selection and inspection still usable

Small phone screens should not try to provide full editing. They can support:

- open project
- inspect model
- view BOM
- view/export checklist

Precision panel layout should remain a desktop/tablet workflow.

## Complete Numbered Flow

1. User clicks `New Project`.
2. Start panel appears over the viewport.
3. User chooses preset, custom, or import.
4. If preset:
   - choose rack units
   - choose width
   - choose depth
   - optionally adjust panels/materials
5. If custom:
   - enter width, height, depth
   - choose panel composition
6. If import:
   - select folder or zip
   - app validates project assets
7. 3D preview updates immediately during chassis choices.
8. User creates project.
9. App enters panel layout workspace.
10. User selects active panel.
11. User adds single holes or component templates.
12. User edits exact dimensions and positions.
13. User creates arrays for repeated objects.
14. User groups logical clusters.
15. User aligns and distributes selected objects.
16. User checks DRC warnings.
17. User imports PCBs.
18. User positions PCBs manually or with anchors.
19. User adds standoffs.
20. User saves project.
21. User runs export preflight.
22. User exports drilled STLs.
23. User exports CSV/DXF drill data if needed.
24. User exports BOM if needed.

## Main User Stories

### First Rack Project

As a DIY audio builder, I want to create a standard rack chassis quickly so I can start placing panel hardware without learning CAD setup first.

Acceptance criteria:

- default preset creates a visible rack chassis
- dimensions are displayed in millimeters
- user can orbit before confirming
- created project has a valid `assembly.json`

### Front Panel Connector Row

As a builder laying out a mixer or crossover panel, I want to place one connector and array it across the panel so repeated controls are fast and evenly spaced.

Acceptance criteria:

- one placed object can be repeated into rows/columns
- ghost preview appears before commit
- committed objects are individually selectable
- panel export is marked dirty after commit

### Manufacturing Check

As a builder preparing to drill or CNC a panel, I want clear warnings for overlaps and edge problems so I do not ruin a physical panel.

Acceptance criteria:

- overlapping holes are visually flagged
- objects outside panel bounds are visually flagged
- export preflight lists conflicts
- clicking a conflict selects the relevant object

### Existing Project Recovery

As a user reopening an old project, I want the app to load everything it can and help me locate missing files instead of failing completely.

Acceptance criteria:

- valid `assembly.json` loads even if some models are missing
- missing files appear in the UI with a clear status
- user can relink or ignore missing files

## UI Component Inventory

### New Project Start Panel

Compact creation panel with project name, starting mode, rack preset, rack units, width, depth, and create action.

### Chassis Preset Picker

Preset selector with common DIY rack formats and physical dimensions.

### Chassis Inspector

Detailed controls for rack size, custom dimensions, enabled panels, material presets, and panel thickness.

### 3D Dimension Overlay

Viewport overlay showing width, height, depth, rack units, selected object coordinates, and edge distances.

### Panel Focus Switcher

Fast switcher for front, back, top, sides, and inside views.

### Tool Toolbar

Primary commands: select, hole, component, array, group, align, measure, snap, undo, redo, export.

### Component Palette

Searchable library of physical parts and drill patterns.

### Object Properties Panel

Exact position, dimensions, cutout type, label, host panel, visibility, lock state, and template metadata.

### Array Builder

Inline popover for rows, columns, spacing, and distribute-between-points mode.

### Group Inspector

Controls for group label, anchor, child list, ungroup, and save-as-template.

### Alignment Bar

Contextual bar for multi-selection alignment and distribution.

### DRC Panel

Validation list with severity, object references, and click-to-focus behavior.

### PCB Import Panel

File picker/path input, PCB list, transform controls, anchors, and standoff helpers.

### Export Drawer

Export options for STL, CSV, DXF, and BOM with preflight status.

### Missing Asset Resolver

Import recovery UI for missing model files.

### Workspace Mode Switcher

Top-level control for project setup, panel layout, interior layout, and export review. It should not feel like navigation to separate pages; it changes the active editing context inside the same 3D workspace.

### Selection Summary Strip

Small contextual strip showing selected object count, active panel, key measurements, and current DRC state. This gives immediate feedback without requiring the user to inspect the sidebar.

### Panel Origin Control

Control for coordinate reference display. MVP can be read-only center origin; later it can switch between center, top-left, and bottom-left display modes.

### Dirty Export Indicator

Status indicator per panel showing whether generated drilled geometry is current or stale.

## Interaction Patterns

### Add Hole Or Component

- Press `H` or select from palette.
- Ghost preview follows cursor on active panel.
- Click places object.
- Sidebar receives exact numeric fields.
- `Enter` confirms.
- `Esc` cancels.

### Exact Positioning

- Selected object shows crosshair.
- Sidebar fields use millimeters.
- Viewport shows distance to panel edges.
- Dragging updates live coordinate readout.

### Array

- Select object.
- Click `Array`.
- Set rows, columns, spacing.
- Ghost copies preview.
- `Enter` commits.
- Objects become independent, optionally grouped.

### Group

- Multi-select objects.
- Press `Ctrl+G` or `Cmd+G`.
- Move group through anchor.
- Double-click edits children.
- `Shift+Ctrl+G` or `Shift+Cmd+G` ungroups.

### Align And Distribute

- Multi-select objects.
- Use alignment buttons.
- Last selected object can become key object in later versions.
- MVP can align to selection bounds.

### Snap

- `S` toggles snapping.
- Hold `Ctrl` or `Cmd` to temporarily bypass snapping.
- Snap guides show the active target.

### DRC

- Runs after each edit.
- Lightweight feedback appears during drag.
- Full warnings appear in DRC panel.
- Export preflight repeats checks.

### PCB Placement

- Import GLTF/GLB.
- Drag with transform controls.
- Type exact transforms.
- Later: define PCB anchor and snap to panel hole.

### Undo And Redo

- `Ctrl+Z` / `Cmd+Z` undoes the last committed operation.
- `Ctrl+Y` or `Shift+Ctrl+Z` / `Shift+Cmd+Z` redoes it.
- Pointer drag is one undo step, committed on release.
- Array placement is one undo step.
- Template placement is one undo step, even when it creates multiple child objects.
- Group and ungroup are one undo step.

Undo must describe physical actions internally:

- add object
- remove object
- move object
- change dimensions
- create array
- group objects
- import PCB
- export panel metadata update

### Keyboard Shortcuts

Recommended shortcuts:

- `V`: select/move
- `H`: hole tool
- `C`: component/template palette
- `A`: array selected object
- `G`: group, with platform modifier where needed
- `S`: snap toggle
- `M`: measure
- `Delete` / `Backspace`: delete selected
- `Esc`: cancel active tool or clear selection
- `Enter`: confirm active preview/tool

Shortcuts should be visible in tooltips, not in large instructional text inside the workspace.

## Data Model Proposals

The current schema should be extended minimally. Flat objects should remain flat. Groups and templates should reference object IDs rather than nesting geometry.

```json
{
  "project": {
    "name": "two-channel-preamp",
    "version": 1,
    "createdAt": "2026-06-17T00:00:00.000Z"
  },
  "units": "mm",
  "origin": "center_of_chassis",
  "axes": {
    "x": "left_right",
    "y": "up_down",
    "z": "front_back"
  },
  "dimensions": {
    "width": 482.6,
    "height": 88.9,
    "depth": 200,
    "rack_units": 2,
    "rack_width": "19in"
  },
  "chassisSpec": {
    "preset": "2u-standard",
    "panels": {
      "front_panel": {
        "enabled": true,
        "materialPreset": "black_anodized",
        "thickness": 3
      },
      "back_panel": {
        "enabled": true,
        "materialPreset": "black_anodized",
        "thickness": 3
      },
      "top": {
        "enabled": false
      },
      "sides": {
        "enabled": true
      }
    }
  },
  "objects": [
    {
      "id": "xlr_out_1",
      "class": "hole",
      "kind": "component_cutout",
      "templateId": "neutrik-d-xlr-female",
      "hostId": "front_panel",
      "position": [-80, 0, 100],
      "rotation": [0, 0, 0],
      "normal": [0, 0, 1],
      "visible": true,
      "locked": false,
      "params": {
        "diameter": 24,
        "depth": 3
      }
    }
  ],
  "groups": [
    {
      "id": "stereo_input_pair_1",
      "label": "Stereo input pair",
      "childIds": ["rca_l_1", "rca_r_1"],
      "anchor": "center",
      "templateId": "stereo-rca-pair"
    }
  ],
  "templates": [
    {
      "id": "custom-control-cluster",
      "label": "Custom control cluster",
      "objects": []
    }
  ],
  "constraints": {
    "minimumEdgeDistance": 3,
    "minimumHoleClearance": 2
  },
  "exports": {
    "front_panel": {
      "drilledPath": "front_panel_drilled.stl",
      "status": "dirty"
    }
  }
}
```

### Groups

Groups should be metadata:

- `id`
- `label`
- `childIds`
- `anchor`
- optional `templateId`

This keeps all physical holes and components independently addressable.

### Templates

Templates should store relative child definitions. Placing a template should instantiate normal objects and optionally create a group.

### Arrays

Arrays should not need permanent schema for MVP. They are an editing operation that creates objects. If needed later, an array operation can be stored in history, not in the project file.

### DRC Results

DRC results should be computed, not persisted. Persist only user overrides if the app later supports exporting with acknowledged warnings.

### Panel-Local Display Data

Do not duplicate panel-local coordinates in the saved object unless needed. Derive them from:

- `hostId`
- `position`
- `normal`
- `dimensions`

If later precision issues require it, add a display/reference object such as:

```json
{
  "panelCoordinateDisplay": {
    "front_panel": {
      "origin": "center",
      "xDirection": "right",
      "yDirection": "up"
    }
  }
}
```

This should control UI display, not geometry.

### Template Instance Data

A placed template should instantiate real objects. Each child can keep `templateId` and `templateRole` for BOM/DRC context:

```json
{
  "id": "xlr_1_mount_left",
  "class": "hole",
  "templateId": "neutrik-d-xlr-female",
  "templateInstanceId": "xlr_1",
  "templateRole": "mounting_hole",
  "hostId": "front_panel",
  "position": [-92, 12, 100],
  "params": {
    "diameter": 3.2,
    "depth": 3
  }
}
```

This keeps manufacturing objects flat while preserving semantic meaning.

## Priority Ranking

### MVP

- New project start panel.
- Rack presets for 1U through 6U, 19 inch width, and common depths.
- Immediate generated chassis preview.
- Front/back panel focus modes.
- Add circular hole with exact millimeter positioning.
- Basic component templates for circular holes and the highest-value rack parts.
- Array tool with rows, columns, and spacing.
- Multi-select, move, duplicate, delete.
- Basic align and distribute for selected objects.
- Save `assembly.json`.
- Export drilled front/back STL.
- Import existing project with missing-file handling.
- Undo and redo for all edits.
- Basic DRC for overlaps and panel bounds.

### Nice To Have

- Half-rack support.
- Material presets per panel.
- Groups with double-click edit.
- Save custom clusters as templates.
- DXF drill export.
- CSV drill export.
- BOM export.
- Snap to object centers and panel centerlines.
- DRC warnings for overlap and edge clearance.
- PCB import with manual transform.

### Future

- PCB anchor snapping to panel holes.
- Automatic standoff detection from PCB metadata.
- Merge two projects.
- Version history inside the project folder.
- Fully parametric generated chassis geometry.
- Tablet-optimized editing.
- Advanced CNC/manufacturer rule profiles.

## Proposed Implementation Phases

This is not implementation work, but it defines a practical build order for later.

### Phase 1: Project Shell

- Add `New Project` entry point.
- Create project metadata and chassis dimensions.
- Generate or select default chassis parts.
- Save initial `assembly.json`.
- Show live dimension preview.

Definition of done:

- user can create a new 1U-6U project
- project reloads after save
- no panel layout features are required yet

### Phase 2: Panel Workplane

- Add active panel focus.
- Add panel-local coordinate readout.
- Add circular hole placement.
- Add exact position editing.
- Mark panel export dirty after changes.

Definition of done:

- user can place and precisely move holes on front/back panels
- saved objects reload on the correct host panel

### Phase 3: Speed Tools

- Add component templates.
- Add array placement.
- Add multi-select.
- Add align/distribute.
- Add duplicate/delete shortcuts.

Definition of done:

- user can create an 8-connector row quickly
- template-created child holes remain editable

### Phase 4: Manufacturing Confidence

- Add MVP DRC.
- Add export preflight.
- Add clearer dirty/exported panel state.
- Improve missing-file recovery.

Definition of done:

- user sees conflicts before export
- generated panels correspond to current object state

### Phase 5: Interior Integration

- Improve PCB interior view.
- Add standoff objects.
- Add manual PCB anchors.
- Add anchor-to-hole snapping.

Definition of done:

- user can align a board feature to a panel hole with less manual coordinate work

## Open Questions

- Are chassis panels generated parametrically, or selected from existing STL templates by rack size?
- Should the first implementation support only front/back drilled panels?
- What is the exact coordinate convention for panel-local X/Y relative to current chassis-centered X/Y/Z?
- Should holes immediately regenerate panel geometry, or remain visual guides until export?
- Which export is highest priority after STL: DXF, CSV, or both?
- Is browser local folder write access acceptable, or should saving remain server-assisted?
- Should component templates be bundled app data, user-editable JSON, or both?
- Which clearance rules are hard errors versus warnings?
- Does KiCad GLTF export include enough metadata for anchors, or must anchors be manually defined?
- Should project names be constrained to filesystem-safe slugs at creation time?
- Should the app support unsaved temporary projects, or always create a project folder first?
- Is panel thickness fixed by chassis preset, editable per panel, or inferred from STL?
- Should red DRC conflicts block export, or allow export with an explicit override?
- Should template dimensions be manufacturer-specific or generic by default?

## Recommended Product Direction

The new project flow should be chassis-first, fast, and physical. The user should get from **New Project** to a visible rack chassis almost immediately, then do most work directly on the front or back panel with exact millimeter controls nearby.

The biggest UX win is not a complex wizard. It is a precise panel workplane where holes, connector templates, arrays, groups, snapping, and DRC behave like a workshop-aware version of Inkscape.

For the next implementation step, build the narrowest useful slice:

1. New project creates a standard 1U-6U chassis.
2. The user can focus the front panel.
3. The user can place circular holes with exact millimeter positions.
4. The project saves and reloads.
5. Export can generate the drilled front panel.

Everything else should attach to that spine.
