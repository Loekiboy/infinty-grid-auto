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
editorSvg.addEventListener('wheel', handleSvgWheel);
// Add context menu disable to enable right-click panning
editorSvg.addEventListener('contextmenu', e => e.preventDefault());

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
    viewBoxState = { 
        x: 0, 
        y: 0, 
        w: img.width, 
        h: img.height 
    };
    editorSvg.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);
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

    // Calculate visual scale so sizes match screen visually regardless of zoom
    const rect = editorSvg.getBoundingClientRect();
    const vScale = rect.width ? viewBoxState.w / rect.width : 1;

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
let dragPointIndex = -1;

// Pan & Zoom state
let isPanning = false;
let panStart = { x: 0, y: 0 };
let viewBoxState = { x: 0, y: 0, w: 0, h: 0 }; // Initialize on image load

function startPan(e, x, y) {
    if (e.button === 1 || e.button === 2) { // Middle or Right click
        e.preventDefault();
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        return true;
    }
    return false;
}

function handleSvgWheel(e) {
    if (!imageLoaded) return;
    e.preventDefault();
    
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    // Zoom factor
    const zoomIntensity = 0.1;
    const zoom = e.deltaY < 0 ? (1 - zoomIntensity) : (1 + zoomIntensity);
    
    // Mouse focus point relative to SVG rect
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate scale factor from view to SVG size
    const scaleX = viewBoxState.w / rect.width;
    const scaleY = viewBoxState.h / rect.height;

    // ViewBox target coords
    const viewTargetX = viewBoxState.x + mouseX * scaleX;
    const viewTargetY = viewBoxState.y + mouseY * scaleY;

    // New ViewBox dimensions
    const newW = viewBoxState.w * zoom;
    const newH = viewBoxState.h * zoom;

    // Adjust X and Y so zoom centers on mouse
    viewBoxState.x = viewTargetX - (mouseX / rect.width) * newW;
    viewBoxState.y = viewTargetY - (mouseY / rect.height) * newH;
    viewBoxState.w = newW;
    viewBoxState.h = newH;

    svg.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);
    redrawSvg(); // Important for stroke-widths and circle sizes based on zoom
}

function handleSvgMouseDown(e) {
    if (!imageLoaded) return;
    
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    const scaleX = viewBoxState.w / rect.width;
    const scaleY = viewBoxState.h / rect.height;

    // Translated coords using actual viewbox bounds
    const x = viewBoxState.x + (e.clientX - rect.left) * scaleX;
    const y = viewBoxState.y + (e.clientY - rect.top) * scaleY;

    if (startPan(e, x, y)) return;

    if (mode === 'calibrate') {
        calibStart = { x, y };
        calibEnd = { x, y };
        isDraggingCalib = true;
        redrawSvg();
    } else if (mode === 'trace') {
        const visualThreshold = 15 * scaleX;

        // 1. Check if we're clicking an existing point to DRAG it
        const clickedIndex = tracePoints.findIndex(p => {
            return Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2) < visualThreshold;
        });

        if (clickedIndex !== -1) {
            // Check if clicking first point to close shape (only matters if dragging first point and want to close)
            if (clickedIndex === 0 && !shapeClosed && tracePoints.length > 2) {
                shapeClosed = true;
                checkReadyFor3D();
                redrawSvg();
                return;
            }
            dragPointIndex = clickedIndex;
            return; // We grabbed a point, don't generate a new one
        }

        // 2. Otherwise add new point if not closed
        if (!shapeClosed) {
            tracePoints.push({ x, y });
            redrawSvg();
        }
    }
}

