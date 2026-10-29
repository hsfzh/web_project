import { CONFIG, EMOTION_DEFAULT_COLORS, clamp01, state } from "./state.js";

const emotionOptions = Object.entries(EMOTION_DEFAULT_COLORS).map(
    ([name, color]) => ({ name, color })
);

// 입력 시간, 멈춤, 지움 횟수로 감정 비중을 계산합니다.
export function analyzeEmotion(text) {
    const now = performance.now();
    const characterCount = [...text].length;
    const writingDuration = state.writingStartedAt === null
        ? 0
        : (now - state.writingStartedAt) / 1000;
    const pausedSeconds = state.pausedTime / 1000;
    const activeWritingTime = Math.max(0, writingDuration - pausedSeconds);
    const writingSpeed = activeWritingTime > 0
        ? characterCount / activeWritingTime
        : 0;

    let speedFactor = clamp01(writingSpeed / CONFIG.maxWritingSpeed);
    let pauseFactor = writingDuration > 0
        ? clamp01((pausedSeconds / writingDuration) * 2)
        : 0;
    let backspaceFactor = clamp01(
        state.backspaceCount / CONFIG.maxBackspaceCount
    );

    if (["불안", "슬픔"].includes(state.focusEmotion)) {
        speedFactor = 1 - speedFactor;
    }

    if (["분노", "공포", "불안"].includes(state.focusEmotion)) {
        pauseFactor = 1 - pauseFactor;
        backspaceFactor = 1 - backspaceFactor;
    }

    const emotionFactor = (
        speedFactor + pauseFactor + backspaceFactor
    ) / 3;

    return selectEmotions(emotionFactor);
}

// 계산된 비중을 여러 감정과 가중치 목록으로 만듭니다.
function selectEmotions(emotionFactor) {
    const factor = Number.isFinite(emotionFactor)
        ? clamp01(emotionFactor)
        : 0;
    const focusOption = {
        name: state.focusEmotion || "분노",
        color: state.focusEmotionColor
    };
    const otherOptions = emotionOptions
        .filter(emotion => emotion.name !== focusOption.name)
        .map(emotion => ({ ...emotion }));

    for (let i = otherOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherOptions[i], otherOptions[j]] = [otherOptions[j], otherOptions[i]];
    }

    let count = Math.floor(Math.random() * emotionOptions.length) + 1;
    if (factor < 0.9 && otherOptions.length > 0) {
        count = Math.max(count, 2);
    }

    const selected = [focusOption, ...otherOptions.slice(0, count - 1)];
    const weights = Array(selected.length).fill(0);
    const focusWeight = selected.length === 1 ? 100 : Math.round(100 * factor);
    weights[0] = focusWeight;

    let remainder = 100 - focusWeight;
    while (remainder > 0 && weights.length > 1) {
        const randomIndex = Math.floor(Math.random() * (weights.length - 1)) + 1;
        weights[randomIndex]++;
        remainder--;
    }

    return selected.map((emotion, index) => ({
        name: emotion.name,
        color: emotion.color,
        weight: weights[index]
    }));
}
