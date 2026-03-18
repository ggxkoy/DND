const VIEWS = ["home", "rolecards", "gamelibrary", "friends", "library", "profile", "gameplay"];

const state = {
  bootstrap: null,
  session: null,
  investigators: [],
  currentRoom: null,
  selectedTemplate: "coc7",
  currentView: "home"
};

const el = {
  authScreen: document.querySelector("#auth-screen"),
  appScreen: document.querySelector("#app-screen"),
  aiStatus: document.querySelector("#ai-status"),
  sessionStatus: document.querySelector("#session-status"),
  navUsername: document.querySelector("#nav-username"),
  navLinks: [...document.querySelectorAll(".nav-link")],
  jumpButtons: [...document.querySelectorAll("[data-jump-view]")],
  homeStage: document.querySelector("#home-stage"),
  rolecardsStage: document.querySelector("#rolecards-stage"),
  gamelibraryStage: document.querySelector("#gamelibrary-stage"),
  friendsStage: document.querySelector("#friends-stage"),
  libraryStage: document.querySelector("#library-stage"),
  profileStage: document.querySelector("#profile-stage"),
  gameplayStage: document.querySelector("#gameplay-stage"),
  homeGreeting: document.querySelector("#home-greeting"),
  homeStats: document.querySelector("#home-stats"),
  homeModules: document.querySelector("#home-modules"),
  friendsList: document.querySelector("#friends-list"),
  libraryList: document.querySelector("#library-list"),
  profileSummary: document.querySelector("#profile-summary"),
  guestLogin: document.querySelector("#guest-login"),
  register: document.querySelector("#register"),
  login: document.querySelector("#login"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  occupationSelect: document.querySelector("#occupation-select"),
  portraitPreview: document.querySelector("#portrait-preview"),
  statPreview: document.querySelector("#stat-preview"),
  derivedPreview: document.querySelector("#derived-preview"),
  characterName: document.querySelector("#character-name"),
  characterAge: document.querySelector("#character-age"),
  hometownInput: document.querySelector("#hometown-input"),
  skillInput: document.querySelector("#skill-input"),
  backstoryInput: document.querySelector("#backstory-input"),
  createCharacter: document.querySelector("#create-character"),
  characterList: document.querySelector("#character-list"),
  characterSelect: document.querySelector("#character-select"),
  roomName: document.querySelector("#room-name"),
  moduleSelect: document.querySelector("#module-select"),
  createTemplateSelect: document.querySelector("#create-template-select"),
  companionList: document.querySelector("#companion-list"),
  scriptJson: document.querySelector("#script-json"),
  createRoom: document.querySelector("#create-room"),
  roomList: document.querySelector("#room-list"),
  roomMeta: document.querySelector("#room-meta"),
  narrativeTemplateSelect: document.querySelector("#narrative-template-select"),
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
  const token = localStorage.getItem("dnd-session-token");
  state.bootstrap = await api("/api/bootstrap", { token, suppressAuthError: true });
  hydrateSession(state.bootstrap.session);
  state.investigators = state.bootstrap.characters || [];
  state.selectedTemplate = Object.keys(state.bootstrap.narrativeTemplates || {})[0] || "coc7";
  bindEvents();
  renderAll();
}

function bindEvents() {
  el.navLinks.forEach((button) => {
    button.addEventListener("click", () => {
      state.currentView = button.dataset.view;
      renderAll();
    });
  });

  el.jumpButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.currentView = button.dataset.jumpView;
      renderAll();
    });
  });

  el.guestLogin.addEventListener("click", async () => {
    const data = await api("/api/auth/guest", { method: "POST" });
    hydrateSession(data.session);
    await syncBootstrap();
    renderAll();
  });

  el.register.addEventListener("click", async () => {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: { username: el.username.value.trim(), password: el.password.value.trim() }
    });
    hydrateSession(data.session);
    await syncBootstrap();
    renderAll();
  });

  el.login.addEventListener("click", async () => {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { username: el.username.value.trim(), password: el.password.value.trim() }
    });
    hydrateSession(data.session);
    await syncBootstrap();
    renderAll();
  });

  el.occupationSelect.addEventListener("change", renderCharacterPreview);

  el.createTemplateSelect.addEventListener("change", () => {
    state.selectedTemplate = el.createTemplateSelect.value;
    syncTemplateSelectors();
  });

  el.narrativeTemplateSelect.addEventListener("change", () => {
    state.selectedTemplate = el.narrativeTemplateSelect.value;
    syncTemplateSelectors();
  });

  el.createCharacter.addEventListener("click", async () => {
    requireSession();
    const data = await api("/api/characters", {
      method: "POST",
      token: state.session?.token,
      body: {
        name: el.characterName.value.trim(),
        age: Number(el.characterAge.value || 28),
        hometown: el.hometownInput.value.trim(),
        occupationId: el.occupationSelect.value,
        interestSkills: splitInput(el.skillInput.value),
        backstory: el.backstoryInput.value.trim()
      }
    });
    state.investigators.unshift(data.character);
    state.currentView = "rolecards";
    renderAll();
  });

  el.createRoom.addEventListener("click", async () => {
    requireSession();
    const data = await api("/api/rooms", {
      method: "POST",
      token: state.session?.token,
      body: {
        roomName: el.roomName.value.trim(),
        moduleId: el.moduleSelect.value,
        scriptJson: el.scriptJson.value.trim(),
        characterId: el.characterSelect.value,
        companionIds: getSelectedCompanions(),
        narrationTemplate: el.createTemplateSelect.value
      }
    });
    state.currentRoom = data.room;
    state.selectedTemplate = data.room.narrationTemplate || state.selectedTemplate;
    await syncBootstrap();
    state.currentView = "gameplay";
    renderAll();
  });

  el.submitFreeAction.addEventListener("click", async () => {
    if (!state.currentRoom) return;
    await performAction({ freeText: el.freeAction.value.trim() });
    el.freeAction.value = "";
  });
}

