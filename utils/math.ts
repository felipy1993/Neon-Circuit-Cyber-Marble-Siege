import { Point, GeneratedLevelData, Obstacle, Tunnel } from '../types';

export const getDistance = (p1: Point, p2: Point) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const interpolate = (start: number, end: number, factor: number) => {
  return start + (end - start) * factor;
};

// Internal function to get raw parametric points and metadata
const getRawLevelData = (type: string, width: number, height: number, steps: number): GeneratedLevelData => {
  const isPortrait = height > width;
  
  // Basic dimensions
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const scale = minDim * 0.42;

  const points: Point[] = [];
  const obstacles: Obstacle[] = [];
  const tunnels: Tunnel[] = [];

  // Helper for obstacles
  const addBlock = (x: number, y: number, w: number, h: number, rot: number = 0) => {
      obstacles.push({ id: Math.random().toString(), x, y, width: w, height: h, rotation: rot });
  };

  if (type === 'teleport-vertical') {
      // 1. Top Loop
      const loop1Steps = Math.floor(steps * 0.45);
      const topCy = height * 0.25;
      const r = minDim * 0.35;
      
      for(let i=0; i<loop1Steps; i++) {
          const t = i / loop1Steps;
          const angle = Math.PI - (t * Math.PI * 2); // Semi circle arc
          points.push({
              x: cx + Math.cos(angle) * r,
              y: topCy + Math.sin(angle) * r * 0.6
          });
      }

      // 2. Tunnel Segment (Straight line down)
      // This part will be marked as a tunnel
      const tunnelStartIdx = points.length;
      const tunnelSteps = Math.floor(steps * 0.1);
      const bottomCy = height * 0.75;
      
      const pStart = points[points.length-1];
      const pEnd = { x: cx - r, y: bottomCy }; // Start of bottom loop

      for(let i=0; i<tunnelSteps; i++) {
          const t = i / tunnelSteps;
          points.push({
              x: interpolate(pStart.x, pEnd.x, t),
              y: interpolate(pStart.y, pEnd.y, t)
          });
      }
      
      const tunnelEndIdx = points.length;
      tunnels.push({ startIdx: tunnelStartIdx, endIdx: tunnelEndIdx, color: '#00f0ff' });

      // 3. Bottom Loop
      const loop2Steps = Math.floor(steps * 0.45);
      for(let i=0; i<loop2Steps; i++) {
           const t = i / loop2Steps;
           const angle = Math.PI + (t * Math.PI * 2);
           points.push({
               x: cx + Math.cos(angle) * r,
               y: bottomCy + Math.sin(angle) * r * 0.6
           });
      }

      // Add central obstacle between loops
      addBlock(cx, cy, width * 0.6, 20);

  } else if (type === 'bunker-zigzag') {
      const pad = isPortrait ? 50 : 100;
      const safeWidth = width - pad * 2;
      const zigSteps = 5;
      const stepY = (height - 200) / zigSteps;
      const startY = 100;

      for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const tScaled = t * zigSteps;
          const zigIndex = Math.floor(tScaled);
          const tLocal = tScaled - zigIndex; // 0 to 1 inside segment

          const dir = zigIndex % 2 === 0 ? 1 : -1; // Right or Left
          const xStart = dir === 1 ? pad : width - pad;
          const xEnd = dir === 1 ? width - pad : pad;
          
          // Smoother sine transition for zigzag
          const smoothT = (1 - Math.cos(tLocal * Math.PI)) / 2;
          
          const x = interpolate(xStart, xEnd, smoothT);
          const y = startY + (zigIndex * stepY) + (tLocal * stepY);
          
          points.push({ x, y });
      }

      // Add "Bunker" obstacles in the middle of the zigzags
      for(let i=1; i<zigSteps; i+=2) {
           const yPos = startY + (i * stepY) + (stepY/2);
           addBlock(cx, yPos, width * 0.2, 40, 0);
      }
  } 
  else {
      // Standard shapes from previous logic
      // Note: We need to adapt the old logic to push to 'points' array
      
      // AUTO-ROTATION LOGIC FOR MOBILE PORTRAIT MODE (Legacy shapes)
      const shouldRotate = isPortrait && type !== 'hourglass';
      const genWidth = shouldRotate ? height : width;
      const genHeight = shouldRotate ? width : height;
      const lCx = genWidth / 2;
      const lCy = genHeight / 2;
      const lMinDim = Math.min(genWidth, genHeight);
      let lScale = lMinDim * 0.42;

      if (isPortrait) {
          lScale = lMinDim * 0.42; 
          if (type === 'infinity') lScale *= 1.7; 
          if (type === 'bow') lScale *= 1.6;
          if (type === 'sine') lScale *= 1.6;
          if (type === 'spiral') lScale *= 1.15;
      }
      
      const edgePadding = isPortrait ? 120 : 60;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let x = 0;
        let y = 0;

        switch (type) {
          case 'circle':
            const angleC = t * Math.PI * 4; 
            const rC = lScale * (1 - t * 0.8);
            x = lCx + Math.cos(angleC) * rC;
            y = lCy + Math.sin(angleC) * rC;
            break;

          case 'infinity':
            const t8 = t * Math.PI * 2;
            x = lCx + (lScale * 1.2) * Math.sin(t8);
            y = lCy + lScale * Math.sin(t8) * Math.cos(t8);
            break;
          
          case 'spiral':
            const angleS = t * Math.PI * 5; 
            const rS = lScale * (1.1 - t);
            x = lCx + Math.cos(angleS) * rS;
            y = lCy + Math.sin(angleS) * rS;
            break;
            
          case 'sine':
             x = interpolate(edgePadding, genWidth - edgePadding, t);
             y = lCy + Math.sin(t * Math.PI * 6) * (lScale * 0.6);
             break;

          case 'hourglass':
            const tH = t * Math.PI * 2;
            const rH = lScale * (1.0 - t * 0.1); 
            x = lCx + (rH * 1.0) * Math.sin(tH) * Math.cos(tH); 
            y = lCy + (rH * 1.2) * Math.sin(tH);
            break;

          case 'super-ellipse':
            const angleSE = t * Math.PI * 2;
            const n = 4; 
            const rSEBase = lScale * (1.0 - t * 0.4);
            const cosT = Math.cos(angleSE);
            const sinT = Math.sin(angleSE);
            const den = Math.pow(Math.abs(cosT), n) + Math.pow(Math.abs(sinT), n);
            const rSE = rSEBase / Math.pow(den, 1/n);
            x = lCx + cosT * rSE;
            y = lCy + sinT * rSE;
            break;
            
          case 'heart':
            const tHeart = t * Math.PI * 2;
            const rHeart = lScale * (0.9 - t * 0.2);
            x = lCx + rHeart * (16 * Math.pow(Math.sin(tHeart), 3)) / 16;
            y = lCy - rHeart * (13 * Math.cos(tHeart) - 5 * Math.cos(2*tHeart) - 2 * Math.cos(3*tHeart) - Math.cos(4*tHeart)) / 16;
            break;

          case 'clover-4':
            const angleCl = t * Math.PI * 2;
            const rClBase = lScale * (1.0 - t * 0.2);
            const rCl = rClBase * (0.6 + 0.4 * Math.cos(2 * angleCl));
            x = lCx + Math.cos(angleCl) * rCl;
            y = lCy + Math.sin(angleCl) * rCl;
            break;

          case 'bow':
            const tBow = t * Math.PI * 2;
            const rBow = lScale * (1.1 - t * 0.2);
            x = lCx + rBow * Math.sin(tBow);
            y = lCy + rBow * Math.sin(tBow) * Math.cos(tBow);
            break;

          default:
            x = lCx + Math.cos(t * Math.PI * 2) * lScale;
            y = lCy + Math.sin(t * Math.PI * 2) * lScale;
        }

        if (shouldRotate) {
             points.push({ x: y, y: x });
        } else {
             points.push({ x, y });
        }
      }
  }

  return { path: points, obstacles, tunnels };
};

