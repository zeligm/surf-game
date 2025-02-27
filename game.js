// Game constants
const GRAVITY = 0.5;
const JUMP_FORCE = -10;
const PLAYER_SPEED = 5;
const BASE_PLAYER_SPEED = 5;
const VERTICAL_SPEED = 3; // Speed for up/down movement
const WAVE_SPEED = 2;
const TRICK_POINTS = 100;
const GRIND_POINTS_PER_FRAME = 1;
const SLOPE_ANGLE = 12; // 12 degree descent
const MOMENTUM_FACTOR = 0.05; // Acceleration factor when going downhill

// Game variables
let canvas, ctx, width, height;
let player, obstacles, waves, score;
let grindingWave = null;
let keys = {};
let gameLoop;
let trickInProgress = false;
let trickName = "";
let isTrickScored = false;
let spawnTimer = 0;
let gameStarted = false;
let playerMomentum = 0; // Additional speed from momentum
let bgMusic; // Background music

// Initialize game
window.onload = function() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    width = canvas.width = 800;
    height = canvas.height = 500;
    
    // Initialize game objects
    resetGame();
    
    // Set up background music
    bgMusic = document.getElementById('bgAudio');
    bgMusic.loop = true;
    bgMusic.volume = 0.5;
    
    // Add event listeners for controls
    window.addEventListener('keydown', function(e) {
        keys[e.code] = true;
        
        // Start game on any key press
        if (!gameStarted) {
            gameStarted = true;
            gameLoop = setInterval(update, 1000 / 60); // 60 FPS
            
            // Start background music
            bgMusic.play().catch(error => {
                console.log("Audio playback error:", error);
            });
        }
        
        // Jump logic
        if (e.code === 'Space' && !player.jumping && !player.grinding) {
            player.vy = JUMP_FORCE;
            player.jumping = true;
        }
        
        // Trick logic when in air
        if (player.jumping && !player.grinding && !trickInProgress) {
            if (e.code === 'KeyZ') {
                trickInProgress = true;
                trickName = "360 FLIP";
                isTrickScored = false;
                player.state = 'trick';
                player.trickFrame = 0;
                player.trickStartTime = new Date().getTime();
                player.trickDuration = 1000; // 1 second for trick animation
            } else if (e.code === 'KeyX') {
                trickInProgress = true;
                trickName = "SURF GRAB";
                isTrickScored = false;
                player.state = 'trick';
                player.trickFrame = 0;
                player.trickStartTime = new Date().getTime();
                player.trickDuration = 800; // 0.8 second for trick animation
            }
        }
    });
    
    window.addEventListener('keyup', function(e) {
        keys[e.code] = false;
    });
    
    // Draw initial screen
    drawStartScreen();
};

function resetGame() {
    // Player object
    player = {
        x: 150,
        y: 300,
        width: 20,
        height: 40,
        vx: 0,
        vy: 0,
        jumping: false,
        grinding: false,
        state: 'normal', // normal, trick, grind
        trickFrame: 0,
        color: '#000'
    };
    
    // Game objects
    obstacles = [];
    waves = [];
    score = 0;
    grindingWave = null;
    trickInProgress = false;
    spawnTimer = 0;
    
    // Generate initial waves
    generateWave();
}

function drawStartScreen() {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, width, height);
    
    // Draw water
    ctx.fillStyle = '#0077be';
    ctx.fillRect(0, height - 100, width, 100);
    
    // Draw title
    ctx.fillStyle = '#fff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SURF', width / 2, height / 2 - 50);
    
    // Draw instructions
    ctx.font = '16px Arial';
    ctx.fillText('Use Arrow Keys to move, SPACE to jump', width / 2, height / 2);
    ctx.fillText('Z and X to perform tricks while in air', width / 2, height / 2 + 30);
    ctx.fillText('Press any key to start', width / 2, height / 2 + 70);
    
    // Draw little surfer icon
    drawStickmanSurfer(width / 2, height / 2 + 120, 1);
}

