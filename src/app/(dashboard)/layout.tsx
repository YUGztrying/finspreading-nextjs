import { Sidebar } from '@/components/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      <Sidebar />
      
      {/* Main Content - fixed margin for static sidebar */}
      <main className="flex-1 overflow-y-auto ml-64">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}