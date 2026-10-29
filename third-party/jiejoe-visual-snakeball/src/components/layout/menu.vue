<template>
    <div class="links" ref="links">
        <a href="https://github.com/JIEJOE-Visual/snakeball" target="_blank">
            <svg viewBox="0 0 24 24">
                <path
                    d="M12.5.75C6.146.75 1 5.896 1 12.25c0 5.089 3.292 9.387 7.863 10.91.575.101.79-.244.79-.546 
                    0-.273-.014-1.178-.014-2.142-2.889.532-3.636-.704-3.866-1.35-.13-.331-.69-1.352-1.18-1.625-.402-.216-.977-.748-.014-.762.906-.014 
                    1.553.834 1.769 1.179 1.035 1.74 2.688 1.25 3.349.948.1-.747.402-1.25.733-1.538-2.559-.287-5.232-1.279-5.232-5.678 
                    0-1.25.445-2.285 1.178-3.09-.115-.288-.517-1.467.115-3.048 0 0 .963-.302 3.163 1.179.92-.259 1.897-.388 2.875-.388.977 
                    0 1.955.13 2.875.388 2.2-1.495 3.162-1.179 3.162-1.179.633 1.581.23 2.76.115 3.048.733.805 1.179 1.825 1.179 3.09 0 
                    4.413-2.688 5.39-5.247 5.678.417.36.776 1.05.776 2.128 0 1.538-.014 2.774-.014 3.162 0 .302.216.662.79.547C20.709 
                    21.637 24 17.324 24 12.25 24 5.896 18.854.75 12.5.75Z"
                />
            </svg>
        </a>
        <a href="https://space.bilibili.com/3546390319860710" target="_blank">
            <svg viewBox="0 0 18 18">
                <path
                    d="M3.73252 2.67094C3.33229 2.28484 3.33229 1.64373 3.73252 1.25764C4.11291 0.890684 4.71552 0.890684 5.09591 
                    1.25764L7.21723 3.30403C7.27749 3.36218 7.32869 3.4261 7.37081 3.49407H10.5789C10.6211 3.4261 10.6723 3.36218 
                    10.7325 3.30403L12.8538 1.25764C13.2342 0.890684 13.8368 0.890684 14.2172 1.25764C14.6175 1.64373 14.6175 
                    2.28484 14.2172 2.67094L13.364 3.49407H14C16.2091 3.49407 18 5.28493 18 7.49407V12.9996C18 15.2087 16.2091 
                    16.9996 14 16.9996H4C1.79086 16.9996 0 15.2087 0 12.9996V7.49406C0 5.28492 1.79086 3.49407 4 3.49407H4.58579L3.73252 
                    2.67094ZM4 5.42343C2.89543 5.42343 2 6.31886 2 7.42343V13.0702C2 14.1748 2.89543 15.0702 4 15.0702H14C15.1046 
                    15.0702 16 14.1748 16 13.0702V7.42343C16 6.31886 15.1046 5.42343 14 5.42343H4ZM5 9.31747C5 8.76519 5.44772 
                    8.31747 6 8.31747C6.55228 8.31747 7 8.76519 7 9.31747V10.2115C7 10.7638 6.55228 11.2115 6 11.2115C5.44772 
                    11.2115 5 10.7638 5 10.2115V9.31747ZM12 8.31747C11.4477 8.31747 11 8.76519 11 9.31747V10.2115C11 10.7638 
                    11.4477 11.2115 12 11.2115C12.5523 11.2115 13 10.7638 13 10.2115V9.31747C13 8.76519 12.5523 8.31747 12 8.31747Z"
                />
            </svg>
        </a>
    </div>
    <div class="nav">
        <div class="nav_soundbtn" :class="{'nav_soundbtn_mute':if_mute}" @click="switch_mutemode">
            <p class="nav_soundbtn_tip _font_1">SOUND</p>
            <div class="nav_soundbtn_wave">
                <div style="--s:1;--d:1"></div>
                <div style="--s:1.5;--d:2"></div>
                <div style="--s:2;--d:3"></div>
            </div>
        </div>
        <svg
            class="nav_colorbtn"
            :class="{'nav_colorbtn_light':current_colormode==='light','nav_colorbtn_dark':current_colormode==='dark'}"
            viewBox="0 0 500 500"
            @click="switch_colormode"
        >
            <path
                class="nav_colorbtn_moon"
                d="M143.03,250c0,64.73,31.22,122.16,79.41,158.06v0.05c-87.33,0-158.12-70.79-158.12-158.12
		S135.12,91.88,222.44,91.88v0.05C174.25,127.84,143.03,185.27,143.03,250z"
            />
            <path class="nav_colorbtn_sun" d="M396.79,250c0,87.33-70.79,158.12-158.12,158.12V91.88C326,91.88,396.79,162.67,396.79,250z" />
            <path class="nav_colorbtn_sunline" d="M238.67,53c108.8,0,197,88.2,197,197s-88.2,197-197,197" />
        </svg>
    </div>
    <a class="copyright _font_1" href="https://www.jiejoe.com" target="_blank" ref="copyright">
        @2025.4.1
        <br />MAKE BY JIEJOE
    </a>
</template>

