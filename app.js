/* ═══════════════════════════════════════════
   TUMANHWAONLINE — Lógica del Portal con Supabase
   Sincronizado en tiempo real. Hosting en Netlify.
   ═══════════════════════════════════════════ */

// Captura de errores global para depuración en producción
window.onerror = function(message, source, lineno, colno, error) {
  try {
    var errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.backgroundColor = '#e74c3c';
    errorDiv.style.color = '#fff';
    errorDiv.style.padding = '15px';
    errorDiv.style.zIndex = '999999';
    errorDiv.style.textAlign = 'center';
    errorDiv.style.fontWeight = 'bold';
    errorDiv.style.fontFamily = 'sans-serif';
    errorDiv.innerHTML = '🚨 ERROR DE JAVASCRIPT: ' + message + ' (Línea: ' + lineno + ')<br><span style="font-size:11px;font-weight:normal;">' + (source || '') + '</span>';
    document.body.appendChild(errorDiv);
  } catch(e) {}
  return false;
};

// ── Credenciales de Supabase ──
const SUPABASE_URL = "https://uwentmslkkroivlajvsx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3ZW50bXNsa2tyb2l2bGFqdnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTAzOTIsImV4cCI6MjA5OTcyNjM5Mn0.H5DdP_FtbWuUF2t52PzHAHA76WNdpWwuqK0QTvBbUyg"; 
const IMGBB_API_KEY = "2f4ac135e5d35e1abbdcea881658f588"; 

// Inicializar cliente de Supabase de forma segura
let supabaseClient = null;
try {
  if (typeof window.supabase !== 'undefined' && SUPABASE_ANON_KEY !== "TU_SUPABASE_ANON_KEY") {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (err) {
  console.warn("No se pudo inicializar Supabase, trabajando en modo local:", err);
}

// ── Estado Global ──
const state = {
  catalog: [],
  currentUser: null,
  readChapters: {},
  library: {},
  history: [],
  comments: {},
  currentView: 'catalog',
  filterType: 'all',
  filterGenre: 'all',
  searchQuery: '',
  showNSFW: false,
  nsfwFilterType: 'all', // 'all', 'anime', 'manga', 'manhwa', 'novel'
  selectedManga: null,
  currentChapter: 1,
  readingMode: 'cascade',
  currentPageIndex: 1,
  totalPagesCount: 0,
  sortOrder: 'desc',
  libraryTab: 'all',
  sortBy: 'recent',
  statusFilter: 'all'
};

const ALL_GENRES = [
  "Acción", "Aventura", "Fantasía", "Romance", "Comedia", "Drama", 
  "Recuentos de la vida", "Ciencia Ficción", "Terror", "Misterio", 
  "Psicológico", "Sobrenatural", "Isekai", "Artes Marciales", "Magia", 
  "Escolar", "Tragedia", "Gore", "Mecha", "Deportes", "Histórico", "Música"
];

// ── Cuentas con permisos de Administrador ──
const ADMIN_EMAILS = [
  "brandonesau250@gmail.com",
  "brandonesau250@tumanhwaonline.com"
];
const ADMIN_USERNAMES = [
  "brandonesau250",
  "admin"
];

function isAdmin() {
  if (!state.currentUser) return false;
  return ADMIN_EMAILS.indexOf(state.currentUser.email.toLowerCase()) !== -1 ||
         ADMIN_USERNAMES.indexOf(state.currentUser.username.toLowerCase()) !== -1;
}

// ── Cargar datos del sistema ──
async function loadState() {
  try {
    try {
      state.currentUser = JSON.parse(localStorage.getItem('tm-user')) || null;
    } catch (e) {
      console.warn("Error cargando usuario local:", e);
      state.currentUser = null;
    }
    
    try {
      state.readChapters = JSON.parse(localStorage.getItem('tm-read')) || {};
    } catch (e) {
      console.warn("Error cargando capítulos leídos:", e);
      state.readChapters = {};
    }
    
    try {
      state.library = JSON.parse(localStorage.getItem('tm-library')) || {};
    } catch (e) {
      console.warn("Error cargando biblioteca local:", e);
      state.library = {};
    }
    
    try {
      state.history = JSON.parse(localStorage.getItem('tm-history')) || [];
    } catch (e) {
      console.warn("Error cargando historial local:", e);
      state.history = [];
    }

    // Si Supabase está configurado, cargamos en tiempo real con recuperación local en caso de error
    if (supabaseClient) {
      await syncWithSupabase();
    } else {
      loadLocalFallbackData();
    }
  } catch (e) {
    console.warn("Error inicializando estados:", e);
    loadLocalFallbackData();
  }
}

// Cargar desde almacenamiento local del navegador (Caché local/Offline)
function loadLocalFallbackData() {
  console.log("Cargando base de datos local (localStorage)...");
  
  try {
    state.comments = JSON.parse(localStorage.getItem('tm-comments')) || {};
  } catch (e) {
    console.warn("Error parseando comentarios locales, reseteando:", e);
    state.comments = {};
  }

  try {
    var savedCatalog = localStorage.getItem('tm-catalog');
    if (savedCatalog) {
      state.catalog = JSON.parse(savedCatalog);
    } else {
      state.catalog = [];
    }
    if (state.catalog.length === 0) {
      state.catalog = getDefaultSeedCatalog();
      saveState();
    }
  } catch (e) {
    console.warn("Error parseando catálogo local, reseteando:", e);
    state.catalog = [];
  }
  
  // Renderizar la interfaz para que todo funcione
  try {
    updateStats();
    renderFeatured();
    renderGenres();
    renderGrid();
    renderSidebarStats();
  } catch (err) {
    console.error("Error renderizando interfaz local:", err);
  }
}

// Sincronizar catálogo y vistas en tiempo real con Supabase
async function syncWithSupabase() {
  if (!supabaseClient) {
    loadLocalFallbackData();
    return;
  }
  try {
    // Intentar obtener el catálogo de Supabase
    let { data: dbCatalog, error: catError } = await supabaseClient
      .from('catalog')
      .select('*')
      .order('id', { ascending: false });

    if (catError) {
      throw catError;
    }

    // Adaptar nombres de campos de BD a JS (con respaldos seguros ante valores nulos)
    state.catalog = (dbCatalog || []).map(item => {
      return {
        id: item.id,
        title: item.title || "Sin título",
        type: item.type || "manga",
        author: item.author || "Anónimo",
        cover: item.cover || "",
        rating: parseFloat(item.rating || 5.0),
        chapters: parseInt(item.chapters || 0),
        chaptersData: item.chapters_data || {},
        status: item.status || "En emisión",
        views: parseInt(item.views || 0),
        genres: item.genres || [],
        description: item.description || "",
        year: item.year || new Date().getFullYear(),
        uploader: item.uploader || "Comunidad",
        lang: item.lang || "ES",
        nsfw: !!item.nsfw
      };
    });

    // Guardar copia local de respaldo
    localStorage.setItem('tm-catalog', JSON.stringify(state.catalog));

    updateStats();
    renderFeatured();
    renderGenres();
    renderGrid();
    renderSidebarStats();
  } catch (err) {
    console.warn("Fallo la sincronización con Supabase (posible clave inválida o tablas no creadas). Usando base de datos local de respaldo.", err);
    loadLocalFallbackData();
  }
}

// ── Guardar datos en localStorage ──
function saveState() {
  try {
    localStorage.setItem('tm-user', JSON.stringify(state.currentUser));
    localStorage.setItem('tm-read', JSON.stringify(state.readChapters));
    localStorage.setItem('tm-library', JSON.stringify(state.library));
    localStorage.setItem('tm-history', JSON.stringify(state.history));
    localStorage.setItem('tm-comments', JSON.stringify(state.comments));
    localStorage.setItem('tm-catalog', JSON.stringify(state.catalog));
  } catch (e) {
    console.warn("Error guardando en localStorage:", e);
  }
}

// ══════════════════════════════════════════════
// ── FUNCIONES DE MODALES (Abrir / Cerrar) ──
// ══════════════════════════════════════════════
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'none';
  }
}

// ══════════════════════════════════════════════
// ── INICIALIZACIÓN ──
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // 1. Cargar datos locales inmediatamente para que la página sea funcional al instante
  loadLocalFallbackData();

  // 2. Ejecutar la sincronización asíncrona con Supabase en segundo plano
  loadState().catch(err => console.warn("Error en segundo plano con Supabase:", err));

  // 3. Renderizar estados iniciales de inmediato
  renderAuth();
  renderGenres();
  updateStats();
  renderHistory();
  renderFeatured();
  renderGrid();
  renderSidebarStats();
  renderUploadGenresSelector();

  // Buscador
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      triggerSearch();
    }, 250));
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') triggerSearch();
    });
  }

  // Cerrar modales al hacer clic fuera
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Responsive sidebar
  window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (state.currentView === 'catalog') {
      sidebar.style.display = window.innerWidth > 768 ? 'block' : 'none';
    }
  });

  // Cambiar etiquetas dinámicamente al seleccionar tipo de obra en modal de subida
  const typeSelect = document.getElementById('up-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', function() {
      const authorInput = document.getElementById('up-author');
      if (authorInput && authorInput.previousElementSibling) {
        if (this.value === 'anime') {
          authorInput.previousElementSibling.textContent = 'Estudio de Animación / Autor:';
          authorInput.placeholder = 'Ej: ufotable / Kyoto Animation';
        } else {
          authorInput.previousElementSibling.textContent = 'Autor:';
          authorInput.placeholder = 'Ej: Chugong';
        }
      }
    });
  }

  // Configurar Drag & Drop y previsualización de portada en el modal de subida
  const coverDropzone = document.getElementById('up-cover-dropzone');
  const coverFileInput = document.getElementById('up-cover-file');
  const coverUrlInput = document.getElementById('up-cover');
  const coverPreview = document.getElementById('up-cover-preview');
  const coverPreviewPlaceholder = document.getElementById('up-cover-preview-placeholder');

  function updateCoverPreview(src) {
    if (coverPreview && coverPreviewPlaceholder) {
      if (src && src.trim() !== "") {
        coverPreview.src = src;
        coverPreview.style.display = 'block';
        coverPreviewPlaceholder.style.display = 'none';
      } else {
        coverPreview.src = '';
        coverPreview.style.display = 'none';
        coverPreviewPlaceholder.style.display = 'block';
      }
    }
  }

  if (coverFileInput) {
    coverFileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
          updateCoverPreview(e.target.result);
        };
        reader.readAsDataURL(this.files[0]);
      } else {
        updateCoverPreview(coverUrlInput ? coverUrlInput.value.trim() : '');
      }
    });
  }

  if (coverUrlInput) {
    coverUrlInput.addEventListener('input', function() {
      updateCoverPreview(this.value.trim());
    });
  }

  if (coverDropzone) {
    coverDropzone.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.classList.add('drag-over');
    });
    coverDropzone.addEventListener('dragleave', function() {
      this.classList.remove('drag-over');
    });
    coverDropzone.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        if (coverFileInput) {
          coverFileInput.files = e.dataTransfer.files;
          var event = new Event('change');
          coverFileInput.dispatchEvent(event);
        }
      }
    });
  }
});

// ══════════════════════════════════════════════
// ── AUTENTICACIÓN ──
// ══════════════════════════════════════════════
function renderAuth() {
  const container = document.getElementById('auth-section');
  if (!container) return;

  if (state.currentUser) {
    if (state.currentUser.xp === undefined) state.currentUser.xp = 0;
    if (state.currentUser.level === undefined) state.currentUser.level = 1;

    let avatarHTML = '';
    const borderClass = `border-lvl-${state.currentUser.level}`;
    if (state.currentUser.avatar && state.currentUser.avatar.trim() !== '') {
      avatarHTML = `<img src="${state.currentUser.avatar}" class="topbar-avatar ${borderClass}" alt="Avatar">`;
    } else {
      const initial = state.currentUser.username[0].toUpperCase();
      avatarHTML = `<div class="topbar-avatar-fallback ${borderClass}">${initial}</div>`;
    }
    const adminBadge = isAdmin() ? '<span style="background:#e74c3c; color:#fff; font-size:9px; padding:2px 6px; border-radius:3px; margin-left:4px; font-weight:bold; letter-spacing:0.5px;">ADMIN</span>' : '';
    const xpHTML = `<span class="xp-badge" title="Rango: ${getUserRankName(state.currentUser.level)}">Lvl ${state.currentUser.level} (${state.currentUser.xp} XP)</span>`;
    
    container.innerHTML = `
      <div class="user-auth-info" onclick="openProfileModal(); return false;" style="cursor:pointer; display:inline-flex; align-items:center; gap:8px; margin-right: 12px; vertical-align: middle;">
        ${avatarHTML}
        <span>Hola, <strong class="username-tag">${state.currentUser.username}</strong>${adminBadge}${xpHTML}</span>
      </div>
      <a href="#" class="logout-btn" onclick="logout(); return false;" style="vertical-align: middle;">Cerrar Sesión</a>
    `;
  } else {
    container.innerHTML = `
      <a href="#" onclick="openModal('login-modal'); return false;">Iniciar Sesión</a>
      <span>|</span>
      <a href="#" onclick="openModal('register-modal'); return false;">Registrarse</a>
    `;
  }
}

