// DOM Elements
const imageUpload = document.getElementById('imageUpload');
const editorSvg = document.getElementById('editorSvg');
const svgContainer = document.getElementById('svgContainer');
const modeControls = document.getElementById('modeControls');
const calibrationInput = document.getElementById('calibrationInput');
const curveTensionSection = document.getElementById('curveTensionSection');
const traceControls = document.getElementById('traceControls');
const clearShapeBtn = document.getElementById('clearShapeBtn');
const generate3dBtn = document.getElementById('generate3dBtn');
const downloadStlBtn = document.getElementById('downloadStlBtn');
const curveTensionSlider = document.getElementById('curveTension');
const tensionValue = document.getElementById('tensionValue');
const viewer3d = document.getElementById('viewer3d');

// State
let img = new Image();
let imageLoaded = false;
let mode = 'calibrate'; // 'calibrate' or 'trace'

// Calibration state
let calibStart = null;
let calibEnd = null;
let pixelsPerMm = null;

// Trace state
let tracePoints = [];
let shapeClosed = false;
let curveTension = 0.3;

// SVG Elements
let imageElement = null;
let calibrationLine = null;
let pointsGroup = null;
let tracePathElement = null;

// 3D Engine State
let scene, camera, renderer, controls, trayMesh;

// ========================
// Event Listeners
// ========================

imageUpload.addEventListener('change', handleImageUpload);

document.querySelectorAll('input[name="toolMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        mode = e.target.value;
        calibrationInput.style.display = mode === 'calibrate' ? 'block' : 'none';
        curveTensionSection.style.display = mode === 'trace' ? 'block' : 'none';
        traceControls.style.display = mode === 'trace' ? 'flex' : 'none';
        redrawSvg();
    });
});

editorSvg.addEventListener('mousedown', handleSvgMouseDown);
editorSvg.addEventListener('mousemove', handleSvgMouseMove);
editorSvg.addEventListener('mouseup', handleSvgMouseUp);

clearShapeBtn.addEventListener('click', () => {
    tracePoints = [];
    shapeClosed = false;
    redrawSvg();
    generate3dBtn.disabled = true;
});

document.getElementById('refLength').addEventListener('input', updateCalibration);

curveTensionSlider.addEventListener('input', (e) => {
    curveTension = parseFloat(e.target.value);
    tensionValue.textContent = Math.round(curveTension * 100) + '%';
    redrawSvg();
});

generate3dBtn.addEventListener('click', generate3DModel);
downloadStlBtn.addEventListener('click', downloadSTL);
window.addEventListener('resize', redrawSvg);

