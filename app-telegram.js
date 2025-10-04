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
let preloadedTracks = new Map(); // Cache for preloaded tracks
let progressUpdateInterval = null; // Interval for updating progress
let isDragging = false; // Track if user is dragging progress bar
// Volume control variables removed

// New features
let isShuffleMode = false; // Shuffle mode state
let isRepeatMode = false; // Repeat mode state
let currentPlaylist = []; // Current playlist
let originalTrackOrder = []; // Original track order for shuffle

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp().catch(console.error);
    setupEventListeners();
    loadTracks();
    sendDataToBot('app_loaded', { timestamp: new Date().toISOString() });
});

// Loading indicator functions
function showLoadingIndicator(message = 'Загрузка...') {
    try {
        // Create or update loading indicator
        let loadingDiv = document.getElementById('loadingIndicator');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.id = 'loadingIndicator';
            loadingDiv.className = 'loading-indicator';
            loadingDiv.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">${message}</div>
                    <div class="loading-progress">
                        <div class="loading-bar"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(loadingDiv);
        } else {
            const loadingText = loadingDiv.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
        }
    
    loadingDiv.style.display = 'flex';
    
    // Animate progress bar
    const progressBar = loadingDiv.querySelector('.loading-bar');
    if (progressBar) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressBar.style.width = progress + '%';
        }, 200);
        
        // Store interval for cleanup
        loadingDiv.interval = interval;
    }
    
    } catch (error) {
        console.error('Error showing loading indicator:', error);
        // Fallback: just log the message
        console.log('Loading:', message);
    }
}

function hideLoadingIndicator() {
    try {
        const loadingDiv = document.getElementById('loadingIndicator');
        if (loadingDiv) {
            // Clear interval
            if (loadingDiv.interval) {
                clearInterval(loadingDiv.interval);
            }
            
            // Complete progress bar
            const progressBar = loadingDiv.querySelector('.loading-bar');
            if (progressBar) {
                progressBar.style.width = '100%';
            }
            
            // Hide after short delay
            setTimeout(() => {
                if (loadingDiv) {
                    loadingDiv.style.display = 'none';
                }
            }, 300);
        }
    } catch (error) {
        console.error('Error hiding loading indicator:', error);
    }
}

// Preload next track for faster playback
function preloadNextTrack(currentIndex) {
    const nextIndex = (currentIndex + 1) % allTracks.length;
    const nextTrack = allTracks[nextIndex];
    
    if (!nextTrack || preloadedTracks.has(nextTrack.id)) {
        return; // Already preloaded or no track
    }
    
    const audioUrl = getAudioUrl(nextTrack);
    if (!audioUrl) {
        return;
    }
    
    // Create hidden audio element for preloading
    const preloadAudio = new Audio();
    preloadAudio.preload = 'auto';
    preloadAudio.src = audioUrl;
    
    preloadAudio.addEventListener('canplaythrough', function() {
        console.log(`Preloaded track: ${nextTrack.title}`);
        preloadedTracks.set(nextTrack.id, preloadAudio);
    });
    
    preloadAudio.addEventListener('error', function() {
        console.log(`Failed to preload track: ${nextTrack.title}`);
    });
    
    // Start loading
    preloadAudio.load();
}

