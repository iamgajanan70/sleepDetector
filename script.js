/* ============================================================
   SENTINEL — Smart Drowsiness Detection System
   Full MediaPipe FaceMesh Integration
   ============================================================ */

'use strict';

// ─── DOM REFERENCES ────────────────────────────────────────────
const videoEl = document.getElementById('videoFeed');
const canvasEl = document.getElementById('overlayCanvas');
const ctx = canvasEl.getContext('2d');
const noCamOverlay = document.getElementById('noCamOverlay');
const retryBtn = document.getElementById('retryBtn');
const alertOverlay = document.getElementById('alertOverlay');
const alertVideo = document.getElementById('alertVideo');
const systemDot = document.getElementById('systemDot');
const systemStatusText = document.getElementById('systemStatusText');
const fpsCounter = document.getElementById('fpsCounter');
const sessionTimerEl = document.getElementById('sessionTimer');
const csbDot = document.getElementById('csbDot');
const csbText = document.getElementById('csbText');
const sdRing = document.getElementById('sdRing');
const sdIcon = document.getElementById('sdIcon');
const sdLabel = document.getElementById('sdLabel');
const sdSub = document.getElementById('sdSub');
const alertLevelFill = document.getElementById('alertLevelFill');
const closedTimerEl = document.getElementById('closedTimer');
const sessionLog = document.getElementById('sessionLog');

// Metrics
const leftEarBar = document.getElementById('leftEarBar');
const rightEarBar = document.getElementById('rightEarBar');
const avgEarBar = document.getElementById('avgEarBar');
const leftEarVal = document.getElementById('leftEarVal');
const rightEarVal = document.getElementById('rightEarVal');
const avgEarVal = document.getElementById('avgEarVal');
const headTiltEl = document.getElementById('headTilt');
const headNodEl = document.getElementById('headNod');
const headTurnEl = document.getElementById('headTurn');
const gazeDirEl = document.getElementById('gazeDir');
const blinkCountEl = document.getElementById('blinkCount');
const blinkRateEl = document.getElementById('blinkRate');
const eyesClosedDurEl = document.getElementById('eyesClosedDur');
const perclosEl = document.getElementById('perclos');
const landmarkCountEl = document.getElementById('landmarkCount');
const confidenceValEl = document.getElementById('confidenceVal');

// Settings
const sleepThresholdSlider = document.getElementById('sleepThreshold');
const earSensitivitySlider = document.getElementById('earSensitivity');
const sleepThresholdVal = document.getElementById('sleepThresholdVal');
const earSensitivityVal = document.getElementById('earSensitivityVal');
const audioAlarmToggle = document.getElementById('audioAlarm');
const showMeshToggle = document.getElementById('showMesh');
const showEyesToggle = document.getElementById('showEyes');
const showBrowsToggle = document.getElementById('showBrows');
const showIrisToggle = document.getElementById('showIris');
const showLipsToggle = document.getElementById('showLips');
const showOvalToggle = document.getElementById('showOval');

// ─── STATE ─────────────────────────────────────────────────────
let SLEEP_THRESHOLD = 0; // ms
let EAR_THRESHOLD = 0.21;
let EAR_DROWSY = 0.26;

let eyesClosedStart = null;
let eyesClosedDur = 0;
let currentState = 'detecting'; // detecting | awake | drowsy | sleeping
let alertActive = false;
let blinkCount = 0;
let lastEyeState = 'open'; // open | closed
let sessionStart = Date.now();
let totalClosedMs = 0;
let totalFrames = 0;
let closedFrames = 0;

// FPS
let frameCount = 0;
let lastFPSTime = performance.now();
let currentFPS = 0;

// Audio for alarm
const alarmAudio = new Audio();
alarmAudio.src = 'MyMusic.mp3';
alarmAudio.loop = true;
alarmAudio.volume = 1.0;
alarmAudio.load();

// Unlock audio on first user interaction to bypass browser autoplay policy
const unlockAudio = () => {
  alarmAudio.play().then(() => {
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
  }).catch(() => { });
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
  document.removeEventListener('touchstart', unlockAudio);
};
document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);
document.addEventListener('touchstart', unlockAudio);

