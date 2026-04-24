<div align="center">
  
# 🛡️ SENTINEL
### Neural Fatigue Monitor v2.1

![Sentinel HUD](https://img.shields.io/badge/UI-Cyberpunk_HUD-00e5ff?style=for-the-badge)
![Tech](https://img.shields.io/badge/Tech-MediaPipe_FaceMesh-00ff88?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-ff2c55?style=for-the-badge)

A futuristic, high-performance, browser-based drowsiness detection system powered by **MediaPipe FaceMesh**.
Sentinel tracks 468 facial landmarks in real-time to monitor eye aspect ratio (EAR), head pose, and blink rate, instantly sounding an alarm if signs of sleep are detected.

</div>

## ✨ Features

- **Real-Time 3D Face Tracking:** Utilizes MediaPipe's Neural Engine to map 468 facial landmarks.
- **Instantaneous Fatigue Detection:** Calculates Eye Aspect Ratio (EAR) and head posture to identify drowsiness instantly (0.0s delay threshold capability).
- **Cyberpunk HUD Interface:** Fully responsive tactical dashboard with 3D hover effects, scanlines, and animated visualizers.
- **Audio & Visual Alarms:** Triggers a blinding red visual pulse and loud custom audio alarm (`MyMusic.mp3`) the moment sleep is detected.
- **Client-Side Processing:** 100% of the neural tracking happens locally in your browser for maximum privacy and zero latency.

## 🚀 Quick Start

1. Clone this repository.
2. Ensure you have your alarm audio named `MyMusic.mp3` in the root folder.
3. Open `index.html` in any modern web browser.
4. **Important:** Click anywhere on the dashboard to unlock the browser's autoplay policy.
5. Grant camera permissions when prompted.
6. Sentinel is now tracking! Close your eyes to test the immediate alarm system.

## ⚙️ Configuration

You can adjust detection settings directly in the right-side control panel:
- **Sleep Threshold:** Configure how long eyes must be closed before the alarm triggers (set to 0.0s for instant triggering).
- **EAR Sensitivity:** Adjust the threshold for what the neural engine considers "closed" eyes.

## 🎨 3D HUD Elements
This project utilizes modern CSS 3D transforms to create an immersive, depth-aware tactical dashboard. Hover over the side panels and the camera feed to see the UI interact with your mouse in 3D space!

---
*Stay alert. Stay alive.*
