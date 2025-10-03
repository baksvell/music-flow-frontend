// Telegram Web App API
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
// const API_BASE_URL = 'http://localhost:8000'; // Для разработки
// const API_BASE_URL = 'https://YOUR_NGROK_URL.ngrok.io'; // Для продакшена
// const API_BASE_URL = 'https://fair-moles-worry.loca.lt'; // Для LocalTunnel
// const API_BASE_URL = 'https://YOUR_RAILWAY_URL.railway.app'; // Замените на ваш Railway URL
const API_BASE_URL = 'https://mysicflow.onrender.com'; // Render.com API

// App State
let currentSection = 'home';
let isPlaying = false;
let currentTrack = 0;
let currentPlaylist = null;
let isShuffled = false;
let isRepeated = false;
let volume = 0.8;
let telegramUserId = null;

// Sample data
const playlists = {
    'popular': {
        name: 'Популярная музыка',
        tracks: [
            { title: 'Shape of You', artist: 'Ed Sheeran', duration: '3:53' },
            { title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:20' },
            { title: 'Watermelon Sugar', artist: 'Harry Styles', duration: '2:54' }
        ]
    },
    'rock': {
        name: 'Рок классика',
        tracks: [
            { title: 'Bohemian Rhapsody', artist: 'Queen', duration: '5:55' },
            { title: 'Hotel California', artist: 'Eagles', duration: '6:30' },
            { title: 'Stairway to Heaven', artist: 'Led Zeppelin', duration: '8:02' }
        ]
    },
    'electronic': {
        name: 'Электронная музыка',
        tracks: [
            { title: 'One More Time', artist: 'Daft Punk', duration: '5:20' },
            { title: 'Levels', artist: 'Avicii', duration: '3:19' },
            { title: 'Titanium', artist: 'David Guetta ft. Sia', duration: '4:05' }
        ]
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadUserData();
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

    // Show welcome message
    console.log('Добро пожаловать в MusicFlow! 🎵');
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
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
}

// Navigation functions
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionId).classList.add('active');

    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const navItem = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('open');

    currentSection = sectionId;

    // Send data to bot
    sendDataToBot('section_changed', {
        section: sectionId,
        timestamp: new Date().toISOString()
    });
}

function showSearch() {
    showSection('search');
    document.getElementById('searchInput').focus();
}

function showProfile() {
    showSection('profile');
}

// Library functions
function showLibraryTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.querySelector(`[onclick="showLibraryTab('${tab}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Show tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabContent = document.getElementById(`${tab}-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
}

// Playlist functions
function playPlaylist(playlistId) {
    if (playlists[playlistId]) {
        currentPlaylist = playlists[playlistId];
        currentTrack = 0;

        // Show playlist modal
        showPlaylistModal(playlistId);

        // Send data to bot
        sendDataToBot('playlist_selected', {
            playlist: playlistId,
            playlistName: currentPlaylist.name,
            trackCount: currentPlaylist.tracks.length,
            timestamp: new Date().toISOString()
        });
    }
}

function showPlaylistModal(playlistId) {
    const modal = document.getElementById('playlistModal');
    const playlist = playlists[playlistId];

    if (playlist && modal) {
        // Update modal content
        modal.querySelector('.modal-header h3').textContent = playlist.name;

        const trackList = modal.querySelector('.track-list');
        trackList.innerHTML = '';

        playlist.tracks.forEach((track, index) => {
            const trackItem = document.createElement('div');
            trackItem.className = 'track-item';
            trackItem.innerHTML = `
                <div class="track-number">${index + 1}</div>
                <div class="track-info">
                    <h4>${track.title}</h4>
                    <p>${track.artist}</p>
                </div>
                <button class="play-track-btn" onclick="playTrack(${index})">
                    <i class="fas fa-play"></i>
                </button>
            `;
            trackList.appendChild(trackItem);
        });

        // Show modal
        modal.classList.add('show');
    }
}

function closePlaylist() {
    const modal = document.getElementById('playlistModal');
    modal.classList.remove('show');
}

