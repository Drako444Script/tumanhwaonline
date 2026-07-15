/* ═══════════════════════════════════════════
   TUMANHWAONLINE — Lógica del Portal con Conexión a Supabase
   ═══════════════════════════════════════════ */

// ── CONFIGURACIÓN DE SUPABASE ──
// Reemplaza estas credenciales con las de tu proyecto en Supabase (Settings > API)
const SUPABASE_URL = 'TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';

// Inicializar cliente de Supabase (si está importada la librería en index.html)
const supabase = (typeof window.supabase !== 'undefined' && SUPABASE_URL !== 'TU_SUPABASE_URL') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// ── Catálogo Inicial de Respaldo (Si Supabase no está conectado) ──
const BACKUP_MANGAS = [
  {
    id: 1,
    title: "Blade of the Forsaken",
    type: "manga",
    author: "Takeshi Yamamoto",
    cover: "assets/covers/manga_cover_1.png",
    rating: 4.8,
    chapters: 186,
    status: "En emisión",
    views: "2.4M",
    genres: ["Acción", "Fantasía", "Drama"],
    description: "En un mundo donde los samuráis han caído, un guerrero solitario busca venganza contra el imperio que destruyó su clan. Su espada maldita le otorga poder inimaginable, pero a un costo devastador.",
    year: 2022,
    uploader: "LectorTraducciones",
    lang: "ES",
    nsfw: false
  },
  {
    id: 2,
    title: "Neon Phantom",
    type: "manhwa",
    author: "Park Ji-hyun",
    cover: "assets/covers/manhwa_cover_1.png",
    rating: 4.9,
    chapters: 142,
    status: "En emisión",
    views: "5.1M",
    genres: ["Ciencia Ficción", "Acción", "Cyberpunk"],
    description: "En Neo-Seúl 2087, una guerrera cibernética descubre que sus memorias implantadas esconden la clave para derrocar a la corporación que controla la ciudad. Cada noche, los fantasmas digitales la guían hacia la verdad.",
    year: 2023,
    uploader: "CyberScan",
    lang: "ES",
    nsfw: false
  },
  {
    id: 3,
    title: "Arcane Forest",
    type: "manga",
    author: "Miyuki Haruna",
    cover: "assets/covers/manga_cover_2.png",
    rating: 4.6,
    chapters: 98,
    status: "En emisión",
    views: "1.8M",
    genres: ["Fantasía", "Aventura", "Misterio"],
    description: "Un bosque antiguo guarda secretos que ningún mortal debería conocer. Cuando una figura encapuchada cruza sus límites, las runas ancestrales despiertan y el equilibrio del mundo se tambalea.",
    year: 2021,
    uploader: "RincónManga",
    lang: "ES",
    nsfw: false
  },
  {
    id: 4,
    title: "Dragon's Abyss",
    type: "manhwa",
    author: "Kim Seo-jin",
    cover: "assets/covers/manhwa_cover_2.png",
    rating: 4.7,
    chapters: 220,
    status: "En emisión",
    views: "8.3M",
    genres: ["Fantasía", "Acción", "Aventura"],
    description: "Tras despertar en el nivel más profundo de una mazmorra infinita, un joven con poderes olvidados debe enfrentar a dragones ancestrales y escalar hacia la superficie. Cada nivel es más mortal que el anterior.",
    year: 2020,
    uploader: "SoloLevelingFans",
    lang: "ES",
    nsfw: false
  },
  {
    id: 5,
    title: "Spirit Resonance",
    type: "manga",
    author: "Aoi Kenshin",
    cover: "assets/covers/manga_cover_3.png",
    rating: 4.5,
    chapters: 67,
    status: "En emisión",
    views: "980K",
    genres: ["Sobrenatural", "Horror", "Escolar"],
    description: "Un estudiante de preparatoria descubre que puede ver espíritus después de un accidente casi mortal. Ahora debe proteger a los vivos de las entidades que acechan entre las sombras de su escuela.",
    year: 2024,
    uploader: "HorrorScanlat",
    lang: "ES",
    nsfw: false
  },
  {
    id: 6,
    title: "Heaven's Path",
    type: "manhwa",
    author: "Lee Min-ho",
    cover: "assets/covers/manhwa_cover_3.png",
    rating: 4.4,
    chapters: 310,
    status: "Completado",
    views: "12M",
    genres: ["Artes Marciales", "Fantasía", "Cultivación"],
    description: "El camino hacia la inmortalidad requiere siglos de meditación y combates épicos. Un joven artista marcial desafía al cielo mismo para alcanzar la iluminación y proteger a los que ama.",
    year: 2019,
    uploader: "CultivadoresUnidos",
    lang: "ES",
    nsfw: false
  },
  {
    id: 7,
    title: "Sweet Obsession (+18)",
    type: "manhwa",
    author: "Han Ji-woo",
    cover: "assets/covers/manhwa_cover_1.png",
    rating: 4.8,
    chapters: 74,
    status: "En emisión",
    views: "3.4M",
    genres: ["Romance", "Drama", "Recuentos de la vida"],
    description: "Una intensa historia de romance adulto en el entorno corporativo. Los secretos y la atracción mutua pondrán a prueba los límites de lo profesional y lo personal en esta cautivadora obra +18.",
    year: 2024,
    uploader: "LustyScans",
    lang: "ES",
    nsfw: true
  },
  {
    id: 8,
    title: "Succubus Café (+18)",
    type: "manga",
    author: "Kuroda Shin",
    cover: "assets/covers/manga_cover_3.png",
    rating: 4.7,
    chapters: 52,
    status: "En emisión",
    views: "1.9M",
    genres: ["Comedia", "Sobrenatural", "Romance"],
    description: "Un café misterioso que abre solo a midnight emplea a meseras que en realidad son súcubos en entrenamiento. Una divertida y picante comedia de enredos sobrenaturales +18.",
    year: 2023,
    uploader: "EcchiNation",
    lang: "ES",
    nsfw: true
  }
];

