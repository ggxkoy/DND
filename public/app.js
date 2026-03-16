const state = {
  bootstrap: null,
  session: null,
  userCharacters: [],
  currentRoom: null
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

function hydrateSession(session) {
  state.session = session || null;
  if (session?.token) {
    localStorage.setItem("dnd-session-token", session.token);
  } else {
    localStorage.removeItem("dnd-session-token");
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
  elements.characterSelect.innerHTML = state.userCharacters
    .map((character) => `<option value="${character.id}">${character.name}</option>`)
    .join("");
}

function renderRoomList(rooms) {
  if (!rooms.length) {
    elements.roomList.innerHTML = `<p class="empty">大厅还没有房间。</p>`;
    return;
  }

  elements.roomList.innerHTML = rooms
    .map(
      (room) => `
        <article class="room-card">
          <div>
            <h4>${room.roomName}</h4>
            <p>${room.moduleTitle} · ${room.players}人</p>
          </div>
          <div class="room-actions">
            <button data-open-room="${room.id}">进入</button>
          </div>
        </article>
      `
    )
    .join("");

  elements.roomList.querySelectorAll("[data-open-room]").forEach((button) => {
    button.addEventListener("click", async () => {
      await openRoom(button.dataset.openRoom);
    });
  });
}

async function refreshRooms(focusRoomId) {
  const bootstrap = await api("/api/bootstrap", {
    token: state.session?.token,
    suppressAuthError: true
  });
  state.bootstrap.rooms = bootstrap.rooms;
  renderRoomList(bootstrap.rooms);
  if (focusRoomId) {
    await openRoom(focusRoomId);
  }
}

async function openRoom(roomId) {
  requireSession();
  const data = await api(`/api/rooms/${roomId}`, { token: state.session?.token });
  state.currentRoom = data.room;
  renderRoom();
}

function renderRoom() {
  const room = state.currentRoom;
  if (!room) {
    return;
  }

  elements.roomMeta.textContent = `${room.roomName} · ${room.module.title} · 第 ${room.turn + 1} 回合`;
  elements.sceneArt.src = room.sceneArt;
  elements.sceneTitle.textContent = room.currentScene.title;
  elements.sceneDescription.textContent = room.currentScene.description;
  elements.partyPanel.innerHTML =
    room.players
      .map(
        (player) => `
          <article class="mini-card">
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
  room.currentScene.choices.forEach((choice) => {
    const button = elements.choiceTemplate.content.firstElementChild.cloneNode(true);
    button.textContent = `${choice.label} · ${choice.skill} / DC ${choice.dc}`;
    button.addEventListener("click", async () => {
      await performAction({ choiceId: choice.id });
    });
    elements.choiceList.appendChild(button);
  });

  elements.logList.innerHTML = room.logs
    .map((log) => `<p>${new Date(log.at).toLocaleTimeString()} · ${log.text}</p>`)
    .join("");
}

async function performAction({ choiceId = "", freeText = "" }) {
  const data = await api(`/api/rooms/${state.currentRoom.id}/action`, {
    method: "POST",
    token: state.session?.token,
    body: {
      choiceId,
      characterId: elements.characterSelect.value,
      freeText
    }
  });
  state.currentRoom = data.room;
  elements.diceResult.textContent = `d20=${data.outcome.roll} · 总值 ${data.outcome.total}/${data.outcome.dc}`;
  renderRoom();
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
