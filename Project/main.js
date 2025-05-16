import { Engine, EngineElement } from "./Engine.js";
import { shaderCode } from "./shaders.js";

// Written by Max K
console.log("main.js loaded");

const Gravity = 9.8;
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
    speed = 0.1// Player speed
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
        if (player.keyboardEvents.jump) {
            player.jump()
            player.velocity[1] += (player.speed + player.velocity[1] * dt) * 0.01;
        };
        if (player.keyboardEvents.drop) {
            player.velocity[1] -= (player.speed - player.velocity[1] * dt) * 0.01;
        };
        if (player.keyboardEvents.left) {
            player.velocity[0] -= (player.speed - player.velocity[0] * dt) * 0.01 ;
        };
        if (player.keyboardEvents.right) {
            player.velocity[0] += (player.speed + player.velocity[0] * dt) * 0.01;
        };
    }
    jump = () => {
        return;
    }
}

const init = async () => {
    await projectEngine.Instantiate();

    const shaderModule = projectEngine.getShaderModule(shaderCode);
    projectEngine.ApplyCanvas(document.getElementById("canvas"), 1920, 1080);
    pipeline = projectEngine.createPipeline(shaderModule, shaderModule, [ElementVertexCoordinateLayout]); // Create the pipeline

    // Player
    player = new Player(pipeline, projectEngine.device); // Create the player object
    player.createVertexBuffer(player.vertices.data, ElementVertexCoordinateLayout, "PlayerVertices");
    const playerPositionUniformBuffer = player.createUniformBuffer(player.position, "PlayerPosition");
    player.createBindGroup(1 /* Shader Group */, [{ // Each binding in the bind group
        binding: 0, // The binding of the uniform buffer in the shader
        resource: {buffer: playerPositionUniformBuffer.buffer}
    }]); // Create the bind group for the player

    bufferUpdate.push({ // Add the player to the buffer update list
        position: player.position,
        uniformObject: playerPositionUniformBuffer
    });
    projectEngine.newElement(player); // Add the player to the engine

    //Platform
    let platform = new Platform(pipeline, projectEngine.device, 1, 1, true)
    platform.position = new Float32Array([1.0, -3.0]);

    platform.createVertexBuffer(platform.vertices.data, ElementVertexCoordinateLayout, "PlatformVertices")
    const platformPositionUniformBuffer = platform.createUniformBuffer(platform.position, "PlatformPosition");
    platform.createBindGroup(1 /* Shader Group */, [{ // Each binding in the bind group
        binding: 0, // The binding of the uniform buffer in the shader
        resource: {buffer: platformPositionUniformBuffer.buffer}
    }]); // Create the bind group for the platform
    bufferUpdate.push({ // Add the platform to the buffer update list
        position: platform.position,
        uniformObject: platformPositionUniformBuffer
    });
    projectEngine.newElement(platform); // Add the platform to the engine
    platform.init()
    requestAnimationFrame(update);
};

let lastTime = undefined
const update = (timeElapsed) => {
    const dt = timeElapsed - lastTime
    lastTime = timeElapsed
    player.update(dt); // Update player position based on keyboard events

    // player.velocity[1] += (player.velocity[1] - Gravity) * 0.0001; // Apply gravity to player position
    player.velocity[1] = Math.min(player.velocity[1], Gravity) * 0.9; // Limit player velocity
    player.position[1] += player.velocity[1]; // Update player position
    player.velocity[0] = player.velocity[0] * 0.9; // Bring it towards 0
    player.position[0] += player.velocity[0];

    //Update platform positions
    collidableObjects.forEach(platform => {
        const collision = projectEngine.checkRectangularCollision(player, platform);
        if (collision) {
            // player.velocity[1] = 0; // Reset player velocity
            projectEngine.resolveCollision(player, platform, collision);
        }
    });

    // Let the GPU know that the position of the player has changed
    bufferUpdate.forEach(buffer => {
        buffer.uniformObject.updateBuffer(buffer.position); // Update the uniform object with the new position
    });

    //Update player position
    // playerPositionUniformObject.updateBuffer(player.position); // Update the player position uniform buffer
    projectEngine.RenderPass(pipeline);

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

        default:
            break;
    };
});

window.projectEngine = projectEngine; // Expose projectEngine to the console for debugging
window.onload = init;
window.player = player; // Expose player to the console for debugging
window.Player = Player; // Expose player to the console for debugging