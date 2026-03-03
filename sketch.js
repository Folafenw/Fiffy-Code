/*
Week 4 — Example 4: Playable Maze (JSON + Level class + Player class)
Course: GBDA302
Instructors: Dr. Karen Cochrane and David Han
Date: Feb. 5, 2026

This is the "orchestrator" file:
- Loads JSON levels (preload)
- Builds Level objects
- Creates/positions the Player
- Handles input + level switching

It is intentionally light on "details" because those are moved into:
- Level.js (grid + drawing + tile meaning)
- Player.js (position + movement rules)

Based on the playable maze structure from Example 3
*/

const TS = 32;

// Raw JSON data (from levels.json).
let levelsData;

// Preloaded images from Assets/
let images = {};

// Array of Level instances.
let levels = [];

// Current level index.
let li = 0;

// State for returning after a normal nextLevel() transition.
// stored as { li, r, c } when we move forward, so R can go back.
let prevState = null;

// State for the special level triggered by a tile value of 4.
// When `inExtraLevel` is true we render and move inside `extraLevel`.
let inExtraLevel = false;
let extraLevel = null;
let returnState = null; // { li, r, c }

// When true the player avatar is hidden and movement is blocked
// (used on the next-level view and the extra-level view when requested).
let hidePlayer = false;

// Custom text shown on the main screen after advancing a level.
let mainScreenText;
// Player instance (tile-based).
let player;

function preload() {
  // Ensure level data is ready before setup runs.
  levelsData = loadJSON("levels.json");

  // If the JSON supplies an extraGrid, use it to override the default.
  if (levelsData.extraGrid) {
    Level.extraGrid = levelsData.extraGrid;
  }

  // Preload all images from the Assets/ folder.
  // Listed explicitly because browsers can't read directories at runtime.
  const assetFiles = [
    "Cornstarch.png",
    "Icecream.png",
    "Pasta.png",
    "Product 1.png",
    "Product 10.png",
    "Product 11.png",
    "Product 13.png",
    "Product 14.png",
    "Product 2.png",
    "Product 3.png",
    "Product 4.png",
    "Product 5.png",
    "Product 6.png",
    "Product 7.png",
    "Product 8.png",
    "Product 9.png",
  ];

  assetFiles.forEach((fname) => {
    images[fname] = loadImage(`Assets/${fname}`);
  });
}

function setup() {
  /*
  Convert raw JSON grids into Level objects.
  levelsData.levels is an array of 2D arrays. 
  */
  levels = levelsData.levels.map((grid) => new Level(copyGrid(grid), TS));

  // Create a player.
  player = new Player(TS);

  // Load the first level (sets player start + canvas size).
  // Create a full-window canvas and then load the level.
  createCanvas(windowWidth, windowHeight);
  loadLevel(0);

  noStroke();
  textFont("sans-serif");
  textSize(14);
}

function draw() {
  background(240);

  // Determine which level we should be drawing (main or extra).
  const activeLevel = inExtraLevel ? extraLevel : levels[li];

  // Draw current level then player on top, centered and scaled to fit.
  const level = activeLevel;
  const lw = level.pixelWidth();
  const lh = level.pixelHeight();

  // Compute uniform scale to fit the level into the window.
  const s = Math.min(windowWidth / lw, windowHeight / lh);

  // Compute top-left offset to center the scaled level.
  const ox = (windowWidth - lw * s) / 2;
  const oy = (windowHeight - lh * s) / 2;

  push();
  translate(ox, oy);
  scale(s);
  level.draw();
  if (!hidePlayer) player.draw();
  pop();

  // if player is hidden on normal main screen, show custom message
  if (hidePlayer && !inExtraLevel) {
    fill(20);
    textAlign(CENTER, CENTER);
    textSize(36);
    text(mainScreenText, width / 2, height / 2);
    textSize(14);
    textAlign(LEFT, BASELINE);
  }

  drawHUD();
}

