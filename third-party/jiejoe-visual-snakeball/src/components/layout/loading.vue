<template>
    <div class="loading _fullscreen" v-show="loading.if_visible.value">
        <svg viewBox="0 0 100 50" class="loading_icon">
            <path
                d="M50,25c0-12.14,9.84-21.99,21.99-21.99S93.98,12.86,93.98,25s-9.84,21.99-21.99,21.99S50,37.21,50,25.06
        S40.16,3.01,28.01,3.01S6.02,12.86,6.02,25s9.84,21.99,21.99,21.99S50,37.14,50,25c0-8.14,4.42-15.24,10.99-19.05
        C67.57,9.76,71.99,16.86,71.99,25c0,8.14-4.42,15.24-10.99,19.04c0,0,0,0,0,0c-3.23,1.87-6.99,2.94-10.99,2.94
        c-4.01,0-7.76-1.07-10.99-2.94h0C32.43,40.24,28.01,33.14,28.01,25c0-8.14,4.42-15.24,10.99-19.05l0,0
        C42.24,4.08,45.99,3.01,50,3.01s7.76,1.07,10.99,2.94l0,0"
            />
            <path
                d="M50,25c0-12.14,9.84-21.99,21.99-21.99S93.98,12.86,93.98,25s-9.84,21.99-21.99,21.99S50,37.21,50,25.06
        S40.16,3.01,28.01,3.01S6.02,12.86,6.02,25s9.84,21.99,21.99,21.99S50,37.14,50,25c0-8.14,4.42-15.24,10.99-19.05
        C67.57,9.76,71.99,16.86,71.99,25c0,8.14-4.42,15.24-10.99,19.04c0,0,0,0,0,0c-3.23,1.87-6.99,2.94-10.99,2.94
        c-4.01,0-7.76-1.07-10.99-2.94h0C32.43,40.24,28.01,33.14,28.01,25c0-8.14,4.42-15.24,10.99-19.05l0,0
        C42.24,4.08,45.99,3.01,50,3.01s7.76,1.07,10.99,2.94l0,0"
            />
        </svg>
        <div class="loading_mask"></div>
        <div class="loading_circle"></div>
        <p class="loading_tip _font_2" @click="store.first_show">START</p>
    </div>
</template>

<script setup>
import { global } from "@/stores/global";
import { onMounted, ref } from "vue";
import gsap from "gsap";
const store = global();
// 加载效果控制模块
const loading = {
    // DOM元素
    icon: null,
    paths: null,
    tip: null,
    circle: null,
    mask: null,
    // 动画播放器
    animater: null,
    if_visible: ref(true), //是否可见
    init() {
        this.icon = document.querySelector(".loading_icon");
        this.paths = [...document.querySelectorAll(".loading_icon path")];
        this.tip = document.querySelector(".loading_tip");
        this.circle = document.querySelector(".loading_circle");
        this.mask = document.querySelector(".loading_mask");
        // loading初始动画：小蛇循环划8
        this.animater = gsap.timeline().fromTo(
            this.paths,
            // 间隔开两端线条的描边偏移：使虚线线段呈现一个小蛇的样子
            {
                strokeDashoffset: (i) => {
                    if (i === 0) return 0;
                    else return 480;
                },
            },
            {
                strokeDashoffset: (i) => {
                    if (i === 0) return -275;
                    else return 205;
                },
                duration: 2,
                ease: "linear",
                onComplete: () => {
                    // 每播放完一次，检查一下加载状态，加载完成则执行完成动画，反之继续循环播放等待加载
                    if (document.readyState === "complete") this.finish();
                    else this.animater.restart();
                },
            }
        );
    },
    // 加载完成：小蛇变成一个球
    finish() {
        this.animater = gsap
            .timeline()
            // 动画的第一部分：蛇头缩放消失，蛇身虚线偏移成圆形，并汇聚成实线，整体缩小以适应一会儿出现的文字
            .to(this.paths[1], {
                strokeWidth: 0,
                duration: 0.4,
                ease: "power3.out",
            })
            .to(
                this.paths[0],
                {
                    strokeDashoffset: -300,
                    duration: 0.4,
                    ease: "power3.out",
                },
                "<"
            )
            .to(
                this.paths[0],
                {
                    strokeDasharray: "138 0 0 0 0 0 0 0 0 500",
                    duration: 0.7,
                    ease: "power3.out",
                },
                "<"
            )
            .to(
                this.icon,
                {
                    scale: 0.6,
                    duration: 0.7,
                    ease: "power3.out",
                },
                "<"
            )
            // 动画的第二部分：提示文字显示
            .to(
                this.tip,
                {
                    clipPath: "circle(100%)",
                    y: 0,
                    duration: 0.7,
                    ease: "power3.out",
                },
                "<0.3"
            )
            .to(
                this.circle,
                {
                    opacity: 1,
                    duration: 0.7,
                    ease: "power3.out",
                },
                "<"
            );
    },
    // 隐藏loading动画
    hidden(immediate, next) {
        // 动画播放器播放完后：才可以执行函数播放后续动画，否则会因为动画冲突导致BUG
        if (this.animater.isActive()) return;
        if (immediate) immediate(); //存在立即执行函数，则立即执行
        // 隐藏loading
        this.animater = gsap
            .timeline()
            .to(this.tip, {
                cursor: "auto",
                scale: 0,
                duration: 1,
                ease: "power3.out",
            })
            .to(
                this.mask,
                {
                    scale: 1,
                    duration: 2.5,
                    ease: "power3.out",
                    onComplete: () => {
                        this.if_visible.value = false; // 动画完成后，隐藏loading
                        if (next) next(); //如果有后续函数，则执行
                    },
                },
                "<"
            );
    },
};
// 储存全局功能函数
store.hidden_loading = loading.hidden.bind(loading);
onMounted(() => {
    loading.init();
});
</script>

<style scoped>
.loading {
    --scale: 1;
    justify-content: center;
    align-items: center;
    background-color: var(--color_front);
    mix-blend-mode: darken;
    z-index: 10000000;
}

.loading_icon {
    position: absolute;
    width: calc(var(--scale) * 35rem);
}

.loading_icon path {
    fill: none;
    stroke: var(--color_back);
    stroke-linecap: round;
}

.loading_icon path:nth-child(1) {
    stroke-width: 2;
    stroke-dasharray: 0 5 0 5 0 5 0 5 0 500;
}

.loading_icon path:nth-child(2) {
    stroke-width: 4;
    stroke-dasharray: 0 500 0 500;
    stroke-dashoffset: 480;
}
.loading_mask {
    position: absolute;
    width: 145vmax;
    height: 145vmax;
    border-radius: 100%;
    background-color: var(--color_back);
    transform: scale(0);
}
.loading_circle {
    position: absolute;
    width: calc(var(--scale) * 9.5rem);
    height: calc(var(--scale) * 9.5rem);
    border-radius: 100%;
    background-color: var(--color_back);
    opacity: 0;
}
.loading_tip {
    position: absolute;
    color: var(--color_front);
    transition: color 0.5s var(--ease_out);
    cursor: pointer;
    transform: translateY(50%);
    clip-path: circle(0%);
}
@media (hover: hover) {
    .loading_tip:hover {
        color: var(--color_gray);
    }
}
</style>