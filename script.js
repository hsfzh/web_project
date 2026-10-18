const inputForm = document.getElementById("input-form");
const userInput = document.getElementById("user-input");
const canvas = document.getElementById("light-canvas");
const context = canvas.getContext("2d");
//const apiKeyInput = document.getElementById("api-key");

const lightRadius = 10;
const lightSpeed = 1000;
const lightGradient = 0.2;

const trailLifeTime = 0.6;
const trailSpacing = 8;

const LIGHTS_PER_RESPONSE = 5;
const MAX_LIGHTS = 20;

const lights = [];
let previousTime = 0;

function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.floor(window.innerWidth * pixelRatio);
    canvas.height = Math.floor(window.innerHeight * pixelRatio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function lerp(start, end, amount) {
    return start + (end - start) * amount;
}

class Light {
    constructor(color, emotion) {
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;
        this.previousX = this.x;
        this.previousY = this.y;

        this.color = color;
        this.emotion = emotion;
        this.speed = lightSpeed;
        this.angle = Math.random() * Math.PI * 2;
        this.out = false;
        this.trails = [];
    }

    checkOutOfBounds() {
        if (!this.out) {
            this.out =
                this.x < -lightRadius ||
                this.x > window.innerWidth + lightRadius ||
                this.y < -lightRadius ||
                this.y > window.innerHeight + lightRadius;
        } else if (
            this.x > lightRadius &&
            this.x < window.innerWidth - lightRadius &&
            this.y > lightRadius &&
            this.y < window.innerHeight - lightRadius
        ) {
            this.out = false;
        }
    }

    update(deltaTime) {
        this.previousX = this.x;
        this.previousY = this.y;

        this.checkOutOfBounds();

        if (this.out) {
            const xDiff = window.innerWidth / 2 - this.x;
            const yDiff = window.innerHeight / 2 - this.y;
            const targetAngle = Math.atan2(yDiff, xDiff);

            const angleDiff = Math.atan2(
                Math.sin(targetAngle - this.angle),
                Math.cos(targetAngle - this.angle)
            );

            this.angle += angleDiff * (1 - Math.exp(-4 * deltaTime));
        } else {
            this.angle += Math.random() * Math.PI / 18 - Math.PI / 36;
        }

        this.x += Math.cos(this.angle) * this.speed * deltaTime;
        this.y += Math.sin(this.angle) * this.speed * deltaTime;

        const distance = Math.hypot(
            this.x - this.previousX,
            this.y - this.previousY
        );

        const steps = Math.max(1, Math.ceil(distance / trailSpacing));

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;

            this.trails.push({
                x: lerp(this.previousX, this.x, t),
                y: lerp(this.previousY, this.y, t),
                age: 0
            });
        }
    }

    draw(x, y, radius = lightRadius) {
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.15, "rgba(255, 255, 255, 0.95)");
        gradient.addColorStop(lightGradient, this.color);
        gradient.addColorStop(1, "rgba(5, 9, 20, 0)");

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }

    drawTrails(deltaTime) {
        context.save();
        context.globalCompositeOperation = "lighter";

        for (const trail of this.trails) {
            const progress = Math.min(trail.age / trailLifeTime, 1);
            const radius = lerp(lightRadius, 1, progress);

            this.draw(trail.x, trail.y, radius);
            trail.age += deltaTime;
        }

        context.restore();

        this.trails = this.trails.filter(
            trail => trail.age < trailLifeTime
        );
    }
}

function animate(currentTime) {
    const rawDeltaTime = previousTime
        ? (currentTime - previousTime) / 1000
        : 0;

    const deltaTime = Math.min(rawDeltaTime, 0.05);
    previousTime = currentTime;

    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const light of lights) {
        light.update(deltaTime);
        light.drawTrails(deltaTime);
        light.draw(light.x, light.y);
    }

    requestAnimationFrame(animate);
}

// api 키 없을때 기능 확인용 랜덤 생성 함수
function returnRandomEmotion() {
    if (!apiKey) {
        const emotionOptions = [
            { name: "기쁨", color: "#FFD700" },
            { name: "슬픔", color: "#4385F5" },
            { name: "분노", color: "#F04438" },
            { name: "불안", color: "#A855F7" },
            { name: "평온", color: "#35C9A5" }
        ];

        // 감정 종류를 1~5개 무작위로 선택합니다.
        for (let i = emotionOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [emotionOptions[i], emotionOptions[j]] =
                [emotionOptions[j], emotionOptions[i]];
        }

        const count = Math.floor(Math.random() * 5) + 1;
        const selected = emotionOptions.slice(0, count);

        const weights = Array(count).fill(0);

        // 100점을 선택된 감정들에 무작위로 배분합니다.
        // 어떤 감정은 0점일 수 있습니다.
        for (let remaining = 100; remaining > 0; remaining--) {
            weights[Math.floor(Math.random() * count)]++;
        }

        return selected
            .map((emotion, index) => {
                const hex = emotion.color.slice(1);
                const baseRgb = [
                    parseInt(hex.slice(0, 2), 16),
                    parseInt(hex.slice(2, 4), 16),
                    parseInt(hex.slice(4, 6), 16)
                ];

                const variedHex = baseRgb
                    .map(value => {
                        const variation = Math.floor(Math.random() * 37) - 18;
                        const adjusted = Math.max(0, Math.min(255, value + variation));
                        return adjusted.toString(16).padStart(2, "0");
                    })
                    .join("");

                return {
                    name: emotion.name,
                    color: `#${variedHex}`,
                    weight: weights[index]
                };
            })
            .filter(emotion => emotion.weight > 0);
    }
}

