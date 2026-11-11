const QUESTS = [
  {
    id: `q_slime`,
    name: `마을 밖의 첫걸음`,
    giver: `guard`,
    minLevel: 1,
    summary: `동문 밖 풀밭의 이끼 슬라임 5마리를 처치한다.`,
    hint: `마을 동쪽 성문을 나서면 바로 풀밭이다. 슬라임은 먼저 덤비지 않는다.`,
    kill: {
      monster: `slime`,
      count: 5,
    },
    rewardItems: [
      {
        item: `potion_red`,
        count: 3,
      },
    ],
    rewardCoins: 30,
    rewardXp: 20,
  },
  {
    id: `q_wolf`,
    name: `숲길의 늑대`,
    giver: `guard`,
    minLevel: 2,
    after: `q_slime`,
    summary: `숲 중턱의 회색 늑대 6마리를 처치한다.`,
    hint: `늑대는 다가오면 먼저 문다. 두 마리가 붙으면 물약을 아끼지 말 것.`,
    kill: {
      monster: `wolf`,
      count: 6,
    },
    rewardItems: [
      {
        item: `leather_armor`,
        count: 1,
      },
    ],
    rewardXp: 60,
  },
  {
    id: `q_bandit`,
    name: `도적의 소굴`,
    giver: `guard`,
    minLevel: 4,
    after: `q_wolf`,
    summary: `숲 북동쪽 야영지의 숲길 도적 4명을 처치한다.`,
    hint: `야영지 도적들은 가까이 가면 함께 달려든다. 한 명씩 끌어내라.`,
    kill: {
      monster: `bandit`,
      count: 4,
    },
    rewardItems: [
      {
        item: `ring_str`,
        count: 1,
      },
    ],
    rewardCoins: 80,
    rewardXp: 100,
  },
  {
    id: `q_strike`,
    name: `검술 교관의 시험`,
    giver: `trainer`,
    minLevel: 4,
    after: `q_wolf`,
    skillQuest: true,
    summary: `늑대 가죽 6장과 도적의 휘장 4개, 수업료 100닢을 교관 하르덴에게 가져간다.`,
    hint: `늑대 가죽은 숲 중턱 늑대, 휘장은 북동쪽 야영지 도적에게서 얻는다. 드물게 도적과 해골이 기술서를 직접 떨어뜨리기도 한다.`,
    bring: [
      {
        item: `wolf_pelt`,
        count: 6,
      },
      {
        item: `bandit_badge`,
        count: 4,
      },
    ],
    coins: 100,
    rewardItems: [
      {
        item: `book_strike`,
        count: 1,
      },
    ],
    rewardXp: 40,
  },
  {
    id: `q_orc`,
    name: `오크의 침입`,
    giver: `guard`,
    minLevel: 6,
    after: `q_bandit`,
    summary: `숲 북쪽 붉은엄니 오크 영지의 오크 8마리를 처치한다.`,
    hint: `숲 북쪽 끝의 길을 따라가면 오크 영지다. 오크는 무리 지어 다니니 바람걸음 물약으로 거리를 벌려라.`,
    kill: {
      monster: `orc`,
      count: 8,
    },
    rewardItems: [
      {
        item: `potion_brave`,
        count: 2,
      },
      {
        item: `scroll_teleport`,
        count: 3,
      },
    ],
    rewardCoins: 150,
    rewardXp: 250,
  },
  {
    id: `q_chief`,
    name: `붉은엄니 가르막`,
    giver: `trainer`,
    minLevel: 8,
    after: `q_orc`,
    summary: `오크 영지 언덕 위의 족장 가르막을 쓰러뜨린다.`,
    hint: `족장은 언덕 위 계단 너머에 있다. 맑은 물약을 넉넉히, 투지의 물약을 마시고 올라가라.`,
    kill: {
      monster: `orc_chief`,
      count: 1,
    },
    rewardItems: [
      {
        item: `scroll_ench_w`,
        count: 2,
      },
    ],
    rewardCoins: 300,
    rewardXp: 500,
  },
  {
    id: `q_night`,
    name: `밤의 묘지`,
    giver: `priest`,
    minLevel: 5,
    after: `q_slime`,
    summary: `밤에만 일어나는 묘지의 망자 6구를 잠재운다.`,
    hint: `해가 지면 숲 남동쪽 묘지에 망자가 일어난다. 날이 밝으면 흙으로 돌아가니 밤에 가라.`,
    kill: {
      monster: `zombie`,
      count: 6,
    },
    rewardItems: [
      {
        item: `holy_water`,
        count: 3,
      },
      {
        item: `scroll_ench_a`,
        count: 1,
      },
    ],
    rewardXp: 200,
  },
  {
    id: `q_silk`,
    name: `심부의 거미줄`,
    giver: `alchemist`,
    minLevel: 8,
    after: `q_bandit`,
    summary: `은광 심부의 동굴 거미에게서 거미줄 8개를 모아 연금술사 미라에게 가져간다.`,
    hint: `폐광 가장 안쪽, 녹슨 기사의 방 동쪽 끝에 심부로 내려가는 길이 있다. 거미는 빠르고 독이 있으니 해독제를 챙겨라.`,
    bring: [
      {
        item: `spider_silk`,
        count: 8,
      },
    ],
    rewardItems: [
      {
        item: `potion_clear`,
        count: 5,
      },
      {
        item: `potion_haste`,
        count: 3,
      },
    ],
    rewardCoins: 200,
    rewardXp: 350,
  },
  {
    id: `q_lich`,
    name: `심부의 군주`,
    giver: `priest`,
    minLevel: 11,
    after: `q_night`,
    summary: `은광 심부의 단상에 앉은 군주 모르가스를 쓰러뜨린다.`,
    hint: `모르가스는 멀리서 어둠의 탄환을 쏜다. 기둥과 벽으로 시야를 끊으며 다가가라. 계단 위 단상에 있다.`,
    kill: {
      monster: `lich`,
      count: 1,
    },
    rewardItems: [
      {
        item: `scroll_ench_w`,
        count: 2,
      },
      {
        item: `scroll_ench_a`,
        count: 2,
      },
    ],
    rewardCoins: 600,
    rewardXp: 900,
  },
  {
    id: `q_bones`,
    name: `뼈의 정화`,
    giver: `priest`,
    minLevel: 5,
    after: `q_slime`,
    summary: `묘지와 폐광의 해골 전사에게서 뼛가루 6개를 모아 사제 엘린에게 가져간다.`,
    hint: `숲 남동쪽 묘지와 폐광 입구 쪽에 해골 전사가 있다.`,
    bring: [
      {
        item: `bone_dust`,
        count: 6,
      },
    ],
    rewardItems: [
      {
        item: `holy_water`,
        count: 3,
      },
    ],
    rewardCoins: 120,
    rewardXp: 120,
  },
];

export { QUESTS };