function playTrack(trackIndex) {
    if (currentPlaylist && currentPlaylist.tracks[trackIndex]) {
        currentTrack = trackIndex;
        const track = currentPlaylist.tracks[trackIndex];

        // Update player display
        updatePlayerDisplay();

        // Start playing
        togglePlayPause();

        // Send data to bot
        sendDataToBot('track_started', {
            track: track.title,
            artist: track.artist,
            playlist: currentPlaylist.name,
            timestamp: new Date().toISOString()
        });
    }
}

// Player functions
function togglePlayPause() {
    console.log('togglePlayPause вызвана, currentAudio:', window.currentAudio);
    
    // Если есть реальное аудио, управляем им
    if (window.currentAudio) {
        console.log('Аудио состояние:', {
            paused: window.currentAudio.paused,
            readyState: window.currentAudio.readyState,
            networkState: window.currentAudio.networkState,
            src: window.currentAudio.src
        });
        
        if (window.currentAudio.paused) {
            console.log('Пытаемся запустить воспроизведение');
            window.currentAudio.play().then(() => {
                console.log('Воспроизведение запущено успешно');
                isPlaying = true;
                const playPauseBtn = document.querySelector('.play-pause i');
                if (playPauseBtn) {
                    playPauseBtn.className = 'fas fa-pause';
                }
                console.log('▶️ Воспроизведение началось!');
            }).catch(error => {
                console.error('Ошибка воспроизведения:', error);
                console.error(`❌ Ошибка воспроизведения: ${error.message}`);
            });
        } else {
            console.log('Ставим на паузу');
            window.currentAudio.pause();
            isPlaying = false;
            const playPauseBtn = document.querySelector('.play-pause i');
            if (playPauseBtn) {
                playPauseBtn.className = 'fas fa-play';
            }
            console.log('⏸️ Пауза');
        }
        return;
    }

    // Обычная логика для демо-плеера
    isPlaying = !isPlaying;

    const playPauseBtn = document.querySelector('.play-pause i');
    if (playPauseBtn) {
        playPauseBtn.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }

    // Send data to bot
    sendDataToBot(isPlaying ? 'play_started' : 'play_paused', {
        track: currentPlaylist ? currentPlaylist.tracks[currentTrack]?.title : 'Unknown',
        playlist: currentPlaylist ? currentPlaylist.name : 'Unknown',
        timestamp: new Date().toISOString()
    });

    // Simulate playback
    if (isPlaying) {
        simulatePlayback();
    }
}

function previousTrack() {
    if (currentPlaylist) {
        currentTrack = currentTrack > 0 ? currentTrack - 1 : currentPlaylist.tracks.length - 1;
        updatePlayerDisplay();

        if (isPlaying) {
            sendDataToBot('track_changed', {
                direction: 'previous',
                track: currentPlaylist.tracks[currentTrack].title,
                timestamp: new Date().toISOString()
            });
        }
    }
}

function nextTrack() {
    if (currentPlaylist) {
        if (isRepeated) {
            // Stay on same track
        } else {
            currentTrack = currentTrack < currentPlaylist.tracks.length - 1 ? currentTrack + 1 : 0;
        }
        updatePlayerDisplay();

        if (isPlaying) {
            sendDataToBot('track_changed', {
                direction: 'next',
                track: currentPlaylist.tracks[currentTrack].title,
                timestamp: new Date().toISOString()
            });
        }
    }
}

function shuffleToggle() {
    isShuffled = !isShuffled;

    const shuffleBtn = document.querySelector('[onclick="shuffleToggle()"] i');
    if (shuffleBtn) {
        shuffleBtn.style.color = isShuffled ? 'var(--tg-theme-button-color)' : '';
    }

    sendDataToBot('shuffle_toggled', {
        enabled: isShuffled,
        timestamp: new Date().toISOString()
    });
}

function repeatToggle() {
    isRepeated = !isRepeated;

    const repeatBtn = document.querySelector('[onclick="repeatToggle()"] i');
    if (repeatBtn) {
        repeatBtn.style.color = isRepeated ? 'var(--tg-theme-button-color)' : '';
    }

    sendDataToBot('repeat_toggled', {
        enabled: isRepeated,
        timestamp: new Date().toISOString()
    });
}

