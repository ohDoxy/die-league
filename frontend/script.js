const API_BASE_URL = 'http://localhost:8000';
const COMMISSIONER_PASSWORD = 'commissioner2024'; // Change this to your desired password

// Global variables for editing
let editingStandingsTeamId = null;
let scheduleGameTeamId = null;
let scheduleGameTeamName = '';
let editingStatsPlayerId = null;
let currentWeek = 1;

function updateCurrentWeekBanner() {
    const label = document.getElementById('current-week-label');
    const title = document.getElementById('league-title');
    const weekText = currentWeek === 'preseason' ? 'Preseason' : `Week ${currentWeek}`;
    if (label) {
        label.textContent = weekText;
    }
    if (title) {
        title.textContent = `Chi Phi Die League: ${weekText}`;
    }
}

async function fetchCurrentWeek() {
    try {
        const response = await fetch(`${API_BASE_URL}/current-week`);
        const data = await response.json();
        currentWeek = data.week ?? 1;
        updateCurrentWeekBanner();
    } catch (error) {
        console.error('Error fetching current week:', error);
    }
}

// Authentication functions
function isAuthenticated() {
    return localStorage.getItem('commissioner_auth') === 'true';
}

function setAuthenticated(value) {
    if (value) {
        localStorage.setItem('commissioner_auth', 'true');
    } else {
        localStorage.removeItem('commissioner_auth');
    }
    updateAuthUI();
}

function updateAuthUI() {
    const authenticated = isAuthenticated();
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authStatus = document.getElementById('auth-status');
    const addButtons = document.querySelectorAll('.commissioner-only');
    const teamsTab = document.querySelector('.tab-btn[data-tab="teams"]');
    const addMatchTab = document.querySelector('.tab-btn[data-tab="add-match"]');
    
    if (authenticated) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        authStatus.textContent = 'Commissioner Mode';
        addButtons.forEach(btn => {
            btn.classList.add('visible');
            btn.classList.remove('hidden');
        });
        // Show teams tab for commissioner
        if (teamsTab) {
            teamsTab.classList.add('visible');
            teamsTab.classList.remove('hidden');
        }
        // Show add match tab for commissioner
        if (addMatchTab) {
            addMatchTab.classList.add('visible');
            addMatchTab.classList.remove('hidden');
        }
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        authStatus.textContent = 'View Only';
        addButtons.forEach(btn => {
            btn.classList.remove('visible');
            btn.classList.add('hidden');
        });
        // Hide teams tab for viewers
        if (teamsTab) {
            teamsTab.classList.remove('visible');
            teamsTab.classList.add('hidden');
        }
        // Hide add match tab for viewers
        if (addMatchTab) {
            addMatchTab.classList.remove('visible');
            addMatchTab.classList.add('hidden');
        }
    }
    
    // Refresh data to show/hide edit/delete buttons
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const tabName = activeTab.getAttribute('data-tab');
        // Force reload by calling loadData which will re-render with current auth state
        loadData(tabName);
    } else {
        // If no active tab yet, load players (default)
        loadData('players');
    }
}

function openLoginForm() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('password').focus();
}

function closeLoginForm() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('login-error').classList.add('hidden');
}

function openWeekForm() {
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    const form = document.getElementById('week-form');
    const select = document.getElementById('currentWeekSelect');
    if (select) {
        select.value = currentWeek.toString();
    }
    form.classList.remove('hidden');
}

function closeWeekForm() {
    document.getElementById('week-form').classList.add('hidden');
    const weekForm = document.getElementById('weekForm');
    if (weekForm) {
        weekForm.reset();
    }
}

async function downloadBackup() {
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/export-data`);
        if (!response.ok) {
            alert('Error downloading backup');
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `beer_die_backup_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading backup:', error);
        alert('Error downloading backup. Make sure the backend is running.');
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        setAuthenticated(false);
        // Close any open forms
        document.querySelectorAll('.form-modal').forEach(modal => {
            if (!modal.id.includes('login')) {
                modal.classList.add('hidden');
            }
        });
    }
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    
    if (password === COMMISSIONER_PASSWORD) {
        setAuthenticated(true);
        closeLoginForm();
        // Force refresh to show edit/delete buttons
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            const tabName = activeTab.getAttribute('data-tab');
            loadData(tabName);
        }
    } else {
        errorDiv.textContent = 'Incorrect password. Access denied.';
        errorDiv.classList.remove('hidden');
        document.getElementById('password').value = '';
    }
});

async function activateTab(tabName) {
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    
    if (!targetBtn || targetBtn.classList.contains('hidden')) {
        return;
    }
    
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(b => {
        if (!b.classList.contains('hidden')) {
            b.classList.remove('active');
        }
    });
    targetBtn.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const targetContent = document.getElementById(tabName);
    if (targetContent) {
        targetContent.classList.add('active');
    }
    
    await loadData(tabName);
}

// Tab switching functionality
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        activateTab(tabName);
    });
});

