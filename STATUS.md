# Статус проєкту (handoff)

**Оновлено:** 2026-10-27 (~00:25 Europe/Kyiv)  
**Мета:** HTML-тренажер тестів для iPhone (Safari), GitHub Pages, згідно з `requirements.md`.

---

## Де зупинилися

Ключ і пули готові; **статичний тренажер зібраний** у корені репо. Залишилось **задеплоїти на GitHub Pages** (і за бажанням перевірити `confidence: low`).

| Етап | Статус |
|------|--------|
| Вимоги (`requirements.md`) | ✅ |
| Парсинг Excel → JSON | ✅ |
| Ключ відповідей | ✅ **3972 / 3972** |
| 40 пулів (стратегія B) | ✅ `data/pools.json` |
| HTML-тренажер | ✅ `index.html` + `assets/` |
| GitHub Pages | 🔄 код на `master` запушено; увімкнути Pages у Settings (branch `master` / root) |

---

## Поточні цифри

- Питань у ключі: **3972**
- Пулів: **40** × 100 = **4000** слотів
- У банку пулів: **3707** унікальних (невикористані надлишки ekpl/anticor/kpku)
- Повтори між пулами: **293** (лише **ККУ**, max 2 використання)
- `confidence: low` у ключі: **12**

### UI (готово)

- Вибір пулу 1–40
- Подвійний тап: вибір → підтвердження → зелений/червоний
- Показ **упевненості** після відповіді
- Мітки ★ ⚑ ♥ ❗ у `localStorage`, фільтр за міткою
- Підсумок + фіксована черга «робота над помилками» до закриття сесії

---

## Що зробити далі

1. Увімкнути **GitHub Pages**: [Settings → Pages](https://github.com/sektorial/brother_testing/settings/pages) → Source: **Deploy from a branch** → `master` / `/` (root) → Save.  
   Очікуваний URL: `https://sektorial.github.io/brother_testing/`
2. Відкрити на iPhone Safari і прогнати smoke-тест (пул, відповідь, мітка, помилки).
3. (Опційно) перевірити 12 питань з `confidence: low`.

Локально: відкривати через будь-який static server (не `file://`), бо `fetch('data/pools.json')`.

```powershell
cd C:\Users\ivoln\IdeaProjects\brother_testing
& "C:\Users\ivoln\anaconda3\envs\conda_env\python.exe" -m http.server 8080
# http://127.0.0.1:8080/
```

Тести:

```powershell
& "C:\Users\ivoln\anaconda3\envs\conda_env\python.exe" -m pytest tests -v
```

---

## Зафіксовані вимоги (коротко)

- Пулів: **40**, стратегія **B**, пропорція **20 / 20 / 30 / 30**
- Після відповіді: **рівень упевненості** ключа
- Мітки: одна на питання; add/remove; лише `localStorage`
- UX: вибір варіанта + кнопка **«Підтвердити»** → фіксація
- Помилки: черга фіксована до кінця сесії
- UI українською; без таймера

---

## Ключові файли

| Шлях | Призначення |
|------|-------------|
| `index.html` | Оболонка тренажера |
| `assets/app.js` / `app.css` | Логіка й стилі |
| `data/pools.json` | 40 пулів + bank питань |
| `data/answer_key.json` / `questions.json` | Повний ключ |
| `scripts/generate_pools.py` | Генерація пулів |
| `scripts/merge_batch_answers.py` | Злиття LLM-батчів |
| `requirements.md` | Специфікація |
| `STATUS.md` | Handoff |
