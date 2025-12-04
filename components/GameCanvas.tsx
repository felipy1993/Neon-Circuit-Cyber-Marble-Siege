





import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { LevelConfig, Marble, MarbleColor, MarbleType, Particle, Point, Projectile, FloatingText, PowerupType, UpgradeType, WallpaperId, SkinId } from '../types';
import { MARBLE_RADIUS, PROJECTILE_SPEED, PATH_WIDTH, CREDITS_PER_MARBLE, CREDITS_PER_COMBO, CREDITS_PER_COMBO as CREDITS_PER_COMBO_CONST, WALLPAPERS } from '../constants';
import { generatePathPoints, getPathLength, getPointAtDistance, getDistance } from '../utils/math';

interface GameCanvasProps {
  levelConfig: LevelConfig;
  upgrades: { [key in UpgradeType]: number };
  wallpaperId: WallpaperId;
  selectedSkin: SkinId;
  isPaused: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean; // Nova prop para música
  onGameOver: (score: number, win: boolean) => void;
  onScoreUpdate: (score: number) => void;
  onCreditsUpdate: (credits: number) => void;
  onProgressUpdate: (pct: number) => void;
  onPowerupUsed: (type: PowerupType) => void;
}

export interface GameCanvasRef {
  triggerPowerup: (type: PowerupType) => void;
}