// ========================
// Image Upload & Setup
// ========================

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        img.onload = () => {
            imageLoaded = true;
            modeControls.style.display = 'flex';
            calibrationInput.style.display = 'flex';
            
            // Reset state
            calibStart = null;
            calibEnd = null;
            tracePoints = [];
            shapeClosed = false;
            pixelsPerMm = null;
            
            setupSvgCanvas();
            init3D();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function setupSvgCanvas() {
    // Clear SVG
    editorSvg.innerHTML = '';

    // Set viewBox to actual image dimensions - this defines the coordinate system
    // Coordinates in SVG will directly match image pixels
    editorSvg.setAttribute('viewBox', `0 0 ${img.width} ${img.height}`);
    editorSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    
    // Let CSS handle the display sizing
    editorSvg.style.width = 'auto';
    editorSvg.style.height = 'auto';
    editorSvg.style.maxWidth = '100%';
    editorSvg.style.maxHeight = '100%';

    // Add image - use full image dimensions as coordinate system
    imageElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', img.src);
    imageElement.setAttribute('width', img.width);
    imageElement.setAttribute('height', img.height);
    imageElement.setAttribute('opacity', '0.85');
    editorSvg.appendChild(imageElement);

    // Create groups for drawing
    calibrationLine = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    calibrationLine.setAttribute('id', 'calibration-line');
    editorSvg.appendChild(calibrationLine);

    tracePathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tracePathElement.setAttribute('fill', 'none');
    tracePathElement.setAttribute('stroke', '#2ecc71');
    tracePathElement.setAttribute('stroke-width', '2');
    tracePathElement.setAttribute('stroke-linecap', 'round');
    tracePathElement.setAttribute('stroke-linejoin', 'round');
    editorSvg.appendChild(tracePathElement);

    pointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pointsGroup.setAttribute('id', 'control-points');
    editorSvg.appendChild(pointsGroup);

    redrawSvg();
}

// ========================
// SVG Drawing Functions
// ========================

function redrawSvg() {
    if (!imageLoaded || !calibrationLine || !pointsGroup || !tracePathElement) return;

    // Clear calibration group
    calibrationLine.innerHTML = '';
    
    // Clear old fill paths to prevent duplicates on every redraw
    const oldFills = tracePathElement.parentNode.querySelectorAll('.fill-path');
    oldFills.forEach(el => el.remove());

    // Calculate visual scale so sizes match screen visually
    const rect = editorSvg.getBoundingClientRect();
    const vScale = rect.width ? img.width / rect.width : 1;

    // Draw calibration line if in calibrate mode
    if (mode === 'calibrate' && calibStart && calibEnd) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', calibStart.x);
        line.setAttribute('y1', calibStart.y);
        line.setAttribute('x2', calibEnd.x);
        line.setAttribute('y2', calibEnd.y);
        line.setAttribute('stroke', '#e74c3c');
        line.setAttribute('stroke-width', 3 * vScale);
        line.setAttribute('stroke-dasharray', `${5 * vScale},${5 * vScale}`);
        calibrationLine.appendChild(line);

        // Start circle
        const circle1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle1.setAttribute('cx', calibStart.x);
        circle1.setAttribute('cy', calibStart.y);
        circle1.setAttribute('r', 6 * vScale);
        circle1.setAttribute('fill', '#c0392b');
        circle1.setAttribute('stroke', 'white');
        circle1.setAttribute('stroke-width', 2 * vScale);
        calibrationLine.appendChild(circle1);

        // End circle
        const circle2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle2.setAttribute('cx', calibEnd.x);
        circle2.setAttribute('cy', calibEnd.y);
        circle2.setAttribute('r', 6 * vScale);
        circle2.setAttribute('fill', '#c0392b');
        circle2.setAttribute('stroke', 'white');
        circle2.setAttribute('stroke-width', 2 * vScale);
        calibrationLine.appendChild(circle2);
    }

    // Draw trace path with curves
    if (mode === 'trace' && tracePoints.length > 0) {
        tracePathElement.setAttribute('stroke-width', 3 * vScale);
        
        if (tracePoints.length === 1) {
            // Just a single point
            tracePathElement.setAttribute('d', '');
        } else if (tracePoints.length === 2) {
            // Straight line between two points
            const d = `M ${tracePoints[0].x} ${tracePoints[0].y} L ${tracePoints[1].x} ${tracePoints[1].y}`;
            tracePathElement.setAttribute('d', d);
        } else {
            // Smooth curve through multiple points
            const pathData = generateBezierPath(tracePoints, shapeClosed);
            tracePathElement.setAttribute('d', pathData);
        }

        // Draw control points
        pointsGroup.innerHTML = '';
        tracePoints.forEach((p, i) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', p.x);
            circle.setAttribute('cy', p.y);
            circle.setAttribute('r', 5 * vScale);
            circle.setAttribute('fill', i === 0 && shapeClosed ? '#27ae60' : '#27ae60');
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', 2 * vScale);
            circle.setAttribute('class', 'control-point');
            if (i === 0 && shapeClosed) {
                circle.setAttribute('fill', '#f39c12');
            }
            pointsGroup.appendChild(circle);
        });

        // If not closed, add subtle highlight on first point to show it's clickable
        if (!shapeClosed && tracePoints.length > 2) {
            const firstPoint = tracePoints[0];
            const ghostCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            ghostCircle.setAttribute('cx', firstPoint.x);
            ghostCircle.setAttribute('cy', firstPoint.y);
            ghostCircle.setAttribute('r', 12 * vScale);
            ghostCircle.setAttribute('fill', 'none');
            ghostCircle.setAttribute('stroke', '#f39c12');
            ghostCircle.setAttribute('stroke-width', 2 * vScale);
            ghostCircle.setAttribute('stroke-dasharray', `${2 * vScale},${2 * vScale}`);
            ghostCircle.setAttribute('opacity', '0.7');
            pointsGroup.appendChild(ghostCircle);
        }

        // Fill shape if closed
        if (shapeClosed) {
            const fillPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const pathData = generateBezierPath(tracePoints, true);
            fillPath.setAttribute('class', 'fill-path');
            fillPath.setAttribute('d', pathData);
            fillPath.setAttribute('fill', 'rgba(46, 204, 113, 0.15)');
            fillPath.setAttribute('stroke', 'none');
            tracePathElement.parentNode.insertBefore(fillPath, tracePathElement);
        }
    }
}

