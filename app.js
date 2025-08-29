// AWS Polly TTS imports and initialization
import { 
  initializePollyClient, 
  isPollyAvailable, 
  speakText, 
  getTtsStatus, 
  resetTtsErrors,
  configureAudioSettings,
  getAudioStatus,
  stopAllAudio,
  setAudioVolume
} from './aws-polly-client.js';

// Sound Effects imports
import { 
  soundEffects,
  playPunchSound, 
  playCollectionSound, 
  setSoundVolume, 
  setSoundEnabled, 
  getSoundStatus,
  preloadGameSounds
} from './sound-effects.js';

// Initialize AWS Polly client on module load
let pollyInitialized = false;
try {
  const client = initializePollyClient();
  pollyInitialized = client !== null;
  
  // Configure audio settings for optimal game performance (Requirement 3.3, 1.4)
  if (pollyInitialized) {
    configureAudioSettings({
      maxConcurrentAudio: 2, // Limit to 2 for game performance
      defaultVolume: 0.6, // Slightly lower for game audio balance
      fadeOutDuration: 300, // Quick fade for responsive gameplay
      queueProcessingDelay: 50 // Fast queue processing for game responsiveness
    });
  }
  
  console.log('Polly initialization status:', pollyInitialized);
} catch (error) {
  console.warn('Failed to initialize Polly client:', error.message);
  pollyInitialized = false;
}

// Initialize sound effects system
let soundEffectsInitialized = false;
console.log('Sound effects system loaded, will initialize on first user interaction');

// Game data
const gameData = {
  negativeThoughts: [
    "I don't belong here",
    "Everyone will find out I'm a fraud",
    "I just got lucky",
    "I'm not qualified enough",
    "Others are so much better than me",
    "I'm going to fail",
    "I don't deserve this success",
    "I'm not smart enough",
    "They made a mistake hiring me",
    "I'm fooling everyone",
    "I don't know what I'm doing",
    "I'm not experienced enough",
    "Everyone else is more talented",
    "I'm going to be exposed",
    "I'm not cut out for this",
    "I'm winging it and hoping no one notices",
    "I should give up before I embarrass myself",
    "I'm in over my head",
    "I'm not creative enough",
    "I'm too slow compared to others",
    "I'm going to disappoint everyone",
    "I'm not leadership material",
    "I'm just pretending to know what I'm doing",
    "I don't have what it takes",
    "I'm going to mess this up badly",
    "I'm not innovative enough",
    "I'm falling behind everyone else",
    "I don't deserve this opportunity",
    "I'm not as experienced as I should be",
    "I'm going to let my team down",
    "I'm not worthy of this position",
    "I'm just lucky they haven't figured me out yet",
    "I'm not confident enough to lead",
    "I'm going to crumble under pressure",
    "I'm not as skilled as people think"
  ],
  
  positiveAffirmations: [
    "I earned my place here",
    "My unique perspective adds value",
    "I am capable and competent",
    "I belong in this space",
    "My skills got me here",
    "I deserve my achievements",
    "I am learning and growing",
    "I have valuable contributions to make",
    "I am enough, just as I am",
    "My voice matters",
    "I have overcome challenges before",
    "I am building expertise every day",
    "I bring creativity and innovation",
    "I am resilient and adaptable",
    "I make a positive difference",
    "I am worthy of success",
    "I trust my abilities and judgment",
    "I am confident in my decisions",
    "I embrace challenges as growth opportunities",
    "I am a valuable team member",
    "I deserve respect and recognition",
    "I am constantly improving my skills",
    "I have the courage to take on new challenges",
    "I am proud of my accomplishments",
    "I contribute meaningfully to my work",
    "I am intelligent and resourceful",
    "I handle pressure with grace",
    "I am a natural problem solver",
    "I inspire others with my dedication",
    "I am building a successful career",
    "I deserve to be here as much as anyone",
    "I am confident in my unique strengths",
    "I turn setbacks into comebacks",
    "I am worthy of opportunities and growth",
    "I trust myself to figure things out"
  ],
  
  achievementMessages: [
    "Great punch! That doubt is gone!",
    "You're fighting back strong!",
    "Your confidence is growing!",
    "Keep boxing those negative thoughts!",
    "You're unstoppable!",
    "That's the fighting spirit!",
    "You're winning this battle!"
  ]
};