const GameCanvas = forwardRef<GameCanvasRef, GameCanvasProps>(({ 
  levelConfig, 
  upgrades,
  wallpaperId,
  selectedSkin,
  isPaused,
  sfxEnabled,
  musicEnabled,
  onGameOver, 
  onScoreUpdate, 
  onCreditsUpdate,
  onProgressUpdate,
  onPowerupUsed
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const creditsRef = useRef(0);
  const frameCountRef = useRef(0);
  
  // Callback Refs
  const onGameOverRef = useRef(onGameOver);
  const onScoreUpdateRef = useRef(onScoreUpdate);
  const onCreditsUpdateRef = useRef(onCreditsUpdate);
  const onProgressUpdateRef = useRef(onProgressUpdate);
  const onPowerupUsedRef = useRef(onPowerupUsed);

  onGameOverRef.current = onGameOver;
  onScoreUpdateRef.current = onScoreUpdate;
  onCreditsUpdateRef.current = onCreditsUpdate;
  onProgressUpdateRef.current = onProgressUpdate;
  onPowerupUsedRef.current = onPowerupUsed;
  
  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicNodesRef = useRef<{ osc1: OscillatorNode, osc2: OscillatorNode, gain: GainNode, lfo: OscillatorNode } | null>(null);
  
  // FPS Tracking
  const lastTimeRef = useRef(0);
  const fpsRef = useRef(60);

  const lastShotTimeRef = useRef(0);
  const lastReportedScoreRef = useRef(0);
  const lastReportedProgressRef = useRef(0);

  // Stats
  const projectileSpeed = PROJECTILE_SPEED + (upgrades[UpgradeType.SPEED] * 3);
  const luckFactor = upgrades[UpgradeType.LUCK] * 0.02;
  const scoreMultiplier = 1 + (upgrades[UpgradeType.EFFICIENCY] * 0.2);
  const blastRadiusMultiplier = 1 + ((upgrades[UpgradeType.BLAST_RADIUS] || 0) * 0.15);
  const reverseForceMultiplier = 1 + ((upgrades[UpgradeType.REVERSE_FORCE] || 0) * 0.15);

  // State Refs
  const shakeRef = useRef(0);
  const slowMoTimerRef = useRef(0);
  const reverseTimerRef = useRef(0);
  const empNextShotRef = useRef(false);
  const comboStreakRef = useRef(0); 
  
  const marblesRef = useRef<Marble[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  
  const nextMarbleColorRef = useRef<MarbleColor>(levelConfig.colors[0]);
  const currentShooterColorRef = useRef<MarbleColor>(levelConfig.colors[0]);
  const marblesSpawnedRef = useRef(0);
  const mousePosRef = useRef<Point>({ x: 0, y: 0 });
  
  const pathPointsRef = useRef<Point[]>([]);
  const pathLengthRef = useRef(0);
  const backgroundNodesRef = useRef<Point[]>([]);

  const wallpaper = WALLPAPERS.find(w => w.id === wallpaperId) || WALLPAPERS[0];

  // --- AUDIO ENGINE ---

  const initAudio = () => {
      if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().then(() => {
              // Try start music after resume if enabled
              if (musicEnabled && !isPaused) startMusic();
          });
      }
  };

  const startMusic = () => {
      if (!musicEnabled || isPaused || musicNodesRef.current || !audioCtxRef.current) return;
      
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // CYBERPUNK DRONE SYNTH
      // Osc 1: Deep Sawtooth
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 55; // Low A

      // Osc 2: Slightly detuned Sawtooth for thickness
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 55.5; 

      // Filter: Lowpass to make it dark
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      filter.Q.value = 1;

      // LFO: Modulates filter to make it "breathe"
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.2; // Slow pulse
      
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300; // Filter moves up/down by 300hz

      // Master Gain
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 2); // Fade in

      // Connections
      osc1.connect(filter);
      osc2.connect(filter);
      
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      lfo.start();

      musicNodesRef.current = { osc1, osc2, gain, lfo };
  };

  const stopMusic = () => {
      if (musicNodesRef.current) {
          const { osc1, osc2, lfo, gain } = musicNodesRef.current;
          const ctx = audioCtxRef.current;
          
          if (ctx) {
             // Fade out
             gain.gain.cancelScheduledValues(ctx.currentTime);
             gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
          }
          
          setTimeout(() => {
             try {
                 osc1.stop();
                 osc2.stop();
                 lfo.stop();
             } catch(e) {}
          }, 600);
          
          musicNodesRef.current = null;
      }
  };

  // Music Effect Hook
  useEffect(() => {
      if (musicEnabled && !isPaused) {
          if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
              startMusic();
          }
      } else {
          stopMusic();
      }
      
      return () => stopMusic();
  }, [musicEnabled, isPaused]);


  const playSound = (type: 'shoot' | 'explode' | 'powerup' | 'swap' | 'gameover' | 'win') => {
      if (!sfxEnabled || !audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx.state !== 'running') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      
      switch (type) {
          case 'shoot':
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(880, now);
              osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
              gain.gain.setValueAtTime(0.2, now);
              gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
              osc.start(now);
              osc.stop(now + 0.15);
              break;
          case 'swap':
              osc.type = 'sine';
              osc.frequency.setValueAtTime(440, now);
              osc.frequency.linearRampToValueAtTime(600, now + 0.05);
              gain.gain.setValueAtTime(0.1, now);
              gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
              osc.start(now);
              osc.stop(now + 0.05);
              break;
          case 'explode':
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(100, now);
              osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.3);
              gain.gain.setValueAtTime(0.2, now);
              gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
              osc.start(now);
              osc.stop(now + 0.3);
              break;
          case 'powerup':
              osc.type = 'square';
              osc.frequency.setValueAtTime(220, now);
              osc.frequency.linearRampToValueAtTime(880, now + 0.4);
              gain.gain.setValueAtTime(0.1, now);
              gain.gain.linearRampToValueAtTime(0, now + 0.4);
              osc.start(now);
              osc.stop(now + 0.4);
              break;
           case 'win':
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(440, now);
              osc.frequency.setValueAtTime(554, now + 0.1);
              osc.frequency.setValueAtTime(659, now + 0.2);
              gain.gain.setValueAtTime(0.2, now);
              gain.gain.linearRampToValueAtTime(0, now + 0.6);
              osc.start(now);
              osc.stop(now + 0.6);
              break;
      }
  };

  useImperativeHandle(ref, () => ({
    triggerPowerup(type: PowerupType) {
      playSound('powerup');
      if (type === PowerupType.EMP) {
        empNextShotRef.current = true;
        addFloatingText(canvasRef.current!.width / (window.devicePixelRatio || 1) / 2, canvasRef.current!.height / (window.devicePixelRatio || 1) / 2, "PEM ARMADO", "#00f0ff", 1.5);
        onPowerupUsedRef.current(type);
      }
      else if (type === PowerupType.SLOW) {
        slowMoTimerRef.current = 600; 
        addFloatingText(canvasRef.current!.width / (window.devicePixelRatio || 1) / 2, canvasRef.current!.height / (window.devicePixelRatio || 1) / 2, "DILATAÇÃO TEMPORAL", "#f0ff00", 1.5);
        onPowerupUsedRef.current(type);
      }
      else if (type === PowerupType.REVERSE) {
        reverseTimerRef.current = 180; 
        addFloatingText(canvasRef.current!.width / (window.devicePixelRatio || 1) / 2, canvasRef.current!.height / (window.devicePixelRatio || 1) / 2, "SISTEMA REVERSO", "#ff00ff", 1.5);
        onPowerupUsedRef.current(type);
      }
    }
  }));

  // Initialize Level & Canvas Scaling
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Set Dimensions with DPI Capping for Performance
    const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const oldLength = pathLengthRef.current;
        
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
        
        pathPointsRef.current = generatePathPoints(levelConfig.pathType, width, height);
        const newLength = getPathLength(pathPointsRef.current);
        pathLengthRef.current = newLength;
        
        if (oldLength > 0 && newLength > 0 && marblesRef.current.length > 0) {
            const ratio = newLength / oldLength;
            marblesRef.current.forEach(m => {
                m.offset = m.offset * ratio;
            });
        }

        backgroundNodesRef.current = Array.from({ length: 30 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height
        }));
    };
    
    window.addEventListener('resize', resize);
    resize(); 

    marblesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    scoreRef.current = 0;
    creditsRef.current = 0;
    marblesSpawnedRef.current = 0;
    shakeRef.current = 0;
    slowMoTimerRef.current = 0;
    reverseTimerRef.current = 0;
    empNextShotRef.current = false;
    comboStreakRef.current = 0;
    frameCountRef.current = 0;
    lastTimeRef.current = performance.now();
    lastShotTimeRef.current = 0;
    
    lastReportedScoreRef.current = 0;
    lastReportedProgressRef.current = 0;
    
    currentShooterColorRef.current = levelConfig.colors[Math.floor(Math.random() * levelConfig.colors.length)];
    nextMarbleColorRef.current = levelConfig.colors[Math.floor(Math.random() * levelConfig.colors.length)];

    return () => {
        window.removeEventListener('resize', resize);
        stopMusic();
    };
  }, [levelConfig]);

  // Game Loop
  const animate = useCallback((time: number) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    
    const delta = time - lastTimeRef.current;
    if (delta > 0) {
        const instantFps = 1000 / delta;
        fpsRef.current = (fpsRef.current * 0.9) + (instantFps * 0.1);
    }
    lastTimeRef.current = time;

    if (shakeRef.current > 0) shakeRef.current *= 0.9;
    if (shakeRef.current < 0.5) shakeRef.current = 0;

    // --- GAME LOGIC ---
    if (!isPaused) {
        frameCountRef.current++;

        if (slowMoTimerRef.current > 0) slowMoTimerRef.current--;
        if (reverseTimerRef.current > 0) reverseTimerRef.current--;

        const timeScale = slowMoTimerRef.current > 0 ? 0.4 : 1.0;

        // 1. Spawning
        if (marblesSpawnedRef.current < levelConfig.spawnCount) {
            let minOffset = 999999;
            if (marblesRef.current.length > 0) {
                marblesRef.current.forEach(m => minOffset = Math.min(minOffset, m.offset));
            } else {
                minOffset = 999999;
            }

            const isRushPhase = marblesSpawnedRef.current < 18;
            const gapRequirement = isRushPhase ? MARBLE_RADIUS * 1.9 : MARBLE_RADIUS * 2.1;

            if (marblesRef.current.length === 0 || minOffset > gapRequirement) {
                const color = levelConfig.colors[Math.floor(Math.random() * levelConfig.colors.length)];
                
                let type = MarbleType.NORMAL;
                const rnd = Math.random();
                const baseChance = 0.02 + luckFactor; 
                if (rnd < baseChance) type = MarbleType.WILDCARD;
                else if (rnd < baseChance * 2) type = MarbleType.BOMB;

                marblesRef.current.push({
                    id: Math.random().toString(36).substr(2, 9),
                    color,
                    type,
                    offset: 0, 
                    speed: 0, 
                    backwards: false
                });
                marblesSpawnedRef.current++;
            }
        } else if (marblesRef.current.length === 0 && particlesRef.current.length === 0) {
            playSound('win');
            onGameOverRef.current(scoreRef.current, true);
        }

        // 2. Physics & Chains
        marblesRef.current.sort((a, b) => b.offset - a.offset);

        const chains: Marble[][] = [];
        if (marblesRef.current.length > 0) {
            let currentChain: Marble[] = [marblesRef.current[0]];
            for (let i = 1; i < marblesRef.current.length; i++) {
                const ahead = marblesRef.current[i-1];
                const curr = marblesRef.current[i];
                const dist = ahead.offset - curr.offset;
                
                if (dist <= MARBLE_RADIUS * 2 + 3.0) { 
                    currentChain.push(curr);
                } else {
                    chains.push(currentChain);
                    currentChain = [curr];
                }
            }
            chains.push(currentChain);
        }

        // Aggressive acceleration logic
        const timeInSeconds = frameCountRef.current / 60;
        // Adjusted ramp up to 0.00001 (0.001% per second acceleration)
        const rampUp = 1 + (timeInSeconds * 0.00001); 
        const speedFactor = Math.min(rampUp, 3.0); // Higher cap (3x max speed)
        
        const dangerZone = pathLengthRef.current * 0.7;
        const leadOffset = marblesRef.current[0]?.offset || 0;
        const isRushStart = marblesSpawnedRef.current < 18 && leadOffset < dangerZone;
        const introMultiplier = isRushStart ? 3.0 : 1.0;

        // Increased base speed multiplier from 0.5 to 0.85
        const baseSpeed = (0.85 * levelConfig.speedMultiplier * speedFactor * introMultiplier) * timeScale; 
        const reverseSpeedMax = (-8.0 * reverseForceMultiplier) * timeScale;
        const forcedReverseSpeed = (-4.0 * reverseForceMultiplier) * timeScale; 

        for (let i = chains.length - 1; i >= 0; i--) {
            const chain = chains[i];
            const isLastChain = (i === chains.length - 1);
            
            let chainVelocity = 0;

            if (reverseTimerRef.current > 0) {
                chainVelocity = forcedReverseSpeed;
            } else if (isLastChain) {
                chainVelocity = baseSpeed;
            } else {
                const chainBehind = chains[i + 1];
                if (chainBehind) {
                    const myTail = chain[chain.length - 1]; 
                    const behindHead = chainBehind[0];    
                    
                    const matches = myTail.color === behindHead.color || myTail.type === MarbleType.WILDCARD || behindHead.type === MarbleType.WILDCARD;
                    
                    if (matches) {
                        const dist = myTail.offset - behindHead.offset;
                        const targetGap = MARBLE_RADIUS * 2;
                        const gapSize = dist - targetGap;
                        
                        if (gapSize > 0.5) {
                            chainVelocity = Math.min(0, Math.max(reverseSpeedMax, -gapSize));
                        } else {
                            chainVelocity = 0;
                        }
                    } else {
                        chainVelocity = 0; 
                    }
                } else {
                    chainVelocity = 0;
                }
            }

            chain.forEach(m => {
                m.speed = chainVelocity;
                m.backwards = (chainVelocity < 0);
                m.offset += m.speed;
            });
        }

        let comboCheckNeededIndex = -1;
        for (let i = marblesRef.current.length - 1; i > 0; i--) {
            const behind = marblesRef.current[i];      
            const ahead = marblesRef.current[i - 1];   

            const dist = ahead.offset - behind.offset;
            const required = MARBLE_RADIUS * 2;

            if (dist < required) {
                if (ahead.backwards && !reverseTimerRef.current) {
                    comboCheckNeededIndex = i;
                }
                ahead.offset = behind.offset + required;
                if (behind.speed > ahead.speed) {
                    ahead.speed = behind.speed;
                }
            }
        }

        if (comboCheckNeededIndex !== -1) {
            handleMatches(comboCheckNeededIndex, true);
        }

        if (marblesRef.current.length > 0) {
            const head = marblesRef.current[0];
            if (head.offset >= pathLengthRef.current) {
                playSound('gameover');
                onGameOverRef.current(scoreRef.current, false);
            }
        }

        for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
            const p = projectilesRef.current[i];
            
            const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
            const steps = Math.ceil(speed / (MARBLE_RADIUS * 0.8)); 
            const stepVx = p.vx / steps;
            const stepVy = p.vy / steps;
            
            let collided = false;

            for (let s = 0; s < steps; s++) {
                p.x += stepVx;
                p.y += stepVy;

                if (p.x < -50 || p.x > logicalWidth + 50 || p.y < -50 || p.y > logicalHeight + 50) {
                    projectilesRef.current.splice(i, 1);
                    comboStreakRef.current = 0; 
                    collided = true;
                    break;
                }

                for (let mIdx = 0; mIdx < marblesRef.current.length; mIdx++) {
                    const m = marblesRef.current[mIdx];
                    const mPoint = getPointAtDistance(m.offset, pathPointsRef.current, pathLengthRef.current);
                    
                    const dx = p.x - mPoint.x;
                    const dy = p.y - mPoint.y;
                    const distSq = dx*dx + dy*dy;
                    const hitDistSq = (MARBLE_RADIUS * 1.8) ** 2; 
                    
                    if (distSq < hitDistSq) { 
                        collided = true;
                        
                        if (m.type === MarbleType.BOMB) {
                            explodeBomb(m, mIdx);
                            projectilesRef.current.splice(i, 1);
                            break;
                        }

                        if (p.isEmp) {
                            explodeArea(p.x, p.y, 150 * blastRadiusMultiplier);
                            addFloatingText(p.x, p.y, "EXPLOSÃO PEM", "#00f0ff", 1.2);
                            projectilesRef.current.splice(i, 1);
                            break;
                        }

                        const newMarble: Marble = {
                            id: Math.random().toString(36).substr(2, 9),
                            color: p.color,
                            type: MarbleType.NORMAL,
                            offset: m.offset - MARBLE_RADIUS * 2, 
                            speed: 0,
                            backwards: false
                        };
                        
                        marblesRef.current.splice(mIdx + 1, 0, newMarble);

                        let currIdx = mIdx + 1;
                        while(currIdx < marblesRef.current.length - 1) {
                            const c = marblesRef.current[currIdx];
                            const n = marblesRef.current[currIdx+1]; 
                            if (c.offset - n.offset < MARBLE_RADIUS * 2) {
                                n.offset = c.offset - MARBLE_RADIUS * 2;
                            }
                            currIdx++;
                        }

                        triggerShake(3);
                        playSound('shoot'); 
                        const matched = handleMatches(mIdx + 1, false);
                        
                        if (matched) {
                            comboStreakRef.current++;
                            if (comboStreakRef.current > 1) {
                                const scale = Math.min(1.0 + (comboStreakRef.current * 0.2), 3.0);
                                const color = comboStreakRef.current > 4 ? '#ff00ff' : (comboStreakRef.current > 2 ? '#f0ff00' : '#00f0ff');
                                addFloatingText(p.x, p.y - 20, `${comboStreakRef.current}x STREAK`, color, scale);
                            }
                        } else {
                            comboStreakRef.current = 0;
                        }
                        
                        projectilesRef.current.splice(i, 1);
                        break; 
                    }
                }
                if (collided) break; 
            }
        }

        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const part = particlesRef.current[i];
            part.x += part.vx;
            part.y += part.vy;
            part.life -= 0.05; 
            if (part.life <= 0) particlesRef.current.splice(i, 1);
        }
        
        for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
            const txt = floatingTextsRef.current[i];
            txt.y -= 1;
            txt.life -= 0.02;
            if (txt.life <= 0) floatingTextsRef.current.splice(i, 1);
        }
    } 

    // --- RENDER ---
    ctx.save();
    
    if (shakeRef.current > 0) {
        const dx = (Math.random() - 0.5) * shakeRef.current;
        const dy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(dx, dy);
    }

    ctx.fillStyle = wallpaper.bgColor;
    ctx.fillRect(-10, -10, logicalWidth + 20, logicalHeight + 20);

    drawCyberpunkBackground(ctx, logicalWidth, logicalHeight);
    drawTrack(ctx);
    drawDataCore(ctx);

    marblesRef.current.forEach(m => {
        const pos = getPointAtDistance(m.offset, pathPointsRef.current, pathLengthRef.current);
        const rotation = m.offset / MARBLE_RADIUS;
        drawMarble(ctx, pos.x, pos.y, m, MARBLE_RADIUS, rotation);
    });

    projectilesRef.current.forEach(p => {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = p.isEmp ? '#00f0ff' : p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, MARBLE_RADIUS + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (p.isEmp) {
             ctx.fillStyle = '#fff';
             ctx.beginPath();
             ctx.arc(p.x, p.y, MARBLE_RADIUS, 0, Math.PI * 2);
             ctx.fill();
        } else {
             ctx.fillStyle = p.color;
             ctx.beginPath();
             ctx.arc(p.x, p.y, MARBLE_RADIUS, 0, Math.PI * 2);
             ctx.fill();
             
             ctx.fillStyle = 'rgba(255,255,255,0.8)';
             ctx.beginPath();
             ctx.arc(p.x - 4, p.y - 4, 4, 0, Math.PI * 2);
             ctx.fill();
        }
    });

    drawShooter(ctx, logicalWidth, logicalHeight);
    drawEffects(ctx);
    
    ctx.restore();

    if (!isPaused) {
        const total = levelConfig.spawnCount;
        const remaining = total - marblesSpawnedRef.current + marblesRef.current.length;
        const currentProgress = Math.max(0, 100 - (remaining / total * 100));
        
        if (Math.abs(currentProgress - lastReportedProgressRef.current) > 0.5) {
            onProgressUpdateRef.current(currentProgress);
            lastReportedProgressRef.current = currentProgress;
        }

        if (scoreRef.current !== lastReportedScoreRef.current) {
            onScoreUpdateRef.current(scoreRef.current);
            lastReportedScoreRef.current = scoreRef.current;
        }
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [levelConfig, upgrades, wallpaperId, selectedSkin, wallpaper, isPaused, sfxEnabled]); 

  // --- HELPERS ---

  const swapColors = () => {
      playSound('swap');
      const temp = currentShooterColorRef.current;
      currentShooterColorRef.current = nextMarbleColorRef.current;
      nextMarbleColorRef.current = temp;
  };

  const explodeArea = (x: number, y: number, radius: number) => {
      triggerShake(10);
      spawnParticles(x, y, '#ff003c');
      playSound('explode');
      
      const toDestroy: number[] = [];
      marblesRef.current.forEach((target, tIdx) => {
           const tPoint = getPointAtDistance(target.offset, pathPointsRef.current, pathLengthRef.current);
           if (getDistance({x, y}, tPoint) < radius) {
               toDestroy.push(tIdx);
           }
      });
      
      toDestroy.sort((a,b) => b-a).forEach(idx => {
          marblesRef.current.splice(idx, 1);
          spawnParticles(x, y, '#fff'); 
      });
  };

  const explodeBomb = (bombMarble: Marble, index: number) => {
      const p = getPointAtDistance(bombMarble.offset, pathPointsRef.current, pathLengthRef.current);
      addFloatingText(p.x, p.y, "BOOM!", "#ff0000", 2.0);
      explodeArea(p.x, p.y, 100 * blastRadiusMultiplier);
      const currentIdx = marblesRef.current.indexOf(bombMarble);
      if (currentIdx !== -1) {
          marblesRef.current.splice(currentIdx, 1);
      }
  };

  const handleMatches = (idx: number, isCombo: boolean): boolean => {
      const marbles = marblesRef.current;
      if (idx < 0 || idx >= marbles.length) return false;
      
      const pivotMarble = marbles[idx];
      const pivotColor = pivotMarble.color;
      
      if (pivotMarble.type === MarbleType.BOMB) {
          explodeBomb(pivotMarble, idx);
          return true;
      }

      let start = idx;
      let end = idx;
      
      while (start > 0) {
          const prev = marbles[start - 1];
          const isMatch = prev.color === pivotColor || prev.type === MarbleType.WILDCARD || pivotMarble.type === MarbleType.WILDCARD;
          if (isMatch) start--; else break;
      }
      
      while (end < marbles.length - 1) {
          const next = marbles[end + 1];
          const isMatch = next.color === pivotColor || next.type === MarbleType.WILDCARD || pivotMarble.type === MarbleType.WILDCARD;
          if (isMatch) end++; else break;
      }
      
      const count = end - start + 1;
      
      if (count >= 3) {
          playSound('explode');
          for(let k=start; k<=end; k++) {
              if (marblesRef.current[k].type === MarbleType.BOMB) {
                  explodeBomb(marblesRef.current[k], k);
                  return true;
              }
          }

          const centerMarble = marbles[idx]; 
          const point = getPointAtDistance(centerMarble.offset, pathPointsRef.current, pathLengthRef.current);
          
          spawnParticles(point.x, point.y, pivotColor);
          triggerShake(5 + count); 
          
          let points = count * 100 * scoreMultiplier;
          let earnedCredits = count * CREDITS_PER_MARBLE;
          
          if (isCombo) {
              points *= 1.5; 
              earnedCredits += CREDITS_PER_COMBO_CONST;
          }

          if (comboStreakRef.current > 1) {
              points *= (1 + (comboStreakRef.current * 0.1));
          }
          
          const label = isCombo ? `COMBO +${Math.floor(points)}` : `+${Math.floor(points)}`;
          const scale = isCombo ? 1.5 : 1.0;
          addFloatingText(point.x, point.y, label, pivotColor, scale);
          scoreRef.current += Math.floor(points);
          
          creditsRef.current += Math.floor(earnedCredits * scoreMultiplier);
          onCreditsUpdateRef.current(Math.floor(earnedCredits * scoreMultiplier));
          
          marblesRef.current.splice(start, count);
          return true;
      }
      return false;
  };

  const spawnParticles = (x: number, y: number, color: string) => {
      for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 8 + 2;
          particlesRef.current.push({
              id: Math.random().toString(),
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              color: color
          });
      }
  };
  
  const addFloatingText = (x: number, y: number, text: string, color: string, scale: number = 1.0) => {
      floatingTextsRef.current.push({
          id: Math.random().toString(),
          x, y, text, color, life: 1.0, scale
      });
  };

  const triggerShake = (amount: number) => {
      shakeRef.current = amount;
  };

  const drawCyberpunkBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const horizonY = height * 0.3;
      
      ctx.strokeStyle = wallpaper.primaryColor;
      ctx.globalAlpha = 0.1;
      ctx.lineWidth = 1;
      
      for (let i = -5; i <= 10; i++) {
          const x = (width / 2) + (i * 150);
          ctx.beginPath();
          ctx.moveTo(width/2, horizonY - 200);
          ctx.lineTo(x, height);
          ctx.stroke();
      }
      
      const offset = (Date.now() * 0.05) % 80;
      for (let y = horizonY; y < height; y += 80) {
          const actualY = y + offset;
          if (actualY > height) continue;
          ctx.beginPath();
          ctx.moveTo(0, actualY);
          ctx.lineTo(width, actualY);
          ctx.stroke();
      }
      
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = wallpaper.primaryColor;
      backgroundNodesRef.current.forEach((node, i) => {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 2, 0, Math.PI*2);
          ctx.fill();
      });
      ctx.globalAlpha = 1.0;
  };

  const drawTrack = (ctx: CanvasRenderingContext2D) => {
    if (pathPointsRef.current.length > 0) {
        const dangerStartIndex = Math.floor(pathPointsRef.current.length * 0.85);
        
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = PATH_WIDTH + 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = dangerStartIndex; i < pathPointsRef.current.length; i++) {
            const p = pathPointsRef.current[i];
            if (i === dangerStartIndex) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = PATH_WIDTH + 2;
        ctx.stroke();
    }

    ctx.strokeStyle = wallpaper.primaryColor;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = PATH_WIDTH + 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pathPointsRef.current.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    ctx.globalAlpha = 0.5;
    ctx.lineWidth = PATH_WIDTH + 2;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = PATH_WIDTH;
    ctx.stroke();
    
    ctx.globalCompositeOperation = 'lighter';
    const timeScale = slowMoTimerRef.current > 0 ? 0.4 : 1.0;
    const dashOffset = (-Date.now() / 15) * timeScale;
    
    if (reverseTimerRef.current > 0) {
         ctx.strokeStyle = '#ffffff'; 
    } else if (slowMoTimerRef.current > 0) {
         ctx.strokeStyle = '#f0ff00'; 
    } else {
         ctx.strokeStyle = wallpaper.primaryColor; 
    }
    
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 40]); 
    ctx.lineDashOffset = dashOffset;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';
  };

  const drawDataCore = (ctx: CanvasRenderingContext2D) => {
    const endPoint = pathPointsRef.current[pathPointsRef.current.length - 1];
    if (!endPoint) return;
    
    const time = Date.now();
    const pulse = 40 + Math.sin(time / 200) * 5;
    
    ctx.fillStyle = 'rgba(255, 0, 60, 0.3)';
    ctx.beginPath();
    ctx.arc(endPoint.x, endPoint.y, pulse + 10, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 0, 60, 0.5)';
    ctx.beginPath();
    for(let i=0; i<6; i++) {
        const angle = i * Math.PI / 3;
        ctx.lineTo(endPoint.x + Math.cos(angle)*pulse, endPoint.y + Math.sin(angle)*pulse);
    }
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = '#ff003c';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NÚCLEO', endPoint.x, endPoint.y);
  };

  const drawMarble = (ctx: CanvasRenderingContext2D, x: number, y: number, marble: Marble, radius: number, rotation: number) => {
      let glowColor: string = marble.color;
      if (marble.type === MarbleType.WILDCARD) {
           const hue = (Date.now() / 5) % 360;
           glowColor = `hsl(${hue}, 100%, 50%)`;
      } else if (marble.type === MarbleType.BOMB) {
           glowColor = '#ff0000';
      }

      ctx.fillStyle = glowColor;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      ctx.fillStyle = marble.color;
      if (marble.type === MarbleType.WILDCARD) ctx.fillStyle = glowColor;
      if (marble.type === MarbleType.BOMB) ctx.fillStyle = `rgb(${150 + Math.sin(Date.now()/100)*100}, 0, 0)`;

      ctx.beginPath();
      ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      if (marble.type !== MarbleType.NORMAL || marble.backwards) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rotation);
          
          if (marble.type === MarbleType.WILDCARD) {
              ctx.fillStyle = '#fff';
              ctx.font = '12px Orbitron';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('★', 0, 0);
          } else if (marble.type === MarbleType.BOMB) {
              ctx.fillStyle = '#000';
              ctx.font = 'bold 12px Orbitron';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('!', 0, 0);
          } 

          if (marble.backwards) {
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(0, 0, 3, 0, Math.PI*2);
              ctx.fill();
          }
          ctx.restore();
      }
  };

  const drawShooter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const cx = width / 2;
    const cy = height / 2;
    const angle = Math.atan2(mousePosRef.current.y - cy, mousePosRef.current.x - cx);
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    
    let skinColor = wallpaper.primaryColor; 
    
    if (selectedSkin === SkinId.RGB) {
        const hue = (Date.now() / 5) % 360;
        skinColor = `hsl(${hue}, 100%, 50%)`;
    } else {
        switch(selectedSkin) {
            case SkinId.CRIMSON: skinColor = '#ff003c'; break;
            case SkinId.TOXIC: skinColor = '#39ff14'; break;
            case SkinId.GOLD: skinColor = '#ffd700'; break;
            case SkinId.AMETHYST: skinColor = '#9d00ff'; break;
            case SkinId.VOID: skinColor = '#111111'; break;
            case SkinId.DEFAULT: skinColor = '#00f0ff'; break;
        }
    }

    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.lineTo(800, 0); 
    ctx.strokeStyle = empNextShotRef.current ? '#ffffff' : currentShooterColorRef.current;
    ctx.lineWidth = empNextShotRef.current ? 4 : 2;
    ctx.setLineDash(empNextShotRef.current ? [] : [2, 10]); 
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
    ctx.restore();
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    
    ctx.fillStyle = skinColor;
    ctx.shadowColor = skinColor;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(-15, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; 
    
    ctx.fillStyle = selectedSkin === SkinId.VOID ? '#050505' : '#0f172a';
    ctx.beginPath();
    ctx.moveTo(25, 0);
    ctx.lineTo(-20, 20);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-20, -20);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = empNextShotRef.current ? '#ffffff' : skinColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(15, 0);
    ctx.stroke();

    if (empNextShotRef.current) {
         ctx.fillStyle = '#fff';
         ctx.beginPath();
         ctx.arc(0, 0, MARBLE_RADIUS - 2, 0, Math.PI*2);
         ctx.fill();
    } else {
         ctx.fillStyle = currentShooterColorRef.current;
         ctx.beginPath();
         ctx.arc(0, 0, MARBLE_RADIUS - 6, 0, Math.PI*2); 
         ctx.fill();
         ctx.fillStyle = 'rgba(255,255,255,0.7)';
         ctx.beginPath();
         ctx.arc(-2, -2, 3, 0, Math.PI*2);
         ctx.fill();
    }
    
    ctx.restore();

    const nextX = cx + 70;
    const nextY = cy + 70;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(nextX, nextY, MARBLE_RADIUS + 8, 0, Math.PI*2);
    ctx.stroke();
    
    ctx.fillStyle = nextMarbleColorRef.current;
    ctx.beginPath();
    ctx.arc(nextX, nextY, MARBLE_RADIUS - 4, 0, Math.PI*2);
    ctx.fill();
  };

  const drawEffects = (ctx: CanvasRenderingContext2D) => {
      ctx.globalCompositeOperation = 'lighter';
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        const size = (Math.random() * 3 + 2); 
        ctx.beginPath();
        ctx.rect(p.x - size/2, p.y - size/2, size, size);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    
    floatingTextsRef.current.forEach(txt => {
        ctx.save();
        ctx.globalAlpha = txt.life;
        ctx.font = `bold ${20 * txt.scale}px Orbitron`;
        ctx.fillStyle = '#fff';
        ctx.fillStyle = txt.color;
        ctx.textAlign = 'center';
        ctx.fillText(txt.text, txt.x, txt.y);
        ctx.restore();
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
      if (isPaused) return; 
      initAudio();
      mousePosRef.current = { x: e.clientX, y: e.clientY };
  };
  
  const handleClick = (e: MouseEvent) => {
      if (!canvasRef.current || isPaused) return; 
      
      const now = Date.now();
      if (now - lastShotTimeRef.current < 150) return;
      lastShotTimeRef.current = now;

      initAudio();
      
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < 60) {
          swapColors();
          return;
      }
      
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
      
      projectilesRef.current.push({
          id: Math.random().toString(),
          x: cx + Math.cos(angle) * 30, 
          y: cy + Math.sin(angle) * 30,
          vx: Math.cos(angle) * projectileSpeed,
          vy: Math.sin(angle) * projectileSpeed,
          color: currentShooterColorRef.current,
          isEmp: empNextShotRef.current
      });
      
      playSound('shoot');
      triggerShake(empNextShotRef.current ? 5 : 2);
      
      if (empNextShotRef.current) {
          empNextShotRef.current = false;
      } else {
          currentShooterColorRef.current = nextMarbleColorRef.current;
          nextMarbleColorRef.current = levelConfig.colors[Math.floor(Math.random() * levelConfig.colors.length)];
      }
  };

  const handleTouchStart = (e: TouchEvent) => {
     if (isPaused) return;
     initAudio();
     const touch = e.touches[0];
     mousePosRef.current = { x: touch.clientX, y: touch.clientY };
     handleClick({ clientX: touch.clientX, clientY: touch.clientY } as any);
  };
  
  const handleTouchMove = (e: TouchEvent) => {
     if (isPaused) return;
     if (e.cancelable) e.preventDefault();
     const touch = e.touches[0];
     mousePosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (!isPaused) {
          initAudio();
          swapColors();
      }
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPaused && e.code === 'Space') {
          e.preventDefault(); 
          initAudio();
          swapColors();
      }
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    return () => {
        cancelAnimationFrame(requestRef.current);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mousedown', handleClick);
        window.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        
        stopMusic();
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
        }
    };
  }, [animate]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 cursor-crosshair" style={{ touchAction: 'none' }} />;
});

export default GameCanvas;