function openProfileModal() {
  if (!state.currentUser) return;

  var totalRead = 0;
  Object.keys(state.readChapters).forEach(function(key) {
    totalRead += state.readChapters[key].length;
  });

  var libSize = Object.keys(state.library).length;
  var userUploads = state.catalog.filter(function(m) { return m.uploader === state.currentUser.username; }).length;

  // Mostrar avatar como imagen o como letra
  var avatarImg = document.getElementById('profile-avatar-img');
  var avatarDiv = document.getElementById('profile-avatar');

  const borderClass = `border-lvl-${state.currentUser.level || 1}`;
  // Limpiar clases previas
  avatarImg.className = '';
  avatarDiv.className = '';

  if (state.currentUser.avatar && state.currentUser.avatar.trim() !== '') {
    avatarImg.src = state.currentUser.avatar;
    avatarImg.style.display = 'block';
    avatarImg.classList.add(borderClass);
    avatarDiv.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    avatarDiv.style.display = 'flex';
    avatarDiv.classList.add(borderClass);
    avatarDiv.textContent = state.currentUser.username[0].toUpperCase();
  }

  // Info del usuario
  const rankName = getUserRankName(state.currentUser.level || 1);
  document.getElementById('profile-username').innerHTML = `${state.currentUser.username} <span class="xp-badge" style="font-size:11px; padding:3px 10px;">Lvl ${state.currentUser.level || 1} [${rankName}]</span>`;
  document.getElementById('profile-email').textContent = state.currentUser.email;
  document.getElementById('profile-bio-text').textContent = state.currentUser.bio || 'Sin biografía.';

  // Estadísticas
  document.getElementById('profile-stat-read').textContent = totalRead;
  document.getElementById('profile-stat-library').textContent = libSize;
  document.getElementById('profile-stat-uploads').textContent = userUploads;

  // Pre-llenar formulario de edición
  document.getElementById('prof-display-name').value = state.currentUser.username;
  var profEmailEl = document.getElementById('prof-email');
  if (profEmailEl) profEmailEl.value = state.currentUser.email || '';
  document.getElementById('prof-avatar-url').value = state.currentUser.avatar || '';
  document.getElementById('prof-bio').value = state.currentUser.bio || '';
  
  var fileInput = document.getElementById('prof-avatar-file');
  if (fileInput) fileInput.value = '';

  openModal('profile-modal');
}

async function saveProfileSettings(e) {
  e.preventDefault();
  if (!state.currentUser) return;

  var newUsername = document.getElementById('prof-display-name').value.trim();
  var profEmailEl = document.getElementById('prof-email');
  var newEmail = profEmailEl ? profEmailEl.value.trim() : state.currentUser.email;
  var newAvatar = document.getElementById('prof-avatar-url').value.trim();
  var newBio = document.getElementById('prof-bio').value.trim();
  var fileInput = document.getElementById('prof-avatar-file');

  async function proceedSave(avatarData) {
    if (newUsername) {
      state.currentUser.username = newUsername;
      state.currentUser.email = newEmail;
      state.currentUser.avatar = avatarData;
      state.currentUser.bio = newBio;
      saveState();
      renderAuth();
      showToast("¡Perfil guardado con éxito!");
      closeModal('profile-modal');
      refreshCurrentView();
    }
  }

  if (fileInput && fileInput.files && fileInput.files[0]) {
    var reader = new FileReader();
    reader.onload = async function(evt) {
      await proceedSave(evt.target.result);
    };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    await proceedSave(newAvatar);
  }
}

function doLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  if (username) {
    // Preservar datos existentes del usuario si ya existía
    var existingUser = null;
    try { existingUser = JSON.parse(localStorage.getItem('tm-user')); } catch(ex) {}
    var email = (existingUser && existingUser.username === username) ? existingUser.email : username + '@tumanhwaonline.com';
    var avatar = (existingUser && existingUser.username === username) ? (existingUser.avatar || '') : '';
    var bio = (existingUser && existingUser.username === username) ? (existingUser.bio || '') : '';
    var xp = (existingUser && existingUser.username === username) ? (existingUser.xp || 0) : 0;
    var level = (existingUser && existingUser.username === username) ? (existingUser.level || 1) : 1;
    
    state.currentUser = { username: username, email: email, avatar: avatar, bio: bio, xp: xp, level: level };
    saveState();
    renderAuth();
    closeModal('login-modal');
    var welcomeMsg = isAdmin() ? '¡Bienvenido, Administrador ' + username + '!' : '¡Bienvenido de vuelta, ' + username + '!';
    showToast(welcomeMsg);
    refreshCurrentView();
  }
}

function doRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-user').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  if (username && email) {
    state.currentUser = { username: username, email: email, avatar: '', bio: '', xp: 0, level: 1 };
    saveState();
    renderAuth();
    closeModal('register-modal');
    var welcomeMsg = isAdmin() ? '¡Cuenta de Administrador registrada, ' + username + '!' : '¡Cuenta registrada exitosamente, ' + username + '!';
    showToast(welcomeMsg);
    refreshCurrentView();
  }
}

function logout() {
  state.currentUser = null;
  saveState();
  renderAuth();
  showToast("Sesión cerrada.");
  refreshCurrentView();
}

function refreshCurrentView() {
  if (state.currentView === 'reader' && state.selectedManga) {
    openReader(state.currentChapter);
  } else if (state.currentView === 'detail' && state.selectedManga) {
    showDetail(state.selectedManga.id);
  }
}

// ══════════════════════════════════════════════
// ── HISTORIAL DE LECTURA ──
// ══════════════════════════════════════════════
function renderHistory() {
  const mainCol = document.getElementById('main-content');
  if (!mainCol) return;

  const oldSec = document.getElementById('history-section-el');
  if (oldSec) oldSec.remove();

  if (state.history.length === 0) return;

  const hisDiv = document.createElement('div');
  hisDiv.id = 'history-section-el';
  hisDiv.className = 'history-section';
  hisDiv.innerHTML = '<div class="history-title">Continuar Leyendo</div><div class="history-grid">' +
    state.history.map(h =>
      '<div class="history-item" onclick="resumeManga(' + h.mangaId + ', ' + h.chapterNum + ')">' +
        '<img class="history-cover" src="' + h.cover + '" alt="">' +
        '<div class="history-info">' +
          '<div class="history-manga-title">' + h.title + '</div>' +
          '<div class="history-chapter">Capítulo ' + h.chapterNum + '</div>' +
        '</div>' +
      '</div>'
    ).join('') +
  '</div>';

  const recSec = document.getElementById('rec-section');
  if (recSec) {
    recSec.insertAdjacentElement('afterend', hisDiv);
  } else {
    mainCol.insertBefore(hisDiv, mainCol.firstChild);
  }
}

function resumeManga(mangaId, chapterNum) {
  const manga = state.catalog.find(m => m.id === mangaId);
  if (manga) {
    state.selectedManga = manga;
    showDetail(mangaId);
    setTimeout(() => openReader(chapterNum), 100);
  }
}

function addToHistory(manga, chapterNum) {
  state.history = state.history.filter(h => h.mangaId !== manga.id);
  state.history.unshift({
    mangaId: manga.id,
    title: manga.title,
    cover: manga.cover,
    chapterNum: chapterNum
  });
  if (state.history.length > 6) state.history.pop();
  saveState();
  renderHistory();
}

// ══════════════════════════════════════════════
// ── RECOMENDADOS ──
// ══════════════════════════════════════════════
let carouselInterval = null;
let currentSlideIndex = 0;

function renderFeatured() {
  const mainCol = document.getElementById('main-content');
  if (!mainCol) return;

  const oldSec = document.getElementById('rec-section');
  if (oldSec) oldSec.remove();

  const available = state.catalog.filter(m => !m.nsfw || state.showNSFW);
  const featured = available.slice(0, 5);
  if (featured.length === 0) return;

  const recDiv = document.createElement('div');
  recDiv.id = 'rec-section';
  recDiv.className = 'carousel-container';

  let slidesHtml = '';
  let dotsHtml = '';

  featured.forEach((m, idx) => {
    const activeClass = idx === 0 ? ' active' : '';
    slidesHtml += `
      <div class="carousel-slide${activeClass}" onclick="showDetail(${m.id})" id="slide-${idx}">
        <div class="carousel-cover-bg" style="background-image: url('${m.cover}');"></div>
        <div class="carousel-info">
          <div class="carousel-meta">${m.type.toUpperCase()} · ★ ${m.rating.toFixed(1)}</div>
          <div class="carousel-title">${m.title}</div>
          <div class="carousel-desc">${m.description || 'Sin descripción.'}</div>
        </div>
      </div>
    `;
    dotsHtml += `<span class="carousel-dot${activeClass}" onclick="event.stopPropagation(); setCarouselSlide(${idx})" id="dot-${idx}"></span>`;
  });

  recDiv.innerHTML = `
    ${slidesHtml}
    <button class="carousel-btn prev" onclick="event.stopPropagation(); changeCarouselSlide(-1)">❮</button>
    <button class="carousel-btn next" onclick="event.stopPropagation(); changeCarouselSlide(1)">❯</button>
    <div class="carousel-dots">
      ${dotsHtml}
    </div>
  `;

  mainCol.insertBefore(recDiv, mainCol.firstChild);
  currentSlideIndex = 0;
  
  startCarouselTimer();
}

function startCarouselTimer() {
  if (carouselInterval) clearInterval(carouselInterval);
  carouselInterval = setInterval(() => {
    const el = document.getElementById('rec-section');
    if (el && el.style.display !== 'none') {
      changeCarouselSlide(1);
    }
  }, 5000);
}

function setCarouselSlide(idx) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.carousel-dot');
  if (slides.length === 0) return;

  if (idx >= slides.length) idx = 0;
  if (idx < 0) idx = slides.length - 1;

  currentSlideIndex = idx;

  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === idx);
  });
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
  });

  startCarouselTimer();
}

function changeCarouselSlide(direction) {
  setCarouselSlide(currentSlideIndex + direction);
}


// ══════════════════════════════════════════════
// ── GÉNEROS ──
// ══════════════════════════════════════════════
function renderGenres() {
  const container = document.getElementById('genre-list');
  if (!container) return;

  const counts = {};
  // Inicializar todos los géneros definidos con 0
  ALL_GENRES.forEach(g => {
    counts[g] = 0;
  });

  state.catalog.forEach(m => {
    if (m.nsfw && !state.showNSFW) return;
    if (m.genres) {
      m.genres.forEach(g => {
        counts[g] = (counts[g] || 0) + 1;
      });
    }
  });

  const sortedGenres = Object.keys(counts).sort();
  const totalVisible = state.catalog.filter(m => !m.nsfw || state.showNSFW).length;
  let html = '<li class="genre-item ' + (state.filterGenre === 'all' ? 'active' : '') + '" onclick="setFilterGenre(\'all\')">Todos <span class="genre-count">(' + totalVisible + ')</span></li>';

  sortedGenres.forEach(genre => {
    html += '<li class="genre-item ' + (state.filterGenre === genre ? 'active' : '') + '" onclick="setFilterGenre(\'' + genre + '\')">' +
      genre + ' <span class="genre-count">(' + counts[genre] + ')</span></li>';
  });

  container.innerHTML = html;
}

function renderUploadGenresSelector() {
  const container = document.getElementById('up-genres-selector');
  if (!container) return;

  container.innerHTML = ALL_GENRES.map(genre => {
    return `
      <label class="genre-checkbox-label" id="lbl-genre-${genre}">
        <input type="checkbox" name="up-genres-cb" value="${genre}" onchange="toggleGenreCheckbox(this)">
        ${genre}
      </label>
    `;
  }).join('');
}

function toggleGenreCheckbox(checkbox) {
  const label = document.getElementById(`lbl-genre-${checkbox.value}`);
  if (label) {
    label.classList.toggle('selected', checkbox.checked);
  }
}

