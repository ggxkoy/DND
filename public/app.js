const POLL_INTERVAL_MS = 5000;

const state = {
  bootstrap: null,
  session: null,
  userCharacters: [],
  currentRoom: null,
  roomPollHandle: null
};

const elements = {
  sessionStatus: document.querySelector("#session-status"),
  guestLogin: document.querySelector("#guest-login"),
  register: document.querySelector("#register"),
  login: document.querySelector("#login"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  raceSelect: document.querySelector("#race-select"),
  classSelect: document.querySelector("#class-select"),
  portraitPreview: document.querySelector("#portrait-preview"),
  statPreview: document.querySelector("#stat-preview"),
  characterName: document.querySelector("#character-name"),
  skillInput: document.querySelector("#skill-input"),
  gearInput: document.querySelector("#gear-input"),
  backstoryInput: document.querySelector("#backstory-input"),
  createCharacter: document.querySelector("#create-character"),
  characterList: document.querySelector("#character-list"),
  characterSelect: document.querySelector("#character-select"),
  roomName: document.querySelector("#room-name"),
  moduleSelect: document.querySelector("#module-select"),
  companionList: document.querySelector("#companion-list"),
  scriptJson: document.querySelector("#script-json"),
  createRoom: document.querySelector("#create-room"),
  roomList: document.querySelector("#room-list"),
  roomMeta: document.querySelector("#room-meta"),
  roomPresence: document.querySelector("#room-presence"),
  sceneArt: document.querySelector("#scene-art"),
  sceneTitle: document.querySelector("#scene-title"),
  sceneDescription: document.querySelector("#scene-description"),
  choiceList: document.querySelector("#choice-list"),
  freeAction: document.querySelector("#free-action"),
  submitFreeAction: document.querySelector("#submit-free-action"),
  diceResult: document.querySelector("#dice-result"),
  partyPanel: document.querySelector("#party-panel"),
  logList: document.querySelector("#log-list"),
  choiceTemplate: document.querySelector("#choice-template")
};

init().catch((error) => {
  console.error(error);
  alert(error.message || "初始化失败");
});

async function init() {
  const savedToken = localStorage.getItem("dnd-session-token");
  state.bootstrap = await api("/api/bootstrap", { token: savedToken, suppressAuthError: true });
  hydrateSession(state.bootstrap.session);
  state.userCharacters = state.bootstrap.characters || [];
  renderBootstrap();
  renderEmptyRoomState();
  bindEvents();
}

function bindEvents() {
  elements.guestLogin.addEventListener("click", async () => {
    const data = await api("/api/auth/guest", { method: "POST" });
    hydrateSession(data.session);
    await syncBootstrap();
  });

  elements.register.addEventListener("click", async () => {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: { username: elements.username.value.trim(), password: elements.password.value.trim() }
    });
    hydrateSession(data.session);
    await syncBootstrap();
  });

  elements.login.addEventListener("click", async () => {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { username: elements.username.value.trim(), password: elements.password.value.trim() }
    });
    hydrateSession(data.session);
    await syncBootstrap();
  });

  elements.raceSelect.addEventListener("change", renderCharacterPreview);
  elements.classSelect.addEventListener("change", renderCharacterPreview);
  elements.characterSelect.addEventListener("change", () => {
    renderRoomList(state.bootstrap.rooms || []);
    if (state.currentRoom) {
      renderRoom();
    }
  });

  elements.createCharacter.addEventListener("click", async () => {
    requireSession();
    const data = await api("/api/characters", {
      method: "POST",
      token: state.session?.token,
      body: {
        name: elements.characterName.value.trim(),
        raceId: elements.raceSelect.value,
        classId: elements.classSelect.value,
        skillChoices: splitInput(elements.skillInput.value),
        gearChoices: splitInput(elements.gearInput.value),
        backstory: elements.backstoryInput.value.trim()
      }
    });
    state.userCharacters.unshift(data.character);
    renderCharacterList();
    fillCharacterSelect();
    renderRoomList(state.bootstrap.rooms || []);
  });

  elements.createRoom.addEventListener("click", async () => {
    requireSession();
    const data = await api("/api/rooms", {
      method: "POST",
      token: state.session?.token,
      body: {
        roomName: elements.roomName.value.trim(),
        moduleId: elements.moduleSelect.value,
        scriptJson: elements.scriptJson.value.trim(),
        characterId: elements.characterSelect.value,
        companionIds: getSelectedCompanions()
      }
    });
    await refreshRooms(data.room.id);
  });

  elements.submitFreeAction.addEventListener("click", async () => {
    if (!state.currentRoom) {
      return;
    }
    await performAction({ freeText: elements.freeAction.value.trim() });
    elements.freeAction.value = "";
  });
}

