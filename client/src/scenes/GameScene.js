import Phaser from 'phaser';
import { TILE_SIZE, MOVE_SPEED_TILES_PER_SEC } from '../../../shared/gameConfig.js';
import { connectToRoom } from '../net/partyClient.js';
import { ensureCatTextures } from '../catSprites.js';

// GameScene: renders the map, both cats, and the ready/countdown/score UI, and
// talks to the room server for kibble/collision/win authority. Movement itself
// is driven locally (grid tween) and reported to the server each time a tile
// change completes.
//
// NOT implemented yet (see project README "Next steps"): bot AI, random map
// selection among 5 maps, shareable match links.

const RULES_TEXT =
  'You win if you have eaten the most amount of kibble by the time all the kibble ' +
  'is gone or if your opponent disconnected from the match. The game ends when ' +
  'someone wins or someone loses. If you touch your opponent, whoever has eaten ' +
  'fewer kibble will be stunned for a few seconds and then will randomly re-spawn. ' +
  'Use the arrow keys to move.';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.myCatId = null;
    this.map = null;
    this.mapGraphics = null;
    this.kibbleGraphics = null;
    this.kibbleDots = new Map(); // "col,row" -> graphics-cleared flag handled via redraw
    this.sprites = {}; // catId -> { rect, label }
    this.aliveMe = true;
    this.started = false;
    this.gameOver = false;
    this.isMoving = false;
    this.myPos = { col: 0, row: 0 };
    this.scores = { kim: 0, kaylie: 0 };

    ensureCatTextures(this);

    this.statusText = this.add.text(10, 10, 'Connecting...', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }).setDepth(10);
    this.scoreText = this.add.text(10, 30, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' }).setDepth(10);

    this.rulesText = this.add.text(0, 0, RULES_TEXT, {
      fontFamily: 'monospace', fontSize: '11px', color: '#cfd8e3', align: 'center'
    }).setOrigin(0.5, 1).setDepth(10).setVisible(false);

    this.readyButton = this.add.text(0, 0, '[ READY ]', { fontFamily: 'monospace', fontSize: '20px', color: '#8fef7f', backgroundColor: '#222' })
      .setPadding(10)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)
      .setVisible(false)
      .on('pointerdown', () => {
        this.net.send({ type: 'ready' });
        this.readyButton.setText('[ WAITING FOR OPPONENT ]').disableInteractive();
        this.rulesText.setVisible(false);
      });

    this.cursors = this.input.keyboard.createCursorKeys();

    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room') || 'local-test-room';
    this.net = connectToRoom(roomId, (msg) => this.handleMessage(msg));
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'full':
        this.statusText.setText('Room already has 2 players. Try a different ?room= link.');
        break;
      case 'welcome': {
        if (this.map) {
          // A second 'welcome' means the room reset after a mid-match disconnect
          // (see 'gameOver' with reason 'opponentDisconnected' below) - tear down
          // the previous match's sprites/graphics before rebuilding, so we don't
          // end up with duplicate cats or a stale kibble layer.
          this.resetSceneState();
        }
        this.myCatId = msg.catId;
        this.map = msg.map;
        this.myPos = { col: msg.spawn[0], row: msg.spawn[1] };
        this.kibble = new Set(msg.kibble);
        this.resizeToMap(this.map);
        this.drawMap(this.map);
        this.spawnCat(this.myCatId, msg.spawn[0], msg.spawn[1]);
        this.positionReadyButton();

        const existingPlayers = msg.existingPlayers || [];
        if (existingPlayers.length > 0) {
          // An opponent was already in the room before we connected - spawn them
          // and unlock Ready immediately, same as the 'playerJoined' case below.
          for (const p of existingPlayers) this.spawnCat(p.catId, p.col, p.row);
          this.statusText.setText('Both cats present. Click ready!');
          this.readyButton.setVisible(true);
          this.rulesText.setVisible(true);
        } else {
          this.statusText.setText(`You are ${this.capitalize(this.myCatId)}. Waiting for opponent...`);
        }
        break;
      }
      case 'playerJoined':
        this.spawnCat(msg.catId, msg.col, msg.row);
        this.statusText.setText('Both cats present. Click ready!');
        this.readyButton.setVisible(true);
        this.rulesText.setVisible(true);
        break;
      case 'countdown':
        this.readyButton.setVisible(false);
        this.rulesText.setVisible(false);
        this.statusText.setText(`Starting in ${msg.value}...`);
        break;
      case 'start':
        this.started = true;
        this.statusText.setText('GO!');
        this.time.delayedCall(600, () => { if (this.started) this.statusText.setText(''); });
        break;
      case 'playerMoved':
        if (msg.catId !== this.myCatId) this.moveSpriteTo(msg.catId, msg.col, msg.row);
        break;
      case 'kibbleEaten': {
        const key = `${msg.col},${msg.row}`;
        this.kibble.delete(key);
        this.redrawKibble();
        this.scores[msg.catId] = msg.score;
        this.updateScoreText();
        break;
      }
      case 'collision':
        if (msg.tie) break;
        if (msg.loser === this.myCatId) {
          this.aliveMe = false;
          this.setCatVisible(this.myCatId, false);
        } else {
          this.setCatVisible(msg.loser, false);
        }
        break;
      case 'respawn':
        this.moveSpriteTo(msg.catId, msg.col, msg.row);
        this.setCatVisible(msg.catId, true);
        if (msg.catId === this.myCatId) {
          this.myPos = { col: msg.col, row: msg.row };
          this.aliveMe = true;
        }
        break;
      case 'gameOver': {
        this.gameOver = true;
        const kim = msg.scores.kim ?? 0;
        const kaylie = msg.scores.kaylie ?? 0;
        const result = msg.winner === 'tie' ? "It's a tie!" : `${this.capitalize(msg.winner)} wins!`;
        const prefix = msg.reason === 'opponentDisconnected' ? 'Opponent disconnected - ' : 'Game over - ';
        this.statusText.setText(`${prefix}${result}  (Kim: ${kim}, Kaylie: ${kaylie})`);
        // On a mid-match disconnect, the server resets the room ~3s after this and
        // sends a fresh 'welcome' to whoever's left - no action needed here, the
        // 'welcome' handler above tears down and rebuilds the scene when it arrives.
        break;
      }
      case 'opponentLeft':
        this.statusText.setText('Opponent disconnected. Waiting for opponent...');
        this.readyButton.setText('[ READY ]').setVisible(false).setInteractive({ useHandCursor: true });
        this.rulesText.setVisible(false);
        break;
      default:
        break;
    }
  }

  resizeToMap(map) {
    this.scale.resize(map.cols * TILE_SIZE, map.rows * TILE_SIZE);
  }

  positionReadyButton() {
    this.readyButton.setPosition(this.map.cols * TILE_SIZE / 2 - 90, this.map.rows * TILE_SIZE / 2 - 15);
    this.rulesText.setWordWrapWidth(this.map.cols * TILE_SIZE - 40);
    this.rulesText.setPosition(this.map.cols * TILE_SIZE / 2, this.readyButton.y - 20);
  }

  resetSceneState() {
    for (const catId of Object.keys(this.sprites)) {
      this.sprites[catId].rect.destroy();
      this.sprites[catId].label.destroy();
    }
    this.sprites = {};
    if (this.mapGraphics) this.mapGraphics.destroy();
    if (this.kibbleGraphics) this.kibbleGraphics.destroy();
    this.mapGraphics = null;
    this.kibbleGraphics = null;

    this.scores = { kim: 0, kaylie: 0 };
    this.updateScoreText();
    this.started = false;
    this.gameOver = false;
    this.aliveMe = true;
    this.isMoving = false;
    this.readyButton.setText('[ READY ]').setVisible(false).setInteractive({ useHandCursor: true });
    this.rulesText.setVisible(false);
  }

  drawMap(map) {
    const g = this.add.graphics();
    this.mapGraphics = g;
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const isWall = map.tiles[row][col] === '#';
        g.fillStyle(isWall ? 0x2b2b3d : 0x14141f, 1);
        g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    this.kibbleGraphics = this.add.graphics();
    this.redrawKibble();
  }

  redrawKibble() {
    this.kibbleGraphics.clear();
    this.kibbleGraphics.fillStyle(0xf2c14e, 1);
    for (const key of this.kibble) {
      const [col, row] = key.split(',').map(Number);
      this.kibbleGraphics.fillCircle(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, 3);
    }
  }

  spawnCat(catId, col, row) {
    if (this.sprites[catId]) return;
    const rect = this.add.image(
      col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2,
      catId === 'kim' ? 'cat-kim' : 'cat-kaylie'
    ).setDisplaySize(TILE_SIZE * 0.95, TILE_SIZE * 0.95);
    const label = this.add.text(rect.x, rect.y - TILE_SIZE * 0.7, catId === 'kim' ? 'Kim' : 'Kaylie', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffffff'
    }).setOrigin(0.5);
    this.sprites[catId] = { rect, label };
  }

  moveSpriteTo(catId, col, row) {
    const sprite = this.sprites[catId];
    if (!sprite) return;
    const x = col * TILE_SIZE + TILE_SIZE / 2;
    const y = row * TILE_SIZE + TILE_SIZE / 2;
    this.tweens.add({
      targets: [sprite.rect],
      x, y,
      duration: 1000 / MOVE_SPEED_TILES_PER_SEC,
      onUpdate: () => { sprite.label.setPosition(sprite.rect.x, sprite.rect.y - TILE_SIZE * 0.7); }
    });
  }

  setCatVisible(catId, visible) {
    const sprite = this.sprites[catId];
    if (!sprite) return;
    sprite.rect.setAlpha(visible ? 1 : 0.15);
    sprite.label.setAlpha(visible ? 1 : 0.15);
  }

  updateScoreText() {
    this.scoreText.setText(`Kim: ${this.scores.kim ?? 0}   Kaylie: ${this.scores.kaylie ?? 0}`);
  }

  capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  update() {
    if (!this.started || this.gameOver || this.isMoving || !this.aliveMe || !this.myCatId) return;

    const dir = this.readDirection();
    if (!dir) return;

    const targetCol = this.myPos.col + dir.x;
    const targetRow = this.myPos.row + dir.y;
    if (!this.isWalkable(targetCol, targetRow)) return;

    this.isMoving = true;
    const sprite = this.sprites[this.myCatId];
    const targetX = targetCol * TILE_SIZE + TILE_SIZE / 2;
    const targetY = targetRow * TILE_SIZE + TILE_SIZE / 2;

    this.tweens.add({
      targets: sprite.rect,
      x: targetX, y: targetY,
      duration: 1000 / MOVE_SPEED_TILES_PER_SEC,
      onUpdate: () => { sprite.label.setPosition(sprite.rect.x, sprite.rect.y - TILE_SIZE * 0.7); },
      onComplete: () => {
        this.isMoving = false;
        this.myPos = { col: targetCol, row: targetRow };
        this.net.send({ type: 'move', col: targetCol, row: targetRow });
      }
    });
  }

  readDirection() {
    if (this.cursors.left.isDown) return { x: -1, y: 0 };
    if (this.cursors.right.isDown) return { x: 1, y: 0 };
    if (this.cursors.up.isDown) return { x: 0, y: -1 };
    if (this.cursors.down.isDown) return { x: 0, y: 1 };
    return null;
  }

  isWalkable(col, row) {
    if (!this.map) return false;
    if (row < 0 || row >= this.map.rows || col < 0 || col >= this.map.cols) return false;
    return this.map.tiles[row][col] !== '#';
  }
}
