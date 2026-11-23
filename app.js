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
const audioFadeInput = document.querySelector("#audio-fade");
const crossfadeInput = document.querySelector("#crossfade");
const openingHookInput = document.querySelector("#opening-hook");
const closingCtaInput = document.querySelector("#closing-cta");
const voiceEnabledInput = document.querySelector("#voice-enabled");
const voiceStyleInput = document.querySelector("#voice-style");
const previewVoiceButton = document.querySelector("#preview-voice");
const editStyleInput = document.querySelector("#edit-style");
const platformInput = document.querySelector("#platform");
const secondsValue = document.querySelector("#seconds-value");
const zoomValue = document.querySelector("#zoom-value");
const volumeValue = document.querySelector("#volume-value");
const durationLabel = document.querySelector("#duration");
const generateDraftsButton = document.querySelector("#generate-drafts");
const draftsPanel = document.querySelector("#story-drafts");
const draftList = document.querySelector("#draft-list");
const makeButton = document.querySelector("#make-video");
const downloadResult = document.querySelector("#download-result");
const downloadLink = document.querySelector("#download-link");
const shareButton = document.querySelector("#share-video");
const status = document.querySelector("#status");

let photos = [];
let sound = null;
let soundUrl = null;
let drafts = [];
let selectedDraft = null;
let exportInProgress = false;
let resultUrl = null;
let resultFile = null;

const voiceStyles = {
  deep: { rate: 0.82, pitch: 0.6, volume: 1 },
  whisper: { rate: 0.94, pitch: 1, volume: 0.65 },
  demon: { rate: 0.78, pitch: 0.45, volume: 1 },
  robot: { rate: 1.04, pitch: 0.8, volume: 1 },
  ghost: { rate: 0.88, pitch: 1.35, volume: 0.8 }
};

function photoSeconds(photo) {
  return Number(photo.duration) || Number(secondsInput.value);
}

function activePhotos() {
  return selectedDraft ? selectedDraft.photos : photos;
}

function narrationText(photoSet = activePhotos(), hook = openingHookInput.value, closing = closingCtaInput.value) {
  const opening = hook.trim() || "Something is watching.";
  const ending = closing.trim() || "Would you have opened the door?";
  return [opening, ...photoSet.map(photo => photo.caption.trim()).filter(Boolean), ending].join(". ");
}

function narrationDurationMs(text, style = voiceStyleInput.value) {
  if (!text || !voiceEnabledInput.checked) return 0;
  const rate = (voiceStyles[style] || voiceStyles.deep).rate;
  return (text.length / (13 * rate) + 0.8) * 1000;
}

function videoTimeline(photoSet) {
  const timeline = photoSet.map(photo => ({
    photo,
    durationMs: photoSeconds(photo) * 1000,
    isJumpScare: false,
    isReveal: false
  }));
  if (editStyleInput.value === "jumpscare" && photoSet.length) {
    photoSet.forEach(photo => timeline.push({ photo, durationMs: 500, isJumpScare: true, isReveal: false }));
    timeline.push({ photo: photoSet[photoSet.length - 1], durationMs: 1250, isJumpScare: true, isReveal: true });
  }
  const timelineDuration = timeline.reduce((total, segment) => total + segment.durationMs, 0);
  const speechDuration = narrationDurationMs(narrationText(photoSet));
  if (speechDuration > timelineDuration) {
    timeline.push({
      photo: photoSet[photoSet.length - 1],
      durationMs: speechDuration - timelineDuration + 250,
      isJumpScare: false,
      isReveal: false
    });
  }
  return timeline;
}

