/**
 * MusicFlow AI Battle - Telegram Mini App
 * Система конкурирующих нейросетей для генерации музыки
 */

// Telegram Web App API
const tg = window.Telegram.WebApp;

// AI Battle System
class AIBattleSystem {
    constructor() {
        this.audioContext = null;
        this.currentBattle = null;
        this.selectedNetwork = null;
        this.isPlaying = false;
        this.currentAudio = null;
        this.currentSection = 'battle';
        
        this.init();
    }

    async init() {
        try {
            // Инициализируем Telegram Web App
            tg.ready();
            tg.expand();
            
            // Настраиваем Telegram интерфейс
            this.setupTelegramUI();
            
            // Инициализируем Web Audio API
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Отключаем кнопки до загрузки
            this.setButtonsEnabled(false);
            
            // Загружаем начальный баттл
            await this.loadNewBattle();
            
            this.setupEventListeners();
            
            console.log('AI Battle System инициализирован в Telegram Mini App');
        } catch (error) {
            console.error('Ошибка инициализации AI Battle System:', error);
        }
    }

    setupTelegramUI() {
        // Настраиваем заголовок
        if (tg.setHeaderColor) {
            tg.setHeaderColor('#1a1a1a');
        }
        if (tg.setHeaderTextColor) {
            tg.setHeaderTextColor('#ffffff');
        }
        
        // Скрываем кнопки Telegram
        if (tg.MainButton) {
            tg.MainButton.hide();
        }
        if (tg.BackButton) {
            tg.BackButton.hide();
        }
    }

    setupEventListeners() {
        // Кнопки воспроизведения
        document.getElementById('playNetworkA')?.addEventListener('click', () => this.playNetwork('a'));
        document.getElementById('playNetworkB')?.addEventListener('click', () => this.playNetwork('b'));
        
        // Кнопки выбора
        document.getElementById('selectNetworkA')?.addEventListener('click', () => this.selectNetwork('a'));
        document.getElementById('selectNetworkB')?.addEventListener('click', () => this.selectNetwork('b'));
        
        // Кнопка подтверждения
        document.getElementById('confirmVote')?.addEventListener('click', () => this.confirmVote());
        
        // Кнопка пропуска
        document.getElementById('skipBattle')?.addEventListener('click', () => this.skipBattle());
        
        // Кнопка нового баттла
        document.getElementById('newBattle')?.addEventListener('click', () => this.loadNewBattle());
        
        // Кнопка статистики
        document.getElementById('statsBtn')?.addEventListener('click', () => this.showStats());
    }

    async loadNewBattle() {
        try {
            this.showLoading(true);
            this.setButtonsEnabled(false);
            
            const response = await fetch('https://mysicflow.onrender.com/battle/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.getUserId()
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки баттла');
            }

            this.currentBattle = await response.json();
            this.selectedNetwork = null;
            
            this.updateUI();
            this.showLoading(false);
            this.setButtonsEnabled(true);
            
            console.log('Новый баттл загружен:', this.currentBattle);
            console.log('Battle ID:', this.currentBattle.id);
        } catch (error) {
            console.error('Ошибка загрузки баттла:', error);
            this.showError('Ошибка загрузки баттла');
            this.showLoading(false);
            this.setButtonsEnabled(true);
        }
    }

    async playNetwork(networkId) {
        try {
            // Проверяем, что баттл загружен
            if (!this.currentBattle) {
                console.log('Баттл еще не загружен, загружаем...');
                await this.loadNewBattle();
                return;
            }
            
            // Останавливаем текущее воспроизведение
            this.stopCurrentAudio();
            
            const network = this.currentBattle[`neural_net_${networkId}`];
            if (!network) {
                throw new Error(`Нейросеть ${networkId} не найдена`);
            }

            // Генерируем музыку на основе параметров
            const audioBuffer = await this.generateMusic(network.music_params);
            
            // Воспроизводим
            this.playAudioBuffer(audioBuffer);
            
            // Обновляем UI
            this.updatePlayButton(networkId, true);
            
        } catch (error) {
            console.error(`Ошибка воспроизведения нейросети ${networkId}:`, error);
            this.showError(`Ошибка воспроизведения нейросети ${networkId}`);
        }
    }

