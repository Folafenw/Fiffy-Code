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


// Products are stored separately from Level and positioned with
// screen pixel coordinates. Define arrays for shelf screens here.
let shelf1Products = [];
let shelf2Products = [];

// Hint button state
let hintActive = false;
let hintCount = 0;
const HINT_LIMIT = 2;
let hintButton = null;
let hintTimer = null;
// Sounds and win state
let correctSound = null;
let incorrectSound = null;
let correctClicked = new Set();
// Simple game state: 'playing', 'shelf1', 'shelf2', 'win'
let gameState = 'playing';

// Array of Level instances.
let levels = [];

// Current level index.
let li = 0;

// State for returning after a normal nextLevel() transition.
// stored as { li, r, c } when we move forward, so R can go back.
let prevState = null;

// State for the special level triggered by a tile value of 4.
// When `inExtraLevel` is true we render and move inside `extraLevel`.
let extraLevel = null;
let returnState = null; // { li, r, c }

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
    "Product 12.png",
    "Product 15.png",
    "Win Screen.png",
  ];

  assetFiles.forEach((fname) => {
    images[fname] = loadImage(`Assets/${fname}`);
  });

  // Load simple audio using browser Audio objects (no p5.sound required)
  correctSound = new Audio('Assets/Correct.mp3');
  incorrectSound = new Audio('Assets/Incorrect.mp3');
}

function setup() {
  /*
  Convert raw JSON grids into Level objects.
  levelsData.levels is an array of 2D arrays. 
  */
  levels = levelsData.levels.map((grid) => new Level(copyGrid(grid), TS));

  // Example manual pixel-based placements (commented).
  // Edit x/y values to position images on the shelf screens.
  // Coordinates are screen pixels (relative to `width` and `height`),
  // not grid cells. Uncomment to enable.
  // Shelf 1 (top shelf screen):
  shelf1Products.push({ name: 'Product 3', imageName: 'Product 3.png', x: 430, y: 280, w:80, h:110 });
  shelf1Products.push({ name: 'Product 7', imageName: 'Product 7.png', x: 600, y: 280, w:80, h:110 });
  shelf1Products.push({ name: 'Cornstarch', imageName: 'Cornstarch.png', x: 790, y: 280, w:80, h:110 });
  shelf1Products.push({ name: 'Product 9', imageName: 'Product 9.png', x: 980, y: 280, w:80, h:110 });

 // Shelf 1 (bottom shelf screen):
  shelf1Products.push({ name: 'Product 4', imageName: 'Product 4.png', x: 450, y:505, w:80, h:110 });
  shelf1Products.push({ name: 'Product 2', imageName: 'Product 2.png', x: 580, y: 505, w:80, h:110 });
  shelf1Products.push({ name: 'Product 14', imageName: 'Product 14.png', x: 710, y: 505, w:80, h:110 });
  shelf1Products.push({ name: 'Product 15', imageName: 'Product 15.png', x: 840, y: 505, w:80, h:110 });
  shelf1Products.push({ name: 'Product 13', imageName: 'Product 13.png', x: 970, y: 505, w:80, h:110 });
  
  // Shelf 2 (bottom shelf screen):
  shelf2Products.push({ name: 'Pasta', imageName: 'Pasta.png', x: 430, y: 280, w:80, h:110 });
  shelf2Products.push({ name: 'Product 5', imageName: 'Product 5.png', x: 600, y: 280, w:80, h:110 });
  shelf2Products.push({ name: 'Product 12', imageName: 'Product 12.png', x: 790, y: 280, w:80, h:110 });
  shelf2Products.push({ name: 'Product 1', imageName: 'Product 1.png', x: 980, y: 280, w:80, h:110 });

  shelf2Products.push({ name: 'Product 6', imageName: 'Product 6.png', x: 450, y: 505, w:80, h:110 });
  shelf2Products.push({ name: 'Icecream', imageName: 'Icecream.png', x: 580, y: 505, w:80, h:110 });
  shelf2Products.push({ name: 'Product 10', imageName: 'Product 10.png', x: 710, y: 505, w:80, h:110 });
  shelf2Products.push({ name: 'Product 11', imageName: 'Product 11.png', x: 840, y: 505, w:80, h:110 });
  shelf2Products.push({ name: 'Product 8', imageName: 'Product 8.png', x: 970, y: 505, w:80, h:110 });

  // Create a player.
  player = new Player(TS);

  // Load the first level (sets player start + canvas size).
  // Create a full-window canvas and then load the level.
  createCanvas(windowWidth, windowHeight);
  loadLevel(0);
  // Create a top-right button (uses CSS absolute positioning)
  hintButton = createButton("Hint items");
  hintButton.style("position", "absolute");
  hintButton.style("right", "10px");
  hintButton.style("top", "10px");
  hintButton.mousePressed(() => {
    if (hintCount >= HINT_LIMIT) {
      hintButton.attribute("disabled", "true");
      return;
    }
    // Activate hint for 5 seconds per click.
    hintActive = true;
    hintCount++;

    // Clear any existing timer and start a new 5s timeout.
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
    hintTimer = setTimeout(() => {
      hintActive = false;
      hintTimer = null;
    }, 2000);

    if (hintCount >= HINT_LIMIT) {
      hintButton.attribute("disabled", "true");
    }
  });

  noStroke();
  textFont("sans-serif");
  textSize(14);
}

