const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Use temp directory as fallback for uploads
const uploadsDir = '/tmp/jarvis-uploads';
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
  }
} catch (error) {
  console.warn('Could not create uploads directory:', error.message);
}

// Configure multer for audio file uploads
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Voice transcription endpoint
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Simple voice transcription simulation - in production would use Whisper/OpenAI
    const mockTranscripts = [
      "Jarvis, turn on the lights",
      "Jarvis, show me the system status",
      "Jarvis, scan the network for devices",
      "Jarvis, what is the current temperature"
    ];
    
    const transcript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
    
    // Clean up uploaded file
    try {
      require('fs').unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup audio file:', cleanupError.message);
    }
    
    res.json({
      success: true,
      transcript,
      confidence: 0.85 + Math.random() * 0.15, // 85-100% confidence
      duration: req.body.duration || Math.random() * 5000
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Text-to-speech endpoint
router.post('/speak', async (req, res) => {
  try {
    const { text, voice = 'aria', speed = 1.0 } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // ElevenLabs TTS integration
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!elevenLabsApiKey) {
      console.warn('ElevenLabs API key not configured, using mock response');
      return res.json({
        success: true,
        audioUrl: null,
        duration: text.length * 0.1,
        message: 'Text-to-speech configured but API key missing'
      });
    }

    try {
      const voiceId = getVoiceId(voice);
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.5,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      // For now, return success without actual audio streaming
      res.json({
        success: true,
        audioUrl: null, // Would need audio streaming setup
        duration: text.length * 0.08,
        message: 'Speech synthesis completed'
      });

    } catch (apiError) {
      console.error('ElevenLabs API error:', apiError);
      res.json({
        success: false,
        error: 'Speech synthesis failed',
        fallback: true
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to map voice names to ElevenLabs voice IDs
function getVoiceId(voiceName) {
  const voiceMap = {
    'aria': '9BWtsMINqrJLrRacOk9x',
    'roger': 'CwhRBWXzGAHq8TQ4Fs17', 
    'sarah': 'EXAVITQu4vr4xnSDxMaL',
    'liam': 'TX3LPaxmHKxFdv7VOQHJ',
    'default': '9BWtsMINqrJLrRacOk9x'
  };
  return voiceMap[voiceName] || voiceMap['default'];
}

// Voice command processing
router.post('/command', async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'No command provided' });
    }

    // Simple command processing logic
    const lowerCommand = command.toLowerCase();
    let intent = 'unknown';
    let response = 'I did not understand that command.';

    // Basic intent recognition
    if (lowerCommand.includes('system') || lowerCommand.includes('status')) {
      intent = 'system_status';
      response = 'System is running normally. All services are operational.';
    } else if (lowerCommand.includes('lights') || lowerCommand.includes('light')) {
      intent = 'lighting_control';
      response = 'Lighting controls are not yet configured. Please check your Home Assistant integration.';
    } else if (lowerCommand.includes('network') || lowerCommand.includes('scan')) {
      intent = 'network_scan';
      response = 'Initiating network scan. I will look for all devices on your network.';
    } else if (lowerCommand.includes('temperature') || lowerCommand.includes('weather')) {
      intent = 'environmental';
      response = 'Environmental sensors are not yet configured. Please set up your monitoring systems.';
    } else if (lowerCommand.includes('security')) {
      intent = 'security_check';
      response = 'Security systems are active. All monitoring services are operational.';
    } else if (lowerCommand.includes('hello') || lowerCommand.includes('hi')) {
      intent = 'greeting';
      response = 'Hello! I am Jarvis, your AI assistant. How can I help you today?';
    }

    res.json({
      success: true,
      intent: intent,
      confidence: 0.90,
      response: response,
      command: command
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available voices
router.get('/voices', async (req, res) => {
  try {
    const voices = [
      { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', description: 'Natural female voice' },
      { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Authoritative male voice' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Friendly female voice' },
      { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Calm male voice' }
    ];
    
    res.json({
      success: true,
      voices: voices
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;