import { OrbitControls } from "./OrbitControls.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set background color
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

// Enhanced lighting setup with multiple light sources
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Additional fill light
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(-10, 15, -10);
scene.add(fillLight);

// Rim light for dramatic effect
const rimLight = new THREE.SpotLight(0xffffff, 0.5);
rimLight.position.set(0, 25, 0);
rimLight.angle = Math.PI / 6;
rimLight.penumbra = 0.3;
rimLight.castShadow = true;
scene.add(rimLight);

// Enable shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Game state variables
let basketball;
let basketballVelocity = new THREE.Vector3(0, 0, 0);
let basketballAngularVelocity = new THREE.Vector3(0, 0, 0);
let isBallInFlight = false;
let shotPower = 50; // 0-100%
let score = 0;
let shotAttempts = 0;
let shotsMade = 0;
let gameMessage = "";
let messageTimer = 0;
let hasScoredThisShot = false; // Track if current shot has already scored
let scoreboardDisplay; // Reference to the 3D scoreboard display
let ballPassedThroughNet = false; // Track if ball has passed through the net
let netPassageTime = 0; // Track time since passing through net
let ballOutOfBounds = false; // Track if ball has gone out of bounds
let outOfBoundsTimer = 0; // Timer for out of bounds message
let shotPassedHoop = false; // Track if ball has passed through hoop area
let missedShotDetected = false; // Track if a missed shot has been detected
let scoreboardPulseTimer = 0; // Timer for scoreboard pulse animation

// Physics constants - Adjusted for proper hoop height
const GRAVITY = -12.0; // Reduced gravity to allow higher shots
const BOUNCE_DAMPING = 0.6; // Reduced for more bounces
const FRICTION = 0.99; // Reduced air resistance
const BALL_RADIUS = 0.25;
const COURT_BOUNDS = { x: 14, z: 7 };
const HOOP_POSITIONS = [
  { x: -15, z: 0, y: 10 },
  { x: 15, z: 0, y: 10 },
];

// Court and ball positioning constants
const COURT_HEIGHT = 0.2;
const COURT_SURFACE_Y = COURT_HEIGHT / 2; // Top surface of the court
const BALL_REST_HEIGHT = BALL_RADIUS + COURT_SURFACE_Y; // Ball sits slightly above court surface
const HOOP_RIM_RADIUS = 0.45;
const HOOP_HEIGHT = 10;

// Game timing constants
const MESSAGE_DISPLAY_TIME = 120; // 2 seconds at 60fps
const SHOT_MESSAGE_TIME = 60; // 1 second at 60fps
const RESET_MESSAGE_TIME = 60; // 1 second at 60fps

// Physics threshold constants
const BALL_STOP_VELOCITY_Y = 0.3; // Reduced for more sensitive stopping
const BALL_STOP_VELOCITY_TOTAL = 0.8; // Reduced for more sensitive stopping
const ROTATION_SPEED_THRESHOLD = 0.1;
const SHOT_BASE_VELOCITY = 35; // Increased significantly for proper height
const SHOT_UPWARD_COMPONENT = 8; // Increased for better arc

// Net physics constants
const NET_HEIGHT = 1.5; // Height of the net below the rim
const NET_SLOWDOWN_FACTOR = 0.3; // How much the net slows the ball
const NET_PASSAGE_TIME = 0.5; // Time in seconds for ball to pass through net

// Out of bounds constants
const OUT_OF_BOUNDS_MESSAGE_TIME = 90; // 1.5 seconds at 60fps
const COURT_BOUNDARY_BUFFER = 2; // Extra buffer beyond court bounds

// Backboard collision constants
const BACKBOARD_BOUNCE_DAMPING = 0.8; // How much the backboard slows the ball
const BACKBOARD_FRICTION = 0.9; // Friction when ball hits backboard

// Input state
const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  KeyW: false,
  KeyS: false,
  Space: false,
  KeyR: false,
  KeyO: false,
};

function degrees_to_radians(degrees) {
  var pi = Math.PI;
  return degrees * (pi / 180);
}

