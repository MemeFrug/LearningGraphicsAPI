import { Engine } from "./Engine.js";

// Written by Max K
console.log("main.js loaded");

const Gravity = 9.8;

const projectEngine = new Engine(document.getElementById("canvas"), true); // Instantiates on Load

const init = () => {

};

const update = () => {
    projectEngine.RenderPass();
    // requestAnimationFrame(update);
};

projectEngine.onload = update;