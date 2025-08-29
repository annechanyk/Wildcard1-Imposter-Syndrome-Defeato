// AWS Polly client initialization and configuration
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { awsConfig, pollyConfig } from './config.js';

let pollyClient = null;
let ttsErrorCount = 0;
let lastErrorTime = null;
const MAX_ERROR_COUNT = 5;
const ERROR_RESET_TIME = 300000; // 5 minutes in milliseconds

// Audio management for concurrent playback and performance optimization
let activeAudioElements = new Set();
let audioQueue = [];
let isProcessingQueue = false;
let audioSettings = {
  maxConcurrentAudio: 3, // Maximum simultaneous audio streams (Requirement 3.3)
  defaultVolume: 0.7,
  fadeOutDuration: 500, // ms for smooth audio transitions
  queueProcessingDelay: 100 // ms between queue processing attempts
};

// Performance monitoring
let performanceMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  averageResponseTime: 0,
  lastRequestTime: 0,
  queuedRequests: 0
};

/**
 * Initialize AWS Polly client with credentials and region configuration
 * @returns {PollyClient|null} Initialized Polly client or null if initialization fails
 */
export function initializePollyClient() {
  try {
    // Validate required credentials with detailed error messages
    if (!awsConfig.credentials.accessKeyId || awsConfig.credentials.accessKeyId.trim() === '') {
      console.warn('TTS_INIT_ERROR: AWS Access Key ID not found or empty. TTS functionality will be disabled.');
      console.debug('TTS_DEBUG: Check VITE_AWS_ACCESS_KEY_ID environment variable');
      return null;
    }

    if (!awsConfig.credentials.secretAccessKey || awsConfig.credentials.secretAccessKey.trim() === '') {
      console.warn('TTS_INIT_ERROR: AWS Secret Access Key not found or empty. TTS functionality will be disabled.');
      console.debug('TTS_DEBUG: Check VITE_AWS_SECRET_ACCESS_KEY environment variable');
      return null;
    }

    // Validate region configuration
    if (!awsConfig.region || awsConfig.region.trim() === '') {
      console.warn('TTS_INIT_ERROR: AWS region not configured. Using default us-east-1.');
      awsConfig.region = 'us-east-1';
    }

    // Create Polly client with configuration
    pollyClient = new PollyClient({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.credentials.accessKeyId,
        secretAccessKey: awsConfig.credentials.secretAccessKey
      }
    });

    console.log('TTS_SUCCESS: AWS Polly client initialized successfully');
    return pollyClient;
  } catch (error) {
    console.error('TTS_INIT_ERROR: Failed to initialize AWS Polly client:', error.message);
    console.debug('TTS_DEBUG: Error details:', {
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Get the initialized Polly client
 * @returns {PollyClient|null} The Polly client instance or null if not initialized
 */
export function getPollyClient() {
  return pollyClient;
}

/**
 * Check if Polly client is available and ready to use
 * @returns {boolean} True if client is available, false otherwise
 */
export function isPollyAvailable() {
  return pollyClient !== null && !isTtsTemporarilyDisabled();
}

/**
 * Check if TTS is temporarily disabled due to repeated errors
 * @returns {boolean} True if TTS should be disabled, false otherwise
 */
function isTtsTemporarilyDisabled() {
  if (ttsErrorCount < MAX_ERROR_COUNT) {
    return false;
  }

  // Check if enough time has passed to reset error count
  const now = Date.now();
  if (lastErrorTime && (now - lastErrorTime) > ERROR_RESET_TIME) {
    console.log('TTS_RECOVERY: Error count reset after timeout, re-enabling TTS');
    ttsErrorCount = 0;
    lastErrorTime = null;
    return false;
  }

  return true;
}

/**
 * Record a TTS error for tracking and potential temporary disabling
 * @param {string} errorType - Type of error that occurred
 */
function recordTtsError(errorType) {
  ttsErrorCount++;
  lastErrorTime = Date.now();
  
  console.warn(`TTS_ERROR_TRACKING: Error count increased to ${ttsErrorCount}/${MAX_ERROR_COUNT} (${errorType})`);
  
  if (ttsErrorCount >= MAX_ERROR_COUNT) {
    console.warn(`TTS_CIRCUIT_BREAKER: TTS temporarily disabled due to repeated errors. Will retry in ${ERROR_RESET_TIME / 60000} minutes.`);
  }
}

/**
 * Get TTS system status and diagnostics
 * @returns {object} Status information for debugging
 */
export function getTtsStatus() {
  return {
    clientInitialized: pollyClient !== null,
    errorCount: ttsErrorCount,
    lastErrorTime: lastErrorTime,
    temporarilyDisabled: isTtsTemporarilyDisabled(),
    credentialsConfigured: !!(awsConfig.credentials.accessKeyId && awsConfig.credentials.secretAccessKey),
    region: awsConfig.region
  };
}

/**
 * Reset TTS error tracking (for manual recovery)
 */
export function resetTtsErrors() {
  ttsErrorCount = 0;
  lastErrorTime = null;
  console.log('TTS_RECOVERY: Error tracking manually reset');
}

/**
 * Configure audio settings for concurrent playback and performance
 * @param {object} settings - Audio configuration settings
 */
export function configureAudioSettings(settings = {}) {
  audioSettings = {
    ...audioSettings,
    ...settings
  };
  
  // Validate settings
  audioSettings.maxConcurrentAudio = Math.max(1, Math.min(10, audioSettings.maxConcurrentAudio));
  audioSettings.defaultVolume = Math.max(0, Math.min(1, audioSettings.defaultVolume));
  audioSettings.fadeOutDuration = Math.max(0, Math.min(5000, audioSettings.fadeOutDuration));
  
  console.log('TTS_AUDIO_CONFIG: Audio settings updated:', audioSettings);
}

/**
 * Get current audio settings and status
 * @returns {object} Audio configuration and status
 */
export function getAudioStatus() {
  return {
    settings: { ...audioSettings },
    activeAudioCount: activeAudioElements.size,
    queuedAudioCount: audioQueue.length,
    isProcessingQueue: isProcessingQueue,
    performanceMetrics: { ...performanceMetrics }
  };
}

/**
 * Stop all active audio playback and clear queue
 */
export function stopAllAudio() {
  console.log('TTS_AUDIO_CONTROL: Stopping all active audio');
  
  // Stop all active audio elements
  activeAudioElements.forEach(audioElement => {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
      if (audioElement.src && audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioElement.src);
      }
    } catch (error) {
      console.warn('TTS_AUDIO_WARNING: Error stopping audio element:', error.message);
    }
  });
  
  activeAudioElements.clear();
  audioQueue.length = 0; // Clear queue
  isProcessingQueue = false;
  
  console.log('TTS_AUDIO_SUCCESS: All audio stopped and queue cleared');
}

/**
 * Set volume for all active and future audio
 * @param {number} volume - Volume level (0.0 to 1.0)
 */
export function setAudioVolume(volume) {
  const normalizedVolume = Math.max(0, Math.min(1, volume));
  audioSettings.defaultVolume = normalizedVolume;
  
  // Update volume for all active audio elements
  activeAudioElements.forEach(audioElement => {
    audioElement.volume = normalizedVolume;
  });
  
  console.log('TTS_AUDIO_CONTROL: Volume set to', normalizedVolume);
}

/**
 * Manage concurrent audio playback by limiting active streams
 */
function manageAudioConcurrency() {
  // Remove completed or errored audio elements from active set
  const elementsToRemove = [];
  activeAudioElements.forEach(audioElement => {
    if (audioElement.ended || audioElement.error || audioElement.paused) {
      elementsToRemove.push(audioElement);
    }
  });
  
  elementsToRemove.forEach(element => {
    activeAudioElements.delete(element);
    if (element.src && element.src.startsWith('blob:')) {
      URL.revokeObjectURL(element.src);
    }
  });
  
  // If we're at or over the limit, fade out oldest audio
  if (activeAudioElements.size >= audioSettings.maxConcurrentAudio) {
    const oldestElement = Array.from(activeAudioElements)[0];
    fadeOutAudio(oldestElement);
  }
}

/**
 * Fade out audio element smoothly
 * @param {HTMLAudioElement} audioElement - Audio element to fade out
 */
function fadeOutAudio(audioElement) {
  if (!audioElement || audioElement.paused) return;
  
  const originalVolume = audioElement.volume;
  const fadeSteps = 20;
  const stepDuration = audioSettings.fadeOutDuration / fadeSteps;
  const volumeStep = originalVolume / fadeSteps;
  
  let currentStep = 0;
  const fadeInterval = setInterval(() => {
    currentStep++;
    audioElement.volume = Math.max(0, originalVolume - (volumeStep * currentStep));
    
    if (currentStep >= fadeSteps || audioElement.volume <= 0) {
      clearInterval(fadeInterval);
      audioElement.pause();
      activeAudioElements.delete(audioElement);
      if (audioElement.src && audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioElement.src);
      }
    }
  }, stepDuration);
}