// Create enhanced basketball court with detailed markings
function createBasketballCourt() {
  const textureLoader = new THREE.TextureLoader();
  const courtTexture = textureLoader.load(
    "src/textures/ParquetFlooring06_MR_4K/ParquetFlooring06_4K_BaseColor.png"
  );
  const normalMap = textureLoader.load(
    "src/textures/ParquetFlooring06_MR_4K/ParquetFlooring06_4K_Normal.png"
  );
  const roughnessMap = textureLoader.load(
    "src/textures/ParquetFlooring06_MR_4K/ParquetFlooring06_4K_Roughness.png"
  );

  courtTexture.wrapS = THREE.RepeatWrapping;
  courtTexture.wrapT = THREE.RepeatWrapping;
  courtTexture.repeat.set(4, 4);

  const courtGeometry = new THREE.BoxGeometry(30, COURT_HEIGHT, 15);
  const courtMaterial = new THREE.MeshStandardMaterial({
    map: courtTexture,
    normalMap: normalMap,
    roughnessMap: roughnessMap,
  });
  const court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.receiveShadow = true;
  scene.add(court);

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

  // Center line
  const centerLineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.11, -7.5),
    new THREE.Vector3(0, 0.11, 7.5),
  ]);
  const centerLine = new THREE.Line(centerLineGeometry, lineMaterial);
  scene.add(centerLine);

  // Center circle
  const centerCirclePoints = [];
  const centerCircleRadius = 1.8;
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * 2 * Math.PI;
    centerCirclePoints.push(
      new THREE.Vector3(
        Math.cos(angle) * centerCircleRadius,
        0.11,
        Math.sin(angle) * centerCircleRadius
      )
    );
  }
  const centerCircleGeometry = new THREE.BufferGeometry().setFromPoints(
    centerCirclePoints
  );
  const centerCircle = new THREE.Line(centerCircleGeometry, lineMaterial);
  scene.add(centerCircle);

  // Three-point lines
  const threePointRadius = 6.25;

  // Left three-point line
  const leftThreePointPoints = [];
  for (let i = 0; i <= 32; i++) {
    const angle = -Math.PI / 2 + (i / 32) * Math.PI;
    leftThreePointPoints.push(
      new THREE.Vector3(
        -12 + Math.cos(angle) * threePointRadius,
        0.11,
        Math.sin(angle) * threePointRadius
      )
    );
  }
  const leftThreePointGeometry = new THREE.BufferGeometry().setFromPoints(
    leftThreePointPoints
  );
  const leftThreePoint = new THREE.Line(leftThreePointGeometry, lineMaterial);
  scene.add(leftThreePoint);

  // Left three-point extensions
  const leftTopExtension = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-12, 0.11, threePointRadius),
    new THREE.Vector3(-15, 0.11, threePointRadius),
  ]);
  const leftTopLine = new THREE.Line(leftTopExtension, lineMaterial);
  scene.add(leftTopLine);

  const leftBottomExtension = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-12, 0.11, -threePointRadius),
    new THREE.Vector3(-15, 0.11, -threePointRadius),
  ]);
  const leftBottomLine = new THREE.Line(leftBottomExtension, lineMaterial);
  scene.add(leftBottomLine);

  // Right three-point line
  const rightThreePointPoints = [];
  for (let i = 0; i <= 32; i++) {
    const angle = Math.PI / 2 + (i / 32) * Math.PI;
    rightThreePointPoints.push(
      new THREE.Vector3(
        12 + Math.cos(angle) * threePointRadius,
        0.11,
        Math.sin(angle) * threePointRadius
      )
    );
  }
  const rightThreePointGeometry = new THREE.BufferGeometry().setFromPoints(
    rightThreePointPoints
  );
  const rightThreePoint = new THREE.Line(rightThreePointGeometry, lineMaterial);
  scene.add(rightThreePoint);

  // Right three-point extensions
  const rightTopExtension = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(12, 0.11, threePointRadius),
    new THREE.Vector3(15, 0.11, threePointRadius),
  ]);
  const rightTopLine = new THREE.Line(rightTopExtension, lineMaterial);
  scene.add(rightTopLine);

  const rightBottomExtension = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(12, 0.11, -threePointRadius),
    new THREE.Vector3(15, 0.11, -threePointRadius),
  ]);
  const rightBottomLine = new THREE.Line(rightBottomExtension, lineMaterial);
  scene.add(rightBottomLine);

  // Free throw lines and key areas
  // Left free throw line
  const leftFreeThrowGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-12, 0.11, -1.8),
    new THREE.Vector3(-12, 0.11, 1.8),
  ]);
  const leftFreeThrow = new THREE.Line(leftFreeThrowGeometry, lineMaterial);
  scene.add(leftFreeThrow);

  // Left key area
  const leftKeyGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-12, 0.11, -1.8),
    new THREE.Vector3(-15, 0.11, -1.8),
    new THREE.Vector3(-15, 0.11, 1.8),
    new THREE.Vector3(-12, 0.11, 1.8),
  ]);
  const leftKey = new THREE.Line(leftKeyGeometry, lineMaterial);
  scene.add(leftKey);

  // Right free throw line
  const rightFreeThrowGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(12, 0.11, -1.8),
    new THREE.Vector3(12, 0.11, 1.8),
  ]);
  const rightFreeThrow = new THREE.Line(rightFreeThrowGeometry, lineMaterial);
  scene.add(rightFreeThrow);

  // Right key area
  const rightKeyGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(12, 0.11, -1.8),
    new THREE.Vector3(15, 0.11, -1.8),
    new THREE.Vector3(15, 0.11, 1.8),
    new THREE.Vector3(12, 0.11, 1.8),
  ]);
  const rightKey = new THREE.Line(rightKeyGeometry, lineMaterial);
  scene.add(rightKey);

  // Free throw circles
  const freeThrowRadius = 1.8;

  // Left free throw circle
  const leftFreeThrowCirclePoints = [];
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 12) * Math.PI;
    leftFreeThrowCirclePoints.push(
      new THREE.Vector3(
        -12 + Math.cos(angle) * freeThrowRadius,
        0.11,
        Math.sin(angle) * freeThrowRadius
      )
    );
  }
  const leftFreeThrowCircleGeometry = new THREE.BufferGeometry().setFromPoints(
    leftFreeThrowCirclePoints
  );
  const leftFreeThrowCircle = new THREE.Line(
    leftFreeThrowCircleGeometry,
    lineMaterial
  );
  scene.add(leftFreeThrowCircle);

  // Right free throw circle
  const rightFreeThrowCirclePoints = [];
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 12) * Math.PI;
    rightFreeThrowCirclePoints.push(
      new THREE.Vector3(
        12 + Math.cos(angle) * freeThrowRadius,
        0.11,
        Math.sin(angle) * freeThrowRadius
      )
    );
  }
  const rightFreeThrowCircleGeometry = new THREE.BufferGeometry().setFromPoints(
    rightFreeThrowCirclePoints
  );
  const rightFreeThrowCircle = new THREE.Line(
    rightFreeThrowCircleGeometry,
    lineMaterial
  );
  scene.add(rightFreeThrowCircle);
}

