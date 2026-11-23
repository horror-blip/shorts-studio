const photoInput = document.querySelector("#photo-files");
const soundInput = document.querySelector("#sound-file");
const photoList = document.querySelector("#photo-list");
const emptyPhotos = document.querySelector("#empty-photos");
const photoCount = document.querySelector("#photo-count");
const soundName = document.querySelector("#sound-name");
const photoDropZone = document.querySelector("#photo-drop-zone");
const canvas = document.querySelector("#video-canvas");
const context = canvas.getContext("2d");
const placeholder = document.querySelector("#preview-placeholder");
const secondsInput = document.querySelector("#seconds");
const zoomInput = document.querySelector("#zoom");
const volumeInput = document.querySelector("#volume");
const audioFadeInput = document.querySelector("#audio-fade");
const crossfadeInput = document.querySelector("#crossfade");
const platformInput = document.querySelector("#platform");
const secondsValue = document.querySelector("#seconds-value");
const zoomValue = document.querySelector("#zoom-value");
const volumeValue = document.querySelector("#volume-value");
const durationLabel = document.querySelector("#duration");
const makeButton = document.querySelector("#make-video");
const downloadResult = document.querySelector("#download-result");
const downloadLink = document.querySelector("#download-link");
const shareButton = document.querySelector("#share-video");
const status = document.querySelector("#status");

let photos = [];
let soundUrl = null;
let exportInProgress = false;
let resultUrl = null;
let resultFile = null;

function photoSeconds(photo) {
  return Number(photo.duration) || Number(secondsInput.value);
}

function videoTimeline() {
  return photos.map(photo => ({
    photo,
    durationMs: photoSeconds(photo) * 1000
  }));
}

function videoDuration() {
  return photos.reduce((total, photo) => total + photoSeconds(photo), 0);
}

function isAppleMobileDevice() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isMobileDevice() {
  return isAppleMobileDevice() || /Android/.test(navigator.userAgent);
}

function updateSettings() {
  secondsValue.value = `${secondsInput.value} sec`;
  zoomValue.value = `${zoomInput.value}%`;
  volumeValue.value = `${volumeInput.value}%`;
  const displayedDuration = Number(videoDuration().toFixed(1));
  durationLabel.textContent = photos.length
    ? `About ${displayedDuration} seconds · ${photos.length} photo${photos.length === 1 ? "" : "s"}`
    : "Add photos to see video length";
  makeButton.disabled = photos.length === 0 || exportInProgress;
  makeButton.textContent = exportInProgress ? "Making your video…" : "Make video";
  photoInput.disabled = exportInProgress;
  soundInput.disabled = exportInProgress;
  platformInput.disabled = exportInProgress;
  secondsInput.disabled = exportInProgress;
  zoomInput.disabled = exportInProgress;
  volumeInput.disabled = exportInProgress;
  audioFadeInput.disabled = exportInProgress;
  crossfadeInput.disabled = exportInProgress;
}

function drawCover(image, zoom, opacity = 1) {
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  context.save();
  context.globalAlpha = opacity;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  context.restore();
}

function paintCover(image, zoom) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawCover(image, zoom);
}

function updatePreview() {
  placeholder.hidden = photos.length > 0;
  if (!photos.length) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  paintCover(photos[0].image, 1 + Number(zoomInput.value) / 100);
}

function renderPhotos() {
  photoList.replaceChildren();
  photos.forEach((photo, index) => {
    const item = document.createElement("li");
    item.className = "photo-item";

    const thumbnail = document.createElement("img");
    thumbnail.src = photo.url;
    thumbnail.alt = "";

    const name = document.createElement("span");
    name.className = "photo-name";
    name.textContent = photo.file.name;
    name.title = photo.file.name;

    const durationControl = document.createElement("label");
    durationControl.className = "photo-duration-control";
    const durationText = document.createElement("span");
    durationText.textContent = "Seconds on screen";
    const duration = document.createElement("input");
    duration.type = "number";
    duration.min = "2";
    duration.max = "10";
    duration.step = "0.1";
    duration.value = String(photoSeconds(photo));
    duration.setAttribute("aria-label", `Seconds on screen for ${photo.file.name}`);
    duration.disabled = exportInProgress;
    duration.addEventListener("input", () => {
      const value = Number(duration.value);
      if (!Number.isFinite(value) || value < 2 || value > 10) return;
      photo.duration = value;
      updateSettings();
    });
    duration.addEventListener("change", () => {
      const value = duration.value === "" ? Number(secondsInput.value) : Number(duration.value);
      photo.duration = Number.isFinite(value) ? Math.min(10, Math.max(2, value)) : Number(secondsInput.value);
      duration.value = String(photo.duration);
      updateSettings();
    });
    durationControl.append(durationText, duration);

    const up = document.createElement("button");
    up.className = "small-button";
    up.type = "button";
    up.textContent = "↑";
    up.setAttribute("aria-label", `Move ${photo.file.name} up`);
    up.disabled = exportInProgress || index === 0;
    up.addEventListener("click", () => movePhoto(index, -1));

    const down = document.createElement("button");
    down.className = "small-button";
    down.type = "button";
    down.textContent = "↓";
    down.setAttribute("aria-label", `Move ${photo.file.name} down`);
    down.disabled = exportInProgress || index === photos.length - 1;
    down.addEventListener("click", () => movePhoto(index, 1));

    const remove = document.createElement("button");
    remove.className = "small-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${photo.file.name}`);
    remove.disabled = exportInProgress;
    remove.addEventListener("click", () => removePhoto(index));

    item.append(thumbnail, name, up, down, remove, durationControl);
    photoList.append(item);
  });

  emptyPhotos.hidden = photos.length > 0;
  photoCount.textContent = `${photos.length} photo${photos.length === 1 ? "" : "s"}`;
  updatePreview();
  updateSettings();
}

