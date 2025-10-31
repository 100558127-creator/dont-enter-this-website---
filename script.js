/* ============================================== */
/* === 游戏核心代码 (优化版) === */
/* ============================================== */

// --- Game state ---
const gameState = {
  isPenActive: false,
  isTapeActive: false,
  isTweezersActive: false,
  isMagnifierActive: false,
  isBoxActive: false,
  isPassActive: false,
  mapRepaired: false,
  letterRepaired: false,
  passCollected: false,
  gamePhase: 0,
  archive: [],
  amelieLetterDeclined: false
};

// --- DOM elements ---
const $ = id => document.getElementById(id);
const introDialog = $('intro-dialog');
const booksIcon = $('books-icon');
const workspace = $('workspace');
const toolbar = $('toolbar');
const penHotspot = $('tool-pen-hotspot');
const tapeHotspot = $('tool-tape-hotspot');
const tweezersHotspot = $('tool-tweezers-hotspot');
const magnifierHotspot = $('tool-magnifier-hotspot');
const boxHotspot = $('tool-box-hotspot');
const passSlot = $('tool-pass-slot');
const fragmentPile = $('fragment-pile');

// 工具列表
const tools = {
  pen: { state: 'isPenActive', element: penHotspot },
  tape: { state: 'isTapeActive', element: tapeHotspot },
  tweezers: { state: 'isTweezersActive', element: tweezersHotspot },
  magnifier: { state: 'isMagnifierActive', element: magnifierHotspot },
  box: { state: 'isBoxActive', element: boxHotspot },
  pass: { state: 'isPassActive', element: passSlot }
};

// --- Level variables ---
let mapDocument, canvas, ctx, isDrawing, hasDrawn;
let letterDocument, placedFragments = {};
let switchingImage, imageClickCount = 0;
let image3Others, image3Lukas, passOthers, passLukas;
let amelieDiaryDocument, amelieDiaryBlurred, amelieDiaryClear;
let newsSwitchingImage, newsImageClickCount = 0;
let explodeImage, newsImageClear, newsImageBlurred;
let lukasDiaryDocument, lukasDiaryFragments = {}, currentLukasPuzzle = 1;
let lukasImage1, lukasImage2, lukasImage3, vignetteLayer;
let amelieLetterDocument, amelieLetterFragments = {};
let lukasDiaryFinalDocument, lukasDiaryFinalFragments = {};
let amelieDiaryFinalSwitchingImage, amelieDiaryFinalClickCount = 0;
let amelieDiaryFinalImage, news2Image;
let endImage;
let blackOverlay, isFinalPhase = false;

// ===== 通用工具函数 =====

// 背景渐变切换动效（切换到level bg）
function switchBackgroundToLevel() {
  const gameContainer = $('game-container');
  
  // 创建新背景层
  const newBg = document.createElement('div');
  newBg.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('level bg.jpg');
    background-size: cover;
    background-position: center;
    z-index: 1;
    opacity: 0;
    transition: opacity 1.5s ease-in-out;
  `;
  gameContainer.appendChild(newBg);
  
  // 触发渐变动画
  setTimeout(() => {
    newBg.style.opacity = '1';
  }, 50);
  
  // 动画完成后更新实际背景并移除临时层
  setTimeout(() => {
    gameContainer.style.backgroundImage = "url('level bg.jpg')";
    newBg.remove();
  }, 1600);
}

// 背景渐变切换动效（切换回bg）
function switchBackgroundToOriginal() {
  const gameContainer = $('game-container');
  
  // 创建新背景层
  const newBg = document.createElement('div');
  newBg.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('bg.png');
    background-size: cover;
    background-position: center;
    z-index: 1;
    opacity: 0;
    transition: opacity 1.5s ease-in-out;
  `;
  gameContainer.appendChild(newBg);
  
  // 触发渐变动画
  setTimeout(() => {
    newBg.style.opacity = '1';
  }, 50);
  
  // 动画完成后更新实际背景并移除临时层
  setTimeout(() => {
    gameContainer.style.backgroundImage = "url('bg.png')";
    newBg.remove();
  }, 1600);
}

// 创建对话框
function createDialog(text, options = {}) {
  const dialog = document.createElement('div');
  const {
    width = '450px',
    height = '180px',
    position = 'center',
    parent = $('game-container')
  } = options;
  
  const styles = {
    center: 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
    right: 'top: 10% !important; right: 10px !important; left: auto !important; transform: none !important; position: fixed !important;'
  };
  
  dialog.style.cssText = `
    position: absolute;
    ${styles[position] || styles.center}
    background-image: url('dialogue.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    padding: 2rem 2.5rem;
    z-index: ${position === 'right' ? 99999 : 10000};
    width: ${width};
    min-height: ${height};
    font-family: 'Indie Flower', cursive;
    color: #2a2520;
    font-size: 1.3rem;
    line-height: 1.4;
    text-align: center;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  dialog.innerHTML = `<p>${text}</p>`;
  (position === 'right' ? document.body : parent).appendChild(dialog);
  
  setTimeout(() => dialog.style.opacity = '1', 100);
  return dialog;
}

// 自动移除对话框
function autoRemoveDialog(dialog, delay = 3000) {
  setTimeout(() => {
    dialog.style.opacity = '0';
    setTimeout(() => dialog.remove(), 300);
  }, delay);
}

// 通用工具选择
function selectTool(toolName) {
  // Box 工具特殊处理：显示对话框而不是选中
  if (toolName === 'box') {
    showBoxDialog();
    return;
  }
  
  const tool = tools[toolName];
  gameState[tool.state] = !gameState[tool.state];
  
  // 取消其他工具
  if (gameState[tool.state]) {
    Object.entries(tools).forEach(([name, t]) => {
      if (name !== toolName) {
        gameState[t.state] = false;
        t.element.style.transform = 'scale(1)';
      }
    });
    
    // 放大当前工具（效果更明显）
    tool.element.style.transform = 'scale(1.35)';
    
    if (canvas && toolName === 'pen') canvas.style.cursor = 'crosshair';
  } else {
    tool.element.style.transform = 'scale(1)';
    if (canvas) canvas.style.cursor = 'default';
  }
}

// 显示 Box 对话框
function showBoxDialog() {
  // 如果在最终阶段，显示密码轮盘
  if (isFinalPhase) {
    showPasswordWheel();
    return;
  }
  
  const dialog = createDialog('Cannot open...', {
    width: '350px',
    height: '120px',
    position: 'right',
    parent: document.body
  });
  dialog.addEventListener('click', (e) => {
    e.stopPropagation();
    dialog.remove();
  });
  autoRemoveDialog(dialog, 3000);
}

// 重置所有工具
function resetAllTools() {
  Object.entries(tools).forEach(([name, tool]) => {
    gameState[tool.state] = false;
    tool.element.style.transform = 'scale(1)';
  });
}

// 淡出并移除元素
function fadeOutRemove(element, callback) {
  if (!element) return;
  element.style.transition = 'opacity 0.5s ease-out';
  element.style.opacity = '0';
  setTimeout(() => {
    if (element.parentNode) element.parentNode.removeChild(element);
    if (callback) callback();
  }, 500);
}

// 更新存档
function updateArchive(title, desc) {
  gameState.archive.push({ title, description: desc });
}

// ===== 游戏流程 =====

window.onload = () => {
  booksIcon.addEventListener('click', handleBooksClick);
  
  penHotspot.addEventListener('click', () => selectTool('pen'));
  tapeHotspot.addEventListener('click', () => selectTool('tape'));
  tweezersHotspot.addEventListener('click', () => selectTool('tweezers'));
  magnifierHotspot.addEventListener('click', () => selectTool('magnifier'));
  boxHotspot.addEventListener('click', () => selectTool('box'));
  
  // 显示开场黑屏警告
  showOpeningWarning();
};

// 显示开场黑屏警告
function showOpeningWarning() {
  // 创建黑色遮罩层（直接显示，不淡入）
  const warningOverlay = document.createElement('div');
  warningOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: black;
    z-index: 100000;
    opacity: 1;
    transition: opacity 2s ease-in-out;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 3rem;
  `;
  
  // 创建警告文字容器（两行）
  const warningText = document.createElement('div');
  warningText.style.cssText = `
    font-family: 'Indie Flower', cursive;
    font-size: 2rem;
    color: #ff0000;
    text-align: center;
    opacity: 1;
    transition: opacity 2s ease-in-out;
    letter-spacing: 0.2em;
    line-height: 1.8;
  `;
  
  // 创建第一行文字
  const line1 = document.createElement('div');
  line1.textContent = 'Do not be curious.';
  
  // 创建第二行文字
  const line2 = document.createElement('div');
  line2.textContent = 'Do not disturb them.';
  
  warningText.appendChild(line1);
  warningText.appendChild(line2);
  warningOverlay.appendChild(warningText);
  document.body.appendChild(warningOverlay);
  
  let optionsShown = false;
  
  // 点击任意位置后先让红字消失，再显示选项
  const handleClick = () => {
    if (optionsShown) return;
    optionsShown = true;
    
    // 先让红色文字淡出
    warningText.style.opacity = '0';
    
    // 等待文字完全消失后再显示选项
    setTimeout(() => {
      // 创建选项容器
      const optionsContainer = document.createElement('div');
      optionsContainer.style.cssText = `
        display: flex;
        gap: 3rem;
        justify-content: center;
        opacity: 0;
        transition: opacity 1s ease-in;
      `;
      
      // 创建 Enter 按钮
      const enterButton = document.createElement('div');
      enterButton.textContent = 'Enter';
      enterButton.style.cssText = `
        font-family: 'Indie Flower', cursive;
        font-size: 1.8rem;
        color: #ffffff;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: underline;
        opacity: 0.8;
      `;
      
      enterButton.onmouseover = () => {
        enterButton.style.opacity = '1';
        enterButton.style.transform = 'scale(1.1)';
      };
      
      enterButton.onmouseout = () => {
        enterButton.style.opacity = '0.8';
        enterButton.style.transform = 'scale(1)';
      };
      
      // 创建 Leave 按钮
      const leaveButton = document.createElement('div');
      leaveButton.textContent = 'Leave';
      leaveButton.style.cssText = `
        font-family: 'Indie Flower', cursive;
        font-size: 1.8rem;
        color: #ff0000;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: underline;
        opacity: 0.8;
      `;
      
      leaveButton.onmouseover = () => {
        leaveButton.style.opacity = '1';
        leaveButton.style.transform = 'scale(1.1)';
      };
      
      leaveButton.onmouseout = () => {
        leaveButton.style.opacity = '0.8';
        leaveButton.style.transform = 'scale(1)';
      };
      
      // Enter 按钮点击事件 - 进入界面
      enterButton.addEventListener('click', () => {
        warningOverlay.style.opacity = '0';
        optionsContainer.style.opacity = '0';
        
        setTimeout(() => {
          warningOverlay.remove();
        }, 2000);
        
        warningOverlay.removeEventListener('click', handleClick);
      });
      
      // Leave 按钮点击事件 - 所有字慢慢消失，保持黑屏
      leaveButton.addEventListener('click', () => {
        optionsContainer.style.opacity = '0';
        
        // 淡出完成后移除选项容器
        setTimeout(() => {
          optionsContainer.remove();
        }, 1000);
      });
      
      optionsContainer.appendChild(enterButton);
      optionsContainer.appendChild(leaveButton);
      warningOverlay.appendChild(optionsContainer);
      
      // 淡入选项
      setTimeout(() => {
        optionsContainer.style.opacity = '1';
      }, 100);
    }, 2000); // 等待文字淡出完成（2秒）
  };
  
  warningOverlay.addEventListener('click', handleClick);
}

