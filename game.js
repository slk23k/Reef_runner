const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

// --- АДАПТИВНОЕ МАСШТАБИРОВАНИЕ ПОД ЛЮБОЙ ЭКРАН ---
function fitGameToViewport() {
  const container = document.getElementById('game-container');
  if (!container) return;
  const scaleX = window.innerWidth / 360;
  const scaleY = window.innerHeight / 640;
  const scale = Math.min(scaleX, scaleY);
  container.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitGameToViewport);
fitGameToViewport();

// --- YOUTUBE PLAYABLES SDK ОБЕРТКА ---
const isYTEnv = () => typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV;
let ytSystemAudioAllowed = true;
let ytSystemPaused = false;
let lastInterstitialTime = 0;

function ytSafeLogError(err) {
  if (isYTEnv() && ytgame.health && ytgame.health.logError) {
    try { ytgame.health.logError(); } catch (e) {}
  }
}

async function ytSendScore(scoreValue) {
  if (!isYTEnv() || !ytgame.engagement || !ytgame.engagement.sendScore) return;
  const intScore = Math.floor(scoreValue);
  if (intScore <= 0) return;
  try {
    await ytgame.engagement.sendScore({ value: intScore });
  } catch (e) {
    ytSafeLogError(e);
  }
}

async function ytSaveCloudData(dataObj) {
  const serialized = JSON.stringify(dataObj);
  try { localStorage.setItem('fishRunnerFixed', serialized); } catch (e) {}
  if (isYTEnv() && ytgame.game && ytgame.game.saveData) {
    try {
      await ytgame.game.saveData(serialized);
    } catch (e) {
      ytSafeLogError(e);
    }
  }
}

async function ytLoadCloudData() {
  let loadedStr = null;
  if (isYTEnv() && ytgame.game && ytgame.game.loadData) {
    try {
      loadedStr = await ytgame.game.loadData();
    } catch (e) {
      ytSafeLogError(e);
    }
  }
  if (!loadedStr) {
    try { loadedStr = localStorage.getItem('fishRunnerFixed'); } catch (e) {}
  }
  if (loadedStr) {
    try {
      const parsed = JSON.parse(loadedStr);
      saveData = Object.assign(saveData, parsed);
    } catch (e) {}
  }
}

// Показ Rewarded-рекламы YouTube Playables
async function showYTRewardedAd(rewardId) {
  if (!isYTEnv() || !ytgame.ads || !ytgame.ads.requestRewardedAd) {
    // Фоллбэк для локального тестирования в браузере вне песочницы YouTube
    return true;
  }
  suspendAudioForAd();
  try {
    const earned = await ytgame.ads.requestRewardedAd(rewardId);
    return Boolean(earned);
  } catch (e) {
    ytSafeLogError(e);
    return false;
  } finally {
    resumeAudioAfterAd();
  }
}

// Показ Interstitial-рекламы между заплывами (с кулдауном 2 минуты)
async function showYTInterstitialAd() {
  const now = Date.now();
  if (now - lastInterstitialTime < 120000) return;
  if (!isYTEnv() || !ytgame.ads || !ytgame.ads.requestInterstitialAd) return;

  suspendAudioForAd();
  try {
    await ytgame.ads.requestInterstitialAd();
    lastInterstitialTime = Date.now();
  } catch (e) {
    ytSafeLogError(e);
  } finally {
    resumeAudioAfterAd();
  }
}

// --- КЭШ ФОНА И ГРАДИЕНТОВ ---
const bgCacheCanvas = document.createElement('canvas');
bgCacheCanvas.width = canvas.width;
bgCacheCanvas.height = canvas.height;
const bgCacheCtx = bgCacheCanvas.getContext('2d', { alpha: false });

function buildStaticBackgroundCache() {
  const waterGrad = bgCacheCtx.createLinearGradient(0, 0, 0, bgCacheCanvas.height);
  waterGrad.addColorStop(0, '#0e6ba8');
  waterGrad.addColorStop(0.5, '#074f8a');
  waterGrad.addColorStop(1, '#042448');
  bgCacheCtx.fillStyle = waterGrad;
  bgCacheCtx.fillRect(0, 0, bgCacheCanvas.width, bgCacheCanvas.height);

  bgCacheCtx.strokeStyle = 'rgba(144, 224, 239, 0.18)';
  bgCacheCtx.lineWidth = 2;
  bgCacheCtx.setLineDash([12, 16]);
  [130, 230].forEach(x => {
    bgCacheCtx.beginPath();
    bgCacheCtx.moveTo(x, 0);
    bgCacheCtx.lineTo(x, bgCacheCanvas.height);
    bgCacheCtx.stroke();
  });
  bgCacheCtx.setLineDash([]);
}
buildStaticBackgroundCache();

const CACHED_GRADS = {
  rays: (() => {
    const g = ctx.createLinearGradient(0, 0, 0, 460);
    g.addColorStop(0, 'rgba(173, 232, 244, 0.09)');
    g.addColorStop(1, 'rgba(173, 232, 244, 0)');
    return g;
  })(),
  chestGlow: (() => {
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
    g.addColorStop(0, 'rgba(255, 215, 0, 0.42)');
    g.addColorStop(1, 'rgba(255, 215, 0, 0)');
    return g;
  })(),
  jelly: (() => {
    const g = ctx.createRadialGradient(0, -6, 2, 0, -4, 18);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#ff9ff3');
    g.addColorStop(1, '#f368e0');
    return g;
  })(),
  crab: (() => {
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 16);
    g.addColorStop(0, '#ff9f43');
    g.addColorStop(1, '#ee5253');
    return g;
  })(),
  bottle: (() => {
    const g = ctx.createLinearGradient(-12, -16, 12, 18);
    g.addColorStop(0, 'rgba(184, 233, 240, 0.88)');
    g.addColorStop(0.5, 'rgba(130, 192, 204, 0.82)');
    g.addColorStop(1, 'rgba(115, 168, 150, 0.88)');
    return g;
  })(),
  sharkBody: (() => {
    const g = ctx.createRadialGradient(-6, -20, 5, 0, 5, 65);
    g.addColorStop(0, '#2ec4b6');
    g.addColorStop(0.45, '#0077b6');
    g.addColorStop(1, '#053c5e');
    return g;
  })(),
  sharkDorsal: (() => {
    const g = ctx.createLinearGradient(-8, -15, 8, 25);
    g.addColorStop(0, '#053c5e');
    g.addColorStop(1, '#09527a');
    return g;
  })(),
  subBody: (() => {
    const g = ctx.createRadialGradient(-8, -6, 4, 0, 0, 44);
    g.addColorStop(0, '#fff799');
    g.addColorStop(0.55, '#ffd32a');
    g.addColorStop(1, '#f39c12');
    return g;
  })(),
  fishOrange: (() => {
    const g = ctx.createLinearGradient(-12, -20, 12, 20);
    g.addColorStop(0, '#ffbe76');
    g.addColorStop(1, '#ff7979');
    return g;
  })(),
  fishBlue: (() => {
    const g = ctx.createLinearGradient(-12, -20, 12, 20);
    g.addColorStop(0, '#7ed6df');
    g.addColorStop(1, '#00a8ff');
    return g;
  })(),
  fishGold: (() => {
    const g = ctx.createLinearGradient(-12, -20, 12, 20);
    g.addColorStop(0, '#fff200');
    g.addColorStop(1, '#ff9f1a');
    return g;
  })()
};