function update() {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Update spawning
    spawnTimer++;
    if (spawnTimer >= 180) { // Every 3 seconds
        generateWave();
        spawnTimer = 0;
    }
    
    // Random chance to spawn a wave at different Y positions
    if (Math.random() < 0.01) { // 1% chance each frame
        const randomY = Math.random() * 100 + (height - 200); // Random Y position in lower half
        generateWave(randomY);
    }
    
    // Calculate momentum (increases when moving downhill)
    if (!player.jumping && !player.grinding) {
        playerMomentum += MOMENTUM_FACTOR;
    } else if (player.grinding) {
        // Maintain momentum while grinding
        playerMomentum = Math.max(playerMomentum, 1); 
    } else {
        // Slowly lose momentum when in air
        playerMomentum *= 0.99;
    }
    // Cap momentum at reasonable value
    playerMomentum = Math.min(playerMomentum, 3);
    
    // Move player with momentum added
    if (keys['ArrowLeft']) {
        player.vx = -BASE_PLAYER_SPEED;
    } else if (keys['ArrowRight']) {
        player.vx = BASE_PLAYER_SPEED + playerMomentum;
    } else {
        // Still move forward with some momentum
        player.vx = playerMomentum * 0.5;
    }
    
    // Add vertical movement (up/down)
    if (keys['ArrowUp'] && !player.grinding) {
        player.vy = -VERTICAL_SPEED;
    } else if (keys['ArrowDown'] && !player.grinding) {
        player.vy = VERTICAL_SPEED;
    }
    
    // Apply physics
    player.x += player.vx;
    
    // Keep player in bounds
    if (player.x < 0) {
        player.x = 0;
    } else if (player.x + player.width > width) {
        player.x = width - player.width;
    }
    
    // Update waves and check collisions
    updateWaves();
    
    // Apply gravity if not grinding
    if (!player.grinding) {
        // Apply less gravity when player is actively moving up/down
        if (keys['ArrowUp'] || keys['ArrowDown']) {
            player.vy += GRAVITY * 0.5;
        } else {
            player.vy += GRAVITY;
        }
        player.y += player.vy;
    }
    
    // Apply slight downhill effect due to slope
    let slopeY = Math.tan(SLOPE_ANGLE * Math.PI / 180) * player.vx;
    if (!player.grinding && !player.jumping) {
        player.y += slopeY * 0.1;
    }
    
    // Update trick animation
    if (trickInProgress) {
        const now = new Date().getTime();
        const elapsed = now - player.trickStartTime;
        
        // Complete trick if duration is over
        if (elapsed >= player.trickDuration) {
            // Only score if trick was completed in the air
            if (player.jumping && !isTrickScored) {
                score += TRICK_POINTS;
                isTrickScored = true;
            }
        }
    }
    
    // Basic world bounds
    if (player.y + player.height > height - 100) { // Water level
        player.y = height - 100 - player.height;
        player.vy = 0;
        player.jumping = false;
        player.state = 'normal';
        trickInProgress = false;
    }
    
    // Upper world bound
    if (player.y < 50) {
        player.y = 50;
        player.vy = 0;
    }
    
    // Reset trick when landing
    if (player.state === 'trick' && !player.jumping) {
        player.state = 'normal';
        trickInProgress = false;
        
        // Award points if trick was completed
        if (!isTrickScored) {
            score += TRICK_POINTS;
            isTrickScored = true;
        }
    }
    
    // Update trick animation
    if (player.state === 'trick') {
        player.trickFrame++;
    }
    
    // Update score display
    document.getElementById('score').textContent = `SCORE: ${score}`;
    
    // Draw everything
    draw();
}

function generateWave(customY) {
    // More variety in wave sizes
    let waveHeight = Math.random() * 80 + 40; // Wave height between 40-120
    let waveLength = Math.random() * 300 + 150; // Wave length between 150-450
    
    // Use custom Y if provided, otherwise use default water level
    const waveY = customY || (height - 100);
    
    waves.push({
        x: width + 50, // Start slightly off-screen
        y: waveY, // Can be at different heights
        width: waveLength,
        height: waveHeight,
        // All waves are grindable now
        type: 'grindable',
        // Add wave curve parameters
        curveHeight: Math.random() * 20 + 10, // Curve height between 10-30
        speed: WAVE_SPEED * (Math.random() * 0.4 + 0.8), // Varying speeds (0.8-1.2 × base speed)
        // Color variation for waves
        color: `rgba(0, ${Math.floor(Math.random() * 100) + 120}, ${Math.floor(Math.random() * 60) + 180}, 0.8)`
    });
}

