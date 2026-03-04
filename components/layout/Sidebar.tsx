'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Users,
  Mail,
  Webhook,
  BarChart3,
  Settings,
  CreditCard,
  MessageCircle,
  HeadphonesIcon,
  LogOut,
  Moon,
  Sun,
  MonitorPlay
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useEffect, useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Formulários', href: '/forms', icon: FileText },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'E-mails', href: '/emails', icon: Mail },
  { name: 'Webhooks', href: '/webhooks', icon: Webhook },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'WhatsApp', href: '/workspace/whatsapp', icon: MessageCircle },
]

const bottomNavigation = [
  { name: 'Workspace', href: '/workspace', icon: Settings },
  { name: 'Routing', href: '/workspace/routing', icon: Users },
  { name: 'Ads', href: '/workspace/ads', icon: MonitorPlay },
  { name: 'Recovery', href: '/workspace/recovery', icon: Mail },
  { name: 'Compliance', href: '/workspace/compliance', icon: Settings },
  { name: 'Faturamento', href: '/billing', icon: CreditCard },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { setTheme, theme } = useTheme()
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [supabase])

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-full w-[280px] flex-col bg-white border-r border-gray-100 p-4">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">L</span>
        </div>
        <span className="font-bold text-xl text-gray-900 tracking-tight">LeadForm</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200',
              isActive(item.href)
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive(item.href) ? "text-white" : "text-gray-400")} />
            {item.name}
          </Link>
        ))}

        <div className="pt-6 pb-2">
          <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Configurações</p>
        </div>

        {bottomNavigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200',
              isActive(item.href)
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive(item.href) ? "text-white" : "text-gray-400")} />
            {item.name}
          </Link>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="mt-4 space-y-1">
        <Link
          href="mailto:suporte@leadform.com"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <HeadphonesIcon className="w-5 h-5 text-gray-400" />
          Support / Help-desk
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
          Logout
        </button>
      </div>

      {/* User Profile Card */}
      <div className="mt-6 bg-primary rounded-2xl p-4 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-10 w-10 border-2 border-white/20">
            <AvatarFallback className="bg-white/20 text-white font-semibold">
              {userEmail ? userEmail.slice(0, 2).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">Admin</p>
            <p className="text-xs text-white/70 truncate">{userEmail || 'Carregando...'}</p>
          </div>
          <button className="p-1 hover:bg-white/10 rounded-md transition-colors">
            <Settings className="w-4 h-4 text-white/70" />
          </button>
        </div>
        
        {/* Theme Toggle inside User Card */}
        <div className="flex items-center bg-black/20 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              "flex-1 flex justify-center items-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all",
              theme !== 'dark' ? "bg-primary text-white shadow-sm" : "text-white/60 hover:text-white"
            )}
          >
            <Sun className="w-3.5 h-3.5" />
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              "flex-1 flex justify-center items-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all",
              theme === 'dark' ? "bg-primary text-white shadow-sm" : "text-white/60 hover:text-white"
            )}
          >
            <Moon className="w-3.5 h-3.5" />
            Dark
          </button>
        </div>
      </div>
    </div>
  )
}