// Load all data on page load
window.addEventListener('DOMContentLoaded', async () => {
    await fetchCurrentWeek();
    updateAuthUI(); // This will check auth and load data
    
    // Set up standings record form event listener
    const standingsForm = document.getElementById('standingsRecordForm');
    if (standingsForm) {
        standingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAuthenticated()) {
                alert('Commissioner access required.');
                return;
            }
            
            if (editingStandingsTeamId === null) {
                alert('No team selected');
                return;
            }
            
            // Fetch the team first to get all its data
            try {
                const teamResponse = await fetch(`${API_BASE_URL}/teams`);
                const teams = await teamResponse.json();
                const team = teams.find(t => t.id === editingStandingsTeamId);
                
                if (!team) {
                    alert('Team not found');
                    return;
                }
                
                // Update only wins and losses
                const updatedTeam = {
                    id: team.id,
                    name: team.name,
                    player1_id: team.player1_id,
                    player2_id: team.player2_id,
                    player3_id: team.player3_id,
                    wins: parseInt(document.getElementById('standingsWins').value),
                    losses: parseInt(document.getElementById('standingsLosses').value)
                };
                
                const response = await fetch(`${API_BASE_URL}/teams/${editingStandingsTeamId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedTeam)
                });
                
                if (response.ok) {
                    closeStandingsRecordForm();
                    loadData('standings');
                } else {
                    alert('Error updating team record');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error updating team record. Make sure the backend is running.');
            }
        });
    }
    
    // Set up schedule game form event listener
    const scheduleGameForm = document.getElementById('scheduleGameForm');
    if (scheduleGameForm) {
        scheduleGameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAuthenticated()) {
                alert('Commissioner access required.');
                return;
            }
            
            if (scheduleGameTeamId === null) {
                alert('No team selected');
                return;
            }
            
            try {
                const opponentId = parseInt(document.getElementById('scheduleOpponent').value, 10);
                const week = parseInt(document.getElementById('scheduleWeek').value, 10);
                const location = document.getElementById('scheduleLocation').value;
                
                if (Number.isNaN(week) || week < 1 || week > 14) {
                    alert('Please select a valid week.');
                    return;
                }
                
                // Create a game with no scores (scheduled game)
                const isHome = opponentId === 0 ? true : location === 'home';
                const game = {
                    team_a_id: isHome ? scheduleGameTeamId : opponentId,
                    team_b_id: isHome ? opponentId : scheduleGameTeamId,
                    score_a: 0,
                    score_b: 0,
                    date: null,
                    week: week
                };
                
                const response = await fetch(`${API_BASE_URL}/games`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(game)
                });
                
                if (response.ok) {
                    closeScheduleGameForm();
                    // Refresh the schedule view if we're viewing a team's schedule
                    if (!document.getElementById('team-schedule-view').classList.contains('hidden')) {
                        viewTeamSchedule(scheduleGameTeamId);
                    } else {
                        loadData('schedule');
                    }
                } else {
                    alert('Error adding game');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error adding game. Make sure the backend is running.');
            }
        });
    }
    
    const weekForm = document.getElementById('weekForm');
    if (weekForm) {
        weekForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAuthenticated()) {
                alert('Commissioner access required.');
                return;
            }
            
            const selectValue = document.getElementById('currentWeekSelect').value;
            if (!selectValue) {
                alert('Please select an option.');
                return;
            }
            
            let selectedWeek = selectValue;
            if (selectValue !== 'preseason') {
                selectedWeek = parseInt(selectValue, 10);
                if (Number.isNaN(selectedWeek) || selectedWeek < 1 || selectedWeek > 14) {
                    alert('Please select a valid week.');
                    return;
                }
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/current-week`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ week: selectedWeek })
                });
                
                if (response.ok) {
                    currentWeek = selectedWeek;
                    updateCurrentWeekBanner();
                    closeWeekForm();
                    const activeTab = document.querySelector('.tab-btn.active');
                    if (activeTab && activeTab.getAttribute('data-tab') === 'schedule') {
                        loadData('schedule');
                    }
                } else {
                    alert('Error updating current week');
                }
            } catch (error) {
                console.error('Error updating current week:', error);
                alert('Error updating current week. Make sure the backend is running.');
            }
        });
    }
    
    // Set up stats form event listener
    const statsForm = document.getElementById('statsForm');
    if (statsForm) {
        statsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAuthenticated()) {
                alert('Commissioner access required.');
                return;
            }
            
            if (editingStatsPlayerId === null) {
                alert('No player selected');
                return;
            }
            
            // Fetch the player first to get all its data
            try {
                const playerResponse = await fetch(`${API_BASE_URL}/players`);
                const players = await playerResponse.json();
                const player = players.find(p => p.id === editingStatsPlayerId);
                
                if (!player) {
                    alert('Player not found');
                    return;
                }
                
                // Update player with new stats
                const updatedPlayer = {
                    id: player.id,
                    name: player.name,
                    rank: player.rank,
                    points: parseInt(document.getElementById('statsPoints').value) || 0,
                    table_hits: parseInt(document.getElementById('statsTableHits').value) || 0,
                    throws: parseInt(document.getElementById('statsThrows').value) || 0,
                    catches: parseInt(document.getElementById('statsCatches').value) || 0,
                    drops: parseInt(document.getElementById('statsDrops').value) || 0,
                    fifas: parseInt(document.getElementById('statsFifas').value) || 0
                };
                
                const response = await fetch(`${API_BASE_URL}/players/${editingStatsPlayerId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedPlayer)
                });
                
                if (response.ok) {
                    closeStatsForm();
                    loadData('stats');
                } else {
                    alert('Error updating player stats');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error updating player stats. Make sure the backend is running.');
            }
        });
    }
});

async function loadData(type) {
    try {
        if (type === 'standings') {
            await displayStandings();
        } else if (type === 'schedule') {
            await displaySchedule();
        } else if (type === 'stats') {
            await displayStats();
        } else if (type === 'leaders') {
            await displayLeaders();
        } else if (type === 'add-match') {
            await displayAddMatch();
        } else {
            const response = await fetch(`${API_BASE_URL}/${type}`);
            const data = await response.json();
            
            if (type === 'players') {
                displayPlayers(data);
            } else if (type === 'teams') {
                await displayTeams(data);
            } else if (type === 'games') {
                displayGames(data);
            }
        }
    } catch (error) {
        console.error(`Error loading ${type}:`, error);
        const container = document.getElementById(`${type === 'standings' ? 'standings' : type === 'schedule' ? 'schedule' : type === 'stats' ? 'stats' : type === 'leaders' ? 'leaders' : type === 'add-match' ? 'add-match-form-container' : type}-list`);
        if (container) {
            container.innerHTML = `<div class="empty-state">
                <h3>Error loading ${type}</h3>
                <p>Make sure the backend server is running on ${API_BASE_URL}</p>
            </div>`;
        }
    }
}

function displayPlayers(players) {
    const container = document.getElementById('players-list');
    const authenticated = isAuthenticated();
    
    if (players.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <h3>No players yet</h3>
            <p>Click "Add Player" to get started</p>
        </div>`;
        return;
    }
    
    // Players are already sorted by rank from backend, but sort again to be safe
    const sortedPlayers = [...players].sort((a, b) => a.rank - b.rank);
    
        container.innerHTML = sortedPlayers.map(player => {
        const buttonsHtml = authenticated ? `
            <div class="card-actions">
                <button class="btn btn-secondary btn-small" onclick="viewPlayerStats(${player.id})">View Stats</button>
                <button class="btn btn-secondary btn-small" onclick="editPlayer(${player.id})">Edit</button>
                <button class="btn btn-danger btn-small" onclick="deletePlayer(${player.id})">Delete</button>
            </div>
        ` : `
            <div class="card-actions">
                <button class="btn btn-secondary btn-small" onclick="viewPlayerStats(${player.id})">View Stats</button>
            </div>
        `;
        
        const idHtml = authenticated ? `
            <div class="card-info">
                <strong>ID:</strong> ${player.id}
            </div>
        ` : '';
        
        return `
        <div class="card">
            <div class="card-header player-header">
                <span class="player-rank">${player.rank}</span>
                <div class="card-title player-name">${player.name}</div>
            </div>
            ${idHtml}
            ${buttonsHtml}
        </div>
        `;
    }).join('');
}

