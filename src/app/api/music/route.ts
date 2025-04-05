import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    // Path to the music directory
    const musicDir = path.join(process.cwd(), "public", "music")

    // Check if directory exists
    if (!fs.existsSync(musicDir)) {
      return NextResponse.json({ error: "Music directory not found" }, { status: 404 })
    }

    // Read directory and filter for MP3 files
    const files = fs.readdirSync(musicDir)
    const tracks = files.filter((file) => file.endsWith(".mp3"))

    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("Error reading music directory:", error)
    return NextResponse.json({ error: "Failed to read music directory" }, { status: 500 })
  }
}