// --- ЛОКАЛИЗАЦИЯ ---
const I18N = {
  ru: {
    coinsBank: "Монеты:",
    bestScoreLabel: "Рекорд:",
    playBtn: "▶ ИГРАТЬ",
    shopBtn: "🛒 МАГАЗИН",
    shopTitle: "Магазин Рифа",
    balance: "Баланс:",
    itemFreeCoinsTitle: "🎬 Сундук за рекламу (+100)",
    itemFreeCoinsDesc: "Посмотри ролик и получи 100 монет",
    itemHpTitle: "❤️ Макс. Здоровье (+1 HP)",
    itemHpDesc: "Увеличивает запас до 4 сердец",
    itemBlueTitle: "💎 Скин: Лазурный Неон",
    itemBlueDesc: "Яркий тропический окрас",
    itemGoldTitle: "👑 Скин: Золотой Император",
    itemGoldDesc: "Сияющий легендарный окрас",
    itemUnfreezeTitle: "⚡ Анти-Шок",
    itemUnfreezeDesc: "Мгновенно снимает разряд и качку",
    itemCleanTitle: "🧼 Чистая Вода",
    itemCleanDesc: "Смывает кляксы чернил спрута",
    itemBoostTitle: "🚀 Быстрый Старт (+150)",
    itemBoostDesc: "Начни заплыв сразу со 150 очками",
    backMenuBtn: "🏠 НАЗАД В МЕНЮ",
    continueTitle: "Продолжить заплыв?",
    continueDesc: "Восстанови 1 ❤️ и получи щит неуязвимости!",
    availableCoins: "Доступно монет:",
    continueAdBtn: "🎬 ЗА РЕКЛАМУ (БЕСПЛАТНО)",
    continueYesBtn: "▶ ЗА МОНЕТЫ (150)",
    continueNoBtn: "✖ ЗАВЕРШИТЬ",
    gameOverTitle: "Заплыв окончен!",
    playAgainBtn: "🔄 ЕЩЕ РАЗ",
    toMenuBtn: "🏠 В МЕНЮ",
    pausedTitle: "Пауза",
    hudScore: "Счет",
    hudBest: "Рекорд",
    hudCoins: "Монеты",
    hudShock: "⚡ ШОК",
    hudSway: "💫 КАЧКА",
    sec: "с",
    inkSplat: "ЧЕРНИЛЬНАЯ КЛЯКСА!",
    newRecordBanner: "НОВЫЙ РЕКОРД!",
    cleanInkTip: "Очистить чернила",
    unfreezeTip: "Снять шок / качку",
    buyHpTip: "Купить +1 жизнь за 300 монет (клавиша H)",
    msgHpUp: "❤️ Здоровье увеличено до 4!",
    msgMidRunHpBought: "❤️ +1 Жизнь куплена за 300 монет!",
    msgHpFull: "❤️ У вас уже полное здоровье!",
    msgSkinSelected: "✨ Скин выбран!",
    msgBought: "✅ Успешно куплено!",
    msgAdCoins: "🎉 Получено +100 монет!",
    msgAdFailed: "⚠️ Реклама сейчас недоступна",
    msgNoCoins: "⚠️ Недостаточно монет!",
    msgMaxOrNoCoins: "⚠️ Недостаточно монет или уже максимум!"
  },
  en: {
    coinsBank: "Coins:",
    bestScoreLabel: "Best:",
    playBtn: "▶ PLAY",
    shopBtn: "🛒 SHOP",
    shopTitle: "Reef Shop",
    balance: "Balance:",
    itemFreeCoinsTitle: "🎬 Free Chest (+100 Coins)",
    itemFreeCoinsDesc: "Watch a short ad for 100 coins",
    itemHpTitle: "❤️ Max Health (+1 HP)",
    itemHpDesc: "Upgrades max capacity to 4 hearts",
    itemBlueTitle: "💎 Skin: Azure Neon",
    itemBlueDesc: "Vibrant tropical reef colors",
    itemGoldTitle: "👑 Skin: Golden Emperor",
    itemGoldDesc: "Shining legendary scales",
    itemUnfreezeTitle: "⚡ Anti-Shock",
    itemUnfreezeDesc: "Instantly clears stun & wobble",
    itemCleanTitle: "🧼 Clear Water",
    itemCleanDesc: "Washes away octopus ink splats",
    itemBoostTitle: "🚀 Head Start (+150)",
    itemBoostDesc: "Start your run with 150 points",
    backMenuBtn: "🏠 BACK TO MENU",
    continueTitle: "Continue Run?",
    continueDesc: "Restore 1 ❤️ and get an invincibility shield!",
    availableCoins: "Available coins:",
    continueAdBtn: "🎬 WATCH AD (FREE)",
    continueYesBtn: "▶ PAY COINS (150)",
    continueNoBtn: "✖ GIVE UP",
    gameOverTitle: "Run Over!",
    playAgainBtn: "🔄 PLAY AGAIN",
    toMenuBtn: "🏠 MAIN MENU",
    pausedTitle: "Paused",
    hudScore: "Score",
    hudBest: "Best",
    hudCoins: "Coins",
    hudShock: "⚡ STUN",
    hudSway: "💫 WOBBLE",
    sec: "s",
    inkSplat: "INK SPLATTER!",
    newRecordBanner: "NEW RECORD!",
    cleanInkTip: "Clear Ink",
    unfreezeTip: "Clear Stun / Wobble",
    buyHpTip: "Buy +1 Heart for 300 coins (Key H)",
    msgHpUp: "❤️ Max HP upgraded to 4!",
    msgMidRunHpBought: "❤️ +1 Heart bought for 300 coins!",
    msgHpFull: "❤️ Health is already full!",
    msgSkinSelected: "✨ Skin equipped!",
    msgBought: "✅ Purchased!",
    msgAdCoins: "🎉 You earned +100 coins!",
    msgAdFailed: "⚠️ Ad is not available right now",
    msgNoCoins: "⚠️ Not enough coins!",
    msgMaxOrNoCoins: "⚠️ Not enough coins or already maxed!"
  },
  es: {
    coinsBank: "Monedas:",
    bestScoreLabel: "Récord:",
    playBtn: "▶ JUGAR",
    shopBtn: "🛒 TIENDA",
    shopTitle: "Tienda del Arrecife",
    balance: "Saldo:",
    itemFreeCoinsTitle: "🎬 Cofre Gratis (+100)",
    itemFreeCoinsDesc: "Mira un anuncio y gana 100 monedas",
    itemHpTitle: "❤️ Salud Máx. (+1 HP)",
    itemHpDesc: "Aumenta la vida a 4 corazones",
    itemBlueTitle: "💎 Skin: Neón Azul",
    itemBlueDesc: "Color tropical brillante",
    itemGoldTitle: "👑 Skin: Emperador Dorado",
    itemGoldDesc: "Escamas legendarias radiantes",
    itemUnfreezeTitle: "⚡ Anti-Choque",
    itemUnfreezeDesc: "Elimina parálisis y mareo al instante",
    itemCleanTitle: "🧼 Agua Limpia",
    itemCleanDesc: "Limpia las manchas de tinta",
    itemBoostTitle: "🚀 Impulso Inicial (+150)",
    itemBoostDesc: "Empieza con 150 puntos extra",
    backMenuBtn: "🏠 VOLVER AL MENÚ",
    continueTitle: "¿Continuar Nado?",
    continueDesc: "¡Recupera 1 ❤️ y obtén un escudo protector!",
    availableCoins: "Monedas disponibles:",
    continueAdBtn: "🎬 VER ANUNCIO (GRATIS)",
    continueYesBtn: "▶ USAR MONEDAS (150)",
    continueNoBtn: "✖ RENDIRSE",
    gameOverTitle: "¡Fin del Nado!",
    playAgainBtn: "🔄 OTRA VEZ",
    toMenuBtn: "🏠 AL MENÚ",
    pausedTitle: "Pausa",
    hudScore: "Puntos",
    hudBest: "Récord",
    hudCoins: "Monedas",
    hudShock: "⚡ CHOQUE",
    hudSway: "💫 MAREO",
    sec: "s",
    inkSplat: "¡MANCHA DE TINTA!",
    newRecordBanner: "¡NUEVO RÉCORD!",
    cleanInkTip: "Limpiar tinta",
    unfreezeTip: "Quitar choque / mareo",
    buyHpTip: "Comprar +1 vida por 300 monedas (Tecla H)",
    msgHpUp: "❤️ ¡Salud aumentada a 4!",
    msgMidRunHpBought: "❤️ ¡+1 Vida comprada por 300 monedas!",
    msgHpFull: "❤️ ¡Ya tienes la salud al máximo!",
    msgSkinSelected: "✨ ¡Skin equipado!",
    msgBought: "✅ ¡Comprado con éxito!",
    msgAdCoins: "🎉 ¡Ganaste +100 monedas!",
    msgAdFailed: "⚠️ El anuncio no está disponible",
    msgNoCoins: "⚠️ ¡No tienes suficientes monedas!",
    msgMaxOrNoCoins: "⚠️ ¡Sin monedas o nivel máximo alcanzado!"
  }
};

let currentLang = 'ru';

function normalizeLangCode(raw) {
  const code = (raw || 'en').toLowerCase();
  if (code.startsWith('ru') || code.startsWith('uk') || code.startsWith('be') || code.startsWith('kk')) return 'ru';
  if (code.startsWith('es')) return 'es';
  return 'en';
}

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
}

window.setLanguage = function(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  try { localStorage.setItem('reefRunnerLang', lang); } catch (e) {}

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.innerText = t(key);
  });

  document.getElementById('cleanInkBtn').title = t('cleanInkTip');
  document.getElementById('unfreezeBtn').title = t('unfreezeTip');
  document.getElementById('buyRunHpBtn').title = t('buyHpTip');

  ['ru', 'en', 'es'].forEach(l => {
    const btn = document.getElementById('lang-' + l);
    if (btn) btn.classList.toggle('active', l === lang);
  });

  if (!isPlaying) drawMenuBackground();
};

let toastTimeout = null;
function showToast(msg) {
  const el = document.getElementById('toastMsg');
  if (!el) return;
  el.innerText = msg;
  el.style.opacity = '1';
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { el.style.opacity = '0'; }, 1900);
}

// --- АУДИОДВИЖОК (С ПОЛНОЙ СИНХРОНИЗАЦИЕЙ С YOUTUBE PLAYABLES) ---
let audioCtx = null;
let audioUnlocked = false;
let hitNoiseBuffer = null;
let masterMusicGain = null;

let musicEnabled = true;
let musicMode = 'lobby';
let phonkStep = 0;
let currentBpm = 90;
let nextStepTime = 0;
let lobbySchedulerId = null;

function isAudioAllowed() {
  return musicEnabled && ytSystemAudioAllowed && !ytSystemPaused;
}

function updateMasterGain() {
  if (!masterMusicGain || !audioCtx) return;
  masterMusicGain.gain.setValueAtTime(isAudioAllowed() ? 0.85 : 0, audioCtx.currentTime);
}

function suspendAudioForAd() {
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {});
  }
}

function resumeAudioAfterAd() {
  if (audioCtx && audioCtx.state === 'suspended' && !ytSystemPaused) {
    audioCtx.resume().catch(() => {});
    nextStepTime = audioCtx.currentTime + 0.05;
  }
}

function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
    masterMusicGain = audioCtx.createGain();
    masterMusicGain.gain.setValueAtTime(isAudioAllowed() ? 0.85 : 0, audioCtx.currentTime);
    masterMusicGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended' && !ytSystemPaused) {
    audioCtx.resume();
  }

  if (!audioUnlocked && audioCtx) {
    try {
      const buffer = audioCtx.createBuffer(1, 1, 22050);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);
      audioUnlocked = true;
      nextStepTime = audioCtx.currentTime + 0.05;
    } catch (e) {}
  }

  if (!hitNoiseBuffer && audioCtx) {
    try {
      const bufferSize = Math.floor(audioCtx.sampleRate * 0.08);
      hitNoiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = hitNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } catch (e) {}
  }

  if (!lobbySchedulerId) {
    lobbySchedulerId = setInterval(() => {
      if (!isPlaying && !ytSystemPaused) updateMusicScheduler(1.0);
    }, 50);
  }

  return audioCtx;
}

['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
  window.addEventListener(evt, ensureAudio, { once: true, passive: true });
});

function playSoftPhonkLead(actx, freq, time, dur, vol, intensity) {
  if (!freq || !masterMusicGain || !isAudioAllowed()) return;
  try {
    const osc = actx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    const filter = actx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650 + intensity * 350, time);

    const gain = actx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterMusicGain);

    osc.start(time);
    osc.stop(time + dur);
  } catch (e) {}
}

function playSoftPhonkBass(actx, freq, time, dur, vol) {
  if (!freq || !masterMusicGain || !isAudioAllowed()) return;
  try {
    const osc = actx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    const gain = actx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.004, time + dur);

    osc.connect(gain);
    gain.connect(masterMusicGain);

    osc.start(time);
    osc.stop(time + dur);
  } catch (e) {}
}

function playSoftKick(actx, time, vol) {
  if (!masterMusicGain || !isAudioAllowed()) return;
  try {
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(108, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.13);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.connect(gain);
    gain.connect(masterMusicGain);
    osc.start(time);
    osc.stop(time + 0.16);
  } catch (e) {}
}

function playSoftPerc(actx, time, vol, isBackbeat) {
  if (!hitNoiseBuffer || !masterMusicGain || !isAudioAllowed()) return;
  try {
    const src = actx.createBufferSource();
    src.buffer = hitNoiseBuffer;

    const filter = actx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isBackbeat ? 950 : 2700, time);
    filter.Q.setValueAtTime(1.6, time);

    const gain = actx.createGain();
    const dur = isBackbeat ? 0.07 : 0.028;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterMusicGain);
    src.start(time);
    src.stop(time + dur);
  } catch (e) {}
}