async function displayTeams(teams) {
    const container = document.getElementById('teams-list');
    const authenticated = isAuthenticated();
    
    if (teams.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <h3>No teams yet</h3>
            <p>Click "Add Team" to create a team</p>
        </div>`;
        return;
    }
    
    // Fetch all players to map IDs to names
    let playersMap = {};
    try {
        const playersResponse = await fetch(`${API_BASE_URL}/players`);
        const players = await playersResponse.json();
        players.forEach(player => {
            playersMap[player.id] = player.name;
        });
    } catch (error) {
        console.error('Error fetching players:', error);
    }
    
    container.innerHTML = teams.map(team => {
        const buttonsHtml = authenticated ? `
            <div class="card-actions">
                <button class="btn btn-secondary btn-small" onclick="editTeam(${team.id})">Edit</button>
                <button class="btn btn-danger btn-small" onclick="deleteTeam(${team.id})">Delete</button>
            </div>
        ` : '';
        
        const idHtml = authenticated ? `
            <div class="card-info">
                <strong>ID:</strong> ${team.id}
            </div>
        ` : '';
        
        const player1Name = playersMap[team.player1_id] || `Player ID ${team.player1_id}`;
        const player2Name = playersMap[team.player2_id] || `Player ID ${team.player2_id}`;
        const player3Name = playersMap[team.player3_id] || `Player ID ${team.player3_id}`;
        
        return `
        <div class="card team-card">
            <div class="card-header player-header">
                <div class="card-title team-name">${team.name}</div>
            </div>
            ${idHtml}
            <div class="card-info team-info">
                <strong>${player1Name}</strong>, <strong>${player2Name}</strong> & <strong>${player3Name}</strong>
            </div>
            ${buttonsHtml}
        </div>
        `;
    }).join('');
}

async function displayStandings() {
    const container = document.getElementById('standings-list');
    const authenticated = isAuthenticated();
    
    try {
        // Fetch teams and players
        const [teamsResponse, playersResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/teams`),
            fetch(`${API_BASE_URL}/players`)
        ]);
        
        const teams = await teamsResponse.json();
        const players = await playersResponse.json();
        
        // Create player map for names
        const playersMap = {};
        players.forEach(player => {
            playersMap[player.id] = player.name;
        });
        
        // Sort teams by wins (descending), then by losses (ascending)
        const sortedTeams = [...teams].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.losses - b.losses;
        });
        
        if (sortedTeams.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <h3>No teams yet</h3>
                <p>Standings will appear here once teams are added</p>
            </div>`;
            return;
        }
        
        container.innerHTML = sortedTeams.map((team, index) => {
            const player1Name = playersMap[team.player1_id] || `Player ID ${team.player1_id}`;
            const player2Name = playersMap[team.player2_id] || `Player ID ${team.player2_id}`;
            const player3Name = playersMap[team.player3_id] || `Player ID ${team.player3_id}`;
            
            const editButton = authenticated ? `
                <div class="card-actions">
                    <button class="btn btn-secondary btn-small" onclick="editStandingsRecord(${team.id})">Edit</button>
                </div>
            ` : '';
            
            return `
            <div class="card team-card standings-card">
                <div class="standings-clickable" onclick="viewScheduleFromStandings(${team.id})">
                    <div class="card-header player-header standings-header">
                        <span class="standings-rank">${index + 1}</span>
                        <div class="standings-middle">
                            <div class="card-title team-name">${team.name}</div>
                            <div class="card-info team-info">
                                <strong>${player1Name}</strong>, <strong>${player2Name}</strong> & <strong>${player3Name}</strong>
                            </div>
                        </div>
                        <span class="standings-record">${team.wins || 0}-${team.losses || 0}</span>
                    </div>
                </div>
                ${editButton}
            </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading standings:', error);
        container.innerHTML = `<div class="empty-state">
            <h3>Error loading standings</h3>
            <p>Make sure the backend server is running on ${API_BASE_URL}</p>
        </div>`;
    }
}

async function viewScheduleFromStandings(teamId) {
    await activateTab('schedule');
    await viewTeamSchedule(teamId);
}

async function displaySchedule() {
    const container = document.getElementById('schedule-list');
    const authenticated = isAuthenticated();
    
    // Ensure we start from the team list view whenever schedule is reloaded
    backToScheduleList();
    
    try {
        const [teamsResponse, gamesResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/teams`),
            fetch(`${API_BASE_URL}/games`)
        ]);
        const teams = await teamsResponse.json();
        const games = await gamesResponse.json();
        
        if (teams.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <h3>No teams yet</h3>
                <p>Teams will appear here once they are added</p>
            </div>`;
            return;
        }
        
        // Sort teams alphabetically by name
        const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
        const teamsMap = {};
        teams.forEach(team => {
            teamsMap[team.id] = team.name;
        });
        const gamesThisWeek = games.filter(game => game.week === currentWeek);
        
        container.innerHTML = sortedTeams.map(team => {
            const viewButton = `
                <button class="btn btn-primary btn-small" onclick="viewTeamSchedule(${team.id})">View Schedule</button>
            `;
            const addButton = authenticated ? `
                <button class="btn btn-secondary btn-small" onclick="openScheduleGameForm(${team.id}, '${team.name}')">Add Game</button>
            ` : '';
            
            const thisWeekGame = gamesThisWeek.find(game => game.team_a_id === team.id || game.team_b_id === team.id);
            let thisWeekText = 'This Week: No game scheduled';
            if (thisWeekGame) {
                const isHome = thisWeekGame.team_a_id === team.id;
                const opponentId = isHome ? thisWeekGame.team_b_id : thisWeekGame.team_a_id;
                if (opponentId === 0) {
                    thisWeekText = 'This Week: BYE';
                } else {
                    const opponentName = teamsMap[opponentId] || `Team ${opponentId}`;
                    thisWeekText = `This Week: ${isHome ? 'vs' : '@'} ${opponentName}`;
                }
            }
            
            return `
            <div class="card team-card schedule-team-card">
                <div class="card-header player-header schedule-card-header">
                    <div class="card-title team-name">${team.name}</div>
                    <div class="schedule-card-actions">
                        ${viewButton}
                        ${addButton}
                    </div>
                </div>
                <div class="schedule-this-week">${thisWeekText}</div>
            </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading schedule:', error);
        container.innerHTML = `<div class="empty-state">
            <h3>Error loading schedule</h3>
            <p>Make sure the backend server is running on ${API_BASE_URL}</p>
        </div>`;
    }
}

async function viewTeamSchedule(teamId) {
    const listView = document.getElementById('schedule-list');
    const scheduleView = document.getElementById('team-schedule-view');
    const gamesContainer = document.getElementById('team-schedule-games');
    const titleElement = document.getElementById('team-schedule-title');
    const authenticated = isAuthenticated();
    
    try {
        // Fetch team info and schedule
        const [teamsResponse, scheduleResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/teams`),
            fetch(`${API_BASE_URL}/teams/${teamId}/schedule`)
        ]);
        
        const teams = await teamsResponse.json();
        const team = teams.find(t => t.id === teamId);
        const schedule = await scheduleResponse.json();
        
        if (!team) {
            alert('Team not found');
            return;
        }
        
        titleElement.textContent = `${team.name} Schedule`;
        
        // Sort games by week (if present) or date
        const sortedGames = [...schedule].sort((a, b) => {
            const weekA = a.week ?? 0;
            const weekB = b.week ?? 0;
            
            if (weekA !== weekB) {
                if (weekA === 0) return 1;
                if (weekB === 0) return -1;
                return weekA - weekB;
            }
            
            const dateA = a.date || '';
            const dateB = b.date || '';
            return dateA.localeCompare(dateB);
        });
        
        if (sortedGames.length === 0) {
            gamesContainer.innerHTML = `<div class="empty-state">
                <h3>No games scheduled</h3>
                <p>This team doesn't have any games scheduled yet</p>
            </div>`;
        } else {
            // Get all teams for opponent names
            const teamsMap = {};
            teams.forEach(t => {
                teamsMap[t.id] = t.name;
            });
            
            gamesContainer.innerHTML = sortedGames.map(game => {
                const isHome = game.team_a_id === teamId;
                const opponentId = isHome ? game.team_b_id : game.team_a_id;
                const opponentName = opponentId === 0 ? 'BYE' : (teamsMap[opponentId] || `Team ${opponentId}`);
                const scheduleLabel = game.week ? `Week ${game.week}` : (game.date ? new Date(game.date).toLocaleDateString() : 'Week TBD');
                const opponentDisplay = opponentId === 0 ? 'BYE' : (isHome ? `vs ${opponentName}` : `@ ${opponentName}`);
                const actionsHtml = authenticated ? `
                    <div class="schedule-actions">
                        <button class="btn btn-danger btn-small" onclick="deleteScheduledGame(${game.id}, ${teamId})">Remove</button>
                    </div>
                ` : '';
                
                return `
                <div class="card schedule-game-card">
                    <div class="schedule-game-info">
                        <div class="schedule-date">${scheduleLabel}</div>
                        <div class="schedule-opponent">${opponentDisplay}</div>
                    </div>
                    ${actionsHtml}
                </div>
                `;
            }).join('');
        }
        
        listView.classList.add('hidden');
        scheduleView.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading team schedule:', error);
        alert('Error loading team schedule');
    }
}

