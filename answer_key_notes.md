# Нотатки: ключ правильних відповідей

Супутній документ до §8 у `requirements.md`. Актуальний handoff — також у `STATUS.md`.

## Висновок перевірки локального Excel (2026-10-26)

- Файл: `questions_with_answers.xlsx`, аркуш `data`.
- Колонки: `#`, `Питання`, `Варіанти відповіді`.
- Правильна відповідь **не закодована** у файлі.
- Розподіл варіантів: переважно 4; поодинокі з 1–5.

## Два джерела ключа

### A) testderz.com (скрапінг + fuzzy match)

- Скрипти: `scripts/fetch_testderz.py`, `scripts/match_answers.py`
- Результат у `data/answer_key.json`: **1974** питань (станом на handoff)
- Звіт: `data/answer_key_match_report.json`
- Match приймається лише якщо текст відповіді добре збігається з одним із локальних options

### B) Відповіді «знанням права» (батчі)

- Missing після testderz: **1998** → нарізані в `data/answer_batches/batch_000.json` … `batch_019.json` (по 100; останній коротший)
- Агенти пишуть `batch_XXX_answers.json`:  
  `{ "<id>": { "correct_index", "correct_text", "confidence": "high|medium|low" } }`
- Злиття: `scripts/merge_batch_answers.py` (на момент handoff **ще не запускався**)

#### Готовність батчів на момент handoff (2026-10-26 ~23:52)

| Файл відповідей | Записів |
|-----------------|---------|
| 000, 001, 002, 003, 004, 007, 013 | по 100 (разом 700) |
| 005, 006, 008–012, 014–019 | відсутні |

Після появи всіх `*_answers.json` — обов’язково `merge_batch_answers.py`, потім перевірити `len(answer_key) == 3972`.

## Артефакти

| Файл | Зміст |
|------|--------|
| `data/questions_raw.json` | 3972 локальних питань |
| `data/testderz_answers.json` | унікальні пари з testderz (~5200) |
| `data/answer_key.json` | id → correct_index |
| `data/questions.json` | questions + correct_index де є |
| `data/answer_batches/` | missing + відповіді батчів |

### Контрольний приклад

- Локальне №1 → matched, `correct_index: 2` («не досягла 18-річного віку»).

## Ризики

- Батч-відповіді можуть помилятися на нюансах редакцій закону → перевіряти `confidence: low`.
- False positive на схожих формулюваннях питань — частково знято option-anchored match для testderz.
|
