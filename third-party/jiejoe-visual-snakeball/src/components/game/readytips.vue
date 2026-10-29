<template>
    <div class="readytips _fullscreen">
        <div class="readytips_wave readytips_textbox">
            <p class="_font_5">
                WAVE
                <span class="_font_5">{{player.wave}}</span>
            </p>
        </div>
        <div class="readytips_ready readytips_textbox">
            <p class="_font_5">
                YOU
                <span class="_font_5">READY?</span>
            </p>
        </div>
        <div class="readytips_start readytips_textbox">
            <p class="_font_5">
                <span class="_font_5">BUMP</span> UP!!
            </p>
        </div>
    </div>
</template>

<script setup>
import { global } from "@/stores/global";
import { onMounted, defineExpose } from "vue";
import gsap from "gsap";
const player = global().player;
let tip_texts; //所有提示文字的DOM元素
// 准备提示：显示准备信息
function ready(immediate, next) {
    if (immediate) immediate(); //存在立即执行代码，则立即执行
    gsap.timeline()
        // 复位所有提示文字
        .set(tip_texts, {
            y: "100%",
        })
        // 展示第一段提示文字,并隐藏
        .to(tip_texts[0], {
            y: "0%",
            duration: 0.5,
            ease: "power3.out",
        })
        .to(
            tip_texts[0],
            {
                y: "-100%",
                duration: 0.5,
                ease: "power3.out",
            },
            "+=0.5" //让文字停留0.5秒多一点
        )
        // 展示第二段提示文字,并隐藏
        .to(
            tip_texts[1],
            {
                y: "0%",
                duration: 0.5,
                ease: "power3.out",
            },
            "<"
        )
        .to(
            tip_texts[1],
            {
                y: "-100%",
                duration: 0.5,
                ease: "power3.out",
            },
            "+=0.5"
        )
        // 展示第三段提示文字,并隐藏
        .to(
            tip_texts[2],
            {
                y: "0%",
                duration: 0.5,
                ease: "power3.out",
            },
            "<"
        )
        .to(
            tip_texts[2],
            {
                y: "-100%",
                duration: 0.5,
                ease: "power3.out",
                // 这里如果设置为最后一段文字完全隐藏之后、才执行next的话，会有一段缓动带来的空白间隙
                // 为了流畅度，所以设置为刚开始播放最后一部分动画的时候，就执行next
                onStart: () => {
                    if (next) next(); //存在后续代码，则执行
                },
            },
            "+=0.5"
        );
}
// 将准备函数提供给stage
defineExpose({ ready });
onMounted(() => {
    tip_texts = [...document.querySelectorAll(".readytips_textbox p")];
});
</script>

<style scoped>
.readytips {
    --scale: 1;
    position: absolute;
    justify-content: center;
    align-items: center;
    pointer-events: none;
}
.readytips > div {
    position: absolute;
}
.readytips P {
    font-family: title;
    color: var(--color_gray);
    white-space: nowrap;
    line-height: calc(var(--scale) * 10rem);
    transform: translateY(100%);
}
.readytips span {
    font-family: title;
    color: var(--color_front);
}
.readytips_textbox {
    overflow: hidden;
}
</style>