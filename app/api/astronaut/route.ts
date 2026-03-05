import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export async function GET() {
  try {
    const filePath = path.resolve('C:\\Users\\rapha\\.gemini\\antigravity\\brain\\4154adae-d8f5-427b-a1ad-13e15394d9bb\\cute_astronaut_two_hands_1772677291099.png')
    
    if (!fs.existsSync(filePath)) {
      return new NextResponse(`File does not exist at: ${filePath}`, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    return new NextResponse(fileBuffer, {
      headers: { 
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    })
  } catch (err: unknown) {
    const error = err as Error
    return new NextResponse(`Image not found: ${error.message}`, { status: 404 })
  }
}