function generateBezierPath(points, closed) {
    if (points.length < 2) return '';

    const tension = curveTension;
    let pathData = `M ${points[0].x} ${points[0].y}`;

    const segments = closed ? points.length : points.length - 1;

    for (let i = 0; i < segments; i++) {
        let p0, p1, p2, p3;

        if (closed) {
            p0 = points[(i - 1 + points.length) % points.length];
            p1 = points[i];
            p2 = points[(i + 1) % points.length];
            p3 = points[(i + 2) % points.length];
        } else {
            p1 = points[i];
            p2 = points[i + 1];
            p0 = i === 0 ? p1 : points[i - 1];
            p3 = i === points.length - 2 ? p2 : points[i + 2];
        }

        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;

        pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    if (closed) {
        pathData += ' Z';
    }

    return pathData;
}

// ========================
// SVG Mouse Events
// ========================

let isDraggingCalib = false;

function handleSvgMouseDown(e) {
    if (!imageLoaded) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    // Parse viewBox correctly to get coordinate system
    const viewBox = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    const viewBoxWidth = viewBox[2];  // width from viewBox
    const viewBoxHeight = viewBox[3]; // height from viewBox
    
    // Calculate scale factors from display size to coordinate system
    const scaleX = viewBoxWidth / rect.width;
    const scaleY = viewBoxHeight / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (mode === 'calibrate') {
        calibStart = { x, y };
        calibEnd = { x, y };
        isDraggingCalib = true;
        redrawSvg();
    } else if (mode === 'trace' && !shapeClosed) {
        // Check if clicking near first point to close shape
        if (tracePoints.length > 2) {
            const firstPoint = tracePoints[0];
            const distance = Math.sqrt((x - firstPoint.x) ** 2 + (y - firstPoint.y) ** 2);
            const visualThreshold = 15 * scaleX; // Scale 15px screen distance to image coordinate system
            if (distance < visualThreshold) {
                shapeClosed = true;
                checkReadyFor3D();
                redrawSvg();
                return;
            }
        }

        tracePoints.push({ x, y });
        redrawSvg();
    }
}

function handleSvgMouseMove(e) {
    if (!imageLoaded || !isDraggingCalib || mode !== 'calibrate') return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    // Parse viewBox correctly
    const viewBox = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    const viewBoxWidth = viewBox[2];
    const viewBoxHeight = viewBox[3];
    
    const scaleX = viewBoxWidth / rect.width;
    const scaleY = viewBoxHeight / rect.height;

    calibEnd.x = (e.clientX - rect.left) * scaleX;
    calibEnd.y = (e.clientY - rect.top) * scaleY;
    redrawSvg();
}

function handleSvgMouseUp() {
    if (mode === 'calibrate' && isDraggingCalib) {
        isDraggingCalib = false;
        updateCalibration();
    }
}

function updateCalibration() {
    if (calibStart && calibEnd) {
        const dx = calibEnd.x - calibStart.x;
        const dy = calibEnd.y - calibStart.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const mm = parseFloat(document.getElementById('refLength').value);
        if (mm > 0 && distPx > 0) {
            pixelsPerMm = distPx / mm;
            console.log(`[Calibration] ${mm}mm = ${distPx.toFixed(2)}px → Scale: ${pixelsPerMm.toFixed(4)} px/mm`);
        }
        checkReadyFor3D();
    }
}

function checkReadyFor3D() {
    if (pixelsPerMm > 0 && shapeClosed && tracePoints.length >= 3) {
        generate3dBtn.disabled = false;
    } else {
        generate3dBtn.disabled = true;
    }
}

// ========================
// 3D & Three.js Logic
// ========================

function init3D() {
    if (scene) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    const aspect = viewer3d.clientWidth / viewer3d.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 10000);
    camera.position.set(0, 100, 150);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(viewer3d.clientWidth, viewer3d.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    viewer3d.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(200, 20, 0xcccccc, 0xeeeeee);
    scene.add(gridHelper);

    window.addEventListener('resize', onWindowResize, false);
    animate3D();
}

function animate3D() {
    requestAnimationFrame(animate3D);
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = viewer3d.clientWidth / viewer3d.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewer3d.clientWidth, viewer3d.clientHeight);
}

function getOffsetPolygon(points, offsetMm) {
    if (typeof window.ClipperLib === 'undefined') {
        console.error("[ERROR] ClipperLib not loaded!");
        return points;
    }

    const scale = 1000;
    console.log(`[Step 3] Computing offset. Offset: ${offsetMm}mm, Points: ${points.length}`);

    const path = points.map(p => ({
        X: Math.round(p.x * scale),
        Y: Math.round(p.y * scale)
    }));

    const co = new ClipperLib.ClipperOffset();
    const offsetPaths = new ClipperLib.Paths();

    co.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);

    const offsetAmt = offsetMm * scale;
    co.Execute(offsetPaths, offsetAmt);

    if (offsetPaths.length === 0) {
        console.warn("[Warning] ClipperLib failed to compute offset");
        return points;
    }

    console.log(`[Step 3b] Offset computed. New path has ${offsetPaths[0].length} points.`);

    return offsetPaths[0].map(pt => ({
        x: pt.X / scale,
        y: pt.Y / scale
    }));
}

