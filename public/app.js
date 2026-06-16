import * as THREE from "/vendor/three/build/three.module.js";

const PLANET_RADIUS = 8;
const PLAYER_OFFSET = 0.75;
const NPC_OFFSET = 0.65;
const SAVE_KEY = "messenger-geometry-clone-progress";
const OUTFIT_KEY = "messenger-geometry-clone-outfit";
const UP = new THREE.Vector3(0, 1, 0);

const questDefinitions = [
  {
    id: "quest-employee",
    title: "办公室急件",
    steps: [
      { npc: "office-worker-2", text: "从办公室职员那里领取文件" },
      { npc: "boss", text: "把文件交给老板" },
      { npc: "office-worker-2", text: "向办公室职员回报" }
    ]
  },
  {
    id: "quest-caveman",
    title: "洞穴与花",
    steps: [
      { npc: "caveman", text: "听穴居人的请求" },
      { npc: "flower-lady", text: "向卖花女士取花" },
      { npc: "caveman", text: "把花带回给穴居人" }
    ]
  },
  {
    id: "quest-scientists",
    title: "实验室接力",
    steps: [
      { npc: "factory-worker-a", text: "领取工厂样本" },
      { npc: "male-scientist", text: "交给男科学家检测" },
      { npc: "female-scientist", text: "把结果交给女科学家" }
    ]
  },
  {
    id: "quest-temple",
    title: "山顶口信",
    steps: [
      { npc: "oldwoman", text: "听老妇人的山顶口信" },
      { npc: "mountainman", text: "转告山顶隐士" }
    ]
  },
  {
    id: "quest-musician",
    title: "海边旋律",
    steps: [
      { npc: "diver", text: "向潜水员询问贝壳" },
      { npc: "musician", text: "把贝壳交给音乐家" }
    ]
  }
];

const npcDefinitions = [
  {
    id: "office-worker-2",
    name: "办公室职员",
    role: "急件发起人",
    quest: "quest-employee",
    color: "#ffb347",
    position: [26.2539, 9.70977, 1.39919],
    success: ["这份文件终于有人送了。", "老板签字了？太好了，今天还能准时下班。"],
    idle: "文件还在路上吗？老板那边很急。"
  },
  {
    id: "boss",
    name: "老板",
    role: "办公室终点",
    quest: "quest-employee",
    color: "#6f86d6",
    position: [-4.04907, 1.05824, 25.4517],
    success: ["文件我收到了。把回执带回去。"],
    idle: "没有正式文件的话，我现在不签任何东西。"
  },
  {
    id: "caveman",
    name: "穴居人",
    role: "古老住民",
    quest: "quest-caveman",
    color: "#b97845",
    position: [-22.9825, -3.72729, 4.71889],
    success: ["朋友，我想送一朵花。", "这朵花很好。石头屋今天也有春天。"],
    idle: "花还没有来。石头还在等。"
  },
  {
    id: "flower-lady",
    name: "卖花女士",
    role: "花园看护",
    quest: "quest-caveman",
    color: "#ef7aa7",
    position: [27.4269, 4.65974, 3.58217],
    success: ["给他这朵耐风的黄色小花。"],
    idle: "如果有人真心需要花，我会准备好。"
  },
  {
    id: "factory-worker-a",
    name: "工厂员工",
    role: "样本管理员",
    quest: "quest-scientists",
    color: "#5aa6a6",
    position: [4.16546, 4.2699, -23.5919],
    success: ["这个样本要马上送去实验室。别摇晃。"],
    idle: "样本交接要按流程走。"
  },
  {
    id: "male-scientist",
    name: "男科学家",
    role: "检测人员",
    quest: "quest-scientists",
    color: "#f2f2f2",
    position: [10.8494, 23.3367, -7.73384],
    success: ["检测完成。数据要交给另一位科学家复核。"],
    idle: "没有样本，我只能继续调仪器。"
  },
  {
    id: "female-scientist",
    name: "女科学家",
    role: "复核人员",
    quest: "quest-scientists",
    color: "#b7e5ff",
    position: [-7.46008, -7.60516, -19.6894],
    success: ["结果对上了。实验室这条线完成。"],
    idle: "等检测数据到了，我会给最终结论。"
  },
  {
    id: "oldwoman",
    name: "老妇人",
    role: "村口信使",
    quest: "quest-temple",
    color: "#d8c3a5",
    position: [23.3711, -16.514, 12.462],
    success: ["请告诉山上的人，钟声今晚会提前响。"],
    idle: "山路远，口信不能丢。"
  },
  {
    id: "mountainman",
    name: "山顶隐士",
    role: "高处守望者",
    quest: "quest-temple",
    color: "#8f9b70",
    position: [-8.17226, 32.3472, -1.76941],
    success: ["我听见了。钟声会照顾到山下的人。"],
    idle: "风很大，说话要带着真正的消息。"
  },
  {
    id: "diver",
    name: "潜水员",
    role: "海边收集者",
    quest: "quest-musician",
    color: "#3aa9d9",
    position: [15.8793, 16.9006, 11.2543],
    success: ["我在海底找到一枚会回声的贝壳。给音乐家吧。"],
    idle: "海水今天很清，贝壳也许就在下面。"
  },
  {
    id: "musician",
    name: "音乐家",
    role: "广场演奏者",
    quest: "quest-musician",
    color: "#a36be8",
    position: [15.0288, -14.7864, -7.09569],
    success: ["贝壳的声音正好。新的曲子完成了。"],
    idle: "少了一点海里的回声，旋律总是不完整。"
  }
];

