// Music Flow Frontend v2 - Enhanced Version
const tg = window.Telegram.WebApp;

// Initialize Telegram Web App
tg.ready();
tg.expand();

// Set theme colors
document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#999999');
document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#2481cc');
document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');

// API Configuration
const API_BASE_URL = 'https://mysicflow.onrender.com';

// App State
let currentSection = 'home';
let isPlaying = false;
let currentTrack = null;
let currentPlaylist = null;
let isShuffled = false;
let isRepeated = false;
let volume = 0.8;
let telegramUserId = null;
let allTracks = [];
let filteredTracks = [];
let currentPage = 1;
let tracksPerPage = 20;
let searchQuery = '';
let sortBy = 'date';
let sortOrder = 'desc';
let filterArtist = '';
let filterGenre = '';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadTracks();
    sendDataToBot('app_loaded', { timestamp: new Date().toISOString() });
});

function initializeApp() {
    // Get Telegram user ID
    if (tg.initDataUnsafe?.user) {
        telegramUserId = tg.initDataUnsafe.user.id;
        console.log('Telegram User ID:', telegramUserId);
    }
    
    // Set initial state
    updatePlayerDisplay();
    updateVolumeDisplay();
    showLoading(false);

    console.log('Music Flow v2 загружен! 🎵');
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Filter controls
    const artistFilter = document.getElementById('artistFilter');
    if (artistFilter) {
        artistFilter.addEventListener('change', handleFilterChange);
    }

    const genreFilter = document.getElementById('genreFilter');
    if (genreFilter) {
        genreFilter.addEventListener('change', handleFilterChange);
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', handleSortChange);
    }

    // Progress bar
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.addEventListener('click', handleProgressClick);
    }

    // Volume bar
    const volumeBar = document.querySelector('.volume-bar');
    if (volumeBar) {
        volumeBar.addEventListener('click', handleVolumeClick);
    }

    // Player controls
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.addEventListener('click', togglePlay);
    }

    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', playPrevious);
    }

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', playNext);
    }

    const shuffleBtn = document.getElementById('shuffleBtn');
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', toggleShuffle);
    }

    const repeatBtn = document.getElementById('repeatBtn');
    if (repeatBtn) {
        repeatBtn.addEventListener('click', toggleRepeat);
    }
}

// ===== API FUNCTIONS =====

async function loadTracks(page = 1, limit = 100) {
    try {
        showLoading(true);
        
        const params = new URLSearchParams({
            skip: (page - 1) * limit,
            limit: limit,
            sort_by: sortBy,
            sort_order: sortOrder
        });

        if (searchQuery) params.append('search', searchQuery);
        if (filterArtist) params.append('artist', filterArtist);
        if (filterGenre) params.append('genre', filterGenre);

        const response = await fetch(`${API_BASE_URL}/tracks?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (page === 1) {
            allTracks = data.tracks;
        } else {
            allTracks = [...allTracks, ...data.tracks];
        }
        
        filteredTracks = [...allTracks];
        currentPage = page;
        
        renderTracks();
        updatePagination(data.has_more);
        
        console.log(`Загружено ${data.tracks.length} треков (всего: ${data.total})`);
        
    } catch (error) {
        console.error('Ошибка загрузки треков:', error);
        showError('Ошибка загрузки треков');
    } finally {
        showLoading(false);
    }
}

async function searchTracks(query) {
    try {
        if (!query.trim()) {
            loadTracks();
            return;
        }

        showLoading(true);
        
        const response = await fetch(`${API_BASE_URL}/tracks/search?q=${encodeURIComponent(query)}&limit=50`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        filteredTracks = data.results;
        renderTracks();
        
        console.log(`Найдено ${data.results.length} треков по запросу "${query}"`);
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
        showError('Ошибка поиска');
    } finally {
        showLoading(false);
    }
}

async function getTrackDetails(trackId) {
    try {
        const response = await fetch(`${API_BASE_URL}/tracks/${trackId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('Ошибка получения деталей трека:', error);
        return null;
    }
}

async function getStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        return null;
    }
}