const N = {
  C2: 65.41, Eb2: 77.78, F2: 87.31, G2: 98.00, Bb2: 116.54,
  C5: 523.25, D5: 587.33, Eb5: 622.25, F5: 698.46, G5: 783.99, Ab5: 830.61, Bb5: 932.33
};

const LOBBY_LEAD = [N.C5, 0, 0, N.Eb5, 0, 0, N.G5, 0, N.F5, 0, 0, N.Eb5, 0, N.D5, 0, 0];
const LOBBY_BASS = [N.C2, 0, 0, 0, 0, 0, 0, 0, N.Eb2, 0, 0, 0, N.F2, 0, 0, 0];

const GAME_LEAD  = [N.C5, 0, 0, N.Eb5, 0, N.G5, 0, N.F5, N.G5, 0, N.Bb5, 0, N.Ab5, 0, N.G5, N.Eb5];
const GAME_BASS  = [N.C2, 0, 0, N.C2, 0, 0, N.Eb2, 0, N.F2, 0, 0, N.F2, 0, 0, N.G2, 0];

function schedulePhonkNote(actx, time, stepIdx, intensity) {
  const s = stepIdx % 16;
  const stepDur = 60 / currentBpm / 4;

  if (musicMode === 'lobby') {
    if (s === 0 || s === 10) playSoftKick(actx, time, 0.16);
    if (s === 4 || s === 12) playSoftPerc(actx, time, 0.045, true);
    if (s % 4 === 2) playSoftPerc(actx, time, 0.02, false);

    playSoftPhonkBass(actx, LOBBY_BASS[s], time, stepDur * 3.5, 0.14);
    playSoftPhonkLead(actx, LOBBY_LEAD[s], time, stepDur * 2.2, 0.055, 0);
  } else {
    if (s === 0 || s === 6 || s === 8 || (intensity > 0.35 && s === 3) || (intensity > 0.65 && s === 11)) {
      playSoftKick(actx, time, 0.18 + intensity * 0.05);
    }
    if (s === 4 || s === 12) {
      playSoftPerc(actx, time, 0.055 + intensity * 0.025, true);
    }
    if (s % 2 === 0) {
      playSoftPerc(actx, time, 0.022, false);
    }

    playSoftPhonkBass(actx, GAME_BASS[s], time, stepDur * 2.2, 0.16 + intensity * 0.04);
    playSoftPhonkLead(actx, GAME_LEAD[s], time, stepDur * 1.6, 0.06 + intensity * 0.02, intensity);
  }
}

function updateMusicScheduler(speedRatio) {
  if (!isAudioAllowed() || !audioCtx || audioCtx.state !== 'running') return;

  let intensity = 0;
  if (musicMode === 'lobby') {
    currentBpm = 90;
    intensity = 0;
  } else {
    intensity = Math.max(0, Math.min(1, (speedRatio - 1) / 1.2));
    currentBpm = 92 + intensity * 18; // Максимум 110 BPM
  }

  const now = audioCtx.currentTime;
  if (nextStepTime < now) {
    nextStepTime = now + 0.02;
  }

  const stepDuration = 60 / currentBpm / 4;
  while (nextStepTime < now + 0.1) {
    schedulePhonkNote(audioCtx, nextStepTime, phonkStep, intensity);
    nextStepTime += stepDuration;
    phonkStep++;
  }
}

function setMusicMode(newMode) {
  if (musicMode === newMode) return;
  musicMode = newMode;
  phonkStep = 0;
  if (audioCtx) {
    nextStepTime = audioCtx.currentTime + 0.04;
  }
}

window.toggleMusic = function() {
  ensureAudio();
  musicEnabled = !musicEnabled;
  document.getElementById('musicIcon').innerText = isAudioAllowed() ? '🔊' : '🔇';
  updateMasterGain();
  if (isAudioAllowed() && audioCtx) {
    nextStepTime = audioCtx.currentTime + 0.04;
  }
};

function playNewRecordSound() {
  if (!ytSystemAudioAllowed || ytSystemPaused) return;
  const actx = ensureAudio();
  if (!actx) return;
  try {
    const now = actx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.18, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.28);
    });
  } catch (e) {}
}

function playHitSound() {
  if (!ytSystemAudioAllowed || ytSystemPaused) return;
  const actx = ensureAudio();
  if (!actx || !hitNoiseBuffer) return;

  try {
    const now = actx.currentTime;
    const noise = actx.createBufferSource();
    noise.buffer = hitNoiseBuffer;

    const filter = actx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = actx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(actx.destination);

    noise.start(now);
    noise.stop(now + 0.08);
  } catch(e) {}
}

function playBottleSound() {
  if (!ytSystemAudioAllowed || ytSystemPaused) return;
  const actx = ensureAudio();
  if (!actx) return;

  try {
    const now = actx.currentTime;
    if (hitNoiseBuffer) {
      const noise = actx.createBufferSource();
      noise.buffer = hitNoiseBuffer;

      const filter = actx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950, now);
      filter.Q.setValueAtTime(3.0, now);

      const gain = actx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(actx.destination);
      noise.start(now);
      noise.stop(now + 0.08);
    }

    const osc = actx.createOscillator();
    const oscGain = actx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(170, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.24);

    oscGain.gain.setValueAtTime(0.22, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    osc.connect(oscGain);
    oscGain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch(e) {}
}

function playCoinSound() {
  if (!ytSystemAudioAllowed || ytSystemPaused) return;
  const actx = ensureAudio();
  if (!actx) return;

  try {
    const now = actx.currentTime;

    const osc1 = actx.createOscillator();
    const gain1 = actx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(actx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    const osc2 = actx.createOscillator();
    const gain2 = actx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1975.53, now + 0.055);
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.setValueAtTime(0.15, now + 0.055);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc2.connect(gain2);
    gain2.connect(actx.destination);
    osc2.start(now + 0.055);
    osc2.stop(now + 0.22);
  } catch(e) {}
}

function playSharkVillagerSmirkSound() {
  if (!ytSystemAudioAllowed || ytSystemPaused) return;
  const actx = ensureAudio();
  if (!actx) return;

  try {
    const now = actx.currentTime;
    const steps = [
      { freq: 140, start: 0.00, duration: 0.18 },
      { freq: 165, start: 0.15, duration: 0.12 },
      { freq: 215, start: 0.26, duration: 0.16 }
    ];

    steps.forEach((step) => {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      const filter = actx.createBiquadFilter();

      osc.type = 'square';
      osc.frequency.setValueAtTime(step.freq, now + step.start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(480, now + step.start);

      gain.gain.setValueAtTime(0.28, now + step.start);
      gain.gain.exponentialRampToValueAtTime(0.01, now + step.start + step.duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(actx.destination);

      osc.start(now + step.start);
      osc.stop(now + step.start + step.duration);
    });
  } catch(e) {}
}

function playInkBubbleSound() {
  if (!ytSystemAudioAllowed || ytSystemPaused) return;
  const actx = ensureAudio();
  if (!actx) return;

  try {
    const now = actx.currentTime;
    [0, 0.11, 0.22].forEach((offset, idx) => {
      const osc = actx.createOscillator();
      const gain = actx.createGain();

      osc.type = 'sine';
      const startFreq = 250 + idx * 120;
      osc.frequency.setValueAtTime(startFreq, now + offset);
      osc.frequency.exponentialRampToValueAtTime(startFreq + 180, now + offset + 0.1);

      gain.gain.setValueAtTime(0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.1);

      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  } catch(e) {}
}

function playDeathSound() {
  if (!ytSystemAudioAllowed || ytSystemPaused) return;
  const actx = ensureAudio();
  if (!actx) return;

  try {
    const now = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.65);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
  } catch(e) {}
}
// ----------------------------------------

let saveData = {
  coins: 0, highScore: 0, maxHp: 3, currentSkin: 'orange',
  unfreezeItems: 0, cleanInkItems: 0, boostScoreItems: 0, skinsOwned: ['orange']
};

function saveState() {
  ytSaveCloudData(saveData);
  const tCoins = document.getElementById('totalCoinsText');
  const sCoins = document.getElementById('shopCoinsText');
  const hScore = document.getElementById('highScoreText');
  if (tCoins) tCoins.innerText = saveData.coins;
  if (sCoins) sCoins.innerText = saveData.coins;
  if (hScore) hScore.innerText = saveData.highScore || 0;
}

const LANES = [80, 180, 280];
const OBSTACLE_SCALE = 1.08;
let currentLane = 1, basePlayerX = LANES[1], playerX = LANES[1], playerY = 480;
let hp = 3, maxHp = 3, initialSpeed = 6, score = 0, currentRunCoins = 0, isPlaying = false;
let previousBestScore = 0;
let recordBeatenThisRun = false;
let invincibleTimer = 0;
let rafId = null;
let lastFrameTime = 0;
let spawnAcc = 0;

let obstacles = [], chests = [], jellyfish = [], hooks = [], crabs = [], bottles = [], spawnTimer = 0;
let particles = [], floatingTexts = [], wakeBubbles = [], fireworks = [];

let submarine = { active: false, x: -130, y: 155, timer: 0 };

let shark = { active: false, state: 'waiting', timer: 0, x: 180, y: 700, targetLane: 1 };
let octopus = { active: false, stage: 'none', timer: 0, targetTimer: 36, x: 180, y: -50 };
let inkTimer = 0; 
let shockTimer = 0; 
let swayTimer = 0;
let damageFlashTimer = 0;
let animTimer = 0; 

let bubbles = [];
for(let i=0; i<20; i++) {
  bubbles.push({ x: Math.random()*360, y: Math.random()*640, r: Math.random()*3.5+1.5, s: Math.random()*1.5+0.5 });
}

let sideReefs = [];
const reefStyles = [
  { fill: '#e15f41', stroke: '#902914' },
  { fill: '#f19066', stroke: '#a34e28' },
  { fill: '#cf6a87', stroke: '#7d2b44' },
  { fill: '#3dc1d3', stroke: '#196f7d' },
  { fill: '#38ada9', stroke: '#176663' }
];
for(let i=0; i<10; i++) {
  let st = reefStyles[i % reefStyles.length];
  sideReefs.push({
    side: i % 2 === 0 ? 'left' : 'right',
    y: i * 70,
    size: 15 + Math.random() * 12,
    color: st.fill,
    stroke: st.stroke
  });
}

document.addEventListener('keydown', (e) => {
  if (!isPlaying || ytSystemPaused || e.repeat) return;
  if (e.code === 'KeyH') {
    window.buyMidRunLife();
    return;
  }
  if (shockTimer > 0) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    if (currentLane > 0) currentLane--;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    if (currentLane < 2) currentLane++;
  }
});

let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!isPlaying || ytSystemPaused || shockTimer > 0) return;
  let diff = e.changedTouches[0].clientX - touchStartX;
  if (diff < -30 && currentLane > 0) currentLane--;
  if (diff > 30 && currentLane < 2) currentLane++;
});