function generate3DModel() {
    console.log("[Step 1] generate3DModel() initiated.");
    if (!pixelsPerMm || !shapeClosed) {
        console.warn("[Cancelled] Scale not set or shape not closed");
        return;
    }

    if (trayMesh) {
        console.log("Removing old mesh");
        scene.remove(trayMesh);
    }

    const baseThick = parseFloat(document.getElementById('baseThickness').value);
    const wallHeight = parseFloat(document.getElementById('wallHeight').value);
    const wallThick = parseFloat(document.getElementById('wallThickness').value);
    const tolerance = parseFloat(document.getElementById('tolerance').value);
    console.log(`[Step 2] Parameters: baseThick=${baseThick}, wallHeight=${wallHeight}, wallThick=${wallThick}, tolerance=${tolerance}`);

    // Use smoothed trace points
    const smoothedPoints = extractPointsFromBezier(tracePoints);
    console.log(`[Step 2b] Points smoothed. ${tracePoints.length} → ${smoothedPoints.length}`);

    // Center coordinates
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    smoothedPoints.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const mmPoints = smoothedPoints.map(p => ({
        x: (p.x - centerX) / pixelsPerMm,
        y: -(p.y - centerY) / pixelsPerMm
    }));

    let holePoints = getOffsetPolygon(mmPoints, tolerance);
    let outerPoints = getOffsetPolygon(holePoints, wallThick);

    // Ensure correct winding order
    const outerIsCW = THREE.ShapeUtils.isClockWise(outerPoints);
    if (outerIsCW) outerPoints.reverse();

    const holeIsCW = THREE.ShapeUtils.isClockWise(holePoints);
    if (!holeIsCW) holePoints.reverse();

    console.log("[Step 4] Winding order fixed. Creating Three.js shapes.");

    // Create Shapes
    const outerShape = new THREE.Shape();
    outerPoints.forEach((p, i) => {
        if (i === 0) outerShape.moveTo(p.x, p.y);
        else outerShape.lineTo(p.x, p.y);
    });

    const holeShape = new THREE.Path();
    holePoints.forEach((p, i) => {
        if (i === 0) holeShape.moveTo(p.x, p.y);
        else holeShape.lineTo(p.x, p.y);
    });

    outerShape.holes.push(holeShape);

    console.log("[Step 5] Extruding walls.");
    const wallGeom = new THREE.ExtrudeGeometry(outerShape, {
        depth: wallHeight,
        bevelEnabled: false
    });

    console.log("[Step 6] Extruding base.");
    const baseShape = new THREE.Shape();
    outerPoints.forEach((p, i) => {
        if (i === 0) baseShape.moveTo(p.x, p.y);
        else baseShape.lineTo(p.x, p.y);
    });

    const baseGeom = new THREE.ExtrudeGeometry(baseShape, {
        depth: baseThick,
        bevelEnabled: false
    });

    wallGeom.translate(0, 0, baseThick);

    wallGeom.computeVertexNormals();
    baseGeom.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0x667eea,
        roughness: 0.6,
        metalness: 0.1
    });

    const wallMesh = new THREE.Mesh(wallGeom, material);
    const baseMesh = new THREE.Mesh(baseGeom, material);

    trayMesh = new THREE.Group();
    trayMesh.add(wallMesh);
    trayMesh.add(baseMesh);

    trayMesh.rotation.x = -Math.PI / 2;

    scene.add(trayMesh);
    downloadStlBtn.disabled = false;

    console.log("[Step 7] Positioning camera.");
    const box = new THREE.Box3().setFromObject(trayMesh);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    camera.position.set(center.x, center.y + size * 1.5, center.z + size * 1.5);
    controls.target.copy(center);
    controls.maxDistance = size * 10;
    controls.update();

    console.log("[Step 8] Complete! Model ready to print.");
}

function downloadSTL() {
    if (!trayMesh) return;

    const exporter = new THREE.STLExporter();
    const stlString = exporter.parse(trayMesh);

    const blob = new Blob([stlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = '3d_tray.stl';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log("[Download] STL file downloaded successfully");
}

function extractPointsFromBezier(points, resolution = 5) {
    if (points.length < 2) return points;

    const result = [];
    const tension = curveTension;
    const closed = shapeClosed;
    const segments = closed ? points.length : points.length - 1;

    for (let i = 0; i < segments; i++) {
        let p0, p1, p2, p3;

        if (closed) {
            p0 = points[(i - 1 + points.length) % points.length];
            p1 = points[i];
            p2 = points[(i + 1) % points.length];
            p3 = points[(i + 2) % points.length];
        } else {
            p1 = points[i];
            p2 = points[i + 1];
            p0 = i === 0 ? p1 : points[i - 1];
            p3 = i === points.length - 2 ? p2 : points[i + 2];
        }

        result.push(p1);

        // Cardinal spline control points matching the visual SVG exactly
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;

        // Evaluate standard cubic Bezier curve to 3D segments
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
}