function handleBooksClick() {
  // 如果玩家拒绝修复信件，显示"没有更多东西"
  if (gameState.gamePhase === 13 && gameState.amelieLetterDeclined) {
    showNoMoreItemsDialog();
    return;
  }
  
  const phases = {
    0: startMapPhase,
    2: startPuzzlePhase,
    4: startImageSwitchingPhase,
    6: showAmelieDiary,
    8: startNewsPhase,
    11: startLukasDiaryPuzzle,
    13: startAmelieLetterPuzzle,
    15: startLukasDiaryFinalPuzzle,
    17: startAmelieDiaryFinalSwitching,
    19: startEndPhase
  };
  phases[gameState.gamePhase]?.();
}

function showNoMoreItemsDialog() {
  const dialog = createDialog('It seems there are no more items...', {
    width: '400px',
    height: '150px',
    position: 'center'
  });
  
  dialog.addEventListener('click', (e) => {
    e.stopPropagation();
    fadeOutRemove(dialog);
  });
  
  autoRemoveDialog(dialog, 3000);
}

// ===== Pass 盖章功能 =====

function placePassStamp(e) {
  const gameContainer = $('game-container');
  const rect = gameContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const passStamp = document.createElement('img');
  passStamp.src = 'pass.png';
  passStamp.className = 'placed-pass';
  
  // 初始 z-index 设置为 501（在 explode 上方）
  const initialZIndex = '501';
  passStamp.style.cssText = `
    position: absolute;
    width: 150px;
    height: 150px;
    left: ${x - 75}px;
    top: ${y - 75}px;
    pointer-events: none;
    z-index: ${initialZIndex};
  `;
  
  gameContainer.appendChild(passStamp);
  passSlot.style.display = 'none';
  gameState.isPassActive = false;
  passSlot.style.backgroundColor = 'transparent';
  passSlot.style.border = 'none';
  
  // 调用更新 pass 层级函数
  updatePassLayersAfterSwap();
}

// 更新所有已放置的 pass 的层级，使其在 explode 上方，但在 news 下方
function updatePassLayersAfterSwap() {
  const placedPasses = document.querySelectorAll('.placed-pass');
  if (!explodeImage || !newsImageClear || !newsImageBlurred || placedPasses.length === 0) {
    return;
  }
  
  const explodeZ = parseInt(explodeImage.style.zIndex);
  const newsZ = parseInt(newsImageClear.style.zIndex);
  
  // 如果 news 在上方 (newsZ > explodeZ)，pass 应该在 news 下方
  // 如果 explode 在上方 (explodeZ > newsZ)，pass 应该在 explode 上方但在 news 下方
  let passZIndex;
  
  if (newsZ > explodeZ) {
    // news 在 explode 上方，pass 应该在 explode 上方但在 news 下方
    // explode 在底层 (500)，news 在上层 (502)
    // pass 应该在 501
    passZIndex = '501';
  } else {
    // explode 在 news 上方，pass 应该在 explode 上方
    // explode 在上层 (502)，news 在底层 (500)
    // pass 应该在 503
    passZIndex = '503';
  }
  
  placedPasses.forEach(pass => {
    pass.style.zIndex = passZIndex;
  });
}

// ===== 第一关：地图 =====

function startMapPhase() {
  gameState.gamePhase = 1;
  
  introDialog.style.opacity = '0';
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    introDialog.style.display = 'none';
    booksIcon.style.display = 'none';
  }, 500);
  
  // 先切换背景，等背景切换完成后再显示关卡内容
  switchBackgroundToLevel();
  setTimeout(() => {
    initMapLevel();
  }, 1700);
}

function initMapLevel() {
  if (gameState.mapRepaired || mapDocument) return;
  
  mapDocument = document.createElement('div');
  mapDocument.id = 'map-document';
  mapDocument.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 900px;
    height: 650px;
    opacity: 0;
    animation: fadeIn 1s ease-out forwards;
  `;
  mapDocument.innerHTML = `
    <img src="map.png" style="width: 100%; height: 100%; object-fit: contain;">
    <canvas id="drawing-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></canvas>
  `;
  workspace.appendChild(mapDocument);
  
  canvas = $('drawing-canvas');
  canvas.width = 900;
  canvas.height = 650;
  ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#2a1a0a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseleave', stopDrawing);
  
  const toolTip = createDialog('You have some <span style="color: #d32f2f;">tools</span> to use', {
    width: '350px',
    height: '120px',
    position: 'right',
    parent: document.body
  });
  autoRemoveDialog(toolTip, 4000);
}

function startDrawing(e) {
  if (!gameState.isPenActive) return;
  isDrawing = true;
    hasDrawn = true; 
    draw(e); 
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
    ctx.beginPath(); 
  if (hasDrawn && !gameState.mapRepaired) completeMapLevel();
}

function draw(e) {
  if (!isDrawing || !gameState.isPenActive) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function completeMapLevel() {
  gameState.mapRepaired = true;
  gameState.gamePhase = 2;
  updateArchive('疑似城市街道图残片', '已修复。');
  
  resetAllTools();
  if (canvas) canvas.style.cursor = 'default';

  const closeMapOnBgClick = (e) => {
    if (e.target.id === 'game-container') {
      fadeOutRemove(mapDocument, () => {
      mapDocument = null;
      canvas = null;
        resetAllTools();
        switchBackgroundToOriginal();
        setTimeout(() => {
        booksIcon.style.display = 'block';
        setTimeout(() => booksIcon.style.opacity = '0.9', 100);
        }, 1700);
      });
      $('game-container').removeEventListener('click', closeMapOnBgClick);
    }
  };
  $('game-container').addEventListener('click', closeMapOnBgClick);
}

// ===== 第二关：拼图 =====

function startPuzzlePhase() {
  gameState.gamePhase = 3;
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
  }, 500);
  
  // 先切换背景，等背景切换完成后再显示关卡内容
  switchBackgroundToLevel();
  setTimeout(() => {
    const puzzleDialog = createDialog('You found some pieces with something written on them...');
    
    setTimeout(() => {
      puzzleDialog.style.opacity = '0';
      setTimeout(() => {
        puzzleDialog.remove();
        initLetterPuzzle();
      }, 1500);
    }, 2500);
  }, 1700);
}

function initLetterPuzzle() {
  const containerWidth = 800; 
  const containerHeight = 800; 
  const fragmentSize = 200;
  
    letterDocument = document.createElement('div');
    letterDocument.id = 'letter-document';
    letterDocument.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: ${containerWidth}px;
      height: ${containerHeight}px;
    z-index: 500;
    `;
    workspace.appendChild(letterDocument);
  
  // 创建 3x3 网格目标位置
  const puzzlePositions = [
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
    { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }
  ];
  
    const offsetX = (containerWidth - fragmentSize * 3) / 2;
    const offsetY = 50;
    
  // 创建目标格子
    for (let i = 0; i < 9; i++) {
      const pos = puzzlePositions[i];
      const target = document.createElement('div');
      target.className = 'fragment-target';
      target.id = `piece-${i}`;
      target.dataset.correctPiece = i;
      target.style.cssText = `
        position: absolute;
        top: ${offsetY + pos.row * fragmentSize}px;
        left: ${offsetX + pos.col * fragmentSize}px;
        width: ${fragmentSize}px;
        height: ${fragmentSize}px;
        outline: 1px dashed rgba(255, 255, 255, 0.3);
        outline-offset: -1px;
      `;
    letterDocument.appendChild(target);
  }
  
  // 创建拼图块（随机打乱）
  const pieces = [...Array(9).keys()];
  const positions = [...Array(9).keys()];
  positions.sort(() => Math.random() - 0.5);
    
    pieces.forEach((pieceNum, index) => {
      const piece = document.createElement('div');
      piece.className = 'draggable-fragment';
      piece.id = `draggable-piece-${pieceNum}`;
      piece.dataset.pieceNum = pieceNum;
      
      const pos = puzzlePositions[pieceNum];
      const bgX = (pos.col / 2) * 100;
      const bgY = (pos.row / 2) * 100;
      
      const randomPos = puzzlePositions[positions[index]];
      const leftPos = offsetX + randomPos.col * fragmentSize;
      const topPos = offsetY + randomPos.row * fragmentSize;
      
      piece.style.cssText = `
        position: absolute;
        left: ${leftPos}px;
        top: ${topPos}px;
        width: ${fragmentSize}px;
        height: ${fragmentSize}px;
        background-image: url('letter-complete.png');
        background-size: 300% 300%;
        background-position: ${bgX}% ${bgY}%;
        cursor: grab;
        z-index: 9999;
        box-shadow: 3px 3px 10px rgba(0,0,0,0.5);
      `;
      
      makePieceDraggable(piece);
    letterDocument.appendChild(piece);
    });
  }
  
  function makePieceDraggable(piece) {
    let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
    let isPlaced = false;
    
    piece.addEventListener('mousedown', (e) => {
    if (isPlaced || !gameState.isTapeActive) return;
      
      isDragging = true;
      piece.style.cursor = 'grabbing';
      piece.style.opacity = '0.8';
      piece.style.zIndex = '10000';
      
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = piece.getBoundingClientRect();
      const parentRect = piece.parentElement.getBoundingClientRect();
      initialLeft = rect.left - parentRect.left;
      initialTop = rect.top - parentRect.top;
      
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging || isPlaced) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      piece.style.left = (initialLeft + deltaX) + 'px';
      piece.style.top = (initialTop + deltaY) + 'px';
    });
    
  document.addEventListener('mouseup', () => {
      if (!isDragging || isPlaced) return;
      isDragging = false;
      piece.style.cursor = 'grab';
      piece.style.opacity = '1';
      piece.style.zIndex = '9999';
      
      const pieceNum = parseInt(piece.dataset.pieceNum);
    const target = $(`piece-${pieceNum}`);
      
      const pieceRect = piece.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      
      if (isOverlapping(pieceRect, targetRect)) {
        isPlaced = true;
      placePiece(piece, target, pieceNum);
      }
    });
  }
  
  function isOverlapping(rect1, rect2) {
  return !(rect1.right < rect2.left || rect1.left > rect2.right || 
           rect1.bottom < rect2.top || rect1.top > rect2.bottom);
}

