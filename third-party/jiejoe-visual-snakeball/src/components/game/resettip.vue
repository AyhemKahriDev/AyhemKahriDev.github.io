<template>
    <div class="resettip _fullscreen">
        <div class="resettip_circle"></div>
        <div class="resettip_circle"></div>
        <div class="resettip_circle"></div>
    </div>
</template>

<script setup>
import gsap from "gsap";
import { onMounted } from "vue";
let circles; //所有的圆环DOM元素
// 重置：短暂显示圆环，并消失
function reset() {
    gsap.fromTo(
        circles,
        {
            scale: 0,
            opacity: 1,
        },
        {
            scale: 1,
            opacity: 0,
            duration: 1,
            stagger: 0.1,
            ease: "power3.inOut",
        }
    );
}
// 将重置函数提供给stage
defineExpose({ reset });
onMounted(() => {
    circles = document.querySelectorAll(".resettip_circle");
});
</script>

<style scoped>
.resettip {
    --scale: 1;
    justify-content: center;
    align-items: center;
    pointer-events: none;
}
.resettip_circle {
    position: absolute;
    width: 100vmax;
    height: 100vmax;
    border-radius: 50%;
    border: calc(var(--scale) * 0.5rem) var(--color_front) solid;
    transform: scale(0);
}
</style>