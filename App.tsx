import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GameScreen, LevelConfig, PlayerState, PowerupType, UpgradeType, WallpaperId, RankConfig, SkinId } from './types';
import { LEVELS, SHOP_ITEMS, CREDITS_LEVEL_CLEAR, UPGRADES, WALLPAPERS, RANKS, SKINS } from './constants';
import GameCanvas, { GameCanvasRef } from './components/GameCanvas';
import Button from './components/Button';
import { Play, Grid, Trophy, RotateCcw, ShieldAlert, ShoppingBag, Coins, Zap, Lock, Beaker, ArrowUpCircle, Palette, Check, Pause, LogOut, Volume2, VolumeX, Music, Home, Info, Mouse, Skull, ArrowRight, Shuffle, Calendar, Gift, ListOrdered, User, Terminal, Mail, Key, Eye, EyeOff, Square, CheckSquare, Crown, Rocket, Box, Sparkles } from 'lucide-react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, User as FirebaseUser, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

const INITIAL_STATE: PlayerState = {
  username: '',
  credits: 0,
  unlockedLevels: 1,
  tutorialCompleted: false,
  lastLoginDate: '',
  loginStreak: 0,
  lastClaimedChestLevel: 0, // Default to 0 so players can claim level 5, 10, etc.
  inventory: {
    [PowerupType.EMP]: 0,
    [PowerupType.SLOW]: 0,
    [PowerupType.REVERSE]: 0
  },
  upgrades: {
    [UpgradeType.SPEED]: 0,
    [UpgradeType.LUCK]: 0,
    [UpgradeType.EFFICIENCY]: 0,
    [UpgradeType.BLAST_RADIUS]: 0,
    [UpgradeType.REVERSE_FORCE]: 0
  },
  highScores: {},
  totalScore: 0,
  selectedWallpaper: WallpaperId.CLASSIC,
  ownedSkins: [SkinId.DEFAULT],
  selectedSkin: SkinId.DEFAULT,
  settings: {
    musicVolume: true,
    sfxVolume: true
  }
};

const TUTORIAL_STEPS = [
    {
        title: "OBJETIVO DO SISTEMA",
        description: "Impeça que os DADOS (esferas) cheguem ao NÚCLEO vermelho. Combine 3 ou mais cores iguais para destruí-los.",
        icon: <ShieldAlert size={64} className="text-red-500 mb-4" />
    },
    {
        title: "CONTROLES DO DRONE",
        description: "Toque na tela para atirar. TOQUE NO DRONE (centro) para trocar a cor da munição.",
        icon: <Mouse size={64} className="text-cyan-400 mb-4" />
    },
    {
        title: "ARSENAL TÁTICO",
        description: "Use a barra lateral direita para comprar e ativar poderes especiais como Câmera Lenta e EMP.",
        icon: <Zap size={64} className="text-yellow-400 mb-4" />
    }
];

interface ChestReward {
    credits: number;
    powerup?: PowerupType;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

export default function App() {
  // --- STATE ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState<GameScreen>(GameScreen.LOGIN);
  
  // Auth Form State
  const [loginIdentifier, setLoginIdentifier] = useState(''); // Email or Username
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Auth UI Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [currentLevelId, setCurrentLevelId] = useState(1);
  const [score, setScore] = useState(0);
  const [gameResultScore, setGameResultScore] = useState(0);
  const [gameResultBonus, setGameResultBonus] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const [activeWallpaperId, setActiveWallpaperId] = useState<WallpaperId>(WallpaperId.CLASSIC);
  const [customizeTab, setCustomizeTab] = useState<'WALLPAPERS' | 'SKINS'>('WALLPAPERS');

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [dailyReward, setDailyReward] = useState<{ credits: number, item?: PowerupType, itemLabel?: string } | null>(null);
  
  const [playerState, setPlayerState] = useState<PlayerState>(INITIAL_STATE);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Chest System State
  const [pendingChestReward, setPendingChestReward] = useState(false);
  const [chestSourceLevel, setChestSourceLevel] = useState<number>(0); // Which level generated this chest
  const [selectedChestIndex, setSelectedChestIndex] = useState<number | null>(null);
  const [chestReward, setChestReward] = useState<ChestReward | null>(null);

  const gameRef = useRef<GameCanvasRef>(null);

  // --- HELPER: GET RANK ---
  const getPlayerRank = (totalScore: number): RankConfig => {
      // Find the highest rank the score satisfies
      for (let i = RANKS.length - 1; i >= 0; i--) {
          if (totalScore >= RANKS[i].minScore) {
              return RANKS[i];
          }
      }
      return RANKS[0];
  };

  // --- FIREBASE AUTH LISTENER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
            // User logged in, fetch data
            try {
                const docRef = doc(db, "players", currentUser.uid);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data() as PlayerState;
                    // Merge with initial state to ensure new fields (like upgrades/skins/lastClaimedChestLevel) exist
                    setPlayerState({
                        ...INITIAL_STATE,
                        ...data,
                        username: data.username || 'Operador',
                        inventory: { ...INITIAL_STATE.inventory, ...data.inventory },
                        upgrades: { ...INITIAL_STATE.upgrades, ...data.upgrades },
                        settings: { ...INITIAL_STATE.settings, ...data.settings },
                        ownedSkins: data.ownedSkins || [SkinId.DEFAULT],
                        selectedSkin: data.selectedSkin || SkinId.DEFAULT,
                        lastClaimedChestLevel: data.lastClaimedChestLevel || 0 // Default to 0 if field missing
                    });
                    setScreen(GameScreen.MENU);
                } else {
                    // Document doesn't exist? Create one with default
                    await setDoc(docRef, { ...INITIAL_STATE, email: currentUser.email });
                    setPlayerState(INITIAL_STATE);
                    setScreen(GameScreen.MENU);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                setAuthError("Erro ao carregar dados do servidor.");
            }
        } else {
            // User logged out
            setScreen(GameScreen.LOGIN);
            setPlayerState(INITIAL_STATE);
        }
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- DATABASE SYNC HELPER ---
  // We only save to DB on specific checkpoints to save writes/reads
  const saveToFirebase = useCallback(async (newState: PlayerState) => {
      if (!user) return;
      try {
          // Calculate total score before saving
          const totalScore = Object.values(newState.highScores).reduce((a: number, b: number) => a + b, 0);
          const dataToSave = { ...newState, totalScore };
          // merge: true ensures we don't accidentally wipe data if we save a partial state (safety)
          await setDoc(doc(db, "players", user.uid), dataToSave, { merge: true });
      } catch (e) {
          console.error("Error saving to cloud:", e);
      }
  }, [user]);

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
        const playersRef = collection(db, "players");
        // Fetches players. 
        // IMPORTANT: Requires a Firestore composite index on 'totalScore' DESC. 
        // If it fails, check console for the link to create index.
        const q = query(playersRef, orderBy("totalScore", "desc"), limit(50)); 
        const querySnapshot = await getDocs(q);
        
        const data = querySnapshot.docs.map(doc => {
            const d = doc.data() as PlayerState;
            // Robust calculation: Use totalScore if present, otherwise sum highScores
            const calculatedTotal = d.totalScore !== undefined 
                ? d.totalScore 
                : Object.values(d.highScores || {}).reduce((a: number, b: number) => a + b, 0);
            
            const rank = getPlayerRank(calculatedTotal);

            return {
                name: d.username || "Desconhecido",
                score: calculatedTotal,
                level: d.unlockedLevels || 1,
                isUser: user?.uid === doc.id,
                rank: rank
            };
        })
        .filter(p => p.score > 0); // Only show players who have actually played

        // Client-side fallback sort (redundant if DB sort works, but safe)
        data.sort((a, b) => b.score - a.score);

