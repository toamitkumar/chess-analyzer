import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChevronLeft, 
  ChevronRight, 
  SkipBack, 
  SkipForward,
  AlertTriangle,
  CheckCircle2,
  Info,
  Trophy,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Game {
  id: number;
  white_player: string;
  black_player: string;
  result: string;
  date: string;
  event: string;
  white_elo: number;
  black_elo: number;
  moves_count: number;
  pgn_content: string;
}

interface Analysis {
  id: number;
  move_number: number;
  move: string;
  evaluation: number;
  centipawn_loss: number;
  best_move: string;
  is_blunder: number;
}

const GameDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentMove, setCurrentMove] = useState(0);
  const [game, setGame] = useState<Game | null>(null);
  const [analysis, setAnalysis] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const [gameResponse, analysisResponse] = await Promise.all([
          fetch(`http://localhost:3000/api/games/${id}`),
          fetch(`http://localhost:3000/api/games/${id}/analysis`)
        ]);

        if (!gameResponse.ok || !analysisResponse.ok) {
          throw new Error('Failed to fetch game data');
        }

        const gameData = await gameResponse.json();
        const analysisData = await analysisResponse.json();
        
        setGame(gameData);
        setAnalysis(analysisData.analysis || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game');
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [id]);

  const getQualityIcon = (centipawnLoss: number, isBlunder: number) => {
    if (isBlunder) return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (centipawnLoss > 100) return <Info className="h-4 w-4 text-warning" />;
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  };

  const getQualityColor = (centipawnLoss: number, isBlunder: number) => {
    if (isBlunder) return "text-destructive";
    if (centipawnLoss > 100) return "text-warning";
    return "text-success";
  };

  const getResultBadge = (result: string, isWhite: boolean) => {
    if (result === "1-0") return isWhite ? "Win" : "Loss";
    if (result === "0-1") return isWhite ? "Loss" : "Win";
    return "Draw";
  };

  const getResultColor = (result: string, isWhite: boolean) => {
    const gameResult = getResultBadge(result, isWhite);
    if (gameResult === "Win") return "bg-success text-success-foreground";
    if (gameResult === "Loss") return "bg-destructive text-destructive-foreground";
    return "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !game) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-destructive">Error</h2>
          <p className="text-muted-foreground mt-2">{error || 'Game not found'}</p>
          <Button onClick={() => navigate("/games")} className="mt-4">
            Back to Games
          </Button>
        </div>
      </Layout>
    );
  }

  const isPlayerWhite = game.white_player === "AdvaitKumar1213";
  const playerName = isPlayerWhite ? game.white_player : game.black_player;
  const opponentName = isPlayerWhite ? game.black_player : game.white_player;
  const playerElo = isPlayerWhite ? game.white_elo : game.black_elo;
  const opponentElo = isPlayerWhite ? game.black_elo : game.white_elo;

  // Group moves by pairs (white, black)
  const movePairs = [];
  for (let i = 0; i < analysis.length; i += 2) {
    const whiteMove = analysis[i];
    const blackMove = analysis[i + 1];
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: whiteMove,
      black: blackMove
    });
  }

  const playerMoves = analysis.filter((_, idx) => 
    isPlayerWhite ? idx % 2 === 0 : idx % 2 === 1
  );
  
  const blunders = playerMoves.filter(move => move.is_blunder).length;
  const avgCentipawnLoss = playerMoves.length > 0 
    ? Math.round(playerMoves.reduce((sum, move) => sum + move.centipawn_loss, 0) / playerMoves.length)
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/games")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Games
          </Button>
          <div className="flex items-center gap-2">
            <Badge className={getResultColor(game.result, isPlayerWhite)}>
              {getResultBadge(game.result, isPlayerWhite)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Trophy className="h-3 w-3" />
              {game.event}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{playerName} vs {opponentName}</CardTitle>
                    <CardDescription>
                      {game.date} • {game.moves_count} moves
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-foreground">{game.result}</div>
                    <div className="text-xs text-muted-foreground">
                      {playerElo} vs {opponentElo}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="aspect-square w-full rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-border">
                    <div className="text-center space-y-2">
                      <div className="text-6xl">♔</div>
                      <p className="text-sm text-muted-foreground">Interactive chess board</p>
                      <p className="text-xs text-muted-foreground">
                        Move {currentMove + 1} of {analysis.length}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMove(0)}
                      disabled={currentMove === 0}
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMove(Math.max(0, currentMove - 1))}
                      disabled={currentMove === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="mx-4 text-sm font-medium">
                      {currentMove + 1} / {analysis.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMove(Math.min(analysis.length - 1, currentMove + 1))}
                      disabled={currentMove === analysis.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMove(analysis.length - 1)}
                      disabled={currentMove === analysis.length - 1}
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Move List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {movePairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "grid grid-cols-[60px_1fr_1fr] gap-4 rounded-lg border p-3 cursor-pointer transition-colors",
                        Math.floor(currentMove / 2) === idx 
                          ? "border-accent bg-accent/10" 
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => setCurrentMove(idx * 2)}
                    >
                      <div className="font-medium text-muted-foreground">
                        {pair.moveNumber}.
                      </div>
                      {pair.white && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{pair.white.move}</span>
                          {getQualityIcon(pair.white.centipawn_loss, pair.white.is_blunder)}
                          <span className={cn("text-xs", getQualityColor(pair.white.centipawn_loss, pair.white.is_blunder))}>
                            {pair.white.evaluation > 0 ? "+" : ""}{(pair.white.evaluation / 100).toFixed(1)}
                          </span>
                        </div>
                      )}
                      {pair.black && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{pair.black.move}</span>
                          {getQualityIcon(pair.black.centipawn_loss, pair.black.is_blunder)}
                          <span className={cn("text-xs", getQualityColor(pair.black.centipawn_loss, pair.black.is_blunder))}>
                            {pair.black.evaluation > 0 ? "+" : ""}{(pair.black.evaluation / 100).toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="pt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Centipawn Loss</span>
                    <span className="font-semibold">{avgCentipawnLoss}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Blunders</span>
                    <span className="font-semibold text-destructive">{blunders}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Moves</span>
                    <span className="font-semibold">{playerMoves.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Game Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Event</span>
                  <span className="font-semibold">{game.event}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-semibold">{game.date}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Result</span>
                  <span className="font-semibold">{game.result}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Color</span>
                  <span className="font-semibold">{isPlayerWhite ? "White" : "Black"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GameDetail;
