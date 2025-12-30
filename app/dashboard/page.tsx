import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CalculationTree } from "@/components/dashboard/calculation-tree"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calculator, LayoutDashboard, Settings, LogOut, TrendingUp, Users, DollarSign } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card/50 hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-2 font-bold text-xl">
          <Calculator className="h-6 w-6 text-primary" />
          <span>NumCom</span>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Button variant="secondary" className="w-full justify-start gap-2">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <TrendingUp className="h-4 w-4" /> Analytics
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Users className="h-4 w-4" /> Team
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Settings className="h-4 w-4" /> Settings
          </Button>
        </nav>
        <div className="p-4 mt-auto border-t">
          <form action="/auth/logout" method="post">
            <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 space-y-8 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Financial Overview</h1>
            <p className="text-muted-foreground">Manage and track your calculation structures.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium">{user.email}</span>
              <span className="text-xs text-muted-foreground">Premium Account</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">$800,000</div>
              <p className="text-xs text-emerald-500 font-medium">+20.1% from last month</p>
            </CardContent>
          </Card>
          {/* ... other stats ... */}
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <CalculationTree />
          </div>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>AI Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm opacity-90 leading-relaxed">
                Based on your current structures, your marketing spend is 15% higher than industry average for similar
                revenue tiers.
              </p>
              <Button variant="secondary" className="w-full">
                Optimization Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
