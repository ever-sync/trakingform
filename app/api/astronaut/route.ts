import { NextResponse } from 'next/server'
import fs from 'fs'

export async function GET() {
  try {
    const filePath = 'C:\\Users\\rapha\\.gemini\\antigravity\\brain\\4154adae-d8f5-427b-a1ad-13e15394d9bb\\floating_astronaut_1772647468670.png'
    const fileBuffer = fs.readFileSync(filePath)
    
    return new NextResponse(fileBuffer, {
      headers: { 
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    })
  } catch {
    return new NextResponse('Image not found', { status: 404 })
  }
}
