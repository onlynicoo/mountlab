#!/usr/bin/env python3
"""
Convert STEP/STP files to STL using CadQuery.

Usage:
  python3 convert.py <input.step> <output.stl>
"""

import sys


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 convert.py <input.step> <output.stl>", file=sys.stderr)
        return 2

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        import cadquery as cq
    except ImportError:
        print(
            "CadQuery is required for STEP conversion. Install it with: pip install cadquery",
            file=sys.stderr,
        )
        return 5

    result = cq.importers.importStep(input_path)
    cq.exporters.export(result, output_path)
    print(f"OK: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