function renderBootstrap() {
  fillRaceAndClass();
  fillModules();
  fillCompanions();
  renderCharacterPreview();
  renderCharacterList();
  renderRoomList(state.bootstrap.rooms || []);
}

function renderEmptyRoomState() {
  elements.roomMeta.textContent = "未进入房间";
  elements.roomPresence.textContent = "当前未加入任何房间。";
  elements.sceneArt.removeAttribute("src");
  elements.sceneTitle.textContent = "等待冒险开始";
  elements.sceneDescription.textContent = "创建或加入房间后，这里会显示当前 AI 场景描述。";
  elements.choiceList.innerHTML = `<p class="empty">先在大厅里创建或加入一个房间。</p>`;
  elements.partyPanel.innerHTML = `<p class="empty">队伍信息会在进入房间后显示。</p>`;
  elements.logList.innerHTML = `<p class="empty">行动日志会在冒险开始后滚动出现。</p>`;
  elements.freeAction.disabled = true;
  elements.submitFreeAction.disabled = true;
}

function hydrateSession(session) {
  state.session = session || null;
  if (session?.token) {
    localStorage.setItem("dnd-session-token", session.token);
  } else {
    localStorage.removeItem("dnd-session-token");
    stopRoomPolling();
  }

  elements.sessionStatus.textContent = session
    ? `${session.user.name}${session.user.isGuest ? "（游客）" : ""}`
    : "未登录";
}

async function syncBootstrap() {
  state.bootstrap = await api("/api/bootstrap", {
    token: state.session?.token,
    suppressAuthError: true
  });
  state.userCharacters = state.bootstrap.characters || [];
  renderBootstrap();

  if (state.currentRoom) {
    await openRoom(state.currentRoom.id);
  }
}

function fillRaceAndClass() {
  elements.raceSelect.innerHTML = Object.entries(state.bootstrap.races)
    .map(([id, race]) => `<option value="${id}">${race.label}</option>`)
    .join("");
  elements.classSelect.innerHTML = Object.entries(state.bootstrap.classes)
    .map(([id, role]) => `<option value="${id}">${role.label}</option>`)
    .join("");
}

function fillModules() {
  elements.moduleSelect.innerHTML = state.bootstrap.modules
    .map((module) => `<option value="${module.id}">${module.title} · ${module.summary}</option>`)
    .join("");
}

function fillCompanions() {
  elements.companionList.innerHTML = state.bootstrap.companions
    .map(
      (companion) => `
        <label>
          <input type="checkbox" value="${companion.id}" />
          <span>${companion.name}｜${companion.role}</span>
        </label>
      `
    )
    .join("");
}

