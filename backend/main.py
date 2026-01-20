from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Union, List
import json
import io
import zipfile
from pathlib import Path

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://die-league-production.up.railway.app/"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data storage directory
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

PLAYERS_FILE = DATA_DIR / "players.json"
TEAMS_FILE = DATA_DIR / "teams.json"
GAMES_FILE = DATA_DIR / "games.json"
CURRENT_WEEK_FILE = DATA_DIR / "current_week.json"

# In-memory "database"
players = []
teams = []
games = []
current_week: Union[int, str] = 1


def load_data():
    """Load data from JSON files on startup"""
    global players, teams, games
    
    # Load players
    if PLAYERS_FILE.exists():
        try:
            with open(PLAYERS_FILE, 'r') as f:
                players_data = json.load(f)
                # Add default stats for existing players that don't have them
                for p in players_data:
                    if 'points' not in p:
                        p['points'] = 0
                    if 'table_hits' not in p:
                        p['table_hits'] = 0
                    if 'throws' not in p:
                        p['throws'] = 0
                    if 'catches' not in p:
                        p['catches'] = 0
                    if 'drops' not in p:
                        p['drops'] = 0
                    if 'fifas' not in p:
                        p['fifas'] = 0
                players = [Player(**p) for p in players_data]
        except Exception as e:
            print(f"Error loading players: {e}")
            players = []
    else:
        players = []
    
    # Load teams
    if TEAMS_FILE.exists():
        try:
            with open(TEAMS_FILE, 'r') as f:
                teams_data = json.load(f)
                teams = [Team(**t) for t in teams_data]
        except Exception as e:
            print(f"Error loading teams: {e}")
            teams = []
    else:
        teams = []
    
    # Load games
    if GAMES_FILE.exists():
        try:
            with open(GAMES_FILE, 'r') as f:
                games_data = json.load(f)
                games = [Game(**g) for g in games_data]
        except Exception as e:
            print(f"Error loading games: {e}")
            games = []
    else:
        games = []


def save_players():
    """Save players to JSON file"""
    try:
        with open(PLAYERS_FILE, 'w') as f:
            json.dump([p.dict() for p in players], f, indent=2)
    except Exception as e:
        print(f"Error saving players: {e}")


def save_teams():
    """Save teams to JSON file"""
    try:
        with open(TEAMS_FILE, 'w') as f:
            json.dump([t.dict() for t in teams], f, indent=2)
    except Exception as e:
        print(f"Error saving teams: {e}")


def save_games():
    """Save games to JSON file"""
    try:
        with open(GAMES_FILE, 'w') as f:
            json.dump([g.dict() for g in games], f, indent=2)
    except Exception as e:
        print(f"Error saving games: {e}")


def load_current_week():
    """Load current week from file"""
    global current_week
    if CURRENT_WEEK_FILE.exists():
        try:
            with open(CURRENT_WEEK_FILE, 'r') as f:
                data = json.load(f)
                current = data.get("week", 1)
                if isinstance(current, str) and current != "preseason":
                    current = int(current)
                current_week = current
        except Exception as e:
            print(f"Error loading current week: {e}")
            current_week = 1
    else:
        current_week = 1


def save_current_week():
    """Persist current week to file"""
    try:
        with open(CURRENT_WEEK_FILE, 'w') as f:
            json.dump({"week": current_week}, f, indent=2)
    except Exception as e:
        print(f"Error saving current week: {e}")


# Load data on startup
@app.on_event("startup")
async def startup_event():
    load_data()
    load_current_week()
    print(f"Loaded {len(players)} players, {len(teams)} teams, {len(games)} games")


class Player(BaseModel):
    id: Optional[int] = None
    name: str
    rank: int
    points: int = 0
    table_hits: int = 0
    throws: int = 0
    catches: int = 0
    drops: int = 0
    fifas: int = 0


class Team(BaseModel):
    id: Optional[int] = None
    name: str
    player1_id: int
    player2_id: int
    player3_id: int
    wins: int = 0
    losses: int = 0


