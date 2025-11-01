const { primitives, booleans, transforms, extrusions } = require('@jscad/modeling');
const { cuboid, cylinder } = primitives;
const { subtract, union } = booleans;
const { translate } = transforms;
const serializer = require('@jscad/stl-serializer');

const GRIDFINITY_UNIT = 42; // mm
const GRIDFINITY_HEIGHT = 7; // Base height in mm
const TOLERANCE = 0.5; // mm tolerance for fit

/**
 * Generate a Gridfinity-compatible bin/insert STL file
 * Based on the dimensions calculated from the photo
 */
async function generateGridfinitySTL(dimensions) {
  const { gridUnitsX, gridUnitsY, height } = dimensions;
  
  // Calculate total dimensions
  const totalWidth = gridUnitsX * GRIDFINITY_UNIT - TOLERANCE;
  const totalLength = gridUnitsY * GRIDFINITY_UNIT - TOLERANCE;
  const totalHeight = Math.max(height, 10); // Minimum 10mm height
  
  // Create the main body
  const body = cuboid({
    size: [totalWidth, totalLength, totalHeight],
    center: [totalWidth / 2, totalLength / 2, totalHeight / 2]
  });
  
  // Create the base grid pattern (simplified)
  let base = cuboid({
    size: [totalWidth, totalLength, GRIDFINITY_HEIGHT],
    center: [totalWidth / 2, totalLength / 2, GRIDFINITY_HEIGHT / 2]
  });
  
  // Add magnets holes (4 corners for single unit, or distributed for larger units)
  const magnetRadius = 3.25; // 6.5mm diameter magnet
  const magnetDepth = 2.5;
  const magnetOffset = 4.8; // Distance from edge
  
  const magnetPositions = [];
  
  // Add magnet positions based on grid size
  for (let x = 0; x < gridUnitsX; x++) {
    for (let y = 0; y < gridUnitsY; y++) {
      const baseX = x * GRIDFINITY_UNIT;
      const baseY = y * GRIDFINITY_UNIT;
      
      // Four corners of each unit
      magnetPositions.push(
        [baseX + magnetOffset, baseY + magnetOffset],
        [baseX + GRIDFINITY_UNIT - magnetOffset, baseY + magnetOffset],
        [baseX + magnetOffset, baseY + GRIDFINITY_UNIT - magnetOffset],
        [baseX + GRIDFINITY_UNIT - magnetOffset, baseY + GRIDFINITY_UNIT - magnetOffset]
      );
    }
  }
  
  // Create magnet holes
  let magnetHoles = [];
  for (const [x, y] of magnetPositions) {
    const hole = cylinder({
      radius: magnetRadius,
      height: magnetDepth,
      center: [x, y, magnetDepth / 2]
    });
    magnetHoles.push(hole);
  }
  
  // Subtract magnet holes from base
  if (magnetHoles.length > 0) {
    base = subtract(base, ...magnetHoles);
  }
  
  // Create the storage compartment (hollow out the top)
  const wallThickness = 1.5;
  const compartment = cuboid({
    size: [
      totalWidth - 2 * wallThickness,
      totalLength - 2 * wallThickness,
      totalHeight - GRIDFINITY_HEIGHT
    ],
    center: [
      totalWidth / 2,
      totalLength / 2,
      GRIDFINITY_HEIGHT + (totalHeight - GRIDFINITY_HEIGHT) / 2
    ]
  });
  
  // Combine base and body, subtract compartment
  let finalModel = union(base, body);
  finalModel = subtract(finalModel, compartment);
  
  // Serialize to STL
  const rawData = serializer.serialize({ binary: false }, finalModel);
  
  // Convert raw data to string
  let stlString = '';
  for (const segment of rawData) {
    if (segment instanceof Uint8Array) {
      stlString += new TextDecoder().decode(segment);
    } else {
      stlString += segment;
    }
  }
  
  return stlString;
}

module.exports = {
  generateGridfinitySTL
};
