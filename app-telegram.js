// Music Flow - Telegram Optimized Version
const tg = window.Telegram.WebApp;

// Initialize Telegram Web App
tg.ready();
tg.expand();

// Set theme colors from Telegram
document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#999999');
document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#2481cc');
document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');

// API Configuration - only Render endpoints for Telegram
const API_ENDPOINTS = [
    'https://mysicflow.onrender.com/tracks',
    'https://mysicflow.onrender.com/music',
    'https://mysicflow.onrender.com/api/tracks',
    'https://mysicflow.onrender.com/'
];

// App State
let currentSection = 'home';
let isPlaying = false;
let currentTrack = null;
let allTracks = [];
let searchQuery = '';
let telegramUserId = null;
let apiWorking = false;
let audioPlayer = null;
let popupOpen = false;
let isPlayingTrack = false; // Prevent multiple play calls
let lastClickTime = 0; // Prevent rapid clicks
let lastTrackSwitchTime = 0; // Prevent rapid track switches
let favoriteTracks = []; // Array of favorite track IDs

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
    
    // Load favorites from localStorage
    loadFavoritesFromStorage();
    
    // Initialize audio player
    initializeAudioPlayer();
    
    updatePlayerDisplay();
    showLoading(false);

    console.log('Music Flow для Telegram загружен! 🎵');
}

function initializeAudioPlayer() {
    // Create audio element
    audioPlayer = new Audio();
    audioPlayer.preload = 'metadata';
    
    // Add event listeners
    audioPlayer.addEventListener('loadstart', function() {
        console.log('Audio loading started');
    });
    
    audioPlayer.addEventListener('canplay', function() {
        console.log('Audio can play');
    });
    
    audioPlayer.addEventListener('play', function() {
        console.log('Audio started playing');
        isPlaying = true;
        updatePlayButton();
        
        // Send play event only once
        if (currentTrack) {
            sendDataToBot('play_toggled', {
                is_playing: true,
                track_id: currentTrack.id
            });
        }
    });
    
    audioPlayer.addEventListener('pause', function() {
        console.log('Audio paused');
        isPlaying = false;
        updatePlayButton();
        
        // Send pause event only once
        if (currentTrack) {
            sendDataToBot('play_toggled', {
                is_playing: false,
                track_id: currentTrack.id
            });
        }
    });
    
    audioPlayer.addEventListener('ended', function() {
        console.log('Audio ended');
        isPlaying = false;
        updatePlayButton();
        // Don't auto-play next track to prevent loops
        // playNext();
    });
    
    audioPlayer.addEventListener('error', function(e) {
        console.error('Audio error:', e);
        // Don't show alert immediately, let playTrack handle it
    });
}

function safeShowAlert(message) {
    if (popupOpen) {
        console.log('Popup already open, skipping alert:', message);
        return;
    }
    
    try {
        popupOpen = true;
        tg.showAlert(message);
        
        // Reset popup flag after a delay
        setTimeout(() => {
            popupOpen = false;
        }, 1000);
        
    } catch (e) {
        console.log('Could not show alert:', e);
        popupOpen = false;
    }
}

async function incrementPlayCount(trackId) {
    if (!trackId) return;
    
    try {
        const response = await fetch(`https://mysicflow.onrender.com/tracks/${trackId}/play`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            console.log(`Play count incremented for track ${trackId}`);
        } else {
            console.log(`Failed to increment play count for track ${trackId}`);
        }
    } catch (error) {
        console.error('Error incrementing play count:', error);
    }
}

