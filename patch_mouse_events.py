import re

with open("app.js", "r") as f:
    js = f.read()

# Add edit state variable
js = js.replace("let dragPointIndex = -1;", "let dragPointIndex = -1;\nlet dragHandleObj = null;")


old_mm = re.search(r"\} else if \(mode === \'trace\' \|\| mode === \'finger\'\) \{[\s\S]*?function generateBezierPath", js).group(0)

new_mm = """} else if (mode === 'trace' || mode === 'finger' || mode === 'edit') {
        pointsGroup.innerHTML = '';
        
        let pathStr = "";
        
        for (let t = 0; t < traces.length; t++) {
            let traceP = traces[t];
            let closed = shapeClosed[t];
            
            if (traceP.length === 2 && !closed) {
                pathStr += `M ${traceP[0].x} ${traceP[0].y} L ${traceP[1].x} ${traceP[1].y} `;
            } else if (traceP.length >= 3) {
                pathStr += generateBezierPath(traceP, closed) + " ";
            }
            
            traceP.forEach((p, i) => {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', p.x);
                circle.setAttribute('cy', p.y);
                circle.setAttribute('r', 5 * vScale);
                circle.setAttribute('fill', i === 0 && closed ? '#f39c12' : '#27ae60');
                circle.setAttribute('stroke', 'white');
                circle.setAttribute('stroke-width', 2 * vScale);
                circle.setAttribute('class', 'control-point');
                pointsGroup.appendChild(circle);

                // Draw handles in edit mode
                if (mode === 'edit') {
                    let handles = getHandles(traceP, i, curveTension, closed);
                    if (!(!closed && i === traceP.length - 1)) {
                        // Out Handle
                        const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        l1.setAttribute('x1', p.x); l1.setAttribute('y1', p.y);
                        l1.setAttribute('x2', handles.hOut.absX); l1.setAttribute('y2', handles.hOut.absY);
                        l1.setAttribute('stroke', '#8e44ad'); l1.setAttribute('stroke-width', 2 * vScale);
                        pointsGroup.appendChild(l1);
                        
                        const h1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                        h1.setAttribute('x', handles.hOut.absX - 4*vScale); h1.setAttribute('y', handles.hOut.absY - 4*vScale);
                        h1.setAttribute('width', 8*vScale); h1.setAttribute('height', 8*vScale);
                        h1.setAttribute('fill', '#9b59b6');
                        pointsGroup.appendChild(h1);
                    }
                    if (!(!closed && i === 0)) {
                        // In Handle
                        const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        l2.setAttribute('x1', p.x); l2.setAttribute('y1', p.y);
                        l2.setAttribute('x2', handles.hIn.absX); l2.setAttribute('y2', handles.hIn.absY);
                        l2.setAttribute('stroke', '#2980b9'); l2.setAttribute('stroke-width', 2 * vScale);
                        pointsGroup.appendChild(l2);
                        
                        const h2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                        h2.setAttribute('x', handles.hIn.absX - 4*vScale); h2.setAttribute('y', handles.hIn.absY - 4*vScale);
                        h2.setAttribute('width', 8*vScale); h2.setAttribute('height', 8*vScale);
                        h2.setAttribute('fill', '#3498db');
                        pointsGroup.appendChild(h2);
                    }
                }
            });

            if (!closed && traceP.length > 2 && t === activeTrace && mode === 'trace') {
                const firstPoint = traceP[0];
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

            if (closed) {
                const fillPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                fillPath.setAttribute('class', 'fill-path');
                fillPath.setAttribute('d', generateBezierPath(traceP, true));
                fillPath.setAttribute('fill', 'rgba(46, 204, 113, 0.15)');
                fillPath.setAttribute('stroke', 'none');
                tracePathElement.parentNode.insertBefore(fillPath, tracePathElement);
            }
        }
        
        tracePathElement.setAttribute('stroke-width', 3 * vScale);
        tracePathElement.setAttribute('d', pathStr.trim());
        
        // Draw Finger Holes
        const pxMm = pixelsPerMm || 1;
        fingerHoles.forEach(f => {
            const h = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            h.setAttribute('cx', f.x);
            h.setAttribute('cy', f.y);
            h.setAttribute('r', f.r * pxMm);
            h.setAttribute('fill', 'rgba(231, 76, 60, 0.4)');
            h.setAttribute('stroke', '#e74c3c');
            h.setAttribute('stroke-width', 2 * vScale);
            pointsGroup.appendChild(h);
        });
    }
}
\nfunction generateBezierPath"""

js = js.replace(old_mm, new_mm)

with open("app.js", "w") as f:
    f.write(js)
