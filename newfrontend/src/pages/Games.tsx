import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Trophy, Crown, Target, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Game {
  id: string;
  white: string;
  black: string;
  result: string;
  date: string;
  opening: string;
  accuracy: {
    white: number;
    black: number;
  };
  blunders: number;
  playerColor: "white" | "black";
  tournament?: string;
}

const sampleGames: Game[] = [
  {
    id: "1",
    white: "You",
    black: "Opponent A",
    result: "1-0",
    date: "2024-01-15",
    opening: "Sicilian Defense, Najdorf",
    accuracy: { white: 89, black: 76 },
    blunders: 2,
    playerColor: "white",
  },
  {
    id: "2",
    white: "Opponent B",
    black: "You",
    result: "0-1",
    date: "2024-01-14",
    opening: "Queen's Gambit Declined",
    accuracy: { white: 72, black: 91 },
    blunders: 1,
    playerColor: "black",
    tournament: "Club Championship 2024",
  },
  {
    id: "3",
    white: "You",
    black: "Opponent C",
    result: "1/2-1/2",
    date: "2024-01-13",
    opening: "Ruy Lopez, Berlin Defense",
    accuracy: { white: 85, black: 87 },
    blunders: 0,
    playerColor: "white",
  },
  {
    id: "4",
    white: "Opponent D",
    black: "You",
    result: "1-0",
    date: "2024-01-12",
    opening: "King's Indian Defense",
    accuracy: { white: 88, black: 68 },
    blunders: 4,
    playerColor: "black",
    tournament: "Club Championship 2024",
  },
];

const Games = () => {
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  const getResultBadge = (result: string, playerColor: string) => {
    const isWin = (result === "1-0" && playerColor === "white") || 
                  (result === "0-1" && playerColor === "black");
    const isDraw = result === "1/2-1/2";
    
    if (isWin) return <Badge className="bg-success text-success-foreground">Win</Badge>;
    if (isDraw) return <Badge variant="secondary">Draw</Badge>;
    return <Badge variant="destructive">Loss</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Game Analysis</h1>
            <p className="text-muted-foreground">Review and analyze your chess games</p>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter games" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              <SelectItem value="wins">Wins Only</SelectItem>
              <SelectItem value="losses">Losses Only</SelectItem>
              <SelectItem value="draws">Draws Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4">
          {sampleGames.map((game) => (
            <Card 
              key={game.id} 
              className="transition-all hover:shadow-lg cursor-pointer"
              onClick={() => navigate(`/games/${game.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      {getResultBadge(game.result, game.playerColor)}
                      {game.tournament && (
                        <Badge variant="outline" className="gap-1">
                          <Trophy className="h-3 w-3" />
                          {game.tournament}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">{game.date}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <Crown className="h-4 w-4 text-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{game.white}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Target className="h-3 w-3" />
                            {game.accuracy.white}% accuracy
                          </div>
                        </div>
                      </div>
                      
                      <span className="text-muted-foreground">vs</span>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                          <Crown className="h-4 w-4 text-secondary-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{game.black}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Target className="h-3 w-3" />
                            {game.accuracy.black}% accuracy
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Opening: <span className="text-foreground">{game.opening}</span>
                      </span>
                      {game.blunders > 0 && (
                        <div className="flex items-center gap-1 text-warning">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{game.blunders} blunder{game.blunders > 1 ? "s" : ""}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Games;