// Progress bar functions
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateProgressBar() {
    if (!audioPlayer) {
        console.log('updateProgressBar: No audioPlayer');
        return;
    }
    
    const currentTime = audioPlayer.currentTime || 0;
    const duration = audioPlayer.duration || 0;
    
    if (duration > 0) {
        const progress = (currentTime / duration) * 100;
        
        // Update progress fill
        const progressFill = document.getElementById('progressFill');
        const progressHandle = document.getElementById('progressHandle');
        
        if (progressFill) {
            progressFill.style.width = progress + '%';
        } else {
            console.log('updateProgressBar: progressFill element not found');
        }
        
        if (progressHandle) {
            progressHandle.style.left = progress + '%';
        } else {
            console.log('updateProgressBar: progressHandle element not found');
        }
        
        // Update time display
        const currentTimeEl = document.getElementById('currentTime');
        const totalTimeEl = document.getElementById('totalTime');
        
        if (currentTimeEl) {
            currentTimeEl.textContent = formatTime(currentTime);
        } else {
            console.log('updateProgressBar: currentTime element not found');
        }
        
        if (totalTimeEl) {
            totalTimeEl.textContent = formatTime(duration);
        } else {
            console.log('updateProgressBar: totalTime element not found');
        }
        
        // Debug logging
        if (Math.floor(currentTime) % 5 === 0) { // Log every 5 seconds
            console.log(`Progress: ${progress.toFixed(1)}% (${formatTime(currentTime)}/${formatTime(duration)})`);
        }
    } else {
        console.log('updateProgressBar: No duration available yet');
    }
}

function startProgressUpdates() {
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
    }
    
    // Use timeupdate event instead of interval for better performance
    // The timeupdate event is already handled in audioPlayer event listeners
    console.log('Progress updates started via timeupdate event');
}

function stopProgressUpdates() {
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
}

function seekTo(event) {
    if (!audioPlayer || !audioPlayer.duration) return;
    
    // Prevent event bubbling to avoid triggering other click handlers
    event.stopPropagation();
    event.preventDefault();
    
    const progressBar = document.getElementById('progressBar');
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * audioPlayer.duration;
    
    console.log(`Seeking to: ${newTime.toFixed(2)}s (${(percentage * 100).toFixed(1)}%)`);
    
    // Simple seeking - now that server supports range requests
    audioPlayer.currentTime = newTime;
    
    // Update progress bar immediately
    updateProgressBar();
}

// Touch support for mobile devices
function seekToTouch(event) {
    if (!audioPlayer || !audioPlayer.duration) return;
    
    // Prevent event bubbling
    event.stopPropagation();
    event.preventDefault();
    
    const progressBar = document.getElementById('progressBar');
    const rect = progressBar.getBoundingClientRect();
    const touch = event.touches[0] || event.changedTouches[0];
    const clickX = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * audioPlayer.duration;
    
    console.log(`Touch seeking to: ${newTime.toFixed(2)}s (${(percentage * 100).toFixed(1)}%)`);
    
    // Add visual feedback
    progressBar.classList.add('touching');
    
    // Simple seeking - now that server supports range requests
    audioPlayer.currentTime = newTime;
    
    // Update progress bar immediately
    updateProgressBar();
    
    // Remove visual feedback
    setTimeout(() => {
        progressBar.classList.remove('touching');
    }, 200);
}

