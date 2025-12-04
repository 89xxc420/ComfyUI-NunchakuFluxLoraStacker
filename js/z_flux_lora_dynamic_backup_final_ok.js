import { app } from "../../scripts/app.js";

console.log("★★★ z_flux_lora_dynamic.js: PHYSICAL WIDGET RECONSTRUCTION ★★★");

app.registerExtension({
    name: "nunchaku.flux_lora_dynamic_final_fix",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "FluxLoraMultiLoader_10") {
            nodeType["@visibleLoraCount"] = { type: "number", default: 1, min: 1, max: 10, step: 1 };
        }
    },

    nodeCreated(node) {
        if (node.comfyClass !== "FluxLoraMultiLoader_10") return;

        node.serialize_widgets = false;
        if (!node.properties) node.properties = {};
        if (node.properties["visibleLoraCount"] === undefined) node.properties["visibleLoraCount"] = 1;

        // ウィジェットキャッシュ初期化
        node.cachedWidgets = {};
        let cacheReady = false;

        // 全ウィジェットをキャッシュに退避
        const initCache = () => {
            if (cacheReady) return;
            
            // Python定義の順番: lora_name_1, lora_wt_1, ...
            const all = [...node.widgets];
            
            for (let i = 1; i <= 10; i++) {
                const wName = all.find(w => w.name === `lora_name_${i}`);
                const wWt = all.find(w => w.name === `lora_wt_${i}`);
                if (wName && wWt) {
                    node.cachedWidgets[i] = [wName, wWt];
                    // 型の念押し
                    wName.type = "combo";
                    wWt.type = "number";
                    // 個別サイズ計算は消す（標準に戻す）
                    if (wName.computeSize) delete wName.computeSize;
                    if (wWt.computeSize) delete wWt.computeSize;
                }
            }
            cacheReady = true;
        };

        // ボタン作成（または取得）
        const ensureButton = () => {
            const btnName = "🔢 Set LoRA Count";
            let btn = node.widgets.find(w => w.name === btnName);
            if (!btn) {
                btn = node.addWidget("button", btnName, null, () => {});
            }
            // コールバック設定
            btn.callback = () => {
                const current = node.properties["visibleLoraCount"];
                const val = prompt("Enter LoRA Count (1-10):", current);
                if (val !== null) {
                    const num = parseInt(val);
                    if (!isNaN(num) && num >= 1 && num <= 10) {
                        node.properties["visibleLoraCount"] = num;
                        node.updateLoraSlots();
                    }
                }
            };
            return btn;
        };

        node.updateLoraSlots = function() {
            if (!cacheReady) initCache();

            const count = parseInt(this.properties["visibleLoraCount"] || 1);
            const btn = ensureButton();

            // 1. 配列を物理的に再構築
            // ボタンのみにする
            this.widgets = [btn];

            // 必要な数だけキャッシュから追加
            for (let i = 1; i <= count; i++) {
                const pair = this.cachedWidgets[i];
                if (pair) {
                    this.widgets.push(pair[0]); // name
                    this.widgets.push(pair[1]); // wt
                }
            }

            // 2. 高さ計算（余白削除）
            // 物理的に存在するウィジェットのみで計算
            const HEADER_H = 60;
            const SLOT_H = 54; // 名前(26) + 重み(26) + マージン
            const PADDING = 20;
            
            // 厳密に「現在のカウント」分だけの高さを設定
            const targetH = HEADER_H + (count * SLOT_H) + PADDING;
            
            this.setSize([this.size[0], targetH]);
            
            // 描画更新
            if (app.canvas) app.canvas.setDirty(true, true);
        };

        node.onPropertyChanged = function(property, value) {
            if (property === "visibleLoraCount") {
                this.updateLoraSlots();
            }
        };

        // 初期化キック
        setTimeout(() => {
            initCache();
            node.updateLoraSlots();
        }, 100);
    }
});
