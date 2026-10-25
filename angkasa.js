const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);

/* BINTANG-BINTANG DI LUAR ANGKASA */

const starGeometry = new THREE.BufferGeometry();
const starCount = 800;

const starPositions = [];

for (let i = 0; i < starCount; i++) {
  const x = (Math.random() - 0.5) * 400;
  const y = (Math.random() - 0.5) * 250;
  const z = (Math.random() - 0.5) * 400;

  starPositions.push(x, y, z);
}

starGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(starPositions, 3)
);

const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.7,
  sizeAttenuation: true
});

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 65, 100);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById("scene").appendChild(renderer.domElement);

// Kontrol kamera
const controls = new THREE.OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.enablePan = true;
controls.minDistance = 5;
controls.maxDistance = 150; // dinaikkan: posisi awal kamera jaraknya ~119

// Cahaya
// Atur dua angka ini kalau mau lebih terang / lebih gelap
const AMBIENT_INTENSITY = 0.35; // cahaya dasar (sisi planet yang membelakangi Matahari)
const SUN_INTENSITY = 2.2;      // cahaya dari Matahari

scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY));

const sunlight = new THREE.PointLight(0xffffff, SUN_INTENSITY);
scene.add(sunlight);

// Matahari
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(2.5, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffaa00 })
);
scene.add(sun);

sun.userData.name = "Matahari";

// Data planet: nama, ukuran, jarak, warna, kecepatan
const planetData = [
  ["Merkurius", 0.35, 4, 0xaaaaaa, 0.025],
  ["Venus",     0.6,  6, 0xffcc88, 0.018],
  ["Bumi",      0.65, 8, 0x2277ff, 0.014],
  ["Mars",      0.48, 10, 0xff5533, 0.011],
  ["Jupiter",   1.3, 13, 0xffbb88, 0.008],
  ["Saturnus",  1.1, 16, 0xe6d2a0, 0.006],
  ["Uranus",    0.8, 19, 0x88eeff, 0.004],
  ["Neptunus",  0.8, 22, 0x3355ff, 0.003]
];

const planets = [];

/* TEKSTUR PLANET
   Tekstur dibuat sendiri lewat canvas (procedural), jadi tidak butuh
   file gambar, tidak bisa 404, dan jalan juga kalau index.html dibuka
   langsung dari folder (file://). */

function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 144665);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

// Value noise yang menyambung di sisi kiri-kanan (supaya tidak ada garis sambungan)
function valueNoise(x, y, seed, period) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const wrap = (v) => ((v % period) + period) % period;
  const x0 = wrap(xi);
  const x1 = wrap(xi + 1);

  const a = hash2(x0, yi, seed);
  const b = hash2(x1, yi, seed);
  const c = hash2(x0, yi + 1, seed);
  const d = hash2(x1, yi + 1, seed);

  const u = smoothstep(xf);
  const v = smoothstep(yf);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Beberapa lapisan noise ditumpuk: makin banyak octave, makin detail
function fbm(u, v, seed, baseFreq, octaves) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = baseFreq;

  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(u * freq * 2, v * freq, seed + o * 17, freq * 2);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }

  return sum / norm;
}

function mixColor(c1, c2, t) {
  t = Math.max(0, Math.min(1, t));
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t
  ];
}

