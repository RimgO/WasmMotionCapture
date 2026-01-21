import './style.css';
import * as THREE from 'three';
import { SceneManager } from './src/scene-manager.js';
import { TrackingManager } from './src/tracking.js';
import { VRMManager } from './src/vrm-manager.js';
import { CameraManager } from './src/camera.js';

import Stats from 'stats.js';

class App {
    constructor() {
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(this.stats.dom);
        this.stats.dom.style.left = 'auto';
        this.stats.dom.style.right = '24px';
        this.stats.dom.style.top = '100px';

        this.sceneManager = new SceneManager(document.getElementById('scene-container'));
        this.trackingManager = new TrackingManager();
        this.vrmManager = new VRMManager(this.sceneManager.scene);
        this.cameraManager = new CameraManager(document.getElementById('webcam'));

        this.lastTime = 0;
        this.isTracking = false;

        this.init();
    }

    async init() {
        // Show loading
        document.getElementById('loading-overlay').classList.remove('hidden');

        try {
            // Initialize Tracking
            await this.trackingManager.initialize();

            // Load Default VRM (Sample model)
            // Fixed correct URL for the three-vrm sample model
            const sampleVrmUrl = 'https://pixiv.github.io/three-vrm/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm';

            try {
                await this.vrmManager.loadVRM(sampleVrmUrl);
            } catch (vrmError) {
                console.warn('Default VRM failed to load, but continuing initialization:', vrmError);
            }

            // Hide loading
            document.getElementById('loading-overlay').classList.add('hidden');

            this.setupEventListeners();
            this.animate();
        } catch (error) {
            console.error('Initialization failed:', error);
            // Ensure overlay is hidden even on error so UI remains interactive
            document.getElementById('loading-overlay').classList.add('hidden');
            alert('Failed to initialize tracking engines: ' + error.message);
        }
    }

    setupEventListeners() {
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        const loadVrmBtn = document.getElementById('load-vrm');
        const statusDot = document.getElementById('status-tracking');
        const statusText = document.getElementById('status-text');

        startBtn.addEventListener('click', async () => {
            try {
                await this.cameraManager.start();
                this.isTracking = true;
                startBtn.classList.add('hidden');
                stopBtn.classList.remove('hidden');
                statusDot.classList.add('active');
                statusText.innerText = 'Tracking Active';
            } catch (err) {
                alert('Camera access denied');
            }
        });

        document.getElementById('calibrate-btn').addEventListener('click', () => {
            this.vrmManager.calibrate();
            this.sceneManager.controls.reset();
        });

        stopBtn.addEventListener('click', () => {
            this.cameraManager.stop();
            this.isTracking = false;
            stopBtn.classList.add('hidden');
            startBtn.classList.remove('hidden');
            statusDot.classList.remove('active');
            statusText.innerText = 'Tracking Off';
        });

        loadVrmBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.vrm';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const url = URL.createObjectURL(file);
                    document.getElementById('loading-overlay').classList.remove('hidden');
                    await this.vrmManager.loadVRM(url);
                    document.getElementById('loading-overlay').classList.add('hidden');
                }
            };
            input.click();
        });
    }

    animate(time) {
        this.stats.begin();
        requestAnimationFrame(this.animate.bind(this));

        const delta = time - this.lastTime;
        this.lastTime = time;

        if (this.isTracking) {
            const canvas = document.getElementById('tracking-canvas');
            const video = document.getElementById('webcam');

            // Adjust canvas size to match video
            if (canvas.width !== video.videoWidth) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            const trackingData = this.trackingManager.detect(video, performance.now());

            if (trackingData) {
                this.vrmManager.update(trackingData);
                this.trackingManager.drawResults(canvas, trackingData);
            }
        }

        if (this.vrmManager.currentVrm) {
            this.vrmManager.currentVrm.update(delta / 1000);
        }

        this.sceneManager.render(delta);
        this.stats.end();
    }
}

// Start the app
new App();