// Create enhanced basketball hoop with branded backboard and chain net
function createBasketballHoop(x, z, facingDirection) {
  const hoopGroup = new THREE.Group();

  // Rim (orange circle)
  const rimRadius = 0.45;
  const rimGeometry = new THREE.TorusGeometry(rimRadius, 0.05, 8, 32);
  rimGeometry.rotateX(Math.PI / 2);
  const rimMaterial = new THREE.MeshPhongMaterial({ color: 0xff8c00 });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.position.set(x, 10, z);
  rim.castShadow = true;
  rim.receiveShadow = true;
  hoopGroup.add(rim);

  // Enhanced backboard with branding - made larger
  const backboardGeometry = new THREE.BoxGeometry(0.1, 1.2, 2.1); // Increased height and width

  // Create branded backboard texture
  const backboardCanvas = document.createElement("canvas");
  backboardCanvas.width = 256;
  backboardCanvas.height = 128;
  const backboardCtx = backboardCanvas.getContext("2d");

  // White background
  backboardCtx.fillStyle = "#ffffff";
  backboardCtx.fillRect(0, 0, 256, 128);

  // Add NBA logo/branding
  backboardCtx.fillStyle = "#000000";
  backboardCtx.font = "bold 24px Arial";
  backboardCtx.textAlign = "center";
  backboardCtx.fillText("NBA", 128, 64);
  backboardCtx.font = "12px Arial";
  backboardCtx.fillText("COURT", 128, 80);

  // Add red rectangle outline
  backboardCtx.strokeStyle = "#ff0000";
  backboardCtx.lineWidth = 4;
  backboardCtx.strokeRect(8, 8, 240, 112);

  const backboardTexture = new THREE.CanvasTexture(backboardCanvas);
  const backboardMaterial = new THREE.MeshPhongMaterial({
    map: backboardTexture,
    transparent: true,
    opacity: 0.9,
  });

  const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
  backboard.position.set(x + facingDirection * 0.6, 10.5, z);
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  hoopGroup.add(backboard);

  // Support pole
  const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 11, 8);
  const poleMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.set(x + facingDirection * 1.5, 5, z);
  pole.castShadow = true;
  pole.receiveShadow = true;
  hoopGroup.add(pole);

  // Support arm
  const armGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.1);
  const armMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
  const arm = new THREE.Mesh(armGeometry, armMaterial);
  arm.position.set(x + facingDirection * 1.1, 10.5, z);
  arm.castShadow = true;
  arm.receiveShadow = true;
  hoopGroup.add(arm);

  // Enhanced chain net
  const chainMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc });
  const netSegments = 16;

  // Vertical chain lines
  for (let i = 0; i < netSegments; i++) {
    const angle = (i / netSegments) * 2 * Math.PI;
    const chainLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(
        x + Math.cos(angle) * rimRadius,
        10,
        z + Math.sin(angle) * rimRadius
      ),
      new THREE.Vector3(
        x + Math.cos(angle) * rimRadius * 0.7,
        8,
        z + Math.sin(angle) * rimRadius * 0.7
      ),
    ]);
    const chainLine = new THREE.Line(chainLineGeometry, chainMaterial);
    hoopGroup.add(chainLine);
  }

  // Horizontal chain rings
  for (let ring = 1; ring <= 4; ring++) {
    const ringRadius = rimRadius * (1 - ring * 0.12);
    const ringHeight = 10 - ring * 0.5;
    const ringPoints = [];

    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * 2 * Math.PI;
      ringPoints.push(
        new THREE.Vector3(
          x + Math.cos(angle) * ringRadius,
          ringHeight,
          z + Math.sin(angle) * ringRadius
        )
      );
    }

    const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const chainRing = new THREE.Line(ringGeometry, chainMaterial);
    hoopGroup.add(chainRing);
  }

  scene.add(hoopGroup);
  return hoopGroup;
}

// Create enhanced basketball with better texture
function createBasketball() {
  const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);

  // Create enhanced basketball texture
  const texture = new THREE.TextureLoader().load(
    "src/textures/balldimpled.png"
  );

  const ballMaterial = new THREE.MeshPhongMaterial({
    map: texture,
    shininess: 30,
  });

  basketball = new THREE.Mesh(ballGeometry, ballMaterial);
  basketball.position.set(0, BALL_REST_HEIGHT, 0);
  basketball.castShadow = true;
  basketball.receiveShadow = true;

  scene.add(basketball);
  return basketball;
}

