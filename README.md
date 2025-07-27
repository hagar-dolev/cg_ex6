# Exercise 6 – Interactive Basketball Shooting Game with Physics

## group members

- Hagar Dolev
- Ella Bar Yaacov

## How to Run Your Implementation

### Prerequisites

- Node.js installed on your machine
- Modern web browser with WebGL support

### Running the Application

1. Clone this repository to your local machine
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Start the local web server: `node index.js`
5. Open your browser and go to http://localhost:8000

### Controls

- **Arrow keys:**
  - **Left/Right:** Move ball horizontally across court
  - **Up/Down:** Move ball forward/backward on court
- **W / S Keys:**
  - **W**: Increase shot power (stronger shot)
  - **S**: Decrease shot power (weaker shot)
- **Spacebar** - Launch ball toward nearest hoop
- **R key** - Return ball to center court position, Reset ball velocity to zero, Reset shot power to default (50%), Clear any physics state

controls from ex5:

- **O Key**: Toggle orbit camera controls
- **C Key**: Cycle through camera preset positions
- **Mouse**: Orbit camera (when enabled)
- **Scroll**: Zoom camera

## Physics System Implementation

Our basketball game implements a comprehensive physics system with the following key components:

### Core Physics Constants

- **Gravity**: -12.0 m/s² (reduced from standard gravity for better gameplay)
- **Bounce Damping**: 0.85 (85% energy retention for realistic basketball bounces)
- **Air Friction**: 0.99 (minimal air resistance for smooth ball movement)
- **Ball Radius**: 0.25 units

### Ball Physics Features

1. **Realistic Rolling**: Perfect rolling physics when ball is on the ground

   - Angular velocity = linear velocity / radius
   - Direction-based rotation axes (X-axis for forward/backward, Z-axis for left/right)

2. **Air Rotation**: Dynamic rotation during shooting and bouncing

   - Enhanced rotation speed (180% of ground rolling) for visible shooting effects
   - Direction-based rotation based on horizontal movement

3. **Bounce Physics**: Realistic bounce behavior with energy loss
   - Impact-based friction reduction
   - Random bounce variations for realism
   - Bounce rotation effects with energy loss

### Collision Detection System

1. **Ground Collision**: Automatic ball stopping when velocity drops below thresholds
2. **Backboard Collision**: Realistic bank shot physics with bounce damping
3. **Rim Collision**: Dynamic rim interactions with visual feedback
4. **Net Physics**: Ball slowdown when passing through net after scoring
5. **Out of Bounds Detection**: Automatic reset when ball leaves court boundaries

### Shooting Mechanics

- **Distance-Aware Aiming**: Automatic angle calculation based on distance to hoop
- **Power System**: Adjustable shot power (0-100%) affecting velocity
- **Precision Scaling**: Closer shots require more precision
- **Realistic Arc**: Proper parabolic trajectories with gravity

## Physics Calculations

### Core Physics Formulas

#### **1. Gravity and Motion**

```javascript
basketballVelocity.y += GRAVITY * deltaTime;
```

- **Formula**: `v = v₀ + at` (velocity = initial velocity + acceleration × time)
- **GRAVITY = -12.0 m/s²** (reduced from standard -9.81 m/s² for gameplay)

#### **2. Air Resistance (Friction)**

```javascript
basketballVelocity.x *= FRICTION;
basketballVelocity.y *= FRICTION;
basketballVelocity.z *= FRICTION;
```

- **FRICTION = 0.99** (1% velocity loss per frame)
- **Formula**: `v = v × 0.99` (exponential decay)

#### **3. Perfect Rolling Physics**

```javascript
const angularVelocity = horizontalVelocity / BALL_RADIUS;
basketball.rotateOnWorldAxis(rotationAxis, angularVelocity * deltaTime);
```

- **Formula**: `ω = v/r` (angular velocity = linear velocity / radius)
- **BALL_RADIUS = 0.25 units**
- **Rotation angle**: `θ = ω × Δt`

#### **4. Bounce Physics**

