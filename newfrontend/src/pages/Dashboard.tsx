import { useState } from "react";
import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// Sample data
const ratingData = [
  { date: "Jan", rating: 1450, avgCPL: 45 },
  { date: "Feb", rating: 1465, avgCPL: 42 },
  { date: "Mar", rating: 1480, avgCPL: 38 },
  { date: "Apr", rating: 1495, avgCPL: 35 },
  { date: "May", rating: 1510, avgCPL: 33 },
  { date: "Jun", rating: 1525, avgCPL: 30 },
];

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState("30");

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Performance Dashboard</h1>
            <p className="text-muted-foreground">Analyze your chess performance and track improvement</p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Games"
            value={147}
            subtitle="Last 30 days"
            icon={Trophy}
          />
          <StatCard
            title="Win Rate"
            value="58%"
            subtitle="73 wins, 52 losses, 22 draws"
            icon={Target}
            trend={{ value: 5.2, isPositive: true }}
            variant="success"
          />
          <StatCard
            title="Avg Accuracy"
            value="84.3%"
            subtitle="↑ 2.1% from last month"
            icon={TrendingUp}
            trend={{ value: 2.1, isPositive: true }}
          />
          <StatCard
            title="Blunders"
            value={23}
            subtitle="↓ 8 from last month"
            icon={AlertTriangle}
            trend={{ value: 25.8, isPositive: true }}
            variant="warning"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Rating Progression</CardTitle>
              <CardDescription>Your rating trend over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ratingData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis domain={[1400, 1600]} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rating" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-1))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Centipawn Loss</CardTitle>
              <CardDescription>Lower is better - tracking accuracy</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ratingData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis domain={[0, 50]} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgCPL" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Performance by Color</CardTitle>
            <CardDescription>Win rates when playing White vs Black</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">White</span>
                  <span className="text-2xl font-bold text-foreground">62%</span>
                </div>
                <div className="text-xs text-muted-foreground">45 wins, 24 losses, 5 draws</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-success" style={{ width: "62%" }} />
                </div>
              </div>
              
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Black</span>
                  <span className="text-2xl font-bold text-foreground">54%</span>
                </div>
                <div className="text-xs text-muted-foreground">28 wins, 28 losses, 17 draws</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-chart-1" style={{ width: "54%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>Your middlegame accuracy is up 12% in the last 50 games</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>You perform 8% better in longer time controls (15+10)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>Most blunders occur in complex middlegame positions</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
