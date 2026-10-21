import type { CombatCue } from './engine'

type Sfx = 'confirm' | 'build' | 'upgrade' | 'alert' | 'impact' | 'error'

let audio: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let started = false
let musicLevel = 0.2
let effectsLevel = 0.42
let noiseBuffer: AudioBuffer | null = null

function ensureAudio() {
  if (audio) return audio
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return null
  audio = new AudioContextClass()
  master = audio.createGain()
  musicBus = audio.createGain()
  sfxBus = audio.createGain()
  const limiter = audio.createDynamicsCompressor()
  limiter.threshold.value = -14
  limiter.knee.value = 20
  limiter.ratio.value = 8
  limiter.attack.value = 0.003
  limiter.release.value = 0.16
  musicBus.connect(master)
  sfxBus.connect(limiter)
  limiter.connect(master)
  master.connect(audio.destination)
  master.gain.value = 0.48
  musicBus.gain.value = musicLevel * 0.32
  sfxBus.gain.value = effectsLevel * 0.75
  return audio
}

export function configureAudio(music: number, effects: number) {
  musicLevel = Math.max(0, Math.min(1, music))
  effectsLevel = Math.max(0, Math.min(1, effects))
  if (!audio || !musicBus || !sfxBus) return
  musicBus.gain.setTargetAtTime(musicLevel * 0.32, audio.currentTime, 0.08)
  sfxBus.gain.setTargetAtTime(effectsLevel * 0.75, audio.currentTime, 0.04)
}

export async function startAudio(music: number, effects: number) {
  const ctx = ensureAudio()
  if (!ctx) return
  try { await ctx.resume() } catch { return }
  configureAudio(music, effects)
  if (started) return
  started = true
  const tones = [55, 82.4, 110]
  tones.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    oscillator.type = index === 0 ? 'triangle' : 'sine'
    oscillator.frequency.value = frequency
    filter.type = 'lowpass'
    filter.frequency.value = 220 + index * 75
    gain.gain.value = index === 0 ? 0.18 : 0.055
    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(musicBus!)
    oscillator.start()
  })
}

export function playSfx(kind: Sfx) {
  if (effectsLevel <= 0) return
  const ctx = ensureAudio()
  if (!ctx || !sfxBus) return
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  const config: Record<Sfx, { start: number; end: number; duration: number; wave: OscillatorType; volume: number }> = {
    confirm: { start: 560, end: 820, duration: 0.1, wave: 'sine', volume: 0.18 },
    build: { start: 150, end: 620, duration: 0.18, wave: 'triangle', volume: 0.26 },
    upgrade: { start: 280, end: 940, duration: 0.24, wave: 'sine', volume: 0.23 },
    alert: { start: 510, end: 280, duration: 0.28, wave: 'sawtooth', volume: 0.16 },
    impact: { start: 120, end: 48, duration: 0.19, wave: 'triangle', volume: 0.22 },
    error: { start: 180, end: 110, duration: 0.16, wave: 'square', volume: 0.12 },
  }
  const spec = config[kind]
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  oscillator.type = spec.wave
  oscillator.frequency.setValueAtTime(spec.start, ctx.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, spec.end), ctx.currentTime + spec.duration)
  filter.type = 'lowpass'
  filter.frequency.value = kind === 'impact' ? 720 : 1800
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(spec.volume, ctx.currentTime + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + spec.duration)
  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(sfxBus)
  oscillator.start()
  oscillator.stop(ctx.currentTime + spec.duration + 0.03)
  oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect() }
}