function updateWaves() {
    // Move waves toward player (they're coming at player from right to left)
    for (let i = 0; i < waves.length; i++) {
        waves[i].x -= waves[i].speed;
        
        // Remove waves that are off screen
        if (waves[i].x + waves[i].width < 0) {
            waves.splice(i, 1);
            i--;
            continue;
        }
        
        // Check collision with player
        if (checkCollision(player, waves[i])) {
            // Check if we're at the top curved part of the wave
            let waveTopY = getWaveYAtPosition(waves[i], player.x + player.width/2);
            
            if (player.y + player.height <= waveTopY + 10) {
                // Start grinding
                player.grinding = true;
                player.state = 'grind';
                grindingWave = waves[i];
                // Position player on top of wave curve
                player.y = waveTopY - player.height + 2;
            }
        }
        
        // Check if we're grinding this wave
        if (grindingWave === waves[i]) {
            // Get the Y position on the wave curve at player's position
            let waveTopY = getWaveYAtPosition(waves[i], player.x + player.width/2);
            
            // Update player position to follow wave curve
            player.y = waveTopY - player.height + 2;
            
            // Add grind points
            score += GRIND_POINTS_PER_FRAME;
            
            // Check if we're still on the wave
            if (player.x + player.width < waves[i].x || 
                player.x > waves[i].x + waves[i].width) {
                player.grinding = false;
                player.state = 'normal';
                grindingWave = null;
            }
            
            // Jump off wave
            if (keys['Space']) {
                player.vy = JUMP_FORCE;
                player.jumping = true;
                player.grinding = false;
                player.state = 'normal';
                grindingWave = null;
                // Give extra momentum on jump
                playerMomentum += 0.5;
            }
        }
    }
}

// Helper function to get the Y position on a wave curve at a given X position
function getWaveYAtPosition(wave, xPos) {
    // Calculate how far along the wave we are (0 to 1)
    let relativeX = (xPos - wave.x) / wave.width;
    
    // Clamp to wave bounds
    relativeX = Math.max(0, Math.min(1, relativeX));
    
    // Create a natural-looking curve, highest in the middle
    let curveAmount = Math.sin(relativeX * Math.PI);
    
    // Calculate Y position on the wave
    return wave.y - wave.height * curveAmount;
}

function checkCollision(a, b) {
    // Simple AABB collision
    return !(
        a.x + a.width < b.x ||
        a.x > b.x + b.width ||
        a.y + a.height < b.y - b.height ||
        a.y > b.y
    );
}

function draw() {
    // Calculate slope angle for drawing with the 12 degree tilt
    const slopeRadians = SLOPE_ANGLE * Math.PI / 180;
    
    // Save context to restore after tilting
    ctx.save();
    
    // Translate and rotate to create the slope effect
    ctx.translate(0, 0);
    ctx.rotate(slopeRadians); // Positive to tilt down from left to right
    
    // Draw sky (make it larger to fill the rotated canvas)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, '#6BB7F5'); // Light blue at top
    skyGradient.addColorStop(0.7, '#87CEEB'); // Medium blue
    skyGradient.addColorStop(1, '#B5E8FF'); // Lighter blue near horizon
    
    ctx.fillStyle = skyGradient;
    ctx.fillRect(-100, -100, width + 200, height + 200);
    
    // Draw distant mountains for depth
    drawMountains();
    
    // Draw water with gradient
    const waterGradient = ctx.createLinearGradient(0, height - 120, 0, height);
    waterGradient.addColorStop(0, '#1A98D5'); // Deeper blue at top
    waterGradient.addColorStop(0.7, '#0077be'); // Medium blue
    waterGradient.addColorStop(1, '#005F97'); // Darker blue at bottom
    
    ctx.fillStyle = waterGradient;
    ctx.fillRect(-100, height - 100, width + 200, 200);
    
    // Draw water surface detail
    drawWaterSurface();
    
    // Draw waves
    for (let wave of waves) {
        drawWave(wave);
    }
    
    // Restore context before drawing player (we want player level, not on slope)
    ctx.restore();
    
    // Draw player
    drawPlayer();
    
    // Draw trick name if in progress
    if (trickInProgress) {
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(trickName, player.x + player.width / 2, player.y - 20);
    }
    
    // Draw speed indicator
    drawSpeedIndicator();
}

