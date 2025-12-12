

import { LevelConfig, MarbleColor, PowerupType, ShopItem, UpgradeConfig, UpgradeType, WallpaperConfig, WallpaperId, RankConfig, SkinConfig, SkinId } from './types';
import { Zap, Crosshair, Clover, Triangle, Hexagon, Circle, Shield } from 'lucide-react';

export const MARBLE_RADIUS = 13; // Reduzido de 16 para 13
export const PATH_WIDTH = 28;    // Ajustado para o novo tamanho
export const SHOOTER_SIZE = 45;
export const PROJECTILE_SPEED = 60; // Projetil um pouco mais rápido para compensar alvos menores
export const BASE_SPAWN_RATE = 50;

export const COLORS = [
  MarbleColor.CYAN,
  MarbleColor.MAGENTA,
  MarbleColor.YELLOW,
  MarbleColor.GREEN,
  MarbleColor.RED,
  MarbleColor.WHITE
];

// Economy
export const CREDITS_PER_MARBLE = 10;
export const CREDITS_PER_COMBO = 50;
export const CREDITS_LEVEL_CLEAR = 500;

export const RANKS: RankConfig[] = [
  { id: 'NOOB', name: 'SCRIPT KIDDIE', minScore: 0, color: '#94a3b8', icon: '👶' },
  { id: 'HACKER', name: 'GREY HAT', minScore: 10000, color: '#00f0ff', icon: '💻' },
  { id: 'PRO', name: 'NETRUNNER', minScore: 50000, color: '#00ff41', icon: '🔋' },
  { id: 'ELITE', name: 'CYBER ELITE', minScore: 150000, color: '#f0ff00', icon: '⚡' },
  { id: 'MASTER', name: 'SYSTEM LORD', minScore: 500000, color: '#ff00ff', icon: '👑' },
  { id: 'GOD', name: 'SINGULARITY', minScore: 1000000, color: '#ff003c', icon: '🧿' }
];

export const SKINS: SkinConfig[] = [
  {
    id: SkinId.DEFAULT,
    name: 'NEON BLUE',
    description: 'Chassi padrão de emissão de fótons azuis.',
    price: 0,
    colorHex: '#00f0ff'
  },
  {
    id: SkinId.CRIMSON,
    name: 'CRIMSON RED',
    description: 'Acabamento agressivo em vermelho.',
    price: 5000,
    colorHex: '#ff003c'
  },
  {
    id: SkinId.TOXIC,
    name: 'TOXIC GREEN',
    description: 'Borda radioativa verde.',
    price: 10000,
    colorHex: '#39ff14'
  },
  {
    id: SkinId.GOLD,
    name: 'ROYAL GOLD',
    description: 'Banhado a ouro digital.',
    price: 20000,
    colorHex: '#ffd700'
  },
  {
    id: SkinId.AMETHYST,
    name: 'AMETHYST',
    description: 'Roxo profundo de alta energia.',
    price: 30000,
    colorHex: '#9d00ff'
  },
  {
    id: SkinId.VOID,
    name: 'VOID BLACK',
    description: 'Absorve luz. Borda escura.',
    price: 40000,
    colorHex: '#111111'
  },
  {
    id: SkinId.RGB,
    name: 'RGB MASTER',
    description: 'Ciclo cromático animado. O auge do estilo.',
    price: 75000,
    colorHex: 'RGB' // Special handler
  }
];

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: PowerupType.EMP,
    name: 'CARGA PEM',
    description: 'Explosão eletromagnética em área.',
    price: 300,
    icon: '⚡'
  },
  {
    id: PowerupType.SLOW,
    name: 'DILATADOR',
    description: 'Câmera lenta por 10s.',
    price: 150,
    icon: '⏳'
  },
  {
    id: PowerupType.REVERSE,
    name: 'REVERSO',
    description: 'Força recuo dos dados.',
    price: 200,
    icon: '⏪'
  }
];

export const UPGRADES: UpgradeConfig[] = [
  {
    id: UpgradeType.SPEED,
    name: 'VELOCIDADE DO PROJÉTIL',
    description: 'Aumenta a velocidade de disparo do drone.',
    basePrice: 1500,
    maxLevel: 5,
    icon: '🚀'
  },
  {
    id: UpgradeType.LUCK,
    name: 'ALGORITMO DA SORTE',
    description: 'Aumenta chance de Curingas e Bombas.',
    basePrice: 2400,
    maxLevel: 5,
    icon: '🍀'
  },
  {
    id: UpgradeType.EFFICIENCY,
    name: 'MINERAÇÃO DE DADOS',
    description: 'Aumenta os pontos e créditos ganhos.',
    basePrice: 3000,
    maxLevel: 5,
    icon: '💎'
  },
  {
    id: UpgradeType.BLAST_RADIUS,
    name: 'EXPANSÃO DE IMPACTO',
    description: 'Aumenta permanentemente o raio de explosão das Bombas e Cargas PEM.',
    basePrice: 2000,
    maxLevel: 5,
    icon: '💥'
  },
  {
    id: UpgradeType.REVERSE_FORCE,
    name: 'TRAÇÃO MAGNÉTICA',
    description: 'Aumenta a força com que as esferas recuam para fechar buracos na trilha.',
    basePrice: 1800,
    maxLevel: 5,
    icon: '🧲'
  }
];

