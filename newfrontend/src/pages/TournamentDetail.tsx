import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Target,
  AlertTriangle,
  TrendingUp,
  Crown,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { StatCard } from "@/components/StatCard";

interface TournamentGame {
  id: string;
  opponent: string;
  result: string;
  playerColor: "white" | "black";
  accuracy: number;
  blunders: number;
  opening: string;
  round: number;
}

interface Tournament {
  id: string;
  name: string;
  dateRange: string;
  games: TournamentGame[];
}

const sampleTournamentData: Tournament = {
  id: "1",
  name: "Club Championship 2024",
  dateRange: "Jan 10 - Jan 20, 2024",
  games: [
    {
      id: "1",
      opponent: "Opponent A",
      result: "1-0",
      playerColor: "white" as const,
      accuracy: 89,
      blunders: 2,
      opening: "Sicilian Defense",
      round: 1,
    },
    {
      id: "4",
      opponent: "Opponent D",
      result: "0-1",
      playerColor: "black" as const,
      accuracy: 68,
      blunders: 4,
      opening: "King's Indian Defense",
      round: 2,
    },
    {
      id: "5",
      opponent: "Opponent E",
      result: "1-0",
      playerColor: "white" as const,
      accuracy: 91,
      blunders: 1,
      opening: "Queen's Gambit",
      round: 3,
    },
    {
      id: "6",
      opponent: "Opponent F",
      result: "1/2-1/2",
      playerColor: "black" as const,
      accuracy: 85,
      blunders: 1,
      opening: "French Defense",
      round: 4,
    },
    {
      id: "7",
      opponent: "Opponent G",
      result: "1-0",
      playerColor: "white" as const,
      accuracy: 87,
      blunders: 0,
      opening: "English Opening",
      round: 5,
    },
    {
      id: "8",
      opponent: "Opponent H",
      result: "1/2-1/2",
      playerColor: "black" as const,
      accuracy: 82,
      blunders: 0,
      opening: "Caro-Kann Defense",
      round: 6,
    },
    {
      id: "9",
      opponent: "Opponent I",
      result: "1-0",
      playerColor: "white" as const,
      accuracy: 86,
      blunders: 0,
      opening: "Italian Game",
      round: 7,
    },
  ],
};

const TournamentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const tournament = sampleTournamentData;
  const games = tournament?.games || [];
  
  const wins = games.filter(
    (g) =>
      (g.result === "1-0" && g.playerColor === "white") ||
      (g.result === "0-1" && g.playerColor === "black")
  ).length;
  const draws = games.filter((g) => g.result === "1/2-1/2").length;
  const losses = games.length - wins - draws;
  const score = wins + draws * 0.5;
  const avgAccuracy = games.length > 0
    ? games.reduce((sum, g) => sum + g.accuracy, 0) / games.length
    : 0;
  const totalBlunders = games.reduce((sum, g) => sum + g.blunders, 0);

  const getResultBadge = (result: string, playerColor: string) => {
    const isWin =
      (result === "1-0" && playerColor === "white") || (result === "0-1" && playerColor === "black");
    const isDraw = result === "1/2-1/2";

    if (isWin) return <Badge className="bg-success text-success-foreground">Win</Badge>;
    if (isDraw) return <Badge variant="secondary">Draw</Badge>;
    return <Badge variant="destructive">Loss</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tournaments")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">{tournament.name}</h1>
            </div>
            <p className="text-muted-foreground">{tournament.dateRange}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Tournament Score"
            value={`${score} / ${games.length}`}
            icon={Trophy}
            subtitle={`${wins}W ${draws}D ${losses}L`}
          />
          <StatCard
            title="Win Rate"
            value={`${games.length > 0 ? ((wins / games.length) * 100).toFixed(1) : "0.0"}%`}
            icon={TrendingUp}
          />
          <StatCard
            title="Avg Accuracy"
            value={`${avgAccuracy.toFixed(1)}%`}
            icon={Target}
          />
          <StatCard
            title="Total Blunders"
            value={totalBlunders.toString()}
            icon={AlertTriangle}
            variant={totalBlunders > 5 ? "warning" : "default"}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Round-by-Round Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between rounded-lg border p-4 transition-all hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/games/${game.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-bold text-primary">R{game.round}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getResultBadge(game.result, game.playerColor)}
                        <span className="text-sm text-muted-foreground">vs</span>
                        <span className="font-medium">{game.opponent}</span>
                        <div className="flex items-center gap-1">
                          <div
                            className={`h-4 w-4 rounded-full ${
                              game.playerColor === "white" ? "bg-muted" : "bg-secondary"
                            }`}
                          >
                            <Crown className="h-3 w-3 m-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{game.opening}</span>
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {game.accuracy}% accuracy
                        </div>
                        {game.blunders > 0 && (
                          <div className="flex items-center gap-1 text-warning">
                            <AlertTriangle className="h-3 w-3" />
                            {game.blunders} blunder{game.blunders > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TournamentDetail;