// Create stadium environment
function createStadiumEnvironment() {
  // Bleachers
  const bleacherMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });

  // Back bleachers (main seating area) - moved even closer
  for (let row = 0; row < 10; row++) {
    const bleacherGeometry = new THREE.BoxGeometry(35, 0.3, 2.5);
    const bleacher = new THREE.Mesh(bleacherGeometry, bleacherMaterial);
    bleacher.position.set(0, row * 0.6, 17 + row * 0.8); // Moved even closer (from 20 to 17)
    bleacher.castShadow = true;
    bleacher.receiveShadow = true;
    scene.add(bleacher);
  }

  // Scoreboard - moved closer and more grounded
  const scoreboardGeometry = new THREE.BoxGeometry(6, 2, 0.5);
  const scoreboardMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  const scoreboard = new THREE.Mesh(scoreboardGeometry, scoreboardMaterial);
  scoreboard.position.set(0, 12, -18); // Lowered height and moved closer
  scoreboard.castShadow = true;
  scoreboard.receiveShadow = true;
  scene.add(scoreboard);

  // Create dynamic scoreboard display
  const displayGeometry = new THREE.PlaneGeometry(5, 1.5);

  // Create canvas for dynamic text
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Create initial scoreboard texture
  function updateScoreboardTexture() {
    // Clear canvas
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add red border
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    // Add title
    ctx.fillStyle = "#ff0000";
    ctx.font = "bold 60px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BASKETBALL", canvas.width / 2, 60);

    // Add score text
    ctx.font = "bold 80px Arial";
    ctx.fillText("SCORE", canvas.width / 2, 120);
    ctx.fillText(score.toString(), canvas.width / 2, 200);

    // Add additional stats
    ctx.font = "bold 35px Arial";
    ctx.fillText(`BASKETS: ${shotsMade}`, canvas.width / 2, 240);
    ctx.fillText(`ATTEMPTS: ${shotAttempts}`, canvas.width / 2, 270);

    // Add accuracy percentage
    const accuracy =
      shotAttempts > 0 ? ((shotsMade / shotAttempts) * 100).toFixed(1) : "0.0";
    ctx.fillText(`ACCURACY: ${accuracy}%`, canvas.width / 2, 300);

    // Add current power
    ctx.fillText(`POWER: ${shotPower}%`, canvas.width / 2, 330);
  }

  // Create initial texture
  updateScoreboardTexture();

  const displayTexture = new THREE.CanvasTexture(canvas);
  displayTexture.wrapS = THREE.ClampToEdgeWrapping;
  displayTexture.wrapT = THREE.ClampToEdgeWrapping;

  const displayMaterial = new THREE.MeshStandardMaterial({
    map: displayTexture,
    emissive: 0xff0000,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.95,
  });

  // Create improved scoreboard display
  scoreboardDisplay = new THREE.Mesh(displayGeometry, displayMaterial);
  scoreboardDisplay.position.set(0, 12, -17.7); // Moved higher and further back
  scoreboardDisplay.castShadow = true;
  scoreboardDisplay.receiveShadow = true;
  scoreboardDisplay.userData = {
    updateTexture: updateScoreboardTexture,
    texture: displayTexture,
  };
  scene.add(scoreboardDisplay);

  // Scoreboard support - made shorter and closer
  const supportGeometry = new THREE.CylinderGeometry(0.2, 0.2, 6, 8); // Reduced height
  const supportMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
  const support = new THREE.Mesh(supportGeometry, supportMaterial);
  support.position.set(0, 9, -18); // Adjusted position
  support.castShadow = true;
  support.receiveShadow = true;
  scene.add(support);

  // Add spotlight to highlight the scoreboard
  // const scoreboardLight = new THREE.SpotLight(0xff0000, 0.8);
  // scoreboardLight.position.set(100, 100, -15);
  // scoreboardLight.angle = Math.PI / 8;
  // scoreboardLight.penumbra = 0.3;
  // scoreboardLight.target = scoreboardDisplay;
  // scoreboardLight.castShadow = true;
  // scene.add(scoreboardLight);
  // scene.add(scoreboardLight.target);
}

// Physics and game logic functions
function updatePhysics(deltaTime) {
  if (!basketball || !isBallInFlight) return;

  // Apply gravity
  basketballVelocity.y += GRAVITY * deltaTime;

  // Apply air resistance (friction) to all components
  basketballVelocity.x *= FRICTION;
  basketballVelocity.y *= FRICTION;
  basketballVelocity.z *= FRICTION;

  // Apply net physics if ball has scored and is passing through net
  if (ballPassedThroughNet) {
    netPassageTime += deltaTime;

    // Check if ball is in the net area (below rim, above net bottom)
    for (const hoop of HOOP_POSITIONS) {
      const horizontalDistance = Math.sqrt(
        Math.pow(basketball.position.x - hoop.x, 2) +
          Math.pow(basketball.position.z - hoop.z, 2)
      );

      // If ball is within net area and still passing through
      if (
        horizontalDistance < HOOP_RIM_RADIUS &&
        basketball.position.y < hoop.y &&
        basketball.position.y > hoop.y - NET_HEIGHT &&
        netPassageTime < NET_PASSAGE_TIME
      ) {
        // Apply net resistance - slow down the ball significantly
        basketballVelocity.multiplyScalar(NET_SLOWDOWN_FACTOR);

        // Add some horizontal resistance from the net
        basketballVelocity.x *= 0.8;
        basketballVelocity.z *= 0.8;

        console.log("Ball passing through net - slowed down");
        break;
      }
    }

    // Reset net passage after the ball has passed through
    if (netPassageTime >= NET_PASSAGE_TIME) {
      ballPassedThroughNet = false;
      netPassageTime = 0;
    }
  }

  // Update position
  const positionChange = basketballVelocity.clone().multiplyScalar(deltaTime);
  basketball.position.add(positionChange);

  // Update rotation based on velocity - improved for realistic ball spin
  const velocityMagnitude = basketballVelocity.length();
  const rotationSpeed = velocityMagnitude * 2.5; // Adjusted for better visual effect

  if (rotationSpeed > 0.05) {
    // Lower threshold for more responsive rotation
    // Calculate rotation axis perpendicular to velocity direction
    const velocityNormalized = basketballVelocity.clone().normalize();

    // Create rotation axis perpendicular to velocity (for realistic ball spin)
    let rotationAxis;
    if (Math.abs(velocityNormalized.y) < 0.8) {
      // For mostly horizontal movement, rotate around vertical axis
      rotationAxis = new THREE.Vector3(
        -velocityNormalized.z,
        0,
        velocityNormalized.x
      ).normalize();
    } else {
      // For vertical movement, rotate around horizontal axis
      rotationAxis = new THREE.Vector3(1, 0, 0);
    }

    // Apply rotation
    basketball.rotateOnAxis(rotationAxis, rotationSpeed * deltaTime);
  }

  // Ground collision with improved bounce physics
  if (basketball.position.y <= BALL_REST_HEIGHT) {
    basketball.position.y = BALL_REST_HEIGHT;

    // Bounce with energy loss
    basketballVelocity.y = -basketballVelocity.y * BOUNCE_DAMPING;

    // Add some horizontal friction on ground contact
    basketballVelocity.x *= 0.95;
    basketballVelocity.z *= 0.95;

    // Stop ball if velocity is very low
    if (
      Math.abs(basketballVelocity.y) < BALL_STOP_VELOCITY_Y &&
      basketballVelocity.length() < BALL_STOP_VELOCITY_TOTAL
    ) {
      isBallInFlight = false;
      basketballVelocity.set(0, 0, 0);
      basketballAngularVelocity.set(0, 0, 0);
      ballPassedThroughNet = false; // Reset net state when ball stops
      netPassageTime = 0;

      // Check if this was a missed shot (ball stopped without scoring)
      if (!hasScoredThisShot && !ballOutOfBounds && !missedShotDetected) {
        missedShotDetected = true;
        gameMessage = "SHOT MISSED!";
        messageTimer = OUT_OF_BOUNDS_MESSAGE_TIME;
        console.log("Shot missed - ball stopped without scoring");
      }
    }
  }

  // Check for out of bounds
  checkOutOfBounds();

  // Check for backboard collisions
  checkBackboardCollision();

  // Check for successful shots
  checkForScore();
}

