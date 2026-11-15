let audioContext: AudioContext | null = null
let unlockInstalled = false

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return null
  audioContext ??= new AudioContextClass()
  return audioContext
}

function unlockAudio(): void {
  const context = getAudioContext()
  if (context?.state === "suspended") void context.resume().catch(() => {})
}

/** Panggil sekali saat aplikasi aktif; browser membuka audio setelah interaksi pengguna. */
export function enableNotificationSounds(): void {
  if (typeof window === "undefined" || unlockInstalled) return
  unlockInstalled = true
  window.addEventListener("pointerdown", unlockAudio, { once: true })
  window.addEventListener("keydown", unlockAudio, { once: true })
}

/** Chime singkat dan lembut tanpa aset audio eksternal. */
export function playNotificationSound(): void {
  const context = getAudioContext()
  if (!context) return

  const play = () => {
    if (context.state !== "running") return
    const start = context.currentTime
    ;[659.25, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const at = start + index * 0.075
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(frequency, at)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.045, at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.14)
    })
  }

  if (context.state === "suspended") {
    void context.resume().then(play).catch(() => {})
  } else {
    play()
  }
}
