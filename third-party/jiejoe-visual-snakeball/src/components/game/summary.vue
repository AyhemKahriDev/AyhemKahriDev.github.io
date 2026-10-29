<template>
    <div class="summary _fullscreen" v-show="summary.if_visible.value">
        <!-- safari浏览器对css的filter适配不友好，这里检测到如果是safari浏览器，则取消滤镜融球效果 -->
        <div class="summary_background" :class="{'summary_background_filter':!store.if_safari}">
            <div class="summary_background_ball _middle_ball"></div>
            <div class="summary_background_ballbox" style="--s:1;--a:45;">
                <div class="summary_background_ball"></div>
            </div>
            <div class="summary_background_ballbox" style="--s:1.2;--a:60;">
                <div class="summary_background_ball"></div>
            </div>
            <div class="summary_background_ballbox" style="--s:1.5;--a:180;">
                <div class="summary_background_ball"></div>
            </div>
            <div class="summary_background_ballbox" style="--s:1.3;--a:315;">
                <div class="summary_background_ball"></div>
            </div>
        </div>
        <div class="summary_inner">
            <div class="summary_inner_result">
                <div class="summary_gray">
                    <p class="_font_6">YOU</p>
                </div>
                <div>
                    <p class="_font_6">{{player.if_active?'LIVE!':'DEAD!'}}</p>
                </div>
            </div>
            <div class="summary_inner_score">
                <div class="summary_gray">
                    <p class="_font_4">SCORE</p>
                </div>
                <div>
                    <p class="_font_4">{{player.score}}</p>
                </div>
            </div>
            <div class="summary_inner_selections">
                <div @click="store.summary_continue_game">
                    <p class="_font_4">{{player.if_active?'CONTINUE':'TRY AGAIN'}}</p>
                </div>
                <div @click="store.show_rank">
                    <p class="_font_4">RANK</p>
                </div>
                <div @click="store.summary_to_welcome">
                    <p class="_font_4">HOME</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { global } from "@/stores/global";
import { onMounted, ref } from "vue";
import gsap from "gsap";
const store = global();
const player = store.player;
// summary控制对象
const summary = {
    // DOM元素
    inner_texts: null,
    balls: null,
    animater: null, //动画播放器
    if_visible: ref(false), //summary是否可见
    init() {
        this.inner_texts = [...document.querySelectorAll(".summary_inner p")];
        this.balls = document.querySelectorAll(".summary_background_ball");
    },
    // 重置summary动画样式
    reset() {
        gsap.set(this.inner_texts, {
            y: "100%",
            visibility: "hidden", // 防止在出现前、按钮就可以被点击
        });
    },
    // 显示summary
    show() {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        this.reset(); //重置
        this.if_visible.value = true; //显示summary
        // 播放动画
        this.animater = gsap
            .timeline()
            .to(this.balls, {
                scale: 1,
                duration: 1,
                ease: "power3.inOut",
                stagger: 0.1,
            })
            // 第一部分文字出现、并消失
            .to(
                [this.inner_texts[0], this.inner_texts[1]],
                {
                    y: "0%",
                    visibility: "visible", // 按钮出现、可以被点击
                    duration: 0.5,
                    ease: "power3.out",
                    stagger: 0.1,
                },
                "<0.6"
            )
            .to(
                [this.inner_texts[0], this.inner_texts[1]],
                {
                    y: "-100%",
                    duration: 0.5,
                    ease: "power3.out",
                    stagger: 0.1,
                },
                "+=0.3"
            )
            // 第二部分文字出现、并消失
            .to(
                [this.inner_texts[2], this.inner_texts[3]],
                {
                    y: "0%",
                    visibility: "visible",
                    duration: 0.5,
                    ease: "power3.out",
                    stagger: 0.1,
                },
                "<0.4"
            )
            .to(
                [this.inner_texts[2], this.inner_texts[3]],
                {
                    y: "-100%",
                    duration: 0.5,
                    ease: "power3.out",
                    stagger: 0.1,
                },
                "+=0.3"
            )
            // 第三部分文字出现
            .to(
                [this.inner_texts[4], this.inner_texts[5], this.inner_texts[6]],
                {
                    y: "0%",
                    visibility: "visible",
                    duration: 0.5,
                    ease: "power3.out",
                    stagger: 0.1,
                },
                "<0.4"
            );
    },
    // 隐藏summary
    hidden(immediate, next) {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        if (immediate) immediate(); //存在立即执行代码，则立即执行
        // 播放动画
        this.animater = gsap
            .timeline()
            .to(this.balls, {
                scale: 0,
                duration: 1,
                ease: "power3.out",
                onComplete: () => {
                    this.if_visible.value = false; //隐藏summary
                    if (next) next(); //如果有后续步骤则执行
                },
            })
            .to(
                [this.inner_texts[4], this.inner_texts[5], this.inner_texts[6]],
                {
                    y: "-100%",
                    duration: 0.5,
                    ease: "power3.out",
                    stagger: 0.1,
                },
                "<"
            );
    },
};
// 储存全局功能函数
store.hidden_summary = summary.hidden.bind(summary);
// 将show方法提供给stage，这里不和hidden方法一样储存到全局、是因为只有在stage里面才会调用show方法
defineExpose({ show: summary.show.bind(summary) });
onMounted(() => {
    summary.init();
});
</script>