window.buyMidRunLife = function() {
  if (!isPlaying || ytSystemPaused) return;
  if (hp >= maxHp) {
    showToast(t('msgHpFull'));
    return;
  }
  const cost = 300;
  const totalAvailable = saveData.coins + currentRunCoins;
  if (totalAvailable < cost) {
    showToast(t('msgNoCoins'));
    return;
  }
  if (saveData.coins >= cost) {
    saveData.coins -= cost;
  } else {
    const remainder = cost - saveData.coins;
    saveData.coins = 0;
    currentRunCoins -= remainder;
  }
  hp++;
  saveState();
  playCoinSound();
  showToast(t('msgMidRunHpBought'));
};

window.useUnfreeze = function() {
  if (saveData.unfreezeItems > 0 && (shockTimer > 0 || swayTimer > 0)) {
    saveData.unfreezeItems--;
    shockTimer = 0;
    swayTimer = 0;
    saveState();
    updateHUD();
  }
};

window.useCleanInk = function() {
  if (saveData.cleanInkItems > 0 && inkTimer > 0) {
    saveData.cleanInkItems--; inkTimer = 0; saveState(); updateHUD();
  }
};

function updateHUD() {
  const uBtn = document.getElementById('unfreezeBtn');
  const cBtn = document.getElementById('cleanInkBtn');
  if (uBtn) uBtn.style.display = saveData.unfreezeItems > 0 ? 'flex' : 'none';
  if (cBtn) cBtn.style.display = saveData.cleanInkItems > 0 ? 'flex' : 'none';
}

function drawSpinningCoin(cx, cy, radius, phaseOffset = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  let spin = Math.cos(animTimer * 0.12 + phaseOffset);
  let widthScale = Math.max(0.22, Math.abs(spin));

  ctx.fillStyle = '#b76e00';
  ctx.beginPath();
  ctx.ellipse(spin > 0 ? 1.2 : -1.2, 0, radius * widthScale, radius, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffd32a';
  ctx.strokeStyle = '#99582a';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * widthScale, radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (widthScale > 0.45) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.roundRect(-1.5 * widthScale, -radius * 0.45, 3 * widthScale, radius * 0.9, 1);
    ctx.fill();
  }
  ctx.restore();
}

function spawnCoinParticles(x, y, amount) {
  for (let i = 0; i < 8; i++) {
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 3.5 + 1.5;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 26, maxLife: 26,
      color: i % 2 === 0 ? '#ffd166' : '#ffffff',
      stroke: i % 2 === 0 ? '#99582a' : '#0077b6',
      size: Math.random() * 3.2 + 2
    });
  }
  floatingTexts.push({
    x: x, y: y - 10,
    amount: amount,
    life: 40, maxLife: 40
  });
}

function spawnFireworkBurst(cx, cy) {
  const fwColors = ['#ffd32a', '#ff5e57', '#0be881', '#48dbfb', '#ff9ff3', '#ffffff'];
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * 2 * i) / 16 + (Math.random() * 0.2);
    const speed = Math.random() * 3.8 + 1.8;
    const col = fwColors[i % fwColors.length];
    fireworks.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      color: col,
      size: Math.random() * 3 + 2,
      life: 38, maxLife: 38
    });
  }
}

function triggerNewRecordSubmarine() {
  recordBeatenThisRun = true;
  submarine.active = true;
  submarine.x = -130;
  submarine.y = 155;
  submarine.timer = 210;
  playNewRecordSound();
  spawnFireworkBurst(110, 120);
  spawnFireworkBurst(250, 135);
}

function checkHighScoreProgress() {
  if (score > saveData.highScore) {
    saveData.highScore = Math.floor(score);
  }
  if (!recordBeatenThisRun && previousBestScore > 0 && score > previousBestScore) {
    triggerNewRecordSubmarine();
  }
}

window.restartGameWithAd = async function() {
  await showYTInterstitialAd();
  window.startGame();
};

window.startGame = function() {
  ensureAudio();
  setMusicMode('game');

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  maxHp = saveData.maxHp; hp = maxHp;
  previousBestScore = saveData.highScore || 0;
  recordBeatenThisRun = false;
  invincibleTimer = 0;
  submarine = { active: false, x: -130, y: 155, timer: 0 };

  currentLane = 1; basePlayerX = LANES[1]; playerX = LANES[1];
  obstacles = []; chests = []; jellyfish = []; hooks = []; crabs = []; bottles = [];
  particles = []; floatingTexts = []; wakeBubbles = []; fireworks = [];
  score = 0; currentRunCoins = 0; initialSpeed = 6;
  spawnTimer = 0; spawnAcc = 0;
  shark = { active: false, state: 'waiting', timer: 0, x: LANES[1], y: 700 };
  octopus = { active: false, stage: 'none', timer: 0, targetTimer: 36, x: 180, y: -50 };
  inkTimer = 0; shockTimer = 0; swayTimer = 0; damageFlashTimer = 0; animTimer = 0;

  if (saveData.boostScoreItems > 0) {
    saveData.boostScoreItems--; score += 150; saveState();
    checkHighScoreProgress();
  }

  isPlaying = true;
  lastFrameTime = performance.now();

  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('continueScreen').style.display = 'none';
  document.getElementById('shopScreen').style.display = 'none';
  document.getElementById('hudBoosts').style.display = 'flex';
  updateHUD();
  rafId = requestAnimationFrame(gameLoop);
};

function promptContinueOrGameOver() {
  isPlaying = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  playDeathSound();
  setMusicMode('lobby');
  document.getElementById('hudBoosts').style.display = 'none';
  document.getElementById('continueCoinsText').innerText = saveData.coins + currentRunCoins;
  document.getElementById('continueScreen').style.display = 'flex';
}

function revivePlayer() {
  setMusicMode('game');
  hp = 1;
  invincibleTimer = 180;
  shockTimer = 0;
  swayTimer = 0;
  inkTimer = 0;
  shark.active = false;
  obstacles = obstacles.filter(o => o.y < 260);
  crabs = crabs.filter(c => c.y < 260);
  jellyfish = jellyfish.filter(j => j.y < 260);
  hooks = hooks.filter(h => h.y < 260);
  bottles = bottles.filter(b => b.y < 260);

  document.getElementById('continueScreen').style.display = 'none';
  document.getElementById('hudBoosts').style.display = 'flex';
  isPlaying = true;
  lastFrameTime = performance.now();
  rafId = requestAnimationFrame(gameLoop);
}

window.continueWithAd = async function() {
  const earned = await showYTRewardedAd('continue-run-revive');
  if (earned) {
    playCoinSound();
    revivePlayer();
  } else {
    showToast(t('msgAdFailed'));
  }
};

window.confirmContinue = function() {
  const cost = 150;
  const totalAvailable = saveData.coins + currentRunCoins;
  if (totalAvailable < cost) {
    showToast(t('msgNoCoins'));
    return;
  }
  if (saveData.coins >= cost) {
    saveData.coins -= cost;
  } else {
    const rem = cost - saveData.coins;
    saveData.coins = 0;
    currentRunCoins -= rem;
  }
  saveState();
  playCoinSound();
  revivePlayer();
};

window.declineContinue = function() {
  document.getElementById('continueScreen').style.display = 'none';
  finalizeGameOver();
};

function finalizeGameOver() {
  isPlaying = false;
  setMusicMode('lobby');
  const finalIntScore = Math.floor(score);
  if (finalIntScore > saveData.highScore) {
    saveData.highScore = finalIntScore;
  }
  saveData.coins += currentRunCoins;
  saveState();
  ytSendScore(finalIntScore);

  document.getElementById('hudBoosts').style.display = 'none';
  document.getElementById('finalScore').innerHTML = `${t('hudScore')}: ${finalIntScore} &nbsp;|&nbsp; ${t('hudCoins')}: +${currentRunCoins} <span class="spinning-coin"></span>`;
  document.getElementById('finalHighScore').innerHTML = `🏆 ${t('hudBest')}: <b style="color:#48dbfb; margin-left:4px;">${saveData.highScore}</b>`;
  document.getElementById('gameOverScreen').style.display = 'flex';
}

window.backToMenu = function() {
  setMusicMode('lobby');
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  saveState();
  drawMenuBackground();
};

window.openShop = function() {
  ensureAudio();
  setMusicMode('lobby');
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('shopScreen').style.display = 'flex';
  saveState();
};

window.closeShop = function() {
  document.getElementById('shopScreen').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
};

window.watchAdForCoins = async function() {
  const earned = await showYTRewardedAd('shop-100-coins');
  if (earned) {
    saveData.coins += 100;
    saveState();
    playCoinSound();
    showToast(t('msgAdCoins'));
  } else {
    showToast(t('msgAdFailed'));
  }
};

window.buyUpgrade = function(type, cost) {
  if (saveData.coins >= cost && type === 'maxHp' && saveData.maxHp < 4) {
    saveData.coins -= cost; saveData.maxHp = 4; saveState(); playCoinSound(); showToast(t('msgHpUp'));
  } else showToast(t('msgMaxOrNoCoins'));
};

window.buySkin = function(skin, cost) {
  if (saveData.skinsOwned.includes(skin)) {
    saveData.currentSkin = skin; saveState(); showToast(t('msgSkinSelected'));
  } else if (saveData.coins >= cost) {
    saveData.coins -= cost; saveData.skinsOwned.push(skin); saveData.currentSkin = skin; saveState(); playCoinSound(); showToast(t('msgBought'));
  } else showToast(t('msgNoCoins'));
};

window.buyItem = function(item, cost) {
  if (saveData.coins >= cost) {
    saveData.coins -= cost;
    if (item === 'unfreeze') saveData.unfreezeItems++;
    if (item === 'cleanInk') saveData.cleanInkItems++;
    if (item === 'boostScore') saveData.boostScoreItems++;
    saveState(); playCoinSound(); showToast(t('msgBought'));
  } else showToast(t('msgNoCoins'));
};

