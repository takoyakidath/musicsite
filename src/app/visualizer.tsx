"use client"

import { useRef, useEffect } from "react"

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null
  isPlaying: boolean
  audioContext: AudioContext | null
}

export default function AudioVisualizer({ audioElement, isPlaying, audioContext }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const setupAttemptedRef = useRef(false)

  // Set up audio analyzer
  useEffect(() => {
    if (!audioElement || !audioContext) return

    // Function to set up audio analyzer
    const setupAudioAnalyzer = () => {
      try {
        console.log("Setting up audio analyzer with AudioContext state:", audioContext.state)

        // Create analyzer if it doesn't exist
        if (!analyserRef.current) {
          analyserRef.current = audioContext.createAnalyser()
          analyserRef.current.fftSize = 1024
          console.log("Analyzer created")
        }

        // Create source if it doesn't exist or if audio element changed
        if (!sourceRef.current) {
          try {
            sourceRef.current = audioContext.createMediaElementSource(audioElement)
            sourceRef.current.connect(analyserRef.current)
            analyserRef.current.connect(audioContext.destination)
            console.log("Audio source connected")
          } catch (err) {
            // If we get an error about the media element already being connected
            if (err instanceof DOMException && err.message.includes("MediaElementAudioSource")) {
              console.log("Audio element already connected to a different AudioContext, reconnecting...")

              // Try to disconnect existing connections (this might not work)
              try {
                analyserRef.current.disconnect()
              } catch (e) {
                console.error("Error disconnecting analyzer:", e)
              }

              // Create a new analyzer
              analyserRef.current = audioContext.createAnalyser()
              analyserRef.current.fftSize = 1024

              // Try to connect the analyzer directly to the destination
              analyserRef.current.connect(audioContext.destination)
              console.log("Created new analyzer and connected to destination")
            } else {
              throw err
            }
          }
        }

        setupAttemptedRef.current = true
      } catch (err) {
        console.error("Error setting up audio analyzer:", err)
      }
    }

    // Try to set up immediately if possible
    if (audioContext.state === "running" || !setupAttemptedRef.current) {
      setupAudioAnalyzer()
    }

    // This is a workaround since there's no direct event for AudioContext state changes
    const checkState = setInterval(() => {
      if (audioContext.state === "running" && !setupAttemptedRef.current) {
        setupAudioAnalyzer()
      }
    }, 1000)

    return () => {
      clearInterval(checkState)

      // Clean up animation frame
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [audioElement, audioContext])

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Make canvas responsive
    const resizeCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    const draw = () => {
      resizeCanvas()

      // Clear canvas with gradient background
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Create a gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      bgGradient.addColorStop(0, "#0f172a") // slate-900
      bgGradient.addColorStop(1, "#020617") // slate-950
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // If we have analyzer and it's playing, draw audio visualization
      if (analyserRef.current && isPlaying && audioContext?.state === "running") {
        try {
          const bufferLength = analyserRef.current.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)
          analyserRef.current.getByteFrequencyData(dataArray)

          // Draw particles based on audio data
          const particles = []
          const particleCount = 200

          for (let i = 0; i < particleCount; i++) {
            const freqIndex = Math.floor((i / particleCount) * bufferLength)
            const amplitude = dataArray[freqIndex] / 255

            // Skip particles with low amplitude
            if (amplitude < 0.05) continue

            const angle = (i / particleCount) * Math.PI * 2
            const distance = 50 + amplitude * 200

            const x = canvas.width / 2 + Math.cos(angle) * distance
            const y = canvas.height / 2 + Math.sin(angle) * distance
            const size = 1 + amplitude * 5

            // Color based on frequency
            const hue = (freqIndex / bufferLength) * 260 + 180

            particles.push({
              x,
              y,
              size,
              color: `hsla(${hue}, 100%, 70%, ${amplitude * 0.8})`,
            })
          }

          // Draw particles
          particles.forEach((particle) => {
            ctx.beginPath()
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
            ctx.fillStyle = particle.color
            ctx.fill()
          })

          // Draw circular wave
          ctx.beginPath()
          ctx.arc(canvas.width / 2, canvas.height / 2, 150, 0, Math.PI * 2)
          ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"
          ctx.lineWidth = 1
          ctx.stroke()

          // Draw frequency bars in a circle
          const barCount = 180
          const radius = 150

          for (let i = 0; i < barCount; i++) {
            const freqIndex = Math.floor(((i / barCount) * bufferLength) / 2)
            const amplitude = dataArray[freqIndex] / 255

            const barHeight = 5 + amplitude * 100
            const angle = (i / barCount) * Math.PI * 2

            const innerX = canvas.width / 2 + Math.cos(angle) * radius
            const innerY = canvas.height / 2 + Math.sin(angle) * radius

            const outerX = canvas.width / 2 + Math.cos(angle) * (radius + barHeight)
            const outerY = canvas.height / 2 + Math.sin(angle) * (radius + barHeight)

            // Create gradient for each bar
            const barGradient = ctx.createLinearGradient(innerX, innerY, outerX, outerY)

            // Color based on frequency and amplitude
            const hue = (i / barCount) * 260 + 180
            barGradient.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.5)`)
            barGradient.addColorStop(1, `hsla(${hue}, 100%, 50%, 0.2)`)

            ctx.beginPath()
            ctx.moveTo(innerX, innerY)
            ctx.lineTo(outerX, outerY)
            ctx.lineWidth = 3
            ctx.strokeStyle = barGradient
            ctx.lineCap = "round"
            ctx.stroke()
          }

          // Draw central circle
          const centerGradient = ctx.createRadialGradient(
            canvas.width / 2,
            canvas.height / 2,
            0,
            canvas.width / 2,
            canvas.height / 2,
            50,
          )
          centerGradient.addColorStop(0, "rgba(255, 255, 255, 0.8)")
          centerGradient.addColorStop(1, "rgba(255, 255, 255, 0)")

          ctx.beginPath()
          ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2)
          ctx.fillStyle = centerGradient
          ctx.fill()

          // Add glow effect
          ctx.shadowColor = "rgba(79, 70, 229, 0.6)"
          ctx.shadowBlur = 15
        } catch (err) {
          console.error("Error drawing audio visualization:", err)
        }
      } else {
        // Draw idle animation when not playing
        const time = Date.now() / 1000

        // Draw stars
        for (let i = 0; i < 100; i++) {
          const x = (Math.sin(i * 0.1 + time * 0.1) * canvas.width) / 2 + canvas.width / 2
          const y = (Math.cos(i * 0.1 + time * 0.1) * canvas.height) / 2 + canvas.height / 2
          const size = 0.5 + Math.sin(i + time) * 0.5

          ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(i + time) * 0.1})`
          ctx.beginPath()
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fill()
        }

        // Draw multiple animated waves
        for (let wave = 0; wave < 5; wave++) {
          const waveSpeed = 0.3 + wave * 0.1
          const waveHeight = 3 + wave * 2
          const waveFrequency = 20 + wave * 10

          ctx.beginPath()

          for (let x = 0; x < canvas.width; x += 5) {
            const y = Math.sin(x / waveFrequency + time * waveSpeed) * waveHeight + canvas.height / 2

            if (x === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
          }

          ctx.strokeStyle = `hsla(${210 + wave * 30}, 80%, ${60 - wave * 5}%, ${0.2 - wave * 0.03})`
          ctx.lineWidth = 2
          ctx.stroke()
        }

        // Draw central pulsing circle
        const pulseSize = 50 + Math.sin(time) * 10
        const circleGradient = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          0,
          canvas.width / 2,
          canvas.height / 2,
          pulseSize,
        )
        circleGradient.addColorStop(0, "rgba(79, 70, 229, 0.6)") // indigo-600
        circleGradient.addColorStop(1, "rgba(79, 70, 229, 0)")

        ctx.beginPath()
        ctx.arc(canvas.width / 2, canvas.height / 2, pulseSize, 0, Math.PI * 2)
        ctx.fillStyle = circleGradient
        ctx.fill()
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, audioContext])

  return (
    <div className="w-full h-full overflow-hidden rounded-lg">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}

