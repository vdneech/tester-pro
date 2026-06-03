let currentRangeStart = null;
let currentRangeEnd = null;

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let rawData = JSON.parse(document.getElementById('raw-questions-data').textContent);

if (typeof rawData === 'string') {
    rawData = JSON.parse(rawData);
}

const masterQuestions = rawData.map(q => {
    const opts = q.options || {};
    let type = "single";

    if (opts.correctAnswers) {
        type = "multi";
    } else if (!opts.correct && !opts.correctAnswers && opts.choices) {
        type = "matching";
    } else if (opts.answers && opts.answers.length === 1 && opts.answers[0] === opts.correct) {
        type = "typing";
    } else if (!opts.answers || opts.answers.length === 0) {
        type = "typing";
    }

    return {
        id: q.id,
        number: q.number,
        question: q.text,
        type: type,
        choices: opts.answers || opts.choices || [],
        correctAnswers: opts.correctAnswers ? opts.correctAnswers : (opts.correct ? [opts.correct] : null),
        explanation: opts.explanation || "Объяснение для данного вопроса отсутствует.",
        images: q.images || []
    };
});

let questions = [];
let currentQuestionIndex = 0;
let startTime;
let answered = false;
let incorrectQuestions = [];
let incorrectAnswerCount = 0;
let isReviewMode = false;
let totalQuestionsCount = 0;
let lastEnterTime = 0;

const questionContainer = document.getElementById('question-container');
const nextBtn = document.getElementById('nextBtn');
const skipBtn = document.getElementById('skipBtn');
const resultContainer = document.getElementById('result-container');
const controlsContainer = document.getElementById('controlsContainer');
const keyboardHint = document.getElementById('keyboardHint');
const shuffleWrapper = document.getElementById('shuffleWrapper');

function initSession() {
    const mode = document.getElementById('modeSelect').value;
    isReviewMode = false;
    incorrectQuestions = [];
    incorrectAnswerCount = 0;
    currentQuestionIndex = 0;
    answered = false;
    startTime = new Date();

    const rangeSelector = document.getElementById('rangeSelector');

    if (rangeSelector) {
        rangeSelector.style.display = (mode === 'range') ? 'flex' : 'none';
    }

    isReviewMode = false;
    incorrectQuestions = [];
    incorrectAnswerCount = 0;
    currentQuestionIndex = 0;
    answered = false;
    startTime = new Date();

    if (mode === 'range' && (currentRangeStart === null || currentRangeEnd === null)) {
        questionContainer.style.display = 'none';
        controlsContainer.style.display = 'none';
        keyboardHint.style.display = 'none';
        resultContainer.style.display = 'none';
        return;
    }

    questionContainer.style.display = 'block';
    controlsContainer.style.display = 'flex';
    keyboardHint.style.display = 'block';
    resultContainer.style.display = 'none';
    skipBtn.style.display = 'none';
    shuffleWrapper.style.opacity = '1';
    shuffleWrapper.style.pointerEvents = 'auto';

    if (mode === 'normal') {
        questions = [...masterQuestions];
    } else if (mode === 'cabinet') {
        questions = [...masterQuestions].sort(() => Math.random() - 0.5).slice(0, 50);
    } else if (mode === 'cheat') {
        renderCheatSheet();
        return;
    } else if (mode === 'range') {
        if (currentRangeStart === null || currentRangeEnd === null) {
            questionContainer.style.display = 'none';
            controlsContainer.style.display = 'none';
            keyboardHint.style.display = 'none';
            if (rangeSelector) {
                rangeSelector.style.display = 'flex';
                document.getElementById('rangeStart').max = masterQuestions.length;
                document.getElementById('rangeEnd').max = masterQuestions.length;
            }
            return;
        } else {
            const startIdx = Math.max(0, currentRangeStart - 1);
            const endIdx = Math.min(masterQuestions.length, currentRangeEnd);
            questions = masterQuestions.slice(startIdx, endIdx);
        }
    }

    totalQuestionsCount = questions.length;

    if (questions.length > 0) {
        showQuestion();
    } else {
        questionContainer.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 14px;">Нет вопросов в выбранном диапазоне.</div>';
        controlsContainer.style.display = 'none';
        keyboardHint.style.display = 'none';
    }
}

