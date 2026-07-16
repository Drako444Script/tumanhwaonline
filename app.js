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
  selectedManga: null,
  currentChapter: 1,
  readingMode: 'cascade',
  currentPageIndex: 1,
  totalPagesCount: 0,
  sortOrder: 'desc'
};

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
});

// ══════════════════════════════════════════════
// ── AUTENTICACIÓN ──
// ══════════════════════════════════════════════
function renderAuth() {
  const container = document.getElementById('auth-section');
  if (!container) return;

  if (state.currentUser) {
    container.innerHTML = `
      <span>Hola, <a href="#" onclick="openProfileModal(); return false;"><strong class="username-tag">${state.currentUser.username}</strong></a></span>
      <a href="#" class="logout-btn" onclick="logout(); return false;">Cerrar Sesión</a>
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

  if (state.currentUser.avatar && state.currentUser.avatar.trim() !== '') {
    avatarImg.src = state.currentUser.avatar;
    avatarImg.style.display = 'block';
    avatarDiv.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    avatarDiv.style.display = 'flex';
    avatarDiv.textContent = state.currentUser.username[0].toUpperCase();
  }

  // Info del usuario
  document.getElementById('profile-username').textContent = state.currentUser.username;
  document.getElementById('profile-email').textContent = state.currentUser.email;
  document.getElementById('profile-bio-text').textContent = state.currentUser.bio || 'Sin biografía.';

  // Estadísticas
  document.getElementById('profile-stat-read').textContent = totalRead;
  document.getElementById('profile-stat-library').textContent = libSize;
  document.getElementById('profile-stat-uploads').textContent = userUploads;

  // Pre-llenar formulario de edición
  document.getElementById('prof-display-name').value = state.currentUser.username;
  document.getElementById('prof-avatar-url').value = state.currentUser.avatar || '';
  document.getElementById('prof-bio').value = state.currentUser.bio || '';

  openModal('profile-modal');
}

function saveProfileSettings(e) {
  e.preventDefault();
  if (!state.currentUser) return;

  var newUsername = document.getElementById('prof-display-name').value.trim();
  var newAvatar = document.getElementById('prof-avatar-url').value.trim();
  var newBio = document.getElementById('prof-bio').value.trim();

  if (newUsername) {
    state.currentUser.username = newUsername;
    state.currentUser.avatar = newAvatar;
    state.currentUser.bio = newBio;
    saveState();
    renderAuth();
    showToast("¡Perfil guardado con éxito!");
    closeModal('profile-modal');
    refreshCurrentView();
  }
}

function doLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  if (username) {
    state.currentUser = { username, email: username + '@tumanhwaonline.com', avatar: '', bio: '' };
    saveState();
    renderAuth();
    closeModal('login-modal');
    showToast('¡Bienvenido de vuelta, ' + username + '!');
    refreshCurrentView();
  }
}

function doRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-user').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  if (username && email) {
    state.currentUser = { username, email, avatar: '', bio: '' };
    saveState();
    renderAuth();
    closeModal('register-modal');
    showToast('¡Cuenta registrada exitosamente, ' + username + '!');
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
function renderFeatured() {
  const mainCol = document.getElementById('main-content');
  if (!mainCol) return;

  const oldSec = document.getElementById('rec-section');
  if (oldSec) oldSec.remove();

  const available = state.catalog.filter(m => !m.nsfw || state.showNSFW);
  const featured = available.slice(0, 4);
  if (featured.length === 0) return;

  const recDiv = document.createElement('div');
  recDiv.id = 'rec-section';
  recDiv.className = 'recommended-section';
  recDiv.innerHTML = '<div class="recommended-title">Recomendaciones de la Semana</div><div class="recommended-grid">' +
    featured.map(m =>
      '<div class="recommended-item" onclick="showDetail(' + m.id + ')">' +
        '<img class="rec-cover" src="' + m.cover + '" alt="">' +
        '<div class="rec-info">' +
          '<div class="rec-title">' + m.title + '</div>' +
          '<div class="rec-meta">★ ' + m.rating + ' · ' + m.type.toUpperCase() + '</div>' +
        '</div>' +
      '</div>'
    ).join('') +
  '</div>';

  mainCol.insertBefore(recDiv, mainCol.firstChild);
}

// ══════════════════════════════════════════════
// ── GÉNEROS ──
// ══════════════════════════════════════════════
function renderGenres() {
  const container = document.getElementById('genre-list');
  if (!container) return;

  const counts = {};
  state.catalog.forEach(m => {
    if (m.nsfw && !state.showNSFW) return;
    m.genres.forEach(g => {
      counts[g] = (counts[g] || 0) + 1;
    });
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
  if (!state.showNSFW) {
    var confirmar = confirm("ADVERTENCIA: Esta sección contiene material exclusivo para adultos (+18) que puede incluir violencia o escenas explícitas.\n\n¿Confirmas que eres mayor de 18 años y deseas ingresar a la Zona +18?");
    if (!confirmar) {
      state.showNSFW = false;
      element.classList.remove('active');
      return;
    }
    state.showNSFW = true;
    element.classList.add('active');
    showToast("🔞 Has entrado a la Zona +18");
  } else {
    state.showNSFW = false;
    element.classList.remove('active');
    showToast("Saliste de la Zona +18");
  }
  renderFeatured();
  renderGenres();
  renderGrid();
}

// ══════════════════════════════════════════════
// ── RENDER CATÁLOGO (GRILLA) ──
// ══════════════════════════════════════════════
function renderGrid() {
  const grid = document.getElementById('manga-grid');
  if (!grid) return;

  let filtered = state.catalog.slice();

  if (!state.showNSFW) filtered = filtered.filter(m => !m.nsfw);
  if (state.filterType !== 'all') filtered = filtered.filter(m => m.type === state.filterType);
  if (state.filterGenre !== 'all') filtered = filtered.filter(m => m.genres && m.genres.includes(state.filterGenre));
  if (state.searchQuery) {
    filtered = filtered.filter(m =>
      m.title.toLowerCase().includes(state.searchQuery) ||
      m.author.toLowerCase().includes(state.searchQuery)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #7f8c8d;">No hay títulos que coincidan con los filtros seleccionados.</div>';
    return;
  }

  grid.innerHTML = filtered.map(m => {
    const libSection = state.library[m.id];
    const badgeHTML = libSection ? '<span class="library-badge ' + libSection + '">' + libSection + '</span>' : '';

    return '<div class="manga-card" onclick="showDetail(' + m.id + ')">' +
      '<div class="card-cover-wrap">' +
        '<img src="' + m.cover + '" alt="' + m.title + '" class="card-cover" onerror="this.src=\'https://placehold.co/300x420/555/fff?text=Sin+Portada\'">' +
        '<span class="badge-tipo">' + m.type + '</span>' +
        (m.nsfw ? '<span class="badge-nsfw">+18</span>' : '') +
      '</div>' +
      '<div class="card-title" title="' + m.title + '">' + m.title + ' ' + badgeHTML + '</div>' +
      '<div class="card-meta">' +
        '<span>★ ' + m.rating + '</span>' +
        '<span>Cap: ' + m.chapters + '</span>' +
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

  // Armar estrellas del rating
  var starsHtml = '';
  for (var s = 1; s <= 5; s++) {
    var activeStar = s <= Math.round(manga.rating || 5.0) ? '★' : '☆';
    starsHtml += '<span class="star-rating-btn" onclick="submitMangaRating(' + manga.id + ', ' + s + ')">' + activeStar + '</span>';
  }

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
            '<tr><td>Autor:</td><td>' + manga.author + '</td></tr>' +
            '<tr><td>Tipo:</td><td style="text-transform:uppercase;"><strong>' + manga.type + '</strong></td></tr>' +
            '<tr><td>Géneros:</td><td>' + manga.genres.join(', ') + '</td></tr>' +
            '<tr><td>Subido por:</td><td>' + manga.uploader + '</td></tr>' +
            '<tr><td>Biblioteca:</td><td>' + (libSection ? 'Guardado en: <strong>' + libSection.toUpperCase() + '</strong>' : 'No guardado') + '</td></tr>' +
            '<tr><td>Visitas totales:</td><td>🔥 ' + (manga.views || 0).toLocaleString() + ' vistas</td></tr>' +
            '<tr><td>Calificación:</td><td>★ ' + (manga.rating || 5.0).toFixed(1) + ' / 5.0</td></tr>' +
            '<tr><td>Puntuar obra:</td><td><div class="star-rating-wrap">' + starsHtml + '</div></td></tr>' +
          '</table>' +
          '<div class="detail-actions">' +
            '<button class="btn-classic-red" onclick="startReading()">Leer Primer Capítulo</button>' +
            '<button class="btn-classic-grey" onclick="openLibraryModal(' + manga.id + ')">' + (libSection ? '★ Cambiar Estado' : '☆ Agregar a Biblioteca') + '</button>' +
            '<button class="btn-classic-grey" onclick="startDownloadSimulation()">↓ Descargar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="detail-synopsis"><strong>Sinopsis:</strong><br><br>' + manga.description + '</div>' +
      '<div class="chapters-header-row">' +
        '<div class="section-title" style="margin-bottom:0; border:none; padding:0;">Lista de Capítulos</div>' +
        '<button class="btn-agregar-cap" onclick="openUploadChapterModal()">+ Agregar Capítulo</button>' +
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

  // Listeners de capítulos
  document.querySelectorAll('.chapter-row').forEach(row => {
    row.addEventListener('click', () => {
      var num = parseInt(row.getAttribute('data-chapter'));
      if (num) openReader(num);
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
    // Si tiene capítulos subidos, leer el primero. Si no, avisar.
    if (state.selectedManga.chapters >= 1) {
      openReader(1);
    } else {
      showToast("Aún no hay capítulos subidos para esta obra.");
    }
  }
}

function renderChaptersList(manga) {
  var html = '';
  var total = manga.chapters;
  
  if (total === 0) {
    return '<li style="padding:15px; color:#888; text-align:center; font-size:12px; list-style:none;">No hay capítulos todavía. ¡Sube el primero presionando "+ Agregar Capítulo"!</li>';
  }

  for (var i = 0; i < total; i++) {
    var num = state.sortOrder === 'desc' ? total - i : i + 1;
    var readChaps = state.readChapters[manga.id] || [];
    var isRead = readChaps.indexOf(num) !== -1;
    html += '<li class="chapter-row ' + (isRead ? 'read' : '') + '" data-chapter="' + num + '">' +
      '<div><span class="chapter-name">Capítulo ' + num + '</span> <span class="chapter-uploader">por ' + manga.uploader + '</span></div>' +
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

  container.innerHTML = list.map(c =>
    '<div class="comment-item">' +
      '<div class="comment-meta">' +
        '<span class="comment-author ' + (c.is_staff ? 'uploader-author' : '') + '">' + c.author + (c.is_staff ? ' [Traductor]' : '') + '</span>' +
        '<span>' + (c.date || 'Hace un momento') + '</span>' +
      '</div>' +
      '<div class="comment-content">' + c.text + '</div>' +
    '</div>'
  ).join('');
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
  openModal('upload-modal');
}

async function doUpload(e) {
  e.preventDefault();

  var title = document.getElementById('up-title').value.trim();
  var coverInput = document.getElementById('up-cover').value.trim();
  var fileInput = document.getElementById('up-cover-file');
  var type = document.getElementById('up-type').value;
  var author = document.getElementById('up-author').value.trim() || "Anónimo";
  var genresInput = document.getElementById('up-genres').value.trim();
  var description = document.getElementById('up-desc').value.trim() || "Sin descripción.";
  var nsfw = document.getElementById('up-nsfw').checked;
  var genres = genresInput ? genresInput.split(',').map(function(g) { return g.trim(); }) : ["General"];
  var uploaderName = state.currentUser ? state.currentUser.username : "Anónimo";

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
    var reader = new FileReader();
    reader.onload = async function(evt) {
      await saveManga(evt.target.result);
    };
    reader.readAsDataURL(fileInput.files[0]);
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
  
  // Auto-sugerir el siguiente capítulo
  var nextChap = (state.selectedManga.chapters || 0) + 1;
  document.getElementById('upch-num').value = nextChap;

  // Limpiar previsualizaciones
  document.getElementById('upch-preview-grid').innerHTML = '';
  document.getElementById('upch-page-count').style.display = 'none';
  document.getElementById('upch-page-count').textContent = '';
  document.getElementById('upch-progress-wrap').style.display = 'none';
  
  // Limpiar el input de archivo
  document.getElementById('upch-files').value = '';

  openModal('upload-chapter-modal');

  // Configurar drag & drop en la zona
  var dropzone = document.getElementById('upch-dropzone');
  var fileInput = document.getElementById('upch-files');

  // Cambio de archivos por clic
  fileInput.onchange = function() {
    processUpchFiles(this.files);
  };

  // Eventos drag & drop
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

// Procesa los archivos de imagen seleccionados y genera miniaturas
function processUpchFiles(files) {
  if (!files || files.length === 0) return;

  var progressWrap = document.getElementById('upch-progress-wrap');
  var progressBar = document.getElementById('upch-progress-bar');
  var progressText = document.getElementById('upch-progress-text');
  var countEl = document.getElementById('upch-page-count');
  var previewGrid = document.getElementById('upch-preview-grid');

  // Ordenar los archivos por nombre para mantener el orden de páginas
  var sorted = Array.from(files).sort(function(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  upchSelectedPages = new Array(sorted.length);
  progressWrap.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = 'Procesando 0 / ' + sorted.length + ' imágenes...';
  previewGrid.innerHTML = '';

  // Pre-crear los slots de miniaturas en orden
  sorted.forEach(function(file, idx) {
    var wrap = document.createElement('div');
    wrap.className = 'upch-thumb-wrap';
    wrap.id = 'upch-thumb-' + idx;
    wrap.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;">⏳</div>' +
      '<span class="upch-thumb-num">Pág. ' + (idx + 1) + '</span>';
    previewGrid.appendChild(wrap);
  });

  var loaded = 0;
  sorted.forEach(function(file, idx) {
    var reader = new FileReader();
    reader.onload = function(evt) {
      upchSelectedPages[idx] = evt.target.result;
      loaded++;

      // Actualizar miniatura
      var wrap = document.getElementById('upch-thumb-' + idx);
      if (wrap) {
        wrap.innerHTML = '<img src="' + evt.target.result + '" alt="Pág ' + (idx + 1) + '">' +
          '<span class="upch-thumb-num">Pág. ' + (idx + 1) + '</span>' +
          '<button class="upch-thumb-del" onclick="removeUpchPage(' + idx + ')" title="Quitar">✕</button>';
      }

      // Actualizar barra de progreso
      var pct = Math.round((loaded / sorted.length) * 100);
      progressBar.style.width = pct + '%';
      progressText.textContent = 'Procesando ' + loaded + ' / ' + sorted.length + ' imágenes...';

      if (loaded === sorted.length) {
        progressText.textContent = '✅ ' + sorted.length + ' páginas listas para publicar.';
        progressBar.style.background = '#27ae60';
        countEl.textContent = '✅ ' + sorted.length + ' páginas seleccionadas y listas.';
        countEl.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
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

  async function saveChapter(pagesArray) {
    if (pagesArray.length === 0) {
      showToast("Debes ingresar al menos una página (archivo o enlace).");
      return;
    }

    if (supabaseClient) {
      showToast("Guardando capítulo en base de datos...");
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
        showToast('¡Capítulo ' + num + ' publicado en tiempo real con éxito!');
        await syncWithSupabase();
        
        // Volver a cargar vista de detalle
        showDetail(manga.id);
      } catch (err) {
        console.error("Error subiendo capítulo a Supabase:", err);
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
  }

  var pagesList = [];
  
  // Usar páginas pre-procesadas del drag & drop (ya están en Base64)
  var cachedPages = upchSelectedPages.filter(function(p) { return p !== null && p !== undefined; });
  
  if (cachedPages.length > 0) {
    // Ya tenemos las páginas procesadas, publicar directo
    await saveChapter(cachedPages);
  } else {
    // Fallback: leer URLs pegadas en el textarea
    if (pagesText) {
      pagesList = pagesText.split('\n').map(function(line) { return line.trim(); }).filter(function(line) { return line !== ""; });
    }
    await saveChapter(pagesList);
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

  var recSec = document.getElementById('rec-section');
  if (recSec) recSec.style.display = 'block';
  var histSec = document.getElementById('history-section-el');
  if (histSec) histSec.style.display = 'block';

  // Cerrar menú móvil
  var menu = document.getElementById('nav-links-menu');
  if (menu) menu.classList.remove('show');

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
  showToast("✉ ¡Mensaje enviado con éxito a soporte!");
}

function doReportChapter(e) {
  e.preventDefault();
  closeModal('report-modal');
  e.target.reset();
  if (state.selectedManga) {
    showToast('⚠ Reporte enviado: Capítulo ' + state.currentChapter + ' de ' + state.selectedManga.title);
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
        showToast("💾 Archivo TuManhwaOnline_Pack.zip descargado (Simulación)");

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
