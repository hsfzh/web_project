import { CONFIG, clamp01, hexToRgba, lerp, state } from "./state.js";

const canvas = document.getElementById("light-canvas");
const context = canvas.getContext("2d");

// 빛이 화면 경계와 여백을 벗어났는지 확인합니다.
function isOutsideCanvas(light, padding = CONFIG.lightRadius) {
    return light.x < -padding || light.x > window.innerWidth + padding ||
        light.y < -padding || light.y > window.innerHeight + padding;
}

// 빛과 화면 중앙 사이의 거리를 반환합니다.
function distanceFromCenter(light) {
    return Math.hypot(
        light.x - window.innerWidth / 2,
        light.y - window.innerHeight / 2
    );
}

export class Light {
    // 지정한 색과 감정으로 빛 하나를 만듭니다.
    constructor(color, emotion, opacity = 1) {
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;
        this.previousX = this.x;
        this.previousY = this.y;
        this.color = color;
        this.emotion = emotion;
        this.opacity = opacity;
        this.initialOpacity = opacity;
        this.speed = CONFIG.lightSpeed;
        this.angle = Math.random() * Math.PI * 2;
        this.out = false;
        this.finishing = false;
        this.finishMode = null;
        this.dissipation = 0;
        this.finishStartSpeed = CONFIG.lightSpeed;
        this.finishTargetAngle = this.angle;
        this.trails = [];
    }

    // 빛을 중앙으로 모으거나 화면 밖으로 보내는 모드로 전환합니다.
    startFinishing(mode) {
        if (this.finishing) return;
        this.finishing = true;
        this.finishMode = mode;
        this.finishStartSpeed = this.speed;

        if (mode === "escape") {
            this.finishTargetAngle = Math.atan2(
                this.y - window.innerHeight / 2,
                this.x - window.innerWidth / 2
            );

            if (distanceFromCenter(this) < 1) {
                this.finishTargetAngle = Math.random() * Math.PI * 2;
            }
        }
    }

    // 일반 애니메이션 중 화면 경계 진입 상태를 갱신합니다.
    checkOutOfBounds() {
        if (!this.out) {
            this.out = isOutsideCanvas(this);
        } else if (
            this.x > CONFIG.lightRadius &&
            this.x < window.innerWidth - CONFIG.lightRadius &&
            this.y > CONFIG.lightRadius &&
            this.y < window.innerHeight - CONFIG.lightRadius
        ) {
            this.out = false;
        }
    }