// Helper function to draw mountains in the background
function drawMountains() {
    // Draw mountains in the background for parallax effect
    ctx.fillStyle = '#5D8AA8'; // Grayish blue for distant mountains
    
    // First mountain range (distant)
    ctx.beginPath();
    ctx.moveTo(-100, height - 150);
    
    // Create jagged mountain shapes
    for (let i = 0; i < 10; i++) {
        const mountainHeight = Math.random() * 100 + 50;
        const mountainWidth = Math.random() * 150 + 100;
        ctx.lineTo((i * 150) - 50, height - 150 - mountainHeight);
        ctx.lineTo((i * 150) + 50, height - 150);
    }
    
    ctx.lineTo(width + 100, height - 150);
    ctx.lineTo(width + 100, height);
    ctx.lineTo(-100, height);
    ctx.closePath();
    ctx.fill();
}

// Helper function to draw water surface details
function drawWaterSurface() {
    // Draw water lines for movement effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    
    const time = new Date().getTime() / 1000;
    
    for (let i = 0; i < 10; i++) {
        const yPos = height - 100 + i * 8;
        const offset = Math.sin(time + i * 0.3) * 10;
        
        ctx.beginPath();
        ctx.moveTo(-100, yPos + offset);
        
        // Wavy line
        for (let x = 0; x <= width + 200; x += 20) {
            const waveOffset = Math.sin((x + time * 50) / 50 + i) * 2;
            ctx.lineTo(x - 100, yPos + waveOffset + offset);
        }
        
        ctx.stroke();
    }
}

// Draw a speed indicator
function drawSpeedIndicator() {
    const speed = playerMomentum + (player.vx > 0 ? player.vx / BASE_PLAYER_SPEED : 0);
    const maxSpeed = 5;
    const speedRatio = Math.min(speed / maxSpeed, 1);
    
    // Position at bottom right
    const indicatorWidth = 100;
    const indicatorHeight = 10;
    const x = width - indicatorWidth - 20;
    const y = height - 30;
    
    // Draw border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, indicatorWidth, indicatorHeight);
    
    // Draw filled portion based on speed
    const fillWidth = indicatorWidth * speedRatio;
    
    // Color gradient based on speed
    let fillColor;
    if (speedRatio < 0.3) {
        fillColor = '#3CBC3C'; // Green for slow
    } else if (speedRatio < 0.7) {
        fillColor = '#FFCC00'; // Yellow for medium
    } else {
        fillColor = '#FF5050'; // Red for fast
    }
    
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, fillWidth, indicatorHeight);
    
    // Add label
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SPEED', x + indicatorWidth / 2, y - 5);
}