const BACKUP_COMMENTS = {
  1: [
    { author: "MangaFan99", text: "Excelente traducción, la calidad de imagen es genial. ¡Espero el siguiente!", date: "Hace 1 hora" }
  ]
};

// ── Estado Global ──
const state = {
  catalog: [], // Se carga de Supabase o backup
  currentUser: JSON.parse(localStorage.getItem('tm-user') || 'null'),
  readChapters: JSON.parse(localStorage.getItem('tm-read') || '{}'),
  library: JSON.parse(localStorage.getItem('tm-library') || '{}'),
  history: JSON.parse(localStorage.getItem('tm-history') || '[]'),
  localComments: JSON.parse(localStorage.getItem('tm-comments') || JSON.stringify(BACKUP_COMMENTS)),
  
  // Filtros activos
  filterType: 'all',
  filterGenre: 'all',
  searchQuery: '',
  showNSFW: false,
  selectedManga: null,
  currentChapter: 1,
  
  // Lector
  readingMode: 'cascade',
  currentPageIndex: 1,
  totalPagesCount: 0,
  
  sortOrder: 'desc'
};

// ── Guardar datos Locales (Para caché de favoritos/historial) ──
function saveState() {
  localStorage.setItem('tm-user', JSON.stringify(state.currentUser));
  localStorage.setItem('tm-read', JSON.stringify(state.readChapters));
  localStorage.setItem('tm-library', JSON.stringify(state.library));
  localStorage.setItem('tm-history', JSON.stringify(state.history));
  if (!supabase) {
    localStorage.setItem('tm-comments', JSON.stringify(state.localComments));
  }
}

// ── Inicialización ──
document.addEventListener('DOMContentLoaded', async () => {
  renderAuth();
  await loadDataFromDatabase(); // Cargar catálogo de Supabase/Backup
  renderGenres();
  updateStats();
  renderHistory();
  renderFeatured();
  renderGrid();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      triggerSearch();
    }, 250));
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') triggerSearch();
    });
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (state.currentView === 'catalog') {
      if (window.innerWidth > 768) {
        sidebar.style.display = 'block';
      } else {
        sidebar.style.display = 'none';
      }
    }
  });
});

// ── Carga Asincrónica de Datos (Supabase / Local) ──
async function loadDataFromDatabase() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('mangas')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        state.catalog = data;
      } else {
        // Si la tabla está vacía, insertar los iniciales para no dejar la web en blanco
        state.catalog = BACKUP_MANGAS;
        await insertBackupToSupabase();
      }
    } catch (err) {
      console.error("Error cargando de Supabase, usando backup local:", err);
      state.catalog = JSON.parse(localStorage.getItem('tm-catalog') || JSON.stringify(BACKUP_MANGAS));
    }
  } else {
    // Si no hay Supabase, usar catálogo local
    state.catalog = JSON.parse(localStorage.getItem('tm-catalog') || JSON.stringify(BACKUP_MANGAS));
  }
}

// Insertar datos de backup en tu Supabase la primera vez para pruebas
async function insertBackupToSupabase() {
  if (!supabase) return;
  try {
    const formatted = BACKUP_MANGAS.map(m => {
      const { id, ...rest } = m; // remover ID auto-generado
      return rest;
    });
    await supabase.from('mangas').insert(formatted);
  } catch (e) {
    console.warn("No se pudo insertar backup en Supabase:", e);
  }
}

// ── Autenticación ──
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
  
  let totalRead = 0;
  Object.keys(state.readChapters).forEach(key => {
    totalRead += state.readChapters[key].length;
  });

  const libSize = Object.keys(state.library).length;
  const userUploads = state.catalog.filter(m => m.uploader === state.currentUser.username).length;

  document.getElementById('profile-avatar').textContent = state.currentUser.username[0].toUpperCase();
  document.getElementById('profile-username').textContent = state.currentUser.username;
  document.getElementById('profile-email').textContent = state.currentUser.email;
  
  document.getElementById('profile-stat-read').textContent = totalRead;
  document.getElementById('profile-stat-library').textContent = libSize;
  document.getElementById('profile-stat-uploads').textContent = userUploads;

  openModal('profile-modal');
}

function doLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  if (username) {
    state.currentUser = { username, email: `${username}@tumanhwaonline.com` };
    saveState();
    renderAuth();
    closeModal('login-modal');
    showToast(`¡Bienvenido de vuelta, ${username}!`);
    refreshCurrentView();
  }
}

function doRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-user').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  if (username && email) {
    state.currentUser = { username, email };
    saveState();
    renderAuth();
    closeModal('register-modal');
    showToast(`¡Cuenta registrada exitosamente, ${username}!`);
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

// ── Render Historial ──
function renderHistory() {
  const mainCol = document.getElementById('main-content');
  if (!mainCol) return;

  const oldSec = document.getElementById('history-section-el');
  if (oldSec) oldSec.remove();

  if (state.history.length === 0) return;

  const hisDiv = document.createElement('div');
  hisDiv.id = 'history-section-el';
  hisDiv.className = 'history-section';
  hisDiv.innerHTML = `
    <div class="history-title">Continuar Leyendo</div>
    <div class="history-grid">
      ${state.history.map(h => `
        <div class="history-item" onclick="resumeManga(${h.mangaId}, ${h.chapterNum})">
          <img class="history-cover" src="${h.cover}" alt="">
          <div class="history-info">
            <div class="history-manga-title">${h.title}</div>
            <div class="history-chapter">Capítulo ${h.chapterNum}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

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
    showDetail(mangaId);
    openReader(chapterNum);
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

  if (state.history.length > 6) {
    state.history.pop();
  }
  saveState();
  renderHistory();
}

// ── Recomendados ──
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
  recDiv.innerHTML = `
    <div class="recommended-title">Recomendaciones de la Semana</div>
    <div class="recommended-grid">
      ${featured.map(m => `
        <div class="recommended-item" onclick="showDetail(${m.id})">
          <img class="rec-cover" src="${m.cover}" alt="">
          <div class="rec-info">
            <div class="rec-title">${m.title}</div>
            <div class="rec-meta">★ ${m.rating} · ${m.type.toUpperCase()}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  mainCol.insertBefore(recDiv, mainCol.firstChild);
}

// ── Géneros ──
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
  let html = `<li class="genre-item ${state.filterGenre === 'all' ? 'active' : ''}" onclick="setFilterGenre('all')">Todos <span class="genre-count">(${state.catalog.filter(m => !m.nsfw || state.showNSFW).length})</span></li>`;
  
  sortedGenres.forEach(genre => {
    html += `
      <li class="genre-item ${state.filterGenre === genre ? 'active' : ''}" onclick="setFilterGenre('${genre}')">
        ${genre} <span class="genre-count">(${counts[genre]})</span>
      </li>
    `;
  });

  container.innerHTML = html;
}

// ── Control Filtros ──
function setFilterType(type, element) {
  state.filterType = type;
  state.searchQuery = ''; 
  document.getElementById('search-input').value = '';

  const links = document.querySelectorAll('.nav-link');
  links.forEach(l => l.classList.remove('active'));
  if (element) element.classList.add('active');

  goHome();
}

function setFilterGenre(genre) {
  state.filterGenre = genre;
  renderGenres();
  goHome();
}

function triggerSearch() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  state.searchQuery = query;
  goHome();
}

function toggleNSFWFilter(element) {
  state.showNSFW = !state.showNSFW;
  if (state.showNSFW) {
    element.classList.add('active');
    showToast("Has entrado a la Zona +18");
  } else {
    element.classList.remove('active');
    showToast("Saliste de la Zona +18");
  }
  renderFeatured();
  renderGenres();
  goHome();
}