// Tiap fungsi menerima (u, v) dari 0..1 dan mengembalikan warna [r, g, b]
const planetStyles = {
  Matahari: (u, v) => {
    const n = fbm(u, v, 21, 6, 5);
    return mixColor([255, 120, 0], [255, 235, 140], n * 1.4 - 0.2);
  },

  Merkurius: (u, v) => {
    const n = fbm(u, v, 1, 4, 6);
    const crater = fbm(u, v, 2, 12, 3);
    let k = 0.3 + n * 0.6;
    if (crater > 0.65) k *= 0.75;
    return [k * 200, k * 190, k * 180];
  },

  Venus: (u, v) => {
    const warp = fbm(u, v, 3, 3, 3);
    const n = fbm(u + warp * 0.25, v, 4, 3, 5);
    return mixColor([190, 135, 70], [250, 220, 150], n * 1.5 - 0.25);
  },

  Bumi: (u, v) => {
    const h = fbm(u, v, 5, 3, 6);
    let col;

    if (h < 0.52) {
      col = mixColor([12, 50, 135], [35, 105, 185], (h - 0.3) * 3); // laut
    } else {
      col = mixColor([50, 125, 55], [150, 125, 75], (h - 0.52) * 4); // daratan
    }

    const lat = Math.abs(v - 0.5) * 2;
    col = mixColor(col, [245, 248, 255], (lat - 0.9) * 10);          // es di kutub

    const cloud = fbm(u, v, 9, 4, 5);
    return mixColor(col, [255, 255, 255], (cloud - 0.58) * 3);       // awan
  },

  Mars: (u, v) => {
    const n = fbm(u, v, 7, 4, 5);
    let col = mixColor([140, 55, 28], [215, 125, 72], n * 1.5 - 0.2);

    const dark = fbm(u, v, 8, 3, 4);
    col = mixColor(col, [80, 35, 25], (dark - 0.6) * 3);

    const lat = Math.abs(v - 0.5) * 2;
    return mixColor(col, [245, 240, 235], (lat - 0.93) * 20);
  },

  Jupiter: (u, v) => {
    const warp = fbm(u, v, 11, 3, 4);
    const band = 0.5 + 0.5 * Math.sin(v * Math.PI * 14 + warp * 6);
    let col = mixColor([160, 105, 70], [238, 218, 188], band);

    // Bintik Merah Besar
    const du = (u - 0.3) / 0.07;
    const dv = (v - 0.64) / 0.045;
    const d = du * du + dv * dv;
    if (d < 1) col = mixColor(col, [185, 75, 50], 1 - d);

    return col;
  },

  Saturnus: (u, v) => {
    const warp = fbm(u, v, 13, 3, 3);
    const band = 0.5 + 0.5 * Math.sin(v * Math.PI * 10 + warp * 3);
    return mixColor([195, 170, 120], [238, 224, 178], band);
  },

  Uranus: (u, v) => {
    const band = 0.5 + 0.5 * Math.sin(v * Math.PI * 6);
    const n = fbm(u, v, 15, 3, 3);
    return mixColor([135, 215, 222], [165, 232, 236], band * 0.6 + n * 0.4);
  },

  Neptunus: (u, v) => {
    const n = fbm(u, v, 17, 4, 5);
    const band = 0.5 + 0.5 * Math.sin(v * Math.PI * 8 + n * 4);
    let col = mixColor([35, 65, 200], [70, 110, 235], band);
    return mixColor(col, [170, 200, 255], (n - 0.62) * 3);
  },

  Bulan: (u, v) => {
    const n = fbm(u, v, 31, 5, 6);
    const crater = fbm(u, v, 32, 14, 3);
    let k = 0.45 + n * 0.5;
    if (crater > 0.64) k *= 0.78;
    return [k * 190, k * 190, k * 190];
  }
};

function makeProceduralTexture(name) {
  const style = planetStyles[name];
  if (!style) return null;

  const W = 512;
  const H = 256;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = style(x / W, y / H);
      const i = (y * W + x) * 4;

      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

// Tekstur Matahari
sun.material.map = makeProceduralTexture("Matahari");
sun.material.color.set(0xffffff);
sun.material.needsUpdate = true;

/* CAHAYA (GLOW) MATAHARI */

function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );

  gradient.addColorStop(0, "rgba(255, 200, 90, 1)");
  gradient.addColorStop(0.25, "rgba(255, 150, 40, 0.55)");
  gradient.addColorStop(0.6, "rgba(255, 100, 20, 0.12)");
  gradient.addColorStop(1, "rgba(255, 80, 0, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

const GLOW_SIZE = 14;

const sunGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  })
);
sunGlow.scale.set(GLOW_SIZE, GLOW_SIZE, 1);
sunGlow.raycast = () => {}; // supaya glow tidak menghalangi klik planet
scene.add(sunGlow);

/* OPSIONAL: PAKAI FOTO TEKSTUR ASLI
   1. Download gambar tekstur planet (mis. dari solarsystemscope.com/textures)
   2. Taruh di folder "textures" di sebelah index.html
   3. Ubah USE_REAL_TEXTURES jadi true
   4. Buka lewat server lokal (mis. ekstensi Live Server di VS Code),
      karena browser memblokir gambar kalau halaman dibuka lewat file://
   Kalau gambarnya gagal dimuat, planet tetap pakai tekstur procedural. */