function drawWave(wave) {
    // Draw wave with custom color
    ctx.fillStyle = wave.color || '#00a7e1';
    
    // Draw the wave with a more realistic curve
    ctx.beginPath();
    ctx.moveTo(wave.x, wave.y);
    
    // Draw the wave with multiple points for a better curve
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = wave.x + t * wave.width;
        
        // Use sin curve for wave top
        let waveHeight = wave.height * Math.sin(t * Math.PI);
        
        // Get y position on curve 
        const y = wave.y - waveHeight;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    // Complete the shape
    ctx.lineTo(wave.x + wave.width, wave.y);
    ctx.lineTo(wave.x, wave.y);
    ctx.closePath();
    ctx.fill();
    
    // Add wave face shading (front of the wave)
    const gradient = ctx.createLinearGradient(
        wave.x + wave.width * 0.6, wave.y - wave.height * 0.7,
        wave.x + wave.width * 0.9, wave.y
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 60, 120, 0.3)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(wave.x + wave.width * 0.6, wave.y - wave.height * 0.7);
    ctx.lineTo(wave.x + wave.width * 0.9, wave.y - wave.height * 0.1);
    ctx.lineTo(wave.x + wave.width * 0.9, wave.y);
    ctx.lineTo(wave.x + wave.width * 0.6, wave.y);
    ctx.closePath();
    ctx.fill();
    
    // Add wave top foam/crest
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = wave.x + t * wave.width;
        
        // Get height at this point
        let waveHeight = wave.height * Math.sin(t * Math.PI);
        
        // Get y position on curve (slightly above wave)
        const y = wave.y - waveHeight - 2;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            // Add small ripples to the foam line
            const ripple = Math.sin(t * 20) * 2;
            ctx.lineTo(x, y + ripple);
        }
    }
    
    ctx.stroke();
}

function drawPlayer() {
    const scale = 1.5;
    
    // Save context for rotation if doing trick
    ctx.save();
    
    if (player.state === 'trick') {
        // Get trick progress (0 to 1)
        const now = new Date().getTime();
        const elapsed = now - (player.trickStartTime || now);
        const progress = Math.min(elapsed / (player.trickDuration || 1000), 1);
        
        // Enhanced rotation for trick animation
        ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
        
        if (trickName === "360 FLIP") {
            // Full 360-degree rotation for the flip trick
            ctx.rotate(progress * Math.PI * 2);
        } else if (trickName === "SURF GRAB") {
            // More subtle rotation for grab trick
            ctx.rotate(Math.sin(progress * Math.PI) * 0.5);
        }
        
        ctx.translate(-(player.x + player.width / 2), -(player.y + player.height / 2));
        
        // Update trick frame
        player.trickFrame = Math.floor(progress * 20); // 20 frames of animation
    }
    
    // Draw different poses based on state
    switch (player.state) {
        case 'normal':
            drawStickmanSurfer(player.x, player.y, scale);
            break;
        case 'trick':
            drawStickmanTrick(player.x, player.y, scale);
            break;
        case 'grind':
            drawStickmanGrind(player.x, player.y, scale);
            break;
    }
    
    ctx.restore();
    
    // Draw trick indicator
    if (trickInProgress) {
        // Calculate trick progress
        const now = new Date().getTime();
        const elapsed = now - (player.trickStartTime || now);
        const progress = Math.min(elapsed / (player.trickDuration || 1000), 1);
        
        // Draw progress bar for trick completion
        const barWidth = 50;
        const barHeight = 5;
        const barX = player.x + player.width/2 - barWidth/2;
        const barY = player.y - 30;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Progress
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    }
}

function drawStickmanSurfer(x, y, scale) {
    // Surfboard
    ctx.fillStyle = '#f4a460';
    ctx.fillRect(x - 10 * scale, y + 35 * scale, 40 * scale, 5 * scale);
    
    // Stickman body
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2 * scale;
    
    // Head
    ctx.beginPath();
    ctx.arc(x + 10 * scale, y + 5 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.stroke();
    
    // Body
    ctx.beginPath();
    ctx.moveTo(x + 10 * scale, y + 10 * scale);
    ctx.lineTo(x + 10 * scale, y + 25 * scale);
    ctx.stroke();
    
    // Arms
    ctx.beginPath();
    ctx.moveTo(x + 10 * scale, y + 15 * scale);
    ctx.lineTo(x + 20 * scale, y + 20 * scale);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x + 10 * scale, y + 15 * scale);
    ctx.lineTo(x, y + 20 * scale);
    ctx.stroke();
    
    // Legs
    ctx.beginPath();
    ctx.moveTo(x + 10 * scale, y + 25 * scale);
    ctx.lineTo(x + 15 * scale, y + 35 * scale);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x + 10 * scale, y + 25 * scale);
    ctx.lineTo(x + 5 * scale, y + 35 * scale);
    ctx.stroke();
}

