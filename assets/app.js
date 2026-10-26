(() => {
  "use strict";

  const Q = window.BrotherQuiz;
  const MARKS = Q.MARKS;
  const CAT_UA = {
    ekpl: "ЄКПЛ",
    anticor: "Антикор",
    kku: "ККУ",
    kpku: "КПКУ",
  };
  const CONF_UA = {
    high: { text: "Упевненість у ключі: висока", cls: "high" },
    medium: { text: "Упевненість у ключі: середня", cls: "medium" },
    low: { text: "Упевненість у ключі: низька — варто перевірити норму", cls: "low" },
  };
  const LS_MARKS = "brother_testing_marks_v1";

  const el = {
    homeBtn: document.getElementById("btn-home"),
    title: document.getElementById("header-title"),
    progress: document.getElementById("progress"),
    home: document.getElementById("screen-home"),
    quiz: document.getElementById("screen-quiz"),
    summary: document.getElementById("screen-summary"),
    poolGrid: document.getElementById("pool-grid"),
    markNav: document.getElementById("mark-nav"),
    qCategory: document.getElementById("q-category"),
    markBar: document.getElementById("mark-bar"),
    qText: document.getElementById("q-text"),
    options: document.getElementById("options"),
    confidence: document.getElementById("confidence"),
    confirm: document.getElementById("btn-confirm"),
    next: document.getElementById("btn-next"),
    summaryStats: document.getElementById("summary-stats"),
    mistakes: document.getElementById("btn-mistakes"),
    again: document.getElementById("btn-again"),
    toHome: document.getElementById("btn-to-home"),
  };

  /** @type {{ pools: any[], bank: Record<string, any>, meta: any } | null} */
  let data = null;
  /** @type {Record<string, string>} */
  let marks = loadMarks();

  /** @type {null | {
   *   mode: 'pool' | 'marks' | 'mistakes',
   *   title: string,
   *   queue: any[],
   *   index: number,
   *   selected: number | null,
   *   locked: boolean,
   *   correctCount: number,
   *   wrongCount: number,
   *   wrongIds: number[],
   *   mistakesQueue: any[] | null,
   *   poolId: number | null,
   *   markFilter: string | null,
   * }} */
  let session = null;

  function loadMarks() {
    try {
      return JSON.parse(localStorage.getItem(LS_MARKS) || "{}") || {};
    } catch {
      return {};
    }
  }
  function saveMarks() {
    localStorage.setItem(LS_MARKS, JSON.stringify(marks));
  }

  function show(screen) {
    el.home.hidden = screen !== "home";
    el.quiz.hidden = screen !== "quiz";
    el.summary.hidden = screen !== "summary";
    el.homeBtn.hidden = screen === "home";
    el.progress.hidden = screen !== "quiz";
  }

  function renderHome() {
    el.title.textContent = "Тренажер";
    el.poolGrid.innerHTML = "";
    for (const pool of data.pools) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(pool.id);
      b.addEventListener("click", () => startPool(pool.id));
      el.poolGrid.appendChild(b);
    }
    el.markNav.innerHTML = "";
    for (const m of MARKS) {
      const count = Q.countMarks(marks, m.id);
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<span>${m.icon} ${m.label}</span><span class="count">${count}</span>`;
      b.disabled = count === 0;
      b.addEventListener("click", () => startMarked(m.id));
      el.markNav.appendChild(b);
    }
    show("home");
  }

  function questionsFromIds(ids) {
    return Q.buildMistakesQueue(ids, data.bank);
  }

  function startPool(poolId) {
    const pool = data.pools.find((p) => p.id === poolId);
    const queue = questionsFromIds(pool.question_ids);
    session = {
      mode: "pool",
      title: `Пул ${poolId}`,
      queue,
      index: 0,
      selected: null,
      locked: false,
      correctCount: 0,
      wrongCount: 0,
      wrongIds: [],
      mistakesQueue: null,
      poolId,
      markFilter: null,
    };
    renderQuestion();
  }

  function startMarked(markId) {
    const ids = Object.entries(marks)
      .filter(([, v]) => v === markId)
      .map(([id]) => Number(id))
      .sort((a, b) => a - b);
    const queue = questionsFromIds(ids);
    const meta = MARKS.find((m) => m.id === markId);
    session = {
      mode: "marks",
      title: `${meta.icon} ${meta.label}`,
      queue,
      index: 0,
      selected: null,
      locked: false,
      correctCount: 0,
      wrongCount: 0,
      wrongIds: [],
      mistakesQueue: null,
      poolId: null,
      markFilter: markId,
    };
    renderQuestion();
  }

  function startMistakes() {
    if (!session || !session.mistakesQueue || !session.mistakesQueue.length) return;
    session = {
      ...session,
      mode: "mistakes",
      title: "Помилки",
      queue: session.mistakesQueue.slice(),
      index: 0,
      selected: null,
      locked: false,
      correctCount: 0,
      wrongCount: 0,
      wrongIds: [],
    };
    renderQuestion();
  }

  function currentQ() {
    return session.queue[session.index];
  }

  function renderMarkBar(q) {
    el.markBar.innerHTML = "";
    const current = marks[String(q.id)] || null;
    for (const m of MARKS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = m.icon;
      b.title = m.label;
      b.setAttribute("aria-label", m.label);
      if (current === m.id) b.classList.add("active");
      b.addEventListener("click", () => {
        marks = Q.toggleMark(marks, q.id, m.id);
        saveMarks();
        renderMarkBar(q);
      });
      el.markBar.appendChild(b);
    }
  }

  function renderQuestion() {
    const q = currentQ();
    el.title.textContent = session.title;
    el.progress.textContent = `${session.index + 1} / ${session.queue.length}`;
    el.qCategory.textContent = CAT_UA[q.category] || q.category;
    el.qText.textContent = q.question;
    el.confidence.hidden = true;
    el.confidence.className = "confidence";
    el.confirm.hidden = true;
    el.next.hidden = true;
    session.selected = null;
    session.locked = false;
    renderMarkBar(q);

    el.options.innerHTML = "";
    q.options.forEach((text, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "option";
      b.textContent = text;
      b.addEventListener("click", () => onOptionTap(idx));
      el.options.appendChild(b);
    });
    show("quiz");
  }

  function onOptionTap(idx) {
    if (session.locked) return;
    session.selected = idx;
    const buttons = [...el.options.querySelectorAll(".option")];
    buttons.forEach((btn, i) => {
      btn.classList.toggle("selected", i === idx);
    });
    el.confirm.hidden = false;
  }

  function confirmAnswer() {
    if (!session || session.locked || session.selected === null) return;
    const q = currentQ();
    const idx = session.selected;
    const buttons = [...el.options.querySelectorAll(".option")];
    const result = Q.gradeAnswer(idx, q.correct_index);

    session.locked = true;
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correct_index) btn.classList.add("correct");
      else if (i === idx && !result.ok) btn.classList.add("wrong");
      btn.classList.remove("selected");
    });

    session.correctCount += result.deltaCorrect;
    session.wrongCount += result.deltaWrong;
    if (!result.ok && session.mode === "pool") session.wrongIds.push(q.id);

    const conf = CONF_UA[q.confidence] || CONF_UA.medium;
    el.confidence.hidden = false;
    el.confidence.className = `confidence ${conf.cls}`;
    el.confidence.textContent = conf.text;
    el.confirm.hidden = true;
    el.next.hidden = false;
    el.next.textContent =
      session.index + 1 >= session.queue.length ? "Завершити" : "Далі";
  }

  function goNext() {
    if (!session) return;
    if (session.index + 1 >= session.queue.length) {
      finishSession();
      return;
    }
    session.index += 1;
    renderQuestion();
  }

  function finishSession() {
    if (session.mode === "pool" && session.mistakesQueue === null) {
      session.mistakesQueue = questionsFromIds(session.wrongIds);
    }
    el.title.textContent = session.title;
    el.summaryStats.innerHTML =
      `<strong>Правильних:</strong> ${session.correctCount}<br>` +
      `<strong>Неправильних:</strong> ${session.wrongCount}` +
      (session.mode === "pool"
        ? `<br><span style="color:var(--muted);font-size:0.95rem">Пул ${session.poolId} · ${session.queue.length} питань</span>`
        : "");
    const canMistakes =
      !!session.mistakesQueue &&
      session.mistakesQueue.length > 0 &&
      (session.mode === "pool" || session.mode === "mistakes");
    el.mistakes.hidden = !canMistakes;
    el.mistakes.textContent =
      session.mode === "mistakes"
        ? "Пройти помилки ще раз"
        : "Пройти роботу над помилками";
    el.again.hidden = session.mode === "mistakes";
    el.again.textContent =
      session.mode === "marks" ? "Пройти мітки знову" : "Пройти пул знову";
    show("summary");
  }

  el.confirm.addEventListener("click", confirmAnswer);
  el.next.addEventListener("click", goNext);
  el.homeBtn.addEventListener("click", () => {
    session = null;
    renderHome();
  });
  el.toHome.addEventListener("click", () => {
    session = null;
    renderHome();
  });
  el.mistakes.addEventListener("click", startMistakes);
  el.again.addEventListener("click", () => {
    if (!session) return;
    if (session.mode === "marks" && session.markFilter) {
      startMarked(session.markFilter);
      return;
    }
    if (session.poolId) startPool(session.poolId);
  });

  async function boot() {
    el.title.textContent = "Завантаження…";
    const res = await fetch("data/pools.json");
    if (!res.ok) throw new Error("Не вдалося завантажити pools.json");
    data = await res.json();
    renderHome();
  }

  boot().catch((err) => {
    el.title.textContent = "Помилка";
    el.home.innerHTML = `<p class="lead">${String(err.message || err)}</p>`;
    show("home");
  });
})();
