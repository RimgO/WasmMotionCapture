import {
    FilesetResolver,
    FaceLandmarker,
    PoseLandmarker,
    HandLandmarker
} from "@mediapipe/tasks-vision";

export class TrackingManager {
    constructor() {
        this.faceLandmarker = null;
        this.poseLandmarker = null;
        this.handLandmarker = null;
        this.isReady = false;
    }

    async initialize() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // Load Face Landmarker
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                delegate: "GPU"
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1
        });

        // Load Pose Landmarker
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: 1
        });

        // Load Hand Landmarker
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2
        });

        this.isReady = true;
    }

    detect(videoElement, timestamp) {
        if (!this.isReady) return null;

        const faceResult = this.faceLandmarker.detectForVideo(videoElement, timestamp);
        const poseResult = this.poseLandmarker.detectForVideo(videoElement, timestamp);
        const handResult = this.handLandmarker.detectForVideo(videoElement, timestamp);

        return {
            face: faceResult,
            pose: poseResult,
            hands: handResult
        };
    }

    drawResults(canvas, trackingData) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!trackingData) return;

        // Draw Pose
        if (trackingData.pose && trackingData.pose.landmarks) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 2;
            trackingData.pose.landmarks.forEach(landmarks => {
                landmarks.forEach(lm => {
                    ctx.beginPath();
                    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2, 0, 2 * Math.PI);
                    ctx.fillStyle = '#4f46e5';
                    ctx.fill();
                });
            });
        }

        // Draw Hands
        if (trackingData.hands && trackingData.hands.landmarks) {
            ctx.strokeStyle = '#10b981';
            trackingData.hands.landmarks.forEach(landmarks => {
                landmarks.forEach(lm => {
                    ctx.beginPath();
                    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2, 0, 2 * Math.PI);
                    ctx.fillStyle = '#10b981';
                    ctx.fill();
                });
            });
        }
    }
}
