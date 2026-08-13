import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import { TILE_SIZE } from '../../shared/gameConfig.js';

// Config assumes map1's 19x13 grid for now; once map selection is wired up
// this should size itself dynamically per map.
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 19 * TILE_SIZE,
  height: 13 * TILE_SIZE,
  backgroundColor: '#0a0a12',
  pixelArt: true,
  scene: [GameScene]
};

new Phaser.Game(config);