const outfitColors = ["#d75d3d", "#2d7ed4", "#38a96b", "#efaa34", "#9b6ce0"];

const dom = {
  canvas: document.querySelector("#world"),
  titleScreen: document.querySelector("#title-screen"),
  begin: document.querySelector("#begin-button"),
  hud: document.querySelector("#hud"),
  questList: document.querySelector("#quest-list"),
  prompt: document.querySelector("#interaction-prompt"),
  dialogue: document.querySelector("#dialogue"),
  dialogueRole: document.querySelector("#dialogue-role"),
  dialogueName: document.querySelector("#dialogue-name"),
  dialogueText: document.querySelector("#dialogue-text"),
  dialogueClose: document.querySelector("#dialogue-close"),
  resetProgress: document.querySelector("#reset-progress"),
  musicToggle: document.querySelector("#music-toggle"),
  outfitToggle: document.querySelector("#outfit-toggle"),
  focusPlayer: document.querySelector("#focus-player"),
  touchButtons: [...document.querySelectorAll("[data-touch-key]")]
};

const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#73d5e4");
scene.fog = new THREE.Fog("#73d5e4", 35, 86);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 150);

const world = new THREE.Group();
scene.add(world);

let lastFrameTime = performance.now();
const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false
};

const state = {
  mode: "title",
  progress: loadProgress(),
  nearNpc: null,
  dialogueOpen: false,
  musicOn: false,
  outfitIndex: Number(localStorage.getItem(OUTFIT_KEY) || 0) % outfitColors.length,
  playerNormal: new THREE.Vector3(0.38, 0.34, 0.86).normalize(),
  playerForward: new THREE.Vector3(0, 0, -1),
  cameraNormal: new THREE.Vector3(0.38, 0.34, 0.86).normalize(),
  cameraForward: new THREE.Vector3(0, 0, -1),
  jumpVelocity: 0,
  jumpHeight: 0,
  titleOrbit: 0,
  lastPromptNpc: null
};

const refs = {
  planet: null,
  player: null,
  playerBody: null,
  npcMeshes: new Map(),
  npcLabels: new Map(),
  questSprites: new Map()
};

init();

function init() {
  createLights();
  createSea();
  createPlanet();
  createPlayer();
  resetCameraHeading(true);
  createNpcSet();
  createProps();
  bindEvents();
  renderQuestList();
  resize();
  renderer.setAnimationLoop(tick);
}

