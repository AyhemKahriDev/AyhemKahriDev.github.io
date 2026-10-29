<template>
    <div class="background _fullscreen">
        <!-- 这里的模糊小球用图片代替滤镜是为了适配safari浏览器，safari对于滤镜不太友好，大范围模糊容易卡顿 -->
        <div style="--s:1.5;--x:-0.1;--y:-0.3;--o:1">
            <img :src="require('@/assets/images/blurball.png')" alt="blurball" />
        </div>
        <div style="--s:1.3;--x:-0.05;--y:0.75;--o:1">
            <img :src="require('@/assets/images/blurball.png')" alt="blurball" />
        </div>
        <div style="--s:0.9;--x:0.7;--y:0;--o:0.8">
            <img :src="require('@/assets/images/blurball.png')" alt="blurball" />
        </div>
        <div style="--s:0.4;--x:0.88;--y:0.45;--o:0.6">
            <img :src="require('@/assets/images/blurball.png')" alt="blurball" />
        </div>
        <div style="--s:0.5;--x:0.6;--y:0.85;--o:0.7">
            <img :src="require('@/assets/images/blurball.png')" alt="blurball" />
        </div>
    </div>
</template>

<script setup>
import { onMounted } from "vue";
import gsap from "gsap";
// 背景控制对象
const background = {
    balls: null, //所有的背景移动小球
    mouse_x: 0, //坐标x
    mouse_y: 0, //坐标y
    distance_x: 0, //横向移动距离
    distance_y: 0, //竖向移动距离
    init() {
        this.balls = document.querySelectorAll(".background div");
        // 绑定监听事件
        document.addEventListener("mousemove", (e) => {
            this.move_balls(e.x, e.y);
        });
        document.addEventListener("touchmove", (e) => {
            this.move_balls(e.touches[0].clientX, e.touches[0].clientY);
        });
        document.addEventListener("mouseleave", (e) => {
            this.reset_balls();
        });
        document.addEventListener("touchend", (e) => {
            this.reset_balls();
        });
    },
    // 移动背景模糊小球
    move_balls(x, y) {
        // 防止大幅度抖动：例如在鼠标离开界面后再回来
        if (Math.abs(x - this.mouse_x) >= innerWidth / 10) this.mouse_x = x;
        if (Math.abs(y - this.mouse_y) >= innerHeight / 10) this.mouse_y = y;
        // 更新距离:将距离与屏幕尺寸绑定：避免不同尺寸下移动距离差异过大
        this.distance_x += ((x - this.mouse_x) / innerWidth) * 80;
        this.distance_y += ((y - this.mouse_y) / innerHeight) * 80;
        // 移动小球
        gsap.to(this.balls, {
            x: `${-this.distance_x}px`,
            y: `${-this.distance_y}px`,
            duration: 3,
            ease: "power3.out",
        });
        // 更新坐标
        this.mouse_x = x;
        this.mouse_y = y;
    },
    // 复位所有背景模糊小球
    reset_balls() {
        gsap.to(this.balls, {
            x: 0,
            y: 0,
            duration: 5,
            ease: "power3.out",
        });
        this.distance_x = this.distance_y = 0;
    },
};
onMounted(() => {
    background.init();
});
</script>

<style scoped>
.background {
    --scale: 1;
    pointer-events: none;
}
.background div {
    position: absolute;
    left: calc(100% * var(--x));
    top: calc(100% * var(--y));
    width: calc(var(--scale) * 50rem * var(--s));
    height: calc(var(--scale) * 50rem * var(--s));
    opacity: var(--o);
}
/* 黑暗模式下，小球亮了点，这里再减去一点透明度 */
._darkmode .background div {
    opacity: calc(var(--o) - 0.4);
}
.background div img {
    position: relative;
    width: 120%;
    height: 120%;
}
</style>