// ══════════════════════════════════════════════
// ── FILTROS ──
// ══════════════════════════════════════════════
function setFilterType(type, element) {
  state.filterType = type;
  state.searchQuery = '';
  document.getElementById('search-input').value = '';

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (element) element.classList.add('active');

  goHome();
}

// Cambiar filtro por género
function setFilterGenre(genre) {
  state.filterGenre = genre;
  renderGenres();
  renderGrid();
}

function triggerSearch() {
  state.searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
  renderGrid();
}

function toggleNSFWFilter(element) {
  var bar = document.getElementById('nsfw-filters-bar');
  if (!state.showNSFW) {
    var confirmar = confirm("ADVERTENCIA: Esta sección contiene material exclusivo para adultos (+18) que puede incluir violencia o escenas explícitas.\n\n¿Confirmas que eres mayor de 18 años y deseas ingresar a la Zona +18?");
    if (!confirmar) {
      state.showNSFW = false;
      element.classList.remove('active');
      if (bar) bar.style.display = 'none';
      document.body.classList.remove('zona-nsfw-active');
      return;
    }
    state.showNSFW = true;
    element.classList.add('active');
    if (bar) bar.style.display = 'flex';
    document.body.classList.add('zona-nsfw-active');
    state.nsfwFilterType = 'all';
    
    // Resetear pestaña activa de la barra NSFW
    document.querySelectorAll('.nsfw-tab').forEach(t => t.classList.remove('active'));
    var allTab = document.querySelector('.nsfw-tab');
    if (allTab) allTab.classList.add('active');
    
    showToast("Has entrado a la Zona +18");
  } else {
    state.showNSFW = false;
    element.classList.remove('active');
    if (bar) bar.style.display = 'none';
    document.body.classList.remove('zona-nsfw-active');
    showToast("Saliste de la Zona +18");
  }
  renderFeatured();
  renderGenres();
  renderGrid();
}

function setNSFWFilterType(type, element) {
  state.nsfwFilterType = type;
  document.querySelectorAll('.nsfw-tab').forEach(t => t.classList.remove('active'));
  if (element) element.classList.add('active');
  renderGrid();
}

// ══════════════════════════════════════════════
// ── RENDER CATÁLOGO (GRILLA) ──
// ══════════════════════════════════════════════
function getMangaProgress(m) {
  if (!m || !m.chapters || m.chapters === 0) return { pct: 0, text: "" };
  const readList = state.readChapters[m.id] || [];
  const readCount = readList.length;
  if (readCount === 0) return { pct: 0, text: "" };
  
  const pct = Math.min(100, Math.round((readCount / m.chapters) * 100));
  const suffix = m.type === 'anime' ? 'eps' : 'caps';
  return {
    pct: pct,
    text: `${readCount}/${m.chapters} ${suffix}`
  };
}