function isLaneOccupied(laneX) {
  for (let i = 0; i < obstacles.length; i++) if (obstacles[i].x === laneX && obstacles[i].y < 112) return true;
  for (let i = 0; i < chests.length; i++) if (chests[i].x === laneX && chests[i].y < 112) return true;
  for (let i = 0; i < jellyfish.length; i++) if (jellyfish[i].x === laneX && jellyfish[i].y < 112) return true;
  for (let i = 0; i < crabs.length; i++) if (crabs[i].x === laneX && crabs[i].y < 112) return true;
  for (let i = 0; i < bottles.length; i++) if (bottles[i].x === laneX && bottles[i].y < 112) return true;
  for (let i = 0; i < hooks.length; i++) if (hooks[i].x === laneX && hooks[i].y < 112) return true;
  return false;
}

function isTargetLaneFree(targetX, currentY) {
  for (let i = 0; i < obstacles.length; i++) if (obstacles[i].x === targetX && Math.abs(obstacles[i].y - currentY) < 75) return false;
  for (let i = 0; i < chests.length; i++) if (chests[i].x === targetX && Math.abs(chests[i].y - currentY) < 75) return false;
  for (let i = 0; i < jellyfish.length; i++) if (jellyfish[i].x === targetX && Math.abs(jellyfish[i].y - currentY) < 75) return false;
  for (let i = 0; i < crabs.length; i++) if (crabs[i].x === targetX && Math.abs(crabs[i].y - currentY) < 75) return false;
  for (let i = 0; i < bottles.length; i++) if (bottles[i].x === targetX && Math.abs(bottles[i].y - currentY) < 75) return false;
  for (let i = 0; i < hooks.length; i++) if (hooks[i].x === targetX && Math.abs(hooks[i].y - currentY) < 75) return false;
  return true;
}

function spawnObjects(dt) {
  spawnAcc += dt;
  while (spawnAcc >= 1) {
    spawnAcc -= 1;
    spawnTimer++;

    if (spawnTimer % 36 === 0) {
      const laneIndex = Math.floor(Math.random() * 3);
      const laneX = LANES[laneIndex];

      if (!isLaneOccupied(laneX)) {
        const rand = Math.random();
        if (rand < 0.28) obstacles.push({ x: laneX, y: -40 });
        else if (rand < 0.50) chests.push({ x: laneX, y: -40 });
        else if (rand < 0.68) jellyfish.push({ x: laneX, y: -40 });
        else if (rand < 0.84) hooks.push({ x: laneX, y: -40 });
        else bottles.push({ x: laneX, y: -40, angle: (Math.random() - 0.5) * 0.7 });
      }
    }

    if (spawnTimer % 120 === 0) {
      let startLaneIdx = Math.random() < 0.5 ? 0 : 2;
      let startX = LANES[startLaneIdx];
      if (!isLaneOccupied(startX)) {
        crabs.push({ x: startX, targetX: startX, y: -40, moving: false });
      }
    }
  }

  if (!shark.active && Math.random() < 0.001 * dt && score > 30) {
    shark.active = true; shark.state = 'waiting'; shark.timer = 36;
    shark.targetLane = currentLane; shark.x = LANES[shark.targetLane]; shark.y = 700;
    playSharkVillagerSmirkSound();
  }

  if (!octopus.active && inkTimer <= 0 && score >= 150 && Math.random() < 0.0015 * dt) {
    octopus.active = true; 
    octopus.stage = 'reaching'; 
    let randomDelay = Math.floor(Math.random() * 37) + 36;
    octopus.timer = randomDelay;
    octopus.targetTimer = randomDelay;
    octopus.y = -50;
    playInkBubbleSound();
  }
}

function update(dt) {
  animTimer += dt;
  let targetX = LANES[currentLane];
  basePlayerX += (targetX - basePlayerX) * Math.min(1, 0.22 * dt);

  if (shockTimer > 0) shockTimer = Math.max(0, shockTimer - dt);
  if (swayTimer > 0) swayTimer = Math.max(0, swayTimer - dt);
  if (inkTimer > 0) inkTimer = Math.max(0, inkTimer - dt);
  if (damageFlashTimer > 0) damageFlashTimer = Math.max(0, damageFlashTimer - dt);
  if (invincibleTimer > 0) invincibleTimer = Math.max(0, invincibleTimer - dt);

  if (swayTimer > 0) {
    let env = Math.min(1, swayTimer / 35);
    let wobbleOffset = Math.sin(animTimer * 0.24) * 32 * env;
    playerX = Math.max(32, Math.min(328, basePlayerX + wobbleOffset));
  } else {
    playerX = basePlayerX;
  }

  if (submarine.active) {
    submarine.timer -= dt;
    if (submarine.timer > 150) {
      submarine.x += (88 - submarine.x) * Math.min(1, 0.08 * dt);
    } else if (submarine.timer > 45) {
      submarine.x += 0.35 * dt;
      if (Math.abs(submarine.timer - 115) < 0.6 || Math.abs(submarine.timer - 75) < 0.6) {
        spawnFireworkBurst(80 + Math.random() * 200, 100 + Math.random() * 70);
      }
    } else {
      submarine.x += 5.5 * dt;
    }
    if (submarine.timer <= 0 || submarine.x > 480) {
      submarine.active = false;
    }
  }

  for (let i = fireworks.length - 1; i >= 0; i--) {
    let fw = fireworks[i];
    fw.x += fw.vx * dt;
    fw.y += fw.vy * dt;
    fw.vy += 0.05 * dt;
    fw.life -= dt;
    if (fw.life <= 0) fireworks.splice(i, 1);
  }

  if (Math.floor(animTimer) % 5 === 0 && wakeBubbles.length < 25) {
    wakeBubbles.push({
      x: playerX + (Math.random() * 8 - 4),
      y: playerY + 36,
      r: Math.random() * 2 + 1.5,
      life: 20
    });
  }
  for (let i = wakeBubbles.length - 1; i >= 0; i--) {
    wakeBubbles[i].y += 2.5 * dt;
    wakeBubbles[i].life -= dt;
    if (wakeBubbles[i].life <= 0) wakeBubbles.splice(i, 1);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i];
    ft.y -= 1.2 * dt; ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  if (shark.active) {
    if (shark.state === 'waiting') {
      shark.y += (550 - shark.y) * Math.min(1, 0.1 * dt);
      shark.timer -= dt;
      if (shark.timer <= 0) shark.state = 'rush';
    } else if (shark.state === 'rush') {
      shark.y -= 15 * dt;
      if (wakeBubbles.length < 28 && Math.random() < 0.5) {
        wakeBubbles.push({
          x: shark.x + (Math.random() * 26 - 13),
          y: shark.y + 75,
          r: Math.random() * 3.5 + 2,
          life: 18
        });
      }
      if (invincibleTimer <= 0 && Math.abs(shark.x - playerX) < 26 && Math.abs(shark.y - playerY) < 32) {
        promptContinueOrGameOver(); return;
      }
      if (shark.y < -120) shark.active = false;
    }
  }

  if (octopus.active) {
    octopus.y += (80 - octopus.y) * Math.min(1, 0.1 * dt);
    octopus.timer -= dt;
    if (octopus.timer <= 0 && octopus.stage === 'reaching') {
      inkTimer = 180;
      octopus.active = false;
    }
  }

  spawnObjects(dt);

  let currentSpeed;
  if (score <= 450) {
    currentSpeed = initialSpeed * (1 + (score / 450));
  } else {
    let speedAt450 = initialSpeed * 2;
    let extraHundreds = Math.floor((score - 450) / 100);
    currentSpeed = speedAt450 * Math.pow(1.1, extraHundreds);
  }

  updateMusicScheduler(currentSpeed / initialSpeed);

  const stepDist = currentSpeed * dt;

  for (let i = 0; i < sideReefs.length; i++) {
    let r = sideReefs[i];
    r.y += stepDist * 0.85;
    if (r.y > 670) r.y = -30;
  }

  for (let i = crabs.length - 1; i >= 0; i--) {
    let cr = crabs[i]; cr.y += stepDist;
    
    if (!cr.moving && cr.y >= 256) {
      cr.moving = true;
      let possibleLanes = LANES.filter(l => l !== cr.x);
      let chosenTarget = possibleLanes[Math.floor(Math.random() * possibleLanes.length)];
      
      if (isTargetLaneFree(chosenTarget, cr.y)) {
        cr.targetX = chosenTarget;
      } else {
        cr.targetX = cr.x;
      }
    }
    
    if (cr.moving) {
      cr.x += (cr.targetX - cr.x) * Math.min(1, 0.08 * dt);
    }

    if (Math.abs(cr.x - playerX) < 27 && Math.abs(cr.y - playerY) < 27) {
      if (invincibleTimer <= 0) { hp--; damageFlashTimer = 15; playHitSound(); }
      score++; checkHighScoreProgress(); crabs.splice(i, 1); continue;
    }
    if (cr.y > 680) { score++; checkHighScoreProgress(); crabs.splice(i, 1); }
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    let o = obstacles[i]; o.y += stepDist;
    if (Math.abs(o.x - playerX) < 27 && Math.abs(o.y - playerY) < 27) {
      if (invincibleTimer <= 0) { hp--; damageFlashTimer = 15; playHitSound(); }
      score++; checkHighScoreProgress(); obstacles.splice(i, 1); continue;
    }
    if (o.y > 680) { score++; checkHighScoreProgress(); obstacles.splice(i, 1); }
  }

  for (let i = chests.length - 1; i >= 0; i--) {
    let c = chests[i]; c.y += stepDist;
    if (Math.abs(c.x - playerX) < 27 && Math.abs(c.y - playerY) < 27) {
      let maxCoins = Math.min(10, 1 + Math.floor(score / 50));
      let droppedCoins = Math.floor(Math.random() * maxCoins) + 1;
      currentRunCoins += droppedCoins; score++; checkHighScoreProgress(); playCoinSound();
      spawnCoinParticles(c.x, c.y, droppedCoins);
      chests.splice(i, 1); continue;
    }
    if (c.y > 680) { score++; checkHighScoreProgress(); chests.splice(i, 1); }
  }

  for (let i = jellyfish.length - 1; i >= 0; i--) {
    let j = jellyfish[i]; j.y += stepDist;
    if (Math.abs(j.x - playerX) < 27 && Math.abs(j.y - playerY) < 27) {
      if (invincibleTimer <= 0) { shockTimer = 210; hp--; damageFlashTimer = 15; playHitSound(); }
      score++; checkHighScoreProgress(); jellyfish.splice(i, 1); continue;
    }
    if (j.y > 680) { score++; checkHighScoreProgress(); jellyfish.splice(i, 1); }
  }

  for (let i = hooks.length - 1; i >= 0; i--) {
    let h = hooks[i]; h.y += stepDist;
    if (Math.abs(h.x - playerX) < 22 && Math.abs(h.y - playerY) < 22) {
      if (invincibleTimer <= 0) { hp--; damageFlashTimer = 15; playHitSound(); }
      score++; checkHighScoreProgress(); hooks.splice(i, 1); continue;
    }
    if (h.y > 680) { score++; checkHighScoreProgress(); hooks.splice(i, 1); }
  }

  for (let i = bottles.length - 1; i >= 0; i--) {
    let b = bottles[i]; b.y += stepDist;
    if (Math.abs(b.x - playerX) < 26 && Math.abs(b.y - playerY) < 26) {
      if (invincibleTimer <= 0) { swayTimer = 210; playBottleSound(); }
      score++; checkHighScoreProgress();
      for (let k = 0; k < 6; k++) {
        let ang = Math.random() * Math.PI * 2;
        particles.push({
          x: b.x, y: b.y,
          vx: Math.cos(ang) * 2.5,
          vy: Math.sin(ang) * 2.5,
          life: 22, maxLife: 22,
          color: '#a8e6cf',
          stroke: '#2c5e63',
          size: 3
        });
      }
      bottles.splice(i, 1);
      continue;
    }
    if (b.y > 680) { score++; checkHighScoreProgress(); bottles.splice(i, 1); }
  }

  if (hp <= 0) { promptContinueOrGameOver(); return; }
}