// Game state
let gameState = {
  isPlaying: false,
  confidence: 50,
  score: 0,
  currentLevel: 1,
  startTime: 0,
  thoughtsDefeated: 0,
  activeThoughts: new Set(),
  gameTimer: null,
  negativeSpawnTimer: null,
  positiveSpawnTimer: null
};

// Show screen function
function showScreen(targetScreenId) {
  console.log('Switching to screen:', targetScreenId);
  
  // Hide all screens
  const screens = ['start-screen', 'game-screen', 'victory-screen'];
  screens.forEach(screenId => {
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.remove('active');
    }
  });
  
  // Show target screen
  const targetScreen = document.getElementById(targetScreenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    console.log('Successfully showed screen:', targetScreenId);
  } else {
    console.error('Screen not found:', targetScreenId);
  }
}

// Start game
function startGame() {
  console.log('Starting boxing match...');
  gameState.isPlaying = true;
  gameState.startTime = Date.now();
  
  // Initialize sound effects on first game start (requires user interaction)
  if (!soundEffectsInitialized) {
    preloadGameSounds().then(() => {
      soundEffectsInitialized = true;
      console.log('Sound effects initialized and preloaded');
    }).catch(error => {
      console.warn('Sound effects initialization failed:', error.message);
    });
  }
  
  // Show game screen
  showScreen('game-screen');
  
  // Show level indicator briefly
  setTimeout(() => {
    const levelIndicator = document.getElementById('level-indicator');
    if (levelIndicator) {
      levelIndicator.classList.add('visible');
      setTimeout(() => {
        levelIndicator.classList.remove('visible');
      }, 1500);
    }
  }, 100);
  
  // Start game timer with Ultrahuman format
  gameState.gameTimer = setInterval(() => {
    if (gameState.isPlaying) {
      const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
      const timerEl = document.getElementById('timer');
      if (timerEl) {
        timerEl.textContent = formatTime(elapsed);
      }
    }
  }, 1000);
  
  // Start spawning thoughts after level indicator disappears
  setTimeout(() => {
    startThoughtSpawning();
  }, 1000);
  
  // Update UI
  updateUI();
}

// Start thought spawning
function startThoughtSpawning() {
  console.log('Starting thought spawning...');
  
  // Spawn negative thoughts every 2.5 seconds
  gameState.negativeSpawnTimer = setInterval(() => {
    if (gameState.isPlaying && gameState.confidence < 100) {
      spawnThought(false);
    }
  }, 2500);
  
  // Spawn positive thoughts every 4 seconds
  gameState.positiveSpawnTimer = setInterval(() => {
    if (gameState.isPlaying && gameState.confidence < 100) {
      spawnThought(true);
    }
  }, 4000);
}

// Check if a position overlaps with existing thoughts
function checkCollision(x, y, width, height, existingThoughts) {
  const buffer = 25; // Minimum distance between thought bubbles
  
  for (const existingThought of existingThoughts) {
    // Skip if the thought element is not in the DOM anymore
    if (!existingThought.parentNode) {
      continue;
    }
    
    const existingRect = existingThought.getBoundingClientRect();
    const gameArea = document.getElementById('game-area');
    const gameAreaRect = gameArea.getBoundingClientRect();
    
    // Convert existing thought position to relative coordinates
    const existingX = existingRect.left - gameAreaRect.left;
    const existingY = existingRect.top - gameAreaRect.top;
    const existingWidth = existingRect.width;
    const existingHeight = existingRect.height;
    
    // Check if rectangles overlap (with buffer)
    if (x < existingX + existingWidth + buffer &&
        x + width + buffer > existingX &&
        y < existingY + existingHeight + buffer &&
        y + height + buffer > existingY) {
      return true; // Collision detected
    }
  }
  return false; // No collision
}

