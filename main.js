import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const scene = new THREE.Scene();
const layers = new THREE.Object3D();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
let controls;
const gui = new GUI();
const plane = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshStandardMaterial({color:0xffffff}));
const geometry = new THREE.BoxGeometry(1, 1, 1);
const stats = new Stats();
const container = document.createElement('div');
let activeId;
let layerColors = [];

let config = {
	seed: stateToBase64(randomState()),
	x: 32,
	y: 32,
	depth: 32,
};

function randomState(size = 1024) {
	return [...Array(size)].map(_ => +(Math.random() > 0.35));
}

function stateFromBase64(s) { // functional programming :)
	return atob(s).split('').flatMap(i => i.charCodeAt(0).toString(2).padStart(8, '0').split('').map(i => parseInt(i)));
}

function stateToBase64(s) { // procedural programming :( 
	let out = [];
	for (let i = 0; i < s.length; i += 8) {
		let b = s.slice(i, i + 8).join('').padEnd(8, '0');
		out.push(String.fromCharCode(parseInt(b, 2)));
	}
	return btoa(out.join(''));
}

function next(state) {
	let size = state.length;
	
	let alive = [[0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 1, 1, 0, 0, 0, 0, 0]];

	let new_state = [...Array(size)].map((_, i) => Array(state[i].length).fill(0));
	for (let y = 0; y < size; y++) {for (let x = 0; x < state[y].length; x++) {
		let neighbours = 0;
		for (let dy = -1; dy < 2; dy++) { for (let dx = -1; dx < 2; dx++) {
			if (dy == 0 && dx == 0) {continue;}
			let y2 = (y + dy + size) % size
			let x2 = (x + dx + state[y].length) % state[y].length
			neighbours += state[y2][x2];
		}}
		new_state[y][x] = alive[state[y][x]][neighbours];
	}}
	return new_state;
}

function generate(config) {
	let rawState = stateFromBase64(config.seed);
	let flatState = Array(Math.max(config.x * config.y - rawState.length, 0)).fill(0).concat(rawState);
	let state = [];
	for (let i = 0; i < config.y; i++) {
		state.push(flatState.slice(i * config.x, (i + 1) * config.x));
	}
    let states = [state];

    for (let i = 0; i < config.depth; i++) {
        states.push(next(states[states.length - 1]));
    }

    function parse(state, z) {
        let points = [];
        for (let y = 0; y < state.length; y++) {for (let x = 0; x < state[y].length; x++) {
            if (state[y][x] == 0) {continue;} 
            points.push([y - config.y/2, z, x - config.x/2]);
        }}
        return points;
    }

    return states.map(parse);
}

function loadCubes(positions) {
	layers.clear();
	layerColors.map(clearTimeout);
	layerColors = [];

	for (let i = 0; i < positions.length; i++) {
		let layer = new THREE.Object3D();
		const material = new THREE.MeshStandardMaterial({
			color:0xff0000,
		});
		material.color.offsetHSL(-0.1 * i, 0, 0);
		function foo() {
			material.color.offsetHSL(0.02, 0, 0);
			layerColors.push(setTimeout(foo, 100));
		};
		foo();

		for (let j = 0; j < positions[i].length; j++) {
			
			const cube = new THREE.Mesh(geometry, material);
			cube.position.set(...positions[i][j]);
			cube.castShadow = true;
			cube.receiveShadow = true;
			
			layer.add(cube);				
		}
		layers.add(layer);
	}
}

function addLights() {
	let light = new THREE.PointLight(0xFFFFFF, 20.0, 0, 0.4);
    light.position.set(48, 48, 48);
    let d = 400;
    light.castShadow = true;
    light.shadow.radius = 1;
    light.shadow.camera.top = light.shadow.camera.right = d;
    light.shadow.camera.bottom = light.shadow.camera.left = -d;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 512;
	scene.add(light);
	scene.add( new THREE.AmbientLight(0xFFFFFF, 0.9));
}

function animate() {	
	activeId = requestAnimationFrame(animate);
	stats.update();
	controls.update();
	renderer.render(scene, camera);
};

function main() {
	document.getElementById("copyToClipboard").onclick = () => {
		let new_config = {...config}; // copy
		new_config.name = "Game of Life Visualiser"; // basic signature
		navigator.clipboard.writeText(JSON.stringify(new_config));
		alert("Copied to Clipboard!");
	};

	document.getElementById("pasteFromClipboard").onclick = async () => {
		// Verifying user input is always a pain 😔
		// Doing a basic signature check for now (TODO: impl full checks)
		let new_config = await navigator.clipboard.readText();
		try {
			let new_config2 = JSON.parse(new_config);
			if (new_config2.name != "Game of Life Visualiser") {throw new Error("Signature does not match.")}
			for (let i in config) {
				config[i] = new_config2[i]; // TRUST THE USER
			}
		} catch (e) {
			alert("Unable to load from clipboard.");
			throw e;
		}

		loadCubes(generate(config));
		cancelAnimationFrame(activeId);
		animate();

		alert("Pasted from Clipboard!");
	};

    document.body.appendChild(container);

	scene.background = new THREE.Color(0x87CEEB); // Sky Blue
	camera.position.set(-0, 16, 64);
	// camera.up.set(1, 0, 0);
	controls = new OrbitControls(camera, renderer.domElement);
	controls.target = new THREE.Vector3(0, 16, 0);
	
	renderer.shadowMap.enabled = true;
	// renderer.shadowMap.type = THREE.BasicShadowMap;

	container.appendChild(renderer.domElement);
	renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(stats.dom);

	plane.castShadow = false;
	plane.receiveShadow = true;
	plane.rotation.x = -Math.PI / 2;
	scene.add(plane);
	scene.add(layers);

    window.addEventListener('resize', () => {
		const width = window.innerWidth;
		const height = window.innerHeight;
	
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	
		renderer.setSize(width, height);
	});

	gui.add(config, "seed").onChange((value) => {
		config.seed = value;
		loadCubes(generate(config));
		cancelAnimationFrame(activeId);
		animate();
	}).listen();
	gui.add(config, "x", 1).onFinishChange((value) => {
		config.x = value;
		loadCubes(generate(config));
		cancelAnimationFrame(activeId);
		animate();
	}).listen();
	gui.add(config, "y", 1).onFinishChange((value) => {
		config.y = value;
		loadCubes(generate(config));
		cancelAnimationFrame(activeId);
		animate();
	}).listen();
	gui.add(config, "depth", 0).onFinishChange((value) => {
		config.depth = value;
		loadCubes(generate(config));
		cancelAnimationFrame(activeId);
		animate();
	}).listen();
	gui.open();

	loadCubes(generate(config));
	addLights();
	animate();
}

main();
