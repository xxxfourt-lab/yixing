export const getTerrainAt = (x: number, y: number): 'normal' | 'desert' | 'cave' | 'forest' => {
  const dist = Math.sqrt(x * x + y * y);
  const angle = Math.atan2(y, x);
  
  const noiseDist = Math.sin(x * 0.0005) * Math.cos(y * 0.0005) * 1000 + Math.sin(x * 0.001 + y * 0.002) * 500;
  const noiseAngle = Math.sin(x * 0.001) * Math.cos(y * 0.001) * 0.5;
  
  const effectiveDist = dist + noiseDist;
  const effectiveAngle = angle + noiseAngle;
  
  if (effectiveDist < 3500) {
    return 'normal';
  }
  
  let normAngle = effectiveAngle % (Math.PI * 2);
  if (normAngle < 0) normAngle += Math.PI * 2;
  
  if (normAngle < Math.PI * 2 / 3) {
    return 'desert';
  } else if (normAngle < Math.PI * 4 / 3) {
    return 'forest';
  } else {
    return 'cave';
  }
};

/**
 * Returns height at given coordinates.
 * 0: low ground
 * 1: high ground (plateau)
 */
export const getHeightAt = (x: number, y: number): number => {
  // Use a lower frequency noise to create larger plateaus
  const noise = Math.sin(x * 0.0008) * Math.cos(y * 0.0008) + 
                Math.sin(x * 0.0015 + y * 0.001) * 0.5;
  
  // Threshold to create distinct plateaus
  return noise > 0.4 ? 1 : 0;
};
