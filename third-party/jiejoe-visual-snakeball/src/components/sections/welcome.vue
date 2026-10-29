<template>
    <div class="weclome _fullscreen" :class="{'_hidden':!welcome.if_visible.value}">
        <div class="weclome_middle">
            <div class="weclome_middle_title">
                <div>
                    <p class="_font_6" v-for="letter in 'SNAKE'" :key="letter">{{letter}}</p>
                </div>
                <div>
                    <p class="_font_6" v-for="letter in 'BALL'" :key="letter">{{letter}}</p>
                </div>
            </div>
            <p class="weclome_middle_info _font_3">Let's bump up! dodge, bump, reset, and score!</p>
            <!-- safari浏览器对css的filter适配不友好，这里检测到如果是safari浏览器，则取消滤镜融球效果 -->
            <div class="weclome_middle_balls" :class="{'weclome_middle_balls_filter':!store.if_safari}">
                <div class="weclome_middle_balls_big _middle_ball"></div>
                <div class="weclome_middle_balls_small" style="--s:1"></div>
                <div class="weclome_middle_balls_small" style="--s:1.5"></div>
                <div class="weclome_middle_balls_small" style="--s:1.2"></div>
            </div>
            <svg class="weclome_middle_line" viewBox="0 0 50 50">
                <circle class="_dashed" cx="25" cy="25" r="25" vector-effect="non-scaling-stroke" />
            </svg>
        </div>
        <div class="welcome_nav">
            <svg class="welcome_nav_line" viewBox="0 0 50 50">
                <circle class="_dashed" cx="25" cy="25" r="25" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="welcome_nav_selection" style="--i:0">
                <div class="wns_node" @click="store.welcome_to_start">
                    <div></div>
                    <p class="_font_2">NEW GAME</p>
                </div>
            </div>
            <div class="welcome_nav_selection" style="--i:1">
                <div class="wns_node" @click="store.welcome_continue_game" :class="{'wns_unclickable':!player.if_active}">
                    <div></div>
                    <p class="_font_2">CONTINUE</p>
                </div>
            </div>
            <div class="welcome_nav_selection" style="--i:2">
                <div class="wns_node" @click="store.show_rank">
                    <div></div>
                    <p class="_font_2">RANK</p>
                </div>
            </div>
            <div class="welcome_nav_selection" style="--i:3">
                <div class="wns_node" @click="store.show_instrution">
                    <div></div>
                    <p class="_font_2">INSTRUTION</p>
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
// welcome控制对象
const welcome = {
    // DOM元素
    container: null,
    middle: null,
    title: null,
    bigball: null,
    smallballs: null,
    line: null,
    balls: null,
    title_letters: null,
    nav: null,
    info: null,
    // 小球能够移动的最大距离
    max_distance: 0,
    animater: null, //动画播放器
    if_visible: ref(false), //welcome是否可见
    init() {
        this.container = document.querySelector(".weclome");
        this.middle = document.querySelector(".weclome_middle");
        this.title = document.querySelector(".weclome_middle_title");
        this.bigball = document.querySelector(".weclome_middle_balls_big");
        this.smallballs = document.querySelectorAll(".weclome_middle_balls_small");
        this.line = document.querySelector(".weclome_middle_line");
        this.balls = document.querySelector(".weclome_middle_balls");
        this.title_letters = document.querySelectorAll(".weclome_middle_title p");
        this.nav = document.querySelector(".welcome_nav");
        this.info = document.querySelector(".weclome_middle_info");
        window.addEventListener("resize", this.resize.bind(this));
        this.resize();
        this.binded_events();
    },
    resize() {
        // 小球的移动范围局限在大球的周围
        this.max_distance = this.bigball.offsetWidth / 2.5;
    },
    // 绑定相关事件
    binded_events() {
        // 在界面范围内：标题文字跟随鼠标/手指偏移
        this.container.onmousemove = (e) => {
            this.move_title(e.x, e.y);
        };
        this.container.ontouchmove = (e) => {
            this.move_title(e.touches[0].clientX, e.touches[0].clientY);
        };
        // 移动结束后，让标题回到原位，即屏幕中心点
        this.container.onmouseout = (e) => {
            this.move_title(innerWidth / 2, innerHeight / 2);
        };
        this.container.ontouchend = (e) => {
            this.move_title(innerWidth / 2, innerHeight / 2);
        };
        // 在靠近中间内容的范围内：小球跟随鼠标/手指偏移，形成融球效果
        this.middle.onmousemove = (e) => {
            this.move_smallballs(e.x, e.y);
        };
        this.middle.ontouchmove = (e) => {
            this.move_smallballs(e.touches[0].clientX, e.touches[0].clientY);
        };
        // 移动结束后，让小球回到原位，即屏幕中心点
        this.middle.onmouseout = (e) => {
            this.move_smallballs(innerWidth / 2, innerHeight / 2);
        };
        this.middle.ontouchend = (e) => {
            this.move_smallballs(innerWidth / 2, innerHeight / 2);
        };
    },
    // 移动标题文字
    move_title(x, y) {
        // 更新距离:以屏幕中心为基准。将距离与屏幕尺寸绑定：避免不同尺寸下移动距离差异过大
        let distance_x = ((x - innerWidth / 2) / innerWidth) * 40;
        let distance_y = ((y - innerHeight / 2) / innerHeight) * 40;
        // 移动标题
        gsap.to(this.title, {
            x: `${distance_x}px`,
            y: `${distance_y}px`,
            duration: 3,
            ease: "power3.out",
        });
    },
    // 移动小球
    move_smallballs(x, y) {
        // 更新距离:以屏幕中心为基准
        let distance_x = x - innerWidth / 2;
        let distance_y = y - innerHeight / 2;
        // 限制移动边界
        distance_x = Math.min(this.max_distance, Math.max(-this.max_distance, distance_x));
        distance_y = Math.min(this.max_distance, Math.max(-this.max_distance, distance_y));
        // 移动小球
        gsap.to(this.smallballs, {
            x: `${distance_x}px`,
            y: `${distance_y}px`,
            duration: 1,
            ease: "power3.out",
            stagger: 0.1,
        });
    },
    // 重置welcome动画样式
    reset() {
        gsap.timeline()
            .set(this.line, {
                scale: 0,
                opacity: 1,
            })
            .set(this.balls, {
                scale: 0,
                opacity: 1,
            })
            .set(this.title_letters, {
                clipPath: "circle(0%)",
                y: "50%",
            })
            .set([this.nav, this.info], {
                opacity: 0,
            });
        this.nav.classList.remove("welcome_nav_show");
    },
    // 显示welcome
    show() {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        this.reset(); //重置
        this.if_visible.value = true; // 显示welcome
        // 播放动画
        this.animater = gsap
            .timeline()
            .to(this.line, {
                scale: 1,
                duration: 1.5,
                ease: "power3.inOut",
            })
            .to(
                this.balls,
                {
                    scale: 1,
                    duration: 1.5,
                    ease: "power3.inOut",
                },
                "<0.3"
            )
            .to(
                this.title_letters,
                {
                    clipPath: "circle(100%)",
                    y: 0,
                    duration: 0.8,
                    ease: "power3.out",
                    stagger: {
                        each: 0.05,
                        from: "random",
                    },
                },
                "<0.8"
            )
            .to(
                [this.nav, this.info],
                {
                    opacity: 1,
                    duration: 1.2,
                    ease: "power3.out",
                    onStart: () => {
                        // nav选项栏因为要适应不同尺寸以旋转，所以不能直接用gsap控制，否则无法响应旋转角度
                        // 这里只能用类名控制，welcome_nav_show会根据不同尺寸而通过媒体查询改变角度
                        this.nav.classList.add("welcome_nav_show");
                    },
                },
                "<"
            );
    },
    // 隐藏welcome
    hidden(immediate, next) {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        if (immediate) immediate(); //存在立即执行代码，则立即执行
        // 播放动画
        this.animater = gsap
            .timeline()
            .to(this.line, {
                opacity: 0,
                duration: 0.8,
                ease: "power3.out",
            })
            .to(
                this.balls,
                {
                    opacity: 0,
                    duration: 0.8,
                    ease: "power3.out",
                },
                "<"
            )
            .to(
                this.title_letters,
                {
                    clipPath: "circle(0%)",
                    y: "-50%",
                    duration: 0.5,
                    ease: "power3.out",
                    stagger: {
                        each: 0.03,
                        from: "random",
                    },
                },
                "<"
            )
            .to(
                [this.nav, this.info],
                {
                    opacity: 0,
                    duration: 0.8,
                    ease: "power3.out",
                    onComplete: () => {
                        this.if_visible.value = false; //隐藏welcome
                        if (next) next(); //如果有后续函数，则执行
                    },
                },
                "<"
            );
    },
};
// 储存全局功能函数
store.show_welcome = welcome.show.bind(welcome);
store.hidden_welcome = welcome.hidden.bind(welcome);
onMounted(() => {
    welcome.init();
});
</script>

