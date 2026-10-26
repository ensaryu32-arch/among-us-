const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Prevent browser caching during active development
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));
app.use(express.static(__dirname, { etag: false, maxAge: 0 }));


// Colors available in Among Us
const COLORS = [
  'Red', 'Blue', 'Green', 'Pink', 'Orange', 'Yellow', 'Black', 'White', 'Purple', 'Brown'
];

// Room storage: roomCode -> roomObject
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function createRoom(code, isFreeplay = false) {
  const room = {
    id: code,
    code: code,
    isFreeplay: isFreeplay,
    isPublic: true,
    hostId: null,
    players: new Map(), // id -> player object
    deadBodies: [],    // { id, x, y, color, victimName }
    state: isFreeplay ? 'PLAYING' : 'LOBBY', // 'LOBBY', 'PLAYING', 'MEETING', 'EJECTION', 'ENDED'
    meeting: null,
    taskTotal: 0,
    taskProgress: 0,
    timerInterval: null,
    settings: {
      map: 'THE SKELD',
      impostors: 1,
      speed: 1.25,
      killCd: 25,
      meetings: 1,
      votingTime: 60,
      visualTasks: true
    }
  };
  rooms.set(code, room);
  return room;
}

function broadcast(room, type, payload) {
  const data = JSON.stringify({ type, ...payload });
  for (const [_, player] of room.players) {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

function broadcastLobbyState(room) {
  const host = room.players.get(room.hostId);
  broadcast(room, 'LOBBY_STATE', {
    roomCode: room.code,
    hostId: room.hostId,
    hostName: host ? host.name : 'Host',
    isPublic: room.isPublic !== false,
    state: room.state,
    maxPlayers: room.maxPlayers || 20,
    impostors: (room.settings && room.settings.impostors) || 1,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      hat: p.hat || 'none',
      skin: p.skin || 'default',
      isHost: p.id === room.hostId,
      isDummy: !!p.isDummy,
      isAlive: (p.isAlive !== false),
      x: p.x,
      y: p.y
    }))
  });
}

function startGame(room) {
  const allPlayers = Array.from(room.players.values());
  const humanList = allPlayers.filter(p => !p.isDummy);
  const pool = room.isFreeplay ? allPlayers : humanList;
  if (pool.length === 0) return;

  // Reset impostor status and flags on EVERY player in room before new lottery
  for (const p of allPlayers) {
    p.isImpostor = false;
    p.isAlive = true;
    p.inVent = false;
    p.completedTasks = 0;
    p.isWatchingCameras = false;
    p.killCooldown = (room.settings && room.settings.killCd) || 25;
    p.x = 3303 + (Math.random() * 140 - 70);
    p.y = 1017 + (Math.random() * 140 - 70);
  }

  // Authentic Among Us rules for impostor count:
  // 4-6 players -> max 1 impostor
  // 7-8 players -> max 2 impostors
  // 9+ players  -> max 3 impostors
  const humanCount = humanList.length;
  let maxAllowedImps = 1;
  const totalCount = pool.length;
  if (totalCount >= 9) maxAllowedImps = 3;
  else if (totalCount >= 7) maxAllowedImps = 2;
  else maxAllowedImps = 1;

  if (!room.isFreeplay) {
    maxAllowedImps = Math.min(maxAllowedImps, Math.max(1, Math.floor((humanCount - 1) / 2)));
  }

  const requestedImps = Math.min(3, Math.max(1, (room.settings && room.settings.impostors) || 1));
  const impCount = Math.min(requestedImps, maxAllowedImps);

  // Equal probability lottery matching authentic Among Us odds (Fisher-Yates)
  const lotteryPool = [...pool];
  for (let i = lotteryPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lotteryPool[i], lotteryPool[j]] = [lotteryPool[j], lotteryPool[i]];
  }

  for (let i = 0; i < impCount && i < lotteryPool.length; i++) {
    lotteryPool[i].isImpostor = true;
  }

  broadcast(room, 'CAMERAS_ACTIVE', { active: false });

  room.deadBodies = [];
  room.state = 'PLAYING';
  room.meeting = null;
  room.taskProgress = 0;
  room.o2UsedCount = 0;

  const crewCount = Array.from(room.players.values()).filter(p => !p.isImpostor).length;
  room.taskTotal = Math.max(crewCount * 3, 3);

  broadcast(room, 'GAME_STARTED', {
    state: room.state,
    taskTotal: room.taskTotal,
    taskProgress: room.taskProgress,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      hat: p.hat || 'none',
      skin: p.skin || 'default',
      isAlive: p.isAlive,
      isImpostor: p.isImpostor,
      isDummy: !!p.isDummy,
      x: p.x,
      y: p.y
    }))
  });
}