/**
 * Process queued audio requests with performance optimization
 */
async function processAudioQueue() {
  if (isProcessingQueue || audioQueue.length === 0) {
    return;
  }
  
  isProcessingQueue = true;
  
  while (audioQueue.length > 0 && activeAudioElements.size < audioSettings.maxConcurrentAudio) {
    const queueItem = audioQueue.shift();
    performanceMetrics.queuedRequests--;
    
    try {
      await processAudioRequest(queueItem);
    } catch (error) {
      console.warn('TTS_QUEUE_ERROR: Failed to process queued audio:', error.message);
    }
    
    // Small delay to prevent overwhelming the browser
    if (audioQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, audioSettings.queueProcessingDelay));
    }
  }
  
  isProcessingQueue = false;
  
  // Schedule next queue processing if items remain
  if (audioQueue.length > 0) {
    setTimeout(() => processAudioQueue(), audioSettings.queueProcessingDelay * 2);
  }
}

/**
 * Process individual audio request from queue
 * @param {object} queueItem - Queued audio request
 */
async function processAudioRequest(queueItem) {
  const { text, resolve, reject } = queueItem;
  
  try {
    await synthesizeAndPlayAudio(text);
    resolve();
  } catch (error) {
    reject(error);
  }
}

/**
 * Synthesizes speech from text using Amazon Polly with concurrent audio management
 * @param {string} text - The text to be spoken
 * @param {object} options - Optional settings for this request
 * @returns {Promise<void>} - Resolves when audio playback begins or is queued
 */
