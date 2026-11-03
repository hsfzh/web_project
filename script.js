import { initializeUI } from "./js/ui.js";
import { startAnimation } from "./js/lights.js";

// 화면 이벤트와 캔버스 애니메이션을 시작합니다.
initializeUI();
startAnimation();

const backgroundMusic = document.getElementById("background-music");
backgroundMusic.volume = 0.35;

function startBackgroundMusic() {
    backgroundMusic.play().then(() => {
        ["pointerdown", "keydown", "touchstart"].forEach(type => {
            document.removeEventListener(type, startBackgroundMusic);
        });
    }).catch(() => {
        // Browsers may block autoplay until the first user interaction.
    });
}

["pointerdown", "keydown", "touchstart"].forEach(type => {
    document.addEventListener(type, startBackgroundMusic);
});
startBackgroundMusic();