function createLights() {
  const hemi = new THREE.HemisphereLight("#f8f2d5", "#31768a", 1.8);
  scene.add(hemi);

  const key = new THREE.DirectionalLight("#fff7d8", 2.4);
  key.position.set(16, 22, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  scene.add(key);

  const rim = new THREE.DirectionalLight("#6ef0ff", 0.8);
  rim.position.set(-18, 8, -10);
  scene.add(rim);
}

function createSea() {
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(72, 96),
    new THREE.MeshStandardMaterial({
      color: "#40bfcf",
      roughness: 0.72,
      metalness: 0.02
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -13.5;
  sea.receiveShadow = true;
  scene.add(sea);

  for (let i = 0; i < 9; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(10 + i * 5.5, 0.018, 6, 96),
      new THREE.MeshBasicMaterial({ color: "#9be9ef", transparent: true, opacity: 0.28 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -13.42 + i * 0.005;
    scene.add(ring);
  }
}

function createPlanet() {
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS, 56, 36),
    new THREE.MeshStandardMaterial({
      color: "#53b96a",
      roughness: 0.92,
      flatShading: true
    })
  );
  planet.castShadow = true;
  planet.receiveShadow = true;
  refs.planet = planet;
  world.add(planet);

  addSurfaceDisk([0.2, 1, 0.2], 2.0, "#7ad46f");
  addSurfaceDisk([0.2, -0.22, 1], 2.6, "#f0d36d");
  addSurfaceDisk([-0.95, -0.12, 0.25], 2.2, "#9ec96e");
  addSurfaceDisk([0.55, 0.56, -0.62], 2.2, "#76cf76");
  addSurfaceDisk([-0.15, 0.86, -0.48], 1.8, "#e7c77a");
  addSurfaceDisk([0.68, -0.62, -0.38], 1.9, "#8ac5d5");
}

function addSurfaceDisk(position, radius, color) {
  const normal = vectorFromArray(position).normalize();
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      side: THREE.DoubleSide,
      flatShading: true
    })
  );
  disk.position.copy(normal).multiplyScalar(PLANET_RADIUS + 0.025);
  disk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  disk.receiveShadow = true;
  world.add(disk);
  return disk;
}

function createPlayer() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.72, 6, 12),
    new THREE.MeshStandardMaterial({ color: outfitColors[state.outfitIndex], roughness: 0.72 })
  );
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  refs.playerBody = body;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 18, 12),
    new THREE.MeshStandardMaterial({ color: "#f1bd86", roughness: 0.7 })
  );
  head.position.y = 1.16;
  head.castShadow = true;
  group.add(head);

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.5, 0.22),
    new THREE.MeshStandardMaterial({ color: "#3b6270", roughness: 0.82 })
  );
  backpack.position.set(0, 0.62, 0.29);
  backpack.castShadow = true;
  group.add(backpack);

  const headset = new THREE.Mesh(
    new THREE.TorusGeometry(0.27, 0.025, 8, 20, Math.PI),
    new THREE.MeshStandardMaterial({ color: "#23323a", roughness: 0.55 })
  );
  headset.position.y = 1.19;
  headset.rotation.z = Math.PI;
  group.add(headset);

  refs.player = group;
  world.add(group);
  placeCharacterOnPlanet(group, state.playerNormal, PLAYER_OFFSET, state.playerForward);
}

function createNpcSet() {
  npcDefinitions.forEach((npc) => {
    const normal = vectorFromArray(npc.position).normalize();
    npc.normal = normal;

    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.25, 0.62, 5, 10),
      new THREE.MeshStandardMaterial({ color: npc.color, roughness: 0.8 })
    );
    body.position.y = 0.46;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 14, 10),
      new THREE.MeshStandardMaterial({ color: "#e8be8f", roughness: 0.75 })
    );
    head.position.y = 0.98;
    head.castShadow = true;
    group.add(head);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.06, 18),
      new THREE.MeshStandardMaterial({ color: "#fff2bf", roughness: 0.85 })
    );
    base.position.y = 0.03;
    base.receiveShadow = true;
    group.add(base);

    placeCharacterOnPlanet(group, normal, NPC_OFFSET);
    world.add(group);
    refs.npcMeshes.set(npc.id, group);

    const marker = makeTextSprite(getNpcMarker(npc), {
      fill: "#1d2830",
      background: "#ffd341",
      size: 96,
      fontSize: 58
    });
    marker.position.copy(normal).multiplyScalar(PLANET_RADIUS + 2.25);
    marker.scale.set(0.78, 0.78, 0.78);
    world.add(marker);
    refs.questSprites.set(npc.id, marker);

    const label = makeTextSprite(npc.name, {
      fill: "#20313a",
      background: "rgba(255,248,224,0.92)",
      size: 256,
      fontSize: 34
    });
    label.position.copy(normal).multiplyScalar(PLANET_RADIUS + 1.58);
    label.scale.set(1.6, 0.52, 1);
    label.visible = false;
    world.add(label);
    refs.npcLabels.set(npc.id, label);
  });
}