// Combat cues come from actual shots and impacts, independently of React redraws.
export function playCombatSfx(cue: CombatCue) {
  const ctx = audio
  if (!ctx || !sfxBus || ctx.state !== 'running' || effectsLevel <= 0) return
  const output = ctx.createGain()
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.max(-0.65, Math.min(0.65, (cue.x / 1000 - 0.5) * 1.3))
  output.connect(pan); pan.connect(sfxBus)
  let sources = 0
  const dispose = () => { if (--sources === 0) { output.disconnect(); pan.disconnect() } }
  const tone = (start: number, end: number, duration: number, volume: number, wave: OscillatorType = 'sine') => {
    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    oscillator.type = wave
    oscillator.frequency.setValueAtTime(start, ctx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(end, ctx.currentTime + duration)
    filter.type = 'lowpass'; filter.frequency.value = 4200
    envelope.gain.setValueAtTime(0.0001, ctx.currentTime)
    envelope.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.004)
    envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    oscillator.connect(filter); filter.connect(envelope); envelope.connect(output)
    sources += 1
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); envelope.disconnect(); dispose() }
    oscillator.start(); oscillator.stop(ctx.currentTime + duration + 0.015)
  }
  const noise = (duration: number, volume: number, frequency: number, type: BiquadFilterType = 'bandpass') => {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.5), ctx.sampleRate)
      const samples = noiseBuffer.getChannelData(0)
      for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1
    }
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const envelope = ctx.createGain()
    source.buffer = noiseBuffer
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = 0.8
    envelope.gain.setValueAtTime(0.0001, ctx.currentTime)
    envelope.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.003)
    envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    source.connect(filter); filter.connect(envelope); envelope.connect(output)
    sources += 1
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); dispose() }
    source.start(); source.stop(ctx.currentTime + duration + 0.015)
  }

  if (cue.kind === 'impact') {
    if (cue.weapon === 'comet') {
      tone(105, 30, 0.3, 0.5, 'triangle'); noise(0.28, 0.52, 1050, 'lowpass')
    } else if (cue.weapon === 'rail') {
      tone(230, 55, 0.14, 0.28, 'triangle'); noise(0.12, 0.32, 1700)
    } else if (cue.weapon === 'cold') {
      tone(1600, 2500, 0.09, 0.17); noise(0.11, 0.24, 4800, 'highpass')
    } else if (cue.weapon === 'arc') {
      tone(900, 170, 0.09, 0.16, 'triangle'); noise(0.07, 0.26, 3100)
    } else {
      tone(350, 90, 0.065, 0.17, 'triangle'); noise(0.055, 0.22, 2100)
    }
    return
  }

  switch (cue.weapon) {
    case 'needle':
      tone(940, 230, 0.075, 0.34, 'triangle'); noise(0.06, 0.4, 1800, 'highpass')
      break
    case 'rail':
      tone(1100, 85, 0.24, 0.5); tone(500, 45, 0.12, 0.23, 'sawtooth'); noise(0.14, 0.36, 2800, 'lowpass')
      break
    case 'arc':
      tone(1600, 400, 0.14, 0.29, 'sawtooth'); tone(250, 1200, 0.1, 0.14, 'square'); noise(0.11, 0.36, 2400)
      break
    case 'comet':
      tone(220, 55, 0.19, 0.34, 'sawtooth'); tone(90, 35, 0.26, 0.45, 'triangle'); noise(0.2, 0.38, 1600, 'lowpass')
      break
    case 'cold':
      tone(1800, 760, 0.16, 0.37); tone(2700, 1400, 0.18, 0.18); noise(0.12, 0.24, 5000)
      break
    case 'drone':
      tone(1100, 1700, 0.095, 0.26, 'triangle'); tone(550, 320, 0.13, 0.25); noise(0.045, 0.17, 2600)
      break
    case 'relay':
      tone(780, 220, 0.15, 0.32); noise(0.08, 0.2, 2600)
      break
    case 'shield':
      tone(320, 95, 0.22, 0.36, 'triangle'); tone(1200, 420, 0.12, 0.2)
      break
    case 'lure':
      tone(130, 390, 0.24, 0.36); tone(520, 110, 0.22, 0.24, 'triangle')
      break
  }
}