class Game(BaseModel):
    id: Optional[int] = None
    team_a_id: int
    team_b_id: int
    score_a: int
    score_b: int
    date: Optional[str] = None  # Date in YYYY-MM-DD format
    week: Optional[int] = None  # Optional week number (1-14)


class WeekUpdate(BaseModel):
    week: Union[int, str]


@app.get("/")
def home():
    return {"message": "Beer Die League API running"}


@app.get("/current-week")
def get_current_week():
    return {"week": current_week}


@app.put("/current-week")
def set_current_week(week_data: WeekUpdate):
    global current_week
    week_value = week_data.week
    if isinstance(week_value, str):
        if week_value != "preseason":
            raise HTTPException(status_code=400, detail="Week must be preseason or between 1 and 14")
        current_week = week_value
    else:
        if week_value < 1 or week_value > 14:
            raise HTTPException(status_code=400, detail="Week must be between 1 and 14")
        current_week = week_value
    save_current_week()
    return {"week": current_week}


@app.get("/export-data")
def export_data():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("players.json", json.dumps([p.dict() for p in players], indent=2))
        zip_file.writestr("teams.json", json.dumps([t.dict() for t in teams], indent=2))
        zip_file.writestr("games.json", json.dumps([g.dict() for g in games], indent=2))
        zip_file.writestr("current_week.json", json.dumps({"week": current_week}, indent=2))
    buffer.seek(0)
    headers = {"Content-Disposition": "attachment; filename=beer_die_backup.zip"}
    return StreamingResponse(buffer, media_type="application/zip", headers=headers)


@app.post("/players")
def add_player(p: Player):
    # Generate unique ID if not provided
    if p.id is None:
        # Generate a unique integer ID (using max existing ID + 1, or random if none exist)
        if players:
            p.id = max(player.id for player in players) + 1
        else:
            p.id = 1
    
    players.append(p)
    save_players()
    return p


@app.get("/players")
def list_players():
    # Return players sorted by rank (ascending - lower rank number = better)
    return sorted(players, key=lambda p: p.rank)


@app.put("/players/{player_id}")
def update_player(player_id: int, p: Player):
    for i, player in enumerate(players):
        if player.id == player_id:
            players[i] = p
            save_players()
            return p
    return {"error": "Player not found"}


@app.delete("/players/{player_id}")
def delete_player(player_id: int):
    global players
    players = [p for p in players if p.id != player_id]
    save_players()
    return {"message": "Player deleted"}


@app.post("/teams")
def add_team(t: Team):
    # Generate unique ID if not provided
    if t.id is None:
        if teams:
            t.id = max(team.id for team in teams) + 1
        else:
            t.id = 1
    
    teams.append(t)
    save_teams()
    return t


@app.get("/teams")
def list_teams():
    return teams


@app.put("/teams/{team_id}")
def update_team(team_id: int, t: Team):
    for i, team in enumerate(teams):
        if team.id == team_id:
            teams[i] = t
            save_teams()
            return t
    return {"error": "Team not found"}


@app.delete("/teams/{team_id}")
def delete_team(team_id: int):
    global teams
    teams = [t for t in teams if t.id != team_id]
    save_teams()
    return {"message": "Team deleted"}


@app.post("/games")
def add_game(g: Game):
    # Generate unique ID if not provided
    if g.id is None:
        if games:
            g.id = max(game.id for game in games) + 1
        else:
            g.id = 1
    
    games.append(g)
    save_games()
    return g


@app.get("/games")
def list_games():
    return games


@app.get("/teams/{team_id}/schedule")
def get_team_schedule(team_id: int):
    """Get all games for a specific team"""
    team_games = [g for g in games if g.team_a_id == team_id or g.team_b_id == team_id]
    return team_games


@app.put("/games/{game_id}")
def update_game(game_id: int, g: Game):
    for i, game in enumerate(games):
        if game.id == game_id:
            games[i] = g
            save_games()
            return g
    return {"error": "Game not found"}


@app.delete("/games/{game_id}")
def delete_game(game_id: int):
    global games
    games = [g for g in games if g.id != game_id]
    save_games()
    return {"message": "Game deleted"}


