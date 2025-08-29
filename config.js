// Environment configuration for AWS Polly TTS
// Note: In production, these should be loaded securely, not hardcoded

export const awsConfig = {
  region: 'us-east-1',
  credentials: {
    accessKeyId: import.meta.env?.VITE_AWS_ACCESS_KEY_ID || 'YOUR_AWS_ACCESS_KEY_ID',
    secretAccessKey: import.meta.env?.VITE_AWS_SECRET_ACCESS_KEY || 'YOUR_AWS_SECRET_ACCESS_KEY'
  }
};

// Polly-specific configuration
export const pollyConfig = {
  voiceId: 'Joanna',
  outputFormat: 'mp3',
  engine: 'standard'
};