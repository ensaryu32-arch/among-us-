// Among Us Web Client Engine - Complete Authentic Recreation
(function() {
  const COLORS = ['Red', 'Blue', 'Green', 'Pink', 'Orange', 'Yellow', 'Black', 'White', 'Purple', 'Brown'];
  const COLOR_HEX = {
    Red: '#c51111',
    Blue: '#132ed1',
    Green: '#117f2d',
    Pink: '#ed54ba',
    Orange: '#ef7d0d',
    Yellow: '#f5f557',
    Black: '#3f474e',
    White: '#d6e0f0',
    Purple: '#6b2fbb',
    Brown: '#71491e'
  };

  const HATS = [
    { id: 'none', name: 'None', icon: '🚫' },
    { id: 'crown', name: 'Crown', icon: '👑' },
    { id: 'sprout', name: 'Sprout', icon: '🌱' },
    { id: 'tophat', name: 'Top Hat', icon: '🎩' },
    { id: 'beanie', name: 'Beanie', icon: '🧢' },
    { id: 'party', name: 'Party Hat', icon: '🥳' },
    { id: 'horns', name: 'Devil Horns', icon: '😈' },
    { id: 'halo', name: 'Angel Halo', icon: '😇' },
    { id: 'chef', name: 'Chef Hat', icon: '👨‍🍳' },
    { id: 'dum', name: 'DUM Note', icon: '📝' },
    { id: 'flower', name: 'Flower', icon: '🌸' },
    { id: 'goggles', name: 'Goggles', icon: '🥽' },
    { id: 'viking', name: 'Viking Helm', icon: '🪖' },
    { id: 'paper', name: 'Paper Hat', icon: '🗞️' }
  ];

  const SKINS = [
    { id: 'default', name: 'None (Default)', icon: '🚫' },
    { id: 'suit', name: 'Black Tuxedo', icon: '🤵' },
    { id: 'doctor', name: 'Doctor Lab Coat', icon: '🥼' },
    { id: 'police', name: 'Police Officer', icon: '👮' },
    { id: 'military', name: 'Military Camo', icon: '🎖️' },
    { id: 'captain', name: 'Captain Uniform', icon: '⚓' },
    { id: 'mechanic', name: 'Mechanic Overalls', icon: '🔧' },
    { id: 'hoodie', name: 'Streetwear Hoodie', icon: '🧥' }
  ];

  // State
  let ws = null;

  // ==================== AUTH & ADMIN DASHBOARD CLIENT STATE ====================
  let currentUser = null;
  let isAdmin = false;
  let adminStatsInterval = null;
  let currentRoomHostId = null;
  let currentRoomPlayersData = [];
  // =============================================================================

  let localPlayer = {
    id: null,
    name: 'Player',
    color: 'Red',
    hat: 'none',
    skin: 'default',
    completedTaskIds: new Set(),
    x: 3303,
    y: 1017,
    dir: 'down',
    walking: false,
    frame: 1,
    isAlive: true,
    isImpostor: false,
    inVent: false,
    ventIndex: -1,
    killCooldown: 15,
    speed: 340,
    hasVoted: false
  };

  let players = new Map(); // id -> player
  let deadBodies = [];
  let mapData = null;
  let mapImage = new Image();
  let sprites = {};
  let sounds = {};
  let soundEnabled = true;
  let gameState = 'MENU'; // 'MENU', 'LOBBY', 'PLAYING', 'MEETING', 'EJECTION', 'ENDED'
  let currentRoomCode = '';
  let currentRoomMaxPlayers = 20;
  let isRoomHost = false;
  let isFreeplayMode = false;
  let doorCooldowns = {
    cafeteria: 0,
    storage: 0,
    security: 0,
    medbay: 0,
    electrical: 0,
    upengine: 0,
    lowengine: 0
  };
  let keys = {};
  let currentNearbyTask = null;
  let currentNearbyBody = null;
  let currentNearbyVent = null;
  let isNearEmergencyTable = false;
  let isNearSecurityCams = false;
  let lastFootstepTime = 0;
  let animTimer = 0;
  let selectedVoteTarget = null;
  let selectedHostImpostors = 1;
  let meetingPhase = 'DISCUSSION';

  // Dead body sprites & falling death animations (Photo 4 then Photo 3)
  const deadCorpseSprites = {};
  const deadAnimSprites = [1, 2, 3, 4].map(n => {
    const img = new Image();
    img.src = 'assets/Images/Player/Dead/Dead' + n + '.png';
    return img;
  });

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // HUD
  const topHud = document.getElementById('top-hud');
  const topRightHud = document.getElementById('top-right-hud');
  const actionHud = document.getElementById('action-hud');
  const btnReport = document.getElementById('btn-report');
  const btnUse = document.getElementById('btn-use');
  const btnVent = document.getElementById('btn-vent');
  const btnKill = document.getElementById('btn-kill');
  const killTimerOverlay = document.getElementById('kill-timer-overlay');
  const taskBarFill = document.getElementById('task-bar-fill');
  const roleDisplay = document.getElementById('role-display');
  const roomCodeTag = document.getElementById('room-code-tag');
  const interactPrompt = document.getElementById('interact-prompt');
  const promptText = document.getElementById('prompt-text');
  const btnSabotage = document.getElementById('btn-sabotage');
  const sabotageModal = document.getElementById('sabotage-modal');
  const crisisBanner = document.getElementById('crisis-banner');
  const crisisBannerText = document.getElementById('crisis-banner-text');
  const sabotageCooldownTag = document.getElementById('sabotage-cooldown-tag');

  let sabotageCooldown = 0;
  let activeSabotage = null;
  let crisisInterval = null;
  let currentNearbySabotageFix = null;
  let isViewingCameras = false;
  let isSomeoneWatchingCameras = false;

  const SABOTAGE_STATIONS = {
    lights: [
      { room: 'Electrical', x: 2450, y: 1960, name: 'Breaker Switchbox' }
    ],
    reactor: [
      { room: 'Reactor', x: 860, y: 1250, name: 'Stabilizer Console' }
    ],
    o2: [
      { room: 'O2', x: 4220, y: 1100, name: 'O2 Purge Keypad' },
      { room: 'Admin', x: 4050, y: 2100, name: 'Admin Purge Keypad' }
    ],
    comms: [
      { room: 'Communications', x: 4050, y: 2750, name: 'Comms Dish Console' }
    ]
  };

  const VENT_NETWORKS = [
    // 0. Cafeteria - Admin - Hallway
    [
      { id: '66', x: 3961, y: 887, name: 'Cafeteria' },
      { id: '407', x: 3756, y: 2039, name: 'Admin' },
      { id: '68', x: 4574, y: 1626, name: 'Hallway' }
    ],
    // 1. Electrical - Medbay - Security
    [
      { id: '72', x: 2184, y: 1351, name: 'MedBay' },
      { id: '738', x: 2284, y: 1810, name: 'Electrical' },
      { id: '75', x: 1955, y: 1655, name: 'Security' }
    ],
    // 2. Reactor - Upper Engine - Lower Engine
    [
      { id: '77', x: 864, y: 1254, name: 'Reactor (Top)' },
      { id: '73', x: 1650, y: 551, name: 'Upper Engine' },
      { id: '76', x: 994, y: 1719, name: 'Reactor (Bottom)' },
      { id: '74', x: 1627, y: 2495, name: 'Lower Engine' }
    ],
    // 3. Weapons - Navigation - Shields
    [
      { id: '67', x: 4507, y: 459, name: 'Weapons' },
      { id: '69', x: 5366, y: 1237, name: 'Navigation (Top)' },
      { id: '70', x: 5367, y: 1619, name: 'Navigation (Bottom)' },
      { id: '71', x: 4567, y: 2539, name: 'Shields' }
    ]
  ];
  let activeVentArrows = [];
  const securityCamsImg = new Image();
  securityCamsImg.src = 'assets/Maps/security_cameras.png';

  // Modals
  const mainMenuModal = document.getElementById('main-menu-modal');
  const enterCodeModal = document.getElementById('enter-code-modal');
  const publicRoomsModal = document.getElementById('public-rooms-modal');
  const createRoomModal = document.getElementById('create-room-modal');
  const roleRevealModal = document.getElementById('role-reveal-modal');
  const meetingModal = document.getElementById('meeting-modal');
  const ejectionModal = document.getElementById('ejection-modal');
  const gameoverModal = document.getElementById('gameover-modal');
  const mapModal = document.getElementById('map-modal');
  const securityCamsModal = document.getElementById('security-cameras-modal');

  // Task Modals
  const wiringModal = document.getElementById('task-modal-wiring');
  const cardModal = document.getElementById('task-modal-card');
  const asteroidsModal = document.getElementById('task-modal-asteroids');
  const downloadModal = document.getElementById('task-modal-download');
  const divertModal = document.getElementById('task-modal-divert');
  const garbageModal = document.getElementById('task-modal-garbage');
  const reactorModal = document.getElementById('task-modal-reactor');
  const steeringModal = document.getElementById('task-modal-steering');
  const medbayScanModal = document.getElementById('task-modal-medbay-scan');
  const fuelModal = document.getElementById('task-modal-fuel');

  // Dropship Lobby Elements
  const dropshipImage = new Image();
  dropshipImage.src = 'assets/Maps/dropship.png';
  const dropshipLaptopImg = new Image();
  dropshipLaptopImg.src = 'assets/Maps/dropship_laptop.png'; // Green crate
  const dropshipCrateImg = new Image();
  dropshipCrateImg.src = 'assets/Maps/dropship_crate.png';   // Laptop sprite
  let isNearDropshipLaptop = false;
  let lastMovePacketTime = 0;

  const dropshipHud = document.getElementById('dropship-hud');
  const dropshipRoomCode = document.getElementById('dropship-room-code');
  const dropshipPlayerCount = document.getElementById('dropship-player-count');
  const dropshipPrivacyBtn = document.getElementById('btn-dropship-privacy');
  const dropshipHostTag = document.getElementById('dropship-host-tag');
  const dropshipHostName = document.getElementById('dropship-host-name');
  const btnDropshipStart = document.getElementById('btn-dropship-start');
  const dropshipGuestMsg = document.getElementById('dropship-guest-msg');
  const btnDropshipCustomize = document.getElementById('btn-dropship-customize');
  const customizeModal = document.getElementById('customize-modal');
  const btnCloseCustomize = document.getElementById('btn-close-customize');

  // Resize canvas
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Load Map & Collision Data
  fetch('map_data.json')
    .then(res => res.json())
    .then(data => {
      mapData = data;
      // Populate collision array from all authentic Skeld geometry layers
      mapData.collision = [
        ...(mapData.walls || []),
        ...(mapData.obstacles || []),
        ...(mapData.tables || []),
        ...(mapData.props || [])
      ];
      // Enrich mapData with authentic Skeld tasks & Security console
      const extraTasks = [
        { id: 'task-garbage-cafeteria', name: 'Cafeteria: Empty Garbage', x: 3950, y: 1350, w: 40, h: 40 },
        { id: 'task-reactor-simon', name: 'Reactor: Start Reactor', x: 820, y: 1320, w: 40, h: 40 },
        { id: 'task-nav-steering', name: 'Navigation: Stabilize Steering', x: 5460, y: 1450, w: 40, h: 40 },
        { id: 'task-medbay-scan', name: 'MedBay: Submit Scan', x: 2360, y: 1200, w: 40, h: 40 },
        { id: 'task-security-cams', name: 'Security: Surveillance Cameras', x: 1756, y: 1062, w: 50, h: 40, isCamera: true }
      ];
      extraTasks.forEach(et => {
        if (!mapData.tasks.some(t => t.id === et.id)) {
          mapData.tasks.push(et);
        }
      });
    })
    .catch(err => console.error('Failed to load map data:', err));

  mapImage.src = 'assets/Maps/map2.png';

  // Audio helper
  function loadSound(path) {
    const audio = new Audio(path);
    audio.preload = 'auto';
    return audio;
  }

  function playSound(audio) {
    if (!soundEnabled || !audio) return;
    try {
      const clone = audio.cloneNode();
      clone.volume = 0.8;
      clone.play().catch(() => {});
    } catch (e) {}
  }

  // Preload Audio
  sounds.kill = loadSound('assets/Sounds/Kill/imposter_kill.wav');
  sounds.killVictim = loadSound('assets/Sounds/Kill/imposter_kill_victim.wav');
  sounds.emergency = loadSound('assets/Sounds/General/alarm_emergencymeeting.wav');
  sounds.report = loadSound('assets/Sounds/General/report_Bodyfound.wav');
  sounds.roundstart = loadSound('assets/Sounds/General/roundstart.wav');
  sounds.vent = loadSound('assets/Sounds/General/vent.wav');
  sounds.taskComplete = loadSound('assets/Sounds/General/task_complete.wav');
  sounds.victoryCrew = loadSound('assets/Sounds/General/victory_crew.wav');
  sounds.victoryImp = loadSound('assets/Sounds/General/victory_impostor.wav');
  sounds.doorLock = loadSound('assets/Sounds/UI/votescreen_locking.wav');
  sounds.keypress = loadSound('assets/Sounds/UI/keypress.wav');
  sounds.footsteps = [];
  for (let i = 1; i <= 8; i++) {
    sounds.footsteps.push(loadSound('assets/Sounds/Footsteps/Footstep0' + i + '.wav'));
  }

  // Preload Astronaut Sprites for all colors (with dynamic tint generation for Pink & single-frame colors)
  COLORS.forEach(c => {
    const lower = c.toLowerCase();
    sprites[c] = {
      down: [],
      left: [],
      right: [],
      up: [],
      ghost: {
        left: new Image(),
        right: new Image()
      }
    };
    sprites[c].ghost.left.src = 'assets/Images/Player/' + c + '/' + lower + '_ghost/step1_left.png';
    sprites[c].ghost.right.src = 'assets/Images/Player/' + c + '/' + lower + '_ghost/step1_right.png';

    // Authentic standing corpse with bone (Photo 3)
    deadCorpseSprites[c] = new Image();
    deadCorpseSprites[c].src = 'assets/Images/Player/Dead/Dead' + lower + '.png';

    for (let f = 1; f <= 18; f++) {
      const imgD = new Image();
      imgD.src = 'assets/Images/Player/' + c + '/' + lower + '_down_walk/step' + f + '.png';
      sprites[c].down.push(imgD);

      const frameNum = (f <= 17 || ['Pink', 'Purple', 'Black', 'White', 'Brown'].includes(c)) ? f : 1;

      const imgL = new Image();
      imgL.src = 'assets/Images/Player/' + c + '/' + lower + '_left_walk/step' + frameNum + '.png';
      sprites[c].left.push(imgL);

      const imgR = new Image();
      imgR.src = 'assets/Images/Player/' + c + '/' + lower + '_right_walk/step' + frameNum + '.png';
      sprites[c].right.push(imgR);

      const imgU = new Image();
      imgU.src = 'assets/Images/Player/' + c + '/' + lower + '_up_walk/step' + frameNum + '.png';
      sprites[c].up.push(imgU);
    }
  });

  // Connect WebSocket
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + window.location.host);

      // ==================== SCHOOL-FRIENDLY DEVICE & FINGERPRINT ID ====================
  function getPersistentDeviceId() {
    let id = null;
    try {
      id = localStorage.getItem('amongus_device_uuid');
      if (!id) {
        const match = document.cookie.match(/amongus_device_uuid=([^;]+)/);
        if (match) id = match[1];
      }
      if (!id) {
        id = 'pc_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem('amongus_device_uuid', id);
        document.cookie = 'amongus_device_uuid=' + id + '; max-age=315360000; path=/; SameSite=Lax';
      }
    } catch(e) {
      id = 'pc_fallback_' + Math.random().toString(36).substring(2, 9);
    }
    return id;
  }

  function getDeviceFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 40;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = '#f60';
        ctx.fillRect(100, 1, 50, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('AmongUs#School#FP', 2, 15);
      }
      const cData = canvas.toDataURL();

      let glRenderer = '';
      try {
        const gl = document.createElement('canvas').getContext('webgl');
        if (gl) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          if (dbg) glRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
        }
      } catch(e) {}

      const raw = [
        cData.slice(-40),
        screen.width,
        screen.height,
        screen.colorDepth,
        navigator.hardwareConcurrency || 4,
        navigator.platform || '',
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        glRenderer
      ].join('###');

      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
      }
      const shortGpu = glRenderer ? '_' + glRenderer.replace(/[^a-zA-Z0-9]/g, '').slice(-8) : '';
      return 'fp_' + Math.abs(hash).toString(36) + shortGpu;
    } catch(e) {
      return 'fp_basic_' + screen.width + 'x' + screen.height;
    }
  }
  // ==================================================================================

      ws.onopen = () => {
      console.log('Connected to Among Us Server');
      // Send device identification so bans only affect the specific PC in school lab!
      try {
        ws.send(JSON.stringify({
          type: 'CLIENT_IDENTIFY',
          deviceId: getPersistentDeviceId(),
          fingerprint: getDeviceFingerprint()
        }));
      } catch(e) {}

      // Auto login if credentials exist in localStorage
      const savedAuth = localStorage.getItem('amongus_auth_creds');
      if (savedAuth) {
        try {
          const creds = JSON.parse(savedAuth);
          if (creds && creds.username && creds.password) {
            ws.send(JSON.stringify({
              type: 'LOGIN',
              username: creds.username,
              password: creds.password
            }));
          }
        } catch(e) {}
      }

    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      console.warn('Disconnected from server. Reconnecting in 2s...');
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
    };
  }
  connectWebSocket();

  // Restore saved player name from localStorage
  const savedPlayerName = localStorage.getItem('among_us_saved_name');
  const nameInputEl = document.getElementById('player-name-input');
  if (nameInputEl) {
    if (savedPlayerName) {
      nameInputEl.value = savedPlayerName;
    }
    nameInputEl.addEventListener('input', () => {
      const val = nameInputEl.value.trim();
      if (val && val.toLowerCase() !== 'player') {
        localStorage.setItem('among_us_saved_name', val);
      }
    });
  }

  function validatePlayerName() {
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name || name.toLowerCase() === 'player') {
      alert('Lütfen geçerli bir oyuncu ismi girin! İsim "Player" veya boş bırakılamaz.\n(Please enter a custom player name before joining or creating a room)');
      if (menuPrimaryNav && !menuPrimaryNav.classList.contains('hidden') && menuOnlineNav) {
        menuPrimaryNav.classList.add('hidden');
        menuOnlineNav.classList.remove('hidden');
      }
      if (nameInput) {
        nameInput.focus();
        nameInput.classList.add('input-error-pulse');
        setTimeout(() => nameInput.classList.remove('input-error-pulse'), 1500);
      }
      return false;
    }
    localStorage.setItem('among_us_saved_name', name);
    return true;
  }

  function getProfile() {
    const nameInput = document.getElementById('player-name-input');
    const colorSelect = document.getElementById('player-color-select');
    const rawName = nameInput ? nameInput.value.trim() : '';
    const chosenName = (rawName && rawName.toLowerCase() !== 'player') ? rawName : (localStorage.getItem('among_us_saved_name') || 'Crewmate');
    return {
      name: chosenName,
      color: (colorSelect && colorSelect.value) || 'Red'
    };
  }

  // ================= 1. MAIN MENU & ONLINE SETUP =================
  const menuPrimaryNav = document.getElementById('menu-primary-nav');
  const menuOnlineNav = document.getElementById('menu-online-nav');
  const btnOnline = document.getElementById('btn-menu-online');
  const btnOnlineBack = document.getElementById('btn-online-back');
  const btnFreeplay = document.getElementById('btn-menu-freeplay');
  const btnHelp = document.getElementById('btn-menu-help');
  const btnCredits = document.getElementById('btn-menu-credits');
  const btnSettings = document.getElementById('btn-menu-settings');
  const btnMenuQuit = document.getElementById('btn-menu-quit');

  const helpModal = document.getElementById('help-modal');

  if (btnOnline) {
    btnOnline.addEventListener('click', () => {
      if (menuPrimaryNav) menuPrimaryNav.classList.add('hidden');
      if (menuOnlineNav) menuOnlineNav.classList.remove('hidden');
    });
  }

  if (btnOnlineBack) {
    btnOnlineBack.addEventListener('click', () => {
      if (menuOnlineNav) menuOnlineNav.classList.add('hidden');
      if (menuPrimaryNav) menuPrimaryNav.classList.remove('hidden');
    });
  }

  function safeSendWs(msgObj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msgObj));
      return true;
    }
    console.warn('WS not open, queuing message:', msgObj.type);
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      connectWebSocket();
    }
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (ws && ws.readyState === WebSocket.OPEN) {
        clearInterval(interval);
        ws.send(JSON.stringify(msgObj));
      } else if (tries > 25) {
        clearInterval(interval);
      }
    }, 100);
    return false;
  }

  function enterLocalFreeplay() {
    isFreeplayMode = true;
    const prof = getProfile();
    const code = 'FREEPLAY_' + Math.random().toString(36).substring(2, 6).toUpperCase();
    currentRoomCode = code;
    isRoomHost = true;
    localPlayer.id = 'p_host';
    localPlayer.name = prof.name;
    localPlayer.color = prof.color;
    localPlayer.isAlive = true;
    localPlayer.isImpostor = (Math.random() < 0.25);
    localPlayer.x = 613;
    localPlayer.y = 460;
    gameState = 'LOBBY';

    // Add 3 dummy practice players
    players.clear();
    const dummyPositions = [
      { id: 'dummy_0', name: 'Dummy Blue', color: 'Blue', x: 480, y: 520 },
      { id: 'dummy_1', name: 'Dummy Pink', color: 'Pink', x: 740, y: 460 },
      { id: 'dummy_2', name: 'Dummy Green', color: 'Green', x: 680, y: 350 }
    ];
    dummyPositions.forEach(dp => {
      players.set(dp.id, {
        id: dp.id,
        name: dp.name,
        color: dp.color,
        hat: 'none',
        skin: 'default',
        x: dp.x,
        y: dp.y,
        dir: 'down',
        walking: false,
        frame: 1,
        isAlive: true,
        isImpostor: false,
        isHost: false
      });
    });

    if (mainMenuModal) mainMenuModal.classList.add('hidden');
    if (publicRoomsModal) publicRoomsModal.classList.add('hidden');
    if (enterCodeModal) enterCodeModal.classList.add('hidden');
    if (dropshipHud) dropshipHud.classList.remove('hidden');
    if (dropshipRoomCode) dropshipRoomCode.innerText = currentRoomCode;
    if (roomCodeTag) roomCodeTag.innerText = 'CODE: ' + currentRoomCode;
    if (btnDropshipStart) btnDropshipStart.classList.remove('hidden');
    if (dropshipGuestMsg) dropshipGuestMsg.classList.add('hidden');
    if (dropshipHostTag) dropshipHostTag.innerHTML = 'HOST: <span style="color:#fbbf24;">' + localPlayer.name + '</span> (You!)';
  }

  if (btnFreeplay) {
    btnFreeplay.addEventListener('click', () => {
      if (!validatePlayerName()) return;
      isFreeplayMode = true;
      const prof = getProfile();
      safeSendWs({
        type: 'START_FREEPLAY',
        name: prof.name,
        color: prof.color
      });
      // Guarantees entering Freeplay immediately even if network lags
      setTimeout(() => {
        if (gameState !== 'LOBBY' && gameState !== 'PLAYING') {
          enterLocalFreeplay();
        }
      }, 500);
    });
  }

  if (btnHelp) {
    btnHelp.addEventListener('click', () => {
      currentHelpSlide = 1;
      updateHelpSlide();
      if (helpModal) helpModal.classList.remove('hidden');
    });
  }

  if (btnCredits) {
    btnCredits.addEventListener('click', () => {
      alert('Among Us Web Remake\nInspired by Innersloth & Fan-Made Projects\nEnjoy playing!');
    });
  }

  const btnCloseHelp = document.getElementById('btn-close-help');
  if (btnCloseHelp) {
    btnCloseHelp.addEventListener('click', () => {
      if (helpModal) helpModal.classList.add('hidden');
    });
  }

  const btnHelpPrev = document.getElementById('btn-help-prev');
  const btnHelpNext = document.getElementById('btn-help-next');

  if (btnHelpPrev) {
    btnHelpPrev.addEventListener('click', () => {
      if (currentHelpSlide > 1) {
        currentHelpSlide--;
        updateHelpSlide();
      }
    });
  }
  if (btnHelpNext) {
    btnHelpNext.addEventListener('click', () => {
      if (currentHelpSlide < totalHelpSlides) {
        currentHelpSlide++;
        updateHelpSlide();
      }
    });
  }

  function updateHelpSlide() {
    if (helpSlideImg) helpSlideImg.src = 'assets/Images/help/help' + currentHelpSlide + '.png';
    if (helpSlideNum) helpSlideNum.innerText = currentHelpSlide;
  }

  // Settings
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      openSettingsModal(isRoomHost);
    });
  }

  // Quit Game
  if (btnMenuQuit) {
    btnMenuQuit.addEventListener('click', () => {
      if (confirm('Exit Among Us?')) {
        window.location.reload();
      }
    });
  }

  // Host Game Creation Setup (Questions Dialog)
  const btnHostGame = document.getElementById('btn-host-game');
  const hostPills = document.querySelectorAll('#host-impostor-pills .choice-pill');
  const createMaxPlayersSelect = document.getElementById('create-max-players');

  function updateHostImpostorPills(maxPlayers) {
    let maxAllowed = 1;
    if (maxPlayers >= 9) maxAllowed = 3;
    else if (maxPlayers >= 7) maxAllowed = 2;
    else maxAllowed = 1;

    hostPills.forEach(pill => {
      const imp = parseInt(pill.getAttribute('data-imp')) || 1;
      if (imp > maxAllowed) {
        pill.classList.add('disabled');
        pill.setAttribute('disabled', 'true');
      } else {
        pill.classList.remove('disabled');
        pill.removeAttribute('disabled');
      }
    });

    if (selectedHostImpostors > maxAllowed) {
      selectedHostImpostors = maxAllowed;
      hostPills.forEach(p => {
        if (parseInt(p.getAttribute('data-imp')) === maxAllowed) p.classList.add('active');
        else p.classList.remove('active');
      });
    }
  }

  if (createMaxPlayersSelect) {
    createMaxPlayersSelect.addEventListener('change', () => {
      updateHostImpostorPills(parseInt(createMaxPlayersSelect.value) || 20);
    });
    updateHostImpostorPills(parseInt(createMaxPlayersSelect.value) || 20);
  }

  if (btnHostGame) {
    btnHostGame.addEventListener('click', () => {
      if (!validatePlayerName()) return;
      if (createRoomModal) {
        createRoomModal.classList.remove('hidden');
        if (createMaxPlayersSelect) updateHostImpostorPills(parseInt(createMaxPlayersSelect.value) || 20);
      }
    });
  }

  // Host Impostor Pills click
  hostPills.forEach(pill => {
    pill.addEventListener('click', () => {
      if (pill.classList.contains('disabled')) return;
      hostPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedHostImpostors = parseInt(pill.getAttribute('data-imp')) || 1;
    });
  });

  const btnConfirmCreateRoom = document.getElementById('btn-confirm-create-room');
  if (btnConfirmCreateRoom) {
    btnConfirmCreateRoom.addEventListener('click', () => {
      if (!validatePlayerName()) return;
      const prof = getProfile();
      const maxP = parseInt(document.getElementById('create-max-players').value) || 20;
      currentRoomMaxPlayers = maxP;
      if (dropshipPlayerCount) dropshipPlayerCount.innerText = '1/' + maxP;
      safeSendWs({
        type: 'CREATE_ROOM',
        name: prof.name,
        color: prof.color,
        impostors: selectedHostImpostors,
        maxPlayers: maxP,
        isPublic: true
      });
      if (createRoomModal) createRoomModal.classList.add('hidden');
      setTimeout(() => {
        if (gameState !== 'LOBBY' && gameState !== 'PLAYING') {
          enterLocalFreeplay();
        }
      }, 1000);
    });
  }

  const btnCancelCreateRoom = document.getElementById('btn-cancel-create-room');
  const btnCloseCreateRoom = document.getElementById('btn-close-create-room');
  if (btnCancelCreateRoom) {
    btnCancelCreateRoom.addEventListener('click', () => {
      if (createRoomModal) createRoomModal.classList.add('hidden');
    });
  }
  if (btnCloseCreateRoom) {
    btnCloseCreateRoom.addEventListener('click', () => {
      if (createRoomModal) createRoomModal.classList.add('hidden');
    });
  }

  // Online Submenu Action: Find Public Games
  const btnFindGame = document.getElementById('btn-find-game');
  if (btnFindGame) {
    btnFindGame.addEventListener('click', () => {
      if (!validatePlayerName()) return;
      if (publicRoomsModal) publicRoomsModal.classList.remove('hidden');
      requestRoomsList();
    });
  }

  const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
  if (btnRefreshRooms) {
    btnRefreshRooms.addEventListener('click', requestRoomsList);
  }
  const btnCloseRooms = document.getElementById('btn-close-rooms');
  if (btnCloseRooms) {
    btnCloseRooms.addEventListener('click', () => {
      if (publicRoomsModal) publicRoomsModal.classList.add('hidden');
    });
  }

  function requestRoomsList() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'LIST_ROOMS' }));
    } else {
      connectWebSocket();
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'LIST_ROOMS' }));
      }, 500);
    }
  }

  window.joinSpecificRoom = function(code) {
    if (!validatePlayerName()) return;
    const prof = getProfile();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode: code,
        name: prof.name,
        color: prof.color
      }));
    }
    if (publicRoomsModal) publicRoomsModal.classList.add('hidden');
  };

  // Online Submenu Action: Private Game (Enter Code)
  const btnEnterCode = document.getElementById('btn-enter-code');
  if (btnEnterCode) {
    btnEnterCode.addEventListener('click', () => {
      if (!validatePlayerName()) return;
      if (enterCodeModal) enterCodeModal.classList.remove('hidden');
      const input = document.getElementById('room-code-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    });
  }

  const btnCancelCode = document.getElementById('btn-cancel-code');
  if (btnCancelCode) {
    btnCancelCode.addEventListener('click', () => {
      if (enterCodeModal) enterCodeModal.classList.add('hidden');
    });
  }

  const btnSubmitCode = document.getElementById('btn-submit-code');
  if (btnSubmitCode) {
    btnSubmitCode.addEventListener('click', () => {
      if (!validatePlayerName()) return;
      const input = document.getElementById('room-code-input');
      const code = input ? input.value.trim().toUpperCase() : '';
      if (!code) return;
      const prof = getProfile();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'JOIN_ROOM',
          roomCode: code,
          name: prof.name,
          color: prof.color
        }));
      }
      if (enterCodeModal) enterCodeModal.classList.add('hidden');
    });
  }

  // ================= 2. GAME SETTINGS MODAL (EDIT & VIEW) =================
  const gameSettingsModal = document.getElementById('game-settings-modal');
  const btnSettingsEdit = document.getElementById('btn-settings-edit');
  const btnSettingsView = document.getElementById('btn-settings-view');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnApplySettings = document.getElementById('btn-apply-settings');
  const settingsModeLabel = document.getElementById('settings-mode-label');
  const btnDropshipSettings = document.getElementById('btn-dropship-settings');

  function openSettingsModal(isEditMode) {
    if (!gameSettingsModal) return;
    const canEdit = isEditMode && isRoomHost;
    gameSettingsModal.classList.remove('hidden');
    if (settingsModeLabel) settingsModeLabel.innerText = canEdit ? 'EDIT' : 'VIEW';
    const selects = gameSettingsModal.querySelectorAll('.setting-select');
    selects.forEach(s => s.disabled = !canEdit);
    if (btnApplySettings) {
      btnApplySettings.style.display = canEdit ? 'block' : 'none';
    }

    // Among Us authentic limit for Game Settings
    const settingImp = document.getElementById('setting-impostors');
    if (settingImp) {
      const cap = currentRoomMaxPlayers || 20;
      let maxAllowed = 1;
      if (cap >= 9) maxAllowed = 3;
      else if (cap >= 7) maxAllowed = 2;
      else maxAllowed = 1;

      Array.from(settingImp.options).forEach(opt => {
        const val = parseInt(opt.value);
        if (val > maxAllowed) {
          opt.disabled = true;
          opt.hidden = true;
        } else {
          opt.disabled = false;
          opt.hidden = false;
        }
      });
      if (parseInt(settingImp.value) > maxAllowed) {
        settingImp.value = String(maxAllowed);
      }
    }
  }

  if (btnSettingsEdit) {
    btnSettingsEdit.addEventListener('click', () => {
      if (!isRoomHost) {
        alert('Sadece oda sahibi ayarları düzenleyebilir! (Only the host can edit game settings)');
        openSettingsModal(false);
      } else {
        openSettingsModal(true);
      }
    });
  }

  if (btnSettingsView) {
    btnSettingsView.addEventListener('click', () => {
      openSettingsModal(false);
    });
  }

  if (btnDropshipSettings) {
    btnDropshipSettings.addEventListener('click', () => {
      openSettingsModal(isRoomHost);
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      if (gameSettingsModal) gameSettingsModal.classList.add('hidden');
    });
  }

  if (btnApplySettings) {
    btnApplySettings.addEventListener('click', () => {
      if (!isRoomHost) return;
      const imp = parseInt(document.getElementById('setting-impostors').value) || 1;
      const spd = parseFloat(document.getElementById('setting-speed').value) || 1.25;
      const cd = parseInt(document.getElementById('setting-kill-cd').value) || 25;
      const meet = parseInt(document.getElementById('setting-meetings').value) || 1;
      const vTime = parseInt(document.getElementById('setting-voting-time').value) || 60;
      const vis = document.getElementById('setting-visual-tasks').value === 'true';

      localPlayer.speed = 340 * spd;
      localPlayer.killCooldown = cd;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'UPDATE_SETTINGS',
          settings: {
            impostors: imp,
            speed: spd,
            killCd: cd,
            meetings: meet,
            votingTime: vTime,
            visualTasks: vis
          }
        }));
      }
      if (gameSettingsModal) gameSettingsModal.classList.add('hidden');
    });
  }

  // ================= 3. CHARACTER CUSTOMIZATION (LAPTOP / PHOTO 5) =================
  let activeCustTab = 'color';
  const tabCustColor = document.getElementById('tab-cust-color');
  const tabCustHat = document.getElementById('tab-cust-hat');
  const tabCustSkin = document.getElementById('tab-cust-skin');
  const gridColor = document.getElementById('customize-color-grid');
  const gridHat = document.getElementById('customize-hat-grid');
  const gridSkin = document.getElementById('customize-skin-grid');

  function openCustomizeModal() {
    if (!customizeModal) return;
    customizeModal.classList.remove('hidden');
    setCustTab(activeCustTab);
    renderColorGrid();
    renderHatGrid();
    renderSkinGrid();
    updateCustomizePreview();
  }

  function setCustTab(tab) {
    activeCustTab = tab;
    [tabCustColor, tabCustHat, tabCustSkin].forEach(b => {
      if (b) b.classList.remove('active');
    });
    [gridColor, gridHat, gridSkin].forEach(g => {
      if (g) g.classList.add('hidden');
    });

    if (tab === 'color') {
      if (tabCustColor) tabCustColor.classList.add('active');
      if (gridColor) gridColor.classList.remove('hidden');
    } else if (tab === 'hat') {
      if (tabCustHat) tabCustHat.classList.add('active');
      if (gridHat) gridHat.classList.remove('hidden');
    } else if (tab === 'skin') {
      if (tabCustSkin) tabCustSkin.classList.add('active');
      if (gridSkin) gridSkin.classList.remove('hidden');
    }
  }

  if (tabCustColor) tabCustColor.onclick = () => setCustTab('color');
  if (tabCustHat) tabCustHat.onclick = () => setCustTab('hat');
  if (tabCustSkin) tabCustSkin.onclick = () => setCustTab('skin');

  function renderColorGrid() {
    if (!gridColor) return;
    gridColor.innerHTML = '';

    const takenColors = new Set();
    players.forEach(p => {
      if (p.id !== localPlayer.id && p.color) {
        takenColors.add(p.color);
      }
    });

    COLORS.forEach(c => {
      const tile = document.createElement('div');
      const isTaken = takenColors.has(c);
      const isSelf = (localPlayer.color === c);

      tile.className = 'customize-color-tile ' + (isSelf ? 'selected ' : '') + (isTaken && !isSelf ? 'disabled-taken' : '');
      tile.style.backgroundColor = COLOR_HEX[c];
      tile.title = isTaken && !isSelf ? `${c} (Already chosen by another crewmate)` : c;

      if (isTaken && !isSelf) {
        tile.innerHTML = '<span class="taken-x">✕</span>';
      } else {
        tile.onclick = () => {
          localPlayer.color = c;
          sendCustomization();
          updateCustomizePreview();
          renderColorGrid();
        };
      }
      gridColor.appendChild(tile);
    });
  }

  function renderHatGrid() {
    if (!gridHat) return;
    gridHat.innerHTML = '';
    HATS.forEach(h => {
      const tile = document.createElement('div');
      tile.className = 'customize-item-tile ' + (localPlayer.hat === h.id ? 'selected' : '');
      tile.innerHTML = '<div class="item-icon">' + h.icon + '</div><div class="item-name">' + h.name + '</div>';
      tile.onclick = () => {
        localPlayer.hat = h.id;
        sendCustomization();
        updateCustomizePreview();
        renderHatGrid();
      };
      gridHat.appendChild(tile);
    });
  }

  function renderSkinGrid() {
    if (!gridSkin) return;
    gridSkin.innerHTML = '';
    SKINS.forEach(s => {
      const tile = document.createElement('div');
      tile.className = 'customize-item-tile ' + (localPlayer.skin === s.id ? 'selected' : '');
      tile.innerHTML = '<div class="item-icon">' + s.icon + '</div><div class="item-name">' + s.name + '</div>';
      tile.onclick = () => {
        localPlayer.skin = s.id;
        sendCustomization();
        updateCustomizePreview();
        renderSkinGrid();
      };
      gridSkin.appendChild(tile);
    });
  }

  function sendCustomization() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'CUSTOMIZE',
        color: localPlayer.color,
        hat: localPlayer.hat,
        skin: localPlayer.skin
      }));
    }
  }

  function updateCustomizePreview() {
    const box = document.getElementById('customize-avatar-preview');
    if (!box) return;
    box.innerHTML = '';
    const prevCanvas = document.createElement('canvas');
    prevCanvas.width = 160;
    prevCanvas.height = 170;
    const pctx = prevCanvas.getContext('2d');

    const spriteSet = sprites[localPlayer.color];
    const imgD = (spriteSet && spriteSet.down && spriteSet.down[0]) ? spriteSet.down[0] : null;
    const imgR = (spriteSet && spriteSet.right && spriteSet.right[0]) ? spriteSet.right[0] : null;
    const px = 80;
    const py = 135;

    let drawn = false;
    if (imgD && imgD.complete && imgD.naturalWidth > 0) {
      pctx.drawImage(imgD, px - 38, py - 68, 76, 97);
      drawn = true;
    } else if (imgR && imgR.complete && imgR.naturalWidth > 0) {
      pctx.drawImage(imgR, px - 33, py - 60, 66, 84);
      drawn = true;
    } else {
      if (imgD && !imgD.complete) {
        imgD.onload = () => updateCustomizePreview();
      }
    }

    if (!drawn) {
      drawFallbackAstronaut(pctx, px, py - 10, localPlayer.color, 'down', true);
    }
    drawSkin(pctx, localPlayer.skin, px, py - 10);
    drawHat(pctx, localPlayer.hat, px, py - 10);

    box.appendChild(prevCanvas);
  }

  if (btnCloseCustomize) {
    btnCloseCustomize.onclick = () => {
      customizeModal.classList.add('hidden');
    };
  }

  // ================= 4. DROPSHIP BUTTONS & CHAT =================
  const btnDropshipLeave = document.getElementById('btn-dropship-leave');
  if (btnDropshipLeave) {
    btnDropshipLeave.addEventListener('click', () => {
      if (confirm('Leave this room and return to menu?')) {
        window.location.reload();
      }
    });
  }

  const btnDropshipCopy = document.getElementById('btn-dropship-copy');
  if (btnDropshipCopy) {
    btnDropshipCopy.addEventListener('click', () => {
      if (currentRoomCode) {
        navigator.clipboard.writeText(currentRoomCode).then(() => {
          btnDropshipCopy.innerText = '✓';
          setTimeout(() => { btnDropshipCopy.innerText = '📋'; }, 1500);
        }).catch(() => {
          prompt('Room Code:', currentRoomCode);
        });
      }
    });
  }

  if (dropshipPrivacyBtn) {
    dropshipPrivacyBtn.addEventListener('click', () => {
      if (!isRoomHost) return;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'TOGGLE_PRIVACY' }));
      }
    });
  }

  if (btnDropshipStart) {
    btnDropshipStart.addEventListener('click', () => {
      if (!isRoomHost) return;
      const count = players.size + 1;
      if (!currentRoomCode.startsWith('FREEPLAY') && count < 4 && ws && ws.readyState === WebSocket.OPEN) {
        alert('Oyunu başlatmak için en az 4 oyuncu gereklidir!\n(At least 4 players required to start multiplayer game)');
        return;
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'START_GAME' }));
      } else {
        // Standalone offline start (ideal for GitHub Pages & School PC!)
        handleServerMessage({
          type: 'GAME_STARTED',
          map: 'THE SKELD',
          role: localPlayer.isImpostor ? 'IMPOSTOR' : 'CREWMATE',
          taskProgress: 0,
          taskTotal: 5,
          players: [
            { id: localPlayer.id, name: localPlayer.name, color: localPlayer.color, isImpostor: localPlayer.isImpostor, isAlive: true, x: 3303, y: 1017 },
            { id: 'dummy_0', name: 'Dummy Blue', color: 'Blue', isImpostor: false, isAlive: true, x: 3200, y: 1017 },
            { id: 'dummy_1', name: 'Dummy Pink', color: 'Pink', isImpostor: false, isAlive: true, x: 3400, y: 1017 },
            { id: 'dummy_2', name: 'Dummy Green', color: 'Green', isImpostor: false, isAlive: true, x: 3300, y: 1100 }
          ]
        });
      }
    });
  }

  if (btnDropshipCustomize) {
    btnDropshipCustomize.addEventListener('click', () => {
      openCustomizeModal();
    });
  }

  // Chat Drawer toggle
  const chatDrawer = document.getElementById('meeting-chat-drawer');
  const btnDropshipChat = document.getElementById('btn-dropship-chat');
  const btnTabletChat = document.getElementById('btn-tablet-chat');
  const btnCloseChat = document.getElementById('btn-close-chat');
  const btnSendChat = document.getElementById('btn-send-chat');
  const chatInput = document.getElementById('chat-input');
  const dropshipChatBadge = document.getElementById('dropship-chat-badge');
  const chatNotificationBadge = document.getElementById('chat-notification-badge');

  function toggleChatDrawer() {
    if (!chatDrawer) return;
    chatDrawer.classList.toggle('hidden');
    if (!chatDrawer.classList.contains('hidden')) {
      if (dropshipChatBadge) dropshipChatBadge.classList.add('hidden');
      if (chatNotificationBadge) chatNotificationBadge.classList.add('hidden');
      if (chatInput) chatInput.focus();
    }
  }

  if (btnDropshipChat) btnDropshipChat.onclick = toggleChatDrawer;
  if (btnTabletChat) btnTabletChat.onclick = toggleChatDrawer;
  if (btnCloseChat) {
    btnCloseChat.onclick = () => {
      if (chatDrawer) chatDrawer.classList.add('hidden');
    };
  }

  function sendChatMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'CHAT', text }));
    }
    chatInput.value = '';
  }

  if (btnSendChat) btnSendChat.onclick = sendChatMessage;
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }

  function addChatMessage(sender, color, text, isDead) {
    const chatBox = document.getElementById('chat-messages');
    if (!chatBox) return;
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg';
    msgEl.innerHTML = '<b style="color: ' + (COLOR_HEX[color] || '#38bdf8') + ';">' + escapeHtml(sender) + (isDead ? ' (Ghost)' : '') + ':</b> ' + escapeHtml(text);
    chatBox.appendChild(msgEl);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (chatDrawer && chatDrawer.classList.contains('hidden')) {
      if (dropshipChatBadge) dropshipChatBadge.classList.remove('hidden');
      if (chatNotificationBadge) chatNotificationBadge.classList.remove('hidden');
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  // ================= 5. SERVER MESSAGES DISPATCHER =================
  function handleServerMessage(msg) {
    switch (msg.type) {
      
      // ================= AUTH & ADMIN WS MESSAGE HANDLERS =================
      case 'AUTH_SUCCESS': {
        currentUser = msg.user;
        isAdmin = !!msg.isAdmin;
        console.log('Auth success! User:', currentUser, 'isAdmin:', isAdmin);

        const authBtnLabel = document.getElementById('auth-btn-label');
        if (authBtnLabel) {
          authBtnLabel.textContent = isAdmin ? '👑 ' + currentUser.username : '👤 ' + currentUser.username;
        }

        const adminBtn = document.getElementById('btn-open-admin-panel');
        if (adminBtn) {
          if (isAdmin) {
            adminBtn.classList.remove('hidden');
            adminBtn.style.display = 'flex';
          } else {
            adminBtn.classList.add('hidden');
            adminBtn.style.display = 'none';
          }
        }

        const hudAdminBtn = document.getElementById('btn-hud-admin');
        if (hudAdminBtn) {
          if (isAdmin) {
            hudAdminBtn.classList.remove('hidden');
            hudAdminBtn.style.display = 'flex';
          } else {
            hudAdminBtn.classList.add('hidden');
            hudAdminBtn.style.display = 'none';
          }
        }

        // If player name input is default, update with username
        const nameInput = document.getElementById('player-name-input');
        if (nameInput && (!nameInput.value || nameInput.value === 'Player' || nameInput.value === 'Crewmate')) {
          nameInput.value = currentUser.username;
          localStorage.setItem('among_us_saved_name', currentUser.username);
        }

        // Update auth modal logged-in box
        const loggedInBox = document.getElementById('auth-logged-in-box');
        const authForm = document.getElementById('auth-form');
        const userNameEl = document.getElementById('auth-user-name');
        const userRoleBadge = document.getElementById('auth-user-role-badge');
        if (loggedInBox && authForm && userNameEl && userRoleBadge) {
          loggedInBox.classList.remove('hidden');
          loggedInBox.style.display = 'flex';
          authForm.classList.add('hidden');
          authForm.style.display = 'none';
          userNameEl.textContent = currentUser.username;
          if (isAdmin) {
            userRoleBadge.textContent = '👑 YÖNETİCİ (ADMIN)';
            userRoleBadge.className = 'auth-badge-admin';
          } else {
            userRoleBadge.textContent = '🧑‍🚀 OYUNCU';
            userRoleBadge.className = 'auth-badge-admin';
            userRoleBadge.style.background = '#0284c7';
            userRoleBadge.style.borderColor = '#38bdf8';
          }
        }

        const submitBtn = document.getElementById('btn-auth-submit');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = (currentAuthTab === 'register') ? 'KAYIT OL' : 'GİRİŞ YAP';
        }
        alert('✓ ' + (msg.message || 'Giriş başarılı!') + (isAdmin ? '\n\n👑 YÖNETİCİ MODU AKTİF!\nSağ üstte beliren "👑 ADMİN PANELİ" butonuna tıklayarak canlı paneli açabilirsiniz.' : ''));
        window.closeAuthModal();
        break;
      }

      case 'AUTH_ERROR': {
        const errEl = document.getElementById('auth-error-msg');
        if (errEl) {
          errEl.textContent = msg.message || 'Giriş hatası!';
          errEl.classList.remove('hidden');
          errEl.style.display = 'block';
        }
        const submitBtn = document.getElementById('btn-auth-submit');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = (currentAuthTab === 'register') ? 'KAYIT OL' : 'GİRİŞ YAP';
        }
        alert('GİRİŞ HATASI: ' + (msg.message || 'Kullanıcı adı veya şifre hatalı!'));
        break;
      }

      case 'AUTH_LOGOUT': {
        currentUser = null;
        isAdmin = false;
        localStorage.removeItem('amongus_auth_creds');
        const authBtnLabel = document.getElementById('auth-btn-label');
        if (authBtnLabel) authBtnLabel.textContent = 'Giriş Yap / Kayıt Ol';

        const adminBtn = document.getElementById('btn-open-admin-panel');
        if (adminBtn) {
          adminBtn.classList.add('hidden');
          adminBtn.style.display = 'none';
        }
        const hudAdminBtn = document.getElementById('btn-hud-admin');
        if (hudAdminBtn) {
          hudAdminBtn.classList.add('hidden');
          hudAdminBtn.style.display = 'none';
        }

        const loggedInBox = document.getElementById('auth-logged-in-box');
        const authForm = document.getElementById('auth-form');
        if (loggedInBox && authForm) {
          loggedInBox.classList.add('hidden');
          loggedInBox.style.display = 'none';
          authForm.classList.remove('hidden');
          authForm.style.display = 'block';
        }
        if (window.closeAdminPanel) window.closeAdminPanel();
        break;
      }

            case 'BANS_RESET_SUCCESS': {
        alert('✓ ' + (msg.message || 'Tüm banlar sıfırlandı!'));
        break;
      }

      case 'ADMIN_STATS_UPDATE': {
        if (!isAdmin) break;
        const stats = msg.stats;
        if (!stats) break;

        // Counters
        const elOnline = document.getElementById('admin-stat-online');
        const elRooms = document.getElementById('admin-stat-rooms');
        const elUsers = document.getElementById('admin-stat-users');
        const elBans = document.getElementById('admin-stat-bans');
        const countRooms = document.getElementById('admin-tab-rooms-count');
        const countClients = document.getElementById('admin-tab-clients-count');
        const countBans = document.getElementById('admin-tab-bans-count');

        if (elOnline) elOnline.textContent = stats.onlineCount || 0;
        if (elRooms) elRooms.textContent = stats.roomCount || 0;
        if (elUsers) elUsers.textContent = stats.registeredCount || 0;
        if (elBans) elBans.textContent = stats.bannedCount || 0;
        if (countRooms) countRooms.textContent = (stats.rooms || []).length;
        if (countClients) countClients.textContent = (stats.clients || []).length;
        if (countBans) countBans.textContent = (stats.bans || []).length;

        if (window.renderAdminRooms) window.renderAdminRooms(stats.rooms || []);
        if (window.renderAdminClients) window.renderAdminClients(stats.clients || []);
        if (window.renderAdminBans) window.renderAdminBans(stats.bans || []);
        break;
      }

      case 'KICKED_FROM_ROOM': {
        const reason = msg.message || msg.reason || 'Odadan atıldınız.';
        alert('UYARI: ' + reason);
        // Reset and return to menu
        if (window.returnToMainMenu) {
          window.returnToMainMenu();
        } else {
          location.reload();
        }
        break;
      }

      case 'ROOM_CLOSED_BY_ADMIN': {
        alert('BİLGİ: ' + (msg.message || 'Bu oda yönetici tarafından kapatıldı.'));
        if (window.returnToMainMenu) {
          window.returnToMainMenu();
        } else {
          location.reload();
        }
        break;
      }

      case 'BANNED': {
        const reason = msg.reason || 'Bu sunucudan kalıcı olarak yasaklandınız!';
        localStorage.removeItem('amongus_auth_creds');
        alert('KIRMIZI ALARM - BANLANDINIZ!\\n\\n' + reason);
        document.body.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#000; color:#ef4444; font-family:sans-serif; text-align:center; padding:20px;">
            <div style="font-size:72px; margin-bottom:20px;">🚫</div>
            <h1 style="font-size:32px; font-weight:900; margin-bottom:12px;">SİTEDEN YASAKLANDINIZ (BANNED)</h1>
            <p style="font-size:18px; color:#fca5a5; max-width:600px; line-height:1.5;">${escapeHtml(reason)}</p>
          </div>
        `;
        break;
      }

      case 'ROOM_PLAYERS_UPDATE': {
        currentRoomHostId = msg.hostId;
        currentRoomPlayersData = msg.players || [];
        const countSpan = document.getElementById('chat-tab-player-count');
        if (countSpan) countSpan.textContent = currentRoomPlayersData.length;
        if (window.renderRoomPlayersList) {
          window.renderRoomPlayersList(currentRoomPlayersData, currentRoomHostId);
        }
        break;
      }

      case 'ERROR': {
        alert(msg.message);
        break;
      }

      case 'CONNECTED': {
        console.log('Registered player ID:', msg.playerId);
        localPlayer.id = msg.playerId;
        break;
      }

      case 'ROOMS_LIST':
      case 'ROOM_LIST': {
        const grid = document.getElementById('public-rooms-grid');
        if (!grid) break;
        grid.innerHTML = '';
        if (msg.rooms.length === 0) {
          grid.innerHTML = '<div style="color:#94a3b8; padding:20px; text-align:center;">No public games found. Host one!</div>';
        } else {
          msg.rooms.forEach(r => {
            const card = document.createElement('div');
            card.className = 'room-card';
            const hName = r.hostName || 'Host';
            const rMap = r.map || 'THE SKELD';
            const rPlayers = (r.players !== undefined ? r.players : (r.playerCount || 1));
            const rMax = r.maxPlayers || 20;
            card.innerHTML = `
              <div class="room-card-host">Host: ` + escapeHtml(hName) + `</div>
              <div class="room-card-info">
                <span>Code: <b>` + r.code + `</b></span>
                <span>Map: <b>` + rMap + `</b></span>
                <span>Players: <b>` + rPlayers + `/` + rMax + `</b></span>
              </div>
              <button class="btn-join-room" onclick="window.joinSpecificRoom('` + r.code + `')">JOIN</button>
            `;
            grid.appendChild(card);
          });
        }
        break;
      }

      case 'ROOM_CREATED':
      case 'ROOM_JOINED': {
        currentRoomCode = msg.roomCode;
        isRoomHost = msg.isHost;
        localPlayer.id = msg.playerId;
        if (msg.color) localPlayer.color = msg.color;
        if (msg.hat) localPlayer.hat = msg.hat;
        if (msg.skin) localPlayer.skin = msg.skin;

        gameState = 'LOBBY';
        localPlayer.x = 613;
        localPlayer.y = 460;
        localPlayer.isAlive = true;

        if (mainMenuModal) mainMenuModal.classList.add('hidden');
        if (publicRoomsModal) publicRoomsModal.classList.add('hidden');
        if (enterCodeModal) enterCodeModal.classList.add('hidden');
        if (dropshipHud) dropshipHud.classList.remove('hidden');

        if (dropshipRoomCode) dropshipRoomCode.innerText = currentRoomCode;
        if (roomCodeTag) roomCodeTag.innerText = 'CODE: ' + currentRoomCode;

        if (isRoomHost) {
          if (btnDropshipStart) btnDropshipStart.classList.remove('hidden');
          if (dropshipGuestMsg) dropshipGuestMsg.classList.add('hidden');
          if (dropshipHostTag) dropshipHostTag.innerHTML = 'HOST: <span style="color:#fbbf24;">' + localPlayer.name + '</span> (You!)';
        } else {
          if (btnDropshipStart) btnDropshipStart.classList.add('hidden');
          if (dropshipGuestMsg) dropshipGuestMsg.classList.remove('hidden');
        }
        break;
      }

      case 'LOBBY_STATE': {
        const maxCap = msg.maxPlayers || currentRoomMaxPlayers || 20;
        currentRoomMaxPlayers = maxCap;
        if (dropshipPlayerCount) dropshipPlayerCount.innerText = msg.players.length + '/' + maxCap;

        // Auto update room players drawer in real time when any player enters/leaves
        currentRoomHostId = msg.hostId;
        currentRoomPlayersData = msg.players || [];
        const countSpan = document.getElementById('chat-tab-player-count');
        if (countSpan) countSpan.textContent = currentRoomPlayersData.length;
        if (window.renderRoomPlayersList) {
          window.renderRoomPlayersList(currentRoomPlayersData, currentRoomHostId);
        }
        if (msg.hostName && !isRoomHost && dropshipHostTag) {
          dropshipHostTag.innerHTML = 'HOST: <span style="color:#fbbf24;">' + msg.hostName + '</span>';
        }

        if (msg.isPublic !== undefined && dropshipPrivacyBtn) {
          dropshipPrivacyBtn.innerText = msg.isPublic ? 'PUBLIC' : 'PRIVATE';
          dropshipPrivacyBtn.className = msg.isPublic ? 'badge-privacy public' : 'badge-privacy private';
        }

        msg.players.forEach(p => {
          if (p.id !== localPlayer.id) {
            const existing = players.get(p.id);
            if (existing) {
              existing.name = p.name;
              existing.color = p.color;
              existing.hat = p.hat || 'none';
              existing.skin = p.skin || 'default';
              existing.isHost = p.isHost;
              existing.isAlive = (p.isAlive !== false);
              if (p.x !== undefined && p.y !== undefined) {
                existing.x = p.x;
                existing.y = p.y;
              }
            } else {
              players.set(p.id, {
                id: p.id,
                name: p.name,
                color: p.color,
                hat: p.hat || 'none',
                skin: p.skin || 'default',
                isHost: p.isHost,
                isDummy: !!p.isDummy,
                x: p.x || (613 + (Math.random() * 80 - 40)),
                y: p.y || (460 + (Math.random() * 60 - 30)),
                dir: 'down',
                walking: false,
                frame: 1,
                isAlive: (p.isAlive !== false)
              });
            }
          }
        });

        const currentIds = new Set(msg.players.map(p => p.id));
        for (const [pid, _] of players) {
          if (!currentIds.has(pid)) {
            players.delete(pid);
          }
        }
        renderColorGrid();
        break;
      }

      case 'PLAYER_CUSTOMIZED':
      case 'PLAYER_COLOR_CHANGED': {
        const p = players.get(msg.id);
        if (p) {
          if (msg.color) p.color = msg.color;
          if (msg.hat) p.hat = msg.hat;
          if (msg.skin) p.skin = msg.skin;
        }
        if (localPlayer.id === msg.id) {
          if (msg.color) localPlayer.color = msg.color;
          if (msg.hat) localPlayer.hat = msg.hat;
          if (msg.skin) localPlayer.skin = msg.skin;
        }
        renderColorGrid();
        updateCustomizePreview();
        break;
      }

      case 'SABOTAGE_TRIGGERED': {
        handleSabotageTriggered(msg);
        break;
      }

      case 'SABOTAGE_REJECTED': {
        alert(msg.reason || 'Sabotaj şu anda kullanılamaz!');
        break;
      }

      case 'SABOTAGE_FIXED': {
        handleSabotageFixed(msg);
        break;
      }

      case 'PRIVACY_CHANGED': {
        if (dropshipPrivacyBtn) {
          dropshipPrivacyBtn.innerText = msg.isPublic ? 'PUBLIC' : 'PRIVATE';
          dropshipPrivacyBtn.className = msg.isPublic ? 'badge-privacy public' : 'badge-privacy private';
        }
        break;
      }

      case 'RETURN_TO_LOBBY': {
        gameState = 'LOBBY';
        if (gameoverModal) gameoverModal.classList.add('hidden');
        if (meetingModal) meetingModal.classList.add('hidden');
        if (chatDrawer) chatDrawer.classList.add('hidden');
        if (mapModal) mapModal.classList.add('hidden');
        if (sabotageModal) sabotageModal.classList.add('hidden');
        if (customizeModal) customizeModal.classList.add('hidden');
        if (topHud) topHud.classList.add('hidden');
        if (topRightHud) topRightHud.classList.add('hidden');
        if (actionHud) actionHud.classList.add('hidden');

        if (window.closeCurrentTask) window.closeCurrentTask();
        if (window.closeFixSabotageModal) window.closeFixSabotageModal();

        // Reveal Dropship Lobby HUD
        if (dropshipHud) dropshipHud.classList.remove('hidden');
        if (dropshipRoomCode) dropshipRoomCode.innerText = currentRoomCode;
        if (roomCodeTag) roomCodeTag.innerText = 'CODE: ' + currentRoomCode;

        if (isRoomHost) {
          if (btnDropshipStart) btnDropshipStart.classList.remove('hidden');
          if (dropshipGuestMsg) dropshipGuestMsg.classList.add('hidden');
          if (dropshipHostTag) dropshipHostTag.innerHTML = 'HOST: <span style="color:#fbbf24;">' + localPlayer.name + '</span> (You!)';
        } else {
          if (btnDropshipStart) btnDropshipStart.classList.add('hidden');
          if (dropshipGuestMsg) dropshipGuestMsg.classList.remove('hidden');
        }

        // Reset local player to dropship spawn
        localPlayer.x = 613;
        localPlayer.y = 460;
        localPlayer.isAlive = true;
        localPlayer.isImpostor = false;
        localPlayer.inVent = false;
        localPlayer.isWatchingCameras = false;
        localPlayer.hasVoted = false;
        localPlayer.completedTaskIds = new Set();

        // Reset other players to dropship spawn
        players.forEach(p => {
          p.isAlive = true;
          p.isImpostor = false;
          p.inVent = false;
          p.hasVoted = false;
        });

        if (isFreeplayMode) {
          const dummyPositions = [
            { id: 'dummy_0', x: 480, y: 520 },
            { id: 'dummy_1', x: 740, y: 460 },
            { id: 'dummy_2', x: 680, y: 350 }
          ];
          dummyPositions.forEach(dp => {
            const existing = players.get(dp.id);
            if (existing) {
              existing.x = dp.x;
              existing.y = dp.y;
              existing.isAlive = true;
              existing.isImpostor = false;
            }
          });
        }

        deadBodies = [];
        activeSabotage = null;
        activeLockedDoors = {};
        sabotageCooldown = 0;
        for (const r in doorCooldowns) doorCooldowns[r] = 0;

        if (crisisAudioLoop) {
          try { crisisAudioLoop.pause(); crisisAudioLoop.currentTime = 0; } catch(e){}
          crisisAudioLoop = null;
        }
        if (crisisInterval) {
          clearInterval(crisisInterval);
          crisisInterval = null;
        }
        if (crisisBanner) crisisBanner.classList.add('hidden');
        break;
      }

      case 'GAME_STARTED': {
        gameState = 'PLAYING';
        const dropshipChatModal = document.getElementById('dropship-chat-modal');
        if (dropshipChatModal) dropshipChatModal.classList.add('hidden');
        if (dropshipHud) dropshipHud.classList.add('hidden');
        if (customizeModal) customizeModal.classList.add('hidden');
        if (mainMenuModal) mainMenuModal.classList.add('hidden');
        if (topHud) topHud.classList.remove('hidden');
        if (topRightHud) topRightHud.classList.remove('hidden');
        if (actionHud) actionHud.classList.remove('hidden');

        const myInfo = msg.players.find(p => p.id === localPlayer.id);
        if (myInfo) {
          localPlayer.isImpostor = myInfo.isImpostor;
          localPlayer.isAlive = myInfo.isAlive;
          localPlayer.x = myInfo.x;
          localPlayer.y = myInfo.y;
          localPlayer.hat = myInfo.hat || localPlayer.hat || 'none';
          localPlayer.skin = myInfo.skin || localPlayer.skin || 'default';
          localPlayer.completedTaskIds = new Set();
          localPlayer.killCooldown = 15;
        }

        players.clear();
        msg.players.forEach(p => {
          if (p.id !== localPlayer.id) {
            players.set(p.id, { ...p, frame: 1, walking: false, dir: 'down' });
          }
        });

        deadBodies = [];
        resetHudTaskList();
        updateRoleHUD();
        updateTaskProgress(msg.taskProgress, msg.taskTotal);

        showRoleReveal();
        playSound(sounds.roundstart);
        break;
      }

      case 'PLAYER_MOVED': {
        const p = players.get(msg.id);
        if (p) {
          p.targetX = msg.x;
          p.targetY = msg.y;
          p.dir = msg.dir;
          p.walking = msg.walking;
          p.inVent = msg.inVent;
          if (p.x === undefined || p.y === undefined) {
            p.x = msg.x;
            p.y = msg.y;
          }
        }
        break;
      }

      case 'PLAYER_KILLED': {
        if (msg.corpse) {
          msg.corpse.diedAt = Date.now();
          deadBodies.push(msg.corpse);
        }

        if (msg.victimId === localPlayer.id) {
          // Play full authentic 18-frame kill animation on victim's screen!
          playKillAnimation(() => {
            localPlayer.isAlive = false;
            updateRoleHUD();
          });
        } else if (msg.killerId === localPlayer.id) {
          // Photo 5 fixed: In authentic Among Us, Impostor stays in world and NEVER gets kill splash animation!
          playSound(sounds.kill);
          localPlayer.killCooldown = 25;
          const victim = players.get(msg.victimId);
          if (victim) victim.isAlive = false;
          updateRoleHUD();
        } else {
          playSound(sounds.kill);
          const victim = players.get(msg.victimId);
          if (victim) victim.isAlive = false;
        }
        break;
      }

      case 'CAMERAS_ACTIVE': {
        isSomeoneWatchingCameras = !!msg.active;
        break;
      }

      case 'MEETING_STARTED': {
        gameState = 'MEETING';
        // Photo 5: First show DEAD BODY REPORTED / EMERGENCY splash alert, then open tablet!
        showReportSplash(msg, () => {
          openMeetingTablet(msg);
        });
        break;
      }

      case 'MEETING_TIMER': {
        meetingPhase = msg.phase;
        const timerNum = document.getElementById('meeting-timer-num');
        if (timerNum) {
          if (msg.phase === 'DISCUSSION') {
            timerNum.innerHTML = '<span style="color:#38bdf8;">DISCUSSION:</span> ' + msg.timer + 's';
          } else {
            timerNum.innerHTML = '<span style="color:#ef4444;">VOTING:</span> ' + msg.timer + 's';
          }
        }
        break;
      }

      case 'VOTING_PHASE_STARTED': {
        meetingPhase = 'VOTING';
        const timerNum = document.getElementById('meeting-timer-num');
        if (timerNum) timerNum.innerHTML = '<span style="color:#ef4444;">VOTING:</span> ' + msg.timer + 's';
        enableVotingCards();
        break;
      }

      case 'VOTE_CAST': {
        const card = document.getElementById('vote-card-' + msg.voterId);
        if (card) {
          card.classList.add('has-voted');
          if (!card.querySelector('.card-voted-badge')) {
            const badge = document.createElement('div');
            badge.className = 'card-voted-badge';
            badge.innerHTML = '<span>🗳️</span> <span>Oy Verdi</span>';
            card.appendChild(badge);
          }
        }
        break;
      }

      case 'MEETING_ENDED': {
        showVotingResults(msg, () => {
          showEjectionScreen(msg);
        });
        break;
      }

      case 'RESUME_GAME': {
        // Only set PLAYING if ejection screen is not currently running
        if (!ejectionModal || ejectionModal.classList.contains('hidden')) {
          gameState = 'PLAYING';
        }
        localPlayer.hasVoted = false;
        msg.players.forEach(p => {
          if (p.id === localPlayer.id) {
            localPlayer.x = p.x;
            localPlayer.y = p.y;
            localPlayer.isAlive = p.isAlive;
          } else {
            const op = players.get(p.id);
            if (op) {
              op.x = p.x;
              op.y = p.y;
              op.isAlive = p.isAlive;
            }
          }
        });
        updateRoleHUD();
        break;
      }

      case 'TASK_PROGRESS': {
        updateTaskProgress(msg.progress, msg.total);
        break;
      }

      case 'CHAT_MESSAGE': {
        addChatMessage(msg.sender, msg.color, msg.text, msg.isDead);
        break;
      }

      case 'GAME_OVER': {
        gameState = 'ENDED';
        showGameOver(msg);
        break;
      }
    }
  }

  // ================= 6. CONTROLS & MOVEMENT =================
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    keys[e.code] = true;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (localPlayer.isImpostor && gameState === 'PLAYING') {
        toggleSabotage();
      } else {
        toggleMinimap();
      }
    }

    if (e.key.toLowerCase() === 'm') {
      toggleMinimap();
    }

    // Vent Navigation & Hopping when in Vent
    if (localPlayer.inVent && gameState === 'PLAYING') {
      if (e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        hopToAdjacentVent(-1);
        return;
      }
      if (e.key.toLowerCase() === 'd' || e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        hopToAdjacentVent(1);
        return;
      }
      if (e.key.toLowerCase() === 'e' || e.code === 'Space' || e.key.toLowerCase() === 'v') {
        e.preventDefault();
        toggleVent();
        return;
      }
    }

    if (e.key.toLowerCase() === 'v') {
      if (gameState === 'PLAYING' && localPlayer.isImpostor && localPlayer.isAlive) {
        toggleVent();
      }
    }

    if (e.key.toLowerCase() === 'e' || e.code === 'Space') {
      if (gameState === 'LOBBY' && isNearDropshipLaptop) {
        openCustomizeModal();
      } else if (gameState === 'PLAYING') {
        if (currentNearbySabotageFix && localPlayer.isAlive) {
          openFixSabotageModal(currentNearbySabotageFix.type);
        } else if (isNearEmergencyTable && localPlayer.isAlive) {
          callEmergencyMeeting();
        } else if (isNearSecurityCams) {
          openSecurityCams();
        } else if (currentNearbyTask) {
          openTaskModal(currentNearbyTask);
        } else if (currentNearbyVent && localPlayer.isImpostor) {
          toggleVent();
        }
      }
    }

    if (e.key.toLowerCase() === 'q') {
      if (gameState === 'PLAYING' && localPlayer.isImpostor && localPlayer.isAlive) {
        performKill();
      }
    }

    if (e.key.toLowerCase() === 'r') {
      if (gameState === 'PLAYING' && currentNearbyBody && localPlayer.isAlive) {
        reportDeadBody();
      }
    }

    if (e.key.toLowerCase() === 'm' || e.key === 'Tab') {
      e.preventDefault();
      toggleMinimap();
    }

    if (e.key === 'Escape') {
      window.closeCurrentTask();
      window.closeMinimap();
      window.closeSecurityCams();
      window.closeFixSabotageModal();
      if (customizeModal) customizeModal.classList.add('hidden');
      if (gameSettingsModal) gameSettingsModal.classList.add('hidden');
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
  });

  // Collision inside Dropship Lobby (Photo 3 & 4 Stairs Fix)
  function collidesWithDropship(nx, ny) {
    const box = {
      x: nx - 17,
      y: ny + 12,
      w: 34,
      h: 24
    };

    // Dropship Bounds (Floor reaches y = 880 down the stairs)
    if (box.x < 360 || box.x + box.w > 865 || box.y < 240 || box.y + box.h > 880) {
      return true;
    }

    // Central Green Laptop Crate at (470, 290)
    if (box.x < 576 && box.x + box.w > 470 && box.y < 435 && box.y + box.h > 290) {
      return true;
    }

    return false;
  }

  // Locked doors state: doorName -> { until: timestamp, rects: [...] }
  // Locked doors state: doorName -> { until: timestamp, duration: 10000, rects: [...] }
  const LOCKED_DOOR_CONFIG = {
    upengine: [
      { x: 1673, y: 580, w: 50, h: 195 }, // Corridor between Upper Engine & Cafeteria
      { x: 1110, y: 1015, w: 140, h: 48 } // Bottom doorway of Upper Engine (Photo 2 fixed!)
    ],
    lowengine: [
      { x: 1665, y: 2113, w: 50, h: 195 }, // Lower Engine hallway doorway
      { x: 1017, y: 1680, w: 140, h: 48 }  // Lower Engine to reactor corridor doorway
    ],
    security: [
      { x: 1675, y: 1420, w: 46, h: 145 }  // Entrance into Security camera room (Photo 2 fixed!)
    ],
    medbay: [
      { x: 2245, y: 780, w: 165, h: 46 }   // Real entrance corridor into Medbay
    ],
    electrical: [
      { x: 2208, y: 2420, w: 147, h: 48 }  // Real doorway corridor leading into Electrical (Photo 1 exact!)
    ],
    cafeteria: [
      { x: 2596, y: 580, w: 56, h: 195 },  // Cafeteria left doorway to Medbay/Engine corridor
      { x: 4015, y: 576, w: 50, h: 199 },  // Cafeteria right doorway to Weapons
      { x: 3258, y: 1353, w: 154, h: 48 }  // Cafeteria south doorway into Storage corridor
    ],
    storage: [
      { x: 3258, y: 1353, w: 154, h: 48 }, // Storage top doorway from Cafeteria corridor
      { x: 2770, y: 2415, w: 48, h: 230 }, // Storage left doorway completely sealed to bottom wall
      { x: 3525, y: 2200, w: 48, h: 235 }  // Storage right doorway to Shields/Comms corridor (Photo 2 fixed!)
    ]
  };
  let activeLockedDoors = {};

  // Authentic sliding blast door renderer matching Among Us (Photo 5)
  function drawAuthenticBlastDoor(ctx, rx, ry, rw, rh, animRatio = 1) {
    if (animRatio <= 0.02) return;
    ctx.save();
    const isHorizCorridor = (rw > rh);

    // Frame casing
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rx - 2, ry - 2, rw + 4, rh + 4);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx - 2, ry - 2, rw + 4, rh + 4);

    if (isHorizCorridor) {
      // Horizontal threshold (doors slide inward to meet in center)
      const midX = rx + rw / 2;
      const panelW = (rw / 2) * animRatio;

      // Left panel
      ctx.fillStyle = '#334155';
      ctx.fillRect(midX - panelW, ry + 2, panelW - 1, rh - 4);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(midX - panelW, ry + 2, panelW - 1, rh - 4);

      // Right panel
      ctx.fillStyle = '#334155';
      ctx.fillRect(midX + 1, ry + 2, panelW - 1, rh - 4);
      ctx.strokeRect(midX + 1, ry + 2, panelW - 1, rh - 4);

      // Center Seam & Lock Indicator
      if (animRatio >= 0.85) {
        ctx.fillStyle = '#020617';
        ctx.fillRect(midX - 2, ry, 4, rh);
        const blink = (Date.now() % 500) < 300;
        ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = blink ? 8 : 2;
        ctx.fillRect(midX - 2, ry + rh / 2 - 6, 4, 12);
      }
    } else {
      // Vertical corridor doorway (rh >= rw): Door leaves slide vertically from top & bottom to meet in horizontal seam ("yan dursun tam kapatması için")
      const midY = ry + rh / 2;
      const panelH = (rh / 2) * animRatio;

      // Top metal door panel (slides down from ceiling)
      const gradT = ctx.createLinearGradient(rx, ry, rx, midY);
      gradT.addColorStop(0, '#1e293b');
      gradT.addColorStop(0.5, '#475569');
      gradT.addColorStop(1, '#334155');
      ctx.fillStyle = gradT;
      ctx.fillRect(rx + 2, midY - panelH, rw - 4, panelH);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 2, midY - panelH, rw - 4, panelH);

      // Bottom metal door panel (slides up from floor)
      const gradB = ctx.createLinearGradient(rx, midY, rx, ry + rh);
      gradB.addColorStop(0, '#334155');
      gradB.addColorStop(0.5, '#475569');
      gradB.addColorStop(1, '#1e293b');
      ctx.fillStyle = gradB;
      ctx.fillRect(rx + 2, midY, rw - 4, panelH);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 2, midY, rw - 4, panelH);

      // Vertical metal grooves across horizontal door panels
      ctx.fillStyle = '#0f172a';
      for (let gx = rx + 8; gx < rx + rw - 6; gx += 12) {
        ctx.fillRect(gx, midY - panelH + 2, 2, panelH * 2 - 4);
      }

      // Horizontal Center Seam & Red Magnetic Lock Bar
      if (animRatio >= 0.85) {
        ctx.fillStyle = '#020617';
        ctx.fillRect(rx, midY - 2, rw, 4);
        const blink = (Date.now() % 500) < 300;
        ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = blink ? 10 : 2;
        ctx.fillRect(rx + rw / 2 - 14, midY - 3, 28, 6);
        ctx.beginPath();
        ctx.arc(rx + rw / 2, midY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Skeld Collision
  function collidesWithMap(nx, ny) {
    if (!localPlayer.isAlive) return false; // Dead ghost can fly/pass through all walls!
    if (!mapData || !mapData.collision) return false;
    const box = {
      x: nx - 16,
      y: ny + 12,
      w: 32,
      h: 22
    };

    for (let i = 0; i < mapData.collision.length; i++) {
      const poly = mapData.collision[i];
      if (poly && poly.w && poly.h) {
        if (box.x < poly.x + poly.w &&
            box.x + box.w > poly.x &&
            box.y < poly.y + poly.h &&
            box.y + box.h > poly.y) {
          return true;
        }
      }
    }

    // Check currently locked doors
    const now = Date.now();
    for (const [room, doorInfo] of Object.entries(activeLockedDoors)) {
      if (doorInfo && doorInfo.until > now) {
        for (const rect of doorInfo.rects) {
          const pad = 6;
          if (box.x < rect.x + rect.w + pad &&
              box.x + box.w > rect.x - pad &&
              box.y < rect.y + rect.h + pad &&
              box.y + box.h > rect.y - pad) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // ================= 7. UPDATE LOOP & PROXIMITY =================
  function update(dt) {
    if (gameState !== 'PLAYING' && gameState !== 'LOBBY') return;

    let moveX = 0;
    let moveY = 0;

    if (keys['w'] || keys['arrowup']) moveY -= 1;
    if (keys['s'] || keys['arrowdown']) moveY += 1;
    if (keys['a'] || keys['arrowleft']) moveX -= 1;
    if (keys['d'] || keys['arrowright']) moveX += 1;

    const isMoving = (moveX !== 0 || moveY !== 0) && (!localPlayer.inVent);

    if (isMoving) {
      const len = Math.hypot(moveX, moveY);
      moveX = (moveX / len) * localPlayer.speed * dt;
      moveY = (moveY / len) * localPlayer.speed * dt;

      if (moveX > 0) localPlayer.dir = 'right';
      else if (moveX < 0) localPlayer.dir = 'left';
      else if (moveY > 0) localPlayer.dir = 'down';
      else if (moveY < 0) localPlayer.dir = 'up';

      if (gameState === 'LOBBY') {
        if (!collidesWithDropship(localPlayer.x + moveX, localPlayer.y)) {
          localPlayer.x += moveX;
        }
        if (!collidesWithDropship(localPlayer.x, localPlayer.y + moveY)) {
          localPlayer.y += moveY;
        }
      } else {
        if (!collidesWithMap(localPlayer.x + moveX, localPlayer.y)) {
          localPlayer.x += moveX;
        }
        if (!collidesWithMap(localPlayer.x, localPlayer.y + moveY)) {
          localPlayer.y += moveY;
        }
      }

      localPlayer.walking = true;
      animTimer += dt * 14;
      localPlayer.frame = (Math.floor(animTimer) % 16) + 1;

      const now = performance.now();
      if (now - lastFootstepTime > 310 && sounds.footsteps.length > 0) {
        lastFootstepTime = now;
        const rIdx = Math.floor(Math.random() * sounds.footsteps.length);
        playSound(sounds.footsteps[rIdx]);
      }

      // Smooth network send throttling (prevents network burst stuttering)
      if (now - lastMovePacketTime > 32) {
        lastMovePacketTime = now;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'MOVE',
            x: localPlayer.x,
            y: localPlayer.y,
            dir: localPlayer.dir,
            walking: true,
            inVent: localPlayer.inVent
          }));
        }
      }
    } else {
      if (localPlayer.walking) {
        localPlayer.walking = false;
        localPlayer.frame = 1;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'MOVE',
            x: localPlayer.x,
            y: localPlayer.y,
            dir: localPlayer.dir,
            walking: false,
            inVent: localPlayer.inVent
          }));
        }
      } else {
        localPlayer.frame = 1;
      }
    }

    // Remote players smooth 60fps interpolation and walk cycle (fixes stuttering / freezing walk!)
    players.forEach(p => {
      if (p.targetX !== undefined && p.targetY !== undefined) {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 300) {
          p.x = p.targetX;
          p.y = p.targetY;
        } else {
          p.x += dx * 0.35;
          p.y += dy * 0.35;
        }
      }
      if (p.walking) {
        p.animTimer = (p.animTimer || 0) + dt * 14;
        p.frame = (Math.floor(p.animTimer) % 18) + 1;
      } else {
        p.frame = 1;
        p.animTimer = 0;
      }
    });

    // Dropship Laptop Proximity Check
    if (gameState === 'LOBBY') {
      const d = Math.hypot(localPlayer.x - 520, localPlayer.y - 360);
      isNearDropshipLaptop = (d < 120);
      if (btnDropshipCustomize) {
        if (isNearDropshipLaptop) btnDropshipCustomize.classList.remove('disabled');
        else btnDropshipCustomize.classList.add('disabled');
      }
      return;
    }

    // Dead Body Proximity
    currentNearbyBody = null;
    let minBodyDist = 120;
    for (const b of deadBodies) {
      const dist = Math.hypot(localPlayer.x - b.x, localPlayer.y - b.y);
      if (dist < minBodyDist) {
        minBodyDist = dist;
        currentNearbyBody = b;
      }
    }
    if (btnReport) {
      if (currentNearbyBody && localPlayer.isAlive) btnReport.classList.remove('disabled');
      else btnReport.classList.add('disabled');
    }

    // Sabotage Cooldown & Door Cooldowns
    if (localPlayer.isImpostor) {
      if (sabotageCooldown > 0) {
        sabotageCooldown = Math.max(0, sabotageCooldown - dt);
        if (btnSabotage) btnSabotage.classList.add('disabled');
      } else {
        if (btnSabotage) btnSabotage.classList.remove('disabled');
      }
      for (const r in doorCooldowns) {
        if (doorCooldowns[r] > 0) {
          doorCooldowns[r] = Math.max(0, doorCooldowns[r] - dt);
        }
      }
      if (sabotageModal && !sabotageModal.classList.contains('hidden')) {
        updateSabotageUI();
      }
    }

    // Kill Cooldown & Target
    if (localPlayer.isImpostor && localPlayer.isAlive) {
      if (localPlayer.killCooldown > 0) {
        localPlayer.killCooldown = Math.max(0, localPlayer.killCooldown - dt);
        if (killTimerOverlay) {
          killTimerOverlay.innerText = Math.ceil(localPlayer.killCooldown) + 's';
          killTimerOverlay.style.display = 'block';
        }
        if (btnKill) {
          btnKill.classList.add('disabled');
          btnKill.classList.add('on-cooldown');
        }
      } else {
        if (killTimerOverlay) {
          killTimerOverlay.innerText = '';
          killTimerOverlay.style.display = 'none';
        }
        if (btnKill) {
          btnKill.classList.remove('on-cooldown');
        }
        let target = null;
        let minDist = 160;
        players.forEach(p => {
          if (!p.isImpostor && p.isAlive && !p.inVent) {
            const dist = Math.hypot(localPlayer.x - p.x, localPlayer.y - p.y);
            if (dist < minDist) {
              minDist = dist;
              target = p;
            }
          }
        });
        if (btnKill) {
          if (target) btnKill.classList.remove('disabled');
          else btnKill.classList.add('disabled');
        }
      }
    }

    // Vent Proximity
    currentNearbyVent = null;
    if (mapData && mapData.vents && localPlayer.isImpostor && localPlayer.isAlive) {
      for (let i = 0; i < mapData.vents.length; i++) {
        const v = mapData.vents[i];
        const vx = v.x + (v.w ? v.w / 2 : 32);
        const vy = v.y + (v.h ? v.h / 2 : 24);
        const dist = Math.hypot(localPlayer.x - vx, localPlayer.y - vy);
        if (dist < 120) {
          currentNearbyVent = { ...v, index: i, cx: vx, cy: vy };
          break;
        }
      }
    }
    if (btnVent) {
      if (currentNearbyVent || localPlayer.inVent) btnVent.classList.remove('disabled');
      else btnVent.classList.add('disabled');
    }

    // Sabotage Station Proximity (Accurate 95px radius so players in Cafeteria never trigger O2!)
    currentNearbySabotageFix = null;
    if (activeSabotage && SABOTAGE_STATIONS[activeSabotage.type] && localPlayer.isAlive) {
      const stations = SABOTAGE_STATIONS[activeSabotage.type];
      for (const st of stations) {
        if (Math.hypot(localPlayer.x - st.x, localPlayer.y - st.y) < 95) {
          currentNearbySabotageFix = { ...st, type: activeSabotage.type };
          break;
        }
      }
    }

    // Cafeteria Emergency Button Table Center (3316, 728)
    const distEmergency = Math.hypot(localPlayer.x - 3316, localPlayer.y - 728);
    isNearEmergencyTable = (distEmergency < 170 && localPlayer.isAlive);

    // Security Room Cameras Console Proximity (Covers full desk in front of 4 monitors)
    isNearSecurityCams = (localPlayer.x >= 1660 && localPlayer.x <= 2040 && localPlayer.y >= 980 && localPlayer.y <= 1240);

    // Tasks Proximity (Enhanced reach distance so players can easily interact with tasks)
    currentNearbyTask = null;
    if (mapData && mapData.tasks && (!localPlayer.isImpostor || currentRoomCode.startsWith('FREEPLAY'))) {
      let minTaskDist = 135;
      for (const t of mapData.tasks) {
        if (t.isCamera || t.type === 'cameras') continue; // Cameras handled specifically above!
        if (localPlayer.completedTaskIds && localPlayer.completedTaskIds.has(t.id)) {
          continue; // Cannot repeat completed task!
        }
        const rw = t.w || 40;
        const rh = t.h || 40;
        const dx = Math.max(t.x - localPlayer.x, 0, localPlayer.x - (t.x + rw));
        const dy = Math.max(t.y - localPlayer.y, 0, localPlayer.y - (t.y + rh));
        const dist = Math.hypot(dx, dy);
        if (dist < minTaskDist) {
          minTaskDist = dist;
          currentNearbyTask = t;
        }
      }
    }

    // Update USE button state & Prompt
    if (btnUse) {
      if (currentNearbySabotageFix || isNearSecurityCams || currentNearbyTask || (currentNearbyVent && localPlayer.isImpostor) || isNearEmergencyTable) {
        btnUse.classList.remove('disabled');
      } else {
        btnUse.classList.add('disabled');
      }
    }

    if (interactPrompt && promptText) {
      if (currentNearbySabotageFix && localPlayer.isAlive) {
        interactPrompt.classList.remove('hidden');
        promptText.innerText = 'SPACE / E: FIX ' + currentNearbySabotageFix.type.toUpperCase() + ' (' + currentNearbySabotageFix.room.toUpperCase() + ')';
      } else if (isNearEmergencyTable) {
        interactPrompt.classList.remove('hidden');
        promptText.innerText = 'SPACE / E: CALL EMERGENCY MEETING';
      } else if (isNearSecurityCams) {
        interactPrompt.classList.remove('hidden');
        promptText.innerText = 'SPACE / E: VIEW SURVEILLANCE CAMERAS';
      } else if (currentNearbyTask) {
        interactPrompt.classList.remove('hidden');
        promptText.innerText = 'SPACE / E: ' + currentNearbyTask.name.toUpperCase();
      } else if (currentNearbyVent && localPlayer.isImpostor) {
        interactPrompt.classList.remove('hidden');
        promptText.innerText = localPlayer.inVent ? 'CLICK ARROWS OR SPACE/E: EXIT VENT' : 'SPACE / E: ENTER VENT';
      } else {
        interactPrompt.classList.add('hidden');
      }
    }
  }

  // ================= 8. RENDERING ENGINE =================
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const offsetX = Math.round(cx - localPlayer.x);
    const offsetY = Math.round(cy - localPlayer.y);

    // ================= A. DROPSHIP LOBBY RENDERING =================
    if (gameState === 'LOBBY') {
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Starfield background
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 137 + Date.now() * 0.015) % canvas.width);
        const sy = ((i * 223) % canvas.height);
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Draw Dropship Floor & Room
      if (dropshipImage.complete && dropshipImage.naturalWidth > 0) {
        ctx.drawImage(dropshipImage, offsetX, offsetY);
      } else {
        // High quality fallback vector dropship lobby interior
        ctx.save();
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(250 + offsetX, 180 + offsetY, 720, 560, 40);
        else ctx.rect(250 + offsetX, 180 + offsetY, 720, 560);
        ctx.fill();
        ctx.stroke();

        // Floor tiles
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        for (let gx = 250; gx < 970; gx += 80) {
          ctx.beginPath();
          ctx.moveTo(gx + offsetX, 180 + offsetY);
          ctx.lineTo(gx + offsetX, 740 + offsetY);
          ctx.stroke();
        }
        for (let gy = 180; gy < 740; gy += 70) {
          ctx.beginPath();
          ctx.moveTo(250 + offsetX, gy + offsetY);
          ctx.lineTo(970 + offsetX, gy + offsetY);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Green Crate at (470, 290)
      if (dropshipLaptopImg.complete && dropshipLaptopImg.naturalWidth > 0) {
        ctx.drawImage(dropshipLaptopImg, 470 + offsetX, 290 + offsetY, 106, 145);
      } else {
        ctx.fillStyle = '#15803d';
        ctx.fillRect(470 + offsetX, 290 + offsetY, 106, 145);
      }
      // Laptop placed ON TOP of crate at (484, 255)
      if (dropshipCrateImg.complete && dropshipCrateImg.naturalWidth > 0) {
        ctx.drawImage(dropshipCrateImg, 484 + offsetX, 255 + offsetY, 78, 70);
      } else {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(484 + offsetX, 255 + offsetY, 78, 70);
      }

      // Pulsating Yellow Glow Outline around Crate + Laptop when near
      if (isNearDropshipLaptop) {
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 18 + Math.sin(Date.now() / 150) * 8;
        ctx.strokeRect(465 + offsetX, 250 + offsetY, 115, 185);
        ctx.restore();
      }

      // Draw Players in Dropship sorted by Y
      const lobbyEntities = [];
      players.forEach(p => {
        lobbyEntities.push({
          id: p.id,
          name: p.name,
          color: p.color,
          hat: p.hat || 'none',
          skin: p.skin || 'default',
          x: p.x,
          y: p.y,
          dir: p.dir || 'down',
          walking: p.walking,
          frame: p.frame || 1,
          isHost: p.isHost,
          isAlive: true,
          isLocal: false
        });
      });
      lobbyEntities.push({
        id: localPlayer.id,
        name: localPlayer.name,
        color: localPlayer.color,
        hat: localPlayer.hat || 'none',
        skin: localPlayer.skin || 'default',
        x: localPlayer.x,
        y: localPlayer.y,
        dir: localPlayer.dir,
        walking: localPlayer.walking,
        frame: localPlayer.frame,
        isHost: isRoomHost,
        isAlive: true,
        isLocal: true
      });

      lobbyEntities.sort((a, b) => a.y - b.y);

      lobbyEntities.forEach(ent => {
        const px = ent.x + offsetX;
        const py = ent.y + offsetY;
        drawAstronaut(px, py, ent);
      });

      // Space Vignette
      const grad = ctx.createRadialGradient(cx, cy, 320, cx, cy, Math.max(canvas.width, canvas.height) / 1.4);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // ================= B. MATCH RENDERING =================
    // 1. Draw Skeld Map
    if (mapImage.complete) {
      ctx.drawImage(mapImage, offsetX, offsetY);
    }

    // 2. Yellow Interactive Task Highlights (Enhanced distance so approaching players easily see it from afar)
    if (mapData && mapData.tasks && (!localPlayer.isImpostor || currentRoomCode.startsWith('FREEPLAY'))) {
      mapData.tasks.forEach(t => {
        if (t.isCamera || t.type === 'cameras') return;
        if (localPlayer.completedTaskIds && localPlayer.completedTaskIds.has(t.id)) {
          return; // No yellow glow if completed!
        }
        const tw = t.w || 40;
        const th = t.h || 40;
        const centerX = t.x + tw / 2;
        const centerY = t.y + th / 2;
        const d = Math.hypot(localPlayer.x - centerX, localPlayer.y - centerY);
        if (d < 380) { // Distance significantly increased per user request!
          const tx = t.x + offsetX;
          const ty = t.y + offsetY;
          ctx.save();
          const pulse = 16 + Math.sin(Date.now() / 150) * 8;
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = pulse;
          ctx.strokeRect(tx - 3, ty - 3, tw + 6, th + 6);

          // Floating yellow indicator arrow over the task station
          const floatY = ty - 18 + Math.sin(Date.now() / 160) * 5;
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.moveTo(tx + tw / 2, floatY + 12);
          ctx.lineTo(tx + tw / 2 - 8, floatY);
          ctx.lineTo(tx + tw / 2 + 8, floatY);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      });
    }

    // Security Cams Console Highlight
    if (localPlayer.isAlive) {
      const dCams = Math.hypot(localPlayer.x - 1756, localPlayer.y - 1062);
      if (dCams < 180) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12 + Math.sin(Date.now() / 150) * 5;
        ctx.strokeRect(1730 + offsetX, 1040 + offsetY, 55, 45);
        ctx.restore();
      }
    }

    // 3. Impostor Vent Highlights
    if (mapData && mapData.vents && localPlayer.isImpostor && localPlayer.isAlive) {
      mapData.vents.forEach(v => {
        const d = Math.hypot(localPlayer.x - v.x, localPlayer.y - v.y);
        if (d < 180) {
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 14 + Math.sin(Date.now() / 150) * 6;
          ctx.strokeRect(v.x + offsetX - 22, v.y + offsetY - 20, 44, 40);
          ctx.restore();
        }
      });
    }

    // 4. Dead Bodies (Photo 4: Falling Animation for 1.2s -> Photo 3: Authentic half-body with bone!)
    deadBodies.forEach(b => {
      const bx = b.x + offsetX;
      const by = b.y + offsetY;
      const elapsed = b.diedAt ? (Date.now() - b.diedAt) : 9999;

      ctx.save();
      if (elapsed < 1200) {
        // Photo 4: Falling over / dying animation for first 1.2s
        const frameIdx = Math.min(3, Math.floor(elapsed / 300));
        drawDyingAstronaut(ctx, bx, by, b.color, frameIdx);
      } else {
        // Photo 3: Authentic standing dead half-body with bone sticking up!
        const cImg = deadCorpseSprites[b.color] || deadCorpseSprites['Red'];
        if (cImg && cImg.complete && cImg.naturalWidth > 0) {
          ctx.drawImage(cImg, bx - 38, by - 38, 76, 58);
        } else {
          ctx.fillStyle = COLOR_HEX[b.color] || '#c51111';
          ctx.beginPath();
          ctx.ellipse(bx, by - 12, 22, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bx - 4, by - 26, 8, 14);
        }
      }
      ctx.restore();
    });

    // 5. Entities (Players sorted by Y)
    const entities = [];
    players.forEach(p => {
      if (!p.inVent) {
        entities.push({
          type: 'player',
          id: p.id,
          name: p.name,
          color: p.color,
          hat: p.hat || 'none',
          skin: p.skin || 'default',
          x: p.x,
          y: p.y,
          dir: p.dir || 'down',
          walking: p.walking,
          frame: p.frame || 1,
          isAlive: p.isAlive,
          isImpostor: p.isImpostor,
          isLocal: false
        });
      }
    });

    if (!localPlayer.inVent) {
      entities.push({
        type: 'player',
        id: localPlayer.id,
        name: localPlayer.name,
        color: localPlayer.color,
        hat: localPlayer.hat || 'none',
        skin: localPlayer.skin || 'default',
        x: localPlayer.x,
        y: localPlayer.y,
        dir: localPlayer.dir,
        walking: localPlayer.walking,
        frame: localPlayer.frame,
        isAlive: localPlayer.isAlive,
        isImpostor: localPlayer.isImpostor,
        isLocal: true
      });
    }

    entities.sort((a, b) => a.y - b.y);

    entities.forEach(ent => {
      if (!ent.isAlive && localPlayer.isAlive) return; // Living players CANNOT see ghosts!
      const px = ent.x + offsetX;
      const py = ent.y + offsetY;
      drawAstronaut(px, py, ent);
    });

    // 6. Draw Closed Blast Doors (Photo 5 Authentic Sliding Metal Blast Door)
    const curTime = Date.now();
    for (const [room, doorInfo] of Object.entries(activeLockedDoors)) {
      if (doorInfo && doorInfo.until > curTime) {
        const remaining = doorInfo.until - curTime;
        const dur = doorInfo.duration || 10000;
        const elapsed = dur - remaining;
        let animRatio = 1;
        if (elapsed < 350) animRatio = Math.max(0.05, elapsed / 350);
        else if (remaining < 350) animRatio = Math.max(0.05, remaining / 350);

        for (const rect of doorInfo.rects) {
          const rx = rect.x + offsetX;
          const ry = rect.y + offsetY;
          drawAuthenticBlastDoor(ctx, rx, ry, rect.w, rect.h, animRatio);
        }
      }
    }

    // 7. Cafeteria Emergency Table Pulsing Glow
    if (isNearEmergencyTable) {
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18 + Math.sin(Date.now() / 150) * 8;
      ctx.strokeRect(3144.5 + offsetX, 597.5 + offsetY, 343, 260.5);
      ctx.restore();
    }

    // 7b. Security Hallway Camera Blinking Red LEDs (Active strictly when someone is watching cams; mounted directly at camera wall fixture lens tips)
    if (isViewingCameras || isSomeoneWatchingCameras) {
      const blink = (Date.now() % 600) < 320;
      if (blink) {
        ctx.save();
        const cameraLEDs = [
          { x: 2554, y: 575 },  // Medbay corridor wall camera lens tip (above entrance)
          { x: 2185, y: 577 },  // Upper Engine hallway wall camera lens tip
          { x: 1308, y: 1375 }, // Reactor/Security cross wall camera lens tip
          { x: 4627, y: 1494 }  // Navigation corridor wall camera lens tip
        ];
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 14;
        cameraLEDs.forEach(c => {
          ctx.beginPath();
          ctx.arc(c.x + offsetX, c.y + offsetY, 5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }
    }

    // 7c. Electrical Breaker Switchbox Red Indicator (Photo 3 bottom panel)
    if (activeSabotage && activeSabotage.type === 'lights') {
      ctx.save();
      const sx = 2450 + offsetX;
      const sy = 1960 + offsetY;
      const pulse = 10 + Math.sin(Date.now() / 140) * 6;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = pulse;
      ctx.strokeRect(sx - 48, sy - 35, 96, 70);
      // Flashing warning beacon on top of switchbox
      if ((Date.now() % 400) < 220) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(sx, sy - 42, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. Vent Navigation Directional Arrows (Only shown when local player is inside a vent)
    activeVentArrows = [];
    if (localPlayer.inVent && localPlayer.isImpostor) {
      let myNetwork = null;
      if (localPlayer.currentVent) {
        myNetwork = VENT_NETWORKS.find(net => net.some(v => v.id == localPlayer.currentVent.id));
      }
      if (!myNetwork) {
        for (const net of VENT_NETWORKS) {
          const found = net.find(v => Math.hypot(v.x - localPlayer.x, v.y - localPlayer.y) < 120);
          if (found) {
            myNetwork = net;
            break;
          }
        }
      }
      if (myNetwork) {
        myNetwork.forEach(targetVent => {
          const dist = Math.hypot(targetVent.x - localPlayer.x, targetVent.y - localPlayer.y);
          if (dist > 50) {
            const angle = Math.atan2(targetVent.y - localPlayer.y, targetVent.x - localPlayer.x);
            const arrowRadius = 130;
            const ax = cx + Math.cos(angle) * arrowRadius;
            const ay = cy + Math.sin(angle) * arrowRadius;

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(angle);

            const pulse = 1 + Math.sin(Date.now() / 100) * 0.15;
            ctx.scale(pulse, pulse);

            ctx.fillStyle = '#38bdf8';
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 3.5;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.moveTo(22, 0);
            ctx.lineTo(-12, -15);
            ctx.lineTo(-6, -6);
            ctx.lineTo(-24, -6);
            ctx.lineTo(-24, 6);
            ctx.lineTo(-6, 6);
            ctx.lineTo(-12, 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.font = 'bold 13px AmongUsFont, Segoe UI, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 5;
            ctx.textAlign = 'center';
            ctx.fillText(targetVent.name, ax, ay + (Math.sin(angle) > 0 ? 26 : -18));
            ctx.restore();

            activeVentArrows.push({ x: ax, y: ay, r: 28, targetVent: targetVent });
          }
        });
      }
    }

    // 9. Sabotage Red Screen Alarm & Directional Navigation Arrow
    if (activeSabotage) {
      if (activeSabotage.type === 'reactor' || activeSabotage.type === 'o2') {
        ctx.save();
        const pulseAlpha = 0.14 + Math.sin(Date.now() / 160) * 0.11;
        ctx.fillStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      if (SABOTAGE_STATIONS[activeSabotage.type]) {
        const stations = SABOTAGE_STATIONS[activeSabotage.type];
        const isYellow = (Date.now() % 500) < 250;
        const color = isYellow ? '#facc15' : '#ef4444';
        const pulse = 16 + Math.sin(Date.now() / 120) * 8;

        // 9a. Render glowing yellow/red warning bounding box & beacon on each sabotage station in the world
        stations.forEach(st => {
          const sx = st.x + offsetX;
          const sy = st.y + offsetY;
          if (sx > -120 && sx < canvas.width + 120 && sy > -120 && sy < canvas.height + 120) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.shadowColor = color;
            ctx.shadowBlur = pulse;
            // Pulsing hazard outline around station console
            ctx.strokeRect(sx - 48, sy - 40, 96, 80);

            // Inner dashed alert ring
            ctx.beginPath();
            ctx.arc(sx, sy, 52 + Math.sin(Date.now() / 140) * 5, 0, Math.PI * 2);
            ctx.setLineDash([8, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Floating beacon label above station
            ctx.font = 'bold 14px AmongUsFont, Segoe UI, sans-serif';
            ctx.fillStyle = color;
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 8;
            ctx.textAlign = 'center';
            ctx.fillText(`⚠️ TAMİR ET / FIX: ${st.room.toUpperCase()}`, sx, sy - 54);
            ctx.restore();
          }
        });

        // 9b. Directional Navigation Arrow (Points to closest station from afar)
        if (localPlayer.isAlive) {
          let closestSt = stations[0];
          let minDist = Math.hypot(stations[0].x - localPlayer.x, stations[0].y - localPlayer.y);
          for (let i = 1; i < stations.length; i++) {
            const d = Math.hypot(stations[i].x - localPlayer.x, stations[i].y - localPlayer.y);
            if (d < minDist) {
              minDist = d;
              closestSt = stations[i];
            }
          }

          if (minDist > 100) {
            const angle = Math.atan2(closestSt.y - localPlayer.y, closestSt.x - localPlayer.x);
            const margin = 70;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const edgeDist = Math.min(
              (canvas.width / 2 - margin) / Math.max(Math.abs(cosA), 0.001),
              (canvas.height / 2 - margin) / Math.max(Math.abs(sinA), 0.001)
            );
            const nx = cx + cosA * edgeDist;
            const ny = cy + sinA * edgeDist;

            ctx.save();
            ctx.translate(nx, ny);
            ctx.rotate(angle);
            const pulseScale = 1 + Math.sin(Date.now() / 120) * 0.18;
            ctx.scale(pulseScale, pulseScale);

            ctx.fillStyle = color;
            ctx.strokeStyle = isYellow ? '#ef4444' : '#facc15';
            ctx.lineWidth = 3.5;
            ctx.shadowColor = color;
            ctx.shadowBlur = 20;

            ctx.beginPath();
            ctx.moveTo(26, 0);
            ctx.lineTo(-14, -18);
            ctx.lineTo(-6, -7);
            ctx.lineTo(-26, -7);
            ctx.lineTo(-26, 7);
            ctx.lineTo(-6, 7);
            ctx.lineTo(-14, 18);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.font = 'bold 14px AmongUsFont, Segoe UI, sans-serif';
            ctx.fillStyle = '#fef08a';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 8;
            ctx.textAlign = 'center';
            const distM = Math.round(minDist / 12);
            ctx.fillText(`⚠️ FIX: ${closestSt.room} (${distM}m)`, nx, ny + (sinA > 0 ? 30 : -20));
            ctx.restore();
          }
        }
      }
    }

    // 10. Lights Sabotage - Crewmate Darkness Flashlight Mask
    if (activeSabotage && activeSabotage.type === 'lights' && !localPlayer.isImpostor && localPlayer.isAlive) {
      ctx.save();
      const lightGrad = ctx.createRadialGradient(cx, cy, 60, cx, cy, 140);
      lightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      lightGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.85)');
      lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
      ctx.fillStyle = lightGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Space Vignette
    const grad = ctx.createRadialGradient(cx, cy, 320, cx, cy, Math.max(canvas.width, canvas.height) / 1.4);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Authentic Fallback Astronaut (With real legs, visor shine, backpack, and shadow)
  function drawFallbackAstronaut(fctx, px, py, colorName, dir = 'down', isAlive = true) {
    const col = COLOR_HEX[colorName] || '#ed54ba';
    const isFacingLeft = (dir === 'left');
    fctx.save();

    if (!isAlive) {
      fctx.globalAlpha = 0.65;
      const bobY = Math.sin((Date.now() / 240) + (px % 10)) * 7;
      py += bobY;

      fctx.fillStyle = col;
      fctx.strokeStyle = '#000000';
      fctx.lineWidth = 2.5;

      const bpX = isFacingLeft ? px + 12 : px - 24;
      fctx.fillRect(bpX, py - 46, 10, 22);
      fctx.strokeRect(bpX, py - 46, 10, 22);

      fctx.beginPath();
      fctx.moveTo(px - 18, py - 20);
      fctx.arc(px, py - 35, 18, Math.PI, 0, false);
      fctx.lineTo(px + 18, py - 10);
      fctx.quadraticCurveTo(px + 12, py - 2, px + 6, py - 10);
      fctx.quadraticCurveTo(px, py - 2, px - 6, py - 10);
      fctx.quadraticCurveTo(px - 12, py - 2, px - 18, py - 10);
      fctx.closePath();
      fctx.fill();
      fctx.stroke();

      fctx.fillStyle = '#83d6e6';
      fctx.beginPath();
      const vX = isFacingLeft ? px - 8 : px + 8;
      fctx.ellipse(vX, py - 38, 12, 7, 0, 0, Math.PI * 2);
      fctx.fill();
      fctx.stroke();
    } else {
      // 1. Ground Shadow
      fctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      fctx.beginPath();
      fctx.ellipse(px, py + 2, 22, 6, 0, 0, Math.PI * 2);
      fctx.fill();

      // 2. Backpack (behind body)
      fctx.fillStyle = col;
      fctx.strokeStyle = '#000000';
      fctx.lineWidth = 2.5;
      const bpX = isFacingLeft ? px + 12 : px - 26;
      fctx.beginPath();
      fctx.roundRect(bpX, py - 48, 14, 28, 4);
      fctx.fill();
      fctx.stroke();

      // 3. Body with real two legs
      fctx.beginPath();
      fctx.moveTo(px - 18, py - 20);
      fctx.lineTo(px - 18, py - 2);
      fctx.arc(px - 12, py - 2, 6, Math.PI, 0, true);
      fctx.lineTo(px - 6, py - 16);
      fctx.lineTo(px + 6, py - 16);
      fctx.lineTo(px + 6, py - 2);
      fctx.arc(px + 12, py - 2, 6, Math.PI, 0, true);
      fctx.lineTo(px + 18, py - 20);
      fctx.arc(px, py - 34, 18, 0, Math.PI, true);
      fctx.closePath();
      fctx.fill();
      fctx.stroke();

      // 4. Visor
      const visorX = isFacingLeft ? px - 6 : px + 6;
      fctx.fillStyle = '#83d6e6';
      fctx.strokeStyle = '#000000';
      fctx.lineWidth = 2.5;
      fctx.beginPath();
      fctx.ellipse(visorX, py - 38, 13, 7.5, 0, 0, Math.PI * 2);
      fctx.fill();
      fctx.stroke();

      fctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      fctx.beginPath();
      fctx.ellipse(visorX - 3, py - 40, 5, 2.5, -Math.PI / 10, 0, Math.PI * 2);
      fctx.fill();
    }
    fctx.restore();
  }

  // Draw Astronaut Helper with Hat and Skin
  function drawAstronaut(px, py, ent) {
    // CRITICAL: A player is NEVER a ghost in the dropship lobby!
    // In match, they are only a ghost if ent.isAlive is explicitly false!
    const isGhost = (gameState !== 'LOBBY' && ent && ent.isAlive === false);
    const isAlive = !isGhost;

    ctx.save();
    if (isGhost) {
      ctx.globalAlpha = 0.65;
      const bobY = Math.sin((Date.now() / 240) + ((ent.x || 0) % 10)) * 7;
      py += bobY;
    }

    const spriteSet = (ent && ent.color && sprites[ent.color]) || sprites['Red'];
    let drawn = false;

    // Draw authentic Ghost Sprite (Photo 3) ONLY IF IS GHOST (strictly false and not in lobby!)
    if (isGhost && spriteSet && spriteSet.ghost) {
      const gSide = (ent.dir === 'left' ? 'left' : 'right');
      const gImg = spriteSet.ghost[gSide];
      if (gImg && (gImg instanceof HTMLCanvasElement || (gImg.complete && gImg.naturalWidth > 0))) {
        ctx.drawImage(gImg, px - 33, py - 60, 66, 84);
        drawn = true;
      }
    }

    // Draw living walking / idle astronaut
    if (!drawn && isAlive && spriteSet) {
      const dir = ent.dir || 'down';
      const dirFrames = spriteSet[dir] || spriteSet['down'];
      if (dirFrames && dirFrames.length > 0) {
        // Frame: if walking, use animated frame (1-18), if standing idle, use frame 1 (or 0 index)
        const frameIdx = ent.walking ? (Math.max(0, (ent.frame || 1) - 1) % dirFrames.length) : 0;
        let img = dirFrames[frameIdx];

        if (!img || (img instanceof HTMLImageElement && (!img.complete || img.naturalWidth === 0))) {
          img = dirFrames[0];
        }
        if (!img && sprites['Red'] && sprites['Red'][dir]) {
          img = sprites['Red'][dir][0];
        }

        if (img && (img instanceof HTMLCanvasElement || (img.complete && img.naturalWidth > 0))) {
          const isDown = (dir === 'down');
          const dw = isDown ? 76 : 66;
          const dh = isDown ? 97 : 84;
          const ox = isDown ? 38 : 33;
          const oy = isDown ? 68 : 60;
          ctx.drawImage(img, px - ox, py - oy, dw, dh);
          drawn = true;
        }
      }
    }

    if (!drawn) {
      drawFallbackAstronaut(ctx, px, py, ent.color, ent.dir, isAlive);
    }

    // Draw Outfit / Skin & Hat (only for alive players)
    if (isAlive) {
      drawSkin(ctx, ent.skin, px, py);
      drawHat(ctx, ent.hat, px, py);
    }

    ctx.restore();

    // Name Tag
    ctx.font = 'bold 14px AmongUsFont, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    if (localPlayer.isImpostor && ent.isImpostor) {
      ctx.fillStyle = '#ff4444';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    const hostTag = ent.isHost ? '👑 ' : '';
    const youTag = ent.isLocal ? ' (You!)' : '';
    ctx.fillText(hostTag + ent.name + youTag, px, py - 68);
    ctx.shadowBlur = 0;
  }

  // Hat Vector Rendering
  function drawHat(tCtx, hatId, px, py) {
    if (!hatId || hatId === 'none') return;
    tCtx.save();
    tCtx.translate(px, py - 52);

    if (hatId === 'sprout') {
      tCtx.strokeStyle = '#22c55e';
      tCtx.lineWidth = 3.5;
      tCtx.beginPath();
      tCtx.moveTo(0, 0);
      tCtx.quadraticCurveTo(0, -12, 2, -18);
      tCtx.stroke();
      tCtx.fillStyle = '#4ade80';
      tCtx.beginPath();
      tCtx.ellipse(-8, -16, 7, 3.5, -Math.PI / 6, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.stroke();
      tCtx.beginPath();
      tCtx.ellipse(8, -18, 7, 3.5, Math.PI / 6, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.stroke();
    } else if (hatId === 'crown') {
      tCtx.fillStyle = '#fbbf24';
      tCtx.strokeStyle = '#b45309';
      tCtx.lineWidth = 2.5;
      tCtx.beginPath();
      tCtx.moveTo(-16, 0);
      tCtx.lineTo(-16, -14);
      tCtx.lineTo(-8, -6);
      tCtx.lineTo(0, -18);
      tCtx.lineTo(8, -6);
      tCtx.lineTo(16, -14);
      tCtx.lineTo(16, 0);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();
      tCtx.fillStyle = '#ef4444';
      tCtx.beginPath();
      tCtx.arc(0, -7, 2.5, 0, Math.PI * 2);
      tCtx.arc(-10, -5, 2, 0, Math.PI * 2);
      tCtx.arc(10, -5, 2, 0, Math.PI * 2);
      tCtx.fill();
    } else if (hatId === 'tophat') {
      tCtx.fillStyle = '#1e293b';
      tCtx.strokeStyle = '#0f172a';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.ellipse(0, 0, 20, 5, 0, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.stroke();
      tCtx.fillRect(-12, -22, 24, 22);
      tCtx.strokeRect(-12, -22, 24, 22);
      tCtx.fillStyle = '#ef4444';
      tCtx.fillRect(-12, -7, 24, 5);
    } else if (hatId === 'beanie') {
      tCtx.fillStyle = '#06b6d4';
      tCtx.beginPath();
      tCtx.arc(0, -2, 16, Math.PI, 0);
      tCtx.fill();
      tCtx.fillStyle = '#ffffff';
      tCtx.beginPath();
      tCtx.arc(0, -18, 4, 0, Math.PI * 2);
      tCtx.fill();
    } else if (hatId === 'party') {
      tCtx.fillStyle = '#f43f5e';
      tCtx.beginPath();
      tCtx.moveTo(-12, 0);
      tCtx.lineTo(0, -26);
      tCtx.lineTo(12, 0);
      tCtx.closePath();
      tCtx.fill();
      tCtx.fillStyle = '#facc15';
      tCtx.beginPath();
      tCtx.arc(0, -27, 4, 0, Math.PI * 2);
      tCtx.fill();
    } else if (hatId === 'horns') {
      tCtx.fillStyle = '#dc2626';
      tCtx.strokeStyle = '#7f1d1d';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.moveTo(-14, 0);
      tCtx.quadraticCurveTo(-22, -10, -18, -18);
      tCtx.quadraticCurveTo(-12, -12, -8, 0);
      tCtx.fill();
      tCtx.stroke();
      tCtx.beginPath();
      tCtx.moveTo(14, 0);
      tCtx.quadraticCurveTo(22, -10, 18, -18);
      tCtx.quadraticCurveTo(12, -12, 8, 0);
      tCtx.fill();
      tCtx.stroke();
    } else if (hatId === 'halo') {
      tCtx.save();
      tCtx.strokeStyle = '#fef08a';
      tCtx.lineWidth = 3.5;
      tCtx.shadowColor = '#facc15';
      tCtx.shadowBlur = 10;
      tCtx.beginPath();
      tCtx.ellipse(0, -14, 16, 5, 0, 0, Math.PI * 2);
      tCtx.stroke();
      tCtx.restore();
    } else if (hatId === 'chef') {
      tCtx.fillStyle = '#ffffff';
      tCtx.strokeStyle = '#cbd5e1';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.arc(-8, -16, 8, 0, Math.PI * 2);
      tCtx.arc(0, -20, 10, 0, Math.PI * 2);
      tCtx.arc(8, -16, 8, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.stroke();
      tCtx.fillRect(-12, -8, 24, 8);
      tCtx.strokeRect(-12, -8, 24, 8);
    } else if (hatId === 'dum') {
      tCtx.fillStyle = '#fef08a';
      tCtx.strokeStyle = '#ca8a04';
      tCtx.lineWidth = 1.5;
      tCtx.fillRect(-11, 4, 22, 18);
      tCtx.strokeRect(-11, 4, 22, 18);
      tCtx.font = 'bold 9px monospace';
      tCtx.fillStyle = '#000000';
      tCtx.textAlign = 'center';
      tCtx.fillText('DUM', 0, 16);
    } else if (hatId === 'flower') {
      tCtx.fillStyle = '#f472b6';
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5;
        tCtx.beginPath();
        tCtx.arc(Math.cos(angle) * 7, -6 + Math.sin(angle) * 7, 4, 0, Math.PI * 2);
        tCtx.fill();
      }
      tCtx.fillStyle = '#fef08a';
      tCtx.beginPath();
      tCtx.arc(0, -6, 3, 0, Math.PI * 2);
      tCtx.fill();
    } else if (hatId === 'goggles') {
      tCtx.fillStyle = '#b45309';
      tCtx.fillRect(-18, 6, 36, 4);
      tCtx.fillStyle = '#38bdf8';
      tCtx.strokeStyle = '#d97706';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.arc(-7, 8, 6, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.stroke();
      tCtx.beginPath();
      tCtx.arc(7, 8, 6, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.stroke();
    } else if (hatId === 'viking') {
      tCtx.fillStyle = '#64748b';
      tCtx.fillRect(-14, -6, 28, 8);
      tCtx.fillStyle = '#f8fafc';
      tCtx.beginPath();
      tCtx.moveTo(-14, -4);
      tCtx.quadraticCurveTo(-22, -14, -20, -22);
      tCtx.quadraticCurveTo(-14, -14, -10, -6);
      tCtx.fill();
      tCtx.beginPath();
      tCtx.moveTo(14, -4);
      tCtx.quadraticCurveTo(22, -14, 20, -22);
      tCtx.quadraticCurveTo(14, -14, 10, -6);
      tCtx.fill();
    } else if (hatId === 'paper') {
      tCtx.fillStyle = '#e2e8f0';
      tCtx.beginPath();
      tCtx.moveTo(-16, 0);
      tCtx.lineTo(0, -18);
      tCtx.lineTo(16, 0);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();
    }
    tCtx.restore();
  }

  // Skin Vector Rendering - Authentic Among Us Outfits
  function drawSkin(tCtx, skinId, px, py) {
    if (!skinId || skinId === 'default') return;
    tCtx.save();
    tCtx.translate(px, py - 32);

    if (skinId === 'suit') {
      // 1. Black Tuxedo Suit
      tCtx.fillStyle = '#0f172a';
      tCtx.strokeStyle = '#000000';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.moveTo(-16, 2);
      tCtx.lineTo(-14, 24);
      tCtx.lineTo(14, 24);
      tCtx.lineTo(16, 2);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();

      // White shirt triangle
      tCtx.fillStyle = '#ffffff';
      tCtx.beginPath();
      tCtx.moveTo(-7, 2);
      tCtx.lineTo(7, 2);
      tCtx.lineTo(0, 16);
      tCtx.closePath();
      tCtx.fill();

      // Red Bowtie
      tCtx.fillStyle = '#ef4444';
      tCtx.strokeStyle = '#991b1b';
      tCtx.lineWidth = 1;
      tCtx.beginPath();
      tCtx.moveTo(0, 4);
      tCtx.lineTo(-6, 1);
      tCtx.lineTo(-6, 7);
      tCtx.lineTo(0, 4);
      tCtx.lineTo(6, 1);
      tCtx.lineTo(6, 7);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();
      tCtx.beginPath();
      tCtx.arc(0, 4, 1.5, 0, Math.PI * 2);
      tCtx.fill();

      // Gold buttons
      tCtx.fillStyle = '#fbbf24';
      tCtx.beginPath();
      tCtx.arc(0, 18, 1.5, 0, Math.PI * 2);
      tCtx.arc(0, 22, 1.5, 0, Math.PI * 2);
      tCtx.fill();

    } else if (skinId === 'doctor') {
      // 2. Doctor Lab Coat & Stethoscope
      tCtx.fillStyle = '#f8fafc';
      tCtx.strokeStyle = '#000000';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.moveTo(-16, 2);
      tCtx.lineTo(-14, 24);
      tCtx.lineTo(14, 24);
      tCtx.lineTo(16, 2);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();

      tCtx.fillStyle = '#e2e8f0';
      tCtx.fillRect(-3, 2, 6, 22);

      // Cyan Stethoscope
      tCtx.strokeStyle = '#06b6d4';
      tCtx.lineWidth = 2.5;
      tCtx.beginPath();
      tCtx.arc(0, 8, 7, 0.2, Math.PI - 0.2);
      tCtx.stroke();

      // Chrome chest piece
      tCtx.fillStyle = '#94a3b8';
      tCtx.strokeStyle = '#0f172a';
      tCtx.lineWidth = 1.5;
      tCtx.beginPath();
      tCtx.arc(4, 17, 3, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.stroke();

      // Red Cross pocket
      tCtx.fillStyle = '#ef4444';
      tCtx.fillRect(-11, 8, 6, 2);
      tCtx.fillRect(-9, 6, 2, 6);

    } else if (skinId === 'police') {
      // 3. Police Officer Uniform
      tCtx.fillStyle = '#1e3a8a';
      tCtx.strokeStyle = '#000000';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.moveTo(-16, 2);
      tCtx.lineTo(-14, 24);
      tCtx.lineTo(14, 24);
      tCtx.lineTo(16, 2);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();

      // Gold Star Badge
      tCtx.fillStyle = '#fbbf24';
      tCtx.strokeStyle = '#b45309';
      tCtx.lineWidth = 1;
      tCtx.beginPath();
      tCtx.arc(7, 8, 3.5, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.stroke();

      // Black Utility Belt & Buckle
      tCtx.fillStyle = '#0f172a';
      tCtx.fillRect(-14, 18, 28, 5);
      tCtx.fillStyle = '#eab308';
      tCtx.fillRect(-3, 17, 6, 7);
      tCtx.fillStyle = '#0f172a';
      tCtx.fillRect(-1.5, 18.5, 3, 4);

    } else if (skinId === 'military') {
      // 4. Military Camo Officer
      tCtx.fillStyle = '#365314';
      tCtx.strokeStyle = '#000000';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.moveTo(-16, 2);
      tCtx.lineTo(-14, 24);
      tCtx.lineTo(14, 24);
      tCtx.lineTo(16, 2);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();

      // Camo patches
      tCtx.fillStyle = '#1a2e05';
      tCtx.beginPath();
      tCtx.ellipse(-8, 12, 4, 3, Math.PI / 4, 0, Math.PI * 2);
      tCtx.ellipse(6, 16, 5, 3, -Math.PI / 6, 0, Math.PI * 2);
      tCtx.fill();

      // Service ribbon bars
      tCtx.fillStyle = '#ef4444';
      tCtx.fillRect(-11, 7, 3, 3);
      tCtx.fillStyle = '#eab308';
      tCtx.fillRect(-8, 7, 3, 3);
      tCtx.fillStyle = '#3b82f6';
      tCtx.fillRect(-5, 7, 3, 3);

    } else if (skinId === 'captain') {
      // 5. Captain Uniform
      tCtx.fillStyle = '#0f172a';
      tCtx.strokeStyle = '#000000';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.moveTo(-16, 2);
      tCtx.lineTo(-14, 24);
      tCtx.lineTo(14, 24);
      tCtx.lineTo(16, 2);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();

      // Gold Anchor
      tCtx.strokeStyle = '#fbbf24';
      tCtx.lineWidth = 1.5;
      tCtx.beginPath();
      tCtx.arc(-7, 7, 2.5, 0, Math.PI * 2);
      tCtx.moveTo(-7, 9.5);
      tCtx.lineTo(-7, 14);
      tCtx.arc(-7, 12, 3, 0, Math.PI);
      tCtx.stroke();

      // Gold Buttons
      tCtx.fillStyle = '#fbbf24';
      tCtx.beginPath();
      tCtx.arc(3, 8, 1.5, 0, Math.PI * 2);
      tCtx.arc(3, 14, 1.5, 0, Math.PI * 2);
      tCtx.arc(8, 8, 1.5, 0, Math.PI * 2);
      tCtx.arc(8, 14, 1.5, 0, Math.PI * 2);
      tCtx.fill();

    } else if (skinId === 'mechanic') {
      // 6. Mechanic Overalls
      tCtx.fillStyle = '#1d4ed8';
      tCtx.strokeStyle = '#000000';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.moveTo(-12, 6);
      tCtx.lineTo(-12, 24);
      tCtx.lineTo(12, 24);
      tCtx.lineTo(12, 6);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();

      tCtx.fillRect(-14, 2, 4, 10);
      tCtx.fillRect(10, 2, 4, 10);

      tCtx.fillStyle = '#94a3b8';
      tCtx.fillRect(-14, 8, 4, 3);
      tCtx.fillRect(10, 8, 4, 3);

      tCtx.fillStyle = '#1e40af';
      tCtx.fillRect(-5, 12, 10, 8);
      tCtx.strokeRect(-5, 12, 10, 8);

    } else if (skinId === 'hoodie') {
      // 7. Streetwear Hoodie
      tCtx.fillStyle = '#334155';
      tCtx.strokeStyle = '#000000';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.moveTo(-16, 2);
      tCtx.lineTo(-14, 24);
      tCtx.lineTo(14, 24);
      tCtx.lineTo(16, 2);
      tCtx.closePath();
      tCtx.fill();
      tCtx.stroke();

      // Kangaroo pocket
      tCtx.fillStyle = '#1e293b';
      tCtx.beginPath();
      tCtx.roundRect(-8, 13, 16, 9, 3);
      tCtx.fill();
      tCtx.stroke();

      // White drawstrings
      tCtx.strokeStyle = '#ffffff';
      tCtx.lineWidth = 1.5;
      tCtx.beginPath();
      tCtx.moveTo(-3, 3);
      tCtx.lineTo(-3, 10);
      tCtx.moveTo(3, 3);
      tCtx.lineTo(3, 10);
      tCtx.stroke();
    }

    tCtx.restore();
  }

  // Main Loop
  let lastTime = performance.now();
  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    try {
      update(dt);
      render();
    } catch (loopErr) {
      console.error('Frame loop error:', loopErr);
    }

    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);

  // ================= 9. TASK MINIGAMES & SYSTEM =================
  let activeAsteroidAnim = null;
  let activeDownloadTimer = null;
  let currentTaskObj = null;

  function openTaskModal(task) {
    if (!task) return;
    currentTaskObj = task;
    const name = (task.name || '').toLowerCase();
    const type = (task.type || '').toLowerCase();
    if (task.isCamera || name.includes('camera') || name.includes('surveillance')) {
      openSecurityCams();
      return;
    }
    if (type === 'meal' || name.includes('meal') || name.includes('yemek') || name.includes('tepsi')) {
      initMealTask();
    } else if (type === 'garbage' || name.includes('garbage') || name.includes('çöp') || name.includes('cop')) {
      initGarbageTask();
    } else if (type === 'fuel' || name.includes('fuel') || name.includes('yakıt') || name.includes('motor')) {
      initFuelTask();
    } else if (type === 'wiring' || name.includes('wiring') || name.includes('kablo')) {
      initWiringTask();
    } else if (type === 'card' || name.includes('card') || name.includes('kart')) {
      initCardTask();
    } else if (type === 'asteroids' || name.includes('asteroids') || name.includes('asteroit')) {
      initAsteroidsTask();
    } else if (type === 'download' || name.includes('download') || name.includes('indir') || name.includes('sample')) {
      initDownloadTask();
    } else if (type === 'divert' || name.includes('divert') || name.includes('güç') || name.includes('power')) {
      initDivertTask();
    } else if (type === 'reactor' || name.includes('reactor') || name.includes('reaktör')) {
      initReactorTask();
    } else if (type === 'steering' || name.includes('steering') || name.includes('yön')) {
      initSteeringTask();
    } else if (type === 'scan' || name.includes('scan') || name.includes('tara')) {
      initMedbayScanTask();
    } else if (name.includes('shields')) {
      initDivertTask();
    } else {
      initMealTask();
    }
  }

  // Cafeteria Meal Tray Minigame (Unique handcrafted task for Cafeteria!)
  let mealPlacedCount = 0;
  function initMealTask() {
    const modal = document.getElementById('task-modal-meal');
    if (!modal) return;
    modal.classList.remove('hidden');

    mealPlacedCount = 0;
    const banner = document.getElementById('meal-served-banner');
    if (banner) banner.classList.add('hidden');

    const foodItems = ['pizza', 'burger', 'drink', 'apple'];
    foodItems.forEach(item => {
      const el = document.getElementById('food-' + item);
      if (el) {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.onclick = () => {
          placeMealItem(item);
        };
      }
      const slot = document.getElementById('slot-' + item);
      if (slot) {
        slot.style.background = 'rgba(0,0,0,0.25)';
        slot.style.borderColor = '#94a3b8';
        const label = slot.querySelector('.slot-label');
        if (label) label.innerText = item.toUpperCase() + ' KOY';
        slot.onclick = () => {
          placeMealItem(item);
        };
      }
    });

    function placeMealItem(item) {
      const el = document.getElementById('food-' + item);
      const slot = document.getElementById('slot-' + item);
      if (!el || !slot || el.style.opacity === '0.25') return;

      el.style.opacity = '0.25';
      el.style.pointerEvents = 'none';

      slot.style.background = 'rgba(34, 197, 94, 0.25)';
      slot.style.borderColor = '#22c55e';
      const label = slot.querySelector('.slot-label');
      if (label) label.innerText = 'YERLEŞTİRİLDİ ✔';

      playSound(sounds.keypress);
      mealPlacedCount++;

      if (mealPlacedCount >= 4) {
        if (banner) banner.classList.remove('hidden');
        playSound(sounds.taskComplete);
        setTimeout(() => {
          taskCompleted();
        }, 1200);
      }
    }
  }

  let activeFuelInterval = null;
  let isFuelingActive = false;
  let fuelProgress = 0;

  window.closeCurrentTask = function() {
    const mealModal = document.getElementById('task-modal-meal');
    [wiringModal, cardModal, asteroidsModal, downloadModal, divertModal, garbageModal, reactorModal, steeringModal, medbayScanModal, fuelModal, mealModal].forEach(m => {
      if (m) m.classList.add('hidden');
    });
    if (activeAsteroidAnim) {
      cancelAnimationFrame(activeAsteroidAnim);
      activeAsteroidAnim = null;
    }
    if (activeDownloadTimer) {
      clearInterval(activeDownloadTimer);
      activeDownloadTimer = null;
    }
    if (activeFuelInterval) {
      clearInterval(activeFuelInterval);
      activeFuelInterval = null;
    }
    isFuelingActive = false;
    currentTaskObj = null;
  };

  function taskCompleted() {
    playSound(sounds.taskComplete);
    if (currentTaskObj) {
      localPlayer.completedTaskIds = localPlayer.completedTaskIds || new Set();
      localPlayer.completedTaskIds.add(currentTaskObj.id);
      markTaskCompletedInHud(currentTaskObj.name);
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'TASK_COMPLETED' }));
    }
    // Update local task progress bar immediately
    const doneCount = localPlayer.completedTaskIds ? localPlayer.completedTaskIds.size : 1;
    updateTaskProgress(doneCount, 5);
    window.closeCurrentTask();
  }

  function markTaskCompletedInHud(taskName) {
    const list = document.getElementById('tasks-list');
    if (list) {
      const items = list.querySelectorAll('.task-item');
      items.forEach(el => {
        const clean = taskName.toLowerCase();
        const elText = el.innerText.toLowerCase();
        if ((clean.includes('fuel') && (elText.includes('fuel') || elText.includes('yakıt') || elText.includes('motor'))) ||
            ((clean.includes('wiring') || clean.includes('kablo')) && (elText.includes('wiring') || elText.includes('kablo'))) ||
            ((clean.includes('card') || clean.includes('kart')) && (elText.includes('card') || elText.includes('kart'))) ||
            ((clean.includes('download') || clean.includes('indir')) && (elText.includes('download') || elText.includes('indir'))) ||
            ((clean.includes('garbage') || clean.includes('çöp')) && (elText.includes('garbage') || elText.includes('çöp'))) ||
            ((clean.includes('asteroids') || clean.includes('asteroit')) && (elText.includes('asteroids') || elText.includes('asteroit'))) ||
            ((clean.includes('steering') || clean.includes('rota')) && (elText.includes('steering') || elText.includes('rota'))) ||
            ((clean.includes('scan') || clean.includes('tarama')) && (elText.includes('scan') || elText.includes('tarama'))) ||
            ((clean.includes('meal') || clean.includes('yemek') || clean.includes('tepsi') || clean.includes('kafeterya')) && (elText.includes('meal') || elText.includes('yemek') || elText.includes('tepsi') || elText.includes('kafeterya'))) ||
            elText.includes(clean)) {
          el.classList.add('completed');
          el.style.color = '#22c55e';
          el.style.textDecoration = 'line-through';
          if (!el.innerText.endsWith('✓')) el.innerText += ' ✓';
        }
      });
    }

    const altItems = document.querySelectorAll('#task-list-items li');
    altItems.forEach(li => {
      if (li.innerText.toLowerCase().includes(taskName.toLowerCase().split(':')[0])) {
        li.style.color = '#22c55e';
        li.style.textDecoration = 'line-through';
        if (!li.innerText.endsWith('✓')) li.innerText += ' ✓';
      }
    });
  }

  function resetHudTaskList() {
    const list = document.getElementById('tasks-list');
    if (list) {
      list.innerHTML = `
        <div class="task-title" style="font-weight: 800; color: #facc15; margin-bottom: 4px;">Görevler:</div>
        <div class="task-item">• Elektrik: Kabloları Tamir Et</div>
        <div class="task-item">• Admin: Kartı Okut</div>
        <div class="task-item">• Depo: Yakıt Bidonunu Doldur</div>
        <div class="task-item">• Alt Motor: Motorları Doldur</div>
        <div class="task-item">• Kafeterya: Çöpü Boşalt</div>
      `;
    }
  }

  // 10. Authentic Fuel Engines Task (Refuel Canister / Engines)
  function initFuelTask() {
    if (!fuelModal) return;
    fuelModal.classList.remove('hidden');
    fuelProgress = 0;
    isFuelingActive = false;
    if (activeFuelInterval) {
      clearInterval(activeFuelInterval);
      activeFuelInterval = null;
    }

    const titleEl = document.getElementById('fuel-task-title');
    if (titleEl && currentTaskObj) {
      titleEl.innerText = (currentTaskObj.name || 'ENGINES: FUEL ENGINES').toUpperCase();
    }

    const liquidBar = document.getElementById('fuel-liquid-bar');
    const pctText = document.getElementById('fuel-pct-text');
    const statusLamp = document.getElementById('fuel-status-lamp');
    const statusLabel = document.getElementById('fuel-status-label');
    const actionHint = document.getElementById('fuel-action-hint');
    const btnHolder = document.getElementById('btn-fuel-holder');

    if (liquidBar) liquidBar.style.height = '0%';
    if (pctText) pctText.innerText = '0%';
    if (statusLamp) {
      statusLamp.style.background = '#ef4444';
      statusLamp.style.boxShadow = '0 0 12px #ef4444';
    }
    if (statusLabel) {
      statusLabel.innerText = 'NEEDS FUEL';
      statusLabel.style.color = '#f87171';
    }
    if (actionHint) {
      actionHint.innerText = 'BASILI TUT / HOLD';
      actionHint.style.color = '#94a3b8';
    }
    if (btnHolder) {
      btnHolder.style.boxShadow = '0 8px 25px rgba(0,0,0,0.7), inset 0 3px 6px rgba(255,255,255,0.3)';
      btnHolder.style.borderColor = '#64748b';
      btnHolder.style.transform = 'scale(1)';
    }

    function startRefuel() {
      if (fuelProgress >= 100 || isFuelingActive) return;
      isFuelingActive = true;
      if (btnHolder) {
        btnHolder.style.transform = 'scale(0.93)';
        btnHolder.style.boxShadow = '0 3px 12px rgba(245,158,11,0.6), inset 0 2px 4px rgba(0,0,0,0.4)';
        btnHolder.style.borderColor = '#f59e0b';
      }
      if (statusLamp) {
        statusLamp.style.background = '#f59e0b';
        statusLamp.style.boxShadow = '0 0 14px #f59e0b';
      }
      if (statusLabel) {
        statusLabel.innerText = 'REFUELING...';
        statusLabel.style.color = '#facc15';
      }
      if (actionHint) {
        actionHint.innerText = 'DOLDURULUYOR...';
        actionHint.style.color = '#facc15';
      }

      if (activeFuelInterval) clearInterval(activeFuelInterval);
      activeFuelInterval = setInterval(() => {
        if (!isFuelingActive) {
          clearInterval(activeFuelInterval);
          activeFuelInterval = null;
          return;
        }
        fuelProgress += 1.6;
        if (sounds.footsteps && sounds.footsteps.length > 0 && Math.random() < 0.2) {
          playSound(sounds.footsteps[0]);
        }
        if (liquidBar) liquidBar.style.height = Math.min(100, fuelProgress) + '%';
        if (pctText) pctText.innerText = Math.min(100, Math.floor(fuelProgress)) + '%';

        if (fuelProgress >= 100) {
          clearInterval(activeFuelInterval);
          activeFuelInterval = null;
          isFuelingActive = false;
          if (statusLamp) {
            statusLamp.style.background = '#22c55e';
            statusLamp.style.boxShadow = '0 0 16px #22c55e';
          }
          if (statusLabel) {
            statusLabel.innerText = 'TANK FULL!';
            statusLabel.style.color = '#4ade80';
          }
          if (actionHint) {
            actionHint.innerText = 'DOLDU! / COMPLETE';
            actionHint.style.color = '#4ade80';
          }
          if (btnHolder) {
            btnHolder.style.transform = 'scale(1)';
            btnHolder.style.borderColor = '#22c55e';
            btnHolder.style.boxShadow = '0 0 20px rgba(34,197,94,0.7)';
          }
          setTimeout(() => {
            taskCompleted();
          }, 600);
        }
      }, 35);
    }

    function stopRefuel() {
      if (fuelProgress >= 100) return;
      isFuelingActive = false;
      if (activeFuelInterval) {
        clearInterval(activeFuelInterval);
        activeFuelInterval = null;
      }
      if (btnHolder) {
        btnHolder.style.transform = 'scale(1)';
        btnHolder.style.boxShadow = '0 8px 25px rgba(0,0,0,0.7), inset 0 3px 6px rgba(255,255,255,0.3)';
        btnHolder.style.borderColor = '#64748b';
      }
      if (statusLamp) {
        statusLamp.style.background = '#ef4444';
        statusLamp.style.boxShadow = '0 0 12px #ef4444';
      }
      if (statusLabel) {
        statusLabel.innerText = 'PAUSED';
        statusLabel.style.color = '#f87171';
      }
      if (actionHint) {
        actionHint.innerText = 'BASILI TUT / HOLD';
        actionHint.style.color = '#94a3b8';
      }
    }

    if (btnHolder) {
      btnHolder.onmousedown = (e) => { e.preventDefault(); startRefuel(); };
      btnHolder.onmouseup = (e) => { e.preventDefault(); stopRefuel(); };
      btnHolder.onmouseleave = (e) => { e.preventDefault(); stopRefuel(); };
      btnHolder.ontouchstart = (e) => { e.preventDefault(); startRefuel(); };
      btnHolder.ontouchend = (e) => { e.preventDefault(); stopRefuel(); };
    }
  }

  // 1. Wiring Task
  function initWiringTask() {
    wiringModal.classList.remove('hidden');
    const wCanvas = document.getElementById('wiring-canvas');
    const wctx = wCanvas.getContext('2d');
    const leftCol = document.getElementById('wiring-left-pins');
    const rightCol = document.getElementById('wiring-right-pins');

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';
    wctx.clearRect(0, 0, wCanvas.width, wCanvas.height);

    const wireColors = ['#ef4444', '#3b82f6', '#eab308', '#ec4899'];
    const leftOrder = [...wireColors].sort(() => 0.5 - Math.random());
    const rightOrder = [...wireColors].sort(() => 0.5 - Math.random());

    const connected = {};
    let activeWire = null;

    leftOrder.forEach((color, idx) => {
      const pin = document.createElement('div');
      pin.className = 'wire-pin';
      pin.style.backgroundColor = color;
      pin.dataset.color = color;
      pin.dataset.idx = idx;
      pin.onmousedown = (e) => {
        if (connected[color]) return;
        activeWire = { color, startY: idx * 75 + 38 };
      };
      leftCol.appendChild(pin);
    });

    rightOrder.forEach((color, idx) => {
      const pin = document.createElement('div');
      pin.className = 'wire-pin';
      pin.style.backgroundColor = color;
      pin.dataset.color = color;
      pin.dataset.idx = idx;
      pin.onmouseup = () => {
        if (activeWire && activeWire.color === color) {
          connected[color] = { startY: activeWire.startY, endY: idx * 75 + 38 };
          activeWire = null;
          redrawWiring();
          if (Object.keys(connected).length === 4) {
            setTimeout(taskCompleted, 500);
          }
        }
      };
      rightCol.appendChild(pin);
    });

    wCanvas.onmousemove = (e) => {
      if (!activeWire) return;
      const rect = wCanvas.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      redrawWiring(curX, curY);
    };

    window.onmouseup = () => {
      if (activeWire) {
        activeWire = null;
        redrawWiring();
      }
    };

    function redrawWiring(curX, curY) {
      wctx.clearRect(0, 0, wCanvas.width, wCanvas.height);
      for (const [col, pos] of Object.entries(connected)) {
        wctx.strokeStyle = col;
        wctx.lineWidth = 14;
        wctx.beginPath();
        wctx.moveTo(0, pos.startY);
        wctx.lineTo(wCanvas.width, pos.endY);
        wctx.stroke();
      }
      if (activeWire && curX !== undefined) {
        wctx.strokeStyle = activeWire.color;
        wctx.lineWidth = 14;
        wctx.beginPath();
        wctx.moveTo(0, activeWire.startY);
        wctx.lineTo(curX, curY);
        wctx.stroke();
      }
    }
  }

  // 2. Swipe Card
  function initCardTask() {
    cardModal.classList.remove('hidden');
    const cardEl = document.getElementById('draggable-card');
    const statusEl = document.getElementById('card-status-text');
    cardEl.style.transform = 'translateX(0px)';
    statusEl.innerText = 'Please swipe card';
    statusEl.style.color = '#e2e8f0';

    let isDragging = false;
    let startX = 0;
    let startTime = 0;

    cardEl.onmousedown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startTime = Date.now();
      statusEl.innerText = 'Reading card...';
    };

    window.onmousemove = (e) => {
      if (!isDragging) return;
      const dx = Math.max(0, Math.min(300, e.clientX - startX));
      cardEl.style.transform = 'translateX(' + dx + 'px)';
    };

    window.onmouseup = () => {
      if (!isDragging) return;
      isDragging = false;
      const curX = parseInt(cardEl.style.transform.replace(/[^0-9]/g, '')) || 0;
      const swipeDuration = Date.now() - startTime;

      if (curX >= 260) {
        if (swipeDuration < 280) {
          statusEl.innerText = 'Too fast! Try again.';
          statusEl.style.color = '#ef4444';
        } else if (swipeDuration > 1100) {
          statusEl.innerText = 'Too slow! Try again.';
          statusEl.style.color = '#ef4444';
        } else {
          statusEl.innerText = 'Accepted. Thank you!';
          statusEl.style.color = '#22c55e';
          setTimeout(taskCompleted, 600);
          return;
        }
      } else {
        statusEl.innerText = 'Bad read. Try again.';
        statusEl.style.color = '#ef4444';
      }
      cardEl.style.transform = 'translateX(0px)';
    };
  }

  // 3. Clear Asteroids
  function initAsteroidsTask() {
    asteroidsModal.classList.remove('hidden');
    const aCanvas = document.getElementById('asteroids-canvas');
    if (!aCanvas) return;
    const actx = aCanvas.getContext('2d');
    const scoreEl = document.getElementById('asteroids-count-num') || document.getElementById('asteroids-score-num');
    let score = 0;
    if (scoreEl) scoreEl.innerText = '0';

    let mouseX = aCanvas.width / 2;
    let mouseY = aCanvas.height / 2;
    let lasers = [];
    let explosions = [];

    let asteroids = [];
    // Initial spawn distributed across screen so player sees targets immediately!
    for (let i = 0; i < 7; i++) {
      spawnAsteroid(true);
    }

    function spawnAsteroid(initial = false) {
      const initX = initial ? (Math.random() * (aCanvas.width - 120) + 90) : (aCanvas.width + Math.random() * 80);
      asteroids.push({
        x: initX,
        y: Math.random() * (aCanvas.height - 80) + 40,
        r: 16 + Math.random() * 14,
        speed: 1.2 + Math.random() * 1.8,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04
      });
    }

    aCanvas.onmousemove = (e) => {
      const rect = aCanvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    aCanvas.onclick = (e) => {
      const rect = aCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Laser blast from dual ship cannons
      lasers.push({ x1: 40, y1: aCanvas.height, x2: mx, y2: my, life: 1 });
      lasers.push({ x1: aCanvas.width - 40, y1: aCanvas.height, x2: mx, y2: my, life: 1 });
      playSound(sounds.taskStep);

      let hit = false;
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const ast = asteroids[i];
        if (Math.hypot(mx - ast.x, my - ast.y) < ast.r + 14) {
          // Spawn explosion particles
          for (let p = 0; p < 8; p++) {
            explosions.push({
              x: ast.x,
              y: ast.y,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              r: 2 + Math.random() * 4,
              color: Math.random() > 0.5 ? '#f59e0b' : '#ef4444',
              life: 1
            });
          }
          asteroids.splice(i, 1);
          score++;
          if (scoreEl) scoreEl.innerText = score;
          spawnAsteroid(false);
          hit = true;
          if (score >= 15) {
            setTimeout(taskCompleted, 350);
          }
          break;
        }
      }
    };

    function updateAsteroids() {
      actx.fillStyle = '#030712';
      actx.fillRect(0, 0, aCanvas.width, aCanvas.height);

      // Starfield background
      actx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let s = 0; s < 25; s++) {
        const sx = ((s * 137) + (Date.now() / 60)) % aCanvas.width;
        const sy = (s * 43) % aCanvas.height;
        actx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Draw active laser blasts
      for (let l = lasers.length - 1; l >= 0; l--) {
        const laser = lasers[l];
        actx.save();
        actx.strokeStyle = `rgba(34, 197, 94, ${laser.life})`;
        actx.lineWidth = 3.5;
        actx.shadowColor = '#22c55e';
        actx.shadowBlur = 12;
        actx.beginPath();
        actx.moveTo(laser.x1, laser.y1);
        actx.lineTo(laser.x2, laser.y2);
        actx.stroke();
        actx.restore();
        laser.life -= 0.18;
        if (laser.life <= 0) lasers.splice(l, 1);
      }

      // Draw explosion particles
      for (let ep = explosions.length - 1; ep >= 0; ep--) {
        const p = explosions[ep];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) {
          explosions.splice(ep, 1);
          continue;
        }
        const radius = Math.max(0.1, p.r * p.life);
        actx.fillStyle = p.color;
        actx.beginPath();
        actx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        actx.fill();
      }

      // Maintain asteroid population consistently
      while (asteroids.length < 7) {
        spawnAsteroid(false);
      }

      // Draw Asteroids
      for (let i = 0; i < asteroids.length; i++) {
        const ast = asteroids[i];
        ast.x -= ast.speed;
        ast.rot += ast.rotSpeed;
        if (ast.x < -40) {
          ast.x = aCanvas.width + 40;
          ast.y = Math.random() * (aCanvas.height - 80) + 40;
        }

        actx.save();
        actx.translate(ast.x, ast.y);
        actx.rotate(ast.rot);

        // Rocky asteroid shape
        actx.fillStyle = '#78716c';
        actx.strokeStyle = '#44403c';
        actx.lineWidth = 2.5;
        actx.beginPath();
        actx.arc(0, 0, ast.r, 0, Math.PI * 2);
        actx.fill();
        actx.stroke();

        // Craters
        actx.fillStyle = '#57534e';
        actx.beginPath();
        actx.arc(-ast.r * 0.35, -ast.r * 0.2, ast.r * 0.28, 0, Math.PI * 2);
        actx.arc(ast.r * 0.3, ast.r * 0.35, ast.r * 0.22, 0, Math.PI * 2);
        actx.fill();

        actx.restore();
      }

      // Dynamic Aiming Crosshair following mouse
      actx.save();
      actx.strokeStyle = '#38bdf8';
      actx.lineWidth = 2;
      actx.shadowColor = '#38bdf8';
      actx.shadowBlur = 8;
      actx.beginPath();
      actx.arc(mouseX, mouseY, 28, 0, Math.PI * 2);
      actx.moveTo(mouseX - 36, mouseY);
      actx.lineTo(mouseX - 12, mouseY);
      actx.moveTo(mouseX + 12, mouseY);
      actx.lineTo(mouseX + 36, mouseY);
      actx.moveTo(mouseX, mouseY - 36);
      actx.lineTo(mouseX, mouseY - 12);
      actx.moveTo(mouseX, mouseY + 12);
      actx.lineTo(mouseX, mouseY + 36);
      actx.stroke();
      actx.restore();

      if (score < 15 && !asteroidsModal.classList.contains('hidden')) {
        activeAsteroidAnim = requestAnimationFrame(updateAsteroids);
      }
    }
    updateAsteroids();
  }

  // 4. Download Data
  function initDownloadTask() {
    downloadModal.classList.remove('hidden');
    const fillEl = document.getElementById('download-bar-fill');
    const statusEl = document.getElementById('download-status-text');
    const btnAction = document.getElementById('btn-start-download');

    fillEl.style.width = '0%';
    statusEl.innerText = 'Estimated Time: 6s';
    statusEl.style.color = '#94a3b8';
    btnAction.disabled = false;
    btnAction.innerText = 'DOWNLOAD';

    btnAction.onclick = () => {
      btnAction.disabled = true;
      btnAction.innerText = 'DOWNLOADING...';

      let elapsed = 0;
      const totalTime = 5500;
      const interval = 100;

      if (activeDownloadTimer) clearInterval(activeDownloadTimer);
      activeDownloadTimer = setInterval(() => {
        elapsed += interval;
        const pct = Math.min(100, Math.round((elapsed / totalTime) * 100));
        fillEl.style.width = pct + '%';

        const remSec = Math.max(0, Math.ceil((totalTime - elapsed) / 1000));
        statusEl.innerText = 'Estimated Time: ' + remSec + 's (' + pct + '%)';

        if (elapsed >= totalTime) {
          clearInterval(activeDownloadTimer);
          activeDownloadTimer = null;
          statusEl.innerText = 'DOWNLOAD COMPLETE!';
          statusEl.style.color = '#22c55e';
          setTimeout(taskCompleted, 600);
        }
      }, interval);
    };
  }

  // 5. Divert Power (Authentic Among Us Slider)
  function initDivertTask() {
    divertModal.classList.remove('hidden');
    const gaugeFill = document.getElementById('divert-gauge-bar') || document.getElementById('divert-gauge-fill');
    const thumb = document.getElementById('divert-slider-thumb') || document.getElementById('divert-switch-thumb');
    const track = document.getElementById('divert-switch-track');
    if (!thumb || !gaugeFill) return;

    gaugeFill.style.height = '20%';
    thumb.classList.remove('completed');
    thumb.style.bottom = '8px';
    thumb.style.background = '#ea580c';
    thumb.innerHTML = '▲';

    let isPulling = false;
    let startY = 0;
    const maxDy = 185;

    const onStartPull = (e) => {
      if (thumb.classList.contains('completed')) return;
      isPulling = true;
      startY = e.clientY;
      e.preventDefault();
    };

    thumb.onmousedown = onStartPull;
    if (track) {
      track.onmousedown = (e) => {
        if (thumb.classList.contains('completed')) return;
        isPulling = true;
        startY = e.clientY;
      };
    }

    window.onmousemove = (e) => {
      if (!isPulling) return;
      const dy = Math.max(0, Math.min(maxDy, startY - e.clientY));
      thumb.style.bottom = (8 + dy) + 'px';
      gaugeFill.style.height = (20 + (dy / maxDy) * 80) + '%';
    };

    window.onmouseup = () => {
      if (!isPulling) return;
      isPulling = false;

      const currentBottom = parseInt(thumb.style.bottom) || 8;
      if (currentBottom >= 140) {
        thumb.classList.add('completed');
        thumb.style.bottom = maxDy + 'px';
        thumb.style.background = '#22c55e';
        thumb.innerHTML = '✓';
        gaugeFill.style.height = '100%';
        playSound(sounds.taskComplete);
        setTimeout(taskCompleted, 550);
      } else {
        thumb.style.bottom = '8px';
        gaugeFill.style.height = '20%';
      }
    };
  }

  // 6. Empty Garbage
  function initGarbageTask() {
    if (!garbageModal) return;
    garbageModal.classList.remove('hidden');
    const lever = document.getElementById('garbage-lever-handle');
    const bin = document.getElementById('garbage-bin');
    if (!lever || !bin) return;

    lever.innerText = '⬇️ PULL & HOLD';
    lever.style.transform = 'translateY(0px)';
    bin.style.transform = 'translateY(0px)';
    bin.style.opacity = '1';

    let isHolding = false;
    let holdTimer = null;
    let holdElapsed = 0;

    lever.onmousedown = () => {
      isHolding = true;
      lever.style.transform = 'translateY(80px)';
      lever.innerText = 'EMPTYING...';

      holdTimer = setInterval(() => {
        holdElapsed += 100;
        bin.style.transform = 'translateY(' + (holdElapsed * 0.15) + 'px)';
        bin.style.opacity = Math.max(0, 1 - holdElapsed / 2200);

        if (holdElapsed >= 2200) {
          clearInterval(holdTimer);
          lever.innerText = 'EMPTY ✓';
          setTimeout(taskCompleted, 500);
        }
      }, 100);
    };

    window.onmouseup = () => {
      if (isHolding) {
        isHolding = false;
        clearInterval(holdTimer);
        if (holdElapsed < 2200) {
          lever.style.transform = 'translateY(0px)';
          lever.innerText = '⬇️ PULL & HOLD';
          bin.style.transform = 'translateY(0px)';
          bin.style.opacity = '1';
          holdElapsed = 0;
        }
      }
    };
  }

  // 7. Start Reactor (Simon Says - Authentic Among Us with Keypad & Indicator LEDs)
  function initReactorTask() {
    if (!reactorModal) return;
    reactorModal.classList.remove('hidden');
    let stage = 1;
    const stageNum = document.getElementById('reactor-stage-num');
    const flashTiles = document.querySelectorAll('#task-modal-reactor .reactor-flash-tile');
    const keyBtns = document.querySelectorAll('#task-modal-reactor .reactor-key-btn');

    let sequence = [];
    let playerSeq = [];
    let isShowingSequence = false;

    for (let i = 0; i < 5; i++) {
      sequence.push(Math.floor(Math.random() * 9));
    }

    function updateStageLeds(curStage) {
      for (let s = 1; s <= 5; s++) {
        const led = document.getElementById('stage-led-' + s);
        if (led) {
          if (s < curStage) led.classList.add('lit');
          else led.classList.remove('lit');
        }
      }
    }

    function playSequence() {
      isShowingSequence = true;
      playerSeq = [];
      if (stageNum) stageNum.innerText = stage;
      updateStageLeds(stage);

      let step = 0;
      flashTiles.forEach(t => t.classList.remove('active', 'lit'));

      const interval = setInterval(() => {
        if (step > 0 && flashTiles[sequence[step - 1]]) {
          flashTiles[sequence[step - 1]].classList.remove('active', 'lit');
        }
        if (step < stage && flashTiles[sequence[step]]) {
          flashTiles[sequence[step]].classList.add('active', 'lit');
          playSound(sounds.keypress);
          step++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            if (flashTiles[sequence[step - 1]]) {
              flashTiles[sequence[step - 1]].classList.remove('active', 'lit');
            }
            isShowingSequence = false;
          }, 350);
        }
      }, 500);
    }

    keyBtns.forEach(btn => {
      btn.onclick = () => {
        if (isShowingSequence) return;
        const idx = parseInt(btn.getAttribute('data-idx'));
        btn.classList.add('pressed');
        playSound(sounds.keypress);
        setTimeout(() => btn.classList.remove('pressed'), 180);

        playerSeq.push(idx);
        const curStep = playerSeq.length - 1;

        if (playerSeq[curStep] !== sequence[curStep]) {
          playerSeq = [];
          flashTiles.forEach(t => {
            t.style.background = '#ef4444';
            setTimeout(() => { t.style.background = ''; }, 300);
          });
          setTimeout(playSequence, 650);
        } else if (playerSeq.length === stage) {
          if (stage >= 5) {
            updateStageLeds(6);
            flashTiles.forEach(t => t.classList.add('lit'));
            setTimeout(taskCompleted, 550);
          } else {
            stage++;
            updateStageLeds(stage);
            setTimeout(playSequence, 650);
          }
        }
      };
    });

    playSequence();
  }

  // 8. Stabilize Steering
  function initSteeringTask() {
    if (!steeringModal) return;
    steeringModal.classList.remove('hidden');
    const sCanvas = document.getElementById('steering-canvas');
    const sctx = sCanvas.getContext('2d');

    let targetX = 120 + Math.random() * 220;
    let targetY = 100 + Math.random() * 140;
    let reticleX = sCanvas.width / 2;
    let reticleY = sCanvas.height / 2;

    sCanvas.onclick = (e) => {
      const rect = sCanvas.getBoundingClientRect();
      reticleX = e.clientX - rect.left;
      reticleY = e.clientY - rect.top;
      drawSteering();

      if (Math.hypot(reticleX - targetX, reticleY - targetY) < 25) {
        sctx.strokeStyle = '#22c55e';
        sctx.lineWidth = 4;
        sctx.strokeRect(targetX - 25, targetY - 25, 50, 50);
        setTimeout(taskCompleted, 500);
      }
    };

    function drawSteering() {
      sctx.fillStyle = '#0f172a';
      sctx.fillRect(0, 0, sCanvas.width, sCanvas.height);

      // Radar circles
      sctx.strokeStyle = '#334155';
      sctx.lineWidth = 1.5;
      sctx.beginPath();
      sctx.arc(sCanvas.width / 2, sCanvas.height / 2, 70, 0, Math.PI * 2);
      sctx.arc(sCanvas.width / 2, sCanvas.height / 2, 130, 0, Math.PI * 2);
      sctx.stroke();

      // Target Reticle
      sctx.strokeStyle = '#ef4444';
      sctx.lineWidth = 2.5;
      sctx.beginPath();
      sctx.arc(targetX, targetY, 20, 0, Math.PI * 2);
      sctx.stroke();

      // Ship Course Reticle
      sctx.strokeStyle = '#38bdf8';
      sctx.lineWidth = 3;
      sctx.beginPath();
      sctx.moveTo(reticleX - 20, reticleY);
      sctx.lineTo(reticleX + 20, reticleY);
      sctx.moveTo(reticleX, reticleY - 20);
      sctx.lineTo(reticleX, reticleY + 20);
      sctx.stroke();
    }
    drawSteering();
  }

  // 9. Submit MedBay Scan
  function initMedbayScanTask() {
    if (!medbayScanModal) return;
    medbayScanModal.classList.remove('hidden');
    const statusText = document.getElementById('medbay-scan-status');
    const avatarHolo = document.getElementById('medbay-avatar-hologram');
    if (avatarHolo) {
      avatarHolo.innerHTML = '<img src="assets/Images/Player/' + localPlayer.color + '/' + localPlayer.color.toLowerCase() + '_right_walk/step1.png" style="width: 70px; height: 90px; filter: drop-shadow(0 0 10px #22c55e);">';
    }

    let countdown = 6;
    const interval = setInterval(() => {
      countdown--;
      if (statusText) statusText.innerText = 'SCANNING IN PROGRESS... ' + countdown + 's';
      if (countdown <= 0) {
        clearInterval(interval);
        if (statusText) {
          statusText.innerText = 'SCAN COMPLETE! VERIFIED CREWMATE.';
          statusText.style.color = '#22c55e';
        }
        setTimeout(taskCompleted, 700);
      }
    }, 1000);
  }

  // ================= 10. SECURITY SURVEILLANCE CAMERAS =================
  let camsInterval = null;
  function openSecurityCams() {
    if (!securityCamsModal) return;
    securityCamsModal.classList.remove('hidden');
    isViewingCameras = true;
    safeSendWs({ type: 'VIEW_CAMERAS', isViewing: true });
    renderCameraFeeds();
    if (camsInterval) clearInterval(camsInterval);
    camsInterval = setInterval(renderCameraFeeds, 350);
  }

  window.closeSecurityCams = function() {
    if (securityCamsModal) securityCamsModal.classList.add('hidden');
    isViewingCameras = false;
    isSomeoneWatchingCameras = false;
    safeSendWs({ type: 'VIEW_CAMERAS', isViewing: false });
    if (camsInterval) {
      clearInterval(camsInterval);
      camsInterval = null;
    }
    const camsCanvas = document.getElementById('cams-composite-canvas');
    if (camsCanvas) {
      const cCtx = camsCanvas.getContext('2d');
      if (cCtx) cCtx.clearRect(0, 0, camsCanvas.width, camsCanvas.height);
    }
    for (const k in keys) keys[k] = false;
  };

  function renderCameraFeeds() {
    const camsCanvas = document.getElementById('cams-composite-canvas');
    if (!camsCanvas) return;
    const cCtx = camsCanvas.getContext('2d');
    if (!cCtx) return;

    // 1. Draw base console monitor (Photo 5)
    if (securityCamsImg && securityCamsImg.complete && securityCamsImg.naturalWidth > 0) {
      cCtx.drawImage(securityCamsImg, 0, 0, camsCanvas.width, camsCanvas.height);
    } else {
      cCtx.fillStyle = '#0f172a';
      cCtx.fillRect(0, 0, camsCanvas.width, camsCanvas.height);
    }

    // 2. 4 CCTV Hallway Quadrants (matching Photo 4 & 5 authentic corridor bounds & positions):
    const cams = [
      {
        name: 'NAVIGATION CORRIDOR',
        rect: { x: 30, y: 28, w: 491, h: 467 },
        bounds: { minX: 4600, maxX: 5100, minY: 1350, maxY: 1650, cx: 4830, cy: 1500 },
        screenCx: 275,
        screenCy: 262
      },
      {
        name: 'MEDBAY CORRIDOR',
        rect: { x: 535, y: 28, w: 492, h: 467 },
        bounds: { minX: 2400, maxX: 2950, minY: 600, maxY: 820, cx: 2680, cy: 710 },
        screenCx: 781,
        screenCy: 280
      },
      {
        name: 'UPPER ENGINE CORRIDOR',
        rect: { x: 30, y: 509, w: 491, h: 468 },
        bounds: { minX: 1700, maxX: 2350, minY: 600, maxY: 820, cx: 2000, cy: 680 },
        screenCx: 275,
        screenCy: 870 // Calibrated to exact corridor center (fixes Photo 4 vs Photo 5 alignment!)
      },
      {
        name: 'REACTOR / SECURITY CROSS',
        rect: { x: 535, y: 509, w: 492, h: 468 },
        bounds: { minX: 1300, maxX: 1650, minY: 1350, maxY: 1650, cx: 1475, cy: 1500 },
        screenCx: 781,
        screenCy: 640
      }
    ];

    const allPlayers = [localPlayer, ...Array.from(players.values())];

    cams.forEach(cam => {
      cCtx.save();
      cCtx.beginPath();
      cCtx.rect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h);
      cCtx.clip();

      // Find players in this hallway zone
      const present = allPlayers.filter(p => p.isAlive && !p.inVent &&
        p.x >= cam.bounds.minX && p.x <= cam.bounds.maxX &&
        p.y >= cam.bounds.minY && p.y <= cam.bounds.maxY
      );

      // Render players moving live in the CCTV feed
      const scale = 0.55;
      present.forEach(p => {
        const relX = (p.x - cam.bounds.cx) * scale;
        const relY = (p.y - cam.bounds.cy) * scale;
        const drawX = (cam.screenCx !== undefined ? cam.screenCx : (cam.rect.x + cam.rect.w / 2)) + relX;
        const drawY = (cam.screenCy !== undefined ? cam.screenCy : (cam.rect.y + cam.rect.h / 2)) + relY;

        // Render full authentic astronaut with animation in CCTV feed
        cCtx.save();
        cCtx.translate(drawX, drawY);
        cCtx.scale(0.55, 0.55);
        drawAstronautInCams(cCtx, 0, 0, p);
        cCtx.restore();

        // Name tag
        cCtx.save();
        cCtx.font = 'bold 11px AmongUsFont, Segoe UI, sans-serif';
        cCtx.fillStyle = '#ffffff';
        cCtx.shadowColor = '#000000';
        cCtx.shadowBlur = 4;
        cCtx.textAlign = 'center';
        cCtx.fillText(p.name, drawX, drawY - 26);
        cCtx.restore();
      });

      // CRT Scanlines
      cCtx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let sy = cam.rect.y; sy < cam.rect.y + cam.rect.h; sy += 4) {
        cCtx.fillRect(cam.rect.x, sy, cam.rect.w, 2);
      }

      // Subtle CCTV greenish hue
      cCtx.fillStyle = 'rgba(34, 197, 94, 0.03)';
      cCtx.fillRect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h);

      // Camera quadrant label
      cCtx.font = 'bold 13px monospace';
      cCtx.fillStyle = '#38bdf8';
      cCtx.shadowColor = '#000000';
      cCtx.shadowBlur = 4;
      cCtx.fillText(cam.name, cam.rect.x + 16, cam.rect.y + 26);

      cCtx.restore();
    });

    // Cyan dividing crosshair lines (matching Photo 5)
    cCtx.strokeStyle = '#38bdf8';
    cCtx.lineWidth = 3.5;
    cCtx.beginPath();
    cCtx.moveTo(30, 498);
    cCtx.lineTo(1027, 498);
    cCtx.moveTo(528, 28);
    cCtx.lineTo(528, 977);
    cCtx.stroke();
  }

  // ================= 11. EMERGENCY MEETING TABLET (Photo 2 Restoration) =================
  function openMeetingTablet(msg) {
    if (!meetingModal) return;
    meetingModal.classList.remove('hidden');
    selectedVoteTarget = null;
    localPlayer.hasVoted = false;
    const titleEl = document.getElementById('meeting-title-text');
    if (titleEl) titleEl.innerText = 'Who Is The Impostor?';
    
    const skipBtn = document.getElementById('btn-skip-vote');
    if (skipBtn) {
      skipBtn.style.pointerEvents = '';
      skipBtn.classList.remove('my-voted-target');
      const oldHand = skipBtn.querySelector('.card-my-vote-hand');
      if (oldHand) oldHand.remove();
    }
    const skipTokens = document.getElementById('tokens-skip');
    if (skipTokens) skipTokens.innerHTML = '';

    const grid = document.getElementById('voting-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (chatDrawer) chatDrawer.classList.add('hidden');

    // Safe player list resolution (includes localPlayer and others)
    let playerList = (msg && Array.isArray(msg.players)) ? [...msg.players] : [];
    if (playerList.length === 0) {
      playerList.push({
        id: localPlayer.id,
        name: localPlayer.name,
        color: localPlayer.color,
        isAlive: localPlayer.isAlive,
        isImpostor: localPlayer.isImpostor
      });
      players.forEach(p => {
        playerList.push({
          id: p.id,
          name: p.name,
          color: p.color,
          isAlive: p.isAlive,
          isImpostor: p.isImpostor
        });
      });
    }

    // Populate 3-column Voting Cards (Photo 4 Blank Tablet Fixed!)
    playerList.forEach(p => {
      const card = document.createElement('div');
      card.className = 'vote-card ' + (p.isAlive ? '' : 'dead');
      card.id = 'vote-card-' + p.id;

      const lower = p.color.toLowerCase();
      const isImposterName = (localPlayer.isImpostor && p.isImpostor);
      const isCaller = msg.callerId ? (p.id === msg.callerId) : (p.name === msg.caller && !p.isDummy);
      const callerEmoji = isCaller ? ' <span title="Rapor Eden / Toplantı Başlatan" style="font-size:16px;">📢</span>' : '';

      card.innerHTML = `
        <div class="card-avatar-wrapper">
          <img src="assets/Images/Player/` + p.color + `/` + lower + `_right_walk/step1.png" class="card-avatar-img" alt="` + p.color + `">
          ` + (!p.isAlive ? '<div class="dead-cross-overlay">✕</div>' : '') + `
        </div>
        <div class="card-player-name ` + (isImposterName ? 'is-impostor-text' : '') + `">
          ` + p.name + callerEmoji + `
        </div>
        <div class="card-vote-actions hidden" id="vote-actions-` + p.id + `">
          <button class="btn-confirm-vote" title="Confirm Vote">✓</button>
          <button class="btn-cancel-vote" title="Cancel">✕</button>
        </div>
        <div class="card-voted-tokens" id="tokens-` + p.id + `"></div>
      `;

      if (p.isAlive && localPlayer.isAlive && !localPlayer.hasVoted) {
        card.addEventListener('click', (e) => {
          if (meetingPhase === 'DISCUSSION') {
            alert('Tartışma süresi bitene kadar oy verilemez!\n(Voting locked during discussion period)');
            return;
          }
          if (e.target.closest('.card-vote-actions')) return;
          selectPlayerCard(p.id);
        });

        const btnConfirm = card.querySelector('.btn-confirm-vote');
        const btnCancel = card.querySelector('.btn-cancel-vote');

        btnConfirm.addEventListener('click', (e) => {
          e.stopPropagation();
          castVote(p.id);
        });

        btnCancel.addEventListener('click', (e) => {
          e.stopPropagation();
          cancelSelectedVote();
        });
      }

      grid.appendChild(card);
    });

    const timerNum = document.getElementById('meeting-timer-num');
    if (timerNum) {
      timerNum.innerHTML = '<span style="color:#38bdf8;">DISCUSSION:</span> ' + msg.timer + 's';
    }
  }

  function enableVotingCards() {
    // Voting phase active
  }

  function selectPlayerCard(targetId) {
    if (localPlayer.hasVoted || meetingPhase === 'DISCUSSION') return;
    cancelSelectedVote();
    selectedVoteTarget = targetId;

    const card = document.getElementById('vote-card-' + targetId);
    if (card) {
      card.classList.add('selected');
      const actions = document.getElementById('vote-actions-' + targetId);
      if (actions) actions.classList.remove('hidden');
    }
  }

  function cancelSelectedVote() {
    if (selectedVoteTarget) {
      const oldCard = document.getElementById('vote-card-' + selectedVoteTarget);
      if (oldCard) oldCard.classList.remove('selected');
      const oldActions = document.getElementById('vote-actions-' + selectedVoteTarget);
      if (oldActions) oldActions.classList.add('hidden');
      selectedVoteTarget = null;
    }
  }

  function castVote(targetId) {
    if (!localPlayer.isAlive || localPlayer.hasVoted || meetingPhase === 'DISCUSSION') return;
    localPlayer.hasVoted = true;
    cancelSelectedVote();

    // Clean up any existing my-vote indicators
    document.querySelectorAll('.card-my-vote-hand').forEach(el => el.remove());
    document.querySelectorAll('.my-voted-target').forEach(el => el.classList.remove('my-voted-target'));

    if (targetId === 'SKIP') {
      const skipBtn = document.getElementById('btn-skip-vote');
      if (skipBtn) {
        skipBtn.classList.add('my-voted-target');
        const hand = document.createElement('span');
        hand.className = 'card-my-vote-hand';
        hand.innerText = '👉';
        hand.style.right = '-28px';
        skipBtn.appendChild(hand);
      }
    } else {
      const targetCard = document.getElementById('vote-card-' + targetId);
      if (targetCard) {
        targetCard.classList.add('my-voted-target');
        const hand = document.createElement('div');
        hand.className = 'card-my-vote-hand';
        hand.title = 'Oyunuz (Your Vote)';
        hand.innerText = '👉';
        targetCard.appendChild(hand);
      }
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'VOTE',
        targetId: targetId
      }));
    }

    const myCard = document.getElementById('vote-card-' + localPlayer.id);
    if (myCard) {
      myCard.classList.add('has-voted');
      if (!myCard.querySelector('.card-voted-badge')) {
        const badge = document.createElement('div');
        badge.className = 'card-voted-badge';
        badge.innerHTML = '<span>🗳️</span> <span>Oy Verdi</span>';
        myCard.appendChild(badge);
      }
    }
  }

  const btnSkipVote = document.getElementById('btn-skip-vote');
  if (btnSkipVote) {
    btnSkipVote.addEventListener('click', () => {
      if (!localPlayer.isAlive) {
        alert('Ruhlar (ölüler) oy kullanamaz!\n(Ghosts cannot vote)');
        return;
      }
      if (meetingPhase === 'DISCUSSION') {
        alert('Tartışma süresi bitene kadar oy verilemez!');
        return;
      }
      castVote('SKIP');
    });
  }

  // ================= 11.5. VOTING RESULTS REVEAL (Photo 2) =================
  function showVotingResults(msg, onComplete) {
    if (!meetingModal) {
      if (onComplete) onComplete();
      return;
    }

    const titleEl = document.getElementById('meeting-title-text');
    if (titleEl) titleEl.innerText = 'Voting Results';

    document.querySelectorAll('.card-vote-actions').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.card-my-vote-hand').forEach(el => el.remove());
    const skipBtn = document.getElementById('btn-skip-vote');
    if (skipBtn) skipBtn.style.pointerEvents = 'none';

    // Clear old tokens
    document.querySelectorAll('.card-voted-tokens').forEach(el => el.innerHTML = '');

    const votes = msg.votes || {};
    Object.entries(votes).forEach(([voterId, targetId]) => {
      let voter = (localPlayer && localPlayer.id === voterId) ? localPlayer : players.get(voterId);
      if (!voter && msg.players) {
        voter = msg.players.find(p => p.id === voterId);
      }
      const vColor = voter ? voter.color : 'Red';
      const vName = voter ? voter.name : 'Player';
      const lower = vColor.toLowerCase();

      let targetContainer = null;
      if (targetId === 'SKIP') {
        targetContainer = document.getElementById('tokens-skip');
      } else {
        targetContainer = document.getElementById('tokens-' + targetId);
      }

      if (targetContainer) {
        const tokenImg = document.createElement('img');
        tokenImg.src = 'assets/Images/Player/' + vColor + '/' + lower + '_right_walk/step1.png';
        tokenImg.className = 'mini-voter-avatar';
        tokenImg.title = vName + ' (' + vColor + ')';
        tokenImg.onerror = function() {
          this.style.display = 'none';
          const dot = document.createElement('div');
          dot.className = 'mini-vote-token';
          dot.style.backgroundColor = COLOR_HEX[vColor] || '#c51111';
          targetContainer.appendChild(dot);
        };
        targetContainer.appendChild(tokenImg);
      }
    });

    let countdown = 5;
    const timerNum = document.getElementById('meeting-timer-num');
    const updateCountdown = () => {
      if (timerNum) {
        timerNum.innerHTML = '<span style="color:#ef4444; font-weight:bold;">Proceeding In: ' + countdown + 's</span>';
      }
    };
    updateCountdown();

    const interval = setInterval(() => {
      countdown--;
      updateCountdown();
      if (countdown <= 0) {
        clearInterval(interval);
        if (meetingModal) meetingModal.classList.add('hidden');
        if (skipBtn) skipBtn.style.pointerEvents = '';
        if (onComplete) onComplete();
      }
    }, 1000);
  }

  // ================= 12. EJECTION SCREEN & TYPEWRITER =================
  function showEjectionScreen(msg) {
    if (!ejectionModal) return;
    ejectionModal.classList.remove('hidden');
    const astronautWrapper = document.getElementById('ejected-astronaut-wrapper');
    const astronautImg = document.getElementById('ejected-astronaut-img');
    const textEl = document.getElementById('ejection-text');

    let fullText = '';
    if (msg.ejected) {
      astronautWrapper.style.display = 'block';
      const color = msg.ejected.color;
      const lower = color.toLowerCase();
      astronautImg.src = 'assets/Images/Player/' + color + '/' + lower + '_right_walk/step1.png';

      // Cleanly restart drift and spin animation across entire screen
      astronautWrapper.style.animation = 'none';
      astronautImg.style.animation = 'none';
      void astronautWrapper.offsetWidth; // trigger reflow
      astronautWrapper.style.animation = 'astronautDrift 10s linear forwards';
      astronautImg.style.animation = 'astronautSpin 7s linear infinite';

      const roleText = msg.ejected.isImpostor ? ' was An Impostor.' : ' was not An Impostor.';
      const remainText = msg.remainingImpostors > 1 ? (msg.remainingImpostors + ' Impostors remain.') : (msg.remainingImpostors === 1 ? '1 Impostor remains.' : 'No Impostors remain.');
      fullText = msg.ejected.name + roleText + '\n' + remainText;
    } else if (msg.isTie) {
      astronautWrapper.style.display = 'none';
      fullText = 'Tie in voting.\nNo one was ejected. (Tie)\n' + msg.remainingImpostors + ' Impostor(s) remain.';
    } else {
      astronautWrapper.style.display = 'none';
      fullText = 'Skipped voting.\nNo one was ejected. (Skipped)\n' + msg.remainingImpostors + ' Impostor(s) remain.';
    }

    // Typewriter effect matching authentic Among Us cadence
    textEl.innerText = '';
    let charIdx = 0;
    const typeInterval = setInterval(() => {
      if (charIdx < fullText.length) {
        textEl.innerText += fullText.charAt(charIdx);
        charIdx++;
      } else {
        clearInterval(typeInterval);
      }
    }, 60);

    // Ejection screen waits until astronaut completely drifts off-screen (Photo 4 fixed!)
    setTimeout(() => {
      if (ejectionModal) ejectionModal.classList.add('hidden');
      if (gameState === 'MEETING' || gameState === 'EJECTION') {
        gameState = 'PLAYING';
        localPlayer.hasVoted = false;
      }
    }, 10500);
  }

  // Kill Splash Animation (18 Frames from Photo 4)
  function playKillAnimation(callback) {
    const modal = document.getElementById('kill-animation-modal');
    const img = document.getElementById('kill-anim-screen-img');
    if (!modal || !img) {
      if (callback) callback();
      return;
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    playSound(sounds.killVictim || sounds.kill);

    let frame = 1;
    img.src = 'assets/Images/Alerts/kill1.png';
    const interval = setInterval(() => {
      frame++;
      if (frame <= 18) {
        img.src = 'assets/Images/Alerts/kill' + frame + '.png';
      } else {
        clearInterval(interval);
        setTimeout(() => {
          modal.classList.add('hidden');
          modal.style.display = 'none';
          if (callback) callback();
        }, 250);
      }
    }, 60);
  }

  // ================= 13. GAME ACTIONS & HUD =================
  function performKill() {
    if (!localPlayer.isImpostor || !localPlayer.isAlive || localPlayer.killCooldown > 0) return;
    let target = null;
    let minDist = 160;
    players.forEach(p => {
      if (!p.isImpostor && p.isAlive && !p.inVent) {
        const dist = Math.hypot(localPlayer.x - p.x, localPlayer.y - p.y);
        if (dist < minDist) {
          minDist = dist;
          target = p;
        }
      }
    });

    if (target) {
      playSound(sounds.kill);
      localPlayer.killCooldown = 15;
      if (target.isDummy || currentRoomCode.startsWith('FREEPLAY')) {
        target.isAlive = false;
        deadBodies.push({
          id: 'corpse_' + Date.now(),
          color: target.color,
          x: target.x,
          y: target.y,
          diedAt: Date.now()
        });
      }
      safeSendWs({
        type: 'KILL',
        victimId: target.id,
        targetId: target.id
      });
    }
  }

  // Photo 5: Dead Body Reported / Emergency Meeting Splash Screen
  function showReportSplash(msg, onComplete) {
    const splashModal = document.getElementById('report-splash-modal');
    const splashImg = document.getElementById('report-splash-img');
    if (!splashModal || !splashImg) {
      if (onComplete) onComplete();
      return;
    }

    const isReport = !!msg.reportedBody;
    // For dead body report, use the DEAD VICTIM'S color! ("karakterin rengi çıksın ölen kişinin yani")
    let rawCol = 'red';
    if (isReport) {
      rawCol = (msg.reportedColor || msg.victimColor || (currentNearbyBody && currentNearbyBody.color) || 'red');
    } else {
      rawCol = (msg.callerColor || (localPlayer && localPlayer.color) || 'red');
    }
    let col = String(rawCol).toLowerCase();
    const validColors = ['blue', 'green', 'orange', 'red', 'yellow'];
    if (!validColors.includes(col)) {
      if (['pink', 'purple'].includes(col)) col = 'red';
      else if (['black', 'white', 'brown'].includes(col)) col = 'blue';
      else col = 'red';
    }

    if (isReport) {
      splashImg.src = 'assets/Images/Alerts/report_dead_body_' + col + '.png';
      playSound(sounds.report);
    } else {
      splashImg.src = 'assets/Images/Alerts/emergency_meeting_' + col + '.png';
      playSound(sounds.emergency);
    }

    splashModal.classList.remove('hidden');
    splashModal.style.display = 'flex';

    setTimeout(() => {
      splashModal.classList.add('hidden');
      splashModal.style.display = 'none';
      if (onComplete) onComplete();
    }, 2200);
  }

  // Draw Falling Dying Astronaut (Photo 4)
  function drawDyingAstronaut(dCtx, px, py, color, frameIdx = 3) {
    const img = deadAnimSprites[frameIdx] || deadAnimSprites[3];
    if (!img || !img.complete || img.naturalWidth === 0) return;
    dCtx.save();
    dCtx.translate(px, py);
    dCtx.drawImage(img, -38, -48, 76, 82);
    dCtx.restore();
  }

  if (btnKill) btnKill.addEventListener('click', performKill);

  function reportDeadBody() {
    if (!localPlayer.isAlive || !currentNearbyBody) return;
    playSound(sounds.report);
    const vColor = currentNearbyBody ? currentNearbyBody.color : null;
    const vName = currentNearbyBody ? currentNearbyBody.victimName : null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'REPORT_BODY',
        bodyId: currentNearbyBody ? currentNearbyBody.id : null,
        victimColor: vColor,
        victimName: vName
      }));
    } else if (currentRoomCode.startsWith('FREEPLAY')) {
      gameState = 'MEETING';
      const freeplayMeeting = {
        caller: localPlayer.name,
        callerColor: localPlayer.color,
        reportedBody: vName,
        reportedColor: vColor,
        victimColor: vColor,
        victimName: vName,
        phase: 'DISCUSSION',
        timer: 15,
        players: [
          { id: localPlayer.id, name: localPlayer.name, color: localPlayer.color, isAlive: true },
          ...Array.from(players.values()).map(p => ({ id: p.id, name: p.name, color: p.color, isAlive: p.isAlive }))
        ]
      };
      showReportSplash(freeplayMeeting, () => {
        openMeetingTablet(freeplayMeeting);
      });
    }
  }
  if (btnReport) btnReport.addEventListener('click', reportDeadBody);

  function callEmergencyMeeting() {
    if (!localPlayer.isAlive) return;
    playSound(sounds.emergency);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'CALL_EMERGENCY' }));
    } else if (currentRoomCode.startsWith('FREEPLAY')) {
      gameState = 'MEETING';
      const freeplayMeeting = {
        caller: localPlayer.name,
        callerColor: localPlayer.color,
        reportedBody: null,
        phase: 'DISCUSSION',
        timer: 15,
        players: [
          { id: localPlayer.id, name: localPlayer.name, color: localPlayer.color, isAlive: true },
          ...Array.from(players.values()).map(p => ({ id: p.id, name: p.name, color: p.color, isAlive: p.isAlive }))
        ]
      };
      showReportSplash(freeplayMeeting, () => {
        openMeetingTablet(freeplayMeeting);
      });
    }
  }

  // Safe vent exit finder so players NEVER get stuck in walls
  function findSafeVentExit(startX, startY) {
    if (!collidesWithMap(startX, startY)) return { x: startX, y: startY };
    for (let r = 5; r <= 80; r += 5) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
        const testX = startX + Math.cos(angle) * r;
        const testY = startY + Math.sin(angle) * r;
        if (!collidesWithMap(testX, testY)) {
          return { x: testX, y: testY };
        }
      }
    }
    return { x: startX, y: startY };
  }

  function toggleVent() {
    if (!localPlayer.isImpostor || !localPlayer.isAlive) return;
    if (localPlayer.inVent) {
      localPlayer.inVent = false;
      localPlayer.currentVent = null;
      playSound(sounds.vent);
      const safe = findSafeVentExit(localPlayer.x, localPlayer.y);
      localPlayer.x = safe.x;
      localPlayer.y = safe.y;
      safeSendWs({
        type: 'MOVE',
        x: localPlayer.x,
        y: localPlayer.y,
        dir: localPlayer.dir,
        walking: false,
        inVent: false
      });
      return;
    }
    if (!currentNearbyVent) return;
    localPlayer.inVent = true;
    localPlayer.currentVent = currentNearbyVent;
    localPlayer.x = currentNearbyVent.cx || (currentNearbyVent.x + (currentNearbyVent.w ? currentNearbyVent.w / 2 : 32));
    localPlayer.y = currentNearbyVent.cy || (currentNearbyVent.y + (currentNearbyVent.h ? currentNearbyVent.h / 2 : 24));
    playSound(sounds.vent);
    safeSendWs({
      type: 'MOVE',
      x: localPlayer.x,
      y: localPlayer.y,
      dir: localPlayer.dir,
      walking: false,
      inVent: true
    });
  }

  function hopToAdjacentVent(direction) {
    if (!localPlayer.inVent || !activeVentArrows || activeVentArrows.length === 0) return;
    let target = null;
    if (direction < 0) {
      target = activeVentArrows[0].targetVent;
    } else {
      target = activeVentArrows[activeVentArrows.length - 1].targetVent;
    }
    if (target) {
      localPlayer.x = target.x;
      localPlayer.y = target.y;
      localPlayer.currentVent = target;
      playSound(sounds.vent);
      safeSendWs({
        type: 'MOVE',
        x: localPlayer.x,
        y: localPlayer.y,
        dir: localPlayer.dir,
        walking: false,
        inVent: true
      });
    }
  }

  if (btnVent) btnVent.addEventListener('click', toggleVent);

  // Canvas click listener for interactive Vent hopping
  canvas.addEventListener('click', (e) => {
    if (localPlayer.inVent && activeVentArrows.length > 0) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      for (const arr of activeVentArrows) {
        if (Math.hypot(mx - arr.x, my - arr.y) < arr.r + 25) {
          localPlayer.x = arr.targetVent.x;
          localPlayer.y = arr.targetVent.y;
          localPlayer.currentVent = arr.targetVent;
          playSound(sounds.vent);
          safeSendWs({
            type: 'MOVE',
            x: localPlayer.x,
            y: localPlayer.y,
            dir: localPlayer.dir,
            walking: false,
            inVent: true
          });
          return;
        }
      }
    }
  });

  if (btnUse) {
    btnUse.addEventListener('click', () => {
      if (currentNearbySabotageFix && localPlayer.isAlive) {
        openFixSabotageModal(currentNearbySabotageFix.type);
      } else if (isNearEmergencyTable && localPlayer.isAlive) {
        callEmergencyMeeting();
      } else if (isNearSecurityCams) {
        openSecurityCams();
      } else if (currentNearbyTask) {
        openTaskModal(currentNearbyTask);
      } else if (currentNearbyVent && localPlayer.isImpostor) {
        toggleVent();
      }
    });
  }

  function updateRoleHUD() {
    if (roleDisplay) {
      if (localPlayer.isImpostor) {
        roleDisplay.innerText = localPlayer.isAlive ? 'IMPOSTOR' : 'IMPOSTOR (GHOST)';
        roleDisplay.className = 'role-badge role-impostor';
        if (btnKill) btnKill.classList.remove('hidden');
        if (btnVent) btnVent.classList.remove('hidden');
        if (btnSabotage) btnSabotage.classList.remove('hidden');
      } else {
        roleDisplay.innerText = localPlayer.isAlive ? 'CREWMATE' : 'CREWMATE (GHOST)';
        roleDisplay.className = 'role-badge role-crewmate';
        if (btnKill) btnKill.classList.add('hidden');
        if (btnVent) btnVent.classList.add('hidden');
        if (btnSabotage) btnSabotage.classList.add('hidden');
      }
    }
  }

  function updateTaskProgress(prog, tot) {
    if (tot === 0) return;
    const pct = Math.min(100, Math.round((prog / tot) * 100));
    if (taskBarFill) taskBarFill.style.width = pct + '%';
    const meetingFill = document.getElementById('meeting-task-fill');
    if (meetingFill) meetingFill.style.width = pct + '%';
  }

  function showRoleReveal() {
    if (!roleRevealModal) return;
    roleRevealModal.classList.remove('hidden');
    const shhhScreen = document.getElementById('shhh-screen');
    const revealContent = document.getElementById('reveal-content');
    const roleTitle = document.getElementById('reveal-role-title');
    const roleDesc = document.getElementById('reveal-role-desc');

    if (shhhScreen) shhhScreen.classList.remove('hidden');
    if (revealContent) revealContent.classList.add('hidden');

    setTimeout(() => {
      if (shhhScreen) shhhScreen.classList.add('hidden');
      if (revealContent) revealContent.classList.remove('hidden');

      const revealCanvas = document.getElementById('reveal-canvas');
      if (revealCanvas) {
        const rCtx = revealCanvas.getContext('2d');
        rCtx.clearRect(0, 0, revealCanvas.width, revealCanvas.height);

        if (localPlayer.isImpostor) {
          // Photo 2: IMPOSTOR Screen
          roleTitle.innerText = 'IMPOSTOR';
          roleTitle.className = 'reveal-impostor';
          roleDesc.innerText = 'Sabotage and kill everyone.';
          roleDesc.style.color = '#ef4444';

          // Dark red radial fog background
          const grad = rCtx.createRadialGradient(480, 180, 30, 480, 180, 480);
          grad.addColorStop(0, 'rgba(185, 28, 28, 0.45)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          rCtx.fillStyle = grad;
          rCtx.fillRect(0, 0, 960, 360);

          // All impostors in the match standing side-by-side
          const allImps = [localPlayer, ...Array.from(players.values()).filter(p => p.isImpostor && p.id !== localPlayer.id)];
          const count = allImps.length;
          const spacing = count === 1 ? 0 : 140;
          const startX = 480 - ((count - 1) * spacing) / 2;

          allImps.forEach((imp, idx) => {
            const ix = startX + idx * spacing;
            const iy = 240;
            drawRoleRevealCharacter(rCtx, ix, iy, imp.color, imp.hat, imp.skin, imp.name, true, 1.4);
          });
        } else {
          // Photo 3: CREWMATE Screen
          roleTitle.innerText = 'CREWMATE';
          roleTitle.className = 'reveal-crew';
          const impCount = Array.from(players.values()).filter(p => p.isImpostor).length + (localPlayer.isImpostor ? 1 : 0);
          const countToDisplay = Math.max(1, impCount);
          roleDesc.innerHTML = `There are <span style="color:#ef4444; font-weight:bold;">${countToDisplay} Impostor${countToDisplay > 1 ? 's' : ''}</span> among us`;
          roleDesc.style.color = '#f1f5f9';

          // Deep cyan/space radial fog
          const grad = rCtx.createRadialGradient(480, 180, 30, 480, 180, 480);
          grad.addColorStop(0, 'rgba(8, 145, 178, 0.3)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          rCtx.fillStyle = grad;
          rCtx.fillRect(0, 0, 960, 360);

          // All crewmates lined up in V-formation (Photo 3)
          const allCrew = [localPlayer, ...Array.from(players.values()).filter(p => !p.isImpostor && p.id !== localPlayer.id)];
          const positioned = [];
          allCrew.forEach((cm, idx) => {
            if (idx === 0) {
              positioned.push({ cm: cm, x: 480, y: 255, scale: 1.4, isLocal: true });
            } else {
              const side = (idx % 2 === 1) ? -1 : 1;
              const rank = Math.ceil(idx / 2);
              const px = 480 + side * (rank * 76);
              const py = 255 - Math.min(rank * 14, 42);
              const pscale = Math.max(1.1, 1.4 - rank * 0.05);
              positioned.push({ cm: cm, x: px, y: py, scale: pscale, isLocal: false });
            }
          });

          // Sort by Y ascending so back characters are rendered first
          positioned.sort((a, b) => a.y - b.y);
          positioned.forEach(item => {
            drawRoleRevealCharacter(rCtx, item.x, item.y, item.cm.color, item.cm.hat, item.cm.skin, item.isLocal ? 'Player (You!)' : item.cm.name, false, item.scale);
          });
        }
      }

      setTimeout(() => {
        roleRevealModal.classList.add('hidden');
      }, 4000);
    }, 1800);
  }

  // Authentic Character Rendering for Role Reveal Screen
  function drawRoleRevealCharacter(tctx, px, py, color, hat, skin, name, isImp, scale = 1.3) {
    tctx.save();
    tctx.translate(px, py);
    tctx.scale(scale, scale);

    // Ground shadow
    tctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    tctx.beginPath();
    tctx.ellipse(0, 2, 24, 7, 0, 0, Math.PI * 2);
    tctx.fill();

    // Down walk step 1 (facing forward idle)
    const spriteSet = (color && sprites[color]) || sprites['Red'];
    let drawn = false;
    if (spriteSet && spriteSet.down && spriteSet.down.length > 0) {
      const img = spriteSet.down[0];
      if (img && (img instanceof HTMLCanvasElement || (img.complete && img.naturalWidth > 0))) {
        tctx.drawImage(img, -38, -68, 76, 97);
        drawn = true;
      }
    }
    if (!drawn) {
      drawFallbackAstronaut(tctx, 0, 0, color, 'down', true);
    }

    if (skin && skin !== 'default') {
      drawSkin(tctx, skin, 0, 0);
    }
    if (hat && hat !== 'none') {
      drawHat(tctx, hat, 0, 0);
    }

    tctx.restore();

    // Name under character
    tctx.save();
    tctx.font = 'bold 15px monospace, Segoe UI, sans-serif';
    tctx.textAlign = 'center';
    tctx.fillStyle = isImp ? '#ef4444' : '#ffffff';
    tctx.shadowColor = '#000000';
    tctx.shadowBlur = 6;
    tctx.fillText(name || '', px, py + 24);
    tctx.restore();
  }

  // Draw Animated Astronaut in Security Camera Feeds
  function drawAstronautInCams(cCtx, px, py, p) {
    const dir = p.dir || 'down';
    const spriteSet = (p.color && sprites[p.color]) || sprites['Red'];
    let drawn = false;
    if (spriteSet && spriteSet[dir] && spriteSet[dir].length > 0) {
      const frameIdx = p.walking ? (Math.max(0, (p.frame || 1) - 1) % spriteSet[dir].length) : 0;
      const img = spriteSet[dir][frameIdx] || spriteSet[dir][0];
      if (img && (img instanceof HTMLCanvasElement || (img.complete && img.naturalWidth > 0))) {
        const isDown = (dir === 'down');
        const dw = isDown ? 76 : 66;
        const dh = isDown ? 97 : 84;
        const ox = isDown ? 38 : 33;
        const oy = isDown ? 68 : 60;
        cCtx.drawImage(img, px - ox, py - oy, dw, dh);
        drawn = true;
      }
    }
    if (!drawn) {
      drawFallbackAstronaut(cCtx, px, py, p.color, dir, p.isAlive !== false);
    }
    if (p.skin && p.skin !== 'default') {
      drawSkin(cCtx, p.skin, px, py);
    }
    if (p.hat && p.hat !== 'none') {
      drawHat(cCtx, p.hat, px, py);
    }
  }

  function showGameOver(msg) {
    if (!gameoverModal) return;
    gameoverModal.classList.remove('hidden');
    const title = document.getElementById('gameover-title');
    const desc = document.getElementById('gameover-desc');

    if (msg.winner === 'IMPOSTOR') {
      title.innerText = 'DEFEAT';
      title.className = 'gameover-imp';
      desc.innerText = 'Impostors have overrun The Skeld!';
      playSound(sounds.victoryImp);
    } else {
      title.innerText = 'VICTORY';
      title.className = 'gameover-crew';
      desc.innerText = msg.reason || 'Crewmates win!';
      playSound(sounds.victoryCrew);
    }

    const btnAgain = document.getElementById('btn-play-again');
    if (btnAgain) {
      btnAgain.innerText = 'ODAYA DEVAM ET';
      btnAgain.onclick = () => {
        if (isRoomHost || isFreeplayMode) {
          if (isFreeplayMode) {
            handleServerMessage({ type: 'RETURN_TO_LOBBY' });
          } else if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'RESTART_ROOM' }));
          } else {
            handleServerMessage({ type: 'RETURN_TO_LOBBY' });
          }
        } else {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            alert('Oda açık değil veya sunucu bağlantısı kapandı.');
          } else {
            alert('Oda sahibinin odayı kurması / devam ettirmesi bekleniyor...');
          }
        }
      };
    }

    const btnLeave = document.getElementById('btn-leave-room');
    if (btnLeave) {
      btnLeave.onclick = () => {
        window.location.reload();
      };
    }
  }

  // ================= 14. MINIMAP & REALTIME TASK LOCATION DISPLAY =================
  let minimapAnimId = null;

  function toggleMinimap() {
    if (!mapModal) return;
    if (mapModal.classList.contains('hidden')) {
      openMinimap();
    } else {
      window.closeMinimap();
    }
  }

  function openMinimap() {
    if (!mapModal) return;
    mapModal.classList.remove('hidden');
    const mCanvas = document.getElementById('minimap-canvas');
    if (!mCanvas) return;
    const mctx = mCanvas.getContext('2d');

    function renderMinimapLoop() {
      if (!mapModal || mapModal.classList.contains('hidden')) {
        minimapAnimId = null;
        return;
      }

      mctx.clearRect(0, 0, mCanvas.width, mCanvas.height);

      // 1. Draw base Skeld map
      if (mapImage.complete && mapImage.naturalWidth > 0) {
        mctx.drawImage(mapImage, 0, 0, mCanvas.width, mCanvas.height);
      } else {
        mctx.fillStyle = '#0f172a';
        mctx.fillRect(0, 0, mCanvas.width, mCanvas.height);
      }

      const mapW = (mapData && mapData.width) ? mapData.width : 5792;
      const mapH = (mapData && mapData.height) ? mapData.height : 3168;
      const scaleX = mCanvas.width / mapW;
      const scaleY = mCanvas.height / mapH;

      // 2. Render all uncompleted tasks with animated pulsating yellow '!' badges (Authentic Among Us Map)
      if (mapData && mapData.tasks && (!localPlayer.isImpostor || currentRoomCode.startsWith('FREEPLAY'))) {
        const pulse = 1 + Math.sin(Date.now() / 180) * 0.18;
        mapData.tasks.forEach(t => {
          if (t.isCamera || t.type === 'cameras') return;
          if (!localPlayer.completedTaskIds || !localPlayer.completedTaskIds.has(t.id)) {
            const tx = (t.x + (t.w || 40) / 2) * scaleX;
            const ty = (t.y + (t.h || 40) / 2) * scaleY;

            mctx.save();
            mctx.translate(tx, ty);
            mctx.scale(pulse, pulse);

            // Pulsing yellow beacon badge
            mctx.fillStyle = '#facc15';
            mctx.shadowColor = '#eab308';
            mctx.shadowBlur = 12;
            mctx.beginPath();
            mctx.arc(0, 0, 8, 0, Math.PI * 2);
            mctx.fill();

            // Contrast outline
            mctx.strokeStyle = '#0f172a';
            mctx.lineWidth = 1.8;
            mctx.stroke();

            // '!' text marker
            mctx.fillStyle = '#0f172a';
            mctx.font = '900 11px monospace';
            mctx.textAlign = 'center';
            mctx.textBaseline = 'middle';
            mctx.fillText('!', 0, 0.5);

            mctx.restore();
          }
        });
      }

      // 3. Draw Player Position (Cyan Dot with White Ring)
      const px = localPlayer.x * scaleX;
      const py = localPlayer.y * scaleY;
      mctx.save();
      mctx.fillStyle = '#38bdf8';
      mctx.strokeStyle = '#ffffff';
      mctx.lineWidth = 2.5;
      mctx.shadowColor = '#38bdf8';
      mctx.shadowBlur = 10;
      mctx.beginPath();
      mctx.arc(px, py, 7.5, 0, Math.PI * 2);
      mctx.fill();
      mctx.stroke();
      mctx.restore();

      minimapAnimId = requestAnimationFrame(renderMinimapLoop);
    }

    if (minimapAnimId) cancelAnimationFrame(minimapAnimId);
    renderMinimapLoop();
  }

  window.closeMinimap = function() {
    if (mapModal) mapModal.classList.add('hidden');
    if (minimapAnimId) {
      cancelAnimationFrame(minimapAnimId);
      minimapAnimId = null;
    }
  };

  const btnMinimap = document.getElementById('btn-minimap');
  if (btnMinimap) btnMinimap.onclick = toggleMinimap;

  const btnTabletMinimap = document.getElementById('btn-tablet-minimap');
  if (btnTabletMinimap) btnTabletMinimap.onclick = toggleMinimap;

  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  if (btnSoundToggle) {
    btnSoundToggle.onclick = () => {
      soundEnabled = !soundEnabled;
      btnSoundToggle.innerText = soundEnabled ? '🔊' : '🔇';
      btnSoundToggle.style.opacity = soundEnabled ? '1' : '0.4';
    };
  }

  // ================= 15. SABOTAGE SYSTEM =================
  window.closeSabotage = function() {
    if (sabotageModal) sabotageModal.classList.add('hidden');
  };

  function toggleSabotage() {
    if (!localPlayer.isImpostor || !localPlayer.isAlive) return;
    if (!sabotageModal) return;
    if (sabotageModal.classList.contains('hidden')) {
      sabotageModal.classList.remove('hidden');
      updateSabotageUI();
    } else {
      sabotageModal.classList.add('hidden');
    }
  }
  if (btnSabotage) btnSabotage.addEventListener('click', toggleSabotage);

  function updateSabotageUI() {
    if (!sabotageCooldownTag) return;
    const isMajorActive = !!activeSabotage;
    if (isMajorActive) {
      sabotageCooldownTag.innerText = 'CRISIS ACTIVE';
      sabotageCooldownTag.style.background = '#dc2626';
    } else if (sabotageCooldown > 0) {
      sabotageCooldownTag.innerText = Math.ceil(sabotageCooldown) + 's';
      sabotageCooldownTag.style.background = '#64748b';
    } else {
      sabotageCooldownTag.innerText = 'READY';
      sabotageCooldownTag.style.background = '#22c55e';
    }

    // Major sabotage buttons (Reactor, Lights, O2, Comms)
    document.querySelectorAll('.sab-action-icon').forEach(btn => {
      if (isMajorActive || sabotageCooldown > 0) {
        btn.classList.add('disabled');
        btn.style.pointerEvents = 'none';
      } else {
        btn.classList.remove('disabled');
        btn.style.pointerEvents = 'auto';
      }
    });

    // Room door buttons
    const curTime = Date.now();
    document.querySelectorAll('.sab-door-btn').forEach(btn => {
      const room = btn.getAttribute('data-door');
      const doorInfo = activeLockedDoors[room];
      const isLocked = (doorInfo && doorInfo.until > curTime);
      const cd = doorCooldowns[room] || 0;

      if (isLocked) {
        btn.classList.add('locked');
        btn.classList.remove('disabled');
        btn.style.pointerEvents = 'none';
        const remaining = Math.max(0, Math.ceil((doorInfo.until - curTime) / 1000));
        btn.innerText = remaining + 's';
      } else if (cd > 0) {
        btn.classList.remove('locked');
        btn.classList.add('disabled');
        btn.style.pointerEvents = 'none';
        btn.innerText = Math.ceil(cd) + 's';
      } else {
        btn.classList.remove('locked');
        btn.classList.remove('disabled');
        btn.style.pointerEvents = 'auto';
        btn.innerText = '✕';
      }
    });
  }

  function lockDoors(room, durationSec = 10) {
    const config = LOCKED_DOOR_CONFIG[room];
    if (!config) return;
    activeLockedDoors[room] = {
      until: Date.now() + durationSec * 1000,
      duration: durationSec * 1000,
      rects: config
    };
    playSound(sounds.doorLock);
    updateSabotageUI();
  }

  document.querySelectorAll('.sab-action-icon').forEach(btn => {
    btn.addEventListener('click', () => {
      if (sabotageCooldown > 0 || activeSabotage !== null) return;
      const sabType = btn.getAttribute('data-sab');
      if (!sabType) return;

      sabotageCooldown = 30; // Authentic Among Us 30s shared cooldown
      safeSendWs({ type: 'SABOTAGE', sabotage: sabType, duration: 30 });
      handleSabotageTriggered({ sabotage: sabType, duration: 30 });
      window.closeSabotage();
    });
  });

  document.querySelectorAll('.sab-door-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const room = btn.getAttribute('data-door');
      if (!room) return;
      if (doorCooldowns[room] > 0) return;
      if (activeSabotage && (activeSabotage.type === 'reactor' || activeSabotage.type === 'o2')) {
        alert('Kritik sabotaj devam ederken kapılar kilitlenemez!\n(Cannot close doors during critical meltdown)');
        return;
      }
      lockDoors(room, 10);
      doorCooldowns[room] = 25; // 10s locked + 15s cooldown
      safeSendWs({ type: 'SABOTAGE', sabotage: 'doors', roomName: room, duration: 10 });
      updateSabotageUI();
    });
  });

  let crisisAudioLoop = null;

  function handleSabotageTriggered(msg) {
    if (msg.sabotage === 'doors' && msg.roomName) {
      lockDoors(msg.roomName, 10);
      doorCooldowns[msg.roomName] = 25;
      return;
    }
    activeSabotage = {
      type: msg.sabotage,
      roomName: msg.roomName,
      endsAt: Date.now() + (msg.duration || 30) * 1000
    };
    if (crisisBanner) crisisBanner.classList.remove('hidden');

    // Continuous looping alarm audio ONLY for critical sabotages (reactor, o2) - NOT for lights!
    if ((msg.sabotage === 'reactor' || msg.sabotage === 'o2') && !crisisAudioLoop) {
      try {
        crisisAudioLoop = new Audio('assets/Sounds/General/crises.wav');
        crisisAudioLoop.loop = true;
        crisisAudioLoop.volume = 0.7;
        crisisAudioLoop.play().catch(() => {});
      } catch(e) {}
    }

    if (crisisInterval) clearInterval(crisisInterval);
    crisisInterval = setInterval(updateCrisisBanner, 400);
    updateCrisisBanner();
  }

  function handleSabotageFixed(msg) {
    activeSabotage = null;
    sabotageCooldown = 30; // Authentic 30s cooldown after fixing!
    if (crisisBanner) crisisBanner.classList.add('hidden');
    if (crisisInterval) clearInterval(crisisInterval);
    if (crisisAudioLoop) {
      try {
        crisisAudioLoop.pause();
        crisisAudioLoop.currentTime = 0;
      } catch(e) {}
      crisisAudioLoop = null;
    }
    window.closeFixSabotageModal();
  }

  function updateCrisisBanner() {
    if (!activeSabotage) return;
    const remaining = Math.max(0, Math.ceil((activeSabotage.endsAt - Date.now()) / 1000));
    if (activeSabotage.type === 'reactor') {
      if (crisisBannerText) crisisBannerText.innerText = `⚠️ REACTOR MELTDOWN IN ${remaining}s! FIX AT REACTOR!`;
      if (remaining <= 0) {
        showGameOver({ winner: 'IMPOSTOR', reason: 'Reactor Meltdown!' });
        handleSabotageFixed();
      }
    } else if (activeSabotage.type === 'o2') {
      if (crisisBannerText) crisisBannerText.innerText = `⚠️ OXYGEN DEPLETION IN ${remaining}s! FIX AT O2 OR ADMIN!`;
      if (remaining <= 0) {
        showGameOver({ winner: 'IMPOSTOR', reason: 'Oxygen Depleted!' });
        handleSabotageFixed();
      }
    } else if (activeSabotage.type === 'lights') {
      if (crisisBannerText) crisisBannerText.innerText = `⚠️ ELECTRICAL LIGHTS SABOTAGED! FIX SWITCHES IN ELECTRICAL!`;
    } else if (activeSabotage.type === 'comms') {
      if (crisisBannerText) crisisBannerText.innerText = `⚠️ COMMUNICATIONS JAMMED! FIX AT COMMS!`;
    }
  }

  // ================= 13. SABOTAGE FIX INTERACTIVE MINIGAMES =================
  let fixLightsState = [false, false, false, false, false];
  let reactorHoldTimer = null;
  let o2TargetCode = '72941';
  let o2CurrentInput = '';

  window.closeFixSabotageModal = function() {
    const fLights = document.getElementById('fix-lights-modal');
    const fReactor = document.getElementById('fix-reactor-modal');
    const fO2 = document.getElementById('fix-o2-modal');
    const fComms = document.getElementById('fix-comms-modal');
    if (fLights) fLights.classList.add('hidden');
    if (fReactor) fReactor.classList.add('hidden');
    if (fO2) fO2.classList.add('hidden');
    if (fComms) fComms.classList.add('hidden');
    if (commsAnimId) {
      cancelAnimationFrame(commsAnimId);
      commsAnimId = null;
    }
    if (reactorHoldTimer) {
      clearInterval(reactorHoldTimer);
      reactorHoldTimer = null;
    }
  };

  let commsTargetFreq = 500;
  let commsAnimId = null;
  let commsHoldTime = 0;

  function openFixCommsModal() {
    const modal = document.getElementById('fix-comms-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    commsTargetFreq = 220 + Math.floor(Math.random() * 560);
    const slider = document.getElementById('comms-freq-slider');
    if (slider) slider.value = (commsTargetFreq > 500 ? 120 : 880);
    commsHoldTime = 0;
    startCommsOscilloscope();
  }

  function startCommsOscilloscope() {
    const canvas = document.getElementById('comms-radio-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const slider = document.getElementById('comms-freq-slider');
    const badge = document.getElementById('comms-match-badge');
    const readout = document.getElementById('comms-freq-readout');

    if (commsAnimId) cancelAnimationFrame(commsAnimId);
    let phase = 0;

    function renderCommsLoop() {
      const modal = document.getElementById('fix-comms-modal');
      if (!modal || modal.classList.contains('hidden')) {
        commsAnimId = null;
        return;
      }

      phase += 0.12;
      const curVal = slider ? parseInt(slider.value) : 0;
      const diff = Math.abs(curVal - commsTargetFreq);
      const isMatched = (diff < 40);

      if (readout) {
        const mhz = (88.0 + (curVal / 1000) * 20.0).toFixed(1);
        readout.innerText = 'TUNING: ' + mhz + ' MHz';
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Oscilloscope Grid
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 22) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Target clean radio wave (Green)
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const y = 65 + Math.sin(x * 0.045 + phase) * 26;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current player radio signal (Red with noise until aligned)
      ctx.strokeStyle = isMatched ? '#4ade80' : '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const waveFreq = 0.015 + (curVal / 1000) * 0.06;
      for (let x = 0; x < canvas.width; x++) {
        const jitter = isMatched ? (Math.random() * 2 - 1) : (Math.random() * 14 - 7);
        const y = 65 + Math.sin(x * waveFreq + phase * 1.1) * 26 + jitter;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (isMatched) {
        commsHoldTime += 16;
        if (badge) {
          badge.style.background = '#22c55e';
          badge.innerText = 'SIGNAL LOCKED! ' + Math.min(100, Math.floor((commsHoldTime / 1200) * 100)) + '%';
        }
        if (commsHoldTime >= 1200) {
          playSound(sounds.taskComplete);
          safeSendWs({ type: 'FIX_SABOTAGE', sabotage: 'comms' });
          handleSabotageFixed({ sabotage: 'comms' });
          window.closeFixSabotageModal();
          return;
        }
      } else {
        commsHoldTime = 0;
        if (badge) {
          badge.style.background = '#dc2626';
          badge.innerText = 'NO SIGNAL';
        }
      }

      commsAnimId = requestAnimationFrame(renderCommsLoop);
    }

    commsAnimId = requestAnimationFrame(renderCommsLoop);
  }

  function openFixSabotageModal(type) {
    if (type === 'lights') {
      const modal = document.getElementById('fix-lights-modal');
      if (!modal) return;
      modal.classList.remove('hidden');
      fixLightsState = [
        Math.random() > 0.5,
        Math.random() > 0.5,
        Math.random() > 0.5,
        Math.random() > 0.5,
        Math.random() > 0.5
      ];
      if (fixLightsState.every(s => s)) fixLightsState[0] = false;
      renderFixLightsSwitches();
    } else if (type === 'reactor') {
      const modal = document.getElementById('fix-reactor-modal');
      if (!modal) return;
      modal.classList.remove('hidden');
      const fill = document.getElementById('reactor-hold-fill');
      if (fill) fill.style.width = '0%';
      const txt = document.getElementById('reactor-hold-text');
      if (txt) txt.innerText = 'HOLD TO PREVENT MELTDOWN';
    } else if (type === 'o2') {
      const modal = document.getElementById('fix-o2-modal');
      if (!modal) return;
      modal.classList.remove('hidden');
      o2TargetCode = String(Math.floor(10000 + Math.random() * 90000));
      o2CurrentInput = '';
      const sticky = document.getElementById('o2-sticky-code');
      if (sticky) sticky.innerText = o2TargetCode;
      renderO2Keypad();
    } else if (type === 'comms') {
      openFixCommsModal();
    }
  }

  function renderFixLightsSwitches() {
    for (let i = 0; i < 5; i++) {
      const isUp = fixLightsState[i];
      const led = document.getElementById('sw-led-' + i);
      const h = document.getElementById('sw-h-' + i);
      if (led) {
        led.style.background = isUp ? '#22c55e' : '#ef4444';
        led.style.boxShadow = isUp ? '0 0 10px #22c55e' : '0 0 10px #ef4444';
      }
      if (h) {
        h.style.bottom = isUp ? '38px' : '2px';
      }
    }
  }

  document.querySelectorAll('.light-switch').forEach(sw => {
    sw.addEventListener('click', () => {
      const idx = parseInt(sw.getAttribute('data-idx'));
      if (isNaN(idx)) return;
      fixLightsState[idx] = !fixLightsState[idx];
      playSound(sounds.keypress);
      renderFixLightsSwitches();
      if (fixLightsState.every(s => s)) {
        setTimeout(() => {
          playSound(sounds.taskComplete);
          safeSendWs({ type: 'FIX_SABOTAGE', sabotage: 'lights' });
          handleSabotageFixed({ sabotage: 'lights' });
          window.closeFixSabotageModal();
        }, 220);
      }
    });
  });

  const reactorPad = document.getElementById('reactor-hold-pad');
  if (reactorPad) {
    let holdStart = 0;
    const onHoldStart = (e) => {
      e.preventDefault();
      holdStart = Date.now();
      const fill = document.getElementById('reactor-hold-fill');
      const txt = document.getElementById('reactor-hold-text');
      if (txt) txt.innerText = 'STABILIZING REACTOR...';
      if (reactorHoldTimer) clearInterval(reactorHoldTimer);
      reactorHoldTimer = setInterval(() => {
        const elapsed = Date.now() - holdStart;
        const pct = Math.min(100, Math.round((elapsed / 1800) * 100));
        if (fill) fill.style.width = pct + '%';
        if (pct >= 100) {
          clearInterval(reactorHoldTimer);
          reactorHoldTimer = null;
          if (txt) txt.innerText = 'REACTOR STABILIZED!';
          playSound(sounds.taskComplete);
          safeSendWs({ type: 'FIX_SABOTAGE', sabotage: 'reactor' });
          handleSabotageFixed({ sabotage: 'reactor' });
          setTimeout(() => {
            window.closeFixSabotageModal();
          }, 350);
        }
      }, 50);
    };

    const onHoldEnd = () => {
      if (reactorHoldTimer) {
        clearInterval(reactorHoldTimer);
        reactorHoldTimer = null;
        const fill = document.getElementById('reactor-hold-fill');
        if (fill) fill.style.width = '0%';
        const txt = document.getElementById('reactor-hold-text');
        if (txt) txt.innerText = 'HOLD TO PREVENT MELTDOWN';
      }
    };

    reactorPad.addEventListener('mousedown', onHoldStart);
    reactorPad.addEventListener('touchstart', onHoldStart);
    window.addEventListener('mouseup', onHoldEnd);
    window.addEventListener('touchend', onHoldEnd);
  }

  function renderO2Keypad() {
    const disp = document.getElementById('o2-code-display');
    if (disp) {
      disp.innerText = o2CurrentInput.padEnd(5, '_');
    }
    const grid = document.getElementById('o2-keypad-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'];
    keys.forEach(k => {
      const btn = document.createElement('button');
      btn.innerText = k;
      btn.style.cssText = 'height: 44px; font-size: 18px; font-weight: bold; background: #334155; color: #fff; border: 2px solid #475569; border-radius: 6px; cursor: pointer;';
      btn.onclick = () => {
        playSound(sounds.keypress);
        if (k === 'C') {
          o2CurrentInput = '';
        } else if (k === '✓') {
          if (o2CurrentInput === o2TargetCode) {
            playSound(sounds.taskComplete);
            safeSendWs({ type: 'FIX_SABOTAGE', sabotage: 'o2' });
            handleSabotageFixed({ sabotage: 'o2' });
            setTimeout(window.closeFixSabotageModal, 300);
          } else {
            o2CurrentInput = '';
          }
        } else {
          if (o2CurrentInput.length < 5) {
            o2CurrentInput += k;
            if (o2CurrentInput.length === 5 && o2CurrentInput === o2TargetCode) {
              playSound(sounds.taskComplete);
              safeSendWs({ type: 'FIX_SABOTAGE', sabotage: 'o2' });
              handleSabotageFixed({ sabotage: 'o2' });
              setTimeout(window.closeFixSabotageModal, 300);
            }
          }
        }
        if (disp) disp.innerText = o2CurrentInput.padEnd(5, '_');
      };
      grid.appendChild(btn);
    });
  }

  // ================= 15. EBA / MEB OKUL KAMUFLAJ SİSTEMİ (F9 PANİK MODU) =================
  let isSchoolDisguised = false;
  const EDU_TITLE = 'EBA Proje Geliştirme ve Fizik Modelleme Portalı';
  const DISGUISE_TITLE = 'EBA - Eğitim Bilişim Ağı | 11. Sınıf Fizik Ders Akışı & Notlar';
  const EDU_FAVICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎓</text></svg>';
  const EBA_FAVICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23e11d48"/><text x="50" y="62" font-size="34" font-weight="bold" fill="white" text-anchor="middle" font-family="sans-serif">EBA</text></svg>';

  window.toggleSchoolDisguise = function() {
    isSchoolDisguised = !isSchoolDisguised;
    const screen = document.getElementById('school-panic-screen');
    const fav = document.getElementById('site-favicon');

    if (isSchoolDisguised) {
      if (screen) screen.style.display = 'block';
      document.title = DISGUISE_TITLE;
      if (fav) fav.href = EBA_FAVICON;
      // Mute audio while in disguise
      if (sounds) {
        sounds.soundEnabled = false;
        const btn = document.getElementById('btn-sound-toggle');
        if (btn) btn.innerText = '🔇';
      }
    } else {
      if (screen) screen.style.display = 'none';
      document.title = EDU_TITLE;
      if (fav) fav.href = EDU_FAVICON;
      // Restore audio
      if (sounds) {
        sounds.soundEnabled = true;
        const btn = document.getElementById('btn-sound-toggle');
        if (btn) btn.innerText = '🔊';
      }
    }
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F9') {
      e.preventDefault();
      window.toggleSchoolDisguise();
    }
  });

// =========================================================================
  // AUTHENTICATION & ADMIN DASHBOARD CLIENT FUNCTIONS
  // =========================================================================

  let currentAuthTab = 'login';
  window.openAuthModal = function() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const errEl = document.getElementById('auth-error-msg');
    if (errEl) { errEl.classList.add('hidden'); errEl.style.display = 'none'; }

    const loggedInBox = document.getElementById('auth-logged-in-box');
    const authForm = document.getElementById('auth-form');
    if (currentUser && loggedInBox && authForm) {
      loggedInBox.classList.remove('hidden');
      loggedInBox.style.display = 'flex';
      authForm.classList.add('hidden');
      authForm.style.display = 'none';
      const uName = document.getElementById('auth-user-name');
      const uRole = document.getElementById('auth-user-role-badge');
      if (uName) uName.textContent = currentUser.username;
      if (uRole) {
        uRole.textContent = isAdmin ? '👑 YÖNETİCİ (ADMIN)' : '🧑‍🚀 OYUNCU';
      }
    } else if (loggedInBox && authForm) {
      loggedInBox.classList.add('hidden');
      loggedInBox.style.display = 'none';
      authForm.classList.remove('hidden');
      authForm.style.display = 'block';
    }
  };

  window.closeAuthModal = function() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  };

  window.switchAuthTab = function(tab) {
    currentAuthTab = tab;
    const tabLogin = document.getElementById('auth-tab-login');
    const tabReg = document.getElementById('auth-tab-register');
    const submitBtn = document.getElementById('btn-auth-submit');
    const errEl = document.getElementById('auth-error-msg');
    if (errEl) { errEl.classList.add('hidden'); errEl.style.display = 'none'; }

    if (tab === 'login') {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabReg) tabReg.classList.remove('active');
      if (submitBtn) submitBtn.textContent = 'GİRİŞ YAP';
    } else {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabReg) tabReg.classList.add('active');
      if (submitBtn) submitBtn.textContent = 'KAYIT OL VE GİRİŞ YAP';
    }
  };

  window.handleAuthSubmit = function(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    const uInput = document.getElementById('auth-username');
    const pInput = document.getElementById('auth-password');
    const username = uInput ? uInput.value.trim() : '';
    const password = pInput ? pInput.value.trim() : '';

    const errEl = document.getElementById('auth-error-msg');
    if (errEl) { errEl.classList.add('hidden'); errEl.style.display = 'none'; }

    if (!username || !password) {
      const msg = 'Lütfen kullanıcı adı ve şifre alanlarını doldurun!';
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
        errEl.style.display = 'block';
      }
      alert(msg);
      return false;
    }

    const submitBtn = document.getElementById('btn-auth-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Giriş Yapılıyor...';
      setTimeout(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = (currentAuthTab === 'register') ? 'KAYIT OL' : 'GİRİŞ YAP';
        }
      }, 3000);
    }

    // Save for auto login
    localStorage.setItem('amongus_auth_creds', JSON.stringify({ username, password }));

    const reqType = (currentAuthTab === 'register') ? 'REGISTER' : 'LOGIN';
    console.log('Sending auth request:', reqType, 'for user:', username);
    safeSendWs({ type: reqType, username, password });
    return false;
  };

  window.logoutUser = function() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'LOGOUT' }));
    }
    localStorage.removeItem('amongus_auth_creds');
    currentUser = null;
    isAdmin = false;
    window.closeAuthModal();
  };

  // ================= ADMIN PANEL METHODS =================
  window.openAdminPanel = function() {
    if (!isAdmin) {
      alert('Yalnızca yetkili yöneticiler (admin) bu paneli açabilir!\\n(Giriş yapmak için ana menüdeki Astronot Hesabı butonunu kullanın)');
      window.openAuthModal();
      return;
    }

    const modal = document.getElementById('admin-panel-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    window.refreshAdminStats();
    if (adminStatsInterval) clearInterval(adminStatsInterval);
    adminStatsInterval = setInterval(() => {
      window.refreshAdminStats();
    }, 2000);
  };

  window.closeAdminPanel = function() {
    const modal = document.getElementById('admin-panel-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
    if (adminStatsInterval) {
      clearInterval(adminStatsInterval);
      adminStatsInterval = null;
    }
  };

  window.refreshAdminStats = function() {
    if (ws && ws.readyState === WebSocket.OPEN && isAdmin) {
      ws.send(JSON.stringify({ type: 'ADMIN_GET_STATS' }));
    }
  };

  window.switchAdminTab = function(tabName) {
    const tabs = ['rooms', 'clients', 'bans', 'quickban'];
    tabs.forEach(t => {
      const btn = document.getElementById('admin-tab-btn-' + t);
      const view = document.getElementById('admin-tab-content-' + t);
      if (btn) {
        if (t === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
      }
      if (view) {
        if (t === tabName) {
          view.classList.remove('hidden');
          view.style.display = 'block';
        } else {
          view.classList.add('hidden');
          view.style.display = 'none';
        }
      }
    });
  };

  window.renderAdminRooms = function(rooms) {
    const container = document.getElementById('admin-rooms-list');
    if (!container) return;
    container.innerHTML = '';

    if (!rooms || rooms.length === 0) {
      container.innerHTML = '<div style="color:#94a3b8; text-align:center; grid-column: 1/-1; padding:40px; font-size:15px;">Şu anda aktif hiçbir oda bulunmuyor.</div>';
      return;
    }

    rooms.forEach(r => {
      const card = document.createElement('div');
      card.className = 'admin-room-card';

      let stateClass = 'state-lobby';
      let stateTr = 'LOBİ';
      if (r.state === 'PLAYING') { stateClass = 'state-playing'; stateTr = 'OYUNDA'; }
      else if (r.state === 'MEETING') { stateClass = 'state-meeting'; stateTr = 'TOPLANTI/OYLAMA'; }

      let playersHtml = '';
      if (r.players && r.players.length > 0) {
        r.players.forEach(p => {
          const roleClass = p.isImpostor ? 'tag-impostor' : 'tag-crewmate';
          const roleText = p.isImpostor ? 'IMPOSTOR' : 'CREWMATE';
          const regText = p.username ? `@${escapeHtml(p.username)}` : 'Misafir';
          const aliveStatus = p.isAlive ? '' : ' 💀';
          const dummyTag = p.isDummy ? ' (Bot)' : '';

          playersHtml += `
            <div class="admin-room-player-item">
              <div class="admin-player-left-info">
                <span class="admin-player-color-circle" style="background:${p.color.toLowerCase()};"></span>
                <b>${escapeHtml(p.name)}${dummyTag}${aliveStatus}</b>
                <span class="admin-player-tag-role ${roleClass}">${roleText}</span>
                <span style="color:#64748b; font-size:11px;">[${regText}]</span>
              </div>
              <div style="display:flex; gap:4px;">
                ${!p.isDummy ? `
                  <button class="btn-kick-warning" onclick="window.adminKickPlayer('${p.connId || p.id}')" title="Odadan At">👢 At</button>
                  <button class="btn-ban-danger" onclick="window.adminBanPlayer('${p.connId || p.id}', '${p.username || p.name}', '${p.ip}', '${p.deviceId || ''}', '${p.fingerprint || ''}')" title="Bu Bilgisayarı/Cihazı Banla (Okul Ağı Bozulmaz)">🚫 PC'yi Banla</button>
                ` : ''}
              </div>
            </div>
          `;
        });
      } else {
        playersHtml = '<div style="color:#64748b; font-size:12px; padding:6px 0;">Oda boş.</div>';
      }

      card.innerHTML = `
        <div class="admin-room-header">
          <span class="admin-room-code-tag">${escapeHtml(r.code)} ${r.isFreeplay ? '<span style="font-size:10px; color:#a855f7;">[SERBEST]</span>' : ''}</span>
          <span class="admin-room-state-badge ${stateClass}">${stateTr}</span>
        </div>
        <div class="admin-room-info-row">
          <span>Oda Kurucusu (Host):</span>
          <b style="color:#f8fafc;">${escapeHtml(r.hostName)}</b>
        </div>
        <div class="admin-room-info-row">
          <span>Oyuncu Sayısı:</span>
          <b>${r.playerCount} / ${r.maxPlayers}</b>
        </div>
        <div class="admin-room-players-box">
          <div style="font-size:11px; color:#94a3b8; font-weight:800; margin-bottom:6px; text-transform:uppercase;">Oyuncu Listesi & Rolleri</div>
          ${playersHtml}
        </div>
        <div class="admin-room-actions-bar">
          <button class="btn-room-close" onclick="window.adminCloseRoom('${r.code}')" style="width:100%;">💥 Odayı Kapat ve Dağıt</button>
        </div>
      `;
      container.appendChild(card);
    });
  };

  window.renderAdminClients = function(clients) {
    const tbody = document.getElementById('admin-clients-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!clients || clients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:30px;">Şu anda bağlı hiçbir istemci yok.</td></tr>';
      return;
    }

    clients.forEach(c => {
      const tr = document.createElement('tr');
      const isRegBadge = c.isRegistered
        ? `<span style="color:#38bdf8; font-weight:800;">@${escapeHtml(c.username)} ${c.isAdmin ? '👑' : ''}</span>`
        : `<span style="color:#94a3b8;">Misafir</span>`;

      tr.innerHTML = `
        <td><code style="color:#fde047; font-size:12px;">${escapeHtml(c.ip || 'Bilinmiyor')}</code></td>
        <td>${isRegBadge}</td>
        <td><b>${escapeHtml(c.playerName || 'Henüz İsimsiz')}</b></td>
        <td><span style="background:rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px; font-size:11px;">${escapeHtml(c.status || 'Ana Menü')}</span></td>
        <td><span style="color:#22c55e; font-weight:700;">🟢 Çevrimiçi</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn-kick-warning" onclick="window.adminKickPlayer('${c.connId}')">👢 At</button>
            <button class="btn-ban-danger" onclick="window.adminBanPlayer('${c.connId}', '${c.username || ''}', '${c.ip}', '${c.deviceId || ''}', '${c.fingerprint || ''}')" title="Bu Bilgisayarı/Cihazı Banla">🚫 PC'yi Banla</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  window.renderAdminBans = function(bans) {
    const tbody = document.getElementById('admin-bans-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!bans || bans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:30px;">Hiçbir ban kaydı bulunmuyor.</td></tr>';
      return;
    }

    bans.forEach(b => {
      const tr = document.createElement('tr');
      const targetStr = b.target || (b.deviceId && b.deviceId !== '-' ? b.deviceId : b.username);
      const typeBadge = b.type ? `<span style="background:rgba(225,29,72,0.2); color:#fca5a5; border:1px solid rgba(225,29,72,0.4); padding:2px 8px; border-radius:6px; font-size:11px; font-weight:800; margin-right:8px;">${escapeHtml(b.type)}</span>` : '';

      tr.innerHTML = `
        <td>
          ${typeBadge}
          <b style="color:#ef4444;">${escapeHtml(targetStr || '-')}</b>
          ${b.username && b.username !== '-' ? `<span style="color:#94a3b8; font-size:11px; margin-left:6px;">(@${escapeHtml(b.username)})</span>` : ''}
        </td>
        <td>${escapeHtml(b.reason || 'Yönetici kararı')}</td>
        <td><span style="color:#fbbf24;">${escapeHtml(b.bannedBy || 'ensar')}</span></td>
        <td style="color:#94a3b8; font-size:12px;">${escapeHtml(b.date || '-')}</td>
        <td>
          <button class="btn-unban-success" onclick="window.adminUnban('${escapeHtml(targetStr)}')">✅ Banı Kaldır</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  window.adminKickPlayer = function(targetId) {
    if (!isAdmin) return;
    if (!confirm('Bu kullanıcıyı oyundan/sunucudan atmak istediğinize emin misiniz?')) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ADMIN_KICK_PLAYER', targetId: targetId }));
    }
  };

  window.adminBanPlayer = function(targetConnId, username, ip, deviceId, fingerprint) {
    if (!isAdmin) return;
    const reason = prompt('Yasaklama (Ban) sebebini girin:\n(DİKKAT: Bu işlem okul internetini bozmaz, SADECE bu bilgisayarı kalıcı olarak yasaklar)', 'Kurallara uymama / Trol / Hile');
    if (reason === null) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ADMIN_BAN_PLAYER',
        connId: targetConnId || '',
        username: username || '',
        ip: ip || '',
        deviceId: deviceId || '',
        fingerprint: fingerprint || '',
        reason: reason
      }));
    }
  };

    window.adminResetAllBans = function() {
    if (!isAdmin) return;
    if (!confirm('DİKKAT: Sistemdeki TÜM banları ve oda yasaklarını sıfırlamak istediğinize emin misiniz?')) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ADMIN_RESET_ALL_BANS' }));
    }
  };

  window.adminUnban = function(target) {
    if (!isAdmin) return;
    if (!confirm(`"${target}" yasağını kaldırmak istediğinize emin misiniz?`)) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ADMIN_UNBAN', target: target }));
    }
  };

  window.adminCloseRoom = function(roomCode) {
    if (!isAdmin) return;
    if (!confirm(`"${roomCode}" kodlu odayı kapatmak ve tüm oyuncuları dağıtmak istediğinize emin misiniz?`)) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ADMIN_CLOSE_ROOM', roomCode: roomCode }));
    }
  };

  window.adminQuickBan = function() {
    if (!isAdmin) return;
    const ipInput = document.getElementById('quickban-ip');
    const userInput = document.getElementById('quickban-user');
    const reasonInput = document.getElementById('quickban-reason');

    const ip = ipInput ? ipInput.value.trim() : '';
    const username = userInput ? userInput.value.trim() : '';
    const reason = (reasonInput && reasonInput.value.trim()) || 'Yönetici tarafından yasaklandı';

    if (!ip && !username) {
      alert('Lütfen en az bir IP adresi veya Kullanıcı Adı girin!');
      return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ADMIN_BAN_PLAYER',
        ip: ip,
        username: username,
        reason: reason
      }));
      if (ipInput) ipInput.value = '';
      if (userInput) userInput.value = '';
      alert('Yasaklama başarıyla işlendi ve hedef siteden atıldı!');
      window.switchAdminTab('bans');
    }
  };

  // ================= ROOM HOST KICK / BAN CLIENT METHODS =================
  let roomPlayersAutoRefreshTimer = null;
  window.switchChatDrawerTab = function(tab) {
    const btnChat = document.getElementById('tab-btn-chat');
    const btnPlayers = document.getElementById('tab-btn-players');
    const contentChat = document.getElementById('chat-tab-content-chat');
    const contentPlayers = document.getElementById('chat-tab-content-players');

    if (tab === 'players') {
      if (btnChat) btnChat.classList.remove('active');
      if (btnPlayers) btnPlayers.classList.add('active');
      if (contentChat) { contentChat.classList.add('hidden'); contentChat.style.display = 'none'; }
      if (contentPlayers) { contentPlayers.classList.remove('hidden'); contentPlayers.style.display = 'block'; }
      
      // Immediate fetch
      safeSendWs({ type: 'GET_ROOM_PLAYERS' });

      // Continuous live polling every 1.5s while drawer players tab is open
      if (roomPlayersAutoRefreshTimer) clearInterval(roomPlayersAutoRefreshTimer);
      roomPlayersAutoRefreshTimer = setInterval(() => {
        const drawer = document.getElementById('meeting-chat-drawer');
        const pView = document.getElementById('chat-tab-content-players');
        if (drawer && !drawer.classList.contains('hidden') && pView && !pView.classList.contains('hidden')) {
          safeSendWs({ type: 'GET_ROOM_PLAYERS' });
        } else {
          clearInterval(roomPlayersAutoRefreshTimer);
          roomPlayersAutoRefreshTimer = null;
        }
      }, 1500);
    } else {
      if (btnChat) btnChat.classList.add('active');
      if (btnPlayers) btnPlayers.classList.remove('active');
      if (contentChat) { contentChat.classList.remove('hidden'); contentChat.style.display = 'block'; }
      if (contentPlayers) { contentPlayers.classList.add('hidden'); contentPlayers.style.display = 'none'; }
      if (roomPlayersAutoRefreshTimer) {
        clearInterval(roomPlayersAutoRefreshTimer);
        roomPlayersAutoRefreshTimer = null;
      }
    }
  };

  window.openRoomPlayersDrawer = function() {
    const drawer = document.getElementById('meeting-chat-drawer');
    if (drawer) {
      drawer.classList.remove('hidden');
      window.switchChatDrawerTab('players');
    }
  };

  window.renderRoomPlayersList = function(playersList, hostId) {
    const container = document.getElementById('chat-players-list');
    if (!container) return;
    container.innerHTML = '';

    const isLocalHost = (localPlayer && localPlayer.id === hostId);
    const canModerate = isLocalHost || isAdmin;

    const hostBadge = document.getElementById('chat-players-host-badge');
    if (hostBadge) {
      hostBadge.textContent = canModerate ? '👑 Siz Yetkilisiniz (Kick/Ban Açık)' : 'Oda Sahibi: Kick/Ban Yetkisi';
    }

    if (!playersList || playersList.length === 0) {
      container.innerHTML = '<div style="color:#94a3b8; padding:20px; text-align:center;">Odada kimse yok.</div>';
      return;
    }

    playersList.forEach(p => {
      const item = document.createElement('div');
      item.className = 'chat-player-item';

      const isSelf = (localPlayer && p.id === localPlayer.id);
      const isTargetHost = (p.id === hostId);
      const colorVal = (p.color || 'red').toLowerCase();

      let actionsHtml = '';
      if (canModerate && !isSelf && !p.isDummy) {
        actionsHtml = `
          <div class="chat-player-actions">
            <button class="btn-host-kick" onclick="window.hostKickPlayer('${p.id}', '${escapeHtml(p.name)}')">👢 At</button>
            <button class="btn-host-ban" onclick="window.hostBanPlayer('${p.id}', '${escapeHtml(p.name)}')">🚫 Banla</button>
          </div>
        `;
      }

      item.innerHTML = `
        <div class="chat-player-info">
          <span class="chat-player-color-dot" style="background:${colorVal};"></span>
          <span class="chat-player-name">${escapeHtml(p.name)} ${isSelf ? '<span style="color:#38bdf8; font-size:12px;">(Sen)</span>' : ''} ${isTargetHost ? '👑' : ''}</span>
        </div>
        ${actionsHtml}
      `;
      container.appendChild(item);
    });
  };

  window.hostKickPlayer = function(targetId, targetName) {
    if (!confirm(`"${targetName}" adlı oyuncuyu odadan atmak istediğinize emin misiniz?`)) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'HOST_KICK_PLAYER',
        targetPlayerId: targetId
      }));
    }
  };

  window.hostBanPlayer = function(targetId, targetName) {
    if (!confirm(`DİKKAT: "${targetName}" adlı oyuncunun bu odaya girişini YASAKLAMAK (Banlamak) istediğinize emin misiniz?\nBu odaya bir daha katılamayacaktır.`)) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'HOST_BAN_PLAYER',
        targetPlayerId: targetId
      }));
    }
  };

  window.returnToMainMenu = function() {
    // Hide in-game HUDs
    const huds = ['top-hud', 'top-right-hud', 'action-hud', 'dropship-hud', 'meeting-chat-drawer', 'emergency-meeting-modal', 'report-splash-modal', 'ejection-screen', 'game-over-modal'];
    huds.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
    });

    const menu = document.getElementById('main-menu-modal');
    if (menu) {
      menu.classList.remove('hidden');
      menu.style.display = 'flex';
    }

    gameState = 'MENU';
    currentRoomCode = null;
    players.clear();
    deadBodies = [];
  };

})();