function checkOutOfBounds() {
  if (!basketball || !isBallInFlight || hasScoredThisShot || ballOutOfBounds)
    return;

  // Check if ball has gone beyond court boundaries
  const extendedBounds = {
    x: COURT_BOUNDS.x + COURT_BOUNDARY_BUFFER,
    z: COURT_BOUNDS.z + COURT_BOUNDARY_BUFFER,
  };

  if (
    Math.abs(basketball.position.x) > extendedBounds.x ||
    Math.abs(basketball.position.z) > extendedBounds.z ||
    basketball.position.y > 20 // Ball went too high
  ) {
    // Ball is out of bounds - stop it and show message
    ballOutOfBounds = true;
    isBallInFlight = false;
    basketballVelocity.set(0, 0, 0);
    basketballAngularVelocity.set(0, 0, 0);

    // Show missed shot message
    gameMessage = "SHOT MISSED! Ball out of bounds";
    messageTimer = OUT_OF_BOUNDS_MESSAGE_TIME;
    outOfBoundsTimer = OUT_OF_BOUNDS_MESSAGE_TIME;

    console.log("Ball out of bounds at position:", basketball.position);

    // Return ball to center after a short delay
    setTimeout(() => {
      resetBall();
    }, 1500); // 1.5 second delay
  }
}

function checkBackboardCollision() {
  if (!basketball || !isBallInFlight) return;

  for (const hoop of HOOP_POSITIONS) {
    // Calculate backboard position based on hoop position and facing direction
    const facingDirection = hoop.x > 0 ? 1 : -1; // Left hoop faces left, right hoop faces right
    const backboardX = hoop.x + facingDirection * 0.6;
    const backboardY = 10.5;
    const backboardZ = hoop.z;

    // Backboard dimensions (from createBasketballHoop function)
    const backboardWidth = 0.1; // X dimension
    const backboardHeight = 1.2; // Y dimension
    const backboardDepth = 2.1; // Z dimension

    // Check if ball is colliding with backboard
    const ballX = basketball.position.x;
    const ballY = basketball.position.y;
    const ballZ = basketball.position.z;

    // Check if ball is within backboard bounds
    if (
      Math.abs(ballX - backboardX) < backboardWidth / 2 + BALL_RADIUS &&
      Math.abs(ballY - backboardY) < backboardHeight / 2 + BALL_RADIUS &&
      Math.abs(ballZ - backboardZ) < backboardDepth / 2 + BALL_RADIUS
    ) {
      // Ball is colliding with backboard
      console.log("Backboard collision detected!");

      // Determine which side of the backboard was hit
      const hitFromFront =
        (facingDirection > 0 && ballX < backboardX) ||
        (facingDirection < 0 && ballX > backboardX);

      if (hitFromFront) {
        // Ball hit the front of backboard - bounce it back
        basketballVelocity.x = -basketballVelocity.x * BACKBOARD_BOUNCE_DAMPING;
        basketballVelocity.y *= BACKBOARD_FRICTION;
        basketballVelocity.z *= BACKBOARD_FRICTION;

        // Add some randomness to make it more realistic
        basketballVelocity.y += (Math.random() - 0.5) * 2;
        basketballVelocity.z += (Math.random() - 0.5) * 2;

        // Move ball slightly away from backboard to prevent sticking
        const pushDirection = facingDirection > 0 ? -1 : 1;
        basketball.position.x =
          backboardX + pushDirection * (backboardWidth / 2 + BALL_RADIUS + 0.1);

        // Show backboard hit message
        gameMessage = "BACKBOARD!";
        messageTimer = 30; // 0.5 seconds
      } else {
        // Ball hit the back of backboard - let it pass through (for bank shots)
        // This allows for realistic bank shot physics
        console.log("Bank shot - ball passing through backboard");
      }
    }
  }
}