function drawOceanBackground() {
  ctx.drawImage(bgCacheCanvas, 0, 0);

  let raySway = Math.sin(animTimer * 0.02) * 15;
  ctx.fillStyle = CACHED_GRADS.rays;

  ctx.beginPath();
  ctx.moveTo(20, 0); ctx.lineTo(110, 0);
  ctx.lineTo(190 + raySway, 460); ctx.lineTo(50 + raySway, 460);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(180, 0); ctx.lineTo(290, 0);
  ctx.lineTo(360 + raySway, 460); ctx.lineTo(220 + raySway, 460);
  ctx.fill();

  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < sideReefs.length; i++) {
    let r = sideReefs[i];
    let xPos = r.side === 'left' ? 6 : canvas.width - 6;
    ctx.fillStyle = r.color;
    ctx.strokeStyle = r.stroke;
    ctx.beginPath();
    ctx.arc(xPos, r.y, r.size, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(xPos + (r.side === 'left' ? 5 : -5), r.y - 10, r.size * 0.65, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < bubbles.length; i++) {
    let b = bubbles[i];
    b.y -= b.s; if (b.y < -10) b.y = 650;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  }
}

function drawYellowSubmarine() {
  if (!submarine.active) return;

  ctx.save();
  let bobY = submarine.y + Math.sin(animTimer * 0.1) * 5;
  ctx.translate(submarine.x, bobY);

  const subOutline = '#99582a';

  if (Math.floor(animTimer) % 3 === 0 && wakeBubbles.length < 28) {
    wakeBubbles.push({
      x: submarine.x - 52,
      y: bobY + (Math.random() * 10 - 5),
      r: Math.random() * 2.5 + 1.5,
      life: 18
    });
  }

  let propScale = Math.sin(animTimer * 0.6);
  ctx.fillStyle = '#e67e22';
  ctx.strokeStyle = subOutline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(-46, -6 * propScale, 3.5, 8 * Math.abs(propScale) + 2, 0, 0, Math.PI * 2);
  ctx.ellipse(-46, 6 * propScale, 3.5, 8 * Math.abs(propScale) + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.moveTo(-36, 0); ctx.lineTo(-45, -14); ctx.lineTo(-30, -8); ctx.closePath();
  ctx.moveTo(-36, 0); ctx.lineTo(-45, 14);  ctx.lineTo(-30, 8);  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = subOutline;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -18); ctx.lineTo(-2, -32); ctx.lineTo(7, -32);
  ctx.stroke();

  ctx.strokeStyle = '#ffd32a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-2, -18); ctx.lineTo(-2, -32); ctx.lineTo(7, -32);
  ctx.stroke();

  ctx.fillStyle = '#f39c12';
  ctx.strokeStyle = subOutline;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-14, -23, 24, 12, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = CACHED_GRADS.subBody;
  ctx.strokeStyle = subOutline;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, 42, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-6, -10, 22, 4, -0.05, 0, Math.PI * 2);
  ctx.fill();

  [-18, 0, 18].forEach(px => {
    ctx.fillStyle = '#e67e22';
    ctx.strokeStyle = subOutline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px, 1, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#7ed6df';
    ctx.beginPath();
    ctx.arc(px, 1, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - 1.4, -0.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.font = '900 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#051923';
  ctx.lineWidth = 4;
  let bannerText = `🏆 ${t('newRecordBanner')}`;
  ctx.strokeText(bannerText, 12, -42);
  ctx.fillStyle = '#fff200';
  ctx.fillText(bannerText, 12, -42);
  ctx.textAlign = 'left';

  ctx.restore();
}

function drawDirtyBottle(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(OBSTACLE_SCALE, OBSTACLE_SCALE);
  let floatRot = b.angle + Math.sin(animTimer * 0.07 + b.x) * 0.18;
  ctx.rotate(floatRot);

  const bottleOutline = '#2c5e63';
  const dirtyLabelOutline = '#6e5239';

  ctx.fillStyle = CACHED_GRADS.bottle;
  ctx.strokeStyle = bottleOutline;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(-4, -15);
  ctx.lineTo(4, -15);
  ctx.lineTo(10, -9);
  ctx.lineTo(7, -2);
  ctx.lineTo(11, 6);
  ctx.lineTo(8, 15);
  ctx.quadraticCurveTo(0, 18, -9, 15);
  ctx.lineTo(-11, 7);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(122, 92, 56, 0.45)';
  ctx.beginPath();
  ctx.ellipse(3, 10, 4.5, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-4, -6, 3.5, 2.2, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d4b483';
  ctx.strokeStyle = dirtyLabelOutline;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-7, -2);
  ctx.lineTo(8, 0);
  ctx.lineTo(10, 7);
  ctx.lineTo(1, 5);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#a34e28';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(5, 3);
  ctx.stroke();

  ctx.strokeStyle = bottleOutline;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, 0); ctx.lineTo(3, -3);
  ctx.moveTo(7, -2); ctx.lineTo(-2, 4);
  ctx.moveTo(-5, 11); ctx.lineTo(4, 9);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-5, -9, 1.8, 4.5, 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#eb4d4b';
  ctx.strokeStyle = '#900c3f';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-4.5, -20, 9, 5, 1.5);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawCrab(cr) {
  ctx.save();
  ctx.translate(cr.x, cr.y);
  ctx.scale(OBSTACLE_SCALE, OBSTACLE_SCALE);

  const crabOutline = '#900c3f';
  let legMove = Math.sin(animTimer * 0.3) * 3.5;
  let clawWag = Math.sin(animTimer * 0.25) * 3.5;

  function strokeWithSoftOutline(drawPathFn, innerColor, innerWidth) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = crabOutline;
    ctx.lineWidth = innerWidth + 2.4;
    ctx.beginPath(); drawPathFn(); ctx.stroke();

    ctx.strokeStyle = innerColor;
    ctx.lineWidth = innerWidth;
    ctx.beginPath(); drawPathFn(); ctx.stroke();
  }

  strokeWithSoftOutline(() => {
    ctx.moveTo(-10, -2); ctx.lineTo(-19, -5 + legMove); ctx.lineTo(-23, 1 + legMove);
    ctx.moveTo(-11, 2);  ctx.lineTo(-21, 2 - legMove);  ctx.lineTo(-25, 8 - legMove);
    ctx.moveTo(-9, 6);   ctx.lineTo(-18, 9 + legMove);  ctx.lineTo(-21, 15 + legMove);
    ctx.moveTo(10, -2);  ctx.lineTo(19, -5 - legMove);  ctx.lineTo(23, 1 - legMove);
    ctx.moveTo(11, 2);   ctx.lineTo(21, 2 + legMove);   ctx.lineTo(25, 8 + legMove);
    ctx.moveTo(9, 6);    ctx.lineTo(18, 9 - legMove);   ctx.lineTo(21, 15 - legMove);
  }, '#ff6b6b', 2.8);

  strokeWithSoftOutline(() => {
    ctx.moveTo(-9, -6); ctx.quadraticCurveTo(-18, -10, -19, -16 + clawWag);
    ctx.moveTo(9, -6);  ctx.quadraticCurveTo(18, -10, 19, -16 - clawWag);
  }, '#ee5253', 3.2);

  function drawPincer(cx, cy, flip) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(flip, 1);
    ctx.fillStyle = '#ff4757';
    ctx.strokeStyle = crabOutline;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0.2, Math.PI * 1.4);
    ctx.lineTo(2, -9);
    ctx.lineTo(1, -2);
    ctx.lineTo(7, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  drawPincer(-19, -16 + clawWag, 1);
  drawPincer(19, -16 - clawWag, -1);

  ctx.fillStyle = CACHED_GRADS.crab;
  ctx.strokeStyle = crabOutline;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 1, 15, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-5, -3, 5, 2.5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = crabOutline;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 3, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  [-5.5, 5.5].forEach(gx => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = crabOutline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(gx, -10, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#5c0626';
    ctx.beginPath();
    ctx.arc(gx, -10, 1.7, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawShark() {
  if (!shark.active) return;

  const sharkOutline = '#043552';

  let warnAlpha = 0.14 + Math.abs(Math.sin(animTimer * 0.25)) * 0.18;
  ctx.fillStyle = `rgba(255, 71, 87, ${warnAlpha})`;
  ctx.fillRect(shark.x - 32, 0, 64, 640);
  ctx.strokeStyle = 'rgba(255, 107, 129, 0.65)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(shark.x - 32, 0, 64, 640);

  ctx.save();
  ctx.translate(shark.x, shark.y);

  let speedFactor = shark.state === 'rush' ? 0.55 : 0.22;
  let tailSwing = Math.sin(animTimer * speedFactor) * (shark.state === 'rush' ? 14 : 6);
  let bodySwing = Math.sin(animTimer * speedFactor - 0.6) * 4;
  let finWave = Math.cos(animTimer * 0.25) * 3;

  if (shark.state === 'rush') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -56, 22, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  ctx.fillStyle = '#09527a';
  ctx.strokeStyle = sharkOutline;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(-18, -14);
  ctx.bezierCurveTo(-52, -4 + finWave, -60, 22 + finWave, -44, 28 + finWave);
  ctx.bezierCurveTo(-30, 22, -22, 12, -16, 8);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(18, -14);
  ctx.bezierCurveTo(52, -4 + finWave, 60, 22 + finWave, 44, 28 + finWave);
  ctx.bezierCurveTo(30, 22, 22, 12, 16, 8);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#09527a';
  ctx.beginPath();
  ctx.moveTo(bodySwing, 68);
  ctx.quadraticCurveTo(-18 + tailSwing, 88, -26 + tailSwing * 1.3, 108);
  ctx.quadraticCurveTo(-8 + tailSwing * 0.8, 95, tailSwing * 0.9, 98);
  ctx.quadraticCurveTo(8 + tailSwing * 0.8, 95, 26 + tailSwing * 1.3, 108);
  ctx.quadraticCurveTo(18 + tailSwing, 88, bodySwing, 68);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#e0fbfc';
  ctx.beginPath();
  ctx.ellipse(0, -52, 17, 16, 0, Math.PI, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#ffffff';
  const teethAngles = [-0.85, -0.5, -0.18, 0.18, 0.5, 0.85];
  teethAngles.forEach(a => {
    let tx = Math.sin(a) * 16;
    let ty = -53 - Math.cos(a) * 12;
    ctx.beginPath();
    ctx.moveTo(tx - 3, ty + 3);
    ctx.lineTo(tx, ty - 5);
    ctx.lineTo(tx + 3, ty + 3);
    ctx.closePath();
    ctx.fill();
  });

  ctx.fillStyle = CACHED_GRADS.sharkBody;
  ctx.beginPath();
  ctx.moveTo(0, -64);
  ctx.bezierCurveTo(26, -50, 27, -5, 17 + bodySwing * 0.4, 34);
  ctx.bezierCurveTo(11 + bodySwing * 0.7, 54, 5 + bodySwing, 66, bodySwing, 74);
  ctx.bezierCurveTo(-5 + bodySwing, 66, -11 + bodySwing * 0.7, 54, -17 + bodySwing * 0.4, 34);
  ctx.bezierCurveTo(-27, -5, -26, -50, 0, -64);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = sharkOutline;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.ellipse(-7, -24, 4.5, 22, -0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = sharkOutline;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  [-24, -17, -10].forEach((gy, idx) => {
    let w = 16 - idx;
    ctx.beginPath();
    ctx.moveTo(-w, gy);
    ctx.quadraticCurveTo(-w - 4, gy + 3, -w + 1, gy + 6);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w, gy);
    ctx.quadraticCurveTo(w + 4, gy + 3, w - 1, gy + 6);
    ctx.stroke();
  });

  ctx.fillStyle = CACHED_GRADS.sharkDorsal;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.bezierCurveTo(10 + bodySwing * 0.5, 0, 9 + bodySwing * 0.8, 22, 0 + bodySwing * 0.5, 32);
  ctx.bezierCurveTo(-5 + bodySwing * 0.4, 18, -5, 0, 0, -18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = sharkOutline;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  function drawTopDownSharkEye(ex, ey, side) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd32a';
    ctx.fill();

    ctx.save();
    ctx.clip();

    ctx.fillStyle = '#b33939';
    ctx.beginPath();
    ctx.ellipse(ex, ey - 0.9, 1.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 1.1, ey - 1.8, 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#075280';
    ctx.beginPath();
    ctx.moveTo(ex - side * 6, ey + 4.2);
    ctx.lineTo(ex + side * 6, ey + 0.4);
    ctx.lineTo(ex + side * 6, ey + 7);
    ctx.lineTo(ex - side * 6, ey + 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = sharkOutline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(ex, ey, 4.8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = sharkOutline;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - side * 5.2, ey + 4.0);
    ctx.lineTo(ex + side * 4.8, ey + 0.3);
    ctx.stroke();
    ctx.restore();
  }

  drawTopDownSharkEye(-13, -42, -1);
  drawTopDownSharkEye(13, -42, 1);

  ctx.restore();
}

function draw() {
  drawOceanBackground();

  for (let i = 0; i < wakeBubbles.length; i++) {
    let wb = wakeBubbles[i];
    ctx.fillStyle = `rgba(255, 255, 255, ${(wb.life / 20) * 0.4})`;
    ctx.beginPath(); ctx.arc(wb.x, wb.y, wb.r, 0, Math.PI * 2); ctx.fill();
  }

  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(OBSTACLE_SCALE, OBSTACLE_SCALE);
    let sway = Math.sin(animTimer * 0.08 + o.x) * 8;
    ctx.lineCap = 'round';

    function drawLeafBranch(x0, y0, cx, cy, x1, y1, color, strokeColor, width) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = width + 2.4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
    }

    drawLeafBranch(-7, 22, sway - 8, 0, sway - 14, -22, '#05c46b', '#006266', 5.2);
    drawLeafBranch(7, 22, sway + 6, 2, sway + 12, -20, '#00d8d6', '#006266', 4.8);
    drawLeafBranch(0, 25, sway, -2, sway * 1.3, -28, '#0be881', '#006266', 6);

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#b33939';
    ctx.fillStyle = '#ff5e57';
    ctx.beginPath(); ctx.arc(sway * 1.3, -28, 4.6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#99582a';
    ctx.fillStyle = '#ffd32a';
    ctx.beginPath(); ctx.arc(sway - 14, -22, 3.8, 0, Math.PI*2); ctx.fill(); ctx.stroke();

    ctx.restore();
  }

  for (let i = 0; i < chests.length; i++) {
    let c = chests[i];
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(OBSTACLE_SCALE, OBSTACLE_SCALE);

    ctx.fillStyle = CACHED_GRADS.chestGlow;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI*2); ctx.fill();

    const woodOutline = '#4a2511';
    const goldOutline = '#99582a';
    ctx.lineWidth = 1.5;

    ctx.strokeStyle = woodOutline;
    ctx.fillStyle = '#a66e38';
    ctx.beginPath(); ctx.ellipse(0, -9, 16, 7.5, 0, Math.PI, 0); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#8d5524';
    ctx.beginPath(); ctx.roundRect(-16, -10, 32, 22, 4); ctx.fill(); ctx.stroke();

    ctx.strokeStyle = goldOutline;
    ctx.fillStyle = '#ffd32a';
    ctx.fillRect(-16, -10, 5, 22); ctx.strokeRect(-16, -10, 5, 22);
    ctx.fillRect(11, -10, 5, 22);  ctx.strokeRect(11, -10, 5, 22);
    ctx.fillRect(-16, -11, 32, 4); ctx.strokeRect(-16, -11, 32, 4);

    ctx.strokeStyle = '#900c3f';
    ctx.fillStyle = '#ff3f34';
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-1.5, -1.5, 1.3, 0, Math.PI*2); ctx.fill();

    ctx.restore();
  }

  for (let i = 0; i < jellyfish.length; i++) {
    let j = jellyfish[i];
    ctx.save();
    ctx.translate(j.x, j.y);
    ctx.scale(OBSTACLE_SCALE, OBSTACLE_SCALE);

    const jellyOutline = '#833471';
    let tentacleOffsets = [-9, -3, 3, 9];
    tentacleOffsets.forEach((tOffset, idx) => {
      let wave = Math.sin(animTimer * 0.12 + idx) * 5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = jellyOutline; ctx.lineWidth = 4.2;
      ctx.beginPath(); ctx.moveTo(tOffset, 0); ctx.quadraticCurveTo(tOffset + wave, 14, tOffset, 24); ctx.stroke();

      ctx.strokeStyle = '#ff9ff3'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(tOffset, 0); ctx.quadraticCurveTo(tOffset + wave, 14, tOffset, 24); ctx.stroke();
    });

    ctx.fillStyle = CACHED_GRADS.jelly;
    ctx.strokeStyle = jellyOutline;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 2, 17, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#571845';
    ctx.beginPath();
    ctx.arc(-6, -5, 2.2, 0, Math.PI*2);
    ctx.arc(6, -5, 2.2, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }
  
  for (let i = 0; i < hooks.length; i++) {
    let h = hooks[i];
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.scale(OBSTACLE_SCALE, OBSTACLE_SCALE);

    const steelOutline = '#3c6382';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(0, -10); ctx.stroke();
    
    ctx.lineCap = 'round';
    ctx.strokeStyle = steelOutline; ctx.lineWidth = 5.6;
    ctx.beginPath(); ctx.arc(-6, -4, 7.5, 0, Math.PI); ctx.stroke();

    ctx.strokeStyle = '#f1f2f6'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.arc(-6, -4, 7.5, 0, Math.PI); ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = steelOutline; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-13.5, -4);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-17, -8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < bottles.length; i++) drawDirtyBottle(bottles[i]);
  for (let i = 0; i < crabs.length; i++) drawCrab(crabs[i]);

  if (octopus.active) {
    const octoOutline = '#4a154b';
    for(let i=0; i<8; i++) {
      let startX = 22 + i * 44;
      let wave = Math.sin(animTimer * 0.08 + i) * 12;
      ctx.lineCap = 'round';

      ctx.strokeStyle = octoOutline; ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.quadraticCurveTo(startX + wave, octopus.y * 0.5, startX + (i%2===0?20:-20), octopus.y);
      ctx.stroke();

      ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.quadraticCurveTo(startX + wave, octopus.y * 0.5, startX + (i%2===0?20:-20), octopus.y);
      ctx.stroke();

      ctx.fillStyle = '#ff9ff3'; ctx.strokeStyle = octoOutline; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(startX + wave * 0.4, octopus.y * 0.45, 4.2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(startX + wave * 0.8, octopus.y * 0.8, 3.6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    }
  }

  drawYellowSubmarine();
  for (let i = 0; i < fireworks.length; i++) {
    let fw = fireworks[i];
    ctx.save();
    ctx.globalAlpha = fw.life / fw.maxLife;
    ctx.fillStyle = fw.color;
    ctx.strokeStyle = '#051923';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawShark();

  ctx.save();
  let tilt = (LANES[currentLane] - basePlayerX) * 0.008;
  if (swayTimer > 0) {
    tilt += Math.cos(animTimer * 0.24) * 0.28;
  }
  ctx.translate(playerX, playerY);
  ctx.rotate(tilt);

  if (invincibleTimer > 0) {
    let shieldAlpha = 0.35 + Math.sin(animTimer * 0.35) * 0.2;
    ctx.fillStyle = `rgba(72, 219, 251, ${shieldAlpha * 0.5})`;
    ctx.strokeStyle = `rgba(255, 255, 255, ${shieldAlpha + 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 4, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  
  let fishGrad = CACHED_GRADS.fishOrange, finColor = '#eb4d4b', fishOutline = '#9e2a2b';
  if (saveData.currentSkin === 'blue') {
    fishGrad = CACHED_GRADS.fishBlue; finColor = '#0097e6'; fishOutline = '#005082';
  } else if (saveData.currentSkin === 'gold') {
    fishGrad = CACHED_GRADS.fishGold; finColor = '#f39c12'; fishOutline = '#99582a';
  }

  if (damageFlashTimer > 0) {
    fishGrad = '#ffffff'; fishOutline = '#9e2a2b';
  }

  ctx.strokeStyle = fishOutline;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';

  let tailWag = Math.sin(animTimer * 0.4) * 6;
  ctx.fillStyle = finColor;
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.bezierCurveTo(-16 + tailWag, 28, -22 + tailWag, 42, -12 + tailWag, 48);
  ctx.lineTo(0, 32);
  ctx.lineTo(12 + tailWag, 48);
  ctx.bezierCurveTo(22 + tailWag, 42, 16 + tailWag, 28, 0, 18);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-9, -4);
  ctx.bezierCurveTo(-24, 2, -26, 15, -14, 18);
  ctx.lineTo(-9, 10);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(9, -4);
  ctx.bezierCurveTo(24, 2, 26, 15, 14, 18);
  ctx.lineTo(9, 10);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = fishGrad;
  ctx.beginPath(); 
  ctx.ellipse(0, 0, 13, 24, 0, 0, Math.PI * 2); 
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-5.5, -6, 2.5, 8, -0.15, 0, Math.PI * 2);
  ctx.fill();

  let dorsalSway = Math.sin(animTimer * 0.4) * 2.5;
  ctx.fillStyle = finColor;
  ctx.strokeStyle = fishOutline;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.bezierCurveTo(4.5 + dorsalSway, 1, 4 + dorsalSway, 11, 0, 16);
  ctx.bezierCurveTo(-2.5 + dorsalSway * 0.5, 10, -2.5, 1, 0, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (shockTimer > 0) {
    ctx.strokeStyle = fishOutline; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -14); ctx.lineTo(-4, -10);
    ctx.moveTo(-4, -14); ctx.lineTo(-8, -10);
    ctx.moveTo(4, -14);  ctx.lineTo(8, -10);
    ctx.moveTo(8, -14);  ctx.lineTo(4, -10);
    ctx.stroke();
  } else {
    [-6, 6].forEach((ex, idx) => {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = fishOutline;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(ex, -12, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1e3799';
      let pxOff = swayTimer > 0 ? Math.cos(animTimer * 0.3 + idx * 3) * 1.3 : 0;
      let pyOff = swayTimer > 0 ? Math.sin(animTimer * 0.3 + idx * 3) * 1.3 : 0;
      ctx.beginPath(); ctx.arc(ex + pxOff, -12 + pyOff, 1.7, 0, Math.PI * 2); ctx.fill();
    });
  }

  if (swayTimer > 0) {
    for (let d = 0; d < 2; d++) {
      let ang = animTimer * 0.16 + d * Math.PI;
      let dx = Math.cos(ang) * 14;
      let dy = -24 + Math.sin(ang) * 4;
      ctx.fillStyle = '#a8e6cf';
      ctx.strokeStyle = '#2c5e63';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(dx, dy, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (shockTimer > 0) {
    ctx.strokeStyle = '#fff200';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    for(let s = 1; s <= 6; s++) {
      let py = -18 + (s * 8);
      let px = (s % 2 === 0 ? 6 : -6) + (Math.random() * 4 - 2);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.restore();

  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < floatingTexts.length; i++) {
    let ft = floatingTexts[i];
    ctx.save();
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#99582a';
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = ft.life / ft.maxLife;
    let label = `+${ft.amount}`;
    ctx.strokeText(label, ft.x - 18, ft.y);
    ctx.fillText(label, ft.x - 18, ft.y);
    drawSpinningCoin(ft.x + 14, ft.y - 6, 7, ft.life * 0.2);
    ctx.restore();
  }

  if (inkTimer > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(44, 20, 74, 0.92)';
    ctx.strokeStyle = '#2c0e37';
    ctx.lineWidth = 2;
    const splats = [
      { x: 180, y: 240, r: 115 },
      { x: 95,  y: 170, r: 75 },
      { x: 265, y: 190, r: 80 },
      { x: 120, y: 340, r: 85 },
      { x: 250, y: 330, r: 75 }
    ];
    splats.forEach(sp => {
      ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillStyle = '#ff9ff3';
    ctx.strokeStyle = '#4a154b';
    ctx.lineWidth = 2.5;
    ctx.textAlign = 'center';
    ctx.strokeText(t('inkSplat'), 180, 250);
    ctx.fillText(t('inkSplat'), 180, 250);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // HUD
  ctx.save();
  ctx.fillStyle = 'rgba(6, 40, 61, 0.72)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(10, 48, 150, 82, 16); ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#ffffff'; ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText(`${t('hudScore')}: ${Math.floor(score)}`, 22, 69);
  ctx.fillStyle = '#48dbfb'; ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(`🏆 ${t('hudBest')}: ${saveData.highScore || 0}`, 22, 89);
  
  drawSpinningCoin(29, 110, 7);
  ctx.fillStyle = '#ffd166'; ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText(`${currentRunCoins}`, 43, 115);

  let hpBoxWidth = maxHp * 26 + 16;
  ctx.fillStyle = 'rgba(6, 40, 61, 0.72)';
  ctx.beginPath(); ctx.roundRect(canvas.width - hpBoxWidth - 10, 10, hpBoxWidth, 38, 16); ctx.fill(); ctx.stroke();

  ctx.font = '18px sans-serif';
  for(let i=0; i<maxHp; i++) {
    ctx.fillText(i < hp ? '❤️' : '🖤', canvas.width - hpBoxWidth + 6 + i * 25, 35);
  }

  let statusY = 66;
  if (shockTimer > 0) {
    ctx.fillStyle = '#ffd32a'; ctx.font = '900 13px system-ui, sans-serif';
    ctx.strokeStyle = '#99582a'; ctx.lineWidth = 2.2;
    let shockLabel = `${t('hudShock')}: ${(shockTimer/60).toFixed(1)}${t('sec')}`;
    ctx.strokeText(shockLabel, 168, statusY);
    ctx.fillText(shockLabel, 168, statusY);
    statusY += 20;
  }

  if (swayTimer > 0) {
    ctx.fillStyle = '#a8e6cf'; ctx.font = '900 13px system-ui, sans-serif';
    ctx.strokeStyle = '#2c5e63'; ctx.lineWidth = 2.2;
    let swayLabel = `${t('hudSway')}: ${(swayTimer/60).toFixed(1)}${t('sec')}`;
    ctx.strokeText(swayLabel, 168, statusY);
    ctx.fillText(swayLabel, 168, statusY);
  }
  ctx.restore();
}

function drawMenuBackground() {
  if (!isPlaying) {
    animTimer++;
    drawOceanBackground();
  }
}

function gameLoop(now) {
  if (!isPlaying || ytSystemPaused) return;
  if (!lastFrameTime) lastFrameTime = now;
  const dt = Math.min(2.0, Math.max(0.25, (now - lastFrameTime) / 16.6667));
  lastFrameTime = now;

  update(dt);
  draw();
  if (isPlaying && !ytSystemPaused) {
    rafId = requestAnimationFrame(gameLoop);
  }
}

// --- ИНИЦИАЛИЗАЦИЯ И ЖИЗНЕННЫЙ ЦИКЛ YOUTUBE PLAYABLES ---
window.addEventListener('DOMContentLoaded', async () => {
  // 1. Рендерим первый кадр сразу и уведомляем YouTube Playables
  drawOceanBackground();
  if (isYTEnv() && ytgame.game && ytgame.game.firstFrameReady) {
    try { ytgame.game.firstFrameReady(); } catch (e) {}
  }

  // 2. Подписываемся на системные события YouTube Playables (пауза, возобновление, звук)
  if (isYTEnv() && ytgame.system) {
    try {
      if (typeof ytgame.system.isAudioEnabled === 'function') {
        ytSystemAudioAllowed = ytgame.system.isAudioEnabled();
        document.getElementById('musicIcon').innerText = isAudioAllowed() ? '🔊' : '🔇';
      }
      if (ytgame.system.onAudioEnabledChange) {
        ytgame.system.onAudioEnabledChange((isAudioEnabled) => {
          ytSystemAudioAllowed = Boolean(isAudioEnabled);
          document.getElementById('musicIcon').innerText = isAudioAllowed() ? '🔊' : '🔇';
          updateMasterGain();
        });
      }
      if (ytgame.system.onPause) {
        ytgame.system.onPause(() => {
          ytSystemPaused = true;
          updateMasterGain();
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          if (isPlaying) {
            document.getElementById('pauseOverlay').style.display = 'flex';
          }
        });
      }
      if (ytgame.system.onResume) {
        ytgame.system.onResume(() => {
          ytSystemPaused = false;
          document.getElementById('pauseOverlay').style.display = 'none';
          updateMasterGain();
          if (audioCtx) nextStepTime = audioCtx.currentTime + 0.05;
          if (isPlaying) {
            lastFrameTime = performance.now();
            rafId = requestAnimationFrame(gameLoop);
          }
        });
      }
    } catch (e) {
      ytSafeLogError(e);
    }
  }

  // 3. Загружаем облачные сохранения игрока
  await ytLoadCloudData();

  // 4. Определяем язык (приоритет: сохраненный -> системный язык YouTube -> язык браузера)
  let initialLang = null;
  try { initialLang = localStorage.getItem('reefRunnerLang'); } catch (e) {}
  if (!initialLang && isYTEnv() && ytgame.system && ytgame.system.getLanguage) {
    try {
      const ytLang = await ytgame.system.getLanguage();
      if (ytLang) initialLang = normalizeLangCode(ytLang);
    } catch (e) {}
  }
  if (!initialLang) {
    initialLang = normalizeLangCode(navigator.language || navigator.userLanguage);
  }
  window.setLanguage(initialLang);

  // 5. Обновляем интерфейс и сообщаем YouTube Playables, что игра полностью готова к взаимодействию
  const tCoins = document.getElementById('totalCoinsText');
  const sCoins = document.getElementById('shopCoinsText');
  const hScore = document.getElementById('highScoreText');
  if (tCoins) tCoins.innerText = saveData.coins;
  if (sCoins) sCoins.innerText = saveData.coins;
  if (hScore) hScore.innerText = saveData.highScore || 0;

  if (isYTEnv() && ytgame.game && ytgame.game.gameReady) {
    try { ytgame.game.gameReady(); } catch (e) {}
  }
});