```javascript
basketballVelocity.y = -basketballVelocity.y * BOUNCE_DAMPING;
const frictionFactor = Math.max(0.85, 1.0 - impactSpeed * 0.02);
```

- **BOUNCE_DAMPING = 0.85** (85% energy retention)
- **Formula**: `v_y = -v_y × 0.85` (velocity reversal with energy loss)
- **Impact-based friction**: `friction = max(0.85, 1.0 - impactSpeed × 0.02)`

#### **5. Shooting Mechanics**

**Distance-Aware Angle Calculation:**

```javascript
if (horizontalDistance < 3) {
  shotAngle = Math.PI * 0.5; // 90 degrees
} else if (horizontalDistance < 8) {
  shotAngle = Math.PI * 0.4; // 72 degrees
} else {
  shotAngle = Math.PI * 0.3; // 54 degrees
}
```

**Velocity Components:**

```javascript
const horizontalVelocity = baseVelocity * Math.cos(shotAngle);
const verticalVelocity =
  baseVelocity * Math.sin(shotAngle) + SHOT_UPWARD_COMPONENT;
```

- **Formula**: `v_x = v × cos(θ)`, `v_y = v × sin(θ) + upward_component`
- **SHOT_UPWARD_COMPONENT = 8** (additional upward boost)

#### **6. Collision Detection**

**Hoop Collision (Rim):**

```javascript
const horizontalDistance = Math.sqrt(
  Math.pow(basketball.position.x - hoop.x, 2) +
    Math.pow(basketball.position.z - hoop.z, 2)
);
```

- **Formula**: `d = √[(x₂-x₁)² + (z₂-z₁)²]` (2D distance)
- **Rim radius = 0.45 units**
- **Collision threshold = ±0.2 units**

**Backboard Collision (AABB):**

```javascript
if (
  Math.abs(ballX - backboardX) < backboardWidth / 2 + BALL_RADIUS &&
  Math.abs(ballY - backboardY) < backboardHeight / 2 + BALL_RADIUS &&
  Math.abs(ballZ - backboardZ) < backboardDepth / 2 + BALL_RADIUS
) {
  // Backboard collision
}
```

- **Axis-aligned bounding box (AABB) collision**
- **Formula**: `|ball_pos - backboard_pos| < (backboard_size/2 + ball_radius)`

#### **7. Net Physics**

```javascript
basketballVelocity.multiplyScalar(NET_SLOWDOWN_FACTOR);
const currentVelocity = basketballVelocity.length();
if (currentVelocity < NET_MIN_VELOCITY) {
  const scaleFactor = NET_MIN_VELOCITY / currentVelocity;
  basketballVelocity.multiplyScalar(scaleFactor);
}
```

- **NET_SLOWDOWN_FACTOR = 0.7** (30% velocity reduction)
- **NET_MIN_VELOCITY = 3.0** (minimum velocity to prevent stopping)

#### **8. Ball Stopping Conditions**

```javascript
if (
  Math.abs(basketballVelocity.y) < BALL_STOP_VELOCITY_Y &&
  basketballVelocity.length() < BALL_STOP_VELOCITY_TOTAL
) {
  isBallInFlight = false;
}
```

- **BALL_STOP_VELOCITY_Y = 0.3** (vertical velocity threshold)
- **BALL_STOP_VELOCITY_TOTAL = 0.8** (total velocity threshold)

#### **9. Position Update**

```javascript
const positionChange = basketballVelocity.clone().multiplyScalar(deltaTime);
basketball.position.add(positionChange);
```

- **Formula**: `x = x₀ + v × Δt` (position = initial position + velocity × time)

### Physics Constants Summary