function checkForScore() {
  if (!basketball || !isBallInFlight || hasScoredThisShot) return;

  for (const hoop of HOOP_POSITIONS) {
    // Check if ball is at hoop height and moving downward
    if (
      Math.abs(basketball.position.y - hoop.y) < 0.5 &&
      basketballVelocity.y < 0
    ) {
      // Check if ball passes through hoop area
      const horizontalDistance = Math.sqrt(
        Math.pow(basketball.position.x - hoop.x, 2) +
          Math.pow(basketball.position.z - hoop.z, 2)
      );

      // Use a smaller radius for actual rim opening (not including net)
      const rimOpeningRadius = HOOP_RIM_RADIUS * 0.7; // 70% of rim radius for actual opening

      if (horizontalDistance < rimOpeningRadius) {
        // Ball is passing through the actual rim opening - score!
        console.log(
          "SCORE! Ball position:",
          basketball.position,
          "Hoop:",
          hoop,
          "Distance:",
          horizontalDistance,
          "Rim opening radius:",
          rimOpeningRadius
        );
        score += 2;
        shotsMade++;
        hasScoredThisShot = true; // Mark this shot as scored
        ballPassedThroughNet = true; // Ball will now pass through net
        netPassageTime = 0; // Reset net passage timer
        shotPassedHoop = true; // Mark that ball passed through hoop area
        gameMessage = "SHOT MADE! +2 points";
        messageTimer = MESSAGE_DISPLAY_TIME;
        updateScoreDisplay();

        // Don't stop the ball immediately - let it continue falling through net
        return;
      } else if (horizontalDistance < HOOP_RIM_RADIUS) {
        // Ball hit the rim or net but didn't go through
        console.log(
          "Rim hit! Ball position:",
          basketball.position,
          "Hoop:",
          hoop,
          "Distance:",
          horizontalDistance,
          "Rim opening radius:",
          rimOpeningRadius
        );

        // Mark that ball passed through hoop area but missed
        if (!shotPassedHoop) {
          shotPassedHoop = true;
          missedShotDetected = true;
          gameMessage = "SHOT MISSED!";
          messageTimer = OUT_OF_BOUNDS_MESSAGE_TIME;
          console.log("Shot missed - ball hit rim but didn't go through");
        }
      } else {
        // Ball near hoop but missed completely
        console.log(
          "Miss! Ball position:",
          basketball.position,
          "Hoop:",
          hoop,
          "Distance:",
          horizontalDistance
        );

        // Mark that ball passed through hoop area but missed
        if (!shotPassedHoop) {
          shotPassedHoop = true;
          missedShotDetected = true;
          gameMessage = "SHOT MISSED!";
          messageTimer = OUT_OF_BOUNDS_MESSAGE_TIME;
          console.log("Shot missed - ball missed hoop completely");
        }
      }
    }
  }
}

function shootBall() {
  if (isBallInFlight) return;

  shotAttempts++;
  isBallInFlight = true;
  hasScoredThisShot = false; // Reset score flag for new shot
  ballOutOfBounds = false; // Reset out of bounds state for new shot
  outOfBoundsTimer = 0;
  shotPassedHoop = false; // Reset shot passed hoop state for new shot
  missedShotDetected = false; // Reset missed shot detection for new shot

  // Find nearest hoop
  const ballPos = basketball.position;
  let nearestHoop = HOOP_POSITIONS[0];
  let minDistance = ballPos.distanceTo(
    new THREE.Vector3(nearestHoop.x, nearestHoop.y, nearestHoop.z)
  );

  for (const hoop of HOOP_POSITIONS) {
    const distance = ballPos.distanceTo(
      new THREE.Vector3(hoop.x, hoop.y, hoop.z)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestHoop = hoop;
    }
  }

  // Calculate direction to hoop
  const directionToHoop = new THREE.Vector3(
    nearestHoop.x - ballPos.x,
    0, // We'll handle vertical separately
    nearestHoop.z - ballPos.z
  ).normalize();

  // Calculate horizontal distance to hoop
  const horizontalDistance = Math.sqrt(
    Math.pow(nearestHoop.x - ballPos.x, 2) +
      Math.pow(nearestHoop.z - ballPos.z, 2)
  );

  // Calculate shot power (0-100% to velocity)
  const powerMultiplier = shotPower / 100;
  const baseVelocity = SHOT_BASE_VELOCITY * powerMultiplier;

  // Improved physics: Use angle-based shooting with height consideration
  // Calculate minimum angle needed to reach hoop height
  const minHeightForHoop = nearestHoop.y + 0.5; // Aim above the rim
  const currentHeight = ballPos.y;
  const heightDifference = minHeightForHoop - currentHeight;

  // Calculate minimum vertical velocity needed to reach hoop height
  // Using physics equation: v^2 = v0^2 + 2*a*y
  // At peak height, v = 0, so: 0 = v0^2 + 2*(-gravity)*height
  // Therefore: v0 = sqrt(2*gravity*height)
  const minVerticalVelocity = Math.sqrt(
    2 * Math.abs(GRAVITY) * heightDifference
  );

  // Use a higher angle for better arc and control
  const shotAngle = Math.PI / 3; // 60 degrees for higher arc

  // Calculate velocity components
  const horizontalVelocity = baseVelocity * Math.cos(shotAngle);
  const verticalVelocity = Math.max(
    baseVelocity * Math.sin(shotAngle),
    minVerticalVelocity
  );

  // Apply horizontal velocity in direction of hoop
  const horizontalVelocityX = directionToHoop.x * horizontalVelocity;
  const horizontalVelocityZ = directionToHoop.z * horizontalVelocity;

  // Set initial velocity
  basketballVelocity.set(
    horizontalVelocityX,
    verticalVelocity,
    horizontalVelocityZ
  );

  // Debug: Log the shot parameters
  console.log("Shot fired!", {
    ballPosition: ballPos,
    targetHoop: nearestHoop,
    horizontalDistance: horizontalDistance,
    heightDifference: heightDifference,
    power: shotPower,
    baseVelocity: baseVelocity,
    shotAngle: shotAngle * (180 / Math.PI), // Convert to degrees for debug
    minVerticalVelocity: minVerticalVelocity,
    horizontalVelocity: horizontalVelocity,
    verticalVelocity: verticalVelocity,
    finalVelocity: basketballVelocity.clone(),
  });

  gameMessage = "SHOT TAKEN!";
  messageTimer = SHOT_MESSAGE_TIME;
  updateScoreDisplay();
}

