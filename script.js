const imageInput = document.getElementById('imageInput');
const windowCountInput = document.getElementById('windowCount');
const windowCountValue = document.getElementById('windowCountValue');
const blurStrengthInput = document.getElementById('blurStrength');
const blurStrengthValue = document.getElementById('blurStrengthValue');
const resetLayoutBtn = document.getElementById('resetLayout');
const exportPngBtn = document.getElementById('exportPng');
const preview = document.getElementById('preview');
const bg = document.getElementById('bg');
const windows = document.getElementById('windows');

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80';

const MIN_SLICE_RATIO = 0.12;

let imageURL = DEFAULT_IMAGE;
let uploadedImageObjectURL = null;
let pointerState = null;
let slices = [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function getPreviewRect() {
  return preview.getBoundingClientRect();
}

function createDefaultSlices(count) {
  const slicesData = [];
  for (let i = 0; i < count; i += 1) {
    const widthRatio = 0.14 + ((i % 3) * 0.03 + 0.03);
    const heightRatio = 0.30 + ((i * 17) % 24) / 100;
    const baseX = (i + 0.5) / count - widthRatio / 2;
    const jitter = ((i % 2 === 0 ? -1 : 1) * (0.01 + ((i * 7) % 10) / 100));

    slicesData.push({
      xRatio: clamp(baseX + jitter, 0, 1 - widthRatio),
      yRatio: clamp(0.34 + ((i * 5) % 15) / 100, 0, 1 - heightRatio),
      widthRatio,
      heightRatio
    });
  }
  return slicesData;
}

function syncSliceStyle(sliceModel, element) {
  const rect = getPreviewRect();
  const left = sliceModel.xRatio * rect.width;
  const top = sliceModel.yRatio * rect.height;
  const width = sliceModel.widthRatio * rect.width;
  const height = sliceModel.heightRatio * rect.height;

  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.style.backgroundImage = `url(${imageURL})`;
  element.style.backgroundSize = `${rect.width}px ${rect.height}px`;
  element.style.backgroundPosition = `${-left}px ${-top}px`;
}

function makeDraggableAndResizable(element, handle, model) {
  element.addEventListener('pointerdown', (event) => {
    if (event.target === handle) {
      return;
    }

    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    pointerState = {
      mode: 'drag',
      id: event.pointerId,
      target: element,
      model,
      startX: event.clientX,
      startY: event.clientY,
      originXRatio: model.xRatio,
      originYRatio: model.yRatio
    };
    element.classList.add('dragging');
  });

  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    pointerState = {
      mode: 'resize',
      id: event.pointerId,
      target: handle,
      element,
      model,
      startX: event.clientX,
      startY: event.clientY,
      originWidthRatio: model.widthRatio,
      originHeightRatio: model.heightRatio
    };
    element.classList.add('resizing');
  });

  element.addEventListener('pointermove', (event) => {
    if (!pointerState || pointerState.id !== event.pointerId || pointerState.target !== element) {
      return;
    }

    const rect = getPreviewRect();
    const deltaXRatio = (event.clientX - pointerState.startX) / rect.width;
    const deltaYRatio = (event.clientY - pointerState.startY) / rect.height;

    const nextXRatio = clamp(
      pointerState.originXRatio + deltaXRatio,
      0,
      1 - pointerState.model.widthRatio
    );
    const nextYRatio = clamp(
      pointerState.originYRatio + deltaYRatio,
      0,
      1 - pointerState.model.heightRatio
    );

    pointerState.model.xRatio = nextXRatio;
    pointerState.model.yRatio = nextYRatio;
    syncSliceStyle(pointerState.model, element);
  });

  handle.addEventListener('pointermove', (event) => {
    if (!pointerState || pointerState.id !== event.pointerId || pointerState.target !== handle) {
      return;
    }

    const rect = getPreviewRect();
    const deltaXRatio = (event.clientX - pointerState.startX) / rect.width;
    const deltaYRatio = (event.clientY - pointerState.startY) / rect.height;

    const maxWidthRatio = 1 - pointerState.model.xRatio;
    const maxHeightRatio = 1 - pointerState.model.yRatio;

    const nextWidthRatio = clamp(
      pointerState.originWidthRatio + deltaXRatio,
      MIN_SLICE_RATIO,
      maxWidthRatio
    );
    const nextHeightRatio = clamp(
      pointerState.originHeightRatio + deltaYRatio,
      MIN_SLICE_RATIO,
      maxHeightRatio
    );

    pointerState.model.widthRatio = nextWidthRatio;
    pointerState.model.heightRatio = nextHeightRatio;
    syncSliceStyle(pointerState.model, element);
  });

  const endAction = (event) => {
    if (!pointerState || pointerState.id !== event.pointerId) {
      return;
    }

    if (pointerState.target === element) {
      element.classList.remove('dragging');
    }

    if (pointerState.target === handle) {
      element.classList.remove('resizing');
    }

    pointerState = null;
  };

  element.addEventListener('pointerup', endAction);
  element.addEventListener('pointercancel', endAction);
  handle.addEventListener('pointerup', endAction);
  handle.addEventListener('pointercancel', endAction);
}

