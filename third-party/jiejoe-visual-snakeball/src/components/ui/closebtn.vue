<template>
    <div class="closebtn" :class="{'closebtn_reverse':if_reverse}">
        <div class="closebtn_part" style="--a:0deg">
            <div></div>
        </div>
        <div class="closebtn_part" style="--a:90deg">
            <div></div>
        </div>
        <div class="closebtn_part" style="--a:180deg">
            <div></div>
        </div>
        <div class="closebtn_part" style="--a:270deg">
            <div></div>
        </div>
    </div>
</template>

<script setup>
//是否翻转颜色
const props = defineProps({ if_reverse: Boolean });
const if_reverse = props.if_reverse;
</script>

<style scoped>
.closebtn {
    --scale: 1;
    --color: var(--color_back);
    position: relative;
    justify-content: center;
    align-items: center;
    width: calc(var(--scale) * 5rem);
    height: calc(var(--scale) * 5rem);
    cursor: pointer;
}
/* 反转颜色 */
.closebtn_reverse {
    --color: var(--color_front);
}
.closebtn_part {
    position: absolute;
    width: calc(var(--scale) * 1.9rem);
    height: calc(var(--scale) * 1.9rem);
    transform-origin: center;
    transform: rotate(var(--a));
}
.closebtn_part div {
    position: absolute;
    left: 0;
    top: 0;
    width: calc(var(--scale) * 0.8rem);
    height: calc(var(--scale) * 0.8rem);
    border-radius: 100%;
    background-color: var(--color);
    transform-origin: right bottom;
    transition: transform 0.5s var(--ease_out);
}
.closebtn_part div::after {
    content: "";
    position: absolute;
    left: calc(var(--scale) * -1rem);
    top: calc(var(--scale) * -1rem);
    width: calc(var(--scale) * 1rem);
    height: calc(var(--scale) * 1rem);
    border-radius: 100%;
    background-color: var(--color);
    transform-origin: right bottom;
    transition: transform 0.5s var(--ease_out);
}
@media (hover: hover) {
    .closebtn:hover .closebtn_part div {
        transform: scale(0.6);
    }
    .closebtn:hover .closebtn_part div::after {
        transform: scale(1.8);
    }
}
</style>