function checkWinConditions(room) {
  if (room.state !== 'PLAYING' && room.state !== 'MEETING' && room.state !== 'EJECTION') return false;
  if (room.isFreeplay) return false; // Freeplay doesn't end match

  const players = Array.from(room.players.values()).filter(p => !p.isDummy);
  const livingImpostors = players.filter(p => p.isImpostor && p.isAlive);
  const livingCrew = players.filter(p => !p.isImpostor && p.isAlive);

  // Impostor win condition: Impostors equal or outnumber crew (e.g., 2 players left in a 4-player room: 1 Impostor, 1 Crewmate)
  if (livingImpostors.length > 0 && livingImpostors.length >= livingCrew.length) {
    room.state = 'ENDED';
    broadcast(room, 'GAME_OVER', {
      winner: 'IMPOSTOR',
      reason: 'Impostors reached parity with crew!',
      impostors: players.filter(p => p.isImpostor).map(p => p.name)
    });
    return true;
  }

  if (livingImpostors.length === 0 && players.length > 1) {
    room.state = 'ENDED';
    broadcast(room, 'GAME_OVER', {
      winner: 'CREW',
      reason: 'All Impostors ejected!'
    });
    return true;
  }

  if (room.taskProgress >= room.taskTotal && room.taskTotal > 0) {
    room.state = 'ENDED';
    broadcast(room, 'GAME_OVER', {
      winner: 'CREW',
      reason: 'All tasks completed!'
    });
    return true;
  }

  return false;
}

function startMeeting(room, callerPlayer, reportedBody = null) {
  if (room.state === 'MEETING') return;
  room.state = 'MEETING';

  // Teleport living players to cafeteria emergency table & reset camera watch
  let angle = 0;
  const count = room.players.size;
  for (const [_, p] of room.players) {
    p.x = 3303 + Math.cos(angle) * 120;
    p.y = 1017 + Math.sin(angle) * 120;
    p.inVent = false;
    p.isWatchingCameras = false;
    angle += (Math.PI * 2) / Math.max(count, 1);
  }
  broadcast(room, 'CAMERAS_ACTIVE', { active: false });

  room.deadBodies = []; // Corpses cleared on meeting call
  const discTime = 10;
  const voteTime = 200; // 200s voting time for thorough discussions

  const reportedName = reportedBody ? reportedBody.victimName : null;
  const reportedColor = reportedBody ? reportedBody.color : null;

  room.meeting = {
    caller: callerPlayer ? callerPlayer.name : 'Emergency Button',
    reportedBody: reportedName,
    reportedColor: reportedColor,
    phase: 'DISCUSSION', // 'DISCUSSION' -> 'VOTING'
    timer: discTime,
    votingTime: voteTime,
    votes: {} // voterId -> targetId ('SKIP' or playerId)
  };

  broadcast(room, 'MEETING_STARTED', {
    caller: room.meeting.caller,
    callerId: callerPlayer ? callerPlayer.id : null,
    callerColor: callerPlayer ? callerPlayer.color : null,
    reportedBody: room.meeting.reportedBody,
    reportedColor: room.meeting.reportedColor,
    phase: room.meeting.phase,
    timer: room.meeting.timer,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      hat: p.hat || 'none',
      skin: p.skin || 'default',
      isAlive: p.isAlive,
      isImpostor: p.isImpostor,
      isDummy: !!p.isDummy
    }))
  });

  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerInterval = setInterval(() => {
    if (!room.meeting) {
      clearInterval(room.timerInterval);
      return;
    }

    room.meeting.timer--;

    if (room.meeting.phase === 'DISCUSSION') {
      if (room.meeting.timer <= 0) {
        room.meeting.phase = 'VOTING';
        room.meeting.timer = room.meeting.votingTime;
        broadcast(room, 'VOTING_PHASE_STARTED', {
          phase: 'VOTING',
          timer: room.meeting.timer
        });
      } else {
        broadcast(room, 'MEETING_TIMER', {
          phase: 'DISCUSSION',
          timer: room.meeting.timer
        });
      }
    } else {
      // Voting Phase
      broadcast(room, 'MEETING_TIMER', {
        phase: 'VOTING',
        timer: room.meeting.timer
      });

      const living = Array.from(room.players.values()).filter(p => p.isAlive && !p.isDummy);
      const votesCount = Object.keys(room.meeting.votes).length;

      if (room.meeting.timer <= 0 || (living.length > 0 && votesCount >= living.length)) {
        clearInterval(room.timerInterval);
        endMeeting(room);
      }
    }
  }, 1000);
}