function renderWindows() {
  windows.innerHTML = '';
  slices.forEach((sliceModel) => {
    const sliceElement = document.createElement('div');
    sliceElement.className = 'slice';

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.setAttribute('aria-hidden', 'true');

    syncSliceStyle(sliceModel, sliceElement);
    makeDraggableAndResizable(sliceElement, resizeHandle, sliceModel);

    sliceElement.appendChild(resizeHandle);
    windows.appendChild(sliceElement);
  });
}

function resetLayout() {
  const count = Number.parseInt(windowCountInput.value, 10);
  windowCountValue.textContent = String(count);
  slices = createDefaultSlices(count);
  renderWindows();
}

function setBlurStrength(value) {
  blurStrengthValue.textContent = `${value}px`;
  bg.style.filter = `blur(${value}px) brightness(0.86)`;
}

function updateBackground() {
  bg.style.backgroundImage = `url(${imageURL})`;
}

function resizeKeepLayout() {
  renderWindows();
}

function loadSelectedFile(file) {
  if (!file) return;
  if (uploadedImageObjectURL) {
    URL.revokeObjectURL(uploadedImageObjectURL);
  }
  uploadedImageObjectURL = URL.createObjectURL(file);
  imageURL = uploadedImageObjectURL;
  updateBackground();
  renderWindows();
}

function exportPreviewAsPng() {
  const rect = getPreviewRect();
  const canvas = document.createElement('canvas');
  const scale = window.devicePixelRatio > 1 ? 2 : 1;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext('2d');

  if (!ctx) return;

  const baseImage = new Image();
  baseImage.crossOrigin = 'anonymous';
  baseImage.src = imageURL;

  baseImage.onload = () => {
    ctx.scale(scale, scale);

    const blurValue = Number.parseInt(blurStrengthInput.value, 10);
    ctx.filter = `blur(${blurValue}px) brightness(0.86)`;
    ctx.drawImage(baseImage, -rect.width * 0.04, -rect.height * 0.04, rect.width * 1.08, rect.height * 1.08);

    ctx.filter = 'none';
    slices.forEach((slice) => {
      const left = slice.xRatio * rect.width;
      const top = slice.yRatio * rect.height;
      const width = slice.widthRatio * rect.width;
      const height = slice.heightRatio * rect.height;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(baseImage, left, top, width, height, left, top, width, height);
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.strokeRect(left, top, width, height);
    });

    const link = document.createElement('a');
    link.download = `depth-wallpaper-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
}

imageInput.addEventListener('change', (event) => {
  loadSelectedFile(event.target.files?.[0]);
});

windowCountInput.addEventListener('input', resetLayout);

blurStrengthInput.addEventListener('input', () => {
  const value = Number.parseInt(blurStrengthInput.value, 10);
  setBlurStrength(value);
});

resetLayoutBtn.addEventListener('click', resetLayout);
exportPngBtn.addEventListener('click', exportPreviewAsPng);
window.addEventListener('resize', resizeKeepLayout);

window.addEventListener('beforeunload', () => {
  if (uploadedImageObjectURL) {
    URL.revokeObjectURL(uploadedImageObjectURL);
  }
});

updateBackground();
setBlurStrength(Number.parseInt(blurStrengthInput.value, 10));
resetLayout();