// ─── MEDIAPIPE LANDMARK INDICES ────────────────────────────────
// 6-point EAR landmarks
const LEFT_EYE_EAR = [362, 385, 387, 263, 373, 380]; // p1..p6
const RIGHT_EYE_EAR = [33, 160, 158, 133, 153, 144];

// Full eye contours for drawing
const LEFT_EYE_CONTOUR = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263];
const RIGHT_EYE_CONTOUR = [133, 173, 157, 158, 159, 160, 161, 246, 33, 7, 163, 144, 145, 153, 154, 155, 133];

// Iris
const LEFT_IRIS = [474, 475, 476, 477];
const RIGHT_IRIS = [469, 470, 471, 472];

// Eyebrows
const LEFT_BROW = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336];
const RIGHT_BROW = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107];

// Nose bridge
const NOSE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175];

// Lips
const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];
const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

// Face oval
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];

// Key structural points
const NOSE_TIP = 1;
const CHIN = 152;
const LEFT_EAR_PT = 234;
const RIGHT_EAR_PT = 454;
const FOREHEAD = 10;
const LEFT_CHEEK = 116;
const RIGHT_CHEEK = 345;

// ─── UTILITY: Distance ─────────────────────────────────────────
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── EAR CALCULATION ───────────────────────────────────────────
// Eye Aspect Ratio = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
function calcEAR(lm, indices) {
  const [i1, i2, i3, i4, i5, i6] = indices;
  const p1 = lm[i1], p2 = lm[i2], p3 = lm[i3];
  const p4 = lm[i4], p5 = lm[i5], p6 = lm[i6];
  const vertical = dist(p2, p6) + dist(p3, p5);
  const horizontal = dist(p1, p4) * 2;
  return horizontal > 0 ? vertical / horizontal : 0;
}

// ─── HEAD POSE ESTIMATION ──────────────────────────────────────
function calcHeadPose(lm) {
  const nose = lm[NOSE_TIP];
  const chin = lm[CHIN];
  const lEar = lm[LEFT_EAR_PT];
  const rEar = lm[RIGHT_EAR_PT];
  const forehead = lm[FOREHEAD];

  // Tilt: angle of ear-to-ear line vs horizontal
  const tiltRad = Math.atan2(lEar.y - rEar.y, lEar.x - rEar.x);
  const tiltDeg = Math.round(tiltRad * (180 / Math.PI));

  // Nod: nose position relative to forehead-chin midpoint
  const midY = (forehead.y + chin.y) / 2;
  let nodState = 'CENTER';
  if (nose.y < midY - 0.05) nodState = 'UP';
  else if (nose.y > midY + 0.05) nodState = 'DOWN';

  // Turn: nose offset from ear midpoint
  const earMidX = (lEar.x + rEar.x) / 2;
  const turnRaw = (nose.x - earMidX) / ((rEar.x - lEar.x) || 0.01);
  const turnDeg = Math.round(turnRaw * 60);

  // Gaze direction (based on nose offset from center of face)
  let gazeDir = 'FORWARD';
  if (Math.abs(turnDeg) > 20) gazeDir = turnDeg > 0 ? 'LEFT' : 'RIGHT';
  if (nodState !== 'CENTER') gazeDir = nodState;

  return { tiltDeg, nodState, turnDeg, gazeDir };
}

// ─── CANVAS DRAWING ────────────────────────────────────────────
function scalePoint(p, w, h) {
  return { x: p.x * w, y: p.y * h };
}

function drawPolyline(landmarks, indices, w, h, color, lineWidth = 1, close = false) {
  if (!indices || indices.length < 2) return;
  ctx.beginPath();
  const first = scalePoint(landmarks[indices[0]], w, h);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < indices.length; i++) {
    const p = scalePoint(landmarks[indices[i]], w, h);
    ctx.lineTo(p.x, p.y);
  }
  if (close) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawDot(x, y, radius, color, glow = false) {
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawMeshTesselation(landmarks, w, h, alpha) {
  // Draw a subset of mesh triangulation lines for wireframe look
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 0.4;

  // Draw landmark dots
  for (let i = 0; i < landmarks.length; i++) {
    const p = scalePoint(landmarks[i], w, h);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,229,255,0.4)';
    ctx.fill();
  }
  ctx.restore();
}