function renderCharacterPreview() {
  const race = state.bootstrap.races[elements.raceSelect.value];
  const role = state.bootstrap.classes[elements.classSelect.value];
  if (!race || !role) {
    return;
  }

  elements.portraitPreview.textContent = `${race.portrait} + ${role.portrait}`;
  elements.statPreview.innerHTML = Object.entries({
    strength: 10 + race.bonuses.strength,
    agility: 10 + race.bonuses.agility,
    intellect: 10 + race.bonuses.intellect,
    spirit: 10 + race.bonuses.spirit,
    charm: 10 + race.bonuses.charm
  })
    .map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderCharacterList() {
  if (!state.userCharacters.length) {
    elements.characterList.innerHTML = `<p class="empty">当前还没有角色卡。</p>`;
    fillCharacterSelect();
    return;
  }

  elements.characterList.innerHTML = state.userCharacters
    .map(
      (character) => `
        <article class="mini-card">
          <h4>${character.name}</h4>
          <p>${state.bootstrap.races[character.raceId].label} / ${state.bootstrap.classes[character.classId].label}</p>
          <p>${character.skills.join("、")}</p>
        </article>
      `
    )
    .join("");
  fillCharacterSelect();
}

function fillCharacterSelect() {
  if (!state.userCharacters.length) {
    elements.characterSelect.innerHTML = `<option value="">请先创建角色</option>`;
    return;
  }

  const previousValue = elements.characterSelect.value;
  elements.characterSelect.innerHTML = state.userCharacters
    .map((character) => `<option value="${character.id}">${character.name}</option>`)
    .join("");

  if (previousValue && state.userCharacters.some((character) => character.id === previousValue)) {
    elements.characterSelect.value = previousValue;
  }
}

function renderRoomList(rooms) {
  if (!rooms.length) {
    elements.roomList.innerHTML = `<p class="empty">大厅还没有房间。</p>`;
    return;
  }

  const selectedCharacter = getSelectedCharacter();
  const currentRoomId = state.currentRoom?.id || "";

  elements.roomList.innerHTML = rooms
    .map((room) => {
      const badges = [
        `<span class="status-badge ${room.completed ? "status-done" : "status-live"}">${
          room.completed ? "已完成" : "进行中"
        }</span>`,
        room.viewerIsMember
          ? `<span class="status-badge status-joined">已加入</span>`
          : "",
        room.id === currentRoomId
          ? `<span class="status-badge status-focus">当前房间</span>`
          : ""
      ]
        .filter(Boolean)
        .join("");

      const joinButton = state.session?.token
        ? selectedCharacter && !room.viewerIsMember && !room.completed
          ? `<button data-join-room="${room.id}" class="secondary">携当前角色加入</button>`
          : !selectedCharacter
            ? `<button class="secondary" disabled>先创建角色</button>`
            : ""
        : "";

      return `
        <article class="room-card ${room.id === currentRoomId ? "is-active" : ""}">
          <div class="room-card-main">
            <div class="room-card-top">
              <h4>${room.roomName}</h4>
              <div class="badge-row">${badges}</div>
            </div>
            <p class="card-meta">邀请码 ${room.inviteCode} · 团长 ${room.ownerName}</p>
            <p class="room-summary">${room.moduleTitle} · 当前场景 ${room.sceneTitle}</p>
            <p class="card-meta">${room.players} 人 · ${formatRoomUpdated(room.lastUpdatedAt)}</p>
          </div>
          <div class="room-actions">
            <button data-open-room="${room.id}">进入查看</button>
            ${joinButton}
          </div>
        </article>
      `;
    })
    .join("");

  elements.roomList.querySelectorAll("[data-open-room]").forEach((button) => {
    button.addEventListener("click", async () => {
      await openRoom(button.dataset.openRoom);
    });
  });

  elements.roomList.querySelectorAll("[data-join-room]").forEach((button) => {
    button.addEventListener("click", async () => {
      await openRoom(button.dataset.joinRoom, { join: true });
    });
  });
}

async function refreshRooms(focusRoomId) {
  const bootstrap = await api("/api/bootstrap", {
    token: state.session?.token,
    suppressAuthError: true
  });
  state.bootstrap.rooms = bootstrap.rooms || [];
  renderRoomList(state.bootstrap.rooms);
  if (focusRoomId) {
    await openRoom(focusRoomId);
  }
}

async function openRoom(roomId, options = {}) {
  if (options.join) {
    requireSession();
    const selectedCharacterId = getSelectedCharacterId();
    if (!selectedCharacterId) {
      throw new Error("请先创建并选择一个角色。");
    }

    const joined = await api(`/api/rooms/${roomId}/join`, {
      method: "POST",
      token: state.session?.token,
      body: { characterId: selectedCharacterId }
    });
    state.currentRoom = joined.room;
  } else {
    const data = await api(`/api/rooms/${roomId}`, {
      token: state.session?.token,
      suppressAuthError: true
    });
    state.currentRoom = data.room;
  }

  syncCharacterSelectionToRoom();
  await refreshRoomSummaries();
  renderRoom();
  startRoomPolling();
}

function renderRoom() {
  const room = state.currentRoom;
  if (!room) {
    renderEmptyRoomState();
    return;
  }

  const viewerIsMember = Boolean(room.viewer?.isMember);
  const viewerCharacterId = room.viewer?.characterId || "";
  const canAct = viewerIsMember && !room.completed;

  elements.roomMeta.textContent = `${room.roomName} · ${room.module.title} · 第 ${room.turn + 1} 回合`;
  elements.roomPresence.textContent = room.completed
    ? "该房间的当前冒险已经完成，你可以继续查看记录。"
    : viewerIsMember
      ? `你已作为队伍成员加入，当前角色是 ${getRoomCharacterName(room, viewerCharacterId)}。`
      : "你当前处于旁观模式，请在大厅里用角色加入房间后再行动。";
  elements.sceneArt.src = room.sceneArt;
  elements.sceneTitle.textContent = room.currentScene.title;
  elements.sceneDescription.textContent = room.currentScene.description;
  elements.partyPanel.innerHTML =
    room.players
      .map(
        (player) => `
          <article class="mini-card ${player.characterId === viewerCharacterId ? "current-player" : ""}">
            <h4>${player.character.name}</h4>
            <p>${state.bootstrap.classes[player.character.classId].label}</p>
            <p>${Object.entries(player.character.stats)
              .map(([key, value]) => `${key}:${value}`)
              .join(" / ")}</p>
          </article>
        `
      )
      .join("") +
    room.companions
      .map(
        (companion) => `
          <article class="mini-card npc">
            <h4>${companion.name}</h4>
            <p>${companion.role}</p>
            <p>${companion.trait}</p>
          </article>
        `
      )
      .join("");

  elements.choiceList.innerHTML = "";
  if (!viewerIsMember) {
    elements.choiceList.innerHTML = `<p class="empty">先回到大厅点击“携当前角色加入”，再回来执行行动。</p>`;
  } else if (room.completed) {
    elements.choiceList.innerHTML = `<p class="empty">这个冒险已经完成，目前只保留浏览与回顾功能。</p>`;
  } else {
    room.currentScene.choices.forEach((choice) => {
      const button = elements.choiceTemplate.content.firstElementChild.cloneNode(true);
      button.textContent = `${choice.label} · ${choice.skill} / DC ${choice.dc}`;
      button.addEventListener("click", async () => {
        await performAction({ choiceId: choice.id });
      });
      elements.choiceList.appendChild(button);
    });
  }

  elements.freeAction.disabled = !canAct;
  elements.submitFreeAction.disabled = !canAct;

  elements.logList.innerHTML = room.logs.length
    ? room.logs
        .map((log) => `<p>${new Date(log.at).toLocaleTimeString()} · ${log.text}</p>`)
        .join("")
    : `<p class="empty">房间已创建，等待第一条行动。</p>`;
}

async function performAction({ choiceId = "", freeText = "" }) {
  if (!state.currentRoom) {
    throw new Error("请先进入一个房间。");
  }

  const activeCharacterId = state.currentRoom.viewer?.characterId || getSelectedCharacterId();
  if (!activeCharacterId) {
    throw new Error("请先用一个角色加入房间。");
  }

  const data = await api(`/api/rooms/${state.currentRoom.id}/action`, {
    method: "POST",
    token: state.session?.token,
    body: {
      choiceId,
      characterId: activeCharacterId,
      freeText
    }
  });
  state.currentRoom = data.room;
  syncCharacterSelectionToRoom();
  elements.diceResult.textContent = `d20=${data.outcome.roll} · 总值 ${data.outcome.total}/${data.outcome.dc}`;
  await refreshRoomSummaries();
  renderRoom();
}

async function refreshRoomSummaries() {
  const bootstrap = await api("/api/bootstrap", {
    token: state.session?.token,
    suppressAuthError: true
  });

  if (bootstrap.rooms) {
    state.bootstrap.rooms = bootstrap.rooms;
  }
  if (bootstrap.characters) {
    state.userCharacters = bootstrap.characters;
    fillCharacterSelect();
  }
  renderRoomList(state.bootstrap.rooms || []);
}

async function pollCurrentRoom() {
  if (!state.currentRoom) {
    return;
  }

  const roomData = await api(`/api/rooms/${state.currentRoom.id}`, {
    token: state.session?.token,
    suppressAuthError: true
  });

  if (roomData?.room) {
    state.currentRoom = roomData.room;
    syncCharacterSelectionToRoom();
    renderRoom();
  }

  await refreshRoomSummaries();
}

function startRoomPolling() {
  stopRoomPolling();
  state.roomPollHandle = window.setInterval(() => {
    pollCurrentRoom().catch((error) => {
      console.warn("Room polling failed:", error);
    });
  }, POLL_INTERVAL_MS);
}

function stopRoomPolling() {
  if (state.roomPollHandle) {
    window.clearInterval(state.roomPollHandle);
    state.roomPollHandle = null;
  }
}

function syncCharacterSelectionToRoom() {
  const viewerCharacterId = state.currentRoom?.viewer?.characterId;
  if (!viewerCharacterId) {
    return;
  }

  const option = [...elements.characterSelect.options].find((item) => item.value === viewerCharacterId);
  if (option) {
    elements.characterSelect.value = viewerCharacterId;
  }
}

function getSelectedCharacterId() {
  return elements.characterSelect.value || "";
}

function getSelectedCharacter() {
  return state.userCharacters.find((character) => character.id === getSelectedCharacterId()) || null;
}

function getRoomCharacterName(room, characterId) {
  const player = room.players.find((item) => item.characterId === characterId);
  return player?.character?.name || "未选择角色";
}

function formatRoomUpdated(timestamp) {
  return `更新于 ${new Date(timestamp).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function requireSession() {
  if (!state.session?.token) {
    throw new Error("请先登录或进入游客模式。");
  }
}

function getSelectedCompanions() {
  return [...elements.companionList.querySelectorAll("input:checked")].map((item) => item.value);
}

function splitInput(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { "x-session-token": options.token } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "请求失败" }));
    if (response.status === 401 && options.suppressAuthError) {
      return {};
    }
    throw new Error(error.error || "请求失败");
  }

  return response.json();
}