const USE_REAL_TEXTURES = false;
const textureLoader = new THREE.TextureLoader();

const realTextures = {
  Merkurius: "textures/mercury.jpg",
  Venus: "textures/venus.jpg",
  Bumi: "textures/earth.jpg",
  Mars: "textures/mars.jpg",
  Jupiter: "textures/jupiter.jpg",
  Saturnus: "textures/saturn.jpg",
  Uranus: "textures/uranus.jpg",
  Neptunus: "textures/neptune.jpg"
};

planetData.forEach((data, index) => {
  const [name, size, distance, color, speed] = data;

  // Tekstur procedural langsung terpasang (anti-gagal)
  const material = new THREE.MeshStandardMaterial({
    map: makeProceduralTexture(name),
    color: 0xffffff
  });

  // Kalau opsi foto asli dinyalakan, timpa dengan foto saat berhasil dimuat
  if (USE_REAL_TEXTURES && realTextures[name]) {
    textureLoader.load(
      realTextures[name],
      (texture) => {
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        console.warn("Foto tekstur " + name + " gagal dimuat, pakai tekstur procedural.");
      }
    );
  }

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(size, 64, 64),
    material
  );

  planet.userData.name = name;
  scene.add(planet);

  // Orbit
  const orbit = new THREE.Mesh(
    new THREE.RingGeometry(distance - 0.025, distance + 0.025, 128),
    new THREE.MeshBasicMaterial({
      color: 0x666666,
      side: THREE.DoubleSide
    })
  );

  orbit.rotation.x = Math.PI / 2;
  scene.add(orbit);

  // Cincin Saturnus
  let ring = null;

  if (name === "Saturnus") {
    ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 2, 64),
      new THREE.MeshBasicMaterial({
        color: 0xd9c39b,
        side: THREE.DoubleSide
      })
    );

    ring.rotation.x = Math.PI / 2.5; // kemiringan tetap, tidak ikut berputar
    ring.userData.name = name;
    scene.add(ring);
  }

  planets.push({
    name: name,
    mesh: planet,
    distance: distance,
    angle: index * 0.8,
    speed: speed,
    size: size,
    ring: ring
  });
});

/* BULAN BUMI */

const earth = planets.find((p) => p.name === "Bumi");

const moon = new THREE.Mesh(
  new THREE.SphereGeometry(0.18, 32, 32),
  new THREE.MeshStandardMaterial({ map: makeProceduralTexture("Bulan") })
);
scene.add(moon);

let moonAngle = 0;
const MOON_DISTANCE = 1.2;

/* SABUK ASTEROID (di antara Mars dan Jupiter) */

const beltPositions = [];
const BELT_COUNT = 700;

for (let i = 0; i < BELT_COUNT; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 11 + Math.random() * 1.3;   // Mars = 10, Jupiter = 13
  const height = (Math.random() - 0.5) * 0.4;

  beltPositions.push(
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius
  );
}

const beltGeometry = new THREE.BufferGeometry();
beltGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(beltPositions, 3)
);

const asteroidBelt = new THREE.Points(
  beltGeometry,
  new THREE.PointsMaterial({
    color: 0xb09a80,
    size: 0.12,
    sizeAttenuation: true
  })
);
scene.add(asteroidBelt);

/* STATE KAMERA
   PENTING: semua variabel ini harus dideklarasikan SEBELUM animate()
   dipanggil. Kalau di bawahnya, `let` masih "belum diinisialisasi"
   dan animate() langsung error (layar hitam, intro nggak hilang). */

const introStartTime = Date.now();
let introActive = true;

let paused = false;   // tombol Jeda
let timeScale = 1;    // slider kecepatan

let moveProgress = 1;          // 1 = kamera tidak sedang pindah
let focusedPlanet = null;      // planet yang sedang diikuti kamera

const cameraStart = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const lookStart = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const lastFocusPos = new THREE.Vector3();
const delta = new THREE.Vector3();

