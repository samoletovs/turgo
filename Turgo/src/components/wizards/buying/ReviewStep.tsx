import { motion } from "framer-motion";
import { Eye, Target, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// ──────────────────────────────────────────────
// DONE STATE FEATURE CARDS
// ──────────────────────────────────────────────

export function BuyingDonePanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 grid gap-4 sm:grid-cols-3"
    >
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-full bg-blue-500/10 p-2">
            <Eye className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium">24/7 Monitoring</p>
            <p className="text-xs text-muted-foreground">
              Continuous marketplace scanning
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-full bg-green-500/10 p-2">
            <Target className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Deal Scoring</p>
            <p className="text-xs text-muted-foreground">
              7-factor analysis (0–100)
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-full bg-purple-500/10 p-2">
            <TrendingDown className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Price Tracking</p>
            <p className="text-xs text-muted-foreground">
              Alerts on price drops
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
