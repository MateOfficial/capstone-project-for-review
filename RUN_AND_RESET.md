# StoreFlow: запуск, перезапуск и обнуление

Этот файл нужен как практическая инструкция для повседневной работы с проектом: как запустить систему, как проверить что она поднялась, как пересобрать после изменений и как полностью обнулить данные.

## 1. Что нужно перед запуском

Минимально нужно:

- Docker Desktop
- Docker Compose
- свободные порты `80`, `8080`, `5432`, `6379`, `11434`

Рабочая папка проекта:

```bash
cd "/Users/ametazizov/Documents/YAMAHA WEB APP/Store Flow"
```

## 2. Какие сервисы поднимает проект

Команда `docker compose up -d` поднимает:

- `postgres` — база данных PostgreSQL
- `redis` — Redis
- `backend` — Spring Boot API на `http://localhost:8080`
- `frontend` — интерфейс на `http://localhost`
- `ollama` — локальный AI-сервис на `http://localhost:11434`

Основные адреса:

- сайт: `http://localhost`
- каталог: `http://localhost/catalog`
- backend health: `http://localhost:8080/actuator/health`
- swagger: `http://localhost:8080/swagger-ui.html`

## 3. Обычный запуск проекта

Если проект уже был собран раньше, стандартный запуск такой:

```bash
cd "/Users/ametazizov/Documents/YAMAHA WEB APP/Store Flow"
docker compose up -d
```

После запуска проверь:

```bash
curl -s http://localhost:8080/actuator/health
curl -I http://localhost/catalog
```

Если всё хорошо:

- backend должен вернуть статус `UP`
- каталог должен открываться по `http://localhost/catalog`

## 4. Первый запуск на пустой базе

Если база пустая, система откроется в режиме первичной настройки.

Что делать:

1. Запустить проект через `docker compose up -d`
2. Открыть `http://localhost/onboarding`
3. Заполнить данные компании
4. Создать администратора
5. Завершить onboarding
6. После этого войти в админку уже под созданными логином и паролем

Важно:

- после полного обнуления onboarding появится снова
- логин `admin / 123123` не является универсальным системным паролем, он работает только если такой пользователь реально существует в текущей базе

## 5. Как остановить проект

Остановить контейнеры без удаления данных:

```bash
docker compose stop
```

Остановить и удалить контейнеры, но оставить данные в volumes:

```bash
docker compose down
```

Разница:

- `stop` просто останавливает контейнеры
- `down` удаляет контейнеры и сеть, но база и модели остаются в volumes

## 6. Как пересобрать проект после изменений

Если менялся только frontend:

```bash
docker compose build frontend
docker compose up -d --force-recreate frontend
```

Если менялся только backend:

```bash
docker compose build backend
docker compose up -d --force-recreate backend
```

Если менялось много всего:

```bash
docker compose build backend frontend
docker compose up -d --force-recreate backend frontend
```

Если нужно просто поднять всё после выключения компьютера, пересборка не нужна, достаточно:

```bash
docker compose up -d
```

## 7. Быстрая проверка, что проект живой

В проекте есть готовый smoke-check:

```bash
./scripts/smoke-check.sh
```

Что он проверяет:

- backend health
- доступность frontend
- логин
- что import endpoint не отдаёт `403`
- публичный каталог API

Для полной проверki релизного состояния есть:

```bash
./scripts/release-check.sh
```

Этот скрипт:

- показывает состояние контейнеров
- собирает backend
- собирает frontend
- запускает smoke-check

## 8. Обнуление проекта: какой вариант выбрать

Ниже четыре уровня сброса. Выбирай минимально достаточный.

### Вариант A. Перезапуск без потери данных

Используй, если проект просто начал вести себя нестабильно, но данные терять нельзя.

```bash
docker compose down
docker compose up -d
```

Что сохранится:

- база PostgreSQL
- настройки
- пользователи
- товары
- импортированные данные
- модели Ollama

### Вариант B. Обнулить только базу данных

Используй, если нужно начать проект заново, снова пройти onboarding и очистить все бизнес-данные, но не хочется заново скачивать AI-модели Ollama.

Команды:

```bash
docker compose down
docker volume rm storeflow_pgdata
docker compose up -d
```

Что произойдёт:

- удалится вся PostgreSQL база
- при следующем запуске Flyway создаст схему заново
- система снова станет "не инициализированной"
- нужно будет заново пройти `http://localhost/onboarding`

Что сохранится:

- кэш и модели Ollama

### Вариант C. Полностью обнулить проект вместе с Ollama-данными

Используй, если нужно полностью очистить всё состояние Docker volumes.

```bash
docker compose down -v
docker compose up -d
```

Что удалится:

- PostgreSQL данные
- Ollama models cache

После этого:

- база будет пустой
- onboarding начнётся заново
- при необходимости Ollama-модель снова понадобится скачать

Текущие volumes проекта:

- `storeflow_pgdata`
- `storeflow_ollama_data`

### Вариант D. Жёсткий сброс с удалением локально собранных образов

Используй только если нужно полностью пересобрать проект с нуля и убрать старые локальные images.

```bash
docker compose down -v --rmi local
docker compose build backend frontend
docker compose up -d
```

Это самый тяжёлый вариант. Обычно он не нужен.

## 9. Что делать после полного обнуления

После вариантов `B`, `C` или `D` порядок такой:

1. Дождаться старта контейнеров
2. Открыть `http://localhost/onboarding`
3. Снова создать магазин и администратора
4. При необходимости заново импортировать данные
5. Проверить систему через `./scripts/smoke-check.sh`

Если в браузере остались старые токены и интерфейс ведёт себя странно, выйди из системы или очисти localStorage браузера для `localhost`.

## 10. Если нужно загрузить старые JSON-данные

В проекте есть режим миграции legacy-данных из папки `../../database`.

Команда для локального запуска backend в режиме миграции:

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=migrate -Dlegacy.data.path=../../database
```

Это отдельный сценарий. Для обычной Docker-работы он не нужен.

## 11. Частые команды в одном месте

Запуск:

```bash
docker compose up -d
```

Остановка без удаления данных:

```bash
docker compose stop
```

Остановка с удалением контейнеров, но не данных:

```bash
docker compose down
```

Пересобрать backend:

```bash
docker compose build backend
docker compose up -d --force-recreate backend
```

Пересобрать frontend:

```bash
docker compose build frontend
docker compose up -d --force-recreate frontend
```

Сброс только базы:

```bash
docker compose down
docker volume rm storeflow_pgdata
docker compose up -d
```

Полный сброс всего состояния:

```bash
docker compose down -v
docker compose up -d
```

Проверка состояния:

```bash
./scripts/smoke-check.sh
```

## 12. Практическая рекомендация

Для обычной ежедневной работы используй только три режима:

- `docker compose up -d` — запустить
- `docker compose down` — аккуратно остановить
- `docker compose build ... && docker compose up -d --force-recreate ...` — применить изменения

Полное обнуление через удаление volume делай только тогда, когда действительно нужно заново проходить onboarding или полностью очищать данные проекта.