function draw() {
  background(240);
  // If win state, draw only the win image and return early
  if (gameState === 'win') {
    const winImg = images['Win Screen.png'];
    if (winImg) {
      push();
      imageMode(CENTER);
      const iw = winImg.width || winImg.naturalWidth || 800;
      const ih = winImg.height || winImg.naturalHeight || 600;
      const s = Math.min(windowWidth / iw, windowHeight / ih) * 0.9;
      image(winImg, windowWidth / 2, windowHeight / 2, iw * s, ih * s);
      pop();
    }
    return;
  }

  // Determine which level we should be drawing (main level always used for shelves)
  const activeLevel = levels[li];

  // Draw based only on gameState
  if (gameState === 'playing') {
    const level = activeLevel;
    const lw = level.pixelWidth();
    const lh = level.pixelHeight();
    const s = Math.min(windowWidth / lw, windowHeight / lh);
    const ox = (windowWidth - lw * s) / 2;
    const oy = (windowHeight - lh * s) / 2;

    push();
    translate(ox, oy);
    scale(s);
    level.draw();
    player.draw();
    pop();
  } else if (gameState === 'shelf1') {
    // show the current level but hide the player and show shelf1 products
    const level = activeLevel;
    const lw = level.pixelWidth();
    const lh = level.pixelHeight();
    const s = Math.min(windowWidth / lw, windowHeight / lh);
    const ox = (windowWidth - lw * s) / 2;
    const oy = (windowHeight - lh * s) / 2;

    push();
    translate(ox, oy);
    scale(s);
    level.draw();
    pop();

    // show message and shelf 1 products
    if (mainScreenText) {
      fill(20);
      textAlign(CENTER, CENTER);
      textSize(36);
      text(mainScreenText, width / 2, height / 2);
      textSize(14);
      textAlign(LEFT, BASELINE);
    }
    drawShelfProducts(1);
  } else if (gameState === 'shelf2') {
    // show the extra level view (from Level.extraGrid) and shelf2 products
    if (!extraLevel) {
      extraLevel = new Level(copyGrid(Level.extraGrid), TS);
    }
    const level = extraLevel;
    const lw = level.pixelWidth();
    const lh = level.pixelHeight();
    const s = Math.min(windowWidth / lw, windowHeight / lh);
    const ox = (windowWidth - lw * s) / 2;
    const oy = (windowHeight - lh * s) / 2;

    push();
    translate(ox, oy);
    scale(s);
    level.draw();
    pop();

    drawShelfProducts(2);
  }

  drawHUD();

  
}

function drawHUD() {
  // HUD: show contextual small text in the top-left.
  fill(0);
  if (gameState === 'shelf2') {
    text(`Shelf 2 - click R to return`, 10, 16);
  } else if (gameState === 'shelf1') {
    text(`Shelf 1 - click R to return`, 10, 16);
  } else {
    text(`Level 1— press R to return`, 10, 16);
  }
}

