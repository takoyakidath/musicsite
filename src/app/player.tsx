"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Play, Pause, SkipForward, Music4, Volume2, VolumeX, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import AudioVisualizer from "./visualizer"
import { motion, AnimatePresence } from "framer-motion"

export default function MusicPlayer() {
  // 基本的な状態管理
  const [tracks, setTracks] = useState<string[]>([])
  const [currentTrack, setCurrentTrack] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [showStartOverlay, setShowStartOverlay] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // 再生位置関連の状態
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // 参照
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const trackEndedRef = useRef<boolean>(false)

  // 時間をMM:SS形式にフォーマット
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // ランダムなトラックを選択
  const selectRandomTrack = useCallback(
    (availableTracks = tracks): string | null => {
      if (availableTracks.length === 0) return null

      const randomIndex = Math.floor(Math.random() * availableTracks.length)
      const newTrack = availableTracks[randomIndex]
      console.log("Selected track:", newTrack)
      setCurrentTrack(newTrack)
      setRetryCount(0) // リトライカウントをリセット
      return newTrack
    },
    [tracks],
  )

  // プログレスバーの更新
  const updateProgress = useCallback(() => {
    if (audioRef.current && !isDragging) {
      setCurrentTime(audioRef.current.currentTime)

      // 再生時間が変更された場合に更新
      if (audioRef.current.duration !== duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration)
      }
    }
  }, [duration, isDragging])

  // プログレス追跡の開始
  const startProgressTracking = useCallback(() => {
    stopProgressTracking()
    progressIntervalRef.current = window.setInterval(updateProgress, 100) as unknown as number
  }, [updateProgress])

  // プログレス追跡の停止
  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  // プログレスバーの操作
  const handleProgressBarInteraction = useCallback(
    (clientX: number) => {
      if (!progressBarRef.current || !audioRef.current || duration <= 0) return

      // プログレスバーの位置を計算
      const rect = progressBarRef.current.getBoundingClientRect()
      const position = (clientX - rect.left) / rect.width
      const clampedPosition = Math.max(0, Math.min(1, position))
      const newTime = clampedPosition * duration

      // 現在時間を更新
      setCurrentTime(newTime)

      // オーディオの位置を設定
      audioRef.current.currentTime = newTime

      return clampedPosition
    },
    [duration],
  )

  // プログレスバーのクリック処理
  const handleProgressBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      handleProgressBarInteraction(e.clientX)
    },
    [handleProgressBarInteraction],
  )

  // プログレスバーのドラッグ開始処理
  const handleProgressBarMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(true)
      stopProgressTracking()

      // ドラッグ中の処理
      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault()
        handleProgressBarInteraction(e.clientX)
      }

      // ドラッグ終了処理
      const handleMouseUp = (e: MouseEvent) => {
        e.preventDefault()
        setIsDragging(false)
        handleProgressBarInteraction(e.clientX)
        startProgressTracking()

        // イベントリスナーを削除
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      // イベントリスナーを追加
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [handleProgressBarInteraction, startProgressTracking, stopProgressTracking],
  )

  // タッチデバイス用のプログレスバー処理
  const handleProgressBarTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(true)
      stopProgressTracking()

      if (e.touches.length > 0) {
        handleProgressBarInteraction(e.touches[0].clientX)
      }

      // タッチ移動中の処理
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault()
        if (e.touches.length > 0) {
          handleProgressBarInteraction(e.touches[0].clientX)
        }
      }

      // タッチ終了処理
      const handleTouchEnd = (e: TouchEvent) => {
        setIsDragging(false)
        if (e.changedTouches.length > 0) {
          handleProgressBarInteraction(e.changedTouches[0].clientX)
        }
        startProgressTracking()

        // イベントリスナーを削除
        document.removeEventListener("touchmove", handleTouchMove)
        document.removeEventListener("touchend", handleTouchEnd)
      }

      // イベントリスナーを追加
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleTouchEnd)
    },
    [handleProgressBarInteraction, startProgressTracking, stopProgressTracking],
  )

  // 音楽トラックの取得
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

          // 初回ロード時のみ曲を選択
          if (!currentTrack && data.tracks.length > 0) {
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
  }, [currentTrack, selectRandomTrack])

  // AudioContextの初期化
  useEffect(() => {
    // AudioContextの作成と再開
    const initializeAudioContext = async () => {
      try {
        // AudioContextが存在しない場合は作成
        if (!audioContextRef.current) {
          audioContextRef.current = new (
            window.AudioContext ||
            (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          )()
          console.log("AudioContext created with state:", audioContextRef.current.state)
        }

        // AudioContextが一時停止している場合は再開
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume()
          console.log("AudioContext resumed")
        }
      } catch (err) {
        console.error("Failed to initialize AudioContext:", err)
        setError("Failed to initialize audio system. Please reload the page.")
      }
    }

    // ユーザーインタラクションでAudioContextを初期化
    const handleUserInteraction = () => {
      initializeAudioContext()
    }

    // ユーザーインタラクションのイベントリスナーを追加
    window.addEventListener("click", handleUserInteraction)
    window.addEventListener("touchstart", handleUserInteraction)

    // クリーンアップ
    return () => {
      window.removeEventListener("click", handleUserInteraction)
      window.removeEventListener("touchstart", handleUserInteraction)

      // コンポーネントのアンマウント時にAudioContextを閉じる
      if (audioContextRef.current) {
        audioContextRef.current.close().catch((err) => {
          console.error("Error closing AudioContext:", err)
        })
      }

      // プログレス追跡のインターバルをクリア
      stopProgressTracking()
    }
  }, [stopProgressTracking])

  // 再生状態に基づいてプログレス追跡を開始/停止
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

  // 再生開始
  const startPlayback = useCallback(async () => {
    if (!audioRef.current || !currentTrack) {
      console.error("Audio element or track not ready")
      return
    }

    setIsLoading(true)
    console.log("Starting playback for:", currentTrack)

    try {
      // AudioContextが初期化され、再開されていることを確認
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
        console.log("AudioContext resumed before playback")
      }

      // オーディオがまだロードされていない場合はロード
      if (audioRef.current.readyState === 0) {
        audioRef.current.load()
      }

      // オーディオがロードされるのを少し待つ
      setTimeout(async () => {
        if (audioRef.current) {
          try {
            // 再生を試みる
            await audioRef.current.play()
            console.log("Playback started successfully")
            setIsPlaying(true)
            setShowStartOverlay(false)
            setIsLoading(false)
            setError(null)
            startProgressTracking()
          } catch (err) {
            console.error("Playback error:", err)
            setIsPlaying(false)
            setIsLoading(false)
            setError("Failed to play the track. Please try again.")
          }
        }
      }, 300)
    } catch (err) {
      console.error("Error preparing for playback:", err)
      setIsLoading(false)
      setError("Failed to initialize audio playback. Please reload the page.")
    }
  }, [currentTrack, startProgressTracking])

  // 再生/一時停止の切り替え
  const togglePlayPause = async () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      stopProgressTracking()
    } else {
      setIsLoading(true)

      try {
        // AudioContextが再開されていることを確認
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume()
          console.log("AudioContext resumed before resuming playback")
        }

        // 再生を試みる
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

  // トラック終了時の処理 - 次のランダムなトラックを再生
  const handleTrackEnded = useCallback(() => {
    console.log("Track ended, selecting next track")
    trackEndedRef.current = true
    stopProgressTracking()
    setCurrentTime(0)

    // 次のトラックを選択
    const nextTrack = selectRandomTrack()
    console.log("Next track selected:", nextTrack)

    // 次のトラックを再生開始
    setTimeout(() => {
      if (audioRef.current) {
        // AudioContextが一時停止している場合は再開
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume().catch((err) => {
            console.error("Failed to resume AudioContext after track ended:", err)
          })
        }

        // トラックを再生
        audioRef.current
          .play()
          .then(() => {
            console.log("Next track playback started successfully")
            setIsPlaying(true)
            setIsLoading(false)
            setError(null)
            startProgressTracking()
            trackEndedRef.current = false
          })
          .catch((err) => {
            console.error("Failed to play next track:", err)
            startPlayback()
          })
      } else {
        startPlayback()
      }
    }, 300)
  }, [selectRandomTrack, startPlayback, stopProgressTracking])

  // 次のトラックにスキップ
  const skipToNext = () => {
    console.log("Skipping to next track")
    stopProgressTracking()
    setCurrentTime(0)
    selectRandomTrack()
  }

  // オーディオエラーの処理
  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.error("Audio error event:", e)
    const target = e.target as HTMLAudioElement
    console.error("Audio error code:", target.error?.code)
    console.error("Audio error message:", target.error?.message)

    setError(`Error playing the track: ${target.error?.message || "Unknown error"}`)
    stopProgressTracking()

    // リトライ回数が少ない場合は同じトラックを再試行
    if (retryCount < 3) {
      console.log(`Retry attempt ${retryCount + 1}/3`)
      setRetryCount((prev) => prev + 1)

      if (audioRef.current) {
        audioRef.current.load()
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(() => {
              // 再試行が失敗した場合は別のトラックを選択
              selectRandomTrack()
            })
          }
        }, 1000)
      }
    } else {
      // 最大リトライ回数に達した場合は別のトラックを選択
      console.log("Max retries reached, selecting a different track")
      selectRandomTrack()
    }
  }

  // ミュートの切り替え
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted
      setMuted(!muted)
    }
  }

  // 現在のトラックを再試行
  const retryCurrentTrack = async () => {
    if (!audioRef.current || !currentTrack) return

    console.log("Manually retrying current track:", currentTrack)
    setIsLoading(true)
    setError(null)
    setCurrentTime(0)

    try {
      // AudioContextが再開されていることを確認
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
        console.log("AudioContext resumed before retry")
      }

      // オーディオ要素を強制的に再ロード
      audioRef.current.src = `/music/${currentTrack}`
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
      }, 300)
    } catch (err) {
      console.error("Error during retry:", err)
      setIsLoading(false)
      setError("Failed to retry playback. Please reload the page.")
    }
  }

  // オーディオシステムのリセット
  const resetAudioSystem = async () => {
    setIsLoading(true)
    setError(null)
    setCurrentTime(0)
    stopProgressTracking()

    try {
      // 既存のAudioContextを閉じる
      if (audioContextRef.current) {
        await audioContextRef.current.close()
        audioContextRef.current = null
      }

      // 新しいAudioContextを作成
      audioContextRef.current = new (
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )()
      console.log("AudioContext reset with state:", audioContextRef.current.state)

      // オーディオ要素を強制的に再ロード
      if (audioRef.current && currentTrack) {
        audioRef.current.src = `/music/${currentTrack}`
        audioRef.current.load()
      }

      setIsLoading(false)

      // スタートオーバーレイが表示されていない場合は再生を試みる
      if (!showStartOverlay) {
        startPlayback()
      }
    } catch (err) {
      console.error("Failed to reset audio system:", err)
      setIsLoading(false)
      setError("Failed to reset audio system. Please reload the page.")
    }
  }

  // メタデータがロードされたときの処理（再生時間の取得）
  const handleMetadataLoaded = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      console.log("Metadata loaded, duration:", audioRef.current.duration)
    }
  }

  // トラック変更時の処理
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return

    console.log("Track changed to:", currentTrack)
    setIsLoading(true)
    setCurrentTime(0)
    stopProgressTracking()

    // オーディオ要素を強制的に再ロード
    audioRef.current.src = `/music/${currentTrack}`
    audioRef.current.load()

    // 既に再生中だった場合、または曲の終了によるトラック変更の場合は新しいトラックを再生
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
      }, 300)
    } else {
      setIsLoading(false)
    }
  }, [currentTrack, isPlaying, startProgressTracking, stopProgressTracking])

  // オーディオが実際に再生されているかチェック
  useEffect(() => {
    if (!isPlaying || !audioRef.current) return

    // 1秒ごとにオーディオが実際に再生されているかチェック
    const interval = setInterval(() => {
      if (audioRef.current && audioRef.current.paused && isPlaying) {
        console.warn("Audio is marked as playing but is actually paused")
        setIsPlaying(false)
        stopProgressTracking()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isPlaying, stopProgressTracking])

  // 可視性変更（タブ切り替え）の処理
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log("Page became visible, checking audio system")

        // AudioContextが一時停止している場合は再開
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          try {
            await audioContextRef.current.resume()
            console.log("AudioContext resumed after visibility change")
          } catch (err) {
            console.error("Failed to resume AudioContext:", err)
          }
        }

        // 再生中だがオーディオが一時停止している場合は再開を試みる
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
        // ページが非表示の場合、リソースを節約するためにプログレス追跡を一時停止
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

  // 曲の終わりを検出するための時間更新ハンドラ
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && audioRef.current.duration > 0) {
      const timeLeft = audioRef.current.duration - audioRef.current.currentTime

      // 残り時間が0.1秒未満で、まだ終了処理が行われていない場合は次の曲へ
      if (timeLeft < 0.1 && !trackEndedRef.current && audioRef.current.duration > 1) {
        console.log("Force ending track due to end proximity")
        handleTrackEnded()
      }
    }
  }, [handleTrackEnded])

  // 曲の終了イベントを確実に検出するための追加リスナー
  useEffect(() => {
    if (!audioRef.current) return

    const audioElement = audioRef.current
    const endedHandler = () => {
      console.log("ENDED EVENT FIRED DIRECTLY")
      handleTrackEnded()
    }

    audioElement.addEventListener("ended", endedHandler)

    return () => {
      audioElement.removeEventListener("ended", endedHandler)
    }
  }, [audioRef, handleTrackEnded])

  // プログレスパーセンテージの計算
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="space-y-4">
      {/* エラー表示 */}
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
          {/* オーディオビジュアライザー */}
          <div className="h-[70vh] w-full">
            <AudioVisualizer
              audioElement={audioRef.current}
              isPlaying={isPlaying}
              audioContext={audioContextRef.current}
            />
          </div>

          {/* プログレスバー */}
          <div className="absolute bottom-[120px] left-0 right-0 w-full">
            {/* 時間表示 */}
            <div className="flex justify-between px-4 mb-1 text-white/70 text-xs">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* インタラクティブなプログレスバー */}
            <div
              ref={progressBarRef}
              className="w-full h-4 bg-transparent cursor-pointer relative group"
              onClick={handleProgressBarClick}
              onMouseDown={handleProgressBarMouseDown}
              onTouchStart={handleProgressBarTouchStart}
            >
              {/* バーの背景 */}
              <div className="absolute top-1/2 left-0 w-full h-1 -mt-0.5 bg-white/20 rounded-full"></div>

              {/* プログレスフィル */}
              <div
                className="absolute top-1/2 left-0 h-1 -mt-0.5 bg-white rounded-full"
                style={{ width: `${progressPercentage}%` }}
              ></div>

              {/* ドラッグハンドル */}
              <div
                className={`absolute top-1/2 h-3 w-3 bg-white rounded-full shadow-lg transform -translate-y-1/2 transition-opacity ${isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                style={{
                  left: `calc(${progressPercentage}% - 6px)`,
                }}
              ></div>
            </div>
          </div>

          {/* スタートオーバーレイ */}
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

          {/* ローディングオーバーレイ */}
          {isLoading && !showStartOverlay && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <RefreshCw className="h-12 w-12 text-white animate-spin" />
            </div>
          )}

          {/* コントロールオーバーレイ */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between">
              {/* トラック情報 */}
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

              {/* コントロール */}
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

      {/* 非表示のオーディオ要素 */}
      <audio
        ref={audioRef}
        onEnded={() => {
          console.log("onEnded event fired from JSX")
          handleTrackEnded()
        }}
        onError={handleError}
        onPlay={() => {
          console.log("Audio play event fired")
          setIsPlaying(true)
        }}
        onPause={() => {
          console.log("Audio pause event fired")
          setIsPlaying(false)
          stopProgressTracking()
        }}
        onLoadedMetadata={handleMetadataLoaded}
        onTimeUpdate={handleTimeUpdate}
        preload="auto"
      >
        {currentTrack && <source src={`/music/${currentTrack}`} type="audio/mpeg" />}
        Your browser does not support the audio element.
      </audio>
    </div>
  )
}
