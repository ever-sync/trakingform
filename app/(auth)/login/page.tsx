'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetEmailTouched, setResetEmailTouched] = useState(false)

  function resetForm() {
    setEmail('')
    setPassword('')
    setName('')
    setShowPassword(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success('Conta criada com sucesso! Verifique seu e-mail.')
    setMode('login')
    resetForm()
    setLoading(false)
  }

  async function handleForgotPassword() {
    setResetEmailTouched(true)
    if (!resetEmail.trim()) {
      toast.error('Informe seu e-mail para recuperar a senha.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      toast.error('Informe um e-mail valido.')
      return
    }
    setResetLoading(true)
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Enviamos um link de recuperacao para seu e-mail. Verifique a caixa de entrada e o spam.')
      setShowResetModal(false)
      setResetEmail('')
      setResetEmailTouched(false)
    }
    setResetLoading(false)
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center relative overflow-hidden bg-white px-6 py-12">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-[-10%] left-[-5%] w-[700px] h-[700px] bg-gray-300/30 rounded-full mix-blend-multiply filter blur-[120px] opacity-80 animate-in fade-in duration-1000" />
      <div className="absolute bottom-[-5%] left-[15%] w-[800px] h-[800px] bg-gray-400/20 rounded-full mix-blend-multiply filter blur-[140px] opacity-80 animate-in fade-in duration-1000 delay-300" />
      <div className="absolute top-[15%] right-[25%] w-[600px] h-[600px] bg-gray-300/25 rounded-full mix-blend-multiply filter blur-[100px] opacity-80 animate-in fade-in duration-1000 delay-500" />
      <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[1000px] h-[1000px] bg-gray-200/20 rounded-full mix-blend-multiply filter blur-[180px] opacity-40 pointer-events-none" />

      {/* Form */}
      <div className="z-10 relative w-full max-w-[440px] bg-white/60 backdrop-blur-3xl border border-white/50 p-8 sm:p-10 rounded-[40px] shadow-[0_8px_40px_rgb(0,0,0,0.04)] animate-in slide-in-from-bottom-8 fade-in duration-700">

             {/* Toggle Entrar / Cadastrar */}
             <div className="flex bg-gray-100/80 rounded-2xl p-1 mb-8">
               <button
                 type="button"
                 onClick={() => { setMode('login'); resetForm() }}
                 className={`flex-1 py-3 rounded-xl text-[14px] font-bold transition-all ${
                   mode === 'login'
                     ? 'bg-white text-slate-900 shadow-sm'
                     : 'text-slate-500 hover:text-slate-700'
                 }`}
               >
                 Entrar
               </button>
               <button
                 type="button"
                 onClick={() => { setMode('register'); resetForm() }}
                 className={`flex-1 py-3 rounded-xl text-[14px] font-bold transition-all ${
                   mode === 'register'
                     ? 'bg-white text-slate-900 shadow-sm'
                     : 'text-slate-500 hover:text-slate-700'
                 }`}
               >
                 Cadastrar
               </button>
             </div>

             <div className="mb-8">
               <h1 className="text-[32px] sm:text-[36px] font-extrabold text-slate-900 tracking-tight mb-2 leading-tight">
                 {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
               </h1>
               <p className="text-[15px] font-medium text-slate-500">
                 {mode === 'login'
                   ? 'Entre com suas credenciais para continuar'
                   : 'Preencha os dados abaixo para começar'}
               </p>
             </div>

             {mode === 'login' ? (
               <form onSubmit={handleLogin} className="space-y-5">
                 <div className="space-y-2">
                   <Label htmlFor="email" className="text-[13px] font-bold text-slate-800 ml-1">E-mail</Label>
                   <Input
                     id="email"
                     type="email"
                     placeholder="Seu e-mail"
                     value={email}
                     onChange={e => setEmail(e.target.value)}
                     className="h-14 rounded-2xl border-gray-200 bg-white/80 focus-visible:ring-primary focus-visible:ring-2 shadow-sm px-5 text-[15px] font-medium transition-all"
                     required
                   />
                 </div>

                 <div className="space-y-2 relative">
                   <Label htmlFor="password" className="text-[13px] font-bold text-slate-800 ml-1">Senha</Label>
                   <div className="relative">
                     <Input
                       id="password"
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

                 <div className="flex items-center justify-between mt-2 px-1">
                   <div className="flex items-center gap-2">
                     <Checkbox id="remember" className="border-gray-300 rounded-[4px] data-[state=checked]:bg-black data-[state=checked]:border-black" />
                     <Label htmlFor="remember" className="text-[13px] font-semibold text-slate-500 cursor-pointer">Lembrar de mim</Label>
                   </div>
                   <button
                     type="button"
                     onClick={() => { setShowResetModal(true); setResetEmail(email); setResetEmailTouched(false) }}
                     className="text-[13px] font-bold text-slate-900 hover:text-primary transition-colors disabled:opacity-60"
                     disabled={resetLoading}
                   >
                     {resetLoading ? 'Enviando...' : 'Esqueceu a senha?'}
                   </button>
                 </div>

                 <div className="pt-4 flex flex-col gap-3">
                   <Button type="submit" className="w-full h-14 bg-black hover:bg-slate-800 text-white rounded-2xl font-bold text-[15px] shadow-lg shadow-black/5 hover:shadow-black/10 transition-all active:scale-[0.98]" disabled={loading}>
                     {loading ? 'Entrando...' : 'Entrar'}
                   </Button>

                   <Button type="button" variant="outline" className="w-full h-14 bg-white/80 border-gray-200 text-slate-700 hover:bg-gray-50 rounded-2xl font-bold text-[15px] shadow-sm transition-all active:scale-[0.98] relative">
                     <svg width="20" height="20" viewBox="0 0 24 24" className="absolute left-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                       <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.86C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                       <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.05H2.15C1.43 8.55 1 10.22 1 12s.43 3.45 1.15 4.95l3.69-2.86z" fill="#FBBC05"/>
                       <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.15 7.05l3.69 2.86c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                     </svg>
                     Continuar com Google
                   </Button>
                 </div>
               </form>
             ) : (
               <form onSubmit={handleRegister} className="space-y-5">
                 <div className="space-y-2">
                   <Label htmlFor="name" className="text-[13px] font-bold text-slate-800 ml-1">Nome completo</Label>
                   <Input
                     id="name"
                     type="text"
                     placeholder="Seu nome completo"
                     value={name}
                     onChange={e => setName(e.target.value)}
                     className="h-14 rounded-2xl border-gray-200 bg-white/80 focus-visible:ring-primary focus-visible:ring-2 shadow-sm px-5 text-[15px] font-medium transition-all"
                     required
                   />
                 </div>

                 <div className="space-y-2">
                   <Label htmlFor="reg-email" className="text-[13px] font-bold text-slate-800 ml-1">E-mail</Label>
                   <Input
                     id="reg-email"
                     type="email"
                     placeholder="Seu e-mail"
                     value={email}
                     onChange={e => setEmail(e.target.value)}
                     className="h-14 rounded-2xl border-gray-200 bg-white/80 focus-visible:ring-primary focus-visible:ring-2 shadow-sm px-5 text-[15px] font-medium transition-all"
                     required
                   />
                 </div>

                 <div className="space-y-2 relative">
                   <Label htmlFor="reg-password" className="text-[13px] font-bold text-slate-800 ml-1">Senha</Label>
                   <div className="relative">
                     <Input
                       id="reg-password"
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

                 <div className="pt-4 flex flex-col gap-3">
                   <Button type="submit" className="w-full h-14 bg-black hover:bg-slate-800 text-white rounded-2xl font-bold text-[15px] shadow-lg shadow-black/5 hover:shadow-black/10 transition-all active:scale-[0.98]" disabled={loading}>
                     {loading ? 'Criando conta...' : 'Criar conta'}
                   </Button>

                   <Button type="button" variant="outline" className="w-full h-14 bg-white/80 border-gray-200 text-slate-700 hover:bg-gray-50 rounded-2xl font-bold text-[15px] shadow-sm transition-all active:scale-[0.98] relative">
                     <svg width="20" height="20" viewBox="0 0 24 24" className="absolute left-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                       <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.86C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                       <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.05H2.15C1.43 8.55 1 10.22 1 12s.43 3.45 1.15 4.95l3.69-2.86z" fill="#FBBC05"/>
                       <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.15 7.05l3.69 2.86c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                     </svg>
                     Continuar com Google
                   </Button>
                 </div>
               </form>
             )}
      </div>

      {showResetModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[420px] rounded-3xl bg-white p-6 sm:p-7 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-[20px] font-extrabold text-slate-900">Recuperar senha</h2>
              <p className="text-[13px] text-slate-500 mt-1">Enviaremos um link para redefinir sua senha.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-[13px] font-bold text-slate-800 ml-1">E-mail</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="Seu e-mail"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                onBlur={() => setResetEmailTouched(true)}
                className="h-12 rounded-2xl border-gray-200 bg-white/90 focus-visible:ring-primary focus-visible:ring-2 shadow-sm px-4 text-[14px] font-medium transition-all"
                required
              />
              {resetEmailTouched && resetEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim()) ? (
                <p className="text-[12px] text-red-600 ml-1">E-mail invalido.</p>
              ) : null}
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-2xl"
                onClick={() => { setShowResetModal(false); setResetEmail(''); setResetEmailTouched(false) }}
                disabled={resetLoading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 h-12 bg-black hover:bg-slate-800 text-white rounded-2xl font-bold"
                onClick={handleForgotPassword}
                disabled={resetLoading}
              >
                {resetLoading ? 'Enviando...' : 'Enviar link'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