function backToScheduleList() {
    document.getElementById('schedule-list').classList.remove('hidden');
    document.getElementById('team-schedule-view').classList.add('hidden');
}

function openScheduleGameForm(teamId, teamName) {
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    scheduleGameTeamId = teamId;
    scheduleGameTeamName = teamName;
    document.getElementById('schedule-form-title').textContent = `Add Game for ${teamName}`;
    document.getElementById('scheduleWeek').value = '';
    document.getElementById('scheduleOpponent').value = '';
    document.getElementById('scheduleLocation').value = 'home';
    document.getElementById('schedule-game-form').classList.remove('hidden');
}

function closeScheduleGameForm() {
    document.getElementById('schedule-game-form').classList.add('hidden');
    document.getElementById('scheduleGameForm').reset();
    scheduleGameTeamId = null;
    scheduleGameTeamName = '';
}

async function deleteScheduledGame(gameId, teamId) {
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    if (!confirm('Remove this scheduled game?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/games/${gameId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            viewTeamSchedule(teamId);
        } else {
            alert('Error removing game');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error removing game. Make sure the backend is running.');
    }
}

function displayGames(games) {
    const container = document.getElementById('games-list');
    const authenticated = isAuthenticated();
    
    if (games.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <h3>No games yet</h3>
            <p>Click "Add Game" to record a game</p>
        </div>`;
        return;
    }
    
    container.innerHTML = games.map(game => {
        const teamAWins = game.score_a > game.score_b;
        const teamBWins = game.score_b > game.score_a;
        
        const buttonsHtml = authenticated ? `
            <div class="card-actions">
                <button class="btn btn-secondary btn-small" onclick="editGame(${game.id})">Edit</button>
                <button class="btn btn-danger btn-small" onclick="deleteGame(${game.id})">Delete</button>
            </div>
        ` : '';
        
        return `
            <div class="card game-card">
                <div class="card-header">
                    <div class="card-title">Game ${game.id}</div>
                    <span class="card-badge badge-primary">Game</span>
                </div>
                <div class="game-score">
                    <div class="team-score">
                        <div class="team-score-label">Team A</div>
                        <div class="team-score-value ${teamAWins ? 'winner' : ''}">${game.score_a}</div>
                    </div>
                    <div class="score-separator">-</div>
                    <div class="team-score">
                        <div class="team-score-label">Team B</div>
                        <div class="team-score-value ${teamBWins ? 'winner' : ''}">${game.score_b}</div>
                    </div>
                </div>
                <div class="card-info">
                    <strong>Team A ID:</strong> ${game.team_a_id}
                </div>
                <div class="card-info">
                    <strong>Team B ID:</strong> ${game.team_b_id}
                </div>
                ${buttonsHtml}
            </div>
        `;
    }).join('');
}

// Player form functions
let editingPlayerId = null;

function openPlayerForm(player = null) {
    if (!isAuthenticated()) {
        alert('Commissioner access required. Please login to add players.');
        openLoginForm();
        return;
    }
    
    const form = document.getElementById('player-form');
    const formTitle = form.querySelector('h3');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (player) {
        // Edit mode
        editingPlayerId = player.id;
        formTitle.textContent = 'Edit Player';
        submitBtn.textContent = 'Update Player';
        document.getElementById('playerName').value = player.name;
        document.getElementById('playerRank').value = player.rank;
    } else {
        // Add mode
        editingPlayerId = null;
        formTitle.textContent = 'Add New Player';
        submitBtn.textContent = 'Add Player';
        document.getElementById('playerName').value = '';
        document.getElementById('playerRank').value = '';
    }
    
    form.classList.remove('hidden');
}

function editPlayer(playerId) {
    fetch(`${API_BASE_URL}/players`)
        .then(res => res.json())
        .then(players => {
            const player = players.find(p => p.id === playerId);
            if (player) {
                openPlayerForm(player);
            }
        });
}

function closePlayerForm() {
    document.getElementById('player-form').classList.add('hidden');
    document.getElementById('playerForm').reset();
    editingPlayerId = null;
}

document.getElementById('playerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    const player = {
        name: document.getElementById('playerName').value,
        rank: parseInt(document.getElementById('playerRank').value)
    };
    
    // Only include ID if editing
    if (editingPlayerId !== null) {
        player.id = editingPlayerId;
    }
    
    try {
        const url = editingPlayerId 
            ? `${API_BASE_URL}/players/${editingPlayerId}`
            : `${API_BASE_URL}/players`;
        const method = editingPlayerId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(player)
        });
        
        if (response.ok) {
            closePlayerForm();
            loadData('players');
        } else {
            alert(editingPlayerId ? 'Error updating player' : 'Error adding player');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`Error ${editingPlayerId ? 'updating' : 'adding'} player. Make sure the backend is running.`);
    }
});

async function deletePlayer(playerId) {
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this player?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/players/${playerId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadData('players');
        } else {
            alert('Error deleting player');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting player. Make sure the backend is running.');
    }
}

// Team form functions
let editingTeamId = null;

function openTeamForm(team = null) {
    if (!isAuthenticated()) {
        alert('Commissioner access required. Please login to add teams.');
        openLoginForm();
        return;
    }
    
    const form = document.getElementById('team-form');
    const formTitle = form.querySelector('h3');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (team) {
        editingTeamId = team.id;
        formTitle.textContent = 'Edit Team';
        submitBtn.textContent = 'Update Team';
        document.getElementById('teamName').value = team.name;
        document.getElementById('teamPlayer1').value = team.player1_id;
        document.getElementById('teamPlayer2').value = team.player2_id;
        document.getElementById('teamPlayer3').value = team.player3_id;
    } else {
        editingTeamId = null;
        formTitle.textContent = 'Add New Team';
        submitBtn.textContent = 'Add Team';
        document.getElementById('teamName').value = '';
        document.getElementById('teamPlayer1').value = '';
        document.getElementById('teamPlayer2').value = '';
        document.getElementById('teamPlayer3').value = '';
    }
    
    form.classList.remove('hidden');
}

function editTeam(teamId) {
    fetch(`${API_BASE_URL}/teams`)
        .then(res => res.json())
        .then(teams => {
            const team = teams.find(t => t.id === teamId);
            if (team) {
                openTeamForm(team);
            }
        });
}

function closeTeamForm() {
    document.getElementById('team-form').classList.add('hidden');
    document.getElementById('teamForm').reset();
    editingTeamId = null;
}

document.getElementById('teamForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    const team = {
        name: document.getElementById('teamName').value,
        player1_id: parseInt(document.getElementById('teamPlayer1').value),
        player2_id: parseInt(document.getElementById('teamPlayer2').value),
        player3_id: parseInt(document.getElementById('teamPlayer3').value)
    };
    
    // If editing, preserve wins/losses
    if (editingTeamId !== null) {
        team.id = editingTeamId;
        try {
            const teamResponse = await fetch(`${API_BASE_URL}/teams`);
            const teams = await teamResponse.json();
            const existingTeam = teams.find(t => t.id === editingTeamId);
            if (existingTeam) {
                team.wins = existingTeam.wins || 0;
                team.losses = existingTeam.losses || 0;
            }
        } catch (error) {
            console.error('Error fetching team:', error);
        }
    }
    
    try {
        const url = editingTeamId 
            ? `${API_BASE_URL}/teams/${editingTeamId}`
            : `${API_BASE_URL}/teams`;
        const method = editingTeamId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(team)
        });
        
        if (response.ok) {
            closeTeamForm();
            loadData('teams');
            if (editingTeamId) {
                loadData('standings'); // Refresh standings if editing
            }
        } else {
            alert(editingTeamId ? 'Error updating team' : 'Error adding team');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`Error ${editingTeamId ? 'updating' : 'adding'} team. Make sure the backend is running.`);
    }
});

async function deleteTeam(teamId) {
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this team?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadData('teams');
        } else {
            alert('Error deleting team');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting team. Make sure the backend is running.');
    }
}

// Game form functions
let editingGameId = null;

function openGameForm(game = null) {
    if (!isAuthenticated()) {
        alert('Commissioner access required. Please login to add games.');
        openLoginForm();
        return;
    }
    
    const form = document.getElementById('game-form');
    const formTitle = form.querySelector('h3');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (game) {
        editingGameId = game.id;
        formTitle.textContent = 'Edit Game';
        submitBtn.textContent = 'Update Game';
        document.getElementById('gameTeamA').value = game.team_a_id;
        document.getElementById('gameTeamB').value = game.team_b_id;
        document.getElementById('gameScoreA').value = game.score_a;
        document.getElementById('gameScoreB').value = game.score_b;
    } else {
        editingGameId = null;
        formTitle.textContent = 'Add New Game';
        submitBtn.textContent = 'Add Game';
        document.getElementById('gameTeamA').value = '';
        document.getElementById('gameTeamB').value = '';
        document.getElementById('gameScoreA').value = '';
        document.getElementById('gameScoreB').value = '';
    }
    
    form.classList.remove('hidden');
}

function editGame(gameId) {
    fetch(`${API_BASE_URL}/games`)
        .then(res => res.json())
        .then(games => {
            const game = games.find(g => g.id === gameId);
            if (game) {
                openGameForm(game);
            }
        });
}

function closeGameForm() {
    document.getElementById('game-form').classList.add('hidden');
    document.getElementById('gameForm').reset();
    editingGameId = null;
}

const gameFormElement = document.getElementById('gameForm');
if (gameFormElement) {
    gameFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isAuthenticated()) {
            alert('Commissioner access required.');
            return;
        }
        
        const game = {
            team_a_id: parseInt(document.getElementById('gameTeamA').value),
            team_b_id: parseInt(document.getElementById('gameTeamB').value),
            score_a: parseInt(document.getElementById('gameScoreA').value),
            score_b: parseInt(document.getElementById('gameScoreB').value)
        };
        
        // Only include ID if editing
        if (editingGameId !== null) {
            game.id = editingGameId;
        }
        
        try {
            const url = editingGameId 
                ? `${API_BASE_URL}/games/${editingGameId}`
                : `${API_BASE_URL}/games`;
            const method = editingGameId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(game)
            });
            
            if (response.ok) {
                closeGameForm();
                loadData('games');
            } else {
                alert(editingGameId ? 'Error updating game' : 'Error adding game');
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`Error ${editingGameId ? 'updating' : 'adding'} game. Make sure the backend is running.`);
        }
    });
}

async function deleteGame(gameId) {
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this game?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/games/${gameId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadData('games');
        } else {
            alert('Error deleting game');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting game. Make sure the backend is running.');
    }
}

// Standings record editing functions
function editStandingsRecord(teamId) {
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    fetch(`${API_BASE_URL}/teams`)
        .then(res => res.json())
        .then(teams => {
            const team = teams.find(t => t.id === teamId);
            if (team) {
                editingStandingsTeamId = teamId;
                document.getElementById('standings-form-title').textContent = `Edit ${team.name} Record`;
                document.getElementById('standingsWins').value = team.wins || 0;
                document.getElementById('standingsLosses').value = team.losses || 0;
                const form = document.getElementById('standings-record-form');
                form.classList.remove('hidden');
            } else {
                alert('Team not found');
            }
        })
        .catch(error => {
            console.error('Error fetching team:', error);
            alert('Error loading team data');
        });
}

function closeStandingsRecordForm() {
    document.getElementById('standings-record-form').classList.add('hidden');
    document.getElementById('standingsRecordForm').reset();
    editingStandingsTeamId = null;
}

// Player stats view functions (for viewing from player rankings)
async function viewPlayerStats(playerId) {
    try {
        const response = await fetch(`${API_BASE_URL}/players`);
        const players = await response.json();
        const player = players.find(p => p.id === playerId);
        
        if (!player) {
            alert('Player not found');
            return;
        }
        
        // Calculate derived stats
        const points = player.points || 0;
        const throws = player.throws || 0;
        const catches = player.catches || 0;
        const drops = player.drops || 0;
        
        // Points per throw (handle division by zero)
        const pointsPerThrow = throws > 0 ? (points / throws).toFixed(3) : '0.000';
        
        // Catch % (handle division by zero)
        const totalAttempts = catches + drops;
        const catchPercentage = totalAttempts > 0 ? ((catches / totalAttempts) * 100).toFixed(1) : '0.0';
        
        // Set title and content
        document.getElementById('player-stats-view-title').textContent = `${player.name} - Statistics`;
        const statsContent = document.getElementById('player-stats-view-content');
        
        statsContent.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Points</span>
                <span class="stat-value">${points}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Table Hits</span>
                <span class="stat-value">${player.table_hits || 0}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Throws</span>
                <span class="stat-value">${throws}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Catches</span>
                <span class="stat-value">${catches}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Drops</span>
                <span class="stat-value">${drops}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Fifas</span>
                <span class="stat-value">${player.fifas || 0}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Points per Throw</span>
                <span class="stat-value">${pointsPerThrow}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Catch %</span>
                <span class="stat-value">${catchPercentage}%</span>
            </div>
        `;
        
        // Show modal
        document.getElementById('player-stats-view').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading player stats:', error);
        alert('Error loading player stats');
    }
}

function closePlayerStatsView() {
    document.getElementById('player-stats-view').classList.add('hidden');
}

// Stats display and editing functions
async function displayStats() {
    const container = document.getElementById('stats-list');
    const authenticated = isAuthenticated();
    
    try {
        // Fetch both players and teams
        const [playersResponse, teamsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/players`),
            fetch(`${API_BASE_URL}/teams`)
        ]);
        
        const players = await playersResponse.json();
        const teams = await teamsResponse.json();
        
        if (players.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <h3>No players yet</h3>
                <p>Add players to see their statistics</p>
            </div>`;
            return;
        }
        
        // Create a mapping of player ID to team
        const playerToTeamMap = new Map();
        teams.forEach(team => {
            if (team.player1_id) playerToTeamMap.set(team.player1_id, team);
            if (team.player2_id) playerToTeamMap.set(team.player2_id, team);
            if (team.player3_id) playerToTeamMap.set(team.player3_id, team);
        });
        
        // Group players by team
        const playersByTeam = new Map();
        const unassignedPlayers = [];
        
        players.forEach(player => {
            const team = playerToTeamMap.get(player.id);
            if (team) {
                if (!playersByTeam.has(team.id)) {
                    playersByTeam.set(team.id, {
                        team: team,
                        players: []
                    });
                }
                playersByTeam.get(team.id).players.push(player);
            } else {
                unassignedPlayers.push(player);
            }
        });
        
        // Sort players within each team by name
        playersByTeam.forEach(group => {
            group.players.sort((a, b) => a.name.localeCompare(b.name));
        });
        unassignedPlayers.sort((a, b) => a.name.localeCompare(b.name));
        
        // Sort teams by name
        const sortedTeams = Array.from(playersByTeam.values()).sort((a, b) => 
            a.team.name.localeCompare(b.team.name)
        );
        
        // Generate HTML with team grouping
        let html = '';
        
        // Helper function to render a player's stats card
        const renderPlayerCard = (player) => {
            const editButton = authenticated ? `
                <button class="btn btn-secondary btn-small" onclick="editStats(${player.id})">Edit Stats</button>
            ` : '';
            
            // Calculate derived stats
            const points = player.points || 0;
            const throws = player.throws || 0;
            const catches = player.catches || 0;
            const drops = player.drops || 0;
            
            // Points per throw (handle division by zero)
            const pointsPerThrow = throws > 0 ? (points / throws).toFixed(3) : '0.000';
            
            // Catch % (handle division by zero)
            const totalAttempts = catches + drops;
            const catchPercentage = totalAttempts > 0 ? ((catches / totalAttempts) * 100).toFixed(1) : '0.0';
            
            return `
                <div class="card stats-card">
                    <div class="stats-header">
                        <h3 class="stats-player-name">${player.name}</h3>
                        ${editButton}
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Points</span>
                            <span class="stat-value">${points}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Table Hits</span>
                            <span class="stat-value">${player.table_hits || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Throws</span>
                            <span class="stat-value">${throws}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Catches</span>
                            <span class="stat-value">${catches}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Drops</span>
                            <span class="stat-value">${drops}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Fifas</span>
                            <span class="stat-value">${player.fifas || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Points per Throw</span>
                            <span class="stat-value">${pointsPerThrow}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Catch %</span>
                            <span class="stat-value">${catchPercentage}%</span>
                        </div>
                    </div>
                </div>
            `;
        };
        
        // Render teams
        sortedTeams.forEach(group => {
            html += `<div class="stats-team-group">
                <h2 class="stats-team-header">${group.team.name}</h2>
                ${group.players.map(renderPlayerCard).join('')}
            </div>`;
        });
        
        // Render unassigned players
        if (unassignedPlayers.length > 0) {
            html += `<div class="stats-team-group">
                <h2 class="stats-team-header">Free Agents</h2>
                ${unassignedPlayers.map(renderPlayerCard).join('')}
            </div>`;
        }
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading stats:', error);
        container.innerHTML = `<div class="empty-state">
            <h3>Error loading stats</h3>
            <p>Make sure the backend server is running on ${API_BASE_URL}</p>
        </div>`;
    }
}

function editStats(playerId) {
    if (!isAuthenticated()) {
        alert('Commissioner access required.');
        return;
    }
    
    fetch(`${API_BASE_URL}/players`)
        .then(res => res.json())
        .then(players => {
            const player = players.find(p => p.id === playerId);
            if (player) {
                editingStatsPlayerId = playerId;
                document.getElementById('stats-form-title').textContent = `Edit ${player.name} Stats`;
                document.getElementById('statsPoints').value = player.points || 0;
                document.getElementById('statsTableHits').value = player.table_hits || 0;
                document.getElementById('statsThrows').value = player.throws || 0;
                document.getElementById('statsCatches').value = player.catches || 0;
                document.getElementById('statsDrops').value = player.drops || 0;
                document.getElementById('statsFifas').value = player.fifas || 0;
                const form = document.getElementById('stats-form');
                form.classList.remove('hidden');
            } else {
                alert('Player not found');
            }
        })
        .catch(error => {
            console.error('Error fetching player:', error);
            alert('Error loading player data');
        });
}

function closeStatsForm() {
    document.getElementById('stats-form').classList.add('hidden');
    document.getElementById('statsForm').reset();
    editingStatsPlayerId = null;
}

// Leaders display function
async function displayLeaders() {
    const container = document.getElementById('leaders-list');
    
    try {
        const response = await fetch(`${API_BASE_URL}/players`);
        const players = await response.json();
        
        if (players.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <h3>No players yet</h3>
                <p>Add players to see league leaders</p>
            </div>`;
            return;
        }
        
        // Calculate derived stats for all players
        const playersWithCalculated = players.map(player => {
            const points = player.points || 0;
            const throws = player.throws || 0;
            const catches = player.catches || 0;
            const drops = player.drops || 0;
            const totalAttempts = catches + drops;
            
            return {
                ...player,
                points: points,
                table_hits: player.table_hits || 0,
                throws: throws,
                catches: catches,
                drops: drops,
                fifas: player.fifas || 0,
                pointsPerThrow: throws > 0 ? points / throws : 0,
                catchPercentage: totalAttempts > 0 ? (catches / totalAttempts) * 100 : 0
            };
        });
        
        // Define stat categories
        const statCategories = [
            { key: 'points', label: 'Points', valueKey: 'points', format: (v) => v.toFixed(0), reverse: false },
            { key: 'table_hits', label: 'Table Hits', valueKey: 'table_hits', format: (v) => v.toFixed(0), reverse: false },
            { key: 'throws', label: 'Throws', valueKey: 'throws', format: (v) => v.toFixed(0), reverse: false },
            { key: 'catches', label: 'Catches', valueKey: 'catches', format: (v) => v.toFixed(0), reverse: false },
            { key: 'drops', label: 'Drops', valueKey: 'drops', format: (v) => v.toFixed(0), reverse: true },
            { key: 'fifas', label: 'Fifas', valueKey: 'fifas', format: (v) => v.toFixed(0), reverse: false },
            { key: 'pointsPerThrow', label: 'Points per Throw', valueKey: 'pointsPerThrow', format: (v) => v.toFixed(3), reverse: false },
            { key: 'catchPercentage', label: 'Catch %', valueKey: 'catchPercentage', format: (v) => v.toFixed(1) + '%', reverse: false }
        ];
        
        container.innerHTML = statCategories.map(category => {
            // Sort players by this stat (descending by default, ascending for reverse stats like drops)
            const sorted = [...playersWithCalculated].sort((a, b) => {
                const aVal = a[category.valueKey] || 0;
                const bVal = b[category.valueKey] || 0;
                if (category.reverse) {
                    return aVal - bVal; // Ascending order for bad stats
                } else {
                    return bVal - aVal; // Descending order for good stats
                }
            });
            
            return `
                <div class="card leaders-card">
                    <h3 class="leaders-category-title">${category.label}</h3>
                    <div class="leaders-ranking">
                        ${sorted.map((player, index) => {
                            const value = player[category.valueKey] || 0;
                            return `
                                <div class="leader-item">
                                    <span class="leader-rank">${index + 1}.</span>
                                    <span class="leader-name leader-name-clickable" onclick="viewPlayerStats(${player.id})" style="cursor: pointer; text-decoration: underline;">${player.name}</span>
                                    <span class="leader-value">${category.format(value)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading leaders:', error);
        container.innerHTML = `<div class="empty-state">
            <h3>Error loading leaders</h3>
            <p>Make sure the backend server is running on ${API_BASE_URL}</p>
        </div>`;
    }
}

// Add Match functions
async function displayAddMatch() {
    if (!isAuthenticated()) {
        document.getElementById('add-match-form-container').innerHTML = `
            <div class="empty-state">
                <h3>Commissioner Access Required</h3>
                <p>You must be logged in as commissioner to add matches</p>
            </div>
        `;
        return;
    }
    
    try {
        // Fetch teams and players
        const [teamsResponse, playersResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/teams`),
            fetch(`${API_BASE_URL}/players`)
        ]);
        
        const teams = await teamsResponse.json();
        const players = await playersResponse.json();
        
        // Populate team selects
        const teamASelect = document.getElementById('team-a-select');
        const teamBSelect = document.getElementById('team-b-select');
        const winnerSelect = document.getElementById('winner-select');
        
        // Clear existing options (except first option)
        while (teamASelect.children.length > 1) teamASelect.removeChild(teamASelect.lastChild);
        while (teamBSelect.children.length > 1) teamBSelect.removeChild(teamBSelect.lastChild);
        while (winnerSelect.children.length > 1) winnerSelect.removeChild(winnerSelect.lastChild);
        
        // Add team options
        teams.forEach(team => {
            const optionA = document.createElement('option');
            optionA.value = team.id;
            optionA.textContent = team.name;
            teamASelect.appendChild(optionA);
            
            const optionB = document.createElement('option');
            optionB.value = team.id;
            optionB.textContent = team.name;
            teamBSelect.appendChild(optionB);
            
            const optionWinner = document.createElement('option');
            optionWinner.value = team.id;
            optionWinner.textContent = team.name;
            winnerSelect.appendChild(optionWinner);
        });
        
        // Store players data for use in game forms
        window.matchFormPlayers = players;
        window.matchFormTeams = teams;
        
        // Set up event listeners
        setupMatchFormListeners();
        
    } catch (error) {
        console.error('Error loading match form:', error);
        document.getElementById('add-match-form-container').innerHTML = `
            <div class="empty-state">
                <h3>Error loading match form</h3>
                <p>Make sure the backend server is running on ${API_BASE_URL}</p>
            </div>
        `;
    }
}

function setupMatchFormListeners() {
    const numGamesInput = document.getElementById('num-games');
    const teamASelect = document.getElementById('team-a-select');
    const teamBSelect = document.getElementById('team-b-select');
    
    // Update winner options when teams change
    function updateWinnerOptions() {
        const teamAId = parseInt(teamASelect.value);
        const teamBId = parseInt(teamBSelect.value);
        const winnerSelect = document.getElementById('winner-select');
        
        // Clear existing options (except first option)
        while (winnerSelect.children.length > 1) {
            winnerSelect.removeChild(winnerSelect.lastChild);
        }
        
        if (teamAId && teamBId) {
            const teamA = window.matchFormTeams.find(t => t.id === teamAId);
            const teamB = window.matchFormTeams.find(t => t.id === teamBId);
            
            if (teamA) {
                const optionA = document.createElement('option');
                optionA.value = teamA.id;
                optionA.textContent = teamA.name;
                winnerSelect.appendChild(optionA);
            }
            
            if (teamB) {
                const optionB = document.createElement('option');
                optionB.value = teamB.id;
                optionB.textContent = teamB.name;
                winnerSelect.appendChild(optionB);
            }
        }
    }
    
    teamASelect.addEventListener('change', updateWinnerOptions);
    teamBSelect.addEventListener('change', updateWinnerOptions);
    
    // Generate game forms when number of games changes
    numGamesInput.addEventListener('change', () => {
        generateGameForms(parseInt(numGamesInput.value));
    });
}

function generateGameForms(numGames) {
    const gamesContainer = document.getElementById('games-container');
    gamesContainer.innerHTML = '';
    
    if (numGames < 1 || numGames > 7) {
        return;
    }
    
    const teamAId = parseInt(document.getElementById('team-a-select').value);
    const teamBId = parseInt(document.getElementById('team-b-select').value);
    
    if (!teamAId || !teamBId) {
        alert('Please select both teams before setting number of games');
        return;
    }
    
    const teamA = window.matchFormTeams.find(t => t.id === teamAId);
    const teamB = window.matchFormTeams.find(t => t.id === teamBId);
    
    if (!teamA || !teamB) {
        alert('Teams not found');
        return;
    }
    
    const playersMap = {};
    window.matchFormPlayers.forEach(p => {
        playersMap[p.id] = p.name;
    });
    
    for (let i = 1; i <= numGames; i++) {
        const gameDiv = document.createElement('div');
        gameDiv.className = 'game-form-section';
        gameDiv.innerHTML = `
            <h3 class="game-form-title">Game ${i}</h3>
            <div class="game-teams-container">
                <div class="game-team-section">
                    <h4>${teamA.name}</h4>
                    ${getPlayerStatsInputs(teamA, playersMap, i, 'a')}
                </div>
                <div class="game-team-section">
                    <h4>${teamB.name}</h4>
                    ${getPlayerStatsInputs(teamB, playersMap, i, 'b')}
                </div>
            </div>
        `;
        gamesContainer.appendChild(gameDiv);
    }
}

function getPlayerStatsInputs(team, playersMap, gameNum, teamLetter) {
    const players = [
        { id: team.player1_id, name: playersMap[team.player1_id] || `Player ${team.player1_id}` },
        { id: team.player2_id, name: playersMap[team.player2_id] || `Player ${team.player2_id}` },
        { id: team.player3_id, name: playersMap[team.player3_id] || `Player ${team.player3_id}` }
    ];
    
    return players.map(player => `
        <div class="player-stats-input-group">
            <label class="player-stats-label">${player.name}</label>
            <div class="stats-input-grid">
                <div class="stat-input">
                    <label>Points</label>
                    <input type="number" min="0" value="0" data-game="${gameNum}" data-team="${teamLetter}" data-player="${player.id}" data-stat="points">
                </div>
                <div class="stat-input">
                    <label>Table Hits</label>
                    <input type="number" min="0" value="0" data-game="${gameNum}" data-team="${teamLetter}" data-player="${player.id}" data-stat="table_hits">
                </div>
                <div class="stat-input">
                    <label>Throws</label>
                    <input type="number" min="0" value="0" data-game="${gameNum}" data-team="${teamLetter}" data-player="${player.id}" data-stat="throws">
                </div>
                <div class="stat-input">
                    <label>Catches</label>
                    <input type="number" min="0" value="0" data-game="${gameNum}" data-team="${teamLetter}" data-player="${player.id}" data-stat="catches">
                </div>
                <div class="stat-input">
                    <label>Drops</label>
                    <input type="number" min="0" value="0" data-game="${gameNum}" data-team="${teamLetter}" data-player="${player.id}" data-stat="drops">
                </div>
                <div class="stat-input">
                    <label>Fifas</label>
                    <input type="number" min="0" value="0" data-game="${gameNum}" data-team="${teamLetter}" data-player="${player.id}" data-stat="fifas">
                </div>
            </div>
        </div>
    `).join('');
}

function resetMatchForm() {
    document.getElementById('match-form').reset();
    document.getElementById('games-container').innerHTML = '';
    document.getElementById('team-a-select').selectedIndex = 0;
    document.getElementById('team-b-select').selectedIndex = 0;
    document.getElementById('winner-select').selectedIndex = 0;
}

// Set up match form submission
document.addEventListener('DOMContentLoaded', () => {
    const matchForm = document.getElementById('match-form');
    if (matchForm) {
        matchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAuthenticated()) {
                alert('Commissioner access required.');
                return;
            }
            
            const teamAId = parseInt(document.getElementById('team-a-select').value);
            const teamBId = parseInt(document.getElementById('team-b-select').value);
            const numGames = parseInt(document.getElementById('num-games').value);
            const winnerId = parseInt(document.getElementById('winner-select').value);
            
            if (!teamAId || !teamBId || !numGames || !winnerId) {
                alert('Please fill in all required fields');
                return;
            }
            
            // Collect all game stats
            const games = [];
            const allInputs = document.querySelectorAll('[data-game][data-team][data-player][data-stat]');
            
            for (let gameNum = 1; gameNum <= numGames; gameNum++) {
                const gameInputs = Array.from(allInputs).filter(input => 
                    parseInt(input.getAttribute('data-game')) === gameNum
                );
                
                const teamAPlayers = [];
                const teamBPlayers = [];
                
                gameInputs.forEach(input => {
                    const teamLetter = input.getAttribute('data-team');
                    const playerId = parseInt(input.getAttribute('data-player'));
                    const stat = input.getAttribute('data-stat');
                    const value = parseInt(input.value) || 0;
                    
                    const playerStats = teamLetter === 'a' ? teamAPlayers : teamBPlayers;
                    let playerStatObj = playerStats.find(p => p.player_id === playerId);
                    
                    if (!playerStatObj) {
                        playerStatObj = {
                            player_id: playerId,
                            points: 0,
                            table_hits: 0,
                            throws: 0,
                            catches: 0,
                            drops: 0,
                            fifas: 0
                        };
                        playerStats.push(playerStatObj);
                    }
                    
                    playerStatObj[stat] = value;
                });
                
                games.push({
                    team_a_players: teamAPlayers,
                    team_b_players: teamBPlayers
                });
            }
            
            const matchData = {
                team_a_id: teamAId,
                team_b_id: teamBId,
                num_games: numGames,
                games: games,
                winner_id: winnerId
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/matches`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(matchData)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to submit match');
                }
                
                const result = await response.json();
                alert(`Match submitted successfully! Updated ${result.players_updated} players and ${result.teams_updated} teams.`);
                
                // Reset form
                resetMatchForm();
                
                // Refresh standings and stats
                await displayStandings();
                await displayStats();
                
            } catch (error) {
                console.error('Error submitting match:', error);
                alert(`Error submitting match: ${error.message}`);
            }
        });
    }
});


// Close modals when clicking outside
document.querySelectorAll('.form-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            if (modal.id === 'login-form') {
                closeLoginForm();
            } else if (modal.id === 'standings-record-form') {
                closeStandingsRecordForm();
            } else if (modal.id === 'schedule-game-form') {
                closeScheduleGameForm();
            } else if (modal.id === 'week-form') {
                closeWeekForm();
            } else if (modal.id === 'stats-form') {
                closeStatsForm();
            } else if (modal.id === 'player-stats-view') {
                closePlayerStatsView();
            } else {
                modal.classList.add('hidden');
            }
        }
    });
});

