(function(){
  const LAST_SELECTION_KEY = "dynamic_puzzle_last_selection";
  const RECENT_SELECTIONS_KEY = "dynamic_puzzle_recent_selections";
  const SPLASH_ONE_MS = 3000;
  const MAX_RECENT_SELECTIONS = 10;

  const state = {
    sources: null,
    folderMeta: null,
    index: null,
    puzzleMeta: null,
    gridData: null,
    clueData: null,
    imageUrl: "",
    solutionUrl: "",
    gridPattern: [],
    numbering: {},
    cellMeta: {},
    clueStarts: {
      across: [],
      down: []
    },
    clueRows: {
      across: new Map(),
      down: new Map()
    },
    inputs: new Map(),
    answers: {},
    history: [],
    historyIndex: -1,
    latestSelection: null
  };

  const dom = {
    splashOne: document.getElementById("splashScreenOne"),
    splashTwo: document.getElementById("splashScreenTwo"),
    gameShell: document.getElementById("gameShell"),
    latestButton: document.getElementById("latestButton"),
    latestChoiceText: document.getElementById("latestChoiceText"),
    recentButton: document.getElementById("recentButton"),
    manualGoButton: document.getElementById("manualGoButton"),
    title: document.getElementById("puzzleTitle"),
    subtitle: document.getElementById("puzzleSubtitle"),
    loading: document.getElementById("loadingCard"),
    banner: document.getElementById("statusBanner"),
    folderSelect: document.getElementById("folderSelect"),
    puzzleSelect: document.getElementById("puzzleSelect"),
    backButton: document.getElementById("backButton"),
    clearButton: document.getElementById("clearButton"),
    undoButton: document.getElementById("undoButton"),
    redoButton: document.getElementById("redoButton"),
    previousButton: document.getElementById("previousButton"),
    nextButton: document.getElementById("nextButton"),
    solutionButton: document.getElementById("solutionButton"),
    puzzleFrame: document.getElementById("puzzleFrame"),
    image: document.getElementById("puzzleImage"),
    grid: document.getElementById("grid"),
    acrossLabel: document.getElementById("acrossLabel"),
    downLabel: document.getElementById("downLabel"),
    acrossText: document.getElementById("acrossText"),
    downText: document.getElementById("downText"),
    acrossList: document.getElementById("acrossList"),
    downList: document.getElementById("downList"),
    recentOverlay: document.getElementById("recentOverlay"),
    recentList: document.getElementById("recentList"),
    recentClose: document.getElementById("recentClose"),
    solutionOverlay: document.getElementById("solutionOverlay"),
    solutionImage: document.getElementById("solutionImage"),
    solutionClose: document.getElementById("solutionClose")
  };

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize(){
    wireEvents();
    startSplashFlow();

    try{
      state.sources = await fetchJson("sources.json");
      populateFolderSelect();
      await prepareChoiceScreen();
    }catch(error){
      dom.loading.hidden = true;
      const suffix = location.protocol === "file:"
        ? " If you open this outside Codex, use GitHub Pages or a local web server."
        : "";
      showBanner((error.message || "Could not load puzzle data.") + suffix);
    }
  }

  function wireEvents(){
    dom.folderSelect.addEventListener("change", async function(){
      try{
        await loadFolderForChooser(dom.folderSelect.value, "");
      }catch(error){
        showBanner(error.message || "Could not load selected magazine.");
      }
    });

    dom.latestButton.addEventListener("click", async function(){
      try{
        const latest = state.latestSelection || await findLatestSelection();
        await openPuzzleByIds(latest.folderId, latest.puzzleId);
      }catch(error){
        showBanner(error.message || "Could not open latest puzzle.");
      }
    });

    dom.recentButton.addEventListener("click", function(){
      renderRecentList();
      dom.recentOverlay.hidden = false;
    });

    dom.manualGoButton.addEventListener("click", async function(){
      try{
        await openPuzzleByIds(dom.folderSelect.value, dom.puzzleSelect.value);
      }catch(error){
        showBanner(error.message || "Could not open selected puzzle.");
      }
    });

    dom.backButton.addEventListener("click", showChoiceScreen);

    if(dom.previousButton){
      dom.previousButton.addEventListener("click", function(){
        navigateRelative(-1);
      });
    }

    if(dom.nextButton){
      dom.nextButton.addEventListener("click", function(){
        navigateRelative(1);
      });
    }

    dom.undoButton.addEventListener("click", function(){
      undoAnswers();
    });

    dom.redoButton.addEventListener("click", function(){
      redoAnswers();
    });

    dom.clearButton.addEventListener("click", function(){
      if(!confirm("Clear all answers?")) return;
      applyAnswersSnapshot({});
      pushHistorySnapshot();
      showToast("Answers cleared", "#c84346");
    });

    dom.solutionButton.addEventListener("click", function(){
      if(!state.solutionUrl) return;
      dom.solutionImage.src = state.solutionUrl;
      dom.solutionOverlay.hidden = false;
    });

    dom.recentClose.addEventListener("click", closeRecent);
    dom.recentOverlay.addEventListener("click", function(event){
      if(event.target === dom.recentOverlay){
        closeRecent();
      }
    });

    dom.solutionClose.addEventListener("click", closeSolution);
    dom.solutionOverlay.addEventListener("click", function(event){
      if(event.target === dom.solutionOverlay){
        closeSolution();
      }
    });

    window.addEventListener("keydown", function(event){
      if(event.key === "Escape" && !dom.recentOverlay.hidden){
        closeRecent();
        return;
      }
      if(event.key === "Escape" && !dom.solutionOverlay.hidden){
        closeSolution();
      }
    });

    let resizeTimer = null;
    window.addEventListener("resize", function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refreshAfterResize, 80);
    });
  }

  function startSplashFlow(){
    dom.splashOne.hidden = false;
    dom.splashTwo.hidden = true;
    dom.gameShell.hidden = true;

    window.setTimeout(function(){
      dom.splashOne.hidden = true;
      dom.splashTwo.hidden = false;
    }, SPLASH_ONE_MS);
  }

  function showGameScreen(){
    dom.splashOne.hidden = true;
    dom.splashTwo.hidden = true;
    dom.gameShell.hidden = false;

    window.requestAnimationFrame(function(){
      refreshAfterResize();
    });
  }

  function showChoiceScreen(){
    closeSolution();
    closeRecent();
    dom.splashOne.hidden = true;
    dom.splashTwo.hidden = false;
    dom.gameShell.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function prepareChoiceScreen(){
    const params = new URLSearchParams(location.search);
    const requestedFolderId = params.get("folder");
    const requestedPuzzle = params.get("puzzle");
    const remembered = readLastSelection();

    state.latestSelection = await findLatestSelection();
    updateLatestChoiceText();

    const folderId = requestedFolderId ||
      (remembered && remembered.folderId) ||
      (state.latestSelection && state.latestSelection.folderId) ||
      state.sources.latestFolder ||
      firstFolderId();
    const puzzleId = requestedPuzzle ||
      (remembered && remembered.puzzleId) ||
      (state.latestSelection && state.latestSelection.puzzleId) ||
      "";

    await loadFolderForChooser(folderId, puzzleId);
  }

  async function loadFolderForChooser(folderId, puzzleId){
    state.folderMeta = getFolderMeta(folderId || firstFolderId());
    if(!state.folderMeta){
      throw new Error("Magazine " + folderId + " is not available.");
    }

    state.index = await fetchJson(state.folderMeta.index);
    populatePuzzleSelect();

    const puzzleMeta = selectPuzzle(state.index, puzzleId);
    if(!puzzleMeta){
      throw new Error("No complete puzzle entry is available in " + state.folderMeta.id);
    }

    dom.folderSelect.value = state.folderMeta.id;
    dom.puzzleSelect.value = puzzleMeta.id;
    return puzzleMeta;
  }

  async function openPuzzleByIds(folderId, puzzleId){
    showGameScreen();
    dom.loading.hidden = false;
    dom.puzzleFrame.classList.add("is-loading");
    dom.grid.innerHTML = "";
    dom.image.removeAttribute("src");
    dom.acrossLabel.textContent = "- Across";
    dom.downLabel.textContent = "- Down";
    dom.acrossText.textContent = "No clue";
    dom.downText.textContent = "No clue";

    const puzzleMeta = await loadFolderForChooser(folderId, puzzleId);
    replaceUrlSelection(state.folderMeta.id, puzzleMeta.id);
    await loadPuzzle(puzzleMeta);
  }

  async function loadPuzzle(puzzleMeta){
    state.puzzleMeta = puzzleMeta;
    persistLastSelection();
    persistRecentSelection();
    state.gridData = await fetchJson(resolveAssetPath(state.folderMeta.assetBase, puzzleMeta.gridFile));
    state.clueData = await fetchJson(resolveAssetPath(state.folderMeta.assetBase, puzzleMeta.clueFile));
    state.imageUrl = await resolvePuzzleImageUrl(puzzleMeta);
    state.solutionUrl = puzzleMeta.solutionFile
      ? resolveAssetPath(state.folderMeta.solutionBase || state.folderMeta.assetBase, puzzleMeta.solutionFile)
      : "";
    state.answers = loadAnswers();
    initializeHistory();

    renderHeader();
    updateNavigationButtons();
    updateHistoryButtons();
    dom.solutionButton.hidden = !state.solutionUrl;
    dom.puzzleFrame.classList.add("is-loading");
    dom.image.addEventListener("load", onImageLoad, { once: true });
    dom.image.src = state.imageUrl;
    if(dom.image.complete){
      onImageLoad();
    }
  }

  async function resolvePuzzleImageUrl(puzzleMeta){
    const candidates = buildImageCandidates(puzzleMeta);
    for(const candidate of candidates){
      if(await canLoadImage(candidate)){
        return candidate;
      }
    }

    if(candidates.length){
      return candidates[0];
    }

    throw new Error("Could not resolve puzzle image for " + puzzleMeta.id);
  }

  function buildImageCandidates(puzzleMeta){
    const extensions = ["png", "gif", "jpg", "jpeg", "webp"];
    const seen = new Set();
    const candidates = [];
    const imageFile = (puzzleMeta.imageFile || "").trim();
    const puzzleId = String(puzzleMeta.id || "").trim();

    function addCandidate(fileName){
      if(!fileName) return;
      const resolved = resolveAssetPath(state.folderMeta.assetBase, fileName);
      if(seen.has(resolved)) return;
      seen.add(resolved);
      candidates.push(resolved);
    }

    addCandidate(imageFile);

    const baseName = imageFile ? imageFile.replace(/\.[^.]+$/, "") : puzzleId;
    extensions.forEach(function(ext){
      addCandidate(baseName + "." + ext);
    });

    if(puzzleId && puzzleId !== baseName){
      extensions.forEach(function(ext){
        addCandidate(puzzleId + "." + ext);
      });
    }

    return candidates;
  }

  function canLoadImage(url){
    return new Promise(function(resolve){
      const probe = new Image();
      probe.onload = function(){ resolve(true); };
      probe.onerror = function(){ resolve(false); };
      probe.src = url;
    });
  }

  async function fetchJson(path){
    const response = await fetch(path, { cache: "no-store" });
    if(!response.ok){
      throw new Error("Could not load " + path);
    }

    const text = await response.text();
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  }

  function populateFolderSelect(){
    dom.folderSelect.innerHTML = "";
    const folders = Array.isArray(state.sources.folders) ? state.sources.folders : [];
    folders.forEach(function(folder){
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = folder.title || folder.id;
      dom.folderSelect.appendChild(option);
    });
  }

  function populatePuzzleSelect(){
    dom.puzzleSelect.innerHTML = "";
    const puzzles = getCompletePuzzles();
    puzzles.forEach(function(puzzle){
      const option = document.createElement("option");
      option.value = puzzle.id;
      option.textContent = puzzle.id;
      dom.puzzleSelect.appendChild(option);
    });
  }

  async function findLatestSelection(){
    const folders = Array.isArray(state.sources.folders) ? state.sources.folders : [];
    let best = null;

    for(const folder of folders){
      try{
        const indexData = await fetchJson(folder.index);
        const puzzleMeta = selectPuzzle(indexData, null);
        if(!puzzleMeta) continue;

        const numericId = Number(puzzleMeta.id) || 0;
        if(!best || numericId > best.numericId){
          best = {
            folderId: folder.id,
            puzzleId: puzzleMeta.id,
            title: puzzleMeta.title || (folder.title || folder.id) + " " + puzzleMeta.id,
            numericId: numericId
          };
        }
      }catch(error){
        continue;
      }
    }

    return {
      folderId: best ? best.folderId : (state.sources.latestFolder || firstFolderId()),
      puzzleId: best ? best.puzzleId : "",
      title: best ? best.title : "Latest available puzzle"
    };
  }

  function updateLatestChoiceText(){
    if(!dom.latestChoiceText) return;
    if(!state.latestSelection){
      dom.latestChoiceText.textContent = "Latest available puzzle";
      return;
    }

    dom.latestChoiceText.textContent = formatSelectionLabel(state.latestSelection);
  }

  function readLastSelection(){
    try{
      const raw = localStorage.getItem(LAST_SELECTION_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if(!parsed || !parsed.folderId) return null;
      return parsed;
    }catch(error){
      return null;
    }
  }

  function persistLastSelection(){
    localStorage.setItem(LAST_SELECTION_KEY, JSON.stringify({
      folderId: state.folderMeta.id,
      puzzleId: state.puzzleMeta.id,
      title: state.puzzleMeta.title || state.puzzleMeta.id,
      accessedAt: Date.now()
    }));
  }

  function readRecentSelections(){
    try{
      const raw = localStorage.getItem(RECENT_SELECTIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(function(item){
        return item && item.folderId && item.puzzleId;
      }) : [];
    }catch(error){
      return [];
    }
  }

  function persistRecentSelection(){
    const current = {
      folderId: state.folderMeta.id,
      folderTitle: state.folderMeta.title || state.folderMeta.id,
      puzzleId: state.puzzleMeta.id,
      title: state.puzzleMeta.title || state.puzzleMeta.id,
      accessedAt: Date.now()
    };
    const recent = readRecentSelections().filter(function(item){
      return !(item.folderId === current.folderId && item.puzzleId === current.puzzleId);
    });
    recent.unshift(current);
    localStorage.setItem(RECENT_SELECTIONS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_SELECTIONS)));
  }

  function renderRecentList(){
    const recent = readRecentSelections();
    dom.recentList.innerHTML = "";

    if(!recent.length){
      const empty = document.createElement("p");
      empty.className = "recent-empty";
      empty.textContent = "ఇంకా ఇటీవల ఆడిన పజిల్స్ లేవు.";
      dom.recentList.appendChild(empty);
      return;
    }

    recent.forEach(function(item){
      const button = document.createElement("button");
      button.type = "button";
      button.className = "recent-item";
      button.innerHTML = "<strong></strong><span></span>";
      button.querySelector("strong").textContent = formatSelectionLabel(item);
      button.querySelector("span").textContent = formatAccessTime(item.accessedAt);
      button.addEventListener("click", async function(){
        closeRecent();
        try{
          await openPuzzleByIds(item.folderId, item.puzzleId);
        }catch(error){
          showBanner(error.message || "Could not open recent puzzle.");
        }
      });
      dom.recentList.appendChild(button);
    });
  }

  function formatSelectionLabel(item){
    const folder = item.folderTitle || item.folderId || "";
    const title = item.title || item.puzzleId || "";
    return folder + " - " + title;
  }

  function formatAccessTime(value){
    if(!value) return "";
    try{
      return new Date(value).toLocaleString("te-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    }catch(error){
      return "";
    }
  }

  function firstFolderId(){
    const folders = Array.isArray(state.sources.folders) ? state.sources.folders : [];
    return folders.length ? folders[0].id : "";
  }

  function getFolderMeta(folderId){
    const folders = Array.isArray(state.sources.folders) ? state.sources.folders : [];
    return folders.find(function(folder){
      return folder.id === folderId;
    }) || null;
  }

  function getCompletePuzzles(){
    const puzzles = Array.isArray(state.index.puzzles) ? state.index.puzzles : [];
    return puzzles.filter(function(item){
      return item.complete;
    });
  }

  function selectPuzzle(indexData, requestedId){
    const complete = getCompletePuzzlesFromIndex(indexData);
    if(requestedId){
      const found = complete.find(function(item){
        return item.id === requestedId;
      });
      if(found) return found;
      throw new Error("Puzzle " + requestedId + " is not available in " + state.folderMeta.id);
    }

    const latestId = indexData.latestCompleteId;
    if(latestId){
      const latest = complete.find(function(item){
        return item.id === latestId;
      });
      if(latest) return latest;
    }

    return complete[0] || null;
  }

  function getCompletePuzzlesFromIndex(indexData){
    const puzzles = Array.isArray(indexData.puzzles) ? indexData.puzzles : [];
    return puzzles.filter(function(item){
      return item.complete;
    });
  }

  function currentPuzzleIndex(){
    const puzzles = getCompletePuzzles();
    return puzzles.findIndex(function(item){
      return state.puzzleMeta && item.id === state.puzzleMeta.id;
    });
  }

  function updateNavigationButtons(){
    if(!dom.previousButton || !dom.nextButton) return;
    const puzzles = getCompletePuzzles();
    const index = currentPuzzleIndex();
    dom.previousButton.disabled = index <= 0;
    dom.nextButton.disabled = index < 0 || index >= puzzles.length - 1;
  }

  function navigateRelative(step){
    const puzzles = getCompletePuzzles();
    const index = currentPuzzleIndex();
    if(index < 0) return;

    const target = puzzles[index + step];
    if(target){
      navigateToSelection(state.folderMeta.id, target.id);
    }
  }

  function navigateToSelection(folderId, puzzleId){
    const params = new URLSearchParams();
    if(folderId){
      params.set("folder", folderId);
    }
    if(puzzleId){
      params.set("puzzle", puzzleId);
    }
    const query = params.toString();
    window.location.href = "puzzle.html" + (query ? "?" + query : "");
  }

  function replaceUrlSelection(folderId, puzzleId){
    const params = new URLSearchParams();
    if(folderId) params.set("folder", folderId);
    if(puzzleId) params.set("puzzle", puzzleId);
    const query = params.toString();
    const nextUrl = "puzzle.html" + (query ? "?" + query : "");
    window.history.replaceState({}, "", nextUrl);
  }

  function renderHeader(){
    const title = state.puzzleMeta.title || state.puzzleMeta.id || "KVN Cross PJ";
    document.title = title;
    dom.title.textContent = title;
    dom.subtitle.textContent = "ఏ సంఖ్యపైనైనా నొక్కితే క్లూ కనిపిస్తుంది.";
  }

  function resolveAssetPath(basePath, fileName){
    return (basePath || "") + fileName;
  }

  function onImageLoad(){
    dom.loading.hidden = true;
    normalizeGridData();
    validateGridData();
    classifyGridFromImage();
    buildNumbering();
    renderGrid();
    dom.puzzleFrame.classList.remove("is-loading");
    renderClueLists();
    updateHistoryButtons();
    if(state.inputs.size){
      const firstKey = state.inputs.keys().next();
      if(!firstKey.done){
        const parts = firstKey.value.split("-").map(Number);
        updateClueBox(parts[0], parts[1]);
      }
    }
  }

  function normalizeGridData(){
    if(Array.isArray(state.gridData.rowLines) &&
       Array.isArray(state.gridData.colLines) &&
       state.gridData.cellNumbers &&
       typeof state.gridData.cellNumbers === "object"){
      return;
    }

    if(Number.isInteger(state.gridData.gridSize) && Array.isArray(state.gridData.numbers)){
      const gridSize = state.gridData.gridSize;
      const rowLines = [];
      const colLines = [];
      const cellNumbers = {};

      for(let index = 0; index <= gridSize; index++){
        const ratio = index / gridSize;
        rowLines.push(ratio);
        colLines.push(ratio);
      }

      state.gridData.numbers.forEach(function(entry){
        if(!entry) return;
        const row = Number(entry.row) - 1;
        const col = Number(entry.col) - 1;
        const number = Number(entry.number);
        if(row >= 0 && col >= 0 && number){
          cellNumbers[row + "-" + col] = number;
        }
      });

      state.gridData.rowLines = rowLines;
      state.gridData.colLines = colLines;
      state.gridData.cellNumbers = cellNumbers;
    }
  }

  function validateGridData(){
    if(!Array.isArray(state.gridData.rowLines) || state.gridData.rowLines.length < 2){
      throw new Error("Grid JSON is missing rowLines.");
    }

    if(!Array.isArray(state.gridData.colLines) || state.gridData.colLines.length < 2){
      throw new Error("Grid JSON is missing colLines.");
    }

    if(!state.gridData.cellNumbers || typeof state.gridData.cellNumbers !== "object"){
      throw new Error("Grid JSON is missing cellNumbers.");
    }
  }

  function classifyGridFromImage(){
    const canvas = document.createElement("canvas");
    const naturalWidth = dom.image.naturalWidth || dom.image.width;
    const naturalHeight = dom.image.naturalHeight || dom.image.height;
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(dom.image, 0, 0, naturalWidth, naturalHeight);

    state.gridPattern = [];
    const rowLines = state.gridData.rowLines;
    const colLines = state.gridData.colLines;

    for(let row = 0; row < rowLines.length - 1; row++){
      let patternRow = "";
      for(let col = 0; col < colLines.length - 1; col++){
        const startX = Math.floor(colLines[col] * naturalWidth);
        const endX = Math.max(startX + 1, Math.floor(colLines[col + 1] * naturalWidth));
        const startY = Math.floor(rowLines[row] * naturalHeight);
        const endY = Math.max(startY + 1, Math.floor(rowLines[row + 1] * naturalHeight));
        const sampleX = Math.min(naturalWidth - 1, Math.floor((startX + endX) / 2));
        const sampleY = Math.min(naturalHeight - 1, Math.floor((startY + endY) / 2));
        const pixel = context.getImageData(sampleX, sampleY, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        patternRow += brightness < 120 ? "#" : ".";
      }
      state.gridPattern.push(patternRow);
    }
  }

  function isOpenCell(row, col){
    return row >= 0 &&
      row < state.gridPattern.length &&
      col >= 0 &&
      col < state.gridPattern[row].length &&
      state.gridPattern[row][col] === ".";
  }

  function buildNumbering(){
    state.numbering = {};
    state.cellMeta = {};
    state.clueStarts = {
      across: [],
      down: []
    };

    const acrossNumbers = new Set(getAcrossEntries().map(function(item){ return Number(item.number); }));
    const downNumbers = new Set(getDownEntries().map(function(item){ return Number(item.number); }));

    for(let row = 0; row < state.gridPattern.length; row++){
      for(let col = 0; col < state.gridPattern[row].length; col++){
        if(!isOpenCell(row, col)) continue;

        const key = row + "-" + col;
        const clueNumber = Number(state.gridData.cellNumbers[key] || 0) || null;
        if(clueNumber){
          state.numbering[key] = clueNumber;
          if(acrossNumbers.has(clueNumber)){
            state.clueStarts.across.push({ number: clueNumber, row: row, col: col });
          }
          if(downNumbers.has(clueNumber)){
            state.clueStarts.down.push({ number: clueNumber, row: row, col: col });
          }
        }

        state.cellMeta[key] = {
          row: row,
          col: col,
          number: clueNumber,
          acrossStart: getAcrossStart(row, col),
          downStart: getDownStart(row, col)
        };
      }
    }
  }

  function getAcrossEntries(){
    if(Array.isArray(state.clueData.crossEntries) && state.clueData.crossEntries.length){
      return state.clueData.crossEntries.filter(Boolean);
    }

    if(Array.isArray(state.clueData.leftEntries) && state.clueData.leftEntries.length){
      return state.clueData.leftEntries.filter(Boolean);
    }

    return (state.clueData.rows || []).filter(function(row){
      return row && (row.crossNumber || row.leftNumber);
    }).map(function(row){
      return {
        row: row.row || null,
        number: row.crossNumber || row.leftNumber,
        text: row.crossText || row.leftText
      };
    });
  }

  function getDownEntries(){
    if(Array.isArray(state.clueData.downEntries) && state.clueData.downEntries.length){
      return state.clueData.downEntries.filter(Boolean);
    }

    if(Array.isArray(state.clueData.rightEntries) && state.clueData.rightEntries.length){
      return state.clueData.rightEntries.filter(Boolean);
    }

    return (state.clueData.rows || []).filter(function(row){
      return row && (row.downNumber || row.rightNumber);
    }).map(function(row){
      return {
        row: row.row || null,
        number: row.downNumber || row.rightNumber,
        text: row.downText || row.rightText
      };
    });
  }

  function getAcrossMap(){
    const map = {};
    getAcrossEntries().forEach(function(item){
      map[item.number] = item.text || "";
    });
    return map;
  }

  function getDownMap(){
    const map = {};
    getDownEntries().forEach(function(item){
      map[item.number] = item.text || "";
    });
    return map;
  }

  function getAcrossStart(row, col){
    let currentCol = col;
    while(currentCol > 0 && isOpenCell(row, currentCol - 1)){
      currentCol -= 1;
    }

    const key = row + "-" + currentCol;
    const number = state.numbering[key];
    const clues = getAcrossMap();
    return {
      row: row,
      col: currentCol,
      number: clues[number] !== undefined ? number : null
    };
  }

  function getDownStart(row, col){
    let currentRow = row;
    while(currentRow > 0 && isOpenCell(currentRow - 1, col)){
      currentRow -= 1;
    }

    const key = currentRow + "-" + col;
    const number = state.numbering[key];
    const clues = getDownMap();
    return {
      row: currentRow,
      col: col,
      number: clues[number] !== undefined ? number : null
    };
  }

  function renderGrid(){
    dom.grid.innerHTML = "";
    state.inputs.clear();
    const imageWidth = dom.image.clientWidth;
    const imageHeight = dom.image.clientHeight;
    const rowLines = state.gridData.rowLines;
    const colLines = state.gridData.colLines;

    for(let row = 0; row < state.gridPattern.length; row++){
      for(let col = 0; col < state.gridPattern[row].length; col++){
        if(!isOpenCell(row, col)) continue;

        const key = row + "-" + col;
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.left = (imageWidth * colLines[col]) + "px";
        cell.style.top = (imageHeight * rowLines[row]) + "px";
        cell.style.width = (imageWidth * (colLines[col + 1] - colLines[col])) + "px";
        cell.style.height = (imageHeight * (rowLines[row + 1] - rowLines[row])) + "px";

        const entry = document.createElement("div");
        entry.className = "entry";

        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "text";
        input.maxLength = 8;
        input.autocomplete = "off";
        input.spellcheck = false;
        input.dataset.row = row;
        input.dataset.col = col;
        input.tabIndex = state.inputs.size + 1;
        input.value = state.answers[key] || "";

        input.addEventListener("focus", function(){
          updateClueBox(row, col);
        });

        input.addEventListener("click", function(){
          updateClueBox(row, col);
        });

        input.addEventListener("input", function(){
          const value = input.value.length > 8 ? input.value.slice(-8) : input.value;
          input.value = value;
          if(value){
            state.answers[key] = value;
          }else{
            delete state.answers[key];
          }
          persistAnswers();
          pushHistorySnapshot();
        });

        input.addEventListener("keydown", function(event){
          if(event.key === "Enter"){
            event.preventDefault();
            moveInDirection(row, col, 0, 1);
            return;
          }

          if(event.key === "ArrowRight"){
            event.preventDefault();
            moveInDirection(row, col, 0, 1);
            return;
          }

          if(event.key === "ArrowLeft"){
            event.preventDefault();
            moveInDirection(row, col, 0, -1);
            return;
          }

          if(event.key === "ArrowDown"){
            event.preventDefault();
            moveInDirection(row, col, 1, 0);
            return;
          }

          if(event.key === "ArrowUp"){
            event.preventDefault();
            moveInDirection(row, col, -1, 0);
          }
        });

        entry.appendChild(input);
        cell.appendChild(entry);
        dom.grid.appendChild(cell);
        state.inputs.set(key, input);
      }
    }
  }

  function renderClueLists(){
    const acrossMap = getAcrossMap();
    const downMap = getDownMap();

    state.clueRows.across.clear();
    state.clueRows.down.clear();

    if(!dom.acrossList || !dom.downList) return;

    dom.acrossList.innerHTML = "";
    dom.downList.innerHTML = "";

    state.clueStarts.across.forEach(function(item){
      dom.acrossList.appendChild(createClueRow("across", item.number, acrossMap[item.number] || ""));
    });

    state.clueStarts.down.forEach(function(item){
      dom.downList.appendChild(createClueRow("down", item.number, downMap[item.number] || ""));
    });
  }

  function createClueRow(direction, number, text){
    const button = document.createElement("button");
    button.type = "button";
    button.className = "clue-item";

    const label = document.createElement("span");
    label.className = "clue-number";
    label.textContent = number + ".";

    const copy = document.createElement("span");
    copy.className = "clue-copy";
    copy.textContent = text || "No clue";

    button.appendChild(label);
    button.appendChild(copy);

    button.addEventListener("click", function(){
      setActiveClue(direction, number);
      focusClueStart(direction, number);
    });

    state.clueRows[direction].set(number, button);
    return button;
  }

  function clueText(direction, number){
    if(!number) return "No clue";
    const map = direction === "across" ? getAcrossMap() : getDownMap();
    return map[number] && String(map[number]).trim() ? String(map[number]) : "No clue";
  }

  function updateClueBox(row, col){
    const meta = state.cellMeta[row + "-" + col];
    if(!meta) return;
    updateClueLine(dom.acrossLabel, dom.acrossText, "Across", meta.acrossStart.number, clueText("across", meta.acrossStart.number));
    updateClueLine(dom.downLabel, dom.downText, "Down", meta.downStart.number, clueText("down", meta.downStart.number));
    setActiveClue("across", meta.acrossStart.number);
    setActiveClue("down", meta.downStart.number);
  }

  function updateClueLine(labelNode, textNode, directionLabel, number, text){
    labelNode.textContent = (number || "-") + " " + directionLabel;
    textNode.textContent = text;
    textNode.classList.toggle("muted", text === "No clue");
  }

  function setActiveClue(direction, number){
    state.clueRows[direction].forEach(function(rowElement, clueNumber){
      rowElement.classList.toggle("active", clueNumber === number);
    });
  }

  function focusClueStart(direction, number){
    const start = state.clueStarts[direction].find(function(item){
      return item.number === number;
    });
    if(start){
      focusCell(start.row, start.col);
    }
  }

  function focusCell(row, col){
    const input = state.inputs.get(row + "-" + col);
    if(input){
      input.focus();
      input.select();
    }
  }

  function moveInDirection(row, col, rowStep, colStep){
    let nextRow = row + rowStep;
    let nextCol = col + colStep;
    while(
      nextRow >= 0 &&
      nextRow < state.gridPattern.length &&
      nextCol >= 0 &&
      nextCol < state.gridPattern[0].length
    ){
      if(isOpenCell(nextRow, nextCol)){
        focusCell(nextRow, nextCol);
        return;
      }

      nextRow += rowStep;
      nextCol += colStep;
    }
  }

  function refreshAfterResize(){
    if(!state.gridPattern.length) return;
    const active = document.activeElement && document.activeElement.matches(".entry input")
      ? {
          row: Number(document.activeElement.dataset.row),
          col: Number(document.activeElement.dataset.col)
        }
      : null;

    renderGrid();
    if(active){
      focusCell(active.row, active.col);
      updateClueBox(active.row, active.col);
    }
  }

  function loadAnswers(){
    try{
      const saved = localStorage.getItem(getStorageKey());
      return saved ? JSON.parse(saved) || {} : {};
    }catch(error){
      return {};
    }
  }

  function persistAnswers(){
    localStorage.setItem(getStorageKey(), JSON.stringify(state.answers));
  }

  function getStorageKey(){
    return "dynamic_puzzle_answers_" + state.folderMeta.id + "_" + state.puzzleMeta.id;
  }

  function initializeHistory(){
    state.history = [];
    state.historyIndex = -1;
    pushHistorySnapshot();
  }

  function snapshotAnswers(){
    return JSON.parse(JSON.stringify(state.answers || {}));
  }

  function pushHistorySnapshot(){
    const snapshot = snapshotAnswers();
    const serialized = JSON.stringify(snapshot);
    const current = state.historyIndex >= 0
      ? JSON.stringify(state.history[state.historyIndex])
      : null;

    if(serialized === current){
      updateHistoryButtons();
      return;
    }

    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    state.historyIndex = state.history.length - 1;
    updateHistoryButtons();
  }

  function applyAnswersSnapshot(snapshot){
    state.answers = JSON.parse(JSON.stringify(snapshot || {}));
    persistAnswers();
    state.inputs.forEach(function(input, key){
      input.value = state.answers[key] || "";
    });
  }

  function undoAnswers(){
    if(state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    applyAnswersSnapshot(state.history[state.historyIndex]);
    updateHistoryButtons();
  }

  function redoAnswers(){
    if(state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    applyAnswersSnapshot(state.history[state.historyIndex]);
    updateHistoryButtons();
  }

  function updateHistoryButtons(){
    dom.undoButton.disabled = state.historyIndex <= 0;
    dom.redoButton.disabled = state.historyIndex >= state.history.length - 1 || state.historyIndex < 0;
  }

  function showBanner(message){
    dom.banner.hidden = false;
    dom.banner.textContent = message;
  }

  function closeSolution(){
    dom.solutionOverlay.hidden = true;
    dom.solutionImage.removeAttribute("src");
  }

  function closeRecent(){
    dom.recentOverlay.hidden = true;
  }

  function showToast(message, background){
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = [
      "position:fixed",
      "top:18px",
      "left:18px",
      "padding:10px 14px",
      "border-radius:12px",
      "color:#ffffff",
      "background:" + background,
      "font-size:0.92rem",
      "font-family:'Space Grotesk',sans-serif",
      "font-weight:700",
      "box-shadow:6px 6px 0 #1b1b1c",
      "border:2px solid #1b1b1c",
      "z-index:9999"
    ].join(";");
    document.body.appendChild(toast);
    setTimeout(function(){
      toast.remove();
    }, 1400);
  }
})();
