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
    });
    
    audioPlayer.addEventListener('pause', function() {
        console.log('Audio paused');
        isPlaying = false;
        updatePlayButton();
    });
    
    audioPlayer.addEventListener('ended', function() {
        console.log('Audio ended');
        isPlaying = false;
        updatePlayButton();
        playNext();
    });
    
    audioPlayer.addEventListener('error', function(e) {
        console.error('Audio error:', e);
        // Don't show alert immediately, let playTrack handle it
    });
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
            `${API_ENDPOINTS[1]}/search?q=${encodeURIComponent(query)}`,
            `${API_ENDPOINTS[0]}?search=${encodeURIComponent(query)}`
        ];
        
        let found = false;
        for (const endpoint of searchEndpoints) {
            try {
                const response = await fetch(endpoint);
                if (response.ok) {
                    const data = await response.json();
                    if (data.results || data.tracks || Array.isArray(data)) {
                        allTracks = data.results || data.tracks || data;
                        found = true;
                        break;
                    }
                }
            } catch (error) {
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
        loadTracks();
    }
}

function playTrack(index) {
    if (index < 0 || index >= allTracks.length) return;
    
    currentTrack = allTracks[index];
    
    // Get audio URL
    const audioUrl = getAudioUrl(currentTrack);
    if (!audioUrl) {
        tg.showAlert('Аудио файл недоступен');
        return;
    }
    
    // Load and play audio
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
        
        // Show Telegram notification
        tg.showAlert(`Воспроизводится: ${currentTrack.title || currentTrack.name}`);
        
    }).catch((error) => {
        console.error('Error playing audio:', error);
        
        // Check if it's a demo track
        if (currentTrack.file_id && currentTrack.file_id.startsWith('demo')) {
            tg.showAlert('Демо трек - аудио недоступно. Добавьте реальную музыку в группу!');
        } else {
            tg.showAlert('Ошибка воспроизведения: ' + error.message);
        }
    });
}

function getAudioUrl(track) {
    // Try different URL patterns
    const fileId = track.file_id;
    if (!fileId) return null;
    
    // For demo tracks, use a test audio file
    if (fileId.startsWith('demo')) {
        // Use a free test audio file from the internet
        return 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav';
    }
    
    // Use proxy endpoint from our API for real tracks
    return `https://mysicflow.onrender.com/proxy-audio/${fileId}`;
}

function togglePlay() {
    if (!currentTrack || !audioPlayer) return;
    
    if (isPlaying) {
        audioPlayer.pause();
    } else {
        audioPlayer.play().catch((error) => {
            console.error('Error playing audio:', error);
            tg.showAlert('Ошибка воспроизведения: ' + error.message);
        });
    }
    
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
    
    // Load section-specific data
    if (section === 'home') {
        loadTracks();
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

// Export functions for global access
window.showSection = showSection;
window.showSearch = showSearch;
window.showProfile = showProfile;
window.playTrack = playTrack;
window.togglePlay = togglePlay;
window.playPrevious = playPrevious;
window.playNext = playNext;
window.loadTracks = loadTracks;