export async function speakText(text, options = {}) {
  // Performance tracking
  const requestStartTime = Date.now();
  performanceMetrics.totalRequests++;
  
  // Validate input with detailed logging
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.warn('TTS_INPUT_ERROR: Invalid or empty text provided to speakText');
    console.debug('TTS_DEBUG: Received text:', { text, type: typeof text });
    return;
  }

  // Check if Polly client is available and not temporarily disabled
  if (!pollyClient) {
    console.warn('TTS_CLIENT_ERROR: Polly client not available, skipping TTS');
    console.debug('TTS_DEBUG: Client initialization may have failed. Check credentials and network connectivity.');
    return;
  }

  if (isTtsTemporarilyDisabled()) {
    console.warn('TTS_CIRCUIT_BREAKER: TTS temporarily disabled due to repeated errors, skipping request');
    return;
  }

  // Manage concurrent audio - clean up completed streams
  manageAudioConcurrency();
  
  // If we're at capacity, queue the request (Requirement 3.3)
  if (activeAudioElements.size >= audioSettings.maxConcurrentAudio) {
    console.log('TTS_QUEUE: Audio at capacity, queuing request');
    performanceMetrics.queuedRequests++;
    
    return new Promise((resolve, reject) => {
      audioQueue.push({ text, resolve, reject });
      // Start processing queue if not already running
      setTimeout(() => processAudioQueue(), audioSettings.queueProcessingDelay);
    });
  }

  // Process immediately if under capacity
  try {
    await synthesizeAndPlayAudio(text, requestStartTime);
  } catch (error) {
    console.warn('TTS_DIRECT_ERROR: Failed to process audio directly:', error.message);
    throw error;
  }
}

/**
 * Core synthesis and playback function with performance optimization
 * @param {string} text - The text to be spoken
 * @param {number} requestStartTime - When the request started (for performance tracking)
 */
