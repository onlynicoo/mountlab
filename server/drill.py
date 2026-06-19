#!/usr/bin/env python3
"""
Apply cylindrical holes to an STL file using FreeCAD.
Usage: FreeCAD drill.py <input.stl> <output.stl> <holes.json>
"""
import json
import math
import sys

try:
    import FreeCAD as App
    import Mesh
    import MeshPart
    import Part
except Exception as exc:
    print(
        "FreeCAD Python modules are not available. "
        "Run this script with FreeCAD or set FREECAD_CMD to the FreeCAD executable.",
        file=sys.stderr,
    )
    print(str(exc), file=sys.stderr)
    sys.exit(5)


def vector(values, fallback):
    if not isinstance(values, list) or len(values) < 3:
        values = fallback
    return App.Vector(float(values[0]), float(values[1]), float(values[2]))


def mesh_to_shape(input_path):
    mesh = Mesh.Mesh(input_path)
    shape = Part.Shape()
    shape.makeShapeFromMesh(mesh.Topology, 0.1)
    shell = Part.Shell(shape.Faces)
    if not shell.isClosed():
        return shape
    return Part.Solid(shell)


def drill_shape(shape, holes):
    cutters = []

    for hole in holes:
        position = vector(hole.get("position"), [0, 0, 0])
        normal = vector(hole.get("normal"), [0, 0, 1])
        if normal.Length == 0:
            normal = App.Vector(0, 0, 1)
        normal.normalize()

        params = hole.get("params") or {}
        diameter = max(float(params.get("diameter", 10)), 0.1)
        declared_depth = max(float(params.get("depth", 3)), 0.1)
        cutter_depth = max(declared_depth * 6, 30)
        radius = diameter / 2
        base = position.sub(normal.multiply(cutter_depth / 2))

        cutter = Part.makeCylinder(radius, cutter_depth, base, normal, 360)
        cutters.append(cutter)

    if not cutters:
        return shape

    cutter_shape = cutters[0] if len(cutters) == 1 else Part.makeCompound(cutters)
    result = shape.cut(cutter_shape)
    return result.removeSplitter()


def export_stl(shape, output_path):
    mesh = MeshPart.meshFromShape(
        Shape=shape,
        LinearDeflection=0.1,
        AngularDeflection=math.radians(8),
        Relative=False,
    )
    mesh.write(output_path)


def main():
    args = sys.argv[1:]
    if args and args[0] == "--pass":
        args = args[1:]

    if len(args) != 3:
        print("Usage: FreeCAD drill.py <input.stl> <output.stl> <holes.json>", file=sys.stderr)
        return 2

    input_path, output_path, holes_path = args
    with open(holes_path, "r", encoding="utf-8") as handle:
        holes = json.load(handle)

    shape = mesh_to_shape(input_path)
    drilled = drill_shape(shape, holes)
    export_stl(drilled, output_path)
    print(f"OK: {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
