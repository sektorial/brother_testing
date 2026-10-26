# Статус проєкту (handoff)

**Оновлено:** 2026-10-27 (~00:16 Europe/Kyiv)  
**Мета:** HTML-тренажер тестів для iPhone (Safari), GitHub Pages, згідно з `requirements.md`.

---

## Де зупинилися

Етап **відновлення правильних відповідей** — **закритий**. Усі батчі злиті в ключ. Далі: пули → HTML → GitHub Pages.

| Етап | Статус |
|------|--------|
| Вимоги (`requirements.md`) | ✅ закриті (функціональні TBD вирішені) |
| Парсинг Excel → JSON | ✅ |
| Ключ з testderz (fuzzy match) | ✅ **1974** |
| Добирання відповідей знаннями права (батчі) | ✅ **20/20** злито; `source: llm_batch` |
| 40 пулів (стратегія B) | ❌ наступний крок |
| HTML-тренажер | ❌ |
| GitHub Pages | ❌ |

---

## Поточні цифри

- Усього питань: **3972**
- У `data/answer_key.json`: **3972** (повне покриття)
- У `data/questions.json`: **3972** з `correct_index` (`answer_status: matched`)
- Батчі LLM: **1998** записів у 20 файлах (`000`–`019`; останній 98)
- `confidence: low` у ключі після merge: **12** (варто вибірково перевірити)

### Готові батчі відповідей

Усі `data/answer_batches/batch_*_answers.json`: `000`–`019` ✅  
Валидатор: `scripts/validate_batch_answers.py`  
Злиття: `scripts/merge_batch_answers.py` (уже виконано)

---

## Що зробити в новій сесії (покроково)

1. Згенерувати **40 пулів** стратегія **B**, пропорція **20/20/30/30**, +28 паддинг останнього питання за потреби.
2. Зібрати **статичний HTML/JS** за `requirements.md` (мітки, подвійний тап, робота над помилками, `localStorage`).
3. Задеплоїти на **GitHub Pages**.
4. (Опційно) вибірково перевірити id з `confidence: low` у `answer_key.json`.

Python для скриптів: `C:\Users\ivoln\anaconda3\envs\conda_env\python.exe` (див. skill `use-conda-env`).

---

## Зафіксовані вимоги (коротко)

Деталі — у `requirements.md`. Головне:

- Пулів: **40**, стратегія **B** (повтори між пулами для дефіциту, насамперед ККУ)
- Пропорція теми: **20 / 20 / 30 / 30** (ЄКПЛ / Антикор / ККУ / КПКУ)
- Мітки: зірка / прапор / серце / оклик; **одна** на питання; можна **додати/зняти**; лише `localStorage`
- UX відповіді: 1-й тап = вибір, 2-й = зелений/червоний, потім «далі»
- Робота над помилками: черга **фіксована** з неправильних цієї сесії; тренувати скільки завгодно; після закриття сесії — зникає
- UI лише українською; без таймера

---

## Ключові файли

| Шлях | Призначення |
|------|-------------|
| `requirements.md` | Повна специфікація |
| `STATUS.md` | Цей handoff |
| `answer_key_notes.md` | Нотатки по ключу / testderz |
| `questions_with_answers.xlsx` | Сире джерело (без позначки правильної відповіді) |
| `questions_categories.md` | Діапазони тем |
| `data/questions_raw.json` | 3972 питань з options |
| `data/questions.json` | Те саме + `correct_index` |
| `data/answer_key.json` | Ключ id → correct_index (повний) |
| `data/testderz_answers.json` | Скрапнуті Q→A |
| `data/testderz_raw/` | Сирий HTML (можна не комітити — важкий) |
| `data/answer_batches/` | Батчі missing + `*_answers.json` |
| `scripts/fetch_testderz.py` | Скрапінг testderz |
| `scripts/match_answers.py` | Fuzzy match |
| `scripts/merge_batch_answers.py` | Злиття LLM-батчів у ключ |
| `scripts/validate_batch_answers.py` | Перевірка батчів перед merge |

---

## Ризики / зауваги для наступної сесії

- Відповіді з батчів — **не офіційний ключ іспиту**; є `confidence: low|medium|high`. Варто вибірково перевірити `low` (зараз 12 у ключі).
- Match з testderz відфільтрований через узгодженість з options (щоб уникати «НЕ наділений» vs «наділений»).
- Користувач пропонував також `wiki.nazk.gov.ua` / `rada.gov.ua` — для верифікації норм, не як готовий банк Q→A.
- У `data/testderz_raw/` є сміттєві файли на кшталт `#comment-*.html` з раннього фетчу — можна ігнорувати/видалити.
|