<template>
    <div class="start _fullscreen" v-show="start.if_visible.value">
        <div class="start_background">
            <svg class="start_background_line" viewBox="0 0 50 50">
                <circle class="_dashed" cx="25" cy="25" r="25" vector-effect="non-scaling-stroke" />
            </svg>
            <svg class="start_background_line" viewBox="0 0 50 50">
                <circle class="_dashed" cx="25" cy="25" r="25" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="start_background_ball _middle_ball"></div>
        </div>
        <div class="start_inner">
            <p class="start_usetip _font_2" @click="store.show_instrution">HOW TO PLAY?</p>
            <div class="start_inputbox">
                <input class="start_inputbox_input _font_4" type="text" placeholder="INPUT YOUR NAME" v-model="start.input_text.value" />
                <div class="start_inputbox_background">
                    <div class="start_inputbox_background_balls">
                        <div>
                            <div v-for="index in 15" :key="index"></div>
                        </div>
                        <div>
                            <div v-for="index in 15" :key="index"></div>
                        </div>
                    </div>
                </div>
            </div>
            <p class="start_startbtn _font_1" @click="start.check_input">
                — Click the
                <span class="_font_1">Enter key</span> to start —
            </p>
            <div class="start_closebtn" @click="store.start_to_welcome">
                <Closebtn />
            </div>
        </div>
    </div>
</template>

<script setup>
import { global } from "@/stores/global";
import Closebtn from "@/components/ui/closebtn.vue";
import { onMounted, ref } from "vue";
import gsap from "gsap";
const store = global();
const player = store.player;
// start控制对象
const start = {
    // DOM元素
    container: null,
    inputbox: null,
    background: null,
    usetip: null,
    closebtn: null,
    ball: null,
    input: null,
    //输入框文字
    input_text: ref(""),
    max_text_length: 14, //最大可输入字符长度
    animater: null, //动画播放器
    if_visible: ref(false), //start是否可见
    init() {
        this.container = document.querySelector(".start");
        this.inputbox = document.querySelector(".start_inputbox");
        this.background = document.querySelector(".start_background");
        this.usetip = document.querySelector(".start_usetip");
        this.closebtn = document.querySelector(".start_closebtn");
        this.ball = document.querySelector(".start_background_ball");
        this.input = document.querySelector(".start_inputbox_input");
        // 监听键盘按键
        this.input.addEventListener("keyup", (e) => {
            // 裁剪限制字符数
            if (this.input_text.value.length > this.max_text_length)
                this.input_text.value = this.input_text.value.slice(0, this.max_text_length);
            // 点击enter，检查输入框是否进入游戏
            else {
                if (e.keyCode == 13) this.check_input();
            }
        });
    },
    // 检查输入框内容
    check_input() {
        // 规范输入内容：玩家可能用特殊方式更改输入内容，故在检查之前再裁剪一下
        this.input_text.value = this.input_text.value.slice(0, this.max_text_length);
        let input_text = this.input_text.value.trim();
        // 检查输入框内容规范后是否为空字符
        if (input_text.length) {
            // 不为空则初始化玩家信息，开始游戏
            store.init_player_data(input_text);
            store.start_new_game();
        } else {
            // 为空则进行提示
            this.input_text.value = ""; //清空输入框
            store.audio_controller.warn.play(); //播放警示音
            // 小球警示样式
            gsap.timeline()
                .set(this.ball, {
                    backgroundColor: "#b80808",
                })
                .set(
                    this.ball,
                    {
                        backgroundColor: "",
                    },
                    "<0.8"
                );
        }
    },
    // 重置start动画样式
    reset() {
        gsap.timeline()
            .set(this.container, {
                scale: 1,
            })
            .set(this.inputbox, {
                clipPath: "circle(0%)",
            })
            .set(this.background, {
                opacity: 0,
            })
            .set(this.usetip, {
                transform: "translateY(-50%)",
                opacity: 0,
            })
            .set(this.closebtn, {
                transform: "translateY(50%)",
                opacity: 0,
            });
    },
    // 显示start
    show() {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        this.reset(); //重置
        this.if_visible.value = true; // 显示start
        // 播放动画
        this.animater = gsap
            .timeline()
            .to(this.inputbox, {
                clipPath: "circle(100%)",
                duration: 1.5,
                ease: "power3.out",
            })
            .to(
                this.background,
                {
                    opacity: 1,
                    duration: 1,
                    ease: "power3.out",
                },
                "<"
            )
            .to(
                [this.usetip, this.closebtn],
                {
                    transform: "translateY(0%)",
                    opacity: 1,
                    duration: 1,
                    ease: "power3.out",
                },
                "<"
            );
    },
    // 隐藏start
    hidden(immediate, next) {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        if (immediate) immediate(); //存在立即执行代码，则立即执行
        // 播放动画
        this.animater = gsap.to(this.container, {
            scale: 0,
            duration: 0.8,
            ease: "power3.inOut",
            onComplete: () => {
                this.input_text.value = ""; //清空输入框
                this.if_visible.value = false; // 隐藏start
                if (next) next(); //存在后续代码，则执行
            },
        });
    },
};
// 储存全局功能函数
store.show_start = start.show.bind(start);
store.hidden_start = start.hidden.bind(start);
onMounted(() => {
    start.init();
});
</script>