// ── Render Catálogo ──
function renderGrid() {
  const grid = document.getElementById('manga-grid');
  if (!grid) return;

  let filtered = [...state.catalog];

  if (!state.showNSFW) {
    filtered = filtered.filter(m => !m.nsfw);
  }

  if (state.filterType !== 'all') {
    filtered = filtered.filter(m => m.type === state.filterType);
  }

  if (state.filterGenre !== 'all') {
    filtered = filtered.filter(m => m.genres.includes(state.filterGenre));
  }

  if (state.searchQuery) {
    filtered = filtered.filter(m => 
      m.title.toLowerCase().includes(state.searchQuery) ||
      m.author.toLowerCase().includes(state.searchQuery)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #7f8c8d;">No hay títulos que coincidan con los filtros seleccionados.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(m => {
    const libSection = state.library[m.id];
    let badgeHTML = '';
    if (libSection) {
      badgeHTML = `<span class="library-badge ${libSection}">${libSection}</span>`;
    }

    return `
      <div class="manga-card" onclick="showDetail(${m.id})">
        <div class="card-cover-wrap">
          <img src="${m.cover}" alt="${m.title}" class="card-cover">
          <span class="badge-tipo">${m.type}</span>
          ${m.nsfw ? `<span class="badge-nsfw">+18</span>` : ''}
        </div>
        <div class="card-title" title="${m.title}">${m.title} ${badgeHTML}</div>
        <div class="card-meta">
          <span>★ ${m.rating}</span>
          <span>Cap: ${m.chapters}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── Vista Detalle ──
async function showDetail(id) {
  const manga = state.catalog.find(m => m.id === id);
  if (!manga) return;

  state.selectedManga = manga;
  state.currentView = 'detail';

  const catalogView = document.getElementById('catalog-view');
  const detailView = document.getElementById('detail-view');
  const sidebar = document.getElementById('sidebar');

  const recSec = document.getElementById('rec-section');
  if (recSec) recSec.style.display = 'none';

  const histSec = document.getElementById('history-section-el');
  if (histSec) histSec.style.display = 'none';

  catalogView.style.display = 'none';
  detailView.style.display = 'block';
  
  if (window.innerWidth <= 768) {
    sidebar.style.display = 'none';
  } else {
    sidebar.style.display = 'block';
  }

  const libSection = state.library[manga.id];

  detailView.innerHTML = `
    <div class="manga-detail">
      <button class="btn-classic-grey back-btn" style="margin-bottom:15px;" onclick="goHome()">← Volver al listado</button>
      
      <div class="detail-header">
        <div class="detail-cover">
          <img src="${manga.cover}" alt="${manga.title}">
        </div>
        <div class="detail-info">
          <h1 class="detail-title">${manga.title}</h1>
          <table class="detail-meta-table">
            <tr>
              <td>Autor:</td>
              <td>${manga.author}</td>
            </tr>
            <tr>
              <td>Tipo:</td>
              <td style="text-transform: uppercase;"><strong>${manga.type}</strong></td>
            </tr>
            <tr>
              <td>Géneros:</td>
              <td>${manga.genres.join(', ')}</td>
            </tr>
            <tr>
              <td>Subido por:</td>
              <td>${manga.uploader}</td>
            </tr>
            <tr>
              <td>Biblioteca:</td>
              <td><span id="detail-library-status">${libSection ? `Guardado en: <strong>${libSection.toUpperCase()}</strong>` : 'No guardado'}</span></td>
            </tr>
            <tr>
              <td>Valoración:</td>
              <td>★ ${manga.rating} / 5</td>
            </tr>
          </table>
          
          <div class="detail-actions">
            <button class="btn-classic-red" onclick="startReading()">Leer Primer Capítulo</button>
            <button class="btn-classic-grey" onclick="openLibraryModal(${manga.id})">
              ${libSection ? '★ Cambiar Estado' : '☆ Agregar a Biblioteca'}
            </button>
            <button class="btn-classic-grey" onclick="startDownloadSimulation()">↓ Descargar</button>
          </div>
        </div>
      </div>

      <div class="detail-synopsis">
        <strong>Sinopsis:</strong><br><br>
        ${manga.description}
      </div>

      <div class="chapters-header-row">
        <div class="section-title" style="margin-bottom:0; border:none; padding:0;">Lista de Capítulos</div>
        <button class="btn-agregar-cap" onclick="openUploadChapterModal()">+ Agregar Capítulo</button>
      </div>
      
      <ul class="chapter-list">
        ${renderChaptersList(manga)}
      </ul>

      <!-- Sección de Comentarios Clásica -->
      <div class="comments-section">
        <div class="section-title" style="border-bottom:1px solid #eaeded; padding-bottom:5px; font-size:14px;">Comentarios de la Comunidad</div>
        
        <div class="comment-form">
          <strong>Deja tu comentario:</strong>
          <div class="comment-input-area">
            <textarea id="comment-text" placeholder="Escribe aquí tu comentario sobre esta obra..."></textarea>
            <button class="btn-comentar" onclick="addComment(${manga.id})">Enviar</button>
          </div>
        </div>

        <div class="comments-list" id="comments-list">
          Cargando comentarios...
        </div>
      </div>
    </div>
  `;

  // Cargar comentarios
  await loadComments(manga.id);

  document.querySelectorAll('.chapter-row').forEach(row => {
    row.addEventListener('click', () => {
      const num = parseInt(row.getAttribute('data-chapter'));
      if (num) openReader(num);
    });
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderChaptersList(manga) {
  let html = '';
  const total = manga.chapters;
  for (let i = 0; i < total; i++) {
    const num = state.sortOrder === 'desc' ? manga.chapters - i : i + 1;
    const isRead = state.readChapters[manga.id]?.includes(num);
    
    html += `
      <li class="chapter-row ${isRead ? 'read' : ''}" data-chapter="${num}">
        <div>
          <span class="chapter-name">Capítulo ${num}</span>
          <span class="chapter-uploader">por ${manga.uploader}</span>
        </div>
        <span class="chapter-date">Hace ${i}d</span>
      </li>
    `;
  }
  return html;
}

// ── Control de Biblioteca ──
function openLibraryModal(mangaId) {
  const currentStatus = state.library[mangaId] || 'leyendo';
  document.getElementById('lib-status-select').value = currentStatus;
  openModal('library-modal');
}

function saveToLibrarySection() {
  const manga = state.selectedManga;
  if (!manga) return;

  const section = document.getElementById('lib-status-select').value;
  state.library[manga.id] = section;
  saveState();
  
  closeModal('library-modal');
  showDetail(manga.id);
  showToast(`Añadido a Biblioteca en sección "${section.toUpperCase()}"`);
}

// ── Comentarios de Vista Detalle con Supabase ──
async function loadComments(mangaId) {
  const commentsListContainer = document.getElementById('comments-list');
  if (!commentsListContainer) return;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('manga_id', mangaId)
        .is('chapter_num', null)
        .order('id', { ascending: false });

      if (error) throw error;
      renderCommentsUI(data || [], commentsListContainer);
    } catch (e) {
      console.error("Error cargando comentarios de Supabase:", e);
      renderCommentsUI(state.localComments[mangaId] || [], commentsListContainer);
    }
  } else {
    renderCommentsUI(state.localComments[mangaId] || [], commentsListContainer);
  }
}

function renderCommentsUI(list, container) {
  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#95a5a6; padding:15px; font-size:12px;">No hay comentarios todavía. ¡Sé el primero en comentar!</div>`;
    return;
  }

  container.innerHTML = list.map(c => `
    <div class="comment-item">
      <div class="comment-meta">
        <span class="comment-author ${c.is_staff ? 'uploader-author' : ''}">${c.author} ${c.is_staff ? '[Traductor]' : ''}</span>
        <span>${c.date}</span>
      </div>
      <div class="comment-content">${c.text}</div>
    </div>
  `).join('');
}

async function addComment(mangaId) {
  const textInput = document.getElementById('comment-text');
  if (!textInput) return;

  const text = textInput.value.trim();
  if (!text) {
    showToast("Escribe un comentario antes de enviar.");
    return;
  }

  const author = state.currentUser ? state.currentUser.username : "Anónimo";
  const isStaff = state.selectedManga && state.selectedManga.uploader === author;

  const newComment = {
    manga_id: mangaId,
    chapter_num: null,
    author: author,
    text: text,
    date: "Ahora mismo",
    is_staff: isStaff
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('comments').insert([newComment]);
      if (error) throw error;
      showToast("Comentario enviado.");
    } catch (e) {
      console.error("Error guardando comentario en Supabase:", e);
      showToast("Error de conexión. Guardado en local temporalmente.");
      saveLocalComment(mangaId, newComment);
    }
  } else {
    saveLocalComment(mangaId, newComment);
    showToast("Comentario enviado.");
  }
  
  textInput.value = '';
  await loadComments(mangaId);
}

