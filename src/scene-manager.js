import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 100);
        this.camera.position.set(0, 1.4, 3.5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0);
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.screenSpacePanning = true;
        this.controls.target.set(0, 1.4, 0);
        this.controls.update();

        this.setupLights();

        window.addEventListener('resize', this.onResize.bind(this));
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(1, 2, 3);
        this.scene.add(dirLight);

        // Add a subtle rim light for premium look
        const rimLight = new THREE.PointLight(0x4f46e5, 1, 10);
        rimLight.position.set(-2, 2, -2);
        this.scene.add(rimLight);

        // Grid Floor
        const grid = new THREE.GridHelper(10, 20, 0x4f46e5, 0x1e293b);
        grid.position.y = 0;
        grid.material.opacity = 0.2;
        grid.material.transparent = true;
        this.scene.add(grid);

        // Background
        this.scene.background = new THREE.Color(0x0d0f14);
        this.scene.fog = new THREE.Fog(0x0d0f14, 5, 15);
    }

    onResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    render(delta) {
        this.renderer.render(this.scene, this.camera);
    }
}