function createProps() {
  const buildingSpots = [
    { pos: [0.96, 0.18, 0.04], color: "#f6e4b0" },
    { pos: [-0.14, 0.02, 0.98], color: "#e8f0f4" },
    { pos: [0.16, 0.12, -0.96], color: "#d7d2c8" },
    { pos: [-0.9, -0.2, 0.28], color: "#f0c082" }
  ];

  buildingSpots.forEach((item, index) => {
    const normal = vectorFromArray(item.pos).normalize();
    const building = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.8 + index * 0.12, 0.9),
      new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.78 })
    );
    box.position.y = 0.42;
    box.castShadow = true;
    building.add(box);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.72, 0.42, 4),
      new THREE.MeshStandardMaterial({ color: index % 2 ? "#d64b38" : "#316d97", roughness: 0.7 })
    );
    roof.position.y = 1.08 + index * 0.06;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    building.add(roof);
    placeCharacterOnPlanet(building, normal, 0.02);
    world.add(building);
  });

  const treePositions = [
    [0.52, 0.68, 0.5],
    [0.44, 0.78, 0.22],
    [-0.68, 0.42, 0.32],
    [-0.72, -0.34, 0.46],
    [0.2, -0.82, 0.42],
    [0.64, -0.42, -0.44],
    [-0.28, 0.66, -0.62],
    [0.18, 0.92, -0.2],
    [-0.44, -0.66, -0.58],
    [0.76, 0.18, -0.58]
  ];
  treePositions.forEach((pos) => createTree(vectorFromArray(pos).normalize()));
}

function createTree(normal) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.11, 0.55, 7),
    new THREE.MeshStandardMaterial({ color: "#855b36", roughness: 0.8 })
  );
  trunk.position.y = 0.28;
  trunk.castShadow = true;
  tree.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.82, 8),
    new THREE.MeshStandardMaterial({ color: "#2f8d57", roughness: 0.86, flatShading: true })
  );
  crown.position.y = 0.88;
  crown.castShadow = true;
  tree.add(crown);
  placeCharacterOnPlanet(tree, normal, 0.02);
  world.add(tree);
}

function bindEvents() {
  dom.begin.addEventListener("click", startGame);
  dom.dialogueClose.addEventListener("click", closeDialogue);
  dom.resetProgress.addEventListener("click", () => {
    state.progress = makeInitialProgress();
    saveProgress();
    updateQuestMarkers();
    renderQuestList();
    showDialogue({
      name: "系统",
      role: "任务重置",
      text: "所有投递目标已重置，可以重新完成每一条任务链。"
    });
  });
  dom.musicToggle.addEventListener("click", () => {
    state.musicOn = !state.musicOn;
    dom.musicToggle.classList.toggle("is-active", state.musicOn);
    dom.musicToggle.title = state.musicOn ? "音乐：开" : "音乐：关";
  });
  dom.outfitToggle.addEventListener("click", () => {
    state.outfitIndex = (state.outfitIndex + 1) % outfitColors.length;
    localStorage.setItem(OUTFIT_KEY, String(state.outfitIndex));
    refs.playerBody.material.color.set(outfitColors[state.outfitIndex]);
  });
  dom.focusPlayer.addEventListener("click", () => {
    resetCameraHeading(true);
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", resize);

  dom.touchButtons.forEach((button) => {
    const key = button.dataset.touchKey;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (key === "talk") {
        interactWithNearest();
        return;
      }
      input[key] = true;
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", () => {
      input[key] = false;
    });
    button.addEventListener("pointercancel", () => {
      input[key] = false;
    });
    button.addEventListener("pointerleave", () => {
      input[key] = false;
    });
  });
}

function startGame() {
  state.mode = "play";
  world.rotation.set(0, 0, 0);
  resetCameraHeading(true);
  lastFrameTime = performance.now();
  dom.titleScreen.classList.add("is-hidden");
  dom.hud.classList.remove("is-hidden");
  updateQuestMarkers();
  renderQuestList();
}

function onKeyDown(event) {
  if (event.repeat && event.code !== "Space") {
    return;
  }
  setKey(event.code, true);
  if (event.code === "KeyE") {
    interactWithNearest();
  }
  if (event.code === "Space" && state.jumpHeight <= 0.01) {
    state.jumpVelocity = 4.8;
  }
}

function onKeyUp(event) {
  setKey(event.code, false);
}