async function synthesizeAndPlayAudio(text, requestStartTime = Date.now()) {
  // Validate text length (Polly has limits)
  const maxTextLength = 3000; // AWS Polly limit for standard voices
  if (text.length > maxTextLength) {
    console.warn(`TTS_INPUT_ERROR: Text too long (${text.length} chars). Truncating to ${maxTextLength} characters.`);
    text = text.substring(0, maxTextLength);
  }

  try {
    // Prepare synthesis parameters with validation
    const synthesizeParams = {
      Text: text.trim(),
      OutputFormat: pollyConfig.outputFormat || 'mp3',
      VoiceId: pollyConfig.voiceId || 'Joanna',
      Engine: pollyConfig.engine || 'standard'
    };

    // Create synthesis command
    const command = new SynthesizeSpeechCommand(synthesizeParams);
    
    // Call AWS Polly synthesizeSpeech API with timeout handling
    console.log('TTS_REQUEST: Synthesizing speech for text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    
    // Set up a timeout for the API call
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API_TIMEOUT')), 10000); // 10 second timeout
    });

    const response = await Promise.race([
      pollyClient.send(command),
      timeoutPromise
    ]);

    // Check if we got audio data
    if (!response || !response.AudioStream) {
      console.warn('TTS_API_ERROR: No audio stream received from Polly API');
      console.debug('TTS_DEBUG: Response received:', { hasResponse: !!response, hasAudioStream: !!(response && response.AudioStream) });
      return;
    }

    // Convert audio stream to blob with error handling
    let audioBytes;
    try {
      audioBytes = await streamToUint8Array(response.AudioStream);
    } catch (streamError) {
      console.error('TTS_STREAM_ERROR: Failed to process audio stream:', streamError.message);
      console.debug('TTS_DEBUG: Stream processing error details:', {
        name: streamError.name,
        message: streamError.message
      });
      return;
    }

    if (!audioBytes || audioBytes.length === 0) {
      console.warn('TTS_STREAM_ERROR: Empty audio data received');
      return;
    }

    const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);

    // Create and configure HTML5 audio element with comprehensive error handling
    const audioElement = new Audio();
    audioElement.src = audioUrl;
    audioElement.volume = audioSettings.defaultVolume; // Use configurable volume
    audioElement.preload = 'auto';
    
    // Add to active audio set for concurrent management
    activeAudioElements.add(audioElement);

    // Handle audio events with detailed logging
    audioElement.addEventListener('loadeddata', () => {
      console.log('TTS_AUDIO_SUCCESS: Audio loaded successfully');
    });

    audioElement.addEventListener('error', (errorEvent) => {
      const audioError = audioElement.error;
      console.warn('TTS_AUDIO_ERROR: Audio playback error occurred');
      console.debug('TTS_DEBUG: Audio error details:', {
        code: audioError?.code,
        message: audioError?.message,
        networkState: audioElement.networkState,
        readyState: audioElement.readyState
      });
      // Clean up resources and remove from active set
      activeAudioElements.delete(audioElement);
      URL.revokeObjectURL(audioUrl);
      // Process queue in case this frees up capacity
      setTimeout(() => processAudioQueue(), audioSettings.queueProcessingDelay);
    });

    audioElement.addEventListener('ended', () => {
      console.log('TTS_AUDIO_SUCCESS: Audio playback completed');
      // Clean up resources and remove from active set
      activeAudioElements.delete(audioElement);
      URL.revokeObjectURL(audioUrl);
      // Process queue in case this frees up capacity
      setTimeout(() => processAudioQueue(), audioSettings.queueProcessingDelay);
    });

    // Handle pause event (for manual stops)
    audioElement.addEventListener('pause', () => {
      if (audioElement.currentTime === 0 || audioElement.ended) {
        activeAudioElements.delete(audioElement);
        URL.revokeObjectURL(audioUrl);
        setTimeout(() => processAudioQueue(), audioSettings.queueProcessingDelay);
      }
    });

    // Start audio playback with comprehensive error handling and autoplay optimization
    try {
      // Optimize for browser autoplay policies (Requirement: optimize for browser audio autoplay policies)
      await handleAutoplayOptimization(audioElement);
      
      console.log('TTS_AUDIO_SUCCESS: Audio playback started successfully');
      
      // Update performance metrics
      const responseTime = Date.now() - requestStartTime;
      performanceMetrics.successfulRequests++;
      performanceMetrics.averageResponseTime = 
        (performanceMetrics.averageResponseTime * (performanceMetrics.successfulRequests - 1) + responseTime) / 
        performanceMetrics.successfulRequests;
      performanceMetrics.lastRequestTime = responseTime;
      
    } catch (playError) {
      // Remove from active set on error
      activeAudioElements.delete(audioElement);
      
      // Handle different types of play errors
      if (playError.name === 'NotAllowedError') {
        console.warn('TTS_AUDIO_POLICY: Audio autoplay blocked by browser policy');
        console.debug('TTS_DEBUG: User interaction required for audio playback');
        // Try to queue for later when user interacts
        handleAutoplayBlocked(audioElement, audioUrl);
      } else if (playError.name === 'NotSupportedError') {
        console.warn('TTS_AUDIO_ERROR: Audio format not supported by browser');
        console.debug('TTS_DEBUG: Browser may not support MP3 format');
      } else {
        console.warn('TTS_AUDIO_ERROR: Audio playback failed:', playError.message);
        console.debug('TTS_DEBUG: Play error details:', {
          name: playError.name,
          message: playError.message
        });
      }
      // Clean up resources even if playback fails
      URL.revokeObjectURL(audioUrl);
      // Process queue in case this frees up capacity
      setTimeout(() => processAudioQueue(), audioSettings.queueProcessingDelay);
    }

  } catch (error) {
    // Comprehensive error handling for different error types
    let errorType = 'UNKNOWN';
    
    if (error.message === 'API_TIMEOUT') {
      errorType = 'TIMEOUT';
      console.warn('TTS_TIMEOUT_ERROR: AWS Polly API request timed out');
      console.debug('TTS_DEBUG: Request exceeded 10 second timeout. Check network connectivity.');
      recordTtsError(errorType);
    } else if (error.name === 'CredentialsProviderError' || error.code === 'CredentialsError') {
      errorType = 'CREDENTIALS';
      console.error('TTS_CREDENTIALS_ERROR: AWS credentials are invalid or expired');
      console.debug('TTS_DEBUG: Check AWS credentials configuration and permissions');
      // Disable client to prevent further failed attempts
      pollyClient = null;
      recordTtsError(errorType);
    } else if (error.name === 'NetworkingError' || error.code === 'NetworkingError') {
      errorType = 'NETWORK';
      console.warn('TTS_NETWORK_ERROR: Network connectivity issue during TTS request');
      console.debug('TTS_DEBUG: Check internet connection and AWS service availability');
      recordTtsError(errorType);
    } else if (error.code === 'Throttling' || error.code === 'ThrottlingException') {
      errorType = 'RATE_LIMIT';
      console.warn('TTS_RATE_LIMIT_ERROR: AWS Polly API rate limit exceeded');
      console.debug('TTS_DEBUG: Too many requests. Consider implementing request queuing.');
      recordTtsError(errorType);
    } else if (error.code === 'InvalidParameterValue' || error.code === 'ValidationException') {
      errorType = 'PARAMETER';
      console.error('TTS_PARAMETER_ERROR: Invalid parameters sent to Polly API');
      console.debug('TTS_DEBUG: Parameter validation failed:', {
        text: text.substring(0, 100),
        textLength: text.length,
        voiceId: pollyConfig.voiceId,
        outputFormat: pollyConfig.outputFormat
      });
      // Don't record parameter errors as they indicate code issues, not service issues
    } else if (error.code === 'ServiceUnavailable' || error.code === 'InternalFailure') {
      errorType = 'SERVICE';
      console.warn('TTS_SERVICE_ERROR: AWS Polly service temporarily unavailable');
      console.debug('TTS_DEBUG: AWS service issue. Retry may succeed later.');
      recordTtsError(errorType);
    } else {
      errorType = 'UNKNOWN';
      console.warn('TTS_UNKNOWN_ERROR: Unexpected error during text-to-speech:', error.message);
      console.debug('TTS_DEBUG: Unknown error details:', {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      recordTtsError(errorType);
    }
    
    // Game continues without audio as per error handling strategy
    // No re-throwing to ensure game functionality is not disrupted
  }
}

/**
 * Handle autoplay optimization for different browsers and policies
 * @param {HTMLAudioElement} audioElement - Audio element to play
 */
async function handleAutoplayOptimization(audioElement) {
  // Check if autoplay is likely to work
  if (document.visibilityState === 'hidden') {
    throw new Error('NotAllowedError: Page not visible');
  }
  
  // Try to play with different strategies
  try {
    // Strategy 1: Direct play (works if user has interacted)
    await audioElement.play();
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      // Strategy 2: Lower volume and try again
      const originalVolume = audioElement.volume;
      audioElement.volume = 0.1;
      try {
        await audioElement.play();
        // Gradually increase volume
        setTimeout(() => {
          audioElement.volume = originalVolume;
        }, 100);
      } catch (secondError) {
        audioElement.volume = originalVolume;
        throw secondError;
      }
    } else {
      throw error;
    }
  }
}