function setupEventListeners() {
    // Search functionality - only home search input
    const homeSearchInput = document.getElementById('homeSearchInput');
    if (homeSearchInput) {
        homeSearchInput.addEventListener('input', debounce(handleSearch, 300));
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

    // Telegram specific events
    tg.onEvent('viewportChanged', function() {
        console.log('Viewport changed');
        adjustForTelegram();
    });
}

// ===== API FUNCTIONS =====

async function loadTracks() {
    try {
        showLoading(true);
        
        // Try multiple API endpoints
        for (const endpoint of API_ENDPOINTS) {
            try {
                console.log(`Trying endpoint: ${endpoint}`);
                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('API Response:', data);
                    
                    // Handle different API responses
                    if (data.tracks && Array.isArray(data.tracks)) {
                        allTracks = data.tracks;
                        apiWorking = true;
                        break;
                    } else if (Array.isArray(data)) {
                        allTracks = data;
                        apiWorking = true;
                        break;
                    } else if (data.music && Array.isArray(data.music)) {
                        allTracks = data.music;
                        apiWorking = true;
                        break;
                    }
                }
            } catch (error) {
                console.log(`Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }
        
        // If no API works, show sample data with message
        if (!apiWorking || allTracks.length === 0) {
            showSampleDataWithMessage();
        } else {
            renderTracks();
            console.log(`Загружено ${allTracks.length} треков с API`);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки треков:', error);
        showSampleDataWithMessage();
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
        
        // Try search endpoints
        const searchEndpoints = [
            `${API_ENDPOINTS[0]}/search?q=${encodeURIComponent(query)}`,
            `https://mysicflow.onrender.com/tracks/search?q=${encodeURIComponent(query)}`
        ];
        
        let found = false;
        for (const endpoint of searchEndpoints) {
            try {
                const response = await fetch(endpoint);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.results || data.tracks || Array.isArray(data)) {
                        allTracks = data.results || data.tracks || data;
                        console.log(`Found ${allTracks.length} tracks for query: ${query}`);
                        found = true;
                        break;
                    }
                }
            } catch (error) {
                console.error(`Search endpoint error: ${endpoint}`, error);
                continue;
            }
        }
        
        if (!found) {
            // Filter local tracks as fallback
            filterLocalTracks(query);
        }
        
        renderTracks();
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
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

    const tracksHtml = allTracks.map((track, index) => createTrackHTML(track, index)).join('');

    tracksContainer.innerHTML = tracksHtml;
}

function createTrackHTML(track, index) {
    const isFav = isFavorite(track.id);
    // Find the actual index in allTracks array
    const actualIndex = allTracks.findIndex(t => t.id === track.id);
    const playIndex = actualIndex !== -1 ? actualIndex : 0; // Fallback to 0 if not found
    
    return `
        <div class="track-item" onclick="playTrack(${playIndex})">
            <div class="track-info">
                <div class="track-title">${escapeHtml(track.title || track.name || 'Без названия')}</div>
                <div class="track-artist">${escapeHtml(track.artist || track.performer || 'Неизвестный исполнитель')}</div>
                <div class="track-meta">
                    <span class="track-duration">${formatDuration(track.duration || track.length)}</span>
                    ${track.play_count > 0 ? `<span class="play-count">${track.play_count} прослушиваний</span>` : ''}
                </div>
            </div>
            <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(${track.id}, event)" title="${isFav ? 'Убрать из избранного' : 'Добавить в избранное'}">
                <i class="fas fa-star"></i>
            </button>
            <div class="track-actions">
                <button class="play-btn" onclick="event.stopPropagation(); playTrack(${playIndex})">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        </div>
    `;
}

function showSampleDataWithMessage() {
    allTracks = [
        { title: 'Sample Track 1', artist: 'Sample Artist', duration: 180 },
        { title: 'Sample Track 2', artist: 'Sample Artist', duration: 240 },
        { title: 'Sample Track 3', artist: 'Sample Artist', duration: 200 }
    ];
    
    renderTracks();
    
    // Show message about API
    const tracksContainer = document.getElementById('tracksContainer');
    if (tracksContainer) {
        const message = document.createElement('div');
        message.className = 'api-message';
        message.innerHTML = `
            <div class="message-content">
                <i class="fas fa-info-circle"></i>
                <div>
                    <strong>API недоступен</strong>
                    <p>Показываем демо-треки. Добавьте музыку в группу через бота!</p>
                </div>
            </div>
        `;
        tracksContainer.insertBefore(message, tracksContainer.firstChild);
    }
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
        console.log('Loading all tracks');
        loadTracks();
    }
}