function setKey(code, pressed) {
  if (code === "KeyW" || code === "ArrowUp") input.up = pressed;
  if (code === "KeyS" || code === "ArrowDown") input.down = pressed;
  if (code === "KeyA" || code === "ArrowLeft") input.left = pressed;
  if (code === "KeyD" || code === "ArrowRight") input.right = pressed;
  if (code === "ShiftLeft" || code === "ShiftRight") input.sprint = pressed;
}

function hasMovementInput() {
  return input.up || input.down || input.left || input.right;
}

function projectDirectionOnTangent(direction, normal, fallbackDirection = new THREE.Vector3(0, 0, -1)) {
  const projected = direction.clone().projectOnPlane(normal);
  if (projected.lengthSq() > 0.0001) {
    return projected.normalize();
  }

  const fallback = fallbackDirection.clone().projectOnPlane(normal);
  if (fallback.lengthSq() > 0.0001) {
    return fallback.normalize();
  }

  return new THREE.Vector3(1, 0, 0).projectOnPlane(normal).normalize();
}

function getCameraPose() {
  const cameraNormal = state.cameraNormal.clone().normalize();
  const cameraForward = projectDirectionOnTangent(state.cameraForward, cameraNormal, state.playerForward);
  return {
    position: cameraNormal
      .clone()
      .multiplyScalar(PLANET_RADIUS + 5.4)
      .addScaledVector(cameraForward, -9.6),
    target: state.playerNormal
      .clone()
      .multiplyScalar(PLANET_RADIUS + 1.25)
      .addScaledVector(cameraForward, 1.15),
    up: cameraNormal
  };
}

function applyCameraPose(instant = false) {
  const pose = getCameraPose();
  if (instant) {
    camera.position.copy(pose.position);
    camera.up.copy(pose.up);
  } else {
    camera.position.lerp(pose.position, 0.18);
    camera.up.lerp(pose.up, 0.22).normalize();
  }
  camera.lookAt(pose.target);
}

function resetCameraHeading(instant = false) {
  state.cameraNormal.copy(state.playerNormal);
  state.cameraForward.copy(
    projectDirectionOnTangent(state.playerForward, state.playerNormal, new THREE.Vector3(0, 0, -1))
  );
  applyCameraPose(instant);
}

function tick() {
  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;
  if (state.mode === "title") {
    updateTitleCamera(dt);
  } else {
    updatePlayer(dt);
    updateCamera(dt);
    updateNpcPrompt();
  }
  animateWorld(dt);
  renderer.render(scene, camera);
}

function updateTitleCamera(dt) {
  state.titleOrbit += dt * 0.22;
  const radius = 25;
  camera.position.set(
    Math.sin(state.titleOrbit) * radius,
    10 + Math.sin(state.titleOrbit * 0.8) * 1.2,
    Math.cos(state.titleOrbit) * radius
  );
  camera.lookAt(0, 1.2, 0);
}

function updatePlayer(dt) {
  const normal = state.playerNormal;
  const cameraForward = projectDirectionOnTangent(state.cameraForward, normal, state.playerForward);

  const cameraRight = new THREE.Vector3().crossVectors(cameraForward, normal).normalize();
  const move = new THREE.Vector3();
  if (input.up) move.add(cameraForward);
  if (input.down) move.sub(cameraForward);
  if (input.right) move.add(cameraRight);
  if (input.left) move.sub(cameraRight);

  if (move.lengthSq() > 0.0001 && !state.dialogueOpen) {
    move.normalize();
    const speed = input.sprint ? 4.2 : 2.8;
    normal.addScaledVector(move, (speed * dt) / PLANET_RADIUS).normalize();
    state.playerForward.copy(projectDirectionOnTangent(move, normal, state.playerForward));
  }

  if (state.jumpVelocity !== 0 || state.jumpHeight > 0) {
    state.jumpVelocity -= 12 * dt;
    state.jumpHeight = Math.max(0, state.jumpHeight + state.jumpVelocity * dt);
    if (state.jumpHeight === 0) {
      state.jumpVelocity = 0;
    }
  }

  placeCharacterOnPlanet(refs.player, normal, PLAYER_OFFSET + state.jumpHeight, state.playerForward);
}

function updateCamera(dt) {
  const normal = state.playerNormal;
  const normalLerp = 1 - Math.pow(0.003, dt);
  state.cameraNormal.lerp(normal, normalLerp).normalize();

  const desiredForward = hasMovementInput() && !state.dialogueOpen ? state.playerForward : state.cameraForward;
  const headingLerp = 1 - Math.pow(0.02, dt);
  const targetForward = projectDirectionOnTangent(desiredForward, state.cameraNormal, state.playerForward);
  state.cameraForward.lerp(targetForward, headingLerp).normalize();

  applyCameraPose(false);
}