function placePiece(piece, target, pieceNum) {
    placedFragments[pieceNum] = true;
    
    piece.style.position = 'absolute';
    piece.style.left = target.style.left;
    piece.style.top = target.style.top;
    piece.style.cursor = 'default';
    piece.style.zIndex = '9000';
    piece.style.opacity = '1';
    
    target.style.display = 'none';
    
    if (Object.keys(placedFragments).length === 9) {
      completeLetterPuzzle();
    }
  }
  
  function completeLetterPuzzle() {
    gameState.letterRepaired = true;
  gameState.gamePhase = 4;
  updateArchive('信件残片', '已修复。看起来是一封信...');
    
    letterDocument.innerHTML = '';
    
    const img = document.createElement('img');
    img.src = 'letter-complete.png';
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    `;
    letterDocument.appendChild(img);
  
  resetAllTools();
  
  const closeLetter = (e) => {
    if (e.target.id === 'game-container') {
      fadeOutRemove(letterDocument, () => {
        letterDocument = null;
        placedFragments = {};
        resetAllTools();
        switchBackgroundToOriginal();
        setTimeout(() => {
        booksIcon.style.display = 'block';
        setTimeout(() => booksIcon.style.opacity = '0.9', 100);
        }, 1700);
      });
      $('game-container').removeEventListener('click', closeLetter);
    }
  };
  $('game-container').addEventListener('click', closeLetter);
}

// ===== 第三关：图片切换 =====

function startImageSwitchingPhase() {
  gameState.gamePhase = 5;
  imageClickCount = 1;
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
  }, 500);
  
  // 先切换背景，等背景切换完成后再显示关卡内容
  switchBackgroundToLevel();
  setTimeout(() => {
    showSwitchingImage('1.png');
  }, 1700);
}

function showSwitchingImage(imageSrc) {
  if (!switchingImage) {
    switchingImage = document.createElement('div');
    switchingImage.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      height: 500px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.5s ease-in;
    `;
    workspace.appendChild(switchingImage);
    switchingImage.addEventListener('click', handleImageClick);
  }
  
  switchingImage.style.backgroundImage = `url('${imageSrc}')`;
  setTimeout(() => switchingImage.style.opacity = '1', 100);
}

function handleImageClick(e) {
  e.stopPropagation();
  if (imageClickCount === 1) {
    imageClickCount = 2;
    switchingImage.style.opacity = '0';
    setTimeout(() => showSwitchingImage('2.png'), 500);
  } else if (imageClickCount === 2) {
    switchingImage.remove();
    switchingImage = null;
    createOverlappingImages();
  }
}

function createOverlappingImages() {
  gameState.gamePhase = 6;
  
  image3Others = createImage('3others.png', '45%', '500px', '500', true);
  image3Lukas = createImage('3Lukas.png', '55%', '500px', '502', false);
  
  passOthers = createPassIcon('501', true);
  passLukas = createPassIcon('503', false);
  
  workspace.append(image3Others, image3Lukas, passOthers, passLukas);
    
    setTimeout(() => {
    [image3Others, image3Lukas, passOthers, passLukas].forEach(el => el.style.opacity = '1');
  }, 100);
  
  const closeImages = (e) => {
    if (e.target.id === 'game-container' || e.target.id === 'workspace') {
      // 必须先用tweezers收集stamp才能关闭
      if (!gameState.passCollected) {
        const warning = createDialog('Maybe you can do something...', {
          width: '400px',
          height: '150px',
          position: 'right',
          parent: document.body
        });
        warning.addEventListener('click', (e) => {
          e.stopPropagation();
          warning.remove();
        });
        autoRemoveDialog(warning, 3000);
        return;
      }
      
      closeOverlappingImages();
      $('game-container').removeEventListener('click', closeImages);
    }
  };
  $('game-container').addEventListener('click', closeImages);
}

function createImage(src, left, width, zIndex, clickable) {
  const img = document.createElement('div');
  img.style.cssText = `
    position: absolute;
    top: 50%;
    left: ${left};
    transform: translate(-50%, -50%);
    width: ${width};
    height: ${width};
    background-image: url('${src}');
    background-size: contain;
    background-repeat: no-repeat;
    cursor: ${clickable ? 'pointer' : 'default'};
    opacity: 0;
    transition: opacity 0.5s ease-in;
    z-index: ${zIndex};
    pointer-events: ${clickable ? 'auto' : 'none'};
  `;
  if (clickable) img.addEventListener('click', swapImageLayers);
  return img;
}

function createPassIcon(zIndex, isOthers) {
  const passContainer = document.createElement('div');
  passContainer.style.cssText = `
    position: absolute;
    top: 50%;
    left: ${isOthers ? '45%' : '55%'};
    transform: translate(-50%, -50%);
    width: 500px;
    height: 500px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    z-index: ${zIndex};
  `;
  
  const passImg = document.createElement('img');
  passImg.src = 'pass.png';
  passImg.style.cssText = `
    position: absolute;
    width: 150px;
    height: 150px;
    bottom: 30px;
    right: 50px;
    ${isOthers ? 'pointer-events: auto; cursor: pointer;' : ''}
  `;
  
  if (isOthers) {
    passImg.classList.add('glow-effect');
    passImg.addEventListener('click', collectPass);
  }
  
  passContainer.appendChild(passImg);
  return passContainer;
}

function swapImageLayers(e) {
  if (e) e.stopPropagation();
  
  const othersZ = parseInt(image3Others.style.zIndex);
  const lukasZ = parseInt(image3Lukas.style.zIndex);
  
  if (othersZ < lukasZ) {
    image3Others.style.zIndex = '502';
    image3Lukas.style.zIndex = '500';
    passOthers.style.zIndex = '503';
    passLukas.style.zIndex = '501';
    
    image3Others.removeEventListener('click', swapImageLayers);
    image3Others.style.cursor = 'default';
    image3Others.style.pointerEvents = 'none';
    image3Lukas.style.cursor = 'pointer';
    image3Lukas.style.pointerEvents = 'auto';
    image3Lukas.addEventListener('click', swapImageLayers);
  } else {
    image3Others.style.zIndex = '500';
    image3Lukas.style.zIndex = '502';
    passOthers.style.zIndex = '501';
    passLukas.style.zIndex = '503';
    
    image3Lukas.removeEventListener('click', swapImageLayers);
    image3Lukas.style.cursor = 'default';
    image3Lukas.style.pointerEvents = 'none';
    image3Others.style.cursor = 'pointer';
    image3Others.style.pointerEvents = 'auto';
    image3Others.addEventListener('click', swapImageLayers);
  }
}

function collectPass(e) {
  if (!gameState.isTweezersActive || gameState.passCollected) return;
  e.stopPropagation();
  
  gameState.passCollected = true;
  fadeOutRemove(passOthers);
  
  const dialog = createDialog('You got a <span style="color: #d32f2f;">stamp</span>!');
  dialog.addEventListener('click', (e) => {
    e.stopPropagation();
    dialog.remove();
  });
  autoRemoveDialog(dialog);
  
  passSlot.style.display = 'block';
  passSlot.addEventListener('click', () => selectTool('pass'));
}

function closeOverlappingImages() {
  gameState.gamePhase = 6;
  [image3Others, image3Lukas, passOthers, passLukas].forEach(el => fadeOutRemove(el));
  
  resetAllTools();
  switchBackgroundToOriginal();
  setTimeout(() => {
  booksIcon.style.display = 'block';
  setTimeout(() => booksIcon.style.opacity = '0.9', 100);
  }, 1700);
}

// ===== 第四关：Amelie Diary =====

function showAmelieDiary() {
  gameState.gamePhase = 7;
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
  }, 500);
  
  // 先切换背景，等背景切换完成后再显示关卡内容
  switchBackgroundToLevel();
  setTimeout(() => {
    
    amelieDiaryDocument = document.createElement('div');
    amelieDiaryDocument.id = 'amelie-diary-document';
    amelieDiaryDocument.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 800px;
      height: 800px;
      opacity: 0;
      transition: opacity 0.5s ease-in;
      z-index: 500;
    `;
    
    amelieDiaryClear = document.createElement('img');
    amelieDiaryClear.src = 'Amelie diary.png';
    amelieDiaryClear.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      object-fit: contain;
    `;
    
    amelieDiaryBlurred = document.createElement('img');
    amelieDiaryBlurred.src = 'Amelie diary.png';
    amelieDiaryBlurred.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: blur(8px);
      pointer-events: none;
    `;
    
    amelieDiaryDocument.append(amelieDiaryClear, amelieDiaryBlurred);
    workspace.appendChild(amelieDiaryDocument);
    
    amelieDiaryDocument.addEventListener('mousemove', handleMagnifierMove);
    amelieDiaryDocument.addEventListener('mouseleave', handleMagnifierLeave);
    
    setTimeout(() => amelieDiaryDocument.style.opacity = '1', 100);
    
    const closeDiary = (e) => {
      if (e.target.id === 'game-container') {
        gameState.gamePhase = 8;
        fadeOutRemove(amelieDiaryDocument, () => {
          amelieDiaryDocument.removeEventListener('mousemove', handleMagnifierMove);
          amelieDiaryDocument.removeEventListener('mouseleave', handleMagnifierLeave);
          amelieDiaryDocument = amelieDiaryClear = amelieDiaryBlurred = null;
          resetAllTools();
          switchBackgroundToOriginal();
          setTimeout(() => {
          booksIcon.style.display = 'block';
          setTimeout(() => booksIcon.style.opacity = '0.9', 100);
          }, 1700);
        });
        $('game-container').removeEventListener('click', closeDiary);
      }
    };
    $('game-container').addEventListener('click', closeDiary);
  }, 1700);
}

function handleMagnifierMove(e) {
  if (!amelieDiaryBlurred || !gameState.isMagnifierActive) {
    if (amelieDiaryBlurred) {
      amelieDiaryBlurred.style.maskImage = 'none';
      amelieDiaryBlurred.style.webkitMaskImage = 'none';
    }
    return;
  }
  
  const rect = amelieDiaryDocument.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const radius = 100;
  const maskValue = `radial-gradient(circle ${radius}px at ${x}px ${y}px, transparent 0, transparent ${radius}px, black ${radius + 20}px, black 100%)`;
  
  amelieDiaryBlurred.style.maskImage = maskValue;
  amelieDiaryBlurred.style.webkitMaskImage = maskValue;
}

function handleMagnifierLeave() {
  if (amelieDiaryBlurred) {
    amelieDiaryBlurred.style.maskImage = 'none';
    amelieDiaryBlurred.style.webkitMaskImage = 'none';
  }
}

// ===== 第五关：News =====

function startNewsPhase() {
  gameState.gamePhase = 9;
  newsImageClickCount = 1;
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
  }, 500);
  
  // 先切换背景，等背景切换完成后再显示关卡内容
  switchBackgroundToLevel();
  setTimeout(() => {
    showNewsSwitchingImage('1.png');
  }, 1700);
}

function showNewsSwitchingImage(imageSrc) {
  if (!newsSwitchingImage) {
    newsSwitchingImage = document.createElement('div');
    newsSwitchingImage.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      height: 500px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.5s ease-in;
    `;
    workspace.appendChild(newsSwitchingImage);
    newsSwitchingImage.addEventListener('click', handleNewsImageClick);
  }
  
  newsSwitchingImage.style.backgroundImage = `url('${imageSrc}')`;
  setTimeout(() => newsSwitchingImage.style.opacity = '1', 100);
}

function handleNewsImageClick(e) {
  e.stopPropagation();
  if (newsImageClickCount === 1) {
    newsImageClickCount = 2;
    newsSwitchingImage.style.opacity = '0';
    setTimeout(() => showNewsSwitchingImage('2.png'), 500);
  } else if (newsImageClickCount === 2) {
    newsSwitchingImage.remove();
    newsSwitchingImage = null;
    createNewsOverlappingImages();
  }
}

