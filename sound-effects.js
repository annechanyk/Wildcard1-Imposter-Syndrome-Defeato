// Sound Effects System for Boxing Game
// Handles punch sound effects and other game audio

class SoundEffectsManager {
  constructor() {
    this.audioContext = null;
    this.soundCache = new Map();
    this.isEnabled = true;
    this.volume = 0.7;
    this.initialized = false;
    
    // Initialize audio context on first user interaction
    this.initPromise = null;
  }

  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async initialize() {
    if (this.initialized) return true;
    
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn('SOUND_EFFECTS: Web Audio API not supported');
        return false;
      }

      this.audioContext = new AudioContext();
      
      // Resume context if it's suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log('SOUND_EFFECTS: Audio context initialized successfully');
      this.initialized = true;
      return true;
    } catch (error) {
      console.warn('SOUND_EFFECTS: Failed to initialize audio context:', error.message);
      return false;
    }
  }

  /**
   * Generate a punch sound effect using Web Audio API
   */
  async generatePunchSound() {
    if (!this.audioContext) return null;

    try {
      const duration = 0.15; // 150ms punch sound
      const sampleRate = this.audioContext.sampleRate;
      const frameCount = duration * sampleRate;
      
      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // Generate punch sound (combination of noise burst and low frequency thump)
      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        
        // Exponential decay envelope
        const envelope = Math.exp(-t * 15);
        
        // Low frequency thump (around 60-80 Hz)
        const thump = Math.sin(2 * Math.PI * 70 * t) * 0.6;
        
        // High frequency crack/snap (noise burst)
        const crack = (Math.random() * 2 - 1) * 0.4 * Math.exp(-t * 25);
        
        // Mid frequency punch (around 200 Hz)
        const punch = Math.sin(2 * Math.PI * 200 * t) * 0.3 * Math.exp(-t * 10);
        
        // Combine all components with envelope
        channelData[i] = (thump + crack + punch) * envelope;
      }
      
      return audioBuffer;
    } catch (error) {
      console.warn('SOUND_EFFECTS: Failed to generate punch sound:', error.message);
      return null;
    }
  }

  /**
   * Generate a softer collection sound for positive thoughts
   */
  async generateCollectionSound() {
    if (!this.audioContext) return null;

    try {
      const duration = 0.3; // 300ms collection sound
      const sampleRate = this.audioContext.sampleRate;
      const frameCount = duration * sampleRate;
      
      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // Generate pleasant collection sound (ascending chime)
      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        
        // Gentle envelope
        const envelope = Math.exp(-t * 3) * (1 - Math.exp(-t * 20));
        
        // Ascending frequency chime
        const baseFreq = 440; // A4
        const frequency = baseFreq * (1 + t * 0.5); // Gentle rise
        
        // Harmonic content for pleasant sound
        const fundamental = Math.sin(2 * Math.PI * frequency * t) * 0.5;
        const harmonic2 = Math.sin(2 * Math.PI * frequency * 2 * t) * 0.2;
        const harmonic3 = Math.sin(2 * Math.PI * frequency * 3 * t) * 0.1;
        
        channelData[i] = (fundamental + harmonic2 + harmonic3) * envelope;
      }
      
      return audioBuffer;
    } catch (error) {
      console.warn('SOUND_EFFECTS: Failed to generate collection sound:', error.message);
      return null;
    }
  }

  /**
   * Play a sound effect from an audio buffer
   */
  async playSound(audioBuffer, volume = 1.0) {
    if (!this.isEnabled || !this.audioContext || !audioBuffer) return;

    try {
      // Create buffer source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Create gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = this.volume * volume;
      
      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Play sound
      source.start();
      
      // Clean up after sound finishes
      source.onended = () => {
        source.disconnect();
        gainNode.disconnect();
      };
      
    } catch (error) {
      console.warn('SOUND_EFFECTS: Failed to play sound:', error.message);
    }
  }

  /**
   * Play punch sound effect
   */
  async playPunchSound(intensity = 1.0) {
    await this.initialize();
    
    if (!this.soundCache.has('punch')) {
      const punchBuffer = await this.generatePunchSound();
      if (punchBuffer) {
        this.soundCache.set('punch', punchBuffer);
      }
    }
    
    const punchBuffer = this.soundCache.get('punch');
    if (punchBuffer) {
      await this.playSound(punchBuffer, intensity);
      console.log('SOUND_EFFECTS: Played punch sound');
    }
  }

  /**
   * Play collection sound effect for positive thoughts
   */
  async playCollectionSound() {
    await this.initialize();
    
    if (!this.soundCache.has('collection')) {
      const collectionBuffer = await this.generateCollectionSound();
      if (collectionBuffer) {
        this.soundCache.set('collection', collectionBuffer);
      }
    }
    
    const collectionBuffer = this.soundCache.get('collection');
    if (collectionBuffer) {
      await this.playSound(collectionBuffer, 0.8);
      console.log('SOUND_EFFECTS: Played collection sound');
    }
  }

  /**
   * Load external sound file (for future use with actual audio files)
   */
  async loadSoundFile(url, name) {
    if (!this.audioContext) {
      await this.initialize();
    }
    
    if (!this.audioContext) return false;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.soundCache.set(name, audioBuffer);
      console.log(`SOUND_EFFECTS: Loaded sound file: ${name}`);
      return true;
    } catch (error) {
      console.warn(`SOUND_EFFECTS: Failed to load sound file ${url}:`, error.message);
      return false;
    }
  }

  /**
   * Play a loaded sound by name
   */
  async playSoundByName(name, volume = 1.0) {
    const audioBuffer = this.soundCache.get(name);
    if (audioBuffer) {
      await this.playSound(audioBuffer, volume);
    } else {
      console.warn(`SOUND_EFFECTS: Sound '${name}' not found in cache`);
    }
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    console.log(`SOUND_EFFECTS: Volume set to ${this.volume}`);
  }

  /**
   * Enable or disable sound effects
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`SOUND_EFFECTS: ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.isEnabled,
      volume: this.volume,
      audioContextState: this.audioContext?.state || 'not created',
      cachedSounds: Array.from(this.soundCache.keys())
    };
  }

  /**
   * Preload all game sounds
   */
  async preloadGameSounds() {
    console.log('SOUND_EFFECTS: Preloading game sounds...');
    
    await this.initialize();
    
    // Generate and cache punch sound
    if (!this.soundCache.has('punch')) {
      const punchBuffer = await this.generatePunchSound();
      if (punchBuffer) {
        this.soundCache.set('punch', punchBuffer);
        console.log('SOUND_EFFECTS: Punch sound preloaded');
      }
    }
    
    // Generate and cache collection sound
    if (!this.soundCache.has('collection')) {
      const collectionBuffer = await this.generateCollectionSound();
      if (collectionBuffer) {
        this.soundCache.set('collection', collectionBuffer);
        console.log('SOUND_EFFECTS: Collection sound preloaded');
      }
    }
    
    console.log('SOUND_EFFECTS: Game sounds preloaded successfully');
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.soundCache.clear();
    this.initialized = false;
    console.log('SOUND_EFFECTS: Resources disposed');
  }
}

// Create and export singleton instance
export const soundEffects = new SoundEffectsManager();

// Export individual functions for convenience
export const playPunchSound = (intensity) => soundEffects.playPunchSound(intensity);
export const playCollectionSound = () => soundEffects.playCollectionSound();
export const setSoundVolume = (volume) => soundEffects.setVolume(volume);
export const setSoundEnabled = (enabled) => soundEffects.setEnabled(enabled);
export const getSoundStatus = () => soundEffects.getStatus();
export const preloadGameSounds = () => soundEffects.preloadGameSounds();