// Posisi kamera relatif terhadap planet yang difokuskan
const FOCUS_OFFSET = new THREE.Vector3(3, 2, 5);

// Animasi
function animate() {
  requestAnimationFrame(animate);

  // dt = 0 saat dijeda, selain itu mengikuti slider kecepatan
  const dt = paused ? 0 : timeScale;

  // Glow Matahari berdenyut pelan
  sunGlow.scale.setScalar(GLOW_SIZE + Math.sin(Date.now() * 0.002) * 0.6);

  // Kamera cinematic saat intro
  if (introActive) {
    const elapsed = (Date.now() - introStartTime) / 1000;

    if (elapsed < 5) {
      const progress = Math.min(elapsed / 5, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      camera.position.set(0, 65 - 40 * ease, 100 - 58 * ease);
      camera.lookAt(0, 0, 0);
    } else {
      introActive = false;
    }
  }

  sun.rotation.y += 0.003 * dt;
  stars.rotation.y += 0.0001 * dt;

  planets.forEach((p) => {
    p.angle += p.speed * dt;

    p.mesh.position.x = Math.cos(p.angle) * p.distance;
    p.mesh.position.z = Math.sin(p.angle) * p.distance;

    p.mesh.rotation.y += 0.01 * dt;

    // Cincin mengikuti posisi planet
    if (p.ring) p.ring.position.copy(p.mesh.position);
  });

  // Bulan mengorbit Bumi
  moonAngle += 0.04 * dt;
  moon.position.set(
    earth.mesh.position.x + Math.cos(moonAngle) * MOON_DISTANCE,
    earth.mesh.position.y + 0.1,
    earth.mesh.position.z + Math.sin(moonAngle) * MOON_DISTANCE
  );

  // Sabuk asteroid berputar pelan
  asteroidBelt.rotation.y += 0.0008 * dt;

  // Karena planet terus bergerak, target kamera harus dihitung ulang
  if (focusedPlanet) {
    const pos = focusedPlanet.mesh.position;

    if (moveProgress < 1) {
      // Lagi pindah: tujuan mengikuti posisi planet terbaru
      cameraTarget.copy(pos).add(FOCUS_OFFSET);
      lookTarget.copy(pos);
    } else {
      // Sudah sampai: geser kamera + titik fokus bareng planet,
      // jadi planet tetap di tengah dan kamu masih bisa muter/zoom
      delta.subVectors(pos, lastFocusPos);
      camera.position.add(delta);
      controls.target.add(delta);
    }

    lastFocusPos.copy(pos);
  }

  // ANIMASI KAMERA MENUJU PLANET
  if (moveProgress < 1) {
    moveProgress = Math.min(moveProgress + 0.015, 1);

    const t = moveProgress;
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    camera.position.lerpVectors(cameraStart, cameraTarget, eased);
    controls.target.lerpVectors(lookStart, lookTarget, eased);
    camera.lookAt(controls.target);

    if (moveProgress >= 1) {
      controls.enabled = true;
    }
  }

  controls.update();
  updateLabels();
  renderer.render(scene, camera);
}

// Responsif
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* INTRO SELESAI OTOMATIS */

const introScreen = document.getElementById("intro-screen");

if (introScreen) {
  setTimeout(() => {
    introScreen.classList.add("intro-hidden");
  }, 5500);

  setTimeout(() => {
    introScreen.style.display = "none";
  }, 7200);
}

/* PLANET EXPLORER - dipanggil dari tombol di HTML (onclick) */

function focusPlanet(name) {
  if (name === "Matahari") {
    focusedPlanet = null;
    cameraTarget.set(0, 25, 42);
    lookTarget.set(0, 0, 0);
  } else {
    const planet = planets.find((p) => p.name === name);
    if (!planet) return;

    focusedPlanet = planet;
    lastFocusPos.copy(planet.mesh.position);
  }

  introActive = false; // hentikan kamera intro kalau masih jalan

  showInfo(name);
  setActiveButton(name);

  cameraStart.copy(camera.position);
  lookStart.copy(controls.target);

  moveProgress = 0;
  controls.enabled = false;
}


/* DATA INFO PLANET */

const planetInfo = {
  Matahari: {
    tipe: "Bintang",
    diameter: "±1.392.700 km",
    jarak: "Pusat tata surya",
    orbit: "±230 juta tahun mengelilingi pusat galaksi",
    fakta: "Matahari menampung sekitar 99,86% dari seluruh massa tata surya. Suhu permukaannya sekitar 5.500 °C."
  },
  Merkurius: {
    tipe: "Planet kebumian",
    diameter: "4.879 km",
    jarak: "±58 juta km",
    orbit: "88 hari",
    fakta: "Planet terkecil sekaligus terdekat dengan Matahari. Merkurius tidak punya satelit alami."
  },
  Venus: {
    tipe: "Planet kebumian",
    diameter: "12.104 km",
    jarak: "±108 juta km",
    orbit: "225 hari",
    fakta: "Planet terpanas, sekitar 465 °C, karena efek rumah kaca yang ekstrem. Venus juga berotasi berlawanan arah dengan kebanyakan planet."
  },
  Bumi: {
    tipe: "Planet kebumian",
    diameter: "12.742 km",
    jarak: "±150 juta km",
    orbit: "365,25 hari",
    fakta: "Satu-satunya planet yang diketahui punya kehidupan. Sekitar 71% permukaannya tertutup air, dan Bumi punya satu satelit alami, yaitu Bulan."
  },
  Mars: {
    tipe: "Planet kebumian",
    diameter: "6.779 km",
    jarak: "±228 juta km",
    orbit: "687 hari",
    fakta: "Punya dua bulan kecil, Phobos dan Deimos. Olympus Mons di Mars adalah gunung berapi tertinggi di tata surya, sekitar 22 km."
  },
  Jupiter: {
    tipe: "Raksasa gas",
    diameter: "139.820 km",
    jarak: "±778 juta km",
    orbit: "±11,9 tahun",
    fakta: "Planet terbesar di tata surya. Bintik Merah Besar adalah badai raksasa yang sudah berlangsung ratusan tahun."
  },
  Saturnus: {
    tipe: "Raksasa gas",
    diameter: "116.460 km",
    jarak: "±1,43 miliar km",
    orbit: "±29,4 tahun",
    fakta: "Terkenal dengan cincinnya yang tersusun dari es dan batuan. Kepadatan rata-ratanya lebih rendah dari air."
  },
  Uranus: {
    tipe: "Raksasa es",
    diameter: "50.724 km",
    jarak: "±2,87 miliar km",
    orbit: "±84 tahun",
    fakta: "Sumbu rotasinya miring sekitar 98°, jadi Uranus seperti berputar sambil menggelinding di orbitnya."
  },
  Neptunus: {
    tipe: "Raksasa es",
    diameter: "49.244 km",
    jarak: "±4,5 miliar km",
    orbit: "±165 tahun",
    fakta: "Planet terjauh dari Matahari. Angin di Neptunus termasuk yang tercepat di tata surya, sampai sekitar 2.000 km/jam."
  }
};

/* KARTU INFO */

const infoCard = document.getElementById("info-card");

// true = garis & judul kartu info ganti warna sesuai planet; false = tetap putih
const COLORFUL_ACCENT = false;

// Warna aksen kartu info untuk tiap planet
const planetAccent = {
  Matahari: "#ffb020",
  Merkurius: "#b5b5b5",
  Venus: "#e8c28a",
  Bumi: "#3a8cff",
  Mars: "#e0603a",
  Jupiter: "#d9a273",
  Saturnus: "#e6d2a0",
  Uranus: "#8ee8ee",
  Neptunus: "#4a6cff"
};

// Tandai tombol planet yang sedang difokuskan
function setActiveButton(name) {
  document.querySelectorAll("#planet-panel button").forEach((b) => {
    b.classList.toggle("active", b.dataset.planet === name);
  });
}

function showInfo(name) {
  const info = planetInfo[name];
  if (!info || !infoCard) return;

  document.getElementById("info-type").textContent = info.tipe;
  document.getElementById("info-name").textContent = name;
  document.getElementById("info-diameter").textContent = info.diameter;
  document.getElementById("info-distance").textContent = info.jarak;
  document.getElementById("info-orbit").textContent = info.orbit;
  document.getElementById("info-fact").textContent = info.fakta;

  infoCard.style.setProperty(
    "--accent",
    COLORFUL_ACCENT ? (planetAccent[name] || "#ffffff") : "#ffffff"
  );
  infoCard.classList.remove("info-hidden");
}

function hideInfo() {
  if (infoCard) infoCard.classList.add("info-hidden");
}

const infoClose = document.getElementById("info-close");
if (infoClose) infoClose.addEventListener("click", hideInfo);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideInfo();
});