function resetBall() {
  if (basketball) {
    basketball.position.set(0, BALL_REST_HEIGHT, 0);
    basketballVelocity.set(0, 0, 0);
    basketballAngularVelocity.set(0, 0, 0);
    basketball.rotation.set(0, 0, 0);
    isBallInFlight = false;
    hasScoredThisShot = false; // Reset score flag
    ballPassedThroughNet = false; // Reset net state
    netPassageTime = 0;
    ballOutOfBounds = false; // Reset out of bounds state
    outOfBoundsTimer = 0;
    shotPassedHoop = false; // Reset shot passed hoop state
    missedShotDetected = false; // Reset missed shot detection
    shotPower = 50;
    gameMessage = "Ball reset to center";
    messageTimer = RESET_MESSAGE_TIME;
    updateScoreDisplay();
  }
}

function resetGame() {
  // Reset all game statistics
  score = 0;
  shotAttempts = 0;
  shotsMade = 0;
  gameMessage = "Game Reset!";
  messageTimer = RESET_MESSAGE_TIME;

  // Reset ball position
  if (basketball) {
    basketball.position.set(0, BALL_REST_HEIGHT, 0);
    basketballVelocity.set(0, 0, 0);
    basketballAngularVelocity.set(0, 0, 0);
    basketball.rotation.set(0, 0, 0);
  }

  // Reset all game states
  isBallInFlight = false;
  hasScoredThisShot = false;
  ballPassedThroughNet = false;
  netPassageTime = 0;
  ballOutOfBounds = false;
  outOfBoundsTimer = 0;
  shotPassedHoop = false;
  missedShotDetected = false;
  shotPower = 50;

  // Update display
  updateScoreDisplay();
}

function moveBall(direction, speed) {
  if (isBallInFlight) return;

  const moveSpeed = speed * 0.1;
  basketball.position.x += direction.x * moveSpeed;
  basketball.position.z += direction.z * moveSpeed;

  // Add rotation during movement for better visual feedback
  if (direction.length() > 0) {
    const rotationSpeed = moveSpeed * 2; // Rotation speed based on movement speed
    const rotationAxis = new THREE.Vector3(
      -direction.z,
      0,
      direction.x
    ).normalize();
    basketball.rotateOnAxis(rotationAxis, rotationSpeed);
  }

  // Allow ball to go outside court bounds for more realistic gameplay
  // No boundary restrictions on movement
}

function adjustShotPower(delta) {
  shotPower = Math.max(0, Math.min(100, shotPower + delta));
  updateScoreDisplay();
}

function updateScoreDisplay() {
  const scoreElement = document.getElementById("score");
  const basketsElement = document.getElementById("baskets");
  const attemptsElement = document.getElementById("attempts");
  const accuracyElement = document.getElementById("accuracy");
  const powerElement = document.getElementById("power");
  const powerFillElement = document.getElementById("power-fill");

  if (scoreElement) scoreElement.textContent = score;
  if (basketsElement) basketsElement.textContent = shotsMade;
  if (attemptsElement) attemptsElement.textContent = shotAttempts;
  if (accuracyElement) {
    const accuracy =
      shotAttempts > 0 ? ((shotsMade / shotAttempts) * 100).toFixed(1) : "0.0";
    accuracyElement.textContent = accuracy + "%";
  }
  if (powerElement) powerElement.textContent = shotPower + "%";
  if (powerFillElement) powerFillElement.style.width = shotPower + "%";

  // Update 3D scoreboard
  if (scoreboardDisplay && scoreboardDisplay.userData.updateTexture) {
    scoreboardDisplay.userData.updateTexture();
    scoreboardDisplay.userData.texture.needsUpdate = true;

    // Trigger pulse animation when score changes
    scoreboardPulseTimer = 30; // 0.5 seconds at 60fps
  }
}

function updateGameMessage() {
  const messageElement = document.getElementById("game-message");
  if (messageElement) {
    if (messageTimer > 0) {
      messageElement.textContent = gameMessage;
      messageElement.style.opacity = "1";
      messageTimer--;
    } else {
      messageElement.style.opacity = "0";
    }
  }
}