function drawHUD() {
  // HUD: show contextual small text in the top-left.
  fill(0);
  if (inExtraLevel) {
    text(`Shelf 2 - click R to return`, 10, 16);
  } else if (hidePlayer) {
    text(`Shelf 1 - click R to return`, 10, 16);
  } else {
    text(`Level 1— press R to return`, 10, 16);
  }
}

function keyPressed() {
  // manual return key works even while moving inside extra level
  if (inExtraLevel && (key === "r" || key === "R")) {
    inExtraLevel = false;
    if (returnState) {
      li = returnState.li;
      player.setCell(returnState.r, returnState.c);
    }
    hidePlayer = false;
    return;
  }

  // return from a normal nextLevel() if we have a stored prevState
  if (!inExtraLevel && (key === "r" || key === "R") && prevState) {
    const ps = prevState;
    prevState = null;
    loadLevel(ps.li);
    player.setCell(ps.r, ps.c);
    hidePlayer = false;
    return;
  }

  // If the player is hidden, only allow return key (handled above).
  if (hidePlayer) return;

  /*
  Convert key presses into a movement direction. (WASD + arrows)
  */
  let dr = 0;
  let dc = 0;

  if (keyCode === LEFT_ARROW || key === "a" || key === "A") dc = -1;
  else if (keyCode === RIGHT_ARROW || key === "d" || key === "D") dc = 1;
  else if (keyCode === UP_ARROW || key === "w" || key === "W") dr = -1;
  else if (keyCode === DOWN_ARROW || key === "s" || key === "S") dr = 1;
  else return; // not a movement key

  // pick correct level for movement
  const activeLevel = inExtraLevel ? extraLevel : levels[li];

  // Try to move. If blocked, nothing happens.
  const moved = player.tryMove(activeLevel, dr, dc);

  if (moved) {
    const t = activeLevel.tileAt(player.r, player.c);

    if (inExtraLevel) {
      // stepping on a 3 inside the extra level returns us
      if (t === 3) {
        inExtraLevel = false;
        if (returnState) {
          li = returnState.li;
          player.setCell(returnState.r, returnState.c);
        }
        hidePlayer = false;
      }
    } else {
      // main-level rules
      if (t === 3) {
        // record current position so we can go back with R
        prevState = { li, r: player.r, c: player.c };
        nextLevel();
        // hide the avatar on the next-level view until user presses R
        hidePlayer = true;
      } else if (t === 4) {
        // teleport into the dedicated extra level
        returnState = { li, r: player.r, c: player.c };
        extraLevel = new Level(copyGrid(Level.extraGrid), TS);
        if (extraLevel.start) {
          player.setCell(extraLevel.start.r, extraLevel.start.c);
        } else {
          player.setCell(1, 1);
        }
        inExtraLevel = true;
        // hide player while inside the extra level
        hidePlayer = true;
      }
    }
  }
}

// ----- Level switching -----

function loadLevel(idx) {
  li = idx;

  const level = levels[li];

  // Place player at the level's start tile (2), if present.
  if (level.start) {
    player.setCell(level.start.r, level.start.c);
  } else {
    // Fallback spawn: top-left-ish (but inside bounds).
    player.setCell(1, 1);
  }

  // Ensure the canvas matches this level’s dimensions.
  // Keep the canvas full-window instead of resizing to the level.
  resizeCanvas(windowWidth, windowHeight);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function nextLevel() {
  // Wrap around when we reach the last level.
  const next = (li + 1) % levels.length;
  loadLevel(next);
}

// ----- Utility -----

function copyGrid(grid) {
  /*
  Make a deep-ish copy of a 2D array:
  - new outer array
  - each row becomes a new array

  Why copy?
  - Because Level constructor may normalize tiles (e.g., replace 2 with 0)
  - And we don’t want to accidentally mutate the raw JSON data object. 
  */
  return grid.map((row) => row.slice());
}