    async generateMusic(params) {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 30; // 30 секунд
        const bufferSize = sampleRate * duration;
        
        const buffer = this.audioContext.createBuffer(2, bufferSize, sampleRate);
        
        // Генерируем музыку на основе параметров
        this.generateMelody(buffer, params);
        this.generateRhythm(buffer, params);
        this.generateHarmony(buffer, params);
        
        return buffer;
    }

    getNotesForKey(key, pitchRange) {
        // Базовые ноты для разных тональностей
        const keyNotes = {
            "C": [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25], // C major
            "G": [293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 554.37, 587.33], // G major
            "D": [293.66, 329.63, 369.99, 415.30, 440.00, 493.88, 554.37, 622.25], // D major
            "A": [220.00, 246.94, 277.18, 293.66, 329.63, 369.99, 415.30, 440.00], // A major
            "E": [164.81, 185.00, 207.65, 220.00, 246.94, 277.18, 311.13, 329.63], // E major
            "B": [123.47, 138.59, 155.56, 164.81, 185.00, 207.65, 233.08, 246.94], // B major
            "F#": [92.50, 103.83, 116.54, 123.47, 138.59, 155.56, 174.61, 185.00], // F# major
            "C#": [69.30, 77.78, 87.31, 92.50, 103.83, 116.54, 130.81, 138.59], // C# major
            "Am": [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00], // A minor
            "Em": [164.81, 185.00, 196.00, 220.00, 246.94, 261.63, 293.66, 329.63], // E minor
            "Bm": [123.47, 138.59, 146.83, 164.81, 185.00, 196.00, 220.00, 246.94], // B minor
            "F#m": [92.50, 103.83, 110.00, 123.47, 138.59, 146.83, 164.81, 185.00], // F# minor
            "C#m": [69.30, 77.78, 82.41, 92.50, 103.83, 110.00, 123.47, 138.59], // C# minor
            "G#m": [51.91, 58.27, 61.74, 69.30, 77.78, 82.41, 92.50, 103.83], // G# minor
            "D#m": [38.89, 43.65, 46.25, 51.91, 58.27, 61.74, 69.30, 77.78], // D# minor
            "A#m": [29.14, 32.70, 34.65, 38.89, 43.65, 46.25, 51.91, 58.27] // A# minor
        };
        
        let notes = keyNotes[key] || keyNotes["C"];
        
        // Расширяем диапазон на основе pitchRange
        if (pitchRange > 0.7) {
            // Добавляем октавы выше и ниже
            const lowerOctave = notes.map(freq => freq / 2);
            const higherOctave = notes.map(freq => freq * 2);
            notes = [...lowerOctave, ...notes, ...higherOctave];
        } else if (pitchRange > 0.4) {
            // Добавляем только верхнюю октаву
            const higherOctave = notes.map(freq => freq * 2);
            notes = [...notes, ...higherOctave];
        }
        
        return notes;
    }

    generateMelodySequence(notes, pattern, density, complexity, seedRandom) {
        const sequence = [];
        const noteCount = Math.floor(density * 16) + 4; // 4-20 нот
        
        for (let i = 0; i < noteCount; i++) {
            let noteIndex;
            
            switch (pattern) {
                case "ascending_scale":
                    noteIndex = i % notes.length;
                    break;
                case "descending_scale":
                    noteIndex = (notes.length - 1) - (i % notes.length);
                    break;
                case "zigzag":
                    noteIndex = i % 2 === 0 ? (i / 2) % notes.length : (notes.length - 1) - ((i - 1) / 2) % notes.length;
                    break;
                case "wave":
                    noteIndex = Math.floor(Math.sin(i * 0.5) * (notes.length - 1) / 2 + (notes.length - 1) / 2);
                    break;
                case "stepwise":
                    noteIndex = (i * 2) % notes.length;
                    break;
                case "leap_and_step":
                    noteIndex = i % 3 === 0 ? Math.floor(seedRandom.random() * notes.length) : (i - 1) % notes.length;
                    break;
                case "arpeggio":
                    noteIndex = (i * 3) % notes.length;
                    break;
                case "simple_repetition":
                default:
                    noteIndex = i % 4; // Повторяем первые 4 ноты
                    break;
            }
            
            // Добавляем случайность на основе сложности
            if (complexity > 0.5 && seedRandom.random() < complexity) {
                noteIndex = Math.floor(seedRandom.random() * notes.length);
            }
            
            sequence.push(notes[noteIndex]);
        }
        
        return sequence;
    }

