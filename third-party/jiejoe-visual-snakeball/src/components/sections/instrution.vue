<template>
    <div class="instrution _fullscreen" v-show="instrution.if_visible.value">
        <svg viewBox="0 0 50 50" class="instrution_circle">
            <circle class="_dashed" cx="25" cy="25" r="25" vector-effect="non-scaling-stroke" />
        </svg>
        <svg viewBox="0 0 50 2" class="instrution_line">
            <line class="_dashed" x1="0" y1="1" x2="50" y2="1" vector-effect="non-scaling-stroke" />
        </svg>
        <svg viewBox="0 0 50 2" class="instrution_line instrution_line_vertical">
            <line class="_dashed" x1="0" y1="1" x2="50" y2="1" vector-effect="non-scaling-stroke" />
        </svg>
        <div class="instrution_ball _middle_ball"></div>
        <div class="instrution_images">
            <div style="--l:0%;--t:0%">
                <I1 />
            </div>
            <div style="--r:0%;--t:0%">
                <I2 />
            </div>
            <div style="--l:0%;--b:0%">
                <I3 />
            </div>
            <div style="--r:0%;--b:0%">
                <I4 />
            </div>
        </div>
        <div class="instrution_closebtn" @click="instrution.hidden">
            <Closebtn :if_reverse="true" />
        </div>
    </div>
</template>

<script setup>
import { global } from "@/stores/global";
import I1 from "@/components/instrutions/i1.vue";
import I2 from "@/components/instrutions/i2.vue";
import I3 from "@/components/instrutions/i3.vue";
import I4 from "@/components/instrutions/i4.vue";
import Closebtn from "@/components/ui/closebtn.vue";
import { onMounted, ref } from "vue";
import gsap from "gsap";
const store = global();
// instrution控制对象
const instrution = {
    // DOM元素
    container: null,
    circle: null,
    lines: null,
    images: null,
    //动画播放器
    animater: null,
    if_visible: ref(false), //instrution是否可见
    init() {
        this.container = document.querySelector(".instrution");
        this.circle = document.querySelector(".instrution_circle");
        this.lines = document.querySelectorAll(".instrution_line");
        this.images = document.querySelectorAll(".instrution_images div");
    },
    // 重置instrution动画样式
    reset() {
        gsap.timeline()
            .set(this.container, {
                clipPath: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)",
            })
            .set(this.circle, {
                scale: 0,
            })
            .set(this.lines, {
                clipPath: "polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)",
            })
            .set(this.images, {
                clipPath: "circle(0%)",
                x: "-20%",
            });
    },
    // 显示instrution
    show(immediate) {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        if (immediate) immediate(); //存在立即执行代码，则立即执行
        this.reset(); //重置
        this.if_visible.value = true; //显示instrution
        // 播放动画
        this.animater = gsap
            .timeline()
            .to(this.container, {
                clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
                duration: 1,
                ease: "power3.inOut",
            })
            .to(
                this.circle,
                {
                    scale: 1,
                    duration: 1.5,
                    ease: "power3.out",
                },
                "<0.5"
            )
            .to(
                this.lines,
                {
                    clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
                    duration: 1.5,
                    ease: "power3.out",
                },
                "<"
            )
            .to(
                this.images,
                {
                    clipPath: "circle(100%)",
                    x: 0,
                    duration: 1.5,
                    ease: "power3.out",
                    stagger: 0.05,
                },
                "<0.4"
            );
    },
    // 隐藏instrution
    hidden() {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        // 播放动画
        this.animater = gsap.to(this.container, {
            clipPath: "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)",
            duration: 1,
            ease: "power3.inOut",
            onComplete: () => {
                this.if_visible.value = false; // 隐藏instrution
            },
        });
    },
};
// 储存全局功能函数
store.show_instrution = () => {
    // 这里将按钮音效播放放在show函数内部，是为了避免多次点击而多次播放音效的BUG
    instrution.show(() => {
        store.audio_controller.button.play();
    });
};
onMounted(() => {
    instrution.init();
});
</script>

<style  scoped>
.instrution {
    --scale: 1;
    justify-content: center;
    align-items: center;
    background-color: var(--color_back);
    z-index: 1000;
}
.instrution_circle {
    position: absolute;
    width: calc(var(--scale) * 85rem);
    height: calc(var(--scale) * 85rem);
    stroke: var(--color_front);
    stroke-dasharray: 0 calc(var(--scale) * 1rem);
    overflow: visible;
}
.instrution_line {
    position: absolute;
    width: 100vmax;
    stroke: var(--color_front);
    stroke-dasharray: 0 calc(var(--scale) * 1rem);
    overflow: visible;
}
.instrution_line_vertical {
    transform: rotate(90deg);
}
.instrution_ball {
    position: absolute;
    background-color: var(--color_back);
    border: calc(var(--scale) * 0.3rem) solid var(--color_front);
    background-image: linear-gradient(0deg, transparent 1.9rem, var(--color_front) 2rem),
        linear-gradient(90deg, transparent 1.9rem, var(--color_front) 2rem);
    background-size: 2rem 2rem;
}
.instrution_images {
    position: absolute;
    width: calc(var(--scale) * 110rem);
    height: calc(var(--scale) * 65rem);
}
.instrution_images div {
    position: absolute;
    justify-content: center;
    align-items: center;
    left: var(--l);
    top: var(--t);
    right: var(--r);
    bottom: var(--b);
    width: calc(var(--scale) * 3.2rem * 16);
    height: calc(var(--scale) * 3.2rem * 9);
    background-color: var(--color_front);
    cursor: pointer;
    overflow: hidden;
}
.instrution_images div svg {
    position: relative;
    width: 100%;
    transform: scale(1.1);
    transition: transform 1s var(--ease_out);
}
@media (hover: hover) {
    .instrution_images div:hover svg {
        transform: scale(1);
    }
}
.instrution_closebtn {
    position: absolute;
}
@media screen and (max-aspect-ratio: 0.7/1) {
    .instrution_images {
        flex-direction: column;
        align-items: center;
        width: auto;
        height: auto;
    }
    .instrution_images div {
        position: relative;
        left: auto;
        top: auto;
        right: auto;
        bottom: auto;
        margin: calc(var(--scale) * 5rem) 0;
    }
}
@media screen and (max-aspect-ratio: 0.6/1) {
    .instrution_images div {
        width: calc(var(--scale) * 4rem * 16);
        height: calc(var(--scale) * 4rem * 9);
    }
}
</style>