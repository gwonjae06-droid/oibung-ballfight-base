/* 공용 상태·유틸. 원본 HTML의 전역 변수와 보조 함수를 그대로 옮겼습니다. */
const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');

function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y + width, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fill();
}

let gameMode = '1v1'; // '1v1' | '1v1v1'
let isPlaying = false;
let isGameOver = false;
let particles = [];
let floatingTexts = [];
let screenShake = 0;
let shockwaves = [];
let players = [];

// 재화·베팅·다중 대상 아이템 상태 (새로고침 시 초기화)
let coins=1000, roundStarted=false, roundSettled=false, selectedBetPlayerNum=null, activeBet=null;
const itemInventory={skillRush:0,vitality:0,speed:0};
const reservedItems={skillRush:[],vitality:[],speed:[]};
const SHOP_ITEMS={skillRush:{name:'능력 오버클럭',price:650,label:'⏱ 1초 능력'},vitality:{name:'강화 생명 코어',price:350,label:'❤️ HP +75'},speed:{name:'돌진 부츠',price:300,label:'🥾 속도 +35%'}};

/* 캐릭터 등록소
   CHARACTER_DEFS : 기본 출전 캐릭터 정의 (js/characters/*.js 가 등록)
   CUSTOM_DEFS    : 나중에 "내 캐릭터 만들기" 기능이 채울 자리 (지금은 비어 있음)
   BEHAVIORS      : 캐릭터 id별 동작 모듈 {update, onContact, drawBack, drawUnder, drawOver, borderColor, label, order} */
const CHARACTER_DEFS = [];
const CUSTOM_DEFS = [];
const BEHAVIORS = {};

function getClosestAliveEnemy(self) {
  const enemies = players.filter(p => p !== self && p.hp > 0);
  if (enemies.length === 0) return null;
  let closest = enemies[0];
  let minDist = Math.hypot(closest.x - self.x, closest.y - self.y);
  for (let i = 1; i < enemies.length; i++) {
    const dist = Math.hypot(enemies[i].x - self.x, enemies[i].y - self.y);
    if (dist < minDist) {
      minDist = dist;
      closest = enemies[i];
    }
  }
  return closest;
}

function addFloatingText(text, x, y, color = '#ea580c', size = 16) {
  floatingTexts.push({
    text, x, y,
    vy: -0.7,
    alpha: 1.0,
    color,
    size
  });
}

function createHitParticles(x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3.5 + 1.0;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 3 + 2,
      alpha: 1,
      color
    });
  }
}