function endMeeting(room) {
  if (!room.meeting) return;

  const votes = room.meeting.votes;
  const tally = {};
  for (const [voterId, targetId] of Object.entries(votes)) {
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  let maxVotes = 0;
  let topTarget = null;
  let isTie = false;

  for (const [target, count] of Object.entries(tally)) {
    if (count > maxVotes) {
      maxVotes = count;
      topTarget = target;
      isTie = false;
    } else if (count === maxVotes) {
      isTie = true;
    }
  }

  let ejectedPlayer = null;
  let wasImpostor = false;
  const skipVotes = tally['SKIP'] || 0;

  // Strict plurality: top candidate must have more votes than SKIP and must not be a tie
  if (!isTie && topTarget && topTarget !== 'SKIP' && maxVotes > skipVotes) {
    ejectedPlayer = room.players.get(topTarget);
    if (ejectedPlayer) {
      ejectedPlayer.isAlive = false;
      wasImpostor = ejectedPlayer.isImpostor;
    }
  } else if (topTarget !== 'SKIP' && isTie) {
    // Tie between candidates
    isTie = true;
  }

  const remainingImpostors = Array.from(room.players.values()).filter(p => p.isImpostor && p.isAlive).length;

  room.state = 'EJECTION';
  broadcast(room, 'MEETING_ENDED', {
    ejected: ejectedPlayer ? {
      id: ejectedPlayer.id,
      name: ejectedPlayer.name,
      color: ejectedPlayer.color,
      hat: ejectedPlayer.hat || 'none',
      skin: ejectedPlayer.skin || 'default',
      isImpostor: wasImpostor
    } : null,
    isTie: isTie,
    isSkip: topTarget === 'SKIP' || skipVotes >= maxVotes || (!topTarget && !isTie),
    remainingImpostors: remainingImpostors,
    votes: votes,
    tally: tally
  });

  room.meeting = null;

  // After 17s (5s voting results reveal + 10.5s ejection drift + buffer), resume game or game over
  setTimeout(() => {
    if (checkWinConditions(room)) return;

    room.state = 'PLAYING';
    const livingPlayers = Array.from(room.players.values()).filter(p => p.isAlive);
    const livingCount = livingPlayers.length;
    let respawnAngle = 0;
    for (const p of livingPlayers) {
      // Respawn living players at center Cafeteria emergency table (matching round start)
      p.x = 3303 + Math.cos(respawnAngle) * 90;
      p.y = 1017 + Math.sin(respawnAngle) * 90;
      respawnAngle += (Math.PI * 2) / Math.max(livingCount, 1);
      p.inVent = false;
      p.isWatchingCameras = false;
      if (p.isImpostor) p.killCooldown = (room.settings && room.settings.killCd) || 25;
    }

    broadcast(room, 'RESUME_GAME', {
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        isAlive: p.isAlive
      }))
    });
  }, 6500);
}