// Camera preset positions
const cameraPresets = [
  { name: "Default", position: [0, 20, 25], lookAt: [0, 0, 0] },
  { name: "Side View", position: [25, 15, 0], lookAt: [0, 0, 0] },
  { name: "Top View", position: [0, 35, 0], lookAt: [0, 0, 0] },
  { name: "Hoop View", position: [15, 12, 0], lookAt: [15, 10, 0] },
  { name: "Court Level", position: [0, 2, 15], lookAt: [0, 0, 0] },
  { name: "Behind Hoop", position: [0, 8, 12], lookAt: [0, 0, 0] },
];

let currentCameraPreset = 0;

// Create all elements
createBasketballCourt();
createBasketballHoop(-15, 0, -1);
createBasketballHoop(15, 0, 1);
createBasketball();
createStadiumEnvironment();

// Set initial camera position
camera.position.set(...cameraPresets[0].position);
camera.lookAt(...cameraPresets[0].lookAt);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
let isOrbitEnabled = true;

// Enhanced UI with camera controls
const uiContainer = document.createElement("div");
uiContainer.style.position = "absolute";
uiContainer.style.bottom = "20px";
uiContainer.style.left = "20px";
uiContainer.style.color = "white";
uiContainer.style.fontSize = "14px";
uiContainer.style.fontFamily = "Arial, sans-serif";
uiContainer.style.textAlign = "left";
uiContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
uiContainer.style.padding = "15px";
uiContainer.style.borderRadius = "10px";
uiContainer.style.minWidth = "200px";
document.body.appendChild(uiContainer);

function updateUI() {
  uiContainer.innerHTML = `
    <h4>Basketball Controls:</h4>
    <div><span style="background-color: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Arrow Keys</span> - Move basketball</div>
    <div><span style="background-color: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">W/S</span> - Adjust shot power</div>
    <div><span style="background-color: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Spacebar</span> - Shoot basketball</div>
    <div><span style="background-color: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">R</span> - Reset ball to center</div>
    <div><span style="background-color: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">G</span> - Reset game (all scores to 0)</div>
    <br>
    <h4>Camera Controls:</h4>
    <div><span style="background-color: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">O</span> - Toggle orbit camera</div>
    <div><span style="background-color: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">C</span> - Next camera preset</div>
    <div><span style="background-color: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Mouse</span> - Orbit camera (when enabled)</div>
    <div><span style="background-color: #444; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Scroll</span> - Zoom camera</div>
    <br>
    <div><strong>Current View:</strong> ${cameraPresets[currentCameraPreset].name}</div>
    <div><strong>Shot Power:</strong> <span id="power">${shotPower}</span>%</div>
  `;
}

// Handle key events
function handleKeyDown(e) {
  keys[e.code] = true;

  // Handle single-press actions
  if (e.code === "Space" && !e.repeat) {
    shootBall();
  } else if (e.code === "KeyR" && !e.repeat) {
    resetBall();
  } else if (e.code === "KeyG" && !e.repeat) {
    resetGame();
  } else if (e.code === "KeyO" && !e.repeat) {
    isOrbitEnabled = !isOrbitEnabled;
    controls.enabled = isOrbitEnabled;
  } else if (e.code === "KeyC" && !e.repeat) {
    currentCameraPreset = (currentCameraPreset + 1) % cameraPresets.length;
    const preset = cameraPresets[currentCameraPreset];
    camera.position.set(...preset.position);
    camera.lookAt(...preset.lookAt);
    controls.target.set(...preset.lookAt);
    controls.update();
  }
}

function handleKeyUp(e) {
  keys[e.code] = false;
}

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);

function handleInput() {
  // Ball movement
  if (keys.ArrowLeft) moveBall(new THREE.Vector3(-1, 0, 0), 1);
  if (keys.ArrowRight) moveBall(new THREE.Vector3(1, 0, 0), 1);
  if (keys.ArrowUp) moveBall(new THREE.Vector3(0, 0, -1), 1);
  if (keys.ArrowDown) moveBall(new THREE.Vector3(0, 0, 1), 1);

  // Shot power adjustment
  if (keys.KeyW) adjustShotPower(1);
  if (keys.KeyS) adjustShotPower(-1);
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);

// Animation function
let lastTime = 0;

function animate(currentTime) {
  requestAnimationFrame(animate);

  // Calculate delta time
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  // Handle input
  handleInput();

  // Update physics
  updatePhysics(deltaTime);

  // Update game message
  updateGameMessage();

  // Update scoreboard pulse animation
  if (scoreboardPulseTimer > 0) {
    scoreboardPulseTimer--;
    const pulseIntensity = 0.2 + 0.1 * Math.sin(scoreboardPulseTimer * 0.3);
    if (scoreboardDisplay && scoreboardDisplay.material) {
      scoreboardDisplay.material.emissiveIntensity = pulseIntensity;
    }
  }

  // Update controls
  if (isOrbitEnabled) {
    controls.update();
  }

  // Update UI
  updateUI();

  renderer.render(scene, camera);
}

// Initialize score display and ensure scoreboard starts with zeros
updateScoreDisplay();

// Force initial scoreboard update to ensure zeros are displayed
if (scoreboardDisplay && scoreboardDisplay.userData.updateTexture) {
  scoreboardDisplay.userData.updateTexture();
  scoreboardDisplay.userData.texture.needsUpdate = true;
}

animate();
