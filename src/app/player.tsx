"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [, setSeekPosition] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const hasInitializedRef = useRef(false)
  const progressIntervalRef = useRef<number | null>(null)
  // 最後のドラッグ位置を追跡するための状態を追加
  const lastDragPositionRef = useRef<number | null>(null)
  // 曲が終了したことを追跡するフラグ
  const trackEndedRef = useRef<boolean>(false)

  // Format time in MM:SS
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // Select a random track from the available tracks
  const selectRandomTrack = useCallback(
    (availableTracks = tracks): string | null => {
      if (availableTracks.length === 0) return null

      const randomIndex = Math.floor(Math.random() * availableTracks.length)
      const newTrack = availableTracks[randomIndex]
      console.log("Selected track:", newTrack)
      setCurrentTrack(newTrack)
      setRetryCount(0) // Reset retry count for new track
      return newTrack
    },
    [tracks],
  )

  // Update progress bar
  const updateProgress = useCallback(() => {
    if (audioRef.current && !isDragging) {
      setCurrentTime(audioRef.current.currentTime)

      // Update duration if it changed (some browsers might update it as they load more of the file)
      if (audioRef.current.duration !== duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration)
      }

      // 曲の終わりに近づいたらログを出力（デバッグ用）
      if (audioRef.current.duration > 0) {
        const timeLeft = audioRef.current.duration - audioRef.current.currentTime
        if (timeLeft < 0.5 && !trackEndedRef.current) {
          console.log("Track almost ended, time left:", timeLeft)
        }
      }
    }
  }, [duration, isDragging])

  // Start progress tracking
  const startProgressTracking = useCallback(() => {
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    // Set up a new interval
    progressIntervalRef.current = window.setInterval(updateProgress, 100) as unknown as number
  }, [updateProgress])

  // Stop progress tracking
  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  // handleProgressBarInteraction 関数を修正して、より正確な位置計算を行うようにします
  const handleProgressBarInteraction = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || !duration || duration <= 0) return

      try {
        // Get mouse/touch position
        let clientX: number

        if ("touches" in e && e.touches && e.touches.length > 0) {
          // Touch event
          clientX = e.touches[0].clientX
        } else if ("clientX" in e) {
          // Mouse event
          clientX = e.clientX
        } else {
          console.error("Could not determine event type or get coordinates")
          return
        }

        // Calculate position relative to progress bar
        const rect = progressBarRef.current.getBoundingClientRect()
        const position = (clientX - rect.left) / rect.width
        const clampedPosition = Math.max(0, Math.min(1, position))
        const newTime = clampedPosition * duration

        // Update time and seek position
        setSeekPosition(clampedPosition)
        setCurrentTime(newTime)

        // 最後のドラッグ位置を保存
        lastDragPositionRef.current = clampedPosition

        // ドラッグ中でなければ（クリックのみ）、すぐにシーク
        if (!isDragging) {
          if (audioRef.current) {
            console.log("Click seeking to:", newTime)
            audioRef.current.currentTime = newTime
          }
        } else {
          // ドラッグ中は視覚的なフィードバックのみ提供（実際のシークはドラッグ終了時に行う）
          console.log("Dragging to:", newTime)
        }
      } catch (err) {
        console.error("Error in progress bar interaction:", err)
      }
    },
    [duration, isDragging],
  )

  // handleProgressBarDown 関数を修正して、ドラッグ終了時に確実に曲の位置を更新するようにします
  const handleProgressBarDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      try {
        setIsDragging(true)
        stopProgressTracking()
        handleProgressBarInteraction(e)

        // Add document-level event listeners for drag
        const handleMove = (e: MouseEvent | TouchEvent) => {
          try {
            e.preventDefault()

            // Convert to the expected event type
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const syntheticEvent: any = {}

            if ("touches" in e && e.touches && e.touches.length > 0) {
              // Touch event
              syntheticEvent.clientX = e.touches[0].clientX
              syntheticEvent.touches = e.touches
            } else if ("clientX" in e) {
              // Mouse event
              syntheticEvent.clientX = e.clientX
            } else {
              console.error("Could not determine event type or get coordinates in move handler")
              return
            }

            handleProgressBarInteraction(syntheticEvent)
          } catch (err) {
            console.error("Error in move handler:", err)
          }
        }

        const handleUp = () => {
          try {
            setIsDragging(false)

            // 重要: 最後のドラッグ位置を使用して曲の位置を設定
            if (audioRef.current && lastDragPositionRef.current !== null) {
              const newTime = lastDragPositionRef.current * duration
              console.log("Final seek to position:", lastDragPositionRef.current, "time:", newTime)

              // 曲の位置を設定
              audioRef.current.currentTime = newTime

              // UIの更新
              setCurrentTime(newTime)
            }

            startProgressTracking()
            setSeekPosition(null)

            // 参照をクリアしない（値は保持しておく）
            // lastDragPositionRef.current = null;

            // Remove document-level event listeners
            document.removeEventListener("mousemove", handleMove)
            document.removeEventListener("touchmove", handleMove)
            document.removeEventListener("mouseup", handleUp)
            document.removeEventListener("touchend", handleUp)
          } catch (err) {
            console.error("Error in up handler:", err)
            // エラーが発生しても必ずリスナーを削除
            document.removeEventListener("mousemove", handleMove)
            document.removeEventListener("touchmove", handleMove)
            document.removeEventListener("mouseup", handleUp)
            document.removeEventListener("touchend", handleUp)
          }
        }

        // Add document-level event listeners
        document.addEventListener("mousemove", handleMove)
        document.addEventListener("touchmove", handleMove, { passive: false })
        document.addEventListener("mouseup", handleUp)
        document.addEventListener("touchend", handleUp)
      } catch (err) {
        console.error("Error in progress bar down handler:", err)
      }
    },
    [duration, handleProgressBarInteraction, startProgressTracking, stopProgressTracking],
  )

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

          // 初回ロード時のみ曲を選択（tracks.length === 0 の条件を追加）
          if (!currentTrack && tracks.length === 0) {
            setTimeout(() => {
              if (typeof selectRandomTrack === "function") {
                selectRandomTrack(data.tracks)
              }
            }, 0)
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
  }, [currentTrack, selectRandomTrack, tracks.length])

  // Initialize audio context when component mounts
  useEffect(() => {
    // Function to create and resume AudioContext
    const initializeAudioContext = async () => {
      try {
        // Create new AudioContext if it doesn't exist
        if (!audioContextRef.current) {
          audioContextRef.current = new (
            window.AudioContext ||
            (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          )()
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

      // Clear progress tracking interval
      stopProgressTracking()
    }
  }, [stopProgressTracking])

  // Start/stop progress tracking based on playback state
  useEffect(() => {
    if (isPlaying) {
      startProgressTracking()
    } else {
      stopProgressTracking()
    }

    return () => {
      stopProgressTracking()
    }
  }, [isPlaying, startProgressTracking, stopProgressTracking])

  // Start playback with user interaction
  const startPlayback = useCallback(async () => {
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

      // Only load the audio if it's not already loaded
      if (audioRef.current.readyState === 0) {
        audioRef.current.load()
      }

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

            // Start tracking progress
            startProgressTracking()
          } catch (err) {
            console.error("Playback error:", err)
            setIsPlaying(false)
            setIsLoading(false)
            setError("Failed to play the track. Please try again.")
          }
        }
      }, 500)
    } catch (err) {
      console.error("Error preparing for playback:", err)
      setIsLoading(false)
      setError("Failed to initialize audio playback. Please reload the page.")
    }
  }, [audioRef, currentTrack, audioContextRef, startProgressTracking])

  // Handle play/pause
  const togglePlayPause = async () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      stopProgressTracking()
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
        startProgressTracking()
      } catch (err) {
        console.error("Playback resume error:", err)
        setIsPlaying(false)
        setIsLoading(false)
        setError("Failed to resume playback. Please try again.")
      }
    }
  }

  // Handle track ended - play next random track
  const handleTrackEnded = useCallback(() => {
    console.log("Track ended event fired, selecting next track")
    trackEndedRef.current = true
    stopProgressTracking()
    setCurrentTime(0)

    // 次の曲を選択
    const nextTrack = selectRandomTrack()
    console.log("Next track selected:", nextTrack)

    // 次の曲を再生開始（これが重要）
    setTimeout(() => {
      startPlayback() // 明示的に再生を開始
    }, 500)
  }, [selectRandomTrack, startPlayback, stopProgressTracking])

  // Skip to next track
  const skipToNext = () => {
    console.log("Skipping to next track")
    stopProgressTracking()
    setCurrentTime(0)
    selectRandomTrack()
  }

  // Handle audio errors
  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.error("Audio error event:", e)

    // Try to get more detailed error information
    const target = e.target as HTMLAudioElement
    console.error("Audio error code:", target.error?.code)
    console.error("Audio error message:", target.error?.message)

    setError(`Error playing the track: ${target.error?.message || "Unknown error"}`)
    stopProgressTracking()

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
    setCurrentTime(0)

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
            startProgressTracking()
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
    setCurrentTime(0)
    stopProgressTracking()

    try {
      // Close existing AudioContext
      if (audioContextRef.current) {
        await audioContextRef.current.close()
        audioContextRef.current = null
      }

      // Create new AudioContext
      audioContextRef.current = new (
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )()
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

  // Handle metadata loaded (get duration)
  const handleMetadataLoaded = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      console.log("Metadata loaded, duration:", audioRef.current.duration)
    }
  }

  // useEffect内の曲変更時の処理も改善します
  // Effect to handle track changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return

    console.log("Track changed to:", currentTrack)
    setIsLoading(true)
    setCurrentTime(0)
    stopProgressTracking()

    // Force reload the audio element
    const currentSrc = `/music/${currentTrack}`
    audioRef.current.innerHTML = ""
    const source = document.createElement("source")
    source.src = currentSrc
    source.type = "audio/mpeg"
    audioRef.current.appendChild(source)

    // Load the new track
    audioRef.current.load()

    // If we were already playing or if this change was triggered by track ending, try to play the new track
    if (isPlaying || trackEndedRef.current) {
      setTimeout(() => {
        if (audioRef.current) {
          console.log("Auto-playing new track after change")
          audioRef.current
            .play()
            .then(() => {
              console.log("New track playback started")
              setIsLoading(false)
              setError(null)
              startProgressTracking()
              trackEndedRef.current = false
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
  }, [currentTrack, isPlaying, startProgressTracking, stopProgressTracking])

  // Check if audio is actually playing
  useEffect(() => {
    if (!isPlaying || !audioRef.current) return

    // Check every second if audio is actually playing
    const interval = setInterval(() => {
      if (audioRef.current && audioRef.current.paused && isPlaying) {
        console.warn("Audio is marked as playing but is actually paused")
        setIsPlaying(false)
        stopProgressTracking()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isPlaying, stopProgressTracking])

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
            startProgressTracking()
          } catch (err) {
            console.error("Failed to resume playback after visibility change:", err)
            setIsPlaying(false)
            stopProgressTracking()
          }
        }
      } else {
        // Page is hidden, pause progress tracking to save resources
        if (isPlaying) {
          stopProgressTracking()
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [isPlaying, startProgressTracking, stopProgressTracking])

  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

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

          {/* Full-width Progress Bar */}
          <div className="absolute bottom-[120px] left-0 right-0 w-full">
            {/* Time Display */}
            <div className="flex justify-between px-4 mb-1 text-white/70 text-xs">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Interactive Progress Bar */}
            <div
              ref={progressBarRef}
              className="w-full h-[3px] bg-white/20 cursor-pointer relative overflow-hidden group"
              onMouseDown={handleProgressBarDown}
              onTouchStart={handleProgressBarDown}
            >
              {/* Progress Fill */}
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white to-transparent"
                style={{ width: `${progressPercentage}%` }}
              />

              {/* Hover Effect - Makes the bar appear thicker on hover */}
              <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-full h-[5px] -mt-1 bg-white/10"></div>
              </div>

              {/* Drag Handle */}
              <div
                className="absolute top-1/2 h-[10px] w-[10px] bg-white rounded-full shadow-lg transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  left: `calc(${progressPercentage}% - 5px)`,
                  display: progressPercentage > 0 ? "block" : "none",
                }}
              />
            </div>
          </div>

          {showStartOverlay && currentTrack && !window.location.href.includes("?robot") && (
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
                      {currentTrack ? currentTrack.replace(".mp3", "").replace(/_/g, " ") : "No track selected"}
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
        onPlay={() => {
          console.log("Audio play event fired")
          setIsPlaying(true)
        }}
        onPause={() => {
          console.log("Audio pause event fired")
          setIsPlaying(false)
        }}
        onLoadedMetadata={handleMetadataLoaded}
        onTimeUpdate={() => {
          // 曲の終わり近くに来たら確認ログを出力（デバッグ用）
          if (audioRef.current && audioRef.current.duration > 0) {
            const timeLeft = audioRef.current.duration - audioRef.current.currentTime
            if (timeLeft < 0.5) {
              console.log("Track almost ended, time left:", timeLeft)
            }
          }
        }}
        preload="auto"
      >
        {currentTrack && <source src={`/music/${currentTrack}`} type="audio/mpeg" />}
        Your browser does not support the audio element.
      </audio>
    </div>
  )
}