function saveLocalComment(mangaId, comment) {
  if (!state.localComments[mangaId]) state.localComments[mangaId] = [];
  state.localComments[mangaId].unshift(comment);
  saveState();
}

// ── Lector Clásica con Selector de Páginas & Modos ──
async function openReader(chapterNum) {
  const manga = state.selectedManga;
  if (!manga) return;

  state.currentView = 'reader';
  state.currentChapter = chapterNum; 
  addToHistory(manga, chapterNum);

  if (!state.readChapters[manga.id]) state.readChapters[manga.id] = [];
  if (!state.readChapters[manga.id].includes(chapterNum)) {
    state.readChapters[manga.id].push(chapterNum);
    saveState();
  }

  const detailView = document.getElementById('detail-view');
  const readerView = document.getElementById('reader-view');
  const sidebar = document.getElementById('sidebar');

  detailView.style.display = 'none';
  sidebar.style.display = 'none';
  readerView.style.display = 'block';

  // Generar páginas
  const count = 12; 
  state.totalPagesCount = count;
  state.currentPageIndex = 1;

  let pagesHtml = '';
  let dropdownOptions = '';
  
  for (let i = 1; i <= count; i++) {
    pagesHtml += `
      <div id="page-${i}" class="lector-page-placeholder" style="height:${650 + Math.random()*50}px; margin-bottom:10px;">
        <div style="text-align: center;">
          <div style="font-size:36px; margin-bottom:10px;">📖</div>
          <div style="font-weight:bold;">${manga.title}</div>
          <div>Capítulo ${chapterNum} - Página ${i} de ${count}</div>
          <div style="color: #666; font-size:10px; margin-top:5px;">[TuManhwaOnline - Repositorio Comunitario]</div>
        </div>
      </div>
    `;
    dropdownOptions += `<option value="${i}">Página ${i}</option>`;
  }

  let singlePageHTML = '';
  for (let i = 1; i <= count; i++) {
    singlePageHTML += `
      <div id="single-page-${i}" class="lector-page-placeholder lector-page-single ${i === 1 ? 'active' : ''}" style="height:650px;">
        <div style="text-align: center; padding-top:150px;">
          <div style="font-size:42px; margin-bottom:15px;">📖</div>
          <div style="font-weight:bold; font-size:16px;">${manga.title}</div>
          <div style="margin-top:5px; font-size:13px;">Capítulo ${chapterNum} - Página ${i} de ${count}</div>
          <div style="color: #777; font-size:11px; margin-top:10px;">(Haz clic en los botones para cambiar de página)</div>
        </div>
      </div>
    `;
  }

  readerView.innerHTML = `
    <div class="lector-container">
      <div class="lector-toolbar">
        <div class="lector-toolbar-left">
          <span>Capítulo ${chapterNum}</span>
          <select id="page-select" onchange="handlePageSelect(this.value)">
            ${dropdownOptions}
          </select>
          <select id="mode-select" onchange="changeReadingMode(this.value)">
            <option value="cascade" ${state.readingMode === 'cascade' ? 'selected' : ''}>Cascada (Vertical)</option>
            <option value="single" ${state.readingMode === 'single' ? 'selected' : ''}>Página a Página</option>
          </select>
        </div>
        <div class="lector-toolbar-right">
          <button class="btn-reportar-error" onclick="openModal('report-modal')">⚠ Reportar</button>
          <button class="btn-cerrar-lector" onclick="closeReader()">✕ Cerrar</button>
        </div>
      </div>
      
      <div class="lector-pages" id="reader-pages-cascade" style="display: ${state.readingMode === 'cascade' ? 'flex' : 'none'}; flex-direction:column; align-items:center;">
        ${pagesHtml}
      </div>

      <div class="lector-pages" id="reader-pages-single" style="display: ${state.readingMode === 'single' ? 'block' : 'none'};">
        ${singlePageHTML}
        <div class="single-page-nav">
          <button class="btn-page-nav" onclick="prevSinglePage()">← Anterior</button>
          <span id="single-page-indicator">Página 1 / ${count}</span>
          <button class="btn-page-nav" onclick="nextSinglePage()">Siguiente →</button>
        </div>
      </div>

      <div class="lector-nav-bottom">
        <button class="btn-classic-grey" onclick="changeChapter(${chapterNum - 1})" ${chapterNum <= 1 ? 'disabled style="opacity:0.5"' : ''}>← Cap. Anterior</button>
        <button class="btn-classic-red" onclick="closeReader()">Volver a Detalles</button>
        <button class="btn-classic-grey" onclick="changeChapter(${chapterNum + 1})" ${chapterNum >= manga.chapters ? 'disabled style="opacity:0.5"' : ''}>Cap. Siguiente →</button>
      </div>

      <!-- Sección de Comentarios del Lector -->
      <div class="lector-comments">
        <div class="lector-comments-title">Comentarios del Capítulo ${chapterNum}</div>
        
        <div class="lector-comment-form">
          ${state.currentUser ? `
            <div class="comment-input-area">
              <textarea id="reader-comment-text" placeholder="¿Qué te pareció este capítulo? Deja tu comentario..."></textarea>
              <button class="btn-comentar" onclick="addReaderComment(${manga.id}, ${chapterNum})">Enviar</button>
            </div>
          ` : `
            <div class="lector-comment-lock">
              <span>Debes <strong>iniciar sesión</strong> o <strong>crear una cuenta</strong> para dejar comentarios en los capítulos.</span>
              <button class="btn-classic-red" onclick="openModal('login-modal')">Iniciar Sesión / Registrarse</button>
            </div>
          `}
        </div>

        <div class="lector-comments-list" id="reader-comments-list">
          Cargando comentarios de este capítulo...
        </div>
      </div>
    </div>
  `;

  // Cargar comentarios del capítulo
  await loadReaderComments(manga.id, chapterNum);

  if (state.readingMode === 'cascade') {
    window.addEventListener('scroll', handleReaderScroll);
  }

  window.scrollTo({ top: 0 });
}