    createSeededRandom(seed) {
        // Простой линейный конгруэнтный генератор для детерминированной случайности
        let current = seed;
        return {
            random: () => {
                current = (current * 1664525 + 1013904223) % 4294967296;
                return current / 4294967296;
            },
            choice: (array) => {
                return array[Math.floor(this.createSeededRandom(current).random() * array.length)];
            }
        };
    }

    generateMelody(buffer, params) {
        const leftChannel = buffer.getChannelData(0);
        const rightChannel = buffer.getChannelData(1);
        
        const tempo = params.tempo || 120;
        const melodyComplexity = params.melody_complexity || 0.5;
        const energyLevel = params.energy_level || 0.5;
        const key = params.key || "C";
        const melodyPattern = params.melody_pattern || "simple_repetition";
        const noteDensity = params.note_density || 0.5;
        const pitchRange = params.pitch_range || 0.5;
        const battleSeed = params.battle_seed || Math.random() * 1000000;
        const variationFactor = params.variation_factor || 0.2;
        
        const sampleRate = buffer.sampleRate;
        const duration = buffer.length / sampleRate;
        
        // Используем battle_seed для детерминированной генерации
        const seedRandom = this.createSeededRandom(battleSeed);
        
        // Определяем ноты на основе тональности
        const notes = this.getNotesForKey(key, pitchRange);
        const melodyNotes = this.generateMelodySequence(notes, melodyPattern, noteDensity, melodyComplexity, seedRandom);
        
        // Генерируем мелодию на основе последовательности нот
        const noteDuration = duration / melodyNotes.length;
        
        for (let i = 0; i < buffer.length; i++) {
            const time = i / sampleRate;
            
            // Определяем текущую ноту на основе времени
            const noteIndex = Math.floor(time / noteDuration) % melodyNotes.length;
            let frequency = melodyNotes[noteIndex];
            
            // Добавляем вариации частоты на основе variation_factor
            const frequencyVariation = 1 + (seedRandom.random() - 0.5) * variationFactor * 0.1;
            frequency *= frequencyVariation;
            
            // Добавляем плавные переходы между нотами
            const noteStartTime = noteIndex * noteDuration;
            const noteEndTime = (noteIndex + 1) * noteDuration;
            const noteProgress = (time - noteStartTime) / noteDuration;
            
            // Амплитуда с учетом времени ноты и вариаций
            let amplitude = energyLevel * 0.3;
            if (noteProgress < 0.1) {
                amplitude *= noteProgress * 10; // Плавное нарастание
            } else if (noteProgress > 0.9) {
                amplitude *= (1 - noteProgress) * 10; // Плавное затухание
            }
            
            // Добавляем амплитудные вариации
            const amplitudeVariation = 1 + (seedRandom.random() - 0.5) * variationFactor * 0.2;
            amplitude *= amplitudeVariation;
            
            // Генерируем волну с дополнительными гармониками
            const wave = Math.sin(2 * Math.PI * frequency * time) * amplitude;
            
            // Добавляем обертоны для богатства звука
            const overtone1 = Math.sin(2 * Math.PI * frequency * 2 * time) * amplitude * 0.3;
            const overtone2 = Math.sin(2 * Math.PI * frequency * 3 * time) * amplitude * 0.1;
            
            // Добавляем дополнительные гармоники на основе experimental_factor
            const experimentalFactor = params.experimental_factor || 0.1;
            let experimentalWave = 0;
            if (experimentalFactor > 0.3) {
                experimentalWave = Math.sin(2 * Math.PI * frequency * 1.5 * time) * amplitude * experimentalFactor * 0.1;
            }
            
            const finalWave = wave + overtone1 + overtone2 + experimentalWave;
            
            leftChannel[i] = finalWave;
            rightChannel[i] = finalWave * (0.8 + seedRandom.random() * 0.2); // Больше вариаций между каналами
        }
    }

