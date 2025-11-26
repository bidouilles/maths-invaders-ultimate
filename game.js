/**
 * MATHS INVADERS ULTIMATE
 * Architecture:
 * 1. DataManager: Gère le localStorage et les statistiques d'apprentissage.
 * 2. MathEngine: Sélectionne les questions basées sur la difficulté.
 * 3. GameEngine: Boucle de jeu, entités, physique.
 * 4. Renderer: Dessine sur le canvas.
 * 5. UI: Gère le DOM.
 */

/* --- CONSTANTS --- */
const SHIPS = [
    { id: 0, name: "Scout", unlockXp: 0, color: "#00f3ff" },
    { id: 1, name: "Hunter", unlockXp: 5000, color: "#ff0055" },
    { id: 2, name: "Destroyer", unlockXp: 15000, color: "#ff9100" }
];

const RANKS = [
    { xp: 0, title: "CADET" },
    { xp: 2000, title: "PILOTE" },
    { xp: 8000, title: "CAPITAINE" },
    { xp: 20000, title: "COMMANDANT" },
    { xp: 50000, title: "LÉGENDE" }
];

/* --- 1. DATA MANAGER & ADAPTIVE LEARNING --- */
const DataManager = {
    data: {},
    config: {
        soundEnabled: true,
        mode: 'marathon',
        difficulty: 'normal', // easy, normal, hard, extreme
        activeTables: [2, 3, 4, 5, 6, 7, 8, 9, 10] // Default all active
    },
    xp: 0,
    highScore: 0,
    unlockedShips: [0],
    highScore: 0,
    unlockedShips: [0],
    currentShipId: 0,
    sessions: [], // History of games

    init() {
        const saved = localStorage.getItem('mathsInvadersData');
        if (saved) {
            this.data = JSON.parse(saved);
        }

        // Ensure all keys exist (1-10 x 1-10)
        for (let a = 1; a <= 10; a++) {
            for (let b = 1; b <= 10; b++) {
                const key = `${a}x${b}`;
                if (!this.data[key]) {
                    this.data[key] = { correct: 0, wrong: 0, weight: 10 };
                }
            }
        }

        const savedConfig = localStorage.getItem('mathsInvadersConfig');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            this.config = { ...this.config, ...parsed }; // Merge to ensure new keys exist
        }

        const savedProgression = localStorage.getItem('mathsInvadersProgression');
        if (savedProgression) {
            const p = JSON.parse(savedProgression);
            this.xp = p.xp || 0;
            this.highScore = p.highScore || 0;
            this.unlockedShips = p.unlockedShips || [0];
            this.currentShipId = p.currentShipId || 0;
            this.sessions = p.sessions || [];
        }
    },

    save() {
        localStorage.setItem('mathsInvadersData', JSON.stringify(this.data));
        localStorage.setItem('mathsInvadersConfig', JSON.stringify(this.config));
        localStorage.setItem('mathsInvadersProgression', JSON.stringify({
            xp: this.xp,
            highScore: this.highScore,
            unlockedShips: this.unlockedShips,
            currentShipId: this.currentShipId,
            sessions: this.sessions
        }));
    },

    recordResult(a, b, isCorrect) {
        const key = `${a}x${b}`;
        if (!this.data[key]) this.data[key] = { correct: 0, wrong: 0, weight: 10 };

        if (isCorrect) {
            this.data[key].correct++;
            this.data[key].weight = Math.max(1, this.data[key].weight - 1);
        } else {
            this.data[key].wrong++;
            this.data[key].weight = Math.min(20, this.data[key].weight + 2);
        }
        this.save();
    },

    addXP(amount) {
        this.xp += amount;
        if (this.xp > 5000 && !this.unlockedShips.includes(1)) this.unlockedShips.push(1);
        if (this.xp > 15000 && !this.unlockedShips.includes(2)) this.unlockedShips.push(2);
        this.save();
    },

    addSession(session) {
        this.sessions.unshift(session); // Add to top
        if (this.sessions.length > 50) this.sessions.pop(); // Keep last 50
        this.save();
    },

    getStats(a, b) {
        return this.data[`${a}x${b}`];
    },

    exportCSV() {
        let csvContent = "data:text/csv;charset=utf-8,Multiplication,Tentatives,Correctes,Taux(%)\n";
        for (let key in this.data) {
            let d = this.data[key];
            let attempts = d.correct + d.wrong;
            if (attempts > 0) {
                let rate = Math.round((d.correct / attempts) * 100);
                csvContent += `${key},${attempts},${d.correct},${rate}\n`;
            }
        }
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "classe_maths_invaders.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    exportJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data));
        const link = document.createElement("a");
        link.setAttribute("href", dataStr);
        link.setAttribute("download", "classe_maths_invaders.json");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    resetData() {
        if (confirm("Attention : Cela effacera toute la progression de l'élève. Continuer ?")) {
            localStorage.removeItem('mathsInvadersData');
            localStorage.removeItem('mathsInvadersConfig');
            localStorage.removeItem('mathsInvadersProgression');
            location.reload();
        }
    }
};

