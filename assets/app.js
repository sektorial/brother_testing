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
  const LS_ANSWERS = "brother_testing_answers_v1";

  const el = {
    homeBtn: document.getElementById("btn-home"),
    title: document.getElementById("header-title"),
    progress: document.getElementById("progress"),
    home: document.getElementById("screen-home"),
    quiz: document.getElementById("screen-quiz"),
    summary: document.getElementById("screen-summary"),
    poolGrid: document.getElementById("pool-grid"),
    markNav: document.getElementById("mark-nav"),
    answersStats: document.getElementById("answers-stats"),
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
    clearMarks: document.getElementById("btn-clear-marks"),
    clearAnswers: document.getElementById("btn-clear-answers"),
    appVersion: document.getElementById("app-version"),
    confirmModal: document.getElementById("confirm-modal"),
    confirmMessage: document.getElementById("confirm-message"),
    confirmOk: document.getElementById("confirm-ok"),
    confirmCancel: document.getElementById("confirm-cancel"),
  };

  /** @type {{ pools: any[], bank: Record<string, any>, meta: any } | null} */
  let data = null;
  /** @type {Record<string, string>} */
  let marks = loadMarks();
  /** @type {Record<string, { selected_index: number, correct_index: number, ok: boolean, ts: number }>} */
  let answers = loadAnswers();

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
  function loadAnswers() {
    try {
      return JSON.parse(localStorage.getItem(LS_ANSWERS) || "{}") || {};
    } catch {
      return {};
    }
  }
  function saveAnswers() {
    localStorage.setItem(LS_ANSWERS, JSON.stringify(answers));
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
    if (el.appVersion) {
      el.appVersion.textContent = `Версія ${window.APP_VERSION || "?"}`;
    }
    el.poolGrid.innerHTML = "";
    for (const pool of data.pools) {
      const stats = Q.poolAnswerStats(pool.question_ids, answers);
      const b = document.createElement("button");
      b.type = "button";
      if (stats.answered > 0) b.classList.add("has-progress");
      b.innerHTML =
        `<span>${pool.id}</span>` +
        (stats.answered
          ? `<span class="pool-sub">${stats.correct}/${stats.answered}</span>`
          : `<span class="pool-sub">—</span>`);
      b.title =
        stats.answered > 0
          ? `Пул ${pool.id}: правильно ${stats.correct} з ${stats.answered} збережених відповідей`
          : `Пул ${pool.id}`;
      b.addEventListener("click", () => startPool(pool.id));
      el.poolGrid.appendChild(b);
    }
    el.markNav.innerHTML = "";
    for (const m of MARKS) {
      const count = Q.countMarks(marks, m.id);
      const row = document.createElement("div");
      row.className = "mark-row";

      const open = document.createElement("button");
      open.type = "button";
      open.className = "mark-open";
      open.innerHTML = `<span>${m.icon} ${m.label}</span><span class="count">${count}</span>`;
      open.disabled = count === 0;
      open.addEventListener("click", () => startMarked(m.id));

      const clearOne = document.createElement("button");
      clearOne.type = "button";
      clearOne.className = "mark-clear-one";
      clearOne.textContent = "Скинути";
      clearOne.disabled = count === 0;
      clearOne.title = `Скинути лише мітки «${m.label}»`;
      clearOne.addEventListener("click", () => clearOneMarkType(m));

      row.appendChild(open);
      row.appendChild(clearOne);
      el.markNav.appendChild(row);
    }
    const answered = Q.countAnswers(answers);
    const correct = Q.countCorrectAnswers(answers);
    el.answersStats.textContent = answered
      ? `Збережено відповідей: ${answered} (правильних: ${correct}).`
      : "Збережених відповідей ще немає.";
    el.clearMarks.disabled = Q.totalMarks(marks) === 0;
    el.clearAnswers.disabled = answered === 0;
    show("home");
  }

  /** In-app confirm dialog (native browser confirm is unreliable on some iOS/Safari contexts). */
  function askConfirm(message) {
    return new Promise((resolve) => {
      el.confirmMessage.textContent = message;
      el.confirmModal.hidden = false;
      const finish = (value) => {
        el.confirmModal.hidden = true;
        el.confirmOk.removeEventListener("click", onOk);
        el.confirmCancel.removeEventListener("click", onCancel);
        el.confirmModal.removeEventListener("click", onBackdrop);
        resolve(value);
      };
      const onOk = (e) => {
        e.preventDefault();
        e.stopPropagation();
        finish(true);
      };
      const onCancel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      };
      const onBackdrop = (e) => {
        if (e.target === el.confirmModal) finish(false);
      };
      el.confirmOk.addEventListener("click", onOk);
      el.confirmCancel.addEventListener("click", onCancel);
      el.confirmModal.addEventListener("click", onBackdrop);
    });
  }

  async function clearOneMarkType(meta) {
    const result = await Q.requestClearMarksOfType(
      marks,
      meta.id,
      meta.label,
      askConfirm
    );
    if (!result.cleared) return;
    marks = result.marks;
    saveMarks();
    renderHome();
  }

  async function clearAllSavedMarks() {
    const result = await Q.requestClearAllMarks(marks, askConfirm);
    if (!result.cleared) return;
    marks = result.marks;
    saveMarks();
    renderHome();
  }

  async function clearAllSavedAnswers() {
    const result = await Q.requestClearAllAnswers(answers, askConfirm);
    if (!result.cleared) return;
    answers = result.answers;
    saveAnswers();
    renderHome();
  }

  function questionsFromIds(ids) {
    return Q.buildMistakesQueue(ids, data.bank);
  }

  function startPool(poolId) {
    const pool = data.pools.find((p) => p.id === poolId);
    const queue = questionsFromIds(pool.question_ids);
    const savedStats = Q.sessionStatsFromSaved(queue, answers);
    session = {
      mode: "pool",
      title: `Пул ${poolId}`,
      queue,
      index: 0,
      selected: null,
      locked: false,
      correctCount: savedStats.correctCount,
      wrongCount: savedStats.wrongCount,
      wrongIds: savedStats.wrongIds.slice(),
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
    const savedStats = Q.sessionStatsFromSaved(queue, answers);
    session = {
      mode: "marks",
      title: `${meta.icon} ${meta.label}`,
      queue,
      index: 0,
      selected: null,
      locked: false,
      correctCount: savedStats.correctCount,
      wrongCount: savedStats.wrongCount,
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

  function showConfidence(level) {
    const conf = CONF_UA[level] || CONF_UA.medium;
    el.confidence.hidden = false;
    el.confidence.className = `confidence ${conf.cls}`;
    el.confidence.textContent = conf.text;
  }

  function lockOptionsReview(selectedIndex, correctIndex) {
    const buttons = [...el.options.querySelectorAll(".option")];
    const ok = selectedIndex === correctIndex;
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      btn.classList.remove("selected");
      if (i === correctIndex) btn.classList.add("correct");
      else if (i === selectedIndex && !ok) btn.classList.add("wrong");
    });
  }

  function renderQuestion() {
    const q = currentQ();
    el.title.textContent = session.title;
    el.progress.textContent = `${session.index + 1} / ${session.queue.length}`;
    el.qCategory.textContent = CAT_UA[q.category] || q.category;
    el.qText.textContent = q.question || "(Текст питання відсутній у джерелі)";
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

    const saved = Q.getSavedAnswer(answers, q.id);
    const review = Q.reviewStateFromSaved(saved);
    if (review) {
      session.selected = review.selectedIndex;
      session.locked = true;
      lockOptionsReview(review.selectedIndex, review.correctIndex);
      showConfidence(q.confidence);
      el.next.hidden = false;
      el.next.textContent =
        session.index + 1 >= session.queue.length ? "Завершити" : "Далі";
    }
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
    const result = Q.gradeAnswer(idx, q.correct_index);
    const prev = Q.getSavedAnswer(answers, q.id);

    if (prev) {
      session.correctCount -= prev.ok ? 1 : 0;
      session.wrongCount -= prev.ok ? 0 : 1;
      session.wrongIds = session.wrongIds.filter((id) => id !== q.id);
    }

    session.locked = true;
    lockOptionsReview(idx, q.correct_index);

    session.correctCount += result.deltaCorrect;
    session.wrongCount += result.deltaWrong;
    if (!result.ok && session.mode === "pool") session.wrongIds.push(q.id);

    answers = Q.recordAnswer(answers, q.id, idx, q.correct_index);
    saveAnswers();

    showConfidence(q.confidence);
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
  el.clearMarks.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearAllSavedMarks();
  });
  el.clearAnswers.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearAllSavedAnswers();
  });
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
