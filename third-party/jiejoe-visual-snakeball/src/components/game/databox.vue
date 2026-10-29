<template>
    <div class="databox _fullscreen _hidden" ref="databox">
        <p class="wave _font_2">
            WAVE:
            <span class="_font_2">{{player.wave}}</span>
        </p>
        <p class="score _font_2">
            SCORE:
            <span class="_font_2">{{player.score}}</span>
        </p>
        <div class="info">
            <div class="info_lives">
                <svg class="info_lives_icon" viewBox="0 0 655 500">
                    <circle cx="187.74" cy="182.92" r="167.7" />
                    <circle cx="466.86" cy="182.92" r="167.7" />
                    <circle cx="327.3" cy="316.34" r="167.7" />
                </svg>
                <span class="_font_2">{{player.lives}}</span>
            </div>
            <div class="info_time">
                <svg class="info_time_icon" viewBox="0 0 350 500">
                    <path d="M11.66,483.55c0-90.13,73.07-163.2,163.2-163.2s163.2,73.07,163.2,163.2H11.66z" />
                    <path d="M338.06,16.2c0,90.13-73.07,163.2-163.2,163.2S11.66,106.33,11.66,16.2H338.06z" />
                    <circle cx="174.86" cy="120" r="39.78" />
                </svg>
                <span class="_font_2">{{player.time}}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { global } from "@/stores/global";
import { ref } from "vue";
const store = global();
const player = store.player;
// DOM元素
const databox = ref(null);
// 显示数据信息
function show_databox() {
    databox.value.classList.remove("_hidden");
}
// 显示数据信息
function hidden_databox() {
    databox.value.classList.add("_hidden");
}
// 储存全局功能函数
store.show_databox = show_databox;
store.hidden_databox = hidden_databox;
</script>

<style scoped>
.databox {
    --scale: 1;
    align-items: center;
    justify-content: center;
    z-index: 100000;
    transition: opacity 1s var(--ease_out), visibility 1s var(--ease_out);
    pointer-events: none;
}
p {
    color: var(--color_gray);
}
span {
    color: var(--color_front);
}
.wave {
    position: fixed;
    left: var(--margin_x);
    top: var(--margin_y);
    transform: translateY(-50%);
}
.score {
    position: fixed;
    left: var(--margin_x);
    bottom: var(--margin_y);
    transform: translateY(50%);
}
.info {
    position: fixed;
    top: var(--margin_y);
    transform: translateY(-50%);
}
.info > div {
    align-items: center;
}
.info svg {
    height: calc(var(--scale) * 2.5rem);
    margin-right: calc(var(--scale) * 1.5rem);
}
.info_lives {
    margin-right: calc(var(--scale) * 4rem);
}

.info_lives_icon circle {
    fill: #0ee515;
}
.info_lives_icon circle:nth-child(1) {
    animation: info_lives_icon_circle1 3s var(--ease_out) infinite;
}
.info_lives_icon circle:nth-child(2) {
    animation: info_lives_icon_circle2 3s var(--ease_out) infinite;
}
.info_lives_icon circle:nth-child(3) {
    animation: info_lives_icon_circle3 3s var(--ease_out) infinite;
}
@keyframes info_lives_icon_circle1 {
    0% {
        transform: translate(0%, 0%); /* 初始位置 */
    }
    33.3% {
        transform: translate(42.6%, 0%); /* 移动到 (466.86, 182.92) */
    }
    66.6% {
        transform: translate(21.3%, 26.7%); /* 移动到 (327.3, 316.34) */
    }
    100% {
        transform: translate(0%, 0%); /* 返回到起始位置 */
    }
}

@keyframes info_lives_icon_circle2 {
    0% {
        transform: translate(0%, 0%); /* 初始位置 */
    }
    33.3% {
        transform: translate(-21.3%, 26.7%); /* 移动到 (327.3, 316.34) */
    }
    66.6% {
        transform: translate(-42.6%, 0%); /* 移动到 (187.74, 182.92) */
    }
    100% {
        transform: translate(0%, 0%); /* 返回到起始位置 */
    }
}
@keyframes info_lives_icon_circle3 {
    0% {
        transform: translate(0%, 0%); /* 初始位置 */
    }
    33.3% {
        transform: translate(-21.3%, -26.7%); /* 移动到 (187.74, 182.92) */
    }
    66.6% {
        transform: translate(21.3%, -26.7%); /* 移动到 (466.86, 182.92) */
    }
    100% {
        transform: translate(0%, 0%); /* 返回到起始位置 */
    }
}

.info_time_icon path {
    fill: var(--color_front);
}
.info_time_icon circle {
    fill: var(--color_front);
    transform-origin: center;
    animation: info_time_icon 1s var(--ease_out) infinite;
}
@keyframes info_time_icon {
    0% {
        transform: translateY(0);
    }
    80% {
        transform: translateY(60%);
    }
    100% {
        transform: translateY(60%);
    }
}
</style>