// ===== UI FUNCTIONS =====

function renderTracks() {
    const tracksContainer = document.getElementById('tracksContainer');
    if (!tracksContainer) return;

    if (filteredTracks.length === 0) {
        tracksContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <h3>Треки не найдены</h3>
                <p>Попробуйте изменить поисковый запрос или фильтры</p>
            </div>
        `;
        return;
    }

    const tracksHtml = filteredTracks.map((track, index) => `
        <div class="track-item" onclick="playTrack(${index})" data-track-id="${track.id}">
            <div class="track-info">
                <div class="track-title">${escapeHtml(track.title)}</div>
                <div class="track-artist">${escapeHtml(track.artist)}</div>
                <div class="track-meta">
                    <span class="track-duration">${formatDuration(track.duration)}</span>
                    ${track.play_count > 0 ? `<span class="play-count">${track.play_count} прослушиваний</span>` : ''}
                </div>
            </div>
            <div class="track-actions">
                <button class="play-btn" onclick="event.stopPropagation(); playTrack(${index})">
                    <i class="fas fa-play"></i>
                </button>
                <button class="favorite-btn" onclick="event.stopPropagation(); toggleFavorite(${track.id})">
                    <i class="fas fa-heart ${track.is_favorite ? 'favorited' : ''}"></i>
                </button>
            </div>
        </div>
    `).join('');

    tracksContainer.innerHTML = tracksHtml;
}

function renderStatistics() {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;

    getStatistics().then(stats => {
        if (!stats) return;

        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.total_tracks}</div>
                    <div class="stat-label">Всего треков</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.total_artists}</div>
                    <div class="stat-label">Исполнителей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.total_play_count}</div>
                    <div class="stat-label">Прослушиваний</div>
                </div>
            </div>
            
            <div class="top-artists">
                <h3>Топ исполнителей</h3>
                <div class="artists-list">
                    ${stats.top_artists.slice(0, 5).map(artist => `
                        <div class="artist-item">
                            <span class="artist-name">${escapeHtml(artist.artist)}</span>
                            <span class="artist-stats">${artist.track_count} треков, ${artist.total_plays} прослушиваний</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
}

// ===== EVENT HANDLERS =====

function handleSearch(event) {
    searchQuery = event.target.value.trim();
    
    if (searchQuery) {
        searchTracks(searchQuery);
    } else {
        loadTracks();
    }
}

function handleFilterChange(event) {
    const filterType = event.target.id;
    const filterValue = event.target.value;
    
    if (filterType === 'artistFilter') {
        filterArtist = filterValue;
    } else if (filterType === 'genreFilter') {
        filterGenre = filterValue;
    }
    
    loadTracks();
}

function handleSortChange(event) {
    const [newSortBy, newSortOrder] = event.target.value.split('_');
    sortBy = newSortBy;
    sortOrder = newSortOrder;
    
    loadTracks();
}

function playTrack(index) {
    if (index < 0 || index >= filteredTracks.length) return;
    
    currentTrack = filteredTracks[index];
    isPlaying = true;
    
    // Update play count
    getTrackDetails(currentTrack.id);
    
    updatePlayerDisplay();
    updatePlayButton();
    
    // Send to Telegram bot
    sendDataToBot('track_played', {
        track_id: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist
    });
}

function togglePlay() {
    if (!currentTrack) return;
    
    isPlaying = !isPlaying;
    updatePlayButton();
    
    sendDataToBot('play_toggled', {
        is_playing: isPlaying,
        track_id: currentTrack.id
    });
}

function playPrevious() {
    if (!currentTrack) return;
    
    const currentIndex = filteredTracks.findIndex(track => track.id === currentTrack.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredTracks.length - 1;
    
    playTrack(prevIndex);
}

function playNext() {
    if (!currentTrack) return;
    
    const currentIndex = filteredTracks.findIndex(track => track.id === currentTrack.id);
    const nextIndex = currentIndex < filteredTracks.length - 1 ? currentIndex + 1 : 0;
    
    playTrack(nextIndex);
}

function toggleShuffle() {
    isShuffled = !isShuffled;
    updateShuffleButton();
    
    if (isShuffled) {
        // Shuffle current playlist
        filteredTracks = shuffleArray([...filteredTracks]);
    } else {
        // Restore original order
        loadTracks();
    }
}

function toggleRepeat() {
    isRepeated = !isRepeated;
    updateRepeatButton();
}

// ===== UTILITY FUNCTIONS =====

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function showLoading(show) {
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    // Simple error display - can be enhanced
    console.error(message);
    tg.showAlert(message);
}

function updatePlayerDisplay() {
    if (!currentTrack) return;
    
    const trackTitle = document.getElementById('currentTrackTitle');
    const trackArtist = document.getElementById('currentTrackArtist');
    
    if (trackTitle) trackTitle.textContent = currentTrack.title;
    if (trackArtist) trackArtist.textContent = currentTrack.artist;
}

function updatePlayButton() {
    const playBtn = document.getElementById('playBtn');
    if (!playBtn) return;
    
    const icon = playBtn.querySelector('i');
    if (icon) {
        icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }
}

function updateShuffleButton() {
    const shuffleBtn = document.getElementById('shuffleBtn');
    if (!shuffleBtn) return;
    
    shuffleBtn.classList.toggle('active', isShuffled);
}

function updateRepeatButton() {
    const repeatBtn = document.getElementById('repeatBtn');
    if (!repeatBtn) return;
    
    repeatBtn.classList.toggle('active', isRepeated);
}

function updateVolumeDisplay() {
    const volumeBar = document.querySelector('.volume-bar');
    if (volumeBar) {
        const fill = volumeBar.querySelector('.volume-fill');
        if (fill) {
            fill.style.width = `${volume * 100}%`;
        }
    }
}

function updatePagination(hasMore) {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = hasMore ? 'block' : 'none';
    }
}

// ===== NAVIGATION =====

function showSection(section) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => s.classList.remove('active'));
    
    // Show selected section
    const targetSection = document.getElementById(`${section}Section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    const activeNavItem = document.querySelector(`[onclick="showSection('${section}')"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    currentSection = section;
    
    // Load section-specific data
    switch (section) {
        case 'home':
            loadTracks();
            break;
        case 'search':
            // Search section is already loaded
            break;
        case 'library':
            // Load user's library
            break;
        case 'profile':
            renderStatistics();
            break;
    }
}

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

function showSearch() {
    showSection('search');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.focus();
    }
}

function showProfile() {
    showSection('profile');
}

// ===== TELEGRAM INTEGRATION =====

function sendDataToBot(event, data) {
    if (tg && tg.sendData) {
        const message = JSON.stringify({
            event: event,
            data: data,
            timestamp: new Date().toISOString()
        });
        
        tg.sendData(message);
    }
}

// ===== LEGACY COMPATIBILITY =====

// Keep some legacy functions for compatibility
function handleProgressClick(event) {
    // Implementation for progress bar click
}

function handleVolumeClick(event) {
    // Implementation for volume bar click
}

function loadUserData() {
    // Implementation for loading user data
}

// Export functions for global access
window.showSection = showSection;
window.toggleMenu = toggleMenu;
window.showSearch = showSearch;
window.showProfile = showProfile;
window.playTrack = playTrack;
window.togglePlay = togglePlay;
window.playPrevious = playPrevious;
window.playNext = playNext;
window.toggleShuffle = toggleShuffle;
window.toggleRepeat = toggleRepeat;
window.toggleFavorite = function(trackId) {
    // Implementation for favorite toggle
    console.log('Toggle favorite for track:', trackId);
};