function updatePlayerDisplay() {
    if (currentPlaylist && currentPlaylist.tracks[currentTrack]) {
        const track = currentPlaylist.tracks[currentTrack];

        document.querySelector('.track-title').textContent = track.title;
        document.querySelector('.track-artist').textContent = track.artist;
    }
}

function simulatePlayback() {
    if (isPlaying && currentPlaylist) {
        const track = currentPlaylist.tracks[currentTrack];
        const duration = parseTime(track.duration);
        let currentTime = 0;

        const interval = setInterval(() => {
            if (!isPlaying) {
                clearInterval(interval);
                return;
            }

            currentTime += 1;
            updateProgress(currentTime, duration);

            if (currentTime >= duration) {
                clearInterval(interval);
                if (isRepeated) {
                    currentTime = 0;
                    simulatePlayback();
                } else {
                    nextTrack();
                }
            }
        }, 1000);
    }
}

function updateProgress(current, total) {
    const progress = document.querySelector('.progress');
    const currentTimeEl = document.querySelector('.time:first-child');
    const totalTimeEl = document.querySelector('.time:last-child');

    if (progress) {
        progress.style.width = `${(current / total) * 100}%`;
    }

    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(current);
    }

    if (totalTimeEl) {
        totalTimeEl.textContent = formatTime(total);
    }
}

