const TOPICS = {
  PH: [
    "Mandaluyong mpox case",
    "PBA trade rumors",
    "Philippines weather update",
    "OPM concert tickets",
    "UAAP finals",
    "Pinoy budget meals",
    "Manila traffic advisory",
    "K-drama finale",
    "Mobile Legends patch",
    "Minimum wage discussion"
  ],
  US: [
    "NBA free agency",
    "movie box office",
    "student loan update",
    "weather alert",
    "tech layoffs",
    "football transfer news"
  ],
  AE: [
    "Dubai rent update",
    "UAE weather",
    "visa rule update",
    "Dubai weekend events",
    "gold price today",
    "Abu Dhabi traffic"
  ],
  JP: ["anime release", "Tokyo weather", "J-pop comeback", "yen exchange rate", "baseball finals"],
  KR: ["K-pop comeback", "Seoul weather", "K-drama episode", "gaming tournament", "beauty trend"],
  SG: ["Singapore weather", "MRT update", "food festival", "property market", "concert tickets"]
};

const HUGOT_TOPICS = [
  "crush na hindi pa ready",
  "friendzone era",
  "seen pero walang reply",
  "study first feelings later",
  "move on quietly",
  "self-worth check",
  "late night overthinking",
  "hindi lahat ng miss kailangan balikan"
];

const PALETTES = {
  news: ["#0f172a", "#1d4ed8", "#f97316"],
  sports: ["#06281f", "#0f8375", "#facc15"],
  study: ["#14213d", "#fca311", "#e5e5e5"],
  hugot: ["#1e1b4b", "#be185d", "#fb7185"],
  food: ["#3f1d0b", "#f97316", "#fde68a"],
  tech: ["#020617", "#2563eb", "#22d3ee"],
  money: ["#052e16", "#16a34a", "#bbf7d0"],
  weather: ["#075985", "#38bdf8", "#f0f9ff"],
  generic: ["#111827", "#0f8375", "#ff7a1a"]
};

const els = {
  canvas: document.querySelector("#canvas"),
  caption: document.querySelector("#caption"),
  meta: document.querySelector("#meta"),
  status: document.querySelector("#status"),
  country: document.querySelector("#country"),
  customTopics: document.querySelector("#customTopics"),
  autoRun: document.querySelector("#autoRun"),
  interval: document.querySelector("#interval"),
  intervalLabel: document.querySelector("#intervalLabel"),
  generate: document.querySelector("#generate"),
  stop: document.querySelector("#stop"),
  facebookPageId: document.querySelector("#facebookPageId"),
  facebookToken: document.querySelector("#facebookToken"),
  graphVersion: document.querySelector("#graphVersion"),
  saveFacebook: document.querySelector("#saveFacebook"),
  facebookStatus: document.querySelector("#facebookStatus"),
  logoUpload: document.querySelector("#logoUpload"),
  clearLogo: document.querySelector("#clearLogo"),
  logoStatus: document.querySelector("#logoStatus")
};

const state = {
  timer: null,
  current: null,
  count: 0,
  trends: []
};

const ctx = els.canvas.getContext("2d");
let uploadedLogo = null;

function selectedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function mask(value) {
  if (!value) return "missing";
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : "saved";
}

function loadFacebookKeys() {
  els.facebookPageId.value = localStorage.getItem("liteFacebookPageId") || "";
  els.graphVersion.value = localStorage.getItem("liteGraphVersion") || "v25.0";
  const token = localStorage.getItem("liteFacebookToken") || "";
  els.facebookToken.placeholder = token ? `Saved: ${mask(token)}` : "Paste Page token";
  els.facebookStatus.textContent = `Page ID: ${els.facebookPageId.value || "missing"} | Token: ${mask(token)}`;
}

function saveFacebookKeys() {
  localStorage.setItem("liteFacebookPageId", els.facebookPageId.value.trim());
  localStorage.setItem("liteGraphVersion", els.graphVersion.value.trim() || "v25.0");
  if (els.facebookToken.value.trim()) {
    localStorage.setItem("liteFacebookToken", els.facebookToken.value.trim());
    els.facebookToken.value = "";
  }
  loadFacebookKeys();
  setStatus("Facebook keys saved. No OpenAI will be used.");
}