        setLeaderboardData(data); 
    } catch (error) {
        console.error("Error loading leaderboard:", error);
    } finally {
        setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (screen === GameScreen.LEADERBOARD) {
        fetchLeaderboard();
    }
  }, [screen]);

  // --- AUTH ACTIONS ---
  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError('');
      
      try {
          // 1. Configure Persistence
          await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

          let emailToUse = loginIdentifier;

          // 2. Check if input is Username (no '@')
          if (!loginIdentifier.includes('@')) {
              const usersRef = collection(db, "players");
              const q = query(usersRef, where("username", "==", loginIdentifier.toUpperCase()));
              const querySnapshot = await getDocs(q);

              if (querySnapshot.empty) {
                  throw new Error("Usuário não encontrado.");
              }
              // Get the email associated with the username
              const userData = querySnapshot.docs[0].data() as PlayerState;
              if (userData.email) {
                  emailToUse = userData.email;
              } else {
                  throw new Error("Erro na conta: Email não vinculado.");
              }
          }

          // 3. Sign In
          await signInWithEmailAndPassword(auth, emailToUse, password);
          // Auth listener handles the rest
      } catch (error: any) {
          if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
              setAuthError('Credenciais inválidas.');
          } else if (error.message === "Usuário não encontrado.") {
              setAuthError('Usuário não encontrado.');
          } else {
              setAuthError('Erro ao conectar: ' + error.message);
          }
      }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError('');
      
      const cleanName = regName.trim().toUpperCase();

      if (cleanName.length < 3) {
          setAuthError('O nome deve ter pelo menos 3 caracteres.');
          return;
      }

      try {
          // 1. Check if Username is taken
          const usersRef = collection(db, "players");
          const q = query(usersRef, where("username", "==", cleanName));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
              setAuthError('Este Nome de Operador já está em uso.');
              return;
          }

          // 2. Create Auth User
          const cred = await createUserWithEmailAndPassword(auth, regEmail, password);
          
          // 3. Create DB Entry
          const newUserState: PlayerState = {
              ...INITIAL_STATE,
              username: cleanName,
              email: regEmail
          };
          await setDoc(doc(db, "players", cred.user.uid), newUserState);
          // Auth listener handles the rest
      } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') setAuthError('Este email já está cadastrado.');
          else if (error.code === 'auth/weak-password') setAuthError('A senha deve ter pelo menos 6 caracteres.');
          else setAuthError('Erro ao registrar: ' + error.message);
      }
  };

  const handleLogout = async () => {
      await signOut(auth);
      setScreen(GameScreen.LOGIN);
      setLoginIdentifier('');
      setPassword('');
  };

  // --- DAILY BONUS CHECK ---
  useEffect(() => {
    const checkDailyBonus = () => {
        if (!user || screen !== GameScreen.MENU) return;
        
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const lastLogin = playerState.lastLoginDate;

        if (lastLogin !== today) {
            let newStreak = 1;
            if (lastLogin) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayString = yesterday.toISOString().split('T')[0];
                if (lastLogin === yesterdayString) {
                    newStreak = (playerState.loginStreak || 0) + 1;
                }
            }
            
            const effectiveStreak = Math.min(newStreak, 7);
            const baseCredits = 100;
            const bonusCredits = baseCredits + (effectiveStreak * 50); 
            
            let bonusItem: PowerupType | undefined;
            let itemLabel = "";
            
            if (effectiveStreak >= 3 && Math.random() > 0.5) {
                const roll = Math.random();
                if (roll > 0.8) { bonusItem = PowerupType.EMP; itemLabel = "1x CARGA PEM"; }
                else if (roll > 0.5) { bonusItem = PowerupType.SLOW; itemLabel = "1x DILATADOR"; }
                else { bonusItem = PowerupType.REVERSE; itemLabel = "1x REVERSO"; }
            }

            setDailyReward({ credits: bonusCredits, item: bonusItem, itemLabel });
            setShowDailyBonus(true);
            
            // Updates state BUT NOT DB yet (wait for claim)
            const updatedState = {
                ...playerState,
                lastLoginDate: today,
                loginStreak: newStreak
            };
            setPlayerState(updatedState);
            saveToFirebase(updatedState); // Autosave login date
        }
    };
    
    // Trigger check
    if (screen === GameScreen.MENU && !showDailyBonus && playerState.lastLoginDate !== new Date().toISOString().split('T')[0] && user) {
        checkDailyBonus();
    }
  }, [playerState.lastLoginDate, screen, user, saveToFirebase]);

  const claimDailyBonus = () => {
      if (!dailyReward) return;
      
      const newState = {
          ...playerState,
          credits: playerState.credits + dailyReward.credits,
          inventory: {
              ...playerState.inventory,
              ...(dailyReward.item ? { [dailyReward.item]: (playerState.inventory[dailyReward.item] || 0) + 1 } : {})
          }
      };
      setPlayerState(newState);
      saveToFirebase(newState);
      setShowDailyBonus(false);
  };

  // Sync active wallpaper
  useEffect(() => {
      if (playerState.selectedWallpaper !== WallpaperId.AUTO) {
          setActiveWallpaperId(playerState.selectedWallpaper);
      }
  }, [playerState.selectedWallpaper]);

  const currentLevelConfig = useMemo(() => 
    LEVELS.find(l => l.id === currentLevelId) || LEVELS[0], 
  [currentLevelId]);

  const currentWallpaper = useMemo(() => 
    WALLPAPERS.find(w => w.id === activeWallpaperId) || WALLPAPERS[0],
  [activeWallpaperId]);
  
  const currentRank = useMemo(() => getPlayerRank(playerState.totalScore), [playerState.totalScore]);

  // --- GAME ACTIONS ---

  const startGame = useCallback((levelId: number) => {
    if (playerState.selectedWallpaper === WallpaperId.AUTO) {
        const availableWallpapers = WALLPAPERS.filter(w => w.id !== activeWallpaperId);
        const randomIndex = Math.floor(Math.random() * availableWallpapers.length);
        const nextWallpaper = availableWallpapers[randomIndex] || WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)];
        setActiveWallpaperId(nextWallpaper.id);
    } else {
        setActiveWallpaperId(playerState.selectedWallpaper);
    }

    setCurrentLevelId(levelId);
    setScore(0);
    setProgress(0);
    setScreen(GameScreen.PLAYING);
    setPendingChestReward(false); // Reset chest state
    setSelectedChestIndex(null);
    setChestReward(null);

    if (!playerState.tutorialCompleted && levelId === 1) {
        setShowTutorial(true);
        setTutorialStep(0);
        setIsPaused(true);
    } else {
        setShowTutorial(false);
        setIsPaused(false);
    }
  }, [playerState.selectedWallpaper, playerState.tutorialCompleted, activeWallpaperId]);

  const handleNextTutorialStep = () => {
      if (tutorialStep < TUTORIAL_STEPS.length - 1) {
          setTutorialStep(prev => prev + 1);
      } else {
          setShowTutorial(false);
          setIsPaused(false);
          const newState = { ...playerState, tutorialCompleted: true };
          setPlayerState(newState);
          saveToFirebase(newState);
      }
  };

  const quitToMenu = () => {
    setIsPaused(false);
    setScreen(GameScreen.MENU);
  };

  const generateChestReward = (): ChestReward => {
      const roll = Math.random();
      
      // 1% Legendary (10,000)
      if (roll < 0.01) {
          return { credits: 10000, rarity: 'LEGENDARY' };
      }
      // 5% Epic (5,000)
      if (roll < 0.06) {
          return { credits: 5000, rarity: 'EPIC' };
      }
      // 20% Rare (2,500 + Powerup)
      if (roll < 0.26) {
          const powerups = [PowerupType.EMP, PowerupType.SLOW, PowerupType.REVERSE];
          return { 
              credits: 2500, 
              powerup: powerups[Math.floor(Math.random() * powerups.length)],
              rarity: 'RARE' 
          };
      }
      // 74% Common (1000 - 2000)
      return { 
          credits: Math.floor(Math.random() * 1000) + 1000, 
          rarity: 'COMMON' 
      };
  };

  const handleOpenChest = (index: number) => {
      if (selectedChestIndex !== null) return; // Prevent double click
      
      setSelectedChestIndex(index);
      
      // Small delay for drama
      setTimeout(() => {
          const reward = generateChestReward();
          setChestReward(reward);
          
          // Apply rewards
          setPlayerState(prev => {
              const newState = { 
                  ...prev,
                  credits: prev.credits + reward.credits
              };
              if (reward.powerup) {
                  newState.inventory = {
                      ...newState.inventory,
                      [reward.powerup]: (newState.inventory[reward.powerup] || 0) + 1
                  }
              }
              // We do NOT save LastClaimedChestLevel here, we save it on close to verify transaction
              saveToFirebase(newState);
              return newState;
          });
      }, 500);
  };

  const closeChestModal = () => {
      setPendingChestReward(false);
      
      // Update the last claimed level pointer
      // Only if the chest source level is higher than what we have recorded
      if (chestSourceLevel > playerState.lastClaimedChestLevel) {
          const newState = {
              ...playerState,
              lastClaimedChestLevel: chestSourceLevel
          };
          setPlayerState(newState);
          saveToFirebase(newState);
      }
  };

  const openRetroactiveChest = (level: number) => {
      setChestSourceLevel(level);
      setPendingChestReward(true);
      setSelectedChestIndex(null);
      setChestReward(null);
  };

  const handleGameOver = useCallback((finalScore: number, win: boolean) => {
    setGameResultScore(finalScore);
    setIsPaused(false);
    
    let earnedCredits = 0;
    if (win) {
        // Dynamic Bonus: 5% of Score added to Base
        const performanceBonus = Math.floor(finalScore * 0.05); 
        earnedCredits = CREDITS_LEVEL_CLEAR + performanceBonus;
        setGameResultBonus(earnedCredits);

        // CHEST CHECK
        // Trigger if:
        // 1. It is the player's current progression frontier (unlockedLevels)
        // 2. It is a multiple of 5
        if (currentLevelId === playerState.unlockedLevels && currentLevelId % 5 === 0) {
            setChestSourceLevel(currentLevelId);
            setPendingChestReward(true);
        }
    } else {
        setGameResultBonus(0);
    }
    
    setPlayerState(prev => {
        const newState = { ...prev };
        // Check High Score
        if (!newState.highScores[currentLevelId] || finalScore > newState.highScores[currentLevelId]) {
            newState.highScores[currentLevelId] = finalScore;
        }
        
        if (win) {
            const nextLevel = currentLevelId + 1;
            newState.unlockedLevels = Math.max(newState.unlockedLevels, nextLevel);
            newState.credits += earnedCredits;
        }
        
        // Update total score locally as well
        newState.totalScore = Object.values(newState.highScores).reduce((a: number, b: number) => a + b, 0);

        // SAVE TO CLOUD
        saveToFirebase(newState);
        return newState;
    });

    if (win) {
      setScreen(GameScreen.VICTORY);
    } else {
      setScreen(GameScreen.GAME_OVER);
    }
  }, [currentLevelId, playerState, saveToFirebase]); 
  
  const handleCreditsEarned = useCallback((amount: number) => {
      setPlayerState(prev => ({
          ...prev,
          credits: prev.credits + amount
      }));
  }, []);

  const nextLevel = useCallback(() => {
    if (currentLevelId < 1000) {
        startGame(currentLevelId + 1);
    } else {
        setScreen(GameScreen.MENU);
    }
  }, [currentLevelId, startGame]);
  
  const handleSmartAction = (itemId: PowerupType, price: number) => {
      const owned = playerState.inventory[itemId] || 0;
      if (owned > 0) {
          usePowerup(itemId);
      } else {
          if (playerState.credits >= price) {
              const newState = {
                  ...playerState,
                  credits: playerState.credits - price,
                  inventory: {
                      ...playerState.inventory,
                      [itemId]: (playerState.inventory[itemId] || 0) + 1
                  }
              };
              setPlayerState(newState);
              saveToFirebase(newState); // Save purchase
          }
      }
  };
  
  const handleUpgradeBuy = (type: UpgradeType, price: number) => {
      if (playerState.credits >= price) {
          const newState = {
              ...playerState,
              credits: playerState.credits - price,
              upgrades: {
                  ...playerState.upgrades,
                  [type]: (playerState.upgrades[type] || 0) + 1
              }
          };
          setPlayerState(newState);
          saveToFirebase(newState); // Save upgrade
      }
  };

  const selectWallpaper = (id: WallpaperId) => {
      const newState = {
          ...playerState,
          selectedWallpaper: id
      };
      setPlayerState(newState);
      saveToFirebase(newState); // Save preference
  };
  
  const buyOrSelectSkin = (skinId: SkinId, price: number) => {
      const isOwned = playerState.ownedSkins.includes(skinId);
      
      if (isOwned) {
          // Select it
          const newState = { ...playerState, selectedSkin: skinId };
          setPlayerState(newState);
          saveToFirebase(newState);
      } else {
          // Buy it
          if (playerState.credits >= price) {
              const newState = {
                  ...playerState,
                  credits: playerState.credits - price,
                  ownedSkins: [...playerState.ownedSkins, skinId],
                  selectedSkin: skinId // Auto select on buy
              };
              setPlayerState(newState);
              saveToFirebase(newState);
          }
      }
  };
  
  const usePowerup = (type: PowerupType) => {
      if (!isPaused && playerState.inventory[type] > 0) {
          if (gameRef.current) {
              gameRef.current.triggerPowerup(type);
          }
      }
  };
  
  const handlePowerupConsumed = useCallback((type: PowerupType) => {
      setPlayerState(prev => ({
          ...prev,
          inventory: {
              ...prev.inventory,
              [type]: prev.inventory[type] - 1
          }
      }));
  }, []);

  const togglePause = () => {
      if (showTutorial) return;
      setIsPaused(!isPaused);
  };

  const toggleMusic = () => {
      const newState = {
          ...playerState,
          settings: { ...playerState.settings, musicVolume: !playerState.settings.musicVolume }
      };
      setPlayerState(newState);
      saveToFirebase(newState);
  };

  const toggleSFX = () => {
      const newState = {
          ...playerState,
          settings: { ...playerState.settings, sfxVolume: !playerState.settings.sfxVolume }
      };
      setPlayerState(newState);
      saveToFirebase(newState);
  };

  // --- RENDERING ---

  if (authLoading) {
      return (
          <div className="absolute inset-0 bg-[#050510] flex items-center justify-center text-cyan-400 font-display text-2xl animate-pulse">
              CONECTANDO AO SERVIDOR...
          </div>
      );
  }
  
  return (
    <div className="relative w-full h-[100dvh] overflow-hidden text-white select-none transition-colors duration-700"
         style={{ backgroundColor: currentWallpaper.bgColor }}>
      <div className="absolute inset-0 z-0 transition-opacity duration-700"
           style={{ background: currentWallpaper.previewGradient, opacity: 0.5 }}></div>
      
      {/* GLOBAL CHEST OVERLAY */}
      {pendingChestReward && (
          <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-lg overflow-y-auto animate-in fade-in duration-300">
              <div className="min-h-full flex flex-col items-center justify-center p-4">
                  <div className="w-full max-w-4xl text-center">
                      <h2 className="text-3xl md:text-5xl font-display text-yellow-400 mb-2 neon-text-shadow animate-pulse">RECOMPENSA DE MARCO</h2>
                      <p className="text-slate-400 mb-8 md:mb-12 text-lg">NÍVEL {chestSourceLevel} CONQUISTADO. ESCOLHA UM SUPRIMENTO.</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-8">
                          {[0, 1, 2].map((idx) => {
                              const isSelected = selectedChestIndex === idx;
                              const isRevealed = chestReward !== null;
                              // UNSELECTED REVEALED
                              if (isRevealed && !isSelected) { 
                                  return (<div key={idx} className="opacity-30 scale-90 grayscale flex flex-col items-center justify-center border border-slate-700 rounded-xl p-4 md:p-8 bg-slate-900"><Box size={40} className="md:w-16 md:h-16 text-slate-500 mb-4" /></div>); 
                              }
                              // SELECTED REVEALED
                              if (isRevealed && isSelected) {
                                  const rarityColor = chestReward.rarity === 'LEGENDARY' ? '#ff003c' : chestReward.rarity === 'EPIC' ? '#a855f7' : chestReward.rarity === 'RARE' ? '#00f0ff' : '#fbbf24';
                                  return (<div key={idx} className="animate-in zoom-in duration-500 border-2 rounded-xl p-6 md:p-8 bg-slate-800 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)]" style={{ borderColor: rarityColor }}><div className="mb-4 relative"><Sparkles size={60} className="text-white animate-spin-slow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50 md:w-20 md:h-20" /><Gift size={48} className="md:w-16 md:h-16" style={{ color: rarityColor }} /></div><div className="text-xl font-bold mb-2 text-white">{chestReward.rarity}</div><div className="text-2xl md:text-3xl font-mono text-yellow-400 mb-2 flex items-center gap-2"><Coins size={24} /> {chestReward.credits}</div>{chestReward.powerup && (<div className="text-cyan-400 font-bold border-t border-slate-600 pt-2 mt-2 w-full text-center">+1 {chestReward.powerup}</div>)}</div>);
                              }
                              // DEFAULT BUTTON
                              return (<button key={idx} onClick={() => handleOpenChest(idx)} className="group relative border-2 border-yellow-600/50 bg-slate-900/80 rounded-xl p-8 md:p-12 flex flex-col items-center justify-center hover:border-yellow-400 hover:bg-slate-800 hover:scale-105 transition-all cursor-pointer"><div className="absolute inset-0 bg-yellow-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div><Box size={60} className="md:w-20 md:h-20 text-yellow-600 group-hover:text-yellow-400 transition-colors mb-4" /><div className="font-display text-slate-500 group-hover:text-white">ABRIR</div></button>);
                          })}
                      </div>
                      {chestReward && (<div className="flex justify-center pb-8"><Button onClick={closeChestModal} className="animate-in fade-in slide-in-from-bottom-8"><div className="flex items-center gap-2">COLETAR <Check size={20} /></div></Button></div>)}
                  </div>
              </div>
          </div>
      )}

      {screen === GameScreen.LOGIN && (
            <div className="absolute inset-0 bg-black/90 z-50 backdrop-blur-md overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md p-8 rgb-border shadow-2xl relative my-8">
                        <h2 className="text-4xl font-display text-center text-white mb-2 neon-text-shadow" style={{color: '#00f0ff'}}>ACESSO AO SISTEMA</h2>
                        <p className="text-slate-400 text-center mb-8">Autenticação de Operador Requerida</p>
                        <form onSubmit={handleLogin} className="flex flex-col gap-4">
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-cyan-500" size={20} />
                                <input type="text" value={loginIdentifier} onChange={e => setLoginIdentifier(e.target.value)} placeholder="EMAIL OU NOME DE USUÁRIO" className="w-full bg-black/50 border border-slate-600 focus:border-cyan-400 text-white pl-10 pr-4 py-3 rounded outline-none transition-colors" />
                            </div>
                            <div className="relative">
                                <Key className="absolute left-3 top-3 text-cyan-500" size={20} />
                                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="CHAVE DE SEGURANÇA" className="w-full bg-black/50 border border-slate-600 focus:border-cyan-400 text-white pl-10 pr-12 py-3 rounded outline-none transition-colors" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-500 hover:text-cyan-400">
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                                <div className={`w-5 h-5 border rounded flex items-center justify-center ${rememberMe ? 'bg-cyan-500 border-cyan-500 text-black' : 'border-slate-500'}`}>
                                    {rememberMe && <Check size={16} />}
                                </div>
                                <span className="text-sm text-slate-400 select-none">Manter conectado neste terminal</span>
                            </div>
                            {authError && <div className="text-red-500 text-sm text-center bg-red-950/30 p-2 rounded border border-red-500/50">{authError}</div>}
                            <Button type="submit" className="w-full mt-4">CONECTAR</Button>
                        </form>
                        <div className="mt-6 text-center text-sm text-slate-500">
                            NÃO POSSUI CREDENCIAIS? <button onClick={() => { setScreen(GameScreen.REGISTER); setAuthError(''); setLoginIdentifier(''); setPassword(''); }} className="text-yellow-400 hover:text-white ml-2 underline">REGISTRAR NOVO OPERADOR</button>
                        </div>
                    </div>
                </div>
            </div>
      )}

      {screen === GameScreen.REGISTER && (
            <div className="absolute inset-0 bg-black/90 z-50 backdrop-blur-md overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md p-8 rgb-border shadow-2xl relative my-8">
                        <h2 className="text-4xl font-display text-center text-white mb-2 neon-text-shadow" style={{color: '#facc15'}}>REGISTRO DE AGENTE</h2>
                        <p className="text-slate-400 text-center mb-8">Criar Nova Identidade Digital</p>
                        <form onSubmit={handleRegister} className="flex flex-col gap-4">
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-yellow-500" size={20} />
                                <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="CODINOME (ÚNICO)" maxLength={12} className="w-full bg-black/50 border border-slate-600 focus:border-yellow-400 text-white pl-10 pr-4 py-3 rounded outline-none transition-colors uppercase" />
                            </div>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-yellow-500" size={20} />
                                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="EMAIL DE CONTATO" className="w-full bg-black/50 border border-slate-600 focus:border-yellow-400 text-white pl-10 pr-4 py-3 rounded outline-none transition-colors" />
                            </div>
                            <div className="relative">
                                <Key className="absolute left-3 top-3 text-yellow-500" size={20} />
                                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="CRIAR CHAVE (SENHA)" className="w-full bg-black/50 border border-slate-600 focus:border-yellow-400 text-white pl-10 pr-12 py-3 rounded outline-none transition-colors" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-500 hover:text-yellow-400">
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {authError && <div className="text-red-500 text-sm text-center bg-red-950/30 p-2 rounded border border-red-500/50">{authError}</div>}
                            <Button type="submit" className="w-full mt-4 bg-yellow-500 text-black border-none hover:bg-yellow-400">REGISTRAR</Button>
                        </form>
                        <div className="mt-6 text-center text-sm text-slate-500">
                            JÁ É UM OPERADOR? <button onClick={() => { setScreen(GameScreen.LOGIN); setAuthError(''); setRegName(''); setRegEmail(''); setPassword(''); }} className="text-cyan-400 hover:text-white ml-2 underline">VOLTAR AO LOGIN</button>
                        </div>
                    </div>
                </div>
            </div>
      )}

      {screen === GameScreen.MENU && (
          <div className="absolute inset-0 bg-black/60 z-20 backdrop-blur-sm overflow-y-auto">
            <div className="min-h-full flex flex-col items-center justify-center p-4 py-8">
                <div className="text-5xl md:text-8xl font-display font-bold glitch mb-2 text-center" data-text="NEON CIRCUIT" style={{ textShadow: `0 0 10px ${currentWallpaper.primaryColor}` }}>NEON CIRCUIT</div>
                <p className="tracking-widest mb-8 text-xl font-bold font-display text-center neon-text-shadow" style={{ color: currentWallpaper.primaryColor }}>CYBER MARBLE SIEGE</p>
                <div className="mb-6 flex flex-col items-center border border-slate-700 bg-slate-900/80 p-4 rounded-lg w-72">
                    <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm mb-2"><User size={14} /> OPERADOR: {playerState.username}</div>
                    <div className="w-full h-px bg-slate-700 mb-3"></div>
                    <div className="flex items-center gap-3 mb-2">
                         <span className="text-2xl">{currentRank.icon}</span>
                         <div className="text-left">
                             <div className="text-[10px] text-slate-400 uppercase tracking-widest">RANK ATUAL</div>
                             <div className="font-display font-bold text-lg" style={{ color: currentRank.color, textShadow: `0 0 5px ${currentRank.color}` }}>{currentRank.name}</div>
                         </div>
                    </div>
                    <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden mt-1"><div className="h-full" style={{ width: '100%', backgroundColor: currentRank.color, opacity: 0.5 }}></div></div>
                    <div className="text-[10px] text-slate-500 w-full text-right mt-1">SCORE TOTAL: {playerState.totalScore.toLocaleString()}</div>
                </div>
                
                {/* RETROACTIVE CLAIM BUTTON */}
                {(() => {
                    const nextClaimTarget = playerState.lastClaimedChestLevel + 5;
                    // If the user has beaten level 5 (unlocked 6), they can claim 5.
                    // unlockedLevels is 1-based, represents the level they are ABOUT to play.
                    // So if unlockedLevels = 6, they completed 5.
                    const maxCompleted = playerState.unlockedLevels - 1;
                    
                    if (nextClaimTarget <= maxCompleted) {
                        return (
                             <div className="mb-4 animate-bounce">
                                <Button variant="primary" onClick={() => openRetroactiveChest(nextClaimTarget)} className="bg-yellow-500 text-black hover:bg-yellow-400 border-2 border-yellow-200">
                                    <div className="flex items-center gap-2 font-bold"><Gift size={20} /> SUPRIMENTO NIVEL {nextClaimTarget}</div>
                                </Button>
                             </div>
                        );
                    }
                    return null;
                })()}

                <div className="flex flex-col gap-4 w-72">
                  <Button onClick={() => startGame(playerState.unlockedLevels)}><div className="flex items-center justify-center gap-2"><Play size={20} /> INICIAR HACK</div></Button>
                  <Button variant="secondary" onClick={() => setScreen(GameScreen.LEVEL_SELECT)}><div className="flex items-center justify-center gap-2"><Grid size={20} /> SELEÇÃO DE SETOR</div></Button>
                  <Button variant="secondary" onClick={() => setScreen(GameScreen.UPGRADES)}><div className="flex items-center justify-center gap-2"><Beaker size={20} /> LABORATÓRIO TECH</div></Button>
                  <Button variant="secondary" onClick={() => setScreen(GameScreen.CUSTOMIZE)}><div className="flex items-center justify-center gap-2"><Palette size={20} /> PERSONALIZAR</div></Button>
                  <Button variant="secondary" onClick={() => setScreen(GameScreen.LEADERBOARD)}><div className="flex items-center justify-center gap-2"><ListOrdered size={20} /> RANKING</div></Button>
                </div>
                <div className="mt-8 flex items-center gap-2 text-yellow-400 font-mono text-xl border border-yellow-400/30 bg-black/50 px-6 py-2 rounded"><Coins size={20} /> CRÉDITOS: {playerState.credits}</div>
                <div className="mt-8 flex gap-6">
                     <button onClick={toggleMusic} className="text-slate-400 hover:text-white transition-colors bg-slate-900/50 p-3 rounded-full border border-slate-700">{playerState.settings.musicVolume ? <Music size={24} /> : <div className="relative"><Music size={24} /><div className="absolute inset-0 border-t border-red-500 rotate-45 top-3"></div></div>}</button>
                     <button onClick={toggleSFX} className="text-slate-400 hover:text-white transition-colors bg-slate-900/50 p-3 rounded-full border border-slate-700">{playerState.settings.sfxVolume ? <Volume2 size={24} /> : <VolumeX size={24} />}</button>
                     <button onClick={handleLogout} className="text-red-500 hover:text-red-400 transition-colors bg-red-950/20 p-3 rounded-full border border-red-900" title="Logout"><LogOut size={24} /></button>
                </div>
            </div>
            {showDailyBonus && dailyReward && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-900 border-2 border-yellow-400 p-8 rounded-xl shadow-[0_0_50px_rgba(250,204,21,0.2)] max-w-sm w-full text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-yellow-400/5 pointer-events-none"></div>
                        <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
                        <Gift size={64} className="text-yellow-400 mx-auto mb-4 animate-bounce" />
                        <h2 className="text-3xl font-display text-white mb-2">LOGIN DIÁRIO</h2>
                        <p className="text-slate-400 mb-6">Sua sequência: <span className="text-yellow-400 font-bold">{playerState.loginStreak} DIAS</span></p>
                        <div className="bg-black/50 border border-slate-700 p-4 rounded-lg mb-8">
                            <div className="text-2xl font-mono text-yellow-400 flex items-center justify-center gap-2 mb-2"><Coins size={24} /> +{dailyReward.credits}</div>
                            {dailyReward.item && (<div className="text-lg font-display text-cyan-400 flex items-center justify-center gap-2 border-t border-slate-700 pt-2 mt-2"><Zap size={20} /> {dailyReward.itemLabel}</div>)}
                        </div>
                        <Button onClick={claimDailyBonus}><div className="flex items-center gap-2 text-yellow-900 font-bold">RESGATAR <Check size={20} /></div></Button>
                    </div>
                </div>
            )}
          </div>
      )}

      {screen === GameScreen.LEADERBOARD && (
            <div className="absolute inset-0 bg-slate-900/95 z-20 overflow-y-auto p-8 backdrop-blur-md">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-8 border-b border-slate-700 pb-4">
                        <div className="flex items-center gap-4"><Trophy size={40} style={{ color: currentWallpaper.primaryColor }} /><div><h2 className="text-4xl font-display neon-text-shadow" style={{ color: currentWallpaper.primaryColor }}>RANKING GLOBAL</h2><p className="text-slate-400 text-sm mt-1">Lista dos melhores operadores reais cadastrados no sistema.</p></div></div>
                        <Button variant="secondary" onClick={() => setScreen(GameScreen.MENU)}>VOLTAR</Button>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden min-h-[300px]">
                        <table className="w-full text-left">
                            <thead className="bg-black/40 text-slate-400 font-mono text-sm uppercase"><tr><th className="p-4">RANK</th><th className="p-4">OPERADOR</th><th className="p-4 text-center">PATENTE</th><th className="p-4 text-right">PONTUAÇÃO</th></tr></thead>
                            <tbody>
                                {loadingLeaderboard ? (<tr><td colSpan={4} className="p-8 text-center text-slate-500 italic">Acessando mainframe... Decodificando dados...</td></tr>) : leaderboardData.length === 0 ? (<tr><td colSpan={4} className="p-8 text-center text-slate-500 italic">Nenhum registro encontrado no sistema.</td></tr>) : (
                                    leaderboardData.map((entry, index) => (
                                        <tr key={index} className={`border-b border-slate-700/50 last:border-0 ${entry.isUser ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                            <td className="p-4 font-mono text-slate-500">{index === 0 && <span className="text-yellow-400 text-xl">🥇</span>}{index === 1 && <span className="text-slate-300 text-xl">🥈</span>}{index === 2 && <span className="text-amber-700 text-xl">🥉</span>}{index > 2 && index + 1}</td>
                                            <td className={`p-4 font-bold ${entry.isUser ? 'text-yellow-400' : 'text-white'}`}>{entry.name} {entry.isUser && <span className="text-xs ml-2 bg-yellow-500 text-black px-1 rounded">VOCÊ</span>}</td>
                                            <td className="p-4 text-center"><div className="flex items-center justify-center gap-2 bg-black/30 py-1 px-3 rounded-full border border-slate-700/50"><span className="text-lg">{entry.rank?.icon}</span><span className="font-display text-xs font-bold" style={{ color: entry.rank?.color }}>{entry.rank?.name}</span></div></td>
                                            <td className="p-4 text-right font-display text-xl" style={{ color: currentWallpaper.primaryColor }}>{entry.score.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
      )}

      {screen === GameScreen.CUSTOMIZE && (
            <div className="absolute inset-0 bg-slate-900/95 z-20 overflow-y-auto p-8 backdrop-blur-md">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-8 border-b border-slate-700 pb-4 sticky top-0 bg-slate-900/95 z-10 pt-4">
                        <div className="flex items-center gap-4"><Palette size={40} style={{ color: currentWallpaper.primaryColor }} /><div><h2 className="text-4xl font-display neon-text-shadow" style={{ color: currentWallpaper.primaryColor }}>PERSONALIZAÇÃO</h2><p className="text-slate-400 text-sm mt-1">Configure sua interface e sua aeronave.</p></div></div>
                         <div className="flex gap-4 items-center"><div className="text-yellow-400 font-mono flex items-center gap-2 text-xl mr-4 bg-black/30 px-3 py-1 rounded border border-yellow-400/20"><Coins size={24} /> {playerState.credits}</div><Button variant="secondary" onClick={() => setScreen(GameScreen.MENU)}>VOLTAR</Button></div>
                    </div>
                    <div className="flex gap-4 mb-8">
                        <button onClick={() => setCustomizeTab('WALLPAPERS')} className={`flex-1 py-4 text-lg font-display font-bold rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${customizeTab === 'WALLPAPERS' ? 'bg-slate-800 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-black/50 border-slate-700 text-slate-500 hover:text-white hover:border-slate-500'}`}><Grid size={20} /> TEMAS VISUAIS</button>
                        <button onClick={() => setCustomizeTab('SKINS')} className={`flex-1 py-4 text-lg font-display font-bold rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${customizeTab === 'SKINS' ? 'bg-slate-800 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'bg-black/50 border-slate-700 text-slate-500 hover:text-white hover:border-slate-500'}`}><Rocket size={20} /> AERONAVE (CORES)</button>
                    </div>
                    {customizeTab === 'WALLPAPERS' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <button onClick={() => selectWallpaper(WallpaperId.AUTO)} className={`relative h-48 rounded-xl overflow-hidden border-2 transition-all flex flex-col justify-end text-left p-4 group ${playerState.selectedWallpaper === WallpaperId.AUTO ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-105' : 'border-slate-700 opacity-80 hover:opacity-100 hover:scale-105'}`} style={{ background: 'linear-gradient(135deg, #100 0%, #001 50%, #010 100%)' }}>
                                <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)` }}></div>
                                <div className="relative z-10 flex justify-between items-end"><div><div className="flex items-center gap-2"><Shuffle size={20} className="text-white animate-spin-slow" /><h3 className="text-xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-green-400 to-blue-400 animate-pulse">ALEATÓRIO (AUTO)</h3></div><p className="text-xs text-slate-400 mt-1">Um tema diferente a cada nível.</p></div>{playerState.selectedWallpaper === WallpaperId.AUTO && <div className="bg-white text-black p-1 rounded-full"><Check size={20} /></div>}</div>
                            </button>
                            {WALLPAPERS.map((wp) => (
                                <button key={wp.id} onClick={() => selectWallpaper(wp.id)} className={`relative h-48 rounded-xl overflow-hidden border-2 transition-all flex flex-col justify-end text-left p-4 group ${playerState.selectedWallpaper === wp.id ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-105' : 'border-slate-700 opacity-80 hover:opacity-100 hover:scale-105'}`} style={{ background: wp.previewGradient }}>
                                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `linear-gradient(${wp.primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${wp.primaryColor} 1px, transparent 1px)`, backgroundSize: '20px 20px' }}></div>
                                    <div className="relative z-10 flex justify-between items-end"><div><h3 className="text-xl font-bold font-display text-white shadow-black drop-shadow-md">{wp.name}</h3><div className="flex gap-2 mt-2"><div className="w-4 h-4 rounded-full border border-white" style={{ background: wp.primaryColor }}></div><div className="w-4 h-4 rounded-full border border-white" style={{ background: wp.secondaryColor }}></div></div></div>{playerState.selectedWallpaper === wp.id && <div className="bg-white text-black p-1 rounded-full"><Check size={20} /></div>}</div>
                                </button>
                            ))}
                        </div>
                    )}
                    {customizeTab === 'SKINS' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                             {SKINS.map((skin) => {
                                 const isOwned = playerState.ownedSkins.includes(skin.id);
                                 const isSelected = playerState.selectedSkin === skin.id;
                                 const canAfford = playerState.credits >= skin.price;
                                 const rgbStyle = skin.id === SkinId.RGB ? { backgroundImage: 'linear-gradient(45deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)', backgroundSize: '200% 200%', animation: 'rgb-glow 2s linear infinite' } : {};
                                 return (
                                     <div key={skin.id} className={`relative border-2 rounded-xl p-6 flex flex-col gap-4 overflow-hidden transition-all ${isSelected ? 'bg-slate-800/80 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]' : 'bg-black/40 border-slate-700 hover:border-slate-500'}`}>
                                         <div className="absolute top-0 right-0 p-4">{isSelected && <div className="bg-cyan-400 text-black px-3 py-1 rounded-full text-xs font-bold font-display">EQUIPADO</div>}{!isOwned && <Lock size={20} className="text-slate-600" />}</div>
                                         <div className="h-32 flex items-center justify-center bg-black/50 rounded-lg border border-slate-800"><div className="relative w-16 h-16 flex items-center justify-center"><div className="w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[45px]" style={{ borderBottomColor: '#0f172a', filter: `drop-shadow(0 0 5px ${skin.colorHex === 'RGB' ? '#fff' : skin.colorHex})` }}></div><div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none"><div style={{ position: 'absolute', width: '0', height: '0', borderLeft: '25px solid transparent', borderRight: '25px solid transparent', borderBottom: `45px solid ${skin.colorHex === 'RGB' ? 'transparent' : skin.colorHex}`, opacity: 0.3, ...rgbStyle }}></div>{skin.id === SkinId.RGB && (<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold text-white z-10">RGB</div>)}</div></div></div>
                                         <div className="flex-1"><h3 className="text-2xl font-display font-bold text-white">{skin.name}</h3><p className="text-sm text-slate-400 leading-tight min-h-[40px]">{skin.description}</p></div>
                                         {isOwned ? (<button onClick={() => buyOrSelectSkin(skin.id, 0)} disabled={isSelected} className={`w-full py-3 rounded font-bold font-display uppercase tracking-wider ${isSelected ? 'bg-slate-700 text-slate-400 cursor-default' : 'bg-cyan-500 hover:bg-cyan-400 text-black'}`}>{isSelected ? 'SELECIONADO' : 'EQUIPAR'}</button>) : (<button onClick={() => buyOrSelectSkin(skin.id, skin.price)} disabled={!canAfford} className={`w-full py-3 rounded font-bold font-display flex items-center justify-center gap-2 ${canAfford ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>{skin.price === 0 ? 'GRÁTIS' : (<>COMPRAR <span className="font-mono text-sm bg-black/20 px-2 py-0.5 rounded">{skin.price.toLocaleString()}</span></>)}</button>)}
                                     </div>
                                 );
                             })}
                        </div>
                    )}
                </div>
            </div>
      )}

      {screen === GameScreen.UPGRADES && (
            <div className="absolute inset-0 bg-slate-900/95 z-20 overflow-y-auto p-8 backdrop-blur-md">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-8 border-b border-slate-700 pb-4">
                        <div className="flex items-center gap-4"><Beaker size={40} style={{ color: currentWallpaper.primaryColor }} /><div><h2 className="text-4xl font-display neon-text-shadow" style={{ color: currentWallpaper.primaryColor }}>LABORATÓRIO</h2><p className="text-slate-400 text-sm mt-1">Invista créditos em melhorias definitivas. O custo triplica a cada nível.</p></div></div>
                        <div className="flex gap-4 items-center"><div className="text-yellow-400 font-mono flex items-center gap-2 text-xl mr-4"><Coins size={24} /> {playerState.credits}</div><Button variant="secondary" onClick={() => setScreen(GameScreen.MENU)}>VOLTAR</Button></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {UPGRADES.map((upgrade) => {
                            const currentLevel = playerState.upgrades[upgrade.id] || 0;
                            const isMaxed = currentLevel >= upgrade.maxLevel;
                            const nextPrice = upgrade.basePrice * Math.pow(3, currentLevel);
                            const canAfford = playerState.credits >= nextPrice;
                            return (
                                <div key={upgrade.id} className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl flex flex-col items-center text-center hover:border-white transition-colors relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    <div className="absolute top-2 right-2 z-10"><div className="bg-cyan-900/80 border border-cyan-500/50 text-cyan-200 text-[9px] font-bold px-2 py-1 rounded tracking-widest uppercase">MELHORIA PERMANENTE</div></div>
                                    <div className="text-5xl mb-4 p-4 bg-black/40 rounded-full border border-slate-600 shadow-lg relative z-10">{upgrade.icon}</div>
                                    <h3 className="text-xl font-bold text-white mb-2 relative z-10">{upgrade.name}</h3>
                                    <p className="text-slate-300 text-xs mb-6 h-12 relative z-10 leading-tight">{upgrade.description}</p>
                                    <div className="flex gap-1 mb-6 relative z-10">{Array.from({ length: upgrade.maxLevel }).map((_, i) => (<div key={i} className={`w-3 h-3 rounded-full ${i < currentLevel ? 'shadow-glow' : 'bg-slate-700'}`} style={{ backgroundColor: i < currentLevel ? currentWallpaper.primaryColor : undefined }} />))}</div>
                                    {isMaxed ? (<div className="bg-slate-700/50 w-full py-3 rounded text-slate-300 font-mono relative z-10">NÍVEL MÁXIMO</div>) : (<button onClick={() => handleUpgradeBuy(upgrade.id, nextPrice)} disabled={!canAfford} className={`relative z-10 w-full py-3 rounded font-bold font-mono transition-all flex items-center justify-center gap-2 ${canAfford ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}><ArrowUpCircle size={18} />{nextPrice.toLocaleString()} CR</button>)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
      )}

      {screen === GameScreen.LEVEL_SELECT && (
          <div className="absolute inset-0 bg-slate-900/95 z-20 overflow-y-auto p-8 backdrop-blur-md">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-900/95 p-4 border-b border-slate-700 z-10">
                <h2 className="text-4xl font-display neon-text-shadow" style={{ color: currentWallpaper.primaryColor }}>SELECIONAR SETOR</h2>
                <div className="flex gap-4 items-center"><div className="text-yellow-400 font-mono flex items-center gap-2 mr-4"><Coins size={16} /> {playerState.credits}</div><Button variant="secondary" onClick={() => setScreen(GameScreen.MENU)}>VOLTAR</Button></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {LEVELS.map((level) => {
                  const unlocked = level.id <= playerState.unlockedLevels;
                  const highScore = playerState.highScores[level.id] || 0;
                  const isNext = level.id === playerState.unlockedLevels;
                  return (
                    <button key={level.id} disabled={!unlocked} onClick={() => startGame(level.id)} className={`aspect-square border-2 transition-all flex flex-col items-center justify-center group relative overflow-hidden rounded-lg ${unlocked ? 'bg-slate-800 border-slate-700 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] cursor-pointer' : 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'} ${isNext ? 'shadow-[0_0_10px_rgba(255,255,255,0.3)] animate-pulse' : ''}`} style={{ borderColor: isNext ? currentWallpaper.primaryColor : (unlocked ? undefined : undefined) }}>
                      {unlocked ? (<><span className={`text-2xl font-display mb-1 relative z-10 ${isNext ? '' : 'text-slate-400 group-hover:text-white'}`} style={{ color: isNext ? currentWallpaper.primaryColor : undefined }}>{level.id}</span><div className="text-[9px] text-slate-500 uppercase relative z-10">{level.pathType}</div>{highScore > 0 && <div className="text-[10px] text-yellow-400 mt-1 font-mono">★ {highScore}</div>}</>) : (<Lock size={20} className="text-slate-700" />)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
      )}

      {screen === GameScreen.PLAYING && (
          <>
            <div className="absolute inset-0 pointer-events-none z-30 opacity-50" style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}></div>
            <div className="absolute inset-0 pointer-events-none z-30" style={{ background: 'radial-gradient(circle, rgba(0,0,0,0) 50%, rgba(0,0,0,0.8) 100%)' }}></div>
            <div className="absolute top-4 left-4 md:top-6 md:left-6 z-50 pointer-events-auto"><button onClick={togglePause} className="bg-black/80 border border-slate-600 hover:border-white p-3 md:p-4 rounded clip-path-slant text-white shadow-lg transition-all hover:scale-105 active:scale-95"><Pause size={24} className="md:w-8 md:h-8" /></button></div>
            {showTutorial && (<div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300"><div className="bg-slate-900 border-2 border-slate-500 p-8 rounded-xl shadow-2xl max-w-md w-full relative overflow-hidden flex flex-col items-center text-center"><div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div><h2 className="text-xl font-display tracking-widest text-cyan-400 mb-6 border-b border-slate-700 pb-2 w-full">INICIALIZAÇÃO DO SISTEMA ({tutorialStep + 1}/{TUTORIAL_STEPS.length})</h2><div className="flex-1 flex flex-col items-center justify-center min-h-[200px] mb-6">{TUTORIAL_STEPS[tutorialStep].icon}<h3 className="text-2xl font-bold text-white mb-4">{TUTORIAL_STEPS[tutorialStep].title}</h3><p className="text-slate-300">{TUTORIAL_STEPS[tutorialStep].description}</p></div><Button onClick={handleNextTutorialStep}><div className="flex items-center gap-2">{tutorialStep < TUTORIAL_STEPS.length - 1 ? 'PRÓXIMO' : 'INICIAR MISSÃO'} <ArrowRight size={20} /></div></Button></div></div>)}
            {isPaused && !showTutorial && (<div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-200"><div className="bg-slate-900 border-2 border-slate-700 p-8 rounded-xl shadow-2xl max-w-sm w-full relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-1" style={{ background: currentWallpaper.primaryColor }}></div><h2 className="text-3xl font-display text-center mb-8 neon-text-shadow tracking-wider" style={{ color: currentWallpaper.primaryColor }}>SISTEMA SUSPENSO</h2><div className="flex flex-col gap-4"><Button onClick={togglePause}><div className="flex items-center gap-2"><Play size={20} /> CONTINUAR</div></Button><div className="flex gap-4"><button onClick={toggleMusic} className={`flex-1 py-3 border rounded font-display text-sm flex items-center justify-center gap-2 transition-all ${playerState.settings.musicVolume ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' : 'bg-black border-red-900 text-red-700'}`}>{playerState.settings.musicVolume ? <Music size={18} /> : <div className="relative"><Music size={18} /><div className="absolute inset-0 border-t border-red-500 rotate-45 top-2"></div></div>} MÚSICA</button><button onClick={toggleSFX} className={`flex-1 py-3 border rounded font-display text-sm flex items-center justify-center gap-2 transition-all ${playerState.settings.sfxVolume ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' : 'bg-black border-red-900 text-red-700'}`}>{playerState.settings.sfxVolume ? <Volume2 size={18} /> : <VolumeX size={18} />} SONS</button></div><Button variant="danger" onClick={quitToMenu}><div className="flex items-center gap-2"><LogOut size={20} /> ABORTAR MISSÃO</div></Button></div></div></div>)}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-40 pl-20 md:pl-28 pt-6 md:pt-4"><div className="bg-black/60 backdrop-blur-md p-2 md:p-3 px-4 md:px-6 border-l-4 clip-path-slant shadow-[0_0_20px_rgba(0,0,0,0.5)]" style={{ borderColor: currentWallpaper.primaryColor }}><div className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase" style={{ color: currentWallpaper.primaryColor }}>Pontos</div><div className="text-xl md:text-2xl font-display text-white">{score.toLocaleString()}</div></div><div className="bg-black/60 backdrop-blur-md p-3 px-6 border border-yellow-400/30 rounded flex items-center gap-2 hidden lg:flex"><Coins className="text-yellow-400" size={18} /><span className="text-xl font-mono text-yellow-400">{playerState.credits}</span></div><div className="bg-black/60 backdrop-blur-md p-2 md:p-3 px-4 md:px-6 border-r-4 clip-path-slant text-right shadow-[0_0_20px_rgba(0,0,0,0.5)]" style={{ borderColor: currentWallpaper.secondaryColor }}><div className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase" style={{ color: currentWallpaper.secondaryColor }}>Setor</div><div className="text-xl md:text-2xl font-display text-white">{currentLevelId} <span className="text-xs md:text-sm text-gray-400">/ 1000</span></div></div></div>
            <div className={`absolute right-0 top-1/2 -translate-y-1/2 z-40 p-2 flex flex-col gap-4 pointer-events-auto transition-opacity duration-300 ${isPaused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                 {SHOP_ITEMS.map(item => {
                     const owned = playerState.inventory[item.id] || 0;
                     const canAfford = playerState.credits >= item.price;
                     const isActionable = owned > 0 || canAfford;
                     return (<div key={item.id} className="group relative flex items-center justify-end"><div className="absolute right-full mr-2 bg-black/90 border border-slate-600 p-2 w-40 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block"><div className="font-bold text-white text-sm">{item.name}</div><div className="text-[10px] text-slate-400 leading-tight">{item.description}</div></div><button onClick={() => handleSmartAction(item.id, item.price)} disabled={!isActionable} className={`relative flex flex-col items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-l-xl border-y border-l transition-all active:scale-95 ${owned > 0 ? 'bg-blue-900/80 border-white hover:bg-cyan-900 shadow-[0_0_15px_rgba(0,240,255,0.3)]' : canAfford ? 'bg-slate-900/80 border-yellow-600 hover:bg-slate-800' : 'bg-black/60 border-slate-800 opacity-50 grayscale'}`} style={{ borderColor: owned > 0 ? currentWallpaper.primaryColor : undefined }}><div className="text-xl md:text-2xl mb-1">{item.icon}</div>{owned > 0 ? (<div className="absolute -top-2 -right-2 text-black font-bold w-5 h-5 rounded-full flex items-center justify-center text-xs shadow-glow" style={{ backgroundColor: currentWallpaper.primaryColor }}>{owned}</div>) : (<div className="text-[9px] font-mono text-yellow-400 font-bold">{item.price}</div>)}<div className="text-[7px] md:text-[8px] font-bold uppercase tracking-tighter">{owned > 0 ? 'ATIVAR' : 'COMPRAR'}</div></button></div>);
                 })}
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs md:max-w-md px-4 pointer-events-none z-40 mb-safe"><div className="h-3 bg-slate-900/80 rounded-full overflow-hidden border border-slate-600 shadow-lg relative"><div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${currentWallpaper.primaryColor}, ${currentWallpaper.secondaryColor})` }} /></div></div>
            <GameCanvas ref={gameRef} levelConfig={currentLevelConfig} upgrades={playerState.upgrades} wallpaperId={activeWallpaperId} selectedSkin={playerState.selectedSkin} isPaused={isPaused} sfxEnabled={playerState.settings.sfxVolume} musicEnabled={playerState.settings.musicVolume} onGameOver={handleGameOver} onScoreUpdate={setScore} onCreditsUpdate={handleCreditsEarned} onProgressUpdate={setProgress} onPowerupUsed={handlePowerupConsumed} />
          </>
      )}

      {screen === GameScreen.VICTORY && (
          <>
          {/* NOTE: Chest Modal moved to global scope */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 backdrop-blur-sm">
             <Trophy size={64} className="text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
             <h2 className="text-5xl font-display mb-2 neon-text-shadow" style={{ color: currentWallpaper.primaryColor }}>SETOR LIMPO</h2>
             <p className="text-xl text-white mb-2 font-mono">PONTOS: <span style={{ color: currentWallpaper.secondaryColor }}>{gameResultScore}</span></p>
             
             <div className="bg-black/40 p-4 rounded-xl border border-yellow-400/30 mb-8 backdrop-blur-md w-72">
                <div className="flex justify-between items-center gap-4 mb-2">
                    <span className="text-slate-400 text-xs uppercase tracking-widest">Base</span>
                    <span className="font-mono text-yellow-400 text-sm">{CREDITS_LEVEL_CLEAR} CR</span>
                </div>
                <div className="flex justify-between items-center gap-4 mb-2">
                    <span className="text-slate-400 text-xs uppercase tracking-widest">Performance</span>
                    <span className="font-mono text-cyan-400 text-sm">+{gameResultBonus - CREDITS_LEVEL_CLEAR} CR</span>
                </div>
                <div className="w-full h-px bg-slate-700 my-2"></div>
                <div className="flex justify-between items-center gap-4">
                    <span className="text-white font-bold text-sm">TOTAL</span>
                    <span className="font-mono text-xl text-yellow-400 font-bold flex items-center gap-2">
                        <Coins size={18} /> {gameResultBonus}
                    </span>
                </div>
             </div>

             <div className="flex gap-4"><Button variant="secondary" onClick={() => setScreen(GameScreen.MENU)}>MENU</Button><Button onClick={nextLevel}>PRÓXIMO SETOR</Button></div>
          </div>
          </>
      )}

      {screen === GameScreen.GAME_OVER && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 z-50 backdrop-blur-sm">
               <ShieldAlert size={64} className="text-red-500 mb-4 animate-pulse drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]" />
               <h2 className="text-5xl font-display text-red-500 mb-2 neon-text-shadow">GAME OVER</h2>
               <p className="text-xl text-white mb-8 tracking-widest text-center px-4">NÚCLEO DE DADOS DESTRUÍDO</p>
               <div className="flex gap-4"><Button variant="secondary" onClick={() => setScreen(GameScreen.MENU)}>MENU</Button><Button onClick={() => startGame(currentLevelId)}>TENTAR NOVAMENTE</Button></div>
            </div>
      )}
      
      <div className="absolute bottom-2 right-2 text-[10px] text-slate-700 font-mono z-50">v8.4.1 // MOBILE_FIX</div>
    </div>
  );
}