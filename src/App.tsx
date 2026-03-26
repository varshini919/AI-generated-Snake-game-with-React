/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Terminal, Power, Activity, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const INITIAL_SPEED = 80;

const TRACKS = [
  { id: 1, title: "DATA_STREAM_01.WAV", url: "https://upload.wikimedia.org/wikipedia/commons/4/4b/MacLeod%2C_Kevin_-_Reformat.ogg" },
  { id: 2, title: "CORRUPTION_DETECTED.WAV", url: "https://upload.wikimedia.org/wikipedia/commons/c/c2/MacLeod%2C_Kevin_-_Electrodoodle.ogg" },
  { id: 3, title: "VOID_PROTOCOL.WAV", url: "https://upload.wikimedia.org/wikipedia/commons/7/7c/MacLeod%2C_Kevin_-_Pamgaea.ogg" }
];

type Point = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [uiState, setUiState] = useState({
    score: 0,
    gameOver: false,
    isPaused: false,
    hasStarted: false
  });

  const [audioState, setAudioState] = useState({
    currentTrackIndex: 0,
    isPlaying: false,
    volume: 0.5
  });

  const gameState = useRef({
    snake: [{ x: 10, y: 10 }] as Point[],
    food: { x: 15, y: 15 } as Point,
    dir: { x: 0, y: -1 } as Point,
    nextDir: { x: 0, y: -1 } as Point,
    score: 0,
    gameOver: false,
    isPaused: false,
    hasStarted: false,
    particles: [] as Particle[],
    screenShake: 0,
    lastMoveTime: 0,
    speed: INITIAL_SPEED
  });

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const state = gameState.current;
    
    ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    
    if (state.screenShake > 0) {
      const dx = (Math.random() - 0.5) * state.screenShake * 2;
      const dy = (Math.random() - 0.5) * state.screenShake * 2;
      ctx.translate(dx, dy);
      if (Math.random() > 0.7) {
        ctx.fillStyle = 'rgba(255, 0, 255, 0.2)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }
      state.screenShake *= 0.85;
      if (state.screenShake < 0.5) state.screenShake = 0;
    }

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CANVAS_SIZE; i += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_SIZE, i); ctx.stroke();
    }

    if (state.hasStarted) {
      ctx.fillStyle = '#FF00FF';
      const foodOffset = Math.random() > 0.9 ? (Math.random() - 0.5) * 10 : 0;
      ctx.fillRect(state.food.x * CELL_SIZE + 2 + foodOffset, state.food.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      state.snake.forEach((segment, i) => {
        ctx.fillStyle = i === 0 ? '#FFFFFF' : '#00FFFF';
        let xOffset = 0;
        if (Math.random() > 0.95) xOffset = (Math.random() - 0.5) * 8;
        ctx.fillRect(segment.x * CELL_SIZE + 1 + xOffset, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      });

      state.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, []);

  const update = useCallback((time: number) => {
    const state = gameState.current;

    if (state.hasStarted && !state.isPaused && !state.gameOver) {
      if (time - state.lastMoveTime > state.speed) {
        state.dir = state.nextDir;
        const head = state.snake[0];
        const newHead = { x: head.x + state.dir.x, y: head.y + state.dir.y };

        if (
          newHead.x < 0 || newHead.x >= GRID_SIZE ||
          newHead.y < 0 || newHead.y >= GRID_SIZE ||
          state.snake.some(s => s.x === newHead.x && s.y === newHead.y)
        ) {
          state.gameOver = true;
          state.screenShake = 40;
          setUiState(s => ({ ...s, gameOver: true }));
        } else {
          state.snake.unshift(newHead);

          if (newHead.x === state.food.x && newHead.y === state.food.y) {
            state.score += 16;
            state.speed = Math.max(40, state.speed - 3);
            setUiState(s => ({ ...s, score: state.score }));
            state.screenShake = 10;
            
            for (let i = 0; i < 30; i++) {
              state.particles.push({
                x: state.food.x * CELL_SIZE + CELL_SIZE/2,
                y: state.food.y * CELL_SIZE + CELL_SIZE/2,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1,
                color: Math.random() > 0.5 ? '#FF00FF' : '#00FFFF',
                size: Math.random() * 6 + 2
              });
            }

            let newFood;
            while (true) {
              newFood = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
              };
              if (!state.snake.some(s => s.x === newFood.x && s.y === newFood.y)) break;
            }
            state.food = newFood;
          } else {
            state.snake.pop();
          }
        }
        state.lastMoveTime = time;
      }

      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) state.particles.splice(i, 1);
      }
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) draw(ctx);
    }

    requestRef.current = requestAnimationFrame(update);
  }, [draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameState.current;
      if (!state.hasStarted) return;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }

      switch(e.key) {
        case 'ArrowUp': case 'w': case 'W':
          if (state.dir.y === 0) state.nextDir = { x: 0, y: -1 };
          break;
        case 'ArrowDown': case 's': case 'S':
          if (state.dir.y === 0) state.nextDir = { x: 0, y: 1 };
          break;
        case 'ArrowLeft': case 'a': case 'A':
          if (state.dir.x === 0) state.nextDir = { x: -1, y: 0 };
          break;
        case 'ArrowRight': case 'd': case 'D':
          if (state.dir.x === 0) state.nextDir = { x: 1, y: 0 };
          break;
        case ' ':
          if (!state.gameOver) {
            state.isPaused = !state.isPaused;
            setUiState(s => ({ ...s, isPaused: state.isPaused }));
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (audioState.isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [audioState.isPlaying, audioState.currentTrackIndex]);

  const togglePlay = () => setAudioState(s => ({ ...s, isPlaying: !s.isPlaying }));
  const nextTrack = () => setAudioState(s => ({ ...s, currentTrackIndex: (s.currentTrackIndex + 1) % TRACKS.length }));
  const prevTrack = () => setAudioState(s => ({ ...s, currentTrackIndex: (s.currentTrackIndex - 1 + TRACKS.length) % TRACKS.length }));
  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setAudioState(s => ({ ...s, volume: v }));
    if (audioRef.current) audioRef.current.volume = v;
  };

  const startGame = () => {
    gameState.current.hasStarted = true;
    setUiState(s => ({ ...s, hasStarted: true }));
    setAudioState(s => ({ ...s, isPlaying: true }));
    if (audioRef.current) {
      audioRef.current.volume = audioState.volume;
      audioRef.current.play().catch(console.error);
    }
  };

  const resetGame = () => {
    gameState.current = {
      ...gameState.current,
      snake: [{ x: 10, y: 10 }],
      food: { x: 15, y: 15 },
      dir: { x: 0, y: -1 },
      nextDir: { x: 0, y: -1 },
      score: 0,
      gameOver: false,
      isPaused: false,
      particles: [],
      speed: INITIAL_SPEED
    };
    setUiState(s => ({ ...s, score: 0, gameOver: false, isPaused: false }));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#00FFFF] font-sans flex items-center justify-center p-4 lg:p-8 crt">
      <div className="static-bg" />
      
      <div className="w-full max-w-6xl border-4 border-[#00FFFF] shadow-[8px_8px_0px_#FF00FF] bg-[#050505] relative z-10 flex flex-col lg:flex-row screen-tear">
        
        <div className="w-full lg:w-80 border-b-4 lg:border-b-0 lg:border-r-4 border-[#00FFFF] p-6 flex flex-col bg-[#050505] relative">
          <div className="absolute top-0 left-0 w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,0,255,0.05)_10px,rgba(255,0,255,0.05)_20px)] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-2">
              <Activity size={24} className="text-[#FF00FF]" />
              <span className="font-mono text-sm text-[#FF00FF] uppercase glitch" data-text="AUD_SUBSYS">AUD_SUBSYS</span>
            </div>
            <div className={`w-4 h-4 border-2 border-[#00FFFF] ${audioState.isPlaying ? 'bg-[#FF00FF] animate-pulse' : 'bg-transparent'}`} />
          </div>

          <div className="border-2 border-[#FF00FF] bg-[#000000] p-4 mb-8 relative z-10">
            <div className="text-xs text-[#00FFFF] mb-2 uppercase font-mono">&gt; STREAM_ACTIVE</div>
            <div className="font-mono text-lg text-[#FF00FF] truncate">
              {TRACKS[audioState.currentTrackIndex].title}
            </div>
            
            <div className="flex items-end gap-1 h-12 mt-6">
              {[...Array(16)].map((_, i) => (
                <motion.div
                  key={i}
                  className="flex-1 bg-[#00FFFF]"
                  animate={{ height: audioState.isPlaying ? [4, Math.random() * 40 + 4, 4] : 4 }}
                  transition={{ repeat: Infinity, duration: 0.1 + Math.random() * 0.2 }}
                  style={{ filter: i % 3 === 0 ? 'drop-shadow(2px 0 0 #FF00FF)' : 'none' }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mb-8 relative z-10">
            <button onClick={prevTrack} className="p-2 border-2 border-[#00FFFF] text-[#00FFFF] hover:bg-[#FF00FF] hover:text-[#050505] hover:border-[#FF00FF] transition-none cursor-pointer">
              <SkipBack size={24} />
            </button>
            <button 
              onClick={togglePlay} 
              className="p-4 border-4 border-[#FF00FF] text-[#FF00FF] hover:bg-[#00FFFF] hover:text-[#050505] hover:border-[#00FFFF] transition-none cursor-pointer"
            >
              {audioState.isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
            </button>
            <button onClick={nextTrack} className="p-2 border-2 border-[#00FFFF] text-[#00FFFF] hover:bg-[#FF00FF] hover:text-[#050505] hover:border-[#FF00FF] transition-none cursor-pointer">
              <SkipForward size={24} />
            </button>
          </div>

          <div className="flex items-center gap-4 mt-auto pt-6 border-t-4 border-[#00FFFF] relative z-10">
            <VolumeX size={20} className="text-[#FF00FF]" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioState.volume}
              onChange={handleVolume}
              className="flex-1 h-2 bg-[#000000] border-2 border-[#00FFFF] appearance-none cursor-pointer accent-[#FF00FF]"
            />
            <Volume2 size={20} className="text-[#FF00FF]" />
          </div>

          <audio ref={audioRef} src={TRACKS[audioState.currentTrackIndex].url} onEnded={nextTrack} crossOrigin="anonymous" />
        </div>

        <div className="flex-1 p-6 lg:p-10 flex flex-col items-center justify-center relative bg-[#000000]">
          
          {!uiState.hasStarted ? (
            <div className="text-center z-10">
              <Power size={64} className="mx-auto mb-6 text-[#FF00FF] animate-pulse" />
              <h1 className="font-mono text-4xl md:text-6xl mb-12 text-[#00FFFF] glitch" data-text="NEON.SNAKE">NEON.SNAKE</h1>
              <button 
                onClick={startGame}
                className="px-8 py-4 border-4 border-[#FF00FF] bg-[#050505] text-[#FF00FF] font-mono text-xl uppercase hover:bg-[#00FFFF] hover:text-[#050505] hover:border-[#00FFFF] transition-none shadow-[4px_4px_0px_#00FFFF] hover:shadow-[4px_4px_0px_#FF00FF] cursor-pointer"
              >
                EXECUTE_SEQUENCE
              </button>
            </div>
          ) : (
            <div className="relative w-full max-w-[500px] aspect-square border-4 border-[#00FFFF] shadow-[8px_8px_0px_#FF00FF] bg-[#050505]">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="w-full h-full object-contain"
              />

              {uiState.gameOver && (
                <div className="absolute inset-0 bg-[#050505]/90 flex flex-col items-center justify-center border-4 border-[#FF00FF]">
                  <AlertTriangle size={48} className="text-[#FF00FF] mb-4 animate-bounce" />
                  <div className="text-[#FF00FF] font-mono text-2xl md:text-3xl mb-4 glitch" data-text="FATAL_EXCEPTION">FATAL_EXCEPTION</div>
                  <div className="text-[#00FFFF] font-mono text-xl mb-8">&gt; ENTROPY: 0x{uiState.score.toString(16).toUpperCase()}</div>
                  <button 
                    onClick={resetGame}
                    className="px-6 py-3 border-2 border-[#00FFFF] text-[#00FFFF] font-mono text-lg uppercase hover:bg-[#FF00FF] hover:text-[#050505] hover:border-[#FF00FF] transition-none cursor-pointer"
                  >
                    REBOOT_SYSTEM
                  </button>
                </div>
              )}

              {uiState.isPaused && !uiState.gameOver && (
                <div className="absolute inset-0 bg-[#050505]/80 flex items-center justify-center">
                  <div className="text-[#00FFFF] font-mono text-4xl glitch" data-text="HALTED">HALTED</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full lg:w-64 border-t-4 lg:border-t-0 lg:border-l-4 border-[#00FFFF] p-6 flex flex-col bg-[#050505] relative">
          <div className="absolute top-0 left-0 w-full h-full bg-[repeating-linear-gradient(-45deg,transparent,transparent_10px,rgba(0,255,255,0.05)_10px,rgba(0,255,255,0.05)_20px)] pointer-events-none" />

          <div className="flex items-center gap-2 mb-8 relative z-10">
            <Terminal size={24} className="text-[#FF00FF]" />
            <span className="font-mono text-sm text-[#FF00FF] uppercase glitch" data-text="DIAGNOSTICS">DIAGNOSTICS</span>
          </div>

          <div className="mb-8 relative z-10">
            <div className="text-xs text-[#00FFFF] mb-2 uppercase font-mono">&gt; ENTROPY_LVL</div>
            <div className="font-mono text-5xl text-[#FF00FF] drop-shadow-[2px_2px_0px_#00FFFF]">
              {uiState.score.toString().padStart(4, '0')}
            </div>
          </div>

          <div className="mt-auto pt-6 border-t-4 border-[#00FFFF] relative z-10">
            <div className="text-xs text-[#00FFFF] mb-4 uppercase font-mono">&gt; INPUT_VECTORS</div>
            <div className="flex flex-col gap-4 font-mono text-sm text-[#FF00FF]">
              <div className="flex items-center justify-between">
                <span>DIR_VECTOR</span>
                <span className="border-2 border-[#FF00FF] bg-[#000000] px-2 py-1">W A S D</span>
              </div>
              <div className="flex items-center justify-between">
                <span>SYS_HALT</span>
                <span className="border-2 border-[#FF00FF] bg-[#000000] px-2 py-1">SPACE</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