<style scoped>
.summary {
    --scale: 1;
    justify-content: center;
    align-items: center;
}
.summary_background {
    position: absolute;
    justify-content: center;
    align-items: center;
    width: calc(var(--scale) * 100rem);
    height: calc(var(--scale) * 100rem);
}
.summary_background_ball {
    transform: scale(0);
}
.summary_background_ballbox {
    position: absolute;
    width: calc(var(--scale) * 60rem);
    height: calc(var(--scale) * 60rem);
    animation: summary_background_ballbox calc(var(--s) * 5s) linear infinite;
}
@keyframes summary_background_ballbox {
    0% {
        transform: rotate(calc(var(--a) * 1deg));
    }
    100% {
        transform: rotate(calc(var(--a) * 1deg + 360deg));
    }
}
.summary_background_filter {
    filter: contrast(1000%);
    background-color: var(--color_back);
    mix-blend-mode: var(--mix);
}
.summary_background_filter .summary_background_ballbox {
    filter: blur(calc(var(--scale) * 3rem));
}
.summary_background_ballbox div {
    position: absolute;
    width: calc(var(--scale) * 8rem * var(--s));
    height: calc(var(--scale) * 8rem * var(--s));
    background-color: var(--color_front);
    border-radius: 50%;
}
.summary_inner {
    position: absolute;
    justify-content: center;
    align-items: center;
}
.summary_inner > div {
    position: absolute;
    flex-direction: column;
    align-items: center;
}
.summary_inner > div div {
    overflow: hidden;
}
.summary_inner p {
    color: var(--color_back);
    white-space: nowrap;
}
.summary_gray p {
    color: var(--color_gray);
}
.summary_inner_result p {
    font-family: title;
    line-height: calc(var(--scale) * 17rem);
}
.summary_inner_result div:nth-child(1) {
    margin-left: calc(var(--scale) * -30rem);
}
.summary_inner_result div:nth-child(2) {
    margin-right: calc(var(--scale) * -18rem);
    mix-blend-mode: exclusion;
}
.summary_inner_result div:nth-child(2) p {
    color: var(--color_white);
}
.summary_inner_score div,
.summary_inner_selections div {
    margin-bottom: calc(var(--scale) * 4.5rem);
}
.summary_inner_score div:last-child,
.summary_inner_selections div:last-child {
    margin-bottom: 0;
}
.summary_inner_selections p {
    cursor: pointer;
    transition: color 0.5s var(--ease_out);
}
@media (hover: hover) {
    .summary_inner_selections p:hover {
        color: var(--color_gray);
    }
}
</style>