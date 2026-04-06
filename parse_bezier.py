import re

with open("app.js", "r") as f:
    js = f.read()

# Add getHandlePositions
helper = """
function getHandles(points, i, tension, closed) {
    let p = points[i];
    let pNext, pPrev;
    if (closed) {
        pNext = points[(i + 1) % points.length];
        pPrev = points[(i - 1 + points.length) % points.length];
    } else {
        pNext = i < points.length - 1 ? points[i + 1] : p;
        pPrev = i > 0 ? points[i - 1] : p;
    }

    let hOutX = p.hasManualHandles && p.hOut ? p.hOut.x : (pNext.x - pPrev.x) * tension;
    let hOutY = p.hasManualHandles && p.hOut ? p.hOut.y : (pNext.y - pPrev.y) * tension;

    let hInX = p.hasManualHandles && p.hIn ? p.hIn.x : -(pNext.x - pPrev.x) * tension;
    let hInY = p.hasManualHandles && p.hIn ? p.hIn.y : -(pNext.y - pPrev.y) * tension;
    
    if (!closed && i === points.length - 1) { hOutX = 0; hOutY = 0; }
    if (!closed && i === 0) { hInX = 0; hInY = 0; }

    return { 
        hOut: { dx: hOutX, dy: hOutY, absX: p.x + hOutX, absY: p.y + hOutY },
        hIn:  { dx: hInX, dy: hInY, absX: p.x + hInX, absY: p.y + hInY }
    };
}
"""

# Now replace extractPointsFromBezier body
old_extract = re.search(r"function extractPointsFromBezier\(points\, isClosed\, resolution \= 5\) \{[\s\S]*?return result;\n\}", js)

new_extract = """function extractPointsFromBezier(points, isClosed, resolution = 5) {
    if (points.length < 2) return points;

    const result = [];
    const tension = curveTension;
    const closed = isClosed;
    const segments = closed ? points.length : points.length - 1;

    for (let i = 0; i < segments; i++) {
        let p1 = points[i];
        let p2 = points[(i + 1) % points.length];
        
        result.push(p1);

        let h1 = getHandles(points, i, tension, closed);
        let h2 = getHandles(points, (i + 1) % points.length, tension, closed);

        const cp1x = h1.hOut.absX;
        const cp1y = h1.hOut.absY;
        const cp2x = h2.hIn.absX;
        const cp2y = h2.hIn.absY;

        for (let t = 1; t < resolution; t++) {
            const tt = t / resolution;
            const mt = 1 - tt;
            
            const b0 = mt * mt * mt;
            const b1 = 3 * mt * mt * tt;
            const b2 = 3 * mt * tt * tt;
            const b3 = tt * tt * tt;

            const x = b0 * p1.x + b1 * cp1x + b2 * cp2x + b3 * p2.x;
            const y = b0 * p1.y + b1 * cp1y + b2 * cp2y + b3 * p2.y;

            result.push({ x, y });
        }
    }
    
    if (!closed && points.length > 0) {
        result.push(points[points.length - 1]);
    }

    return result;
}"""

js = js.replace(old_extract.group(0), helper + "\n" + new_extract)

# And generateBezierPath
old_gen = re.search(r"function generateBezierPath\(points\, closed\) \{[\s\S]*?return pathData;\n\}", js)

new_gen = """function generateBezierPath(points, closed) {
    if (points.length < 2) return '';

    const tension = curveTension;
    let pathData = `M ${points[0].x} ${points[0].y}`;
    const segments = closed ? points.length : points.length - 1;

    for (let i = 0; i < segments; i++) {
        let p2 = points[(i + 1) % points.length];
        let h1 = getHandles(points, i, tension, closed);
        let h2 = getHandles(points, (i + 1) % points.length, tension, closed);

        const cp1x = h1.hOut.absX;
        const cp1y = h1.hOut.absY;
        const cp2x = h2.hIn.absX;
        const cp2y = h2.hIn.absY;

        pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    if (closed) pathData += ' Z';
    return pathData;
}"""

js = js.replace(old_gen.group(0), new_gen)

with open("app.js", "w") as f:
    f.write(js)