// Alternative seeking method that doesn't trigger events
function seekToAlternative(event) {
    if (!audioPlayer || !audioPlayer.duration) return;
    
    event.stopPropagation();
    event.preventDefault();
    
    const progressBar = document.getElementById('progressBar');
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * audioPlayer.duration;
    
    console.log(`Alternative seeking to: ${newTime.toFixed(2)}s (${(percentage * 100).toFixed(1)}%)`);
    console.log(`Audio seeking support: ${audioPlayer.seekable.length > 0 ? 'YES' : 'NO'}`);
    console.log(`Audio ready state: ${audioPlayer.readyState}`);
    console.log(`Audio network state: ${audioPlayer.networkState}`);
    
    // Check if seeking is supported
    if (audioPlayer.seekable.length === 0) {
        console.error('Audio seeking not supported - no seekable ranges');
        return;
    }
    
    // Check if we're in a seekable range
    const seekableStart = audioPlayer.seekable.start(0);
    const seekableEnd = audioPlayer.seekable.end(0);
    console.log(`Seekable range: ${seekableStart}s - ${seekableEnd}s`);
    
    if (newTime < seekableStart || newTime > seekableEnd) {
        console.error(`Seek time ${newTime}s is outside seekable range ${seekableStart}s - ${seekableEnd}s`);
        return;
    }
    
    // Use a more direct approach
    try {
        const wasPlaying = !audioPlayer.paused;
        console.log(`Was playing: ${wasPlaying}`);
        
        // Set time directly
        audioPlayer.currentTime = newTime;
        
        // Wait a bit and check if it worked
        setTimeout(() => {
            const actualTime = audioPlayer.currentTime;
            console.log(`Actual time after seek: ${actualTime.toFixed(2)}s`);
            
            if (Math.abs(actualTime - newTime) > 1) {
                console.error(`Seek failed! Expected: ${newTime.toFixed(2)}s, Got: ${actualTime.toFixed(2)}s`);
                
                // Try alternative approach - reload and seek
                console.log('Trying alternative approach - reload and seek');
                const currentSrc = audioPlayer.src;
                audioPlayer.src = '';
                audioPlayer.src = currentSrc;
                audioPlayer.load();
                
                audioPlayer.addEventListener('canplay', function seekAfterLoad() {
                    audioPlayer.removeEventListener('canplay', seekAfterLoad);
                    audioPlayer.currentTime = newTime;
                    console.log(`Alternative seek result: ${audioPlayer.currentTime.toFixed(2)}s`);
                }, { once: true });
            } else {
                console.log(`Seek successful! Time: ${actualTime.toFixed(2)}s`);
            }
            
            // Force update progress bar
            updateProgressBar();
        }, 100);
        
    } catch (error) {
        console.error('Seek error:', error);
    }
}

// Range request seeking method for streaming audio
function seekWithRangeRequest(event) {
    if (!audioPlayer || !audioPlayer.duration) return;
    
    event.stopPropagation();
    event.preventDefault();
    
    const progressBar = document.getElementById('progressBar');
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * audioPlayer.duration;
    
    console.log(`Range request seeking to: ${newTime.toFixed(2)}s (${(percentage * 100).toFixed(1)}%)`);
    
    // For streaming audio, we need to reload with range request
    const currentSrc = audioPlayer.src;
    const wasPlaying = !audioPlayer.paused;
    
    // Calculate byte range for the seek position
    // This is a rough estimation - actual implementation would need server support
    const estimatedFileSize = 1000000; // 1MB estimate
    const bytesPerSecond = estimatedFileSize / audioPlayer.duration;
    const startByte = Math.floor(newTime * bytesPerSecond);
    const endByte = Math.min(startByte + 100000, estimatedFileSize); // 100KB chunk
    
    console.log(`Requesting bytes ${startByte}-${endByte} for time ${newTime}s`);
    
    // Create new audio element with range request
    const newAudio = new Audio();
    newAudio.crossOrigin = 'anonymous';
    
    // Set up range request headers
    const xhr = new XMLHttpRequest();
    xhr.open('GET', currentSrc, true);
    xhr.setRequestHeader('Range', `bytes=${startByte}-${endByte}`);
    xhr.responseType = 'blob';
    
    xhr.onload = function() {
        if (xhr.status === 206) { // Partial content
            const blob = xhr.response;
            const blobUrl = URL.createObjectURL(blob);
            
            // Replace current audio with new one
            audioPlayer.src = blobUrl;
            audioPlayer.currentTime = newTime - (startByte / bytesPerSecond);
            audioPlayer.load();
            
            if (wasPlaying) {
                audioPlayer.play().catch(e => console.log('Range seek play error:', e));
            }
            
            console.log(`Range seek successful: ${audioPlayer.currentTime.toFixed(2)}s`);
        } else {
            console.error('Range request failed, falling back to normal seek');
            // Fallback to normal seeking
            audioPlayer.currentTime = newTime;
        }
    };
    
    xhr.onerror = function() {
        console.error('Range request error, falling back to normal seek');
        audioPlayer.currentTime = newTime;
    };
    
    xhr.send();
}