window.handleModeChange = function () {
    currentRangeStart = null;
    currentRangeEnd = null;
    initSession();
}

window.resetSession = function () {
    initSession();
}

window.handleShuffleChange = function () {
    const mode = document.getElementById('modeSelect').value;
    if (!answered && questions.length > 0 && !isReviewMode && mode !== 'cheat') {
        showQuestion();
    }
}

window.startRangeTest = function () {
    const startInput = document.getElementById('rangeStart');
    const endInput = document.getElementById('rangeEnd');
    const max = masterQuestions.length;

    let startVal = parseInt(startInput.value);
    let endVal = parseInt(endInput.value);

    let start = isNaN(startVal) ? 1 : startVal;
    let end = isNaN(endVal) ? max : endVal;

    if (start < 1) start = 1;
    if (end > max) end = max;
    if (start > end) {
        let temp = start;
        start = end;
        end = temp;

        startInput.value = start;
        endInput.value = end;
    }

    currentRangeStart = start;
    currentRangeEnd = end;
    initSession();
}

function showQuestion() {
    if (questions.length === 0) return;

    document.getElementById('explanation-box').style.display = 'none';

    const q = questions[currentQuestionIndex];
    answered = false;
    nextBtn.textContent = 'Ответить';

    let imagesHTML = '';
    if (q.images && q.images.length > 0) {
        imagesHTML = `<div class="image-grid">`;
        q.images.forEach(url => {
            imagesHTML += `<img src="${url}" alt="Медиа">`;
        });
        imagesHTML += `</div>`;
    }

    let choicesHTML = '';
    if (q.type === 'matching') {
        const isArray = Array.isArray(q.choices);
        let leftSides = [];
        let rightSides = [];
        let lookupMap = {};

        if (isArray) {
            q.choices.forEach(pair => {
                leftSides.push(pair[0]);
                rightSides.push(pair[1]);
                lookupMap[pair[0]] = pair[1];
            });
        } else {
            leftSides = Object.keys(q.choices);
            rightSides = Object.values(q.choices);
            lookupMap = q.choices;
        }

        leftSides.sort(() => Math.random() - 0.5);
        rightSides.sort(() => Math.random() - 0.5);
        q.matchingMap = lookupMap;

        choicesHTML = `<div style="border: 1px solid var(--border-main); padding: 14px; border-radius: var(--radius-md); background: var(--bg-muted);">`;
        leftSides.forEach(left => {
            let options = `<option value="" disabled selected>Установите соответствие...</option>`;
            rightSides.forEach(right => {
                options += `<option value="${escapeHTML(right)}">${escapeHTML(right)}</option>`;
            });
            choicesHTML += `
                <div class="matching-row">
                    <span style="flex: 1; min-width: 160px; font-weight: 500; font-size: 13px;">${escapeHTML(left)}</span>
                    <select name="matching-answer" data-left="${escapeHTML(left)}" class="matching-select">${options}</select>
                </div>
            `;
        });
        choicesHTML += `</div>`;
    } else if (q.type === 'typing') {
        choicesHTML = `
            <div style="margin-bottom: 8px;">
                <input type="text" id="typingAnswerInput" class="toolbar-select"
                       placeholder="Введите ваш ответ..."
                       style="width: 100%; height: 42px; padding: 0 14px; font-size: 14px; border-radius: var(--radius-md); cursor: text !important;"
                       autocomplete="off">
            </div>
        `;
    } else {
        const isMulti = q.type === 'multi';
        const inputType = isMulti ? 'checkbox' : 'radio';

        let finalChoices = [...q.choices];
        if (document.getElementById('shuffleAnswersToggle').checked) {
            finalChoices.sort(() => Math.random() - 0.5);
        }

        choicesHTML = finalChoices.map(choice => {
            const escaped = escapeHTML(choice);
            return `
                <label class="answer-choice">
                    <input type="${inputType}" name="answer" value="${escaped}">
                    <span>${escaped}</span>
                </label>
            `;
        }).join('');
    }

    questionContainer.innerHTML = `
        <span class="badge badge-primary">
            ${isReviewMode ? 'Работа над ошибками' : `Вопрос ${currentQuestionIndex + 1} из ${questions.length}`}
        </span>
        <h3 style="margin-bottom: 16px; font-size: 15px; font-weight: 600;">${escapeHTML(q.question)}</h3>
        ${imagesHTML}
        <div id="options-block">${choicesHTML}</div>
    `;

    if (q.type !== 'matching' && q.type !== 'typing') {
        document.querySelectorAll('.answer-choice').forEach(label => {
            label.addEventListener('click', function (e) {
                if (this.classList.contains('disabled')) return;

                const input = this.querySelector('input');
                if (e.target !== input) {
                    e.preventDefault();
                    input.checked = !input.checked;
                }

                if (input.type === 'radio') {
                    document.querySelectorAll('.answer-choice').forEach(l => l.style.borderColor = 'var(--border-main)');
                    if (input.checked) this.style.borderColor = 'var(--primary)';
                } else if (input.type === 'checkbox') {
                    this.style.borderColor = input.checked ? 'var(--primary)' : 'var(--border-main)';
                }
            });
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
        const typingInput = document.getElementById('typingAnswerInput');
        if (typingInput) typingInput.focus();
    }, 50);
}

nextBtn.addEventListener('click', () => {
    const q = questions[currentQuestionIndex];

    if (!answered) {
        if (q.type === 'typing') {
            const inputField = document.getElementById('typingAnswerInput');
            const userAnswer = inputField.value.trim();
            const correctAnswer = q.correctAnswers[0];
            const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();

            inputField.disabled = true;

            if (isCorrect && userAnswer !== "") {
                inputField.style.borderColor = 'var(--success)';
                inputField.style.backgroundColor = 'var(--success-bg)';
                inputField.style.color = 'var(--success)';
            } else {
                if (!isReviewMode) incorrectAnswerCount++;
                incorrectQuestions.push(q);

                inputField.style.borderColor = 'var(--danger)';
                inputField.style.backgroundColor = 'var(--danger-bg)';
                inputField.style.color = 'var(--danger)';

                const hint = document.createElement('div');
                hint.style.color = 'var(--success)';
                hint.style.fontSize = '13px';
                hint.style.fontWeight = '500';
                hint.style.marginTop = '6px';
                hint.innerHTML = `Правильно: <strong>${correctAnswer}</strong>`;
                inputField.parentNode.appendChild(hint);
            }

            showExplanation(q);
            answered = true;
            nextBtn.textContent = 'Далее';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        if (q.type === 'matching') {
            const selects = Array.from(document.querySelectorAll('select[name="matching-answer"]'));
            let isCorrect = true;

            selects.forEach(select => {
                const leftValue = select.getAttribute('data-left');
                const selectedRight = select.value;
                const correctRight = q.matchingMap[leftValue];
                select.disabled = true;

                if (selectedRight === correctRight && selectedRight !== "") {
                    select.style.borderColor = 'var(--success)';
                    select.style.backgroundColor = 'var(--success-bg)';
                } else {
                    isCorrect = false;
                    select.style.borderColor = 'var(--danger)';
                    select.style.backgroundColor = 'var(--danger-bg)';

                    const hint = document.createElement('div');
                    hint.style.color = 'var(--primary)';
                    hint.style.fontSize = '12px';
                    hint.style.marginTop = '2px';
                    hint.innerHTML = `Правильно: <strong>${correctRight}</strong>`;
                    select.parentNode.appendChild(hint);
                }
            });

            if (!isCorrect && !isReviewMode) incorrectAnswerCount++;
            if (!isCorrect) incorrectQuestions.push(q);

            showExplanation(q);
            answered = true;
            nextBtn.textContent = 'Далее';
            return;
        }

        const selectedInputs = Array.from(document.querySelectorAll('input[name="answer"]:checked'));
        const selectedAnswers = selectedInputs.map(input => input.value);
        const correctAnswers = q.correctAnswers;

        const isCorrect = selectedAnswers.length > 0 &&
            selectedAnswers.length === correctAnswers.length &&
            selectedAnswers.every(val => correctAnswers.includes(val));

        if (!isCorrect && !isReviewMode) incorrectAnswerCount++;
        if (!isCorrect) incorrectQuestions.push(q);

        document.querySelectorAll('input[name="answer"]').forEach(input => {
            const label = input.closest('label');
            input.disabled = true;
            label.classList.add('disabled');
            label.style.borderColor = ''; // Сброс инлайн-стиля

            const val = input.value;
            const isSelected = selectedAnswers.includes(val);
            const isActualCorrect = correctAnswers.includes(val);

            if (isSelected && isActualCorrect) {
                label.classList.add('correct-answer');
            } else if (isSelected && !isActualCorrect) {
                label.classList.add('incorrect-answer');
            } else if (!isSelected && isActualCorrect) {
                label.classList.add('partially-correct-answer');
            } else {
                label.style.borderColor = 'var(--border-main)';
            }
        });

        showExplanation(q);
        answered = true;
        nextBtn.textContent = 'Далее';
    } else {
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            showQuestion();
        } else {
            if (incorrectQuestions.length > 0) {
                showModal(
                    "Основной пул завершен",
                    `Допущено ошибок – ${incorrectQuestions.length}`,
                    "Начать работу над ошибками",
                    () => {
                        startReviewMode();
                    }
                );
                currentQuestionIndex = 0;
                questions = [...incorrectQuestions];
                incorrectQuestions = [];
                isReviewMode = true;
                skipBtn.style.display = 'flex';
                showQuestion();
            } else {
                finishTest();
            }
        }
    }
});

skipBtn.addEventListener('click', () => {
    finishTest();
});

function showExplanation(q) {
    const expBox = document.getElementById('explanation-box');
    if (expBox) {
        expBox.style.display = 'block';
        expBox.innerHTML = `<strong>Разбор:</strong> ${q.explanation}`;
    }
}

function renderCheatSheet() {
    controlsContainer.style.display = 'none';
    keyboardHint.style.display = 'none';
    shuffleWrapper.style.opacity = '0.4';
    shuffleWrapper.style.pointerEvents = 'none';

    let fullHTML = `<h2 style="font-size: 16px; font-weight:600; margin-bottom:16px;">Спецификация правильных ответов теста</h2>`;

    masterQuestions.forEach((q, idx) => {
        let imagesHTML = '';
        if (q.images && q.images.length > 0) {
            imagesHTML = `<div class="image-grid" style="margin-top:8px;">`;
            q.images.forEach(url => {
                imagesHTML += `<img src="${url}">`;
            });
            imagesHTML += `</div>`;
        }

        let answersRender = '';
        if (q.type === 'matching') {
            const isArray = Array.isArray(q.choices);
            answersRender = `<div style="margin-top:8px; padding:10px; background:var(--bg-muted); border-radius:var(--radius-sm); border:1px solid var(--border-main);">`;
            if (isArray) {
                q.choices.forEach(pair => {
                    answersRender += `<div style="font-size:13px; margin-bottom:4px;"><strong>${escapeHTML(pair[0])}</strong> → <span style="color:var(--success); font-weight:500;">${escapeHTML(pair[1])}</span></div>`;
                });
            } else {
                Object.entries(q.choices).forEach(([k, v]) => {
                    answersRender += `<div style="font-size:13px; margin-bottom:4px;"><strong>${escapeHTML(k)}</strong> → <span style="color:var(--success); font-weight:500;">${escapeHTML(v)}</span></div>`;
                });
            }
            answersRender += `</div>`;
        } else {
            answersRender = `<div style="margin-top:8px; display:flex; flex-direction:column; gap:4px;">`;
            if (q.type === 'typing') {
                answersRender += `
                    <div style="padding:6px 10px; border:1px solid var(--success); background: var(--success-bg); border-radius:var(--radius-sm); font-size:13px; font-weight:500; color: var(--success);">
                        Правильный ответ (ввод текста): <strong>${escapeHTML(q.correctAnswers[0])}</strong>
                    </div>
                `;
            } else {
                q.choices.forEach(choice => {
                    const isActualCorrect = q.correctAnswers.includes(choice);
                    const borderStyle = isActualCorrect ? 'border-color: var(--success); background: var(--success-bg); font-weight:500;' : 'opacity:0.7;';

                    answersRender += `
                        <div style="padding:6px 10px; border:1px solid var(--border-main); border-radius:var(--radius-sm); font-size:13px; ${borderStyle}">
                            ${escapeHTML(choice)}
                        </div>
                    `;
                });
            }
            answersRender += `</div>`;
        }

        fullHTML += `
            <div class="cheat-question-block">
                <span class="badge badge-primary">
                    ${isReviewMode ? 'Работа над ошибками' : `Вопрос ${idx + 1}`}
                </span>
                <div style="font-size:14px; font-weight:500; margin-top:2px;">${escapeHTML(q.question)}</div>
                ${imagesHTML}
                ${answersRender}
                <div style="margin-top:6px; font-size:12px; color:var(--text-muted); background:var(--bg-main); padding:6px; border-radius:4px;">
                    <strong>Разбор:</strong> ${escapeHTML(q.explanation)}
                </div>
            </div>
        `;
    });

    questionContainer.innerHTML = fullHTML;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function finishTest() {
    const timeTaken = Math.floor((new Date() - startTime) / 1000);
    const percent = totalQuestionsCount > 0
        ? (((totalQuestionsCount - incorrectAnswerCount) / totalQuestionsCount) * 100).toFixed(0)
        : 0;

    questionContainer.style.display = 'none';
    controlsContainer.style.display = 'none';
    keyboardHint.style.display = 'none';

    resultContainer.style.display = 'block';
    resultContainer.className = 'result-card'; // Применяем стиль карточки

    resultContainer.innerHTML = `
        <h2 style="margin: 0 0 16px 0; font-size: 18px; text-align: center;">Тестирование завершено</h2>

        <div class="stats-grid">
            <div class="stat-item">
                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Вопросов</span>
                <span class="stat-value">${totalQuestionsCount}</span>
            </div>
            <div class="stat-item">
                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Ошибок</span>
                <span class="stat-value" style="color: var(--danger);">${incorrectAnswerCount}</span>
            </div>
            <div class="stat-item">
                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Результат</span>
                <span class="stat-value" style="color: var(--success);">${percent}%</span>
            </div>
            <div class="stat-item">
                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Время</span>
                <span class="stat-value">${timeTaken}с</span>
            </div>
        </div>

        <div class="result-actions">
            <button class="btn btn-primary" onclick="window.resetSession();" style="justify-content: center;">
                <i data-lucide="refresh-cw" style="width:16px; height:16px; margin-right:8px;"></i> Повторить тест
            </button>
            <a href="${window.QUIZ_CONFIG.homeUrl}" class="btn btn-outline" style="justify-content: center; color: var(--text-muted);">
                <i data-lucide="home" style="width:16px; height:16px; margin-right:8px;"></i> На главную
            </a>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const now = Date.now();
        if (now - lastEnterTime < 250) {
            event.preventDefault();
            return;
        }

        if (nextBtn && controlsContainer.style.display !== 'none' && nextBtn.style.display !== 'none') {
            event.preventDefault();
            lastEnterTime = now;
            nextBtn.click();
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (window.QUIZ_CONFIG) {
        localStorage.setItem('last_quiz_slug', window.QUIZ_CONFIG.testSlug);
        localStorage.setItem('last_quiz_title', window.QUIZ_CONFIG.testTitle);
    }
    const rangeEnd = document.getElementById('rangeEnd');

    if (rangeEnd) rangeEnd.placeholder = `${masterQuestions.length}`;

    initSession();
});