function parseTime(timeStr) {
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function handleProgressClick(event) {
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;

    if (currentPlaylist) {
        const track = currentPlaylist.tracks[currentTrack];
        const duration = parseTime(track.duration);
        const newTime = Math.floor(duration * percentage);

        updateProgress(newTime, duration);

        sendDataToBot('progress_changed', {
            time: newTime,
            duration: duration,
            percentage: percentage,
            timestamp: new Date().toISOString()
        });
    }
}

// Volume functions
function toggleMute() {
    volume = volume > 0 ? 0 : 0.8;
    updateVolumeDisplay();

    sendDataToBot('volume_changed', {
        volume: volume,
        muted: volume === 0,
        timestamp: new Date().toISOString()
    });
}

function updateVolumeDisplay() {
    const volumeProgress = document.querySelector('.volume-progress');
    const volumeBtn = document.querySelector('.volume-btn i');

    if (volumeProgress) {
        volumeProgress.style.width = `${volume * 100}%`;
    }

    if (volumeBtn) {
        if (volume === 0) {
            volumeBtn.className = 'fas fa-volume-mute';
        } else if (volume < 0.5) {
            volumeBtn.className = 'fas fa-volume-down';
        } else {
            volumeBtn.className = 'fas fa-volume-up';
        }
    }
}

function handleVolumeClick(event) {
    const volumeBar = event.currentTarget;
    const rect = volumeBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    volume = Math.max(0, Math.min(1, clickX / rect.width));

    updateVolumeDisplay();

    sendDataToBot('volume_changed', {
        volume: volume,
        timestamp: new Date().toISOString()
    });
}

// Принудительный локальный режим для тестирования
const FORCE_LOCAL_MODE = false; // Установите в true для локального тестирования

// Отладочная информация
console.log('=== ОТЛАДКА РЕЖИМА ===');
console.log('FORCE_LOCAL_MODE:', FORCE_LOCAL_MODE);
console.log('window.Telegram:', window.Telegram);
console.log('window.location.protocol:', window.location.protocol);
console.log('Режим:', FORCE_LOCAL_MODE || !window.Telegram || !window.Telegram.WebApp || window.location.protocol === 'file:' ? 'ЛОКАЛЬНЫЙ' : 'TELEGRAM');
console.log('====================');

// Демо-данные для локального тестирования
const DEMO_TRACKS = [
    {
        message_id: 1,
        title: "Лишь о тебе мечтая",
        artist: "Руки Вверх",
        duration: 210,
        file_id: "demo_audio_1",
        file_size: 6800000,
        mime_type: "audio/mpeg",
        type: "audio",
        date: "2025-10-02T07:42:41"
    },
    {
        message_id: 2,
        title: "Свобода",
        artist: "Ленинград",
        duration: 189,
        file_id: "CQACAgIAAyEFAAS0qIPEAAMQaN32lyNQUbdvPvs-FSRlb4dS3s4AAht9AAKBvvFK1WOO7vC2V3I2BA",
        file_size: 3121398,
        mime_type: "audio/mp4",
        type: "audio",
        date: "2025-10-02T03:50:47+00:00"
    },
    {
        message_id: 3,
        title: "3-е Сентября",
        artist: "Михаил Шуфутинский",
        duration: 223,
        file_id: "real_file_id_shufu",
        file_size: 3568622,
        mime_type: "audio/mpeg",
        type: "audio",
        date: "2025-10-02T06:55:31+00:00"
    },
    {
        message_id: 4,
        title: "привет.mp3",
        artist: "Неизвестный исполнитель",
        duration: 223,
        file_id: "CQACAgIAAyEFAAS0qIPEAAMRaN34d0drdetkXOydDQt0yWeXw90AAiZ9AAKBvvFK1WOO7vC2V3I2BA",
        file_size: 3568622,
        mime_type: "audio/mpeg",
        type: "audio",
        date: "2025-10-02T03:58:47+00:00"
    }
];

// Локальный поиск с демо-данными
async function handleLocalSearch(query, resultsContainer) {
    console.log('Локальный поиск по запросу:', query);
    
    // Имитируем задержку API
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const queryLower = query.toLowerCase();
    const results = DEMO_TRACKS.filter(track => 
        track.title.toLowerCase().includes(queryLower) || 
        track.artist.toLowerCase().includes(queryLower)
    );
    
    if (results.length > 0) {
        resultsContainer.innerHTML = `
            <div class="search-info">
                🎵 Найдено ${results.length} треков (демо-данные для локального тестирования)
            </div>
            ${results.map(result => {
                const duration = result.duration ? formatTime(result.duration) : 'N/A';
                const fileSize = result.file_size ? formatFileSize(result.file_size) : '';
                
                return `
                    <div class="track-item">
                        <div class="track-info">
                            <h4>${escapeHtml(result.title)}</h4>
                            <p>${escapeHtml(result.artist)}</p>
                            <div class="track-meta">
                                <span class="duration">${duration}</span>
                                ${fileSize ? `<span class="file-size">${fileSize}</span>` : ''}
                            </div>
                        </div>
                        <button class="play-btn" onclick="playTelegramTrack('${result.file_id}', '${escapeHtml(result.title)}', '${escapeHtml(result.artist)}', ${result.message_id})">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                `;
            }).join('')}
        `;
    } else {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <p>❌ Треки не найдены</p>
                <p>Попробуйте поискать: "Руки Вверх", "Ленинград", "Шуфутинский", "привет"</p>
            </div>
        `;
    }
}

// Enhanced Search functions with Telegram integration
async function handleSearch(event) {
    const query = event.target.value.trim();
    const resultsContainer = document.getElementById('searchResults');

    if (query.length < 2) {
        resultsContainer.innerHTML = '<p>Введите запрос для поиска музыки в группе MPFM_cloud</p>';
        return;
    }

    // Show loading
    resultsContainer.innerHTML = '<div class="loading">🔍 Поиск в группе MPFM_cloud...</div>';

    try {
        // Проверяем, работаем ли мы локально (без Telegram Web App)
        if (FORCE_LOCAL_MODE || !window.Telegram || !window.Telegram.WebApp || window.location.protocol === 'file:') {
            console.log('Локальный режим - используем демо-данные');
            await handleLocalSearch(query, resultsContainer);
            return;
        }

        // Search in Telegram group MPFM_cloud
        console.log('Отправляем запрос к API:', `${API_BASE_URL}/search/music?query=${encodeURIComponent(query)}&limit=20`);
        const response = await fetch(`${API_BASE_URL}/search/music?query=${encodeURIComponent(query)}&limit=20`);
        
        console.log('Ответ API:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Данные от API:', data);
        
        if (data.results && data.results.length > 0) {
            resultsContainer.innerHTML = `
                <div class="search-info">
                    🎵 Найдено ${data.results.length} треков в группе <strong>${data.source}</strong>
                    </div>
                ${data.results.map(result => {
                    const duration = result.duration ? formatTime(result.duration) : 'N/A';
                    const fileSize = result.file_size ? formatFileSize(result.file_size) : '';
                    const date = result.date ? new Date(result.date).toLocaleDateString('ru-RU') : '';
                    
                    return `
                        <div class="track-item telegram-track" onclick="playTelegramTrack('${result.file_id}', '${escapeHtml(result.title)}', '${escapeHtml(result.artist)}', ${result.message_id})">
                        <div class="track-info">
                                <h4>${escapeHtml(result.title)}</h4>
                                <p>${escapeHtml(result.artist)} • MPFM_cloud</p>
                                <div class="track-meta">
                                    <span class="track-duration">${duration}</span>
                                    ${fileSize ? `<span class="file-size">${fileSize}</span>` : ''}
                                    ${date ? `<span class="track-date">${date}</span>` : ''}
                                </div>
                                <span class="group-badge">📱 Из группы</span>
                        </div>
                        <button class="play-track-btn">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    `;
                }).join('')}
            `;
            } else {
            resultsContainer.innerHTML = '<p>В группе MPFM_cloud ничего не найдено по вашему запросу</p>';
        }

        sendDataToBot('search_performed', {
            query: query,
            resultsCount: data.results ? data.results.length : 0,
            source: data.source || 'MPFM_cloud',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Search error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            API_BASE_URL: API_BASE_URL
        });
        resultsContainer.innerHTML = `
            <div class="error-message">
                <p>❌ Ошибка поиска в группе</p>
                <p>Ошибка: ${error.message}</p>
                <p>API URL: ${API_BASE_URL}</p>
                <p>Проверьте, что API сервер запущен на порту 8000</p>
            </div>
        `;
    }
}

async function playTelegramTrack(fileId, title, artist, messageId) {
    try {
        // Показываем индикатор загрузки
        console.log('🎵 Загрузка трека...');
        
        // Для демо-файлов используем прямые ссылки
        let audioUrl;
        if (fileId.startsWith('demo_')) {
            // Демо-файлы с рабочими URL
            const demoUrls = {
                'demo_audio_1': 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
                'demo_audio_2': 'https://www.soundjay.com/misc/sounds/clock-chimes-daniel_simon.wav',
                'demo_audio_3': 'https://www.soundjay.com/misc/sounds/beep-07a.wav'
            };
            audioUrl = demoUrls[fileId] || demoUrls['demo_audio_1'];
        } else {
            // Реальные файлы через прокси
            audioUrl = `${API_BASE_URL}/proxy-audio/${fileId}`;
        }
        
        // Создаем виртуальный плейлист для Telegram трека
        currentPlaylist = {
            name: 'MPFM_cloud',
            tracks: [{
                title: title,
                artist: artist,
                duration: '0:00', // Будет обновлено при загрузке
                file_url: audioUrl,
                is_telegram_track: true,
                file_id: fileId,
                message_id: messageId
            }]
        };
        currentTrack = 0;
        
        // Обновляем отображение плеера
        updatePlayerDisplay();
        
        // Создаем аудио элемент для реального воспроизведения
        console.log('Создаем Audio элемент с URL:', audioUrl);
        const audio = new Audio(audioUrl);
        
        // Обработчики событий аудио
        audio.addEventListener('loadstart', () => {
            console.log('Начало загрузки аудио');
            console.log('🔄 Загрузка началась...');
        });
        
        audio.addEventListener('loadedmetadata', () => {
            console.log('Метаданные загружены, длительность:', audio.duration);
            const duration = Math.floor(audio.duration);
            currentPlaylist.tracks[0].duration = formatTime(duration);
            updatePlayerDisplay();
            console.log(`🎵 ${title} - ${artist} - Метаданные загружены`);
        });
        
        audio.addEventListener('canplay', () => {
            console.log('Аудио готово к воспроизведению');
            console.log('✅ Аудио готово к воспроизведению');
        });
        
        audio.addEventListener('timeupdate', () => {
            if (audio.duration) {
                updateProgress(Math.floor(audio.currentTime), Math.floor(audio.duration));
            }
        });
        
        audio.addEventListener('ended', () => {
            isPlaying = false;
            const playPauseBtn = document.querySelector('.play-pause i');
            if (playPauseBtn) {
                playPauseBtn.className = 'fas fa-play';
            }
        });
        
        audio.addEventListener('error', (e) => {
            console.error('Ошибка воспроизведения:', e);
            console.error('Audio error details:', {
                error: audio.error,
                networkState: audio.networkState,
                readyState: audio.readyState,
                src: audio.src
            });
            console.error(`❌ Ошибка воспроизведения: ${audio.error ? audio.error.message : 'Неизвестная ошибка'}`);
        });
        
        // Таймаут для загрузки
        const loadTimeout = setTimeout(() => {
            console.log('Таймаут загрузки аудио');
            console.log('⏰ Таймаут загрузки. Попробуйте нажать кнопку воспроизведения в плеере.');
        }, 10000); // 10 секунд
        
        audio.addEventListener('canplay', () => {
            clearTimeout(loadTimeout);
        });
        
        // Начинаем воспроизведение
        try {
            console.log('Попытка воспроизведения:', audioUrl);
            await audio.play();
            isPlaying = true;
            
            const playPauseBtn = document.querySelector('.play-pause i');
            if (playPauseBtn) {
                playPauseBtn.className = 'fas fa-pause';
            }
            
            console.log('Воспроизведение началось успешно');
            console.log('✅ Воспроизведение началось!');
        } catch (playError) {
            console.error('Ошибка при попытке воспроизведения:', playError);
            
            // Более детальная обработка ошибок
            let errorMessage = '❌ Ошибка воспроизведения';
            if (playError.name === 'NotAllowedError') {
                errorMessage = '🔒 Автовоспроизведение заблокировано браузером - Нажмите кнопку воспроизведения в плеере';
            } else if (playError.name === 'NotSupportedError') {
                errorMessage = '❌ Формат файла не поддерживается';
            } else {
                errorMessage = `❌ Ошибка: ${playError.message} - Попробуйте нажать кнопку воспроизведения в плеере`;
            }
            
            console.error(errorMessage);
            
            // Сохраняем аудио для ручного воспроизведения
            window.currentAudio = audio;
        }
        
        // Отправляем данные боту
        sendDataToBot('telegram_track_played', {
            file_id: fileId,
        title: title,
        artist: artist,
            message_id: messageId,
            source: 'MPFM_cloud',
        timestamp: new Date().toISOString()
    });

    } catch (error) {
        console.error('Ошибка воспроизведения Telegram трека:', error);
        console.error('❌ Не удалось воспроизвести трек из группы');
    }
}

function playSearchResult(title, artist) {
    // Find and play the track
    Object.entries(playlists).forEach(([playlistId, playlist]) => {
        const trackIndex = playlist.tracks.findIndex(track =>
            track.title === title && track.artist === artist
        );

        if (trackIndex !== -1) {
            currentPlaylist = playlist;
            currentTrack = trackIndex;
            updatePlayerDisplay();
            togglePlayPause();

            sendDataToBot('search_result_played', {
                track: title,
                artist: artist,
                playlist: playlist.name,
                timestamp: new Date().toISOString()
            });
        }
    });
}

// User data functions
async function loadUserData() {
    // Загружаем последние треки из группы
    await loadRecentTracks();
}

// Function to load recent tracks from MPFM_cloud group
async function loadRecentTracks() {
    try {
        let tracks = [];
        
        // Проверяем, работаем ли мы локально
        if (FORCE_LOCAL_MODE || !window.Telegram || !window.Telegram.WebApp || window.location.protocol === 'file:') {
            console.log('Локальный режим - используем демо-данные для библиотеки');
            tracks = DEMO_TRACKS;
        } else {
            const response = await fetch(`${API_BASE_URL}/recent-music?limit=30`);
            
            if (!response.ok) {
                throw new Error('Не удалось загрузить треки из группы');
            }

            const data = await response.json();
            tracks = data.results || [];
        }
        
        // Добавляем секцию с треками из группы в библиотеку
        const librarySection = document.getElementById('library');
        
        // Удаляем предыдущую секцию если есть
        const existingSection = librarySection.querySelector('.group-tracks-section');
        if (existingSection) {
            existingSection.remove();
        }
        
        if (tracks.length > 0) {
            const groupTracksHtml = `
                <div class="group-tracks-section">
                    <h3>🎵 Последние треки из MPFM_cloud (${tracks.length})</h3>
                    <div class="group-tracks-list">
                        ${tracks.map(track => {
                            const duration = track.duration ? formatTime(track.duration) : 'N/A';
                            const date = track.date ? new Date(track.date).toLocaleDateString('ru-RU') : '';
                            return `
                                <div class="track-item" onclick="playTelegramTrack('${track.file_id}', '${escapeHtml(track.title)}', '${escapeHtml(track.artist)}', ${track.message_id})">
                                    <div class="track-info">
                                        <h4>${escapeHtml(track.title)}</h4>
                                        <p>${escapeHtml(track.artist)} • ${date}</p>
                                        <span class="track-duration">${duration}</span>
                                    </div>
                                    <button class="play-track-btn">
                                        <i class="fas fa-play"></i>
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <button class="refresh-btn" onclick="loadRecentTracks()">
                        <i class="fas fa-sync-alt"></i> Обновить
                    </button>
                </div>
            `;
            
            // Добавляем в конец библиотеки
            librarySection.insertAdjacentHTML('beforeend', groupTracksHtml);
        } else {
            const noTracksHtml = `
                <div class="group-tracks-section">
                    <h3>🎵 MPFM_cloud</h3>
                    <p>Пока нет треков в группе или бот не имеет доступа к истории сообщений.</p>
                    <button class="refresh-btn" onclick="loadRecentTracks()">
                        <i class="fas fa-sync-alt"></i> Попробовать снова
                    </button>
                </div>
            `;
            librarySection.insertAdjacentHTML('beforeend', noTracksHtml);
        }

    } catch (error) {
        console.error('Ошибка загрузки треков из группы:', error);
        
        // Показываем ошибку в библиотеке
        const librarySection = document.getElementById('library');
        const errorHtml = `
            <div class="group-tracks-section">
                <h3>🎵 MPFM_cloud</h3>
                <p class="error-message">❌ Ошибка загрузки треков из группы</p>
                <button class="refresh-btn" onclick="loadRecentTracks()">
                    <i class="fas fa-sync-alt"></i> Попробовать снова
                </button>
            </div>
        `;
        librarySection.insertAdjacentHTML('beforeend', errorHtml);
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Profile functions
function upgradeToPremium() {
    console.log('Функция премиум будет доступна в следующих версиях! 💎');

    sendDataToBot('premium_upgrade_clicked', {
        timestamp: new Date().toISOString()
    });
}

function showStats() {
    console.log('Статистика будет доступна в следующих версиях! 📊');

    sendDataToBot('stats_viewed', {
        timestamp: new Date().toISOString()
    });
}

// Utility functions
function sendDataToBot(action, data) {
    const message = {
        action: action,
        ...data
    };

    try {
        tg.sendData(JSON.stringify(message));
        console.log('Data sent to bot:', message);
    } catch (error) {
        console.error('Error sending data to bot:', error);
    }
}

// Handle back button
tg.onEvent('backButtonClicked', function() {
    if (currentSection !== 'home') {
        showSection('home');
    } else {
        tg.close();
    }
});

// Show back button when not on home
function updateBackButton() {
    if (currentSection !== 'home') {
        tg.BackButton.show();
    } else {
        tg.BackButton.hide();
    }
}

// Update back button when section changes
const originalShowSection = showSection;
showSection = function(sectionId) {
    originalShowSection(sectionId);
    updateBackButton();
};

// Initialize back button
updateBackButton();