function drawStickmanTrick(x, y, scale) {
    const time = new Date().getTime() / 200;
    const trickProgress = player.trickFrame / 20; // 0 to 1
    
    // Draw animated surfboard
    ctx.save();
    ctx.translate(x + 10 * scale, y + 35 * scale);
    
    // Different rotation for different tricks
    if (trickName === "360 FLIP") {
        // Make board spin with player for flip
        ctx.rotate(trickProgress * Math.PI * 2);
    } else if (trickName === "SURF GRAB") {
        // Subtle angle for grab
        ctx.rotate(Math.sin(trickProgress * Math.PI) * 0.3);
    }
    
    // Draw surfboard with style
    const boardGradient = ctx.createLinearGradient(-15 * scale, 0, 25 * scale, 0);
    boardGradient.addColorStop(0, '#f4a460');
    boardGradient.addColorStop(0.5, '#e9967a');
    boardGradient.addColorStop(1, '#f4a460');
    
    ctx.fillStyle = boardGradient;
    
    // Draw curved surfboard
    ctx.beginPath();
    ctx.moveTo(-15 * scale, 2 * scale);
    ctx.lineTo(25 * scale, 0);
    ctx.lineTo(22 * scale, 5 * scale);
    ctx.lineTo(-13 * scale, 7 * scale);
    ctx.closePath();
    ctx.fill();
    
    // Add stripe on board
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(-10 * scale, 3 * scale);
    ctx.lineTo(20 * scale, 2 * scale);
    ctx.stroke();
    
    ctx.restore();
    
    // Stickman body in trick pose
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2 * scale;
    
    // Head
    ctx.beginPath();
    ctx.arc(x + 10 * scale, y + 5 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.stroke();
    
    if (trickName === "360 FLIP") {
        // Body for flip trick - more compact
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 10 * scale);
        ctx.lineTo(x + 10 * scale, y + 25 * scale);
        ctx.stroke();
        
        // Arms stretched out
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 15 * scale);
        ctx.lineTo(x + 25 * scale, y + 10 * scale - Math.sin(trickProgress * Math.PI * 2) * 5);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 15 * scale);
        ctx.lineTo(x - 5 * scale, y + 10 * scale - Math.sin(trickProgress * Math.PI * 2) * 5);
        ctx.stroke();
        
        // Legs tucked for flip
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 25 * scale);
        ctx.lineTo(x + 20 * scale, y + 30 * scale);
        ctx.lineTo(x + 15 * scale, y + 35 * scale);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 25 * scale);
        ctx.lineTo(x, y + 30 * scale);
        ctx.lineTo(x + 5 * scale, y + 35 * scale);
        ctx.stroke();
    } else if (trickName === "SURF GRAB") {
        // Body for grab trick - reaching down
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 10 * scale);
        ctx.lineTo(x + 10 * scale, y + 20 * scale);
        ctx.stroke();
        
        // One arm grabbing board
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 15 * scale);
        ctx.lineTo(x + 5 * scale, y + 30 * scale);
        ctx.lineTo(x + 10 * scale, y + 35 * scale);
        ctx.stroke();
        
        // Other arm out for balance
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 15 * scale);
        ctx.lineTo(x + 25 * scale, y + 15 * scale);
        ctx.stroke();
        
        // Legs bent for style
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 20 * scale);
        ctx.lineTo(x + 15 * scale, y + 25 * scale);
        ctx.lineTo(x + 20 * scale, y + 35 * scale);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x + 10 * scale, y + 20 * scale);
        ctx.lineTo(x + 5 * scale, y + 25 * scale);
        ctx.lineTo(x, y + 35 * scale);
        ctx.stroke();
    }
    
    // Add trick effect particles
    drawTrickEffects(x, y, scale, trickProgress);
}