function updateNpcPrompt() {
  const near = findNearestNpc();
  state.nearNpc = near;

  refs.npcLabels.forEach((label, id) => {
    label.visible = near?.id === id;
  });

  if (!near) {
    dom.prompt.classList.add("is-hidden");
    state.lastPromptNpc = null;
    return;
  }

  const questHint = getNpcQuestHint(near);
  dom.prompt.textContent = `按 E 与 ${near.name} 对话 · ${questHint}`;
  dom.prompt.classList.remove("is-hidden");
  state.lastPromptNpc = near.id;
}

function animateWorld(dt) {
  if (state.mode === "title") {
    world.rotation.y += dt * 0.04;
  }
  refs.questSprites.forEach((sprite, id) => {
    const npc = npcDefinitions.find((item) => item.id === id);
    const markerScale = isNpcCurrentObjective(npc) ? 0.86 : 0.62;
    const pulse = isNpcCurrentObjective(npc) ? Math.sin(performance.now() * 0.006) * 0.08 : 0;
    sprite.scale.setScalar(markerScale + pulse);
    sprite.quaternion.copy(camera.quaternion);
  });
  refs.npcLabels.forEach((label) => {
    label.quaternion.copy(camera.quaternion);
  });
}

function interactWithNearest() {
  if (state.dialogueOpen) {
    closeDialogue();
    return;
  }
  if (!state.nearNpc) {
    return;
  }
  interactWithNpc(state.nearNpc);
}

function interactWithNpc(npc) {
  const quest = questDefinitions.find((item) => item.id === npc.quest);
  const stepIndex = getCurrentStepIndex(quest.id);
  const currentStep = quest.steps[stepIndex];

  if (!currentStep) {
    showDialogue({
      name: npc.name,
      role: npc.role,
      text: `${npc.name}点点头：这条投递线已经完成了。`
    });
    return;
  }

  if (currentStep.npc !== npc.id) {
    showDialogue({
      name: npc.name,
      role: npc.role,
      text: npc.idle
    });
    return;
  }

  state.progress[quest.id][stepIndex] = true;
  saveProgress();
  updateQuestMarkers();
  renderQuestList();

  const isQuestDone = state.progress[quest.id].every(Boolean);
  const text =
    npc.success[Math.min(stepIndex, npc.success.length - 1)] ||
    `步骤完成：${currentStep.text}。`;
  showDialogue({
    name: npc.name,
    role: isQuestDone ? "任务完成" : npc.role,
    text: isQuestDone ? `${text}「${quest.title}」完成。` : text
  });
}

function showDialogue({ name, role, text }) {
  state.dialogueOpen = true;
  dom.dialogueName.textContent = name;
  dom.dialogueRole.textContent = role;
  dom.dialogueText.textContent = text;
  dom.dialogue.classList.remove("is-hidden");
}

function closeDialogue() {
  state.dialogueOpen = false;
  dom.dialogue.classList.add("is-hidden");
}

function findNearestNpc() {
  let nearest = null;
  let bestDistance = Infinity;
  npcDefinitions.forEach((npc) => {
    const surfaceDistance = state.playerNormal.angleTo(npc.normal) * PLANET_RADIUS;
    if (surfaceDistance < bestDistance) {
      bestDistance = surfaceDistance;
      nearest = npc;
    }
  });
  return bestDistance <= 1.8 ? nearest : null;
}

function renderQuestList() {
  dom.questList.innerHTML = "";
  questDefinitions.forEach((quest) => {
    const doneCount = state.progress[quest.id].filter(Boolean).length;
    const item = document.createElement("article");
    item.className = "quest-item";

    const title = document.createElement("p");
    title.className = "quest-title";
    title.innerHTML = `<span>${quest.title}</span><span class="quest-count">${doneCount}/${quest.steps.length}</span>`;
    item.append(title);

    const steps = document.createElement("div");
    steps.className = "step-list";
    const currentStepIndex = getCurrentStepIndex(quest.id);

    quest.steps.forEach((step, index) => {
      const row = document.createElement("div");
      row.className = "quest-step";
      if (state.progress[quest.id][index]) row.classList.add("is-done");
      if (index === currentStepIndex) row.classList.add("is-current");
      row.innerHTML = `<span>${state.progress[quest.id][index] ? "✓" : index + 1}</span><span>${step.text}</span>`;
      steps.append(row);
    });
    item.append(steps);
    dom.questList.append(item);
  });
}