function renderAll() {
  renderShell();
  renderTopbar();
  fillOccupations();
  fillModules();
  fillNarrativeTemplates();
  fillCompanions();
  renderCharacterPreview();
  renderInvestigators();
  renderRooms();
  renderHome();
  renderFriends();
  renderLibrary();
  renderProfile();
  renderViews();
  renderGameplay();
}

function renderShell() {
  const loggedIn = Boolean(state.session?.token);
  el.authScreen.classList.toggle("hidden", loggedIn);
  el.appScreen.classList.toggle("hidden", !loggedIn);
}

function renderTopbar() {
  const username = state.session?.user?.name || "未登录";
  el.sessionStatus.textContent = username;
  el.navUsername.textContent = username;
  el.aiStatus.textContent = state.bootstrap?.config?.aiEnabled ? "LLM 守秘人在线" : "本地守秘人";
}

function fillOccupations() {
  el.occupationSelect.innerHTML = Object.entries(state.bootstrap.occupations || {})
    .map(([id, occupation]) => `<option value="${id}">${occupation.label}</option>`)
    .join("");
}

function fillModules() {
  el.moduleSelect.innerHTML = (state.bootstrap.modules || [])
    .map((module) => `<option value="${module.id}">${module.title} · ${module.summary}</option>`)
    .join("");
}

function fillNarrativeTemplates() {
  const options = Object.entries(state.bootstrap.narrativeTemplates || {})
    .map(([id, item]) => `<option value="${id}">${item.label}</option>`)
    .join("");
  el.createTemplateSelect.innerHTML = options;
  el.narrativeTemplateSelect.innerHTML = options;
  syncTemplateSelectors();
}

function syncTemplateSelectors() {
  el.createTemplateSelect.value = state.selectedTemplate;
  el.narrativeTemplateSelect.value = state.currentRoom?.narrationTemplate || state.selectedTemplate;
}