function createNewsOverlappingImages() {
  gameState.gamePhase = 10;
  
  // 创建 explode.png（底层，初始可点击）
  explodeImage = document.createElement('div');
  explodeImage.style.cssText = `
    position: absolute;
    top: 50%;
    left: 45%;
    transform: translate(-50%, -50%);
    width: 500px;
    height: 500px;
    background-image: url('explode.png');
    background-size: contain;
    background-repeat: no-repeat;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    z-index: 500;
    pointer-events: auto;
  `;
  explodeImage._clickHandler = createNewsClickHandler();
  explodeImage.addEventListener('click', explodeImage._clickHandler);
  
  // 创建 news.png 清晰层（上层，初始不可点击）
  newsImageClear = document.createElement('div');
  newsImageClear.style.cssText = `
    position: absolute;
    top: 50%;
    left: 55%;
    transform: translate(-50%, -50%);
    width: 800px;
    height: 800px;
    background-image: url('news.png');
    background-size: contain;
    background-repeat: no-repeat;
    cursor: default;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    z-index: 502;
    pointer-events: none;
  `;
  
  // 创建 news.png 模糊层（最上层）
  newsImageBlurred = document.createElement('div');
  newsImageBlurred.style.cssText = `
    position: absolute;
    top: 50%;
    left: 55%;
    transform: translate(-50%, -50%);
    width: 800px;
    height: 800px;
    background-image: url('news.png');
    background-size: contain;
    background-repeat: no-repeat;
    filter: blur(8px);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    z-index: 503;
  `;
  
  workspace.append(explodeImage, newsImageClear, newsImageBlurred);
  
  setTimeout(() => {
    explodeImage.style.opacity = '1';
    newsImageClear.style.opacity = '1';
    newsImageBlurred.style.opacity = '1';
  }, 100);
  
  workspace.addEventListener('mousemove', handleNewsOverlappingMagnifier);
  workspace.addEventListener('mouseleave', handleNewsOverlappingMagnifierLeave);
  
  const closeNews = (e) => {
    if (e.target.id === 'game-container' || e.target.id === 'workspace') {
      // 必须先盖章才能关闭
      const placedPasses = document.querySelectorAll('.placed-pass');
      if (placedPasses.length === 0) {
        const warning = createDialog('Maybe you can do something...', {
          width: '400px',
          height: '150px',
          position: 'right',
          parent: document.body
        });
        warning.addEventListener('click', (e) => {
          e.stopPropagation();
          warning.remove();
        });
        autoRemoveDialog(warning, 3000);
        return;
      }
      
      closeNewsOverlapping();
      $('game-container').removeEventListener('click', closeNews);
    }
  };
  $('game-container').addEventListener('click', closeNews);
}

function createNewsClickHandler() {
  return (e) => {
    if (gameState.isPassActive && gameState.passCollected) {
      e.stopPropagation();
      placePassStamp(e);
      return;
    }
    swapNewsLayers(e);
  };
}

function swapNewsLayers(e) {
  if (e) e.stopPropagation();
  
  const explodeZ = parseInt(explodeImage.style.zIndex);
  const newsZ = parseInt(newsImageClear.style.zIndex);
  
  if (explodeZ < newsZ) {
    explodeImage.style.zIndex = '502';
    newsImageClear.style.zIndex = '500';
    newsImageBlurred.style.zIndex = '501';
    
    explodeImage.removeEventListener('click', explodeImage._clickHandler);
    explodeImage.style.cursor = 'default';
    explodeImage.style.pointerEvents = 'none';
    
    newsImageClear.style.cursor = 'pointer';
    newsImageClear.style.pointerEvents = 'auto';
    newsImageClear._clickHandler = createNewsClickHandler();
    newsImageClear.addEventListener('click', newsImageClear._clickHandler);
  } else {
    explodeImage.style.zIndex = '500';
    newsImageClear.style.zIndex = '502';
    newsImageBlurred.style.zIndex = '503';
    
    newsImageClear.removeEventListener('click', newsImageClear._clickHandler);
    newsImageClear.style.cursor = 'default';
    newsImageClear.style.pointerEvents = 'none';
    
    explodeImage.style.cursor = 'pointer';
    explodeImage.style.pointerEvents = 'auto';
    explodeImage._clickHandler = createNewsClickHandler();
    explodeImage.addEventListener('click', explodeImage._clickHandler);
  }
  
  // 更新 pass 的层级
  updatePassLayersAfterSwap();
}

function handleNewsOverlappingMagnifier(e) {
  if (!newsImageBlurred || !gameState.isMagnifierActive) {
    if (newsImageBlurred) {
      newsImageBlurred.style.maskImage = 'none';
      newsImageBlurred.style.webkitMaskImage = 'none';
    }
    return;
  }
  
  const rect = newsImageClear.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const radius = 100;
  const maskValue = `radial-gradient(circle ${radius}px at ${x}px ${y}px, transparent 0, transparent ${radius}px, black ${radius + 20}px, black 100%)`;
  
  newsImageBlurred.style.maskImage = maskValue;
  newsImageBlurred.style.webkitMaskImage = maskValue;
}

function handleNewsOverlappingMagnifierLeave() {
  if (newsImageBlurred) {
    newsImageBlurred.style.maskImage = 'none';
    newsImageBlurred.style.webkitMaskImage = 'none';
  }
}

function closeNewsOverlapping() {
  gameState.gamePhase = 11;
  
  const placedPasses = document.querySelectorAll('.placed-pass');
  placedPasses.forEach(pass => {
    pass.style.transition = 'opacity 0.5s ease-out';
    pass.style.opacity = '0';
  });
  
  [explodeImage, newsImageClear, newsImageBlurred].forEach(el => fadeOutRemove(el));
  
  setTimeout(() => {
    workspace.removeEventListener('mousemove', handleNewsOverlappingMagnifier);
    workspace.removeEventListener('mouseleave', handleNewsOverlappingMagnifierLeave);
    placedPasses.forEach(pass => pass.remove());
    explodeImage = newsImageClear = newsImageBlurred = null;
    
    resetAllTools();
    switchBackgroundToOriginal();
    setTimeout(() => {
    booksIcon.style.display = 'block';
    setTimeout(() => booksIcon.style.opacity = '0.9', 100);
    }, 1700);
  }, 500);
}

// ===== 第六关：Lukas Diary 拼图（无对话框）=====

function startLukasDiaryPuzzle() {
  gameState.gamePhase = 12;
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
  }, 500);
  
  // 先切换背景，等背景切换完成后再显示关卡内容
  switchBackgroundToLevel();
  setTimeout(() => {
    initLukasDiaryPuzzle();
  }, 1700);
}

function initLukasDiaryPuzzle() {
  const containerWidth = 800;
  const containerHeight = 800;
  const fragmentSize = 200;
  
  // 确定当前要显示的拼图
  let currentImage;
  if (currentLukasPuzzle === 1) {
    currentImage = 'lukas diary.png';
  } else if (currentLukasPuzzle === 2) {
    currentImage = 'lukas diary2.png';
  } else {
    currentImage = 'lukas diary3.png';
  }
  
  lukasDiaryDocument = document.createElement('div');
  lukasDiaryDocument.id = 'lukas-diary-document';
  lukasDiaryDocument.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: ${containerWidth}px;
    height: ${containerHeight}px;
    z-index: 500;
    opacity: 0;
    animation: fadeIn 1s ease-out forwards;
  `;
  workspace.appendChild(lukasDiaryDocument);
  
  const puzzlePositions = [
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
    { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }
  ];
  
  const offsetX = (containerWidth - fragmentSize * 3) / 2;
  const offsetY = 50;
  
  // 创建目标格子
  for (let i = 0; i < 9; i++) {
    const pos = puzzlePositions[i];
    const target = document.createElement('div');
    target.className = 'fragment-target';
    target.id = `lukas-piece-${i}`;
    target.dataset.correctPiece = i;
    target.style.cssText = `
      position: absolute;
      top: ${offsetY + pos.row * fragmentSize}px;
      left: ${offsetX + pos.col * fragmentSize}px;
      width: ${fragmentSize}px;
      height: ${fragmentSize}px;
      outline: 1px dashed rgba(255, 255, 255, 0.3);
      outline-offset: -1px;
    `;
    lukasDiaryDocument.appendChild(target);
  }
  
  // 创建拼图块（随机打乱）
  const pieces = [...Array(9).keys()];
  const positions = [...Array(9).keys()];
  positions.sort(() => Math.random() - 0.5);
  
  pieces.forEach((pieceNum, index) => {
    const piece = document.createElement('div');
    piece.className = 'draggable-fragment';
    piece.id = `draggable-lukas-piece-${pieceNum}`;
    piece.dataset.pieceNum = pieceNum;
    
    const pos = puzzlePositions[pieceNum];
    const bgX = (pos.col / 2) * 100;
    const bgY = (pos.row / 2) * 100;
    
    const randomPos = puzzlePositions[positions[index]];
    const leftPos = offsetX + randomPos.col * fragmentSize;
    const topPos = offsetY + randomPos.row * fragmentSize;
    
    piece.style.cssText = `
      position: absolute;
      left: ${leftPos}px;
      top: ${topPos}px;
      width: ${fragmentSize}px;
      height: ${fragmentSize}px;
      background-image: url('${currentImage}');
      background-size: 300% 300%;
      background-position: ${bgX}% ${bgY}%;
      cursor: grab;
      z-index: 9999;
      box-shadow: 3px 3px 10px rgba(0,0,0,0.5);
    `;
    
    makeLukasPieceDraggable(piece);
    lukasDiaryDocument.appendChild(piece);
  });
}

function makeLukasPieceDraggable(piece) {
  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  let isPlaced = false;
  
  piece.addEventListener('mousedown', (e) => {
    if (isPlaced || !gameState.isTapeActive) return;
    isDragging = true;
    piece.style.cursor = 'grabbing';
    piece.style.opacity = '0.8';
    piece.style.zIndex = '10000';
    startX = e.clientX;
    startY = e.clientY;
    const rect = piece.getBoundingClientRect();
    const parentRect = piece.parentElement.getBoundingClientRect();
    initialLeft = rect.left - parentRect.left;
    initialTop = rect.top - parentRect.top;
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging || isPlaced) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    piece.style.left = (initialLeft + deltaX) + 'px';
    piece.style.top = (initialTop + deltaY) + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    if (!isDragging || isPlaced) return;
    isDragging = false;
    piece.style.cursor = 'grab';
    piece.style.opacity = '1';
    piece.style.zIndex = '9999';
    const pieceNum = parseInt(piece.dataset.pieceNum);
    const target = $(`lukas-piece-${pieceNum}`);
    const pieceRect = piece.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (!(pieceRect.right < targetRect.left || pieceRect.left > targetRect.right || 
          pieceRect.bottom < targetRect.top || pieceRect.top > targetRect.bottom)) {
      isPlaced = true;
      placeLukasPiece(piece, target, pieceNum);
    }
  });
}

function placeLukasPiece(piece, target, pieceNum) {
  lukasDiaryFragments[pieceNum] = true;
  
  piece.style.position = 'absolute';
  piece.style.left = target.style.left;
  piece.style.top = target.style.top;
  piece.style.cursor = 'default';
  piece.style.zIndex = '9000';
  piece.style.opacity = '1';
  target.style.display = 'none';
  
  // 检查当前拼图是否完成
  if (Object.keys(lukasDiaryFragments).length === 9) {
    showCompletedLukasPuzzle();
  }
}

function showCompletedLukasPuzzle() {
  // 显示当前完成的拼图完整图片
  resetAllTools();
  lukasDiaryDocument.innerHTML = '';
  
  let currentImage;
  if (currentLukasPuzzle === 1) {
    currentImage = 'lukas diary.png';
  } else if (currentLukasPuzzle === 2) {
    currentImage = 'lukas diary2.png';
  } else {
    currentImage = 'lukas diary3.png';
  }
  
  const img = document.createElement('img');
  img.src = currentImage;
  img.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    cursor: pointer;
  `;
  
  // 点击完整图片进入下一个拼图或显示重叠图片
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentLukasPuzzle < 3) {
      // 进入下一个拼图
      fadeOutRemove(lukasDiaryDocument, () => {
        lukasDiaryDocument = null;
        lukasDiaryFragments = {};
        currentLukasPuzzle++;
        initLukasDiaryPuzzle();
      });
    } else {
      // 所有拼图完成，显示重叠摆放的图片
      completeLukasDiaryPuzzle();
    }
  });
  
  lukasDiaryDocument.appendChild(img);
}

