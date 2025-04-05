"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Play, Pause, SkipForward, Music4, Volume2, VolumeX, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import AudioVisualizer from "./visualizer"
import { motion, AnimatePresence } from "framer-motion"

export default function MusicPlayer() {
  const [tracks, setTracks] = useState<string[]>([])
  const [currentTrack, setCurrentTrack] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [showStartOverlay, setShowStartOverlay] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const hasInitializedRef = useRef(false)

  // Fetch music tracks from API
  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const response = await fetch("/api/music")
        if (!response.ok) {
          throw new Error("Failed to fetch music tracks")
        }
        const data = await response.json()

        if (data.tracks && data.tracks.length > 0) {
          console.log("Tracks loaded:", data.tracks)
          setTracks(data.tracks)

          // Select a random track on initial load
          if (!currentTrack) {
            selectRandomTrack(data.tracks)
          }
        } else {
          setError("No music tracks found. Please add MP3 files to the /public/music/ folder.")
        }
      } catch (err) {
        console.error("Error fetching tracks:", err)
        setError("Failed to load music tracks")
      }
    }

    fetchTracks()
  }, [])

  // Initialize audio context when component mounts
  useEffect(() => {
    // Function to create and resume AudioContext
    const initializeAudioContext = async () => {
      try {
        // Create new AudioContext if it doesn't exist
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
          console.log("AudioContext created with state:", audioContextRef.current.state)
        }

        // Resume AudioContext if it's suspended
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume()
          console.log("AudioContext resumed")
        }

        hasInitializedRef.current = true
      } catch (err) {
        console.error("Failed to initialize AudioContext:", err)
        setError("Failed to initialize audio system. Please reload the page.")
      }
    }

    // Initialize on user interaction
    const handleUserInteraction = () => {
      initializeAudioContext()
    }

    // Add event listeners for user interaction
    window.addEventListener("click", handleUserInteraction)
    window.addEventListener("touchstart", handleUserInteraction)

    // Clean up
    return () => {
      window.removeEventListener("click", handleUserInteraction)
      window.removeEventListener("touchstart", handleUserInteraction)

      // Close AudioContext when component unmounts
      if (audioContextRef.current) {
        audioContextRef.current.close().catch((err) => {
          console.error("Error closing AudioContext:", err)
        })
      }
    }
  }, [])

  // Select a random track from the available tracks
  const selectRandomTrack = (availableTracks = tracks) => {
    if (availableTracks.length === 0) return

    const randomIndex = Math.floor(Math.random() * availableTracks.length)
    const newTrack = availableTracks[randomIndex]
    console.log("Selected track:", newTrack)
    setCurrentTrack(newTrack)
    setRetryCount(0) // Reset retry count for new track
  }

  // Start playback with user interaction
  const startPlayback = async () => {
    if (!audioRef.current || !currentTrack) {
      console.error("Audio element or track not ready")
      return
    }

    setIsLoading(true)
    console.log("Starting playback for:", currentTrack)

    try {
      // Ensure AudioContext is initialized and resumed
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
        console.log("AudioContext resumed before playback")
      }

      // Make sure the audio is loaded
      audioRef.current.load()

      // Small delay to ensure audio is loaded
      setTimeout(async () => {
        if (audioRef.current) {
          try {
            // Try to play with a promise
            await audioRef.current.play()
            console.log("Playback started successfully")
            setIsPlaying(true)
            setShowStartOverlay(false)
            setIsLoading(false)
            setError(null)
          } catch (err) {
            console.error("Playback error:", err)
            setIsPlaying(false)
            setIsLoading(false)
            setError("Failed to play the track. Please try again.")

            // Force reload the audio element
            if (audioRef.current) {
              const currentSrc = audioRef.current.querySelector("source")?.src
              if (currentSrc) {
                const audioElement = audioRef.current
                audioElement.innerHTML = ""
                const source = document.createElement("source")
                source.src = currentSrc
                source.type = "audio/mpeg"
                audioElement.appendChild(source)
                audioElement.load()
              }
            }
          }
        }
      }, 500)
    } catch (err) {
      console.error("Error preparing for playback:", err)
      setIsLoading(false)
      setError("Failed to initialize audio playback. Please reload the page.")
    }
  }

  // Handle play/pause
  const togglePlayPause = async () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      setIsLoading(true)

      try {
        // Ensure AudioContext is resumed
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume()
          console.log("AudioContext resumed before resuming playback")
        }

        // Try to play with a promise
        await audioRef.current.play()
        console.log("Playback resumed successfully")
        setIsPlaying(true)
        setIsLoading(false)
        setError(null)
      } catch (err) {
        console.error("Playback resume error:", err)
        setIsPlaying(false)
        setIsLoading(false)
        setError("Failed to resume playback. Please try again.")
      }
    }
  }

  // Handle track ended - play next random track
  const handleTrackEnded = () => {
    console.log("Track ended, selecting next track")
    selectRandomTrack()

    // We'll let the useEffect handle the playback
  }

  // Skip to next track
  const skipToNext = () => {
    console.log("Skipping to next track")
    selectRandomTrack()

    // We'll let the useEffect handle the playback
  }

  // Handle audio errors
  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.error("Audio error event:", e)

    // Try to get more detailed error information
    const target = e.target as HTMLAudioElement
    console.error("Audio error code:", target.error?.code)
    console.error("Audio error message:", target.error?.message)

    setError(`Error playing the track: ${target.error?.message || "Unknown error"}`)

    // Try to recover by selecting a different track after a few retries
    if (retryCount < 3) {
      console.log(`Retry attempt ${retryCount + 1}/3`)
      setRetryCount((prev) => prev + 1)

      // Try to reload the same track first
      if (audioRef.current) {
        audioRef.current.load()

        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch((err) => {
              console.error("Retry playback error:", err)
              // If still failing, try a different track
              selectRandomTrack()
            })
          }
        }, 1000)
      }
    } else {
      console.log("Max retries reached, selecting a different track")
      selectRandomTrack()
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted
      setMuted(!muted)
    }
  }

  // Retry current track
  const retryCurrentTrack = async () => {
    if (!audioRef.current || !currentTrack) return

    console.log("Manually retrying current track:", currentTrack)
    setIsLoading(true)
    setError(null)

    try {
      // Ensure AudioContext is resumed
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
        console.log("AudioContext resumed before retry")
      }

      // Force reload the audio element
      const currentSrc = `/music/${currentTrack}`
      audioRef.current.innerHTML = ""
      const source = document.createElement("source")
      source.src = currentSrc
      source.type = "audio/mpeg"
      audioRef.current.appendChild(source)

      // Reload the audio element
      audioRef.current.load()

      setTimeout(async () => {
        if (audioRef.current) {
          try {
            await audioRef.current.play()
            console.log("Manual retry successful")
            setIsPlaying(true)
            setIsLoading(false)
          } catch (err) {
            console.error("Manual retry failed:", err)
            setIsPlaying(false)
            setIsLoading(false)
            setError("Failed to play the track. Please try again.")
          }
        }
      }, 500)
    } catch (err) {
      console.error("Error during retry:", err)
      setIsLoading(false)
      setError("Failed to retry playback. Please reload the page.")
    }
  }

  // Reset audio system
  const resetAudioSystem = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Close existing AudioContext
      if (audioContextRef.current) {
        await audioContextRef.current.close()
        audioContextRef.current = null
      }

      // Create new AudioContext
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      console.log("AudioContext reset with state:", audioContextRef.current.state)

      // Force reload the audio element
      if (audioRef.current && currentTrack) {
        const currentSrc = `/music/${currentTrack}`
        audioRef.current.innerHTML = ""
        const source = document.createElement("source")
        source.src = currentSrc
        source.type = "audio/mpeg"
        audioRef.current.appendChild(source)
        audioRef.current.load()
      }

      setIsLoading(false)

      // If we were on the start overlay, keep it there
      // Otherwise try to play again
      if (!showStartOverlay) {
        startPlayback()
      }
    } catch (err) {
      console.error("Failed to reset audio system:", err)
      setIsLoading(false)
      setError("Failed to reset audio system. Please reload the page.")
    }
  }

  // Effect to handle track changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return

    console.log("Track changed to:", currentTrack)
    setIsLoading(true)

    // Force reload the audio element
    const currentSrc = `/music/${currentTrack}`
    audioRef.current.innerHTML = ""
    const source = document.createElement("source")
    source.src = currentSrc
    source.type = "audio/mpeg"
    audioRef.current.appendChild(source)

    // Load the new track
    audioRef.current.load()

    // If we were already playing, try to play the new track
    if (isPlaying) {
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current
            .play()
            .then(() => {
              console.log("New track playback started")
              setIsLoading(false)
              setError(null)
            })
            .catch((err) => {
              console.error("New track playback error:", err)
              setIsPlaying(false)
              setIsLoading(false)
              setError("Failed to play the new track. Please try again.")
            })
        }
      }, 500)
    } else {
      setIsLoading(false)
    }
  }, [currentTrack])

  // Check if audio is actually playing
  useEffect(() => {
    if (!isPlaying || !audioRef.current) return

    // Check every second if audio is actually playing
    const interval = setInterval(() => {
      if (audioRef.current && audioRef.current.paused && isPlaying) {
        console.warn("Audio is marked as playing but is actually paused")
        setIsPlaying(false)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isPlaying])

  // Handle visibility change (tab switching)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log("Page became visible, checking audio system")

        // Resume AudioContext if it's suspended
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          try {
            await audioContextRef.current.resume()
            console.log("AudioContext resumed after visibility change")
          } catch (err) {
            console.error("Failed to resume AudioContext:", err)
          }
        }

        // If we were playing but audio is paused, try to resume
        if (isPlaying && audioRef.current && audioRef.current.paused) {
          try {
            await audioRef.current.play()
            console.log("Playback resumed after visibility change")
          } catch (err) {
            console.error("Failed to resume playback after visibility change:", err)
            setIsPlaying(false)
          }
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [isPlaying])

  return (
    <div className="space-y-4">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="p-3 bg-red-900/80 text-red-100 rounded-md mb-4 backdrop-blur-sm flex items-center justify-between"
        >
          <span>{error}</span>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-red-800 border-red-700 hover:bg-red-700 text-white"
              onClick={retryCurrentTrack}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-red-800 border-red-700 hover:bg-red-700 text-white"
              onClick={resetAudioSystem}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Reset Audio
            </Button>
          </div>
        </motion.div>
      )}

      <Card className="bg-transparent border-0 shadow-none overflow-hidden">
        <div className="relative">
          {/* Audio Visualizer */}
          <div className="h-[70vh] w-full">
            <AudioVisualizer
              audioElement={audioRef.current}
              isPlaying={isPlaying}
              audioContext={audioContextRef.current}
            />
          </div>

          {/* Start Overlay */}
          {showStartOverlay && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center p-6"
              >
                <h2 className="text-3xl font-bold text-white mb-6">Music Visualizer</h2>
                <p className="text-lg text-gray-300 mb-8">
                  Click the button below to start the music and visualization
                </p>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-6 rounded-full text-lg font-medium"
                  onClick={startPlayback}
                  disabled={isLoading || !currentTrack}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-6 w-6 animate-spin" /> Loading...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-6 w-6" /> Start Music
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && !showStartOverlay && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <RefreshCw className="h-12 w-12 text-white animate-spin" />
            </div>
          )}

          {/* Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between">
              {/* Track info */}
              <div className="flex items-center space-x-4">
                <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-3 rounded-xl shadow-lg">
                  <Music4 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentTrack}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="font-bold text-2xl text-white"
                    >
                      {currentTrack ? currentTrack.replace(".mp3", "") : "No track selected"}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* Controls */}
              <div className="flex space-x-4">
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-14 w-14 rounded-full bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/30 ${!isPlaying ? "pulse-animation" : ""}`}
                  onClick={togglePlayPause}
                  disabled={isLoading || !currentTrack || tracks.length === 0}
                >
                  {isLoading ? (
                    <RefreshCw className="h-6 w-6 text-white animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-6 w-6 text-white" />
                  ) : (
                    <Play className="h-6 w-6 text-white ml-1" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-full bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/30"
                  onClick={skipToNext}
                  disabled={isLoading || tracks.length === 0}
                >
                  <SkipForward className="h-6 w-6 text-white" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-full bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/30"
                  onClick={toggleMute}
                  disabled={isLoading}
                >
                  {muted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={handleTrackEnded}
        onError={handleError}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="auto"
      >
        {currentTrack && <source src={`/music/${currentTrack}`} type="audio/mpeg" />}
        Your browser does not support the audio element.
      </audio>
    </div>
  )
}

