/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Wind, 
  Utensils, 
  Pickaxe, 
  Terminal as TerminalIcon, 
  AlertTriangle,
  Globe, 
  ChevronRight,
  RefreshCw,
  Skull
} from 'lucide-react';
import { GameState, Resources, Entity, Upgrades } from './types/game';
import { generatePlanet, generateDailyEvent } from './services/aiDirector';
import confetti from 'canvas-confetti';
import { GameCanvas } from './components/GameCanvas';
import { ResourceBar } from './components/ResourceBar';
import { UpgradeMenu } from './components/UpgradeMenu';
import { cn } from './utils/cn';
import { INITIAL_RESOURCES } from './constants';

import { audioManager } from './utils/audio';

const INITIAL_WEAPON_STATS: any = {
  attackSpeed: 1,
  attackPower: 1,
  bulletsPerShot: 1,
  attackRange: 200,
  hasBounce: false,
  laserEveryNth: 0,
  isMachineGun: false,
  isLaserGun: false,
  isCannon: false,
  explosionRadius: 0,
  acquiredGoldUpgrades: []
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    planet: null,
    resources: INITIAL_RESOURCES,
    day: 1,
    logs: ['[SYSTEM] 初始化拓荒协议...', '[SYSTEM] 等待轨道扫描结果...'],
    events: [],
    isGameOver: false,
    status: 'initializing',
    playerPosition: { x: 0, y: 0 },
    podPosition: { x: 0, y: 0 },
    isBoosting: false,
    entities: [],
    upgrades: {
      oxygenSystem: 1,
      flightSystem: 1,
      weaponSystem: 1,
      hasBoat: false,
      weaponStats: INITIAL_WEAPON_STATS
    },
    bullets: [],
    missiles: [],
    notifications: [],
    chestLoot: [],
    carriedMinerals: 0,
    maxCarryCapacity: 500,
    deathReason: undefined,
    timeOfDay: 0,
    isNight: false,
    nightProgress: 0,
    buildingInventory: [],
    selectedBuildingIndex: 0
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFirstInteraction = () => {
      audioManager.resume();
      window.removeEventListener('click', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    return () => window.removeEventListener('click', handleFirstInteraction);
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.logs]);

  const addLog = (message: string) => {
    setGameState(prev => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`]
    }));
  };

  const startNewGame = async () => {
    audioManager.resume();
    setIsProcessing(true);
    addLog('正在扫描邻近星系...');
    try {
      const planet = await generatePlanet();

      setGameState({
        planet,
        resources: planet.initialResources,
        day: 1,
        logs: [
          `[SYSTEM] 成功进入 ${planet.name} 轨道`,
          `[INFO] 星球类型: ${planet.type}`,
          `[SYSTEM] 准备降落程序...`
        ],
        events: [],
        isGameOver: false,
        status: 'landing',
        playerPosition: { x: 0, y: 0 },
        podPosition: { x: 0, y: 0 },
        isBoosting: false,
        entities: [],
        upgrades: {
          oxygenSystem: 1,
          flightSystem: 1,
          weaponSystem: 1,
          hasBoat: false,
          weaponStats: INITIAL_WEAPON_STATS
        },
        bullets: [],
        missiles: [],
        notifications: [],
        chestLoot: [],
        carriedMinerals: 0,
        maxCarryCapacity: 500,
        deathReason: undefined,
        timeOfDay: 0,
        isNight: false,
        nightProgress: 0,
        buildingInventory: [],
        selectedBuildingIndex: 0
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b']
      });
    } catch (error) {
      addLog('扫描失败: 信号干扰。请重试。');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] font-sans selection:bg-emerald-500/30">
      {/* CRT Overlay Effect */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      
      <main className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 h-screen max-h-screen overflow-hidden">
        
        {/* Left Column: Planet & Resources */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Header */}
          <div className="border-b border-white/10 pb-4">
            <h1 className="text-2xl font-bold tracking-tighter flex items-center gap-2">
              <Globe className="text-emerald-500" />
              异星拓荒者
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">v1.0-AI</span>
            </h1>
            <p className="text-xs opacity-50 mt-1 uppercase tracking-widest">Exoplanet Pioneers Protocol</p>
          </div>

          {/* Planet Info Card */}
          <AnimatePresence mode="wait">
            {gameState.planet ? (
              <motion.div 
                key="planet-info"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4"
              >
                <div>
                  <h2 className="text-emerald-400 font-mono text-lg">{gameState.planet.name}</h2>
                  <p className="text-[10px] uppercase opacity-40 tracking-widest">{gameState.planet.type}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <p className="opacity-40 uppercase">大气层</p>
                    <p className="truncate">{gameState.planet.atmosphere}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="opacity-40 uppercase">地表温度</p>
                    <p>{gameState.planet.temperature}</p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed opacity-80 italic">
                  "{gameState.planet.description}"
                </p>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-[10px] uppercase opacity-40 tracking-widest mb-2">当前任务目标</p>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-xs text-emerald-400 flex items-start gap-2">
                    <Pickaxe size={14} className="mt-0.5" />
                    <span>{gameState.planet.objective}</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4">
                <Globe className="w-12 h-12 opacity-20 animate-pulse" />
                <p className="text-sm opacity-40">等待轨道数据...</p>
                <button 
                  onClick={startNewGame}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                  启动拓荒协议
                </button>
              </div>
            )}
          </AnimatePresence>

          {/* Resources */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">生命维持系统</h3>
              <span className="text-xs font-mono text-emerald-500">DAY {gameState.day}</span>
            </div>
            
            <div className="space-y-4">
              <ResourceBar icon={Wind} label="氧气储备" value={gameState.resources.oxygen} color={gameState.resources.oxygen < 20 ? "bg-red-500" : "bg-cyan-500"} max={100 + (gameState.upgrades.oxygenSystem - 1) * 50} />
              <ResourceBar icon={Zap} label="能量核心" value={gameState.resources.energy} color={gameState.resources.energy < 10 ? "bg-red-500" : "bg-yellow-500"} />
              <ResourceBar icon={Utensils} label="有机补给" value={gameState.resources.food} color="bg-orange-500" />
              <ResourceBar icon={Zap} label="飞行燃料" value={gameState.resources.fuel} color="bg-emerald-500" max={100 + (gameState.upgrades.flightSystem - 1) * 50} />
              <ResourceBar icon={Pickaxe} label="矿物资源" value={gameState.resources.minerals} color="bg-slate-400" max={5000} />
            </div>
          </div>

          {/* Controls */}
          {gameState.planet && !gameState.isGameOver && (
            <div className="space-y-3">
              <div className="w-full py-4 bg-white/5 border border-white/10 text-white/60 font-mono text-xs rounded-2xl flex flex-col items-center justify-center gap-1">
                <span className="uppercase tracking-widest opacity-40">自动生存协议运行中</span>
                <span className="text-emerald-500">DAY {gameState.day} - {gameState.isNight ? 'NIGHT' : 'DAY'}</span>
              </div>
              <p className="text-[10px] text-center opacity-40 font-mono uppercase tracking-widest">
                靠近船舱按 [F] 进行系统升级
              </p>
            </div>
          )}

          {gameState.isGameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full py-8 bg-red-500/10 border border-red-500/20 text-white font-bold rounded-2xl flex flex-col items-center justify-center gap-4"
            >
              <Skull size={48} className="text-red-500" />
              <div className="text-center">
                <h2 className="text-xl uppercase tracking-widest">拓荒任务终止</h2>
                <p className="text-xs font-mono opacity-60 mt-1">
                  {gameState.deathReason || (gameState.resources.oxygen <= 0 ? "氧气耗尽 - 维持生命系统停止运行" : "能量核心枯竭 - 基地电力完全丧失")}
                </p>
              </div>
              <button 
                onClick={startNewGame}
                className="px-8 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-full transition-all flex items-center gap-2"
              >
                重新开始拓荒
              </button>
            </motion.div>
          )}
        </div>

        {/* Right Column: Terminal & Events */}
        <div className="lg:col-span-8 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* Visual Viewport */}
          <GameCanvas gameState={gameState} setGameState={setGameState} isProcessing={isProcessing} />

          {/* Terminal View */}
          <div className="flex-1 bg-black/60 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-mono opacity-60">
                <TerminalIcon size={12} />
                COMMAND_CENTER_LOGS.EXE
              </div>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/50" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2 custom-scrollbar">
              {gameState.logs.map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className={cn(
                    "border-l-2 pl-3 py-0.5",
                    log.includes('[FATAL]') ? "border-red-500 text-red-400 bg-red-500/5" :
                    log.includes('[EVENT]') ? "border-yellow-500 text-yellow-200 bg-yellow-500/5" :
                    log.includes('[SYSTEM]') ? "border-emerald-500 text-emerald-400" :
                    "border-white/10 opacity-70"
                  )}
                >
                  {log}
                </motion.div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Recent Events Grid */}
          <div className="h-48 overflow-x-auto flex gap-4 pb-2 custom-scrollbar">
            <AnimatePresence>
              {gameState.events.length === 0 ? (
                <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-2xl opacity-20 text-xs uppercase tracking-widest">
                  暂无历史事件记录
                </div>
              ) : (
                gameState.events.map((event) => (
                  <motion.div 
                    key={event.id}
                    initial={{ opacity: 0, scale: 0.9, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 280 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={cn(
                      "flex-shrink-0 border rounded-2xl p-4 flex flex-col gap-2",
                      event.type === 'positive' ? "bg-emerald-500/5 border-emerald-500/20" :
                      event.type === 'negative' ? "bg-red-500/5 border-red-500/20" :
                      "bg-white/5 border-white/10"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm truncate">{event.title}</h4>
                      {event.type === 'negative' && <AlertTriangle size={14} className="text-red-500" />}
                    </div>
                    <p className="text-xs opacity-60 line-clamp-3 leading-relaxed">
                      {event.description}
                    </p>
                    {event.impact && (
                      <div className="mt-auto flex gap-2 overflow-x-auto pt-2">
                        {Object.entries(event.impact).map(([key, val]) => (
                          <span key={key} className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded border uppercase font-mono",
                            val > 0 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-red-400 border-red-500/30 bg-red-500/10"
                          )}>
                            {key.slice(0, 3)} {val > 0 ? '+' : ''}{val}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <UpgradeMenu gameState={gameState} setGameState={setGameState} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