    // 빛의 방향, 위치, 잔광을 시간에 따라 갱신합니다.
    update(deltaTime) {
        this.previousX = this.x;
        this.previousY = this.y;
        let angleDiff = 0;

        if (this.finishing) {
            const elapsed = state.lightsDissipationProgress * CONFIG.lightsDissipationDuration;

            if (this.finishMode === "gather") {
                const opacityFade = 1 - Math.exp(-4.5 * elapsed / CONFIG.lightsBurstTime);
                this.opacity = this.initialOpacity * (1 - opacityFade * 0.35);
                this.dissipation = Math.min(1, elapsed / CONFIG.lightsBurstTime);
                const centerAngle = Math.atan2(
                    window.innerHeight / 2 - this.y,
                    window.innerWidth / 2 - this.x
                );
                angleDiff = Math.atan2(
                    Math.sin(centerAngle - this.angle),
                    Math.cos(centerAngle - this.angle)
                );
                this.speed = lerp(
                    this.finishStartSpeed,
                    this.finishStartSpeed * CONFIG.focusFinalSpeedRatio,
                    this.dissipation
                );
            } else {
                this.dissipation = 0;
                this.opacity = this.initialOpacity;
                this.speed = this.finishStartSpeed;
                angleDiff = Math.atan2(
                    Math.sin(this.finishTargetAngle - this.angle),
                    Math.cos(this.finishTargetAngle - this.angle)
                );
            }

            const turnRate = this.finishMode === "gather"
                ? 1.4 + this.dissipation * 1.2
                : CONFIG.escapeTurnRate;
            const maxTurn = turnRate * deltaTime;
            this.angle += Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
        } else {
            this.checkOutOfBounds();

            if (this.out) {
                const targetAngle = Math.atan2(
                    window.innerHeight / 2 - this.y,
                    window.innerWidth / 2 - this.x
                );
                const difference = Math.atan2(
                    Math.sin(targetAngle - this.angle),
                    Math.cos(targetAngle - this.angle)
                );
                this.angle += difference * (1 - Math.exp(-4 * deltaTime));
            } else {
                this.angle += Math.random() * Math.PI / 18 - Math.PI / 36;
            }
        }

        this.x += Math.cos(this.angle) * this.speed * deltaTime;
        this.y += Math.sin(this.angle) * this.speed * deltaTime;

        const escaped = this.finishMode === "escape" && isOutsideCanvas(this);
        if (escaped) return;

        const distance = Math.hypot(
            this.x - this.previousX,
            this.y - this.previousY
        );
        const steps = Math.max(1, Math.ceil(distance / CONFIG.trailSpacing));

        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            this.trails.push({
                x: lerp(this.previousX, this.x, progress),
                y: lerp(this.previousY, this.y, progress),
                age: 0
            });
        }
    }

    // 빛을 원형 그라데이션으로 그립니다.
    draw(x, y, radius = CONFIG.lightRadius) {
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${this.opacity})`);
        gradient.addColorStop(0.15, `rgba(255, 255, 255, ${this.opacity * 0.95})`);
        gradient.addColorStop(CONFIG.lightGradient, hexToRgba(this.color, this.opacity));
        gradient.addColorStop(
            1,
            `rgba(${state.backgroundTone.r}, ${state.backgroundTone.g}, ${state.backgroundTone.b}, 0)`
        );

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }

    // 잔광을 그린 뒤 수명이 다한 잔광을 정리합니다.
    drawTrails(deltaTime) {
        context.save();
        context.globalCompositeOperation = "lighter";

        for (const trail of this.trails) {
            const progress = Math.min(trail.age / CONFIG.trailLifeTime, 1);
            this.draw(trail.x, trail.y, lerp(CONFIG.lightRadius, 1, progress));
            trail.age += deltaTime;
        }

        context.restore();
        this.trails = this.trails.filter(trail => trail.age < CONFIG.trailLifeTime);
    }
}

// 중앙에 도착한 빛을 작은 폭죽 입자들로 바꿉니다.
function createLightBurst(light) {
    const particleCount = 18;

    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.35;
        const speed = 110 + Math.random() * 180;
        state.burstParticles.push({
            x: light.x,
            y: light.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: 0.8 + Math.random() * 0.55,
            radius: 1.5 + Math.random() * 2.5,
            color: light.color,
            energyWeight: light.opacity / particleCount
        });
    }
}

// 모든 빛의 상태를 갱신하고 화면에 그립니다.
function drawLights(deltaTime) {
    for (const light of state.lights) {
        light.update(deltaTime);
        light.drawTrails(deltaTime);
        light.draw(light.x, light.y);
    }
}

// 중앙에 도착했거나 화면 밖으로 나간 빛을 정리합니다.
function removeCompletedLights(elapsed) {
    for (let i = state.lights.length - 1; i >= 0; i--) {
        const light = state.lights[i];

        if (light.finishMode === "gather") {
            const reachedCenter = distanceFromCenter(light) <= CONFIG.lightsBurstRadius;
            const canBurst = elapsed >= CONFIG.lightsMinGatherTime && reachedCenter;
            const timedOut = elapsed >= CONFIG.lightsDissipationDuration;

            if (canBurst || timedOut) {
                createLightBurst(light);
                state.lights.splice(i, 1);
            }
        } else if (
            light.finishMode === "escape" &&
            isOutsideCanvas(light) &&
            light.trails.length === 0
        ) {
            state.lights.splice(i, 1);
        }
    }
}

// 폭죽 입자를 움직이고 투명하게 사라지게 그립니다.
function drawBurstParticles(deltaTime) {
    context.save();
    context.globalCompositeOperation = "lighter";

    for (let i = state.burstParticles.length - 1; i >= 0; i--) {
        const particle = state.burstParticles[i];
        particle.age += deltaTime;

        if (particle.age >= particle.life) {
            state.burstParticles.splice(i, 1);
            continue;
        }

        particle.vx *= Math.pow(0.985, deltaTime * 60);
        particle.vy *= Math.pow(0.985, deltaTime * 60);
        particle.vy += 45 * deltaTime;
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;

        const alpha = 1 - particle.age / particle.life;
        context.fillStyle = hexToRgba(particle.color, alpha);
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius * alpha, 0, Math.PI * 2);
        context.fill();
    }

    context.restore();
}

// 남은 빛과 폭죽의 밝기에 맞춰 배경 진행도를 계산합니다.
function syncBackgroundWithLights() {
    if (!state.isFinishingLights || state.finishTotalEnergy <= 0) return;

    let remainingEnergy = 0;
    for (const light of state.lights) {
        if (light.finishMode === "escape") {
            const edgeDistance = Math.min(
                light.x,
                light.y,
                window.innerWidth - light.x,
                window.innerHeight - light.y
            );
            remainingEnergy += light.initialOpacity * clamp01(edgeDistance / 70);
        } else {
            remainingEnergy += Math.max(0, light.opacity);
        }
    }

    for (const particle of state.burstParticles) {
        remainingEnergy += particle.energyWeight * (1 - particle.age / particle.life);
    }

    state.backgroundProgress = clamp01(1 - remainingEnergy / state.finishTotalEnergy);
}

// 계산된 진행도를 배경색과 글자색에 반영합니다.
function updateFinishBackground() {
    state.backgroundTone = {
        r: Math.round(lerp(5, 255, state.backgroundProgress)),
        g: Math.round(lerp(9, 255, state.backgroundProgress)),
        b: Math.round(lerp(20, 255, state.backgroundProgress))
    };
    document.body.style.backgroundColor = `rgb(${state.backgroundTone.r}, ${state.backgroundTone.g}, ${state.backgroundTone.b})`;
    document.body.style.color = `rgb(${Math.round(244 - 220 * state.backgroundProgress)}, ${Math.round(245 - 220 * state.backgroundProgress)}, ${Math.round(247 - 220 * state.backgroundProgress)})`;
}

// 모든 빛과 폭죽이 사라지면 감사 화면을 표시합니다.
function finishIfComplete() {
    if (!state.isFinishingLights || state.lights.length > 0 || state.burstParticles.length > 0) return;

    clearTimeout(state.idleTimer);
    state.lightsDissipationProgress = 1;
    state.backgroundProgress = 1;
    state.backgroundTone = { r: 255, g: 255, b: 255 };
    document.body.style.backgroundColor = "#fff";
    document.body.style.color = "#181818";
    document.getElementById("ending-screen").hidden = false;
}

// 한 프레임의 애니메이션과 종료 상태를 처리합니다.
function animate(currentTime) {
    const rawDeltaTime = state.previousFrameTime
        ? (currentTime - state.previousFrameTime) / 1000
        : 0;
    const deltaTime = Math.min(rawDeltaTime, 0.05);
    state.previousFrameTime = currentTime;

    if (state.isFinishingLights) {
        state.lightsDissipationProgress = Math.min(
            1,
            state.lightsDissipationProgress + deltaTime / CONFIG.lightsDissipationDuration
        );
    }

    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawLights(deltaTime);
    removeCompletedLights(state.lightsDissipationProgress * CONFIG.lightsDissipationDuration);
    drawBurstParticles(deltaTime);
    syncBackgroundWithLights();

    if (state.isFinishingLights) updateFinishBackground();
    finishIfComplete();
    requestAnimationFrame(animate);
}

// 고해상도 화면 배율에 맞춰 캔버스 크기를 설정합니다.
export function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(window.innerWidth * pixelRatio);
    canvas.height = Math.floor(window.innerHeight * pixelRatio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

// 캔버스 애니메이션 루프를 시작합니다.
export function startAnimation() {
    requestAnimationFrame(animate);
}

// 감정 가중치에 맞춰 빛을 만들고 최대 개수를 유지합니다.
export function createLightInstances(emotions) {
    const counts = distributeLightCounts(emotions);
    const additions = [];

    emotions.forEach((emotion, index) => {
        const focused = emotion.name === state.focusEmotion;
        const color = focused ? state.focusEmotionColor : emotion.color;
        const opacity = focused ? 1 : 0.2;

        for (let i = 0; i < counts[index]; i++) {
            additions.push(new Light(color, emotion.name, opacity));
        }
    });

    state.lights.push(...additions);
    if (state.lights.length > CONFIG.maxLights) {
        state.lights.splice(0, state.lights.length - CONFIG.maxLights);
    }
}

// 감정별 가중치에 따라 정해진 빛 개수를 나눕니다.
function distributeLightCounts(emotions) {
    if (emotions.length === 0) return [];

    const counts = Array(emotions.length).fill(1);
    const remaining = CONFIG.lightsPerResponse - emotions.length;
    if (remaining <= 0) return counts;

    const totalWeight = emotions.reduce((sum, emotion) => sum + emotion.weight, 0);
    const weights = totalWeight > 0
        ? emotions.map(emotion => emotion.weight / totalWeight)
        : emotions.map(() => 1 / emotions.length);
    const fractions = [];
    let assigned = 0;

    weights.forEach((weight, index) => {
        const exactShare = remaining * weight;
        const wholeShare = Math.floor(exactShare);
        counts[index] += wholeShare;
        assigned += wholeShare;
        fractions.push({ index, fraction: exactShare - wholeShare });
    });

    fractions.sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < remaining - assigned; i++) {
        counts[fractions[i].index]++;
    }

    return counts;
}

// 감정별 종료 모드를 설정하고 마무리 애니메이션을 시작합니다.
export function beginFinish() {
    clearTimeout(state.idleTimer);
    state.isFinishingLights = true;
    state.lightsDissipationProgress = 0;
    state.backgroundProgress = 0;
    state.finishTotalEnergy = state.lights.reduce(
        (energy, light) => energy + light.initialOpacity,
        0
    );
    state.burstParticles.length = 0;

    for (const light of state.lights) {
        const mode = light.emotion === state.focusEmotion ? "gather" : "escape";
        light.startFinishing(mode);
    }
}

// 빛과 배경 상태를 새 글쓰기 세션을 위해 초기화합니다.
export function resetLightScene() {
    state.lights.length = 0;
    state.burstParticles.length = 0;
    state.isFinishingLights = false;
    state.lightsDissipationProgress = 0;
    state.backgroundProgress = 0;
    state.finishTotalEnergy = 0;
    state.backgroundTone = { r: 5, g: 9, b: 20 };
    document.body.style.backgroundColor = "#050914";
    document.body.style.color = "#f4f5f7";
}
