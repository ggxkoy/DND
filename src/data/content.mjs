export const RACES = {
  human: {
    label: "人类",
    portrait: "Human Strategist",
    bonuses: { strength: 1, agility: 1, intellect: 1, spirit: 1, charm: 1 }
  },
  dwarf: {
    label: "矮人",
    portrait: "Dwarf Warden",
    bonuses: { strength: 2, agility: 0, intellect: 0, spirit: 2, charm: -1 }
  },
  elf: {
    label: "精灵",
    portrait: "Elf Seer",
    bonuses: { strength: 0, agility: 2, intellect: 2, spirit: 0, charm: 1 }
  },
  tiefling: {
    label: "提夫林",
    portrait: "Infernal Diplomat",
    bonuses: { strength: 0, agility: 1, intellect: 1, spirit: 1, charm: 2 }
  }
};

export const CLASSES = {
  fighter: {
    label: "战士",
    portrait: "Steel Vanguard",
    skills: ["athletics", "survival", "intimidation"],
    gear: ["长剑", "盾牌", "锁子甲"]
  },
  mage: {
    label: "法师",
    portrait: "Arcane Scholar",
    skills: ["arcana", "history", "investigation"],
    gear: ["法杖", "法术书", "奥术披风"]
  },
  cleric: {
    label: "牧师",
    portrait: "Temple Herald",
    skills: ["medicine", "insight", "religion"],
    gear: ["圣徽", "权杖", "治疗药剂"]
  },
  rogue: {
    label: "盗贼",
    portrait: "Shadow Operative",
    skills: ["stealth", "sleight", "deception"],
    gear: ["匕首", "开锁工具", "烟雾弹"]
  }
};

export const COMPANIONS = [
  {
    id: "thief-cautious",
    name: "维斯",
    role: "谨慎的盗贼",
    trait: "偏好侦察与陷阱处理",
    modifiers: { stealth: 2, investigation: 1, deception: 1 }
  },
  {
    id: "cleric-rash",
    name: "艾琳",
    role: "鲁莽的牧师",
    trait: "治疗强，但冲动冒险",
    modifiers: { medicine: 2, persuasion: -1, athletics: 1 }
  },
  {
    id: "ranger-calm",
    name: "索恩",
    role: "冷静的游侠",
    trait: "擅长远程和追踪",
    modifiers: { survival: 2, perception: 2, athletics: 1 }
  }
];

export const OFFICIAL_MODULES = [
  {
    id: "ember-catacomb",
    title: "余烬地窟",
    summary: "在火山余脉下探索一座被遗忘的熔岩墓穴。",
    tone: "heroic fantasy",
    difficulty: 13,
    scenes: [
      {
        id: "entrance",
        title: "地窟入口",
        description: "裂开的黑曜石门后涌出热浪，墙面铭文闪烁暗红光。",
        choices: [
          {
            id: "survey",
            label: "观察铭文",
            kind: "skill",
            skill: "arcana",
            dc: 12,
            successText: "你辨认出这是封印警告，指出了一条安全通道。",
            failureText: "你误解铭文，触发了熔火喷气。"
          },
          {
            id: "push",
            label: "强行推门",
            kind: "skill",
            skill: "athletics",
            dc: 14,
            successText: "石门轰然开启，露出通往祭坛的阶梯。",
            failureText: "门纹丝不动，巨响惊醒了地窟中的东西。"
          }
        ]
      },
      {
        id: "altar",
        title: "灰烬祭坛",
        description: "祭坛中央漂浮着一枚灼热晶核，周围散落盔甲残骸。",
        choices: [
          {
            id: "convince",
            label: "安抚守墓灵",
            kind: "skill",
            skill: "persuasion",
            dc: 13,
            successText: "守墓灵承认你并非盗墓者，允许你带走晶核。",
            failureText: "灵体怒吼，灰烬旋风席卷整个大厅。"
          },
          {
            id: "snatch",
            label: "直接夺取晶核",
            kind: "skill",
            skill: "sleight",
            dc: 15,
            successText: "你抓住时机迅速取走晶核，祭坛陷阱未能锁定你。",
            failureText: "晶核发出刺目强光，队伍被迫后撤。"
          }
        ]
      }
    ]
  },
  {
    id: "moonwatch-hollow",
    title: "月望空谷",
    summary: "护送失踪学者穿过被幻术笼罩的峡谷。",
    tone: "mystic exploration",
    difficulty: 12,
    scenes: [
      {
        id: "mist",
        title: "迷雾岔路",
        description: "银白迷雾吞没山道，远处传来疑似求救的回音。",
        choices: [
          {
            id: "track",
            label: "追踪脚印",
            kind: "skill",
            skill: "survival",
            dc: 12,
            successText: "你识破幻音，找到了真正的营地遗迹。",
            failureText: "你被雾中倒影误导，绕回了原地。"
          },
          {
            id: "pray",
            label: "以灵性感知异常",
            kind: "skill",
            skill: "insight",
            dc: 11,
            successText: "你的直觉锁定了施术者残留的魔力方向。",
            failureText: "幻术干扰了你的心智，队伍士气下降。"
          }
        ]
      }
    ]
  }
];

export const SKILL_MAP = {
  athletics: "strength",
  survival: "spirit",
  intimidation: "charm",
  arcana: "intellect",
  history: "intellect",
  investigation: "intellect",
  medicine: "spirit",
  insight: "spirit",
  religion: "spirit",
  stealth: "agility",
  sleight: "agility",
  deception: "charm",
  persuasion: "charm",
  perception: "spirit"
};