export const WALLPAPERS: WallpaperConfig[] = [
  {
    id: WallpaperId.CLASSIC,
    name: 'NEON PRIME',
    primaryColor: '#00f0ff',
    secondaryColor: '#ff00ff',
    bgColor: '#050510',
    previewGradient: 'linear-gradient(135deg, #050510 0%, #001020 100%)'
  },
  {
    id: WallpaperId.MATRIX,
    name: 'SYSTEM HACK',
    primaryColor: '#00ff41',
    secondaryColor: '#003b00',
    bgColor: '#000a00',
    previewGradient: 'linear-gradient(135deg, #000000 0%, #001a00 100%)'
  },
  {
    id: WallpaperId.RETROWAVE,
    name: 'SUNSET GRID',
    primaryColor: '#ff00aa',
    secondaryColor: '#00f0ff',
    bgColor: '#1a0b2e',
    previewGradient: 'linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 100%)'
  },
  {
    id: WallpaperId.CRIMSON,
    name: 'RED ALERT',
    primaryColor: '#ff003c',
    secondaryColor: '#ffaa00',
    bgColor: '#1a0505',
    previewGradient: 'linear-gradient(135deg, #1a0505 0%, #2e0b0b 100%)'
  },
  {
    id: WallpaperId.GOLDEN,
    name: 'LUXURY DATA',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    bgColor: '#121212',
    previewGradient: 'linear-gradient(135deg, #121212 0%, #2a2a2a 100%)'
  },
  {
    id: WallpaperId.JUNGLE,
    name: 'NEON JUNGLE',
    primaryColor: '#39ff14',
    secondaryColor: '#ff9900',
    bgColor: '#051a05',
    previewGradient: 'linear-gradient(135deg, #051a05 0%, #0d2e0d 100%)'
  },
  {
    id: WallpaperId.OCEAN,
    name: 'DEEP OCEAN',
    primaryColor: '#00ffff',
    secondaryColor: '#0077be',
    bgColor: '#001020',
    previewGradient: 'linear-gradient(135deg, #001020 0%, #002040 100%)'
  },
  {
    id: WallpaperId.CYBER,
    name: 'CITY 2077',
    primaryColor: '#fcee0a',
    secondaryColor: '#00e5ff',
    bgColor: '#1a1a00',
    previewGradient: 'linear-gradient(135deg, #1a1a00 0%, #2e2e00 100%)'
  },
  {
    id: WallpaperId.VAPOR,
    name: 'VAPORWAVE',
    primaryColor: '#ff99ff',
    secondaryColor: '#99ffff',
    bgColor: '#2a1a2a',
    previewGradient: 'linear-gradient(135deg, #2a1a2a 0%, #3a2a3a 100%)'
  },
  {
    id: WallpaperId.TOXIC,
    name: 'BIOHAZARD',
    primaryColor: '#ccff00',
    secondaryColor: '#aa00ff',
    bgColor: '#1a1a1a',
    previewGradient: 'linear-gradient(135deg, #1a1a1a 0%, #2a1a2a 100%)'
  }
];

// Generate 1000 levels with increasing difficulty
export const LEVELS: LevelConfig[] = Array.from({ length: 1000 }, (_, i) => {
  const difficulty = i + 1;
  
  // Color progression (starts easy, gets colorful)
  let colorCount = 3;
  if (difficulty > 10) colorCount = 4;
  if (difficulty > 30) colorCount = 5;
  if (difficulty > 60) colorCount = 6;

  const levelColors = COLORS.slice(0, colorCount);

  // Path types rotate - MOBILE OPTIMIZED SET (No sharp corners, no complex shapes)
  const pathTypes: LevelConfig['pathType'][] = [
      'circle', 
      'infinity', 
      'spiral', 
      'hourglass', 
      'sine', 
      'super-ellipse',
      'heart',
      'clover-4',
      'bow'
  ];
  
  // Speed curve: Reduced base speed significantly for mobile playability
  // From 0.8 base to 0.6 base.
  const speedMultiplier = 0.6 + (Math.log(difficulty + 5) / Math.log(1000)) * 1.0;
  
  const spawnCount = 30 + Math.floor(difficulty * 1.5);

  return {
    id: difficulty,
    speedMultiplier: parseFloat(speedMultiplier.toFixed(2)),
    colors: levelColors,
    spawnCount: spawnCount,
    pathType: pathTypes[i % pathTypes.length],
    mapScale: 1.0
  };
});