<style scoped>
.weclome {
    --scale: 1;
    justify-content: center;
    align-items: center;
}
.weclome_middle {
    position: relative;
    justify-content: center;
    align-items: center;
    width: calc(var(--scale) * 82rem);
    height: calc(var(--scale) * 55rem);
}
.weclome_middle_title {
    flex-direction: column;
    position: absolute;
    color: var(--color_white);
    mix-blend-mode: exclusion;
    z-index: 10;
}
.weclome_middle_title > div:nth-child(1) {
    margin-right: calc(var(--scale) * 15rem);
}
.weclome_middle_title > div:nth-child(2) {
    justify-content: end;
    margin-left: calc(var(--scale) * 15rem);
}
.weclome_middle_title p {
    font-family: title;
    line-height: calc(var(--scale) * 17rem);
}
.weclome_middle_info {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 40%;
    color: var(--color_white);
    line-height: calc(var(--scale) * 3.5rem);
    mix-blend-mode: exclusion;
    z-index: 10;
}
.weclome_middle_balls {
    position: absolute;
    justify-content: center;
    align-items: center;
    width: calc(var(--scale) * 85rem);
    height: calc(var(--scale) * 85rem);
}

.weclome_middle_balls div {
    position: absolute;
}
.weclome_middle_balls_filter {
    filter: contrast(1000%);
    background-color: var(--color_back);
    mix-blend-mode: var(--mix);
}
.weclome_middle_balls_filter div {
    filter: blur(calc(var(--scale) * 3rem));
}