/* KLIK PLANET DI LAYAR (raycaster) */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickable = [
  sun,
  ...planets.map((p) => p.mesh),
  ...planets.filter((p) => p.ring).map((p) => p.ring)
];

function pickBody(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  // recursive = true supaya cincin Saturnus (anak dari mesh) ikut terdeteksi
  const hits = raycaster.intersectObjects(clickable, true);
  if (!hits.length) return null;

  let obj = hits[0].object;
  while (obj && !obj.userData.name) obj = obj.parent;

  return obj ? obj.userData.name : null;
}

// Bedakan "klik" dari "seret kamera": kalau geser > 5px, dianggap seret
let downX = 0;
let downY = 0;

renderer.domElement.addEventListener("pointerdown", (e) => {
  downX = e.clientX;
  downY = e.clientY;
});

renderer.domElement.addEventListener("pointerup", (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;

  const name = pickBody(e);
  if (name) focusPlanet(name);
});

// Kursor berubah jadi tangan saat di atas planet (desktop)
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  renderer.domElement.style.cursor = pickBody(e) ? "pointer" : "grab";
});

/* LABEL NAMA PLANET (elemen HTML yang mengikuti posisi planet di layar) */

const labelLayer = document.createElement("div");
labelLayer.id = "label-layer";
document.body.appendChild(labelLayer);