// ── Comentarios de Lector con Supabase ──
async function loadReaderComments(mangaId, chapterNum) {
  const container = document.getElementById('reader-comments-list');
  if (!container) return;

  const commentKey = `${mangaId}_${chapterNum}`;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('manga_id', mangaId)
        .eq('chapter_num', chapterNum)
        .order('id', { ascending: false });

      if (error) throw error;
      renderReaderCommentsUI(data || [], container);
    } catch (e) {
      console.error("Error cargando comentarios del lector de Supabase:", e);
      renderReaderCommentsUI(state.localComments[commentKey] || [], container);
    }
  } else {
    renderReaderCommentsUI(state.localComments[commentKey] || [], container);
  }
}

function renderReaderCommentsUI(list, container) {
  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#888888; padding:15px; font-size:11px;">Nadie ha comentado en este capítulo. ¡Sé el primero!</div>`;
    return;
  }

  container.innerHTML = list.map(c => `
    <div class="lector-comment-item">
      <div class="lector-comment-meta">
        <span class="lector-comment-author ${c.is_staff ? 'uploader-author' : ''}">${c.author} ${c.is_staff ? '[Traductor]' : ''}</span>
        <span>${c.date}</span>
      </div>
      <div class="lector-comment-content">${c.text}</div>
    </div>
  `).join('');
}

