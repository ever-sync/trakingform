'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    // Attempt to load session from recovery link
    supabase.auth.getSession().catch(() => {})
  }, [supabase])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    toast.success('Senha atualizada. Você será redirecionado para o login.')
    setRedirecting(true)
    setTimeout(() => {
      router.push('/login')
      router.refresh()
    }, 1500)
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-[440px] bg-white/70 backdrop-blur-2xl border border-white/50 p-8 sm:p-10 rounded-[32px] shadow-[0_8px_40px_rgb(0,0,0,0.04)]">
        <div className="mb-8">
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-slate-900 tracking-tight mb-2 leading-tight">
            Redefinir senha
          </h1>
          <p className="text-[14px] font-medium text-slate-500">
            Defina uma nova senha para sua conta.
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-5">
          <div className="space-y-2 relative">
            <Label htmlFor="new-password" className="text-[13px] font-bold text-slate-800 ml-1">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha de 8 a 16 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-14 rounded-2xl border-gray-200 bg-white/80 focus-visible:ring-primary focus-visible:ring-2 shadow-sm px-5 pr-14 text-[15px] font-medium transition-all"
                minLength={8}
                maxLength={16}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-700 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-[13px] font-bold text-slate-800 ml-1">Confirmar senha</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repita a senha"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="h-14 rounded-2xl border-gray-200 bg-white/80 focus-visible:ring-primary focus-visible:ring-2 shadow-sm px-5 text-[15px] font-medium transition-all"
              minLength={8}
              maxLength={16}
              required
            />
          </div>

          <Button type="submit" className="w-full h-14 bg-black hover:bg-slate-800 text-white rounded-2xl font-bold text-[15px] shadow-lg shadow-black/5 hover:shadow-black/10 transition-all active:scale-[0.98]" disabled={loading || redirecting}>
            {loading ? 'Atualizando...' : (redirecting ? 'Redirecionando...' : 'Atualizar senha')}
          </Button>
        </form>
      </div>
    </div>
  )
}
