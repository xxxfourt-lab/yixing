import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { GameState, Entity } from '../types/game';
import { cn } from '../utils/cn';
import { audioManager } from '../utils/audio';
import { getTerrainAt, getHeightAt } from '../utils/terrain';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  isProcessing: boolean;
}

export const GameCanvas = ({ 
  gameState, 
  setGameState, 
  isProcessing 
}: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Set<string>>(new Set());
  const landingProgress = useRef(0);
  const playerOutProgress = useRef(0);
  const lastTime = useRef(0);
  const shootTimer = useRef(0);
  const spawnTimer = useRef(0);
  const exploredChunks = useRef<Set<string>>(new Set(['-3,-3', '-3,-2', '-3,-1', '-3,0', '-3,1', '-3,2', '-3,3', '-2,-3', '-2,-2', '-2,-1', '-2,0', '-2,1', '-2,2', '-2,3', '-1,-3', '-1,-2', '-1,-1', '-1,0', '-1,1', '-1,2', '-1,3', '0,-3', '0,-2', '0,-1', '0,0', '0,1', '0,2', '0,3', '1,-3', '1,-2', '1,-1', '1,0', '1,1', '1,2', '1,3', '2,-3', '2,-2', '2,-1', '2,0', '2,1', '2,2', '2,3', '3,-3', '3,-2', '3,-1', '3,0', '3,1', '3,2', '3,3']));
  const lastPlayerPos = useRef({ x: 0, y: 0 });
  const travelDistance = useRef(0);
  const gameStateRef = useRef(gameState);
  const isProcessingRef = useRef(isProcessing);
  const sandwormTimer = useRef(0);
  const sandwormWarning = useRef<{x: number, y: number, time: number} | null>(null);
  const buildHoldTimer = useRef(0);
  const teleportHoldTimer = useRef(0);
  const warningTimers = useRef({ oxygen: 0, food: 0, energy: 0, fuel: 0 });
  const zoom = useRef(1);
  const targetZoom = useRef(1);
  const BUILD_HOLD_DURATION = 1000; // 1 second hold to build
  const TELEPORT_HOLD_DURATION = 1000; // 1 second hold to teleport

  const generateChunk = (cx: number, cy: number) => {
    const chunkKey = `${cx},${cy}`;
    if (exploredChunks.current.has(chunkKey)) return [];
    exploredChunks.current.add(chunkKey);

    const startX = cx * 1000;
    const startY = cy * 1000;
    const terrainType = getTerrainAt(startX + 500, startY + 500);

    const entities: Entity[] = [];

    // Don't spawn too close to the pod (0,0)
    if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) return [];

    // Generate a fixed number of potential spawn points per chunk
    // and decide what to spawn based on the exact terrain at that point.
    
    // Rocks (Minerals)
    for (let i = 0; i < 12; i++) {
      const ex = startX + Math.random() * 1000;
      const ey = startY + Math.random() * 1000;
      const t = getTerrainAt(ex, ey);
      
      // Caves have more rocks
      if (t === 'cave' || Math.random() < 0.4) {
        entities.push({
          id: `rock-${chunkKey}-${i}`,
          type: 'rock',
          x: ex, y: ey,
          health: 100, amount: 50 + Math.floor(Math.random() * 50),
          scale: 0.8 + Math.random() * 0.4, rotation: Math.random() * Math.PI * 2
        });
      }
    }

    // Crystals (Energy)
    for (let i = 0; i < 4; i++) {
      const ex = startX + Math.random() * 1000;
      const ey = startY + Math.random() * 1000;
      const t = getTerrainAt(ex, ey);
      if ((t === 'cave' && Math.random() < 0.8) || Math.random() < 0.3) {
        entities.push({
          id: `crystal-${chunkKey}-${i}`,
          type: 'crystal',
          x: ex, y: ey,
          scale: 1 + Math.random() * 0.5
        });
      }
    }

    // Stalactites (Cave only)
    for (let i = 0; i < 15; i++) {
      const ex = startX + Math.random() * 1000;
      const ey = startY + Math.random() * 1000;
      const t = getTerrainAt(ex, ey);
      if (t === 'cave' && Math.random() < 0.7) {
        entities.push({
          id: `stalactite-${chunkKey}-${i}`,
          type: 'stalactite',
          x: ex, y: ey,
          scale: 1 + Math.random() * 1.5,
          rotation: Math.random() * Math.PI * 2
        });
      }
    }

    // Vegetation
    for (let i = 0; i < 25; i++) {
      const ex = startX + Math.random() * 1000;
      const ey = startY + Math.random() * 1000;
      const t = getTerrainAt(ex, ey);
      
      if (t === 'forest' && Math.random() < 0.9) {
        entities.push({
          id: `veg-${chunkKey}-${i}`,
          type: 'vegetation',
          x: ex, y: ey,
          vegetationType: 3 + Math.floor(Math.random() * 3), // 3,4,5 for alien trees
          scale: 1.5 + Math.random() * 2 // Large
        });
      } else if (t === 'desert' && Math.random() < 0.3) {
        entities.push({
          id: `veg-${chunkKey}-${i}`,
          type: 'vegetation',
          x: ex, y: ey,
          vegetationType: 6 + Math.floor(Math.random() * 2), // 6,7 for desert plants
          scale: 1 + Math.random() * 1.5
        });
      } else if (t === 'normal' && Math.random() < 0.4) {
        entities.push({
          id: `veg-${chunkKey}-${i}`,
          type: 'vegetation',
          x: ex, y: ey,
          vegetationType: Math.floor(Math.random() * 3), // 0,1,2 for normal grass
          scale: 0.5 + Math.random() * 1
        });
      }
    }

    // Pools/Lakes
    if (Math.random() < 0.2) {
      const ex = startX + Math.random() * 1000;
      const ey = startY + Math.random() * 1000;
      const t = getTerrainAt(ex, ey);
      if (t !== 'cave' && (t === 'forest' || Math.random() < 0.3)) {
        entities.push({
          id: `pool-${chunkKey}`,
          type: 'pool',
          x: ex, y: ey,
          width: 200 + Math.random() * 300,
          height: 150 + Math.random() * 200,
          rotation: Math.random() * Math.PI * 2
        });
      }
    }

    // Chests
    if (Math.random() > 0.6) {
      entities.push({
        id: `chest-${chunkKey}`,
        type: 'chest',
        x: startX + Math.random() * 1000,
        y: startY + Math.random() * 1000
      });
    }

    // Monsters
    let monsterCount = 1 + Math.floor(Math.random() * 2);
    if (terrainType === 'cave') monsterCount += 2;
    else if (terrainType === 'forest') monsterCount += 1;

    for (let i = 0; i < monsterCount; i++) {
      const ex = startX + Math.random() * 1000;
      const ey = startY + Math.random() * 1000;
      const t = getTerrainAt(ex, ey);
      
      let mType: any = 'normal';
      if (t === 'cave') mType = Math.random() > 0.5 ? 'evil-eye' : 'six-legged';
      else if (t === 'forest') mType = Math.random() > 0.5 ? 'swarm' : 'normal';
      else if (t === 'desert') mType = 'six-legged'; // sandworms spawn dynamically
      
      entities.push({
        id: `monster-${chunkKey}-${i}`,
        type: 'monster',
        monsterType: mType,
        x: ex,
        y: ey,
        health: mType === 'evil-eye' ? 200 : (mType === 'six-legged' ? 150 : 100),
        maxHealth: mType === 'evil-eye' ? 200 : (mType === 'six-legged' ? 150 : 100),
        attackCooldown: 0
      });
    }

    return entities;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const update = (deltaTime: number) => {
    if (gameStateRef.current.status === 'landing') {
      landingProgress.current += deltaTime * 0.001;
      if (landingProgress.current >= 1) {
        landingProgress.current = 1;
        playerOutProgress.current += deltaTime * 0.001;
        if (playerOutProgress.current >= 1) {
          playerOutProgress.current = 1;
          setGameState(prev => ({ ...prev, status: 'exploring' }));
        }
      }
      return;
    }

    if (gameStateRef.current.status !== 'exploring' || gameStateRef.current.isGameOver || isProcessingRef.current) return;

    // Smooth Zoom Update
    zoom.current += (targetZoom.current - zoom.current) * 0.1;

    const oxygenDepletionRate = 1 / (gameStateRef.current.upgrades.oxygenSystem * 0.5 + 0.5);
    const oxygenLoss = (deltaTime / 1000) * oxygenDepletionRate;
    const speedBase = 0.15 + (gameStateRef.current.upgrades.flightSystem * 0.02);
    const speed = keys.current.has('Space') && gameStateRef.current.resources.fuel > 0 ? speedBase * 2 : speedBase;
    const isBoosting = keys.current.has('Space') && gameStateRef.current.resources.fuel > 0;
    
    let dx = 0;
    let dy = 0;
    if (keys.current.has('KeyW')) dy -= 1;
    if (keys.current.has('KeyS')) dy += 1;
    if (keys.current.has('KeyA')) dx -= 1;
    if (keys.current.has('KeyD')) dx += 1;

    setGameState(prev => {
      // Day/Night Cycle
      let newTimeOfDay = prev.timeOfDay + deltaTime;
      let newDay = prev.day;
      if (newTimeOfDay >= 120000) {
        newTimeOfDay = 0;
        newDay++;
      }
      const isNight = newTimeOfDay >= 60000;
      
      let nightProgress = 0;
      if (newTimeOfDay >= 50000 && newTimeOfDay < 60000) {
        nightProgress = (newTimeOfDay - 50000) / 10000;
      } else if (newTimeOfDay >= 60000 && newTimeOfDay < 110000) {
        nightProgress = 1;
      } else if (newTimeOfDay >= 110000) {
        nightProgress = 1 - (newTimeOfDay - 110000) / 10000;
      } else {
        nightProgress = 0;
      }

      // Infinite Map Generation
      const currentChunkX = Math.floor(prev.playerPosition.x / 1000);
      const currentChunkY = Math.floor(prev.playerPosition.y / 1000);
      let newEntities = [...prev.entities];
      
      for (let x = -2; x <= 2; x++) {
        for (let y = -2; y <= 2; y++) {
          const chunkEntities = generateChunk(currentChunkX + x, currentChunkY + y);
          if (chunkEntities.length > 0) {
            newEntities.push(...chunkEntities);
          }
        }
      }

      // Ensure objects don't spawn on water, by adding islands under them
      const pools = newEntities.filter(e => e.type === 'pool');
      newEntities.forEach(e => {
        if (e.type !== 'pool' && e.type !== 'island' && e.type !== 'monster' && e.type !== 'dropped_item' && !e.id.startsWith('island-')) {
          for (const p of pools) {
            const dx = e.x - p.x;
            const dy = e.y - p.y;
            const cos = Math.cos(-(p.rotation || 0));
            const sin = Math.sin(-(p.rotation || 0));
            const rx = dx * cos - dy * sin;
            const ry = dx * sin + dy * cos;
            const a = (p.width || 100) / 2;
            const b = (p.height || 60) / 2;
            if ((rx * rx) / (a * a) + (ry * ry) / (b * b) <= 1) {
              // It's inside a pool, check if an island already exists
              const islandId = `island-${e.id}`;
              if (!newEntities.find(ent => ent.id === islandId)) {
                newEntities.push({
                  id: islandId,
                  type: 'island',
                  x: e.x,
                  y: e.y,
                  width: 60 + Math.random() * 40,
                  height: 40 + Math.random() * 30,
                  rotation: Math.random() * Math.PI * 2
                });
              }
              break;
            }
          }
        }
      });

      // Cleanup far entities (performance)
      if (newEntities.length > 300) {
        newEntities = newEntities.filter(e => {
          if (e.type === 'monster' && !e.isDead) return true; // Keep active monsters
          if (e.type === 'building' || e.type === 'mech-miner') return true; // Keep buildings and miners
          const d = Math.sqrt(Math.pow(prev.playerPosition.x - e.x, 2) + Math.pow(prev.playerPosition.y - e.y, 2));
          return d < 3000;
        });
      }

      // Cleanup far chunks so they can regenerate
      for (const chunkKey of exploredChunks.current) {
        const [cx, cy] = chunkKey.split(',').map(Number);
        if (Math.abs(cx - currentChunkX) > 3 || Math.abs(cy - currentChunkY) > 3) {
          exploredChunks.current.delete(chunkKey);
        }
      }

      // Monster Spawning
      spawnTimer.current += deltaTime;
      const scalingFactor = 1 + (newDay - 1) * 0.2; // Increase scaling
      
      // Determine spawn interval and count based on day/night and day number
      let spawnInterval = isNight ? Math.max(2000, 10000 - (newDay - 1) * 1000) : 15000;
      
      if (spawnTimer.current >= spawnInterval) {
        spawnTimer.current = 0;
        
        let numToSpawn = isNight ? (2 + Math.floor(Math.random() * 2) + (newDay - 1)) : 1;
        
        for (let i = 0; i < numToSpawn; i++) {
          const spawnDist = 900 + Math.random() * 200; // Outside viewport
          const spawnAngle = Math.random() * Math.PI * 2;
          const sx = prev.playerPosition.x + Math.cos(spawnAngle) * spawnDist;
          const sy = prev.playerPosition.y + Math.sin(spawnAngle) * spawnDist;

          const spawnChunkX = Math.floor(sx / 1000);
          const spawnChunkY = Math.floor(sy / 1000);
          let spawnTerrain = getTerrainAt(sx, sy);

          const monsterScaling = scalingFactor;
          const rand = Math.random();
          
          let mType: any = 'normal';
          
          if (spawnTerrain === 'cave') {
            mType = rand > 0.5 ? 'evil-eye' : 'six-legged';
          } else if (spawnTerrain === 'forest') {
            mType = rand > 0.5 ? 'swarm' : 'normal';
          } else if (spawnTerrain === 'desert') {
            mType = 'six-legged';
          } else {
            // Normal terrain, use the day/night progression logic
            let evilEyeProb = isNight && newDay > 1 ? Math.min(0.3, (newDay - 1) * 0.05) : 0;
            let sixLeggedProb = isNight && newDay > 1 ? Math.min(0.4, (newDay - 1) * 0.1) : 0;
            let swarmProb = isNight && newDay > 1 ? Math.min(0.4, (newDay - 1) * 0.1) : 0;
            
            if (rand < evilEyeProb) mType = 'evil-eye';
            else if (rand < evilEyeProb + sixLeggedProb) mType = 'six-legged';
            else if (rand < evilEyeProb + sixLeggedProb + swarmProb) mType = 'swarm';
            else mType = 'normal';
          }
          
          if (mType === 'swarm') {
            const count = 3 + Math.floor(Math.random() * 3) + Math.floor(newDay / 2);
            for (let j = 0; j < count; j++) {
              newEntities.push({
                id: 'monster-' + Math.random().toString(36).substr(2, 9),
                type: 'monster', monsterType: 'swarm',
                x: sx + (Math.random() - 0.5) * 100, y: sy + (Math.random() - 0.5) * 100,
                health: 30 * monsterScaling, maxHealth: 30 * monsterScaling, attackCooldown: 750
              });
            }
          } else {
            newEntities.push({
              id: 'monster-' + Math.random().toString(36).substr(2, 9),
              type: 'monster', monsterType: mType,
              x: sx, y: sy,
              health: (mType === 'evil-eye' ? 300 : (mType === 'six-legged' ? 200 : 100)) * monsterScaling,
              maxHealth: (mType === 'evil-eye' ? 300 : (mType === 'six-legged' ? 200 : 100)) * monsterScaling,
              attackCooldown: mType === 'evil-eye' ? 2000 : (mType === 'six-legged' ? 500 : 1500)
            });
          }
        }
      }

      // Sandworm Logic
      const currentTerrain = getTerrainAt(prev.playerPosition.x, prev.playerPosition.y);
      if (currentTerrain === 'desert') {
        sandwormTimer.current += deltaTime;
        if (sandwormTimer.current > 20000 && !sandwormWarning.current) {
          // Trigger warning
          sandwormWarning.current = { x: prev.playerPosition.x, y: prev.playerPosition.y, time: 3000 };
          sandwormTimer.current = 0;
        }
      } else {
        // Reset timer if not in desert
        sandwormTimer.current = 0;
        sandwormWarning.current = null;
      }

      let newNotifications = prev.notifications.map(n => ({ ...n, life: n.life - deltaTime })).filter(n => n.life > 0);

      let sandwormDamage = 0;
      if (sandwormWarning.current) {
        sandwormWarning.current.time -= deltaTime;
        if (sandwormWarning.current.time <= 0) {
          // Spawn sandworm
          newEntities.push({
            id: 'monster-' + Math.random().toString(36).substr(2, 9),
            type: 'monster', monsterType: 'sandworm',
            x: sandwormWarning.current.x, y: sandwormWarning.current.y,
            health: 1000, maxHealth: 1000, attackCooldown: 0,
            attackProgress: 2000 // Time it stays emerged
          });
          
          // Check if player is in range
          const dist = Math.sqrt(Math.pow(prev.playerPosition.x - sandwormWarning.current.x, 2) + Math.pow(prev.playerPosition.y - sandwormWarning.current.y, 2));
          if (dist < 150) {
            // Massive damage
            sandwormDamage = 100;
            newNotifications.push({ id: Math.random().toString(36).substr(2, 9), message: "遭到沙虫巨口吞噬!", type: 'system', life: 3000 });
          }
          
          sandwormWarning.current = null;
        }
      }

      let newX = prev.playerPosition.x;
      let newY = prev.playerPosition.y;
      let foodDeductionFromTravel = 0;

      if (dx !== 0 || dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        const moveX = (dx / length) * speed * deltaTime;
        const moveY = (dy / length) * speed * deltaTime;
        newX += moveX;
        newY += moveY;
        
        // Organic supply consumption for travel: 2 per 1000m (skip if boosting)
        const distMoved = Math.sqrt(moveX * moveX + moveY * moveY);
        if (!isBoosting) {
          travelDistance.current += distMoved;
          if (travelDistance.current >= 1000) {
            foodDeductionFromTravel = 2;
            travelDistance.current -= 1000;
          }
        }
      }

      let newFuel = prev.resources.fuel;
      if (isBoosting) newFuel = Math.max(0, newFuel - deltaTime * 0.05);

      // Elevation Logic
      const currentHeight = getHeightAt(prev.playerPosition.x, prev.playerPosition.y);
      const nextHeight = getHeightAt(newX, newY);
      let fallDamage = 0;

      if (nextHeight > currentHeight && !isBoosting) {
        // Block movement up if not flying
        newX = prev.playerPosition.x;
        newY = prev.playerPosition.y;
      } else if (nextHeight < currentHeight && !isBoosting) {
        // Fall down
        fallDamage = 5;
        newNotifications.push({ id: Math.random().toString(36).substr(2, 9), message: "从高处摔落! -5 氧气", type: 'system', life: 2000 });
        audioManager.playSFX('damage');
      }

      let newOxygen = Math.max(0, prev.resources.oxygen - oxygenLoss - fallDamage);
      let newFood = Math.max(0, prev.resources.food - deltaTime * 0.001 - foodDeductionFromTravel);
      let newEnergy = Math.max(0, prev.resources.energy - deltaTime * 0.0005);

      const distToPod = Math.sqrt(Math.pow(newX - prev.podPosition.x, 2) + Math.pow(newY - prev.podPosition.y, 2));
      
      const hasPodEnergy = prev.resources.energy > 0;
      let depositedMinerals = 0;
      let directMinerals = 0;
      if (distToPod < 40 && hasPodEnergy) {
        newFuel = Math.min(100 + (prev.upgrades.flightSystem - 1) * 50, newFuel + deltaTime * 0.1);
        newOxygen = Math.min(100 + (prev.upgrades.oxygenSystem - 1) * 50, newOxygen + deltaTime * 0.2);
        newEnergy = Math.min(100, newEnergy + deltaTime * 0.1);
        if (prev.carriedMinerals > 0) depositedMinerals = prev.carriedMinerals;
      }

      // Building Selection
      if (keys.current.has('Digit1')) setGameState(prev => ({ ...prev, selectedBuildingIndex: 0 }));
      if (keys.current.has('Digit2')) setGameState(prev => ({ ...prev, selectedBuildingIndex: 1 }));
      if (keys.current.has('Digit3')) setGameState(prev => ({ ...prev, selectedBuildingIndex: 2 }));
      if (keys.current.has('Digit4')) setGameState(prev => ({ ...prev, selectedBuildingIndex: 3 }));
      if (keys.current.has('Digit5')) setGameState(prev => ({ ...prev, selectedBuildingIndex: 4 }));
      if (keys.current.has('Digit6')) setGameState(prev => ({ ...prev, selectedBuildingIndex: 5 }));
      if (keys.current.has('Digit7')) setGameState(prev => ({ ...prev, selectedBuildingIndex: 6 }));
      if (keys.current.has('Digit8')) setGameState(prev => ({ ...prev, selectedBuildingIndex: 7 }));
      if (keys.current.has('Digit9')) setGameState(prev => ({ ...prev, selectedBuildingIndex: 8 }));

      // Pod Interaction for Upgrade
      if (distToPod < 60 && keys.current.has('KeyF')) {
        return { ...prev, status: 'upgrading' };
      }

      let newInventory = [...prev.buildingInventory];
      let newSelectedBuildingIndex = prev.selectedBuildingIndex;
      let newLogs = [...prev.logs];

      // Building Placement (Long press B)
      if (keys.current.has('KeyB') && prev.buildingInventory.length > 0 && prev.selectedBuildingIndex < prev.buildingInventory.length) {
        buildHoldTimer.current += deltaTime;
        
        if (buildHoldTimer.current >= BUILD_HOLD_DURATION) {
          // Check if on water
          let playerInWater = false;
          let playerInIsland = false;
          for (const entity of newEntities) {
            if (entity.type === 'pool' || entity.type === 'island') {
              const dx = newX - entity.x;
              const dy = newY - entity.y;
              const rx = (entity.width || 100) / 2;
              const ry = (entity.height || 60) / 2;
              const cos = Math.cos(-(entity.rotation || 0));
              const sin = Math.sin(-(entity.rotation || 0));
              const rotatedX = dx * cos - dy * sin;
              const rotatedY = dx * sin + dy * cos;
              if ((rotatedX * rotatedX) / (rx * rx) + (rotatedY * rotatedY) / (ry * ry) <= 1) {
                if (entity.type === 'pool') playerInWater = true;
                if (entity.type === 'island') playerInIsland = true;
              }
            }
          }
          const isActuallyInWater = playerInWater && !playerInIsland;

          if (isActuallyInWater) {
            newNotifications.push({ id: Math.random().toString(36).substr(2, 9), message: "无法在水面上建造!", type: 'system', life: 2000 });
            keys.current.delete('KeyB');
            buildHoldTimer.current = 0;
          } else {
            const buildingToPlace = prev.buildingInventory[prev.selectedBuildingIndex];
            let health = 50;
            if (buildingToPlace.type === 'turret') health = 70;
            
            newEntities.push({
              id: 'building-' + Math.random().toString(36).substr(2, 9),
              type: 'building',
              buildingType: buildingToPlace.type,
              x: newX,
              y: newY,
              health: health,
              maxHealth: health,
              attackCooldown: 0,
              laserDamage: 5,
              laserDuration: 0,
              controlCooldown: 0,
              buildProgress: 0
            });

            if (buildingToPlace.type === 'mech-miner-institute') {
              newEntities.push({
                id: 'mech-miner-' + Math.random().toString(36).substr(2, 9),
                type: 'mech-miner',
                x: newX,
                y: newY,
                carriedMinerals: 0,
                state: 'searching'
              });
            }

            newInventory.splice(prev.selectedBuildingIndex, 1);
            newSelectedBuildingIndex = Math.max(0, prev.selectedBuildingIndex - 1);
            newLogs.push(`[BUILD] 在当前位置建造了 ${buildingToPlace.name}`);
            
            keys.current.delete('KeyB'); // Prevent multiple placements
            buildHoldTimer.current = 0;
          }
        }
      } else {
        buildHoldTimer.current = 0; // Reset timer if B is released or conditions not met
      }

      // Teleport Tower Interaction
      if (keys.current.has('KeyR')) {
        const nearTeleportTower = prev.entities.some(e => e.type === 'building' && e.buildingType === 'teleport-tower' && Math.sqrt(Math.pow(newX - e.x, 2) + Math.pow(newY - e.y, 2)) < 80);
        if (nearTeleportTower) {
          teleportHoldTimer.current += deltaTime;
          if (teleportHoldTimer.current >= TELEPORT_HOLD_DURATION) {
            newX = prev.podPosition.x;
            newY = prev.podPosition.y;
            audioManager.playSFX('upgrade'); // Use upgrade sound for teleport
            teleportHoldTimer.current = 0;
            keys.current.delete('KeyR');
            newNotifications.push({ id: Math.random().toString(36).substr(2, 9), message: "传送成功", type: 'system', life: 2000 });
          }
        } else {
          teleportHoldTimer.current = 0;
        }
      } else {
        teleportHoldTimer.current = 0;
      }

      const newBullets = prev.bullets.map(b => ({
        ...b,
        x: b.x + b.vx * deltaTime,
        y: b.y + b.vy * deltaTime,
        life: b.life - deltaTime
      })).filter(b => b.life > 0);

      const newMissiles: any[] = prev.missiles.map(m => {
        if (m.isExploding) {
          return { ...m, explosionProgress: (m.explosionProgress || 0) + deltaTime };
        }
        const nx = m.x + m.vx * deltaTime;
        const ny = m.y + m.vy * deltaTime;
        
        let hitTarget = false;
        
        if (m.isFriendly) {
          prev.entities.forEach(e => {
            if (e.type === 'monster' && !e.isDead && e.controlledMonsterId !== 'controlled') {
              const d = Math.sqrt(Math.pow(nx - e.x, 2) + Math.pow(ny - e.y, 2));
              if (d < 20) {
                e.health = (e.health || 100) - m.damage;
                hitTarget = true;
              }
            }
          });
        } else {
          const distToPlayer = Math.sqrt(Math.pow(nx - newX, 2) + Math.pow(ny - newY, 2));
          if (distToPlayer < 20) {
            hitTarget = true;
          }
        }
        
        if (hitTarget || m.life <= deltaTime) {
          return { ...m, isExploding: true, explosionProgress: 0, life: 500 };
        }
        
        return { ...m, x: nx, y: ny, life: m.life - deltaTime, rotation: m.rotation + 0.1 };
      }).filter(m => m.life > 0 && (m.explosionProgress || 0) < 500);

      shootTimer.current += deltaTime;
      const weaponStats = prev.upgrades.weaponStats;
      const shootInterval = (weaponStats.isMachineGun ? 100 : (weaponStats.isLaserGun ? 500 : (weaponStats.isCannon ? 800 : 500))) / weaponStats.attackSpeed;
      
      if (shootTimer.current >= shootInterval) {
        let nearestMonster: Entity | null = null;
        let minDist = weaponStats.attackRange; 
        prev.entities.forEach(e => {
          if (e.type === 'monster' && !e.isDead) {
            const d = Math.sqrt(Math.pow(newX - e.x, 2) + Math.pow(newY - e.y, 2));
            if (d < minDist) { minDist = d; nearestMonster = e; }
          }
        });

        if (nearestMonster) {
          const angle = Math.atan2(nearestMonster.y - newY, nearestMonster.x - newX);
          
          // Check for laser
          const shotCount = (prev as any).shotCount || 0;
          const isLaserShot = weaponStats.laserEveryNth > 0 && (shotCount + 1) % weaponStats.laserEveryNth === 0;
          const isLaserGun = weaponStats.isLaserGun;

          if (isLaserShot || isLaserGun) {
            audioManager.playSFX('laser');
            // Laser logic: damage all monsters in a line
            const laserRange = 1000;
            const laserDamage = 10 * weaponStats.attackPower * (isLaserShot ? 2 : 1);
            const laserAngle = angle;
            
            prev.entities.forEach(e => {
              if (e.type === 'monster' && !e.isDead) {
                const edx = e.x - newX;
                const edy = e.y - newY;
                const dist = Math.sqrt(edx * edx + edy * edy);
                if (dist < laserRange) {
                  const eAngle = Math.atan2(edy, edx);
                  const angleDiff = Math.abs(eAngle - laserAngle);
                  if (angleDiff < 0.1) { // Narrow beam
                    e.health = (e.health || 100) - laserDamage;
                  }
                }
              }
            });
            
            // Add a visual bullet that acts as the laser beam
            newBullets.push({
              id: 'laser-' + Math.random().toString(36).substr(2, 9),
              x: newX, y: newY,
              vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5,
              damage: 0, life: 200, // Short life, high speed for visual
              isLaser: true as any
            } as any);
          } else {
            audioManager.playSFX('laser');
            const bulletCount = weaponStats.bulletsPerShot;
            const spread = 0.1;
            for (let i = 0; i < bulletCount; i++) {
              const finalAngle = angle + (i - (bulletCount - 1) / 2) * spread;
              newBullets.push({
                id: Math.random().toString(36).substr(2, 9),
                x: newX, y: newY,
                vx: Math.cos(finalAngle) * 1.5, vy: Math.sin(finalAngle) * 1.5,
                damage: 10 * weaponStats.attackPower, life: 2000,
                isCannon: weaponStats.isCannon as any,
                hasBounce: weaponStats.hasBounce as any,
                bounceCount: 0 as any
              } as any);
            }
          }
          
          shootTimer.current -= shootInterval;
          (prev as any).shotCount = shotCount + 1;
        } else {
          shootTimer.current = Math.min(shootTimer.current, shootInterval);
        }
      }

      const remainingEntities = newEntities;
      let collectedFood = 0, collectedEnergy = 0, collectedMinerals = 0, playerDamage = sandwormDamage;
      const isInteracting = keys.current.has('KeyF');

      const newChestLoot = [...(prev.chestLoot || [])];

      for (let i = remainingEntities.length - 1; i >= 0; i--) {
        const entity = remainingEntities[i];
        const dist = Math.sqrt(Math.pow(newX - entity.x, 2) + Math.pow(newY - entity.y, 2));

        if (entity.isDead) {
          entity.deathProgress = (entity.deathProgress || 0) + deltaTime;
          if (entity.deathProgress > 1000) {
            remainingEntities.splice(i, 1);
          }
          continue;
        }

        if (entity.type === 'building') {
          if (entity.buildProgress !== undefined && entity.buildProgress < 1000) {
            entity.buildProgress += deltaTime;
            if (entity.buildProgress >= 1000) {
              // Building finished
            }
            continue;
          }

          if (entity.health !== undefined && entity.health <= 0) {
            entity.isDead = true;
            entity.deathProgress = 0;
            newLogs.push(`[SYSTEM] 建筑 ${entity.buildingType} 已被摧毁`);
            continue;
          }

          if (entity.buildingType === 'turret') {
            entity.attackCooldown = (entity.attackCooldown || 0) - deltaTime;
            if (entity.attackCooldown <= 0) {
              let target: Entity | null = null;
              let minDist = 300;
              prev.entities.forEach(e => {
                if (e.type === 'monster' && !e.isDead && e.controlledMonsterId !== 'controlled') {
                  const d = Math.sqrt(Math.pow(entity.x - e.x, 2) + Math.pow(entity.y - e.y, 2));
                  if (d < minDist) { minDist = d; target = e; }
                }
              });
              if (target) {
                const angle = Math.atan2(target.y - entity.y, target.x - entity.x);
                newBullets.push({
                  id: 'turret-' + Math.random().toString(36).substr(2, 9),
                  x: entity.x, y: entity.y,
                  vx: Math.cos(angle) * 1.5, vy: Math.sin(angle) * 1.5,
                  damage: 20, life: 2000,
                  isCannon: true as any,
                  hasBounce: false as any,
                  bounceCount: 0 as any
                } as any);
                entity.attackCooldown = 2000;
                audioManager.playSFX('laser');
              }
            }
          } else if (entity.buildingType === 'laser-tower') {
            let target: Entity | null = null;
            let minDist = 250;
            
            // If we have a target, check if it's still valid
            if (entity.laserTargetId) {
              const currentTarget = prev.entities.find(e => e.id === entity.laserTargetId && !e.isDead);
              if (currentTarget) {
                const d = Math.sqrt(Math.pow(entity.x - currentTarget.x, 2) + Math.pow(entity.y - currentTarget.y, 2));
                if (d <= 250) {
                  target = currentTarget;
                }
              }
            }

            // Find new target if needed
            if (!target) {
              entity.laserTargetId = undefined;
              entity.laserDamage = 5;
              entity.laserDuration = 0;
              prev.entities.forEach(e => {
                if (e.type === 'monster' && !e.isDead && e.controlledMonsterId !== 'controlled') {
                  const d = Math.sqrt(Math.pow(entity.x - e.x, 2) + Math.pow(entity.y - e.y, 2));
                  if (d < minDist) { minDist = d; target = e; }
                }
              });
            }

            if (target) {
              entity.laserTargetId = target.id;
              entity.laserDuration = (entity.laserDuration || 0) + deltaTime;
              entity.laserDamage = 5 + Math.floor(entity.laserDuration / 1000) * 5;
              
              target.health = (target.health || 100) - (entity.laserDamage * (deltaTime / 1000));
              
              // Visual laser
              const angle = Math.atan2(target.y - entity.y, target.x - entity.x);
              newBullets.push({
                id: 'laser-tower-' + Math.random().toString(36).substr(2, 9),
                x: entity.x, y: entity.y,
                vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5,
                damage: 0, life: 50,
                isLaser: true as any
              } as any);
            }
          } else if (entity.buildingType === 'mind-control-tower') {
            entity.controlCooldown = (entity.controlCooldown || 0) - deltaTime;
            
            if (entity.controlledMonsterId) {
              const controlledMonster = prev.entities.find(e => e.id === entity.controlledMonsterId);
              if (!controlledMonster || controlledMonster.isDead) {
                entity.controlledMonsterId = undefined;
                entity.controlCooldown = 5000;
              } else {
                entity.controlDuration = (entity.controlDuration || 0) - deltaTime;
                if (entity.controlDuration <= 0) {
                  controlledMonster.controlledMonsterId = undefined;
                  entity.controlledMonsterId = undefined;
                  entity.controlCooldown = 5000;
                }
              }
            } else if (entity.controlCooldown <= 0) {
              let target: Entity | null = null;
              let minDist = 200;
              prev.entities.forEach(e => {
                if (e.type === 'monster' && !e.isDead && !e.controlledMonsterId) {
                  const d = Math.sqrt(Math.pow(entity.x - e.x, 2) + Math.pow(entity.y - e.y, 2));
                  if (d < minDist) { minDist = d; target = e; }
                }
              });
              if (target) {
                entity.controlledMonsterId = target.id;
                target.controlledMonsterId = 'controlled';
                entity.controlDuration = 5000;
              }
            }
          }
        } else if (entity.type === 'mech-miner') {
          const podX = prev.podPosition.x;
          const podY = prev.podPosition.y;

          if (entity.state === 'searching' || !entity.state) {
            // Find nearest rock or crystal
            let nearestRock: Entity | null = null;
            let minDist = Infinity;
            prev.entities.forEach(e => {
              if ((e.type === 'rock' || e.type === 'crystal') && !e.isDead) {
                const d = Math.sqrt(Math.pow(entity.x - e.x, 2) + Math.pow(entity.y - e.y, 2));
                if (d < minDist) {
                  minDist = d;
                  nearestRock = e;
                }
              }
            });

            if (nearestRock) {
              entity.targetRockId = nearestRock.id;
              const angle = Math.atan2(nearestRock.y - entity.y, nearestRock.x - entity.x);
              if (minDist > 30) {
                entity.x += Math.cos(angle) * 0.15 * deltaTime;
                entity.y += Math.sin(angle) * 0.15 * deltaTime;
                entity.rotation = angle;
              } else {
                entity.state = 'mining';
                entity.miningProgress = 0;
              }
            } else {
              // No rocks found, hover around pod
              const t = Date.now() / 1000;
              const targetX = podX + Math.cos(t) * 60;
              const targetY = podY + Math.sin(t) * 60;
              const angle = Math.atan2(targetY - entity.y, targetX - entity.x);
              entity.x += Math.cos(angle) * 0.1 * deltaTime;
              entity.y += Math.sin(angle) * 0.1 * deltaTime;
              entity.rotation = angle;
            }
          } else if (entity.state === 'mining') {
            entity.miningProgress = (entity.miningProgress || 0) + deltaTime;
            if (entity.miningProgress >= 10000) {
              entity.miningProgress = 0;
              entity.carriedMinerals = 50;
              entity.state = 'returning';
            }
          } else if (entity.state === 'returning') {
            const angle = Math.atan2(podY - entity.y, podX - entity.x);
            const dist = Math.sqrt(Math.pow(podX - entity.x, 2) + Math.pow(podY - entity.y, 2));
            if (dist > 20) {
              entity.x += Math.cos(angle) * 0.15 * deltaTime;
              entity.y += Math.sin(angle) * 0.15 * deltaTime;
              entity.rotation = angle;
            } else {
              entity.state = 'delivering';
              entity.deliveryProgress = 0;
            }
          } else if (entity.state === 'delivering') {
            entity.deliveryProgress = (entity.deliveryProgress || 0) + deltaTime;
            if (entity.deliveryProgress >= 1000) {
              entity.deliveryProgress = 0;
              directMinerals += (entity.carriedMinerals || 0);
              entity.carriedMinerals = 0;
              entity.state = 'searching';
              newNotifications.push({ 
                id: Math.random().toString(36).substr(2, 9), 
                message: "机甲矿工上供", 
                type: 'mineral', 
                amount: 50, 
                life: 3000 
              });
            }
          }
        }

        if (entity.type === 'monster') {
          const mType = entity.monsterType || 'normal';
          let mSpeed = 0.06;
          let mRange = 25;
          let mDamage = 10 * (1 + (newDay - 1) * 0.05);
          
          if (mType === 'swarm') { mSpeed = 0.12; mDamage = 5 * (1 + (newDay - 1) * 0.05); }
          else if (mType === 'six-legged') { mSpeed = 0.09; mRange = 150; mDamage = 20 * (1 + (newDay - 1) * 0.05); }
          else if (mType === 'evil-eye') { mSpeed = 0.018; mRange = 400; mDamage = 20 * (1 + (newDay - 1) * 0.05); }
          else if (mType === 'sandworm') { mSpeed = 0; mRange = 0; mDamage = 0; } // Sandworm doesn't move or attack normally

          // Behavior logic
          let targetX = entity.x;
          let targetY = entity.y;
          let isTargetingPod = false;
          let isTargetingPlayer = false;
          let targetMonster: Entity | null = null;

          if (mType === 'sandworm') {
            // Sandworm stays for attackProgress time, then disappears
            if (entity.attackProgress !== undefined) {
              entity.attackProgress -= deltaTime;
              if (entity.attackProgress <= 0) {
                remainingEntities.splice(i, 1);
                continue;
              }
            }
          } else if (entity.controlledMonsterId === 'controlled') {
            // Attack other monsters
            let minDist = Infinity;
            prev.entities.forEach(e => {
              if (e.type === 'monster' && !e.isDead && e.id !== entity.id && e.controlledMonsterId !== 'controlled') {
                const d = Math.sqrt(Math.pow(entity.x - e.x, 2) + Math.pow(entity.y - e.y, 2));
                if (d < minDist) { minDist = d; targetMonster = e; }
              }
            });
            if (targetMonster) {
              targetX = targetMonster.x;
              targetY = targetMonster.y;
            }
          } else {
            const distToPlayer = Math.sqrt(Math.pow(newX - entity.x, 2) + Math.pow(newY - entity.y, 2));
            const distToPod = Math.sqrt(Math.pow(prev.podPosition.x - entity.x, 2) + Math.pow(prev.podPosition.y - entity.y, 2));

            if (isNight) {
              // Nighttime: Attracted to pod and player's light
              if (distToPlayer < 600) { // Player light range
                targetX = newX;
                targetY = newY;
                isTargetingPlayer = true;
              } else if (distToPod < 1200) { // Pod beacon range
                targetX = prev.podPosition.x;
                targetY = prev.podPosition.y;
                isTargetingPod = true;
              }
            } else {
              // Daytime: Only attack if player gets close (aggro range)
              if (distToPlayer < 300) {
                targetX = newX;
                targetY = newY;
                isTargetingPlayer = true;
              }
            }
          }

          const distToTarget = Math.sqrt(Math.pow(targetX - entity.x, 2) + Math.pow(targetY - entity.y, 2));

          if (isTargetingPlayer || isTargetingPod || targetMonster) {
            const angle = Math.atan2(targetY - entity.y, targetX - entity.x);
            entity.x += Math.cos(angle) * mSpeed * deltaTime;
            entity.y += Math.sin(angle) * mSpeed * deltaTime;
          }

          entity.attackCooldown = (entity.attackCooldown || 0) - deltaTime;
          if ((isTargetingPlayer || isTargetingPod || targetMonster) && distToTarget < mRange && entity.attackCooldown <= 0) {
            if (mType === 'evil-eye') {
              for (let j = 0; j < 3; j++) {
                const mAngle = Math.atan2(targetY - entity.y, targetX - entity.x) + (j - 1) * 0.2;
                newMissiles.push({
                  id: Math.random().toString(36).substr(2, 9),
                  x: entity.x, y: entity.y,
                  vx: Math.cos(mAngle) * 0.4, vy: Math.sin(mAngle) * 0.4,
                  damage: mDamage, life: 3000, rotation: mAngle,
                  isFriendly: entity.controlledMonsterId === 'controlled'
                } as any);
              }
              entity.attackCooldown = 2000;
            } else {
              if (targetMonster) {
                targetMonster.health = (targetMonster.health || 100) - mDamage;
                audioManager.playSFX('damage');
              } else if (isTargetingPod) {
                // Damage pod energy
                const podDamage = mType === 'six-legged' ? 25 : (mType === 'swarm' ? 10 : 15);
                newEnergy = Math.max(0, newEnergy - podDamage);
                audioManager.playSFX('damage');
                newNotifications.push({ id: Math.random().toString(36).substr(2, 9), message: "船舱遭到攻击!", type: 'system', life: 1000 });
              } else {
                playerDamage += mDamage;
                audioManager.playSFX('damage');
              }
              entity.attackCooldown = mType === 'six-legged' ? 500 : (mType === 'swarm' ? 750 : 1500);
              entity.attackProgress = 300;
            }
          }
          if (entity.attackProgress && entity.attackProgress > 0 && mType !== 'sandworm') entity.attackProgress -= deltaTime;

          for (let j = newBullets.length - 1; j >= 0; j--) {
            const b: any = newBullets[j];
            if (b.isLaser) continue;
            
            if (Math.sqrt(Math.pow(b.x - entity.x, 2) + Math.pow(b.y - entity.y, 2)) < 20) {
              entity.health = (entity.health || 100) - b.damage;
              
              if (b.isCannon) {
                audioManager.playSFX('explosion');
                const explosionRadius = weaponStats.explosionRadius || 200;
                prev.entities.forEach(e => {
                  if (e.type === 'monster' && !e.isDead && e.id !== entity.id) {
                    const edist = Math.sqrt(Math.pow(e.x - entity.x, 2) + Math.pow(e.y - entity.y, 2));
                    if (edist < explosionRadius) {
                      e.health = (e.health || 100) - b.damage;
                    }
                  }
                });
              }

              if (b.hasBounce && b.bounceCount < 1) {
                let nextMonster: Entity | null = null;
                let nextMinDist = 300;
                prev.entities.forEach(e => {
                  if (e.type === 'monster' && !e.isDead && e.id !== entity.id) {
                    const d = Math.sqrt(Math.pow(entity.x - e.x, 2) + Math.pow(entity.y - e.y, 2));
                    if (d < nextMinDist) { nextMinDist = d; nextMonster = e; }
                  }
                });
                if (nextMonster) {
                  const angle = Math.atan2(nextMonster.y - entity.y, nextMonster.x - entity.x);
                  b.vx = Math.cos(angle) * 1.5;
                  b.vy = Math.sin(angle) * 1.5;
                  b.bounceCount++;
                } else {
                  newBullets.splice(j, 1);
                }
              } else {
                newBullets.splice(j, 1);
              }
            }
          }
          if (entity.health !== undefined && entity.health <= 0) {
            let lootAmount = Math.floor(Math.random() * 11) + 10; // 10-20
            if (mType === 'swarm') lootAmount = 10;
            else if (mType === 'six-legged') lootAmount = Math.floor(Math.random() * 21) + 40; // 40-60
            else if (mType === 'evil-eye') lootAmount = Math.floor(Math.random() * 21) + 80; // 80-100

            if (Math.random() > 0.3) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 0.2 + 0.1;
              remainingEntities.push({
                id: Math.random().toString(36).substr(2, 9),
                type: 'dropped_item', x: entity.x, y: entity.y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                content: 'food', amount: lootAmount
              });
            }
            collectedMinerals += lootAmount * 2;
            audioManager.playSFX('explosion');
            newNotifications.push({ id: Math.random().toString(36).substr(2, 9), message: "击败生物", type: 'system', amount: lootAmount, life: 3000 });
            remainingEntities.splice(i, 1);
            continue;
          }
        } else if (entity.type === 'rock' || entity.type === 'crystal' || entity.type === 'stalactite') {
          // Mining logic
          if (dist < 50 && !entity.isDead) {
            entity.miningProgress = (entity.miningProgress || 0) + deltaTime;
            if (entity.miningProgress >= 1000) { // 1 second to mine
              const amount = entity.amount || (entity.type === 'crystal' ? 100 : (entity.type === 'stalactite' ? 30 : 50));
              collectedMinerals += amount;
              audioManager.playSFX('pickup');
              newNotifications.push({ 
                id: Math.random().toString(36).substr(2, 9), 
                message: entity.type === 'crystal' ? "开采晶体" : (entity.type === 'stalactite' ? "开采钟乳石" : "开采矿山"), 
                type: 'mineral', 
                amount, 
                life: 3000 
              });
              entity.isDead = true;
              entity.deathProgress = 0;
            }
          } else {
            entity.miningProgress = 0;
          }
        } else if (entity.type === 'chest') {
          if (dist < 80 && isInteracting && !entity.isOpened) {
            entity.isOpened = true;
            audioManager.playSFX('chest');
            
            // Spawn 3-6 dropped items around the chest
            const numItems = Math.floor(Math.random() * 4) + 3;
            for (let j = 0; j < numItems; j++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 0.3 + 0.2;
              
              const lootType = Math.random();
              let content: 'mineral' | 'food' | 'oxygen' | 'energy' | 'fuel' = 'mineral';
              let amount = 0;

              if (lootType < 0.4) {
                content = 'mineral';
                amount = Math.floor(Math.random() * 50) + 20;
              } else if (lootType < 0.6) {
                content = 'food';
                amount = Math.floor(Math.random() * 20) + 10;
              } else if (lootType < 0.8) {
                content = 'oxygen';
                amount = Math.floor(Math.random() * 20) + 10;
              } else if (lootType < 0.9) {
                content = 'energy';
                amount = Math.floor(Math.random() * 20) + 10;
              } else {
                content = 'fuel';
                amount = Math.floor(Math.random() * 20) + 10;
              }

              remainingEntities.push({
                id: `chest-loot-${Math.random().toString(36).substr(2, 9)}`,
                type: 'dropped_item',
                x: entity.x,
                y: entity.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                content,
                amount
              });
            }
            
            newChestLoot.push({ id: Math.random().toString(36).substr(2, 9), message: `发现宝箱物资`, type: 'system', amount: numItems, time: Date.now() });
          }
        } else if (entity.type === 'dropped_item') {
          if (entity.vx !== undefined && entity.vy !== undefined) {
            entity.x += entity.vx * deltaTime;
            entity.y += entity.vy * deltaTime;
            entity.vx *= 0.95; // friction
            entity.vy *= 0.95;
            if (Math.abs(entity.vx) < 0.01) entity.vx = 0;
            if (Math.abs(entity.vy) < 0.01) entity.vy = 0;
          }
          if (dist < 30 && isInteracting) {
            const amount = entity.amount || 0;
            let pickedUpAmount = 0;
            let pickedUp = false;

            if (entity.content === 'food') { collectedFood += amount; pickedUpAmount = amount; pickedUp = true; remainingEntities.splice(i, 1); }
            else if (entity.content === 'energy') { collectedEnergy += amount; pickedUpAmount = amount; pickedUp = true; remainingEntities.splice(i, 1); }
            else if (entity.content === 'oxygen') { newOxygen = Math.min(100 + (prev.upgrades.oxygenSystem - 1) * 50, newOxygen + amount); pickedUpAmount = amount; pickedUp = true; remainingEntities.splice(i, 1); }
            else if (entity.content === 'mineral') {
              const availableSpace = prev.maxCarryCapacity - (prev.carriedMinerals + collectedMinerals);
              const actualPickup = Math.min(amount, Math.max(0, availableSpace));
              if (actualPickup > 0) {
                collectedMinerals += actualPickup;
                pickedUpAmount = actualPickup;
                pickedUp = true;
                if (actualPickup < amount) {
                  entity.amount = amount - actualPickup;
                  newNotifications.push({ id: Math.random().toString(36).substr(2, 9) + '_full', message: "负重已满!", type: 'system', life: 2000 });
                } else {
                  remainingEntities.splice(i, 1);
                }
              } else {
                newNotifications.push({ id: Math.random().toString(36).substr(2, 9) + '_full', message: "无法携带更多矿物", type: 'system', life: 2000 });
              }
            } else if (entity.content === 'fuel') { newFuel = Math.min(100, newFuel + amount); pickedUpAmount = amount; pickedUp = true; remainingEntities.splice(i, 1); }
            
            if (pickedUp) {
              audioManager.playSFX('pickup');
              newNotifications.push({
                id: Math.random().toString(36).substr(2, 9),
                message: `获得 ${entity.content === 'food' ? '有机补给' : entity.content === 'energy' ? '能量核心' : entity.content === 'mineral' ? '矿物资源' : entity.content === 'oxygen' ? '氧气补给' : '飞行燃料'}`,
                type: (entity.content === 'fuel' ? 'energy' : (entity.content === 'oxygen' ? 'food' : entity.content)) as any,
                amount: pickedUpAmount,
                life: 3000
              });
            }
          }
        } else if (dist < 20) {
          if (entity.type === 'food') { collectedFood += 10; remainingEntities.splice(i, 1); }
          else if (entity.type === 'energy') { collectedEnergy += 15; remainingEntities.splice(i, 1); }
          else if (entity.type === 'mineral') {
            const amount = 25;
            const availableSpace = prev.maxCarryCapacity - (prev.carriedMinerals + collectedMinerals);
            const actualPickup = Math.min(amount, Math.max(0, availableSpace));
            if (actualPickup > 0) { collectedMinerals += actualPickup; remainingEntities.splice(i, 1); }
          }
        }
      }

      // Water Collision Logic
      let isInWater = false;
      let isInIsland = false;
      
      for (const entity of remainingEntities) {
        if (entity.type === 'pool' || entity.type === 'island') {
          const dx = newX - entity.x;
          const dy = newY - entity.y;
          // Simple ellipse collision
          const rx = (entity.width || 100) / 2;
          const ry = (entity.height || 60) / 2;
          // Rotate point back to check against axis-aligned ellipse
          const cos = Math.cos(-(entity.rotation || 0));
          const sin = Math.sin(-(entity.rotation || 0));
          const rotatedX = dx * cos - dy * sin;
          const rotatedY = dx * sin + dy * cos;
          
          if ((rotatedX * rotatedX) / (rx * rx) + (rotatedY * rotatedY) / (ry * ry) <= 1) {
            if (entity.type === 'pool') isInWater = true;
            if (entity.type === 'island') isInIsland = true;
          }
        }
      }

      const isActuallyInWater = isInWater && !isInIsland;
      let finalIsGameOver = newOxygen <= 0 || newEnergy <= 0 || newFood <= 0;
      let deathReason = "";

      if (newOxygen <= 0) deathReason = "氧气耗尽 - 维持生命系统停止运行";
      else if (newEnergy <= 0) deathReason = "能量核心枯竭 - 基地电力完全丧失";
      else if (newFood <= 0) deathReason = "有机补给耗尽 - 身体机能衰竭";

      if (isActuallyInWater) {
        if (!isBoosting && !prev.upgrades.hasBoat) {
          finalIsGameOver = true;
          deathReason = "溺水 - 掉入深水区域";
        }
      }

      // Fuel check while flying over water
      if (isBoosting && isActuallyInWater && newFuel <= 0) {
        finalIsGameOver = true;
        deathReason = "燃料耗尽 - 坠入深水区域";
      }

      // Handle missile damage to player
      let missileDamage = 0;
      newMissiles.forEach(m => {
        if (m.isExploding && m.explosionProgress === 0 && !m.isFriendly) {
          missileDamage += m.damage;
        }
      });

      if (depositedMinerals > 0) {
        newNotifications.push({ id: Math.random().toString(36).substr(2, 9), message: "矿物已上供", type: 'system', amount: depositedMinerals, life: 3000 });
      }

      const finalOxygen = Math.max(0, newOxygen - playerDamage - missileDamage);
      const finalFood = Math.min(100, newFood + collectedFood);
      const finalEnergy = Math.min(100, Math.max(0, newEnergy + collectedEnergy - (playerDamage * 0.5) - (missileDamage * 0.5)));
      const finalFuel = newFuel;

      const maxOxygen = 100 + (prev.upgrades.oxygenSystem - 1) * 50;
      const maxFuel = 100 + (prev.upgrades.flightSystem - 1) * 50;
      const now = Date.now();

      if (finalOxygen / maxOxygen < 0.2 && now - warningTimers.current.oxygen > 10000) {
        setGameState(prev => ({ ...prev, warningText: "警告: 氧气储备低于 20%!" }));
        warningTimers.current.oxygen = now;
        setTimeout(() => setGameState(prev => ({ ...prev, warningText: null })), 4000);
      }
      if (finalFood / 100 < 0.2 && now - warningTimers.current.food > 10000) {
        setGameState(prev => ({ ...prev, warningText: "警告: 有机补给低于 20%!" }));
        warningTimers.current.food = now;
        setTimeout(() => setGameState(prev => ({ ...prev, warningText: null })), 4000);
      }
      if (finalEnergy / 100 < 0.2 && now - warningTimers.current.energy > 10000) {
        setGameState(prev => ({ ...prev, warningText: "警告: 能量核心低于 20%!" }));
        warningTimers.current.energy = now;
        setTimeout(() => setGameState(prev => ({ ...prev, warningText: null })), 4000);
      }
      if (finalFuel / maxFuel < 0.2 && now - warningTimers.current.fuel > 10000) {
        setGameState(prev => ({ ...prev, warningText: "警告: 飞行燃料低于 20%!" }));
        warningTimers.current.fuel = now;
        setTimeout(() => setGameState(prev => ({ ...prev, warningText: null })), 4000);
      }

      const filteredChestLoot = newChestLoot.filter(l => now - l.time < 5000);

      return {
        ...prev,
        timeOfDay: newTimeOfDay,
        isNight,
        nightProgress,
        day: newDay,
        playerPosition: { x: newX, y: newY },
        carriedMinerals: prev.carriedMinerals + collectedMinerals - depositedMinerals,
        resources: { 
          ...prev.resources, 
          fuel: finalFuel, 
          oxygen: finalOxygen,
          food: finalFood,
          energy: finalEnergy,
          minerals: prev.resources.minerals + depositedMinerals + directMinerals
        },
        entities: remainingEntities,
        bullets: newBullets,
        missiles: newMissiles,
        notifications: newNotifications,
        chestLoot: filteredChestLoot,
        isBoosting,
        isGameOver: finalIsGameOver,
        deathReason: deathReason || prev.deathReason,
        status: finalIsGameOver ? 'gameover' : prev.status,
        buildingInventory: newInventory,
        selectedBuildingIndex: newSelectedBuildingIndex,
        logs: newLogs
      };
    });
  };

  const draw = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    if (!state.planet) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const time = Date.now() * 0.005;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(zoom.current, zoom.current);
    ctx.translate(-centerX, -centerY);

    // Draw Ground by Chunks
    const startChunkX = Math.floor((state.playerPosition.x - width / 2) / 1000) - 1;
    const endChunkX = Math.floor((state.playerPosition.x + width / 2) / 1000) + 1;
    const startChunkY = Math.floor((state.playerPosition.y - height / 2) / 1000) - 1;
    const endChunkY = Math.floor((state.playerPosition.y + height / 2) / 1000) + 1;

    for (let cx = startChunkX; cx <= endChunkX; cx++) {
      for (let cy = startChunkY; cy <= endChunkY; cy++) {
        const screenX = centerX + (cx * 1000 - state.playerPosition.x);
        const screenY = centerY + (cy * 1000 - state.playerPosition.y);
        
        // We can draw the terrain in smaller tiles for smoother transitions
        // But for performance, let's draw 200x200 tiles within the chunk
        for (let tx = 0; tx < 5; tx++) {
          for (let ty = 0; ty < 5; ty++) {
            const worldX = cx * 1000 + tx * 200 + 100;
            const worldY = cy * 1000 + ty * 200 + 100;
            const terrain = getTerrainAt(worldX, worldY);
            const heightAt = getHeightAt(worldX, worldY);
            
            let groundColor = '#e24d3b'; // normal
            if (terrain === 'desert') groundColor = '#d97706'; // yellowish sand
            else if (terrain === 'cave') groundColor = '#3f3f46'; // dark gray
            else if (terrain === 'forest') groundColor = '#166534'; // dark green

            // Adjust color for height
            if (heightAt === 1) {
              // Lighter version for high ground
              ctx.fillStyle = groundColor;
              ctx.globalAlpha = 1;
              ctx.fillRect(screenX + tx * 200, screenY + ty * 200, 200, 200);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
              ctx.fillRect(screenX + tx * 200, screenY + ty * 200, 200, 200);
            } else {
              ctx.fillStyle = groundColor;
              ctx.fillRect(screenX + tx * 200, screenY + ty * 200, 200, 200);
            }
            
            // Draw cliff edges (simple shadow) and hatching
            if (heightAt === 0) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
              ctx.lineWidth = 2;
              
              // Check neighbors to draw edges and hatching INSIDE the low ground
              const drawHatching = (sx: number, sy: number, w: number, h: number, dir: 'left' | 'right' | 'top' | 'bottom') => {
                ctx.save();
                ctx.beginPath();
                ctx.rect(sx, sy, w, h);
                ctx.clip();
                
                let grad;
                if (dir === 'right') grad = ctx.createLinearGradient(sx + w, sy, sx, sy);
                else if (dir === 'left') grad = ctx.createLinearGradient(sx, sy, sx + w, sy);
                else if (dir === 'bottom') grad = ctx.createLinearGradient(sx, sy + h, sx, sy);
                else grad = ctx.createLinearGradient(sx, sy, sx, sy + h);
                
                grad.addColorStop(0, 'rgba(0,0,0,0.6)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(sx, sy, w, h);

                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 2;
                for (let i = -200; i < 400; i += 15) {
                  ctx.beginPath();
                  ctx.moveTo(sx + i, sy - 50);
                  ctx.lineTo(sx + i - 40, sy + 250);
                  ctx.stroke();
                }
                ctx.restore();
              };

              const cliffWidth = 60; // Make it wider and more obvious

              if (getHeightAt(worldX + 200, worldY) === 1) { // Right is high
                drawHatching(screenX + tx * 200 + 200 - cliffWidth, screenY + ty * 200, cliffWidth, 200, 'right');
              }
              if (getHeightAt(worldX - 200, worldY) === 1) { // Left is high
                drawHatching(screenX + tx * 200, screenY + ty * 200, cliffWidth, 200, 'left');
              }
              if (getHeightAt(worldX, worldY + 200) === 1) { // Bottom is high
                drawHatching(screenX + tx * 200, screenY + ty * 200 + 200 - cliffWidth, 200, cliffWidth, 'bottom');
              }
              if (getHeightAt(worldX, worldY - 200) === 1) { // Top is high
                drawHatching(screenX + tx * 200, screenY + ty * 200, 200, cliffWidth, 'top');
              }
            }
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    // Draw Ground Details (Small crosses and pebbles)
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 150; i++) {
      const seed = i * 12345.67;
      const gx = ((Math.sin(seed) * 100000) % 6000) - state.playerPosition.x + centerX;
      const gy = ((Math.cos(seed) * 100000) % 6000) - state.playerPosition.y + centerY;
      
      if (gx > -20 && gx < width + 20 && gy > -20 && gy < height + 20) {
        // Get terrain for this specific point to adjust detail color
        const worldX = state.playerPosition.x + gx - centerX;
        const worldY = state.playerPosition.y + gy - centerY;
        const terrain = getTerrainAt(worldX, worldY);
        
        if (terrain === 'cave') ctx.fillStyle = 'rgba(255,255,255,0.05)';
        else ctx.fillStyle = 'rgba(0,0,0,0.15)';

        if (i % 3 === 0) {
          ctx.fillText('+', gx, gy);
        } else if (i % 3 === 1) {
          ctx.fillRect(gx, gy, 2, 2);
        } else {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw Pools (Lakes) in passes to make them seamless
    const pools = state.entities.filter(e => e.type === 'pool');
    
    // Pass 1: Beaches
    ctx.fillStyle = '#94a3b8';
    pools.forEach(entity => {
      const ex = centerX + (entity.x - state.playerPosition.x);
      const ey = centerY + (entity.y - state.playerPosition.y);
      if (ex > -400 && ex < width + 400 && ey > -400 && ey < height + 400) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(entity.rotation || 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, (entity.width || 100) / 2 + 20, (entity.height || 60) / 2 + 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // Pass 2: Water
    ctx.fillStyle = '#064e3b';
    pools.forEach(entity => {
      const ex = centerX + (entity.x - state.playerPosition.x);
      const ey = centerY + (entity.y - state.playerPosition.y);
      if (ex > -400 && ex < width + 400 && ey > -400 && ey < height + 400) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(entity.rotation || 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, (entity.width || 100) / 2, (entity.height || 60) / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Waterfall effect if pool is on high ground
        if (getHeightAt(entity.x, entity.y) === 1) {
          ctx.restore(); // Exit pool rotation
          ctx.save();
          ctx.translate(ex, ey);
          
          const w = (entity.width || 100) / 2;
          const h = (entity.height || 60) / 2;
          
          // Check 4 directions for cliffs
          const directions = [
            { dx: 1, dy: 0, angle: 0 },
            { dx: -1, dy: 0, angle: Math.PI },
            { dx: 0, dy: 1, angle: Math.PI / 2 },
            { dx: 0, dy: -1, angle: -Math.PI / 2 }
          ];

          directions.forEach(dir => {
            if (getHeightAt(entity.x + dir.dx * 100, entity.y + dir.dy * 100) === 0) {
              ctx.save();
              ctx.rotate(dir.angle);
              ctx.translate(w - 5, -h); // Move to the edge
              
              const fallDistance = 60; // How far the water falls
              
              // Water body
              const grad = ctx.createLinearGradient(0, 0, fallDistance, 0);
              grad.addColorStop(0, 'rgba(56, 189, 248, 0.8)'); // Light blue
              grad.addColorStop(1, 'rgba(2, 132, 199, 0.4)'); // Darker blue, fading
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, fallDistance, h * 2);
              
              // Foam streaks
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
              for (let i = 0; i < h * 2; i += 12) {
                const speed = 40 + (i % 3) * 10;
                const offset = (time * speed + i * 15) % fallDistance;
                const length = 10 + (i % 5) * 2;
                
                ctx.lineWidth = 1.5 + (i % 2);
                ctx.beginPath();
                ctx.moveTo(offset, i);
                ctx.lineTo(Math.min(fallDistance, offset + length), i);
                ctx.stroke();
              }
              
              // Splash at the bottom
              ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
              for (let i = 0; i < 8; i++) {
                const splashX = fallDistance - 5 + Math.random() * 10;
                const splashY = Math.random() * h * 2;
                const splashSize = 1 + Math.random() * 2;
                ctx.beginPath();
                ctx.arc(splashX, splashY, splashSize, 0, Math.PI * 2);
                ctx.fill();
              }
              
              ctx.restore();
            }
          });
        }
        ctx.restore();
      }
    });

    // Pass 3: Water Details (Bubbles and waves)
    pools.forEach(entity => {
      const ex = centerX + (entity.x - state.playerPosition.x);
      const ey = centerY + (entity.y - state.playerPosition.y);
      if (ex > -400 && ex < width + 400 && ey > -400 && ey < height + 400) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(entity.rotation || 0);
        
        // Bubbles
        ctx.fillStyle = 'rgba(74, 222, 128, 0.3)';
        for (let b = 0; b < 5; b++) {
          const bx = Math.sin(time + b * 10) * (entity.width || 100) * 0.3;
          const by = Math.cos(time * 0.7 + b * 5) * (entity.height || 60) * 0.3;
          ctx.beginPath();
          ctx.arc(bx, by, 2 + Math.sin(time + b) * 1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Waves
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.05)';
        ctx.lineWidth = 1;
        for (let w = 0; w < 2; w++) {
          const waveScale = 0.5 + w * 0.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, (entity.width || 100) / 2 * waveScale, (entity.height || 60) / 2 * waveScale, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    // Calculate shadow offset based on time of day
    const sunAngle = (state.timeOfDay / 120000) * Math.PI * 2;
    const shadowLength = 15 + Math.sin(sunAngle) * 10;
    const shadowOffsetX = Math.cos(sunAngle) * shadowLength;
    const shadowOffsetY = Math.sin(sunAngle) * shadowLength * 0.5;
    const shadowAlpha = state.isNight ? 0.1 : 0.2;

    // Draw Sandworm Warning
    if (sandwormWarning.current) {
      const wx = centerX + (sandwormWarning.current.x - state.playerPosition.x);
      const wy = centerY + (sandwormWarning.current.y - state.playerPosition.y);
      if (wx > -200 && wx < width + 200 && wy > -200 && wy < height + 200) {
        ctx.save();
        ctx.translate(wx, wy);
        
        // Pulsing warning circle
        const pulse = Math.abs(Math.sin(time * 10));
        ctx.fillStyle = `rgba(239, 68, 68, ${0.2 + pulse * 0.3})`; // Red pulse
        ctx.beginPath();
        ctx.arc(0, 0, 150, 0, Math.PI * 2);
        ctx.fill();
        
        // Warning border
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 + pulse * 4;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, 150, 0, Math.PI * 2);
        ctx.stroke();
        
        // Warning text
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`! DANGER ! ${(sandwormWarning.current.time / 1000).toFixed(1)}s`, 0, 0);
        
        ctx.restore();
      }
    }

    // Sort entities by Y for simple depth sorting
    const sortedEntities = [...state.entities].filter(e => e.type !== 'pool').sort((a, b) => a.y - b.y);

    sortedEntities.forEach(entity => {
      const ex = centerX + (entity.x - state.playerPosition.x);
      const ey = centerY + (entity.y - state.playerPosition.y);
      
      if (ex > -400 && ex < width + 400 && ey > -400 && ey < height + 400) {
        // Draw shadow
        if (entity.type !== 'island' && entity.type !== 'dropped_item' && !entity.isDead) {
          ctx.save();
          ctx.translate(ex + shadowOffsetX, ey + shadowOffsetY);
          ctx.scale(entity.scale || 1, entity.scale || 1);
          ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
          ctx.beginPath();
          if (entity.type === 'rock') {
            ctx.ellipse(0, 15, 30, 10, 0, 0, Math.PI * 2);
          } else if (entity.type === 'vegetation') {
            ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2);
          } else if (entity.type === 'monster') {
            const mType = entity.monsterType || 'normal';
            const scale = mType === 'evil-eye' ? 4 : (mType === 'six-legged' ? 3 : (mType === 'swarm' ? 0.8 : 1));
            ctx.ellipse(0, 0, 15 * scale, 8 * scale, 0, 0, Math.PI * 2);
          } else if (entity.type === 'chest') {
            ctx.ellipse(0, 10, 20, 8, 0, 0, Math.PI * 2);
          } else if (entity.type === 'crystal') {
            ctx.ellipse(0, 10, 15, 5, 0, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.restore();
        }

        if (entity.type === 'island') {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(entity.rotation || 0);
          
          // Island base (Ground color)
          ctx.fillStyle = '#e24d3b'; 
          ctx.beginPath();
          ctx.ellipse(0, 0, (entity.width || 80) / 2, (entity.height || 60) / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Island edge/shadow
          ctx.strokeStyle = '#991b1b';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          ctx.restore();
        } else if (entity.type === 'rock') {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.scale(entity.scale || 1, entity.scale || 1);
          
          if (entity.isDead) {
            ctx.globalAlpha = Math.max(0, 1 - (entity.deathProgress || 0) / 500);
          }

          // Mine drawing (Stable Mountain shape)
          const mineColor = '#4a2c5a'; 
          const mineHighlight = '#6b467d';
          const mineShadow = '#2d1b36';
          
          // Base
          ctx.fillStyle = mineShadow;
          ctx.beginPath();
          ctx.moveTo(-30, 15); ctx.lineTo(30, 15); ctx.lineTo(20, -25); ctx.lineTo(-20, -25);
          ctx.closePath(); ctx.fill();
          
          // Body
          ctx.fillStyle = mineColor;
          ctx.beginPath();
          ctx.moveTo(-25, 12); ctx.lineTo(25, 12); ctx.lineTo(15, -20); ctx.lineTo(-15, -20);
          ctx.closePath(); ctx.fill();
          
          // Top Highlight
          ctx.fillStyle = mineHighlight;
          ctx.beginPath();
          ctx.moveTo(-12, -12); ctx.lineTo(12, -12); ctx.lineTo(6, -18); ctx.lineTo(-6, -18);
          ctx.closePath(); ctx.fill();

          // Mining Progress Bar
          if (entity.miningProgress && entity.miningProgress > 0 && !entity.isDead) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(-20, -30, 40, 4);
            ctx.fillStyle = '#fde047';
            ctx.fillRect(-20, -30, 40 * (entity.miningProgress / 1000), 4);
          }
          
          ctx.restore();
        } else if (entity.type === 'crystal') {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.scale(entity.scale || 1, entity.scale || 1);

          if (entity.isDead) {
            ctx.globalAlpha = Math.max(0, 1 - (entity.deathProgress || 0) / 1000);
          }
          
          const crystalColor = '#67e8f9';
          const crystalGlow = 'rgba(103, 232, 249, 0.5)';
          
          // Glow
          ctx.shadowBlur = 15;
          ctx.shadowColor = crystalColor;
          
          // Draw multiple crystal shards
          for (let s = 0; s < 5; s++) {
            ctx.fillStyle = crystalColor;
            ctx.save();
            ctx.rotate((s - 2) * 0.3 + Math.sin(time * 0.5 + s) * 0.05);
            const h = 15 + s * 5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(4, -h * 0.8);
            ctx.lineTo(0, -h);
            ctx.lineTo(-4, -h * 0.8);
            ctx.closePath();
            ctx.fill();
            
            // Shard highlight
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(0, -h * 0.5);
            ctx.lineTo(1, -h * 0.8);
            ctx.lineTo(0, -h * 0.9);
            ctx.fill();
            ctx.restore();
          }
          ctx.shadowBlur = 0;
          ctx.restore();
        } else if (entity.type === 'food') {
          ctx.fillStyle = '#fb923c'; ctx.fillRect(ex - 8, ey - 8, 16, 16);
          ctx.fillStyle = '#ea580c'; ctx.fillRect(ex - 6, ey - 6, 12, 4);
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(ex - 8, ey - 8, 16, 16);
        } else if (entity.type === 'energy') {
          const pulse = Math.sin(time * 2) * 2;
          ctx.fillStyle = '#fde047'; ctx.shadowBlur = 15 + pulse; ctx.shadowColor = '#fde047';
          ctx.beginPath(); ctx.arc(ex, ey, 8 + pulse, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        } else if (entity.type === 'mineral') {
          ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(ex, ey - 12); ctx.lineTo(ex + 10, ey + 4); ctx.lineTo(ex - 10, ey + 4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(ex, ey - 12); ctx.lineTo(ex + 4, ey); ctx.lineTo(ex - 4, ey); ctx.fill();
        } else if (entity.type === 'monster') {
          ctx.save(); ctx.translate(ex, ey);
          const mType = entity.monsterType || 'normal';
          const scale = mType === 'sandworm' ? 1 : (mType === 'evil-eye' ? 4 : (mType === 'six-legged' ? 3 : (mType === 'swarm' ? 0.8 : 1)));
          ctx.scale(scale, scale);

          if (entity.isDead) {
            ctx.rotate(Math.min(Math.PI / 2, (entity.deathProgress || 0) / 1000 * (Math.PI / 2)));
            ctx.globalAlpha = Math.max(0, 1 - (entity.deathProgress || 0) / 1000);
          }

          if (entity.controlledMonsterId === 'controlled') {
            ctx.shadowColor = '#ec4899';
            ctx.shadowBlur = 15;
          }

          const isAttacking = entity.attackProgress && entity.attackProgress > 0;
          const attackOffset = isAttacking ? Math.sin(entity.attackProgress / 300 * Math.PI) * 15 : 0;

          if (mType === 'sandworm') {
            // Giant emerging mouth
            const emergeProgress = entity.attackProgress ? Math.min(1, (2000 - entity.attackProgress) / 500) : 1;
            const retreatProgress = entity.attackProgress ? Math.max(0, (entity.attackProgress) / 500) : 1;
            const visibleScale = Math.min(emergeProgress, retreatProgress);
            
            ctx.scale(visibleScale, visibleScale);
            
            // Outer ring
            ctx.fillStyle = '#78350f';
            ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.fill();
            
            // Inner mouth
            ctx.fillStyle = '#450a0a';
            ctx.beginPath(); ctx.arc(0, 0, 130, 0, Math.PI * 2); ctx.fill();
            
            // Teeth
            ctx.fillStyle = '#fef3c7';
            for (let i = 0; i < 36; i++) {
              ctx.save();
              ctx.rotate((i * Math.PI * 2) / 36 + time);
              ctx.beginPath();
              ctx.moveTo(110, -10);
              ctx.lineTo(130, 0);
              ctx.lineTo(110, 10);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
            
            // Deep center
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();
            
          } else if (mType === 'evil-eye') {
            ctx.fillStyle = '#2e1065'; ctx.beginPath(); ctx.arc(0, -10 + Math.sin(time * 2) * 5, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -10 + Math.sin(time * 2) * 5, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7e22ce'; ctx.beginPath(); ctx.arc(0, -10 + Math.sin(time * 2) * 5, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = entity.controlledMonsterId === 'controlled' ? '#ec4899' : '#2e1065'; ctx.lineWidth = 2;
            for (let t = 0; t < 6; t++) {
              ctx.beginPath(); ctx.moveTo(Math.cos(t) * 10, Math.sin(t) * 10 - 10);
              ctx.quadraticCurveTo(Math.cos(t) * 20, Math.sin(t) * 20 + 10, Math.cos(t + Math.sin(time) * 0.5) * 30, Math.sin(t + Math.sin(time) * 0.5) * 30 + 20);
              ctx.stroke();
            }
          } else if (mType === 'six-legged') {
            ctx.fillStyle = '#450a0a'; ctx.fillRect(-12 + attackOffset, -10, 24, 20);
            ctx.strokeStyle = entity.controlledMonsterId === 'controlled' ? '#ec4899' : '#ef4444'; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
              const angle = (i / 6) * Math.PI * 2;
              ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
              ctx.lineTo(Math.cos(angle + Math.sin(time * 5) * 0.2) * 25, Math.sin(angle + Math.sin(time * 5) * 0.2) * 25);
              ctx.stroke();
            }
          } else {
            ctx.fillStyle = mType === 'swarm' ? '#1e1b4b' : '#450a0a';
            ctx.fillRect(-12 + attackOffset, -10, 24, 20);
            ctx.strokeStyle = entity.controlledMonsterId === 'controlled' ? '#ec4899' : (mType === 'swarm' ? '#6366f1' : '#ef4444'); ctx.lineWidth = 3;
            const legMove = Math.sin(time + (entity.x + entity.y) * 0.1) * 5;
            for (let i = 0; i < 3; i++) {
              ctx.beginPath(); ctx.moveTo(-12 + attackOffset, -8 + i * 8); ctx.lineTo(-20 + attackOffset + (i === 1 ? -legMove : legMove), -12 + i * 12); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(12 + attackOffset, -8 + i * 8); ctx.lineTo(20 + attackOffset + (i === 1 ? legMove : -legMove), -12 + i * 12); ctx.stroke();
            }
            ctx.fillStyle = entity.controlledMonsterId === 'controlled' ? '#ec4899' : (mType === 'swarm' ? '#6366f1' : '#ef4444'); ctx.fillRect(8 + attackOffset, -6, 6, 6);
          }

          if (!entity.isDead) {
            ctx.fillStyle = '#000'; ctx.fillRect(-12, -20, 24, 4);
            ctx.fillStyle = '#10b981'; ctx.fillRect(-12, -20, 24 * ((entity.health || 100) / (entity.maxHealth || 100)), 4);
          }
          ctx.restore();
        } else if (entity.type === 'building') {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.scale(entity.scale || 1, entity.scale || 1);
          
          const isBuilding = entity.buildProgress !== undefined && entity.buildProgress < 1000;
          if (isBuilding) {
            ctx.globalAlpha = 0.5 + (entity.buildProgress! / 1000) * 0.5;
          }

          if (entity.buildingType === 'teleport-tower') {
            // Base
            ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(20, -10); ctx.lineTo(25, 0); ctx.lineTo(-25, 0); ctx.fill();
            // Pillars
            ctx.fillStyle = '#3b82f6'; ctx.fillRect(-15, -45, 6, 35); ctx.fillRect(9, -45, 6, 35);
            // Energy Core
            const pulse = Math.sin(time * 5) * 2;
            ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.arc(0, -25, 8 + pulse, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#bfdbfe'; ctx.beginPath(); ctx.arc(0, -25, 4 + pulse, 0, Math.PI * 2); ctx.fill();
            // Top Arch
            ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -45, 12, Math.PI, 0); ctx.stroke();
            
            if (!isBuilding && Math.sqrt(Math.pow(centerX - ex, 2) + Math.pow(centerY - ey, 2)) < 50) {
              ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('TELEPORT [R]', 0, 20);
            }
          } else if (entity.buildingType === 'mech-miner-institute') {
            // Factory Base
            ctx.fillStyle = '#334155'; ctx.fillRect(-30, -20, 60, 20);
            ctx.fillStyle = '#1e293b'; ctx.fillRect(-35, 0, 70, 5);
            // Chimneys
            ctx.fillStyle = '#475569'; ctx.fillRect(-20, -40, 8, 20); ctx.fillRect(12, -35, 8, 15);
            // Smoke
            ctx.fillStyle = 'rgba(148, 163, 184, 0.5)'; ctx.beginPath(); ctx.arc(-16, -45 - (time % 10), 6, 0, Math.PI * 2); ctx.fill();
            // Conveyor Belt / Door
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-10, -15, 20, 15);
            ctx.fillStyle = '#10b981'; ctx.fillRect(-8, -13, 16, 2); // Glowing light above door
          } else if (entity.buildingType === 'turret') {
            // Base
            ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.moveTo(-15, -10); ctx.lineTo(15, -10); ctx.lineTo(20, 0); ctx.lineTo(-20, 0); ctx.fill();
            // Mount
            ctx.fillStyle = '#334155'; ctx.fillRect(-10, -20, 20, 10);
            // Dome
            ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(0, -20, 12, Math.PI, 0); ctx.fill();
            // Barrel (pointing right/up slightly)
            ctx.save();
            ctx.translate(0, -20);
            ctx.rotate(-Math.PI / 6); // Fixed angle for visual
            ctx.fillStyle = '#64748b'; ctx.fillRect(0, -4, 25, 8);
            ctx.fillStyle = '#f97316'; ctx.fillRect(20, -3, 6, 6); // Muzzle
            ctx.restore();
          } else if (entity.buildingType === 'laser-tower') {
            // Base
            ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.moveTo(-15, -10); ctx.lineTo(15, -10); ctx.lineTo(20, 0); ctx.lineTo(-20, 0); ctx.fill();
            // Spire
            ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.lineTo(4, -45); ctx.lineTo(-4, -45); ctx.fill();
            // Glowing Core
            const glow = Math.sin(time * 8) * 3;
            ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.arc(0, -50, 8 + glow, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.arc(0, -50, 4, 0, Math.PI * 2); ctx.fill();
            // Energy Rings
            ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(0, -30, 12, 4, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(0, -20, 14, 4, 0, 0, Math.PI * 2); ctx.stroke();
          } else if (entity.buildingType === 'mind-control-tower') {
            // Alien Base
            ctx.fillStyle = '#1e1b4b'; ctx.beginPath(); ctx.moveTo(-20, -5); ctx.lineTo(20, -5); ctx.lineTo(15, 0); ctx.lineTo(-15, 0); ctx.fill();
            // Stem
            ctx.fillStyle = '#312e81'; ctx.fillRect(-6, -35, 12, 30);
            // Brain/Dome
            const pulse = Math.sin(time * 3) * 2;
            ctx.fillStyle = '#6366f1'; ctx.beginPath(); ctx.arc(0, -40, 14 + pulse, 0, Math.PI * 2); ctx.fill();
            // Neural nodes
            ctx.fillStyle = '#a78bfa';
            ctx.beginPath(); ctx.arc(-6, -45, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(6, -42, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -35, 3, 0, Math.PI * 2); ctx.fill();
            // Floating Ring
            ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(0, -40 + Math.sin(time * 2) * 5, 20, 6, 0, 0, Math.PI * 2); ctx.stroke();
            
            // Draw Charm Ray
            if (entity.controlledMonsterId) {
              const target = state.entities.find(e => e.id === entity.controlledMonsterId);
              if (target) {
                const targetEx = centerX + (target.x - state.playerPosition.x);
                const targetEy = centerY + (target.y - state.playerPosition.y);
                const relX = targetEx - ex;
                const relY = targetEy - ey;
                
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(0, -40);
                
                // Wavy flowing ray
                const dist = Math.hypot(relX, relY + 40);
                const angle = Math.atan2(relY + 40, relX);
                const segments = 20;
                for (let i = 0; i <= segments; i++) {
                  const t = i / segments;
                  const x = t * dist;
                  const wave = Math.sin(t * Math.PI * 6 - time * 15) * 12; // Wavy amplitude
                  const px = Math.cos(angle) * x - Math.sin(angle) * wave;
                  const py = -40 + Math.sin(angle) * x + Math.cos(angle) * wave;
                  ctx.lineTo(px, py);
                }
                
                ctx.strokeStyle = '#f472b6'; // Brighter pink
                ctx.lineWidth = 3 + Math.sin(time * 10);
                ctx.shadowColor = '#fbcfe8';
                ctx.shadowBlur = 20;
                ctx.stroke();
                
                // Inner core for brightness
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.shadowBlur = 0;
                ctx.stroke();
                
                ctx.restore();
              }
            }
          }
          
          if (isBuilding) {
            ctx.fillStyle = '#000'; ctx.fillRect(-15, 5, 30, 4);
            ctx.fillStyle = '#fde047'; ctx.fillRect(-15, 5, 30 * (entity.buildProgress! / 1000), 4);
          } else if (entity.health !== undefined && entity.maxHealth !== undefined) {
            ctx.fillStyle = '#000'; ctx.fillRect(-15, 5, 30, 4);
            ctx.fillStyle = '#10b981'; ctx.fillRect(-15, 5, 30 * (entity.health / entity.maxHealth), 4);
          }
          ctx.restore();
        } else if (entity.type === 'mech-miner') {
          ctx.save();
          const hover = Math.sin(time * 3) * 5;
          ctx.translate(ex, ey + hover);
          ctx.rotate(entity.rotation || 0);
          
          // Body
          ctx.fillStyle = '#475569';
          ctx.fillRect(-10, -8, 20, 16);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-8, -6, 16, 12);
          
          // Rotors/Thrusters
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-14, -12, 8, 8);
          ctx.fillRect(-14, 4, 8, 8);
          ctx.fillRect(6, -12, 8, 8);
          ctx.fillRect(6, 4, 8, 8);
          
          // Spinning blades (visual only)
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          for (let i = 0; i < 4; i++) {
            const bx = i < 2 ? -10 : 10;
            const by = i % 2 === 0 ? -8 : 8;
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(time * 10);
            ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
            ctx.restore();
          }
          
          // Eye/Sensor
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(6, -2, 4, 4);
          
          // Cargo indicator
          const cargoFill = (entity.carriedMinerals || 0) / 50;
          ctx.fillStyle = '#000';
          ctx.fillRect(-6, 2, 12, 4);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(-6, 2, 12 * cargoFill, 4);

          // Night Light
          if (state.isNight) {
            ctx.save();
            const gradient = ctx.createRadialGradient(15, 0, 0, 15, 0, 80);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(80, -40);
            ctx.lineTo(80, 40);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          
          ctx.restore();
        } else if (entity.type === 'chest') {
          ctx.save();
          ctx.translate(ex, ey);
          
          // Hover effect if not opened
          const hover = entity.isOpened ? 0 : Math.sin(time * 3) * 3;
          ctx.translate(0, hover);

          if (entity.isOpened) {
            // Opened state: dull, empty crate
            ctx.fillStyle = '#1e293b'; // slate-800
            ctx.beginPath();
            ctx.moveTo(-18, -5); ctx.lineTo(18, -5); ctx.lineTo(14, 10); ctx.lineTo(-14, 10); ctx.fill();
            ctx.fillStyle = '#0f172a'; // slate-900
            ctx.beginPath();
            ctx.moveTo(-16, -15); ctx.lineTo(16, -15); ctx.lineTo(18, -5); ctx.lineTo(-18, -5); ctx.fill();
          } else {
            // Closed state: glowing sci-fi crate
            ctx.fillStyle = '#334155'; // slate-700
            ctx.beginPath();
            ctx.moveTo(-16, -12); ctx.lineTo(16, -12); ctx.lineTo(20, 0); ctx.lineTo(16, 12); ctx.lineTo(-16, 12); ctx.lineTo(-20, 0); ctx.fill();
            
            // Inner panel
            ctx.fillStyle = '#1e293b'; // slate-800
            ctx.beginPath();
            ctx.moveTo(-12, -8); ctx.lineTo(12, -8); ctx.lineTo(15, 0); ctx.lineTo(12, 8); ctx.lineTo(-12, 8); ctx.lineTo(-15, 0); ctx.fill();
            
            // Glowing lines
            ctx.strokeStyle = '#0ea5e9'; // sky-500
            ctx.lineWidth = 2;
            ctx.shadowColor = '#0ea5e9';
            ctx.shadowBlur = 10 + Math.sin(time * 5) * 5;
            ctx.beginPath();
            ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
            ctx.moveTo(0, -4); ctx.lineTo(0, 4);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          
          ctx.restore();

          if (Math.sqrt(Math.pow(centerX - ex, 2) + Math.pow(centerY - ey, 2)) < 60 && !entity.isOpened) {
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('PRESS [F]', ex, ey + 30);
          }
        } else if (entity.type === 'dropped_item') {
          const colors = { food: '#fb923c', energy: '#fde047', mineral: '#94a3b8', fuel: '#10b981', oxygen: '#06b6d4' };
          ctx.fillStyle = colors[entity.content as keyof typeof colors] || '#fff';
          ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
          if (Math.sqrt(Math.pow(centerX - ex, 2) + Math.pow(centerY - ey, 2)) < 50) {
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('PICKUP [F]', ex, ey + 25);
          }
        } else if (entity.type === 'stalactite') {
          ctx.save(); ctx.translate(ex, ey); ctx.scale(entity.scale || 1, entity.scale || 1);
          ctx.rotate(entity.rotation || 0);

          if (entity.isDead) {
            ctx.globalAlpha = Math.max(0, 1 - (entity.deathProgress || 0) / 1000);
          }
          
          // Draw stalactite (looks like a sharp rock pointing downwards/upwards)
          ctx.fillStyle = '#52525b'; // Zinc-600
          ctx.beginPath();
          ctx.moveTo(-15, 0);
          ctx.lineTo(15, 0);
          ctx.lineTo(5, -40);
          ctx.lineTo(-5, -40);
          ctx.closePath();
          ctx.fill();
          
          // Highlight
          ctx.fillStyle = '#71717a'; // Zinc-500
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(15, 0);
          ctx.lineTo(5, -40);
          ctx.closePath();
          ctx.fill();
          
          ctx.restore();
        } else if (entity.type === 'vegetation') {
          ctx.save(); ctx.translate(ex, ey); ctx.scale(entity.scale || 1, entity.scale || 1);
          
          // Draw a cluster of alien plants instead of just one
          const seed = entity.x * 123.45 + entity.y * 67.89;
          const clusterSize = 3 + Math.floor(Math.abs(Math.sin(seed)) * 4);
          
          for (let i = 0; i < clusterSize; i++) {
            ctx.save();
            const offsetX = Math.sin(seed + i) * 20;
            const offsetY = Math.cos(seed + i) * 20;
            ctx.translate(offsetX, offsetY);
            ctx.scale(0.5 + Math.abs(Math.sin(seed + i * 2)) * 0.8, 0.5 + Math.abs(Math.cos(seed + i * 2)) * 0.8);
            
            if (entity.vegetationType === 0) {
              // Glowing bulbous plant
              ctx.fillStyle = '#4c1d95'; // Dark purple stem
              ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(5, -15, 0, -30); ctx.lineTo(2, -30); ctx.quadraticCurveTo(7, -15, 2, 0); ctx.fill();
              ctx.fillStyle = '#a855f7'; // Purple bulb
              ctx.shadowBlur = 10; ctx.shadowColor = '#a855f7';
              ctx.beginPath(); ctx.ellipse(1, -30, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
              ctx.shadowBlur = 0;
            } else if (entity.vegetationType === 1) {
              // Tentacle-like fern
              ctx.strokeStyle = '#059669'; ctx.lineWidth = 3; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(15, -15, -15, -30, 5, -45); ctx.stroke();
              ctx.fillStyle = '#10b981';
              for(let j = 0; j < 4; j++) {
                ctx.beginPath(); ctx.arc(Math.sin(j) * 5, -10 - j * 10, 2, 0, Math.PI * 2); ctx.fill();
              }
            } else if (entity.vegetationType === 3) {
              // Giant alien tree (Forest)
              ctx.fillStyle = '#064e3b'; // Very dark green trunk
              ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.lineTo(2, -40); ctx.lineTo(-2, -40); ctx.fill();
              ctx.fillStyle = '#10b981'; // Emerald leaves
              ctx.beginPath(); ctx.arc(0, -45, 20, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#34d399';
              ctx.beginPath(); ctx.arc(-5, -50, 15, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(8, -40, 12, 0, Math.PI * 2); ctx.fill();
            } else if (entity.vegetationType === 4) {
              // Spore tree (Forest)
              ctx.strokeStyle = '#831843'; ctx.lineWidth = 4; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -35); ctx.stroke();
              ctx.fillStyle = '#f43f5e'; // Rose spore cap
              ctx.beginPath(); ctx.ellipse(0, -35, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#fda4af';
              for(let j=0; j<5; j++) {
                ctx.beginPath(); ctx.arc((Math.random()-0.5)*20, -35 + (Math.random()-0.5)*10, 2, 0, Math.PI*2); ctx.fill();
              }
            } else if (entity.vegetationType === 5) {
              // Glowing vines (Forest)
              ctx.strokeStyle = '#047857'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -15, 0, -30); ctx.quadraticCurveTo(-10, -45, 5, -60); ctx.stroke();
              ctx.fillStyle = '#6ee7b7'; ctx.shadowBlur = 5; ctx.shadowColor = '#6ee7b7';
              ctx.beginPath(); ctx.arc(0, -30, 3, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.arc(5, -60, 4, 0, Math.PI*2); ctx.fill();
              ctx.shadowBlur = 0;
            } else if (entity.vegetationType === 6) {
              // Giant Cactus (Desert)
              ctx.fillStyle = '#166534'; // Green
              ctx.beginPath(); ctx.roundRect(-6, -40, 12, 40, 6); ctx.fill();
              ctx.beginPath(); ctx.roundRect(-15, -25, 8, 15, 4); ctx.fill(); // Left arm
              ctx.beginPath(); ctx.roundRect(-15, -25, 15, 6, 3); ctx.fill();
              ctx.beginPath(); ctx.roundRect(7, -30, 8, 12, 4); ctx.fill(); // Right arm
              ctx.beginPath(); ctx.roundRect(0, -30, 15, 6, 3); ctx.fill();
              // Spikes
              ctx.fillStyle = '#fcd34d';
              for(let j=0; j<10; j++) {
                ctx.fillRect(-6 + Math.random()*12, -40 + Math.random()*35, 2, 1);
              }
            } else if (entity.vegetationType === 7) {
              // Dry bush (Desert)
              ctx.strokeStyle = '#b45309'; ctx.lineWidth = 2;
              for(let j=0; j<5; j++) {
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo((Math.random()-0.5)*30, -10 - Math.random()*20); ctx.stroke();
              }
            } else {
              // Crystal flower (Normal)
              ctx.fillStyle = '#0891b2';
              for (let j = 0; j < 5; j++) { 
                ctx.rotate(Math.PI * 2 / 5); 
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, -15); ctx.lineTo(-4, -15); ctx.closePath(); ctx.fill(); 
              }
              ctx.fillStyle = '#22d3ee';
              ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
          }
          ctx.restore();
        }
      }
    });

    const podScreenX = centerX + (state.podPosition.x - state.playerPosition.x);
    const podScreenY = centerY + (state.podPosition.y - state.playerPosition.y);
    let currentPodY = podScreenY;
    if (state.status === 'landing') {
      currentPodY = -100 + (podScreenY + 100) * landingProgress.current;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(podScreenX, podScreenY + 30, 40 * landingProgress.current, 20 * landingProgress.current, 0, 0, Math.PI * 2); ctx.fill();
    }
    
    // Draw Pod (VANGUARD-01)
    ctx.save();
    ctx.translate(podScreenX, currentPodY);
    
    // Pod Shadow
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(shadowOffsetX, 45 + shadowOffsetY, 35, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pod Body
    const podColor = state.resources.energy > 0 ? '#94a3b8' : '#475569';
    const podHighlight = '#cbd5e1';
    const podDark = '#334155';
    
    ctx.fillStyle = podDark;
    ctx.beginPath();
    ctx.moveTo(-35, 40); ctx.lineTo(35, 40); ctx.lineTo(25, -30); ctx.lineTo(-25, -30);
    ctx.closePath(); ctx.fill();
    
    ctx.fillStyle = podColor;
    ctx.beginPath();
    ctx.moveTo(-30, 35); ctx.lineTo(30, 35); ctx.lineTo(20, -25); ctx.lineTo(-20, -25);
    ctx.closePath(); ctx.fill();
    
    // Window/Cockpit
    ctx.fillStyle = state.resources.energy > 0 ? '#0ea5e9' : '#1e293b';
    ctx.fillRect(-15, -15, 30, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(-12, -12, 10, 5);
    
    // Antenna
    ctx.strokeStyle = podDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -50); ctx.stroke();
    if (state.resources.energy > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(0, -50 + Math.sin(time * 2) * 2, 3, 0, Math.PI * 2); ctx.fill();
    }

    if (state.resources.energy > 0) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'; ctx.setLineDash([10, 10]); 
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 80 + Math.sin(time) * 5, 0, Math.PI * 2); ctx.stroke(); 
      ctx.setLineDash([]);

      // Upgrade Prompt
      const distToPod = Math.sqrt(Math.pow(state.playerPosition.x - state.podPosition.x, 2) + Math.pow(state.playerPosition.y - state.podPosition.y, 2));
      if (distToPod < 60 && state.status === 'exploring') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS [F] TO UPGRADE', 0, 70);
      }
    }
    ctx.restore();

    if (state.status === 'exploring' || (state.status === 'landing' && landingProgress.current === 1)) {
      const playerX = state.status === 'landing' ? podScreenX + (playerOutProgress.current * 60) : centerX;
      const playerY = state.status === 'landing' ? podScreenY : centerY;
      
      ctx.save();
      ctx.translate(playerX, playerY);
      
      // Player Shadow
      ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(shadowOffsetX, 15 + shadowOffsetY, 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Check if player is on water for rendering boat
      let playerInWater = false;
      let playerInIsland = false;
      for (const entity of state.entities) {
        if (entity.type === 'pool' || entity.type === 'island') {
          const dx = state.playerPosition.x - entity.x;
          const dy = state.playerPosition.y - entity.y;
          const rx = (entity.width || 100) / 2;
          const ry = (entity.height || 60) / 2;
          const cos = Math.cos(-(entity.rotation || 0));
          const sin = Math.sin(-(entity.rotation || 0));
          const rotatedX = dx * cos - dy * sin;
          const rotatedY = dx * sin + dy * cos;
          if ((rotatedX * rotatedX) / (rx * rx) + (rotatedY * rotatedY) / (ry * ry) <= 1) {
            if (entity.type === 'pool') playerInWater = true;
            if (entity.type === 'island') playerInIsland = true;
          }
        }
      }
      const isActuallyInWater = playerInWater && !playerInIsland;

      // Boat Rendering
      if (isActuallyInWater && !state.isBoosting && state.upgrades.hasBoat) {
        ctx.fillStyle = '#78350f'; // Brown boat
        ctx.beginPath();
        ctx.moveTo(-20, 10); ctx.lineTo(20, 10); ctx.lineTo(25, 25); ctx.lineTo(-25, 25);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#451a03'; ctx.lineWidth = 2; ctx.stroke();
      }

      if (state.isBoosting) { 
        ctx.fillStyle = '#f97316'; 
        ctx.shadowBlur = 15; ctx.shadowColor = '#f97316';
        ctx.beginPath(); ctx.arc(0, 20, 8 + Math.random() * 8, 0, Math.PI * 2); ctx.fill(); 
        ctx.shadowBlur = 0;
      }
      
      // Astronaut Body
      ctx.fillStyle = '#f8fafc'; // White suit
      ctx.fillRect(-10, -15, 20, 30);
      
      // Visor
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-7, -12, 14, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(-5, -10, 4, 3);
      
      // Backpack
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-12, -10, 4, 20);
      
      // Details
      ctx.fillStyle = '#10b981'; // Green accent
      ctx.fillRect(-10, 5, 20, 4);
      
      if (state.upgrades.weaponSystem > 0) { 
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)'; 
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 200, 0, Math.PI * 2); ctx.stroke(); 
      }

      ctx.restore();
    }

    // Night Tint
    if (state.nightProgress > 0) {
      ctx.save();
      // Deep blue/purple atmospheric tint
      ctx.globalCompositeOperation = 'multiply';
      // Interpolate between white (no effect in multiply) and the dark night color
      // #2e3159 is rgb(46, 49, 89)
      const r = Math.floor(255 - (255 - 46) * state.nightProgress);
      const g = Math.floor(255 - (255 - 49) * state.nightProgress);
      const b = Math.floor(255 - (255 - 89) * state.nightProgress);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`; 
      ctx.fillRect(0, 0, width, height);
      
      // Vignette effect
      ctx.globalCompositeOperation = 'source-over';
      const gradient = ctx.createRadialGradient(centerX, centerY, 300, centerX, centerY, Math.max(width, height));
      gradient.addColorStop(0, `rgba(10, 5, 30, 0)`);
      gradient.addColorStop(1, `rgba(5, 2, 15, ${0.5 * state.nightProgress})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Add bioluminescent ambient glow
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(40, 30, 100, ${0.2 * state.nightProgress})`;
      ctx.fillRect(0, 0, width, height);
      
      ctx.restore();
    }

    // Lighting Pass (rendered over Night Tint)
    if (state.nightProgress > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      
      // Plant and Crystal lights
      sortedEntities.forEach(entity => {
        if (entity.type === 'vegetation') {
          const ex = centerX + (entity.x - state.playerPosition.x);
          const ey = centerY + (entity.y - state.playerPosition.y);
          if (ex > -400 && ex < width + 400 && ey > -400 && ey < height + 400) {
            ctx.save();
            ctx.translate(ex, ey);
            
            // Pulsing effect based on time
            const pulse = 1 + Math.sin(time * 2 + entity.x) * 0.1;
            
            let r, g, b;
            if (entity.vegetationType === 0) {
              r = 168; g = 85; b = 247; // Purple
            } else if (entity.vegetationType === 1) {
              r = 16; g = 185; b = 129; // Green
            } else {
              r = 34; g = 211; b = 238; // Cyan
            }
            
            ctx.scale(entity.scale || 1, entity.scale || 1);
            ctx.shadowBlur = 15 * pulse;
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${state.nightProgress})`;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.8 * state.nightProgress})`;
            ctx.lineWidth = 3;
            ctx.fillStyle = 'transparent';

            if (entity.vegetationType === 0) {
              // Stroke the bulb
              ctx.beginPath(); ctx.ellipse(1, -30, 8, 12, 0, 0, Math.PI * 2); ctx.stroke();
              // Fill the bulb with a soft glow
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.4 * state.nightProgress})`;
              ctx.fill();
            } else if (entity.vegetationType === 1) {
              // Stroke the tentacle
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(15, -15, -15, -30, 5, -45); ctx.stroke();
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.6 * state.nightProgress})`;
              for(let j = 0; j < 4; j++) {
                ctx.beginPath(); ctx.arc(Math.sin(j) * 5, -10 - j * 10, 3, 0, Math.PI * 2); ctx.fill();
              }
            } else {
              // Stroke the crystal flower
              for (let j = 0; j < 5; j++) { 
                ctx.rotate(Math.PI * 2 / 5); 
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, -15); ctx.lineTo(-4, -15); ctx.closePath(); ctx.stroke(); 
              }
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.8 * state.nightProgress})`;
              ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;
            
            // Tiny floating light particles around plants
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.9 * state.nightProgress})`;
            for(let p = 0; p < 3; p++) {
              const px = Math.sin(time + p * 2 + entity.x) * 20;
              const py = Math.cos(time * 0.8 + p * 3 + entity.y) * 20 - 15;
              ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
            }
            
            ctx.restore();
          }
        } else if (entity.type === 'crystal') {
          const ex = centerX + (entity.x - state.playerPosition.x);
          const ey = centerY + (entity.y - state.playerPosition.y);
          if (ex > -400 && ex < width + 400 && ey > -400 && ey < height + 400) {
            ctx.save();
            ctx.translate(ex, ey);
            
            const pulse = 1 + Math.sin(time * 3 + entity.x) * 0.15;
            const radius = 60 * pulse;
            
            const gradient = ctx.createRadialGradient(0, -10, 0, 0, -10, radius);
            // Cyan/Blue glow for crystals
            gradient.addColorStop(0, `rgba(6, 182, 212, ${0.9 * state.nightProgress})`);
            gradient.addColorStop(0.4, `rgba(14, 165, 233, ${0.4 * state.nightProgress})`);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath(); ctx.arc(0, -10, radius, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
        } else if (entity.type === 'monster' && !entity.isDead) {
          const ex = centerX + (entity.x - state.playerPosition.x);
          const ey = centerY + (entity.y - state.playerPosition.y);
          if (ex > -400 && ex < width + 400 && ey > -400 && ey < height + 400) {
            ctx.save();
            ctx.translate(ex, ey);
            ctx.rotate(entity.rotation || 0);
            
            const mType = entity.monsterType || 'normal';
            const scale = mType === 'evil-eye' ? 4 : (mType === 'six-legged' ? 3 : (mType === 'swarm' ? 0.8 : 1));
            ctx.scale(scale, scale);
            
            // Glowing red eyes
            ctx.fillStyle = `rgba(239, 68, 68, ${0.9 * state.nightProgress})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ef4444';
            
            if (mType === 'evil-eye') {
              ctx.beginPath(); ctx.arc(0, -5, 4, 0, Math.PI * 2); ctx.fill();
            } else if (mType === 'six-legged') {
              ctx.beginPath(); ctx.arc(5, -5, 2, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(-5, -5, 2, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(10, -2, 1.5, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(-10, -2, 1.5, 0, Math.PI * 2); ctx.fill();
            } else {
              ctx.beginPath(); ctx.arc(3, -5, 2, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(-3, -5, 2, 0, Math.PI * 2); ctx.fill();
            }
            
            ctx.restore();
          }
        }
      });

      // Pod light (Warm, safe beacon)
      ctx.save();
      ctx.translate(podScreenX, currentPodY);
      const podPulse = 1 + Math.sin(time * 3) * 0.05;
      const podRadius = 250 * podPulse;
      const podGradient = ctx.createRadialGradient(0, -20, 0, 0, -20, podRadius);
      // Warm amber/cyan mix for sci-fi feel
      podGradient.addColorStop(0, `rgba(14, 165, 233, ${0.7 * state.nightProgress})`); // Cyan core
      podGradient.addColorStop(0.2, `rgba(56, 189, 248, ${0.4 * state.nightProgress})`);
      podGradient.addColorStop(0.6, `rgba(2, 132, 199, ${0.1 * state.nightProgress})`);
      podGradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = podGradient;
      ctx.beginPath(); ctx.arc(0, -20, podRadius, 0, Math.PI * 2); ctx.fill();
      
      // Pod beacon light
      ctx.fillStyle = `rgba(239, 68, 68, ${state.nightProgress * (0.5 + Math.sin(time * 5) * 0.5)})`;
      ctx.beginPath(); ctx.arc(0, -50, 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Player light (Ambient + Glowing Visor)
      if (state.status === 'exploring' || (state.status === 'landing' && landingProgress.current === 1)) {
        const playerX = state.status === 'landing' ? podScreenX + (playerOutProgress.current * 60) : centerX;
        const playerY = state.status === 'landing' ? podScreenY : centerY;
        ctx.save();
        ctx.translate(playerX, playerY);
        
        // Ambient glow around player
        const playerAmbient = ctx.createRadialGradient(0, 0, 0, 0, 0, 250);
        playerAmbient.addColorStop(0, `rgba(255, 255, 255, ${0.5 * state.nightProgress})`);
        playerAmbient.addColorStop(0.3, `rgba(200, 220, 255, ${0.2 * state.nightProgress})`);
        playerAmbient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = playerAmbient;
        ctx.beginPath(); ctx.arc(0, 0, 250, 0, Math.PI * 2); ctx.fill();
        
        // Glowing Visor
        ctx.globalCompositeOperation = 'source-over'; // Draw solid over the screen mode
        ctx.fillStyle = `rgba(56, 189, 248, ${0.9 * state.nightProgress})`; // Cyan glowing visor
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#38bdf8';
        ctx.fillRect(-7, -12, 14, 10);
        
        // Visor reflection
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * state.nightProgress})`;
        ctx.fillRect(-5, -10, 4, 3);
        ctx.shadowBlur = 0;
        
        ctx.restore();
      }

      ctx.restore();
    }

    // Draw Bullets & Missiles
    state.bullets.forEach(b => {
      const bx = centerX + (b.x - state.playerPosition.x);
      const by = centerY + (b.y - state.playerPosition.y);
      
      if ((b as any).isLaser) {
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#67e8f9';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + b.vx * 200, by + b.vy * 200); // Draw a long line
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = (b as any).isCannon ? '#f97316' : '#10b981';
        ctx.shadowBlur = 10;
        ctx.shadowColor = (b as any).isCannon ? '#f97316' : '#10b981';
        ctx.beginPath();
        ctx.arc(bx, by, (b as any).isCannon ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    state.missiles.forEach(m => {
      const mx = centerX + (m.x - state.playerPosition.x);
      const my = centerY + (m.y - state.playerPosition.y);
      
      if (m.isExploding) {
        const progress = m.explosionProgress! / 500;
        ctx.fillStyle = `rgba(168, 85, 247, ${1 - progress})`;
        ctx.beginPath(); ctx.arc(mx, my, 40 * progress, 0, Math.PI * 2); ctx.fill();
        
        // Particles
        ctx.fillStyle = `rgba(216, 180, 254, ${1 - progress})`;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + m.rotation;
          const dist = 50 * progress;
          ctx.beginPath();
          ctx.arc(mx + Math.cos(angle) * dist, my + Math.sin(angle) * dist, 3 * (1 - progress), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.save(); ctx.translate(mx, my); ctx.rotate(m.rotation);
        ctx.fillStyle = '#a855f7'; ctx.shadowBlur = 10; ctx.shadowColor = '#a855f7';
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 5); ctx.lineTo(-5, -5); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.restore();
      }
    });

    // Draw Build Progress UI
    if (buildHoldTimer.current > 0) {
      const progress = Math.min(1, buildHoldTimer.current / BUILD_HOLD_DURATION);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(centerX - 20, centerY - 40, 40, 6);
      ctx.fillStyle = '#10b981'; // Emerald
      ctx.fillRect(centerX - 20, centerY - 40, 40 * progress, 6);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(centerX - 20, centerY - 40, 40, 6);
      
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BUILDING...', centerX, centerY - 45);
    }

    // Draw Teleport Progress UI
    if (teleportHoldTimer.current > 0) {
      const progress = Math.min(1, teleportHoldTimer.current / TELEPORT_HOLD_DURATION);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(centerX - 20, centerY - 40, 40, 6);
      ctx.fillStyle = '#a855f7'; // Purple
      ctx.fillRect(centerX - 20, centerY - 40, 40 * progress, 6);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(centerX - 20, centerY - 40, 40, 6);
      
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TELEPORTING...', centerX, centerY - 45);
    }

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Adjust target zoom based on wheel delta
      targetZoom.current = Math.max(1, Math.min(2, targetZoom.current - e.deltaY * 0.001));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    let animationFrameId: number;
    const render = (time: number) => {
      const deltaTime = time - lastTime.current;
      lastTime.current = time;
      update(deltaTime > 100 ? 16 : deltaTime);
      draw(ctx, gameStateRef.current);
      animationFrameId = requestAnimationFrame(render);
    };
    animationFrameId = requestAnimationFrame(render);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-inner">
      <canvas ref={canvasRef} width={1600} height={900} className="w-full h-full image-render-pixel" style={{ imageRendering: 'pixelated' }} />
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="px-2 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[10px] font-mono text-emerald-500 flex items-center gap-1">
          <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", gameState.isNight ? "bg-blue-500" : "bg-emerald-500")} />
          {gameState.isNight ? 'NIGHT_CYCLE' : 'DAY_CYCLE'}: {Math.floor((gameState.isNight ? 120000 - gameState.timeOfDay : 60000 - gameState.timeOfDay) / 1000)}s
        </div>
        {gameState.status === 'exploring' && (
          <div className="px-2 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[10px] font-mono text-white/60">
            WASD 移动 | SPACE 飞行器 | F 交互 | 靠近船舱补给 & 上供矿物
          </div>
        )}
      </div>

      {gameState.status === 'exploring' && (
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl min-w-[160px]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">矿物承载量</span>
              <span className={cn("text-xs font-mono font-bold", gameState.carriedMinerals >= gameState.maxCarryCapacity ? "text-red-500" : "text-slate-300")}>
                {Math.floor(gameState.carriedMinerals)} / {gameState.maxCarryCapacity}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className={cn("h-full transition-all duration-300", gameState.carriedMinerals >= gameState.maxCarryCapacity ? "bg-red-500" : "bg-slate-400")}
                initial={{ width: 0 }}
                animate={{ width: `${(gameState.carriedMinerals / gameState.maxCarryCapacity) * 100}%` }}
              />
            </div>
            {gameState.carriedMinerals >= gameState.maxCarryCapacity && (
              <div className="mt-2 text-[9px] font-mono text-red-500 animate-pulse flex items-center gap-1">
                <AlertTriangle size={10} /> 负重已满，请返回船舱上供
              </div>
            )}
          </div>

          {gameState.buildingInventory.length > 0 && (
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl min-w-[160px] flex flex-col gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">建筑库存 (按1-9选择, B放置)</span>
              {gameState.buildingInventory.map((building, idx) => (
                <div key={building.id} className={cn(
                  "px-2 py-1 text-xs font-mono rounded border transition-colors",
                  gameState.selectedBuildingIndex === idx ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-white/5 border-white/10 text-white/60"
                )}>
                  [{idx + 1}] {building.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="absolute top-20 left-4 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {gameState.notifications.map(n => (
            <motion.div key={n.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-3 py-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-3 shadow-xl">
              <div className={cn("w-2 h-2 rounded-full", n.type === 'food' ? 'bg-orange-500' : n.type === 'energy' ? 'bg-yellow-500' : n.type === 'mineral' ? 'bg-slate-400' : 'bg-emerald-500')} />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">{n.message}</span>
                {n.amount && <span className="text-[9px] font-mono text-emerald-400">+{n.amount} UNITS</span>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-20 left-4 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {gameState.chestLoot?.map(l => (
            <motion.div key={l.id} initial={{ opacity: 0, x: -50, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -50, scale: 0.8 }} className="px-4 py-3 bg-gradient-to-r from-indigo-900/90 to-purple-900/90 backdrop-blur-md border border-indigo-500/30 rounded-xl flex items-center gap-4 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/50">
                <span className="text-lg">🎁</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-indigo-100 tracking-widest">{l.message}</span>
                <span className="text-sm font-mono font-bold text-emerald-400">掉落 {l.amount} 件物品</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {gameState.warningText && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -50, scale: 0.9 }} 
            className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none z-50"
          >
            <div className="px-6 py-3 bg-red-950/80 backdrop-blur-md border border-red-500/50 rounded-xl flex items-center gap-3 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <AlertTriangle className="text-red-500 animate-pulse" size={24} />
              <span className="text-base font-bold text-red-100 tracking-widest">{gameState.warningText}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState.status === 'exploring' && gameState.planet && (
        <div className="absolute inset-0 pointer-events-none">
          {(() => {
            const dx = gameState.podPosition.x - gameState.playerPosition.x;
            const dy = gameState.podPosition.y - gameState.playerPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 60) return null;
            const angle = Math.atan2(dy, dx);
            const r = Math.min(800, 450) - 60;
            const indicatorX = 800 + Math.cos(angle) * r;
            const indicatorY = 450 + Math.sin(angle) * r;
            return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ left: `${(indicatorX / 1600) * 100}%`, top: `${(indicatorY / 900) * 100}%`, transform: 'translate(-50%, -50%)' }} className="absolute flex flex-col items-center gap-1">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-emerald-500" style={{ transform: `rotate(${angle + Math.PI/2}rad)` }} />
                <div className="bg-black/80 backdrop-blur-sm border border-emerald-500/30 px-2 py-1 rounded text-[9px] font-mono text-emerald-400 whitespace-nowrap shadow-lg">
                  <span className="font-bold">VANGUARD-01</span>
                  <div className="flex items-center gap-1 opacity-80">
                    <RefreshCw size={8} className="animate-spin-slow" /> {Math.round(distance)}m
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