async function addReaderComment(mangaId, chapterNum) {
  if (!state.currentUser) {
    showToast("Debes iniciar sesión para comentar.");
    return;
  }

  const textInput = document.getElementById('reader-comment-text');
  if (!textInput) return;

  const text = textInput.value.trim();
  if (!text) {
    showToast("Escribe un comentario antes de enviar.");
    return;
  }

  const commentKey = `${mangaId}_${chapterNum}`;
  const author = state.currentUser.username;
  const isStaff = state.selectedManga && state.selectedManga.uploader === author;

  const newComment = {
    manga_id: mangaId,
    chapter_num: chapterNum,
    author: author,
    text: text,
    date: "Ahora mismo",
    is_staff: isStaff
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('comments').insert([newComment]);
      if (error) throw error;
      showToast("Comentario publicado.");
    } catch (e) {
      console.error("Error guardando comentario en Supabase:", e);
      showToast("Error de conexión. Guardado en local temporalmente.");
      saveLocalReaderComment(commentKey, newComment);
    }
  } else {
    saveLocalReaderComment(commentKey, newComment);
    showToast("Comentario publicado.");
  }

  textInput.value = '';
  await loadReaderComments(mangaId, chapterNum);
}

function saveLocalReaderComment(key, comment) {
  if (!state.localComments[key]) state.localComments[key] = [];
  state.localComments[key].unshift(comment);
  saveState();
}

function changeReadingMode(mode) {
  state.readingMode = mode;
  saveState();
  
  const cascadeContainer = document.getElementById('reader-pages-cascade');
  const singleContainer = document.getElementById('reader-pages-single');

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
  const pageNum = parseInt(val);
  state.currentPageIndex = pageNum;

  if (state.readingMode === 'cascade') {
    jumpToPage(pageNum);
  } else {
    updateSinglePageView();
  }
}

function updateSinglePageView() {
  const pages = document.querySelectorAll('.lector-page-single');
  pages.forEach((p, idx) => {
    p.classList.toggle('active', (idx + 1) === state.currentPageIndex);
  });
  
  document.getElementById('page-select').value = state.currentPageIndex;
  document.getElementById('single-page-indicator').textContent = `Página ${state.currentPageIndex} / ${state.totalPagesCount}`;
  window.scrollTo({ top: 0 });
}

function prevSinglePage() {
  if (state.currentPageIndex > 1) {
    state.currentPageIndex--;
    updateSinglePageView();
  }
}

function nextSinglePage() {
  if (state.currentPageIndex < state.totalPagesCount) {
    state.currentPageIndex++;
    updateSinglePageView();
  } else {
    showToast("¡Has llegado al final de este capítulo!");
  }
}

function handleReaderScroll() {
  if (state.readingMode !== 'cascade') return;
  const dropdown = document.getElementById('page-select');
  if (!dropdown) return;

  const placeholders = document.querySelectorAll('.lector-page-placeholder');
  placeholders.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
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
  
  if (window.innerWidth > 768) {
    document.getElementById('sidebar').style.display = 'block';
  }
  window.scrollTo({ top: 0 });
}

function goHome() {
  state.selectedManga = null;
  state.currentView = 'catalog';
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('reader-view').style.display = 'none';
  document.getElementById('catalog-view').style.display = 'block';
  
  const recSec = document.getElementById('rec-section');
  if (recSec) recSec.style.display = 'block';

  renderHistory();

  if (window.innerWidth > 768) {
    document.getElementById('sidebar').style.display = 'block';
  } else {
    document.getElementById('sidebar').style.display = 'none';
  }
  
  renderGrid();
  window.scrollTo({ top: 0 });
}

// ── Subir Manga Completo con Supabase ──
function openUploadModal() {
  openModal('upload-modal');
}

async function doUpload(e) {
  e.preventDefault();
  
  const title = document.getElementById('up-title').value.trim();
  const type = document.getElementById('up-type').value;
  const author = document.getElementById('up-author').value.trim() || "Anónimo";
  const genresInput = document.getElementById('up-genres').value.trim();
  const description = document.getElementById('up-desc').value.trim() || "Sin descripción.";
  const nsfw = document.getElementById('up-nsfw').checked;

  const genres = genresInput ? genresInput.split(',').map(g => g.trim()) : ["General"];
  
  const covers = [
    "assets/covers/manga_cover_1.png",
    "assets/covers/manga_cover_2.png",
    "assets/covers/manga_cover_3.png",
    "assets/covers/manhwa_cover_1.png",
    "assets/covers/manhwa_cover_2.png",
    "assets/covers/manhwa_cover_3.png"
  ];
  const randomCover = covers[Math.floor(Math.random() * covers.length)];
  const uploaderName = state.currentUser ? state.currentUser.username : "Anónimo";

  const newManga = {
    title,
    type,
    author,
    cover: randomCover,
    rating: 5.0,
    chapters: 1,
    status: "En emisión",
    views: "100",
    genres,
    description,
    year: new Date().getFullYear(),
    uploader: uploaderName,
    lang: "ES",
    nsfw: nsfw
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('mangas').insert([newManga]);
      if (error) throw error;
      showToast("¡Manga publicado exitosamente en Supabase!");
    } catch (e) {
      console.error("Error guardando manga en Supabase:", e);
      showToast("Error de conexión. Se guardó localmente.");
      saveLocalManga({ ...newManga, id: Date.now() });
    }
  } else {
    saveLocalManga({ ...newManga, id: Date.now() });
    showToast("¡Manga publicado por la comunidad con éxito!");
  }
  
  closeModal('upload-modal');
  e.target.reset();
  
  await loadDataFromDatabase(); // Actualizar catálogo
  updateStats();
  renderGenres();
  renderFeatured();
  renderGrid();
}