// Find a non-overlapping position for a thought bubble
function findNonOverlappingPosition(gameAreaRect, thoughtElement) {
  // Add element temporarily to measure its actual dimensions
  const gameArea = document.getElementById('game-area');
  thoughtElement.style.visibility = 'hidden';
  thoughtElement.style.position = 'absolute';
  thoughtElement.style.left = '-9999px';
  gameArea.appendChild(thoughtElement);
  
  const thoughtRect = thoughtElement.getBoundingClientRect();
  const thoughtWidth = thoughtRect.width;
  const thoughtHeight = thoughtRect.height;
  
  // Remove from DOM temporarily
  gameArea.removeChild(thoughtElement);
  thoughtElement.style.visibility = 'visible';
  
  const maxX = Math.max(20, gameAreaRect.width - thoughtWidth - 20);
  const maxY = Math.max(20, gameAreaRect.height - thoughtHeight - 20);
  const maxAttempts = 50; // Increased attempts to reduce fallback usage
  
  const existingThoughts = Array.from(gameState.activeThoughts);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    
    if (!checkCollision(x, y, thoughtWidth, thoughtHeight, existingThoughts)) {
      return { x, y };
    }
  }
  
  // If we can't find a non-overlapping position after max attempts,
  // use grid-based fallback positioning to minimize overlaps
  console.debug('Could not find non-overlapping position after', maxAttempts, 'attempts, using grid-based fallback');
  return findGridBasedPosition(maxX, maxY, thoughtWidth, thoughtHeight, existingThoughts);
}

// Grid-based fallback positioning to minimize overlaps
function findGridBasedPosition(maxX, maxY, thoughtWidth, thoughtHeight, existingThoughts) {
  const gridSize = Math.max(thoughtWidth + 30, thoughtHeight + 30); // Grid cell size with padding
  const cols = Math.floor(maxX / gridSize) || 1;
  const rows = Math.floor(maxY / gridSize) || 1;
  
  // Create array of all grid positions
  const gridPositions = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      gridPositions.push({
        x: col * gridSize + Math.random() * (gridSize - thoughtWidth),
        y: row * gridSize + Math.random() * (gridSize - thoughtHeight)
      });
    }
  }
  
  // Shuffle grid positions for variety
  for (let i = gridPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gridPositions[i], gridPositions[j]] = [gridPositions[j], gridPositions[i]];
  }
  
  // Find first grid position without collision
  for (const pos of gridPositions) {
    if (!checkCollision(pos.x, pos.y, thoughtWidth, thoughtHeight, existingThoughts)) {
      return pos;
    }
  }
  
  // Final fallback: use the first grid position (least likely to overlap severely)
  return gridPositions[0] || { x: 20, y: 20 };
}

