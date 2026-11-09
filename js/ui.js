import {
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
const releaseDialog = document.getElementById("release-dialog");
const continueWritingButton = document.getElementById("continue-writing-button");
const finishWritingButton = document.getElementById("finish-writing-button");
const releaseEmotionButton = document.getElementById("release-emotion-button");
const restartWritingButton = document.getElementById("restart-writing-button");
const leavePageButton = document.getElementById("leave-page-button");
const closeWindowMessage = document.getElementById("close-window-message");

// 내용 높이에 맞춰 입력창 크기를 조절합니다.
function resizeUserInput() {
    userInput.style.height = "auto";
    userInput.style.height = `${Math.min(userInput.scrollHeight, 160)}px`;
    userInput.style.overflowY = userInput.scrollHeight > 160 ? "auto" : "hidden";
}

// 작성 시작 시각과 입력 사이의 멈춤 시간을 기록합니다.
function recordWritingInputTiming() {
    const now = performance.now();

    if (state.firstInputAt === null && userInput.value.length > 0) {
        state.firstInputAt = now;
        state.previousInputAt = now;
        return;
    }

    if (state.previousInputAt !== null) {
        const gap = now - state.previousInputAt;
        if (gap >= 2000) {
            state.longPauseCount++;
            state.accumulatedPauseTime += gap;
        }
    }

    state.previousInputAt = now;
}

// 메시지를 분석하고 감정에 해당하는 빛을 추가합니다.
async function handleSubmit(event) {
    event.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    // 마지막 입력 뒤 전송 전까지의 멈춤 시간도 작성 통계에 반영합니다.
    const submittedAt = performance.now();
    if (state.previousInputAt !== null) {
        const finalGap = submittedAt - state.previousInputAt;
        if (finalGap >= 2000) {
            state.longPauseCount++;
            state.accumulatedPauseTime += finalGap;
        }
    }

    const characterCount = [...text].length;
    const emotions = analyzeEmotion(text);
    const submitButton = inputForm.querySelector('[type="submit"]');
    const originalPlaceholder = userInput.placeholder;
    userInput.value = "";
    resizeUserInput();
    userInput.placeholder = "메시지 분석 중...";
    userInput.disabled = true;
    if (submitButton) submitButton.disabled = true;

    try {
        // 로딩 상태가 화면에 그려진 뒤 CPU 작업을 진행합니다.
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        createLightInstances(emotions, characterCount);
        resetWritingMetrics();
        releaseEmotionButton.hidden = state.lights.length === 0;
    } finally {
        userInput.disabled = false;
        userInput.placeholder = originalPlaceholder;
        if (submitButton) submitButton.disabled = false;
        userInput.focus();
    }
}

// 설정 화면을 닫고 글쓰기 화면을 엽니다.
function startWriting(event) {
    event.preventDefault();
    state.focusEmotionColor = colorPicker.value;
    startScreen.hidden = true;
    writingScreen.hidden = false;
    userInput.focus();
    releaseEmotionButton.hidden = true;
}

// 빛 보내기 애니메이션을 시작합니다.
function finishWriting() {
    releaseDialog.close();
    writingScreen.hidden = true;
    beginFinish();
    window.dispatchEvent(new Event("writing:finish"));
}

// 감정 선택부터 다시 시작하도록 앱 상태를 초기화합니다.
function restartWriting() {
    if (releaseDialog.open) releaseDialog.close();

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

// 글쓰기와 종료 관련 이벤트를 연결합니다.
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
        recordWritingInputTiming();
    });

    userInput.addEventListener("input", event => {
        if (event.inputType === "deleteContentBackward") {
            state.backspaceCount++;
        }
    });

    inputForm.addEventListener("submit", handleSubmit);

    releaseEmotionButton.addEventListener("click", () => {
        if (state.lights.length > 0 && !releaseDialog.open) releaseDialog.showModal();
    });
    continueWritingButton.addEventListener("click", () => {
        releaseDialog.close();
        userInput.focus();
    });
    finishWritingButton.addEventListener("click", finishWriting);
    restartWritingButton.addEventListener("click", restartWriting);
    leavePageButton.addEventListener("click", () => {
        window.close();
        closeWindowMessage.hidden = false;
    });

    releaseDialog.addEventListener("cancel", event => {
        event.preventDefault();
        releaseDialog.close();
        userInput.focus();
    });
}

// 화면 요소와 창 크기 변경 이벤트를 초기화합니다.
export function initializeUI() {
    bindSetupEvents();
    bindWritingEvents();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
}