    generateRhythm(buffer, params) {
        const leftChannel = buffer.getChannelData(0);
        const rightChannel = buffer.getChannelData(1);
        
        const tempo = params.tempo || 120;
        const rhythmComplexity = params.rhythm_complexity || 0.5;
        const energyLevel = params.energy_level || 0.5;
        const rhythmPattern = params.rhythm_pattern || "straight";
        const syncopation = params.syncopation || 0.1;
        const timeSignature = params.time_signature || "4/4";
        
        const sampleRate = buffer.sampleRate;
        const beatDuration = 60 / tempo; // Длительность одного бита в секундах
        const beatSamples = Math.floor(beatDuration * sampleRate);
        
        // Определяем количество долей в такте
        const beatsPerMeasure = parseInt(timeSignature.split('/')[0]);
        
        // Генерируем ритмический паттерн на основе типа
        for (let i = 0; i < buffer.length; i += beatSamples) {
            const beatIndex = Math.floor(i / beatSamples);
            const measureIndex = Math.floor(beatIndex / beatsPerMeasure);
            const beatInMeasure = beatIndex % beatsPerMeasure;
            
            let shouldPlay = false;
            let drumType = "kick";
            
            switch (rhythmPattern) {
                case "syncopated":
                    // Синкопированный ритм
                    shouldPlay = beatInMeasure === 0 || (beatInMeasure === 2 && syncopation > 0.3) || 
                                (beatInMeasure === 1 && syncopation > 0.6);
                    drumType = beatInMeasure === 0 ? "kick" : "snare";
                    break;
                case "polyrhythmic":
                    // Полиритмический паттерн
                    shouldPlay = beatInMeasure % 3 === 0 || (beatInMeasure % 2 === 0 && rhythmComplexity > 0.7);
                    drumType = beatInMeasure % 3 === 0 ? "kick" : "snare";
                    break;
                case "irregular":
                    // Нерегулярный ритм
                    shouldPlay = Math.random() < (rhythmComplexity * 0.3 + 0.1);
                    drumType = Math.random() < 0.5 ? "kick" : "snare";
                    break;
                case "swing":
                    // Свинг
                    shouldPlay = beatInMeasure === 0 || (beatInMeasure === 2 && rhythmComplexity > 0.4);
                    drumType = beatInMeasure === 0 ? "kick" : "snare";
                    break;
                case "shuffle":
                    // Шаффл
                    shouldPlay = beatInMeasure % 2 === 0 || (beatInMeasure % 3 === 0 && rhythmComplexity > 0.5);
                    drumType = beatInMeasure % 2 === 0 ? "kick" : "snare";
                    break;
                case "offbeat":
                    // Офф-бит
                    shouldPlay = beatInMeasure === 1 || beatInMeasure === 3;
                    drumType = "snare";
                    break;
                case "straight":
                default:
                    // Прямой ритм
                    shouldPlay = beatInMeasure === 0 || (beatInMeasure === 2 && rhythmComplexity > 0.5);
                    drumType = beatInMeasure === 0 ? "kick" : "snare";
                    break;
            }
            
            if (shouldPlay) {
                if (drumType === "kick") {
                    this.addKickDrum(buffer, i, energyLevel);
                } else {
                    this.addSnareDrum(buffer, i, energyLevel * 0.7);
                }
            }
        }
    }

    generateHarmony(buffer, params) {
        const leftChannel = buffer.getChannelData(0);
        const rightChannel = buffer.getChannelData(1);
        
        const harmonyComplexity = params.harmony_complexity || 0.5;
        const energyLevel = params.energy_level || 0.5;
        
        const sampleRate = buffer.sampleRate;
        
        // Аккорды
        const chords = [
            [261.63, 329.63, 392.00], // C major
            [293.66, 349.23, 440.00], // D major
            [329.63, 392.00, 493.88], // E major
            [349.23, 440.00, 523.25]  // F major
        ];
        
        const chordDuration = 2; // 2 секунды на аккорд
        const chordSamples = Math.floor(chordDuration * sampleRate);
        
        for (let i = 0; i < buffer.length; i += chordSamples) {
            const chordIndex = Math.floor(i / chordSamples) % chords.length;
            const chord = chords[chordIndex];
            
            // Генерируем аккорд
            for (let j = 0; j < chordSamples && i + j < buffer.length; j++) {
                const time = (i + j) / sampleRate;
                let chordWave = 0;
                
                chord.forEach(frequency => {
                    chordWave += Math.sin(2 * Math.PI * frequency * time) * energyLevel * 0.1;
                });
                
                leftChannel[i + j] += chordWave;
                rightChannel[i + j] += chordWave * 0.7;
            }
        }
    }