function videoDuration(photoSet = activePhotos()) {
  return videoTimeline(photoSet).reduce((total, segment) => total + segment.durationMs, 0) / 1000;
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
  const currentPhotos = activePhotos();
  const displayedDuration = Number(videoDuration(currentPhotos).toFixed(1));
  durationLabel.textContent = currentPhotos.length
    ? `${selectedDraft ? `${selectedDraft.title} · ` : ""}About ${displayedDuration} seconds · ${currentPhotos.length} photo${currentPhotos.length === 1 ? "" : "s"}`
    : "Add photos to see video length";
  makeButton.disabled = currentPhotos.length === 0 || exportInProgress;
  makeButton.textContent = selectedDraft ? "Make selected draft" : "Make my video";
  generateDraftsButton.disabled = photos.length < 3 || exportInProgress;
  generateDraftsButton.textContent = drafts.length ? "Regenerate 3 story drafts" : "Generate 3 story drafts";
  photoInput.disabled = exportInProgress;
  soundInput.disabled = exportInProgress;
  platformInput.disabled = exportInProgress;
  secondsInput.disabled = exportInProgress;
  zoomInput.disabled = exportInProgress;
  volumeInput.disabled = exportInProgress;
  audioFadeInput.disabled = exportInProgress;
  crossfadeInput.disabled = exportInProgress;
  openingHookInput.disabled = exportInProgress;
  closingCtaInput.disabled = exportInProgress;
  voiceEnabledInput.disabled = exportInProgress;
  voiceStyleInput.disabled = exportInProgress || !voiceEnabledInput.checked;
  previewVoiceButton.disabled = exportInProgress || !voiceEnabledInput.checked;
  editStyleInput.disabled = exportInProgress;
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

function wrapText(text, maxWidth, maxLines) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let line = "";
  let wordIndex = 0;

  for (; wordIndex < words.length; wordIndex += 1) {
    const candidate = line ? `${line} ${words[wordIndex]}` : words[wordIndex];
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = words[wordIndex];
      if (lines.length === maxLines - 1) {
        wordIndex += 1;
        break;
      }
    } else {
      line = candidate;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  if (wordIndex < words.length && lines.length) {
    let lastLine = `${lines[lines.length - 1]}…`;
    while (context.measureText(lastLine).width > maxWidth && lastLine.length > 1) {
      lastLine = `${lastLine.slice(0, -2)}…`;
    }
    lines[lines.length - 1] = lastLine;
  }
  return lines;
}

function drawTextCard(text, centerY, fontSize) {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  context.save();
  context.font = `700 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const maxTextWidth = canvas.width - 100;
  const lines = wrapText(trimmedText, maxTextWidth, 3);
  const lineHeight = fontSize * 1.25;
  const padding = 18;
  const textWidth = Math.max(...lines.map(line => context.measureText(line).width));
  const boxWidth = Math.min(canvas.width - 48, textWidth + padding * 2);
  const boxHeight = lines.length * lineHeight + padding * 2;
  const left = (canvas.width - boxWidth) / 2;
  const top = Math.max(32, Math.min(canvas.height - boxHeight - 80, centerY - boxHeight / 2));

  context.fillStyle = "rgba(0, 0, 0, 0.76)";
  context.fillRect(left, top, boxWidth, boxHeight);
  context.fillStyle = "#bd1728";
  context.fillRect(left, top, boxWidth, 5);
  context.fillStyle = "#ffffff";
  lines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, top + padding + lineHeight * (index + 0.5), maxTextWidth);
  });
  context.restore();
}

function clearDrafts() {
  drafts = [];
  selectedDraft = null;
  draftList.replaceChildren();
  draftsPanel.hidden = true;
}

function updatePreview() {
  const currentPhotos = activePhotos();
  placeholder.hidden = currentPhotos.length > 0;
  if (!currentPhotos.length) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  paintCover(currentPhotos[0].image, 1 + Number(zoomInput.value) / 100);
  drawTextCard(selectedDraft ? selectedDraft.hook : openingHookInput.value, 350, 44);
  drawTextCard(currentPhotos[0].caption, 930, 38);
}

function renderDrafts() {
  draftList.replaceChildren();
  draftsPanel.hidden = drafts.length === 0;

  drafts.forEach(draft => {
    const card = document.createElement("article");
    card.className = `draft-card${selectedDraft === draft ? " is-selected" : ""}`;

    const title = document.createElement("h3");
    title.textContent = draft.title;

    const description = document.createElement("p");
    description.textContent = draft.description;

    const hook = document.createElement("p");
    hook.className = "draft-hook";
    hook.textContent = draft.hook;

    const strip = document.createElement("div");
    strip.className = "draft-photos";
    strip.setAttribute("aria-label", `${draft.photos.length} photos in ${draft.title}`);
    draft.photos.forEach((photo, index) => {
      const thumbnail = document.createElement("img");
      thumbnail.src = photo.url;
      thumbnail.alt = `Photo ${index + 1}`;
      strip.append(thumbnail);
    });

    const meta = document.createElement("p");
    meta.className = "draft-meta";
    const draftDuration = Number(videoDuration(draft.photos).toFixed(1));
    meta.textContent = `${draft.photos.length} photos · about ${draftDuration} seconds`;

    const actions = document.createElement("div");
    actions.className = "draft-actions";

    const previewButton = document.createElement("button");
    previewButton.className = `draft-action${selectedDraft === draft ? " is-primary" : ""}`;
    previewButton.type = "button";
    previewButton.textContent = selectedDraft === draft ? "Previewing" : "Preview draft";
    previewButton.disabled = exportInProgress;
    previewButton.addEventListener("click", () => selectDraft(draft));

    const downloadButton = document.createElement("button");
    downloadButton.className = "draft-action";
    downloadButton.type = "button";
    downloadButton.textContent = "Make & download";
    downloadButton.disabled = exportInProgress;
    downloadButton.addEventListener("click", () => {
      selectDraft(draft);
      makeVideo();
    });

    actions.append(previewButton, downloadButton);
    card.append(title, description, hook, strip, meta, actions);
    draftList.append(card);
  });
}

function selectDraft(draft) {
  selectedDraft = draft;
  openingHookInput.value = draft.hook;
  closingCtaInput.value = draft.closingCta;
  renderDrafts();
  updatePreview();
  updateSettings();
  status.textContent = `Previewing ${draft.title}. Make the selected draft when you're ready.`;
}

function generateDrafts() {
  if (photos.length < 3) {
    status.textContent = "Add at least 3 photos to create different story drafts.";
    return;
  }

  selectedDraft = null;
  const selectionSize = Math.min(6, Math.max(2, Math.round(photos.length / 2)));
  const maxStart = photos.length - selectionSize;
  const starts = [0, Math.floor(maxStart / 2), maxStart];
  const selections = photos.length === 3
    ? [[0, 1], [0, 2], [1, 2]]
    : starts.map(start => Array.from({ length: selectionSize }, (_, index) => start + index));
  const descriptions = photos.length === 3
    ? [
      "Open with the first photo and follow the clue.",
      "Pair the opening image with the final reveal.",
      "Build the cut from the middle to the ending."
    ]
    : [
      "Start with the early photos and follow their order.",
      "Focus the cut around the middle of your sequence.",
      "Use the final photos as the story's reveal."
    ];
  const hooks = [
    "It began with one small clue.",
    "Something here does not add up.",
    "Everything led to this moment."
  ];
  const closingCta = closingCtaInput.value.trim() || "What would you have done?";

  drafts = selections.map((indices, index) => ({
    id: index,
    title: ["The first clue", "The strange detail", "The final reveal"][index],
    description: descriptions[index],
    hook: openingHookInput.value.trim() || hooks[index],
    closingCta,
    photos: indices.map(photoIndex => photos[photoIndex])
  }));
  renderDrafts();
  updatePreview();
  updateSettings();
  status.textContent = "Three story drafts are ready. Preview them and choose the one you like best.";
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

    const caption = document.createElement("input");
    caption.className = "photo-caption";
    caption.type = "text";
    caption.maxLength = 100;
    caption.placeholder = "Caption for this photo (optional)";
    caption.value = photo.caption;
    caption.setAttribute("aria-label", `Caption for ${photo.file.name}`);
    caption.disabled = exportInProgress;
    caption.addEventListener("input", () => {
      photo.caption = caption.value;
      updatePreview();
      updateSettings();
      if (drafts.length) renderDrafts();
    });

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
      if (drafts.length) renderDrafts();
    });
    duration.addEventListener("change", () => {
      const value = duration.value === "" ? Number(secondsInput.value) : Number(duration.value);
      photo.duration = Number.isFinite(value) ? Math.min(10, Math.max(2, value)) : Number(secondsInput.value);
      duration.value = String(photo.duration);
      updateSettings();
      if (drafts.length) renderDrafts();
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

    item.append(thumbnail, name, up, down, remove, caption, durationControl);
    photoList.append(item);
  });

  emptyPhotos.hidden = photos.length > 0;
  photoCount.textContent = `${photos.length} photo${photos.length === 1 ? "" : "s"}`;
  updatePreview();
  updateSettings();
  if (drafts.length) renderDrafts();
}

