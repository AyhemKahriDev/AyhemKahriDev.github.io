"use strict";
// Audio recordings are optional. Transcripts are included; no unverified MP3 is distributed.
const VOICE_CLIPS = {
  "intro-2": {
    url: null,
    duration: 3.09,
    text: "哎呀，小桥断了。一起修好它吧！",
  },
  "intro-3": {
    url: null,
    duration: 2.987,
    text: "听，青蛙在打鼓！你也来试试。",
  },
  "intro-0": {
    url: null,
    duration: 3.547,
    text: "咦，小灯还没亮呢。我们叫醒萤火虫吧！",
  },
  "intro-1": {
    url: null,
    duration: 2.533,
    text: "豆豆要出发啦，帮它划划小船吧！",
  },
  "intro-5": {
    url: null,
    duration: 2.126,
    text: "天黑啦，我们把灯塔点亮吧！",
  },
  "intro-4": {
    url: null,
    duration: 2.523,
    text: "风来啦！让小风筝飞起来吧。",
  },
  "intro-7": {
    url: null,
    duration: 2.033,
    text: "看，向日葵在找太阳呢！",
  },
  "intro-6": {
    url: null,
    duration: 2.519,
    text: "小种子睡醒啦，帮它钻出泥土吧。",
  },
  "intro-8": {
    url: null,
    duration: 2.694,
    text: "小花渴啦。让风车转起来吧！",
  },
  "intro-9": {
    url: null,
    duration: 2.354,
    text: "嗡嗡嗡，小蜜蜂要去采蜜啦！",
  },
  "intro-10": {
    url: null,
    duration: 2.89,
    text: "苹果熟啦！接住，别让它掉地上。",
  },
  "intro-11": {
    url: null,
    duration: 2.632,
    text: "彩虹还差一点颜色，我们来帮忙！",
  },
  "intro-12": {
    url: null,
    duration: 2.722,
    text: "包裹准备好啦，让气球带它出发吧！",
  },
  "intro-13": {
    url: null,
    duration: 2.526,
    text: "小火车等着呢，给它装上车轮吧！",
  },
  "intro-14": {
    url: null,
    duration: 2.639,
    text: "啵！小鱼想吹一串大泡泡。",
  },
  "intro-15": {
    url: null,
    duration: 2.842,
    text: "雪花飘来啦，做一枚雪花印章吧！",
  },
  "intro-16": {
    url: null,
    duration: 2.744,
    text: "星星藏在哪儿呢？转转望远镜吧。",
  },
  "intro-17": {
    url: null,
    duration: 2.311,
    text: "小猫的信来啦，帮忙送到家吧！",
  },
  "intro-19": {
    url: null,
    duration: 2.76,
    text: "咔哒，装好齿轮，小钟就会走啦！",
  },
  "intro-18": {
    url: null,
    duration: 2.709,
    text: "叮叮咚咚，我们一起弹首曲子吧！",
  },
  "intro-20": {
    url: null,
    duration: 2.501,
    text: "火箭要出发啦，给它加点能量吧！",
  },
  "intro-21": {
    url: null,
    duration: 2.451,
    text: "星星迷路啦，帮它们连在一起吧！",
  },
  "intro-23": {
    url: null,
    duration: 2.228,
    text: "把你的音乐，装进小唱片吧！",
  },
  "intro-22": {
    url: null,
    duration: 1.946,
    text: "滴答滴答，听听雨点的歌！",
  },
  "intro-24": {
    url: null,
    duration: 2.347,
    text: "咕嘟咕嘟，小汤锅等你加料呢！",
  },
  "intro-25": {
    url: null,
    duration: 2.633,
    text: "蛋糕做好啦，挤上漂亮的糖霜吧！",
  },
  "intro-26": {
    url: null,
    duration: 2.635,
    text: "饼干上的字母错啦，我们来修一修。",
  },
  "intro-27": {
    url: null,
    duration: 2.345,
    text: "朋友们饿啦，把午餐送过去吧！",
  },
  "intro-31": {
    url: null,
    duration: 2.437,
    text: "机器人还没醒，帮它装好零件吧！",
  },
  "intro-30": {
    url: null,
    duration: 2.324,
    text: "咕噜噜，去海底找找新朋友吧！",
  },
  "intro-28": {
    url: null,
    duration: 2.033,
    text: "面包鼓起来啦，香喷喷的！",
  },
  "intro-29": {
    url: null,
    duration: 2.43,
    text: "灯笼准备好啦，一盏一盏点亮吧！",
  },
  "intro-33": {
    url: null,
    duration: 2.234,
    text: "写封小短信，告诉朋友你来啦！",
  },
  "intro-32": {
    url: null,
    duration: 2.106,
    text: "这颗小星球，还没有名字呢。",
  },
  "intro-34": {
    url: null,
    duration: 2.312,
    text: "朋友们到齐啦，音乐会开始！",
  },
  "intro-35": {
    url: null,
    duration: 2.624,
    text: "星光号准备好啦，一起去看新世界！",
  },
  "key-B": {
    url: null,
    duration: 0.883,
    text: "找找，B。",
  },
  "key-A": {
    url: null,
    duration: 0.894,
    text: "找找，A。",
  },
  "key-D": {
    url: null,
    duration: 0.835,
    text: "找找，D。",
  },
  "key-C": {
    url: null,
    duration: 0.946,
    text: "找找，C。",
  },
  "key-F": {
    url: null,
    duration: 0.938,
    text: "找找，F。",
  },
  "key-E": {
    url: null,
    duration: 0.863,
    text: "找找，E。",
  },
  "key-G": {
    url: null,
    duration: 0.874,
    text: "找找，G。",
  },
  "key-H": {
    url: null,
    duration: 1.101,
    text: "找找，H。",
  },
  "key-I": {
    url: null,
    duration: 0.89,
    text: "找找，I。",
  },
  "key-J": {
    url: null,
    duration: 0.928,
    text: "找找，J。",
  },
  "key-K": {
    url: null,
    duration: 0.921,
    text: "找找，K。",
  },
  "key-L": {
    url: null,
    duration: 0.959,
    text: "找找，L。",
  },
  "key-M": {
    url: null,
    duration: 1.049,
    text: "找找，M。",
  },
  "key-N": {
    url: null,
    duration: 0.926,
    text: "找找，N。",
  },
  "key-P": {
    url: null,
    duration: 0.965,
    text: "找找，P。",
  },
  "key-O": {
    url: null,
    duration: 1.02,
    text: "找找，O。",
  },
  "key-Q": {
    url: null,
    duration: 0.973,
    text: "找找，Q。",
  },
  "key-R": {
    url: null,
    duration: 1.044,
    text: "找找，R。",
  },
  "key-S": {
    url: null,
    duration: 1.118,
    text: "找找，S。",
  },
  "key-T": {
    url: null,
    duration: 0.989,
    text: "找找，T。",
  },
  "key-U": {
    url: null,
    duration: 1.003,
    text: "找找，U。",
  },
  "key-V": {
    url: null,
    duration: 0.861,
    text: "找找，V。",
  },
  "key-W": {
    url: null,
    duration: 1.044,
    text: "找找，W。",
  },
  "key-X": {
    url: null,
    duration: 1.214,
    text: "找找，X。",
  },
  "key-Y": {
    url: null,
    duration: 0.968,
    text: "找找，Y。",
  },
  "key-Z": {
    url: null,
    duration: 1.01,
    text: "找找，Z。",
  },
  "key-0": {
    url: null,
    duration: 0.701,
    text: "数字零。",
  },
  "key-1": {
    url: null,
    duration: 0.611,
    text: "数字一。",
  },
  "key-3": {
    url: null,
    duration: 0.652,
    text: "数字三。",
  },
  "key-2": {
    url: null,
    duration: 0.592,
    text: "数字二。",
  },
  "key-5": {
    url: null,
    duration: 0.655,
    text: "数字五。",
  },
  "key-4": {
    url: null,
    duration: 0.712,
    text: "数字四。",
  },
  "key-8": {
    url: null,
    duration: 0.593,
    text: "数字八。",
  },
  "key-6": {
    url: null,
    duration: 0.592,
    text: "数字六。",
  },
  "key-9": {
    url: null,
    duration: 0.642,
    text: "数字九。",
  },
  "key-7": {
    url: null,
    duration: 0.722,
    text: "数字七。",
  },
  "key-SPACE": {
    url: null,
    duration: 1.388,
    text: "拇指，按空格。",
  },
  "key-ENTER": {
    url: null,
    duration: 1.39,
    text: "按回车，送出去！",
  },
  "key-BACKSPACE": {
    url: null,
    duration: 1.59,
    text: "按退格，删掉它。",
  },
  "key-semicolon": {
    url: null,
    duration: 1.045,
    text: "找找，分号。",
  },
  "key-comma": {
    url: null,
    duration: 0.975,
    text: "找找，逗号。",
  },
  "key-period": {
    url: null,
    duration: 0.96,
    text: "找找，句号。",
  },
  "key-slash": {
    url: null,
    duration: 1.013,
    text: "找找，斜杠。",
  },
  "shift-left": {
    url: null,
    duration: 2.661,
    text: "左手按住 Shift，右手按字母。",
  },
  "shift-right": {
    url: null,
    duration: 2.562,
    text: "右手按住 Shift，左手按字母。",
  },
  hands: {
    url: null,
    duration: 3.88,
    text: "食指摸摸小凸起。左手 F，右手 J。",
  },
  "win-0": {
    url: null,
    duration: 1.437,
    text: "哇，真的做到了！",
  },
  "win-1": {
    url: null,
    duration: 1.881,
    text: "完成啦！宝藏是你的！",
  },
  "win-2": {
    url: null,
    duration: 1.709,
    text: "看，这是你亲手做的！",
  },
  "win-map": {
    url: null,
    duration: 2.17,
    text: "找到了！一片新的星图！",
  },
  sample: {
    url: null,
    duration: 3.443,
    text: "你好呀！我是豆豆。一起去小岛玩吧！",
  },
  "intro-39": {
    url: null,
    duration: 2.004,
    text: "装好小信封，一起试试吧！",
  },
  "intro-36": {
    url: null,
    duration: 1.916,
    text: "找到恐龙蛋，一起试试吧！",
  },
  "intro-38": {
    url: null,
    duration: 1.851,
    text: "发现小河，一起试试吧！",
  },
  "intro-37": {
    url: null,
    duration: 1.73,
    text: "找到嫩草，一起试试吧！",
  },
  "intro-40": {
    url: null,
    duration: 2.332,
    text: "找到第一串脚印，一起试试吧！",
  },
  "intro-42": {
    url: null,
    duration: 2.118,
    text: "装好雪橇板，一起试试吧！",
  },
  "intro-41": {
    url: null,
    duration: 2.006,
    text: "邀请小恐龙，一起试试吧！",
  },
  "intro-43": {
    url: null,
    duration: 2.402,
    text: "铺好亮晶晶的冰，一起试试吧！",
  },
  "intro-46": {
    url: null,
    duration: 2.086,
    text: "和小熊打招呼，一起试试吧！",
  },
  "intro-44": {
    url: null,
    duration: 1.857,
    text: "找到小帽子，一起试试吧！",
  },
  "intro-47": {
    url: null,
    duration: 2.369,
    text: "砌好雪白城墙，一起试试吧！",
  },
  "intro-45": {
    url: null,
    duration: 2.237,
    text: "收集透明冰晶，一起试试吧！",
  },
  "intro-49": {
    url: null,
    duration: 2.216,
    text: "准备彩色糖果，一起试试吧！",
  },
  "intro-48": {
    url: null,
    duration: 2.309,
    text: "搅出白白糖丝，一起试试吧！",
  },
  "intro-51": {
    url: null,
    duration: 2.282,
    text: "倒入彩色果冻，一起试试吧！",
  },
  "intro-50": {
    url: null,
    duration: 2.084,
    text: "烤好小饼干，一起试试吧！",
  },
  "intro-53": {
    url: null,
    duration: 2.005,
    text: "包好一颗糖，一起试试吧！",
  },
  "intro-52": {
    url: null,
    duration: 2.114,
    text: "摆好甜甜圈，一起试试吧！",
  },
  "intro-55": {
    url: null,
    duration: 2.394,
    text: "松开第一块泥土，一起试试吧！",
  },
  "intro-54": {
    url: null,
    duration: 2.501,
    text: "请第一只小鸡排队，一起试试吧！",
  },
  "intro-57": {
    url: null,
    duration: 2.271,
    text: "收好金色稻谷，一起试试吧！",
  },
  "intro-56": {
    url: null,
    duration: 2.124,
    text: "和奶牛打招呼，一起试试吧！",
  },
  "intro-58": {
    url: null,
    duration: 2.204,
    text: "把南瓜放上秤，一起试试吧！",
  },
  "intro-59": {
    url: null,
    duration: 2.141,
    text: "摆出苹果摊，一起试试吧！",
  },
  "intro-60": {
    url: null,
    duration: 2.256,
    text: "展开藏宝地图，一起试试吧！",
  },
  "intro-61": {
    url: null,
    duration: 2.226,
    text: "听鹦鹉指左边，一起试试吧！",
  },
  "intro-62": {
    url: null,
    duration: 2.026,
    text: "摘下几颗椰子，一起试试吧！",
  },
  "intro-65": {
    url: null,
    duration: 2.299,
    text: "分一份给新朋友，一起试试吧！",
  },
  "intro-63": {
    url: null,
    duration: 2.512,
    text: "经过第一座珊瑚门，一起试试吧！",
  },
  "intro-64": {
    url: null,
    duration: 2.448,
    text: "转动左侧密码轮，一起试试吧！",
  },
  "intro-69": {
    url: null,
    duration: 2.239,
    text: "系好左边藤蔓，一起试试吧！",
  },
  "intro-68": {
    url: null,
    duration: 2.266,
    text: "装好第一份包裹，一起试试吧！",
  },
  "intro-66": {
    url: null,
    duration: 2.349,
    text: "制作第一张名牌，一起试试吧！",
  },
  "intro-67": {
    url: null,
    duration: 2.297,
    text: "叫醒第一只树蛙，一起试试吧！",
  },
  "intro-70": {
    url: null,
    duration: 2.295,
    text: "画一只红蝴蝶，一起试试吧！",
  },
  "intro-72": {
    url: null,
    duration: 2.575,
    text: "修好水壶上的字母，一起试试吧！",
  },
  "intro-73": {
    url: null,
    duration: 2.354,
    text: "修正向左的路牌，一起试试吧！",
  },
  "intro-71": {
    url: null,
    duration: 2.288,
    text: "欢迎来到小树屋，一起试试吧！",
  },
  "intro-74": {
    url: null,
    duration: 2.325,
    text: "修好花朵名牌，一起试试吧！",
  },
  "intro-76": {
    url: null,
    duration: 2.805,
    text: "删掉两颗多余的小点，一起试试吧！",
  },
  "intro-77": {
    url: null,
    duration: 2.105,
    text: "修好一声谢谢，一起试试吧！",
  },
  "intro-75": {
    url: null,
    duration: 2.947,
    text: "擦掉问候里的多余字母，一起试试吧！",
  },
  "intro-81": {
    url: null,
    duration: 2.268,
    text: "测试左侧车轮，一起试试吧！",
  },
  "intro-78": {
    url: null,
    duration: 2.446,
    text: "给一号机器人派件，一起试试吧！",
  },
  "intro-80": {
    url: null,
    duration: 2.56,
    text: "启动第一朵机械花，一起试试吧！",
  },
  "intro-79": {
    url: null,
    duration: 2.493,
    text: "把电梯送到上层，一起试试吧！",
  },
  "intro-83": {
    url: null,
    duration: 2.36,
    text: "点亮欢迎的小灯，一起试试吧！",
  },
  "intro-82": {
    url: null,
    duration: 2.22,
    text: "修好左臂编号，一起试试吧！",
  },
  "intro-84": {
    url: null,
    duration: 2.272,
    text: "折好一枚小书签，一起试试吧！",
  },
  "intro-88": {
    url: null,
    duration: 1.976,
    text: "写下一句你好，一起试试吧！",
  },
  "intro-87": {
    url: null,
    duration: 2.27,
    text: "折好自己的飞机，一起试试吧！",
  },
  "intro-86": {
    url: null,
    duration: 2.184,
    text: "放入红色花瓣，一起试试吧！",
  },
  "intro-89": {
    url: null,
    duration: 2.591,
    text: "合上喜欢的故事书，一起试试吧！",
  },
  "intro-85": {
    url: null,
    duration: 2.094,
    text: "翻开月亮故事，一起试试吧！",
  },
  "intro-90": {
    url: null,
    duration: 2.253,
    text: "等待第一束极光，一起试试吧！",
  },
  "intro-91": {
    url: null,
    duration: 2.59,
    text: "收集闪亮的小星星，一起试试吧！",
  },
  "intro-92": {
    url: null,
    duration: 2.334,
    text: "向未来的自己问好，一起试试吧！",
  },
  "intro-94": {
    url: null,
    duration: 2.538,
    text: "修好第一张新船票，一起试试吧！",
  },
  "intro-93": {
    url: null,
    duration: 2.411,
    text: "请豆豆站到镜头前，一起试试吧！",
  },
  "intro-95": {
    url: null,
    duration: 2.435,
    text: "记下自己学会的本领，一起试试吧！",
  },
};
