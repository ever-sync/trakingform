import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden w-full">
        <Topbar userEmail={user.email} />
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-12 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