<script setup>
import { global } from "@/stores/global";
import { ref } from "vue";
import gsap from "gsap";
import { Howler } from "howler";
const store = global();
//当前的颜色模式：默认为light
const current_colormode = ref("light");
// 切换页面颜色模式
function switch_colormode() {
    document.querySelector("html").classList.toggle("_darkmode");
    current_colormode.value = current_colormode.value === "light" ? "dark" : "light";
}
//是否静音，默认为false
let if_mute = ref(false);
// 切换页面静音状态
function switch_mutemode() {
    if_mute.value = !if_mute.value;
    Howler.mute(if_mute.value);
}
// DOM元素
const links = ref(null);
const copyright = ref(null);
// 显示菜单
function show_menu() {
    links.value.classList.remove("_hidden");
    copyright.value.classList.remove("_hidden");
}
// 隐藏菜单
function hidden_menu() {
    links.value.classList.add("_hidden");
    copyright.value.classList.add("_hidden");
}
// 储存全局功能函数
store.show_menu = show_menu;
store.hidden_menu = hidden_menu;
</script>

<style scoped>
* {
    --scale: 1;
    z-index: 10000;
}
.links {
    position: fixed;
    left: var(--margin_x);
    top: var(--margin_y);
    transform: translateY(-50%);
    transition: opacity 1s var(--ease_out), visibility 1s var(--ease_out);
}
.links svg {
    height: calc(var(--scale) * 3rem);
    fill: var(--color_front);
    margin-right: calc(var(--scale) * 3rem);
    overflow: visible;
    transition: fill 0.5s var(--ease_out);
    cursor: pointer;
}
@media (hover: hover) {
    .links svg:hover {
        fill: var(--color_gray);
    }
}
.nav {
    flex-direction: row-reverse;
    position: fixed;
    align-items: center;
    right: var(--margin_x);
    top: var(--margin_y);
    transform: translateY(-50%);
}
.nav_soundbtn {
    justify-content: center;
    align-items: center;
    background-color: var(--color_front);
    border-radius: calc(var(--scale) * 2rem);
    padding: calc(var(--scale) * 1rem) calc(var(--scale) * 1.5rem);
    transition: background-color 0.5s var(--ease_out);
    cursor: pointer;
}
.nav_soundbtn_tip {
    color: var(--color_back);
    line-height: calc(var(--scale) * 1.5rem);
    margin-right: calc(var(--scale) * 0.6rem);
}
.nav_soundbtn_wave {
    align-items: center;
    height: calc(var(--scale) * 1.5rem);
    overflow: hidden;
    transition: height 0.5s var(--ease_out);
}
.nav_soundbtn_wave div {
    width: calc(var(--scale) * 0.5rem * var(--s));
    height: calc(var(--scale) * 0.5rem * var(--s));
    background-color: var(--color_back);
    border-radius: 100%;
    margin: 0 calc(var(--scale) * 0.4rem);
    animation: nav_soundbtn_wave 2s var(--ease_out) infinite calc(var(--d) * 0.2s);
}
@keyframes nav_soundbtn_wave {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.5);
    }
    100% {
        transform: scale(1);
    }
}
@media (hover: hover) {
    .nav_soundbtn:hover {
        background-color: var(--color_gray);
    }
}
.nav_soundbtn_mute .nav_soundbtn_wave {
    height: calc(var(--scale) * 0.25rem);
}
.nav_soundbtn_mute .nav_soundbtn_wave div {
    animation-play-state: paused;
}
.nav_colorbtn {
    width: calc(var(--scale) * 3.8rem);
    height: calc(var(--scale) * 3.8rem);
    margin-right: calc(var(--scale) * 3rem);
    cursor: pointer;
}
.nav_colorbtn_moon,
.nav_colorbtn_sun,
.nav_colorbtn_sunline {
    transition: fill 0.5s var(--ease_out), stroke 0.5s var(--ease_out);
}
.nav_colorbtn_moon {
    fill: var(--color_front);
}
.nav_colorbtn_sun {
    fill: var(--color_front);
}
.nav_colorbtn_sunline {
    fill: none;
    stroke: var(--color_front);
    stroke-width: 25;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 0, 70;
    animation: nav_colorbtn_sunline 0.1s linear infinite;
}
@keyframes nav_colorbtn_sunline {
    0% {
        stroke-dashoffset: 0;
    }
    100% {
        stroke-dashoffset: -70;
    }
}
.nav_colorbtn_light .nav_colorbtn_moon {
    fill: var(--color_gray);
}

@media (hover: hover) {
    .nav_colorbtn_light:hover .nav_colorbtn_moon {
        fill: var(--color_front);
    }
}
.nav_colorbtn_dark .nav_colorbtn_sun {
    fill: var(--color_gray);
}
.nav_colorbtn_dark .nav_colorbtn_sunline {
    stroke: var(--color_gray);
}

@media (hover: hover) {
    .nav_colorbtn_dark:hover .nav_colorbtn_sun {
        fill: var(--color_front);
    }
    .nav_colorbtn_dark:hover .nav_colorbtn_sunline {
        stroke: var(--color_front);
    }
}

.copyright {
    position: fixed;
    left: var(--margin_x);
    bottom: var(--margin_y);
    line-height: calc(var(--scale) * 2rem);
    color: var(--color_front);
    text-decoration: none;
    transition: opacity 1s var(--ease_out), visibility 1s var(--ease_out),
        color 0.5s var(--ease_out);
    transform: translateY(50%);
}
@media (hover: hover) {
    .copyright:hover {
        color: var(--color_gray);
    }
}
</style>