function completeLukasDiaryPuzzle() {
  gameState.gamePhase = 13;
  updateArchive('Lukas日记残片', '已修复。这是Lukas的三页日记...');
  
  // 移除拼图，清空工作区
      fadeOutRemove(lukasDiaryDocument, () => {
        lukasDiaryDocument = null;
    
    // 显示噪点效果
    showNoiseEffect(() => {
      // 噪点效果结束后，创建三张部分重叠的图片
      // 从右到左依次是：lukas diary.png, lukas diary2.png, lukas diary3.png
      // lukas diary.png 在最上方，lukas diary3.png 在最下方
      lukasImage1 = createLukasImage('lukas diary.png', '504', 200, 0);
      lukasImage2 = createLukasImage('lukas diary2.png', '502', 0, 0);
      lukasImage3 = createLukasImage('lukas diary3.png', '500', -200, 0);
      
      workspace.append(lukasImage1, lukasImage2, lukasImage3);
      
      setTimeout(() => {
        [lukasImage1, lukasImage2, lukasImage3].forEach(el => el.style.opacity = '1');
      }, 100);
    });
  });
  
  resetAllTools();
  
  const closeLukasDiary = (e) => {
    if (e.target.id === 'game-container' || e.target.id === 'workspace') {
      closeLukasOverlappingImages();
      $('game-container').removeEventListener('click', closeLukasDiary);
    }
  };
  $('game-container').addEventListener('click', closeLukasDiary);
}

function showNoiseEffect(callback) {
  // 创建暗角效果层
  vignetteLayer = document.createElement('div');
  vignetteLayer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.7) 70%, rgba(0, 0, 0, 0.95) 100%);
    z-index: 600;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.8s ease-in;
  `;
  
  document.body.appendChild(vignetteLayer);
  
  // 显示暗角效果
  setTimeout(() => {
    vignetteLayer.style.opacity = '1';
  }, 50);
  
  // 暗角显示完成后执行回调
  setTimeout(() => {
    if (callback) callback();
  }, 850);
}

function createLukasImage(src, zIndex, offsetX, offsetY) {
  const img = document.createElement('div');
  img.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px));
    width: 600px;
    height: 600px;
    background-image: url('${src}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    cursor: pointer;
    opacity: 0;
    transition: all 0.3s ease-in-out;
    z-index: ${zIndex};
    pointer-events: auto;
  `;
  img.addEventListener('click', (e) => bringLukasImageToFront(img, e));
  return img;
}

function bringLukasImageToFront(clickedImage, e) {
  if (e) e.stopPropagation();
  
  // 获取当前所有图片的 z-index
  const z1 = parseInt(lukasImage1.style.zIndex);
  const z2 = parseInt(lukasImage2.style.zIndex);
  const z3 = parseInt(lukasImage3.style.zIndex);
  const maxZ = Math.max(z1, z2, z3);
  
  // 如果点击的图片已经在最上层，不做任何操作
  const currentZ = parseInt(clickedImage.style.zIndex);
  if (currentZ === maxZ) return;
  
  // 将点击的图片设置为最高 z-index
  clickedImage.style.zIndex = (maxZ + 2).toString();
}

function closeLukasOverlappingImages() {
  gameState.gamePhase = 13;
  [lukasImage1, lukasImage2, lukasImage3].forEach(el => fadeOutRemove(el));
  
  // 暗角效果保持不移除
  
        lukasDiaryFragments = {};
  currentLukasPuzzle = 1;
        resetAllTools();
        switchBackgroundToOriginal();
  setTimeout(() => {
        booksIcon.style.display = 'block';
        setTimeout(() => booksIcon.style.opacity = '0.9', 100);
  }, 1700);
}

// ===== Amelie Letter 拼图关卡（带模糊层）=====

function startAmelieLetterPuzzle() {
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
  }, 500);
  
  // 显示确认对话框
  showAmelieLetterConfirmDialog();
}

