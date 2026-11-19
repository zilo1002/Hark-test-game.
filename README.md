# 半亩·丰收

> 走进田地收获、加工、装箱并出售，解锁新关卡、雇工和庄园。3D 种田，安卓 APK。

现有 90 关；当前 Android 版本为 6.1.5（versionCode 95）。只有安卓客户端，APK 在 [Releases](https://github.com/zilo1002/Hark-test-game./releases/latest) 下载。版本、测试状态和关卡说明见 [harvest/README.md](./harvest/README.md)。

## ✨ 功能亮点
- 90 关，每关一个新作物、新机器或新玩法，按用时得 1–3 颗星。
- 区域：花园 1–15、林场 16–30、湖畔 31–45、四季山谷 46–60、夜市 61–75、椰风海岛 76–90（芒果、菠萝、火龙果、椰子、小龙虾、扇贝、海带，芒果班戟 / 椰子冻要两次加工）。
- 装扮庄园四页（花园庄园、林场牧场、湖畔酒庄、椰风海岛），用星星一件件建；星星商店装饰；庄园地图（四季山谷、夜市）可兑换切换。
- 机器两档升级；链式专员（两台机器串联只雇一个）；售货员一次拿满、一放放满，还换大铲车。
- 木台：原料一块平木台，加工品另一块平木台，踩上去搬货；柜台缺货时农工优先送柜台。
- 毛绒风宠物，农场主与员工用带骨骼的 3D 角色。

## 🔒 隐私与安全
- 不收集任何数据：没有后端、没有统计脚本、没有外部请求，完全离线运行。
- 存档只保存在手机本机，卸载 App 会同时清掉存档；设置里可一键清空存档。

## 🗂 项目结构
```
.
├── harvest/                游戏源码（打包进 APK，版本说明见其 README.md）
│   ├── index.html
│   ├── style.css
│   ├── js/                 关卡、工人 AI、机器、商店、庄园
│   ├── models/             3D 模型
│   ├── vendor/             Three.js 本地文件
│   └── sim/                平衡与专项检查（balance.mjs 等）
├── android-harvest/        安卓 WebView 壳
│   ├── apk-patch/          APK 专属改动（apply.py）
│   ├── overrides/          APK 专属美术
│   └── build-apk.sh        打包 APK
├── package.json            {"type": "module"}（让 node 跑 sim）
└── README.md
```

## 🛠 技术栈
- 原生 JavaScript（ES Modules）+ Three.js，Android WebView 壳
- 发布：推送到 main 后 GitHub Actions 构建 APK 并发布到 Releases

## 💡 使用提示
- **调平衡**：改 `harvest/js/config.js`，再跑 `node harvest/sim/balance.mjs`。
- **安卓更新**：去 Releases 下载最新 APK 覆盖安装，存档保留。
- **版本号逢 10 进位**：4.9.9 之后是 5.0.0；5.1.9 之后是 5.2.0。

## License
- 奶牛 / 绵羊 3D 模型来自 Quaternius 的 Farm Animal Pack（CC0，https://quaternius.com/packs/farmanimal.html）。