function saveLocalManga(manga) {
  state.catalog.unshift(manga);
  localStorage.setItem('tm-catalog', JSON.stringify(state.catalog));
}

// ── Subir Capítulo con Supabase ──
function openUploadChapterModal() {
  if (!state.selectedManga) return;
  document.getElementById('upch-manga-title').value = state.selectedManga.title;
  openModal('upload-chapter-modal');
}

async function doUploadChapter(e) {
  e.preventDefault();
  
  const num = parseInt(document.getElementById('upch-num').value);
  if (!state.selectedManga) return;

  const currentMangaId = state.selectedManga.id;
  const currentChapters = state.selectedManga.chapters;
  const targetChapters = num > currentChapters ? num : currentChapters + 1;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('mangas')
        .update({ chapters: targetChapters })
        .eq('id', currentMangaId);

      if (error) throw error;
      showToast(`¡Capítulo ${num} publicado exitosamente en Supabase!`);
    } catch (e) {
      console.error("Error actualizando capítulos en Supabase:", e);
      showToast("Error de conexión. Guardado en local.");
      updateLocalMangaChapters(currentMangaId, targetChapters);
    }
  } else {
    updateLocalMangaChapters(currentMangaId, targetChapters);
    showToast(`¡Capítulo ${num} publicado exitosamente!`);
  }
  
  closeModal('upload-chapter-modal');
  e.target.reset();

  await loadDataFromDatabase(); // Recargar base de datos
  
  // Buscar de nuevo el manga en el catálogo para actualizar la vista de detalle
  const updatedManga = state.catalog.find(m => m.id === currentMangaId);
  if (updatedManga) {
    state.selectedManga = updatedManga;
    showDetail(currentMangaId);
  }
  
  updateStats();
}

function updateLocalMangaChapters(id, chapters) {
  const manga = state.catalog.find(m => m.id === id);
  if (manga) {
    manga.chapters = chapters;
    localStorage.setItem('tm-catalog', JSON.stringify(state.catalog));
  }
}

// ── Soporte & Reporte ──
function doContact(e) {
  e.preventDefault();
  const email = document.getElementById('contact-email').value;
  const subject = document.getElementById('contact-subject').value;
  const msg = document.getElementById('contact-msg').value;

  if (email && subject && msg) {
    closeModal('contact-modal');
    e.target.reset();
    showToast("✉ ¡Mensaje enviado con éxito a soporte!");
  }
}

function doReportChapter(e) {
  e.preventDefault();
  if (state.selectedManga) {
    closeModal('report-modal');
    e.target.reset();
    showToast(`⚠ Reporte enviado: Capítulo ${state.currentChapter} de ${state.selectedManga.title} revisado pronto.`);
  }
}

// ── Descarga Simulada ──
function startDownloadSimulation() {
  if (!state.selectedManga) return;
  
  const progressBar = document.getElementById('download-progress-bar');
  const statusText = document.getElementById('download-status');
  
  if (!progressBar || !statusText) return;
  
  openModal('download-modal');
  progressBar.style.width = '0%';
  statusText.textContent = 'Buscando servidores de descarga...';

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 5;
    if (progress > 100) progress = 100;
    
    progressBar.style.width = `${progress}%`;
    
    if (progress < 30) {
      statusText.textContent = 'Conectando con el mirror...';
    } else if (progress < 60) {
      statusText.textContent = 'Comprimiendo capítulos en ZIP...';
    } else if (progress < 90) {
      statusText.textContent = 'Generando enlace directo...';
    } else if (progress === 100) {
      statusText.textContent = '¡Descarga completa!';
      clearInterval(interval);
      
      setTimeout(() => {
        closeModal('download-modal');
        showToast("💾 Archivo TuManhwaOnline_Pack.zip descargado (Simulación)");
        
        const element = document.createElement('a');
        const fileContent = `TuManhwaOnline - Descarga de Info\nTítulo: ${state.selectedManga.title}\nAutor: ${state.selectedManga.author}\nCapítulos: ${state.selectedManga.chapters}\n¡Gracias por preferir la comunidad de TuManhwaOnline!`;
        const file = new Blob([fileContent], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `${state.selectedManga.title.replace(/\s+/g, '_')}_TuManhwaOnline.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }, 1000);
    }
  }, 350);
}

// ── Utilidades ──
function updateStats() {
  const titles = state.catalog.length;
  let chapters = 0;
  const contributors = new Set();

  state.catalog.forEach(m => {
    chapters += m.chapters;
    contributors.add(m.uploader);
  });

  const titlesEl = document.getElementById('stat-titles');
  const chaptersEl = document.getElementById('stat-chapters');
  const usersEl = document.getElementById('stat-users');

  if (titlesEl) titlesEl.textContent = titles;
  if (chaptersEl) chaptersEl.textContent = chapters.toLocaleString();
  if (usersEl) usersEl.textContent = contributors.size;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
