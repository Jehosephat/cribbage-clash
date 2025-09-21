import { createInitialState } from '@cribbage-clash/rules';
import Phaser from 'phaser';
import Boot from './scenes/Boot';
import LobbyScene from './scenes/LobbyScene';
import MatchScene from './scenes/MatchScene';
import MenuScene from './scenes/MenuScene';
import ResultsScene from './scenes/ResultsScene';

const state = createInitialState();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0f172a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540
  },
  fps: {
    target: 60,
    forceSetTimeOut: true
  },
  render: {
    antialias: true,
    pixelArt: false
  },
  scene: [Boot, MenuScene, LobbyScene, MatchScene, ResultsScene],
  dom: {
    createContainer: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  }
};

export const gameState = state;

export const game = new Phaser.Game(config);
