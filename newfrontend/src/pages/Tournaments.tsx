import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TournamentStats {
  id: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  avgAccuracy: number;
  totalBlunders: number;
  dateRange: string;
}

const sampleTournaments: TournamentStats[] = [
  {
    id: "1",
    name: "Club Championship 2024",
    gamesPlayed: 7,
    wins: 4,
    draws: 2,
    losses: 1,
    avgAccuracy: 84,
    totalBlunders: 8,
    dateRange: "Jan 10 - Jan 20, 2024",
  },
  {
    id: "2",
    name: "Summer Open 2023",
    gamesPlayed: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    avgAccuracy: 81,
    totalBlunders: 6,
    dateRange: "Jul 15 - Jul 18, 2023",
  },
  {
    id: "3",
    name: "Regional Masters",
    gamesPlayed: 6,
    wins: 2,
    draws: 2,
    losses: 2,
    avgAccuracy: 79,
    totalBlunders: 12,
    dateRange: "Mar 5 - Mar 10, 2024",
  },
];

const Tournaments = () => {
  const navigate = useNavigate();

  const calculateWinRate = (wins: number, total: number) => {
    if (!total || total === 0) return "0.0";
    return ((wins / total) * 100).toFixed(1);
  };

  const calculateScore = (wins: number, draws: number) => {
    return wins + draws * 0.5;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tournament Performance</h1>
          <p className="text-muted-foreground">Analyze your performance across tournaments</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tournaments</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sampleTournaments.length}</div>
              <p className="text-xs text-muted-foreground">
                {sampleTournaments.reduce((sum, t) => sum + t.gamesPlayed, 0)} total games
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Win Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(
                  sampleTournaments.reduce(
                    (sum, t) => sum + (t.wins / t.gamesPlayed) * 100,
                    0
                  ) / sampleTournaments.length
                ).toFixed(1)}
                %
              </div>
              <p className="text-xs text-muted-foreground">Across all tournaments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Accuracy</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(
                  sampleTournaments.reduce((sum, t) => sum + t.avgAccuracy, 0) /
                  sampleTournaments.length
                ).toFixed(1)}
                %
              </div>
              <p className="text-xs text-muted-foreground">Average performance</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tournament History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Games</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Win Rate</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Blunders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleTournaments.map((tournament) => (
                  <TableRow
                    key={tournament.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="font-medium">{tournament.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tournament.dateRange}
                    </TableCell>
                    <TableCell>{tournament.gamesPlayed}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {calculateScore(tournament.wins, tournament.draws)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          / {tournament.gamesPlayed}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          parseFloat(calculateWinRate(tournament.wins, tournament.gamesPlayed)) >
                          50
                            ? "default"
                            : "secondary"
                        }
                      >
                        {calculateWinRate(tournament.wins, tournament.gamesPlayed)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        <span>{tournament.avgAccuracy}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tournament.totalBlunders > 0 && (
                        <div className="flex items-center gap-1 text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{tournament.totalBlunders}</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Tournaments;