/**
 * Handle autoplay blocked scenario
 * @param {HTMLAudioElement} audioElement - Blocked audio element
 * @param {string} audioUrl - Audio blob URL
 */
function handleAutoplayBlocked(audioElement, audioUrl) {
  // Store for potential later playback when user interacts
  const playOnInteraction = () => {
    audioElement.play().then(() => {
      console.log('TTS_AUDIO_SUCCESS: Delayed audio playback after user interaction');
      activeAudioElements.add(audioElement);
    }).catch(() => {
      URL.revokeObjectURL(audioUrl);
    });
    
    // Remove listeners after first use
    document.removeEventListener('click', playOnInteraction);
    document.removeEventListener('keydown', playOnInteraction);
    document.removeEventListener('touchstart', playOnInteraction);
  };
  
  // Add temporary listeners for user interaction
  document.addEventListener('click', playOnInteraction, { once: true });
  document.addEventListener('keydown', playOnInteraction, { once: true });
  document.addEventListener('touchstart', playOnInteraction, { once: true });
  
  // Clean up after timeout
  setTimeout(() => {
    document.removeEventListener('click', playOnInteraction);
    document.removeEventListener('keydown', playOnInteraction);
    document.removeEventListener('touchstart', playOnInteraction);
    URL.revokeObjectURL(audioUrl);
  }, 30000); // 30 second timeout
}

