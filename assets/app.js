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
  const LS_TIMERS = "brother_testing_timers_v1";

  const el = {
    homeBtn: document.getElementById("btn-home"),
    title: document.getElementById("header-title"),
    progress: document.getElementById("progress"),
    poolTimer: document.getElementById("pool-timer"),
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
    prev: document.getElementById("btn-prev"),
    next: document.getElementById("btn-next"),
    finish: document.getElementById("btn-finish"),
    navRow: document.getElementById("nav-row"),
    summaryStats: document.getElementById("summary-stats"),
    unanswered: document.getElementById("btn-unanswered"),
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
    poolReset: document.getElementById("pool-reset"),
    poolResetSummary: document.getElementById("pool-reset-summary"),
    poolLiveStats: document.getElementById("pool-live-stats"),
    summaryPoolStats: document.getElementById("summary-pool-stats"),
    clearPoolAnswers: document.getElementById("btn-clear-pool-answers"),
    clearPoolMarks: document.getElementById("btn-clear-pool-marks"),
    clearPoolAnswersSummary: document.getElementById("btn-clear-pool-answers-summary"),
    clearPoolMarksSummary: document.getElementById("btn-clear-pool-marks-summary"),
  };

  /** @type {{ pools: any[], bank: Record<string, any>, meta: any } | null} */
  let data = null;
  /** @type {Record<string, string>} */
  let marks = loadMarks();
  /** @type {Record<string, { selected_index: number, correct_index: number, ok: boolean, ts: number }>} */
  let answers = loadAnswers();
  /** @type {Record<string, number>} poolId -> elapsed ms */
  let poolTimers = loadPoolTimers();

  /** @type {null | {
   *   mode: 'pool' | 'marks' | 'mistakes' | 'unanswered',
   *   sourceMode: 'pool' | 'marks',
   *   title: string,
   *   hubTitle: string,
   *   queue: any[],
   *   hubQueue: any[],
   *   index: number,
   *   selected: number | null,
   *   locked: boolean,
   *   correctCount: number,
   *   wrongCount: number,
   *   wrongIds: number[],
   *   unansweredCount: number,
   *   unansweredIds: number[],
   *   mistakesQueue: any[] | null,
   *   unansweredQueue: any[] | null,
   *   poolId: number | null,
   *   markFilter: string | null,
   *   elapsedMs: number | null,
   * }} */
  let session = null;

  /** Pool run timer (only for sourceMode === 'pool'). */
  let poolTimer = {
    startedAt: null,
    intervalId: null,
    running: false,
  };

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
  function loadPoolTimers() {
    try {
      return JSON.parse(localStorage.getItem(LS_TIMERS) || "{}") || {};
    } catch {
      return {};
    }
  }
  function savePoolTimers() {
    localStorage.setItem(LS_TIMERS, JSON.stringify(poolTimers));
  }

  function show(screen) {
    el.home.hidden = screen !== "home";
    el.quiz.hidden = screen !== "quiz";
    el.summary.hidden = screen !== "summary";
    el.homeBtn.hidden = screen === "home";
    el.progress.hidden = screen !== "quiz";
    syncPoolTimerVisibility(screen);
  }

  function readPoolTimerMs() {
    if (poolTimer.running && poolTimer.startedAt != null) {
      return Date.now() - poolTimer.startedAt;
    }
    if (session && session.elapsedMs != null) return session.elapsedMs;
    return 0;
  }

  function paintPoolTimer(ms) {
    if (!el.poolTimer) return;
    el.poolTimer.textContent = Q.formatElapsedHms(ms);
  }

  function syncPoolTimerVisibility(screen) {
    if (!el.poolTimer) return;
    const isPoolSource = !!(session && session.sourceMode === "pool");
    const showLive = screen === "quiz" && isPoolSource && session.mode === "pool";
    const showFrozen =
      screen === "summary" && isPoolSource && session.elapsedMs != null;
    el.poolTimer.hidden = !(showLive || showFrozen);
    if (showLive || showFrozen) paintPoolTimer(readPoolTimerMs());
  }

  function persistCurrentPoolElapsed(ms) {
    if (!session || session.poolId == null) return;
    poolTimers = Q.setPoolElapsed(poolTimers, session.poolId, ms);
    savePoolTimers();
  }

  function clearPersistedPoolElapsed(poolId) {
    poolTimers = Q.clearPoolElapsed(poolTimers, poolId);
    savePoolTimers();
  }

  /**
   * Start/resume pool timer.
   * @param {{ reset?: boolean }} [opts]
   */
  function startPoolTimer(opts) {
    const reset = !!(opts && opts.reset);
    const poolId = session && session.poolId;
    stopPoolTimer({ persist: false, clearSession: true });
    let baseMs = 0;
    if (reset && poolId != null) {
      clearPersistedPoolElapsed(poolId);
    } else if (poolId != null) {
      baseMs = Q.getPoolElapsed(poolTimers, poolId);
    }
    if (session) session.elapsedMs = baseMs;
    poolTimer.startedAt = Date.now() - baseMs;
    poolTimer.running = true;
    paintPoolTimer(baseMs);
    poolTimer.intervalId = setInterval(() => {
      if (!poolTimer.running || poolTimer.startedAt == null) return;
      paintPoolTimer(Date.now() - poolTimer.startedAt);
    }, 250);
  }

  /**
   * Stop ticking.
   * persist: save elapsed for current pool
   * clearSession: wipe session.elapsedMs when discarding
   */
  function stopPoolTimer(opts) {
    const persist = !!(opts && opts.persist);
    const clearSession = !!(opts && opts.clearSession);
    if (poolTimer.intervalId != null) {
      clearInterval(poolTimer.intervalId);
      poolTimer.intervalId = null;
    }
    let ms = 0;
    if (poolTimer.running && poolTimer.startedAt != null) {
      ms = Date.now() - poolTimer.startedAt;
    } else if (session && session.elapsedMs != null) {
      ms = session.elapsedMs;
    }
    poolTimer.running = false;
    poolTimer.startedAt = null;
    if (persist) {
      if (session) {
        session.elapsedMs = ms;
        paintPoolTimer(ms);
      }
      persistCurrentPoolElapsed(ms);
    } else if (clearSession && session) {
      session.elapsedMs = null;
    }
  }

  function renderHome() {
    el.title.textContent = "Тренажер";
    if (el.appVersion) {
      el.appVersion.textContent = `Версія ${window.APP_VERSION || "?"}`;
    }
    el.poolGrid.innerHTML = "";
    for (const pool of data.pools) {
      const stats = Q.poolAnswerStats(pool.question_ids, answers);
      const markCount = Q.countMarksForIds(marks, pool.question_ids);
      const row = document.createElement("div");
      row.className = "pool-row";

      const open = document.createElement("button");
      open.type = "button";
      open.className = "pool-open";
      if (stats.answered > 0) open.classList.add("has-progress");
      open.innerHTML =
        `<span>Пул ${pool.id}</span>` +
        `<span class="pool-sub">${Q.formatPoolStatsHtml(stats)}</span>`;
      open.title = `Пул ${pool.id}: неправильних ${stats.wrong}, надано ${stats.answered}, усього ${stats.total}`;
      open.addEventListener("click", () => startPool(pool.id));

      const clearAns = document.createElement("button");
      clearAns.type = "button";
      clearAns.className = "pool-clear-answers";
      clearAns.textContent = "↺ відп.";
      clearAns.title = `Скинути відповіді пулу ${pool.id}`;
      clearAns.disabled = stats.answered === 0;
      clearAns.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearPoolAnswersById(pool.id);
      });

      const clearMk = document.createElement("button");
      clearMk.type = "button";
      clearMk.className = "pool-clear-marks";
      clearMk.textContent = "↺ мітки";
      clearMk.title = `Скинути мітки пулу ${pool.id}`;
      clearMk.disabled = markCount === 0;
      clearMk.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearPoolMarksById(pool.id);
      });

      row.appendChild(open);
      row.appendChild(clearAns);
      row.appendChild(clearMk);
      el.poolGrid.appendChild(row);
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
    poolTimers = {};
    savePoolTimers();
    renderHome();
  }

  function currentPoolIds() {
    if (!session || !session.poolId || !data) return null;
    const pool = data.pools.find((p) => p.id === session.poolId);
    return pool ? pool.question_ids : null;
  }

  function syncPoolResetButtons() {
    const inPool = !!(session && session.poolId);
    const ids = currentPoolIds() || [];
    const stats = Q.poolAnswerStats(ids, answers);
    const markN = Q.countMarksForIds(marks, ids);
    const statsHtml = Q.formatPoolStatsHtml(stats);

    if (el.poolLiveStats) {
      el.poolLiveStats.hidden = !inPool;
      if (inPool) el.poolLiveStats.innerHTML = statsHtml;
    }
    if (el.summaryPoolStats) {
      el.summaryPoolStats.hidden = !inPool;
      if (inPool) el.summaryPoolStats.innerHTML = statsHtml;
    }
    if (el.poolReset) {
      el.poolReset.hidden = !inPool;
      if (!inPool) el.poolReset.open = false;
    }
    if (el.poolResetSummary) {
      el.poolResetSummary.hidden = !inPool;
      if (!inPool) el.poolResetSummary.open = false;
    }
    if (el.clearPoolAnswers) el.clearPoolAnswers.disabled = !inPool || stats.answered === 0;
    if (el.clearPoolMarks) el.clearPoolMarks.disabled = !inPool || markN === 0;
    if (el.clearPoolAnswersSummary) {
      el.clearPoolAnswersSummary.disabled = !inPool || stats.answered === 0;
    }
    if (el.clearPoolMarksSummary) {
      el.clearPoolMarksSummary.disabled = !inPool || markN === 0;
    }
  }

  async function clearPoolAnswersById(poolId) {
    const pool = data.pools.find((p) => p.id === poolId);
    if (!pool) return;
    const result = await Q.requestClearPoolAnswers(
      answers,
      pool.question_ids,
      String(poolId),
      askConfirm
    );
    if (!result.cleared) return;
    answers = result.answers;
    saveAnswers();
    clearPersistedPoolElapsed(poolId);
    if (session && session.poolId === poolId) {
      applyHubStatsToSession();
      if (!el.quiz.hidden) {
        startPoolTimer({ reset: true });
        renderQuestion();
      } else if (!el.summary.hidden) {
        session.elapsedMs = 0;
        finishSession();
      } else renderHome();
    } else {
      renderHome();
    }
  }

  function applyHubStatsToSession() {
    if (!session || !session.hubQueue) return null;
    const savedStats = Q.sessionStatsFromSaved(session.hubQueue, answers);
    session.correctCount = savedStats.correctCount;
    session.wrongCount = savedStats.wrongCount;
    session.wrongIds = savedStats.wrongIds.slice();
    session.unansweredCount = savedStats.unansweredCount;
    session.unansweredIds = savedStats.unansweredIds.slice();
    session.mistakesQueue = savedStats.wrongIds.length
      ? questionsFromIds(savedStats.wrongIds)
      : [];
    session.unansweredQueue = savedStats.unansweredIds.length
      ? Q.buildUnansweredQueue(savedStats.unansweredIds, data.bank)
      : [];
    return savedStats;
  }

  async function clearPoolMarksById(poolId) {
    const pool = data.pools.find((p) => p.id === poolId);
    if (!pool) return;
    const result = await Q.requestClearPoolMarks(
      marks,
      pool.question_ids,
      String(poolId),
      askConfirm
    );
    if (!result.cleared) return;
    marks = result.marks;
    saveMarks();
    if (session && session.poolId === poolId && !el.quiz.hidden) {
      renderQuestion();
    } else if (!el.home.hidden) {
      renderHome();
    } else {
      syncPoolResetButtons();
    }
  }

  async function clearCurrentPoolAnswers() {
    if (!session || !session.poolId) return;
    await clearPoolAnswersById(session.poolId);
  }

  async function clearCurrentPoolMarks() {
    if (!session || !session.poolId) return;
    await clearPoolMarksById(session.poolId);
  }

  function questionsFromIds(ids) {
    return Q.buildMistakesQueue(ids, data.bank);
  }

  function startPool(poolId, opts) {
    const pool = data.pools.find((p) => p.id === poolId);
    const queue = questionsFromIds(pool.question_ids);
    const hubTitle = `Пул ${poolId}`;
    const resetTimer = !!(opts && opts.resetTimer);
    session = {
      mode: "pool",
      sourceMode: "pool",
      title: hubTitle,
      hubTitle,
      queue,
      hubQueue: queue.slice(),
      index: 0,
      selected: null,
      locked: false,
      correctCount: 0,
      wrongCount: 0,
      wrongIds: [],
      unansweredCount: 0,
      unansweredIds: [],
      mistakesQueue: null,
      unansweredQueue: null,
      poolId,
      markFilter: null,
      elapsedMs: null,
    };
    applyHubStatsToSession();
    startPoolTimer({ reset: resetTimer });
    renderQuestion();
  }

  function startMarked(markId) {
    stopPoolTimer({ persist: false, clearSession: true });
    const ids = Object.entries(marks)
      .filter(([, v]) => v === markId)
      .map(([id]) => Number(id))
      .sort((a, b) => a - b);
    const queue = questionsFromIds(ids);
    const meta = MARKS.find((m) => m.id === markId);
    const hubTitle = `${meta.icon} ${meta.label}`;
    session = {
      mode: "marks",
      sourceMode: "marks",
      title: hubTitle,
      hubTitle,
      queue,
      hubQueue: queue.slice(),
      index: 0,
      selected: null,
      locked: false,
      correctCount: 0,
      wrongCount: 0,
      wrongIds: [],
      unansweredCount: 0,
      unansweredIds: [],
      mistakesQueue: null,
      unansweredQueue: null,
      poolId: null,
      markFilter: markId,
      elapsedMs: null,
    };
    applyHubStatsToSession();
    renderQuestion();
  }

  function startMistakes() {
    applyHubStatsToSession();
    if (!session || !session.mistakesQueue || !session.mistakesQueue.length) return;
    // Reset saved wrong answers so the user can re-answer without reveal.
    const retryQueue = session.mistakesQueue.slice();
    const retryIds = retryQueue.map((q) => q.id);
    answers = Q.clearAnswersForIds(answers, retryIds);
    saveAnswers();
    session = {
      ...session,
      mode: "mistakes",
      title: "Помилки",
      queue: retryQueue,
      index: 0,
      selected: null,
      locked: false,
      mistakesQueue: retryQueue.slice(),
      wrongIds: retryIds.slice(),
      wrongCount: retryIds.length,
    };
    renderQuestion();
  }

  function startUnanswered() {
    applyHubStatsToSession();
    if (!session || !session.unansweredQueue || !session.unansweredQueue.length) {
      return;
    }
    session = {
      ...session,
      mode: "unanswered",
      title: "Пропущені",
      queue: session.unansweredQueue.slice(),
      index: 0,
      selected: null,
      locked: false,
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

  function syncNavButtons() {
    if (!session) return;
    const atStart = session.index <= 0;
    const atEnd = !Q.canGoNext(session.index, session.queue.length);
    el.prev.disabled = atStart;
    el.next.disabled = atEnd;
    el.next.textContent = "Далі →";
    el.prev.textContent = "← Назад";
    if (el.finish) el.finish.hidden = false;
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
    }
    syncNavButtons();
    syncPoolResetButtons();
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

    session.locked = true;
    lockOptionsReview(idx, q.correct_index);

    answers = Q.recordAnswer(answers, q.id, idx, q.correct_index);
    saveAnswers();
    applyHubStatsToSession();

    showConfidence(q.confidence);
    el.confirm.hidden = true;
    syncNavButtons();
    syncPoolResetButtons();
  }

  function goPrev() {
    if (!session) return;
    const next = Q.prevIndex(session.index);
    if (next === session.index) return;
    session.index = next;
    renderQuestion();
  }

  function goNext() {
    if (!session) return;
    const total = session.queue.length;
    if (!Q.canGoNext(session.index, total)) return;
    session.index = Q.nextIndex(session.index, total);
    renderQuestion();
  }

  function finishSession() {
    if (!session) return;
    if (session.sourceMode === "pool") {
      stopPoolTimer({ persist: true });
    }
    applyHubStatsToSession();
    el.title.textContent = session.hubTitle || session.title;
    const hubTotal = session.hubQueue ? session.hubQueue.length : session.queue.length;
    const poolLine =
      session.poolId != null
        ? `<br><span style="color:var(--muted);font-size:0.95rem">Пул ${session.poolId} · ${hubTotal} питань</span>`
        : session.sourceMode === "marks"
          ? `<br><span style="color:var(--muted);font-size:0.95rem">${hubTotal} питань з міткою</span>`
          : "";
    const timeLine =
      session.sourceMode === "pool" && session.elapsedMs != null
        ? `<br><strong>Час:</strong> ${Q.formatElapsedHms(session.elapsedMs)}`
        : "";
    el.summaryStats.innerHTML =
      `<strong>Правильних:</strong> ${session.correctCount}<br>` +
      `<strong>Неправильних:</strong> ${session.wrongCount}<br>` +
      `<strong>Без відповіді:</strong> ${session.unansweredCount}` +
      timeLine +
      poolLine;

    const unansweredN = session.unansweredQueue ? session.unansweredQueue.length : 0;
    const wrongN = session.mistakesQueue ? session.mistakesQueue.length : 0;
    if (el.unanswered) {
      el.unanswered.hidden = unansweredN === 0;
      el.unanswered.textContent = `Допроходити пропущені (${unansweredN})`;
    }
    el.mistakes.hidden = wrongN === 0;
    el.mistakes.textContent =
      session.mode === "mistakes"
        ? `Пройти помилки ще раз (${wrongN})`
        : `Пройти роботу над помилками (${wrongN})`;
    el.again.hidden = false;
    el.again.textContent =
      session.sourceMode === "marks" ? "Пройти мітки знову" : "Пройти пул знову";
    syncPoolResetButtons();
    show("summary");
  }

  el.confirm.addEventListener("click", confirmAnswer);
  el.prev.addEventListener("click", goPrev);
  el.next.addEventListener("click", goNext);
  if (el.finish) el.finish.addEventListener("click", finishSession);
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
  el.clearPoolAnswers.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearCurrentPoolAnswers();
  });
  el.clearPoolMarks.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearCurrentPoolMarks();
  });
  el.clearPoolAnswersSummary.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearCurrentPoolAnswers();
  });
  el.clearPoolMarksSummary.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearCurrentPoolMarks();
  });
  el.homeBtn.addEventListener("click", () => {
    stopPoolTimer({ persist: true });
    session = null;
    renderHome();
  });
  el.toHome.addEventListener("click", () => {
    stopPoolTimer({ persist: true });
    session = null;
    renderHome();
  });
  if (el.unanswered) el.unanswered.addEventListener("click", startUnanswered);
  el.mistakes.addEventListener("click", startMistakes);
  el.again.addEventListener("click", () => {
    if (!session) return;
    if (session.sourceMode === "marks" && session.markFilter) {
      startMarked(session.markFilter);
      return;
    }
    if (session.poolId) startPool(session.poolId, { resetTimer: true });
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