function showAmelieLetterConfirmDialog() {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-image: url('dialogue.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    padding: 3rem 2.5rem;
    z-index: 10000;
    width: 500px;
    min-height: 200px;
    font-family: 'Indie Flower', cursive;
    color: #2a2520;
    font-size: 1.3rem;
    line-height: 1.6;
    text-align: center;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `;
  
  const text = document.createElement('p');
  text.textContent = 'It appears to be a letter that was deliberately damaged. Are you sure you want to repair it?';
  text.style.marginBottom = '1.5rem';
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 2rem;
    justify-content: center;
  `;
  
  const yesButton = document.createElement('span');
  yesButton.textContent = 'Yes';
  yesButton.style.cssText = `
    font-family: 'Indie Flower', cursive;
    font-size: 1.4rem;
    color: #2a2520;
    cursor: pointer;
    transition: all 0.3s;
    text-decoration: underline;
  `;
  yesButton.onmouseover = () => {
    yesButton.style.color = '#000';
    yesButton.style.transform = 'scale(1.1)';
    yesButton.style.fontWeight = 'bold';
  };
  yesButton.onmouseout = () => {
    yesButton.style.color = '#2a2520';
    yesButton.style.transform = 'scale(1)';
    yesButton.style.fontWeight = 'normal';
  };
  
  const noButton = document.createElement('span');
  noButton.textContent = 'No';
  noButton.style.cssText = `
    font-family: 'Indie Flower', cursive;
    font-size: 1.4rem;
    color: #d32f2f;
    cursor: pointer;
    transition: all 0.3s;
    text-decoration: underline;
  `;
  noButton.onmouseover = () => {
    noButton.style.color = '#a02020';
    noButton.style.transform = 'scale(1.1)';
    noButton.style.fontWeight = 'bold';
  };
  noButton.onmouseout = () => {
    noButton.style.color = '#d32f2f';
    noButton.style.transform = 'scale(1)';
    noButton.style.fontWeight = 'normal';
  };
  
  yesButton.addEventListener('click', (e) => {
    e.stopPropagation();
    fadeOutRemove(dialog, () => {
      gameState.gamePhase = 14;
      switchBackgroundToLevel();
      setTimeout(() => {
        initAmelieLetterPuzzle();
      }, 1700);
    });
  });
  
  noButton.addEventListener('click', (e) => {
    e.stopPropagation();
    gameState.amelieLetterDeclined = true;
    fadeOutRemove(dialog, () => {
      booksIcon.style.display = 'block';
      setTimeout(() => booksIcon.style.opacity = '0.9', 100);
    });
  });
  
  buttonContainer.append(yesButton, noButton);
  dialog.append(text, buttonContainer);
  $('game-container').appendChild(dialog);
  
  setTimeout(() => dialog.style.opacity = '1', 100);
}

function initAmelieLetterPuzzle() {
  const containerWidth = 800;
  const containerHeight = 800;
  const fragmentSize = 150; // 4×4拼图，每块更小
  
  amelieLetterDocument = document.createElement('div');
  amelieLetterDocument.id = 'amelie-letter-document';
  amelieLetterDocument.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: ${containerWidth}px;
    height: ${containerHeight}px;
    z-index: 500;
    opacity: 0;
    animation: fadeIn 1s ease-out forwards;
  `;
  workspace.appendChild(amelieLetterDocument);
  
  // 4×4的拼图位置
  const puzzlePositions = [
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
    { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
    { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }
  ];
  
  const offsetX = (containerWidth - fragmentSize * 4) / 2;
  const offsetY = (containerHeight - fragmentSize * 4) / 2;
  
  // 创建目标格子
  for (let i = 0; i < 16; i++) {
    const pos = puzzlePositions[i];
    const target = document.createElement('div');
    target.className = 'fragment-target';
    target.id = `amelie-letter-piece-${i}`;
    target.dataset.correctPiece = i;
    target.style.cssText = `
      position: absolute;
      top: ${offsetY + pos.row * fragmentSize}px;
      left: ${offsetX + pos.col * fragmentSize}px;
      width: ${fragmentSize}px;
      height: ${fragmentSize}px;
      outline: 1px dashed rgba(255, 255, 255, 0.3);
      outline-offset: -1px;
    `;
    amelieLetterDocument.appendChild(target);
  }
  
  // 创建拼图块（随机打乱）
  const pieces = [...Array(16).keys()];
  const positions = [...Array(16).keys()];
  positions.sort(() => Math.random() - 0.5);
  
  pieces.forEach((pieceNum, index) => {
    const pos = puzzlePositions[pieceNum];
    const bgX = (pos.col / 3) * 100;
    const bgY = (pos.row / 3) * 100;
    
    const randomPos = puzzlePositions[positions[index]];
    const leftPos = offsetX + randomPos.col * fragmentSize;
    const topPos = offsetY + randomPos.row * fragmentSize;
    
    // 创建拼图块容器
    const pieceContainer = document.createElement('div');
    pieceContainer.className = 'draggable-fragment';
    pieceContainer.id = `draggable-amelie-letter-piece-${pieceNum}`;
    pieceContainer.dataset.pieceNum = pieceNum;
    pieceContainer.style.cssText = `
      position: absolute;
      left: ${leftPos}px;
      top: ${topPos}px;
      width: ${fragmentSize}px;
      height: ${fragmentSize}px;
      cursor: grab;
      z-index: 9999;
      box-shadow: 3px 3px 10px rgba(0,0,0,0.5);
    `;
    
    // 清晰层
    const clearLayer = document.createElement('div');
    clearLayer.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      background-image: url('Amelie letter.png');
      background-size: 400% 400%;
      background-position: ${bgX}% ${bgY}%;
    `;
    
    // 模糊层
    const blurredLayer = document.createElement('div');
    blurredLayer.className = 'piece-blurred-layer';
    blurredLayer.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      background-image: url('Amelie letter.png');
      background-size: 400% 400%;
      background-position: ${bgX}% ${bgY}%;
      filter: blur(8px);
      pointer-events: none;
    `;
    
    pieceContainer.append(clearLayer, blurredLayer);
    
    makeAmelieLetterPieceDraggable(pieceContainer);
    amelieLetterDocument.appendChild(pieceContainer);
  });
  
  // 添加放大镜效果
  amelieLetterDocument.addEventListener('mousemove', handleAmelieLetterMagnifier);
  amelieLetterDocument.addEventListener('mouseleave', handleAmelieLetterMagnifierLeave);
}

function makeAmelieLetterPieceDraggable(piece) {
  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  let isPlaced = false;
  
  piece.addEventListener('mousedown', (e) => {
    if (isPlaced || !gameState.isTapeActive) return;
    isDragging = true;
    piece.style.cursor = 'grabbing';
    piece.style.opacity = '0.8';
    piece.style.zIndex = '10000';
    startX = e.clientX;
    startY = e.clientY;
    const rect = piece.getBoundingClientRect();
    const parentRect = piece.parentElement.getBoundingClientRect();
    initialLeft = rect.left - parentRect.left;
    initialTop = rect.top - parentRect.top;
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging || isPlaced) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    piece.style.left = (initialLeft + deltaX) + 'px';
    piece.style.top = (initialTop + deltaY) + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    if (!isDragging || isPlaced) return;
    isDragging = false;
    piece.style.cursor = 'grab';
    piece.style.opacity = '1';
    piece.style.zIndex = '9999';
    const pieceNum = parseInt(piece.dataset.pieceNum);
    const target = $(`amelie-letter-piece-${pieceNum}`);
    const pieceRect = piece.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (!(pieceRect.right < targetRect.left || pieceRect.left > targetRect.right || 
          pieceRect.bottom < targetRect.top || pieceRect.top > targetRect.bottom)) {
      isPlaced = true;
      placeAmelieLetterPiece(piece, target, pieceNum);
    }
  });
}

function placeAmelieLetterPiece(piece, target, pieceNum) {
  amelieLetterFragments[pieceNum] = true;
  
  piece.style.position = 'absolute';
  piece.style.left = target.style.left;
  piece.style.top = target.style.top;
  piece.style.cursor = 'default';
  piece.style.zIndex = '9000';
  piece.style.opacity = '1';
  target.style.display = 'none';
  
  if (Object.keys(amelieLetterFragments).length === 16) {
    completeAmelieLetterPuzzle();
  }
}

function completeAmelieLetterPuzzle() {
  gameState.gamePhase = 15;
  updateArchive('Amelie信件残片', '已修复。这是一封信...');
  
  resetAllTools();
  
  // 移除放大镜事件（因为拼图块的放大镜不再适用）
  amelieLetterDocument.removeEventListener('mousemove', handleAmelieLetterMagnifier);
  amelieLetterDocument.removeEventListener('mouseleave', handleAmelieLetterMagnifierLeave);
  
  // 移除所有拼图块和目标格子
  const fragments = amelieLetterDocument.querySelectorAll('.draggable-fragment, .fragment-target');
  fragments.forEach(el => el.remove());
  
  // 让暗角变得更暗
  if (vignetteLayer) {
    vignetteLayer.style.transition = 'background 1s ease-in-out';
    vignetteLayer.style.background = 'radial-gradient(circle at center, transparent 20%, rgba(0, 0, 0, 0.85) 60%, rgba(0, 0, 0, 0.98) 100%)';
  }
  
  // 创建完整的带模糊层的图片
  const amelieLetterClear = document.createElement('img');
  amelieLetterClear.src = 'Amelie letter.png';
  amelieLetterClear.style.cssText = `
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: contain;
  `;
  
  const amelieLetterBlurred = document.createElement('img');
  amelieLetterBlurred.src = 'Amelie letter.png';
  amelieLetterBlurred.className = 'amelie-letter-complete-blurred';
  amelieLetterBlurred.style.cssText = `
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: blur(8px);
    pointer-events: none;
  `;
  
  amelieLetterDocument.append(amelieLetterClear, amelieLetterBlurred);
  
  // 添加完整图片的放大镜效果
  amelieLetterDocument.addEventListener('mousemove', handleAmelieLetterCompleteMagnifier);
  amelieLetterDocument.addEventListener('mouseleave', handleAmelieLetterCompleteMagnifierLeave);
  
  const closeLetter = (e) => {
    if (e.target.id === 'game-container') {
      gameState.gamePhase = 15;
      fadeOutRemove(amelieLetterDocument, () => {
        amelieLetterDocument.removeEventListener('mousemove', handleAmelieLetterCompleteMagnifier);
        amelieLetterDocument.removeEventListener('mouseleave', handleAmelieLetterCompleteMagnifierLeave);
        amelieLetterDocument = null;
        amelieLetterFragments = {};
        resetAllTools();
        switchBackgroundToOriginal();
        setTimeout(() => {
          booksIcon.style.display = 'block';
          setTimeout(() => booksIcon.style.opacity = '0.9', 100);
        }, 1700);
      });
      $('game-container').removeEventListener('click', closeLetter);
    }
  };
  $('game-container').addEventListener('click', closeLetter);
}

function handleAmelieLetterCompleteMagnifier(e) {
  const amelieLetterBlurred = amelieLetterDocument.querySelector('.amelie-letter-complete-blurred');
  if (!amelieLetterBlurred || !gameState.isMagnifierActive) {
    if (amelieLetterBlurred) {
      amelieLetterBlurred.style.maskImage = 'none';
      amelieLetterBlurred.style.webkitMaskImage = 'none';
    }
    return;
  }
  
  const rect = amelieLetterDocument.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const radius = 100;
  const maskValue = `radial-gradient(circle ${radius}px at ${x}px ${y}px, transparent 0, transparent ${radius}px, black ${radius + 20}px, black 100%)`;
  
  amelieLetterBlurred.style.maskImage = maskValue;
  amelieLetterBlurred.style.webkitMaskImage = maskValue;
}

function handleAmelieLetterCompleteMagnifierLeave() {
  const amelieLetterBlurred = amelieLetterDocument.querySelector('.amelie-letter-complete-blurred');
  if (amelieLetterBlurred) {
    amelieLetterBlurred.style.maskImage = 'none';
    amelieLetterBlurred.style.webkitMaskImage = 'none';
  }
}

function handleAmelieLetterMagnifier(e) {
  if (!gameState.isMagnifierActive) {
    // 清除所有模糊层的mask
    const blurredLayers = amelieLetterDocument.querySelectorAll('.piece-blurred-layer');
    blurredLayers.forEach(layer => {
      layer.style.maskImage = 'none';
      layer.style.webkitMaskImage = 'none';
    });
    return;
  }
  
  const radius = 100;
  
  // 对每个拼图块应用放大镜效果
  const pieces = amelieLetterDocument.querySelectorAll('.draggable-fragment');
  pieces.forEach(piece => {
    const blurredLayer = piece.querySelector('.piece-blurred-layer');
    if (!blurredLayer) return;
    
    const pieceRect = piece.getBoundingClientRect();
    const x = e.clientX - pieceRect.left;
    const y = e.clientY - pieceRect.top;
    
    // 检查鼠标是否在拼图块内
    if (x >= 0 && x <= pieceRect.width && y >= 0 && y <= pieceRect.height) {
      const maskValue = `radial-gradient(circle ${radius}px at ${x}px ${y}px, transparent 0, transparent ${radius}px, black ${radius + 20}px, black 100%)`;
      blurredLayer.style.maskImage = maskValue;
      blurredLayer.style.webkitMaskImage = maskValue;
    } else {
      blurredLayer.style.maskImage = 'none';
      blurredLayer.style.webkitMaskImage = 'none';
    }
  });
}

function handleAmelieLetterMagnifierLeave() {
  const blurredLayers = amelieLetterDocument.querySelectorAll('.piece-blurred-layer');
  blurredLayers.forEach(layer => {
    layer.style.maskImage = 'none';
    layer.style.webkitMaskImage = 'none';
  });
}

// ===== Lukas Diary Final 拼图关卡（4×4）=====

function startLukasDiaryFinalPuzzle() {
  gameState.gamePhase = 16;
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
  }, 500);
  
  // 先切换背景，等背景切换完成后再显示关卡内容
  switchBackgroundToLevel();
  setTimeout(() => {
    initLukasDiaryFinalPuzzle();
  }, 1700);
}

function initLukasDiaryFinalPuzzle() {
  const containerWidth = 800;
  const containerHeight = 800;
  const fragmentSize = 150; // 4×4拼图，每块150px
  
  lukasDiaryFinalDocument = document.createElement('div');
  lukasDiaryFinalDocument.id = 'lukas-diary-final-document';
  lukasDiaryFinalDocument.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: ${containerWidth}px;
    height: ${containerHeight}px;
    z-index: 500;
    opacity: 0;
    animation: fadeIn 1s ease-out forwards;
  `;
  workspace.appendChild(lukasDiaryFinalDocument);
  
  // 4×4的拼图位置
  const puzzlePositions = [
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
    { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
    { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }
  ];
  
  const offsetX = (containerWidth - fragmentSize * 4) / 2;
  const offsetY = (containerHeight - fragmentSize * 4) / 2;
  
  // 创建目标格子
  for (let i = 0; i < 16; i++) {
    const pos = puzzlePositions[i];
    const target = document.createElement('div');
    target.className = 'fragment-target';
    target.id = `lukas-final-piece-${i}`;
    target.dataset.correctPiece = i;
    target.style.cssText = `
      position: absolute;
      top: ${offsetY + pos.row * fragmentSize}px;
      left: ${offsetX + pos.col * fragmentSize}px;
      width: ${fragmentSize}px;
      height: ${fragmentSize}px;
      outline: 1px dashed rgba(255, 255, 255, 0.3);
      outline-offset: -1px;
    `;
    lukasDiaryFinalDocument.appendChild(target);
  }
  
  // 创建拼图块（随机打乱）
  const pieces = [...Array(16).keys()];
  const positions = [...Array(16).keys()];
  positions.sort(() => Math.random() - 0.5);
  
  pieces.forEach((pieceNum, index) => {
    const pos = puzzlePositions[pieceNum];
    const bgX = (pos.col / 3) * 100;
    const bgY = (pos.row / 3) * 100;
    
    const randomPos = puzzlePositions[positions[index]];
    const leftPos = offsetX + randomPos.col * fragmentSize;
    const topPos = offsetY + randomPos.row * fragmentSize;
    
    const piece = document.createElement('div');
    piece.className = 'draggable-fragment';
    piece.id = `draggable-lukas-final-piece-${pieceNum}`;
    piece.dataset.pieceNum = pieceNum;
    piece.style.cssText = `
      position: absolute;
      left: ${leftPos}px;
      top: ${topPos}px;
      width: ${fragmentSize}px;
      height: ${fragmentSize}px;
      background-image: url('lukasdiaryfinal.png');
      background-size: 400% 400%;
      background-position: ${bgX}% ${bgY}%;
      cursor: grab;
      z-index: 9999;
      box-shadow: 3px 3px 10px rgba(0,0,0,0.5);
    `;
    
    makeLukasDiaryFinalPieceDraggable(piece);
    lukasDiaryFinalDocument.appendChild(piece);
  });
}

function makeLukasDiaryFinalPieceDraggable(piece) {
  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  let isPlaced = false;
  
  piece.addEventListener('mousedown', (e) => {
    if (isPlaced || !gameState.isTapeActive) return;
    isDragging = true;
    piece.style.cursor = 'grabbing';
    piece.style.opacity = '0.8';
    piece.style.zIndex = '10000';
    startX = e.clientX;
    startY = e.clientY;
    const rect = piece.getBoundingClientRect();
    const parentRect = piece.parentElement.getBoundingClientRect();
    initialLeft = rect.left - parentRect.left;
    initialTop = rect.top - parentRect.top;
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging || isPlaced) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    piece.style.left = (initialLeft + deltaX) + 'px';
    piece.style.top = (initialTop + deltaY) + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    if (!isDragging || isPlaced) return;
    isDragging = false;
    piece.style.cursor = 'grab';
    piece.style.opacity = '1';
    piece.style.zIndex = '9999';
    const pieceNum = parseInt(piece.dataset.pieceNum);
    const target = $(`lukas-final-piece-${pieceNum}`);
    const pieceRect = piece.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (!(pieceRect.right < targetRect.left || pieceRect.left > targetRect.right || 
          pieceRect.bottom < targetRect.top || pieceRect.top > targetRect.bottom)) {
      isPlaced = true;
      placeLukasDiaryFinalPiece(piece, target, pieceNum);
    }
  });
}

function placeLukasDiaryFinalPiece(piece, target, pieceNum) {
  lukasDiaryFinalFragments[pieceNum] = true;
  
  piece.style.position = 'absolute';
  piece.style.left = target.style.left;
  piece.style.top = target.style.top;
  piece.style.cursor = 'default';
  piece.style.zIndex = '9000';
  piece.style.opacity = '1';
  target.style.display = 'none';
  
  if (Object.keys(lukasDiaryFinalFragments).length === 16) {
    completeLukasDiaryFinalPuzzle();
  }
}

function completeLukasDiaryFinalPuzzle() {
  gameState.gamePhase = 17;
  updateArchive('Lukas最终日记', '已修复。这是Lukas的最后一页日记...');
  
  resetAllTools();
  lukasDiaryFinalDocument.innerHTML = '';
  
  const img = document.createElement('img');
  img.src = 'lukasdiaryfinal.png';
  img.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  `;
  
  lukasDiaryFinalDocument.appendChild(img);
  
  const closeFinalDiary = (e) => {
    if (e.target.id === 'game-container') {
      fadeOutRemove(lukasDiaryFinalDocument, () => {
        lukasDiaryFinalDocument = null;
        lukasDiaryFinalFragments = {};
        resetAllTools();
        switchBackgroundToOriginal();
        setTimeout(() => {
          booksIcon.style.display = 'block';
          setTimeout(() => booksIcon.style.opacity = '0.9', 100);
        }, 1700);
      });
      $('game-container').removeEventListener('click', closeFinalDiary);
    }
  };
  $('game-container').addEventListener('click', closeFinalDiary);
}

// ===== Amelie Diary Final 图片切换关卡 =====

function startAmelieDiaryFinalSwitching() {
  gameState.gamePhase = 18;
  amelieDiaryFinalClickCount = 1;
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
  }, 500);
  
  // 先切换背景，等背景切换完成后再显示关卡内容
  switchBackgroundToLevel();
  setTimeout(() => {
    showAmelieDiaryFinalSwitchingImage('1-.png');
  }, 1700);
}

function showAmelieDiaryFinalSwitchingImage(imageSrc) {
  if (!amelieDiaryFinalSwitchingImage) {
    amelieDiaryFinalSwitchingImage = document.createElement('div');
    amelieDiaryFinalSwitchingImage.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      height: 600px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.5s ease-in;
      z-index: 500;
    `;
    workspace.appendChild(amelieDiaryFinalSwitchingImage);
    amelieDiaryFinalSwitchingImage.addEventListener('click', handleAmelieDiaryFinalImageClick);
  }
  
  amelieDiaryFinalSwitchingImage.style.backgroundImage = `url('${imageSrc}')`;
  setTimeout(() => amelieDiaryFinalSwitchingImage.style.opacity = '1', 100);
}

