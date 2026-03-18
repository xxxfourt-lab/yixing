import { Entity } from '../types/game';
import { getTerrainAt } from './terrain';

export const mulberry32 = (a: number) => {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
};

export const generateInitialEntities = (): Entity[] => {
  const entities: Entity[] = [];
  
  // Add Large Irregular Lakes (Clusters of pools)
  for (let i = 0; i < 15; i++) {
    const lakeCenterX = (Math.random() - 0.5) * 5000;
    const lakeCenterY = (Math.random() - 0.5) * 5000;
    
    // Ensure lakes don't spawn near (0,0) where the pod lands
    const distToCenter = Math.sqrt(lakeCenterX * lakeCenterX + lakeCenterY * lakeCenterY);
    if (distToCenter < 500) continue; 
    
    const t = getTerrainAt(lakeCenterX, lakeCenterY);
    if (t === 'cave') continue; // No lakes in caves

    const clusterSize = 5 + Math.floor(Math.random() * 8);
    const clusterId = `lake-${i}`;
    
    // Create the lake shape with more blobs for irregularity
    for (let j = 0; j < clusterSize; j++) {
      const offsetX = (Math.random() - 0.5) * 300;
      const offsetY = (Math.random() - 0.5) * 300;
      entities.push({
        id: `${clusterId}-${j}`,
        type: 'pool',
        clusterId,
        x: lakeCenterX + offsetX,
        y: lakeCenterY + offsetY,
        width: 180 + Math.random() * 350,
        height: 120 + Math.random() * 250,
        rotation: Math.random() * Math.PI * 2
      });
    }

    // Add an Island in the middle of some lakes
    if (Math.random() > 0.3) {
      const islandX = lakeCenterX;
      const islandY = lakeCenterY;
      entities.push({
        id: `island-${i}`,
        type: 'island',
        x: islandX,
        y: islandY,
        width: 100 + Math.random() * 120,
        height: 80 + Math.random() * 100,
        rotation: Math.random() * Math.PI * 2
      });

      // Add resources on the island
      const resCount = 3 + Math.floor(Math.random() * 4);
      for (let k = 0; k < resCount; k++) {
        const type = ['food', 'energy', 'mineral', 'chest'][Math.floor(Math.random() * 4)] as any;
        entities.push({
          id: `island-res-${i}-${k}`,
          type,
          x: islandX + (Math.random() - 0.5) * 60,
          y: islandY + (Math.random() - 0.5) * 60,
          health: type === 'monster' ? 100 : undefined,
          isOpened: false
        });
      }
    }
  }

  // Add Mines (Repurposed Rocks)
  for (let i = 0; i < 120; i++) {
    const x = (Math.random() - 0.5) * 6000;
    const y = (Math.random() - 0.5) * 6000;
    const scale = 0.6 + Math.random() * 2.5;
    entities.push({
      id: 'mine-' + Math.random().toString(36).substr(2, 9),
      type: 'rock',
      x,
      y,
      scale,
      rotation: 0,
      health: 100,
      maxHealth: 100,
      amount: 50 + Math.floor(Math.random() * 51) // 50-100 minerals
    });
  }

  // Add Crystals (Background)
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * 6000;
    const y = (Math.random() - 0.5) * 6000;
    entities.push({
      id: 'crystal-' + Math.random().toString(36).substr(2, 9),
      type: 'crystal',
      x,
      y,
      scale: 0.5 + Math.random() * 1.2
    });
  }
  
  // Add Vegetation (Background)
  for (let i = 0; i < 150; i++) {
    const x = (Math.random() - 0.5) * 6000;
    const y = (Math.random() - 0.5) * 6000;
    const t = getTerrainAt(x, y);
    
    let vType = Math.floor(Math.random() * 3);
    let scale = 0.5 + Math.random() * 1.5;
    
    if (t === 'forest') {
      vType = 3 + Math.floor(Math.random() * 3);
      scale = 1.5 + Math.random() * 2;
    } else if (t === 'desert') {
      vType = 6 + Math.floor(Math.random() * 2);
      scale = 1 + Math.random() * 1.5;
    } else if (t === 'cave') {
      continue; // No vegetation in caves
    }
    
    entities.push({
      id: 'veg-' + Math.random().toString(36).substr(2, 9),
      type: 'vegetation',
      x,
      y,
      vegetationType: vType,
      scale
    });
  }
  
  // Add Stalactites
  for (let i = 0; i < 50; i++) {
    const x = (Math.random() - 0.5) * 6000;
    const y = (Math.random() - 0.5) * 6000;
    const t = getTerrainAt(x, y);
    if (t === 'cave') {
      entities.push({
        id: 'stalactite-' + Math.random().toString(36).substr(2, 9),
        type: 'stalactite',
        x,
        y,
        scale: 1 + Math.random() * 1.5,
        rotation: Math.random() * Math.PI * 2
      });
    }
  }

  // Add Interactive Entities (Mainland)
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * 4000;
    const y = (Math.random() - 0.5) * 4000;
    const type = ['food', 'energy', 'mineral', 'monster', 'chest'][Math.floor(Math.random() * 5)] as any;
    entities.push({
      id: Math.random().toString(36).substr(2, 9),
      type,
      x,
      y,
      health: type === 'monster' ? 100 : undefined,
      isOpened: false
    });
  }

  return entities;
};