function movePhoto(index, offset) {
  const destination = index + offset;
  if (destination < 0 || destination >= photos.length) return;
  clearDrafts();
  [photos[index], photos[destination]] = [photos[destination], photos[index]];
  renderPhotos();
}

function removePhoto(index) {
  clearDrafts();
  URL.revokeObjectURL(photos[index].url);
  photos.splice(index, 1);
  renderPhotos();
}

photoInput.addEventListener("change", async () => {
  const selected = Array.from(photoInput.files || []).filter(file => file.type.startsWith("image/"));
  photoInput.value = "";
  if (!selected.length) return;

  clearDrafts();
  status.textContent = "Loading photos…";
  let failedCount = 0;
  for (const file of selected) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      photos.push({ file, image, url, caption: "", duration: Number(secondsInput.value) });
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

for (const input of [openingHookInput, closingCtaInput]) {
  input.addEventListener("input", () => {
    if (selectedDraft) {
      selectedDraft.hook = openingHookInput.value;
      selectedDraft.closingCta = closingCtaInput.value;
      renderDrafts();
    }
    updatePreview();
    updateSettings();
  });
}

generateDraftsButton.addEventListener("click", generateDrafts);

function makeNarrationUtterance(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  const style = voiceStyles[voiceStyleInput.value] || voiceStyles.deep;
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(voice => voice.lang.toLowerCase() === "en-us") ||
    voices.find(voice => voice.lang.toLowerCase().startsWith("en-"));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
    utterance.lang = preferredVoice.lang;
  }
  utterance.rate = style.rate;
  utterance.pitch = style.pitch;
  utterance.volume = style.volume;
  return utterance;
}

previewVoiceButton.addEventListener("click", () => {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    status.textContent = "Voice narration is not supported in this browser.";
    return;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(makeNarrationUtterance(narrationText()));
  status.textContent = "Playing a preview of your selected voice style.";
});

for (const input of [voiceEnabledInput, voiceStyleInput, editStyleInput]) {
  input.addEventListener("change", () => {
    updateSettings();
    if (input === editStyleInput) updatePreview();
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

function downloadBlob(blob, mimeType, platform, draftNumber) {
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const draftSuffix = draftNumber ? `-draft-${draftNumber}` : "";
  const filename = `horror-${platform}${draftSuffix}.${extension}`;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = URL.createObjectURL(blob);
  resultFile = typeof File === "undefined" ? null : new File([blob], filename, { type: blob.type || mimeType });
  downloadLink.href = resultUrl;
  downloadLink.download = filename;
  downloadResult.hidden = false;
  shareButton.hidden = !isMobileDevice() || !canShareVideo(resultFile);
}

async function makeVideo() {
  const exportPhotoSet = activePhotos();
  if (!exportPhotoSet.length || exportInProgress) return;
  if (!canvas.captureStream || !window.MediaRecorder) {
    status.textContent = "Video export is not supported in this browser. Try the latest Chrome or Edge.";
    return;
  }

  const platform = platformInput.value === "tiktok" ? "tiktok" : "youtube-shorts";
  const draftNumber = selectedDraft ? selectedDraft.id + 1 : null;
  const openingHook = selectedDraft ? selectedDraft.hook : openingHookInput.value;
  const closingCta = selectedDraft ? selectedDraft.closingCta : closingCtaInput.value;
  const voiceEnabled = voiceEnabledInput.checked;
  if (voiceEnabled && (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getDisplayMedia ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  )) {
    status.textContent = "Narrated export needs a browser with built-in speech and tab-audio capture. Turn narration off to make a silent video.";
    return;
  }
  exportInProgress = true;
  renderPhotos();
  makeButton.textContent = "Making your video…";
  status.textContent = voiceEnabled
    ? "Choose this browser tab and enable tab audio in the share prompt to record your narration."
    : `Keep this page open while your ${platform === "tiktok" ? "TikTok" : "YouTube Shorts"} video is being made.`;

  let audioContext = null;
  let audioElement = null;
  let audioGain = null;
  let displayCapture = null;
  let stream = null;
  let animationFrame = 0;
  let renderError = null;

  try {
    const mimeType = supportedMimeType();
    if (!mimeType) throw new Error("This browser does not support a video format this editor can export.");

    const displayCaptureRequest = voiceEnabled
      ? navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        systemAudio: "include"
      })
      : null;
    const timeline = videoTimeline(exportPhotoSet);
    const timelineStarts = [];
    let durationMs = 0;
    timeline.forEach(segment => {
      timelineStarts.push(durationMs);
      durationMs += segment.durationMs;
    });
    stream = canvas.captureStream(30);
    if (displayCaptureRequest) {
      displayCapture = await displayCaptureRequest;
      const audioTracks = displayCapture.getAudioTracks();
      if (!audioTracks.length) {
        throw new Error("No tab audio was shared. Try again, choose this browser tab, and turn on Share tab audio.");
      }
      displayCapture.getVideoTracks().forEach(track => track.stop());
      status.textContent = `Recording your voice for the ${platform === "tiktok" ? "TikTok" : "YouTube Shorts"} video. Keep this page open.`;
    }

    if (soundUrl || displayCapture) {
      audioContext = new AudioContext();
      await audioContext.resume();
      const destination = audioContext.createMediaStreamDestination();
      if (displayCapture) {
        const voiceSource = audioContext.createMediaStreamSource(new MediaStream(displayCapture.getAudioTracks()));
        voiceSource.connect(destination);
      }
      if (soundUrl) {
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
      }
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
        downloadBlob(blob, recorder.mimeType || mimeType, platform, draftNumber);
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
    if (voiceEnabled) {
      window.speechSynthesis.cancel();
      const utterance = makeNarrationUtterance(narrationText(exportPhotoSet, openingHook, closingCta));
      utterance.onerror = () => {
        renderError = new Error("The browser could not play the selected voice. Try another voice style or browser.");
        if (recorder.state === "recording") recorder.stop();
      };
      window.speechSynthesis.speak(utterance);
    }
    const zoomFactor = 1 + Number(zoomInput.value) / 100;

    function renderFrame(now) {
      try {
        const elapsed = Math.max(0, Math.min(now - startTime, durationMs));
        let segmentIndex = timelineStarts.findIndex((segmentStart, index) => elapsed < segmentStart + timeline[index].durationMs);
        if (segmentIndex < 0) segmentIndex = timeline.length - 1;
        const segment = timeline[segmentIndex];
        const photo = segment && segment.photo;
        if (!photo) throw new Error("A photo was unavailable while rendering. Please reload your photos and try again.");
        const segmentElapsed = elapsed - timelineStarts[segmentIndex];
        const segmentProgress = Math.max(0, Math.min(segmentElapsed / segment.durationMs, 1));
        const scale = segment.isReveal
          ? 1.08 + segmentProgress * 0.32
          : segment.isJumpScare
            ? 1.08 + segmentProgress * 0.06
            : 1 + (zoomFactor - 1) * segmentProgress;
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawCover(photo.image, scale);
        if (segment.isJumpScare) {
          context.fillStyle = "rgba(36, 0, 0, 0.16)";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }

        const nextSegment = timeline[segmentIndex + 1];
        const transitionMs = nextSegment && !segment.isJumpScare && !nextSegment.isJumpScare
          ? Math.min(450, segment.durationMs / 4, nextSegment.durationMs / 4)
          : 0;
        if (crossfadeInput.checked && nextSegment && transitionMs > 0) {
          const transitionStart = segment.durationMs - transitionMs;
          if (segmentElapsed > transitionStart) {
            const transitionProgress = (segmentElapsed - transitionStart) / transitionMs;
            drawCover(nextSegment.photo.image, 1 + (zoomFactor - 1) * transitionProgress, transitionProgress);
          }
        }

        const hookWindow = Math.min(1800, durationMs / 3);
        const closingWindow = Math.min(1800, durationMs / 3);
        if (segmentIndex === 0 && elapsed < hookWindow) drawTextCard(openingHook, 350, 44);
        if (!segment.isJumpScare && photo.caption) drawTextCard(photo.caption, 930, 38);
        if (segmentIndex === timeline.length - 1 && elapsed >= durationMs - closingWindow) {
          drawTextCard(closingCta, 1080, 36);
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
    if (displayCapture) displayCapture.getTracks().forEach(track => track.stop());
    if (voiceEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
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