# Match submission model
class GamePlayerStats(BaseModel):
    player_id: int
    points: int = 0
    table_hits: int = 0
    throws: int = 0
    catches: int = 0
    drops: int = 0
    fifas: int = 0


class GameStats(BaseModel):
    team_a_players: List[GamePlayerStats]
    team_b_players: List[GamePlayerStats]


class MatchSubmission(BaseModel):
    team_a_id: int
    team_b_id: int
    num_games: int
    games: List[GameStats]
    winner_id: int  # ID of the winning team


@app.post("/matches")
def submit_match(match: MatchSubmission):
    """Submit a match with all game stats and update player stats and team records"""
    global players, teams
    
    # Validate teams exist
    team_a = next((t for t in teams if t.id == match.team_a_id), None)
    team_b = next((t for t in teams if t.id == match.team_b_id), None)
    
    if not team_a or not team_b:
        raise HTTPException(status_code=404, detail="One or both teams not found")
    
    if match.winner_id not in [match.team_a_id, match.team_b_id]:
        raise HTTPException(status_code=400, detail="Winner ID must be one of the participating teams")
    
    # Aggregate stats for all players across all games
    player_stats_accumulator = {}
    
    # Initialize accumulator with all players from both teams
    for player_id in [team_a.player1_id, team_a.player2_id, team_a.player3_id,
                      team_b.player1_id, team_b.player2_id, team_b.player3_id]:
        player_stats_accumulator[player_id] = {
            'points': 0,
            'table_hits': 0,
            'throws': 0,
            'catches': 0,
            'drops': 0,
            'fifas': 0
        }
    
    # Accumulate stats from all games
    for game in match.games:
        for player_stats in game.team_a_players:
            if player_stats.player_id in player_stats_accumulator:
                player_stats_accumulator[player_stats.player_id]['points'] += player_stats.points
                player_stats_accumulator[player_stats.player_id]['table_hits'] += player_stats.table_hits
                player_stats_accumulator[player_stats.player_id]['throws'] += player_stats.throws
                player_stats_accumulator[player_stats.player_id]['catches'] += player_stats.catches
                player_stats_accumulator[player_stats.player_id]['drops'] += player_stats.drops
                player_stats_accumulator[player_stats.player_id]['fifas'] += player_stats.fifas
        
        for player_stats in game.team_b_players:
            if player_stats.player_id in player_stats_accumulator:
                player_stats_accumulator[player_stats.player_id]['points'] += player_stats.points
                player_stats_accumulator[player_stats.player_id]['table_hits'] += player_stats.table_hits
                player_stats_accumulator[player_stats.player_id]['throws'] += player_stats.throws
                player_stats_accumulator[player_stats.player_id]['catches'] += player_stats.catches
                player_stats_accumulator[player_stats.player_id]['drops'] += player_stats.drops
                player_stats_accumulator[player_stats.player_id]['fifas'] += player_stats.fifas
    
    # Update player stats (add to existing stats)
    for player_id, stats in player_stats_accumulator.items():
        player = next((p for p in players if p.id == player_id), None)
        if player:
            player.points = (player.points or 0) + stats['points']
            player.table_hits = (player.table_hits or 0) + stats['table_hits']
            player.throws = (player.throws or 0) + stats['throws']
            player.catches = (player.catches or 0) + stats['catches']
            player.drops = (player.drops or 0) + stats['drops']
            player.fifas = (player.fifas or 0) + stats['fifas']
    
    # Update team W-L records
    if match.winner_id == match.team_a_id:
        team_a.wins = (team_a.wins or 0) + 1
        team_b.losses = (team_b.losses or 0) + 1
    else:
        team_b.wins = (team_b.wins or 0) + 1
        team_a.losses = (team_a.losses or 0) + 1
    
    # Save all changes
    save_players()
    save_teams()
    
    return {
        "message": "Match submitted successfully",
        "players_updated": len(player_stats_accumulator),
        "teams_updated": 2
    }