function fillCompanions() {
  el.companionList.innerHTML = (state.bootstrap.companions || [])
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
  const occupation = state.bootstrap.occupations?.[el.occupationSelect.value];
  if (!occupation) return;
  el.portraitPreview.textContent = occupation.portrait;
  const mockStats = {
    str: 60,
    con: 55,
    siz: 65,
    dex: 60,
    app: 50,
    int: 75,
    pow: 60,
    edu: 70
  };
  const derived = {
    hp: Math.floor((mockStats.con + mockStats.siz) / 10),
    mp: Math.floor(mockStats.pow / 5),
    san: mockStats.pow,
    luck: 60
  };
  el.statPreview.innerHTML = Object.entries(mockStats)
    .map(([key, value]) => `<div><span>${key.toUpperCase()}</span><strong>${value}</strong></div>`)
    .join("");
  el.derivedPreview.innerHTML = Object.entries(derived)
    .map(([key, value]) => `<div><span>${key.toUpperCase()}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderInvestigators() {
  if (!state.investigators.length) {
    el.characterList.innerHTML = `<p class="empty">当前还没有调查员。</p>`;
    fillCharacterSelect();
    return;
  }

  el.characterList.innerHTML = state.investigators
    .map(
      (item) => `
        <article class="mini-card">
          <h4>${item.name}</h4>
          <p>${state.bootstrap.occupations[item.occupationId].label} · ${item.age}岁</p>
          <p>SAN ${item.derived.san} / HP ${item.derived.hp} / Luck ${item.derived.luck}</p>
          <p>${topSkills(item.skills).join("、")}</p>
        </article>
      `
    )
    .join("");
  fillCharacterSelect();
}

function fillCharacterSelect() {
  el.characterSelect.innerHTML = state.investigators
    .map((item) => `<option value="${item.id}">${item.name}</option>`)
    .join("");
}

function topSkills(skills) {
  return Object.entries(skills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skillId, value]) => `${state.bootstrap.skills[skillId]?.label || skillId} ${value}`);
}

function renderRooms() {
  const rooms = state.bootstrap.rooms || [];
  el.roomList.innerHTML = rooms.length
    ? rooms
        .map(
          (room) => `
            <article class="room-card">
              <div>
                <h4>${room.roomName}</h4>
                <p>${room.moduleTitle} · ${room.players}人</p>
              </div>
              <div class="room-actions">
                <button data-room-id="${room.id}">进入</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<p class="empty">目前还没有案件房间。</p>`;

  el.homeModules.innerHTML = (state.bootstrap.modules || [])
    .map(
      (module) => `
        <article class="room-card">
          <div>
            <h4>${module.title}</h4>
            <p>${module.summary}</p>
          </div>
          <div class="room-actions">
            <button data-pick-module="${module.id}">选用</button>
          </div>
        </article>
      `
    )
    .join("");

  el.roomList.querySelectorAll("[data-room-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const data = await api(`/api/rooms/${button.dataset.roomId}`, { token: state.session?.token });
      state.currentRoom = data.room;
      state.currentView = "gameplay";
      renderAll();
    });
  });

  el.homeModules.querySelectorAll("[data-pick-module]").forEach((button) => {
    button.addEventListener("click", () => {
      el.moduleSelect.value = button.dataset.pickModule;
      state.currentView = "gamelibrary";
      renderAll();
    });
  });
}

function renderHome() {
  const username = state.session?.user?.name || "调查员";
  el.homeGreeting.textContent = `欢迎回来，${username} 调查员。`;
  el.homeStats.innerHTML = [
    ["角色卡", state.investigators.length],
    ["案件房间", (state.bootstrap.rooms || []).length],
    ["规则资料", 3],
    ["好友入口", 3]
  ]
    .map(
      ([label, value]) => `
        <article class="mini-card stat-card">
          <strong>${value}</strong>
          <span>${label}</span>
        </article>
      `
    )
    .join("");
}

function renderFriends() {
  const items = [
    ["黑尔", "常用搭档", "擅长侦查与搬运现场证物"],
    ["艾薇", "新闻线人", "适合偏都市调查与舆论追踪"],
    ["玛拉修女", "医疗支援", "在高压调查中提供稳定恢复"]
  ];
  el.friendsList.innerHTML = items
    .map(
      ([name, role, text]) => `
        <article class="mini-card">
          <h4>${name}</h4>
          <p>${role}</p>
          <p>${text}</p>
        </article>
      `
    )
    .join("");
}

function renderLibrary() {
  const items = [
    ["COC7 快速规则", "建卡、D100、理智与战斗基础"],
    ["调查员手册摘录", "职业、技能和背景塑造建议"],
    ["模组说明", "官方模组与自定义 JSON 模组格式"]
  ];
  el.libraryList.innerHTML = items
    .map(
      ([title, summary]) => `
        <article class="room-card">
          <div>
            <h4>${title}</h4>
            <p>${summary}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderProfile() {
  el.profileSummary.innerHTML = [
    ["账号", state.session?.user?.name || "未登录"],
    ["身份", state.session?.user?.isGuest ? "访客" : "正式账号"],
    ["当前模板", state.bootstrap.narrativeTemplates?.[state.selectedTemplate]?.label || "未选择"],
    ["角色数", state.investigators.length],
    ["房间数", (state.bootstrap.rooms || []).length]
  ]
    .map(([label, value]) => `<div class="summary-item"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderViews() {
  const stages = {
    home: el.homeStage,
    rolecards: el.rolecardsStage,
    gamelibrary: el.gamelibraryStage,
    friends: el.friendsStage,
    library: el.libraryStage,
    profile: el.profileStage,
    gameplay: el.gameplayStage
  };

  for (const view of VIEWS) {
    stages[view].classList.toggle("hidden", state.currentView !== view);
  }

  el.navLinks.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.currentView);
  });
}

function renderGameplay() {
  if (!state.currentRoom) {
    return;
  }

  const room = state.currentRoom;
  el.roomMeta.textContent = `${room.roomName} · ${room.module.title} · 第 ${room.turn + 1} 轮`;
  el.narrativeTemplateSelect.value = room.narrationTemplate || state.selectedTemplate;
  el.sceneArt.src = room.sceneArt;
  el.sceneTitle.textContent = room.currentScene.title;
  el.sceneDescription.textContent = room.currentScene.description;

  el.partyPanel.innerHTML =
    room.players
      .map(
        (player) => `
          <article class="mini-card">
            <h4>${player.character.name}</h4>
            <p>${state.bootstrap.occupations[player.character.occupationId].label}</p>
            <p>HP ${player.character.derived.hp} / SAN ${player.character.derived.san} / MP ${player.character.derived.mp}</p>
            <p>DB ${player.character.derived.damageBonus} / Build ${player.character.derived.build}</p>
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

  el.choiceList.innerHTML = "";
  room.currentScene.choices.forEach((choice) => {
    const button = el.choiceTemplate.content.firstElementChild.cloneNode(true);
    const skill = state.bootstrap.skills[choice.skill]?.label || choice.skill;
    button.textContent = `${choice.label} · ${skill} · ${difficultyLabel(choice.difficulty)}`;
    button.addEventListener("click", async () => {
      await performAction({ choiceId: choice.id });
    });
    el.choiceList.appendChild(button);
  });

  el.logList.innerHTML = room.logs
    .map((item) => `<p>${new Date(item.at).toLocaleTimeString()} · ${item.text}</p>`)
    .join("");
}

async function performAction({ choiceId = "", freeText = "" }) {
  const data = await api(`/api/rooms/${state.currentRoom.id}/action`, {
    method: "POST",
    token: state.session?.token,
    body: {
      choiceId,
      characterId: el.characterSelect.value,
      freeText,
      narrationTemplate: el.narrativeTemplateSelect.value
    }
  });
  state.currentRoom = data.room;
  state.selectedTemplate = data.room.narrationTemplate || state.selectedTemplate;
  el.diceResult.textContent = `${data.outcome.roll} / ${data.outcome.target} · ${data.outcome.label} · SAN-${data.outcome.sanLoss}`;
  renderAll();
}

function hydrateSession(session) {
  state.session = session || null;
  if (session?.token) {
    localStorage.setItem("dnd-session-token", session.token);
  } else {
    localStorage.removeItem("dnd-session-token");
  }
}

async function syncBootstrap() {
  state.bootstrap = await api("/api/bootstrap", {
    token: state.session?.token,
    suppressAuthError: true
  });
  state.investigators = state.bootstrap.characters || [];
}

function getSelectedCompanions() {
  return [...el.companionList.querySelectorAll("input:checked")].map((item) => item.value);
}

function difficultyLabel(value) {
  return value === "extreme" ? "极难" : value === "hard" ? "困难" : "常规";
}

function splitInput(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireSession() {
  if (!state.session?.token) {
    throw new Error("请先登录或以访客模式进入。");
  }
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