.weclome_middle_balls_small {
    width: calc(var(--scale) * 15rem * var(--s));
    height: calc(var(--scale) * 15rem * var(--s));
    background-color: var(--color_front);
    border-radius: 100%;
}
.weclome_middle_line {
    position: absolute;
    width: calc(var(--scale) * 66rem);
    overflow: visible;
}
.weclome_middle_line circle {
    stroke: var(--color_front);
    stroke-dasharray: 0 calc(var(--scale) * 2rem);
    transform-origin: center;
    animation: welcome_line_rotate 8s linear infinite;
}
.welcome_nav {
    /* 整个选项框显示前的旋转度数 */
    --before_rotate: 45deg;
    /* 整个选项框显示后的旋转度数 */
    --after_rotate: 0deg;
    /* 每一个选项的间隔旋转度数 */
    --interval_rotate: 12deg;
    /* 每一个选项屏幕比例修改后的修正旋转度数 */
    --correct_rotate: 0deg;
    position: absolute;
    justify-content: center;
    align-items: center;
    width: calc(var(--scale) * 135rem);
    height: calc(var(--scale) * 135rem);
    transform: rotate(var(--before_rotate));
    pointer-events: none;
}
.welcome_nav_show {
    transform: rotate(var(--after_rotate));
    transition: transform 1.2s var(--ease_out);
}

.welcome_nav_line {
    position: absolute;
    width: 100%;
    overflow: visible;
    animation: welcome_line_rotate 15s linear infinite;
}
.welcome_nav_line circle {
    stroke: var(--color_front);
    stroke-dasharray: 0 calc(var(--scale) * 2rem);
}
.welcome_nav_selection {
    position: absolute;
    width: 100%;
    height: 100%;
    justify-content: center;
    align-items: center;
    transform-origin: center;
    transform: rotate(calc(var(--interval_rotate) * var(--i)));
}

.wns_node {
    position: absolute;
    align-items: center;
    left: 99.7%;
    height: calc(var(--scale) * 7rem);
    transform-origin: left;
    transform: rotate(calc(var(--interval_rotate) * var(--i) * -1 - var(--correct_rotate)));
    pointer-events: all;
    cursor: pointer;
}

.wns_node div {
    position: relative;
    justify-content: center;
    align-items: center;
    width: calc(var(--scale) * 1rem);
    height: calc(var(--scale) * 1rem);
    background-color: var(--color_front);
    border-radius: 100%;
    margin-right: calc(var(--scale) * 1rem);
}
.wns_node div::after {
    content: "";
    position: absolute;
    width: 200%;
    height: 200%;
    border: calc(var(--scale) * 0.05rem) solid var(--color_front);
    border-radius: 100%;
    transform: scale(0);
    transition: transform 0.5s var(--ease_out);
}
.wns_node p {
    align-self: end;
    color: var(--color_front);
    white-space: nowrap;
    transition: transform 0.5s var(--ease_out);
}
.wns_unclickable {
    pointer-events: none;
    cursor: auto;
}
.wns_unclickable div {
    background-color: var(--color_gray);
}
.wns_unclickable p {
    color: var(--color_gray);
}
@media (hover: hover) {
    .wns_node:hover div::after {
        transform: scale(1);
    }
    .wns_node:hover p {
        transform: translateX(5%);
    }
}
@keyframes welcome_line_rotate {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
@media screen and (max-aspect-ratio: 1/1) {
    .welcome_nav {
        --interval_rotate: 25deg;
        --before_rotate: 5deg;
        --after_rotate: 60deg;
        --correct_rotate: 60deg;
        width: calc(var(--scale) * 135rem * 0.9);
        height: calc(var(--scale) * 135rem * 0.9);
    }
    .wns_node {
        left: 100%;
    }
}
</style>