const labels = [];
const labelPos = new THREE.Vector3();

function addLabel(text, target, offsetY) {
  const el = document.createElement("div");
  el.className = "planet-label";
  el.textContent = text;
  labelLayer.appendChild(el);

  labels.push({ el: el, target: target, offsetY: offsetY });
}

addLabel("Matahari", sun, 3.2);
planets.forEach((p) => addLabel(p.name, p.mesh, p.size + 0.5));

function updateLabels() {
  camera.updateMatrixWorld();

  const w = window.innerWidth;
  const h = window.innerHeight;

  labels.forEach((l) => {
    l.target.getWorldPosition(labelPos);
    labelPos.y += l.offsetY;
    labelPos.project(camera);

    // Sembunyikan kalau di belakang kamera atau di luar layar
    const onScreen =
      labelPos.z < 1 &&
      Math.abs(labelPos.x) < 1.05 &&
      Math.abs(labelPos.y) < 1.05;

    if (!onScreen) {
      l.el.style.display = "none";
      return;
    }

    const x = (labelPos.x * 0.5 + 0.5) * w;
    const y = (-labelPos.y * 0.5 + 0.5) * h;

    l.el.style.display = "block";
    l.el.style.transform =
      "translate(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px) translate(-50%, -100%)";
  });
}

const labelToggle = document.getElementById("label-toggle");

if (labelToggle) {
  labelToggle.addEventListener("change", () => {
    labelLayer.style.display = labelToggle.checked ? "block" : "none";
  });
}

/* KONTROL WAKTU: JEDA + KECEPATAN */

const pauseBtn = document.getElementById("pause-btn");
const speedRange = document.getElementById("speed-range");
const speedValue = document.getElementById("speed-value");

function togglePause() {
  paused = !paused;
  if (pauseBtn) pauseBtn.textContent = paused ? "▶ Lanjut" : "⏸ Jeda";
}

if (pauseBtn) pauseBtn.addEventListener("click", togglePause);

if (speedRange) {
  speedRange.addEventListener("input", () => {
    timeScale = parseFloat(speedRange.value);
    if (speedValue) speedValue.textContent = timeScale.toFixed(1) + "x";
  });
}

// Tombol P di keyboard = jeda / lanjut
window.addEventListener("keydown", (e) => {
  if (e.key === "p" || e.key === "P") togglePause();
});

// Mulai animasi paling akhir, setelah semua variabel dideklarasikan
animate();