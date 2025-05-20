import { Engine, EngineElement } from "./Engine.js";
import { shaderCode } from "./shaders.js";

// Written by Max K
console.log("main.js loaded");

//UI Elements
const FPSElement = document.getElementById("fps-text");
const PlayerYVelocityElement = document.getElementById("player-vy-text");
const PlayerXVelocityElement = document.getElementById("player-vx-text");

const Gravity = -0.1;
const projectEngine = new Engine(); // Instantiates on Load

let pipeline = null; // Pipeline for the player

const collidableObjects = [];

const bufferUpdate = [];

const ElementVertexCoordinateLayout = {
  arrayStride: 8,
  attributes: [{
      format: "float32x2",
      offset: 0,
      shaderLocation: 0 // Position, see vertex shader
    }]
};

class Platform extends EngineElement {
    constructor(pipeline, device, width, height, collidable) {
        super(pipeline, device);
        this.position = new Float32Array([0.0, 0.0]);
        this.width = width;
        this.height = height;
        this.vertices = {
            data: new Float32Array([
                //X,    Y,
                -width, -height, // Triangle 1 (Blue)
                width, -height,
                width, height,

                -width, -height, // Triangle 2 (Red)
                width, height,
                -width, height,
            ]),

        };

        this.uniformObject = null;
        this.static = true; // Static object
        this.collidable = collidable;
    }

    init = () => {
        if (this.collidable) {
            collidableObjects.push(this);
        }
    }
}

let player = null; // Player object
class Player extends EngineElement {
    constructor(pipeline, device) {
        super(pipeline, device);
        this.position = new Float32Array([0.0, 0.0]);
        this.velocity = new Float32Array([0.0, 0.0]);
    }
    canJump = false; // Can jump
    jumpHeight = 0.007; // Jump height
    speed = 0.055; // Player speed
    vertices = {
        data: new Float32Array([
            //X,    Y,
            -0.3, -0.5, // Triangle 1
            0.3, -0.5,
            0.3, 0.5,

            -0.3, -0.5, // Triangle 2
            0.3, 0.5,
            -0.3, 0.5,
        ])
    }
    keyboardEvents = {
        jump: false,
        drop: false,
        left: false,
        right: false,
    }
    update = (dt) => {
        if (!this.canJump) { this.speed = 0.045; } // Slow down when jumping
        else { this.speed = 0.06; } // Reset speed when not jumping

        if (player.keyboardEvents.jump) {
            player.jump(dt)
        };
        if (player.keyboardEvents.drop) {
            player.velocity[1] -= (player.speed * dt - player.velocity[1] ) * 0.01;
        };
        if (player.keyboardEvents.left) {
            player.velocity[0] -= (player.speed * dt - player.velocity[0] ) * 0.01 ;
        };
        if (player.keyboardEvents.right) {
            player.velocity[0] += (player.speed * dt - player.velocity[0] ) * 0.01;
        };
    }
    jump = (dt) => {
        if (player.canJump) {
            player.velocity[1] = player.jumpHeight * dt;
            player.canJump = false; // Reset jump
        }
        return;
    }
}

class Camera extends EngineElement {
    constructor(pipeline, device) {
        super(pipeline, device);
        this.position = new Float32Array([0.0, 0.0]);
    }
}


function createPlatform(pipeline, position = new Float32Array([1.0, -3.0]), width, height, collidable) {
    //Platforms
    let platform = new Platform(pipeline, projectEngine.device, width, height, collidable)
    platform.position = new Float32Array([position[0], position[1]]);

    platform.createVertexBuffer(platform.vertices.data, ElementVertexCoordinateLayout, "PlatformVertices")
    const platformPositionUniformBuffer = platform.createUniformBuffer(platform.position, "PlatformPosition");
    const platformBindGroup = platform.createBindGroup(1 /* Shader Group */, [{ // Each binding in the bind group
        binding: 0, // The binding of the uniform buffer in the shader
        resource: {buffer: platformPositionUniformBuffer.buffer}
    }]); // Create the bind group for the platform
    platform.bindGroups.push(platformBindGroup); // Add the bind group to the platform
    bufferUpdate.push({ // Add the platform to the buffer update list
        position: platform.position,
        uniformObject: platformPositionUniformBuffer
    });
    projectEngine.newElement(platform); // Add the platform to the engine
    platform.init();
}
    
let camera = null; // Camera object

