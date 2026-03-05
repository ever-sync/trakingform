'use client'

import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { QrCode, Download } from 'lucide-react'

interface QRCodeDialogProps {
  formId: string
  formName: string
  appUrl: string
}

export function QRCodeDialog({ formId, formName, appUrl }: QRCodeDialogProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const embedUrl = `${appUrl}/embed/${formId}`

  function handleDownload() {
    const canvas = canvasRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `qrcode-${formName.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = url
    link.click()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4 mr-2" />
          QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code do formulário</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div ref={canvasRef} className="rounded-xl border p-4 bg-white">
            <QRCodeCanvas
              value={embedUrl}
              size={256}
              level="H"
              marginSize={2}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Escaneie para abrir o formulário. Ideal para imprimir em materiais, stands ou balcões.
          </p>
          <div className="flex gap-2 w-full">
            <Button onClick={handleDownload} className="flex-1 bg-black hover:bg-gray-800">
              <Download className="h-4 w-4 mr-2" />
              Baixar PNG
            </Button>
          </div>
          <div className="w-full">
            <p className="text-xs text-muted-foreground mb-1">URL do formulário:</p>
            <code className="block text-xs bg-gray-100 p-2 rounded break-all">{embedUrl}</code>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