function movePhoto(index, offset) {
  const destination = index + offset;
  if (destination < 0 || destination >= photos.length) return;
  [photos[index], photos[destination]] = [photos[destination], photos[index]];
  renderPhotos();
}

function removePhoto(index) {
  URL.revokeObjectURL(photos[index].url);
  photos.splice(index, 1);
  renderPhotos();
}

async function addPhotos(files) {
  const selected = files.filter(file => file.type.startsWith("image/"));
  if (!selected.length) {
    if (files.length) status.textContent = "Choose image files to add photos to your video.";
    return;
  }

  status.textContent = "Loading photos…";
  let failedCount = 0;
  for (const file of selected) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      photos.push({ file, image, url, duration: Number(secondsInput.value) });
    } catch (error) {
      URL.revokeObjectURL(url);
      failedCount += 1;
      continue;
    }
  }
  renderPhotos();
  if (!photos.length) {
    status.textContent = "No photos could be loaded. Please choose JPG, PNG, or WebP images.";
  } else if (failedCount) {
    status.textContent = `${failedCount} photo${failedCount === 1 ? "" : "s"} could not be loaded. The other photos are ready.`;
  } else {
    status.textContent = "Photos are ready. Add music if you want, then make your video.";
  }
}

photoInput.addEventListener("change", async () => {
  const selected = Array.from(photoInput.files || []);
  photoInput.value = "";
  await addPhotos(selected);
});

photoDropZone.addEventListener("dragover", event => {
  event.preventDefault();
  photoDropZone.classList.add("is-dragging");
});

photoDropZone.addEventListener("dragleave", event => {
  if (!photoDropZone.contains(event.relatedTarget)) photoDropZone.classList.remove("is-dragging");
});

photoDropZone.addEventListener("drop", async event => {
  event.preventDefault();
  photoDropZone.classList.remove("is-dragging");
  await addPhotos(Array.from(event.dataTransfer.files || []));
});

soundInput.addEventListener("change", () => {
  const file = soundInput.files && soundInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    status.textContent = "Choose an audio file such as MP3, WAV, or M4A.";
    soundInput.value = "";
    return;
  }
  if (soundUrl) URL.revokeObjectURL(soundUrl);
  soundUrl = URL.createObjectURL(file);
  soundName.textContent = file.name;
  status.textContent = "Sound is ready. It will loop if it is shorter than your video.";
});

secondsInput.addEventListener("input", () => {
  photos.forEach(photo => {
    photo.duration = Number(secondsInput.value);
  });
  renderPhotos();
});

for (const input of [zoomInput, volumeInput]) {
  input.addEventListener("input", () => {
    updateSettings();
    updatePreview();
  });
}