// Generates path points and re-samples them to be equidistant for constant speed
export const generatePathPoints = (type: string, width: number, height: number, steps: number = 2000): GeneratedLevelData => {
  // 1. Get raw data
  const { path: rawPoints, obstacles, tunnels } = getRawLevelData(type, width, height, steps);
  
  // 2. Resample logic (Simplified for consistent speed)
  // We need to resample the points to ensure constant speed, 
  // BUT we must preserve the relative positions of tunnels.
  // This is complex. For now, we will resample the entire path and map the tunnel indices proportionally.
  
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 1; i < rawPoints.length; i++) {
    const dist = getDistance(rawPoints[i-1], rawPoints[i]);
    segmentLengths.push(dist);
    totalLength += dist;
  }

  const uniformPoints: Point[] = [rawPoints[0]];
  const targetStep = totalLength / steps;
  let accumulatedDist = 0;
  let targetD = targetStep;
  
  // Mapping old indices to new indices logic would be needed for perfect tunnel alignment
  // Approximation: Since steps in raw roughly match steps in output (2000), 
  // we can treat indices as percentage of path.
  
  for (let i = 0; i < segmentLengths.length; i++) {
      const len = segmentLengths[i];
      while (targetD <= accumulatedDist + len) {
          const t = (targetD - accumulatedDist) / len;
          const p1 = rawPoints[i];
          const p2 = rawPoints[i+1];
          uniformPoints.push({
              x: p1.x + (p2.x - p1.x) * t,
              y: p1.y + (p2.y - p1.y) * t
          });
          targetD += targetStep;
      }
      accumulatedDist += len;
  }
  
  uniformPoints.push(rawPoints[rawPoints.length - 1]);

  // Remap tunnels based on percentage of completion
  // Original Tunnel Start Index / Original Length -> New Start Index
  const adjustedTunnels = tunnels.map(t => ({
      ...t,
      startIdx: Math.floor((t.startIdx / rawPoints.length) * uniformPoints.length),
      endIdx: Math.floor((t.endIdx / rawPoints.length) * uniformPoints.length)
  }));

  return { path: uniformPoints, obstacles, tunnels: adjustedTunnels };
};

export const getPathLength = (points: Point[]): number => {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += getDistance(points[i - 1], points[i]);
  }
  return len;
};

export const getPointAtDistance = (distance: number, points: Point[], totalLength: number): Point => {
  if (distance <= 0) return points[0];
  if (distance >= totalLength) return points[points.length - 1];

  const idx = Math.floor((distance / totalLength) * (points.length - 1));
  const safeIdx = Math.max(0, Math.min(idx, points.length - 2));
  
  const p1 = points[safeIdx];
  const p2 = points[safeIdx + 1];
  
  const segmentLen = totalLength / (points.length - 1);
  const distAtP1 = safeIdx * segmentLen;
  const ratio = (distance - distAtP1) / segmentLen;
  
  return {
    x: p1.x + (p2.x - p1.x) * ratio,
    y: p1.y + (p2.y - p1.y) * ratio
  };
};