// Spawn a thought bubble
function spawnThought(isPositive = false) {
  console.log('Spawning thought, isPositive:', isPositive);
  
  const gameArea = document.getElementById('game-area');
  if (!gameArea) {
    console.error('Game area not found');
    return;
  }
  
  const thought = document.createElement('div');
  thought.className = `thought-bubble ${isPositive ? 'positive' : 'negative'}`;
  
  // Select random message
  const messages = isPositive ? gameData.positiveAffirmations : gameData.negativeThoughts;
  const message = messages[Math.floor(Math.random() * messages.length)];
  thought.textContent = message;
  
  // Get game area dimensions
  const gameAreaRect = gameArea.getBoundingClientRect();
  
  // Find non-overlapping position using actual element dimensions
  const position = findNonOverlappingPosition(gameAreaRect, thought);
  
  thought.style.left = position.x + 'px';
  thought.style.top = position.y + 'px';
  
  // Add click handler
  thought.addEventListener('click', function(event) {
    event.preventDefault();
    event.stopPropagation();
    clickThought(thought, isPositive, event);
  });
  
  // Add to game area
  gameArea.appendChild(thought);
  gameState.activeThoughts.add(thought);
  
  // Only play TTS for positive thoughts to reinforce positive affirmations (Requirements 1.1, 1.2, 3.1)
  // Performance monitoring for TTS impact on game responsiveness (Requirement 1.4)
  if (isPositive && pollyInitialized && isPollyAvailable()) {
    const ttsStartTime = performance.now();
    
    speakText(message).then(() => {
      const ttsEndTime = performance.now();
      const ttsDuration = ttsEndTime - ttsStartTime;
      
      // Log performance impact if TTS is affecting game responsiveness
      if (ttsDuration > 100) { // More than 100ms could impact game feel
        console.warn(`TTS_PERFORMANCE: TTS request took ${ttsDuration.toFixed(2)}ms - may impact game responsiveness`);
      }
    }).catch(error => {
      const ttsEndTime = performance.now();
      const ttsDuration = ttsEndTime - ttsStartTime;
      console.warn('TTS_INTEGRATION_ERROR: Failed to speak positive thought text:', error.message);
      console.debug(`TTS_PERFORMANCE: Failed TTS request took ${ttsDuration.toFixed(2)}ms`);
      // Game continues normally even if TTS fails
    });
  } else if (isPositive && pollyInitialized && !isPollyAvailable()) {
    console.debug('TTS_INTEGRATION_DEBUG: TTS temporarily disabled, skipping speech for positive thought');
  } else if (!isPositive) {
    console.debug('TTS_INTEGRATION_DEBUG: Negative thought - audio muted for positive reinforcement');
  }
  
  // IMPORTANT: Only auto-remove negative thoughts, positive ones stay until clicked
  if (!isPositive) {
    const removeTimeout = setTimeout(() => {
      if (gameArea.contains(thought)) {
        console.log('Auto-removing negative thought');
        removeThought(thought);
      }
    }, 5000); // 5 seconds for negative thoughts
    
    thought.removeTimeout = removeTimeout;
  }
}

// Handle thought click
function clickThought(thought, isPositive, event) {
  console.log('Thought clicked! isPositive:', isPositive);
  
  if (!gameState.isPlaying || thought.classList.contains('clicked')) {
    return;
  }
  
  // Show effects and play sounds based on thought type
  if (!isPositive) {
    // Punching negative thoughts: GOOD action
    // Show enhanced punch effect with sound sync
    showPunchEffect(event.clientX, event.clientY, true);
    
    // Play punch sound effect with slight intensity variation
    const intensity = 0.8 + Math.random() * 0.4; // Random intensity between 0.8 and 1.2
    playPunchSound(intensity).catch(error => {
      console.debug('SOUND_EFFECTS: Punch sound failed:', error.message);
      // Fallback to regular punch effect if sound fails
      showPunchEffect(event.clientX, event.clientY, false);
    });
  } else {
    // Punching positive thoughts: BAD action (penalty)
    // Show a different effect to indicate this was wrong
    showPenaltyEffect(event.clientX, event.clientY);
    
    // No sound effect for penalty to make it feel less satisfying
    console.log('Player punched a positive thought - penalty applied');
  }
  
  // Clear auto-remove timeout if it exists
  if (thought.removeTimeout) {
    clearTimeout(thought.removeTimeout);
  }
  
  // Add clicked animation
  thought.classList.add('clicked');
  
  // Update game state based on thought type
  if (!isPositive) {
    // Punching negative thoughts: REWARD
    const points = 10;
    gameState.score += points;
    const confidenceIncrease = 5;
    gameState.confidence += confidenceIncrease;
    gameState.thoughtsDefeated++;
    showAchievementMessage();
  } else {
    // Punching positive thoughts: PENALTY
    const pointsPenalty = 15;
    gameState.score = Math.max(0, gameState.score - pointsPenalty); // Don't go below 0
    const confidenceDecrease = 3;
    gameState.confidence = Math.max(0, gameState.confidence - confidenceDecrease); // Don't go below 0
    showPenaltyMessage();
  }
  
  // Ensure confidence doesn't exceed 100
  gameState.confidence = Math.min(gameState.confidence, 100);
  
  // Update UI
  updateUI();
  
  // Remove thought after animation
  setTimeout(() => {
    removeThought(thought);
  }, 400);
  
  // Check win condition
  if (gameState.confidence >= 100) {
    setTimeout(() => {
      endGame();
    }, 500);
  }
}

