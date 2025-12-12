import React from 'react';

export enum GameScreen {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  MENU = 'MENU',
  LEVEL_SELECT = 'LEVEL_SELECT',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  SHOP = 'SHOP',
  UPGRADES = 'UPGRADES',
  CUSTOMIZE = 'CUSTOMIZE',
  LEADERBOARD = 'LEADERBOARD',
  PROFILE_SETUP = 'PROFILE_SETUP'
}

export enum MarbleColor {
  CYAN = '#00f0ff',
  MAGENTA = '#ff00ff',
  YELLOW = '#f0ff00',
  GREEN = '#00ff41',
  RED = '#ff003c',
  WHITE = '#ffffff'
}

export enum MarbleType {
  NORMAL = 'NORMAL',
  WILDCARD = 'WILDCARD', // Matches any color
  BOMB = 'BOMB',          // Explodes on impact
  ICE = 'ICE',           // Slows down the chain
  COIN = 'COIN'          // Gives bonus credits
}

export enum PowerupType {
  EMP = 'EMP', // Large explosion
  SLOW = 'SLOW', // Slow time
  REVERSE = 'REVERSE' // Force back
}

export enum UpgradeType {
  SPEED = 'SPEED',         // Projectile Speed
  LUCK = 'LUCK',           // Chance of special marbles
  EFFICIENCY = 'EFFICIENCY', // Score multiplier
  BLAST_RADIUS = 'BLAST_RADIUS', // Bomb/EMP Radius
  REVERSE_FORCE = 'REVERSE_FORCE' // Magnetic Pull Strength
}

export enum WallpaperId {
  AUTO = 'AUTO', // Selects random every level
  CLASSIC = 'CLASSIC',
  MATRIX = 'MATRIX',
  RETROWAVE = 'RETROWAVE',
  CRIMSON = 'CRIMSON',
  GOLDEN = 'GOLDEN',
  JUNGLE = 'JUNGLE',
  OCEAN = 'OCEAN',
  CYBER = 'CYBER',
  VAPOR = 'VAPOR',
  TOXIC = 'TOXIC'
}

export enum SkinId {
  DEFAULT = 'DEFAULT', // Cyan
  CRIMSON = 'CRIMSON', // Red
  GOLD = 'GOLD',       // Yellow
  TOXIC = 'TOXIC',     // Green
  AMETHYST = 'AMETHYST', // Purple
  VOID = 'VOID',       // Black/Stealth
  RGB = 'RGB'          // Animated Rainbow
}

export interface RankConfig {
  id: string;
  name: string;
  minScore: number;
  color: string;
  icon?: string; // Emoji fallback
}

export interface PlayerSettings {
  musicVolume: boolean;
  sfxVolume: boolean;
}

export interface PlayerState {
  username: string; // New field for player name
  email?: string; // Field for email reference
  credits: number;
  unlockedLevels: number;
  tutorialCompleted: boolean;
  // Daily Bonus Tracking
  lastLoginDate?: string; // ISO string YYYY-MM-DD
  loginStreak: number;
  
  inventory: {
    [key in PowerupType]: number;
  };
  upgrades: {
    [key in UpgradeType]: number; // Current Level (0 to max)
  };
  highScores: { [levelId: number]: number };
  totalScore: number; // Sum of all high scores for leaderboard
  
  selectedWallpaper: WallpaperId;
  
  // Skin System
  ownedSkins: SkinId[];
  selectedSkin: SkinId;

  settings: PlayerSettings;
}

export interface ShopItem {
  id: PowerupType;
  name: string;
  description: string;
  price: number;
  icon: string;
}

export interface UpgradeConfig {
  id: UpgradeType;
  name: string;
  description: string;
  basePrice: number;
  maxLevel: number;
  icon: React.ReactNode;
}

export interface WallpaperConfig {
  id: WallpaperId;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  previewGradient: string;
}

export interface SkinConfig {
  id: SkinId;
  name: string;
  description: string;
  price: number;
  colorHex: string; // Used for UI preview
}

export interface Point {
  x: number;
  y: number;
}

export interface Marble {
  id: string;
  color: MarbleColor;
  type: MarbleType;
  offset: number; // Position along the path (0 to pathLength)
  speed: number;
  backwards: boolean; // Is it being pulled back to close a gap?
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: MarbleColor;
  isEmp?: boolean; // Special property for EMP shot
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0 to 1
  color: string;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  scale: number; // For combo emphasis
}

export interface LevelConfig {
  id: number;
  speedMultiplier: number;
  colors: MarbleColor[];
  spawnCount: number;
  pathType: 'spiral' | 'sine' | 'infinity' | 'circle' | 'hourglass' | 'super-ellipse' | 'heart' | 'clover-4' | 'bow';
  mapScale: number;
}