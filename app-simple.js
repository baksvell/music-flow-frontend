// Music Flow - Simple & User-Friendly Version
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
let allTracks = [];
let searchQuery = '';
let telegramUserId = null;

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
    
    updatePlayerDisplay();
    showLoading(false);

    console.log('Music Flow загружен! 🎵');
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
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
}

// ===== API FUNCTIONS =====

async function loadTracks() {
    try {
        showLoading(true);
        
        // Try API v2 first, fallback to simple API
        let response = await fetch(`${API_BASE_URL}/tracks?limit=50`);
        
        if (!response.ok) {
            // Fallback to simple API
            response = await fetch(`${API_BASE_URL}/music`);
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle different API responses
        if (data.tracks) {
            allTracks = data.tracks;
        } else if (Array.isArray(data)) {
            allTracks = data;
        } else if (data.music) {
            allTracks = data.music;
        } else {
            allTracks = [];
        }
        
        renderTracks();
        console.log(`Загружено ${allTracks.length} треков`);
        
    } catch (error) {
        console.error('Ошибка загрузки треков:', error);
        showError('Ошибка загрузки треков. Попробуйте позже.');
        // Show sample data as fallback
        showSampleData();
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
        
        // Try search endpoint
        let response = await fetch(`${API_BASE_URL}/tracks/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            // Fallback to simple search
            response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle different response formats
        if (data.results) {
            allTracks = data.results;
        } else if (data.tracks) {
            allTracks = data.tracks;
        } else if (Array.isArray(data)) {
            allTracks = data;
        } else {
            allTracks = [];
        }
        
        renderTracks();
        console.log(`Найдено ${allTracks.length} треков по запросу "${query}"`);
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
        showError('Ошибка поиска. Попробуйте другой запрос.');
        // Filter local tracks as fallback
        filterLocalTracks(query);
    } finally {
        showLoading(false);
    }
}

// ===== UI FUNCTIONS =====

function renderTracks() {
    const tracksContainer = document.getElementById('tracksContainer');
    if (!tracksContainer) return;

    if (allTracks.length === 0) {
        tracksContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <h3>Треки не найдены</h3>
                <p>Попробуйте изменить поисковый запрос</p>
            </div>
        `;
        return;
    }

    const tracksHtml = allTracks.map((track, index) => `
        <div class="track-item" onclick="playTrack(${index})">
            <div class="track-info">
                <div class="track-title">${escapeHtml(track.title || track.name || 'Без названия')}</div>
                <div class="track-artist">${escapeHtml(track.artist || track.performer || 'Неизвестный исполнитель')}</div>
                <div class="track-meta">
                    <span class="track-duration">${formatDuration(track.duration || track.length)}</span>
                    ${track.play_count > 0 ? `<span class="play-count">${track.play_count} прослушиваний</span>` : ''}
                </div>
            </div>
            <div class="track-actions">
                <button class="play-btn" onclick="event.stopPropagation(); playTrack(${index})">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        </div>
    `).join('');

    tracksContainer.innerHTML = tracksHtml;
}

function showSampleData() {
    allTracks = [
        { title: 'Sample Track 1', artist: 'Sample Artist', duration: 180 },
        { title: 'Sample Track 2', artist: 'Sample Artist', duration: 240 },
        { title: 'Sample Track 3', artist: 'Sample Artist', duration: 200 }
    ];
    renderTracks();
}

function filterLocalTracks(query) {
    const filtered = allTracks.filter(track => {
        const title = (track.title || track.name || '').toLowerCase();
        const artist = (track.artist || track.performer || '').toLowerCase();
        const search = query.toLowerCase();
        return title.includes(search) || artist.includes(search);
    });
    allTracks = filtered;
    renderTracks();
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

function playTrack(index) {
    if (index < 0 || index >= allTracks.length) return;
    
    currentTrack = allTracks[index];
    isPlaying = true;
    
    updatePlayerDisplay();
    updatePlayButton();
    
    // Send to Telegram bot
    sendDataToBot('track_played', {
        track_id: currentTrack.id || index,
        title: currentTrack.title || currentTrack.name,
        artist: currentTrack.artist || currentTrack.performer
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
    
    const currentIndex = allTracks.findIndex(track => track === currentTrack);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : allTracks.length - 1;
    
    playTrack(prevIndex);
}

function playNext() {
    if (!currentTrack) return;
    
    const currentIndex = allTracks.findIndex(track => track === currentTrack);
    const nextIndex = currentIndex < allTracks.length - 1 ? currentIndex + 1 : 0;
    
    playTrack(nextIndex);
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
    if (!text) return '';
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

function showLoading(show) {
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    console.error(message);
    // Simple error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
    `;
    
    const container = document.getElementById('tracksContainer');
    if (container) {
        container.innerHTML = '';
        container.appendChild(errorDiv);
    }
}

function updatePlayerDisplay() {
    if (!currentTrack) return;
    
    const trackTitle = document.getElementById('currentTrackTitle');
    const trackArtist = document.getElementById('currentTrackArtist');
    
    if (trackTitle) trackTitle.textContent = currentTrack.title || currentTrack.name || 'Без названия';
    if (trackArtist) trackArtist.textContent = currentTrack.artist || currentTrack.performer || 'Неизвестный исполнитель';
}

function updatePlayButton() {
    const playBtn = document.getElementById('playBtn');
    if (!playBtn) return;
    
    const icon = playBtn.querySelector('i');
    if (icon) {
        icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
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
    if (section === 'home') {
        loadTracks();
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

// Export functions for global access
window.showSection = showSection;
window.toggleMenu = toggleMenu;
window.showSearch = showSearch;
window.showProfile = showProfile;
window.playTrack = playTrack;
window.togglePlay = togglePlay;
window.playPrevious = playPrevious;
window.playNext = playNext;