// Volume control functions removed

// Volume feedback functions removed

// Volume dragging functions removed

// Make functions globally available
window.seekTo = seekTo;
window.seekToTouch = seekToTouch;
window.seekToAlternative = seekToAlternative;
window.seekWithRangeRequest = seekWithRangeRequest;
window.toggleShuffle = toggleShuffle;
window.toggleRepeat = toggleRepeat;
window.showPlaylist = showPlaylist;
window.clearPlaylist = clearPlaylist;

async function initializeApp() {
    // Get Telegram user ID
    if (tg.initDataUnsafe?.user) {
        telegramUserId = tg.initDataUnsafe.user.id;
        console.log('Telegram User ID:', telegramUserId);
    }
    
    // Load favorites from backend
    await loadFavoritesFromStorage();
    
    // Initialize audio player
    initializeAudioPlayer();
    
    // Update statistics
    updatePlaylistStats();
    
    // Initialize player display with no track selected
    currentTrack = null;
    currentTrackIndex = null;
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
        // Only hide loading indicator if not seeking
        if (!isDragging) {
            hideLoadingIndicator();
        }
    });
    
    audioPlayer.addEventListener('play', function() {
        console.log('Audio started playing');
        isPlaying = true;
        updatePlayButton();
        
        // Only hide loading indicator and start progress updates if not seeking
        if (!isDragging) {
            hideLoadingIndicator();
            startProgressUpdates();
        }
        
        // Send play event only once and only if not seeking
        if (currentTrack && !isDragging) {
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
        stopProgressUpdates();
        
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
        stopProgressUpdates();
        
        // Reset progress bar
        const progressFill = document.getElementById('progressFill');
        const progressHandle = document.getElementById('progressHandle');
        const currentTimeEl = document.getElementById('currentTime');
        
        if (progressFill) progressFill.style.width = '0%';
        if (progressHandle) progressHandle.style.left = '0%';
        if (currentTimeEl) currentTimeEl.textContent = '0:00';
        
        // Don't auto-play next track to prevent loops
        // playNext();
    });
    
    audioPlayer.addEventListener('timeupdate', function() {
        // Update progress bar during playback
        updateProgressBar();
    });
    
    audioPlayer.addEventListener('loadedmetadata', function() {
        // Update total time when metadata is loaded
        updateProgressBar();
        
        // Check seeking support
        console.log('Audio metadata loaded:');
        console.log(`- Duration: ${audioPlayer.duration}s`);
        console.log(`- Seekable ranges: ${audioPlayer.seekable.length}`);
        if (audioPlayer.seekable.length > 0) {
            console.log(`- Seekable range: ${audioPlayer.seekable.start(0)}s - ${audioPlayer.seekable.end(0)}s`);
        }
        console.log(`- Ready state: ${audioPlayer.readyState}`);
    });
    
    audioPlayer.addEventListener('error', function(e) {
        console.error('Audio error:', e);
        hideLoadingIndicator();
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
    
    // Update favorite status for all tracks after rendering
    updateFavoriteStatuses();
}

async function updateFavoriteStatuses() {
    if (!telegramUserId) return;
    
    // Update favorite status for each track
    for (const track of allTracks) {
        try {
            const isFav = await isFavorite(track.id);
            const favoriteBtn = document.getElementById(`favorite-btn-${track.id}`);
            if (favoriteBtn) {
                if (isFav) {
                    favoriteBtn.classList.add('active');
                    favoriteBtn.title = 'Убрать из избранного';
                } else {
                    favoriteBtn.classList.remove('active');
                    favoriteBtn.title = 'Добавить в избранное';
                }
            }
        } catch (error) {
            console.error(`Error updating favorite status for track ${track.id}:`, error);
        }
    }
}

function createTrackHTML(track, index) {
    // For now, we'll show the star as inactive and update it after checking the API
    // Find the actual index in allTracks array
    const actualIndex = allTracks.findIndex(t => t.id === track.id);
    const playIndex = actualIndex !== -1 ? actualIndex : 0; // Fallback to 0 if not found
    
    return `
        <div class="track-item" onclick="selectTrack(${playIndex})" data-track-id="${track.id}">
            <div class="track-info">
                <div class="track-title">${escapeHtml(track.title || track.name || 'Без названия')}</div>
                <div class="track-artist">${escapeHtml(track.artist || track.performer || 'Неизвестный исполнитель')}</div>
                <div class="track-meta">
                    <span class="track-duration">${formatDuration(track.duration || track.length)}</span>
                    ${track.play_count > 0 ? `<span class="play-count">${track.play_count} прослушиваний</span>` : ''}
                </div>
            </div>
            <button class="favorite-btn" id="favorite-btn-${track.id}" onclick="toggleFavorite(${track.id}, event)" title="Добавить в избранное">
                <i class="fas fa-star"></i>
            </button>
            <div class="track-actions">
                <button class="playlist-add-btn" onclick="event.stopPropagation(); addToPlaylist(track)" title="Добавить в плейлист">
                    <i class="fas fa-plus"></i>
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

function selectTrack(index) {
    if (index < 0 || index >= allTracks.length) {
        console.log('Invalid track index:', index);
        return;
    }
    
    const track = allTracks[index];
    console.log('Selected track:', track.title, 'at index:', index);
    
    // Set current track
    currentTrackIndex = index;
    currentTrack = track;
    
    // Update player display
    updatePlayerDisplay();
    
    // Update track selection visual
    updateTrackSelection(index);
}

function updateTrackSelection(index) {
    // Remove selection from all tracks
    document.querySelectorAll('.track-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection to current track
    const trackItem = document.querySelector(`[data-track-id="${allTracks[index].id}"]`);
    if (trackItem) {
        trackItem.classList.add('selected');
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
    
    // Show loading indicator
    showLoadingIndicator('Загрузка аудио...');
    
    // Get audio URL
    const audioUrl = getAudioUrl(currentTrack);
    if (!audioUrl) {
        hideLoadingIndicator();
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
        hideLoadingIndicator();
        
        // Initialize progress bar
        updateProgressBar();
        
        // Preload next track
        preloadNextTrack(index);
        
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
    if (!currentTrack || !audioPlayer) {
        console.log('No track selected or audio player not available');
        return;
    }
    
    // If no track index is available, try to find it
    if (currentTrackIndex === null || currentTrackIndex === undefined) {
        const trackIndex = allTracks.findIndex(t => t.id === currentTrack.id);
        if (trackIndex === -1) {
            console.log('Track not found in allTracks');
            return;
        }
        currentTrackIndex = trackIndex;
    }
    
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
    if (!currentTrack) {
        // No track selected - show placeholder
        const trackTitle = document.getElementById('currentTrackTitle');
        const trackArtist = document.getElementById('currentTrackArtist');
        
        if (trackTitle) trackTitle.textContent = 'Выберите трек для воспроизведения';
        if (trackArtist) trackArtist.textContent = '';
        
        // Disable play button
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.disabled = true;
            playBtn.style.opacity = '0.5';
        }
        return;
    }
    
    const trackTitle = document.getElementById('currentTrackTitle');
    const trackArtist = document.getElementById('currentTrackArtist');
    
    if (trackTitle) trackTitle.textContent = currentTrack.title || currentTrack.name || 'Без названия';
    if (trackArtist) trackArtist.textContent = currentTrack.artist || currentTrack.performer || 'Неизвестный исполнитель';
    
    // Enable play button
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.disabled = false;
        playBtn.style.opacity = '1';
    }
    
    // Reset progress bar when switching tracks
    const progressFill = document.getElementById('progressFill');
    const progressHandle = document.getElementById('progressHandle');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    
    if (progressFill) progressFill.style.width = '0%';
    if (progressHandle) progressHandle.style.left = '0%';
    if (currentTimeEl) currentTimeEl.textContent = '0:00';
    if (totalTimeEl) totalTimeEl.textContent = '0:00';
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

async function loadFavoritesFromStorage() {
    // Load favorites from backend API
    if (!telegramUserId) {
        console.log('Telegram User ID not available for loading favorites');
        return;
    }
    
    try {
        const response = await fetch(`https://mysicflow.onrender.com/favorites/${telegramUserId}`);
        if (response.ok) {
            const result = await response.json();
            favoriteTracks = result.tracks.map(track => track.id);
            console.log('Loaded favorites from backend:', favoriteTracks);
        } else {
            console.log('Failed to load favorites from backend');
            favoriteTracks = [];
        }
    } catch (error) {
        console.error('Error loading favorites from backend:', error);
        favoriteTracks = [];
    }
}

function saveFavoritesToStorage() {
    // No longer using localStorage - using backend API with Telegram ID
    console.log('Favorites now stored on backend with Telegram ID:', telegramUserId);
}

async function toggleFavorite(trackId, event) {
    event.stopPropagation(); // Prevent track play
    
    if (!telegramUserId) {
        console.error('Telegram User ID not available');
        return;
    }
    
    try {
        // Call backend API to toggle favorite
        const response = await fetch(`https://mysicflow.onrender.com/favorites/${telegramUserId}/${trackId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Favorite toggle result:', result);
        
        // Update UI
        renderTracks(); // Refresh display
        updateFavoritesButton();
        
        // Send to bot
        sendDataToBot('favorite_toggled', {
            track_id: trackId,
            is_favorite: result.action === 'added'
        });
        
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}

async function isFavorite(trackId) {
    if (!telegramUserId) {
        return false;
    }
    
    try {
        const response = await fetch(`https://mysicflow.onrender.com/favorites/${telegramUserId}/check/${trackId}`);
        if (!response.ok) {
            return false;
        }
        const result = await response.json();
        return result.is_favorite;
    } catch (error) {
        console.error('Error checking favorite status:', error);
        return false;
    }
}

function showFavorites() {
    showSection('favorites');
    loadFavorites();
}

async function loadFavorites() {
    const favoritesContainer = document.getElementById('favoritesContainer');
    if (!favoritesContainer) return;
    
    if (!telegramUserId) {
        favoritesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star" style="font-size: 48px; color: var(--tg-theme-hint-color, #999); margin-bottom: 16px;"></i>
                <h3>Не удалось загрузить избранное</h3>
                <p>Telegram User ID не найден</p>
            </div>
        `;
        return;
    }
    
    try {
        // Get favorites from backend API
        const response = await fetch(`https://mysicflow.onrender.com/favorites/${telegramUserId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        const favoriteTracksList = result.tracks;
        
        if (favoriteTracksList.length === 0) {
            favoritesContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-star" style="font-size: 48px; color: var(--tg-theme-hint-color, #999); margin-bottom: 16px;"></i>
                    <h3>Нет избранных треков</h3>
                    <p>Добавьте треки в избранное, нажав на звездочку</p>
                </div>
            `;
            return;
        }
        
        // Render favorite tracks
        favoritesContainer.innerHTML = favoriteTracksList.map(track => createTrackHTML(track)).join('');
        
    } catch (error) {
        console.error('Error loading favorites:', error);
        favoritesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star" style="font-size: 48px; color: var(--tg-theme-hint-color, #999); margin-bottom: 16px;"></i>
                <h3>Ошибка загрузки избранного</h3>
                <p>Попробуйте позже</p>
            </div>
        `;
    }
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

// ===== NEW FEATURES =====

// Shuffle functionality
function toggleShuffle() {
    isShuffleMode = !isShuffleMode;
    const shuffleBtn = document.getElementById('shuffleBtn');
    
    if (shuffleBtn) {
        if (isShuffleMode) {
            shuffleBtn.classList.add('active');
            // Save original order
            originalTrackOrder = [...allTracks];
            // Shuffle tracks
            shuffleTracks();
        } else {
            shuffleBtn.classList.remove('active');
            // Restore original order
            allTracks = [...originalTrackOrder];
            renderTracks();
        }
    }
    
    console.log(`Shuffle mode: ${isShuffleMode ? 'ON' : 'OFF'}`);
}

function shuffleTracks() {
    if (allTracks.length <= 1) return;
    
    const shuffled = [...allTracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    allTracks = shuffled;
    renderTracks();
}

// Repeat functionality
function toggleRepeat() {
    isRepeatMode = !isRepeatMode;
    const repeatBtn = document.getElementById('repeatBtn');
    
    if (repeatBtn) {
        if (isRepeatMode) {
            repeatBtn.classList.add('active');
        } else {
            repeatBtn.classList.remove('active');
        }
    }
    
    console.log(`Repeat mode: ${isRepeatMode ? 'ON' : 'OFF'}`);
}

// Playlist functionality
function showPlaylist() {
    showSection('playlist');
    loadPlaylist();
}

function loadPlaylist() {
    const playlistContent = document.getElementById('playlistContent');
    if (!playlistContent) return;
    
    if (currentPlaylist.length === 0) {
        playlistContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-list" style="font-size: 48px; color: var(--text-hint); margin-bottom: 16px;"></i>
                <h3>Плейлист пуст</h3>
                <p>Добавьте треки в плейлист для воспроизведения</p>
            </div>
        `;
        return;
    }
    
    const playlistHtml = currentPlaylist.map((track, index) => `
        <div class="playlist-item ${currentTrackIndex === index ? 'playing' : ''}" onclick="playTrackFromPlaylist(${index})">
            <div class="playlist-item-number">${index + 1}</div>
            <div class="playlist-item-info">
                <div class="playlist-item-title">${escapeHtml(track.title || track.name || 'Без названия')}</div>
                <div class="playlist-item-artist">${escapeHtml(track.artist || track.performer || 'Неизвестный исполнитель')}</div>
            </div>
            <div class="playlist-item-actions">
                <button class="playlist-remove-btn" onclick="removeFromPlaylist(${index}, event)" title="Удалить из плейлиста">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    playlistContent.innerHTML = playlistHtml;
}

function addToPlaylist(track) {
    if (!currentPlaylist.find(t => t.id === track.id)) {
        currentPlaylist.push(track);
        updatePlaylistStats();
        console.log(`Added to playlist: ${track.title}`);
    }
}

function removeFromPlaylist(index, event) {
    event.stopPropagation();
    currentPlaylist.splice(index, 1);
    loadPlaylist();
    updatePlaylistStats();
}

function clearPlaylist() {
    currentPlaylist = [];
    loadPlaylist();
    updatePlaylistStats();
}

function playTrackFromPlaylist(index) {
    const track = currentPlaylist[index];
    if (track) {
        // Find track in allTracks and play it
        const trackIndex = allTracks.findIndex(t => t.id === track.id);
        if (trackIndex !== -1) {
            playTrack(trackIndex);
        }
    }
}

// Statistics
function updatePlaylistStats() {
    const totalTracksEl = document.getElementById('totalTracks');
    const favoriteCountEl = document.getElementById('favoriteCount');
    const playlistCountEl = document.getElementById('playlistCount');
    
    if (totalTracksEl) {
        totalTracksEl.textContent = allTracks.length;
    }
    
    if (favoriteCountEl) {
        favoriteCountEl.textContent = favoriteTracks.length;
    }
    
    if (playlistCountEl) {
        playlistCountEl.textContent = currentPlaylist.length;
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