function handleAmelieDiaryFinalImageClick(e) {
  e.stopPropagation();
  if (amelieDiaryFinalClickCount === 1) {
    amelieDiaryFinalClickCount = 2;
    amelieDiaryFinalSwitchingImage.style.opacity = '0';
    setTimeout(() => showAmelieDiaryFinalSwitchingImage('2-.png'), 500);
  } else if (amelieDiaryFinalClickCount === 2) {
    amelieDiaryFinalClickCount = 3;
    // 移除切换图片容器
    fadeOutRemove(amelieDiaryFinalSwitchingImage, () => {
      amelieDiaryFinalSwitchingImage = null;
      // 创建两张重叠的图片
      createAmelieDiaryFinalOverlappingImages();
    });
  }
}

function createAmelieDiaryFinalOverlappingImages() {
  gameState.gamePhase = 19;
  updateArchive('Amelie最终日记', '这是Amelie的最后一页日记...');
  
  // 让暗角变得更暗
  if (vignetteLayer) {
    vignetteLayer.style.transition = 'background 1s ease-in-out';
    vignetteLayer.style.background = 'radial-gradient(circle at center, transparent 15%, rgba(0, 0, 0, 0.9) 55%, rgba(0, 0, 0, 0.99) 100%)';
  }
  
  // 创建 Amelie diary final.png（左侧，初始在上层）
  amelieDiaryFinalImage = document.createElement('div');
  amelieDiaryFinalImage.style.cssText = `
    position: absolute;
    top: 50%;
    left: 45%;
    transform: translate(-50%, -50%);
    width: 600px;
    height: 600px;
    background-image: url('Amelie diary final.png');
    background-size: contain;
    background-repeat: no-repeat;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    z-index: 502;
    pointer-events: auto;
  `;
  amelieDiaryFinalImage.addEventListener('click', swapAmelieFinalLayers);
  
  // 创建 news2.png（右侧，初始在下层）
  news2Image = document.createElement('div');
  news2Image.style.cssText = `
    position: absolute;
    top: 50%;
    left: 55%;
    transform: translate(-50%, -50%);
    width: 680px;
    height: 680px;
    background-image: url('news2.png');
    background-size: contain;
    background-repeat: no-repeat;
    cursor: default;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    z-index: 500;
    pointer-events: none;
  `;
  
  workspace.append(amelieDiaryFinalImage, news2Image);
  
  setTimeout(() => {
    amelieDiaryFinalImage.style.opacity = '1';
    news2Image.style.opacity = '1';
  }, 100);
  
  const closeAmelieFinal = (e) => {
    if (e.target.id === 'game-container' || e.target.id === 'workspace') {
      closeAmelieDiaryFinalOverlapping();
      $('game-container').removeEventListener('click', closeAmelieFinal);
    }
  };
  $('game-container').addEventListener('click', closeAmelieFinal);
}

function swapAmelieFinalLayers(e) {
  if (e) e.stopPropagation();
  
  const amelieZ = parseInt(amelieDiaryFinalImage.style.zIndex);
  const newsZ = parseInt(news2Image.style.zIndex);
  
  if (amelieZ > newsZ) {
    // Amelie在上层，切换到news2在上层
    amelieDiaryFinalImage.style.zIndex = '500';
    news2Image.style.zIndex = '502';
    
    amelieDiaryFinalImage.removeEventListener('click', swapAmelieFinalLayers);
    amelieDiaryFinalImage.style.cursor = 'default';
    amelieDiaryFinalImage.style.pointerEvents = 'none';
    
    news2Image.style.cursor = 'pointer';
    news2Image.style.pointerEvents = 'auto';
    news2Image.addEventListener('click', swapAmelieFinalLayers);
  } else {
    // news2在上层，切换到Amelie在上层
    amelieDiaryFinalImage.style.zIndex = '502';
    news2Image.style.zIndex = '500';
    
    news2Image.removeEventListener('click', swapAmelieFinalLayers);
    news2Image.style.cursor = 'default';
    news2Image.style.pointerEvents = 'none';
    
    amelieDiaryFinalImage.style.cursor = 'pointer';
    amelieDiaryFinalImage.style.pointerEvents = 'auto';
    amelieDiaryFinalImage.addEventListener('click', swapAmelieFinalLayers);
  }
}

function closeAmelieDiaryFinalOverlapping() {
  [amelieDiaryFinalImage, news2Image].forEach(el => fadeOutRemove(el));
  
  amelieDiaryFinalClickCount = 0;
  resetAllTools();
  switchBackgroundToOriginal();
  setTimeout(() => {
    booksIcon.style.display = 'block';
    setTimeout(() => booksIcon.style.opacity = '0.9', 100);
  }, 1700);
}

// ===== 最终关卡：End =====

function startEndPhase() {
  gameState.gamePhase = 20;
  booksIcon.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
  }, 500);
  
  // 先切换背景，等背景切换完成后再显示关卡内容
  switchBackgroundToLevel();
  setTimeout(() => {
    showEndImage();
  }, 1700);
}

