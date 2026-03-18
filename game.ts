
export type ResourceType = 'oxygen' | 'energy' | 'food' | 'minerals';

export type BuildingType = 'teleport-tower' | 'mech-miner-institute' | 'turret' | 'laser-tower' | 'mind-control-tower';

export interface BuildingItem {
  id: string;
  type: BuildingType;
  name: string;
}

export interface Resources {
  oxygen: number;
  energy: number;
  food: number;
  minerals: number;
  fuel: number;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  impact?: Partial<Resources>;
  timestamp: number;
}

export interface PlanetInfo {
  name: string;
  type: string;
  atmosphere: string;
  temperature: string;
  description: string;
  objective: string;
  initialResources: Resources;
}

export type MonsterType = 'normal' | 'swarm' | 'six-legged' | 'evil-eye' | 'sandworm';

export interface Entity {
  id: string;
  type: 'food' | 'energy' | 'mineral' | 'monster' | 'chest' | 'dropped_item' | 'vegetation' | 'rock' | 'crystal' | 'pool' | 'island' | 'building' | 'mech-miner' | 'stalactite';
  buildingType?: BuildingType;
  monsterType?: MonsterType;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  health?: number;
  maxHealth?: number;
  isDead?: boolean;
  deathProgress?: number;
  isOpened?: boolean;
  content?: 'food' | 'energy' | 'mineral' | 'fuel' | 'oxygen';
  amount?: number;
  attackCooldown?: number;
  attackProgress?: number;
  miningProgress?: number;
  vegetationType?: number; // 0-2 for different styles
  scale?: number;
  width?: number; // For pools/rocks
  height?: number; // For pools/rocks
  rotation?: number;
  clusterId?: string; // For grouping lake pools
  // Building specific
  buildProgress?: number;
  laserTargetId?: string;
  laserDamage?: number;
  laserDuration?: number;
  controlledMonsterId?: string;
  controlCooldown?: number;
  controlDuration?: number;
  // Mech miner specific
  carriedMinerals?: number;
  targetRockId?: string;
  state?: 'searching' | 'mining' | 'returning' | 'delivering';
  deliveryProgress?: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
}

export interface Missile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  rotation: number;
  isExploding?: boolean;
  explosionProgress?: number;
  isFriendly?: boolean;
}

export interface GameNotification {
  id: string;
  message: string;
  type: 'food' | 'energy' | 'mineral' | 'system';
  amount?: number;
  life: number;
}

export interface WeaponStats {
  attackSpeed: number; // multiplier, 1.0 is base
  attackPower: number; // multiplier, 1.0 is base
  bulletsPerShot: number;
  attackRange: number; // in pixels
  hasBounce: boolean;
  laserEveryNth: number; // 0 means no laser, 3 means every 3rd
  isMachineGun: boolean;
  isLaserGun: boolean;
  isCannon: boolean;
  explosionRadius: number;
  acquiredGoldUpgrades: string[];
}

export interface UpgradeOption {
  id: string;
  title: string;
  description: string;
  rarity: 'gray' | 'green' | 'blue' | 'gold';
  effect: (stats: WeaponStats) => WeaponStats;
}

export interface Upgrades {
  oxygenSystem: number;
  flightSystem: number;
  weaponSystem: number;
  hasBoat: boolean;
  weaponStats: WeaponStats;
}

export interface GameState {
  planet: PlanetInfo | null;
  resources: Resources;
  day: number;
  logs: string[];
  events: GameEvent[];
  isGameOver: boolean;
  status: 'initializing' | 'landing' | 'exploring' | 'event' | 'gameover' | 'upgrading';
  timeOfDay: number; // 0 to 120000 ms
  isNight: boolean;
  nightProgress: number;
  warningText?: string | null;
  chestLoot?: { id: string, message: string, amount: number, type: string, time: number }[];
  playerPosition: { x: number; y: number };
  podPosition: { x: number; y: number };
  isBoosting: boolean;
  entities: Entity[];
  upgrades: Upgrades;
  bullets: Bullet[];
  missiles: Missile[];
  notifications: GameNotification[];
  carriedMinerals: number;
  maxCarryCapacity: number;
  deathReason?: string;
  weaponUpgradeOptions?: UpgradeOption[];
  buildingInventory: BuildingItem[];
  selectedBuildingIndex: number;
}
