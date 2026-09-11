// Background Suspense Audio Engine for Running Trading Bots
// Plays "Anticipation" (FesliyanStudios - Suspenseful & Dramatic Film Soundtrack)
// Plays automatically in the background when the bot is running, stops when paused or stopped.

class MotivationalAudioEngine {
  private audioElement: HTMLAudioElement | null = null;
  private synthCtx: AudioContext | null = null;
  private synthMasterGain: GainNode | null = null;
  private synthTimerId: any = null;
  private isRunning: boolean = false;
  private isUsingSynthFallback: boolean = false;
  private volume: number = 0.85; // Solid clear volume
  private currentStep: number = 0;
  private currentChordIndex: number = 0;
  private noiseBuffer: AudioBuffer | null = null;

  // Direct MP3 sources for Anticipation / Cinematic Film Suspense Soundtrack
  private audioSources = [
    'https://www.fesliyanstudios.com/musicfiles/2016-11-20_-_Anticipation_-_David_Fesliyan.mp3',
    'https://cdn.pixabay.com/download/audio/2022/03/24/audio_c8b88d3e69.mp3' // High quality fallback
  ];

  // Suspenseful Dark Minor & Diminished Chord Progression for Synth Fallback
  private suspenseChords = [
    [32.70, 65.41, 130.81, 155.56, 196.00, 293.66],
    [32.70, 65.41, 123.47, 146.83, 185.00, 261.63],
    [51.91, 103.83, 155.56, 207.65, 246.94, 311.13],
    [49.00, 97.99, 146.83, 196.00, 233.08, 293.66]
  ];