// Show punch effect
function showPunchEffect(x, y, withSound = false) {
  const gameArea = document.getElementById('game-area');
  const punchEffect = document.getElementById('punch-effect');
  
  if (!gameArea || !punchEffect) return;
  
  // Get the game area's position and dimensions
  const gameAreaRect = gameArea.getBoundingClientRect();
  
  // Calculate position relative to game area (since punch effect is now inside game area)
  const relativeX = x - gameAreaRect.left;
  const relativeY = y - gameAreaRect.top;
  
  // Center the 60px x 60px punch effect exactly on the cursor position
  const effectSize = 60;
  const centeredX = relativeX - (effectSize / 2);
  const centeredY = relativeY - (effectSize / 2);
  
  // Ensure the effect stays within the game area bounds
  const maxX = gameAreaRect.width - effectSize;
  const maxY = gameAreaRect.height - effectSize;
  
  const finalX = Math.max(0, Math.min(centeredX, maxX));
  const finalY = Math.max(0, Math.min(centeredY, maxY));
  
  // Position the effect
  punchEffect.style.left = finalX + 'px';
  punchEffect.style.top = finalY + 'px';
  
  // Use enhanced animation if sound is available
  if (withSound && soundEffectsInitialized) {
    punchEffect.classList.add('active', 'with-sound');
  } else {
    punchEffect.classList.add('active');
  }
  
  setTimeout(() => {
    punchEffect.classList.remove('active', 'with-sound');
  }, 300);
}

// Show collection effect for positive thoughts
function showCollectionEffect(x, y) {
  const gameArea = document.getElementById('game-area');
  
  if (!gameArea) return;
  
  // Create collection effect element
  const collectionEffect = document.createElement('div');
  collectionEffect.className = 'collection-effect';
  
  // Get the game area's position and dimensions
  const gameAreaRect = gameArea.getBoundingClientRect();
  
  // Calculate position relative to game area
  const relativeX = x - gameAreaRect.left;
  const relativeY = y - gameAreaRect.top;
  
  // Center the 40px x 40px collection effect exactly on the cursor position
  const effectSize = 40;
  const centeredX = relativeX - (effectSize / 2);
  const centeredY = relativeY - (effectSize / 2);
  
  // Ensure the effect stays within the game area bounds
  const maxX = gameAreaRect.width - effectSize;
  const maxY = gameAreaRect.height - effectSize;
  
  const finalX = Math.max(0, Math.min(centeredX, maxX));
  const finalY = Math.max(0, Math.min(centeredY, maxY));
  
  // Position the effect
  collectionEffect.style.left = finalX + 'px';
  collectionEffect.style.top = finalY + 'px';
  
  gameArea.appendChild(collectionEffect);
  
  // Trigger animation
  setTimeout(() => {
    collectionEffect.classList.add('active');
  }, 10);
  
  // Remove element after animation
  setTimeout(() => {
    if (gameArea.contains(collectionEffect)) {
      gameArea.removeChild(collectionEffect);
    }
  }, 400);
}