function facebookPayload() {
  return {
    pageId: els.facebookPageId.value.trim() || localStorage.getItem("liteFacebookPageId") || "",
    token: els.facebookToken.value.trim() || localStorage.getItem("liteFacebookToken") || "",
    version: els.graphVersion.value.trim() || localStorage.getItem("liteGraphVersion") || "v25.0"
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = src;
  });
}

async function loadSavedLogo() {
  const saved = localStorage.getItem("liteLogoDataUrl");
  if (!saved) {
    uploadedLogo = null;
    els.logoStatus.textContent = "No uploaded logo. Text logo will be used.";
    return;
  }
  try {
    uploadedLogo = await loadImage(saved);
    els.logoStatus.textContent = "Uploaded logo active.";
  } catch {
    uploadedLogo = null;
    localStorage.removeItem("liteLogoDataUrl");
    els.logoStatus.textContent = "Logo could not load. Text logo will be used.";
  }
}

function saveUploadedLogo(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    localStorage.setItem("liteLogoDataUrl", String(reader.result));
    await loadSavedLogo();
    setStatus("Logo saved. Next layout will use uploaded logo.");
  };
  reader.readAsDataURL(file);
}

async function clearLogo() {
  localStorage.removeItem("liteLogoDataUrl");
  els.logoUpload.value = "";
  await loadSavedLogo();
  setStatus("Logo cleared. Text logo will be used.");
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getTopics() {
  const pasted = els.customTopics.value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (pasted.length) return pasted;
  return TOPICS[els.country.value] || TOPICS.PH;
}

async function loadLiveTrends() {
  const response = await fetch(`/api/trends?geo=${encodeURIComponent(els.country.value || "PH")}&limit=10`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load Google Trends");
  state.trends = data.trends || [];
  return state.trends;
}

async function pickTrend() {
  const pasted = els.customTopics.value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (pasted.length) {
    return {
      title: pick(pasted),
      picture: "",
      pictureSource: "pasted topic"
    };
  }
  if (!state.trends.length) await loadLiveTrends();
  return pick(state.trends);
}

function classify(text, postType) {
  const value = text.toLowerCase();
  if (postType === "hugot") return "hugot";
  if (/nba|pba|uaap|sports|football|baseball|finals|tournament|trade|kane|bellingham|djokovic/.test(value)) return "sports";
  if (/school|study|student|exam|university|class/.test(value)) return "study";
  if (/food|meal|budget|restaurant|coffee/.test(value)) return "food";
  if (/tech|ai|mobile|gaming|patch|app|phone/.test(value)) return "tech";
  if (/price|rent|wage|gold|loan|market|money/.test(value)) return "money";
  if (/weather|storm|rain|heat|typhoon/.test(value)) return "weather";
  if (/case|update|advisory|rule|visa|traffic/.test(value)) return "news";
  return "generic";
}

function createCopy({ topic, language, postType }) {
  const finalType = postType === "auto" ? (state.count % 2 === 0 ? "trend" : "hugot") : postType;
  const subject = finalType === "hugot" ? pick(HUGOT_TOPICS) : topic;

  if (finalType === "hugot") {
    const tagalog = [
      ["Crush mo siya, pero peace mo muna.", "Hindi lahat ng miss mo, kailangang balikan."],
      ["Seen ka na naman, pero okay ka pa rin.", "Minsan reply ang hinihintay, pero self-respect ang kailangan."],
      ["Kung hindi ka pinili, piliin mo sarili mo.", "Tahimik lang, pero lumalakas araw-araw."]
    ];
    const english = [
      ["Choose your peace first.", "Not every feeling deserves a second chance."],
      ["No reply is still a reply.", "Protect your focus. Protect your heart."],
      ["If they are unsure, be sure about yourself.", "Quiet growth is still growth."]
    ];
    const mix = [
      ["Crush mo siya, pero peace mo muna.", "Self-worth muna bago late-night overthink."],
      ["No reply? Focus ka muna.", "Hindi lahat ng silence kailangan habulin."],
      ["Kung hindi ka pinili, choose yourself.", "Main character ka rin sa sariling story mo."]
    ];
    const [title, subtitle] = pick(language === "english" ? english : language === "mix" ? mix : tagalog);
    return {
      finalType,
      subject,
      title,
      subtitle,
      label: "HUGOT CHECK",
      cta: pickCta(language, "hugot"),
      caption: buildCaption({ title, subtitle, topic: subject, language, finalType })
    };
  }

  const category = classify(subject, finalType);
  const titles = trendTitles({ subject, language, category });
  const subtitles = trendSubtitles({ language, category });
  const title = pick(titles[language] || titles.tagalog);
  const subtitle = pick(subtitles[language] || subtitles.tagalog);
  return {
    finalType,
    subject,
    title,
    subtitle,
    label: "TREND WATCH",
    cta: pickCta(language, category),
    caption: buildCaption({ title, subtitle, topic: subject, language, finalType })
  };
}

function pickCta(language, category) {
  const ctas = {
    tagalog: [
      "AGREE O PASS?",
      "COMMENT MO SIDE MO",
      "TAMA BA ITO?",
      "DROP YOUR REACTION",
      "SHARE MO KUNG RELATE",
      "SINO NAKAKITA NITO?",
      "MAY MAS MALINAW BA?",
      "REAL TALK?"
    ],
    english: [
      "AGREE OR PASS?",
      "DROP YOUR SIDE",
      "REAL OR HYPE?",
      "COMMENT YOUR REACTION",
      "SHARE IF RELATABLE",
      "WHO ELSE SAW THIS?",
      "ANY BETTER CONTEXT?",
      "WORTH WATCHING?"
    ],
    mix: [
      "AGREE O PASS?",
      "DROP YOUR SIDE",
      "REAL BA O HYPE?",
      "COMMENT YOUR REACTION",
      "SHARE IF RELATE",
      "SINO NAKAKITA NITO?",
      "MAY BETTER CONTEXT?",
      "WORTH IT BA?"
    ]
  };

  const categoryCtas = {
    weather: {
      tagalog: ["READY KA BA?", "CHECK ROUTE MUNA", "PAYONG CHECK"],
      english: ["READY TO GO?", "CHECK YOUR ROUTE", "RAIN PLAN READY?"],
      mix: ["READY KA BA?", "CHECK ROUTE MUNA", "RAIN PLAN READY?"]
    },
    sports: {
      tagalog: ["KANINO KA?", "SINO LAMANG?", "DROP PREDICTION"],
      english: ["WHO WINS?", "DROP PREDICTION", "WHO HAS THE EDGE?"],
      mix: ["KANINO KA?", "DROP PREDICTION", "WHO HAS EDGE?"]
    },
    hugot: {
      tagalog: ["RELATE KA BA?", "TAG MO NA", "SAKIT O LESSON?"],
      english: ["RELATE OR NO?", "TAG SOMEONE", "PAIN OR LESSON?"],
      mix: ["RELATE KA BA?", "TAG SOMEONE", "SAKIT OR LESSON?"]
    }
  };

  return pick([...(categoryCtas[category]?.[language] || []), ...(ctas[language] || ctas.tagalog)]);
}

function trendTitles({ subject, language, category }) {
  const pools = {
    tagalog: [
      `Trend check: ${subject}`,
      `${subject}: hype ba o legit?`,
      `Kung nakita mo ito sa feed, eto ang tanong`,
      `May update sa ${subject}`,
      `Usapang ${subject}: saan ka dito?`,
      `Biglang nasa feed: ${subject}`,
      `Hindi lang scroll moment: ${subject}`,
      `Ito ang topic today: ${subject}`,
      `${subject}: dapat bang bantayan?`,
      `Quick take tungkol sa ${subject}`,
      `May angle dito na hindi dapat palampasin`,
      `Feed check: ${subject}`
    ],
    english: [
      `Trend check: ${subject}`,
      `${subject}: hype or real?`,
      `This is showing up everywhere`,
      `${subject} update`,
      `Quick take on ${subject}`,
      `Why ${subject} is on the feed`,
      `Not just another scroll: ${subject}`,
      `Today's topic: ${subject}`,
      `${subject}: worth watching?`,
      `Your take on ${subject}?`,
      `One angle people may miss`,
      `Feed check: ${subject}`
    ],
    mix: [
      `Trend check: ${subject}`,
      `${subject}: hype ba or real?`,
      `Biglang nasa feed: ${subject}`,
      `Quick take on ${subject}`,
      `Ito yung topic today: ${subject}`,
      `${subject}: worth watching ba?`,
      `Not just scroll content: ${subject}`,
      `Usapang ${subject}: saan ka dito?`,
      `May update sa ${subject}`,
      `Feed check: ${subject}`,
      `One angle na madaling ma-miss`,
      `${subject}: agree ka ba?`
    ]
  };

  const categoryLines = {
    weather: {
      tagalog: [`Weather check: maghanda bago umalis`, `Rain plan muna bago lakad`, `Kung lalabas ka today, check this`],
      english: [`Weather check before you go`, `Plan your day before the rain hits`, `Going out today? Check this`],
      mix: [`Weather check muna bago lakad`, `Rain plan muna before going out`, `Kung lalabas ka today, check this`]
    },
    sports: {
      tagalog: [`Game talk: sino ang lamang?`, `Sports feed check: ${subject}`, `Mainit ang usapan sa laro`],
      english: [`Game talk: who has the edge?`, `Sports feed check: ${subject}`, `The matchup people are watching`],
      mix: [`Game talk: sino lamang?`, `Sports feed check: ${subject}`, `Matchup na pinag-aabangan`]
    },
    money: {
      tagalog: [`Budget check: may epekto ba sa'yo?`, `Money talk: ${subject}`, `Practical check bago gumastos`],
      english: [`Budget check: does this affect you?`, `Money talk: ${subject}`, `A practical note before spending`],
      mix: [`Budget check: affected ka ba?`, `Money talk: ${subject}`, `Practical check before gastos`]
    },
    tech: {
      tagalog: [`Tech update: useful ba o hype lang?`, `App/device check: ${subject}`, `Digital trend na dapat silipin`],
      english: [`Tech update: useful or hype?`, `Device/app check: ${subject}`, `A digital trend worth checking`],
      mix: [`Tech update: useful ba or hype?`, `App/device check: ${subject}`, `Digital trend worth checking`]
    },
    food: {
      tagalog: [`Food check: sulit ba ito?`, `Budget meal angle: ${subject}`, `Craving or practical choice?`],
      english: [`Food check: worth it?`, `Budget meal angle: ${subject}`, `Craving or practical choice?`],
      mix: [`Food check: sulit ba?`, `Budget meal angle: ${subject}`, `Craving or practical choice?`]
    }
  };

  const extra = categoryLines[category]?.[language] || [];
  return {
    tagalog: [...extra, ...pools.tagalog],
    english: [...extra, ...pools.english],
    mix: [...extra, ...pools.mix]
  };
}

function trendSubtitles({ language, category }) {
  const base = {
    tagalog: [
      "Hindi kailangan mahaba, basta malinaw ang take.",
      "Basahin, isipin, tapos comment kung agree ka.",
      "May side ka ba dito o wait-and-see muna?",
      "Kung nakita mo rin ito, hindi ka nag-iisa.",
      "Short update lang para hindi ka lost sa feed.",
      "Anong angle ang mas importante para sa'yo?",
      "Puwedeng maliit na topic, pero malaki ang reactions.",
      "Dito nagkakaiba ang opinion ng mga tao.",
      "Comment ka kung may mas malinaw kang context.",
      "Minsan isang topic lang, pero ang daming take."
    ],
    english: [
      "Quick note, clear take, then you decide.",
      "Read it, think about it, then drop your take.",
      "Are you picking a side or waiting for more?",
      "If this is on your feed too, you are not alone.",
      "A short update so you are not lost in the feed.",
      "Which angle matters most to you?",
      "Small topic, big reactions.",
      "This is where opinions split.",
      "Comment if you have better context.",
      "One topic can carry a lot of takes."
    ],
    mix: [
      "Quick note lang, then ikaw na bahala.",
      "Read it, think about it, then drop your take.",
      "May side ka ba or wait-and-see muna?",
      "Kung nasa feed mo rin ito, same tayo.",
      "Short update para hindi lost sa feed.",
      "Which angle matters most sa'yo?",
      "Small topic, pero big reactions.",
      "Dito usually naghahati ang opinions.",
      "Comment ka if may better context ka.",
      "One topic, pero ang daming take."
    ]
  };

  const byCategory = {
    weather: {
      tagalog: ["Check route, payong, at timing bago umalis.", "Mas okay nang prepared kaysa hassle sa daan."],
      english: ["Check your route, timing, and backup plan.", "Better prepared than stuck later."],
      mix: ["Check route, timing, and backup plan muna.", "Better prepared kaysa hassle later."]
    },
    sports: {
      tagalog: ["Stats may matter, pero puso pa rin ang usapan.", "Fans, ready na ba sa banter?"],
      english: ["Stats matter, but momentum changes fast.", "Fans, get the takes ready."],
      mix: ["Stats matter, pero momentum changes fast.", "Fans, ready na ba sa banter?"]
    },
    money: {
      tagalog: ["Kung may epekto sa budget, dapat pag-usapan.", "Small changes can hit daily spending."],
      english: ["If it affects the budget, it matters.", "Small changes can hit daily spending."],
      mix: ["If affected ang budget, dapat pag-usapan.", "Small changes can hit daily gastos."]
    },
    food: {
      tagalog: ["Kung sulit, share mo. Kung hindi, warn mo kami.", "Food finds hit harder kapag budget-friendly."],
      english: ["If it is worth it, share it. If not, warn us.", "Food finds hit harder when they are budget-friendly."],
      mix: ["If sulit, share mo. If not, warn us.", "Food finds hit harder kapag budget-friendly."]
    }
  };

  return {
    tagalog: [...(byCategory[category]?.tagalog || []), ...base.tagalog],
    english: [...(byCategory[category]?.english || []), ...base.english],
    mix: [...(byCategory[category]?.mix || []), ...base.mix]
  };
}

function buildCaption({ title, subtitle, topic, language, finalType }) {
  const questions = {
    tagalog: [
      "Agree ka ba dito?",
      "Anong side mo?",
      "May mas malinaw ka bang context?",
      "Nakita mo rin ba ito sa feed?",
      "Real talk: hype lang ba o may point?",
      "Kung ikaw tatanungin, ano ang mas importante dito?"
    ],
    english: [
      "Do you agree with this?",
      "Which side are you on?",
      "Do you have better context?",
      "Did this show up on your feed too?",
      "Real talk: hype or valid?",
      "What matters most here?"
    ],
    mix: [
      "Agree ka ba dito?",
      "Which side ka?",
      "May better context ka ba?",
      "Nasa feed mo rin ba ito?",
      "Real talk: hype lang ba or valid?",
      "Ano yung mas importanteng angle dito?"
    ]
  };
  const question = pick(questions[language] || questions.tagalog);
  const tags = finalType === "hugot"
    ? "#HugotPH #RelateMuch #Pakemon #TeenHugot #SelfWorth"
    : "#TrendingPH #Pakemon #UsapangOnline #ViralUpdate #CommentYourTake";
  return `${title}\n\n${subtitle}\n\n${question}\n\n${tags}`;
}

function clearCanvas() {
  ctx.clearRect(0, 0, 1080, 1080);
}

function drawCoverImage(image) {
  const canvasRatio = 1;
  const imageRatio = image.width / image.height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  if (imageRatio > canvasRatio) {
    sw = image.height * canvasRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / canvasRatio;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 1080, 1080);
  ctx.fillStyle = "rgba(2, 6, 23, 0.34)";
  ctx.fillRect(0, 0, 1080, 1080);
  const shade = ctx.createLinearGradient(0, 0, 0, 1080);
  shade.addColorStop(0, "rgba(15, 23, 42, 0.05)");
  shade.addColorStop(0.58, "rgba(15, 23, 42, 0.22)");
  shade.addColorStop(1, "rgba(15, 23, 42, 0.52)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 1080, 1080);
}

async function background(category, imageUrl = "") {
  if (imageUrl) {
    try {
      const proxied = `/api/image?url=${encodeURIComponent(imageUrl)}`;
      drawCoverImage(await loadImage(proxied));
      return true;
    } catch {
      // Fall back to local graphic background if Google image is unavailable.
    }
  }

  const colors = PALETTES[category] || PALETTES.generic;
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.55, colors[1]);
  grad.addColorStop(1, colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 12; i += 1) {
    const x = (i * 137 + state.count * 29) % 1180 - 80;
    const y = (i * 251 + state.count * 41) % 1180 - 80;
    ctx.fillStyle = i % 2 ? "#ffffff" : "#000000";
    ctx.beginPath();
    ctx.arc(x, y, 70 + (i % 5) * 28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (category === "sports") drawSportsMarks();
  if (category === "study" || category === "hugot") drawNotebookMarks();
  if (category === "weather") drawWeatherMarks();
  if (category === "tech") drawTechMarks();
  if (category === "money") drawMoneyMarks();
  return false;
}

function drawSportsMarks() {
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(850, 250, 130, 0, Math.PI * 2);
  ctx.moveTo(720, 250);
  ctx.lineTo(980, 250);
  ctx.moveTo(850, 120);
  ctx.lineTo(850, 380);
  ctx.stroke();
}

function drawNotebookMarks() {
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 5;
  for (let y = 150; y < 900; y += 58) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(980, y + 18);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(760, 150, 180, 210);
  ctx.clearRect(780, 175, 140, 22);
  ctx.clearRect(780, 225, 110, 22);
}

function drawWeatherMarks() {
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(180, 190, 75, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(180 + Math.cos(angle) * 105, 190 + Math.sin(angle) * 105);
    ctx.lineTo(180 + Math.cos(angle) * 150, 190 + Math.sin(angle) * 150);
    ctx.stroke();
  }
}

function drawTechMarks() {
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 4;
  for (let x = 120; x < 1000; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 90);
    ctx.lineTo(x + 180, 910);
    ctx.stroke();
  }
}

function drawMoneyMarks() {
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  for (let i = 0; i < 7; i += 1) {
    ctx.fillRect(90 + i * 130, 120 + (i % 3) * 52, 90, 48);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  visible.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return visible.length;
}

async function renderPost(copy, category, imageUrl = "") {
  clearCanvas();
  const usedImage = await background(category, imageUrl);

  ctx.fillStyle = "rgba(15,23,42,0.56)";
  roundRect(70, 560, 940, 360, 34);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(80, 62, 330, 74, 28);
  ctx.fill();

  if (uploadedLogo) {
    ctx.save();
    roundRect(102, 78, 44, 44, 10);
    ctx.clip();
    ctx.drawImage(uploadedLogo, 102, 78, 44, 44);
    ctx.restore();
  } else {
    ctx.fillStyle = "#0f8375";
    roundRect(102, 78, 44, 44, 10);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 21px Arial";
    ctx.fillText("PK", 111, 108);
  }
  ctx.fillStyle = "#0f172a";
  ctx.font = "900 25px Arial";
  ctx.fillText("Pakemon", 164, 101);
  ctx.fillStyle = "#64748b";
  ctx.font = "700 16px Arial";
  ctx.fillText(usedImage ? "Google Trends image" : "Local trend-ready post", 164, 123);

  ctx.fillStyle = "#ff7a1a";
  roundRect(100, 592, 315, 50, 24);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 20px Arial";
  ctx.fillText(copy.label, 128, 625);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 64px Arial";
  const titleLines = wrapText(copy.title, 100, 710, 840, 72, 3);
  ctx.font = "900 29px Arial";
  wrapText(copy.subtitle, 104, 735 + titleLines * 72, 780, 36, 3);

  ctx.fillStyle = "rgba(255,255,255,0.93)";
  roundRect(100, 955, 880, 56, 28);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.font = "900 22px Arial";
  wrapText(copy.subject, 132, 991, 520, 28, 1);
  ctx.fillStyle = "#0f8375";
  ctx.font = "900 20px Arial";
  ctx.textAlign = "right";
  ctx.fillText(copy.cta, 940, 991);
  ctx.textAlign = "left";
}

async function postToFacebook() {
  const keys = facebookPayload();
  if (!keys.pageId || !keys.token) {
    throw new Error("Missing Facebook Page ID or Page token.");
  }

  const response = await fetch("/api/facebook/photo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...keys,
      caption: els.caption.value,
      imageDataUrl: els.canvas.toDataURL("image/png")
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Facebook post failed");
  return data;
}

async function generate() {
  els.generate.disabled = true;
  let postedOk = false;
  try {
    setStatus("Finding Google Trends topic and image...");
    const requestedPostType = selectedValue("postType");
    const postType = requestedPostType === "auto" ? (state.count % 2 === 0 ? "trend" : "hugot") : requestedPostType;
    const language = selectedValue("language");
    const trend = postType === "hugot" ? null : await pickTrend();
    const topic = postType === "hugot" ? pick(HUGOT_TOPICS) : trend.title;
    const copy = createCopy({ topic, language, postType });
    const category = classify(copy.subject, copy.finalType);

    state.count += 1;
    state.current = { copy, category, trend, createdAt: new Date() };
    await renderPost(copy, category, trend?.picture || "");
    els.caption.value = copy.caption;
    els.meta.textContent = `${copy.finalType.toUpperCase()} | ${category} | ${trend?.pictureSource || "local"} | ${state.current.createdAt.toLocaleString()}`;
    const liveMode = selectedValue("postMode") === "live";
    setStatus(liveMode ? "Generated with Google Trends image. Posting to Facebook..." : `Smoke test generated. ${els.autoRun.checked ? "Next smoke test will continue on schedule." : "No Facebook post was made."}`);
    postedOk = !liveMode;

    if (liveMode) {
      const posted = await postToFacebook();
      setStatus(`Posted to Facebook. ID: ${posted.postId || posted.id || "ok"}`);
      postedOk = true;
    } else {
      setStatus("Smoke test ready. No Facebook token used and no post was made.");
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    els.generate.disabled = false;
  }

  if (els.autoRun.checked && postedOk) scheduleNext();
}

function scheduleNext() {
  clearTimeout(state.timer);
  const minutes = Number(els.interval.value) || 5;
  const next = new Date(Date.now() + minutes * 60_000);
  const mode = selectedValue("postMode") === "live" ? "post" : "smoke test";
  setStatus(`Auto ${mode} ON. Next ${mode}: ${next.toLocaleString()}`);
  state.timer = setTimeout(generate, minutes * 60_000);
}

function stopAuto() {
  clearTimeout(state.timer);
  state.timer = null;
  els.autoRun.checked = false;
  setStatus("Stopped. Auto posting is OFF.");
}

els.generate.addEventListener("click", generate);
els.stop.addEventListener("click", stopAuto);
els.saveFacebook.addEventListener("click", saveFacebookKeys);
els.logoUpload.addEventListener("change", () => saveUploadedLogo(els.logoUpload.files?.[0]));
els.clearLogo.addEventListener("click", clearLogo);
els.interval.addEventListener("input", () => {
  els.intervalLabel.textContent = els.interval.value;
});
els.autoRun.addEventListener("change", () => {
  if (!els.autoRun.checked) {
    clearTimeout(state.timer);
    setStatus("Auto mode OFF.");
  } else {
    setStatus("Auto mode ready. Click Start Auto Posting once.");
  }
});

async function init() {
  loadFacebookKeys();
  await loadSavedLogo();
  setStatus("Ready. Smoke test is selected. Click Start Auto Posting once.");
}

init();
