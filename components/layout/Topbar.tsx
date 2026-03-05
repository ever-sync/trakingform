'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, Settings, Search, Bell, Info, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Sidebar } from '@/components/layout/Sidebar'

interface TopbarProps {
  userEmail?: string
}

export function Topbar({ userEmail }: TopbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : 'U'

  // We can extract a display name from email
  const displayName = userEmail ? userEmail.split('@')[0].split('.')[0] : 'User'
  const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1)

  return (
    <header className="h-16 lg:h-20 bg-transparent flex items-center justify-between px-6 lg:px-12 z-10">
      <div className="flex items-center gap-3">
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-none w-[280px]">
              <SheetTitle className="sr-only">Menu lateral</SheetTitle>
              <Sidebar />
            </SheetContent>
          </Sheet>
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
            Olá, {capitalizedName} <span className="text-yellow-400">👋</span>
          </h1>
          <p className="hidden md:block text-sm text-muted-foreground mt-0.5">Veja o que precisa da sua atenção</p>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        {/* Search Bar */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Pesquisar" 
            className="w-64 pl-9 bg-white border-gray-200 rounded-full h-10 focus-visible:ring-primary shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 lg:gap-2">
          <Button variant="outline" size="icon" className="hidden sm:flex rounded-full bg-white h-9 w-9 lg:h-10 lg:w-10 border-gray-200 shadow-sm text-gray-500 hover:text-gray-900">
            <Settings className="h-4 w-4 lg:h-5 lg:w-5" />
          </Button>
          <Button variant="outline" size="icon" className="hidden sm:flex rounded-full bg-white h-9 w-9 lg:h-10 lg:w-10 border-gray-200 shadow-sm text-gray-500 hover:text-gray-900">
            <Info className="h-4 w-4 lg:h-5 lg:w-5" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full bg-white h-9 w-9 lg:h-10 lg:w-10 border-gray-200 shadow-sm text-gray-500 hover:text-gray-900 relative">
            <Bell className="h-4 w-4 lg:h-5 lg:w-5" />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </Button>
        </div>
        {/* User Dropdown (mobile fallback) */}
        <div className="lg:hidden ml-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border shadow-sm">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

