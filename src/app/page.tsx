import MusicPlayer from "./player"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="w-full max-w-4xl">
        <MusicPlayer />
      </div>
    </main>
  )
}