  private suspenseScale = [
    261.63, 293.66, 311.13, 369.99, 392.00, 466.16, 523.25, 587.33, 622.25, 739.99
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.audioElement = new Audio();
        this.audioElement.loop = true;
        this.audioElement.volume = this.volume;
        this.audioElement.crossOrigin = 'anonymous';
        this.audioElement.src = this.audioSources[0];

        // If primary stream fails, fallback to secondary stream or Web Audio synth
        this.audioElement.onerror = () => {
          if (this.audioElement && this.audioElement.src === this.audioSources[0]) {
            this.audioElement.src = this.audioSources[1];
            if (this.isRunning) {
              this.audioElement.play().catch(() => this.startSynthFallback());
            }
          } else if (this.isRunning) {
            this.startSynthFallback();
          }
        };
      } catch (e) {
        console.warn('Audio element initialization skipped:', e);
      }
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    if (this.audioElement) {
      this.audioElement.volume = this.volume;
      this.audioElement.currentTime = 0;

      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If browser policy blocks HTML5 Audio auto-play or stream fails, use Web Audio API synth
          this.startSynthFallback();
        });
      }
    } else {
      this.startSynthFallback();
    }
  }

  public stop() {
    this.isRunning = false;

    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch (e) {
        // Ignore
      }
    }

    this.stopSynthFallback();
  }

  public pause() {
    this.stop();
  }

  public resume() {
    this.start();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
    if (this.synthMasterGain && this.synthCtx) {
      const now = this.synthCtx.currentTime;
      this.synthMasterGain.gain.setValueAtTime(this.volume, now);
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  // Web Audio Synth Fallback (synthesizes "Anticipation" suspense atmosphere)
  private initSynthContext() {
    if (!this.synthCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.synthCtx = new AudioCtx();

      this.synthMasterGain = this.synthCtx.createGain();
      this.synthMasterGain.gain.setValueAtTime(this.volume, this.synthCtx.currentTime);
      this.synthMasterGain.connect(this.synthCtx.destination);

      const bufferSize = this.synthCtx.sampleRate;
      this.noiseBuffer = this.synthCtx.createBuffer(1, bufferSize, this.synthCtx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }

    if (this.synthCtx && this.synthCtx.state === 'suspended') {
      this.synthCtx.resume();
    }
  }

  private startSynthFallback() {
    if (this.isUsingSynthFallback) return;
    this.isUsingSynthFallback = true;
    this.initSynthContext();

    if (!this.synthCtx || !this.synthMasterGain) return;

    this.currentStep = 0;
    this.currentChordIndex = 0;

    const now = this.synthCtx.currentTime;
    this.synthMasterGain.gain.cancelScheduledValues(now);
    this.synthMasterGain.gain.setValueAtTime(0, now);
    this.synthMasterGain.gain.linearRampToValueAtTime(this.volume, now + 0.3);

    const stepInterval = 115; 
    this.synthTimerId = setInterval(() => {
      this.tickSynth();
    }, stepInterval);
  }

  private tickSynth() {
    if (!this.isRunning || !this.synthCtx || !this.synthMasterGain) return;

    const now = this.synthCtx.currentTime;
    const chord = this.suspenseChords[this.currentChordIndex];
    const step16 = this.currentStep % 16;

    if (step16 === 0) {
      this.playDarkDrone(chord, now);
    }

    if (step16 === 0 || step16 === 8) {
      this.playHeartbeat(now, 1.0);
    }

    this.playClockTick(now, step16 % 4 === 0);

    if ([3, 7, 11, 14].includes(step16)) {
      const pingNoteIdx = (this.currentStep * 2 + this.currentChordIndex) % this.suspenseScale.length;
      const freq = this.suspenseScale[pingNoteIdx];
      this.playSuspensePing(freq, now);
    }

    if (step16 % 2 === 0) {
      this.playSubBass(chord[0], now);
    }

    this.currentStep++;
    if (this.currentStep % 16 === 0) {
      this.currentChordIndex = (this.currentChordIndex + 1) % this.suspenseChords.length;
    }
  }

  private playDarkDrone(freqs: number[], now: number) {
    if (!this.synthCtx || !this.synthMasterGain) return;

    freqs.slice(0, 4).forEach((freq, idx) => {
      const osc = this.synthCtx!.createOscillator();
      const gain = this.synthCtx!.createGain();
      const filter = this.synthCtx!.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200 + idx * 50, now);
      filter.frequency.exponentialRampToValueAtTime(500 + idx * 80, now + 1.2);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.synthMasterGain!);

      osc.start(now);
      osc.stop(now + 2.0);
    });
  }

  private playHeartbeat(now: number, intensity: number) {
    if (!this.synthCtx || !this.synthMasterGain) return;

    const osc = this.synthCtx.createOscillator();
    const gain = this.synthCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.14);

    gain.gain.setValueAtTime(0.45 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.synthMasterGain);

    osc.start(now);
    osc.stop(now + 0.17);
  }

  private playClockTick(now: number, isAccent: boolean) {
    if (!this.synthCtx || !this.synthMasterGain || !this.noiseBuffer) return;

    const whiteNoise = this.synthCtx.createBufferSource();
    whiteNoise.buffer = this.noiseBuffer;

    const filter = this.synthCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isAccent ? 4000 : 2800, now);
    filter.Q.setValueAtTime(6, now);

    const gain = this.synthCtx.createGain();
    const maxGain = isAccent ? 0.09 : 0.05;

    gain.gain.setValueAtTime(maxGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthMasterGain);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.035);
  }

  private playSuspensePing(freq: number, now: number) {
    if (!this.synthCtx || !this.synthMasterGain) return;

    const osc = this.synthCtx.createOscillator();
    const gain = this.synthCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.synthMasterGain);

    osc.start(now);
    osc.stop(now + 0.52);
  }

  private playSubBass(freq: number, now: number) {
    if (!this.synthCtx || !this.synthMasterGain) return;

    const osc = this.synthCtx.createOscillator();
    const gain = this.synthCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.synthMasterGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  private stopSynthFallback() {
    this.isUsingSynthFallback = false;

    if (this.synthTimerId) {
      clearInterval(this.synthTimerId);
      this.synthTimerId = null;
    }

    if (this.synthCtx && this.synthMasterGain) {
      const now = this.synthCtx.currentTime;
      this.synthMasterGain.gain.cancelScheduledValues(now);
      this.synthMasterGain.gain.setValueAtTime(this.synthMasterGain.gain.value, now);
      this.synthMasterGain.gain.linearRampToValueAtTime(0, now + 0.2);
    }
  }
}

export const motivationalAudio = new MotivationalAudioEngine();