// Helper function to draw trick effect particles
function drawTrickEffects(x, y, scale, progress) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    
    // Number of particles based on progress
    const numParticles = Math.floor(progress * 15);
    
    for (let i = 0; i < numParticles; i++) {
        // Calculate particle position in a circular pattern around player
        const angle = (i / numParticles) * Math.PI * 2 + progress * Math.PI * 2;
        const distance = 30 * scale * progress;
        const particleX = x + 10 * scale + Math.cos(angle) * distance;
        const particleY = y + 20 * scale + Math.sin(angle) * distance;
        
        // Size varies with trick type
        let particleSize;
        if (trickName === "360 FLIP") {
            particleSize = 2 * scale * (1 - progress);
        } else {
            particleSize = 1.5 * scale * Math.sin(progress * Math.PI);
        }
        
        // Draw the particle
        ctx.beginPath();
        ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawStickmanGrind(x, y, scale) {
    const time = new Date().getTime() / 200; // For animation
    
    // Draw surfboard with angle following wave
    ctx.save();
    ctx.translate(x + 10 * scale, y + 35 * scale);
    
    // Make board follow wave angle with slight tilt
    let boardAngle = Math.sin(time * 0.1) * 0.1 + 0.15; // Slight upward angle
    ctx.rotate(boardAngle);
    
    // Surfboard with style
    const boardGradient = ctx.createLinearGradient(-15 * scale, 0, 25 * scale, 0);
    boardGradient.addColorStop(0, '#f4a460');
    boardGradient.addColorStop(0.5, '#e9967a');
    boardGradient.addColorStop(1, '#f4a460');
    
    ctx.fillStyle = boardGradient;
    
    // Draw curved surfboard
    ctx.beginPath();
    ctx.moveTo(-15 * scale, 2 * scale);
    ctx.lineTo(25 * scale, 0);
    ctx.lineTo(22 * scale, 5 * scale);
    ctx.lineTo(-13 * scale, 7 * scale);
    ctx.closePath();
    ctx.fill();
    
    // Add stripe on board
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(-10 * scale, 3 * scale);
    ctx.lineTo(20 * scale, 2 * scale);
    ctx.stroke();
    
    ctx.restore();
    
    // Stickman body in dynamic surfing pose
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2 * scale;
    
    // Add motion effect for surfing
    const kneeAngle = Math.sin(time * 0.2) * 0.1;
    const armAngle = Math.sin(time * 0.15) * 0.15;
    
    // Head
    ctx.beginPath();
    ctx.arc(x + 10 * scale, y + 5 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.stroke();
    
    // Body leaning for surf position
    ctx.beginPath();
    ctx.moveTo(x + 10 * scale, y + 10 * scale);
    ctx.lineTo(x + 13 * scale, y + 25 * scale);
    ctx.stroke();
    
    // Arms in surfing position
    // Back arm up for balance
    ctx.beginPath();
    ctx.moveTo(x + 11 * scale, y + 15 * scale);
    ctx.lineTo(x - 5 * scale, y + 10 * scale + Math.sin(armAngle) * 5);
    ctx.stroke();
    
    // Front arm low and forward
    ctx.beginPath();
    ctx.moveTo(x + 11 * scale, y + 15 * scale);
    ctx.lineTo(x + 25 * scale, y + 18 * scale + Math.sin(armAngle) * 2);
    ctx.stroke();
    
    // Legs in dynamic surfing stance
    // Back leg bent knee
    ctx.beginPath();
    ctx.moveTo(x + 13 * scale, y + 25 * scale);
    ctx.lineTo(x + 8 * scale, y + 30 * scale + Math.sin(kneeAngle) * 2);
    ctx.lineTo(x + 3 * scale, y + 35 * scale);
    ctx.stroke();
    
    // Front leg extended
    ctx.beginPath();
    ctx.moveTo(x + 13 * scale, y + 25 * scale);
    ctx.lineTo(x + 18 * scale, y + 30 * scale);
    ctx.lineTo(x + 23 * scale, y + 35 * scale);
    ctx.stroke();
    
    // Add spray effect when grinding
    if (player.grinding) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let i = 0; i < 5; i++) {
            let spraySizeFactor = Math.random() * 0.5 + 0.5;
            let sprayX = x + 20 * scale + Math.random() * 5;
            let sprayY = y + 35 * scale + Math.random() * 3;
            
            ctx.beginPath();
            ctx.arc(sprayX, sprayY, 2 * scale * spraySizeFactor, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}