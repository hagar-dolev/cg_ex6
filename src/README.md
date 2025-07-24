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