<style scoped>
.start {
    --scale: 1;
    justify-content: center;
    align-items: center;
}
.start_background {
    position: absolute;
    justify-content: center;
    align-items: center;
}

.start_background_line {
    position: absolute;
    width: calc(var(--scale) * 50rem);
    overflow: visible;
    animation: start_background_line 2s var(--ease_out) infinite;
}
.start_background .start_background_line:nth-child(2) {
    animation-delay: 1s;
}
@keyframes start_background_line {
    0% {
        transform: scale(1) rotate(0);
    }
    50% {
        transform: scale(1.3) rotate(45deg);
    }
    100% {
        transform: scale(1) rotate(0);
    }
}
.start_background_line circle {
    stroke: var(--color_front);
    stroke-dasharray: 0 calc(var(--scale) * 1rem);
}
.start_background_ball {
    position: absolute;
    background-color: var(--color_front);
    filter: blur(calc(var(--scale) * 0.8rem));
}
.start_inner {
    flex-direction: column;
    position: absolute;
    justify-content: center;
    align-items: center;
    width: calc(var(--scale) * 55rem);
    height: calc(var(--scale) * 55rem);
}
.start_usetip {
    position: absolute;
    top: var(--margin_ball_y);
    color: var(--color_back);
    transition: color 0.5s var(--ease_out);
    cursor: pointer;
}
@media (hover: hover) {
    .start_usetip:hover {
        color: var(--color_gray);
    }
}
.start_inputbox {
    position: relative;
    justify-content: center;
    align-items: center;
    width: 100%;
}
.start_inputbox_input {
    position: absolute;
    text-align: center;
    width: 80%;
    color: var(--color_back);
    background-color: #0000;
    outline: none;
    border: none;
}
.start_inputbox_background {
    position: absolute;
    width: 100%;
    height: calc(var(--scale) * 15rem);
    mask-image: linear-gradient(0deg, #000, #0000 30%, #0000 70%, #000);
    pointer-events: none;
}
.start_inputbox_background_balls {
    position: absolute;
    justify-content: end;
    align-items: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
    mask-image: linear-gradient(90deg, #0000, #000000 30%, #000000 70%, #0000);
    opacity: 0.3;
    transition: opacity 0.5s var(--ease_out);
}
.start_inputbox_background_balls > div {
    animation: start_inputbox_background_balls 2s linear infinite;
}
.start_inputbox_background_balls > div div {
    width: calc(var(--scale) * 14rem);
    height: calc(var(--scale) * 14rem);
    border-radius: 100%;
    border: calc(var(--scale) * 0.1rem) var(--color_back) solid;
    margin-right: calc(var(--scale) * -10rem);
}
@media (hover: hover) {
    .start_inputbox:hover .start_inputbox_background_balls {
        opacity: 1;
    }
}
@keyframes start_inputbox_background_balls {
    0% {
        transform: translateX();
    }
    100% {
        transform: translateX(100%);
    }
}
.start_startbtn {
    position: absolute;
    color: var(--color_gray);
    transform: translateY(400%);
    transition: color 0.5s var(--ease_out);
    cursor: pointer;
}
.start_startbtn span {
    color: var(--color_back);
}
@media (hover: hover) {
    .start_startbtn:hover {
        color: var(--color_back);
    }
}
.start_closebtn {
    position: absolute;
    bottom: var(--margin_ball_y);
}
</style>