"use strict";

    const video = document.getElementById("camera");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const stage = document.getElementById("stage");
    const welcome = document.getElementById("welcome");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const statusEl = document.getElementById("status");
    const hint = document.getElementById("hint");
    const song = document.getElementById("song");

    const strokes = [];
    let currentStroke = [];
    let particles = [];
    let camera = null;
    let hands = null;
    let cameraOn = false;
    let paused = false;
    let drawing = false;
    let waitForFreshDrawGesture = false;
    let pointerDrawing = false;
    let lastPoint = null;
    let lastGesture = "";
    let gestureCount = 0;
    let lastMagic = 0;
    let musicEnabled = false;
    let songUrl = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let recording = false;
    let recordCanvas = null;
    let recordCtx = null;
    let recordStream = null;
    let recordAnimation = null;
    let recordStartedAt = 0;
    let nameOverlayUntil = 0;
    let nameOverlayText = "";
    let lastNameOverlayStart = 0;

    const palettes = {
      garden: ["#ffb4d5", "#c4a5ff", "#b4efc4", "#ffe59a"],
      rose: ["#ff477e", "#ff8fb8", "#ffd0e1", "#d89bff"],
      rainbow: ["#ff7aaf", "#ffc66e", "#9ce8bb", "#8adcf4", "#c6a2ff"],
      violet: ["#e2b4ff", "#ba91ff", "#f6b5d8", "#a8c9ff"],
      galaxy: ["#ff8fce", "#c49aff", "#8de7ff", "#fff1a8"],
      butterfly: ["#ff9ed5", "#d0a6ff", "#a8e9d1", "#ffe5a3"]
    };
    document.getElementById("undoBtn").addEventListener("click", undoLastStroke);
    document.getElementById("clearBtn").addEventListener("click", clearCanvas);

    function undoLastStroke() {
      if (strokes.length > 0) {
        strokes.pop();
        redrawCanvas();
      }
    }

    function clearCanvas() {
      strokes.length = 0;
      redrawCanvas();
    }


    function currentPalette() {
      return palettes[document.getElementById("style").value] || palettes.garden;
    }

    function namesText() {
      const a = document.getElementById("nameOne").value.trim() || "You";
      const b = document.getElementById("nameTwo").value.trim() || "Me";
      return `${a} ♡ ${b}`;
    }

    function updateNames() {
      document.getElementById("coupleNames").textContent = namesText();
    }
    document.getElementById("nameOne").addEventListener("input", updateNames);
    document.getElementById("nameTwo").addEventListener("input", updateNames);

    function resizeCanvas() {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }

    function flower(x, y, size, color, rotation = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * i) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -size * 0.52, size * 0.30, size * 0.56, 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "#fff0a8";
      ctx.fill();
      ctx.restore();
    }

    function heart(x, y, size, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 18, size / 18);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.bezierCurveTo(-18, -4, -10, -15, 0, -7);
      ctx.bezierCurveTo(10, -15, 18, -4, 0, 7);
      ctx.fill();
      ctx.restore();
    }

    function drawPoint(point) {
      const palette = currentPalette();
      const color = palette[point.seed % palette.length];

      // No plain connecting line: the trail is made from flowers and hearts.
      flower(point.x, point.y, point.size, color, point.rotation || 0);

      if (point.heart) {
        heart(
          point.x + Math.cos(point.rotation || 0) * 5,
          point.y - 3,
          point.size + 3,
          palette[(point.seed + 1) % palette.length]
        );
      }

      if (point.sparkle) {
        ctx.save();
        ctx.font = `${point.size + 8}px serif`;
        ctx.fillStyle = "#fff4c7";
        ctx.shadowColor = "#fff4c7";
        ctx.shadowBlur = 12;
        ctx.fillText("✦", point.x - 4, point.y - 5);
        ctx.restore();
      }

      if (point.butterfly) {
        ctx.save();
        ctx.font = "15px serif";
        ctx.fillText("🦋", point.x + 3, point.y - 6);
        ctx.restore();
      }
    }

    function drawStroke(points) {
      for (const point of points) drawPoint(point);
    }

    function drawNames(targetCtx, width, height) {
      const text = namesText();
      const fontSize = Math.max(18, Math.min(30, width * 0.035));

      targetCtx.save();
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "middle";
      targetCtx.font = `bold ${fontSize}px Georgia, serif`;
      targetCtx.shadowColor = "#ff8fcf";
      targetCtx.shadowBlur = 18;
      targetCtx.lineWidth = 3;
      targetCtx.strokeStyle = "#482d50";
      targetCtx.fillStyle = "#fff0fa";
      targetCtx.strokeText(text, width / 2, 36);
      targetCtx.fillText(text, width / 2, 36);
      targetCtx.font = `${fontSize * 0.7}px serif`;
      targetCtx.fillStyle = "#ff8fcf";
      targetCtx.fillText("♥", width / 2, 63);
      targetCtx.restore();
    }

    function redraw() {
      ctx.clearRect(0, 0, stage.clientWidth, stage.clientHeight);
      for (const stroke of strokes) drawStroke(stroke);
      if (currentStroke.length) drawStroke(currentStroke);
      for (const p of particles) drawParticle(p);

      if (performance.now() < nameOverlayUntil) {
        drawNames(ctx, stage.clientWidth, stage.clientHeight);
      }
    }

    function addFlowerPoint(x, y) {
      const palette = currentPalette();
      const power = Number(document.getElementById("intensity").value) / 100;

      currentStroke.push({
        x, y,
        seed: Math.floor(Math.random() * palette.length),
        size: 4.5 + Math.random() * (3 + power * 2),
        heart: Math.random() < 0.48,
        sparkle: Math.random() < 0.22,
        butterfly: Math.random() < 0.035,
        rotation: Math.random() * Math.PI * 2
      });

      if (currentStroke.length > 1200) currentStroke.shift();
      drawPoint(currentStroke[currentStroke.length - 1]);
    }



    function addPoint(x, y) {
      const spacing = Math.max(
        4,
        8 - (Number(document.getElementById("intensity").value) / 100) * 3
      );

      if (!lastPoint) {
        addFlowerPoint(x, y);
        lastPoint = { x, y };
        return;
      }

      const distance = Math.hypot(
        x - lastPoint.x,
        y - lastPoint.y
      );

      const steps = Math.max(1, Math.ceil(distance / spacing));

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;

        addFlowerPoint(
          lastPoint.x + (x - lastPoint.x) * t,
          lastPoint.y + (y - lastPoint.y) * t
        );
      }

      lastPoint = { x, y };
    }



    function startDrawing() {
      if (drawing || paused) return;

      drawing = true;
      currentStroke = [];
      lastPoint = null;

      nameOverlayText = namesText();
      nameOverlayUntil = performance.now() + 5000;
      lastNameOverlayStart = performance.now();

      hint.textContent = "🌸 Your love is blooming...";
      playSong();
    }

    function finishStroke() {
      if (currentStroke.length) {
        strokes.push(currentStroke);
        currentStroke = [];
      }

      lastPoint = null;
      drawing = false;
      pauseSong();
      redraw();
    }

    function spawnParticle(x, y, emoji) {
      const emojis = ["💕", "💖", "🌸", "✨", "🦋", "💗", "💞"];
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 2,
        vy: -0.5 - Math.random() * 2,
        life: 80 + Math.random() * 60,
        maxLife: 140,
        size: 14 + Math.random() * 10,
        emoji: emoji || emojis[Math.floor(Math.random() * emojis.length)]
      });
    }

    function drawParticle(p) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / 25);
      ctx.font = `${p.size}px serif`;
      ctx.fillText(p.emoji, p.x, p.y);
      ctx.restore();
    }

    function loveShower() {
      const emojis = ["💗", "💖", "💕", "🌸", "🦋", "✨", "💞"];
      for (let i = 0; i < 40; i++) {
        spawnParticle(
          Math.random() * stage.clientWidth,
          stage.clientHeight + Math.random() * 50,
          emojis[Math.floor(Math.random() * emojis.length)]
        );
      }
    }

    function burst() {
      for (let i = 0; i < 30; i++) {
        spawnParticle(
          Math.random() * stage.clientWidth,
          Math.random() * stage.clientHeight
        );
      }
    }


    function animate() {
      const now = performance.now();
      const showNames = now < nameOverlayUntil;

      // Avoid redrawing all artwork when nothing is moving.
      if (particles.length > 0 || showNames) {
        ctx.clearRect(0, 0, stage.clientWidth, stage.clientHeight);

        for (const stroke of strokes) {
          drawStroke(stroke);
        }

        if (currentStroke.length) {
          drawStroke(currentStroke);
        }

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];

          p.x += p.vx;
          p.y += p.vy;
          p.life--;

          drawParticle(p);

          if (p.life <= 0) {
            particles.splice(i, 1);
          }
        }

        if (showNames) {
          drawNames(ctx, stage.clientWidth, stage.clientHeight);
        }
      }

      requestAnimationFrame(animate);
    }


    /* Music controls */
    function playSong() {
      if (!musicEnabled || !song.src) return;
      song.play().catch(() => {
        document.getElementById("recordStatus").textContent =
          "Click Enable music again if your browser blocked playback.";
      });
    }

    function pauseSong() {
      song.pause();
    }

    document.getElementById("songFile").addEventListener("change", event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      if (songUrl) URL.revokeObjectURL(songUrl);
      songUrl = URL.createObjectURL(file);
      song.src = songUrl;
      song.load();

      document.getElementById("recordStatus").textContent =
        `Selected song: ${file.name}. Click Enable music to allow playback.`;
    });

    document.getElementById("musicBtn").addEventListener("click", async () => {
      if (!song.src) {
        document.getElementById("songFile").click();
        document.getElementById("recordStatus").textContent =
          "Choose a song file, then click Enable music.";
        return;
      }

      musicEnabled = true;
      try {
        await song.play();
        document.getElementById("musicBtn").textContent = "♫ Music enabled";
        if (!drawing) song.pause();
      } catch (error) {
        document.getElementById("recordStatus").textContent =
          "Music could not start. Choose an audio file and click Enable music again.";
      }
    });

    /* Hand tracking */
    function fingerUp(lm, tip, pip) {
      // A little tolerance helps reduce jitter from hand tracking.
      return lm[tip].y < lm[pip].y - 0.01;
    }


    function fingerIsUp(lm, tip, joint) {
      return lm[tip].y < lm[joint].y - 0.015;
    }


    function recognizeGesture(lm) {
      const index = fingerUp(lm, 8, 6);
      const middle = fingerUp(lm, 12, 10);
      const ring = fingerUp(lm, 16, 14);
      const pinky = fingerUp(lm, 20, 18);

      // Closed fist pauses drawing.
      if (!index && !middle && !ring && !pinky) {
        return "fist";
      }

      // Only the index finger should draw.
      if (index && !middle) {
        return "draw";
      }

      return "other";
    }





    function handleGesture(gesture, lm) {
      if (gesture === lastGesture) {
        gestureCount++;
      } else {
        lastGesture = gesture;
        gestureCount = 1;
      }

      const now = performance.now();

      // Two fingers: trigger love effects WITHOUT stopping the drawing.
      if (gesture !== "draw") {
        waitForFreshDrawGesture = false;
      }
      // Draw with the index finger.
      if (gesture === "draw") {
        if (waitForFreshDrawGesture) return;
        if (paused) {
          paused = false;
          pauseBtn.textContent = "Ⅱ Pause drawing";
        }

        startDrawing();

        const x = (1 - lm[8].x) * stage.clientWidth;
        const y = lm[8].y * stage.clientHeight;

        addPoint(x, y);
        hint.textContent = "🌸 Your love is blooming...";
        return;
      }

      // A stable fist pauses drawing.
      if (gesture === "fist") {
        if (gestureCount >= 3 && !paused) {
          finishStroke();
          paused = true;
          pauseBtn.textContent = "▶ Resume drawing";
          hint.textContent = "✊ Drawing paused.";
        }
        return;
      }

      // Only finish the stroke after another gesture is detected steadily.
      if (gestureCount >= 4 && drawing) {
        finishStroke();
      }

      if (gestureCount >= 4) {
        hint.textContent = "☝️ Raise your index finger to draw.";
      }
    }



    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          alert("Camera access requires localhost or HTTPS.");
          return;
        }

        if (!window.Hands || !window.Camera) {
          alert("Hand tracking did not load. Check your internet and refresh.");
          return;
        }

        startBtn.disabled = true;
        startBtn.textContent = "Opening camera...";

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24, max: 30 }
          },
          audio: false
        });

        video.srcObject = stream;
        await video.play();

        hands = new Hands({
          locateFile: file =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55
        });

        hands.onResults(results => {
          if (!cameraOn) return;
          const lm = results.multiHandLandmarks?.[0];

          if (lm) {
            statusEl.textContent = "Hand detected";
            handleGesture(recognizeGesture(lm), lm);
          } else {
            statusEl.textContent = "Show your hand to the camera";
            if (drawing) finishStroke();
            lastGesture = "";
            gestureCount = 0;
          }
        });

        camera = new Camera(video, {
          onFrame: async () => {
            if (hands && cameraOn) await hands.send({ image: video });
          },
          width: 640,
          height: 480
        });

        cameraOn = true;
        await camera.start();

        welcome.classList.add("hidden");
        video.style.opacity = "0.4";
        statusEl.textContent = "Camera is on";
        startBtn.disabled = false;
        stopBtn.disabled = false;
        pauseBtn.disabled = false;
        startBtn.textContent = "Start our love garden 💕";
      } catch (error) {
        console.error(error);
        cameraOn = false;

        if (video.srcObject) {
          video.srcObject.getTracks().forEach(track => track.stop());
          video.srcObject = null;
        }

        startBtn.disabled = false;
        startBtn.textContent = "Try camera again 💕";
        statusEl.textContent = "Camera permission needed";
        alert("Camera could not start. Allow camera access and try again.");
      }
    }

    async function stopCamera() {
      if (recording) await stopRecording();

      cameraOn = false;
      if (camera?.stop) camera.stop();

      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }

      if (hands) {
        await hands.close();
        hands = null;
      }

      finishStroke();
      video.style.opacity = "0";
      welcome.classList.remove("hidden");
      statusEl.textContent = "Camera is off";
      startBtn.disabled = false;
      stopBtn.disabled = true;
      pauseBtn.disabled = true;
      startBtn.textContent = "Start our love garden 💕";
    }

    startBtn.addEventListener("click", startCamera);
    stopBtn.addEventListener("click", stopCamera);


    pauseBtn.addEventListener("click", () => {
      if (paused) {
        paused = false;
        pauseBtn.textContent = "Ⅱ Pause drawing";
        hint.textContent = "🌸 Drawing resumed! Raise your index finger.";
      } else {
        finishStroke();
        paused = true;
        pauseBtn.textContent = "▶ Resume drawing";
        hint.textContent = "✊ Drawing and music paused.";
      }
    });


    document.getElementById("undoBtn").addEventListener("click", () => {
      finishStroke();
      strokes.pop();
      redraw();
    });

    /* Save PNG, with names even after the live overlay disappears */
    document.getElementById("saveBtn").addEventListener("click", () => {
      finishStroke();

      const width = stage.clientWidth;
      const height = stage.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = Math.round(width * dpr);
      exportCanvas.height = Math.round(height * dpr);

      const exportCtx = exportCanvas.getContext("2d");
      exportCtx.scale(dpr, dpr);

      // Transparent drawing on a dark background for a beautiful saved image.
      exportCtx.fillStyle = "#241a30";
      exportCtx.fillRect(0, 0, width, height);

      // Draw the artwork without changing the live canvas.
      for (const stroke of strokes) {
        for (const p of stroke) {
          const palette = currentPalette();
          const color = palette[p.seed % palette.length];
          exportCtx.save();
          exportCtx.translate(p.x, p.y);
          exportCtx.rotate(p.rotation || 0);
          exportCtx.shadowColor = color;
          exportCtx.shadowBlur = 8;

          for (let i = 0; i < 5; i++) {
            exportCtx.save();
            exportCtx.rotate(i * Math.PI * 2 / 5);
            exportCtx.beginPath();
            exportCtx.ellipse(0, -p.size * .52, p.size * .3, p.size * .56, 0, 0, Math.PI * 2);
            exportCtx.fillStyle = color;
            exportCtx.fill();
            exportCtx.restore();
          }

          exportCtx.beginPath();
          exportCtx.arc(0, 0, p.size * .25, 0, Math.PI * 2);
          exportCtx.fillStyle = "#fff0a8";
          exportCtx.fill();
          exportCtx.restore();

          if (p.heart) {
            exportCtx.save();
            exportCtx.translate(p.x + 3, p.y - 3);
            exportCtx.scale((p.size + 3) / 18, (p.size + 3) / 18);
            exportCtx.fillStyle = palette[(p.seed + 1) % palette.length];
            exportCtx.beginPath();
            exportCtx.moveTo(0, 7);
            exportCtx.bezierCurveTo(-18, -4, -10, -15, 0, -7);
            exportCtx.bezierCurveTo(10, -15, 18, -4, 0, 7);
            exportCtx.fill();
            exportCtx.restore();
          }

          if (p.sparkle) {
            exportCtx.font = `${p.size + 8}px serif`;
            exportCtx.fillStyle = "#fff4c7";
            exportCtx.fillText("✦", p.x - 4, p.y - 5);
          }
          if (p.butterfly) {
            exportCtx.font = "15px serif";
            exportCtx.fillText("🦋", p.x + 3, p.y - 6);
          }
        }
      }

      drawNames(exportCtx, width, height);

      const a = document.getElementById("nameOne").value.trim() || "You";
      const b = document.getElementById("nameTwo").value.trim() || "Me";
      const link = document.createElement("a");
      link.download = `Love-${a}-${b}.png`.replace(/[\\/:*?"<>|]/g, "-");
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    });

    /* Mouse/touch fallback when camera is off */
    function pointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    canvas.addEventListener("pointerdown", event => {
      if (cameraOn || paused) return;
      pointerDrawing = true;
      canvas.setPointerCapture(event.pointerId);
      startDrawing();
      const p = pointerPosition(event);
      addPoint(p.x, p.y);
    });

    canvas.addEventListener("pointermove", event => {
      if (!pointerDrawing || cameraOn || paused) return;
      const p = pointerPosition(event);
      addPoint(p.x, p.y);
    });

    function endPointerDrawing() {
      if (!pointerDrawing) return;
      pointerDrawing = false;
      finishStroke();
    }

    canvas.addEventListener("pointerup", endPointerDrawing);
    canvas.addEventListener("pointercancel", endPointerDrawing);

    /* Video recording: webcam + canvas + optional song audio */
    function drawRecordingFrame() {
      if (!recording || !recordCtx || !recordCanvas) return;

      const width = stage.clientWidth;
      const height = stage.clientHeight;
      const dpr = recordCanvas.width / width;

      recordCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      recordCtx.fillStyle = "#241a30";
      recordCtx.fillRect(0, 0, width, height);

      if (video.readyState >= 2 && cameraOn) {
        recordCtx.save();
        recordCtx.translate(width, 0);
        recordCtx.scale(-1, 1);
        recordCtx.drawImage(video, 0, 0, width, height);
        recordCtx.restore();
      }

      // Overlay the complete flower drawing on the webcam image.
      recordCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);

      // Keep names in the saved video, even after they disappear from the live view.
      drawNames(recordCtx, width, height);

      // Small recording timestamp.
      const seconds = Math.floor((performance.now() - recordStartedAt) / 1000);
      recordCtx.save();
      recordCtx.fillStyle = "#ffffff";
      recordCtx.font = "bold 12px Arial";
      recordCtx.fillText(
        `♥ ${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`,
        15,
        height - 18
      );
      recordCtx.restore();

      recordAnimation = requestAnimationFrame(drawRecordingFrame);
    }

    async function startRecording() {
      if (!cameraOn) {
        alert("Start the camera before recording.");
        return;
      }

      if (!canvas.captureStream || !window.MediaRecorder) {
        alert("Your browser does not support canvas video recording. Try the latest Chrome or Edge.");
        return;
      }

      try {
        finishStroke();

        const width = stage.clientWidth;
        const height = stage.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        recordCanvas = document.createElement("canvas");
        recordCanvas.width = Math.round(width * dpr);
        recordCanvas.height = Math.round(height * dpr);
        recordCtx = recordCanvas.getContext("2d");

        const videoStream = recordCanvas.captureStream(30);
        const tracks = [...videoStream.getVideoTracks()];

        // Capture music audio when supported by the browser.
        if (song.src && typeof song.captureStream === "function") {
          const audioStream = song.captureStream();
          tracks.push(...audioStream.getAudioTracks());
        } else if (song.src && typeof song.mozCaptureStream === "function") {
          const audioStream = song.mozCaptureStream();
          tracks.push(...audioStream.getAudioTracks());
        }

        recordStream = new MediaStream(tracks);
        recordedChunks = [];

        let options = {};
        if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
          options.mimeType = "video/webm;codecs=vp9,opus";
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
          options.mimeType = "video/webm;codecs=vp8,opus";
        } else if (MediaRecorder.isTypeSupported("video/webm")) {
          options.mimeType = "video/webm";
        }

        mediaRecorder = new MediaRecorder(recordStream, options);

        mediaRecorder.ondataavailable = event => {
          if (event.data && event.data.size > 0) recordedChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const mimeType = mediaRecorder.mimeType || "video/webm";
          const blob = new Blob(recordedChunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const one = document.getElementById("nameOne").value.trim() || "You";
          const two = document.getElementById("nameTwo").value.trim() || "Me";
          a.href = url;
          a.download = `Love-Memory-${one}-${two}.webm`.replace(/[\\/:*?"<>|]/g, "-");
          document.body.appendChild(a);
          a.click();
          a.remove();

          setTimeout(() => URL.revokeObjectURL(url), 60000);
          document.getElementById("recordStatus").textContent =
            "Your love video has been saved. Check your Downloads folder.";
        };

        recording = true;
        recordStartedAt = performance.now();
        mediaRecorder.start(1000);
        drawRecordingFrame();

        document.getElementById("recordBtn").disabled = true;
        document.getElementById("stopRecordBtn").disabled = false;
        document.getElementById("recordStatus").textContent =
          "● Recording your camera, drawings, names, and music where supported...";
        document.getElementById("recordStatus").classList.add("recording");
      } catch (error) {
        console.error(error);
        recording = false;
        alert("Could not start recording. Try a current version of Chrome or Edge.");
      }
    }

    async function stopRecording() {
      if (!recording) return;

      recording = false;
      if (recordAnimation) cancelAnimationFrame(recordAnimation);
      recordAnimation = null;

      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }

      if (recordStream) {
        recordStream.getTracks().forEach(track => track.stop());
      }

      document.getElementById("recordBtn").disabled = false;
      document.getElementById("stopRecordBtn").disabled = true;
      document.getElementById("recordStatus").classList.remove("recording");
      document.getElementById("recordStatus").textContent = "Preparing your video download...";
    }

    document.getElementById("recordBtn").addEventListener("click", startRecording);
    document.getElementById("stopRecordBtn").addEventListener("click", stopRecording);

    document.getElementById("style").addEventListener("change", redraw);
    window.addEventListener("resize", resizeCanvas);

    window.addEventListener("beforeunload", () => {
      if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
      if (songUrl) URL.revokeObjectURL(songUrl);
    });

    resizeCanvas();
    animate();

    document.getElementById("undoBtn").addEventListener("click", () => {
      if (typeof finishStroke === "function") {
        finishStroke();
      }

      if (typeof undoLastStroke === "function") {
        undoLastStroke();
      } else {
        alert("Undo function is missing. Please add the undo function.");
      }
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
      if (typeof finishStroke === "function") {
        finishStroke();
      }

      if (typeof clearCanvas === "function") {
        clearCanvas();
      } else {
        alert("Clear function is missing. Please add the clear function.");
      }
    });