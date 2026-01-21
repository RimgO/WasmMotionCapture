import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export class VRMManager {
    constructor(scene) {
        this.scene = scene;
        this.currentVrm = null;
        this.loader = new GLTFLoader();
        this.loader.register((parser) => new VRMLoaderPlugin(parser));
    }

    async loadVRM(url) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    const vrm = gltf.userData.vrm;

                    if (this.currentVrm) {
                        this.scene.remove(this.currentVrm.scene);
                        VRMUtils.deepDispose(this.currentVrm.scene);
                    }

                    this.currentVrm = vrm;
                    this.scene.add(vrm.scene);

                    // Rotate model 180 deg to face camera
                    vrm.scene.rotation.y = Math.PI;

                    resolve(vrm);
                },
                (progress) => console.log('Loading VRM...', (progress.loaded / progress.total * 100).toFixed(2), '%'),
                (error) => reject(error)
            );
        });
    }

    update(trackingData) {
        if (!this.currentVrm || !trackingData) return;

        const { face, pose, hands } = trackingData;

        // 1. Update Face Expressions
        if (face && face.faceBlendshapes && face.faceBlendshapes.length > 0) {
            this.updateFace(face.faceBlendshapes[0]);
        }

        // 2. Update Pose
        if (pose && pose.landmarks && pose.landmarks.length > 0) {
            this.updatePose(pose.landmarks[0], pose.worldLandmarks[0]);
        }

        // 3. Update Hands
        if (hands && hands.landmarks && hands.landmarks.length > 0) {
            this.updateHands(hands.landmarks, hands.handedness);
        }
    }

    updateFace(blendshapes) {
        const vrmExpression = this.currentVrm.expressionManager;
        if (!vrmExpression) return;

        // Map MediaPipe blendshapes to VRM expressions
        const categoryMap = {
            'eyeBlinkLeft': 'blinkLeft',
            'eyeBlinkRight': 'blinkRight',
            'jawOpen': 'aa',
            'mouthPucker': 'oo',
            'mouthShrugUpper': 'ee',
            'mouthSmileLeft': 'happy',
            'mouthSmileRight': 'happy'
        };

        blendshapes.categories.forEach(category => {
            const vrmKey = categoryMap[category.categoryName];
            if (vrmKey) {
                // VRM expressions are typically 0 to 1
                vrmExpression.setValue(vrmKey, category.score);
            }
        });
    }

    updatePose(landmarks, worldLandmarks) {
        const humanoid = this.currentVrm.humanoid;
        if (!humanoid) return;

        // 1. Head Rotation
        const head = humanoid.getNormalizedBoneNode('head');
        if (head && landmarks[0] && landmarks[7] && landmarks[8]) {
            const dx = landmarks[7].x - landmarks[8].x;
            const dy = landmarks[7].y - landmarks[8].y;
            const roll = Math.atan2(dy, dx);

            const leftDist = Math.abs(landmarks[0].x - landmarks[7].x);
            const rightDist = Math.abs(landmarks[0].x - landmarks[8].x);
            const yaw = (leftDist - rightDist) * 3.0;

            const earsY = (landmarks[7].y + landmarks[8].y) / 2;
            const pitch = (earsY - landmarks[0].y) * 3.0;

            head.rotation.z = roll;
            head.rotation.y = yaw;
            head.rotation.x = pitch;
        }

        // 2. Arms Tracking
        this.updateArm(humanoid, 'left', landmarks[11], landmarks[13], landmarks[15]);
        this.updateArm(humanoid, 'right', landmarks[12], landmarks[14], landmarks[16]);
    }

    updateArm(humanoid, side, shoulder, elbow, wrist) {
        const upperArm = humanoid.getNormalizedBoneNode(`${side}UpperArm`);
        const lowerArm = humanoid.getNormalizedBoneNode(`${side}LowerArm`);

        if (!upperArm || !shoulder || !elbow) return;

        // MediaPipe landmarks: Y is positive downwards
        const dxUpper = elbow.x - shoulder.x;
        const dyUpper = elbow.y - shoulder.y;
        const angleUpper = Math.atan2(dyUpper, dxUpper);

        const dxLower = wrist ? wrist.x - elbow.x : dxUpper;
        const dyLower = wrist ? wrist.y - elbow.y : dyUpper;
        const angleLower = Math.atan2(dyLower, dxLower);

        if (side === 'left') {
            // Left arm neutral in VRM is +X.
            // If movement was reversed, we change the rotation direction.
            upperArm.rotation.z = angleUpper;
            if (lowerArm) {
                lowerArm.rotation.z = angleLower - angleUpper;
            }
        } else {
            // Right arm neutral in VRM is -X.
            upperArm.rotation.z = angleUpper - Math.PI;
            if (lowerArm) {
                lowerArm.rotation.z = angleLower - angleUpper;
            }
        }
    }

    calibrate() {
        if (!this.currentVrm || !this.currentVrm.humanoid) return;

        // Reset all humanoid bone rotations
        const bones = this.currentVrm.humanoid.humanBones;
        Object.values(bones).forEach(bone => {
            if (bone.node) {
                bone.node.rotation.set(0, 0, 0);
            }
        });

        // Specific reset for head if needed
        const head = this.currentVrm.humanoid.getNormalizedBoneNode('head');
        if (head) head.rotation.set(0, 0, 0);
    }

    updateHands(landmarksList, handednessList) {
        if (!this.currentVrm || !this.currentVrm.humanoid) return;
        const humanoid = this.currentVrm.humanoid;

        landmarksList.forEach((landmarks, index) => {
            const isRightHand = handednessList[index].categoryName === 'Right'; // MediaPipe handedness is mirrored
            const side = isRightHand ? 'right' : 'left';

            // Finger mapping: Thumb, Index, Middle, Ring, Little
            const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
            const fingerJoints = ['Proximal', 'Intermediate', 'Distal'];

            fingers.forEach((finger, fIdx) => {
                fingerJoints.forEach((joint, jIdx) => {
                    const boneName = `${side}${finger}${joint}`;
                    const boneNode = humanoid.getNormalizedBoneNode(boneName);

                    if (boneNode) {
                        // MediaPipe finger landmarks start from 1 (Thumb CMC) to 20 (Little Tip)
                        // Each finger has 4 points. 
                        // Simplified: Use the angle between joints
                        const baseIdx = 1 + fIdx * 4;
                        const p1 = landmarks[baseIdx + jIdx];
                        const p2 = landmarks[baseIdx + jIdx + 1];

                        if (p1 && p2) {
                            const dx = p2.x - p1.x;
                            const dy = p2.y - p1.y;
                            const angle = Math.atan2(dy, dx);

                            // Apply rotation (simplified axis)
                            boneNode.rotation.z = angle * (isRightHand ? 1 : -1);
                        }
                    }
                });
            });
        });
    }
}