function supportedMimeType() {
  if (!window.MediaRecorder) return "";
  const mp4Candidates = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    "video/mp4"
  ];
  const webmCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  const candidates = isAppleMobileDevice()
    ? [...mp4Candidates, ...webmCandidates]
    : [...webmCandidates, ...mp4Candidates];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function canShareVideo(file) {
  if (!file || !navigator.canShare || !navigator.share) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function downloadBlob(blob, mimeType, platform) {
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const filename = `photos-${platform}.${extension}`;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = URL.createObjectURL(blob);
  resultFile = typeof File === "undefined" ? null : new File([blob], filename, { type: blob.type || mimeType });
  downloadLink.href = resultUrl;
  downloadLink.download = filename;
  downloadResult.hidden = false;
  shareButton.hidden = !isMobileDevice() || !canShareVideo(resultFile);
}

async function makeVideo() {
  if (!photos.length || exportInProgress) return;
  if (!canvas.captureStream || !window.MediaRecorder) {
    status.textContent = "Video export is not supported in this browser. Try the latest Chrome or Edge.";
    return;
  }

  const platform = platformInput.value === "tiktok" ? "tiktok" : "youtube-shorts";
  exportInProgress = true;
  renderPhotos();
  makeButton.textContent = "Making your video…";
  status.textContent = `Keep this page open while your ${platform === "tiktok" ? "TikTok" : "YouTube Shorts"} video is being made.`;

  let audioContext = null;
  let audioElement = null;
  let audioGain = null;
  let stream = null;
  let animationFrame = 0;
  let renderError = null;

  try {
    const mimeType = supportedMimeType();
    if (!mimeType) throw new Error("This browser does not support a video format this editor can export.");

    const timeline = videoTimeline();
    const timelineStarts = [];
    let durationMs = 0;
    timeline.forEach(segment => {
      timelineStarts.push(durationMs);
      durationMs += segment.durationMs;
    });
    stream = canvas.captureStream(30);

    if (soundUrl) {
      audioContext = new AudioContext();
      await audioContext.resume();
      const destination = audioContext.createMediaStreamDestination();
      const gain = audioContext.createGain();
      audioGain = gain;
      const targetGain = Number(volumeInput.value) / 100;
      gain.gain.value = audioFadeInput.checked ? 0 : targetGain;
      audioElement = new Audio(soundUrl);
      audioElement.loop = true;
      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(gain);
      gain.connect(destination);
      await audioElement.play();
      for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5_000_000
    });
    const chunks = [];

    const finished = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", event => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("error", event => reject(event.error || new Error("Video recording failed.")), { once: true });
      recorder.addEventListener("stop", () => {
        if (renderError) {
          reject(renderError);
          return;
        }
        if (!chunks.length) {
          reject(new Error("No video data was created. Try fewer or smaller photos."));
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
        downloadBlob(blob, recorder.mimeType || mimeType, platform);
        resolve();
      }, { once: true });
    });

    recorder.start(250);
    const startTime = performance.now();
    if (audioContext && audioGain && audioFadeInput.checked) {
      const audioStart = audioContext.currentTime;
      const fadeSeconds = Math.min(1, durationMs / 3000);
      const targetGain = Number(volumeInput.value) / 100;
      audioGain.gain.cancelScheduledValues(audioStart);
      audioGain.gain.setValueAtTime(0, audioStart);
      audioGain.gain.linearRampToValueAtTime(targetGain, audioStart + fadeSeconds);
      audioGain.gain.setValueAtTime(targetGain, audioStart + durationMs / 1000 - fadeSeconds);
      audioGain.gain.linearRampToValueAtTime(0, audioStart + durationMs / 1000);
    }
    const zoomFactor = 1 + Number(zoomInput.value) / 100;

    function renderFrame(now) {
      try {
        const elapsed = Math.max(0, Math.min(now - startTime, durationMs));
        let segmentIndex = timelineStarts.findIndex((segmentStart, index) => elapsed < segmentStart + timeline[index].durationMs);
        if (segmentIndex < 0) segmentIndex = timeline.length - 1;
        const segment = timeline[segmentIndex];
        const photo = segment.photo;
        if (!photo) throw new Error("A photo was unavailable while rendering. Please reload your photos and try again.");
        const segmentElapsed = elapsed - timelineStarts[segmentIndex];
        const segmentProgress = Math.max(0, Math.min(segmentElapsed / segment.durationMs, 1));
        const scale = 1 + (zoomFactor - 1) * segmentProgress;
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawCover(photo.image, scale);

        const nextSegment = timeline[segmentIndex + 1];
        const transitionMs = nextSegment ? Math.min(450, segment.durationMs / 4, nextSegment.durationMs / 4) : 0;
        if (crossfadeInput.checked && nextSegment && transitionMs > 0) {
          const transitionStart = segment.durationMs - transitionMs;
          if (segmentElapsed > transitionStart) {
            const transitionProgress = (segmentElapsed - transitionStart) / transitionMs;
            drawCover(nextSegment.photo.image, 1 + (zoomFactor - 1) * transitionProgress, transitionProgress);
          }
        }
      } catch (error) {
        renderError = error instanceof Error ? error : new Error("Video rendering failed.");
        recorder.stop();
        return;
      }

      if (now - startTime >= durationMs) {
        recorder.stop();
        return;
      }
      animationFrame = requestAnimationFrame(renderFrame);
    }

    animationFrame = requestAnimationFrame(renderFrame);
    await finished;
    if (renderError) throw renderError;
    status.textContent = `Your ${platform === "tiktok" ? "TikTok" : "YouTube Shorts"} video is ready. Use the download or share button to save it to your device.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "The video could not be made. Try again with fewer or smaller files.";
  } finally {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (audioContext && audioContext.state !== "closed") {
      try {
        await audioContext.close();
      } catch (error) {
        status.textContent = "The video was made, but the sound session did not close cleanly. You can still use the download.";
      }
    }
    exportInProgress = false;
    renderPhotos();
  }
}

makeButton.addEventListener("click", makeVideo);
shareButton.addEventListener("click", async () => {
  if (!resultFile || !navigator.share) return;
  try {
    await navigator.share({ files: [resultFile], title: resultFile.name });
    status.textContent = "The share menu was opened for your video.";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      status.textContent = "Sharing was canceled. Your video is still ready to download.";
      return;
    }
    status.textContent = error instanceof Error ? error.message : "The share menu could not be opened. Use the download link instead.";
  }
});
platformInput.addEventListener("change", () => {
  const destination = platformInput.value === "tiktok" ? "TikTok" : "YouTube Shorts";
  status.textContent = `${destination} selected. Both destinations use the same vertical 9:16 format.`;
});
updateSettings();
