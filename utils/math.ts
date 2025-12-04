import { Point } from '../types';

export const getDistance = (p1: Point, p2: Point) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const interpolate = (start: number, end: number, factor: number) => {
  return start + (end - start) * factor;
};

// Internal function to get raw parametric points
const getRawPathPoints = (type: string, width: number, height: number, steps: number): Point[] => {
  // AUTO-ROTATION LOGIC FOR MOBILE PORTRAIT MODE
  const isPortrait = height > width;

  // Most maps are designed horizontally (Landscape).
  // If the device is in Portrait mode, we generate the map in a "Virtual Landscape" space
  // (swapping width and height) and then swap X/Y coordinates at the end.
  // Exception: 'hourglass' is natively vertical, so we don't rotate it.
  const shouldRotate = isPortrait && type !== 'hourglass';

  const genWidth = shouldRotate ? height : width;
  const genHeight = shouldRotate ? width : height;

  const points: Point[] = [];
  const cx = genWidth / 2;
  const cy = genHeight / 2;
  const minDim = Math.min(genWidth, genHeight);
  const scale = minDim * 0.4;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x = 0;
    let y = 0;

    switch (type) {
      case 'circle':
        const angleC = t * Math.PI * 4; 
        const rC = scale * (1 - t * 0.8);
        x = cx + Math.cos(angleC) * rC;
        y = cy + Math.sin(angleC) * rC;
        break;

      case 'infinity':
        const t8 = t * Math.PI * 2;
        x = cx + (scale * 1.2) * Math.sin(t8);
        y = cy + scale * Math.sin(t8) * Math.cos(t8);
        break;
      
      case 'spiral':
        const angleS = t * Math.PI * 6;
        const rS = scale * (1.1 - t);
        x = cx + Math.cos(angleS) * rS;
        y = cy + Math.sin(angleS) * rS;
        break;
        
      case 'sine':
         // Use genWidth to ensure full length usage
         x = interpolate(50, genWidth - 50, t);
         y = cy + Math.sin(t * Math.PI * 8) * (scale * 0.6);
         break;

      case 'complex':
        // Modified 'complex' type: "Cyber-Clover Spiral"
        const angleCpx = t * Math.PI * 2;
        const shapeMod = 0.4 * Math.pow(Math.sin(2 * angleCpx), 2);
        const spiralFactor = 1.15 - (t * 0.55);
        const rCpx = scale * (0.8 + shapeMod) * spiralFactor;
        x = cx + Math.cos(angleCpx) * rCpx;
        y = cy + Math.sin(angleCpx) * rCpx;
        break;
        
      case 'star':
        // 5-Pointed Star Pattern
        const angleStar = t * Math.PI * 2;
        const lobes = 5;
        const rBaseStar = scale * (1.0 - t * 0.3); // Slight spiral in
        const rStar = rBaseStar * (0.6 + 0.4 * Math.cos(lobes * angleStar));
        // Rotate -PI/2 to make top point upwards
        x = cx + Math.cos(angleStar - Math.PI/2) * rStar;
        y = cy + Math.sin(angleStar - Math.PI/2) * rStar;
        break;

      case 'diamond':
        // Astroid Shape (Concave Diamond)
        const angleD = t * Math.PI * 2;
        const rD = scale * (1.0 - t * 0.2);
        x = cx + rD * Math.pow(Math.cos(angleD), 3);
        y = cy + rD * Math.pow(Math.sin(angleD), 3);
        break;

      case 'hourglass':
        // Vertical Figure-8 (Lissajous) - Natively Vertical
        const tH = t * Math.PI * 2;
        const rH = scale * (1.0 - t * 0.1); 
        x = cx + (rH * 1.0) * Math.sin(tH) * Math.cos(tH); 
        y = cy + (rH * 1.2) * Math.sin(tH);
        break;

      case 'gear':
        // Mechanical Gear shape
        const angleG = t * Math.PI * 2;
        const teeth = 8;
        const rGearBase = scale * (1.0 - t * 0.6); 
        const rGear = rGearBase * (0.85 + 0.15 * Math.sin(teeth * angleG));
        x = cx + Math.cos(angleG) * rGear;
        y = cy + Math.sin(angleG) * rGear;
        break;

      case 'super-ellipse':
        // Rounded Square (Squircle)
        const angleSE = t * Math.PI * 2;
        const n = 4; 
        const rSEBase = scale * (1.0 - t * 0.4);
        
        const cosT = Math.cos(angleSE);
        const sinT = Math.sin(angleSE);
        
        const den = Math.pow(Math.abs(cosT), n) + Math.pow(Math.abs(sinT), n);
        const rSE = rSEBase / Math.pow(den, 1/n);
        
        x = cx + cosT * rSE;
        y = cy + sinT * rSE;
        break;

      default:
        x = cx + Math.cos(t * Math.PI * 2) * scale;
        y = cy + Math.sin(t * Math.PI * 2) * scale;
    }
    points.push({ x, y });
  }

  // If we generated in virtual landscape for portrait mode, rotate points 90 degrees
  if (shouldRotate) {
      return points.map(p => ({
          x: p.y,           // Short dimension becomes X (Width)
          y: p.x            // Long dimension becomes Y (Height)
      }));
  }

  return points;
};

// Generates path points and re-samples them to be equidistant for constant speed
export const generatePathPoints = (type: string, width: number, height: number, steps: number = 2000): Point[] => {
  // 1. Get high resolution raw points
  const rawPoints = getRawPathPoints(type, width, height, steps);
  
  // 2. Calculate total length and segment lengths
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 1; i < rawPoints.length; i++) {
    const dist = getDistance(rawPoints[i-1], rawPoints[i]);
    segmentLengths.push(dist);
    totalLength += dist;
  }

  // 3. Resample to ensure points are evenly spaced
  const uniformPoints: Point[] = [rawPoints[0]];
  const targetStep = totalLength / steps;
  
  let accumulatedDist = 0;
  let targetD = targetStep;
  
  for (let i = 0; i < segmentLengths.length; i++) {
      const len = segmentLengths[i];
      // While we have targets within this segment
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
  
  // Ensure last point is included
  uniformPoints.push(rawPoints[rawPoints.length - 1]);

  return uniformPoints;
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

  // Since points are now equidistant (mostly), we can map index directly
  const idx = Math.floor((distance / totalLength) * (points.length - 1));
  const safeIdx = Math.max(0, Math.min(idx, points.length - 2));
  
  const p1 = points[safeIdx];
  const p2 = points[safeIdx + 1];
  
  // Calculate local ratio within the segment
  // Segment length is roughly totalLength / (points.length - 1)
  const segmentLen = totalLength / (points.length - 1);
  const distAtP1 = safeIdx * segmentLen;
  const ratio = (distance - distAtP1) / segmentLen;
  
  return {
    x: p1.x + (p2.x - p1.x) * ratio,
    y: p1.y + (p2.y - p1.y) * ratio
  };
};