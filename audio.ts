
class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmBuffer: AudioBuffer | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private isInitialized = false;

  constructor() {
    // Lazy initialization on first user interaction
  }

  private init() {
    if (this.isInitialized) return;
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.masterGain.gain.value = 0.8;
      this.isInitialized = true;
      this.loadBGM();
    } catch (e) {
      console.error('AudioContext not supported', e);
    }
  }

  private async loadBGM() {
    if (!this.context) return;
    try {
      // Generate procedural atmospheric melody
      const duration = 20; // seconds
      const sampleRate = this.context.sampleRate;
      const buffer = this.context.createBuffer(2, sampleRate * duration, sampleRate);
      
      // Define multiple scales for variety
      const scales = [
        [392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50], // G Pentatonic (Brighter)
        [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25], // C Major Pentatonic (Calm)
        [329.63, 392.00, 440.00, 493.88, 587.33, 659.25, 783.99, 880.00], // E Minor Pentatonic (Mysterious)
        [293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46, 783.99]  // D Dorian (Spacey)
      ];
      
      const scale = scales[Math.floor(Math.random() * scales.length)];
      const baseDroneFreq1 = scale[0] / 2; // Octave down for drone
      const baseDroneFreq2 = scale[1] / 2;
      
      for (let channel = 0; channel < 2; channel++) {
        const channelData = buffer.getChannelData(channel);
        
        // Base drone
        for (let i = 0; i < buffer.length; i++) {
          const t = i / sampleRate;
          const drone = Math.sin(t * baseDroneFreq1 * Math.PI * 2) * 0.05 +
                        Math.sin(t * baseDroneFreq2 * Math.PI * 2) * 0.03;
          channelData[i] = drone;
        }

        // Add random notes
        const noteCount = 12 + Math.floor(Math.random() * 8); // Variable note count
        for (let n = 0; n < noteCount; n++) {
          const startTime = (n / noteCount) * duration + Math.random() * (duration / noteCount);
          const freq = scale[Math.floor(Math.random() * scale.length)];
          const noteDuration = 1.5 + Math.random() * 2.5;
          
          const startIdx = Math.floor(startTime * sampleRate);
          const endIdx = Math.min(buffer.length, Math.floor((startTime + noteDuration) * sampleRate));
          
          for (let i = startIdx; i < endIdx; i++) {
            const t = (i - startIdx) / sampleRate;
            const env = Math.pow(Math.sin((t / noteDuration) * Math.PI), 0.5); // Sharper attack/decay
            const osc = Math.sin(t * freq * Math.PI * 2) * 0.12;
            // Add a subtle harmonic
            const harmonic = Math.sin(t * freq * 2 * Math.PI * 2) * 0.04;
            channelData[i] += (osc + harmonic) * env;
          }
        }

        // Final smoothing and limiting
        for (let i = 0; i < buffer.length; i++) {
          const fadeLength = sampleRate * 2;
          let env = 1;
          if (i < fadeLength) env = i / fadeLength;
          else if (i > buffer.length - fadeLength) env = (buffer.length - i) / fadeLength;
          
          channelData[i] = Math.tanh(channelData[i] * env * 0.6) * 0.35;
        }
      }
      
      this.bgmBuffer = buffer;
      this.playBGM();
    } catch (e) {
      console.error('Failed to generate BGM', e);
    }
  }

  public playBGM() {
    this.init();
    if (!this.context || !this.bgmBuffer || this.bgmSource) return;

    this.bgmSource = this.context.createBufferSource();
    this.bgmSource.buffer = this.bgmBuffer;
    this.bgmSource.loop = true;
    
    const bgmGain = this.context.createGain();
    bgmGain.gain.value = 0.5;
    this.bgmSource.connect(bgmGain);
    bgmGain.connect(this.masterGain!);
    
    this.bgmSource.start(0);
  }

  public playSFX(type: 'laser' | 'explosion' | 'pickup' | 'damage' | 'upgrade' | 'chest') {
    this.init();
    if (!this.context || !this.masterGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.context.currentTime;

    switch (type) {
      case 'laser':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case 'explosion':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        // Add some noise for explosion feel
        this.playNoise(0.3, 0.4);
        break;
      case 'pickup':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case 'damage':
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case 'upgrade':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      case 'chest':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.2);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
    }
  }

  private playNoise(duration: number, volume: number) {
    if (!this.context || !this.masterGain) return;
    const bufferSize = this.context.sampleRate * duration;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.context.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(volume, this.context.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start();
  }

  public resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
    this.playBGM();
  }
}

export const audioManager = new AudioManager();