function showEndImage() {
  endImage = document.createElement('div');
  endImage.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    height: 600px;
    background-image: url('end.png');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    z-index: 500;
  `;
  workspace.appendChild(endImage);
  
  setTimeout(() => {
    endImage.style.opacity = '1';
    // 显示后等待1秒再显示对话框
    setTimeout(() => {
      showEndDialog();
    }, 1000);
  }, 100);
}

function showEndDialog() {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: absolute;
    top: 8%;
    left: 50%;
    transform: translate(-50%, 0);
    background-image: url('dialogue.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    padding: 3rem 2.5rem;
    z-index: 10000;
    width: 500px;
    min-height: 200px;
    font-family: 'Indie Flower', cursive;
    color: #2a2520;
    font-size: 1.3rem;
    line-height: 1.6;
    text-align: center;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `;
  
  const text = document.createElement('p');
  text.textContent = 'It seems there is something written on the back...';
  text.style.marginBottom = '1.5rem';
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 2rem;
    justify-content: center;
  `;
  
  const flipButton = document.createElement('span');
  flipButton.textContent = 'Flip';
  flipButton.style.cssText = `
    font-family: 'Indie Flower', cursive;
    font-size: 1.4rem;
    color: #2a2520;
    cursor: pointer;
    transition: all 0.3s;
    text-decoration: underline;
  `;
  flipButton.onmouseover = () => {
    flipButton.style.color = '#000';
    flipButton.style.transform = 'scale(1.1)';
    flipButton.style.fontWeight = 'bold';
  };
  flipButton.onmouseout = () => {
    flipButton.style.color = '#2a2520';
    flipButton.style.transform = 'scale(1)';
    flipButton.style.fontWeight = 'normal';
  };
  
  const exitButton = document.createElement('span');
  exitButton.textContent = "Exit, I won't look";
  exitButton.style.cssText = `
    font-family: 'Indie Flower', cursive;
    font-size: 1.4rem;
    color: #d32f2f;
    cursor: pointer;
    transition: all 0.3s;
    text-decoration: underline;
  `;
  exitButton.onmouseover = () => {
    exitButton.style.color = '#a02020';
    exitButton.style.transform = 'scale(1.1)';
    exitButton.style.fontWeight = 'bold';
  };
  exitButton.onmouseout = () => {
    exitButton.style.color = '#d32f2f';
    exitButton.style.transform = 'scale(1)';
    exitButton.style.fontWeight = 'normal';
  };
  
  flipButton.addEventListener('click', (e) => {
    e.stopPropagation();
    fadeOutRemove(dialog, () => {
      // 翻转图片
      flipToEnd2();
    });
  });
  
  exitButton.addEventListener('click', (e) => {
    e.stopPropagation();
    fadeOutRemove(dialog, () => {
      // 直接关闭关卡
      closeEndPhase();
    });
  });
  
  buttonContainer.append(flipButton, exitButton);
  dialog.append(text, buttonContainer);
  $('game-container').appendChild(dialog);
  
  setTimeout(() => dialog.style.opacity = '1', 100);
}

function flipToEnd2() {
  // 改变图片为end2.png
  endImage.style.opacity = '0';
  setTimeout(() => {
    endImage.style.backgroundImage = "url('end2.png')";
    setTimeout(() => {
      endImage.style.opacity = '1';
    }, 100);
  }, 500);
  
  // 点击背景可关闭
  const closeEnd = (e) => {
    if (e.target.id === 'game-container' || e.target.id === 'workspace') {
      closeEndPhase();
      $('game-container').removeEventListener('click', closeEnd);
    }
  };
  $('game-container').addEventListener('click', closeEnd);
}

function closeEndPhase() {
  fadeOutRemove(endImage, () => {
    endImage = null;
    resetAllTools();
    switchBackgroundToOriginal();
    setTimeout(() => {
      booksIcon.style.display = 'block';
      setTimeout(() => booksIcon.style.opacity = '0.9', 100);
      
      // 等待books图标出现后，开始慢慢变黑
      setTimeout(() => {
        startFinalPhase();
      }, 2000);
    }, 1700);
  });
}

// ===== 最终阶段：黑屏与密码 =====

function startFinalPhase() {
  isFinalPhase = true;
  
  // 隐藏所有工具栏图标和其他元素
  booksIcon.style.opacity = '0';
  penHotspot.style.opacity = '0';
  tapeHotspot.style.opacity = '0';
  tweezersHotspot.style.opacity = '0';
  magnifierHotspot.style.opacity = '0';
  passSlot.style.opacity = '0';
  
  setTimeout(() => {
    booksIcon.style.display = 'none';
    penHotspot.style.display = 'none';
    tapeHotspot.style.display = 'none';
    tweezersHotspot.style.display = 'none';
    magnifierHotspot.style.display = 'none';
    passSlot.style.display = 'none';
  }, 500);
  
  // 获取 toolbar 引用
  const toolbar = document.getElementById('toolbar');
  
  // 创建一个独立的 box 元素（从 toolbar 移出）
  const standaloneBox = document.createElement('div');
  standaloneBox.className = 'toolbar-item standalone-box';
  standaloneBox.id = 'standalone-box-hotspot';
  standaloneBox.style.cssText = `
    position: fixed;
    right: 2%;
    top: 50%;
    transform: translateY(-50%);
    width: 80px;
    height: 80px;
    background-image: url('box.png');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    cursor: pointer;
    z-index: 10001;
    opacity: 1;
  `;
  document.body.appendChild(standaloneBox);
  
  // 为独立 box 添加点击事件
  standaloneBox.addEventListener('click', () => selectTool('box'));
  
  // 隐藏原始的 box（它在 toolbar 中）
  boxHotspot.style.opacity = '0';
  setTimeout(() => {
    boxHotspot.style.display = 'none';
  }, 500);
  
  // 让 toolbar 的背景慢慢变黑消失
  toolbar.style.transition = 'opacity 3s ease-in-out';
  setTimeout(() => {
    toolbar.style.opacity = '0';
  }, 100);
  
  // 创建整个屏幕的黑色遮罩层（除了 box）
  blackOverlay = document.createElement('div');
  blackOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: black;
    z-index: 10000;
    opacity: 0;
    transition: opacity 3s ease-in-out;
    pointer-events: none;
  `;
  document.body.appendChild(blackOverlay);
  
  // 整个屏幕慢慢变黑
  setTimeout(() => {
    blackOverlay.style.opacity = '1';
  }, 100);
}

function showPasswordWheel() {
  const dialog = document.createElement('div');
  dialog.id = 'password-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10002;
    background-image: url('dialogue.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    padding: 3rem 2.5rem;
    width: 500px;
    min-height: 250px;
    opacity: 0;
    transition: opacity 0.5s ease-in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `;
  
  const title = document.createElement('div');
  title.textContent = 'Enter Password';
  title.style.cssText = `
    font-family: 'Indie Flower', cursive;
    font-size: 1.8rem;
    color: #2a2520;
    text-align: center;
    margin-bottom: 2.5rem;
  `;
  
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = `
    display: flex;
    gap: 1.5rem;
    margin-bottom: 2rem;
    justify-content: center;
  `;
  
  // 创建4个输入框
  const inputs = [];
  for (let i = 0; i < 4; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 1;
    input.style.cssText = `
      width: 50px;
      height: 50px;
      font-family: 'Courier New', monospace;
      font-size: 2rem;
      text-align: center;
      border: none;
      border-bottom: 3px solid #2a2520;
      background: transparent;
      color: #2a2520;
      outline: none;
      transition: border-color 0.3s;
    `;
    
    // 只允许输入数字
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
      if (e.target.value && i < 3) {
        inputs[i + 1].focus();
      }
    });
    
    // 按下退格键时返回上一个输入框
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) {
        inputs[i - 1].focus();
      }
      if (e.key === 'Enter') {
        checkPassword();
      }
    });
    
    input.addEventListener('focus', () => {
      input.style.borderColor = '#d32f2f';
    });
    
    input.addEventListener('blur', () => {
      input.style.borderColor = '#2a2520';
    });
    
    inputs.push(input);
    inputContainer.appendChild(input);
  }
  
  // 检查密码函数
  function checkPassword() {
    const password = inputs.map(input => input.value).join('');
    if (password === '1225') {
      fadeOutRemove(dialog, () => {
        showFinalTruth();
      });
    } else if (password.length === 4) {
      // 错误密码，摇晃效果并清空
      dialog.style.animation = 'shake 0.5s';
      setTimeout(() => {
        dialog.style.animation = '';
        inputs.forEach(input => input.value = '');
        inputs[0].focus();
      }, 500);
    }
  }
  
  // 添加摇晃动画
  if (!document.querySelector('#shake-keyframes')) {
    const style = document.createElement('style');
    style.id = 'shake-keyframes';
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translate(-50%, -50%); }
        10%, 30%, 50%, 70%, 90% { transform: translate(-52%, -50%); }
        20%, 40%, 60%, 80% { transform: translate(-48%, -50%); }
      }
    `;
    document.head.appendChild(style);
  }
  
  dialog.append(title, inputContainer);
  document.body.appendChild(dialog);
  
  setTimeout(() => {
    dialog.style.opacity = '1';
    inputs[0].focus();
  }, 100);
}

function showFinalTruth() {
  // 创建更深的暗化遮罩
  const darkenOverlay = document.createElement('div');
  darkenOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 10002;
    opacity: 0;
    transition: opacity 2s ease-in-out;
    pointer-events: none;
  `;
  document.body.appendChild(darkenOverlay);
  
  // 创建主容器
  const truthContainer = document.createElement('div');
  truthContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10003;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3rem;
  `;
  
  // 创建图片容器（并列显示）
  const imageContainer = document.createElement('div');
  imageContainer.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 3rem;
    opacity: 0;
    animation: fadeInTruth 2s ease-in forwards;
  `;
  
  // 创建eye.png
  const eyeImage = document.createElement('img');
  eyeImage.src = 'eye.png';
  eyeImage.style.cssText = `
    width: 300px;
    height: 300px;
    object-fit: contain;
  `;
  
  // 创建teeth.png（小一点）
  const teethImage = document.createElement('img');
  teethImage.src = 'teeth.png';
  teethImage.style.cssText = `
    width: 200px;
    height: 200px;
    object-fit: contain;
  `;
  
  imageContainer.append(eyeImage, teethImage);
  
  // 创建红色文字
  const truthText = document.createElement('div');
  truthText.textContent = 'Now you know what you wanted to know. Perhaps everything should have been better...';
  truthText.style.cssText = `
    font-family: 'Indie Flower', cursive;
    font-size: 1.8rem;
    color: #ff0000;
    text-align: center;
    text-shadow: 0 0 20px rgba(255, 0, 0, 0.8);
    opacity: 0;
    max-width: 800px;
    line-height: 1.5;
  `;
  
  // 添加淡入动画
  if (!document.querySelector('#truth-keyframes')) {
    const style = document.createElement('style');
    style.id = 'truth-keyframes';
    style.textContent = `
      @keyframes fadeInTruth {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes fadeInText {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  truthContainer.append(imageContainer, truthText);
  document.body.appendChild(truthContainer);
  
  // 图片出现时屏幕立即开始变暗
  setTimeout(() => {
    darkenOverlay.style.opacity = '1';
  }, 100);
  
  // 图片淡入后，整体渐变更黑暗，然后显示文字
  setTimeout(() => {
    // 继续渐变黑暗
    imageContainer.style.transition = 'opacity 2s ease-in-out';
    imageContainer.style.opacity = '0.3';
    
    // 1秒后显示红字
    setTimeout(() => {
      truthText.style.animation = 'fadeInText 2s ease-in forwards';
      setTimeout(() => {
        truthText.style.opacity = '1';
        
        // 红字显示2秒后，开始血液流动动画
        setTimeout(() => {
          createBloodEffect();
          
          // 血液流动5秒后，整个画面慢慢变黑
          setTimeout(() => {
            const finalBlack = document.createElement('div');
            finalBlack.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: black;
              z-index: 10005;
              opacity: 0;
              transition: opacity 4s ease-in-out;
              pointer-events: none;
            `;
            document.body.appendChild(finalBlack);
            
            setTimeout(() => {
              finalBlack.style.opacity = '1';
            }, 100);
          }, 5000);
        }, 2000);
      }, 100);
    }, 1000);
  }, 2000);
}

function createBloodEffect() {
  // 创建血液容器
  const bloodContainer = document.createElement('div');
  bloodContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10004;
    pointer-events: none;
    overflow: hidden;
  `;
  document.body.appendChild(bloodContainer);
  
  // 添加血液流动的CSS动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bloodDrip {
      0% {
        height: 0;
        opacity: 0.9;
      }
      30% {
        opacity: 1;
      }
      100% {
        height: 100vh;
        opacity: 0.8;
      }
    }
    
    .blood-drip {
      position: absolute;
      top: 0;
      width: 2px;
      height: 0;
      background: linear-gradient(to bottom, 
        rgba(139, 0, 0, 0.9) 0%,
        rgba(139, 0, 0, 0.8) 30%,
        rgba(80, 0, 0, 0.6) 60%,
        rgba(60, 0, 0, 0.3) 100%
      );
      filter: blur(1px);
      animation: bloodDrip ease-in forwards;
    }
  `;
  document.head.appendChild(style);
  
  // 创建多条血液流
  const bloodCount = 25;
  for (let i = 0; i < bloodCount; i++) {
    setTimeout(() => {
      const bloodDrip = document.createElement('div');
      bloodDrip.className = 'blood-drip';
      
      // 随机位置
      const leftPos = Math.random() * 100;
      bloodDrip.style.left = `${leftPos}%`;
      
      // 随机宽度
      const width = 1 + Math.random() * 3;
      bloodDrip.style.width = `${width}px`;
      
      // 随机持续时间
      const duration = 3 + Math.random() * 2;
      bloodDrip.style.animationDuration = `${duration}s`;
      
      // 随机延迟
      const delay = Math.random() * 0.5;
      bloodDrip.style.animationDelay = `${delay}s`;
      
      bloodContainer.appendChild(bloodDrip);
    }, i * 80);
  }
}