wss.on('connection', (ws) => {
  let currentPlayer = null;
  let currentRoom = null;

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        // Create a new Room
        case 'CREATE_ROOM': {
          const roomCode = generateRoomCode();
          currentRoom = createRoom(roomCode, false);
          if (msg.impostors) currentRoom.settings.impostors = parseInt(msg.impostors) || 1;
          if (msg.maxPlayers) currentRoom.maxPlayers = Math.min(20, Math.max(4, parseInt(msg.maxPlayers) || 10));

          currentPlayer = {
            id: 'p_' + Math.random().toString(36).substring(2, 9),
            ws: ws,
            name: msg.name || 'Host',
            color: msg.color || 'Red',
            hat: msg.hat || 'none',
            skin: msg.skin || 'default',
            isAlive: true,
            isImpostor: false,
            x: 613,
            y: 460,
            dir: 'down',
            inVent: false,
            killCooldown: 25,
            completedTasks: 0
          };

          currentRoom.hostId = currentPlayer.id;
          currentRoom.players.set(currentPlayer.id, currentPlayer);

          ws.send(JSON.stringify({
            type: 'ROOM_CREATED',
            roomCode: roomCode,
            playerId: currentPlayer.id,
            isHost: true,
            color: currentPlayer.color
          }));

          broadcastLobbyState(currentRoom);
          break;
        }

        // Join existing room by code
        case 'JOIN_ROOM': {
          const code = (msg.roomCode || '').toUpperCase().trim();
          const targetRoom = rooms.get(code);

          if (!targetRoom) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found! Check the room code.' }));
            return;
          }

          const maxLimit = targetRoom.maxPlayers || 20;
          if (targetRoom.players.size >= maxLimit) {
            ws.send(JSON.stringify({ type: 'ERROR', message: `Room is full (max ${maxLimit} players).` }));
            return;
          }

          currentRoom = targetRoom;
          const existingColors = new Set(Array.from(currentRoom.players.values()).map(p => p.color));
          const chosenColor = msg.color && !existingColors.has(msg.color)
            ? msg.color
            : (COLORS.find(c => !existingColors.has(c)) || COLORS[currentRoom.players.size % COLORS.length]);

          currentPlayer = {
            id: 'p_' + Math.random().toString(36).substring(2, 9),
            ws: ws,
            name: msg.name || 'Crewmate ' + (currentRoom.players.size + 1),
            color: chosenColor,
            hat: msg.hat || 'none',
            skin: msg.skin || 'default',
            isAlive: true,
            isImpostor: false,
            x: 613 + (Math.random() * 80 - 40),
            y: 460 + (Math.random() * 60 - 30),
            dir: 'down',
            inVent: false,
            killCooldown: 25,
            completedTasks: 0
          };

          currentRoom.players.set(currentPlayer.id, currentPlayer);

          ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            roomCode: currentRoom.code,
            playerId: currentPlayer.id,
            isHost: currentPlayer.id === currentRoom.hostId,
            color: chosenColor
          }));

          broadcastLobbyState(currentRoom);

          // If game already started, catch up
          if (currentRoom.state === 'PLAYING') {
            ws.send(JSON.stringify({
              type: 'GAME_STARTED',
              state: currentRoom.state,
              taskTotal: currentRoom.taskTotal,
              taskProgress: currentRoom.taskProgress,
              players: Array.from(currentRoom.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                isAlive: p.isAlive,
                isImpostor: p.isImpostor,
                x: p.x,
                y: p.y
              }))
            }));
          }
          break;
        }

        // List public rooms
        case 'LIST_ROOMS': {
          const list = [];
          for (const [code, r] of rooms) {
            if (!r.isFreeplay && r.players.size > 0 && r.state === 'LOBBY' && r.isPublic !== false) {
              const host = r.players.get(r.hostId);
              list.push({
                code: code,
                hostName: host ? host.name : 'Host',
                map: (r.settings && r.settings.map) || 'THE SKELD',
                playerCount: r.players.size,
                players: r.players.size,
                maxPlayers: r.maxPlayers || 20
              });
            }
          }
          ws.send(JSON.stringify({ type: 'ROOMS_LIST', rooms: list }));
          break;
        }

        // Start Solo Freeplay mode with practice dummies in Dropship
        case 'JOIN_FREEPLAY':
        case 'START_FREEPLAY': {
          const code = 'FREEPLAY_' + Math.random().toString(36).substring(2, 6).toUpperCase();
          currentRoom = createRoom(code, true);

          currentPlayer = {
            id: 'p_host',
            ws: ws,
            name: msg.name || 'Player',
            color: msg.color || 'Red',
            isAlive: true,
            isImpostor: msg.isImpostor !== undefined ? msg.isImpostor : (Math.random() < 0.25),
            x: 613,
            y: 460,
            dir: 'down',
            inVent: false,
            killCooldown: 10,
            completedTasks: 0
          };
          currentRoom.hostId = currentPlayer.id;
          currentRoom.players.set(currentPlayer.id, currentPlayer);

          // Add 3 dummies in the dropship
          const dummyPositions = [
            { name: 'Dummy Blue', color: 'Blue', x: 480, y: 520 },
            { name: 'Dummy Pink', color: 'Pink', x: 740, y: 460 },
            { name: 'Dummy Green', color: 'Green', x: 680, y: 350 }
          ];

          dummyPositions.forEach((dp, idx) => {
            const dId = 'dummy_' + idx;
            currentRoom.players.set(dId, {
              id: dId,
              ws: null,
              name: dp.name,
              color: dp.color,
              isAlive: true,
              isImpostor: false,
              isDummy: true,
              x: dp.x,
              y: dp.y,
              dir: 'down',
              inVent: false,
              killCooldown: 25,
              completedTasks: 0
            });
          });

          ws.send(JSON.stringify({
            type: 'ROOM_CREATED',
            roomCode: code,
            playerId: currentPlayer.id,
            isHost: true,
            color: currentPlayer.color
          }));

          broadcastLobbyState(currentRoom);
          break;
        }

        // Change Astronaut Customization (Color, Hat, Skin) in Dropship Closet
        case 'CUSTOMIZE':
        case 'CHANGE_COLOR': {
          if (!currentRoom || !currentPlayer) break;
          const requested = msg.color;
          if (requested && COLORS.includes(requested)) {
            const taken = Array.from(currentRoom.players.values()).some(p => p.id !== currentPlayer.id && p.color === requested);
            if (!taken) {
              currentPlayer.color = requested;
            }
          }
          if (msg.hat) currentPlayer.hat = msg.hat;
          if (msg.skin) currentPlayer.skin = msg.skin;

          broadcast(currentRoom, 'PLAYER_CUSTOMIZED', {
            id: currentPlayer.id,
            color: currentPlayer.color,
            hat: currentPlayer.hat,
            skin: currentPlayer.skin
          });
          broadcastLobbyState(currentRoom);
          break;
        }

        // Impostor Sabotage System
        case 'SABOTAGE': {
          if (!currentRoom || !currentPlayer || !currentPlayer.isImpostor) break;
          const sabotageType = msg.sabotage; // 'lights', 'reactor', 'o2', 'comms', 'doors'
          if (sabotageType === 'o2') {
            currentRoom.o2UsedCount = currentRoom.o2UsedCount || 0;
            if (currentRoom.o2UsedCount >= 2) {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'SABOTAGE_REJECTED', reason: 'O2 sabotajı her elde maksimum 2 kez yapılabilir!' }));
              }
              break;
            }
            currentRoom.o2UsedCount++;
          }
          currentRoom.activeSabotage = {
            type: sabotageType,
            startedAt: Date.now(),
            roomName: msg.roomName || null,
            duration: msg.duration || 30
          };
          broadcast(currentRoom, 'SABOTAGE_TRIGGERED', {
            sabotage: sabotageType,
            roomName: msg.roomName,
            duration: currentRoom.activeSabotage.duration,
            o2UsedCount: currentRoom.o2UsedCount || 0
          });
          break;
        }

        case 'FIX_SABOTAGE': {
          if (!currentRoom) break;
          currentRoom.activeSabotage = null;
          broadcast(currentRoom, 'SABOTAGE_FIXED', {
            sabotage: msg.sabotage
          });
          break;
        }

        // Toggle Room Privacy (Private / Public)
        case 'TOGGLE_PRIVACY': {
          if (!currentRoom || !currentPlayer || currentPlayer.id !== currentRoom.hostId) break;
          currentRoom.isPublic = !currentRoom.isPublic;
          broadcast(currentRoom, 'PRIVACY_CHANGED', { isPublic: currentRoom.isPublic });
          break;
        }

        // Start Match (Host only)
        case 'START_GAME': {
          if (!currentRoom) return;
          if (currentRoom.hostId !== currentPlayer.id && !currentRoom.isFreeplay) return;
          const humanCount = Array.from(currentRoom.players.values()).filter(p => !p.isDummy).length;
          if (!currentRoom.isFreeplay && humanCount < 4) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: `Need at least 4 players to start the game! (Current: ${humanCount}/4)`
            }));
            return;
          }
          startGame(currentRoom);
          break;
        }

        // Restart Room back to Lobby (Host or Freeplay, keeps room, players, settings intact)
        case 'RESTART_ROOM': {
          if (!currentRoom || !currentPlayer) return;
          if (currentRoom.hostId !== currentPlayer.id && !currentRoom.isFreeplay) return;
          
          currentRoom.state = 'LOBBY';
          currentRoom.meeting = null;
          currentRoom.deadBodies = [];
          currentRoom.activeSabotage = null;
          currentRoom.taskProgress = 0;
          currentRoom.o2UsedCount = 0;

          // Reset all players back to lobby positions & living state
          let dropIndex = 0;
          for (const [_, p] of currentRoom.players) {
            p.isAlive = true;
            p.isImpostor = false;
            p.inVent = false;
            p.isWatchingCameras = false;
            p.killCooldown = 25;
            p.completedTasks = 0;
            if (p.isDummy) {
              const dummyPositions = [
                { x: 480, y: 520 },
                { x: 740, y: 460 },
                { x: 680, y: 350 }
              ];
              const dp = dummyPositions[dropIndex % dummyPositions.length];
              p.x = dp.x;
              p.y = dp.y;
            } else {
              p.x = 613 + ((dropIndex % 5) * 35 - 70);
              p.y = 460 + (Math.floor(dropIndex / 5) * 35 - 35);
            }
            dropIndex++;
          }

          broadcast(currentRoom, 'RETURN_TO_LOBBY', {
            state: 'LOBBY',
            roomCode: currentRoom.code
          });
          broadcastLobbyState(currentRoom);
          break;
        }

        // Movement packet
        case 'MOVE': {
          if (!currentPlayer || !currentRoom) return;
          currentPlayer.x = msg.x;
          currentPlayer.y = msg.y;
          currentPlayer.dir = msg.dir;
          currentPlayer.walking = msg.walking;
          currentPlayer.inVent = msg.inVent;

          // Broadcast to others in the room
          const moveData = JSON.stringify({
            type: 'PLAYER_MOVED',
            id: currentPlayer.id,
            x: currentPlayer.x,
            y: currentPlayer.y,
            dir: currentPlayer.dir,
            walking: currentPlayer.walking,
            inVent: currentPlayer.inVent
          });

          for (const [_, p] of currentRoom.players) {
            if (p.id !== currentPlayer.id && p.ws && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(moveData);
            }
          }
          break;
        }

        // Kill Crewmate
        case 'KILL': {
          if (!currentPlayer || !currentPlayer.isImpostor || !currentPlayer.isAlive || !currentRoom) return;
          const targetPlayerId = msg.victimId || msg.targetId;
          const victim = currentRoom.players.get(targetPlayerId);
          if (!victim || !victim.isAlive) return;

          victim.isAlive = false;
          currentPlayer.killCooldown = currentRoom.settings ? currentRoom.settings.killCooldown : 25;

          const corpse = {
            id: 'corpse_' + Date.now(),
            x: victim.x,
            y: victim.y,
            color: victim.color,
            victimName: victim.name
          };
          currentRoom.deadBodies.push(corpse);

          broadcast(currentRoom, 'PLAYER_KILLED', {
            victimId: victim.id,
            killerId: currentPlayer.id,
            corpse: corpse
          });

          checkWinConditions(currentRoom);
          break;
        }

        // Report dead body (requires dead body) or emergency button
        case 'REPORT':
        case 'REPORT_BODY': {
          if (!currentPlayer || !currentPlayer.isAlive || !currentRoom) return;
          if (!currentRoom.deadBodies || currentRoom.deadBodies.length === 0) return;
          let corpse = null;
          const corpseId = msg.bodyId || msg.corpseId;
          if (corpseId) {
            corpse = currentRoom.deadBodies.find(c => c.id === corpseId);
          }
          if (!corpse) {
            corpse = currentRoom.deadBodies[currentRoom.deadBodies.length - 1];
          }
          startMeeting(currentRoom, currentPlayer, corpse);
          break;
        }

        case 'CALL_EMERGENCY': {
          if (!currentPlayer || !currentPlayer.isAlive || !currentRoom) return;
          startMeeting(currentRoom, currentPlayer, null);
          break;
        }

        // Security cameras viewing state
        case 'VIEW_CAMERAS': {
          if (!currentRoom || !currentPlayer) return;
          currentPlayer.isWatchingCameras = !!(msg.isViewing && currentPlayer.isAlive);
          const anyWatching = Array.from(currentRoom.players.values()).some(p => p.isWatchingCameras && p.isAlive && !p.isDummy);
          broadcast(currentRoom, 'CAMERAS_ACTIVE', { active: anyWatching });
          break;
        }

        // Vote in Meeting
        case 'VOTE': {
          if (!currentPlayer || !currentPlayer.isAlive || !currentRoom || !currentRoom.meeting) return;
          currentRoom.meeting.votes[currentPlayer.id] = msg.targetId; // 'SKIP' or playerId

          broadcast(currentRoom, 'VOTE_CAST', {
            voterId: currentPlayer.id,
            targetId: msg.targetId
          });

          const living = Array.from(currentRoom.players.values()).filter(p => p.isAlive && !p.isDummy);
          if (Object.keys(currentRoom.meeting.votes).length >= living.length) {
            if (currentRoom.timerInterval) clearInterval(currentRoom.timerInterval);
            endMeeting(currentRoom);
          }
          break;
        }

        // Task Completed
        case 'TASK_COMPLETED': {
          if (!currentPlayer || !currentRoom) return;
          currentPlayer.completedTasks = (currentPlayer.completedTasks || 0) + 1;
          currentRoom.taskProgress = Math.min(currentRoom.taskTotal, currentRoom.taskProgress + 1);

          broadcast(currentRoom, 'TASK_PROGRESS', {
            progress: currentRoom.taskProgress,
            total: currentRoom.taskTotal
          });

          checkWinConditions(currentRoom);
          break;
        }

        // Chat message in Meeting
        case 'CHAT': {
          if (!currentPlayer || !currentRoom) return;
          broadcast(currentRoom, 'CHAT_MESSAGE', {
            sender: currentPlayer.name,
            color: currentPlayer.color,
            text: msg.text,
            isDead: !currentPlayer.isAlive
          });
          break;
        }

        // Change color in Lobby
        case 'CHANGE_COLOR': {
          if (!currentPlayer || !currentRoom || currentRoom.state !== 'LOBBY') return;
          const desired = msg.color;
          const taken = Array.from(currentRoom.players.values()).some(p => p.id !== currentPlayer.id && p.color === desired);
          if (!taken && COLORS.includes(desired)) {
            currentPlayer.color = desired;
            broadcastLobbyState(currentRoom);
          }
          break;
        }

        // Customize (Color, Hat, Skin)
        case 'CUSTOMIZE': {
          if (!currentPlayer || !currentRoom) return;
          if (msg.color && COLORS.includes(msg.color)) {
            const taken = Array.from(currentRoom.players.values()).some(p => p.id !== currentPlayer.id && p.color === msg.color);
            if (!taken) currentPlayer.color = msg.color;
          }
          if (msg.hat !== undefined) currentPlayer.hat = msg.hat;
          if (msg.skin !== undefined) currentPlayer.skin = msg.skin;
          broadcastLobbyState(currentRoom);
          break;
        }

        // Toggle Room Privacy (Public/Private)
        case 'TOGGLE_PRIVACY': {
          if (!currentPlayer || !currentRoom || currentRoom.hostId !== currentPlayer.id) return;
          currentRoom.isPublic = !currentRoom.isPublic;
          broadcast(currentRoom, 'PRIVACY_CHANGED', {
            isPublic: currentRoom.isPublic
          });
          break;
        }

        // Update Game Settings (Host only)
        case 'UPDATE_SETTINGS': {
          if (!currentPlayer || !currentRoom || currentRoom.hostId !== currentPlayer.id) return;
          currentRoom.settings = {
            ...currentRoom.settings,
            ...msg.settings
          };
          broadcast(currentRoom, 'SETTINGS_UPDATED', {
            settings: currentRoom.settings
          });
          break;
        }
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    if (currentPlayer && currentRoom) {
      currentRoom.players.delete(currentPlayer.id);
      if (currentRoom.hostId === currentPlayer.id) {
        const remaining = Array.from(currentRoom.players.values()).filter(p => !p.isDummy);
        if (remaining.length > 0) {
          currentRoom.hostId = remaining[0].id;
        } else {
          rooms.delete(currentRoom.code);
        }
      }
      broadcastLobbyState(currentRoom);
      checkWinConditions(currentRoom);
    }
  });
});

server.listen(PORT, () => {
  console.log('=========================================');
  console.log(`🚀 Among Us Web Server running at: http://localhost:${PORT}`);
  console.log('=========================================');
});