    addKickDrum(buffer, startIndex, amplitude) {
        const leftChannel = buffer.getChannelData(0);
        const rightChannel = buffer.getChannelData(1);
        
        const sampleRate = buffer.sampleRate;
        const duration = 0.1; // 100ms
        const samples = Math.floor(duration * sampleRate);
        
        for (let i = 0; i < samples && startIndex + i < buffer.length; i++) {
            const time = i / sampleRate;
            const envelope = Math.exp(-time * 20); // Экспоненциальное затухание
            const frequency = 60 * Math.exp(-time * 10); // Падающая частота
            
            const wave = Math.sin(2 * Math.PI * frequency * time) * amplitude * envelope * 0.5;
            
            leftChannel[startIndex + i] += wave;
            rightChannel[startIndex + i] += wave;
        }
    }

    addSnareDrum(buffer, startIndex, amplitude) {
        const leftChannel = buffer.getChannelData(0);
        const rightChannel = buffer.getChannelData(1);
        
        const sampleRate = buffer.sampleRate;
        const duration = 0.05; // 50ms
        const samples = Math.floor(duration * sampleRate);
        
        for (let i = 0; i < samples && startIndex + i < buffer.length; i++) {
            const time = i / sampleRate;
            const envelope = Math.exp(-time * 30);
            
            // Белый шум для щелчка
            const noise = (Math.random() * 2 - 1) * amplitude * envelope * 0.3;
            
            leftChannel[startIndex + i] += noise;
            rightChannel[startIndex + i] += noise;
        }
    }

    playAudioBuffer(buffer) {
        this.stopCurrentAudio();
        
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        
        source.onended = () => {
            this.isPlaying = false;
            this.updatePlayButtons();
        };
        
        source.start();
        this.currentAudio = source;
        this.isPlaying = true;
    }

    stopCurrentAudio() {
        if (this.currentAudio) {
            this.currentAudio.stop();
            this.currentAudio = null;
        }
        this.isPlaying = false;
        this.updatePlayButtons();
    }

    selectNetwork(networkId) {
        this.selectedNetwork = networkId;
        this.updateSelectionUI();
        
        // Останавливаем воспроизведение при выборе
        this.stopCurrentAudio();
    }

    async confirmVote() {
        if (!this.selectedNetwork) {
            this.showError('Пожалуйста, выберите понравившуюся нейросеть');
            return;
        }

        try {
            this.showLoading(true);
            
            const response = await fetch('https://mysicflow.onrender.com/battle/vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.getUserId(),
                    battle_id: this.currentBattle.id,
                    winner: `neural_net_${this.selectedNetwork}`,
                    confidence: 1.0
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка голосования');
            }

            const result = await response.json();
            console.log('Голос засчитан:', result);
            
            // Показываем результат
            this.showVoteResult();
            
            // Загружаем новый баттл через 2 секунды
            setTimeout(() => {
                this.loadNewBattle();
            }, 2000);
            
        } catch (error) {
            console.error('Ошибка голосования:', error);
            this.showError('Ошибка голосования');
            this.showLoading(false);
        }
    }

    async skipBattle() {
        try {
            this.showLoading(true);
            
            // Загружаем новый баттл без голосования
            await this.loadNewBattle();
            
        } catch (error) {
            console.error('Ошибка пропуска баттла:', error);
            this.showError('Ошибка пропуска баттла');
            this.showLoading(false);
        }
    }

    updateUI() {
        if (!this.currentBattle) return;
        
        // Обновляем информацию о нейросетях
        this.updateNetworkInfo('a', this.currentBattle.neural_net_a);
        this.updateNetworkInfo('b', this.currentBattle.neural_net_b);
        
        // Сбрасываем выбор
        this.selectedNetwork = null;
        this.updateSelectionUI();
        
        // Обновляем кнопки воспроизведения
        this.updatePlayButtons();
    }