// Show penalty effect for punching positive thoughts
function showPenaltyEffect(x, y) {
  const gameArea = document.getElementById('game-area');
  
  if (!gameArea) return;
  
  // Create penalty effect element
  const penaltyEffect = document.createElement('div');
  penaltyEffect.className = 'penalty-effect';
  
  // Get the game area's position and dimensions
  const gameAreaRect = gameArea.getBoundingClientRect();
  
  // Calculate position relative to game area
  const relativeX = x - gameAreaRect.left;
  const relativeY = y - gameAreaRect.top;
  
  // Center the 50px x 50px penalty effect exactly on the cursor position
  const effectSize = 50;
  const centeredX = relativeX - (effectSize / 2);
  const centeredY = relativeY - (effectSize / 2);
  
  // Ensure the effect stays within the game area bounds
  const maxX = gameAreaRect.width - effectSize;
  const maxY = gameAreaRect.height - effectSize;
  
  const finalX = Math.max(0, Math.min(centeredX, maxX));
  const finalY = Math.max(0, Math.min(centeredY, maxY));
  
  // Position the effect
  penaltyEffect.style.left = finalX + 'px';
  penaltyEffect.style.top = finalY + 'px';
  
  gameArea.appendChild(penaltyEffect);
  
  // Trigger animation
  setTimeout(() => {
    penaltyEffect.classList.add('active');
  }, 10);
  
  // Remove element after animation
  setTimeout(() => {
    if (gameArea.contains(penaltyEffect)) {
      gameArea.removeChild(penaltyEffect);
    }
  }, 500);
}

// Remove thought from game
function removeThought(thought) {
  // Always remove from activeThoughts set, even if element is not in DOM
  gameState.activeThoughts.delete(thought);
  
  const gameArea = document.getElementById('game-area');
  if (gameArea && gameArea.contains(thought)) {
    gameArea.removeChild(thought);
  }
  
  if (thought.removeTimeout) {
    clearTimeout(thought.removeTimeout);
    thought.removeTimeout = null;
  }
}

// Show achievement message
function showAchievementMessage() {
  const achievementPopup = document.getElementById('achievement-popup');
  const achievementText = document.getElementById('achievement-text');
  
  if (!achievementPopup || !achievementText) return;
  
  if (Math.random() < 0.6) {
    const message = gameData.achievementMessages[
      Math.floor(Math.random() * gameData.achievementMessages.length)
    ];
    
    achievementText.textContent = message;
    achievementPopup.classList.add('visible');
    
    setTimeout(() => {
      achievementPopup.classList.remove('visible');
    }, 2000);
  }
}

// Show penalty message for punching positive thoughts
function showPenaltyMessage() {
  const achievementPopup = document.getElementById('achievement-popup');
  const achievementText = document.getElementById('achievement-text');
  
  if (!achievementPopup || !achievementText) return;
  
  const penaltyMessages = [
    "Oops! Don't punch the positive thoughts!",
    "Let the good vibes stay with you!",
    "Keep the positive affirmations safe!",
    "Focus on the negative thoughts only!",
    "Preserve your guiding light!"
  ];
  
  const message = penaltyMessages[Math.floor(Math.random() * penaltyMessages.length)];
  
  achievementText.textContent = message;
  achievementPopup.classList.add('visible', 'penalty');
  
  setTimeout(() => {
    achievementPopup.classList.remove('visible', 'penalty');
  }, 2500); // Show penalty message slightly longer
}

