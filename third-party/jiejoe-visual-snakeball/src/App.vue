<template>
    <Background />
    <Stage />
    <Welcome />
    <Start />
    <Instrution />
    <Rank />
    <Menu />
    <Loading />
</template>
<script setup>
// sections
import Welcome from "@/components/sections/welcome.vue";
import Start from "@/components/sections/start.vue";
import Instrution from "@/components/sections/instrution.vue";
import Rank from "@/components/sections/rank.vue";
// layout
import Background from "@/components/layout/background.vue";
import Menu from "@/components/layout/menu.vue";
import Loading from "@/components/layout/loading.vue";
// game
import Stage from "@/components/game/stage.vue";
</script>
<style>
/* 全局设置 */
* {
    margin: 0;
    padding: 0;
    /* 全局缩放控制 */
    font-size: 1vmin;
    font-family: content;
    /* 颜色 */
    --color_black: #080808;
    --color_white: #f8f8f8;
    --color_gray: #8b8b8b;
    /* 缓动曲线 */
    --ease_out: cubic-bezier(0.25, 0.85, 0.3, 1);
    /* 球内的竖向间距 */
    --margin_ball_y: calc(var(--scale) * 5rem);
    --margin_x: calc(var(--scale) * 9rem);
    --margin_y: calc(var(--scale) * 9rem);
}
/* 默认为light亮色模式 */
html {
    /* 前景色 */
    --color_front: var(--color_black);
    /* 背景色 */
    --color_back: var(--color_white);
    /* 混合模式 */
    --mix: darken;
}
/* 暗色模式：对调前景背景色 */
._darkmode {
    --color_front: var(--color_white);
    --color_back: var(--color_black);
    --mix: lighten;
}

p {
    user-select: none;
}

img {
    pointer-events: none;
    user-select: none;
}

div {
    display: flex;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}

body {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100dvh;
    background-color: var(--color_back);
    overflow: hidden;
}

::-webkit-scrollbar {
    display: none;
}

/* 字号 */
._font_1 {
    font-size: calc(var(--scale) * 1.5rem);
}
._font_2 {
    font-size: calc(var(--scale) * 1.8rem);
}
._font_3 {
    font-size: calc(var(--scale) * 2.5rem);
}
._font_4 {
    font-size: calc(var(--scale) * 3.2rem);
}
._font_5 {
    font-size: calc(var(--scale) * 11.5rem);
}
._font_6 {
    font-size: calc(var(--scale) * 18rem);
}

/* 字体 */
@font-face {
    font-family: title;
    src: url(~@/assets/fonts/EricaOne-Regular.ttf);
}
@font-face {
    font-family: content;
    src: url(~@/assets/fonts/RammettoOne-Regular.ttf);
}


/* 响应式 */
/* vmin */
@media screen and (max-aspect-ratio: 1.7/1) {
    * {
        font-size: 0.96vmin;
    }
}
@media screen and (max-aspect-ratio: 1.6/1) {
    * {
        font-size: 0.9vmin;
    }
}
@media screen and (max-aspect-ratio: 1.5/1) {
    * {
        font-size: 0.84vmin;
    }
}
@media screen and (max-aspect-ratio: 1.4/1) {
    * {
        font-size: 0.78vmin;
    }
}
@media screen and (max-aspect-ratio: 1.3/1) {
    * {
        font-size: 0.72vmin;
    }
}
@media screen and (max-aspect-ratio: 1.2/1) {
    * {
        font-size: 0.66vmin;
    }
}
@media screen and (max-aspect-ratio: 1.1/1) {
    * {
        font-size: 0.6vmin;
    }
}
/* vmax */
@media screen and (max-aspect-ratio: 1/1) {
    * {
        font-size: 0.6vmax;
    }
}
@media screen and (max-aspect-ratio: 0.8/1) {
    * {
        font-size: 0.52vmax;
    }
}
@media screen and (max-aspect-ratio: 0.6/1) {
    * {
        font-size: 0.44vmax;
    }
}
@media screen and (max-aspect-ratio: 0.5/1) {
    * {
        font-size: 0.4vmax;
    }
}

/* 复用类名 */
/* 全屏 */
._fullscreen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
}
/* 中间球样式 */
._middle_ball {
    width: calc(var(--scale) * 55rem);
    height: calc(var(--scale) * 55rem);
    border-radius: 100%;
    background-color: var(--color_front);
}
/* 虚线 */
._dashed {
    fill: none;
    stroke-width: calc(var(--scale) * 0.2rem);
    stroke-linecap: round;
}
/* 专为visibility设置的隐藏类：有些元素如果使用display来设置隐藏的话，内部元素没法获取定位属性 */
._hidden {
    visibility: hidden;
    opacity: 0;
}
</style>