function drawConnections(landmarks, connectionList, w, h, color, lw) {
  if (!connectionList) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 1;
  for (const [a, b] of connectionList) {
    if (!landmarks[a] || !landmarks[b]) continue;
    const pA = scalePoint(landmarks[a], w, h);
    const pB = scalePoint(landmarks[b], w, h);
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();
  }
}

// Build edge pairs for oval, eyes, etc.
function contourEdges(arr) {
  const edges = [];
  for (let i = 0; i < arr.length - 1; i++) edges.push([arr[i], arr[i + 1]]);
  return edges;
}

function drawEyeHighlight(landmarks, indices, w, h, color, state) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = state === 'closed' ? 4 : 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const first = scalePoint(landmarks[indices[0]], w, h);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < indices.length; i++) {
    const p = scalePoint(landmarks[indices[i]], w, h);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();

  // Fill semi-transparent
  ctx.globalAlpha = state === 'closed' ? 0.15 : 0.05;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawIris(landmarks, indices, w, h, color) {
  if (indices.length < 4) return;
  const pts = indices.map(i => scalePoint(landmarks[i], w, h));
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const r = dist(pts[0], { x: cx, y: cy });

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner dot
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBrow(landmarks, indices, w, h, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const first = scalePoint(landmarks[indices[0]], w, h);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < indices.length; i++) {
    const p = scalePoint(landmarks[indices[i]], w, h);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFaceOval(landmarks, w, h, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  const first = scalePoint(landmarks[FACE_OVAL[0]], w, h);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < FACE_OVAL.length; i++) {
    const p = scalePoint(landmarks[FACE_OVAL[i]], w, h);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawLips(landmarks, w, h, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  // outer
  ctx.beginPath();
  const first = scalePoint(landmarks[LIPS_OUTER[0]], w, h);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < LIPS_OUTER.length; i++) {
    const p = scalePoint(landmarks[LIPS_OUTER[i]], w, h);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function renderOverlay(landmarks, w, h, earL, earR) {
  ctx.clearRect(0, 0, w, h);

  const eyeState = ((earL + earR) / 2) < EAR_THRESHOLD ? 'closed' : 'open';
  const drowsy = ((earL + earR) / 2) < EAR_DROWSY && eyeState !== 'closed';

  // Choose colors based on state
  const meshColor = currentState === 'sleeping' ? 'rgba(255,44,85,0.3)'
    : currentState === 'drowsy' ? 'rgba(255,214,10,0.2)'
      : 'rgba(0,229,255,0.15)';
  const eyeColor = eyeState === 'closed' ? '#ff2c55'
    : drowsy ? '#ffd60a'
      : '#00e5ff';
  const browColor = '#00ff88';
  const ovalColor = currentState === 'sleeping' ? 'rgba(255,44,85,0.5)'
    : currentState === 'drowsy' ? 'rgba(255,214,10,0.5)'
      : 'rgba(0,229,255,0.35)';

  // 1. Face mesh tessellation
  if (showMeshToggle.checked) {
    drawMeshTesselation(landmarks, w, h, 0.4);
  }

  // 2. Face oval
  if (showOvalToggle.checked) {
    drawFaceOval(landmarks, w, h, ovalColor);
  }

  // 3. Lips
  if (showLipsToggle.checked) {
    drawLips(landmarks, w, h, 'rgba(0,229,255,0.5)');
  }

  // 4. Eyebrows
  if (showBrowsToggle.checked) {
    drawBrow(landmarks, LEFT_BROW, w, h, browColor);
    drawBrow(landmarks, RIGHT_BROW, w, h, browColor);
  }

  // 5. Eyes
  if (showEyesToggle.checked) {
    drawEyeHighlight(landmarks, LEFT_EYE_CONTOUR, w, h, eyeColor, eyeState);
    drawEyeHighlight(landmarks, RIGHT_EYE_CONTOUR, w, h, eyeColor, eyeState);
  }

  // 6. Iris
  if (showIrisToggle.checked) {
    drawIris(landmarks, LEFT_IRIS, w, h, eyeState === 'closed' ? '#ff2c55' : '#00ffff');
    drawIris(landmarks, RIGHT_IRIS, w, h, eyeState === 'closed' ? '#ff2c55' : '#00ffff');
  }

  // 7. EAR reference lines (vertical distances)
  drawEARLines(landmarks, w, h, earL, earR, eyeColor);

  // 8. Nose bridge line
  ctx.save();
  ctx.strokeStyle = 'rgba(0,229,255,0.3)';
  ctx.lineWidth = 1;
  drawPolyline(landmarks, NOSE, w, h, 'rgba(0,229,255,0.3)', 0.8);
  ctx.restore();

  // 9. Head pose indicator
  drawHeadPoseIndicator(landmarks, w, h);
}

function drawEARLines(landmarks, w, h, earL, earR, color) {
  // Show vertical measurement lines for EAR on each eye
  ctx.save();
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7;

  // Left eye vertical
  const lTop = scalePoint(landmarks[LEFT_EYE_EAR[1]], w, h);
  const lBot = scalePoint(landmarks[LEFT_EYE_EAR[5]], w, h);
  ctx.beginPath();
  ctx.moveTo(lTop.x, lTop.y);
  ctx.lineTo(lBot.x, lBot.y);
  ctx.stroke();

  // Right eye vertical
  const rTop = scalePoint(landmarks[RIGHT_EYE_EAR[1]], w, h);
  const rBot = scalePoint(landmarks[RIGHT_EYE_EAR[5]], w, h);
  ctx.beginPath();
  ctx.moveTo(rTop.x, rTop.y);
  ctx.lineTo(rBot.x, rBot.y);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

function drawHeadPoseIndicator(landmarks, w, h) {
  const nose = scalePoint(landmarks[NOSE_TIP], w, h);
  const chin = scalePoint(landmarks[CHIN], w, h);
  const lEar = scalePoint(landmarks[LEFT_EAR_PT], w, h);
  const rEar = scalePoint(landmarks[RIGHT_EAR_PT], w, h);

  // Center axis line nose -> chin
  ctx.save();
  ctx.strokeStyle = 'rgba(0,255,136,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y - 30);
  ctx.lineTo(chin.x, chin.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Ear-to-ear line
  ctx.strokeStyle = 'rgba(0,229,255,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(lEar.x, lEar.y);
  ctx.lineTo(rEar.x, rEar.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Nose tip dot
  drawDot(nose.x, nose.y, 3, '#00ff88', true);
}

// ─── AUDIO ALARM ───────────────────────────────────────────────
function startAudioAlarm() {
  if (!audioAlarmToggle.checked) return;

  // Play MyMusic.mp3 loudly and immediately
  alarmAudio.currentTime = 0;
  alarmAudio.play().catch(err => console.error("Audio play failed:", err));
}

function stopAudioAlarm() {
  alarmAudio.pause();
  alarmAudio.currentTime = 0;
}

// ─── ALERT SYSTEM ──────────────────────────────────────────────
function triggerAlert() {
  if (alertActive) return;
  alertActive = true;
  alertOverlay.classList.remove('hidden');

  // Try playing alert.mp4
  if (alertVideo.src && alertVideo.src !== window.location.href) {
    alertVideo.muted = false;
    alertVideo.play().catch(() => { });
  }

  startAudioAlarm();
  addLog('⚠ SLEEPING DETECTED — ALERT TRIGGERED', 'danger');
}

function dismissAlert() {
  if (!alertActive) return;
  alertActive = false;
  alertOverlay.classList.add('hidden');
  alertVideo.pause();
  alertVideo.currentTime = 0;
  stopAudioAlarm();
  addLog('✓ ALERT DISMISSED — MONITORING RESUMED', 'ok');
}

// ─── STATUS UPDATES ────────────────────────────────────────────
function setState(newState) {
  if (currentState === newState) return;
  const prev = currentState;
  currentState = newState;

  document.body.className = `state-${newState}`;

  const configs = {
    awake: {
      icon: '◎', label: 'AWAKE', sub: 'ALL SYSTEMS NORMAL',
      ring: '', cam: 'TRACKING ACTIVE'
    },
    drowsy: {
      icon: '◑', label: 'DROWSY', sub: 'WARNING — STAY ALERT',
      ring: 'drowsy', cam: 'DROWSINESS DETECTED'
    },
    sleeping: {
      icon: '●', label: 'SLEEPING', sub: 'ALERT TRIGGERED',
      ring: 'sleeping', cam: 'SLEEPING DETECTED'
    },
    detecting: {
      icon: '◌', label: 'DETECTING', sub: 'INITIALIZING...',
      ring: '', cam: 'DETECTING FACE...'
    }
  };

  const cfg = configs[newState] || configs.detecting;
  sdIcon.textContent = cfg.icon;
  sdLabel.textContent = cfg.label;
  sdSub.textContent = cfg.sub;
  csbText.textContent = cfg.cam;
  sdRing.className = 'sd-ring ' + cfg.ring;

  if (newState !== prev) {
    if (newState === 'sleeping') triggerAlert();
    else if (prev === 'sleeping') dismissAlert();
    if (newState !== 'detecting') addLog(`[ ${cfg.label} ] ${cfg.sub}`, newState === 'awake' ? 'ok' : newState === 'drowsy' ? 'warn' : 'danger');
  }
}

function updateAlertBar(ear) {
  // Normalize EAR to 0-100% alert level (inverted: lower EAR = higher alert)
  const normalized = Math.max(0, Math.min(1, (EAR_DROWSY - ear) / (EAR_DROWSY - 0.1)));
  alertLevelFill.style.width = (normalized * 100) + '%';
}

// ─── SETTINGS LISTENERS ────────────────────────────────────────
sleepThresholdSlider.addEventListener('input', () => {
  SLEEP_THRESHOLD = parseFloat(sleepThresholdSlider.value) * 1000;
  sleepThresholdVal.textContent = parseFloat(sleepThresholdSlider.value).toFixed(1) + 's';
});
earSensitivitySlider.addEventListener('input', () => {
  EAR_THRESHOLD = parseFloat(earSensitivitySlider.value);
  EAR_DROWSY = EAR_THRESHOLD + 0.05;
  earSensitivityVal.textContent = EAR_THRESHOLD.toFixed(2);
});

// Click overlay to dismiss
alertOverlay.addEventListener('click', dismissAlert);

// ─── SESSION LOG ───────────────────────────────────────────────
function addLog(msg, type = '') {
  const now = new Date();
  const ts = now.toTimeString().slice(0, 8);
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${ts}] ${msg}`;
  sessionLog.appendChild(entry);
  sessionLog.scrollTop = sessionLog.scrollHeight;
  // Keep log to last 50
  while (sessionLog.children.length > 50) sessionLog.removeChild(sessionLog.firstChild);
}

// ─── SESSION TIMER ─────────────────────────────────────────────
function updateSessionTimer() {
  const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  sessionTimerEl.textContent = `${mm}:${ss}`;
}

// ─── PERCLOS ───────────────────────────────────────────────────
// % of time eyes are closed over a 60-second window
const perclosWindow = [];
function updatePerclos(closed) {
  const now = Date.now();
  perclosWindow.push({ t: now, closed });
  // Remove entries older than 60s
  const cutoff = now - 60000;
  while (perclosWindow.length && perclosWindow[0].t < cutoff) perclosWindow.shift();
  const closedCount = perclosWindow.filter(e => e.closed).length;
  const pct = perclosWindow.length > 0 ? Math.round((closedCount / perclosWindow.length) * 100) : 0;
  perclosEl.textContent = pct + '%';
  return pct;
}

// ─── MAIN RESULTS CALLBACK ─────────────────────────────────────
function onResults(results) {
  const w = canvasEl.width;
  const h = canvasEl.height;

  // FPS
  frameCount++;
  totalFrames++;
  const now = performance.now();
  if (now - lastFPSTime >= 1000) {
    currentFPS = Math.round(frameCount * 1000 / (now - lastFPSTime));
    fpsCounter.textContent = currentFPS;
    frameCount = 0;
    lastFPSTime = now;

    // Blink rate per minute
    const sessionMin = (Date.now() - sessionStart) / 60000;
    blinkRateEl.textContent = sessionMin > 0 ? Math.round(blinkCount / sessionMin) : '--';
  }

  updateSessionTimer();

  ctx.clearRect(0, 0, w, h);

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    // No face detected
    setState('detecting');
    leftEarVal.textContent = '0.000';
    rightEarVal.textContent = '0.000';
    avgEarVal.textContent = '0.000';
    leftEarBar.style.width = '0%';
    rightEarBar.style.width = '0%';
    avgEarBar.style.width = '0%';
    headTiltEl.textContent = '--';
    headNodEl.textContent = '--';
    headTurnEl.textContent = '--';
    gazeDirEl.textContent = '--';
    closedTimerEl.textContent = 'NO FACE';
    closedTimerEl.className = 'closed-timer';
    landmarkCountEl.textContent = 'LANDMARKS: 0';
    confidenceValEl.textContent = 'CONFIDENCE: --';
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  landmarkCountEl.textContent = `LANDMARKS: ${landmarks.length}`;
  confidenceValEl.textContent = `CONFIDENCE: HIGH`;

  // ── EAR Calculation ──
  const earL = calcEAR(landmarks, LEFT_EYE_EAR);
  const earR = calcEAR(landmarks, RIGHT_EYE_EAR);
  const earAvg = (earL + earR) / 2;

  // Update EAR displays
  leftEarVal.textContent = earL.toFixed(3);
  rightEarVal.textContent = earR.toFixed(3);
  avgEarVal.textContent = earAvg.toFixed(3);

  const earToPercent = (e) => Math.min(100, Math.max(0, (e / 0.4) * 100));
  leftEarBar.style.width = earToPercent(earL) + '%';
  rightEarBar.style.width = earToPercent(earR) + '%';
  avgEarBar.style.width = earToPercent(earAvg) + '%';

  // Color the bars
  const earColor = earAvg < EAR_THRESHOLD ? '#ff2c55' : earAvg < EAR_DROWSY ? '#ffd60a' : '#00e5ff';
  leftEarBar.style.background = `linear-gradient(90deg, rgba(0,0,0,0.3), ${earColor})`;
  leftEarBar.style.boxShadow = `0 0 6px ${earColor}`;
  rightEarBar.style.background = `linear-gradient(90deg, rgba(0,0,0,0.3), ${earColor})`;
  rightEarBar.style.boxShadow = `0 0 6px ${earColor}`;

  // ── Head pose ──
  const pose = calcHeadPose(landmarks);
  headTiltEl.textContent = pose.tiltDeg + '°';
  headNodEl.textContent = pose.nodState;
  headTurnEl.textContent = pose.turnDeg + '°';
  gazeDirEl.textContent = pose.gazeDir;

  // ── Eye state / blink detection ──
  const eyesClosed = earAvg < EAR_THRESHOLD;
  closedFrames += eyesClosed ? 1 : 0;
  updatePerclos(eyesClosed);

  if (eyesClosed) {
    if (!eyesClosedStart) eyesClosedStart = Date.now();
    eyesClosedDur = Date.now() - eyesClosedStart;
    totalClosedMs += 16; // approx per frame
  } else {
    // Detect blink (eyes just opened)
    if (eyesClosedStart && eyesClosedDur < 50) { // quick close = blink
      blinkCount++;
      blinkCountEl.textContent = blinkCount;
    }
    eyesClosedStart = null;
    eyesClosedDur = 0;
  }

  eyesClosedDurEl.textContent = (eyesClosedDur / 1000).toFixed(1) + 's';

  // ── Update closed-timer display ──
  if (eyesClosed && eyesClosedDur > 0) {
    const sec = (eyesClosedDur / 1000).toFixed(1);
    closedTimerEl.textContent = `CLOSED ${sec}s`;
    if (eyesClosedDur > SLEEP_THRESHOLD * 0.6) {
      closedTimerEl.className = 'closed-timer danger';
    } else {
      closedTimerEl.className = 'closed-timer warning';
    }
  } else {
    closedTimerEl.textContent = 'EYES OPEN';
    closedTimerEl.className = 'closed-timer';
  }

  // ── State machine ──
  if (eyesClosed && eyesClosedDur > SLEEP_THRESHOLD) {
    setState('sleeping');
  } else if (eyesClosed && eyesClosedDur > SLEEP_THRESHOLD * 0.4) {
    setState('drowsy');
  } else if (earAvg < EAR_DROWSY && !eyesClosed) {
    setState('drowsy');
  } else if (!eyesClosed) {
    setState('awake');
    if (alertActive) dismissAlert();
  }

  // ── Alert bar ──
  updateAlertBar(earAvg);

  // ── Render overlay ──
  renderOverlay(landmarks, w, h, earL, earR);
}

// ─── FACEMESH SETUP ────────────────────────────────────────────
let faceMeshInstance = null;
let cameraInstance = null;

async function initFaceMesh() {
  updateSystemStatus('LOADING NEURAL ENGINE...', false);

  const faceMeshObj = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  faceMeshObj.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,     // enables iris landmarks
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });

  faceMeshObj.onResults(onResults);
  faceMeshInstance = faceMeshObj;

  updateSystemStatus('AWAITING CAMERA PERMISSION...', false);
  await startCamera();
}

// ─── CAMERA ────────────────────────────────────────────────────
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    });

    videoEl.srcObject = stream;
    noCamOverlay.classList.add('hidden');

    videoEl.onloadedmetadata = () => {
      canvasEl.width = videoEl.videoWidth || 640;
      canvasEl.height = videoEl.videoHeight || 480;
      updateSystemStatus('SYSTEM ONLINE', true);
      addLog('✓ CAMERA INITIALIZED — FACE TRACKING ACTIVE', 'ok');

      // Use MediaPipe Camera util for the frame loop
      cameraInstance = new Camera(videoEl, {
        onFrame: async () => {
          if (faceMeshInstance) {
            await faceMeshInstance.send({ image: videoEl });
          }
        },
        width: 640,
        height: 480
      });
      cameraInstance.start();
    };

  } catch (err) {
    console.error('Camera error:', err);
    noCamOverlay.classList.remove('hidden');
    updateSystemStatus('CAMERA DENIED', false);
    addLog('✗ CAMERA ACCESS DENIED — GRANT PERMISSION', 'danger');
  }
}

function updateSystemStatus(msg, online) {
  systemStatusText.textContent = msg;
  if (online) {
    systemDot.classList.add('online');
  } else {
    systemDot.classList.remove('online');
  }
}

// Retry button
retryBtn.addEventListener('click', () => {
  startCamera();
});

// ─── VISUAL FOOT BARS ANIMATION ────────────────────────────────
// Animate footer bars based on FPS
setInterval(() => {
  const bars = document.querySelectorAll('.fb');
  bars.forEach(b => {
    const h = 4 + Math.random() * 12;
    b.style.height = h + 'px';
    b.style.opacity = 0.4 + Math.random() * 0.6;
  });
}, 200);

// ─── BOOT SEQUENCE ─────────────────────────────────────────────
async function boot() {
  addLog('[ SENTINEL v2.1 ] NEURAL FATIGUE MONITOR STARTING...', 'init');
  addLog('Loading MediaPipe FaceMesh engine...', 'init');

  // Slight delay for dramatic boot effect
  await new Promise(r => setTimeout(r, 400));

  // Check MediaPipe availability
  if (typeof FaceMesh === 'undefined') {
    addLog('✗ MediaPipe not loaded — retrying...', 'warn');
    updateSystemStatus('LOADING MEDIAPIPE...', false);

    // Poll until available
    let retries = 0;
    while (typeof FaceMesh === 'undefined' && retries < 20) {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }
    if (typeof FaceMesh === 'undefined') {
      addLog('✗ FATAL: MediaPipe failed to load. Check internet connection.', 'danger');
      updateSystemStatus('MEDIAPIPE LOAD FAILED', false);
      return;
    }
  }

  addLog('✓ MediaPipe FaceMesh ready (468 landmarks)', 'ok');
  await initFaceMesh();
}

// ─── CANVAS RESIZE ─────────────────────────────────────────────
function handleResize() {
  const wrapper = document.querySelector('.camera-wrapper');
  const rect = wrapper.getBoundingClientRect();
  if (videoEl.videoWidth) {
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
  }
}

window.addEventListener('resize', handleResize);

// ─── KEYBOARD SHORTCUT: ESC to dismiss alert ───────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && alertActive) dismissAlert();
  if (e.key === ' ') {
    // Space: toggle mesh
    showMeshToggle.checked = !showMeshToggle.checked;
  }
});

// ─── INIT ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', boot);
