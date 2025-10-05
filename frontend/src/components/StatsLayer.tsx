import { Card } from "@/components/ui/card"
import { TrendingUp, Users, Zap, Shield } from "lucide-react"

export function StatsLayer() {
  return (
    <div className="space-y-6">
      {/* Main Stats Card */}
      <Card className="p-6 bg-card border-border shadow-xl">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-primary">THE MODULAR MONEY MARKET</h2>
          <p className="text-muted-foreground">A NEW ERA OF CAPITAL EFFICIENCY</p>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div className="text-3xl font-bold text-primary">$49,871,114.62</div>
            <div className="text-sm text-muted-foreground">TOTAL VALUE VERIFIED</div>
          </div>
        </div>
      </Card>

      {/* Feature Blocks - LEGO Style */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Best Rates</div>
              <div className="text-sm text-muted-foreground">6 AMMs</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <div className="font-semibold">Fully Onchain</div>
              <div className="text-sm text-muted-foreground">No deps</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Immutable</div>
              <div className="text-sm text-muted-foreground">Secure</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <div className="font-semibold">Community</div>
              <div className="text-sm text-muted-foreground">Driven</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Info Block */}
      <Card className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-2">20/75 Spots Left. U.S. Only.</div>
          <div className="text-primary font-semibold">Early Access Available</div>
        </div>
      </Card>
    </div>
  )
}