// Update UI elements - Ultrahuman Style
function updateUI() {
  const confidence = Math.round(gameState.confidence);
  
  // Update circular progress ring
  const confidencePercentage = document.getElementById('confidence-percentage');
  const currentLevelEl = document.getElementById('current-level');
  const startConfidenceValue = document.getElementById('start-confidence-value');
  
  // Update confidence display in both start and game screens
  if (confidencePercentage) confidencePercentage.textContent = confidence;
  if (startConfidenceValue) startConfidenceValue.textContent = confidence;
  
  // Update score display during gameplay
  const currentScoreEl = document.getElementById('current-score');
  if (currentScoreEl) currentScoreEl.textContent = gameState.score;
  if (currentLevelEl) {
    // Update level based on confidence
    const level = Math.floor(confidence / 20) + 1;
    currentLevelEl.textContent = `Level ${level}`;
    gameState.currentLevel = level;
  }
  
  // Update progress ring gradient based on confidence
  updateProgressRing(confidence);
  
  // Update zone indicator
  updateZoneIndicator(confidence);
}

// Update the circular progress ring
function updateProgressRing(confidence) {
  const progressBackground = document.querySelector('.progress-ring__background');
  if (!progressBackground) return;
  
  // Calculate the angle for the progress (0-360 degrees)
  const angle = (confidence / 100) * 360;
  
  // Update the conic gradient to show progress
  const gradient = `conic-gradient(
    from -90deg,
    var(--color-accent-red) 0deg,
    var(--color-accent-orange) ${Math.min(angle, 60)}deg,
    var(--color-accent-teal) ${Math.min(angle, 120)}deg,
    var(--color-secondary) ${Math.min(angle, 180)}deg,
    var(--color-secondary) ${angle}deg,
    var(--color-surface-secondary) ${angle}deg,
    var(--color-surface-secondary) 360deg
  )`;
  
  const beforeElement = progressBackground.querySelector('::before');
  if (progressBackground) {
    progressBackground.style.setProperty('--progress-angle', angle + 'deg');
    // Update CSS custom property for the gradient
    document.documentElement.style.setProperty('--confidence-progress', gradient);
  }
}

// Update zone indicator based on confidence level
function updateZoneIndicator(confidence) {
  const zoneText = document.querySelector('.zone-text');
  if (!zoneText) return;
  
  let zone, range, color;
  
  if (confidence < 25) {
    zone = 1;
    range = '0 - 25%';
    color = 'var(--color-accent-red)';
  } else if (confidence < 50) {
    zone = 2;
    range = '25 - 50%';
    color = 'var(--color-accent-orange)';
  } else if (confidence < 75) {
    zone = 3;
    range = '50 - 75%';
    color = 'var(--color-accent-teal)';
  } else {
    zone = 4;
    range = '75 - 100%';
    color = 'var(--color-secondary)';
  }
  
  zoneText.textContent = `Zone ${zone} • ${range}`;
  zoneText.parentElement.style.background = color;
}

// End game
function endGame() {
  console.log('Ending boxing match...');
  gameState.isPlaying = false;
  
  // Clear timers
  if (gameState.gameTimer) clearInterval(gameState.gameTimer);
  if (gameState.negativeSpawnTimer) clearInterval(gameState.negativeSpawnTimer);
  if (gameState.positiveSpawnTimer) clearInterval(gameState.positiveSpawnTimer);
  
  // Stop all TTS audio for clean game end (Performance optimization)
  if (pollyInitialized) {
    stopAllAudio();
  }
  
  // Clear active thoughts
  gameState.activeThoughts.forEach(thought => {
    if (thought.removeTimeout) clearTimeout(thought.removeTimeout);
    removeThought(thought);
  });
  gameState.activeThoughts.clear();
  
  // Update final stats
  const finalTimeSeconds = Math.floor((Date.now() - gameState.startTime) / 1000);
  const finalTime = document.getElementById('final-time');
  const thoughtsDefeatedEl = document.getElementById('thoughts-defeated');
  
  if (finalTime) finalTime.textContent = formatTime(finalTimeSeconds);
  if (thoughtsDefeatedEl) thoughtsDefeatedEl.textContent = gameState.thoughtsDefeated;
  
  // Update final score
  const finalScoreEl = document.getElementById('final-score');
  if (finalScoreEl) finalScoreEl.textContent = gameState.score;
  
  // Show victory screen
  showScreen('victory-screen');
}