async function analyzeEmotion(text) {
    const apiKey = ""; // 향후 서버를 통해 응답 받도록 수정 현재는 개인 테스트 목적으로 코드에 api 키 입력해서 테스트함

    if (!apiKey) {
        // throw new Error("API 키를 입력해 주세요.");
        return returnRandomEmotion(); // 향후 제거 예정
    }

    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `
문장에서 드러나는 감정을 최대 5개까지 분석해.
감정 이름은 문장에 맞게 정하고, 감정에 어울리는 6자리 HEX 색상을 지정해.
색은 빛으로 잘 보이도록 선명하고 채도가 높은 색을 선택해.
파스텔색, 회색빛 색, 지나치게 옅은 색은 피하고 감정에 어울리는 HEX 색을 써.
단, 평온이나 중립은 감정 표현에 필요하면 흰색이나 옅은 색을 사용할 수 있어.
weight는 0 이상의 정수이며, 여러 감정이면 합계는 100, 하나면 100으로 해.
감정이 없으면 중립 하나를 반환해.
JSON만 출력해.

{"emotions":[{"name":"기쁨","color":"#FFD700","weight":70}]}

문장: ${text}
`.trim()
                    }]
                }],
                generationConfig: {
                    thinkingConfig: {
                        thinkingLevel: "minimal"
                    },
                    responseMimeType: "application/json"
                }
            })
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.error?.message || `Gemini API 오류: ${response.status}`
        );
    }

    const candidate = result.candidates?.[0];

    if (candidate?.finishReason === "MAX_TOKENS") {
        throw new Error("AI 응답이 토큰 한도에서 잘렸습니다. 다시 시도해 주세요.");
    }

    const outputText = candidate?.content?.parts
        ?.map(part => part.text ?? "")
        .join("")
        .trim();

    if (!outputText) {
        throw new Error("AI 응답에서 감정 정보를 찾지 못했습니다.");
    }

    let parsed;

    try {
        const cleanedText = outputText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();

        parsed = JSON.parse(cleanedText);
    } catch {
        throw new Error(`AI 응답을 JSON으로 읽지 못했습니다: ${outputText}`);
    }

    if (!Array.isArray(parsed.emotions)) {
        throw new Error("AI 응답에 emotions 배열이 없습니다.");
    }

    const validEmotions = [];
    const seenNames = new Set();

    for (const item of parsed.emotions.slice(0, LIGHTS_PER_RESPONSE)) {
        if (
            typeof item.name !== "string" ||
            !/^#[0-9a-fA-F]{6}$/.test(item.color) ||
            !Number.isFinite(item.weight) ||
            item.weight < 0
        ) {
            continue;
        }

        const name = item.name.trim().slice(0, 30);
        if (!name) continue;

        const normalizedName = name.toLowerCase();
        if (seenNames.has(normalizedName)) continue;

        seenNames.add(normalizedName);
        validEmotions.push({
            name,
            color: item.color,
            weight: item.weight
        });
    }

    if (validEmotions.length === 0) {
        throw new Error("유효한 감정 정보를 응답에서 찾지 못했습니다.");
    }

    return validEmotions;
}

function distributeLights(emotions) {
    const counts = Array(emotions.length).fill(1);
    let remaining = LIGHTS_PER_RESPONSE - emotions.length;

    if (remaining <= 0) {
        return counts;
    }

    const totalWeight = emotions.reduce(
        (sum, emotion) => sum + emotion.weight,
        0
    );

    const weights = totalWeight > 0
        ? emotions.map(emotion => emotion.weight / totalWeight)
        : emotions.map(() => 1 / emotions.length);

    const fractions = [];
    let assigned = 0;

    for (let i = 0; i < weights.length; i++) {
        const exactShare = remaining * weights[i];
        const wholeShare = Math.floor(exactShare);

        counts[i] += wholeShare;
        assigned += wholeShare;

        fractions.push({
            index: i,
            fraction: exactShare - wholeShare
        });
    }

    fractions.sort((a, b) => b.fraction - a.fraction);

    for (let i = 0; i < remaining - assigned; i++) {
        counts[fractions[i].index]++;
    }

    return counts;
}

function createEmotionLights(emotions) {
    const counts = distributeLights(emotions);
    const newLights = [];

    for (let i = 0; i < emotions.length; i++) {
        for (let count = 0; count < counts[i]; count++) {
            newLights.push(
                new Light(emotions[i].color, emotions[i].name)
            );
        }
    }

    lights.push(...newLights);

    if (lights.length > MAX_LIGHTS) {
        lights.splice(0, LIGHTS_PER_RESPONSE);
    }
}

inputForm.addEventListener("submit", async event => {
    event.preventDefault();

    const text = userInput.value.trim();
    if (!text) return;

    const submitButton = inputForm.querySelector('[type="submit"]');
    const originalPlaceholder = userInput.placeholder;

    userInput.value = "";
    userInput.placeholder = "메시지 분석 중...";
    userInput.disabled = true;

    if (submitButton) {
        submitButton.disabled = true;
    }

    try {
        const emotions = await analyzeEmotion(text);
        console.log("분석된 감정:", emotions);

        createEmotionLights(emotions);
        console.log("현재 빛 개수:", lights.length);
    } catch (error) {
        console.error(error);
        userInput.value = text;
        alert(error.message);
    } finally {
        userInput.disabled = false;
        userInput.placeholder = originalPlaceholder;

        if (submitButton) {
            submitButton.disabled = false;
        }

        userInput.focus();
    }
});

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(animate);