function updateQuestMarkers() {
  npcDefinitions.forEach((npc) => {
    const marker = refs.questSprites.get(npc.id);
    if (!marker) {
      return;
    }
    const active = isNpcCurrentObjective(npc);
    const completed = state.progress[npc.quest].every(Boolean);
    marker.material.map = makeTextTexture(completed ? "✓" : active ? "!" : "•", {
      fill: completed ? "#186b38" : "#1d2830",
      background: active ? "#ffd341" : "rgba(255,248,224,0.86)",
      size: 96,
      fontSize: completed ? 58 : 62
    });
    marker.material.needsUpdate = true;
  });
}

function getNpcQuestHint(npc) {
  if (state.progress[npc.quest].every(Boolean)) {
    return "已完成";
  }
  return isNpcCurrentObjective(npc) ? "当前目标" : "稍后再来";
}

function isNpcCurrentObjective(npc) {
  const quest = questDefinitions.find((item) => item.id === npc.quest);
  const index = getCurrentStepIndex(quest.id);
  return quest.steps[index]?.npc === npc.id;
}

function getCurrentStepIndex(questId) {
  const index = state.progress[questId].findIndex((done) => !done);
  return index === -1 ? state.progress[questId].length : index;
}

function placeCharacterOnPlanet(group, normal, offset, forward = null) {
  group.position.copy(normal).multiplyScalar(PLANET_RADIUS + offset);
  const base = new THREE.Quaternion().setFromUnitVectors(UP, normal);
  group.quaternion.copy(base);

  if (forward && forward.lengthSq() > 0.001) {
    const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(base).projectOnPlane(normal);
    if (localForward.lengthSq() > 0.001) {
      localForward.normalize();
      const targetForward = forward.clone().projectOnPlane(normal).normalize();
      const sign = Math.sign(new THREE.Vector3().crossVectors(localForward, targetForward).dot(normal));
      const angle = localForward.angleTo(targetForward) * (sign || 1);
      group.rotateY(angle);
    }
  }
}

function makeTextSprite(text, options) {
  const texture = makeTextTexture(text, options);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  return new THREE.Sprite(material);
}

function makeTextTexture(text, options) {
  const size = options.size || 128;
  const canvas = document.createElement("canvas");
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.background || "rgba(255,255,255,0.9)";
  roundedRect(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(29,40,48,0.34)";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = options.fill || "#1d2830";
  ctx.font = `900 ${options.fontSize || 48}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    const initial = makeInitialProgress();
    questDefinitions.forEach((quest) => {
      if (!Array.isArray(saved?.[quest.id]) || saved[quest.id].length !== quest.steps.length) {
        saved[quest.id] = initial[quest.id];
      }
    });
    return saved || initial;
  } catch {
    return makeInitialProgress();
  }
}

function makeInitialProgress() {
  return Object.fromEntries(questDefinitions.map((quest) => [quest.id, quest.steps.map(() => false)]));
}

function saveProgress() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state.progress));
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (state.mode !== "title") {
    applyCameraPose(true);
  }
}

function vectorFromArray(value) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function getNpcMarker(npc) {
  return isNpcCurrentObjective(npc) ? "!" : "•";
}

window.__messengerClone = {
  getState() {
    return {
      mode: state.mode,
      progress: state.progress,
      playerNormal: state.playerNormal.toArray(),
      playerForward: state.playerForward.toArray(),
      cameraNormal: state.cameraNormal.toArray(),
      cameraForward: state.cameraForward.toArray(),
      cameraUpDot: camera.up.dot(state.playerNormal),
      nearNpc: state.nearNpc?.id || null
    };
  },
  teleportToNpc(id) {
    const npc = npcDefinitions.find((item) => item.id === id);
    if (!npc) {
      return false;
    }
    state.playerNormal.copy(npc.normal.clone().addScaledVector(state.playerForward, -0.12).normalize());
    placeCharacterOnPlanet(refs.player, state.playerNormal, PLAYER_OFFSET, state.playerForward);
    resetCameraHeading(true);
    return true;
  }
};
