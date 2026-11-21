const photoInput = document.querySelector("#photo-files");
const soundInput = document.querySelector("#sound-file");
const photoList = document.querySelector("#photo-list");
const emptyPhotos = document.querySelector("#empty-photos");
const photoCount = document.querySelector("#photo-count");
const soundName = document.querySelector("#sound-name");
const canvas = document.querySelector("#video-canvas");
const context = canvas.getContext("2d");
const placeholder = document.querySelector("#preview-placeholder");
const secondsInput = document.querySelector("#seconds");
const zoomInput = document.querySelector("#zoom");
const volumeInput = document.querySelector("#volume");
const secondsValue = document.querySelector("#seconds-value");
const zoomValue = document.querySelector("#zoom-value");
const volumeValue = document.querySelector("#volume-value");
const durationLabel = document.querySelector("#duration");
const makeButton = document.querySelector("#make-video");
const status = document.querySelector("#status");

let photos = [];
let sound = null;
let soundUrl = null;
let exportInProgress = false;

function videoDuration() {
  return photos.length * Number(secondsInput.value);
}

function updateSettings() {
  secondsValue.value = `${secondsInput.value} sec`;
  zoomValue.value = `${zoomInput.value}%`;
  volumeValue.value = `${volumeInput.value}%`;
  durationLabel.textContent = photos.length
    ? `About ${videoDuration()} seconds · ${photos.length} photo${photos.length === 1 ? "" : "s"}`
    : "Add photos to see video length";
  makeButton.disabled = photos.length === 0 || exportInProgress;
  photoInput.disabled = exportInProgress;
  soundInput.disabled = exportInProgress;
  secondsInput.disabled = exportInProgress;
  zoomInput.disabled = exportInProgress;
  volumeInput.disabled = exportInProgress;
}

function paintCover(image, zoom) {
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
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

    item.append(thumbnail, name, up, down, remove);
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

photoInput.addEventListener("change", async () => {
  const selected = Array.from(photoInput.files || []).filter(file => file.type.startsWith("image/"));
  photoInput.value = "";
  if (!selected.length) return;

  status.textContent = "Loading photos…";
  let failedCount = 0;
  for (const file of selected) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      photos.push({ file, image, url });
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
    status.textContent = "Photos are ready. Choose a sound if you want, then make your video.";
  }
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
  sound = file;
  soundUrl = URL.createObjectURL(file);
  soundName.textContent = file.name;
  status.textContent = "Sound is ready. It will loop if it is shorter than your video.";
});

for (const input of [secondsInput, zoomInput, volumeInput]) {
  input.addEventListener("input", () => {
    updateSettings();
    updatePreview();
  });
}

function supportedMimeType() {
  if (!window.MediaRecorder) return "";
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    "video/mp4"
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function downloadBlob(blob, mimeType) {
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `horror-short.${extension}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function makeVideo() {
  if (!photos.length || exportInProgress) return;
  if (!canvas.captureStream || !window.MediaRecorder) {
    status.textContent = "Video export is not supported in this browser. Try the latest Chrome or Edge.";
    return;
  }

  exportInProgress = true;
  renderPhotos();
  makeButton.textContent = "Making your video…";
  status.textContent = "Keep this page open while the video is being made.";

  let audioContext = null;
  let audioElement = null;
  let stream = null;
  let animationFrame = 0;

  try {
    const mimeType = supportedMimeType();
    if (!mimeType) throw new Error("This browser does not support a video format this editor can export.");

    const exportPhotos = photos.slice();
    const secondsPerPhoto = Number(secondsInput.value) * 1000;
    const durationMs = exportPhotos.length * secondsPerPhoto;
    stream = canvas.captureStream(30);
    if (soundUrl) {
      audioContext = new AudioContext();
      await audioContext.resume();
      const destination = audioContext.createMediaStreamDestination();
      const gain = audioContext.createGain();
      gain.gain.value = Number(volumeInput.value) / 100;
      audioElement = new Audio(soundUrl);
      audioElement.loop = true;
      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(gain);
      gain.connect(destination);
      for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
      await audioElement.play();
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5_000_000
    });
    const chunks = [];
    let renderError = null;

    const finished = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", event => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("error", event => reject(event.error || new Error("Video recording failed.")), { once: true });
      recorder.addEventListener("stop", () => {
        if (!chunks.length) {
          reject(renderError || new Error("No video data was created. Try fewer or smaller photos."));
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
        downloadBlob(blob, recorder.mimeType || mimeType);
        resolve();
      }, { once: true });
    });

    recorder.start(250);
    const startTime = performance.now();
    const zoomFactor = 1 + Number(zoomInput.value) / 100;

    function renderFrame(now) {
      try {
        const elapsed = Math.max(0, Math.min(now - startTime, durationMs));
        const photoIndex = Math.max(0, Math.min(Math.floor(elapsed / secondsPerPhoto), exportPhotos.length - 1));
        const photo = exportPhotos[photoIndex];
        if (!photo) throw new Error("A photo was unavailable while rendering. Please reload your photos and try again.");
        const photoProgress = (elapsed - photoIndex * secondsPerPhoto) / secondsPerPhoto;
        const scale = 1 + (zoomFactor - 1) * Math.max(0, Math.min(photoProgress, 1));
        paintCover(photo.image, scale);
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
    status.textContent = "Your video is ready and downloaded.";
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
    makeButton.textContent = "Make my video";
    renderPhotos();
  }
}

makeButton.addEventListener("click", makeVideo);
updateSettings();
