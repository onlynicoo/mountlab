# 3D Assembly Viewer

Interactive full-stack viewer for assembling multi-part chassis models and PCB exports in a shared 3D workspace.

## Run

```bash
npm install
npm run dev
```

The frontend runs on `localhost:5173`; the backend model server runs on `localhost:3001`.

## Desktop app

MountLab can also run inside Electron. The Electron main process starts the Express backend on a private loopback port, injects that API URL into the renderer, and stores user data under Electron's per-user app-data directory.

```bash
npm run electron:dev
```

Build the Vite bundle and package the desktop app with:

```bash
npm run electron:build
```

Saved projects, scratch workspaces, conversion cache, and `positions.json` move under `MOUNTLAB_DATA_DIR` when that environment variable is set. Electron sets it to `app.getPath('userData')`; plain `npm run dev` keeps the previous development defaults.

## Project folders

Project folders imported from the viewer should live under `public/projects/<project-name>/`, so Vite can serve the files as static assets. Put chassis STL parts and PCB exports inside that folder:

```text
public/projects/example-project/
├── assembly.json
├── chassis/
│   ├── body.stl
│   ├── front_panel.stl
│   ├── back_panel.stl
│   └── rackmount.stl
└── pcb/
    ├── main_board.gltf
    └── psu_board.gltf
```

Chassis filenames should stay fixed across projects. The importer also accepts generic aliases such as `shell.stl`, `front-panel.stl`, `rear_panel.stl`, `back-panel.stl`, `rack_mount.stl`, and `rack_ears.stl`.

Each project can include its own `assembly.json` manifest. This makes the viewer multi-project: every project defines its own dimensions, origin, coordinate system, and component transforms.

```json
{
  "units": "mm",
  "origin": "center_of_chassis",
  "axes": {
    "x": "left_right",
    "y": "up_down",
    "z": "front_back"
  },
  "dimensions": {
    "width": 482.6,
    "height": 222.25,
    "depth": 150
  },
  "chassis": {
    "body.stl": {
      "position": [0, 0, 0],
      "rotation": [0, 0, 0]
    },
    "front_panel.stl": {
      "position": [0, 0, 0],
      "rotation": [0, 0, 0]
    },
    "back_panel.stl": {
      "position": [0, 0, 0],
      "rotation": [0, 0, 0]
    },
    "rackmount.stl": {
      "position": [0, 0, 0],
      "rotation": [0, 0, 0]
    }
  },
  "objects": [
    {
      "id": "control_hole_1",
      "class": "hole",
      "label": "Control hole",
      "hostId": "front_panel",
      "position": [0, 0, 75],
      "rotation": [0, 0, 0],
      "normal": [0, 0, 1],
      "visible": true,
      "material": {
        "color": "#111111",
        "metalness": 0.2,
        "roughness": 0.6
      },
      "params": {
        "diameter": 10,
        "depth": 3
      }
    }
  ]
}
```

When importing a project, the viewer reads `assembly.json` and applies transforms to the matching chassis files. If `assembly.json` is missing, the fallback is to load all chassis parts at `[0, 0, 0]`.

`objects` contains editable stand-alone layout items such as visual holes, knobs, and generic controls. Their `position`, `rotation`, and `normal` are relative to `hostId` (`front_panel` or `back_panel`), so moving the host panel keeps its objects attached. These are visual placement objects only; they do not cut STL geometry yet.
