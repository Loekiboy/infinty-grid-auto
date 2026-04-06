import re

with open("app.js", "r") as f:
    js = f.read()

mouse_down = re.search(r"function handleSvgMouseDown\(e\) \{[\s\S]*?function handleSvgMouseMove\(e\) \{", js).group(0)

new_mouse_down = """function handleSvgMouseDown(e) {
    if (mode === 'trace' || mode === 'finger' || mode === 'edit') {
        let pt = getMousePosition(e);
        const threshold = 10 * vScale;
        
        if (mode === 'edit') {
            dragPointIndex = -1;
            dragHandleObj = null;
            let activeTraceArr = traces[activeTrace];
            if (!activeTraceArr) return;

            // Check Handles first
            let closed = shapeClosed[activeTrace];
            for (let i = 0; i < activeTraceArr.length; i++) {
                let handles = getHandles(activeTraceArr, i, curveTension, closed);
                
                if (!(!closed && i === activeTraceArr.length - 1)) {
                    let dOut = Math.hypot(pt.x - handles.hOut.absX, pt.y - handles.hOut.absY);
                    if (dOut < threshold) {
                        dragPointIndex = i;
                        dragHandleObj = 'hOut';
                        return;
                    }
                }
                if (!(!closed && i === 0)) {
                    let dIn = Math.hypot(pt.x - handles.hIn.absX, pt.y - handles.hIn.absY);
                    if (dIn < threshold) {
                        dragPointIndex = i;
                        dragHandleObj = 'hIn';
                        return;
                    }
                }
            }
            
            // Check anchor points
            for (let i = 0; i < activeTraceArr.length; i++) {
                let p = activeTraceArr[i];
                let d = Math.hypot(pt.x - p.x, pt.y - p.y);
                if (d < threshold) {
                    dragPointIndex = i;
                    isDraggingPoint = true;
                    return;
                }
            }
            return; // click nowhere
        }

        if (mode === 'trace') {
            let activeTraceArr = traces[activeTrace];
            for (let i = 0; i < activeTraceArr.length; i++) {
                let p = activeTraceArr[i];
                let d = Math.hypot(pt.x - p.x, pt.y - p.y);
                if (d < threshold) {
                    isDraggingPoint = true;
                    dragPointIndex = i;
                    return;
                }
            }

            if (!shapeClosed[activeTrace] && activeTraceArr.length > 2) {
                let d = Math.hypot(pt.x - activeTraceArr[0].x, pt.y - activeTraceArr[0].y);
                if (d < 15 * vScale) {
                    shapeClosed[activeTrace] = true;
                    redrawSvg();
                    generate3DModel();
                    return;
                }
            }
            activeTraceArr.push({ x: pt.x, y: pt.y });
            redrawSvg();
        } else if (mode === 'finger') {
            const pxMm = pixelsPerMm || 1;
            let clickedOnExisting = false;
            for(let i=0; i<fingerHoles.length; i++) {
                let f = fingerHoles[i];
                if (Math.hypot(pt.x - f.x, pt.y - f.y) <= f.r * pxMm + threshold) {
                    fingerHoles.splice(i, 1);
                    clickedOnExisting = true;
                    break;
                }
            }
            if(!clickedOnExisting) {
                const radius = parseFloat(fingerRadiusInput.value);
                fingerHoles.push({x: pt.x, y: pt.y, r: radius});
            }
            redrawSvg();
            if (activeTrace === 0 && shapeClosed[0]) {
                generate3DModel();
            }
        }
    }
}

function handleSvgMouseMove"""

js = js.replace(mouse_down, new_mouse_down)

mouse_move = re.search(r"function handleSvgMouseMove\(e\) \{[\s\S]*?function handleSvgMouseUp\(e\) \{", js).group(0)

new_mouse_move = """function handleSvgMouseMove(e) {
    if (mode === 'edit' && dragPointIndex !== -1 && dragHandleObj) {
        let pt = getMousePosition(e);
        let activeTraceArr = traces[activeTrace];
        let p = activeTraceArr[dragPointIndex];
        
        p.hasManualHandles = true;
        
        if (dragHandleObj === 'hOut') {
            p.hOut = { x: pt.x - p.x, y: pt.y - p.y };
        } else if (dragHandleObj === 'hIn') {
            p.hIn = { x: pt.x - p.x, y: pt.y - p.y };
        }
        
        redrawSvg();
        return;
    }
    
    if (isDraggingPoint && dragPointIndex !== -1 && (mode === 'trace' || mode === 'edit')) {
        let pt = getMousePosition(e);
        traces[activeTrace][dragPointIndex].x = pt.x;
        traces[activeTrace][dragPointIndex].y = pt.y;
        redrawSvg();
    }
}

function handleSvgMouseUp"""
js = js.replace(mouse_move, new_mouse_move)


mouse_up = re.search(r"function handleSvgMouseUp\(e\) \{[\s\S]*?function redrawSvg\(\) \{", js).group(0)

new_mouse_up = """function handleSvgMouseUp(e) {
    if (isDraggingPoint || dragHandleObj) {
        isDraggingPoint = false;
        dragHandleObj = null;
        dragPointIndex = -1;
        if (shapeClosed[activeTrace]) {
            generate3DModel();
        }
    }
}

function redrawSvg() {"""

js = js.replace(mouse_up, new_mouse_up)

with open("app.js", "w") as f:
    f.write(js)
