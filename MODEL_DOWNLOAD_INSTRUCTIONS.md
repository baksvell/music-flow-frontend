# Инструкции по загрузке моделей Magenta.js

## Что нужно скачать

Для работы AI Battle системы нужно скачать файлы модели `basic_rnn` и поместить их в папку:
```
music-flow-frontend/models/music_rnn/basic_rnn/
```

## Файлы для скачивания

### 1. config.json
**URL:** https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn/config.json
**Сохранить как:** `music-flow-frontend/models/music_rnn/basic_rnn/config.json`

### 2. weights_manifest.json
**URL:** https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn/weights_manifest.json
**Сохранить как:** `music-flow-frontend/models/music_rnn/basic_rnn/weights_manifest.json`

### 3. Файлы весов (shards)
После скачивания `weights_manifest.json`, откройте его и найдите URL'ы файлов весов.
Обычно это файлы вида `group1-shard1of1`, `group1-shard2of1` и т.д.

**Пример URL:** https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn/group1-shard1of1
**Сохранить как:** `music-flow-frontend/models/music_rnn/basic_rnn/group1-shard1of1`

## Структура папки после загрузки

```
music-flow-frontend/
└── models/
    └── music_rnn/
        └── basic_rnn/
            ├── config.json
            ├── weights_manifest.json
            ├── group1-shard1of1
            └── [другие shard файлы из weights_manifest.json]
```

## Как скачать

1. Откройте каждый URL в браузере
2. Сохраните файл в указанную папку
3. Убедитесь, что все файлы находятся в `music-flow-frontend/models/music_rnn/basic_rnn/`

## Проверка

После загрузки всех файлов, AI Battle система будет использовать локальные модели вместо внешних URL'ов, что обеспечит стабильную работу без зависимости от доступности Google Cloud Storage.

## Различия между сетями A и B

Хотя обе сети используют одну модель `basic_rnn`, они настроены по-разному:

- **Сеть A (Melody Master):** 
  - Temperature: 0.3-0.7 (более консервативная)
  - Steps: 48-80 (более длинные мелодии)
  - Seed: battleSeed + 1000

- **Сеть B (Melody Explorer):**
  - Temperature: 0.7-1.3 (более экспериментальная)
  - Steps: 32-80 (более короткие, ритмичные)
  - Seed: battleSeed + 2000

Это обеспечивает разные стили генерации музыки для каждой сети.
