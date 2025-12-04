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
  const points: Point[] = [];
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
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
         x = interpolate(50, width - 50, t);
         y = cy + Math.sin(t * Math.PI * 8) * (scale * 0.6);
         break;

      case 'complex':
        const k = 4;
        const angleX = t * Math.PI * 2 * k;
        const rX = scale * Math.cos(k * angleX) * (1 - t * 0.5) + (scale * 0.5);
        x = cx + rX * Math.cos(t * Math.PI * 4);
        y = cy + rX * Math.sin(t * Math.PI * 4);
        break;

      default:
        x = cx + Math.cos(t * Math.PI * 2) * scale;
        y = cy + Math.sin(t * Math.PI * 2) * scale;
    }
    points.push({ x, y });
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
  // We aim for roughly the same number of points to keep resolution high
  const uniformPoints: Point[] = [rawPoints[0]];
  const targetStep = totalLength / steps;
  
  let currentDist = 0;
  let nextTarget = targetStep;
  let segmentIdx = 0;
  let segmentCovered = 0; // Distance covered within the current segment

  // Iterate to find points at exact intervals
  while (segmentIdx < segmentLengths.length && uniformPoints.length < steps + 1) {
    const segLen = segmentLengths[segmentIdx];
    
    // While the next target distance is within the current segment
    while (segmentCovered + segLen >= nextTarget - currentDist) {
        // How far into this segment is the target?
        const remainingToTarget = nextTarget - currentDist;
        const ratio = (remainingToTarget - segmentCovered) / segLen; // This needs to be relative to segment start
        
        // Correct math:
        // Absolute distance of target is `nextTarget`
        // Absolute distance of segment start is `currentDist + segmentCovered`
        // Distance into segment = `nextTarget - (currentDist + segmentCovered)`
        const distIntoSegment = nextTarget - (currentDist + segmentCovered);
        const t = Math.max(0, Math.min(1, distIntoSegment / segLen));

        const p1 = rawPoints[segmentIdx];
        const p2 = rawPoints[segmentIdx + 1];
        
        uniformPoints.push({
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
        });
        
        nextTarget += targetStep;
        
        if (nextTarget > totalLength) break;
    }

    currentDist += segLen; // Move base cursor to end of this segment (approx) - actually we track absolute
    // To be precise:
    // We processed segment `segmentIdx`.
    // We update our tracking.
    // Instead of complex tracking, let's simplify logic:
    
    segmentIdx++;
    segmentCovered = 0; // Reset for next segment? No, we need absolute tracking.
  }
  
  // Re-implementation of simpler resampling loop for robustness:
  const refinedPoints: Point[] = [rawPoints[0]];
  let accumulatedDist = 0;
  let targetD = targetStep;
  
  for (let i = 0; i < segmentLengths.length; i++) {
      const len = segmentLengths[i];
      // While we have targets within this segment
      while (targetD <= accumulatedDist + len) {
          const t = (targetD - accumulatedDist) / len;
          const p1 = rawPoints[i];
          const p2 = rawPoints[i+1];
          refinedPoints.push({
              x: p1.x + (p2.x - p1.x) * t,
              y: p1.y + (p2.y - p1.y) * t
          });
          targetD += targetStep;
      }
      accumulatedDist += len;
  }
  
  // Ensure last point is included
  refinedPoints.push(rawPoints[rawPoints.length - 1]);

  return refinedPoints;
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