function playTrack(index) {
    console.log('playTrack called with index:', index, 'allTracks.length:', allTracks.length);
    
    if (index < 0 || index >= allTracks.length) {
        console.error('Invalid track index:', index);
        return;
    }
    
    // Prevent multiple play calls
    if (isPlayingTrack) {
        console.log('Already playing a track, skipping...');
        return;
    }
    
    isPlayingTrack = true;
    currentTrack = allTracks[index];
    console.log('Playing track:', currentTrack);
    
    // Get audio URL
    const audioUrl = getAudioUrl(currentTrack);
    if (!audioUrl) {
        safeShowAlert('Аудио файл недоступен');
        isPlayingTrack = false;
        return;
    }
    
    // Load and play audio
    console.log(`Loading audio from: ${audioUrl}`);
    audioPlayer.src = audioUrl;
    audioPlayer.load();
    
    // Try to play
    audioPlayer.play().then(() => {
        console.log('Audio playing successfully');
        updatePlayerDisplay();
        updatePlayButton();
        
        // Send to Telegram bot
        sendDataToBot('track_played', {
            track_id: currentTrack.id || index,
            title: currentTrack.title || currentTrack.name,
            artist: currentTrack.artist || currentTrack.performer
        });
        
        // Increment play count in database
        incrementPlayCount(currentTrack.id);
        
        // Don't show alert on successful play to avoid popup conflicts
        
    }).catch((error) => {
        console.error('Error playing audio:', error);
        
        // Show different messages for demo vs real tracks
        if (currentTrack.file_id && currentTrack.file_id.startsWith('demo')) {
            safeShowAlert('Демо трек - аудио недоступно. Добавьте реальную музыку в группу!');
        } else {
            safeShowAlert('Ошибка воспроизведения: ' + error.message + '\n\nАудио файлы хранятся в базе данных SQLite.');
        }
    }).finally(() => {
        // Reset flag after a delay to allow for normal playback
        setTimeout(() => {
            isPlayingTrack = false;
        }, 1000);
    });
}

function getAudioUrl(track) {
    // Check if track exists and has file_id
    if (!track || !track.file_id) {
        console.error('Track or file_id is missing:', track);
        return null;
    }
    
    // Try different URL patterns
    const fileId = track.file_id;
    
    // For demo tracks, use a test audio file
    if (fileId.startsWith('demo')) {
        // Use a free test audio file from the internet
        return 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav';
    }
    
    // For real tracks, use our Telegram file proxy
    console.log(`Getting audio URL for real track: ${fileId}`);
    return `https://mysicflow.onrender.com/proxy-audio/${fileId}`;
}

function togglePlay() {
    if (!currentTrack || !audioPlayer) return;
    
    // Prevent rapid clicks (debounce)
    const now = Date.now();
    if (now - lastClickTime < 500) {
        console.log('Rapid click detected, ignoring...');
        return;
    }
    lastClickTime = now;
    
    if (isPlaying) {
        audioPlayer.pause();
        // Don't send event here, let the pause event handle it
    } else {
        audioPlayer.play().catch((error) => {
            console.error('Error playing audio:', error);
            safeShowAlert('Ошибка воспроизведения: ' + error.message);
        });
        // Don't send event here, let the play event handle it
    }
}

function playPrevious() {
    if (!currentTrack) return;
    
    // Prevent rapid track switches
    const now = Date.now();
    if (now - lastTrackSwitchTime < 2000) {
        console.log('Rapid track switch detected, ignoring...');
        return;
    }
    lastTrackSwitchTime = now;
    
    const currentIndex = allTracks.findIndex(track => track === currentTrack);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : allTracks.length - 1;
    
    console.log(`Switching from track ${currentIndex} to ${prevIndex}`);
    playTrack(prevIndex);
}

function playNext() {
    if (!currentTrack) return;
    
    // Prevent rapid track switches
    const now = Date.now();
    if (now - lastTrackSwitchTime < 2000) {
        console.log('Rapid track switch detected, ignoring...');
        return;
    }
    lastTrackSwitchTime = now;
    
    const currentIndex = allTracks.findIndex(track => track === currentTrack);
    const nextIndex = currentIndex < allTracks.length - 1 ? currentIndex + 1 : 0;
    
    console.log(`Switching from track ${currentIndex} to ${nextIndex}`);
    playTrack(nextIndex);
}

// ===== TELEGRAM SPECIFIC FUNCTIONS =====

function adjustForTelegram() {
    // Adjust UI for Telegram viewport
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.paddingBottom = '80px'; // Space for player
    }
}