function handleSvgMouseMove(e) {
    if (!imageLoaded) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    const scaleX = viewBoxState.w / rect.width;
    const scaleY = viewBoxState.h / rect.height;

    if (isPanning) {
        const dx = (e.clientX - panStart.x) * scaleX;
        const dy = (e.clientY - panStart.y) * scaleY;
        
        viewBoxState.x -= dx;
        viewBoxState.y -= dy;
        
        svg.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);
        
        panStart = { x: e.clientX, y: e.clientY };
        return;
    }

    if (mode === 'calibrate' && isDraggingCalib) {
        calibEnd.x = viewBoxState.x + (e.clientX - rect.left) * scaleX;
        calibEnd.y = viewBoxState.y + (e.clientY - rect.top) * scaleY;
        redrawSvg();
    } 
    else if (mode === 'trace' && dragPointIndex !== -1) {
        // Dragging an individual point
        tracePoints[dragPointIndex].x = viewBoxState.x + (e.clientX - rect.left) * scaleX;
        tracePoints[dragPointIndex].y = viewBoxState.y + (e.clientY - rect.top) * scaleY;
        redrawSvg();
    }
}

function handleSvgMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        return;
    }

    if (mode === 'calibrate' && isDraggingCalib) {
        isDraggingCalib = false;
        updateCalibration();
    }
    
    if (mode === 'trace' && dragPointIndex !== -1) {
        dragPointIndex = -1;
        checkReadyFor3D(); // Trigger 3D update if closed
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
    const trayMode = document.getElementById('trayMode').value;
    console.log(`[Step 2] Parameters: baseThick=${baseThick}, wallHeight=${wallHeight}, wallThick=${wallThick}, tolerance=${tolerance}, mode=${trayMode}`);

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

    const holeIsCW = THREE.ShapeUtils.isClockWise(holePoints);
    if (!holeIsCW) holePoints.reverse();

    const outerShape = new THREE.Shape();
    const baseShape = new THREE.Shape();

    let unitsX = 1, unitsY = 1;
    let shiftZ = 0;

    if (trayMode === 'exact') {
        let outerPoints = getOffsetPolygon(holePoints, wallThick);
        
        const outerIsCW = THREE.ShapeUtils.isClockWise(outerPoints);
        if (outerIsCW) outerPoints.reverse();

        outerPoints.forEach((p, i) => {
            if (i === 0) {
                outerShape.moveTo(p.x, p.y);
                baseShape.moveTo(p.x, p.y);
            } else {
                outerShape.lineTo(p.x, p.y);
                baseShape.lineTo(p.x, p.y);
            }
        });
    } else {
        // Bounding or Gridfinity mode
        let hMinX = Infinity, hMinY = Infinity, hMaxX = -Infinity, hMaxY = -Infinity;
        holePoints.forEach(p => {
            if (p.x < hMinX) hMinX = p.x;
            if (p.x > hMaxX) hMaxX = p.x;
            if (p.y < hMinY) hMinY = p.y;
            if (p.y > hMaxY) hMaxY = p.y;
        });

        let boxWidth, boxHeight, boxCX, boxCY;

        if (trayMode === 'bounding') {
            boxWidth = (hMaxX - hMinX) + (wallThick * 2);
            boxHeight = (hMaxY - hMinY) + (wallThick * 2);
            boxCX = (hMaxX + hMinX) / 2;
            boxCY = (hMaxY + hMinY) / 2;
        } else if (trayMode === 'gridfinity') {
            const minInnerWidth = (hMaxX - hMinX) + (wallThick * 2);
            const minInnerHeight = (hMaxY - hMinY) + (wallThick * 2);
            
            unitsX = Math.ceil(minInnerWidth / 42);
            unitsY = Math.ceil(minInnerHeight / 42);
            
            boxWidth = unitsX * 42 - 0.5;
            boxHeight = unitsY * 42 - 0.5;
            boxCX = (hMaxX + hMinX) / 2;
            boxCY = (hMaxY + hMinY) / 2;
            shiftZ = 4.6; // We sit on top of the feet
        }

        const rX = boxCX - boxWidth / 2;
        const rY = boxCY - boxHeight / 2;
        const radius = trayMode === 'gridfinity' ? 4.0 : 2;

        const buildRoundedRect = (s, x, y, width, height, r) => {
            s.moveTo(x + r, y);
            s.lineTo(x + width - r, y);
            s.quadraticCurveTo(x + width, y, x + width, y + r);
            s.lineTo(x + width, y + height - r);
            s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            s.lineTo(x + r, y + height);
            s.quadraticCurveTo(x, y + height, x, y + height - r);
            s.lineTo(x, y + r);
            s.quadraticCurveTo(x, y, x + r, y);
        };

        buildRoundedRect(outerShape, rX, rY, boxWidth, boxHeight, radius);
        buildRoundedRect(baseShape, rX, rY, boxWidth, boxHeight, radius);
    }

    console.log("[Step 4] Shape defined. Creating Three.js geometries.");

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
    
    const baseGeom = new THREE.ExtrudeGeometry(baseShape, {
        depth: baseThick,
        bevelEnabled: false
    });

    wallGeom.translate(0, 0, shiftZ + baseThick);
    baseGeom.translate(0, 0, shiftZ);

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

    // Add Gridfinity Feet
    if (trayMode === 'gridfinity') {
        const makeRoundedRect = (w, r) => {
            const s = new THREE.Shape();
            const hw = w/2;
            s.moveTo(hw - r, -hw);
            s.quadraticCurveTo(hw, -hw, hw, -hw + r);
            s.lineTo(hw, hw - r);
            s.quadraticCurveTo(hw, hw, hw - r, hw);
            s.lineTo(-hw + r, hw);
            s.quadraticCurveTo(-hw, hw, -hw, hw - r);
            s.lineTo(-hw, -hw + r);
            s.quadraticCurveTo(-hw, -hw, -hw + r, -hw);
            s.lineTo(hw - r, -hw);
            return s;
        };

        const footGroup = new THREE.Group();

        // 1. Bottom straight
        const bShape = makeRoundedRect(36.6, 1.6);
        const bGeom = new THREE.ExtrudeGeometry(bShape, {depth: 0.8, bevelEnabled: false});
        footGroup.add(new THREE.Mesh(bGeom, material));

        // 2. Chamfer
        const slices = 12;
        for(let i=0; i<slices; i++) {
            const t = (i + 0.5) / slices;
            const w = 36.6 + t * (41.5 - 36.6);
            const r = 1.6 + t * (4.0 - 1.6);
            const sliceGeom = new THREE.ExtrudeGeometry(makeRoundedRect(w, r), {depth: 2.4/slices, bevelEnabled: false});
            sliceGeom.translate(0, 0, 0.8 + i * (2.4/slices));
            footGroup.add(new THREE.Mesh(sliceGeom, material));
        }

        // 3. Top straight
        const tShape = makeRoundedRect(41.5, 4.0);
        const tGeom = new THREE.ExtrudeGeometry(tShape, {depth: 1.4, bevelEnabled: false});
        tGeom.translate(0, 0, 3.2);
        footGroup.add(new THREE.Mesh(tGeom, material));

        let hMinX = Infinity, hMinY = Infinity, hMaxX = -Infinity, hMaxY = -Infinity;
        holePoints.forEach(p => {
            if (p.x < hMinX) hMinX = p.x;
            if (p.x > hMaxX) hMaxX = p.x;
            if (p.y < hMinY) hMinY = p.y;
            if (p.y > hMaxY) hMaxY = p.y;
        });
        const boxCX = (hMaxX + hMinX) / 2;
        const boxCY = (hMaxY + hMinY) / 2;

        const startX = boxCX - ((unitsX - 1) * 42) / 2;
        const startY = boxCY - ((unitsY - 1) * 42) / 2;

        for (let x=0; x<unitsX; x++) {
            for (let y=0; y<unitsY; y++) {
                const foot = footGroup.clone();
                foot.position.x = startX + x * 42;
                foot.position.y = startY + y * 42;
                trayMesh.add(foot);
            }
        }
    }

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