function keyPressed() {
  // Win restart: R or Space resets game to 'playing' and resets systems
  if (gameState === 'win' && (key === 'r' || key === 'R' || keyCode === 32)) {
    correctClicked.clear();
    gameState = 'playing';
    mainScreenText = null;
    // reset hint system
    hintCount = 0;
    hintActive = false;
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
    if (hintButton) {
      try { hintButton.removeAttribute && hintButton.removeAttribute('disabled'); } catch (e) {}
    }
    // reset navigation state
    prevState = null;
    returnState = null;
    // reload first level and reuse player instance
    loadLevel(0);
    const lvl = levels[li];
    if (lvl && lvl.start) player.setCell(lvl.start.r, lvl.start.c);
    else player.setCell(1, 1);
    player.movedAt = 0;
    return;
  }

  // Return from shelf views: R returns to previous gameplay state
  if (gameState === 'shelf2' && (key === 'r' || key === 'R')) {
    gameState = 'playing';
    if (returnState) {
      loadLevel(returnState.li);
      player.setCell(returnState.r, returnState.c);
      returnState = null;
    }
    return;
  }

  if (gameState === 'shelf1' && (key === 'r' || key === 'R')) {
    gameState = 'playing';
    if (prevState) {
      const ps = prevState;
      prevState = null;
      loadLevel(ps.li);
      player.setCell(ps.r, ps.c);
    }
    return;
  }

  // Block movement and other keys unless playing
  if (gameState !== 'playing') return;

  /* Convert key presses into a movement direction. (WASD + arrows) */
  let dr = 0;
  let dc = 0;
  if (keyCode === LEFT_ARROW || key === 'a' || key === 'A') dc = -1;
  else if (keyCode === RIGHT_ARROW || key === 'd' || key === 'D') dc = 1;
  else if (keyCode === UP_ARROW || key === 'w' || key === 'W') dr = -1;
  else if (keyCode === DOWN_ARROW || key === 's' || key === 'S') dr = 1;
  else return; // not a movement key

  const activeLevel = levels[li];
  const moved = player.tryMove(activeLevel, dr, dc);
  if (!moved) return;

  const t = activeLevel.tileAt(player.r, player.c);
  // stepping on 3: advance level and show shelf1
  if (t === 3) {
    prevState = { li, r: player.r, c: player.c };
    nextLevel();
    gameState = 'shelf1';
  } else if (t === 4) {
    // stepping on 4: show shelf2 (record return position)
    returnState = { li, r: player.r, c: player.c };
    // don't create/move into extraLevel; shelf2 is a static product view
    gameState = 'shelf2';
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

// Draw product images for a given shelf screen (1 or 2).
// Products use pixel coordinates so you can place them freely.
function drawShelfProducts(shelfNumber) {
  const list = shelfNumber === 1 ? shelf1Products : shelf2Products;
  if (!list || list.length === 0) return;

  // Draw using screen pixel coordinates. Use `image()` directly
  // so images are not scaled by tileSize — caller provides sizes.
  push();
  imageMode(CENTER);
  for (const p of list) {
    const img = images[p.imageName];
    const x = p.x;
    const y = p.y;
    if (img) {
      // If the product object specifies width/height, respect it.
      if (p.w && p.h) image(img, x, y, p.w, p.h);
      else image(img, x, y);
    } else {
      // fallback marker when image missing
      fill(180);
      rectMode(CENTER);
      rect(x, y, p.w || 40, p.h || 40);
    }

    // Draw hint stroke for specific products when active
    if (hintActive) {
      const targets = ["Cornstarch", "Pasta", "Icecream"];
      if (targets.includes(p.name)) {
        push();
        noFill();
        stroke(0, 200, 0);
        strokeWeight(10);
        rectMode(CENTER);
        // If width/height provided, use them; otherwise estimate from image
        const rw = p.w || (p.h ? p.h * 0.75 : 80);
        const rh = p.h || (p.w ? p.w * 1.3 : 110);
        rect(x, y, rw + 4, rh + 4);
        pop();
      }
    }
  }
  pop();
}

function mousePressed() {
  // Only allow clicking when a shelf view is active (either shelf1 or shelf2)
  let shelfNumber = null;
  if (gameState === 'shelf1') shelfNumber = 1;
  else if (gameState === 'shelf2') shelfNumber = 2;
  else return;

  const list = shelfNumber === 1 ? shelf1Products : shelf2Products;
  if (!list) return;

  // Check each product's bounding box (imageMode CENTER)
  for (const p of list) {
    const w = p.w || 80;
    const h = p.h || 110;
    const left = p.x - w / 2;
    const right = p.x + w / 2;
    const top = p.y - h / 2;
    const bottom = p.y + h / 2;

    if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
      const targets = ["Cornstarch", "Pasta", "Icecream"];
      if (targets.includes(p.name)) {
        // If not already clicked, count it and play correct sound
        if (!correctClicked.has(p.name)) {
          correctClicked.add(p.name);
          try { correctSound.currentTime = 0; } catch (e) {}
          correctSound.play();
        }
      } else {
        try { incorrectSound.currentTime = 0; } catch (e) {}
        incorrectSound.play();
      }

      // If all three correct items clicked, show win screen once
      if (correctClicked.size === 3 && gameState !== 'win') {
        gameState = 'win';
        mainScreenText = "You win!";
        // disable hint button if present
        if (hintButton) try { hintButton.attribute("disabled", "true"); } catch (e) {}
      }

      // Stop after first matching product
      return;
    }
  }
}