function sendDataToBot(event, data) {
    if (tg && tg.sendData) {
        const message = JSON.stringify({
            event: event,
            data: data,
            timestamp: new Date().toISOString(),
            user_id: telegramUserId
        });
        
        tg.sendData(message);
        console.log('Sent to bot:', message);
    }
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
    updateFavoritesButton();
    updateBackButton();
    
    // Load section-specific data
    if (section === 'home') {
        loadTracks();
    } else if (section === 'favorites') {
        loadFavorites();
    }
}

// showSearch function removed - search is now integrated in home section

function showProfile() {
    showSection('profile');
}

// ===== FAVORITES FUNCTIONALITY =====

function loadFavoritesFromStorage() {
    try {
        const stored = localStorage.getItem('musicFlow_favorites');
        if (stored) {
            favoriteTracks = JSON.parse(stored);
            console.log('Loaded favorites:', favoriteTracks);
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
        favoriteTracks = [];
    }
}

function saveFavoritesToStorage() {
    try {
        localStorage.setItem('musicFlow_favorites', JSON.stringify(favoriteTracks));
        console.log('Saved favorites:', favoriteTracks);
    } catch (error) {
        console.error('Error saving favorites:', error);
    }
}

function toggleFavorite(trackId, event) {
    event.stopPropagation(); // Prevent track play
    
    const index = favoriteTracks.indexOf(trackId);
    if (index > -1) {
        // Remove from favorites
        favoriteTracks.splice(index, 1);
        console.log('Removed from favorites:', trackId);
    } else {
        // Add to favorites
        favoriteTracks.push(trackId);
        console.log('Added to favorites:', trackId);
    }
    
    saveFavoritesToStorage();
    renderTracks(); // Refresh display
    updateFavoritesButton();
    
    // Send to bot
    sendDataToBot('favorite_toggled', {
        track_id: trackId,
        is_favorite: favoriteTracks.includes(trackId)
    });
}

function isFavorite(trackId) {
    return favoriteTracks.includes(trackId);
}

function showFavorites() {
    showSection('favorites');
    loadFavorites();
}

function loadFavorites() {
    const favoritesContainer = document.getElementById('favoritesContainer');
    if (!favoritesContainer) return;
    
    if (favoriteTracks.length === 0) {
        favoritesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star" style="font-size: 48px; color: var(--tg-theme-hint-color, #999); margin-bottom: 16px;"></i>
                <h3>Нет избранных треков</h3>
                <p>Добавьте треки в избранное, нажав на звездочку</p>
            </div>
        `;
        return;
    }
    
    // Filter tracks to show only favorites
    const favoriteTracksList = allTracks.filter(track => isFavorite(track.id));
    
    if (favoriteTracksList.length === 0) {
        favoritesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star" style="font-size: 48px; color: var(--tg-theme-hint-color, #999); margin-bottom: 16px;"></i>
                <h3>Избранные треки не найдены</h3>
                <p>Возможно, треки были удалены из библиотеки</p>
            </div>
        `;
        return;
    }
    
    // Render favorite tracks
    favoritesContainer.innerHTML = favoriteTracksList.map(track => createTrackHTML(track)).join('');
}

function updateFavoritesButton() {
    const favoritesBtn = document.querySelector('.favorites-btn');
    const profileBtn = document.querySelector('.profile-btn');
    
    if (favoritesBtn) {
        if (currentSection === 'favorites') {
            favoritesBtn.classList.add('active');
        } else {
            favoritesBtn.classList.remove('active');
        }
    }
    
    if (profileBtn) {
        if (currentSection === 'profile') {
            profileBtn.classList.add('active');
        } else {
            profileBtn.classList.remove('active');
        }
    }
}

function updateBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        // Show back button only when not on home page
        if (currentSection === 'home') {
            backBtn.style.display = 'none';
        } else {
            backBtn.style.display = 'block';
        }
    }
}

function goBack() {
    showSection('home');
}

// Export functions for global access
window.showSection = showSection;
window.showProfile = showProfile;
window.showFavorites = showFavorites;
window.goBack = goBack;
window.playTrack = playTrack;
window.togglePlay = togglePlay;
window.playPrevious = playPrevious;
window.playNext = playNext;
window.loadTracks = loadTracks;
window.loadFavorites = loadFavorites;
window.toggleFavorite = toggleFavorite;