const init = async () => {
    await projectEngine.Instantiate();

    const shaderModule = projectEngine.getShaderModule(shaderCode);
    projectEngine.ApplyCanvas(document.getElementById("canvas"), 1920, 1080);
    pipeline = projectEngine.createPipeline(shaderModule, shaderModule, [ElementVertexCoordinateLayout]); // Create the pipeline

    // Camera
    camera = new Camera(pipeline, projectEngine.device); // Create the camera object
    const cameraUniformBuffer = camera.createUniformBuffer(camera.position, "CameraPosition");
    const cameraBindGroup = camera.createBindGroup(0 /* Shader Group */, [{ // Each binding in the bind group
        binding: 0, // The binding of the uniform buffer in the shader
        resource: {buffer: cameraUniformBuffer.buffer}
    }]); // Create the bind group for the camera
    camera.bindGroups.push(cameraBindGroup); // Add the bind group to the camera
    projectEngine.cameraElement = camera; // Set the camera element in the engine

    bufferUpdate.push({ // Add the camera to the buffer update list
        position: camera.position,
        uniformObject: cameraUniformBuffer
    });

    // Player
    player = new Player(pipeline, projectEngine.device); // Create the player object
    player.position = new Float32Array([-4, -2.0]); // Set the player position
    player.createVertexBuffer(player.vertices.data, ElementVertexCoordinateLayout, "PlayerVertices");
    const playerPositionUniformBuffer = player.createUniformBuffer(player.position, "PlayerPosition");
    const playerBindGroup = player.createBindGroup(1 /* Shader Group */, [{ // Each binding in the bind group
        binding: 0, // The binding of the uniform buffer in the shader
        resource: {buffer: playerPositionUniformBuffer.buffer}
    }]); // Create the bind group for the player
    player.bindGroups.push(playerBindGroup); // Add the bind group to the player
    bufferUpdate.push({ // Add the player to the buffer update list
        position: player.position,
        uniformObject: playerPositionUniformBuffer
    });
    projectEngine.newElement(player); // Add the player to the engine

    //Platforms
    createPlatform(pipeline, [-4, -4], 1, 1, true);
    createPlatform(pipeline, [-0.5, -3.2], 1, 1, true);
    createPlatform(pipeline, [2, -3.4], 0.5, 0.5, true);
    createPlatform(pipeline, [5, -4.4], 2, 0.5, true);

    requestAnimationFrame(update);
};

let lastTime = 0;
const update = (timeElapsed) => {
    const dt = timeElapsed - lastTime
    lastTime = timeElapsed
    //If the dt is too high and not undefined, skip the frame
    if (dt > 60 || !dt) {
        console.error("dt is too high or undefined, skipping frame");
        requestAnimationFrame(update);
        return;
    }

    if (player.position[1] < -10) {
        player.position[0] = -4;
        player.position[1] = -2.0; // Reset player position
    }

    player.update(dt); // Update player position based on keyboard events

    player.velocity[1] += Gravity * dt * 0.002; // Apply gravity to player position
    player.velocity[1] = Math.max(-0.2, player.velocity[1]); // Limit the velocity to a minimum of 0.2
    player.position[1] += player.velocity[1]; // Update player position
    player.velocity[0] = player.velocity[0] * dt * 0.0515; // Bring it towards 0
    player.position[0] += player.velocity[0];

    //Update platform positions
    collidableObjects.forEach(platform => {
        const collision = projectEngine.checkRectangularCollision(player, platform);
        if (collision) {
            if (collision.axis === "y") {
                player.velocity[1] = 0; // Reset player velocity
                player.canJump = true;
            }
            projectEngine.resolveCollision(player, platform, collision);
        }
    });

    // Update Camera Position
    camera.position[0] += ((-player.position[0] - 2) - camera.position[0]) * 0.07; // Set the camera position to the player position
    camera.position[1] += ((-player.position[1]/3) - camera.position[1]) * 0.2; // Set the camera position to the player position

    //Update UI
    FPSElement.textContent = Math.round(1000/dt);
    PlayerXVelocityElement.textContent = Math.round(player.velocity[0]*1000);
    PlayerYVelocityElement.textContent = Math.round(player.velocity[1]*1000);

    // Let the GPU know that the position of the player has changed
    bufferUpdate.forEach(buffer => {
        buffer.uniformObject.updateBuffer(buffer.position); // Update the uniform object with the new position
    });

    //Update player position
    // playerPositionUniformObject.updateBuffer(player.position); // Update the player position uniform buffer
    projectEngine.RenderPass(pipeline, camera);

    requestAnimationFrame(update);
};

//Listen for keyboard events
window.addEventListener("keydown", (event) => {
    switch (event.code) {
        case "KeyW":
            player.keyboardEvents.jump = true;
            break;
        case "KeyS":
            player.keyboardEvents.drop = true;
            break;
        case "Space":
            player.keyboardEvents.jump = true;
            break;
        case "KeyA":
            player.keyboardEvents.left = true;
            break;
        case "KeyD":
            player.keyboardEvents.right = true;
            break;
        case "ArrowLeft":
            player.keyboardEvents.left = true;
            break;
        case "ArrowRight":
            player.keyboardEvents.right = true;
            break;
        case "ArrowUp":
            player.keyboardEvents.jump = true;
            break;
        case "ArrowDown":
            player.keyboardEvents.drop = true;
            break;

        default:
            break;
    };
});
window.addEventListener("keyup", (event) => {
    switch (event.code) {
        case "KeyW":
            player.keyboardEvents.jump = false;
            break;
        case "Space":
            player.keyboardEvents.jump = false;
            break;
        case "KeyS":
            player.keyboardEvents.drop = false;
            break;
        case "KeyA":
            player.keyboardEvents.left = false;
            break;
        case "KeyD":
            player.keyboardEvents.right = false;
            break;
        case "ArrowLeft":
            player.keyboardEvents.left = false;
            break;
        case "ArrowRight":
            player.keyboardEvents.right = false;
            break;
        case "ArrowUp":
            player.keyboardEvents.jump = false;
            break;
        case "ArrowDown":
            player.keyboardEvents.drop = false;
            break;

        default:
            break;
    };
});

window.projectEngine = projectEngine; // Expose projectEngine to the console for debugging
window.onload = init;
window.player = player; // Expose player to the console for debugging
window.Player = Player; // Expose player to the console for debugging