/* --- 1.5 AUDIO CONTROLLER --- */
const AudioController = {
    ctx: null,
    enabled: true,

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    shoot() {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    },

    explosion() {
        if (!this.enabled || !this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    },

    correct(combo = 0) {
        // Pitch increases with combo, capped at 2.0x (approx 1 octave)
        const pitch = 1 + Math.min(1.0, combo * 0.1);
        this.playTone(600 * pitch, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(900 * pitch, 'sine', 0.2, 0.1), 100);
    },

    wrong() {
        this.playTone(150, 'sawtooth', 0.3, 0.15);
    }
};

/* --- 2. MATH ENGINE --- */
const MathEngine = {
    currentProblem: null,

    generateProblem(mode) {
        let pool = [];
        const activeTables = DataManager.config.activeTables;

        // Build weighted pool
        for (let a of activeTables) {
            for (let b = 1; b <= 10; b++) {
                let key = `${a}x${b}`;
                let stats = DataManager.data[key];
                let w = stats.weight;

                if (mode === 'focus') {
                    // En focus, on ignore ce qui est "facile" (weight < 8)
                    if (w < 8) w = 0;
                    else w = w * 2;
                }

                // Add to pool w times
                for (let k = 0; k < w; k++) {
                    pool.push({ a, b });
                }
            }
        }

        // Fallback if pool is empty (focus mode completed or nothing selected)
        if (pool.length === 0) {
            let a = activeTables[Math.floor(Math.random() * activeTables.length)];
            let b = Math.floor(Math.random() * 9) + 2;
            pool.push({ a, b });
        }

        const pick = pool[Math.floor(Math.random() * pool.length)];
        this.currentProblem = {
            a: pick.a,
            b: pick.b,
            answer: pick.a * pick.b,
            startTime: Date.now()
        };
        return this.currentProblem;
    },

    getDecoys(correctAnswer) {
        let decoys = new Set();
        while (decoys.size < 3) {
            let d;
            const type = Math.random();
            if (type < 0.33) {
                // Close number
                d = correctAnswer + (Math.floor(Math.random() * 10) - 5);
            } else if (type < 0.66) {
                // Ending in same digit
                d = correctAnswer + 10;
            } else {
                // Random plausible
                d = Math.floor(Math.random() * 80) + 4;
            }
            if (d > 0 && d !== correctAnswer) decoys.add(d);
        }
        return Array.from(decoys);
    }
};

/* --- 3. GAME ENGINE --- */
const Game = {
    canvas: document.getElementById('gameCanvas'),
    ctx: null,
    state: 'menu', // menu, playing, paused, gameover

    lastTime: 0,

    entities: {
        player: null,
        bullets: [],
        enemies: [],
        particles: [],
        texts: [],
        stars: [],
        powerups: []
    },

    score: 0,
    combo: 0,
    health: 100,
    level: 1,
    mode: 'marathon',

    // Power-ups
    powerups: {
        tripleShot: { active: false, timer: 0 },
        shield: { active: false }
    },

    // Visuals
    flashAlpha: 0,
    screenShake: 0,
    shakeIntensity: 0,

    spawnTimer: 0,
    spawnInterval: 2500, // ms

    // Touch controls
    touchX: null,
    isFiring: false,

    init() {
        this.ctx = this.canvas.getContext('2d');
        DataManager.init();
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Mouse / Touch Input
        window.addEventListener('mousemove', e => {
            if (this.state === 'playing') this.entities.player.targetX = e.clientX;
        });
        window.addEventListener('mousedown', () => {
            if (this.state === 'playing') this.shoot();
        });

        this.canvas.addEventListener('touchmove', (e) => {
            if (this.state === 'playing') {
                e.preventDefault();
                this.entities.player.targetX = e.touches[0].clientX;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchstart', (e) => {
            this.isFiring = true;
            this.touchX = e.touches[0].clientX;
            if (this.state === 'playing') this.entities.player.targetX = e.touches[0].clientX;
            AudioController.init();
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => {
            this.isFiring = false;
        });

        window.addEventListener('keydown', (e) => this.handleInput(e, true));
        window.addEventListener('keyup', (e) => this.handleInput(e, false));
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });

        // Init audio on click anywhere (desktop)
        window.addEventListener('click', () => AudioController.init(), { once: true });

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
        UI.init(); // Initialize all UI components

        // Show mobile controls if touch device
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            document.getElementById('mobileControls').classList.remove('hidden');
        }
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.entities.player) this.entities.player.y = this.canvas.height - 80;
    },

    start(mode) {
        if (DataManager.config.activeTables.length === 0) {
            alert("Veuillez sélectionner au moins une table dans les options.");
            return;
        }

        AudioController.init();
        this.mode = mode;
        this.state = 'playing';
        this.score = 0;
        this.combo = 0;
        this.health = 100;
        this.level = 1;
        this.spawnInterval = 3000;
        this.entities = {
            player: {
                x: this.canvas.width / 2,
                y: this.canvas.height - 100,
                width: 40,
                height: 40,
                speed: 400,
                dx: 0,
                targetX: this.canvas.width / 2 // For mouse control
            },
            bullets: [],
            enemies: [],
            particles: [],
            texts: [],
            stars: [],
            powerups: []
        };

        this.sessionMistakes = []; // Track mistakes for this session

        this.powerups = {
            tripleShot: { active: false, timer: 0 },
            shield: { active: false },
            warp: { active: false, timer: 0 },
            freeze: { active: false, timer: 0 }
        };

        this.timeScale = 1.0;
        this.initStars();

        UI.hideMenu();
        UI.showHUD();
        this.nextWave();
    },

    initStars() {
        for (let i = 0; i < 100; i++) {
            this.entities.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2,
                speed: 0.5 + Math.random() * 2
            });
        }
    },

    spawnPowerUp(x, y) {
        if (Math.random() > 0.15) return; // 15% chance
        const rand = Math.random();
        let type = 'SMART';
        if (rand < 0.3) type = 'SMART';
        else if (rand < 0.6) type = 'SHIELD';
        else if (rand < 0.8) type = 'WARP';
        else type = 'FREEZE';

        this.entities.powerups.push({
            x, y, type,
            dy: 100,
            r: 15
        });
    },

    generateAsteroidShape(r) {
        const points = [];
        const numPoints = 8 + Math.floor(Math.random() * 6);
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const radius = r * (0.8 + Math.random() * 0.4); // Variation
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        return points;
    },

    nextWave() {
        const problem = MathEngine.generateProblem(this.mode);
        this.currentProblem = problem; // Store for mistake tracking
        UI.updateTarget(problem.a, problem.b);

        const answers = [problem.answer, ...MathEngine.getDecoys(problem.answer)];
        // Shuffle
        for (let i = answers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
        }

        const segment = this.canvas.width / answers.length;

        answers.forEach((val, i) => {
            let isCorrect = (val === problem.answer);
            // Difficulty indicator for visual coding
            let difficultyColor = 'white'; // default

            // Only show hints in Learning Mode
            if (this.mode === 'learning' && isCorrect) {
                const key = `${problem.a}x${problem.b}`;
                const stats = DataManager.data[key];
                if (stats.weight < 5) difficultyColor = '#0aff0a'; // Green
                else if (stats.weight < 15) difficultyColor = '#f1c40f'; // Yellow
                else difficultyColor = '#ff003c'; // Red
            }

            const r = 35;
            this.entities.enemies.push({
                x: (i * segment) + (segment / 2),
                y: -50,
                value: val,
                isCorrect: isCorrect,
                r: r,
                shape: this.generateAsteroidShape(r),
                angle: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 2, // Rad/s
                speed: this.getEnemySpeed(),
                color: difficultyColor
            });
        });
    },

    restart() {
        UI.hideStats();
        this.start(this.mode);
    },

    handleInput(e, isDown) {
        if (this.state !== 'playing') return;

        if (e.code === 'Escape') {
            UI.returnToMenu();
            return;
        }

        if (e.code === 'ArrowLeft') this.entities.player.dx = isDown ? -1 : 0;
        if (e.code === 'ArrowRight') this.entities.player.dx = isDown ? 1 : 0;
        if (e.code === 'Space' && isDown) this.shoot();
    },

    shoot() {
        if (this.state !== 'playing') return;

        // Cooldown check
        const now = Date.now();
        if (this.lastShotTime && now - this.lastShotTime < 250) return; // 4 shots per second max
        this.lastShotTime = now;

        AudioController.shoot();

        // Standard shot
        this.entities.bullets.push({
            x: this.entities.player.x,
            y: this.entities.player.y - 20,
            speed: 800,
            r: 4,
            angle: 0
        });
    },

    loop(timestamp) {
        if (this.state !== 'playing') {
            this.lastTime = timestamp; // Reset timer when not playing to avoid jumps
            requestAnimationFrame(this.loop);
            return;
        }

        if (!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Cap dt to prevent huge jumps (e.g. tab switching)
        if (dt > 0.1) dt = 0.1;

        // Time Scale (Warp/Freeze)
        if (this.powerups.warp.active) dt *= 2.5;
        if (this.powerups.freeze.active) dt *= 0.2;

        // Auto-fire on mobile/touch
        if (this.isFiring && this.state === 'playing') {
            this.shoot();
        }

        this.update(dt);
        this.draw();
        requestAnimationFrame(this.loop);
    },

    update(dt) {
        // Player Movement (Hybrid: Keyboard dx + Mouse targetX)
        const p = this.entities.player;

        // Keyboard override
        if (p.dx !== 0) {
            p.x += p.dx * p.speed * dt;
            p.targetX = p.x; // Sync target to current pos
        } else {
            // Mouse/Touch smooth follow
            const diff = p.targetX - p.x;
            p.x += diff * 10 * dt; // Smooth lerp
        }

        // Bounds
        if (p.x < p.width / 2) p.x = p.width / 2;
        if (p.x > this.canvas.width - p.width / 2) p.x = this.canvas.width - p.width / 2;

        // Bullets
        for (let i = this.entities.bullets.length - 1; i >= 0; i--) {
            let b = this.entities.bullets[i];
            b.y -= b.speed * dt; // Move up
            if (b.angle) b.x += b.angle * b.speed * dt; // Spread for triple shot
            if (b.y < 0) this.entities.bullets.splice(i, 1);
        }

        // Stars
        this.entities.stars.forEach(s => {
            s.y += s.speed * (this.level * 0.5); // Speed up with level
            if (s.y > this.canvas.height) {
                s.y = 0;
                s.x = Math.random() * this.canvas.width;
            }
        });

        // Powerups
        for (let i = this.entities.powerups.length - 1; i >= 0; i--) {
            let p = this.entities.powerups[i];
            p.y += p.dy * dt;

            // Collision with player
            let dx = this.entities.player.x - p.x;
            let dy = this.entities.player.y - p.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.entities.player.width) {
                // Collect
                if (p.type === 'TRIPLE') {
                    this.powerups.tripleShot.active = true;
                    this.powerups.tripleShot.timer = 5;
                    this.spawnFloatingText(this.entities.player.x, this.entities.player.y, "TRIPLE TIR!", "#00f3ff");
                } else if (p.type === 'SMART') {
                    // Smart Bomb: Destroy all decoys
                    this.spawnFloatingText(this.entities.player.x, this.entities.player.y, "SMART BOMB!", "#ff003c");
                    this.entities.enemies.forEach((e, idx) => {
                        if (!e.isCorrect) {
                            this.createExplosion(e.x, e.y, e.color);
                            // Mark for removal (we'll filter them out or handle in next frame, but simpler to just set health or flag)
                            e.dead = true;
                        }
                    });
                    // Filter out dead enemies immediately
                    this.entities.enemies = this.entities.enemies.filter(e => !e.dead);

                } else if (p.type === 'SHIELD') {
                    this.powerups.shield.active = true;
                    this.spawnFloatingText(this.entities.player.x, this.entities.player.y, "BOUCLIER!", "#bc13fe");
                } else if (p.type === 'WARP') {
                    this.powerups.warp.active = true;
                    this.powerups.warp.timer = 5;
                    this.spawnFloatingText(this.entities.player.x, this.entities.player.y, "WARP SPEED!", "#f1c40f");
                    document.getElementById('warp-overlay').style.opacity = 1;
                } else if (p.type === 'FREEZE') {
                    this.powerups.freeze.active = true;
                    this.powerups.freeze.timer = 5;
                    this.spawnFloatingText(this.entities.player.x, this.entities.player.y, "FREEZE!", "#0aff0a");
                    document.getElementById('freeze-overlay').style.opacity = 1;
                }
                AudioController.correct(); // Reuse chime
                this.entities.powerups.splice(i, 1);
            } else if (p.y > this.canvas.height) {
                this.entities.powerups.splice(i, 1);
            }
        }

        // Powerup Timers
        if (this.powerups.warp.active) {
            this.powerups.warp.timer -= dt / 2.5; // Real time
            if (this.powerups.warp.timer <= 0) {
                this.powerups.warp.active = false;
                document.getElementById('warp-overlay').style.opacity = 0;
            }
        }
        if (this.powerups.freeze.active) {
            this.powerups.freeze.timer -= dt * 5; // Real time (since dt is small)
            if (this.powerups.freeze.timer <= 0) {
                this.powerups.freeze.active = false;
                document.getElementById('freeze-overlay').style.opacity = 0;
            }
        }

        // Flash decay
        if (this.flashAlpha > 0) this.flashAlpha -= dt * 2;

        // Enemies
        let enemiesCleared = true;
        for (let i = this.entities.enemies.length - 1; i >= 0; i--) {
            let e = this.entities.enemies[i];
            enemiesCleared = false;
            e.y += e.speed * dt;
            e.angle += e.rotationSpeed * dt;

            // Removed Chaotic Movement (User request: straight down, just faster)

            // Collision Bullet-Enemy
            for (let j = this.entities.bullets.length - 1; j >= 0; j--) {
                let b = this.entities.bullets[j];
                let dx = b.x - e.x;
                let dy = b.y - e.y;
                let dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < e.r + b.r) {
                    // HIT
                    this.createExplosion(e.x, e.y, e.isCorrect ? '#0aff0a' : '#ff003c');
                    this.entities.bullets.splice(j, 1);

                    if (e.isCorrect) {
                        this.handleCorrectAnswer();
                        // Score Popup
                        this.spawnFloatingText(e.x, e.y, `+${100 * this.combo}`, '#0aff0a');
                        // Screen Shake
                        this.shakeIntensity = 5;

                        // Remove all enemies of this wave
                        this.entities.enemies = [];
                        const delay = this.getSpawnDelay();
                        setTimeout(() => this.nextWave(), delay);
                        return;
                    } else {
                        this.handleWrongAnswer(e.value);
                        this.entities.enemies.splice(i, 1); // Remove wrong asteroid
                    }
                    break;
                }
            }

            // Collision Player-Enemy (Crash)
            let pdx = p.x - e.x;
            let pdy = p.y - e.y;
            let pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pdist < e.r + 20) {
                this.takeDamage(20);
                this.createExplosion(e.x, e.y, '#ffffff');
                this.entities.enemies.splice(i, 1);
                if (e.isCorrect) {
                    // Si on percute la bonne réponse, ça compte comme une erreur mais on passe
                    this.handleWrongAnswer("CRASH");
                    this.entities.enemies = [];
                    const delay = Math.max(200, 1000 - (this.level * 80));
                    setTimeout(() => this.nextWave(), delay + 500); // Little extra delay for crash
                    return;
                }
            }

            // Out of bounds
            if (e.y > this.canvas.height) {
                this.entities.enemies.splice(i, 1);
                if (e.isCorrect) {
                    this.handleWrongAnswer("MISSED");
                    this.entities.enemies = [];
                    const delay = Math.max(200, 1000 - (this.level * 80));
                    setTimeout(() => this.nextWave(), delay);
                    return;
                }
            }
        }

        // Particles
        for (let i = this.entities.particles.length - 1; i >= 0; i--) {
            let part = this.entities.particles[i];
            part.x += part.vx * dt;
            part.y += part.vy * dt;
            part.life -= dt;
            if (part.life <= 0) this.entities.particles.splice(i, 1);
        }

        // Float texts
        for (let i = this.entities.texts.length - 1; i >= 0; i--) {
            let t = this.entities.texts[i];
            t.y -= 50 * dt;
            t.life -= dt;
            if (t.life <= 0) this.entities.texts.splice(i, 1);
        }
    },

    handleCorrectAnswer() {
        AudioController.correct(this.combo);
        const prob = MathEngine.currentProblem;
        const timeTaken = Date.now() - prob.startTime;

        DataManager.recordResult(prob.a, prob.b, true, timeTaken);

        this.combo++;
        this.score += 100 * this.combo;
        this.health = Math.min(100, this.health + 5);

        // Combo Milestones
        if (this.combo === 10) this.spawnFloatingText(this.canvas.width / 2, this.canvas.height / 2, "EPIC!", "#f1c40f", 2.0);
        if (this.combo === 20) this.spawnFloatingText(this.canvas.width / 2, this.canvas.height / 2, "UNSTOPPABLE!", "#bc13fe", 2.0);
        if (this.combo === 30) this.spawnFloatingText(this.canvas.width / 2, this.canvas.height / 2, "GODLIKE!", "#ff003c", 3.0);

        UI.updateScore(this.score, this.combo, this.health);

        // Level up every 5 correct
        if (DataManager.data[`${prob.a}x${prob.b}`].correct % 5 === 0) {
            this.level = Math.min(10, this.level + 0.5); // Faster leveling (was 0.2)
            UI.updateLevel(Math.floor(this.level));
            this.flashAlpha = 0.5; // Flash on level up
        }
    },

    handleWrongAnswer(val) {
        AudioController.wrong();
        if (this.currentProblem) {
            this.sessionMistakes.push(`${this.currentProblem.a} x ${this.currentProblem.b} = ${this.currentProblem.answer}`);
        }
        const prob = MathEngine.currentProblem;
        DataManager.recordResult(prob.a, prob.b, false, 0);

        this.combo = 0;
        this.takeDamage(20);
        this.spawnFloatingText(this.entities.player.x, this.entities.player.y, "NON!", "#ff003c");
        UI.updateScore(this.score, this.combo, this.health);
    },

    takeDamage(amount) {
        if (this.powerups.shield.active) {
            this.powerups.shield.active = false;
            this.spawnFloatingText(this.entities.player.x, this.entities.player.y, "BOUCLIER BRISE!", "#ffffff");
            this.createExplosion(this.entities.player.x, this.entities.player.y, '#bc13fe');
            return;
        }

        this.health -= amount;
        // Screen shake effect
        this.shakeIntensity = 10;

        if (this.health <= 0) {
            this.gameOver();
        }
    },

    createExplosion(x, y, color) {
        AudioController.explosion();
        this.spawnPowerUp(x, y); // Try spawn powerup
        const count = 20 + Math.random() * 10; // More particles
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 50;
            this.entities.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8 + Math.random() * 0.5, // Longer life
                color: color
            });
        }
    },

    spawnFloatingText(x, y, text, color, life = 1.0) {
        this.entities.texts.push({
            x, y, text, color, life: life, maxLife: life
        });
    },

    draw() {
        // Clear
        this.ctx.fillStyle = '#050510';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply Screen Shake
        this.ctx.save();
        if (this.shakeIntensity > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            this.ctx.translate(dx, dy);
            this.shakeIntensity = Math.max(0, this.shakeIntensity - 0.5); // Decay
        }
        this.ctx.fillStyle = '#ffffff';
        this.entities.stars.forEach(s => {
            this.ctx.globalAlpha = Math.random() * 0.5 + 0.3;
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // Grid background (Retro effect)
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
        this.ctx.lineWidth = 1;
        const gridSize = 50;
        const offset = (Date.now() / 50) % gridSize;

        // Vertical lines
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        // Horizontal (moving)
        for (let y = offset; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Draw Player
        const p = this.entities.player;
        this.ctx.save();
        this.ctx.translate(p.x, p.y);

        // Ship shape
        this.ctx.beginPath();
        this.ctx.moveTo(0, -20);
        this.ctx.lineTo(15, 15);

        // Shield visual
        if (this.powerups.shield.active) {
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 30, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#bc13fe';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Ship Color & Shape
        const shipId = DataManager.currentShipId;
        const shipColor = SHIPS[shipId].color;
        this.ctx.fillStyle = shipColor;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = shipColor;

        this.ctx.beginPath();
        if (shipId === 0) { // Scout
            this.ctx.moveTo(0, -20);
            this.ctx.lineTo(20, 20);
            this.ctx.lineTo(0, 15);
            this.ctx.lineTo(-20, 20);
        } else if (shipId === 1) { // Hunter
            this.ctx.moveTo(0, 10);
            this.ctx.lineTo(20, 20);
            this.ctx.lineTo(20, -10);
            this.ctx.lineTo(5, -25);
            this.ctx.lineTo(0, -15);
            this.ctx.lineTo(-5, -25);
            this.ctx.lineTo(-20, -10);
            this.ctx.lineTo(-20, 20);
        } else { // Destroyer
            this.ctx.moveTo(0, -25);
            this.ctx.lineTo(15, -5);
            this.ctx.lineTo(25, 15);
            this.ctx.lineTo(0, 25);
            this.ctx.lineTo(-25, 15);
            this.ctx.lineTo(-15, -5);
        }
        this.ctx.closePath();
        this.ctx.fill();

        // Thruster flame
        this.ctx.beginPath();
        this.ctx.moveTo(-5, 15);
        this.ctx.lineTo(0, 25 + Math.random() * 10);
        this.ctx.lineTo(5, 15);
        this.ctx.fillStyle = '#bc13fe';
        this.ctx.shadowColor = '#bc13fe';
        this.ctx.fill();

        this.ctx.restore();

        // Draw Powerups
        this.entities.powerups.forEach(p => {
            this.ctx.save();
            this.ctx.translate(p.x, p.y);

            let color = '#fff';
            let label = '?';
            if (p.type === 'SMART') { color = '#ff003c'; label = 'B'; }
            else if (p.type === 'SHIELD') { color = '#bc13fe'; label = 'S'; }
            else if (p.type === 'WARP') { color = '#f1c40f'; label = 'W'; }
            else if (p.type === 'FREEZE') { color = '#0aff0a'; label = 'F'; }

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, p.r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#000';
            this.ctx.font = '10px "Press Start 2P"';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(label, 0, 0);
            this.ctx.restore();
        });

        // Draw Enemies
        this.entities.enemies.forEach(e => {
            this.ctx.save();
            this.ctx.translate(e.x, e.y);
            this.ctx.rotate(e.angle); // Rotate

            // Draw Asteroid Shape
            this.ctx.beginPath();
            if (e.shape && e.shape.length > 0) {
                this.ctx.moveTo(e.shape[0].x, e.shape[0].y);
                for (let i = 1; i < e.shape.length; i++) {
                    this.ctx.lineTo(e.shape[i].x, e.shape[i].y);
                }
            } else {
                // Fallback
                this.ctx.arc(0, 0, e.r, 0, Math.PI * 2);
            }
            this.ctx.closePath();

            this.ctx.fillStyle = '#111';
            this.ctx.fill();

            this.ctx.lineWidth = 3;
            this.ctx.strokeStyle = e.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = e.color;
            this.ctx.stroke();

            // Learning Mode Hint
            if (this.mode === 'learning' && e.isCorrect) {
                this.ctx.strokeStyle = 'white';
                this.ctx.setLineDash([5, 5]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }

            // Text (Rotate back so text is straight)
            this.ctx.rotate(-e.angle);

            this.ctx.fillStyle = '#fff';
            this.ctx.shadowBlur = 0;
            this.ctx.font = '20px "Press Start 2P"';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(e.value, 0, 5); // Slight offset

            this.ctx.restore();
        });

        // Draw Bullets
        this.ctx.fillStyle = '#bc13fe';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#bc13fe';
        this.entities.bullets.forEach(b => {
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw Particles
        this.entities.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        });

        // Draw Floating Texts
        this.entities.texts.forEach(t => {
            this.ctx.globalAlpha = t.life;
            this.ctx.fillStyle = t.color;
            this.ctx.font = '16px "Press Start 2P"';
            this.ctx.fillText(t.text, t.x, t.y);
            this.ctx.globalAlpha = 1;
        });

        // Screen Flash
        if (this.flashAlpha > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.ctx.restore(); // End Screen Shake
    },

    getEnemySpeed() {
        const diff = DataManager.config.difficulty;
        let base = 30;
        let multiplier = 10;

        if (diff === 'normal') { base = 50; multiplier = 15; }
        if (diff === 'hard') { base = 100; multiplier = 30; } // Significantly faster
        if (diff === 'extreme') { base = 150; multiplier = 50; } // Very fast

        return base + (this.level * multiplier);
    },

    getSpawnDelay() {
        const diff = DataManager.config.difficulty;
        let base = 1000;
        let reduction = 80;

        if (diff === 'easy') { base = 1500; reduction = 50; }
        if (diff === 'hard') { base = 800; reduction = 100; }
        if (diff === 'extreme') { base = 500; reduction = 150; }

        return Math.max(200, base - (this.level * reduction));
    },

    getChaoticFactor() {
        return 0; // Disabled
    },

    gameOver() {
        this.state = 'gameover';
        AudioController.playTone(100, 'sawtooth', 0.5);

        // Award XP
        if (this.mode !== 'learning') {
            DataManager.addXP(this.score);
            if (this.score > DataManager.highScore) {
                DataManager.highScore = this.score;
            }

            // Record Session
            const total = this.score / 100; // Approx correct answers (ignoring combos for simplicity or track separately)
            // Better: track actual correct count in Game
            DataManager.addSession({
                date: new Date().toISOString(),
                mode: this.mode,
                score: this.score,
                mistakes: this.sessionMistakes.length,
                rank: DataManager.xp // Snapshot of rank
            });
            DataManager.save();
        }

        UI.showGameOver(this.score, this.sessionMistakes);
    }
};

/* --- 4. UI MANAGER --- */
const UI = {
    hideMenu() { document.getElementById('mainMenu').classList.add('hidden'); },

    updateRankUI() {
        const rank = RANKS.slice().reverse().find(r => DataManager.xp >= r.xp) || RANKS[0];
        document.getElementById('rankTitle').innerText = rank.title;
        document.getElementById('rankXP').innerText = `${DataManager.xp} XP`;
    },

    renderShipSelector() {
        const container = document.getElementById('shipSelector');
        container.innerHTML = '';
        SHIPS.forEach(ship => {
            const btn = document.createElement('div');
            const isUnlocked = DataManager.unlockedShips.includes(ship.id);
            const isSelected = DataManager.currentShipId === ship.id;

            btn.className = `w-10 h-10 border-2 rounded flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'border-green-400 shadow-[0_0_10px_#0aff0a]' :
                isUnlocked ? 'border-gray-600 hover:border-white' : 'border-gray-800 opacity-50 cursor-not-allowed'
                }`;

            if (!isUnlocked) {
                btn.innerHTML = '<i class="fas fa-lock text-xs text-gray-500"></i>';
            } else {
                // Simple colored square as preview
                const preview = document.createElement('div');
                preview.className = 'w-6 h-6';
                preview.style.backgroundColor = ship.color;
                // Clip path for shape
                if (ship.id === 0) preview.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
                else if (ship.id === 1) preview.style.clipPath = 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)';
                else preview.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';

                btn.appendChild(preview);
                btn.onclick = () => {
                    DataManager.currentShipId = ship.id;
                    DataManager.save();
                    UI.renderShipSelector();
                };
            }
            container.appendChild(btn);
        });
    },
    init() {
        this.renderTablesGrid();
        this.setDifficulty(DataManager.config.difficulty || 'normal');
        this.updateRankUI();
        this.renderShipSelector();
    },

    showMenu() {
        document.getElementById('mainMenu').classList.remove('hidden');
        document.getElementById('statsScreen').classList.add('hidden');
        document.getElementById('hud').classList.add('hidden');
        this.updateRankUI();
        this.renderShipSelector();
    },

    showGameOver(score, mistakes) {
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('statsScreen').classList.remove('hidden');

        // Update Stats
        document.getElementById('statsTitle').innerText = "MISSION TERMINÉE";
        document.getElementById('statScore').innerText = score;
        // Accuracy? We'd need to track total shots vs hits. For now just score.
        document.getElementById('statAccuracy').innerText = "-";

        // Mistakes List
        const list = document.getElementById('reviewList');
        list.innerHTML = '';
        if (mistakes && mistakes.length > 0) {
            // Dedup
            const unique = [...new Set(mistakes)];
            unique.forEach(m => {
                const div = document.createElement('div');
                div.className = "text-red-300 border-b border-red-900/50 pb-1";
                div.innerText = m;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = '<div class="text-green-400 text-center italic">Aucune erreur ! Mission parfaite.</div>';
        }

        // Global Progress Bar (XP)
        const bar = document.getElementById('globalProgressBar');
        const nextRank = RANKS.slice().reverse().find(r => r.xp > DataManager.xp) || { xp: DataManager.xp * 1.5 }; // Fallback
        const prevRank = RANKS.slice().reverse().find(r => r.xp <= DataManager.xp) || { xp: 0 };

        const progress = Math.min(100, Math.max(0, ((DataManager.xp - prevRank.xp) / (nextRank.xp - prevRank.xp)) * 100));

        bar.innerHTML = `<div class="h-full bg-purple-500" style="width: ${progress}%"></div>`;

        // --- REVIEW SHEET (Fiche de Révision) ---
        const reviewContainer = document.createElement('div');
        reviewContainer.className = "w-full max-w-4xl mt-6 bg-gray-900 border border-red-900 p-4 rounded-lg";

        // Filter difficult items (< 85% accuracy)
        const difficultItems = [];
        for (let key in DataManager.data) {
            const d = DataManager.data[key];
            if (d.correct + d.wrong > 0) {
                const rate = d.correct / (d.correct + d.wrong);
                if (rate < 0.85) {
                    difficultItems.push({ key, rate, total: d.correct + d.wrong });
                }
            }
        }
            difficultItems.sort((a, b) => a.rate - b.rate);

            reviewContainer.innerHTML = `
            <h3 class="text-xl text-red-400 mb-4 border-b border-gray-700 pb-2 flex justify-between items-center">
                <span>FICHE DE RÉVISION</span>
                <div class="flex gap-2">
                    <button class="text-xs bg-cyan-600 hover:bg-cyan-500 text-white py-1 px-3 rounded font-bold transition-all print-review-btn">
                        <i class="fas fa-print mr-1"></i> PDF
                    </button>
                    <i class="fas fa-book-open text-red-400"></i>
                </div>
            </h3>
            <div class="text-gray-300 text-sm mb-4">
                ${difficultItems.length > 0
                ? "Voici les tables à travailler en priorité (précision < 85%) :"
                : "Aucune difficulté majeure détectée ! Continuez comme ça !"}
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                ${difficultItems.map(item => `
                    <div class="bg-gray-800 p-3 rounded border border-red-500/30 flex justify-between items-center">
                        <span class="font-bold text-white text-lg">${item.key.replace('x', ' x ')}</span>
                        <span class="text-xs ${item.rate < 0.5 ? 'text-red-500' : 'text-yellow-500'} font-bold">
                            ${Math.round(item.rate * 100)}%
                        </span>
                    </div>
                `).join('')}
            </div>
        `;

        // Insert Review Sheet BEFORE History (History is removed now, so just append to historyContainer parent or replace it)
        // Actually, the previous code inserted it before historyContainer.
        // Since we want to REMOVE history, we can just clear the historyContainer and put the review sheet there,
        // OR we can just use a dedicated container.
        // The previous code did: parent.insertBefore(reviewContainer, historyContainer);

        const historyContainer = document.getElementById('historyContainer');
        // We want to remove the history table entirely.
        historyContainer.innerHTML = '';
        historyContainer.className = "hidden"; // Hide it

        // Check if already exists to avoid dupes if we don't clear
        const existingReview = document.getElementById('reviewSheetContainer');
        if (existingReview) existingReview.remove();

        reviewContainer.id = 'reviewSheetContainer';
        // Insert into the parent of historyContainer, replacing where history used to be effectively
        historyContainer.parentNode.insertBefore(reviewContainer, historyContainer);

        const printableDifficulties = difficultItems.map(item => ({
            title: item.key.replace('x', ' x '),
            detail: `${Math.round(item.rate * 100)}% de réussite (${item.total} essais)`
        }));
        const printBtn = reviewContainer.querySelector('.print-review-btn');
        if (printBtn) {
            printBtn.onclick = () => this.openPrintPage(
                "FICHE DE RÉVISION",
                "Tables à travailler en priorité",
                printableDifficulties
            );
        }
    },
    showHUD() { document.getElementById('hud').classList.remove('hidden'); },

    updateTarget(a, b) {
        document.getElementById('targetProblem').innerHTML = `${a} <span class="text-gray-500">x</span> ${b}`;
    },

    updateScore(score, combo, health) {
        document.getElementById('scoreDisplay').innerText = `SCORE: ${score}`;
        const comboEl = document.getElementById('comboDisplay');
        comboEl.innerText = `COMBO x${combo}`;

        // Trigger animation
        comboEl.classList.remove('pop-anim');
        void comboEl.offsetWidth; // Trigger reflow
        comboEl.classList.add('pop-anim');

        const bar = document.getElementById('healthBar');
        bar.style.width = `${health}%`;
        bar.className = `h-full transition-all duration-300 ${health < 30 ? 'bg-red-500' : 'bg-green-500'}`;
    },

    updateLevel(lvl) {
        document.getElementById('levelDisplay').innerText = lvl;
    },

    openPrintPage(title, subtitle, items) {
        const win = window.open('', '_blank');
        if (!win) {
            alert("Veuillez autoriser les pop-ups pour imprimer.");
            return;
        }

        const listHtml = items && items.length
            ? items.map(it => `
                <div class="item">
                    <div class="item-title">${it.title}</div>
                    <div class="item-detail">${it.detail || ''}</div>
                </div>
            `).join('')
            : '<p class="empty">Aucune difficulté détectée. Bravo !</p>';

        win.document.write(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8" />
                <title>${title}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: "Arial", sans-serif; background: #fff; color: #111; margin: 0; padding: 32px; }
                    h1 { margin: 0 0 6px; font-size: 28px; }
                    h2 { margin: 0 0 24px; font-size: 16px; font-weight: normal; color: #555; }
                    .item { border: 1px solid #ddd; padding: 12px 16px; border-radius: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
                    .item-title { font-weight: 700; font-size: 16px; }
                    .item-detail { font-size: 14px; color: #0a7; font-weight: 700; }
                    .empty { font-size: 16px; font-weight: 600; color: #0a7; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <h2>${subtitle}</h2>
                ${listHtml}
                <script>window.onload = () => window.print();</script>
            </body>
            </html>
        `);
        win.document.close();
    },

    showSettings() {
        document.getElementById('settingsScreen').classList.remove('hidden');
    },
    hideSettings() {
        document.getElementById('settingsScreen').classList.add('hidden');
        DataManager.save();
    },

    setDifficulty(diff) {
        DataManager.config.difficulty = diff;
        DataManager.save();

        // Update UI
        ['easy', 'normal', 'hard', 'extreme'].forEach(d => {
            const btn = document.getElementById(`btn-${d}`);
            if (d === diff) {
                btn.className = `flex-1 py-2 rounded border text-xs font-bold bg-${this.getDiffColor(d)}-900/30 border-${this.getDiffColor(d)}-500 text-${this.getDiffColor(d)}-400`;
            } else {
                btn.className = "flex-1 py-2 rounded border border-gray-600 text-gray-400 text-xs font-bold hover:bg-gray-800";
            }
        });
    },

    getDiffColor(d) {
        if (d === 'easy') return 'green';
        if (d === 'normal') return 'cyan';
        if (d === 'hard') return 'orange';
        if (d === 'extreme') return 'red';
        return 'gray';
    },

    renderTablesGrid() {
        const container = document.getElementById('tablesGrid');
        container.innerHTML = '';
        for (let i = 2; i <= 10; i++) {
            const isActive = DataManager.config.activeTables.includes(i);
            const btn = document.createElement('button');
            btn.className = `p-3 rounded border text-center font-bold transition-all ${isActive ? 'border-cyan-400 bg-cyan-900/30 text-cyan-400' : 'border-gray-700 text-gray-600'}`;
            btn.innerText = `Table de ${i}`;
            btn.onclick = () => {
                this.toggleTable(i);
                this.renderTablesGrid();
            };
            container.appendChild(btn);
        }
    },

    toggleTable(n) {
        const idx = DataManager.config.activeTables.indexOf(n);
        if (idx > -1) DataManager.config.activeTables.splice(idx, 1);
        else DataManager.config.activeTables.push(n);
        DataManager.config.activeTables.sort((a, b) => a - b);
    },

    toggleAllTables(state) {
        if (state) DataManager.config.activeTables = [2, 3, 4, 5, 6, 7, 8, 9, 10];
        else DataManager.config.activeTables = [];
        this.renderTablesGrid();
    },

    showStats() {
        document.getElementById('statsScreen').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');

        document.getElementById('statsTitle').innerText = Game.state === 'gameover' ? "MISSION TERMINÉE" : "RAPPORT PROF";
        document.getElementById('statScore').innerText = Game.score;

        // Calculate detailed stats
        let totalAttempts = 0;
        let totalCorrect = 0;
        let reviewItems = [];
        let mastered = 0, learning = 0, hard = 0;

        for (let key in DataManager.data) {
            const d = DataManager.data[key];
            let attempts = d.correct + d.wrong; // FIXED: Calculate attempts
            if (attempts > 0) {
                totalAttempts += attempts;
                totalCorrect += d.correct;
                const rate = d.correct / attempts;

                // Categorization
                if (rate < 0.8) {
                    hard++;
                    reviewItems.push({ key, rate, attempts: attempts });
                } else if (rate < 0.95) {
                    learning++;
                } else {
                    mastered++;
                }
            }
        }

        // Accuracy
        const acc = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
        document.getElementById('statAccuracy').innerText = `${acc}%`;

        // Fill Review List (Top 5 worst)
        reviewItems.sort((a, b) => a.rate - b.rate);
        const list = document.getElementById('reviewList');
        list.innerHTML = '';
        if (reviewItems.length === 0) {
            list.innerHTML = '<div class="text-green-400 text-center py-4">Rien à signaler. Excellent travail !</div>';
        } else {
            reviewItems.slice(0, 10).forEach(item => {
                const div = document.createElement('div');
                div.className = "flex justify-between items-center bg-black/50 p-2 rounded border-l-2 border-red-500";
                div.innerHTML = `
                    <span class="font-bold text-white">${item.key}</span>
                    <span class="text-xs text-red-300">${Math.round(item.rate * 100)}% (sur ${item.attempts} essais)</span>
                `;
                list.appendChild(div);
            });
        }
        const printableReview = reviewItems.slice(0, 10).map(item => ({
            title: item.key.replace('x', ' x '),
            detail: `${Math.round(item.rate * 100)}% - ${item.attempts} essais`
        }));
        const reviewPrintBtn = document.getElementById('reviewPrintBtn');
        if (reviewPrintBtn) {
            reviewPrintBtn.onclick = () => this.openPrintPage(
                "À Réviser (Difficulté)",
                "Tables avec précision < 80%",
                printableReview
            );
        }

        // Global Progress Bar
        const totalActive = mastered + learning + hard;
        if (totalActive > 0) {
            const pBar = document.getElementById('globalProgressBar');
            const pctMaster = (mastered / totalActive) * 100;
            const pctLearn = (learning / totalActive) * 100;
            const pctHard = (hard / totalActive) * 100;

            pBar.innerHTML = `
                <div style="width:${pctMaster}%" class="bg-green-500 h-full"></div>
                <div style="width:${pctLearn}%" class="bg-yellow-500 h-full"></div>
                <div style="width:${pctHard}%" class="bg-red-500 h-full"></div>
            `;
        }
    },

    returnToMenu() {
        Game.state = 'menu';
        this.showMenu();
    }
};

// Start
window.onload = () => Game.init();
