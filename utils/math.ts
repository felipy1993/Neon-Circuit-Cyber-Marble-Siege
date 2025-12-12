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
  // Exception: 'hourglass' (vertical) is natively vertical/tall friendly.
  
  const shouldRotate = isPortrait && type !== 'hourglass';

  const genWidth = shouldRotate ? height : width;
  const genHeight = shouldRotate ? width : height;

  const points: Point[] = [];
  const cx = genWidth / 2;
  const cy = genHeight / 2;
  const minDim = Math.min(genWidth, genHeight);
  
  // Base scale reduced to ensure fit on all screens
  let scale = minDim * 0.42;

  // Mobile specific boosts - Adjusted to prevent clipping
  if (isPortrait) {
      scale = minDim * 0.42; 
      
      // Multipliers reduced to ensure horizontal fit (which corresponds to generated Y)
      if (type === 'infinity') scale *= 1.7; 
      if (type === 'bow') scale *= 1.6;
      if (type === 'sine') scale *= 1.6;
      if (type === 'spiral') scale *= 1.15;
      // Hourglass is limited by width, so we can't boost it much without clipping
  }

  // Increased padding to avoid UI overlaps (Notch, Bottom Bar)
  const edgePadding = isPortrait ? 120 : 60;

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
        // Simplified spiral with fewer windings for mobile clarity
        const angleS = t * Math.PI * 5; // Reduced from 6 to 5
        const rS = scale * (1.1 - t);
        x = cx + Math.cos(angleS) * rS;
        y = cy + Math.sin(angleS) * rS;
        break;
        
      case 'sine':
         // Smoother sine wave (lower frequency)
         x = interpolate(edgePadding, genWidth - edgePadding, t);
         // Reduced frequency from 8 to 6 for wider curves
         y = cy + Math.sin(t * Math.PI * 6) * (scale * 0.6);
         break;

      case 'hourglass':
        // Vertical Figure-8 (Lissajous) - Natively Vertical
        const tH = t * Math.PI * 2;
        const rH = scale * (1.0 - t * 0.1); 
        x = cx + (rH * 1.0) * Math.sin(tH) * Math.cos(tH); 
        y = cy + (rH * 1.2) * Math.sin(tH);
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
        
      case 'heart':
        // Parametric Heart
        const tHeart = t * Math.PI * 2;
        const rHeart = scale * (0.9 - t * 0.2);
        // Standard heart equation modified for canvas coord
        x = cx + rHeart * (16 * Math.pow(Math.sin(tHeart), 3)) / 16;
        y = cy - rHeart * (13 * Math.cos(tHeart) - 5 * Math.cos(2*tHeart) - 2 * Math.cos(3*tHeart) - Math.cos(4*tHeart)) / 16;
        break;

      case 'clover-4':
        // 4-Leaf Clover (Polar Rose k=2)
        const angleCl = t * Math.PI * 2;
        const rClBase = scale * (1.0 - t * 0.2);
        const rCl = rClBase * (0.6 + 0.4 * Math.cos(2 * angleCl));
        x = cx + Math.cos(angleCl) * rCl;
        y = cy + Math.sin(angleCl) * rCl;
        break;

      case 'bow':
        // Bowtie / Lemniscate of Gerono
        const tBow = t * Math.PI * 2;
        const rBow = scale * (1.1 - t * 0.2);
        x = cx + rBow * Math.sin(tBow);
        y = cy + rBow * Math.sin(tBow) * Math.cos(tBow);
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