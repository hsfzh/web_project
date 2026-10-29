import {
    CONFIG,
    EMOTION_DEFAULT_COLORS,
    resetWritingMetrics,
    state
} from "./state.js";
import { analyzeEmotion } from "./emotions.js";
import {
    beginFinish,
    createLightInstances,
    resetLightScene,
    resizeCanvas
} from "./lights.js";

const inputForm = document.getElementById("input-form");
const userInput = document.getElementById("user-input");
const startScreen = document.getElementById("start-screen");
const emotionStep = document.getElementById("emotion-step");
const colorStep = document.getElementById("color-step");
const nextButton = document.getElementById("emotion-next-button");
const backButton = document.getElementById("emotion-back-button");
const selectedEmotionName = document.getElementById("selected-emotion-name");
const colorPicker = document.getElementById("emotion-color-picker");
const colorValue = document.getElementById("color-value");
const writingScreen = document.getElementById("writing-screen");
const endingScreen = document.getElementById("ending-screen");
const idleDialog = document.getElementById("idle-dialog");
const continueWritingButton = document.getElementById("continue-writing-button");
const finishWritingButton = document.getElementById("finish-writing-button");
const restartWritingButton = document.getElementById("restart-writing-button");

// 내용 높이에 맞춰 입력창 크기를 조절합니다.
function resizeUserInput() {
    userInput.style.height = "auto";
    userInput.style.height = `${Math.min(userInput.scrollHeight, 160)}px`;
    userInput.style.overflowY = userInput.scrollHeight > 160 ? "auto" : "hidden";
}

// 사용자 활동이 멈췄을 때의 확인 창 타이머를 다시 설정합니다.
function resetIdleTimer() {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;

    if (
        writingScreen.hidden ||
        userInput.disabled ||
        idleDialog.open ||
        state.lights.length === 0
    ) {
        return;
    }

    state.idleTimer = setTimeout(() => {
        if (!idleDialog.open && state.lights.length > 0) {
            idleDialog.showModal();
        }
    }, CONFIG.idleTimeLimitMs);
}

// 작성 시작 시각과 입력 사이의 멈춤 시간을 기록합니다.
function recordTypingActivity() {
    const now = performance.now();

    if (state.writingStartedAt === null && userInput.value.length > 0) {
        state.writingStartedAt = now;
        state.lastInputAt = now;
        return;
    }

    if (state.lastInputAt !== null) {
        const gap = now - state.lastInputAt;
        if (gap >= 2000) {
            state.pauseCount++;
            state.pausedTime += gap;
        }
    }

    state.lastInputAt = now;
}

// 메시지를 분석하고 감정에 해당하는 빛을 추가합니다.
function handleSubmit(event) {
    event.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    clearTimeout(state.idleTimer);
    state.idleTimer = null;

    const submitButton = inputForm.querySelector('[type="submit"]');
    const originalPlaceholder = userInput.placeholder;
    userInput.value = "";
    resizeUserInput();
    userInput.placeholder = "메시지 분석 중...";
    userInput.disabled = true;
    if (submitButton) submitButton.disabled = true;

    const emotions = analyzeEmotion(text);
    createLightInstances(emotions);
    resetWritingMetrics();

    userInput.disabled = false;
    userInput.placeholder = originalPlaceholder;
    if (submitButton) submitButton.disabled = false;

    userInput.focus();
    resetIdleTimer();
}

// 설정 화면을 닫고 글쓰기 화면을 엽니다.
function startWriting(event) {
    event.preventDefault();
    state.focusEmotionColor = colorPicker.value;
    startScreen.hidden = true;
    writingScreen.hidden = false;
    userInput.focus();
    resetIdleTimer();
}

// 빛 보내기 애니메이션을 시작합니다.
function finishWriting() {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
    idleDialog.close();
    writingScreen.hidden = true;
    beginFinish();
    window.dispatchEvent(new Event("writing:finish"));
}

// 감정 선택부터 다시 시작하도록 앱 상태를 초기화합니다.
function restartWriting() {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
    if (idleDialog.open) idleDialog.close();

    resetLightScene();
    resetWritingMetrics();
    state.focusEmotion = "";
    state.focusEmotionColor = "#FF4F4F";

    userInput.value = "";
    userInput.disabled = false;
    resizeUserInput();
    document.querySelectorAll('input[name="focus-emotion"]').forEach(input => {
        input.checked = false;
    });

    colorPicker.value = state.focusEmotionColor;
    colorValue.textContent = state.focusEmotionColor;
    selectedEmotionName.textContent = "";
    nextButton.disabled = true;
    colorStep.hidden = true;
    emotionStep.hidden = false;
    writingScreen.hidden = true;
    endingScreen.hidden = true;
    startScreen.hidden = false;
}

// 감정과 색상 설정 화면의 이벤트를 연결합니다.
function bindSetupEvents() {
    nextButton.disabled = true;

    document.querySelectorAll('input[name="focus-emotion"]').forEach(input => {
        input.addEventListener("change", () => {
            nextButton.disabled = false;
        });
    });

    nextButton.addEventListener("click", () => {
        const selected = document.querySelector('input[name="focus-emotion"]:checked');
        if (!selected) return;

        state.focusEmotion = selected.value;
        state.focusEmotionColor = EMOTION_DEFAULT_COLORS[state.focusEmotion] || "#FF4F4F";
        selectedEmotionName.textContent = state.focusEmotion;
        colorPicker.value = state.focusEmotionColor;
        colorValue.textContent = state.focusEmotionColor;
        emotionStep.hidden = true;
        colorStep.hidden = false;
        colorPicker.focus();
    });

    backButton.addEventListener("click", () => {
        colorStep.hidden = true;
        emotionStep.hidden = false;
    });

    colorPicker.addEventListener("input", () => {
        colorValue.textContent = colorPicker.value.toUpperCase();
    });

    colorStep.addEventListener("submit", startWriting);
}

// 글쓰기, 유휴 확인, 종료 관련 이벤트를 연결합니다.
function bindWritingEvents() {
    userInput.addEventListener("keydown", event => {
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            inputForm.requestSubmit();
        }
    });

    userInput.addEventListener("input", () => {
        resizeUserInput();
        recordTypingActivity();
    });

    userInput.addEventListener("keydown", event => {
        if (event.key === "Backspace") state.backspaceCount++;
    });

    inputForm.addEventListener("submit", handleSubmit);

    ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "input"].forEach(type => {
        document.addEventListener(type, event => {
            if (writingScreen.contains(event.target)) resetIdleTimer();
        }, { passive: ["pointermove", "wheel", "touchstart"].includes(type) });
    });

    colorStep.addEventListener("submit", resetIdleTimer);
    continueWritingButton.addEventListener("click", () => {
        idleDialog.close();
        userInput.focus();
        resetIdleTimer();
    });
    finishWritingButton.addEventListener("click", finishWriting);
    restartWritingButton.addEventListener("click", restartWriting);

    idleDialog.addEventListener("cancel", event => {
        event.preventDefault();
        idleDialog.close();
        userInput.focus();
        resetIdleTimer();
    });
}

// 화면 요소와 창 크기 변경 이벤트를 초기화합니다.
export function initializeUI() {
    bindSetupEvents();
    bindWritingEvents();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
}