/**
 * Helper function to convert ReadableStream to Uint8Array with comprehensive error handling
 * @param {ReadableStream} stream - The audio stream from Polly
 * @returns {Promise<Uint8Array>} - The audio data as Uint8Array
 */
async function streamToUint8Array(stream) {
  if (!stream) {
    throw new Error('STREAM_ERROR: No stream provided');
  }

  let reader;
  const chunks = [];
  
  try {
    reader = stream.getReader();
    
    if (!reader) {
      throw new Error('STREAM_ERROR: Failed to get stream reader');
    }

    let readCount = 0;
    const maxReads = 1000; // Prevent infinite loops
    
    while (readCount < maxReads) {
      try {
        const { done, value } = await reader.read();
        readCount++;
        
        if (done) {
          console.log(`TTS_STREAM_SUCCESS: Stream processing completed after ${readCount} reads`);
          break;
        }
        
        if (value && value.length > 0) {
          chunks.push(value);
        }
      } catch (readError) {
        console.error('TTS_STREAM_ERROR: Error reading from stream:', readError.message);
        throw new Error(`STREAM_READ_ERROR: ${readError.message}`);
      }
    }

    if (readCount >= maxReads) {
      console.warn('TTS_STREAM_WARNING: Maximum read attempts reached, stream may be incomplete');
    }

  } catch (error) {
    console.error('TTS_STREAM_ERROR: Stream processing failed:', error.message);
    throw error;
  } finally {
    // Ensure reader is always released
    if (reader) {
      try {
        reader.releaseLock();
      } catch (releaseError) {
        console.warn('TTS_STREAM_WARNING: Failed to release stream reader:', releaseError.message);
      }
    }
  }
  
  if (chunks.length === 0) {
    throw new Error('STREAM_ERROR: No data chunks received from stream');
  }

  try {
    // Calculate total length
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    
    if (totalLength === 0) {
      throw new Error('STREAM_ERROR: Total stream length is zero');
    }

    console.log(`TTS_STREAM_SUCCESS: Processing ${chunks.length} chunks, total size: ${totalLength} bytes`);
    
    // Combine all chunks into single Uint8Array
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      if (chunk && chunk.length > 0) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
    }
    
    return result;
  } catch (error) {
    console.error('TTS_STREAM_ERROR: Failed to combine stream chunks:', error.message);
    throw new Error(`STREAM_COMBINE_ERROR: ${error.message}`);
  }
}