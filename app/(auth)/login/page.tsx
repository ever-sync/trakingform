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

  return (
    <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-2 relative overflow-hidden bg-white">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-[-10%] left-[-5%] w-[700px] h-[700px] bg-gray-300/30 rounded-full mix-blend-multiply filter blur-[120px] opacity-80 animate-in fade-in duration-1000" />
      <div className="absolute bottom-[-5%] left-[15%] w-[800px] h-[800px] bg-gray-400/20 rounded-full mix-blend-multiply filter blur-[140px] opacity-80 animate-in fade-in duration-1000 delay-300" />
      <div className="absolute top-[15%] right-[25%] w-[600px] h-[600px] bg-gray-300/25 rounded-full mix-blend-multiply filter blur-[100px] opacity-80 animate-in fade-in duration-1000 delay-500" />
      <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[1000px] h-[1000px] bg-gray-200/20 rounded-full mix-blend-multiply filter blur-[180px] opacity-40 pointer-events-none" />

      {/* Left Column: Form */}
      <div className="flex items-center justify-center p-8 z-10 relative h-full w-full">
         <div className="w-full max-w-[440px] bg-white/60 backdrop-blur-3xl border border-white/50 p-8 sm:p-10 rounded-[40px] shadow-[0_8px_40px_rgb(0,0,0,0.04)] animate-in slide-in-from-bottom-8 fade-in duration-700">

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
                   <button type="button" className="text-[13px] font-bold text-slate-900 hover:text-primary transition-colors">
                     Esqueceu a senha?
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
      </div>

      {/* Right Column: Hero Visuals */}
      <div className="hidden lg:flex flex-col items-center justify-center p-6 lg:p-12 z-10 relative">
        <div className="w-full h-full max-h-[850px] rounded-[48px] shadow-[0_20px_100px_rgb(0,0,0,0.3)] flex items-center justify-center relative overflow-hidden group bg-[#0a0a1a]">
          {/* Stars background */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Static stars via radial gradients */}
            <div className="absolute inset-0" style={{
              backgroundImage: `
                radial-gradient(1px 1px at 10% 15%, white 100%, transparent),
                radial-gradient(1px 1px at 20% 35%, white 100%, transparent),
                radial-gradient(1.5px 1.5px at 30% 10%, white 100%, transparent),
                radial-gradient(1px 1px at 40% 60%, rgba(255,255,255,0.8) 100%, transparent),
                radial-gradient(1px 1px at 50% 25%, white 100%, transparent),
                radial-gradient(1.5px 1.5px at 60% 80%, white 100%, transparent),
                radial-gradient(1px 1px at 70% 45%, rgba(255,255,255,0.7) 100%, transparent),
                radial-gradient(1px 1px at 80% 70%, white 100%, transparent),
                radial-gradient(1.5px 1.5px at 85% 20%, white 100%, transparent),
                radial-gradient(1px 1px at 90% 55%, rgba(255,255,255,0.9) 100%, transparent),
                radial-gradient(1px 1px at 15% 75%, white 100%, transparent),
                radial-gradient(1px 1px at 25% 90%, rgba(255,255,255,0.6) 100%, transparent),
                radial-gradient(1.5px 1.5px at 35% 50%, white 100%, transparent),
                radial-gradient(1px 1px at 45% 85%, white 100%, transparent),
                radial-gradient(1px 1px at 55% 40%, rgba(255,255,255,0.8) 100%, transparent),
                radial-gradient(1px 1px at 65% 15%, white 100%, transparent),
                radial-gradient(1.5px 1.5px at 75% 95%, white 100%, transparent),
                radial-gradient(1px 1px at 5% 50%, rgba(255,255,255,0.7) 100%, transparent),
                radial-gradient(1px 1px at 95% 35%, white 100%, transparent),
                radial-gradient(1px 1px at 12% 42%, rgba(255,255,255,0.5) 100%, transparent),
                radial-gradient(1.5px 1.5px at 58% 62%, white 100%, transparent),
                radial-gradient(1px 1px at 72% 28%, rgba(255,255,255,0.9) 100%, transparent),
                radial-gradient(1px 1px at 88% 88%, white 100%, transparent),
                radial-gradient(1px 1px at 33% 72%, rgba(255,255,255,0.6) 100%, transparent),
                radial-gradient(1.5px 1.5px at 48% 8%, white 100%, transparent)
              `
            }} />
            {/* Second layer of smaller stars */}
            <div className="absolute inset-0 opacity-60" style={{
              backgroundImage: `
                radial-gradient(0.5px 0.5px at 8% 22%, white 100%, transparent),
                radial-gradient(0.5px 0.5px at 18% 58%, white 100%, transparent),
                radial-gradient(0.5px 0.5px at 28% 82%, white 100%, transparent),
                radial-gradient(0.5px 0.5px at 38% 38%, white 100%, transparent),
                radial-gradient(0.5px 0.5px at 52% 72%, white 100%, transparent),
                radial-gradient(0.5px 0.5px at 62% 5%, white 100%, transparent),
                radial-gradient(0.5px 0.5px at 78% 52%, white 100%, transparent),
                radial-gradient(0.5px 0.5px at 82% 12%, white 100%, transparent),
                radial-gradient(0.5px 0.5px at 92% 78%, white 100%, transparent),
                radial-gradient(0.5px 0.5px at 42% 48%, white 100%, transparent)
              `
            }} />
          </div>

          {/* Subtle glow effects */}
          <div className="absolute w-[400px] h-[400px] bg-white/5 blur-[100px] rounded-full top-1/4 left-1/4" />
          <div className="absolute w-[350px] h-[350px] bg-white/4 blur-[90px] rounded-full bottom-1/4 right-1/4" />
          <div className="absolute w-[300px] h-[300px] bg-white/3 blur-[80px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

          {/* Astronaut floating */}
          <div className="w-[550px] h-[550px] relative animate-float z-20 pointer-events-none drop-shadow-[0_25px_60px_rgba(255,255,255,0.15)]">
            <img
              src="/astronauta.png"
              alt="Floating Astronaut"
              className="w-full h-full object-contain filter saturate-[1.1] contrast-[1.05] drop-shadow-2xl"
            />
          </div>
        </div>
      </div>

    </div>
  )
}
