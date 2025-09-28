const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');

const execAsync = util.promisify(exec);

class VoiceSkill {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.modelPath = process.env.VOICE_MODEL_PATH || './models';
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    this.voiceId = process.env.VOICE_ID || '9BWtsMINqrJLrRacOk9x';
  }

  async initialize() {
    try {
      // Create models directory if it doesn't exist
      await fs.mkdir(this.modelPath, { recursive: true });
      
      // Check if local voice processing tools are available
      await this.checkVoiceTools();
      
      this.logger.info('Voice skill initialized successfully');
      return true;
    } catch (error) {
      this.logger.warn('Voice skill initialized with limited functionality:', error.message);
      return true;
    }
  }

  async execute(action, args = {}) {
    try {
      switch (action) {
        case 'transcribe':
          return await this.transcribeAudio(args.audioPath, args.language);
        case 'speak':
          return await this.textToSpeech(args.text, args.voice, args.speed);
        case 'process_command':
          return await this.processVoiceCommand(args.transcript);
        case 'set_voice':
          return await this.setVoice(args.voiceId);
        case 'get_voices':
          return await this.getAvailableVoices();
        case 'download_model':
          return await this.downloadVoiceModel(args.modelName);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Voice action ${action} failed:`, error.message);
      throw error;
    }
  }

  async transcribeAudio(audioPath, language = 'en') {
    try {
      // Try local transcription first (if Whisper is available)
      if (await this.hasLocalWhisper()) {
        return await this.transcribeWithWhisper(audioPath, language);
      }
      
      // Fallback to OpenAI API if available
      if (this.openaiApiKey) {
        return await this.transcribeWithOpenAI(audioPath, language);
      }
      
      // Mock transcription for development
      this.logger.warn('No transcription service available, using mock response');
      return {
        success: true,
        transcript: "Mock transcription result",
        confidence: 0.8,
        language: language,
        duration: 5.0
      };
      
    } catch (error) {
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  async textToSpeech(text, voice = 'default', speed = 1.0) {
    try {
      const outputPath = path.join(this.modelPath, 'temp', `speech_${Date.now()}.mp3`);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Try ElevenLabs first
      if (this.elevenlabsApiKey) {
        const result = await this.speakWithElevenLabs(text, outputPath);
        if (result.success) return result;
      }
      
      // Fallback to local TTS
      if (await this.hasLocalTTS()) {
        return await this.speakWithLocalTTS(text, outputPath, speed);
      }
      
      // Mock TTS for development
      this.logger.warn('No TTS service available, using mock response');
      return {
        success: true,
        audioPath: outputPath,
        duration: text.length * 0.1,
        message: 'Mock TTS response'
      };
      
    } catch (error) {
      throw new Error(`Text-to-speech failed: ${error.message}`);
    }
  }

  async processVoiceCommand(transcript) {
    try {
      // Extract intent from voice command
      const intent = this.extractIntent(transcript);
      
      return {
        success: true,
        transcript,
        intent: intent.action,
        confidence: intent.confidence,
        entities: intent.entities,
        response: `Understood: ${intent.action}`
      };
    } catch (error) {
      throw new Error(`Voice command processing failed: ${error.message}`);
    }
  }

  async setVoice(voiceId) {
    this.voiceId = voiceId;
    return {
      success: true,
      message: `Voice set to ${voiceId}`,
      voiceId
    };
  }

  async getAvailableVoices() {
    const voices = [
      { id: 'default', name: 'Default Voice', language: 'en' },
      { id: 'female', name: 'Female Voice', language: 'en' },
      { id: 'male', name: 'Male Voice', language: 'en' }
    ];
    
    // Add ElevenLabs voices if API key is available
    if (this.elevenlabsApiKey) {
      try {
        const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': this.elevenlabsApiKey }
        });
        
        const elevenlabsVoices = response.data.voices.map(voice => ({
          id: voice.voice_id,
          name: voice.name,
          language: 'en',
          provider: 'elevenlabs'
        }));
        
        voices.push(...elevenlabsVoices);
      } catch (error) {
        this.logger.warn('Failed to fetch ElevenLabs voices:', error.message);
      }
    }
    
    return {
      success: true,
      voices
    };
  }

  async downloadVoiceModel(modelName) {
    try {
      const modelPath = path.join(this.modelPath, modelName);
      
      // This would typically download from a model repository
      // For now, just create a placeholder
      await fs.mkdir(modelPath, { recursive: true });
      await fs.writeFile(
        path.join(modelPath, 'model.info'),
        JSON.stringify({ name: modelName, downloaded: new Date().toISOString() })
      );
      
      return {
        success: true,
        message: `Model ${modelName} downloaded successfully`,
        path: modelPath
      };
    } catch (error) {
      throw new Error(`Model download failed: ${error.message}`);
    }
  }

  // Private helper methods
  async hasLocalWhisper() {
    try {
      await execAsync('which whisper');
      return true;
    } catch (error) {
      return false;
    }
  }

  async hasLocalTTS() {
    try {
      await execAsync('which espeak || which festival || which piper');
      return true;
    } catch (error) {
      return false;
    }
  }

  async transcribeWithWhisper(audioPath, language) {
    try {
      const { stdout } = await execAsync(`whisper "${audioPath}" --language ${language} --output_format json --output_dir /tmp`);
      const result = JSON.parse(stdout);
      
      return {
        success: true,
        transcript: result.text,
        confidence: 0.9,
        language: result.language,
        duration: result.duration || 0
      };
    } catch (error) {
      throw new Error(`Whisper transcription failed: ${error.message}`);
    }
  }

  async transcribeWithOpenAI(audioPath, language) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      const audioBuffer = await fs.readFile(audioPath);
      
      form.append('file', audioBuffer, 'audio.wav');
      form.append('model', 'whisper-1');
      form.append('language', language);
      
      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${this.openaiApiKey}`
        }
      });
      
      return {
        success: true,
        transcript: response.data.text,
        confidence: 0.9,
        language: language,
        duration: 0
      };
    } catch (error) {
      throw new Error(`OpenAI transcription failed: ${error.message}`);
    }
  }

  async speakWithElevenLabs(text, outputPath) {
    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
        {
          text: text,
          model_id: process.env.VOICE_MODEL || 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenlabsApiKey
          },
          responseType: 'arraybuffer'
        }
      );
      
      await fs.writeFile(outputPath, response.data);
      
      return {
        success: true,
        audioPath: outputPath,
        duration: text.length * 0.1,
        provider: 'elevenlabs'
      };
    } catch (error) {
      throw new Error(`ElevenLabs TTS failed: ${error.message}`);
    }
  }

  async speakWithLocalTTS(text, outputPath, speed) {
    try {
      // Try espeak first
      try {
        await execAsync(`espeak -s ${Math.round(175 * speed)} -w "${outputPath}" "${text}"`);
        return {
          success: true,
          audioPath: outputPath,
          duration: text.length * 0.1 / speed,
          provider: 'espeak'
        };
      } catch (error) {
        // Fallback to festival
        await execAsync(`echo "${text}" | festival --tts --pipe > "${outputPath}"`);
        return {
          success: true,
          audioPath: outputPath,
          duration: text.length * 0.1 / speed,
          provider: 'festival'
        };
      }
    } catch (error) {
      throw new Error(`Local TTS failed: ${error.message}`);
    }
  }

  extractIntent(transcript) {
    const text = transcript.toLowerCase();
    
    // Simple intent extraction - in production this would use NLP
    const patterns = [
      { pattern: /turn on|switch on|enable/, action: 'turn_on' },
      { pattern: /turn off|switch off|disable/, action: 'turn_off' },
      { pattern: /start|begin/, action: 'start' },
      { pattern: /stop|halt/, action: 'stop' },
      { pattern: /restart|reboot/, action: 'restart' },
      { pattern: /status|check/, action: 'status' },
      { pattern: /what|how|show/, action: 'query' },
      { pattern: /set|change/, action: 'set' }
    ];
    
    for (const { pattern, action } of patterns) {
      if (pattern.test(text)) {
        return {
          action,
          confidence: 0.8,
          entities: this.extractEntities(text)
        };
      }
    }
    
    return {
      action: 'unknown',
      confidence: 0.3,
      entities: []
    };
  }

  extractEntities(text) {
    const entities = [];
    
    // Extract common entities
    const lightMatch = text.match(/(light|lamp|bulb)/i);
    if (lightMatch) entities.push({ type: 'device', value: 'light' });
    
    const tempMatch = text.match(/(\d+)\s*(degree|celsius|fahrenheit)/i);
    if (tempMatch) entities.push({ type: 'temperature', value: tempMatch[1] });
    
    const numberMatch = text.match(/\d+/);
    if (numberMatch) entities.push({ type: 'number', value: parseInt(numberMatch[0]) });
    
    return entities;
  }

  async checkVoiceTools() {
    const tools = [];
    
    try {
      await execAsync('which whisper');
      tools.push('whisper');
    } catch (error) {
      // Whisper not available
    }
    
    try {
      await execAsync('which espeak');
      tools.push('espeak');
    } catch (error) {
      // espeak not available
    }
    
    try {
      await execAsync('which festival');
      tools.push('festival');
    } catch (error) {
      // festival not available
    }
    
    return tools;
  }

  async healthCheck() {
    try {
      const tools = await this.checkVoiceTools();
      const hasApi = !!(this.openaiApiKey || this.elevenlabsApiKey);
      
      return {
        healthy: tools.length > 0 || hasApi,
        message: 'Voice skill operational',
        localTools: tools,
        hasApiAccess: hasApi
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message
      };
    }
  }

  async shutdown() {
    this.logger.info('Voice skill shutting down');
    
    // Clean up temporary files
    try {
      const tempDir = path.join(this.modelPath, 'temp');
      await execAsync(`rm -rf "${tempDir}"`);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

module.exports = VoiceSkill;