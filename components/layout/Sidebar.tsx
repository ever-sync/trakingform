'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  { name: 'Ads', href: '/workspace/ads', icon: BarChart3 },
  { name: 'Recovery', href: '/workspace/recovery', icon: Mail },
  { name: 'Compliance', href: '/workspace/compliance', icon: Settings },
  { name: 'Operações', href: '/workspace/operations', icon: BarChart3 },
  { name: 'Plano & Faturamento', href: '/billing', icon: CreditCard },
]

export function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-full w-64 flex-col bg-[#0f0f13] text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-white/10">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">L</span>
        </div>
        <span className="font-semibold text-white">LeadForm</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-indigo-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.name}
          </Link>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        {bottomNavigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-indigo-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  )
}