    updateNetworkInfo(networkId, network) {
        const container = document.getElementById(`network${networkId.toUpperCase()}`);
        if (!container) return;
        
        // Обновляем название
        const nameElement = container.querySelector('.network-name');
        if (nameElement) {
            nameElement.textContent = network.name;
        }
        
        // Обновляем цвет
        const colorElement = container.querySelector('.network-color');
        if (colorElement) {
            colorElement.style.backgroundColor = network.color;
        }
        
        // Обновляем параметры
        const paramsElement = container.querySelector('.network-params');
        if (paramsElement) {
            const params = network.music_params;
            paramsElement.innerHTML = `
                <div>Темп: ${Math.round(params.tempo || 120)} BPM</div>
                <div>Мелодия: ${Math.round((params.melody_complexity || 0.5) * 100)}%</div>
                <div>Ритм: ${Math.round((params.rhythm_complexity || 0.5) * 100)}%</div>
                <div>Энергия: ${Math.round((params.energy_level || 0.5) * 100)}%</div>
            `;
        }
    }

    updateSelectionUI() {
        // Сбрасываем все выделения
        document.querySelectorAll('.network-container').forEach(container => {
            container.classList.remove('selected');
        });
        
        // Выделяем выбранную нейросеть
        if (this.selectedNetwork) {
            const selectedContainer = document.getElementById(`network${this.selectedNetwork.toUpperCase()}`);
            if (selectedContainer) {
                selectedContainer.classList.add('selected');
            }
        }
        
        // Обновляем кнопку подтверждения
        const confirmButton = document.getElementById('confirmVote');
        if (confirmButton) {
            confirmButton.disabled = !this.selectedNetwork;
            confirmButton.textContent = this.selectedNetwork ? 
                `Подтвердить выбор ${this.selectedNetwork.toUpperCase()}` : 
                'Выберите нейросеть';
        }
    }

    updatePlayButtons() {
        document.querySelectorAll('.play-button').forEach(button => {
            button.textContent = this.isPlaying ? '⏸️ Пауза' : '▶️ Воспроизвести';
        });
    }

    updatePlayButton(networkId, isPlaying) {
        const button = document.getElementById(`playNetwork${networkId.toUpperCase()}`);
        if (button) {
            button.textContent = isPlaying ? '⏸️ Пауза' : '▶️ Воспроизвести';
        }
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }

    setButtonsEnabled(enabled) {
        const buttons = [
            'playNetworkA', 'playNetworkB', 
            'selectNetworkA', 'selectNetworkB',
            'confirmVote', 'skipBattle'
        ];
        
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = !enabled;
                button.style.opacity = enabled ? '1' : '0.5';
            }
        });
    }

    showError(message) {
        const errorElement = document.getElementById('error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }

    showVoteResult() {
        const resultElement = document.getElementById('voteResult');
        if (resultElement) {
            resultElement.textContent = `Голос за ${this.selectedNetwork.toUpperCase()} засчитан!`;
            resultElement.style.display = 'block';
            
            setTimeout(() => {
                resultElement.style.display = 'none';
            }, 2000);
        }
    }

    showStats() {
        this.showSection('stats');
        this.loadStats();
    }

    showSection(sectionId) {
        // Скрываем все секции
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Показываем нужную секцию
        const targetSection = document.getElementById(`${sectionId}Section`);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionId;
        }
    }

    async loadStats() {
        try {
            const response = await fetch('https://mysicflow.onrender.com/neural-nets/stats');
            if (!response.ok) {
                throw new Error('Ошибка загрузки статистики');
            }
            
            const data = await response.json();
            this.updateStats(data.neural_nets);
            
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    updateStats(neuralNets) {
        const statsA = document.getElementById('statsA');
        const statsB = document.getElementById('statsB');
        
        if (statsA && neuralNets[0]) {
            statsA.textContent = `${neuralNets[0].wins} побед (${neuralNets[0].win_rate * 100}%)`;
        }
        
        if (statsB && neuralNets[1]) {
            statsB.textContent = `${neuralNets[1].wins} побед (${neuralNets[1].win_rate * 100}%)`;
        }
    }

    getUserId() {
        // Получаем ID пользователя из Telegram Web App
        if (tg.initDataUnsafe?.user?.id) {
            return parseInt(tg.initDataUnsafe.user.id);
        }
        return 1118235356; // Дефолтный ID для тестирования
    }
}

// Глобальные функции для совместимости
function showSection(sectionId) {
    if (window.aiBattleSystem) {
        window.aiBattleSystem.showSection(sectionId);
    }
}

function showStats() {
    if (window.aiBattleSystem) {
        window.aiBattleSystem.showStats();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.aiBattleSystem = new AIBattleSystem();
});