| Constant                 | Value      | Description                  |
| ------------------------ | ---------- | ---------------------------- |
| GRAVITY                  | -12.0 m/s² | Reduced gravity for gameplay |
| BOUNCE_DAMPING           | 0.85       | Energy retention on bounce   |
| FRICTION                 | 0.99       | Air resistance per frame     |
| BALL_RADIUS              | 0.25 units | Basketball size              |
| HOOP_RIM_RADIUS          | 0.45 units | Rim opening size             |
| NET_SLOWDOWN_FACTOR      | 0.7        | Net resistance               |
| BALL_STOP_VELOCITY_Y     | 0.3        | Vertical stopping threshold  |
| BALL_STOP_VELOCITY_TOTAL | 0.8        | Total stopping threshold     |

## Additional Features

### Enhanced Visual Environment

1. **Professional Basketball Court**: Complete court with proper markings

   - Three-point lines, free throw circles, center circle
   - Realistic court dimensions and proportions
   - High-quality parquet flooring textures

2. **Stadium Environment**: Immersive basketball arena

   - Bleacher seating around the court
   - Professional lighting setup with multiple light sources
   - Ambient, directional, fill, and rim lighting for dramatic effects

3. **Dynamic Scoreboard**: Real-time 3D scoreboard display
   - Live score updates with visual feedback
   - Pulsing animation when scoring
   - Shot attempts and success rate tracking

### Interactive Game Elements

1. **Dual Hoop System**: Two basketball hoops for varied gameplay

   - Left and right hoops with proper positioning
   - Independent collision detection for each hoop
   - Automatic nearest hoop targeting

2. **Visual Feedback Systems**:

   - Rim movement animation when hit
   - Net swaying effects during scoring
   - Backboard hit detection and feedback
   - Real-time game messages (SCORE, MISS, RIM, BACKBOARD)

3. **Advanced Camera Controls**: Enhanced from Exercise 5
   - Orbit camera with mouse controls
   - Multiple preset camera positions
   - Smooth zoom functionality
   - Toggle between free camera and preset views

### Realistic Basketball Physics

1. **Net Interaction**: Ball passes through net after scoring

   - Realistic net resistance and slowdown
   - Proper net movement when ball passes through
   - Time-based net passage physics

2. **Bank Shot Support**: Realistic backboard interactions

   - Front/back backboard collision detection
   - Proper bounce physics for bank shots
   - Visual feedback for backboard hits

3. **Dynamic Ball Movement**: Realistic ball behavior
   - Perfect rolling physics on court surface
   - Air rotation during shooting and bouncing
   - Impact-based bounce variations

## Known Issues and Limitations

### Physics Limitations

1. **Simplified Collision Detection**:

   - Ball-rim collisions use simplified geometric approximations
   - No complex ball deformation or compression effects
   - Limited to spherical collision detection
   - The net movement looks unrealistic, it should be more dynamic and realistic

2. **Net Physics Simplification**:

   - Net interaction is time-based rather than fully physical
   - No individual net strand collisions
   - Simplified net resistance model

3. **Air Resistance Model**:
   - Uses constant friction factor rather than velocity-dependent drag
   - No Magnus effect (spin-based trajectory changes)
   - Simplified air physics for performance

### Gameplay Limitations

1. **Shot Accuracy**:

   - Automatic aiming system may feel less challenging for experienced players
   - Limited manual aiming control
   - No wind effects or environmental factors

### Technical Limitations

1. **Performance Considerations**:

   - Physics calculations run on main thread
   - No multi-threaded physics processing
   - Limited to 60fps target frame rate

## Sources of External Assets

Textures and Materials
Parquet Flooring Textures: From the "ParquetFlooring06_MR_4K" texture set

Source: https://cgbookcase-volume.b-cdn.net/t/ParquetFlooring06_MR_4K.zip
Base Color: ParquetFlooring06_4K_BaseColor.png
Normal Map: ParquetFlooring06_4K_Normal.png
Roughness Map: ParquetFlooring06_4K_Roughness.png
Height Map: ParquetFlooring06_4K_Height.png
Source: High-quality PBR texture set for realistic wood flooring
Basketball Texture: balldimpled.png

Source: https://opengameart.org/content/basket-ball-texture
Realistic basketball texture with proper orange color and black seam lines
Used for the static basketball at center court
