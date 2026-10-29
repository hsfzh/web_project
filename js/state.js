export const CONFIG = Object.freeze({
    lightRadius: 10,
    lightSpeed: 1000,
    lightGradient: 0.2,
    trailLifeTime: 0.6,
    trailSpacing: 8,
    lightsPerResponse: 10,
    maxLights: 20,
    idleTimeLimitMs: 20_000,
    lightsDissipationDuration: 8,
    lightsBurstTime: 6.6,
    lightsBurstRadius: 85,
    lightsMinGatherTime: 2.8,
    focusFinalSpeedRatio: 0.3,
    escapeTurnRate: 1.2,
    maxWritingSpeed: 3,
    maxBackspaceCount: 10
});

export const EMOTION_DEFAULT_COLORS = Object.freeze({
    "분노": "#F04438",
    "불안": "#A855F7",
    "슬픔": "#4385F5",
    "공포": "#3657A6",
    "스트레스": "#FF8A3D"
});

export const state = {
    focusEmotion: "",
    focusEmotionColor: "#FF4F4F",
    writingStartedAt: null,
    lastInputAt: null,
    pauseCount: 0,
    pausedTime: 0,
    backspaceCount: 0,
    lights: [],
    burstParticles: [],
    previousFrameTime: 0,
    isFinishingLights: false,
    lightsDissipationProgress: 0,
    backgroundProgress: 0,
    finishTotalEnergy: 0,
    backgroundTone: { r: 5, g: 9, b: 20 },
    idleTimer: null
};

// 숫자를 0과 1 사이로 제한합니다.
export const clamp01 = value => Math.max(0, Math.min(1, value));

// 두 값 사이를 지정한 비율만큼 보간합니다.
export function lerp(start, end, amount) {
    return start + (end - start) * amount;
}

// 16진수 색상에 투명도를 붙여 RGBA 문자열로 변환합니다.
export function hexToRgba(hex, alpha = 1) {
    const normalizedHex = hex.replace("#", "");
    const red = parseInt(normalizedHex.slice(0, 2), 16);
    const green = parseInt(normalizedHex.slice(2, 4), 16);
    const blue = parseInt(normalizedHex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

// 한 번의 글쓰기 입력에서 수집한 통계를 초기화합니다.
export function resetWritingMetrics() {
    state.writingStartedAt = null;
    state.lastInputAt = null;
    state.pauseCount = 0;
    state.pausedTime = 0;
    state.backspaceCount = 0;
}