// Restart game
function restartGame() {
  console.log('Restarting boxing match...');
  
  // Clear timers
  if (gameState.gameTimer) clearInterval(gameState.gameTimer);
  if (gameState.negativeSpawnTimer) clearInterval(gameState.negativeSpawnTimer);
  if (gameState.positiveSpawnTimer) clearInterval(gameState.positiveSpawnTimer);
  
  // Stop all TTS audio for clean restart (Performance optimization)
  if (pollyInitialized) {
    stopAllAudio();
  }
  
  // Clear thoughts
  const gameArea = document.getElementById('game-area');
  if (gameArea) {
    const thoughts = gameArea.querySelectorAll('.thought-bubble');
    thoughts.forEach(thought => {
      if (thought.removeTimeout) clearTimeout(thought.removeTimeout);
      thought.remove();
    });
  }
  
  // Reset game state
  gameState = {
    isPlaying: false,
    confidence: 50,
    score: 0,
    currentLevel: 1,
    startTime: 0,
    thoughtsDefeated: 0,
    activeThoughts: new Set(),
    gameTimer: null,
    negativeSpawnTimer: null,
    positiveSpawnTimer: null
  };
  
  // Update UI and show start screen
  updateUI();
  showScreen('start-screen');
}

// Format time in Ultrahuman style (HH:MM:SS)
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Initialize segmented control
function initializeSegmentedControl() {
  const segmentedOptions = document.querySelectorAll('.segmented-control__option');
  
  segmentedOptions.forEach(option => {
    option.addEventListener('click', function() {
      // Remove active class from all options
      segmentedOptions.forEach(opt => opt.classList.remove('active'));
      // Add active class to clicked option
      this.classList.add('active');
      
      // Update game mode if needed
      const mode = this.dataset.mode;
      console.log('Game mode selected:', mode);
    });
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing Ultrahuman-style app...');
  
  // Add TTS debugging and control functions to global scope for console access
  window.getTtsStatus = getTtsStatus;
  window.resetTtsErrors = resetTtsErrors;
  window.getAudioStatus = getAudioStatus;
  window.stopAllAudio = stopAllAudio;
  window.setAudioVolume = setAudioVolume;
  window.configureAudioSettings = configureAudioSettings;
  
  // Add sound effects control functions to global scope
  window.getSoundStatus = getSoundStatus;
  window.setSoundVolume = setSoundVolume;
  window.setSoundEnabled = setSoundEnabled;
  window.playPunchSound = playPunchSound;
  window.playCollectionSound = playCollectionSound;
  window.preloadGameSounds = preloadGameSounds;
  
  console.log('TTS_DEBUG: Available TTS console functions: getTtsStatus(), resetTtsErrors(), getAudioStatus(), stopAllAudio(), setAudioVolume(0.5), configureAudioSettings({maxConcurrentAudio: 3})');
  console.log('SOUND_DEBUG: Available sound console functions: getSoundStatus(), setSoundVolume(0.7), setSoundEnabled(true), playPunchSound(), playCollectionSound(), preloadGameSounds()');
  
  // Initialize components
  initializeSegmentedControl();
  
  // Add event listeners
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  
  if (startBtn) {
    startBtn.addEventListener('click', function(event) {
      console.log('Start button clicked');
      event.preventDefault();
      startGame();
    });
    console.log('Start button listener added');
  } else {
    console.error('Start button not found');
  }
  
  if (restartBtn) {
    restartBtn.addEventListener('click', function(event) {
      console.log('Restart button clicked');
      event.preventDefault();
      restartGame();
    });
    console.log('Restart button listener added');
  } else {
    console.error('Restart button not found');
  }
  
  // Initialize UI
  updateUI();
  console.log('Ultrahuman-style app initialization complete');
});