function triggerSearchFilters() {
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('manga-grid');
  if (!grid) return;

  const sortSelect = document.getElementById('filter-sort');
  const statusSelect = document.getElementById('filter-status');
  if (sortSelect) state.sortBy = sortSelect.value;
  if (statusSelect) state.statusFilter = statusSelect.value;

  let filtered = state.catalog.slice();

  if (state.showNSFW) {
    // Modo +18 activo: mostrar solo contenido +18
    filtered = filtered.filter(m => m.nsfw === true);
    if (state.nsfwFilterType !== 'all') {
      filtered = filtered.filter(m => m.type === state.nsfwFilterType);
    }
  } else {
    // Modo convencional activo: ocultar todo el contenido +18
    filtered = filtered.filter(m => !m.nsfw);
    if (state.filterType !== 'all') {
      filtered = filtered.filter(m => m.type === state.filterType);
    }
  }

  if (state.filterGenre !== 'all') filtered = filtered.filter(m => m.genres && m.genres.includes(state.filterGenre));
  if (state.statusFilter !== 'all') filtered = filtered.filter(m => m.status === state.statusFilter);
  if (state.searchQuery) {
    filtered = filtered.filter(m =>
      m.title.toLowerCase().includes(state.searchQuery) ||
      m.author.toLowerCase().includes(state.searchQuery)
    );
  }

  // Ordenamiento
  if (state.sortBy === 'recent') {
    filtered.sort((a, b) => b.id - a.id);
  } else if (state.sortBy === 'views') {
    filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else if (state.sortBy === 'rating') {
    filtered.sort((a, b) => (b.rating || 0.0) - (a.rating || 0.0));
  } else if (state.sortBy === 'title') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #7f8c8d;">No hay títulos que coincidan con los filtros seleccionados.</div>';
    return;
  }

  grid.innerHTML = filtered.map(m => {
    const libSection = state.library[m.id];
    const badgeHTML = libSection ? '<span class="library-badge ' + libSection + '">' + libSection + '</span>' : '';
    const progress = getMangaProgress(m);
    const progressHTML = progress.pct > 0 ? `
      <div class="card-progress-bar-wrap">
        <div class="card-progress-bar" style="width: ${progress.pct}%"></div>
      </div>
      <span class="card-progress-text">${progress.text}</span>
    ` : '';

    const badgeTipoClass = m.type === 'anime' ? 'badge-tipo badge-anime' : 'badge-tipo';
    const badgeTipoText = m.type === 'anime' ? 'anime' : m.type;
    const countLabel = m.type === 'anime' ? 'Ep' : 'Cap';

    return '<div class="manga-card" onclick="showDetail(' + m.id + ')">' +
      '<div class="card-cover-wrap">' +
        '<img src="' + m.cover + '" alt="' + m.title + '" class="card-cover" onerror="this.src=\'https://placehold.co/300x420/555/fff?text=Sin+Portada\'">' +
        '<span class="' + badgeTipoClass + '">' + badgeTipoText + '</span>' +
        (m.nsfw ? '<span class="badge-nsfw">+18</span>' : '') +
        progressHTML +
      '</div>' +
      '<div class="card-title" title="' + m.title + '">' + m.title + ' ' + badgeHTML + '</div>' +
      '<div class="card-meta">' +
        '<span>★ ' + m.rating + '</span>' +
        '<span>' + countLabel + ': ' + m.chapters + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════════
// ── VISTA DETALLE ──
// ══════════════════════════════════════════════
async function showDetail(id) {
  const manga = state.catalog.find(m => m.id === id);
  if (!manga) return;

  state.selectedManga = manga;
  state.currentView = 'detail';

  var catalogView = document.getElementById('catalog-view');
  var detailView = document.getElementById('detail-view');
  var sidebar = document.getElementById('sidebar');

  var recSec = document.getElementById('rec-section');
  if (recSec) recSec.style.display = 'none';
  var histSec = document.getElementById('history-section-el');
  if (histSec) histSec.style.display = 'none';

  catalogView.style.display = 'none';
  detailView.style.display = 'block';
  sidebar.style.display = window.innerWidth <= 768 ? 'none' : 'block';

  var libSection = state.library[manga.id];

  // 1. Incrementar visitas en Supabase (en segundo plano)
  incrementMangaViews(manga);

  // Armar estrellas del rating en orden inverso para row-reverse CSS hover
  var starsHtml = '';
  for (var s = 5; s >= 1; s--) {
    var isStarActive = s <= Math.round(manga.rating || 5.0) ? ' active' : '';
    starsHtml += '<span class="star-rating-btn' + isStarActive + '" onclick="submitMangaRating(' + manga.id + ', ' + s + ')">★</span>';
  }

  const isAnime = manga.type === 'anime';
  const labelAutor = isAnime ? 'Estudio / Director:' : 'Autor:';
  const labelAction = isAnime ? 'Ver Primer Episodio' : 'Leer Primer Capítulo';
  const labelListTitle = isAnime ? 'Lista de Episodios' : 'Lista de Capítulos';
  const labelAddButton = isAnime ? '+ Agregar Episodio' : '+ Agregar Capítulo';

  detailView.innerHTML =
    '<div class="manga-detail">' +
      '<button class="btn-classic-grey back-btn" style="margin-bottom:15px;" onclick="goHome()">← Volver al listado</button>' +
      '<div class="detail-header">' +
        '<div class="detail-cover">' +
          '<img src="' + manga.cover + '" alt="' + manga.title + '" onerror="this.src=\'https://placehold.co/300x420/555/fff?text=Sin+Portada\'">' +
        '</div>' +
        '<div class="detail-info">' +
          '<h1 class="detail-title">' + manga.title + '</h1>' +
          '<table class="detail-meta-table">' +
            '<tr><td>' + labelAutor + '</td><td>' + manga.author + '</td></tr>' +
            '<tr><td>Tipo:</td><td style="text-transform:uppercase;"><strong>' + manga.type + '</strong></td></tr>' +
            '<tr><td>Géneros:</td><td>' + manga.genres.join(', ') + '</td></tr>' +
            '<tr><td>Subido por:</td><td>' + manga.uploader + '</td></tr>' +
            '<tr><td>Biblioteca:</td><td>' + (libSection ? 'Guardado en: <strong>' + libSection.toUpperCase() + '</strong>' : 'No guardado') + '</td></tr>' +
            '<tr><td>Visitas totales:</td><td>' + (manga.views || 0).toLocaleString() + ' vistas</td></tr>' +
            '<tr><td>Calificación:</td><td>★ ' + (manga.rating || 5.0).toFixed(1) + ' / 5.0</td></tr>' +
            '<tr><td>Puntuar obra:</td><td><div class="star-rating-wrap">' + starsHtml + '</div></td></tr>' +
          '</table>' +
          '<div class="detail-actions">' +
            '<button class="btn-classic-red" onclick="startReading()">' + labelAction + '</button>' +
            '<button class="btn-classic-grey" onclick="openLibraryModal(' + manga.id + ')">' + (libSection ? '★ Cambiar Estado' : '☆ Agregar a Biblioteca') + '</button>' +
            '<button class="btn-classic-grey" onclick="startDownloadSimulation()">↓ Descargar</button>' +
            (isAdmin() ? '<button class="btn-classic-grey btn-admin-delete" style="background-color:#e74c3c; color:#fff; border-color:#c0392b;" onclick="deleteManga(' + manga.id + ')">Eliminar Obra (Admin)</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="detail-synopsis"><strong>Sinopsis:</strong><br><br>' + manga.description + '</div>' +
      '<div class="chapters-header-row">' +
        '<div class="section-title" style="margin-bottom:0; border:none; padding:0;">' + labelListTitle + '</div>' +
        '<button class="btn-agregar-cap" onclick="openUploadChapterModal()">' + labelAddButton + '</button>' +
      '</div>' +
      '<ul class="chapter-list">' + renderChaptersList(manga) + '</ul>' +
      '<div class="comments-section">' +
        '<div class="section-title" style="border-bottom:1px solid #eaeded; padding-bottom:5px; font-size:14px;">Comentarios de la Comunidad</div>' +
        '<div class="comment-form"><strong>Deja tu comentario:</strong>' +
          '<div class="comment-input-area">' +
            '<textarea id="comment-text" placeholder="Escribe aquí tu comentario sobre esta obra..."></textarea>' +
            '<button class="btn-comentar" onclick="addComment(' + manga.id + ')">Enviar</button>' +
          '</div>' +
        '</div>' +
        '<div class="comments-list" id="comments-list"></div>' +
      '</div>' +
    '</div>';

  // Cargar comentarios
  renderCommentsList(manga.id);

  // Listeners de capítulos/episodios
  document.querySelectorAll('.chapter-row').forEach(row => {
    row.addEventListener('click', () => {
      var num = parseInt(row.getAttribute('data-chapter'));
      if (num) {
        if (manga.type === 'anime') {
          openVideoPlayer(manga.id, num);
        } else {
          openReader(num);
        }
      }
    });
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Registrar incremento de visitas en Supabase
async function incrementMangaViews(manga) {
  manga.views = (parseInt(manga.views) || 0) + 1;
  renderSidebarStats(); // Actualizar barra lateral inmediatamente en pantalla
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('catalog')
        .update({ views: manga.views })
        .eq('id', manga.id);
    } catch (err) {
      console.warn("No se pudo registrar la visita en Supabase:", err);
    }
  }
}

// Valorar una obra en estrellas
async function submitMangaRating(mangaId, stars) {
  var manga = state.catalog.find(m => m.id === mangaId);
  if (!manga) return;

  // Promedio básico de calificación
  var currentRating = parseFloat(manga.rating || 5.0);
  var newRating = ((currentRating * 9) + parseFloat(stars)) / 10; // Suavizado de rating
  manga.rating = newRating;

  showToast("¡Has calificado esta obra con " + stars + " estrellas!");
  addXP(5);
  showDetail(mangaId); // Recargar panel de detalles

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('catalog')
        .update({ rating: newRating })
        .eq('id', mangaId);
      await syncWithSupabase();
    } catch (err) {
      console.warn("No se pudo guardar la calificación en Supabase:", err);
    }
  }
}


function startReading() {
  if (state.selectedManga) {
    if (state.selectedManga.chapters >= 1) {
      if (state.selectedManga.type === 'anime') {
        openVideoPlayer(state.selectedManga.id, 1);
      } else {
        openReader(1);
      }
    } else {
      var label = state.selectedManga.type === 'anime' ? 'episodios' : 'capítulos';
      showToast("Aún no hay " + label + " subidos para esta obra.");
    }
  }
}

function renderChaptersList(manga) {
  var html = '';
  var total = manga.chapters;
  var isAnime = manga.type === 'anime';
  var labelName = isAnime ? 'Episodio' : 'Capítulo';
  var placeholderText = isAnime ? 'No hay episodios todavía. ¡Sube el primero presionando "+ Agregar Episodio"!' : 'No hay capítulos todavía. ¡Sube el primero presionando "+ Agregar Capítulo"!';
  
  if (total === 0) {
    return '<li style="padding:15px; color:#888; text-align:center; font-size:12px; list-style:none;">' + placeholderText + '</li>';
  }

  for (var i = 0; i < total; i++) {
    var num = state.sortOrder === 'desc' ? total - i : i + 1;
    var readChaps = state.readChapters[manga.id] || [];
    var isRead = readChaps.indexOf(num) !== -1;
    html += '<li class="chapter-row ' + (isRead ? 'read' : '') + '" data-chapter="' + num + '">' +
      '<div><span class="chapter-name">' + labelName + ' ' + num + '</span> <span class="chapter-uploader">por ' + manga.uploader + '</span></div>' +
      '<span class="chapter-date">Hace ' + i + 'd</span></li>';
  }
  return html;
}

// ══════════════════════════════════════════════
// ── BIBLIOTECA ──
// ══════════════════════════════════════════════
function openLibraryModal(mangaId) {
  var currentStatus = state.library[mangaId] || 'leyendo';
  document.getElementById('lib-status-select').value = currentStatus;
  openModal('library-modal');
}

function saveToLibrarySection() {
  if (!state.selectedManga) return;
  var section = document.getElementById('lib-status-select').value;
  state.library[state.selectedManga.id] = section;
  saveState();
  closeModal('library-modal');
  showDetail(state.selectedManga.id);
  showToast('Añadido a Biblioteca en sección "' + section.toUpperCase() + '"');
}

// ── Vistas y Controles de Mi Biblioteca ──

function showLibraryView(element) {
  state.currentView = 'library';
  state.selectedManga = null;

  // Ajustar visibilidad de vistas principales
  document.getElementById('catalog-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('reader-view').style.display = 'none';
  document.getElementById('library-view').style.display = 'block';
  document.getElementById('sidebar').style.display = 'none'; // Ocultar sidebar para más espacio

  // Ocultar sección de recomendados e historial
  var recSec = document.getElementById('rec-section');
  if (recSec) recSec.style.display = 'none';
  var histSec = document.getElementById('history-section-el');
  if (histSec) histSec.style.display = 'none';

  // Resaltar nav link activo
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  } else {
    var libLink = document.getElementById('nav-btn-library');
    if (libLink) libLink.classList.add('active');
  }

  // Cerrar menú móvil si está abierto
  var menu = document.getElementById('nav-links-menu');
  if (menu) menu.classList.remove('show');

  // Renderizar contenido
  renderLibraryGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setLibraryTab(tab, element) {
  state.libraryTab = tab;
  
  // Toggle tab activo
  document.querySelectorAll('.lib-tab').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
  
  renderLibraryGrid();
}

function renderLibraryGrid() {
  const grid = document.getElementById('library-grid');
  if (!grid) return;

  // Filtrar catálogo por obras que estén guardadas en la biblioteca
  let inLibrary = state.catalog.filter(m => state.library[m.id] !== undefined);

  // Filtrar según el tab activo
  if (state.libraryTab !== 'all') {
    inLibrary = inLibrary.filter(m => state.library[m.id] === state.libraryTab);
  }

  if (inLibrary.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; padding: 50px; text-align: center; color: #7f8c8d;">
      No tienes obras en esta sección de tu biblioteca.
    </div>`;
    return;
  }

  grid.innerHTML = inLibrary.map(m => {
    const libSection = state.library[m.id];
    const badgeHTML = libSection ? '<span class="library-badge ' + libSection + '">' + libSection + '</span>' : '';
    const progress = getMangaProgress(m);
    const progressHTML = progress.pct > 0 ? `
      <div class="card-progress-bar-wrap">
        <div class="card-progress-bar" style="width: ${progress.pct}%"></div>
      </div>
      <span class="card-progress-text">${progress.text}</span>
    ` : '';

    const badgeTipoClass = m.type === 'anime' ? 'badge-tipo badge-anime' : 'badge-tipo';
    const badgeTipoText = m.type === 'anime' ? 'anime' : m.type;
    const countLabel = m.type === 'anime' ? 'Ep' : 'Cap';

    return '<div class="manga-card" onclick="showDetail(' + m.id + ')">' +
      '<div class="card-cover-wrap">' +
        '<img src="' + m.cover + '" alt="' + m.title + '" class="card-cover" onerror="this.src=\'https://placehold.co/300x420/555/fff?text=Sin+Portada\'">' +
        '<span class="' + badgeTipoClass + '">' + badgeTipoText + '</span>' +
        (m.nsfw ? '<span class="badge-nsfw">+18</span>' : '') +
        progressHTML +
      '</div>' +
      '<div class="card-title" title="' + m.title + '">' + m.title + ' ' + badgeHTML + '</div>' +
      '<div class="card-meta">' +
        '<span>★ ' + m.rating + '</span>' +
        '<span>' + countLabel + ': ' + m.chapters + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════════
// ── COMENTARIOS ──
// ══════════════════════════════════════════════
async function renderCommentsList(mangaId) {
  var container = document.getElementById('comments-list');
  if (!container) return;

  var list = [];
  if (supabaseClient) {
    try {
      let { data, error } = await supabaseClient
        .from('comments')
        .select('*')
        .eq('manga_id', String(mangaId))
        .order('id', { ascending: false });

      if (error) throw error;
      list = data || [];
    } catch (err) {
      console.warn("Error cargando comentarios de Supabase, usando locales:", err);
      list = state.comments[mangaId] || [];
    }
  } else {
    list = state.comments[mangaId] || [];
  }

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#95a5a6; padding:15px; font-size:12px;">No hay comentarios todavía. ¡Sé el primero en comentar!</div>';
    return;
  }

  container.innerHTML = list.map(function(c, index) {
    var commentId = c.id || null;
    var deleteBtn = isAdmin() ? '<button class="btn-delete-comment" onclick="deleteComment(' + mangaId + ', ' + index + ', ' + commentId + ')">🗑 Borrar</button>' : '';
    return '<div class="comment-item">' +
      '<div class="comment-meta" style="display:flex; align-items:center; gap:8px;">' +
        '<span class="comment-author ' + (c.is_staff ? 'uploader-author' : '') + '">' + c.author + (c.is_staff ? ' [Traductor]' : '') + '</span>' +
        '<span>' + (c.date || 'Hace un momento') + '</span>' +
        deleteBtn +
      '</div>' +
      '<div class="comment-content">' + c.text + '</div>' +
    '</div>';
  }).join('');
}

async function addComment(mangaId) {
  var textInput = document.getElementById('comment-text');
  if (!textInput) return;
  var text = textInput.value.trim();
  if (!text) { showToast("Escribe un comentario antes de enviar."); return; }

  var author = state.currentUser ? state.currentUser.username : "Anónimo";
  var isStaff = state.selectedManga && state.selectedManga.uploader === author;

  if (supabaseClient) {
    try {
      let { error } = await supabaseClient
        .from('comments')
        .insert([{
          manga_id: String(mangaId),
          author: author,
          text: text,
          date: 'Ahora mismo',
          is_staff: isStaff
        }]);

      if (error) throw error;
      textInput.value = '';
      await renderCommentsList(mangaId);
      showToast("Comentario enviado.");
      addXP(5);
    } catch (err) {
      console.warn("No se pudo guardar comentario en Supabase:", err);
      saveCommentLocalFallback(mangaId, author, text, isStaff);
    }
  } else {
    saveCommentLocalFallback(mangaId, author, text, isStaff);
  }
}

function saveCommentLocalFallback(mangaId, author, text, isStaff) {
  var textInput = document.getElementById('comment-text');
  if (!state.comments[mangaId]) state.comments[mangaId] = [];
  state.comments[mangaId].unshift({ author: author, text: text, date: "Ahora mismo", is_staff: isStaff });
  saveState();
  if (textInput) textInput.value = '';
  renderCommentsList(mangaId);
  showToast("Comentario guardado localmente.");
  addXP(5);
}

// ══════════════════════════════════════════════
// ── MODERACIÓN DE ADMINISTRADOR ──
// ══════════════════════════════════════════════
async function deleteManga(mangaId) {
  if (!isAdmin()) {
    showToast("No tienes permisos de administrador.");
    return;
  }
  var manga = state.catalog.find(function(m) { return m.id === mangaId; });
  if (!manga) return;

  var confirmar = confirm("⚠ ADMIN: ¿Estás seguro de eliminar \"" + manga.title + "\" del catálogo?\n\nEsta acción no se puede deshacer.");
  if (!confirmar) return;

  // Eliminar de Supabase si está conectado
  if (supabaseClient) {
    try {
      let { error } = await supabaseClient
        .from('catalog')
        .delete()
        .eq('id', mangaId);
      if (error) throw error;
      showToast("\"" + manga.title + "\" eliminado del servidor.");
      await syncWithSupabase();
    } catch (err) {
      console.error("Error al eliminar de Supabase:", err);
      showToast("Error de conexión. Se eliminó localmente.");
      deleteLocalManga(mangaId);
    }
  } else {
    deleteLocalManga(mangaId);
  }

  goHome();
}

function deleteLocalManga(mangaId) {
  state.catalog = state.catalog.filter(function(m) { return m.id !== mangaId; });
  delete state.comments[mangaId];
  delete state.library[mangaId];
  delete state.readChapters[mangaId];
  state.history = state.history.filter(function(h) { return h.mangaId !== mangaId; });
  saveState();
  updateStats();
  renderGenres();
  renderFeatured();
  renderGrid();
  renderSidebarStats();
}

async function deleteComment(mangaId, commentIndex, commentId) {
  if (!isAdmin()) {
    showToast("No tienes permisos de administrador.");
    return;
  }
  var confirmar = confirm("ADMIN: ¿Eliminar este comentario?");
  if (!confirmar) return;

  if (supabaseClient && commentId) {
    try {
      let { error } = await supabaseClient
        .from('comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
      showToast("Comentario eliminado del servidor.");
      renderCommentsList(mangaId);
      return;
    } catch (err) {
      console.warn("No se pudo eliminar el comentario en Supabase:", err);
    }
  }

  // Eliminar localmente
  var list = state.comments[mangaId] || [];
  if (commentIndex >= 0 && commentIndex < list.length) {
    list.splice(commentIndex, 1);
    state.comments[mangaId] = list;
    saveState();
    renderCommentsList(mangaId);
    showToast("Comentario eliminado localmente.");
  }
}

// ══════════════════════════════════════════════
// ── LECTOR DE CAPÍTULOS ──
// ══════════════════════════════════════════════
function openReader(chapterNum) {
  var manga = state.selectedManga;
  if (!manga) return;

  state.currentView = 'reader';
  state.currentChapter = chapterNum;
  addToHistory(manga, chapterNum);

  if (!state.readChapters[manga.id]) state.readChapters[manga.id] = [];
  if (state.readChapters[manga.id].indexOf(chapterNum) === -1) {
    state.readChapters[manga.id].push(chapterNum);
    saveState();
    addXP(10);
  }

  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  var readerView = document.getElementById('reader-view');
  readerView.style.display = 'block';

  // Buscar páginas reales en el manga
  var pages = [];
  if (manga.chaptersData && manga.chaptersData[chapterNum]) {
    pages = manga.chaptersData[chapterNum];
  }

  var count = pages.length;
  var usingPlaceholders = false;

  // Si no hay páginas subidas, usar placeholders clásicos de respaldo para demostración
  if (count === 0) {
    count = 8;
    usingPlaceholders = true;
    for (var i = 1; i <= count; i++) {
      pages.push('placeholder');
    }
  }

  state.totalPagesCount = count;
  state.currentPageIndex = 1;

  var pagesHtml = '';
  var dropdownOptions = '';
  var singlePageHTML = '';

  for (var i = 1; i <= count; i++) {
    var pageUrl = pages[i - 1];
    var pageContentCascade = '';
    var pageContentSingle = '';

    if (usingPlaceholders) {
      pageContentCascade = '<div class="lector-page-placeholder" style="height:' + (650 + Math.random() * 50) + 'px; margin-bottom:10px;">' +
        '<div style="text-align:center;">' +
          '<div style="font-size:36px; margin-bottom:10px;">📖</div>' +
          '<div style="font-weight:bold;">' + manga.title + '</div>' +
          '<div>Capítulo ' + chapterNum + ' - Página ' + i + ' de ' + count + '</div>' +
          '<div style="color:#666; font-size:10px; margin-top:5px;">[TuManhwaOnline - Modo Demostración]</div>' +
        '</div>' +
      '</div>';

      pageContentSingle = '<div id="single-page-' + i + '" class="lector-page-placeholder lector-page-single ' + (i === 1 ? 'active' : '') + '" style="height:650px;">' +
        '<div style="text-align:center; padding-top:150px;">' +
          '<div style="font-size:42px; margin-bottom:15px;">📖</div>' +
          '<div style="font-weight:bold; font-size:16px;">' + manga.title + '</div>' +
          '<div style="margin-top:5px; font-size:13px;">Capítulo ' + chapterNum + ' - Página ' + i + ' de ' + count + '</div>' +
        '</div>' +
      '</div>';
    } else {
      pageContentCascade = '<div id="page-' + i + '" class="lector-page-real" style="text-align:center; margin-bottom:12px;">' +
        '<img src="' + pageUrl + '" alt="Página ' + i + '" style="max-width:100%; height:auto; display:block; margin:0 auto; border: 1px solid #ddd;" onerror="this.src=\'https://placehold.co/600x900/555/fff?text=Error+al+cargar+página+' + i + '\'">' +
      '</div>';

      pageContentSingle = '<img id="single-page-' + i + '" class="lector-page-single ' + (i === 1 ? 'active' : '') + '" src="' + pageUrl + '" alt="Página ' + i + '" style="max-width:100%; max-height:80vh; height:auto; display:' + (i === 1 ? 'block' : 'none') + '; margin:0 auto; border: 1px solid #ddd;" onerror="this.src=\'https://placehold.co/600x900/555/fff?text=Error+al+cargar+página+' + i + '\'">';
    }

    pagesHtml += pageContentCascade;
    dropdownOptions += '<option value="' + i + '">Página ' + i + '</option>';
    singlePageHTML += pageContentSingle;
  }

  var prevDisabled = chapterNum <= 1 ? ' disabled style="opacity:0.5"' : '';
  var nextDisabled = chapterNum >= manga.chapters ? ' disabled style="opacity:0.5"' : '';

  readerView.innerHTML =
    '<div class="lector-container">' +
      '<div class="lector-toolbar">' +
        '<div class="lector-toolbar-left">' +
          '<span>Capítulo ' + chapterNum + '</span>' +
          '<select id="page-select" onchange="handlePageSelect(this.value)">' + dropdownOptions + '</select>' +
          '<select id="mode-select" onchange="changeReadingMode(this.value)">' +
            '<option value="cascade"' + (state.readingMode === 'cascade' ? ' selected' : '') + '>Cascada (Vertical)</option>' +
            '<option value="single"' + (state.readingMode === 'single' ? ' selected' : '') + '>Página a Página</option>' +
          '</select>' +
          '<select id="theme-select" style="margin-left: 6px;" onchange="changeReaderTheme(this.value)">' +
            '<option value="dark">Fondo Oscuro</option>' +
            '<option value="oled">Fondo OLED (Negro)</option>' +
            '<option value="cream">Fondo Crema</option>' +
            '<option value="light">Fondo Claro</option>' +
          '</select>' +
        '</div>' +
        '<div class="lector-toolbar-right">' +
          '<button class="btn-reportar-error" onclick="openModal(\'report-modal\')">⚠ Reportar</button>' +
          '<button class="btn-cerrar-lector" onclick="closeReader()">✕ Cerrar</button>' +
        '</div>' +
      '</div>' +
      '<div class="lector-pages" id="reader-pages-cascade" style="display:' + (state.readingMode === 'cascade' ? 'flex' : 'none') + '; flex-direction:column; align-items:center;">' + pagesHtml + '</div>' +
      '<div class="lector-pages" id="reader-pages-single" style="display:' + (state.readingMode === 'single' ? 'block' : 'none') + '; text-align:center;">' +
        singlePageHTML +
        '<div class="single-page-nav">' +
          '<button class="btn-page-nav" onclick="prevSinglePage()">← Anterior</button>' +
          '<span id="single-page-indicator">Página 1 / ' + count + '</span>' +
          '<button class="btn-page-nav" onclick="nextSinglePage()">Siguiente →</button>' +
        '</div>' +
      '</div>' +
      '<div class="lector-nav-bottom">' +
        '<button class="btn-classic-grey" onclick="changeChapter(' + (chapterNum - 1) + ')"' + prevDisabled + '>← Cap. Anterior</button>' +
        '<button class="btn-classic-red" onclick="closeReader()">Volver a Detalles</button>' +
        '<button class="btn-classic-grey" onclick="changeChapter(' + (chapterNum + 1) + ')"' + nextDisabled + '>Cap. Siguiente →</button>' +
      '</div>' +
      '<div class="lector-comments">' +
        '<div class="lector-comments-title">Comentarios del Capítulo ' + chapterNum + '</div>' +
        '<div class="lector-comment-form">' +
          (state.currentUser ?
            '<div class="comment-input-area">' +
              '<textarea id="reader-comment-text" placeholder="¿Qué te pareció este capítulo?"></textarea>' +
              '<button class="btn-comentar" onclick="addReaderComment(' + manga.id + ', ' + chapterNum + ')">Enviar</button>' +
            '</div>'
          :
            '<div class="lector-comment-lock">' +
              '<span>Debes <strong>iniciar sesión</strong> para dejar comentarios en los capítulos.</span>' +
              '<button class="btn-classic-red" onclick="openModal(\'login-modal\')">Iniciar Sesión / Registrarse</button>' +
            '</div>'
          ) +
        '</div>' +
        '<div class="lector-comments-list" id="reader-comments-list"></div>' +
      '</div>' +
    '</div>';

  renderReaderCommentsList(manga.id, chapterNum);

  if (state.readingMode === 'cascade') {
    window.addEventListener('scroll', handleReaderScroll);
  }
  window.scrollTo({ top: 0 });
}

// ── Comentarios del Lector ──
async function renderReaderCommentsList(mangaId, chapterNum) {
  var container = document.getElementById('reader-comments-list');
  if (!container) return;

  var key = mangaId + '_' + chapterNum;
  var list = [];

  if (supabaseClient) {
    try {
      let { data, error } = await supabaseClient
        .from('comments')
        .select('*')
        .eq('manga_id', key)
        .order('id', { ascending: false });

      if (error) throw error;
      list = data || [];
    } catch (err) {
      console.warn("Error cargando comentarios del capítulo de Supabase:", err);
      list = state.comments[key] || [];
    }
  } else {
    list = state.comments[key] || [];
  }

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#888; padding:15px; font-size:11px;">Nadie ha comentado en este capítulo. ¡Sé el primero!</div>';
    return;
  }

  container.innerHTML = list.map(c =>
    '<div class="lector-comment-item">' +
      '<div class="lector-comment-meta">' +
        '<span class="lector-comment-author ' + (c.is_staff ? 'uploader-author' : '') + '">' + c.author + (c.is_staff ? ' [Traductor]' : '') + '</span>' +
        '<span>' + (c.date || 'Hace un momento') + '</span>' +
      '</div>' +
      '<div class="lector-comment-content">' + c.text + '</div>' +
    '</div>'
  ).join('');
}

async function addReaderComment(mangaId, chapterNum) {
  if (!state.currentUser) { showToast("Debes iniciar sesión para comentar."); return; }

  var textInput = document.getElementById('reader-comment-text');
  if (!textInput) return;
  var text = textInput.value.trim();
  if (!text) { showToast("Escribe un comentario antes de enviar."); return; }

  var key = mangaId + '_' + chapterNum;
  var author = state.currentUser.username;
  var isStaff = state.selectedManga && state.selectedManga.uploader === author;

  if (supabaseClient) {
    try {
      let { error } = await supabaseClient
        .from('comments')
        .insert([{
          manga_id: key,
          author: author,
          text: text,
          date: 'Ahora mismo',
          is_staff: isStaff
        }]);

      if (error) throw error;
      textInput.value = '';
      await renderReaderCommentsList(mangaId, chapterNum);
      showToast("Comentario publicado.");
      addXP(5);
    } catch (err) {
      console.warn("No se pudo subir el comentario del lector a Supabase:", err);
      saveReaderCommentLocalFallback(key, author, text, isStaff);
    }
  } else {
    saveReaderCommentLocalFallback(key, author, text, isStaff);
  }
}

function saveReaderCommentLocalFallback(key, author, text, isStaff) {
  var textInput = document.getElementById('reader-comment-text');
  if (!state.comments[key]) state.comments[key] = [];
  state.comments[key].unshift({ author: author, text: text, date: "Ahora mismo", is_staff: isStaff });
  saveState();
  if (textInput) textInput.value = '';
  renderReaderCommentsList(state.selectedManga.id, state.currentChapter);
  showToast("Comentario guardado localmente.");
  addXP(5);
}

// ── Modos de lectura ──
function changeReadingMode(mode) {
  state.readingMode = mode;
  var cascadeContainer = document.getElementById('reader-pages-cascade');
  var singleContainer = document.getElementById('reader-pages-single');

  if (mode === 'cascade') {
    cascadeContainer.style.display = 'flex';
    singleContainer.style.display = 'none';
    window.addEventListener('scroll', handleReaderScroll);
    jumpToPage(state.currentPageIndex);
  } else {
    cascadeContainer.style.display = 'none';
    singleContainer.style.display = 'block';
    window.removeEventListener('scroll', handleReaderScroll);
    updateSinglePageView();
  }
}

function changeReaderTheme(theme) {
  const container = document.querySelector('.lector-container');
  if (!container) return;
  
  if (theme === 'oled') {
    container.style.backgroundColor = '#000000';
    container.style.color = '#ffffff';
  } else if (theme === 'cream') {
    container.style.backgroundColor = '#fdf6e3';
    container.style.color = '#586e75';
  } else if (theme === 'light') {
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#333333';
  } else { // dark
    container.style.backgroundColor = '#1a1a1a';
    container.style.color = '#ffffff';
  }
}

function handlePageSelect(val) {
  state.currentPageIndex = parseInt(val);
  if (state.readingMode === 'cascade') {
    jumpToPage(state.currentPageIndex);
  } else {
    updateSinglePageView();
  }
}

function jumpToPage(pageNum) {
  var el = document.getElementById('page-' + pageNum);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function updateSinglePageView() {
  document.querySelectorAll('.lector-page-single').forEach(function(p, idx) {
    // Si es un lector de imagen real, el display se maneja de otra forma
    if (p.tagName === 'IMG') {
      p.style.display = (idx + 1) === state.currentPageIndex ? 'block' : 'none';
    } else {
      p.classList.toggle('active', (idx + 1) === state.currentPageIndex);
    }
  });
  var dropdown = document.getElementById('page-select');
  if (dropdown) dropdown.value = state.currentPageIndex;
  var indicator = document.getElementById('single-page-indicator');
  if (indicator) indicator.textContent = 'Página ' + state.currentPageIndex + ' / ' + state.totalPagesCount;
  window.scrollTo({ top: 0 });
}

function prevSinglePage() {
  if (state.currentPageIndex > 1) { state.currentPageIndex--; updateSinglePageView(); }
}

function nextSinglePage() {
  if (state.currentPageIndex < state.totalPagesCount) { state.currentPageIndex++; updateSinglePageView(); }
  else { showToast("¡Has llegado al final de este capítulo!"); }
}

function handleReaderScroll() {
  if (state.readingMode !== 'cascade') return;
  var dropdown = document.getElementById('page-select');
  if (!dropdown) return;
  document.querySelectorAll('#reader-pages-cascade > div').forEach(function(el, index) {
    var rect = el.getBoundingClientRect();
    if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
      dropdown.value = index + 1;
      state.currentPageIndex = index + 1;
    }
  });
}

function changeChapter(num) {
  if (state.selectedManga && num >= 1 && num <= state.selectedManga.chapters) {
    openReader(num);
  }
}

function closeReader() {
  window.removeEventListener('scroll', handleReaderScroll);
  document.getElementById('reader-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  if (window.innerWidth > 768) document.getElementById('sidebar').style.display = 'block';
  window.scrollTo({ top: 0 });
  state.currentView = 'detail';
}

// ══════════════════════════════════════════════
// ── SUBIR MANGA ──
// ══════════════════════════════════════════════
function openUploadModal() {
  // Desmarcar todos los géneros
  document.querySelectorAll('input[name="up-genres-cb"]').forEach(cb => {
    cb.checked = false;
    toggleGenreCheckbox(cb);
  });

  // Resetear previsualización de portada
  var coverPreview = document.getElementById('up-cover-preview');
  var coverPreviewPlaceholder = document.getElementById('up-cover-preview-placeholder');
  if (coverPreview && coverPreviewPlaceholder) {
    coverPreview.src = '';
    coverPreview.style.display = 'none';
    coverPreviewPlaceholder.style.display = 'block';
  }

  // Limpiar inputs del formulario
  var form = document.querySelector('#upload-modal form');
  if (form) form.reset();

  // Asegurar que el select resetee la etiqueta de Estudio/Autor
  var authorInput = document.getElementById('up-author');
  if (authorInput && authorInput.previousElementSibling) {
    authorInput.previousElementSibling.textContent = 'Autor:';
    authorInput.placeholder = 'Ej: Chugong';
  }

  openModal('upload-modal');
}

async function doUpload(e) {
  e.preventDefault();

  var title = document.getElementById('up-title').value.trim();
  var coverInput = document.getElementById('up-cover').value.trim();
  var fileInput = document.getElementById('up-cover-file');
  var type = document.getElementById('up-type').value;
  var author = document.getElementById('up-author').value.trim() || "Anónimo";
  var description = document.getElementById('up-desc').value.trim() || "Sin descripción.";
  var nsfw = document.getElementById('up-nsfw').checked;
  var uploaderName = state.currentUser ? state.currentUser.username : "Anónimo";

  var genres = [];
  var checkedCbs = document.querySelectorAll('input[name="up-genres-cb"]:checked');
  checkedCbs.forEach(function(cb) {
    genres.push(cb.value);
  });
  if (genres.length === 0) {
    showToast("Debes seleccionar al menos un género.");
    var selector = document.getElementById('up-genres-selector');
    if (selector) {
      selector.style.outline = '2px solid #e74c3c';
      selector.style.borderRadius = '4px';
      setTimeout(function() { selector.style.outline = 'none'; }, 3000);
    }
    return;
  }

  async function saveManga(finalCover) {
    var newManga = {
      title: title,
      type: type,
      author: author,
      cover: finalCover,
      rating: 5.0,
      chapters: 0,
      chapters_data: {},
      status: "En emisión",
      views: 0,
      genres: genres,
      description: description,
      year: new Date().getFullYear(),
      uploader: uploaderName,
      lang: "ES",
      nsfw: nsfw
    };

    if (supabaseClient) {
      showToast("Publicando en la base de datos en tiempo real...");
      try {
        let { data, error } = await supabaseClient
          .from('catalog')
          .insert([newManga])
          .select();
        
        if (error) throw error;
        showToast('¡"' + title + '" publicado en tiempo real con éxito!');
        await syncWithSupabase();
      } catch (err) {
        console.error("Error al subir a Supabase:", err);
        showToast("Error de conexión. Se guardó localmente.");
        saveLocalFallback(newManga);
      }
    } else {
      saveLocalFallback(newManga);
    }

    closeModal('upload-modal');
    e.target.reset();
  }

  function saveLocalFallback(newManga) {
    newManga.id = Date.now();
    newManga.chaptersData = {};
    newManga.views = "100";
    state.catalog.unshift(newManga);
    saveState();
    updateStats();
    renderGenres();
    renderFeatured();
    renderGrid();
    renderSidebarStats();
    showToast('¡"' + title + '" publicado localmente con éxito!');
  }

  // Si el usuario subió un archivo local
  if (fileInput.files && fileInput.files[0]) {
    showToast("Subiendo portada a ImgBB...");
    try {
      var coverUrl = await uploadToImgBB(fileInput.files[0]);
      await saveManga(coverUrl);
    } catch (err) {
      console.error("Error subiendo portada a ImgBB:", err);
      showToast("Fallo al subir la portada a ImgBB. Usando portada genérica.");
      var colors = ['2c3e50', '8e44ad', '27ae60', 'e74c3c', '34495e', 'f39c12', 'c0392b', 'd35400', '16a085', '2980b9'];
      var randomColor = colors[Math.floor(Math.random() * colors.length)];
      var fallbackCover = 'https://placehold.co/300x420/' + randomColor + '/ffffff?text=' + encodeURIComponent(title.substring(0, 20));
      await saveManga(fallbackCover);
    }
  } else {
    var coverUrl = coverInput;
    if (!coverUrl) {
      var colors = ['2c3e50', '8e44ad', '27ae60', 'e74c3c', '34495e', 'f39c12', 'c0392b', 'd35400', '16a085', '2980b9'];
      var randomColor = colors[Math.floor(Math.random() * colors.length)];
      coverUrl = 'https://placehold.co/300x420/' + randomColor + '/ffffff?text=' + encodeURIComponent(title.substring(0, 20));
    }
    await saveManga(coverUrl);
  }
}

// ── Subir Capítulo (con Drag & Drop y Previsualizaciones) ──

// Array global que almacena los dataURLs de las páginas seleccionadas
var upchSelectedPages = [];

function openUploadChapterModal() {
  if (!state.selectedManga) return;

  // Resetear estado previo
  upchSelectedPages = [];
  document.getElementById('upch-manga-title').value = state.selectedManga.title;
  
  // Auto-sugerir el siguiente capítulo/episodio
  var nextChap = (state.selectedManga.chapters || 0) + 1;
  document.getElementById('upch-num').value = nextChap;

  // Limpiar previsualizaciones
  document.getElementById('upch-preview-grid').innerHTML = '';
  document.getElementById('upch-page-count').style.display = 'none';
  document.getElementById('upch-page-count').textContent = '';
  document.getElementById('upch-progress-wrap').style.display = 'none';
  
  // Limpiar el input de archivo
  document.getElementById('upch-files').value = '';

  const isAnime = state.selectedManga.type === 'anime';

  // Adaptar textos y atributos si es Anime
  const modalHeader = document.querySelector('#upload-chapter-modal .modal-header span');
  if (modalHeader) {
    modalHeader.textContent = isAnime ? 'Subir Nuevo Episodio' : 'Subir Nuevo Capítulo';
  }

  const mangaLabel = document.querySelector('#upload-chapter-modal label');
  if (mangaLabel) {
    mangaLabel.textContent = isAnime ? 'Anime:' : 'Manga / Manhwa:';
  }

  const numInput = document.getElementById('upch-num');
  if (numInput && numInput.previousElementSibling) {
    numInput.previousElementSibling.textContent = isAnime ? 'Episodio Nº:' : 'Capítulo Nº:';
    numInput.placeholder = isAnime ? 'Ej: 12' : 'Ej: 15';
  }

  const nameInput = document.getElementById('upch-name');
  if (nameInput && nameInput.previousElementSibling) {
    nameInput.previousElementSibling.textContent = isAnime ? 'Título del Episodio (Opcional):' : 'Título del Capítulo (Opcional):';
    nameInput.placeholder = isAnime ? 'Ej: "El despertar de la bestia"' : 'Ej: "El despertar del héroe"';
  }

  const fileInput = document.getElementById('upch-files');
  if (fileInput) {
    fileInput.accept = isAnime ? 'video/*' : 'image/*,.zip';
    fileInput.multiple = !isAnime;
  }

  const dropzoneLabel = fileInput ? fileInput.parentNode.previousElementSibling : null;
  if (dropzoneLabel) {
    dropzoneLabel.textContent = isAnime ? 'Archivo de Video:' : 'Páginas del Capítulo:';
  }

  const dropzoneText = document.querySelector('#upch-dropzone .upch-dropzone-text');
  if (dropzoneText) {
    dropzoneText.innerHTML = isAnime ? '<strong>Arrastra el archivo de video (.mp4, .webm) aquí</strong>' : '<strong>Arrastra las imágenes o un archivo .ZIP aquí</strong>';
  }

  const dropzoneIcon = document.querySelector('#upch-dropzone .upch-dropzone-icon');
  if (dropzoneIcon) {
    dropzoneIcon.innerHTML = isAnime ? 
      '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #7f8c8d; margin-bottom: 8px;"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>' : 
      '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #7f8c8d; margin-bottom: 8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>';
  }

  const clickHint = document.getElementById('upch-dropzone-click-hint');
  if (clickHint) {
    clickHint.textContent = isAnime ? 'o haz clic para seleccionar el video desde tu dispositivo' : 'o haz clic para seleccionarlos desde tu dispositivo';
  }

  const formatHint = document.getElementById('upch-dropzone-format-hint');
  if (formatHint) {
    formatHint.textContent = isAnime ? 'Acepta formatos MP4, WebM y Ogg' : 'Acepta JPG, PNG, WebP o archivos comprimidos ZIP';
  }

  const pagesTextarea = document.getElementById('upch-pages');
  if (pagesTextarea) {
    pagesTextarea.placeholder = isAnime ? 'https://ejemplo.com/episodio1.mp4\no enlace de YouTube' : 'https://i.imgur.com/pag1.jpg\nhttps://i.imgur.com/pag2.jpg';
    var summaryText = pagesTextarea.parentNode.querySelector('summary');
    if (summaryText) {
      summaryText.innerHTML = isAnime ? 
        '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; color: #7f8c8d;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>O pega el enlace de video (alternativa)' : 
        '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; color: #7f8c8d;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>O pega URLs de imágenes (alternativa)';
    }
  }

  const submitBtn = document.getElementById('upch-submit-btn');
  if (submitBtn) {
    submitBtn.textContent = isAnime ? 'Publicar Episodio' : 'Publicar Capítulo';
  }

  openModal('upload-chapter-modal');

  // Configurar drag & drop en la zona
  var dropzone = document.getElementById('upch-dropzone');

  // Cambio de archivos por clic
  if (fileInput) {
    fileInput.onchange = function() {
      processUpchFiles(this.files);
    };
  }

  // Eventos drag & drop
  if (dropzone) {
    dropzone.ondragover = function(ev) {
      ev.preventDefault();
      dropzone.classList.add('drag-over');
    };
    dropzone.ondragleave = function() {
      dropzone.classList.remove('drag-over');
    };
    dropzone.ondrop = function(ev) {
      ev.preventDefault();
      dropzone.classList.remove('drag-over');
      processUpchFiles(ev.dataTransfer.files);
    };
  }
}

// Procesa los archivos de imagen seleccionados (o archivo ZIP) y genera miniaturas
async function processUpchFiles(files) {
  if (!files || files.length === 0) return;

  var progressWrap = document.getElementById('upch-progress-wrap');
  var progressBar = document.getElementById('upch-progress-bar');
  var progressText = document.getElementById('upch-progress-text');
  var countEl = document.getElementById('upch-page-count');
  var previewGrid = document.getElementById('upch-preview-grid');

  let filesArray = Array.from(files);

  const isAnime = state.selectedManga && state.selectedManga.type === 'anime';

  if (isAnime) {
    const videoFile = filesArray[0];
    if (!videoFile.type.startsWith('video/')) {
      showToast("Por favor selecciona un archivo de video válido (.mp4, .webm).");
      return;
    }
    
    upchSelectedPages = [videoFile];
    
    progressWrap.style.display = 'block';
    progressBar.style.width = '100%';
    progressBar.style.background = '#27ae60';
    progressText.textContent = '✅ Video listo para publicar.';
    countEl.textContent = '✅ Video seleccionado: ' + videoFile.name;
    countEl.style.display = 'block';
    previewGrid.innerHTML = '';
    
    var wrap = document.createElement('div');
    wrap.className = 'upch-thumb-wrap video-preview';
    wrap.style.width = '120px';
    wrap.style.height = '80px';
    
    var objectUrl = URL.createObjectURL(videoFile);
    wrap.innerHTML = '<video src="' + objectUrl + '" style="width:100%; height:100%; object-fit:cover; border-radius:3px;"></video>' +
      '<span class="upch-thumb-num" style="font-size:9px;">Vista previa</span>' +
      '<button class="upch-thumb-del" type="button" onclick="removeUpchPage(0)" title="Quitar">✕</button>';
    previewGrid.appendChild(wrap);
    return;
  }

  // 1. Si es un único archivo ZIP, descomprimirlo
  if (filesArray.length === 1 && filesArray[0].name.toLowerCase().endsWith('.zip')) {
    progressWrap.style.display = 'block';
    progressBar.style.width = '20%';
    progressBar.style.background = '#3498db';
    progressText.textContent = 'Leyendo archivo ZIP...';
    
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(filesArray[0]);
      
      // Filtrar por imágenes omitiendo carpetas del sistema
      const imgNames = Object.keys(loadedZip.files).filter(name => {
        return !loadedZip.files[name].dir && /\.(png|jpe?g|webp|gif)$/i.test(name) && !name.includes('__MACOSX');
      }).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      if (imgNames.length === 0) {
        showToast("El archivo ZIP no contiene imágenes válidas.");
        progressWrap.style.display = 'none';
        return;
      }

      progressText.textContent = 'Descomprimiendo ' + imgNames.length + ' imágenes...';
      const filePromises = imgNames.map(async (name, index) => {
        const zipFile = loadedZip.file(name);
        const blob = await zipFile.async("blob");
        var pct = 20 + Math.round((index / imgNames.length) * 60);
        progressBar.style.width = pct + '%';
        return new File([blob], name, { type: blob.type });
      });

      filesArray = await Promise.all(filePromises);
      progressBar.style.width = '80%';
    } catch (zipErr) {
      console.error("Error al descomprimir el archivo ZIP:", zipErr);
      showToast("No se pudo leer el archivo ZIP.");
      progressWrap.style.display = 'none';
      return;
    }
  }

  // 2. Ordenar por nombre para asegurar secuencia de lectura correcta
  filesArray.sort(function(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  upchSelectedPages = filesArray;

  progressWrap.style.display = 'block';
  progressBar.style.width = '100%';
  progressBar.style.background = '#27ae60';
  progressText.textContent = '✅ ' + filesArray.length + ' páginas listas para publicar.';
  countEl.textContent = '✅ ' + filesArray.length + ' páginas seleccionadas.';
  countEl.style.display = 'block';
  previewGrid.innerHTML = '';

  // Renderizar las miniaturas usando Object URL (más rápido y ligero)
  filesArray.forEach(function(file, idx) {
    var wrap = document.createElement('div');
    wrap.className = 'upch-thumb-wrap';
    wrap.id = 'upch-thumb-' + idx;
    
    var objectUrl = URL.createObjectURL(file);
    wrap.innerHTML = '<img src="' + objectUrl + '" alt="Pág ' + (idx + 1) + '">' +
      '<span class="upch-thumb-num">Pág. ' + (idx + 1) + '</span>' +
      '<button class="upch-thumb-del" type="button" onclick="removeUpchPage(' + idx + ')" title="Quitar">✕</button>';
    previewGrid.appendChild(wrap);
  });
}

// Quitar una página individual de la selección
function removeUpchPage(idx) {
  upchSelectedPages[idx] = null;
  var wrap = document.getElementById('upch-thumb-' + idx);
  if (wrap) wrap.style.opacity = '0.3';
  var remaining = upchSelectedPages.filter(function(p) { return p !== null; }).length;
  document.getElementById('upch-page-count').textContent = '✅ ' + remaining + ' páginas seleccionadas.';
}


async function doUploadChapter(e) {
  e.preventDefault();
  if (!state.selectedManga) return;

  var num = parseInt(document.getElementById('upch-num').value);
  var pagesText = document.getElementById('upch-pages').value.trim();
  var fileInput = document.getElementById('upch-files');
  
  var manga = state.catalog.find(function(m) { return m.id === state.selectedManga.id; });
  if (!manga) return;

  const isAnime = manga.type === 'anime';

  async function saveChapter(pagesArray) {
    if (pagesArray.length === 0) {
      var itemLabel = isAnime ? 'video' : 'página';
      showToast("Debes ingresar al menos un " + itemLabel + " (archivo o enlace).");
      return;
    }

    if (supabaseClient) {
      var dbLabel = isAnime ? 'episodio' : 'capítulo';
      showToast("Guardando " + dbLabel + " en la base de datos...");
      try {
        var updatedChaptersData = manga.chaptersData || {};
        updatedChaptersData[num] = pagesArray;

        var totalChapters = manga.chapters;
        if (num > totalChapters) {
          totalChapters = num;
        }

        let { error } = await supabaseClient
          .from('catalog')
          .update({ 
            chapters: totalChapters, 
            chapters_data: updatedChaptersData 
          })
          .eq('id', manga.id);

        if (error) throw error;
        showToast('¡' + (isAnime ? 'Episodio ' : 'Capítulo ') + num + ' publicado en tiempo real con éxito!');
        await syncWithSupabase();
        
        // Volver a cargar vista de detalle
        showDetail(manga.id);
      } catch (err) {
        console.error("Error subiendo contenido a Supabase:", err);
        showToast("Error. Guardado en caché local.");
        saveChapterLocalFallback(pagesArray);
      }
    } else {
      saveChapterLocalFallback(pagesArray);
    }

    closeModal('upload-chapter-modal');
    e.target.reset();
  }

  function saveChapterLocalFallback(pagesArray) {
    if (!manga.chaptersData) manga.chaptersData = {};
    manga.chaptersData[num] = pagesArray;

    if (num > manga.chapters) {
      manga.chapters = num;
    }

    state.selectedManga = manga;
    saveState();
    showDetail(manga.id);
    updateStats();
    renderSidebarStats();
    showToast('¡' + (isAnime ? 'Episodio ' : 'Capítulo ') + num + ' publicado localmente con éxito!');
  }

  var pagesList = [];
  var cachedPages = upchSelectedPages.filter(function(p) { return p !== null && p !== undefined; });
  
  if (isAnime) {
    if (cachedPages.length > 0) {
      // Archivo de video local
      var videoFile = cachedPages[0];
      var progressWrap = document.getElementById('upch-progress-wrap');
      var progressBar = document.getElementById('upch-progress-bar');
      var progressText = document.getElementById('upch-progress-text');

      progressWrap.style.display = 'block';
      progressBar.style.width = '30%';
      progressBar.style.background = '#e67e22';
      progressText.textContent = 'Procesando y optimizando video...';
      
      setTimeout(async function() {
        progressBar.style.width = '70%';
        progressText.textContent = 'Simulando subida al CDN de video...';
        
        setTimeout(async function() {
          progressBar.style.width = '100%';
          progressBar.style.background = '#27ae60';
          progressText.textContent = '✅ ¡Video subido con éxito!';
          
          var objectUrl = URL.createObjectURL(videoFile);
          await saveChapter([objectUrl]);
        }, 800);
      }, 700);
    } else {
      // Enlace pegado
      if (pagesText) {
        pagesList = [pagesText.split('\n')[0].trim()];
      }
      await saveChapter(pagesList);
    }
  } else {
    // Es manga: subir imágenes a ImgBB
    if (cachedPages.length > 0) {
      var progressWrap = document.getElementById('upch-progress-wrap');
      var progressBar = document.getElementById('upch-progress-bar');
      var progressText = document.getElementById('upch-progress-text');

      progressWrap.style.display = 'block';
      progressBar.style.background = '#e67e22';
      
      var uploadedUrls = [];
      try {
        for (var i = 0; i < cachedPages.length; i++) {
          var file = cachedPages[i];
          progressText.textContent = 'Subiendo página ' + (i + 1) + ' de ' + cachedPages.length + ' a ImgBB...';
          var pct = Math.round((i / cachedPages.length) * 100);
          progressBar.style.width = pct + '%';
          
          var imgUrl = await uploadToImgBB(file);
          uploadedUrls.push(imgUrl);
        }
        
        progressBar.style.width = '100%';
        progressBar.style.background = '#27ae60';
        progressText.textContent = '✅ ¡Imágenes subidas a ImgBB con éxito!';
        
        await saveChapter(uploadedUrls);
      } catch (err) {
        console.error("Error al subir páginas a ImgBB:", err);
        showToast("Fallo al subir a ImgBB. Revisa tu conexión.");
        progressBar.style.background = '#c0392b';
        progressText.textContent = '❌ Error de subida a ImgBB.';
      }
    } else {
      if (pagesText) {
        pagesList = pagesText.split('\n').map(function(line) { return line.trim(); }).filter(function(line) { return line !== ""; });
      }
      await saveChapter(pagesList);
    }
  }
}

// ══════════════════════════════════════════════
// ── NAVEGACIÓN ──
// ══════════════════════════════════════════════
function goHome() {
  state.selectedManga = null;
  state.currentView = 'catalog';
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('reader-view').style.display = 'none';
  document.getElementById('catalog-view').style.display = 'block';
  
  var libView = document.getElementById('library-view');
  if (libView) libView.style.display = 'none';

  var recSec = document.getElementById('rec-section');
  if (recSec) recSec.style.display = 'block';
  var histSec = document.getElementById('history-section-el');
  if (histSec) histSec.style.display = 'block';

  // Cerrar menú móvil
  var menu = document.getElementById('nav-links-menu');
  if (menu) menu.classList.remove('show');

  // Ajustar enlaces de navegación activos
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  var allNavs = document.querySelectorAll('.nav-link');
  // Encontrar el link que recarga "Inicio"
  allNavs.forEach(function(l) {
    if (l.textContent.trim() === "Inicio") {
      l.classList.add('active');
    }
  });

  renderHistory();
  document.getElementById('sidebar').style.display = window.innerWidth > 768 ? 'block' : 'none';
  renderGrid();
  window.scrollTo({ top: 0 });
}

// ── Control del Menú Hamburguesa Móvil ──
function toggleMobileMenu() {
  var menu = document.getElementById('nav-links-menu');
  if (menu) {
    menu.classList.toggle('show');
  }
}


// ══════════════════════════════════════════════
// ── SOPORTE Y REPORTES ──
// ══════════════════════════════════════════════
function doContact(e) {
  e.preventDefault();
  closeModal('contact-modal');
  e.target.reset();
  showToast("¡Mensaje enviado con éxito a soporte!");
}

function doReportChapter(e) {
  e.preventDefault();
  closeModal('report-modal');
  e.target.reset();
  if (state.selectedManga) {
    showToast('Reporte enviado: Capítulo ' + state.currentChapter + ' de ' + state.selectedManga.title);
  }
}

// ══════════════════════════════════════════════
// ── DESCARGA SIMULADA ──
// ══════════════════════════════════════════════
function startDownloadSimulation() {
  if (!state.selectedManga) return;

  openModal('download-modal');
  var progressBar = document.getElementById('download-progress-bar');
  var statusText = document.getElementById('download-status');
  if (!progressBar || !statusText) return;

  progressBar.style.width = '0%';
  statusText.textContent = 'Buscando servidores de descarga...';

  var progress = 0;
  var interval = setInterval(function() {
    progress += Math.floor(Math.random() * 15) + 5;
    if (progress > 100) progress = 100;
    progressBar.style.width = progress + '%';

    if (progress < 30) statusText.textContent = 'Conectando con el mirror...';
    else if (progress < 60) statusText.textContent = 'Comprimiendo capítulos en ZIP...';
    else if (progress < 90) statusText.textContent = 'Generando enlace directo...';
    else if (progress === 100) {
      statusText.textContent = '¡Descarga completa!';
      clearInterval(interval);
      setTimeout(function() {
        closeModal('download-modal');
        showToast("Archivo TuManhwaOnline_Pack.zip descargado (Simulación)");

        var element = document.createElement('a');
        var fileContent = 'TuManhwaOnline - Info\nTítulo: ' + state.selectedManga.title + '\nAutor: ' + state.selectedManga.author + '\nCapítulos: ' + state.selectedManga.chapters + '\n¡Gracias por la comunidad de TuManhwaOnline!';
        var file = new Blob([fileContent], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = state.selectedManga.title.replace(/\s+/g, '_') + '_TuManhwaOnline.txt';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }, 1000);
    }
  }, 350);
}

// ══════════════════════════════════════════════
// ── UTILIDADES ──
// ══════════════════════════════════════════════
function updateStats() {
  var titles = state.catalog.length;
  var chapters = 0;
  var contributors = {};
  state.catalog.forEach(function(m) {
    chapters += m.chapters;
    contributors[m.uploader] = true;
  });

  var el1 = document.getElementById('stat-titles');
  var el2 = document.getElementById('stat-chapters');
  var el3 = document.getElementById('stat-users');
  if (el1) el1.textContent = titles;
  if (el2) el2.textContent = chapters.toLocaleString();
  if (el3) el3.textContent = Object.keys(contributors).length;
}

// ── Render de listas de la Barra Lateral (Sidebar) ──
function renderSidebarStats() {
  try {
    var topViewsContainer = document.getElementById("sidebar-top-views");
    var newUploadsContainer = document.getElementById("sidebar-new-uploads");
    if (!topViewsContainer || !newUploadsContainer) return;

    var catalogCopy = state.catalog.slice();

    // 1. Los Mas Vistos (Top Visitas)
    var topViews = catalogCopy.sort(function(a, b) {
      return (b.views || 0) - (a.views || 0);
    }).slice(0, 5);

    if (topViews.length === 0) {
      topViewsContainer.innerHTML = '<li style="padding: 10px 12px; color: #7f8c8d; font-size: 11px; text-align: center;">Sin registros.</li>';
    } else {
      topViewsContainer.innerHTML = topViews.map(function(m, index) {
        var mTitle = m.title || "Sin titulo";
        var mViews = m.views || 0;
        return '<li class="sidebar-item" onclick="showDetail(' + m.id + ')">' +
          '<span class="sidebar-item-num">' + (index + 1) + '</span>' +
          '<span class="sidebar-item-title">' + mTitle + '</span>' +
          '<span class="sidebar-item-meta">' + formatViews(mViews) + '</span>' +
        '</li>';
      }).join('');
    }

    // 2. Recien Subidos (Ultimos agregados)
    var newUploads = state.catalog.slice().sort(function(a, b) {
      return b.id - a.id;
    }).slice(0, 5);

    if (newUploads.length === 0) {
      newUploadsContainer.innerHTML = '<li style="padding: 10px 12px; color: #7f8c8d; font-size: 11px; text-align: center;">Sin registros.</li>';
    } else {
      newUploadsContainer.innerHTML = newUploads.map(function(m) {
        var mTitle = m.title || "Sin titulo";
        var mType = m.type || "manga";
        return '<li class="sidebar-item" onclick="showDetail(' + m.id + ')">' +
          '<span class="sidebar-item-title">' + mTitle + '</span>' +
          '<span class="sidebar-item-meta" style="background-color:#e8f8f5; color:#117a65;">' + mType.toUpperCase() + '</span>' +
        '</li>';
      }).join('');
    }
  } catch (err) {
    console.error("Error al renderizar barra lateral de estadisticas:", err);
  }
}

function addXP(amount) {
  if (!state.currentUser) return;
  
  if (state.currentUser.xp === undefined) state.currentUser.xp = 0;
  if (state.currentUser.level === undefined) state.currentUser.level = 1;
  
  state.currentUser.xp += amount;
  
  let newLevel = 1;
  const xp = state.currentUser.xp;
  if (xp >= 700) newLevel = 5;
  else if (xp >= 350) newLevel = 4;
  else if (xp >= 150) newLevel = 3;
  else if (xp >= 50) newLevel = 2;
  
  if (newLevel > state.currentUser.level) {
    state.currentUser.level = newLevel;
    showToast(`¡Subiste de Nivel! Ahora eres Nivel ${newLevel} [${getUserRankName(newLevel)}]`);
  }
  
  saveState();
  renderAuth();
  
  var profileModal = document.getElementById('profile-modal');
  if (profileModal && profileModal.style.display === 'flex') {
    openProfileModal();
  }
}

function getUserRankName(lvl) {
  switch(lvl) {
    case 1: return "Novato";
    case 2: return "Lector Aprendiz";
    case 3: return "Explorador de Mazmorras";
    case 4: return "Otaku Consagrado";
    case 5: return "Leyenda del Manhwa";
    default: return "Novato";
  }
}

function formatViews(views) {
  var v = parseInt(views || 0);
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v + ' vis';
}

function showToast(msg) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(function() { toast.style.display = 'none'; }, 2500);
}

function debounce(fn, delay) {
  var timer;
  return function() {
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(null, args); }, delay);
  };
}

// ── Helper para Subir Imágenes a ImgBB ──
async function uploadToImgBB(fileOrBase64) {
  const formData = new FormData();
  if (typeof fileOrBase64 === 'string') {
    const cleanBase64 = fileOrBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    formData.append('image', cleanBase64);
  } else {
    formData.append('image', fileOrBase64);
  }

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Error en subida a ImgBB: ${response.statusText}`);
  }

  const json = await response.json();
  if (json && json.data && json.data.url) {
    return json.data.url;
  } else {
    throw new Error("Respuesta inválida de ImgBB");
  }
}

// ══════════════════════════════════════════════
// ── REPRODUCTOR DE VIDEO DE ANIME (PREMIUM) ──
// ══════════════════════════════════════════════

function getYoutubeId(url) {
  var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  var match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function changeEpisode(num) {
  if (state.selectedManga && num >= 1 && num <= state.selectedManga.chapters) {
    openVideoPlayer(state.selectedManga.id, num);
  }
}

function toggleTheaterMode() {
  const container = document.getElementById('player-container');
  if (container) {
    container.classList.toggle('theater');
    showToast(container.classList.contains('theater') ? "🎭 Modo Cine activado" : "Modo Cine desactivado");
  }
}

async function openVideoPlayer(mangaId, episodeNum) {
  var manga = state.catalog.find(m => m.id === mangaId);
  if (!manga) return;

  state.currentView = 'reader';
  state.currentChapter = episodeNum;
  addToHistory(manga, episodeNum);

  if (!state.readChapters[manga.id]) state.readChapters[manga.id] = [];
  if (state.readChapters[manga.id].indexOf(episodeNum) === -1) {
    state.readChapters[manga.id].push(episodeNum);
    saveState();
    addXP(10);
  }

  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  var readerView = document.getElementById('reader-view');
  readerView.style.display = 'block';

  // Buscar vídeo del episodio
  var videoUrl = "";
  if (manga.chaptersData && manga.chaptersData[episodeNum]) {
    videoUrl = manga.chaptersData[episodeNum][0] || "";
  }

  // Fallback si no hay video subido: usar un video de muestra
  var isDemo = false;
  if (!videoUrl) {
    isDemo = true;
    const demoVideos = [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutback.mp4"
    ];
    videoUrl = demoVideos[(episodeNum - 1) % demoVideos.length];
  }

  var dropdownOptions = '';
  for (var i = 1; i <= manga.chapters; i++) {
    var isSelected = i === episodeNum ? ' selected' : '';
    dropdownOptions += '<option value="' + i + '"' + isSelected + '>Episodio ' + i + '</option>';
  }

  var prevDisabled = episodeNum <= 1 ? ' disabled style="opacity:0.5; cursor:not-allowed;"' : '';
  var nextDisabled = episodeNum >= manga.chapters ? ' disabled style="opacity:0.5; cursor:not-allowed;"' : '';

  var isYoutube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") || videoUrl.includes("youtube-nocookie.com");
  var videoEmbedHTML = "";

  if (isYoutube) {
    var ytId = getYoutubeId(videoUrl);
    videoEmbedHTML = '<iframe class="anime-iframe" src="https://www.youtube.com/embed/' + ytId + '?autoplay=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
  } else {
    videoEmbedHTML = 
      '<video id="anime-custom-player" class="anime-custom-player" src="' + videoUrl + '" autoplay controls>' +
        'Tu navegador no soporta reproducción de video.' +
      '</video>';
  }

  var commentFormHTML = '';
  if (state.currentUser) {
    commentFormHTML = `
      <div class="comment-input-area">
        <textarea id="reader-comment-text" placeholder="¿Qué te pareció este episodio?"></textarea>
        <button class="btn-comentar" onclick="addReaderComment(${manga.id}, ${episodeNum})">Enviar</button>
      </div>
    `;
  } else {
    commentFormHTML = `
      <div class="lector-comment-lock">
        <span>Debes <strong>iniciar sesión</strong> para dejar comentarios en los episodios.</span>
        <button class="btn-classic-red" onclick="openModal('login-modal')">Iniciar Sesión / Registrarse</button>
      </div>
    `;
  }

  readerView.innerHTML = `
    <div class="anime-player-wrapper">
      <div class="player-header-bar">
        <div class="player-header-left">
          <span class="player-show-title">${manga.title}</span>
          <span class="player-episode-tag">Episodio ${episodeNum}</span>
          ${isDemo ? '<span class="demo-tag" title="Este es un video de demostración gratuito para pruebas">DEMO</span>' : ''}
        </div>
        <div class="player-header-right">
          <button class="btn-classic-grey btn-theater-mode" onclick="toggleTheaterMode()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; color: #fff;"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>Modo Cine</button>
          <button class="btn-reportar-error" onclick="openModal('report-modal')"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; color: #fff;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>Reportar</button>
          <button class="btn-cerrar-lector" onclick="closeReader()">✕ Cerrar</button>
        </div>
      </div>

      <div class="player-view-container" id="player-container">
        <div class="video-container-aspect">
          ${videoEmbedHTML}
        </div>
      </div>

      <div class="player-navigation-controls">
        <div class="nav-control-left">
          <button class="btn-classic-grey" onclick="changeEpisode(${episodeNum - 1})" ${prevDisabled}>← Anterior</button>
        </div>
        <div class="nav-control-center">
          <select id="player-episode-select" class="player-select" onchange="changeEpisode(parseInt(this.value))">
            ${dropdownOptions}
          </select>
        </div>
        <div class="nav-control-right">
          <button class="btn-classic-red" onclick="changeEpisode(${episodeNum + 1})" ${nextDisabled}>Siguiente →</button>
        </div>
      </div>

      <div class="lector-comments">
        <div class="lector-comments-title">Comentarios del Episodio ${episodeNum}</div>
        <div class="lector-comment-form">
          ${commentFormHTML}
        </div>
        <div class="lector-comments-list" id="reader-comments-list"></div>
      </div>
    </div>
  `;

  renderReaderCommentsList(manga.id, episodeNum);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getDefaultSeedCatalog() {
  return [
    {
      id: 1,
      title: "Solo Leveling",
      type: "manhwa",
      author: "Chugong",
      cover: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80",
      rating: 4.9,
      chapters: 3,
      chapters_data: {
        1: ["placeholder", "placeholder"],
        2: ["placeholder", "placeholder"],
        3: ["placeholder", "placeholder"]
      },
      status: "Completado",
      views: 12500,
      genres: ["Acción", "Aventura", "Fantasía"],
      description: "En un mundo donde cazadores deben luchar contra monstruos para proteger a la humanidad, Sung Jin-Woo, el cazador más débil de todos, encuentra un sistema secreto que le permite subir de nivel ilimitadamente.",
      year: 2018,
      uploader: "System",
      lang: "ES",
      nsfw: false
    },
    {
      id: 2,
      title: "One Piece",
      type: "manga",
      author: "Eiichiro Oda",
      cover: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80",
      rating: 4.8,
      chapters: 2,
      chapters_data: {
        1: ["placeholder"],
        2: ["placeholder"]
      },
      status: "En emisión",
      views: 9800,
      genres: ["Aventura", "Comedia", "Fantasía"],
      description: "Monkey D. Luffy se niega a permitir que nadie se interponga en su camino para convertirse en el rey de los piratas. Con un barco y una tripulación, Luffy busca el legendario tesoro One Piece.",
      year: 1997,
      uploader: "System",
      lang: "ES",
      nsfw: false
    },
    {
      id: 3,
      title: "Demon Slayer (Anime)",
      type: "anime",
      author: "ufotable",
      cover: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&q=80",
      rating: 4.9,
      chapters: 3,
      chapters_data: {
        1: ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"],
        2: ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"],
        3: ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"]
      },
      status: "Completado",
      views: 24500,
      genres: ["Acción", "Aventura", "Fantasía", "Sobrenatural"],
      description: "Tanjiro Kamado lucha por salvar a su hermana Nezuko, convertida en demonio, y vengar a su familia asesinada por el rey de los demonios, Muzan Kibutsuji.",
      year: 2019,
      uploader: "ufotable",
      lang: "ES",
      nsfw: false
    },
    {
      id: 4,
      title: "Shinmai Maou no Testament (Zona +18)",
      type: "anime",
      author: "Production IMS",
      cover: "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=400&q=80",
      rating: 4.2,
      chapters: 2,
      chapters_data: {
        1: ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"],
        2: ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"]
      },
      status: "Completado",
      views: 18700,
      genres: ["Acción", "Fantasía", "Romance", "Sobrenatural", "Gore"],
      description: "Basara Toujo se ve obligado a convivir con dos hermanastras que resultan ser la nueva Reina Demonio y una súcubo protectora. Un anime lleno de acción, batallas sobrenaturales y romance subido de tono.",
      year: 2015,
      uploader: "System",
      lang: "ES",
      nsfw: true
    }
  ];
}


