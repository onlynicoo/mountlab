#!/usr/bin/env python3
"""
Export an STL mesh panel as a STEP file using FreeCAD.
Usage: python export.py <input.stl> <output.step>
"""
import sys

try:
    import FreeCAD as App
    import Mesh
    import Part
except Exception as exc:
    print(
        "FreeCAD Python modules are not available. "
        "Run this script with FreeCAD's Python or set FREECAD_CMD/FREECAD_LIB_PATH.",
        file=sys.stderr,
    )
    print(str(exc), file=sys.stderr)
    sys.exit(5)


def mesh_to_shape(input_path):
    mesh = Mesh.Mesh(input_path)
    shape = Part.Shape()
    shape.makeShapeFromMesh(mesh.Topology, 0.1)
    shell = Part.Shell(shape.Faces)
    if not shell.isClosed():
        return shape
    return Part.Solid(shell)


def main():
    args = sys.argv[1:]
    if args and args[0] == "--pass":
        args = args[1:]

    if len(args) != 2:
        print("Usage: python export.py <input.stl> <output.step>", file=sys.stderr)
        return 2

    input_path, output_path = args
    shape = mesh_to_shape(input_path)
    shape.exportStep(output_path)
    print(f"OK: {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
